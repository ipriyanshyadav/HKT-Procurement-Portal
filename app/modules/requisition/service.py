from __future__ import annotations

import re
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from loguru import logger
from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.constants import AuditAction
from app.core.exceptions import AppException, ForbiddenError, NotFoundError, ValidationError
from app.core.metrics import pr_approval_duration_hours, pr_created_total
from app.core.redis_client import RedisKeys, get_redis_client
from app.db.enums import POStatus, PRSource, PRStatus, VendorStatus
from app.events.publisher import OutboxPublisher
from app.modules.approval_rules.service import rules_engine
from app.modules.audit.service import audit_service
from app.modules.organization.models import BusinessUnit, CostCenter, Organization
from app.modules.purchase_order.models import PoLine, PurchaseOrder
from app.modules.purchase_order.repository import purchase_order_repository
from app.modules.requisition.fsm import validate_pr_transition
from app.modules.requisition.models import Requisition, RequisitionLine
from app.modules.requisition.repository import RequisitionRepository, requisition_repository
from app.modules.requisition.schemas import (
    BudgetCheckResult,
    BuyerSelectionItem,
    IndentCartTransferRequest,
    IndentorTrackingResponse,
    IndentTransferRequest,
    PRCreateRequest,
    PRLineItemRequest,
    PRSplitRequest,
    PRUpdateRequest,
)
from app.modules.user.models import User
from app.modules.vendor.models import Vendor
from app.modules.workflow.models import WorkflowTask
from app.modules.workflow.service import workflow_engine


