from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import UUID
from loguru import logger
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.constants import AuditAction
from app.core.metrics import pr_created_total, pr_approval_duration_hours
from app.core.exceptions import AppException, ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.core.redis_client import RedisKeys, get_redis_client
from app.db.enums import PRStatus, PRSource, ProcurementType
from app.events.publisher import OutboxPublisher
from app.modules.approval_rules.service import rules_engine
from app.modules.audit.service import audit_service
from app.modules.organization.models import BusinessUnit, CostCenter, Organization
from app.modules.requisition.fsm import validate_pr_transition
from app.modules.requisition.models import Requisition, RequisitionLine
from app.modules.requisition.repository import RequisitionRepository, requisition_repository
from app.modules.requisition.schemas import (
    BudgetCheckResult,
    PRCreateRequest,
    PRMergeRequest,
    PRSplitRequest,
    PRUpdateRequest,
    SourcingPathResult,
)
from app.modules.user.models import User
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
        return pr

    async def list_prs(
        self,
        db: AsyncSession,
        org_id: UUID,
        status: Optional[str] = None,
        business_unit_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        requestor_id: Optional[UUID] = None,
        search: Optional[str] = None,
        scope: str = "all",
        current_user: Optional[User] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[Requisition], int]:
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
        task_id: Optional[UUID],
        comment: Optional[str],
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
        pr.approved_at = datetime.now(timezone.utc)
        pr.updated_by = actor_id
        await self.repo.update(db, pr)

        if pr.created_at:
            c_at = pr.created_at if pr.created_at.tzinfo is not None else pr.created_at.replace(tzinfo=timezone.utc)
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
        task_id: Optional[UUID],
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
        merged_title: Optional[str] = None,
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
        title = merged_title or f"Merged PR - {datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"
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
            approved_at=datetime.now(timezone.utc),
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
            for l in lines:
                key = (l.item_code or l.item_description, l.uom_id)
                if key in merged_lines_map:
                    merged_lines_map[key].quantity += l.quantity
                else:
                    new_line = RequisitionLine(
                        org_id=org_id,
                        requisition_id=merged_pr.id,
                        line_number=line_num,
                        item_description=l.item_description,
                        item_code=l.item_code,
                        category_id=l.category_id,
                        uom_id=l.uom_id,
                        quantity=l.quantity,
                        estimated_unit_price=l.estimated_unit_price,
                        hsn_code=l.hsn_code,
                        specifications=l.specifications,
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
        lines_by_number = {l.line_number: l for l in source_lines}

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
                approved_at=datetime.now(timezone.utc),
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
    ) -> Requisition:
        pr = await self.get_by_id(db, pr_id, org_id)
        if pr.status not in (PRStatus.APPROVED, PRStatus.IN_SOURCING):
            raise AppException("PR must be APPROVED or IN_SOURCING to convert to PO", "INVALID_STATE")

        validate_pr_transition(pr.status, PRStatus.CONVERTED)
        # Budget is transferred to PO
        pr.budget_reserved_amount = Decimal("0.0")
        pr.status = PRStatus.CONVERTED
        pr.updated_by = actor_id
        await self.repo.update(db, pr)

        await self._invalidate_pr_cache(org_id)
        await OutboxPublisher.publish(
            db,
            "procurement.pr",
            "pr.converted_to_po",
            {"pr_id": str(pr.id), "pr_number": pr.pr_number},
            org_id,
        )
        await audit_service.log(
            db,
            "REQUISITION",
            pr.id,
            "PR_CONVERTED_TO_PO",
            actor_id,
            org_id,
            new_values={"status": PRStatus.CONVERTED.value},
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
        year = datetime.now(timezone.utc).year
        seq_name = f"seq_pr_{bu_code.lower()}_{year}"

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
        bu_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        mode: Optional[str] = None,
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


requisition_service = RequisitionService()