class RequisitionService:

    def __init__(self, repo: RequisitionRepository = requisition_repository):
        self.repo = repo

    async def create(
        self,
        db: AsyncSession,
        data: PRCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Requisition:
        pr_number = await self._generate_pr_number(db, data.business_unit_id, org_id)

        pr = Requisition(
            org_id=org_id,
            pr_number=pr_number,
            title=data.title,
            description=data.description,
            source=PRSource.MANUAL,
            status=PRStatus.DRAFT,
            procurement_type=data.procurement_type,
            requestor_id=actor_id,
            business_unit_id=data.business_unit_id,
            plant_id=data.plant_id,
            department_id=data.department_id,
            cost_center_id=data.cost_center_id,
            category_id=data.category_id,
            currency=data.currency,
            estimated_value=Decimal("0.0"),
            is_emergency=data.is_emergency,
            is_capex=data.is_capex,
            required_by_date=data.required_by_date,
            delivery_location_id=data.delivery_location_id,
            created_by=actor_id,
            updated_by=actor_id,
        )
        db.add(pr)
        await db.flush()

        total_value = Decimal("0.0")
        for line_data in data.lines:
            line_total = line_data.quantity * line_data.estimated_unit_price
            total_value += line_total
            line = RequisitionLine(
                org_id=org_id,
                requisition_id=pr.id,
                line_number=line_data.line_number,
                item_description=line_data.item_description,
                item_code=line_data.item_code,
                category_id=line_data.category_id or data.category_id,
                uom_id=line_data.uom_id,
                quantity=line_data.quantity,
                estimated_unit_price=line_data.estimated_unit_price,
                hsn_code=line_data.hsn_code,
                specifications=line_data.specifications,
                required_by_date=line_data.required_by_date,
                delivery_location_id=line_data.delivery_location_id or data.delivery_location_id,
            )
            db.add(line)

        pr.estimated_value = total_value
        await db.flush()

        await self._invalidate_pr_cache(org_id)
        pr_created_total.labels(
            org_id=str(org_id),
            bu_id=str(data.business_unit_id),
        ).inc()
        await audit_service.log(
            db,
            "REQUISITION",
            pr.id,
            AuditAction.CREATED,
            actor_id,
            org_id,
            new_values={"pr_number": pr_number, "status": PRStatus.DRAFT.value, "title": pr.title},
        )
        return pr

    async def get_by_id(self, db: AsyncSession, pr_id: UUID, org_id: UUID) -> Requisition:
        pr = await self.repo.get(db, pr_id, org_id)
        if not pr:
            raise NotFoundError(f"Requisition {pr_id} not found")
        if pr.status == PRStatus.CONVERTED and not getattr(pr, "po_id", None):
            stmt = select(PurchaseOrder.id, PurchaseOrder.po_number).where(
                PurchaseOrder.source_pr_id == pr.id,
                PurchaseOrder.org_id == org_id,
            ).limit(1)
            res = await db.execute(stmt)
            po_row = res.first()
            if po_row:
                pr.po_id = po_row[0]
                pr.po_number = po_row[1]
        return pr

    async def list_prs(
        self,
        db: AsyncSession,
        org_id: UUID,
        status: str | None = None,
        business_unit_id: UUID | None = None,
        category_id: UUID | None = None,
        requestor_id: UUID | None = None,
        search: str | None = None,
        scope: str = "all",
        current_user: User | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[Requisition], int]:
        # Enforce upper bound to prevent full-table dumps
        limit = min(limit, settings.MAX_LIST_LIMIT)
        req_user_id = requestor_id
        bu_filter = business_unit_id

        if scope == "mine" and current_user:
            req_user_id = current_user.id
        elif scope == "bu" and current_user and current_user.business_unit_id:
            bu_filter = current_user.business_unit_id

        return await self.repo.list(
            db,
            org_id=org_id,
            status=status,
            business_unit_id=bu_filter,
            category_id=category_id,
            requestor_id=req_user_id,
            search=search,
            skip=skip,
            limit=limit,
        )

    async def update(
        self,
        db: AsyncSession,
        pr_id: UUID,
        data: PRUpdateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Requisition:
        pr = await self.get_by_id(db, pr_id, org_id)
        if pr.status != PRStatus.DRAFT:
            raise AppException(f"Cannot edit PR in {pr.status} state", "PR_NOT_IN_DRAFT")
        if pr.requestor_id != actor_id and pr.created_by != actor_id:
            raise ForbiddenError("Only creator can edit draft PR")

        if data.title is not None:
            pr.title = data.title
        if data.description is not None:
            pr.description = data.description
        if data.procurement_type is not None:
            pr.procurement_type = data.procurement_type
        if data.business_unit_id is not None:
            pr.business_unit_id = data.business_unit_id
        if data.plant_id is not None:
            pr.plant_id = data.plant_id
        if data.department_id is not None:
            pr.department_id = data.department_id
        if data.cost_center_id is not None:
            pr.cost_center_id = data.cost_center_id
        if data.category_id is not None:
            pr.category_id = data.category_id
        if data.currency is not None:
            pr.currency = data.currency
        if data.is_emergency is not None:
            pr.is_emergency = data.is_emergency
        if data.is_capex is not None:
            pr.is_capex = data.is_capex
        if data.required_by_date is not None:
            pr.required_by_date = data.required_by_date
        if data.delivery_location_id is not None:
            pr.delivery_location_id = data.delivery_location_id

        if data.lines is not None:
            await self.repo.delete_lines(db, pr.id, org_id)
            total = Decimal("0.0")
            for line_data in data.lines:
                line_total = line_data.quantity * line_data.estimated_unit_price
                total += line_total
                line = RequisitionLine(
                    org_id=org_id,
                    requisition_id=pr.id,
                    line_number=line_data.line_number,
                    item_description=line_data.item_description,
                    item_code=line_data.item_code,
                    category_id=line_data.category_id or pr.category_id,
                    uom_id=line_data.uom_id,
                    quantity=line_data.quantity,
                    estimated_unit_price=line_data.estimated_unit_price,
                    hsn_code=line_data.hsn_code,
                    specifications=line_data.specifications,
                    required_by_date=line_data.required_by_date,
                    delivery_location_id=line_data.delivery_location_id or pr.delivery_location_id,
                )
                db.add(line)
            pr.estimated_value = total

        pr.updated_by = actor_id
        await self.repo.update(db, pr)
        await self._invalidate_pr_cache(org_id)
        await audit_service.log(
            db,
            "REQUISITION",
            pr.id,
            AuditAction.REVISED,
            actor_id,
            org_id,
            new_values={"title": pr.title, "estimated_value": str(pr.estimated_value)},
        )
        return pr

    async def submit(
        self,
        db: AsyncSession,
        pr_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> Requisition:
        pr = await self.get_by_id(db, pr_id, org_id)
        if pr.requestor_id != actor_id and pr.created_by != actor_id:
            raise ForbiddenError("Only PR creator can submit")

        validate_pr_transition(pr.status, PRStatus.SUBMITTED)

        # Synchronous budget check
        budget_check = await self._check_budget(
            db,
            cost_center_id=pr.cost_center_id,
            amount=pr.estimated_value,
            org_id=org_id,
            bu_id=pr.business_unit_id,
            category_id=pr.category_id,
        )
        pr.budget_check_status = budget_check.status
        pr.budget_reserved_amount = pr.estimated_value

        entity_context = {
            "amount": float(pr.estimated_value),
            "bu_id": str(pr.business_unit_id),
            "business_unit_id": str(pr.business_unit_id),
            "category_id": str(pr.category_id),
            "is_capex": pr.is_capex,
            "requirement_type": pr.procurement_type.value if hasattr(pr.procurement_type, "value") else str(pr.procurement_type),
            "created_by": str(actor_id),
            "submitted_by": str(actor_id),
        }

        # Resolve approval rule
        rule = await rules_engine.find_matching_rule(db, "PR", entity_context, org_id)
        if not rule:
            # Rule resolution pending alert
            pr.status = PRStatus.SUBMITTED
            await OutboxPublisher.publish(
                db,
                "procurement.pr",
                "pr.rule.unmatched",
                {"pr_id": str(pr.id), "pr_number": pr.pr_number, "org_id": str(org_id)},
                org_id,
            )
            await audit_service.log(
                db, "REQUISITION", pr.id, "PR_RULE_UNMATCHED", actor_id, org_id
            )
        else:
            # Instantiate workflow engine step
            pr.status = PRStatus.PENDING_APPROVAL
            await workflow_engine.instantiate(
                db,
                template_code=rule.workflow_template_code,
                entity_type="REQUISITION",
                entity_id=pr.id,
                entity_context=entity_context,
                org_id=org_id,
                actor_id=actor_id,
            )

        pr.updated_by = actor_id
        await self.repo.update(db, pr)
        await self._invalidate_pr_cache(org_id)
        await OutboxPublisher.publish(
            db,
            "procurement.pr",
            "pr.submitted",
            {"pr_id": str(pr.id), "pr_number": pr.pr_number, "status": pr.status.value},
            org_id,
        )
        await audit_service.log(
            db,
            "REQUISITION",
            pr.id,
            AuditAction.PR_SUBMITTED,
            actor_id,
            org_id,
            new_values={"pr_number": pr.pr_number, "status": pr.status.value},
        )
        return pr

    async def withdraw(
        self,
        db: AsyncSession,
        pr_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> Requisition:
        pr = await self.get_by_id(db, pr_id, org_id)
        if pr.requestor_id != actor_id and pr.created_by != actor_id:
            raise ForbiddenError("Only PR creator can withdraw")

        validate_pr_transition(pr.status, PRStatus.WITHDRAWN)

        # Release reserved budget
        pr.budget_reserved_amount = Decimal("0.0")
        pr.status = PRStatus.WITHDRAWN
        pr.updated_by = actor_id
        await self.repo.update(db, pr)

        # Invalidate cache
        await self._invalidate_pr_cache(org_id)
        await OutboxPublisher.publish(
            db,
            "procurement.pr",
            "pr.withdrawn",
            {"pr_id": str(pr.id), "pr_number": pr.pr_number},
            org_id,
        )
        await audit_service.log(
            db,
            "REQUISITION",
            pr.id,
            "PR_WITHDRAWN",
            actor_id,
            org_id,
            new_values={"status": PRStatus.WITHDRAWN.value},
        )
        return pr

    async def approve(
        self,
        db: AsyncSession,
        pr_id: UUID,
        task_id: UUID | None,
        comment: str | None,
        actor_id: UUID,
        org_id: UUID,
    ) -> Requisition:
        pr = await self.get_by_id(db, pr_id, org_id)

        # Enforce Maker-Checker: Creator cannot approve their own PR
        if pr.requestor_id == actor_id or pr.created_by == actor_id:
            raise ForbiddenError("Maker-checker violation: PR creator cannot approve their own PR")

        validate_pr_transition(pr.status, PRStatus.APPROVED)

        # If task_id provided, complete the task
        if task_id:
            task_stmt = select(WorkflowTask).where(
                WorkflowTask.id == task_id,
                WorkflowTask.org_id == org_id,
            )
            task_res = await db.execute(task_stmt)
            task = task_res.scalar_one_or_none()
            if task and task.assigned_to == actor_id:
                await workflow_engine.advance(
                    db,
                    task_id=task_id,
                    action="APPROVE",
                    comment=comment or "Approved",
                    actor_id=actor_id,
                    org_id=org_id,
                )

        pr.status = PRStatus.APPROVED
        pr.approved_at = datetime.now(UTC)
        pr.updated_by = actor_id
        await self.repo.update(db, pr)

        if pr.created_at:
            c_at = pr.created_at if pr.created_at.tzinfo is not None else pr.created_at.replace(tzinfo=UTC)
            duration_hours = max(0.0, (pr.approved_at - c_at).total_seconds() / 3600.0)
            pr_approval_duration_hours.labels(org_id=str(org_id)).observe(duration_hours)

        await self._invalidate_pr_cache(org_id)
        await OutboxPublisher.publish(
            db,
            "procurement.pr",
            "pr.approved",
            {"pr_id": str(pr.id), "pr_number": pr.pr_number},
            org_id,
        )
        await audit_service.log(
            db,
            "REQUISITION",
            pr.id,
            AuditAction.APPROVED,
            actor_id,
            org_id,
            new_values={"status": PRStatus.APPROVED.value, "approved_at": pr.approved_at.isoformat()},
        )
        return pr

    async def reject(
        self,
        db: AsyncSession,
        pr_id: UUID,
        task_id: UUID | None,
        comment: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> Requisition:
        pr = await self.get_by_id(db, pr_id, org_id)
        validate_pr_transition(pr.status, PRStatus.REJECTED)

        if task_id:
            await workflow_engine.advance(
                db,
                task_id=task_id,
                action="REJECT",
                comment=comment,
                actor_id=actor_id,
                org_id=org_id,
            )

        # Release reserved budget
        pr.budget_reserved_amount = Decimal("0.0")
        pr.status = PRStatus.REJECTED
        pr.updated_by = actor_id
        await self.repo.update(db, pr)

        await self._invalidate_pr_cache(org_id)
        await OutboxPublisher.publish(
            db,
            "procurement.pr",
            "pr.rejected",
            {"pr_id": str(pr.id), "pr_number": pr.pr_number, "reason": comment},
            org_id,
        )
        await audit_service.log(
            db,
            "REQUISITION",
            pr.id,
            AuditAction.PR_REJECTED,
            actor_id,
            org_id,
            new_values={"status": PRStatus.REJECTED.value, "comment": comment},
        )
        return pr

    async def amend(
        self,
        db: AsyncSession,
        pr_id: UUID,
        data: PRUpdateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Requisition:
        pr = await self.get_by_id(db, pr_id, org_id)
        if pr.status != PRStatus.APPROVED:
            raise AppException("Only approved PRs can be amended", "PR_NOT_APPROVED")

        old_value = pr.estimated_value or Decimal("1.0")

        # Check for critical field changes
        critical_changed = (
            (data.category_id is not None and data.category_id != pr.category_id)
            or (data.business_unit_id is not None and data.business_unit_id != pr.business_unit_id)
            or (data.cost_center_id is not None and data.cost_center_id != pr.cost_center_id)
            or (data.procurement_type is not None and data.procurement_type != pr.procurement_type)
        )

        # Apply field changes
        if data.title is not None:
            pr.title = data.title
        if data.description is not None:
            pr.description = data.description
        if data.category_id is not None:
            pr.category_id = data.category_id
        if data.business_unit_id is not None:
            pr.business_unit_id = data.business_unit_id
        if data.cost_center_id is not None:
            pr.cost_center_id = data.cost_center_id
        if data.procurement_type is not None:
            pr.procurement_type = data.procurement_type

        new_value = old_value
        if data.lines is not None:
            await self.repo.delete_lines(db, pr.id, org_id)
            new_total = Decimal("0.0")
            for line_data in data.lines:
                line_total = line_data.quantity * line_data.estimated_unit_price
                new_total += line_total
                line = RequisitionLine(
                    org_id=org_id,
                    requisition_id=pr.id,
                    line_number=line_data.line_number,
                    item_description=line_data.item_description,
                    item_code=line_data.item_code,
                    category_id=line_data.category_id or pr.category_id,
                    uom_id=line_data.uom_id,
                    quantity=line_data.quantity,
                    estimated_unit_price=line_data.estimated_unit_price,
                    hsn_code=line_data.hsn_code,
                    specifications=line_data.specifications,
                    required_by_date=line_data.required_by_date,
                    delivery_location_id=line_data.delivery_location_id or pr.delivery_location_id,
                )
                db.add(line)
            pr.estimated_value = new_total
            new_value = new_total

        pct_change = abs(float(new_value - old_value)) / float(old_value) if old_value > 0 else 1.0

        if pct_change > 0.10 or critical_changed:
            validate_pr_transition(pr.status, PRStatus.AMENDMENT_PENDING)
            pr.status = PRStatus.AMENDMENT_PENDING
        else:
            pr.status = PRStatus.APPROVED

        pr.updated_by = actor_id
        await self.repo.update(db, pr)
        await self._invalidate_pr_cache(org_id)
        await audit_service.log(
            db,
            "REQUISITION",
            pr.id,
            AuditAction.REVISED,
            actor_id,
            org_id,
            new_values={"status": pr.status.value, "pct_change": pct_change},
        )
        return pr

    async def merge_prs(
        self,
        db: AsyncSession,
        pr_ids: list[UUID],
        actor_id: UUID,
        org_id: UUID,
        merged_title: str | None = None,
    ) -> Requisition:
        if len(pr_ids) < 2:
            raise ValidationError("MERGE_REQUIRES_TWO", "At least 2 PRs required for merge")

        prs = [await self.get_by_id(db, pid, org_id) for pid in pr_ids]

        bu_ids = {p.business_unit_id for p in prs}
        if len(bu_ids) > 1:
            raise AppException("All PRs must belong to same business unit", "MERGE_DIFFERENT_BU")

        cat_ids = {p.category_id for p in prs}
        if len(cat_ids) > 1:
            raise AppException("All PRs must belong to same category", "MERGE_DIFFERENT_CATEGORY")

        first_pr = prs[0]
        title = merged_title or f"Merged PR - {datetime.now(UTC).strftime('%Y%m%d%H%M')}"
        pr_number = await self._generate_pr_number(db, first_pr.business_unit_id, org_id)

        merged_pr = Requisition(
            org_id=org_id,
            pr_number=pr_number,
            title=title,
            description=f"Merged from PRs: {', '.join(p.pr_number for p in prs)}",
            source=PRSource.MANUAL,
            status=PRStatus.APPROVED,
            procurement_type=first_pr.procurement_type,
            requestor_id=actor_id,
            business_unit_id=first_pr.business_unit_id,
            plant_id=first_pr.plant_id,
            department_id=first_pr.department_id,
            cost_center_id=first_pr.cost_center_id,
            category_id=first_pr.category_id,
            currency=first_pr.currency,
            estimated_value=Decimal("0.0"),
            is_capex=any(p.is_capex for p in prs),
            merged_from=[p.id for p in prs],
            approved_at=datetime.now(UTC),
            created_by=actor_id,
            updated_by=actor_id,
        )
        db.add(merged_pr)
        await db.flush()

        # Merge line items: combine quantities for matching (item_code, item_description, uom_id)
        merged_lines_map: dict[tuple[str, UUID], RequisitionLine] = {}
        line_num = 1
        total_val = Decimal("0.0")

        for pr in prs:
            lines = await self.repo.get_lines(db, pr.id, org_id)
            for line in lines:
                key = (line.item_code or line.item_description, line.uom_id)
                if key in merged_lines_map:
                    merged_lines_map[key].quantity += line.quantity
                else:
                    new_line = RequisitionLine(
                        org_id=org_id,
                        requisition_id=merged_pr.id,
                        line_number=line_num,
                        item_description=line.item_description,
                        item_code=line.item_code,
                        category_id=line.category_id,
                        uom_id=line.uom_id,
                        quantity=line.quantity,
                        estimated_unit_price=line.estimated_unit_price,
                        hsn_code=line.hsn_code,
                        specifications=line.specifications,
                    )
                    merged_lines_map[key] = new_line
                    line_num += 1

        for ml in merged_lines_map.values():
            db.add(ml)
            total_val += ml.quantity * ml.estimated_unit_price

        merged_pr.estimated_value = total_val

        # Transition source PRs
        for pr in prs:
            pr.status = PRStatus.IN_SOURCING
            pr.updated_by = actor_id
            await self.repo.update(db, pr)

        await self._invalidate_pr_cache(org_id)
        await OutboxPublisher.publish(
            db,
            "procurement.pr",
            "pr.merged",
            {
                "merged_pr_id": str(merged_pr.id),
                "merged_pr_number": merged_pr.pr_number,
                "source_pr_ids": [str(p.id) for p in prs],
            },
            org_id,
        )
        await audit_service.log(
            db,
            "REQUISITION",
            merged_pr.id,
            "PR_MERGED",
            actor_id,
            org_id,
            new_values={"source_prs": [p.pr_number for p in prs]},
        )
        return merged_pr

    async def split_pr(
        self,
        db: AsyncSession,
        pr_id: UUID,
        data: PRSplitRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> list[Requisition]:
        source_pr = await self.get_by_id(db, pr_id, org_id)
        if source_pr.status != PRStatus.APPROVED:
            raise AppException("PR must be in APPROVED state to split", "PR_NOT_APPROVED")

        source_lines = await self.repo.get_lines(db, pr_id, org_id)
        lines_by_number = {line.line_number: line for line in source_lines}

        child_prs: list[Requisition] = []
        for split in data.splits:
            selected_lines = [lines_by_number[num] for num in split.line_numbers if num in lines_by_number]
            if not selected_lines:
                raise AppException(f"No lines found for line numbers {split.line_numbers}", "INVALID_SPLIT")

            child_pr_number = await self._generate_pr_number(db, source_pr.business_unit_id, org_id)
            child_pr = Requisition(
                org_id=org_id,
                pr_number=child_pr_number,
                title=split.title or f"Split from {source_pr.pr_number}",
                description=f"Split from PR {source_pr.pr_number}",
                source=source_pr.source,
                status=PRStatus.APPROVED,
                procurement_type=source_pr.procurement_type,
                requestor_id=source_pr.requestor_id,
                business_unit_id=source_pr.business_unit_id,
                plant_id=source_pr.plant_id,
                cost_center_id=split.cost_center_id or source_pr.cost_center_id,
                category_id=split.category_id,
                currency=source_pr.currency,
                is_capex=source_pr.is_capex,
                budget_check_status="PASSED",
                split_from=source_pr.id,
                approved_at=datetime.now(UTC),
                created_by=actor_id,
                updated_by=actor_id,
            )
            db.add(child_pr)
            await db.flush()

            child_total = Decimal("0.0")
            for idx, sl in enumerate(selected_lines, 1):
                sl_total = sl.quantity * sl.estimated_unit_price
                child_total += sl_total
                cline = RequisitionLine(
                    org_id=org_id,
                    requisition_id=child_pr.id,
                    line_number=idx,
                    item_description=sl.item_description,
                    item_code=sl.item_code,
                    category_id=split.category_id,
                    uom_id=sl.uom_id,
                    quantity=sl.quantity,
                    estimated_unit_price=sl.estimated_unit_price,
                    hsn_code=sl.hsn_code,
                    specifications=sl.specifications,
                )
                db.add(cline)

            child_pr.estimated_value = child_total
            child_prs.append(child_pr)

        source_pr.status = PRStatus.SPLIT
        source_pr.split_into = [cp.id for cp in child_prs]
        source_pr.updated_by = actor_id
        await self.repo.update(db, source_pr)

        await self._invalidate_pr_cache(org_id)
        await OutboxPublisher.publish(
            db,
            "procurement.pr",
            "pr.split",
            {
                "source_pr_id": str(source_pr.id),
                "child_pr_ids": [str(cp.id) for cp in child_prs],
            },
            org_id,
        )
        await audit_service.log(
            db,
            "REQUISITION",
            source_pr.id,
            "PR_SPLIT",
            actor_id,
            org_id,
            new_values={"split_into": [str(cp.id) for cp in child_prs]},
        )
        return child_prs

    async def convert_to_rfq(
        self,
        db: AsyncSession,
        pr_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> Requisition:
        pr = await self.get_by_id(db, pr_id, org_id)
        if pr.status != PRStatus.APPROVED:
            raise AppException("Only approved PR can be converted to RFQ", "PR_NOT_APPROVED")

        validate_pr_transition(pr.status, PRStatus.IN_SOURCING)
        pr.status = PRStatus.IN_SOURCING
        pr.updated_by = actor_id
        await self.repo.update(db, pr)

        await self._invalidate_pr_cache(org_id)
        await OutboxPublisher.publish(
            db,
            "procurement.pr",
            "pr.converted_to_rfq",
            {"pr_id": str(pr.id), "pr_number": pr.pr_number},
            org_id,
        )
        await audit_service.log(
            db,
            "REQUISITION",
            pr.id,
            "PR_CONVERTED_TO_RFQ",
            actor_id,
            org_id,
            new_values={"status": PRStatus.IN_SOURCING.value},
        )
        return pr

    async def convert_to_po(
        self,
        db: AsyncSession,
        pr_id: UUID,
        actor_id: UUID,
        org_id: UUID,
        vendor_id: UUID | None = None,
    ) -> Requisition:
        pr = await self.get_by_id(db, pr_id, org_id)
        if pr.status not in (PRStatus.APPROVED, PRStatus.IN_SOURCING):
            raise AppException("PR must be APPROVED or IN_SOURCING to convert to PO", "INVALID_STATE")

        validate_pr_transition(pr.status, PRStatus.CONVERTED)

        # Resolve vendor
        target_vendor_id = vendor_id
        if not target_vendor_id:
            stmt = select(Vendor.id).where(Vendor.org_id == org_id).limit(1)
            res = await db.execute(stmt)
            target_vendor_id = res.scalar_one_or_none()
            if not target_vendor_id:
                new_vendor = Vendor(
                    org_id=org_id,
                    company_name="Standard Vendor",
                    primary_email=f"vendor_{org_id.hex[:6]}@example.com",
                    status=VendorStatus.ACTIVE,
                    created_by=actor_id,
                )
                db.add(new_vendor)
                await db.flush()
                target_vendor_id = new_vendor.id

        po_number = await purchase_order_repository.generate_po_number(db, pr.business_unit_id, org_id)

        po_lines = []
        total_val = Decimal("0.0")
        for idx, line in enumerate(pr.lines, 1):
            line_total = line.quantity * line.estimated_unit_price
            total_val += line_total
            po_lines.append(
                PoLine(
                    org_id=org_id,
                    line_number=idx,
                    item_description=line.item_description,
                    item_code=line.item_code,
                    uom_id=line.uom_id,
                    ordered_quantity=line.quantity,
                    unit_price=line.estimated_unit_price,
                    awarded_unit_price=line.estimated_unit_price,
                    hsn_code=line.hsn_code,
                    tax_rate=Decimal("0.0"),
                    open_quantity=line.quantity,
                    received_quantity=Decimal("0.0"),
                    invoiced_quantity=Decimal("0.0"),
                    delivery_date=line.required_by_date or pr.required_by_date,
                )
            )

        po = PurchaseOrder(
            org_id=org_id,
            po_number=po_number,
            title=f"PO from {pr.pr_number}: {pr.title}",
            vendor_id=target_vendor_id,
            source_pr_id=pr.id,
            status=POStatus.DRAFT,
            business_unit_id=pr.business_unit_id,
            plant_id=pr.plant_id,
            category_id=pr.category_id,
            currency=pr.currency,
            total_value=total_val if total_val > 0 else pr.estimated_value,
            delivery_location_id=pr.delivery_location_id,
            expected_delivery_date=pr.required_by_date,
            buyer_id=actor_id,
            created_by=actor_id,
            updated_by=actor_id,
            lines=po_lines,
        )
        await purchase_order_repository.create(db, po)
        await db.flush()

        # Budget is transferred to PO
        pr.budget_reserved_amount = Decimal("0.0")
        pr.status = PRStatus.CONVERTED
        pr.updated_by = actor_id
        await self.repo.update(db, pr)

        # Attach po details for response
        pr.po_id = po.id
        pr.po_number = po.po_number

        await self._invalidate_pr_cache(org_id)
        await OutboxPublisher.publish(
            db,
            "procurement.pr",
            "pr.converted_to_po",
            {"pr_id": str(pr.id), "pr_number": pr.pr_number, "po_id": str(po.id), "po_number": po.po_number},
            org_id,
        )
        await audit_service.log(
            db,
            "REQUISITION",
            pr.id,
            "PR_CONVERTED_TO_PO",
            actor_id,
            org_id,
            new_values={"status": PRStatus.CONVERTED.value, "po_id": str(po.id), "po_number": po.po_number},
        )
        return pr

    async def _generate_pr_number(
        self,
        db: AsyncSession,
        bu_id: UUID,
        org_id: UUID,
    ) -> str:
        bu_stmt = select(BusinessUnit).where(BusinessUnit.id == bu_id, BusinessUnit.org_id == org_id)
        bu_res = await db.execute(bu_stmt)
        bu = bu_res.scalar_one_or_none()
        bu_code = bu.code.upper() if bu else "CORP"
        year = datetime.now(UTC).year
        clean_code = re.sub(r"[^a-zA-Z0-9_]", "_", bu_code.lower())
        seq_name = f"seq_pr_{clean_code}_{year}"

        try:
            await db.execute(text(f"CREATE SEQUENCE IF NOT EXISTS {seq_name} START WITH 1 INCREMENT BY 1;"))
            result = await db.execute(text(f"SELECT nextval('{seq_name}')"))
            n = result.scalar()
        except Exception:
            result = await db.execute(text("SELECT nextval('seq_pr_number')"))
            n = result.scalar()

        return f"{bu_code}-PR-{year}-{str(n).zfill(6)}"

    async def _check_budget(
        self,
        db: AsyncSession,
        cost_center_id: UUID,
        amount: Decimal,
        org_id: UUID,
        bu_id: UUID | None = None,
        category_id: UUID | None = None,
        mode: str | None = None,
    ) -> BudgetCheckResult:
        # Determine budget mode: org settings -> overrides -> default
        org_stmt = select(Organization).where(Organization.id == org_id)
        org_res = await db.execute(org_stmt)
        org = org_res.scalar_one_or_none()
        org_settings = org.settings if org and org.settings else {}

        budget_config = org_settings.get("budget_check_config", {})
        determined_mode = mode or budget_config.get("default_mode", "soft")

        # Check overrides
        for override in budget_config.get("overrides", []):
            if bu_id and override.get("bu_id") == str(bu_id):
                determined_mode = override.get("mode", determined_mode)
            if category_id and override.get("category_id") == str(category_id):
                determined_mode = override.get("mode", determined_mode)

        # Check cost center available budget from DB
        cc_stmt = select(CostCenter).where(CostCenter.id == cost_center_id, CostCenter.org_id == org_id)
        cc_res = await db.execute(cc_stmt)
        cost_center = cc_res.scalar_one_or_none()

        if cost_center is not None:
            available_budget = cost_center.available_budget
        else:
            cost_center_limits = org_settings.get("cost_center_budgets", {})
            available_budget = Decimal(str(cost_center_limits.get(str(cost_center_id), "100000000.0")))

        # If available budget is exceeded
        if available_budget < amount or budget_config.get("force_insufficient", False):
            if determined_mode == "hard":
                raise AppException(
                    f"Insufficient budget. Available: {available_budget}, Requested: {amount}",
                    "BUDGET_INSUFFICIENT",
                    {"available_budget": str(available_budget), "requested": str(amount)},
                )
            return BudgetCheckResult(
                status="WARNING",
                available=available_budget,
                requested=amount,
                message="Budget warning: requested amount exceeds available budget",
            )

        return BudgetCheckResult(
            status="SUFFICIENT",
            available=available_budget,
            requested=amount,
            message="Budget sufficient",
        )

    async def check_budget_preflight(
        self,
        db: AsyncSession,
        cost_center_id: UUID,
        amount: Decimal,
        org_id: UUID,
        bu_id: UUID | None = None,
        category_id: UUID | None = None,
    ) -> BudgetCheckResult:
        """Pre-flight check of budget availability before PR submission."""
        try:
            return await self._check_budget(
                db,
                cost_center_id=cost_center_id,
                amount=amount,
                org_id=org_id,
                bu_id=bu_id,
                category_id=category_id,
            )
        except AppException as exc:
            details = exc.details or {}
            avail = Decimal(str(details.get("available_budget", "0.0")))
            return BudgetCheckResult(
                status="BLOCKED",
                available=avail,
                requested=amount,
                message=exc.message,
            )

    async def _invalidate_pr_cache(self, org_id: UUID) -> None:
        try:
            r = get_redis_client()
            for status_val in [
                "DRAFT", "SUBMITTED", "PENDING_APPROVAL", "APPROVED", "REJECTED",
                "WITHDRAWN", "IN_SOURCING", "CONVERTED", "CANCELLED", "UNMAPPED",
                "AMENDMENT_PENDING", "SPLIT"
            ]:
                await r.delete(RedisKeys.pr_count_cache(org_id, status_val))
            await r.aclose()
        except Exception as e:
            logger.warning(f"Failed to invalidate PR cache for org {org_id}: {e}")

    async def create_indent(
        self,
        db: AsyncSession,
        data: IndentTransferRequest,
        actor: User,
        org_id: UUID,
    ) -> Requisition:
        # Re-use create
        pr = await self.create(db, data, actor.id, org_id)
        pr.is_indent = True
        pr.indentor_id = actor.id
        pr.assigned_buyer_id = data.assigned_buyer_id
        pr.indent_notes = data.indent_notes
        pr.source = PRSource.INDENT_CART
        pr.status = PRStatus.SUBMITTED
        if not pr.assigned_buyer_id and settings.INDENT_AUTO_ASSIGN_BUYER:
            buyers = await self.get_available_buyers(db, org_id, data.category_id, data.business_unit_id)
            if buyers:
                pr.assigned_buyer_id = buyers[0].id
        await self.repo.update(db, pr)
        await audit_service.log(
            db,
            "REQUISITION",
            pr.id,
            AuditAction.INDENT_TRANSFERRED,
            actor.id,
            org_id,
            new_values={
                "pr_number": pr.pr_number,
                "status": pr.status.value,
                "assigned_buyer_id": str(pr.assigned_buyer_id) if pr.assigned_buyer_id else None,
            },
        )
        return pr

    async def create_indent_from_cart(
        self,
        db: AsyncSession,
        data: IndentCartTransferRequest,
        actor: User,
        org_id: UUID,
    ) -> Requisition:
        from app.modules.catalog.repository import cart_item_repository, user_cart_repository
        from app.modules.master_data.models import Category, ItemMaster, UomMaster
        from app.modules.requisition.schemas import IndentTransferRequest, PRLineItemRequest

        cart = await user_cart_repository.get_active_cart(db, org_id, actor.id)
        if not cart:
            raise ValidationError("No active cart found to transfer.")
        items = await cart_item_repository.list_by_cart(db, cart.id)
        if not items:
            raise ValidationError("Cart is empty. Add catalog items before transferring.")

        category_id = None
        for ci in items:
            if ci.item_id:
                m_item = await db.get(ItemMaster, ci.item_id)
                if m_item and m_item.category_id:
                    category_id = m_item.category_id
                    break
        if not category_id:
            cat_stmt = select(Category.id).where(Category.org_id == org_id).limit(1)
            category_id = (await db.execute(cat_stmt)).scalar()
            if not category_id:
                raise ValidationError("No Category found for organization.")

        pr_lines: list[PRLineItemRequest] = []
        for ci in items:
            line_cat_id = None
            uom_id = None
            if ci.item_id:
                m_item = await db.get(ItemMaster, ci.item_id)
                if m_item:
                    line_cat_id = m_item.category_id
                    uom_id = m_item.uom_id
            if not line_cat_id:
                line_cat_id = category_id
            if not uom_id:
                first_uom = (await db.execute(select(UomMaster.id).where(UomMaster.org_id == org_id).limit(1))).scalar()
                uom_id = first_uom or uuid4()

            pr_lines.append(
                PRLineItemRequest(
                    item_description=ci.item_name,
                    item_code=ci.item_code,
                    category_id=line_cat_id,
                    uom_id=uom_id,
                    quantity=ci.quantity,
                    estimated_unit_price=ci.unit_price,
                    specifications=ci.punchout_payload.get("specs") if ci.punchout_payload else None,
                )
            )

        now = datetime.now(UTC)
        transfer_req = IndentTransferRequest(
            title=f"Indent from Cart ({now.strftime('%b %d, %Y')})",
            procurement_type="OPEX",
            business_unit_id=data.business_unit_id,
            cost_center_id=data.cost_center_id,
            category_id=category_id,
            delivery_location_id=data.delivery_location_id,
            required_by_date=data.required_by_date,
            assigned_buyer_id=data.assigned_buyer_id,
            indent_notes=data.indent_notes,
            lines=pr_lines,
        )

        pr = await self.create_indent(db, transfer_req, actor, org_id)
        cart.status = "CHECKED_OUT"
        await db.flush()
        return pr

    async def get_available_buyers(
        self,
        db: AsyncSession,
        org_id: UUID,
        category_id: UUID | None = None,
        business_unit_id: UUID | None = None,
    ) -> list[BuyerSelectionItem]:
        from app.core.constants import RoleCode
        from app.db.enums import UserStatusEnum
        from app.modules.user.models import Role, User, UserRoleAssignment

        stmt = (
            select(User)
            .join(UserRoleAssignment, UserRoleAssignment.user_id == User.id)
            .join(Role, Role.id == UserRoleAssignment.role_id)
            .where(
                User.org_id == org_id,
                Role.code.in_([RoleCode.BUYER, RoleCode.PROCUREMENT_OFFICER]),
                User.status == UserStatusEnum.ACTIVE,
                UserRoleAssignment.is_active.is_(True),
            )
        )
        if business_unit_id:
            stmt = stmt.where(User.business_unit_id == business_unit_id)
        res = await db.execute(stmt)
        users = res.scalars().unique().all()

        return [
            BuyerSelectionItem(
                id=u.id,
                name=f"{u.first_name} {u.last_name}".strip() or u.email,
                email=u.email,
                department=str(u.department_id) if getattr(u, "department_id", None) else None,
                workload=0,
            )
            for u in users
        ]

    async def get_indentor_tracking(
        self,
        db: AsyncSession,
        actor: User,
        org_id: UUID,
        page: int,
        page_size: int,
        status_filter: str | None = None,
    ) -> tuple[list[Requisition], int]:
        from sqlalchemy import func

        from app.modules.user.role_repository import role_repository

        stmt = select(Requisition).where(
            Requisition.org_id == org_id,
            Requisition.is_indent.is_(True),
        )

        role_codes = await role_repository.get_user_role_codes(db, actor.id, org_id)
        roles = set(role_codes)
        if hasattr(actor, "roles") and actor.roles:
            roles.update({r.code if hasattr(r, "code") else str(r) for r in actor.roles})

        is_super = getattr(actor, "is_superadmin", False) or "SUPERADMIN" in roles
        is_org_admin = bool({"ORG_ADMIN", "PROCUREMENT_ADMIN", "PROCUREMENT_MANAGER"}.intersection(roles))

        if not (is_super or is_org_admin):
            if bool({"BUYER", "PROCUREMENT_OFFICER", "SOURCING_MANAGER"}.intersection(roles)):
                stmt = stmt.where(
                    or_(
                        Requisition.indentor_id == actor.id,
                        Requisition.assigned_buyer_id == actor.id,
                        Requisition.requestor_id == actor.id,
                    )
                )
            else:
                stmt = stmt.where(
                    or_(
                        Requisition.indentor_id == actor.id,
                        Requisition.requestor_id == actor.id,
                    )
                )

        if status_filter:
            stmt = stmt.where(Requisition.status == status_filter)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await db.execute(count_stmt)).scalar() or 0

        stmt = (
            stmt.order_by(Requisition.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        res = await db.execute(stmt)
        items = list(res.scalars().all())
        return items, total

    async def enrich_indentor_tracking(
        self,
        db: AsyncSession,
        items: list[Requisition],
        org_id: UUID,
    ) -> list[IndentorTrackingResponse]:
        from app.modules.grn.models import GoodsReceiptNote
        from app.modules.purchase_order.models import PurchaseOrder

        buyer_ids = {
            item.assigned_buyer_id
            for item in items
            if getattr(item, "assigned_buyer_id", None) and isinstance(item.assigned_buyer_id, UUID)
        }
        buyer_map: dict[UUID, str] = {}
        if buyer_ids:
            b_res = await db.execute(select(User).where(User.id.in_(buyer_ids)))
            for u in b_res.scalars().all():
                buyer_map[u.id] = f"{u.first_name} {u.last_name}".strip()

        pr_ids = [item.id for item in items if getattr(item, "id", None) and isinstance(item.id, UUID)]
        po_by_pr_id: dict[UUID, PurchaseOrder] = {}
        grn_status_by_po_id: dict[UUID, str] = {}
        if pr_ids:
            po_res = await db.execute(
                select(PurchaseOrder).where(
                    PurchaseOrder.org_id == org_id,
                    PurchaseOrder.source_pr_id.in_(pr_ids),
                )
            )
            po_list = po_res.scalars().all()
            for po in po_list:
                if po.source_pr_id:
                    po_by_pr_id[po.source_pr_id] = po

            po_ids = [po.id for po in po_list]
            if po_ids:
                grn_res = await db.execute(
                    select(GoodsReceiptNote).where(
                        GoodsReceiptNote.org_id == org_id,
                        GoodsReceiptNote.po_id.in_(po_ids),
                    )
                )
                for grn in grn_res.scalars().all():
                    grn_status_by_po_id[grn.po_id] = str(grn.status)

        res_items = []
        for item in items:
            mapped = IndentorTrackingResponse.model_validate(item)
            assigned_buyer_id = getattr(item, "assigned_buyer_id", None)
            if assigned_buyer_id and assigned_buyer_id in buyer_map:
                mapped.assigned_buyer_name = buyer_map[assigned_buyer_id]
            po = po_by_pr_id.get(getattr(item, "id", None))
            if po:
                mapped.po_id = po.id
                mapped.po_number = po.po_number
                mapped.po_status = str(po.status.value if hasattr(po.status, "value") else po.status)
                if po.id in grn_status_by_po_id:
                    mapped.grn_status = grn_status_by_po_id[po.id]
            res_items.append(mapped)

        return res_items



requisition_service = RequisitionService()
