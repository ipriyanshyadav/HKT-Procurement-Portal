"""
Workflow Engine Service — core state machine.

Implements: instantiate(), advance(), _process_step(), create_tasks_for_step(),
_handle_step_completion(), _check_parallel_convergence(), _advance_to_next_step(),
cancel(), pause(), resume(), force_advance(), simulate().

All SLA thresholds and business rules come from settings (no magic numbers).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.metrics import workflow_tasks_pending
from app.core.exceptions import AppException, ForbiddenError, NotFoundError
from app.db.enums import (
    ApprovalTaskStatusEnum,
    WorkflowInstanceStatusEnum,
)
from app.modules.audit.service import audit_service
from app.modules.user.models import User
from app.modules.user.repository import UserRepository, user_repository
from app.modules.workflow.evaluator import safe_eval
from app.modules.workflow.events import WorkflowEventPublisher, workflow_event_publisher
from app.modules.workflow.group_repository import (
    ApprovalGroupRepository,
    approval_group_repository,
)
from app.modules.workflow.models import WorkflowEvent, WorkflowInstance, WorkflowTask
from app.modules.workflow.repository import WorkflowRepository, workflow_repository
from app.modules.workflow.resolver import ApproverResolver


ENTITY_ALIAS_MAP: dict[str, set[str]] = {
    "PR": {"PR", "REQUISITION", "PURCHASE_REQUISITION"},
    "REQUISITION": {"PR", "REQUISITION", "PURCHASE_REQUISITION"},
    "PURCHASE_REQUISITION": {"PR", "REQUISITION", "PURCHASE_REQUISITION"},
    "PO": {"PO", "PURCHASE_ORDER"},
    "PURCHASE_ORDER": {"PO", "PURCHASE_ORDER"},
    "INVOICE": {"INVOICE", "INVOICES"},
    "INVOICES": {"INVOICE", "INVOICES"},
    "RFQ": {"RFQ", "SOURCING"},
    "SOURCING": {"RFQ", "SOURCING"},
    "CONTRACT": {"CONTRACT", "CONTRACTS"},
    "CONTRACTS": {"CONTRACT", "CONTRACTS"},
    "ARN": {"ARN", "AWARD", "AWARD_RECOMMENDATION"},
    "AWARD_RECOMMENDATION": {"ARN", "AWARD", "AWARD_RECOMMENDATION"},
    "VENDOR": {"VENDOR", "VENDORS"},
    "VENDORS": {"VENDOR", "VENDORS"},
}


class WorkflowEngine:
    """
    Pure-Python async workflow state machine.
    All DB writes must be flushed by caller's transaction; no internal commits.
    """

    def __init__(
        self,
        repo: WorkflowRepository,
        user_repo: UserRepository,
        group_repo: ApprovalGroupRepository,
        publisher: WorkflowEventPublisher,
    ) -> None:
        self._repo = repo
        self._user_repo = user_repo
        self._group_repo = group_repo
        self._publisher = publisher
        self._resolver = ApproverResolver(user_repo, group_repo)

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    async def instantiate(
        self,
        db: AsyncSession,
        template_code: str,
        entity_type: str,
        entity_id: UUID,
        entity_context: dict,
        org_id: UUID,
        actor_id: UUID,
    ) -> WorkflowInstance:
        """Create a new workflow instance and kick off step 1."""
        template = await self._repo.get_template_by_code(db, template_code, org_id)

        instance = WorkflowInstance(
            org_id=org_id,
            template_id=template.id,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_context=entity_context,
            status=WorkflowInstanceStatusEnum.ACTIVE,
            current_step_number=0,
        )
        db.add(instance)
        await db.flush()

        first_step = min(template.steps, key=lambda s: s["step_number"])
        await self._process_step(db, instance, first_step, entity_context)

        await self._publisher.instance_created(
            db,
            instance.id,
            entity_type,
            entity_id,
            template_code,
            org_id,
        )
        return instance

    async def advance(
        self,
        db: AsyncSession,
        instance_id: UUID,
        task_id: UUID,
        action: str,
        actor_id: UUID,
        comment: str,
        org_id: UUID,
    ) -> WorkflowInstance:
        """Record an approver's action on a task and advance the workflow."""
        instance = await self._repo.get_instance(db, instance_id, org_id)
        task = await self._repo.get_task(db, task_id, org_id)

        if task.workflow_instance_id != instance_id:
            raise AppException(
                "Task does not belong to this workflow instance",
                "TASK_INSTANCE_MISMATCH",
            )
        if task.status != ApprovalTaskStatusEnum.PENDING:
            raise AppException(
                f"Task status is {task.status!r}, cannot act on it",
                "TASK_NOT_PENDING",
            )
        is_delegated = False
        if task.assigned_to != actor_id:
            # Check if actor_id is an active authorized delegate of task.assigned_to
            from sqlalchemy import text
            now_dt = datetime.now(timezone.utc)
            delegation_stmt = text(
                """
                SELECT id, entity_types, max_amount_threshold, bu_ids FROM delegation_rules
                WHERE delegator_id = :delegator_id
                  AND delegate_id = :delegate_id
                  AND org_id = :org_id
                  AND is_active = TRUE
                  AND valid_from <= :now
                  AND (valid_until IS NULL OR valid_until >= :now)
                  AND deleted_at IS NULL
                ORDER BY created_at DESC
                """
            )
            res = await db.execute(
                delegation_stmt,
                {
                    "delegator_id": str(task.assigned_to),
                    "delegate_id": str(actor_id),
                    "org_id": str(org_id),
                    "now": now_dt,
                },
            )
            delegation_rows = res.fetchall()
            for row in delegation_rows:
                rule_entities = row[1] if len(row) > 1 and row[1] is not None else []
                rule_max_threshold = row[2] if len(row) > 2 and row[2] is not None else None
                rule_bu_ids = row[3] if len(row) > 3 and row[3] is not None else []

                # Guard 1: SoD maker-checker — delegate cannot be document creator/requester
                forbidden_delegates = set()
                if instance.entity_context:
                    for k in ("created_by", "submitted_by", "requestor_id", "buyer_id"):
                        val = instance.entity_context.get(k)
                        if val:
                            forbidden_delegates.add(str(val))
                if str(actor_id) in forbidden_delegates:
                    continue

                # Guard 2: Entity type scoping
                if rule_entities:
                    matched = False
                    aliases = ENTITY_ALIAS_MAP.get(str(instance.entity_type).upper(), {str(instance.entity_type).upper()})
                    for allowed in rule_entities:
                        if allowed.upper() in aliases or allowed.upper() == "ALL":
                            matched = True
                            break
                    if not matched:
                        continue

                # Guard 3: Maximum financial threshold
                if rule_max_threshold is not None:
                    try:
                        max_limit = float(rule_max_threshold)
                        entity_amount = float(
                            (instance.entity_context or {}).get("total_amount")
                            or (instance.entity_context or {}).get("amount")
                            or (instance.entity_context or {}).get("estimated_value")
                            or (instance.entity_context or {}).get("total_value")
                            or 0.0
                        )
                        if entity_amount > max_limit:
                            continue
                    except (ValueError, TypeError):
                        pass

                # Guard 4: BU scoping
                if rule_bu_ids:
                    entity_bu = str(
                        (instance.entity_context or {}).get("bu_id")
                        or (instance.entity_context or {}).get("business_unit_id")
                        or ""
                    )
                    if entity_bu and entity_bu not in [str(b) for b in rule_bu_ids]:
                        continue

                is_delegated = True
                break

            if not is_delegated:
                raise ForbiddenError("This task is not assigned to you")
        if instance.status != WorkflowInstanceStatusEnum.ACTIVE:
            raise AppException(
                f"Workflow instance status is {instance.status!r}",
                "INSTANCE_NOT_ACTIVE",
            )

        action_to_status = {
            "APPROVE": ApprovalTaskStatusEnum.APPROVED,
            "APPROVED": ApprovalTaskStatusEnum.APPROVED,
            "REJECT": ApprovalTaskStatusEnum.REJECTED,
            "REJECTED": ApprovalTaskStatusEnum.REJECTED,
            "RETURN": ApprovalTaskStatusEnum.REJECTED,
            "RETURNED": ApprovalTaskStatusEnum.REJECTED,
            "ESCALATE": ApprovalTaskStatusEnum.ESCALATED,
            "ESCALATED": ApprovalTaskStatusEnum.ESCALATED,
            "DELEGATE": ApprovalTaskStatusEnum.DELEGATED,
            "DELEGATED": ApprovalTaskStatusEnum.DELEGATED,
            "FORCE_APPROVE": ApprovalTaskStatusEnum.FORCE_APPROVED,
            "FORCE_APPROVED": ApprovalTaskStatusEnum.FORCE_APPROVED,
            "CANCEL": ApprovalTaskStatusEnum.CANCELLED,
            "CANCELLED": ApprovalTaskStatusEnum.CANCELLED,
        }
        task.status = action_to_status.get(str(action).upper(), ApprovalTaskStatusEnum.PENDING)
        task.action = action
        task.comment = f"[Delegated to {actor_id}] {comment}" if is_delegated and comment else comment
        task.acted_at = datetime.now(timezone.utc)
        if instance.entity_context is not None:
            instance.entity_context["last_actor_id"] = str(actor_id)

        await self._publisher.task_completed(
            db, task.id, instance_id, action, actor_id, comment, org_id
        )
        workflow_tasks_pending.labels(
            org_id=str(org_id),
            step_name=str(task.assigned_role or "step"),
        ).dec()
        await self._handle_step_completion(db, instance, task, action)
        return instance

    async def cancel(
        self,
        db: AsyncSession,
        instance_id: UUID,
        actor_id: UUID,
        reason: str,
        org_id: UUID,
    ) -> WorkflowInstance:
        """Cancel an active workflow instance."""
        instance = await self._repo.get_instance(db, instance_id, org_id)
        if instance.status not in (
            WorkflowInstanceStatusEnum.ACTIVE,
            WorkflowInstanceStatusEnum.PAUSED,
        ):
            raise AppException(
                f"Cannot cancel instance in status {instance.status!r}",
                "INVALID_STATUS_TRANSITION",
            )

        now = datetime.now(timezone.utc)
        instance.status = WorkflowInstanceStatusEnum.CANCELLED
        instance.cancelled_at = now
        instance.cancel_reason = reason
        instance.cancelled_by = actor_id

        await self._cancel_pending_tasks(db, instance_id, org_id)
        await self._publisher.instance_cancelled(db, instance_id, reason, actor_id, org_id)
        await audit_service.log(
            db, "WORKFLOW", instance_id, AuditAction.CANCELLED, actor_id, org_id,
            metadata={"reason": reason},
        )
        await self._sync_entity_on_completion(db, instance, final_action="CANCEL")
        return instance

    async def pause(
        self,
        db: AsyncSession,
        instance_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> WorkflowInstance:
        """Pause an active workflow instance (admin action)."""
        instance = await self._repo.get_instance(db, instance_id, org_id)
        if instance.status != WorkflowInstanceStatusEnum.ACTIVE:
            raise AppException(
                f"Cannot pause instance in status {instance.status!r}",
                "INVALID_STATUS_TRANSITION",
            )
        instance.status = WorkflowInstanceStatusEnum.PAUSED
        await self._publisher.instance_paused(db, instance_id, actor_id, org_id)
        return instance

    async def resume(
        self,
        db: AsyncSession,
        instance_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> WorkflowInstance:
        """Resume a paused workflow instance (admin action)."""
        instance = await self._repo.get_instance(db, instance_id, org_id)
        if instance.status != WorkflowInstanceStatusEnum.PAUSED:
            raise AppException(
                f"Cannot resume instance in status {instance.status!r}",
                "INVALID_STATUS_TRANSITION",
            )
        instance.status = WorkflowInstanceStatusEnum.ACTIVE
        await self._publisher.instance_resumed(db, instance_id, actor_id, org_id)
        return instance

    async def force_advance(
        self,
        db: AsyncSession,
        instance_id: UUID,
        actor_id: UUID,
        reason: str,
        org_id: UUID,
    ) -> WorkflowInstance:
        """
        Admin force-advance: skip current step, write ADMIN_INTERVENTION compliance log.
        Requires workflow.force_advance permission (enforced at router level).
        """
        instance = await self._repo.get_instance(db, instance_id, org_id)
        if instance.status != WorkflowInstanceStatusEnum.ACTIVE:
            raise AppException(
                f"Cannot force-advance instance in status {instance.status!r}",
                "INVALID_STATUS_TRANSITION",
            )

        from_step = instance.current_step_number
        await self._cancel_pending_tasks(db, instance_id, org_id)

        compliance_event = WorkflowEvent(
            org_id=org_id,
            workflow_instance_id=instance_id,
            event_type="ADMIN_INTERVENTION",
            event_data={
                "action": "FORCE_ADVANCE",
                "from_step": from_step,
                "actor_id": str(actor_id),
                "reason": reason,
            },
            actor_id=actor_id,
        )
        db.add(compliance_event)

        await audit_service.log(
            db, "WORKFLOW", instance_id, "FORCE_ADVANCE", actor_id, org_id,
            metadata={"from_step": from_step, "reason": reason},
        )

        await self._advance_to_next_step(db, instance)
        await self._publisher.force_advanced(
            db, instance_id, from_step, instance.current_step_number, actor_id, reason, org_id
        )
        return instance

    async def simulate(
        self,
        db: AsyncSession,
        template_code: str,
        entity_context: dict,
        org_id: UUID,
    ) -> list[dict[str, Any]]:
        """
        DRY-RUN — read-only. Returns expected approval chain with approver names.
        NEVER writes to DB. Wrapped in explicit read-only semantics by the caller.
        """
        template = await self._repo.get_template_by_code(db, template_code, org_id)
        chain: list[dict[str, Any]] = []

        for step in sorted(template.steps, key=lambda s: s["step_number"]):
            condition_met = safe_eval(step.get("condition_expression", ""), entity_context)
            if condition_met:
                approvers = await self._resolver.resolve(
                    db,
                    step["resolver"],
                    step.get("resolver_config", {}),
                    entity_context,
                    org_id,
                )
                chain.append({
                    "step_number": step["step_number"],
                    "step_name": step.get("step_name"),
                    "step_type": step["step_type"],
                    "approvers": [
                        {
                            "id": str(a.id),
                            "name": f"{a.first_name} {a.last_name}",
                            "role": step.get("resolver_config", {}).get("role_code"),
                        }
                        for a in approvers
                    ],
                    "sla_hours": step["sla_hours"],
                    "convergence": step.get("convergence"),
                    "condition_met": True,
                })
            else:
                chain.append({
                    "step_number": step["step_number"],
                    "step_name": step.get("step_name"),
                    "condition_met": False,
                    "condition_expression": step.get("condition_expression"),
                })

        return chain

    # ─────────────────────────────────────────────────────────────────────────
    # Internal state-machine helpers
    # ─────────────────────────────────────────────────────────────────────────

    async def _process_step(
        self,
        db: AsyncSession,
        instance: WorkflowInstance,
        step: dict,
        entity_context: dict,
    ) -> None:
        """Evaluate condition, resolve approvers, create tasks."""
        should_run = safe_eval(step.get("condition_expression", ""), entity_context)
        if not should_run:
            instance.current_step_number = step["step_number"]
            await self._advance_to_next_step(db, instance)
            return

        approvers = await self._resolver.resolve(
            db,
            step["resolver"],
            step.get("resolver_config", {}),
            entity_context,
            instance.org_id,
        )
        approvers = await self._apply_delegation(
            db, approvers, instance.org_id, entity_type=instance.entity_type, entity_context=entity_context
        )
        instance.current_step_number = step["step_number"]
        await self.create_tasks_for_step(db, instance, step, approvers)

    async def create_tasks_for_step(
        self,
        db: AsyncSession,
        instance: WorkflowInstance,
        step: dict,
        approvers: list[User],
    ) -> None:
        """Create workflow tasks — enforces maker-checker by excluding entity creator/submitter."""
        entity_creator = str(instance.entity_context.get("created_by", ""))
        entity_submitter = str(instance.entity_context.get("submitted_by", ""))

        eligible = [
            a for a in approvers
            if str(a.id) not in (entity_creator, entity_submitter)
        ]

        if not eligible:
            escalation_users = await self._get_escalation_approvers(db, instance, step)
            eligible = [
                a for a in escalation_users
                if str(a.id) not in (entity_creator, entity_submitter)
            ]

        if not eligible:
            raise AppException(
                "Maker-checker: no eligible approver found after exclusion",
                "NO_ELIGIBLE_APPROVER",
            )

        group_id = uuid4() if step.get("step_type") == "PARALLEL" else None
        sla_hours: int = step.get("sla_hours", 24)
        sla_deadline = datetime.now(timezone.utc) + timedelta(hours=sla_hours)

        for approver in eligible:
            task = WorkflowTask(
                org_id=instance.org_id,
                workflow_instance_id=instance.id,
                step_number=step["step_number"],
                assigned_to=approver.id,
                assigned_role=step.get("resolver_config", {}).get("role_code"),
                status=ApprovalTaskStatusEnum.PENDING,
                parallel_task_group_id=group_id,
                sla_deadline=sla_deadline,
                is_maker_checker_enforced=True,
            )
            if hasattr(approver, "_delegated_from"):
                task.delegated_from = approver._delegated_from  # type: ignore[attr-defined]
            db.add(task)
            await db.flush()  # get task.id

            await self._publisher.task_created(
                db,
                task.id,
                instance.id,
                approver.id,
                step.get("step_name", ""),
                sla_deadline.isoformat(),
                instance.org_id,
            )
            workflow_tasks_pending.labels(
                org_id=str(instance.org_id),
                step_name=str(step.get("step_name") or task.assigned_role or "step"),
            ).inc()

    async def _handle_step_completion(
        self,
        db: AsyncSession,
        instance: WorkflowInstance,
        task: WorkflowTask,
        action: str,
    ) -> None:
        """Handle post-task-action step logic based on action and step type."""
        if action in ("REJECT", "RETURN"):
            instance.status = WorkflowInstanceStatusEnum.FAILED
            instance.completed_at = datetime.now(timezone.utc)
            await self._publisher.instance_failed(
                db,
                instance.id,
                instance.entity_type,
                instance.entity_id,
                task.step_number,
                task.comment or "",
                instance.org_id,
            )
            await self._sync_entity_on_completion(db, instance, final_action=action)
            return

        template = await self._repo.get_template(db, instance.template_id, instance.org_id)
        step = next(
            (s for s in template.steps if s["step_number"] == task.step_number), None
        )
        if step is None:
            raise AppException(
                f"Step {task.step_number} not found in template",
                "STEP_NOT_FOUND",
            )

        if step.get("step_type") == "PARALLEL":
            await self._check_parallel_convergence(db, instance, step, task)
        else:
            await self._advance_to_next_step(db, instance)

    async def _check_parallel_convergence(
        self,
        db: AsyncSession,
        instance: WorkflowInstance,
        step: dict,
        task: WorkflowTask,
    ) -> None:
        """Apply ALL / ANY / MAJORITY / QUORUM_N_OF_M convergence logic."""
        if task.parallel_task_group_id is None:
            await self._advance_to_next_step(db, instance)
            return

        group_tasks = await self._repo.get_tasks_by_group(
            db, task.parallel_task_group_id, instance.org_id
        )
        convergence: str = step.get("convergence", "ALL")
        total = len(group_tasks)
        approved = [t for t in group_tasks if t.status == ApprovalTaskStatusEnum.APPROVED]
        rejected = [t for t in group_tasks if t.status == ApprovalTaskStatusEnum.REJECTED]

        if convergence == "ALL":
            if rejected:
                instance.status = WorkflowInstanceStatusEnum.FAILED
                instance.completed_at = datetime.now(timezone.utc)
                for t in group_tasks:
                    if t.status == ApprovalTaskStatusEnum.PENDING:
                        t.status = ApprovalTaskStatusEnum.CANCELLED
                await self._sync_entity_on_completion(db, instance, final_action="REJECT")
            elif len(approved) == total:
                await self._advance_to_next_step(db, instance)

        elif convergence == "ANY":
            if approved:
                for t in group_tasks:
                    if t.status == ApprovalTaskStatusEnum.PENDING:
                        t.status = ApprovalTaskStatusEnum.CANCELLED
                await self._advance_to_next_step(db, instance)

        elif convergence == "MAJORITY":
            if len(approved) > total / 2:
                for t in group_tasks:
                    if t.status == ApprovalTaskStatusEnum.PENDING:
                        t.status = ApprovalTaskStatusEnum.CANCELLED
                await self._advance_to_next_step(db, instance)
            elif len(rejected) >= total / 2:
                instance.status = WorkflowInstanceStatusEnum.FAILED
                instance.completed_at = datetime.now(timezone.utc)
                await self._sync_entity_on_completion(db, instance, final_action="REJECT")

        elif convergence.startswith("QUORUM_"):
            # Format: QUORUM_N_OF_M e.g. QUORUM_2_OF_3
            parts = convergence.split("_")
            required = int(parts[1])
            if len(approved) >= required:
                for t in group_tasks:
                    if t.status == ApprovalTaskStatusEnum.PENDING:
                        t.status = ApprovalTaskStatusEnum.CANCELLED
                await self._advance_to_next_step(db, instance)
            elif len(rejected) > total - required:
                instance.status = WorkflowInstanceStatusEnum.FAILED
                instance.completed_at = datetime.now(timezone.utc)
                await self._sync_entity_on_completion(db, instance, final_action="REJECT")

    async def _advance_to_next_step(
        self, db: AsyncSession, instance: WorkflowInstance
    ) -> None:
        """Find and process the next eligible step, or complete the workflow."""
        template = await self._repo.get_template(db, instance.template_id, instance.org_id)
        next_steps = sorted(
            [s for s in template.steps if s["step_number"] > instance.current_step_number],
            key=lambda s: s["step_number"],
        )

        for step in next_steps:
            condition_met = safe_eval(
                step.get("condition_expression", ""), instance.entity_context
            )
            if condition_met:
                instance.current_step_number = step["step_number"]
                await self._process_step(db, instance, step, instance.entity_context)
                return
            # Step condition false → skip (log it)
            logger.info(
                "Workflow step skipped (condition false)",
                instance_id=str(instance.id),
                step_number=step["step_number"],
            )

        # No more steps → completed
        instance.status = WorkflowInstanceStatusEnum.COMPLETED
        instance.completed_at = datetime.now(timezone.utc)
        await self._publisher.instance_completed(
            db, instance.id, instance.entity_type, instance.entity_id, instance.org_id
        )
        await self._sync_entity_on_completion(db, instance, final_action="APPROVE")

    # ─────────────────────────────────────────────────────────────────────────
    # Delegation helpers
    # ─────────────────────────────────────────────────────────────────────────

    async def _apply_delegation(
        self,
        db: AsyncSession,
        approvers: list[User],
        org_id: UUID,
        entity_type: Optional[str] = None,
        entity_context: Optional[dict[str, Any]] = None,
    ) -> list[User]:
        """Replace delegating users with their delegates (checked at task creation time).

        Supports multi-entity scoping, maximum financial threshold, BU scoping,
        and Segregation of Duties (SoD maker-checker) bypass prevention.
        """
        from sqlalchemy import text

        now = datetime.now(timezone.utc)
        result_users: list[User] = []
        alias_map = ENTITY_ALIAS_MAP

        # Calculate entity value if available for threshold checking
        entity_amount = 0.0
        if entity_context:
            try:
                entity_amount = float(
                    entity_context.get("total_amount")
                    or entity_context.get("amount")
                    or entity_context.get("estimated_value")
                    or entity_context.get("total_value")
                    or 0.0
                )
            except (ValueError, TypeError):
                entity_amount = 0.0

        # Disallowed users for SoD guard (maker cannot be approver)
        forbidden_delegates: set[str] = set()
        if entity_context:
            for key in ("created_by", "submitted_by", "requester_id"):
                val = entity_context.get(key)
                if val:
                    forbidden_delegates.add(str(val))

        for approver in approvers:
            delegate_found = None
            try:
                delegation_stmt = text(
                    """
                    SELECT delegate_id, entity_types, max_amount_threshold, bu_ids FROM delegation_rules
                    WHERE delegator_id = :delegator_id
                      AND org_id = :org_id
                      AND is_active = TRUE
                      AND valid_from <= :now
                      AND (valid_until IS NULL OR valid_until >= :now)
                      AND deleted_at IS NULL
                    ORDER BY created_at DESC
                    """
                )
                res = await db.execute(
                    delegation_stmt,
                    {
                        "delegator_id": str(approver.id),
                        "org_id": str(org_id),
                        "now": now,
                    },
                )
                rows = res.fetchall()
            except Exception:
                rows = []

            for row in rows:
                rule_delegate_id = row[0] if isinstance(row[0], UUID) else UUID(str(row[0]))
                rule_entities = row[1] if len(row) > 1 and row[1] is not None else []
                rule_max_threshold = row[2] if len(row) > 2 and row[2] is not None else None
                rule_bu_ids = row[3] if len(row) > 3 and row[3] is not None else []

                # Guard 1: Circular / Self-delegation prevention
                if rule_delegate_id == approver.id:
                    continue

                # Guard 2: Segregation of Duties (SoD) — delegate cannot be the creator/requester of this document
                if str(rule_delegate_id) in forbidden_delegates:
                    continue

                # Guard 3: Maximum amount authority threshold
                if rule_max_threshold is not None:
                    try:
                        max_limit = float(rule_max_threshold)
                        if entity_amount > max_limit:
                            # Document value exceeds delegate's financial authority limit
                            continue
                    except (ValueError, TypeError):
                        pass

                # Guard 4: Business Unit scoping
                if rule_bu_ids and entity_context:
                    entity_bu = str(entity_context.get("business_unit_id") or entity_context.get("bu_id") or "")
                    if entity_bu:
                        allowed_bus = [str(b) for b in rule_bu_ids] if isinstance(rule_bu_ids, list) else []
                        if allowed_bus and entity_bu not in allowed_bus:
                            continue

                if isinstance(rule_entities, str):
                    import json
                    try:
                        rule_entities = json.loads(rule_entities)
                    except Exception:
                        rule_entities = [rule_entities]

                if not entity_type or not rule_entities or "ALL" in [str(e).upper() for e in rule_entities] or "*" in rule_entities:
                    delegate_found = rule_delegate_id
                    break

                target_aliases = alias_map.get(entity_type.upper(), {entity_type.upper()})
                rule_entities_upper = {str(e).upper() for e in rule_entities}
                if bool(target_aliases & rule_entities_upper):
                    delegate_found = rule_delegate_id
                    break

            if delegate_found:
                try:
                    from app.modules.user.repository import user_repository as u_repo

                    delegate = await u_repo.get_by_id(db, delegate_found, org_id)
                    if delegate:
                        delegate._delegated_from = approver.id  # type: ignore[attr-defined]
                        result_users.append(delegate)
                    else:
                        result_users.append(approver)
                except (ValueError, TypeError):
                    result_users.append(approver)
            else:
                result_users.append(approver)

        return result_users

    async def _get_escalation_approvers(
        self,
        db: AsyncSession,
        instance: WorkflowInstance,
        step: dict,
    ) -> list[User]:
        """Get escalation approvers from escalation_config → fallback to PROCUREMENT_ADMIN."""
        from app.modules.user.repository import user_repository as u_repo

        escalation_config = step.get("escalation_config", {})
        escalation_role = escalation_config.get("role_code", "PROCUREMENT_ADMIN")
        users = await u_repo.get_active_users_with_role(db, instance.org_id, escalation_role)
        return users

    async def _cancel_pending_tasks(
        self,
        db: AsyncSession,
        instance_id: UUID,
        org_id: UUID,
    ) -> None:
        """Cancel all pending tasks for a given instance."""
        from sqlalchemy import and_, select

        stmt = (
            select(WorkflowTask)
            .where(
                and_(
                    WorkflowTask.workflow_instance_id == instance_id,
                    WorkflowTask.org_id == org_id,
                    WorkflowTask.status == ApprovalTaskStatusEnum.PENDING,
                )
            )
        )
        result = await db.execute(stmt)
        for task in result.scalars().all():
            task.status = ApprovalTaskStatusEnum.CANCELLED

    async def _sync_entity_on_completion(
        self,
        db: AsyncSession,
        instance: WorkflowInstance,
        final_action: str = "APPROVE",
    ) -> None:
        """Synchronously synchronize the underlying business entity status upon workflow completion/failure.

        Ensures that when a workflow completes (e.g. from the Tasks Approver queue),
        the underlying Requisition, Purchase Order, Award Recommendation, Invoice,
        or Contract is immediately updated in the same DB transaction.
        """
        try:
            from decimal import Decimal
            from sqlalchemy import select
            from app.events.publisher import OutboxPublisher

            entity_type_upper = str(instance.entity_type).upper()
            last_actor_str = (instance.entity_context or {}).get("last_actor_id")
            last_actor_id = UUID(last_actor_str) if last_actor_str else None

            # 1. Requisitions (PR)
            if entity_type_upper in ("REQUISITION", "PR", "PURCHASE_REQUISITION"):
                from app.modules.requisition.models import Requisition
                from app.db.enums import PRStatus
                stmt = select(Requisition).where(
                    Requisition.id == instance.entity_id,
                    Requisition.org_id == instance.org_id,
                )
                res = await db.execute(stmt)
                pr = res.scalar_one_or_none()
                if pr and isinstance(pr, Requisition):
                    actor = last_actor_id or pr.requestor_id
                    if final_action in ("APPROVE", "FORCE_APPROVE"):
                        if pr.status in (PRStatus.PENDING_APPROVAL, PRStatus.SUBMITTED):
                            pr.status = PRStatus.APPROVED
                            pr.approved_at = datetime.now(timezone.utc)
                            pr.updated_by = actor
                            await db.flush()
                            await OutboxPublisher.publish(
                                db,
                                "procurement.pr",
                                "pr.approved",
                                {"pr_id": str(pr.id), "pr_number": pr.pr_number},
                                instance.org_id,
                            )
                            await audit_service.log(
                                db,
                                "REQUISITION",
                                pr.id,
                                AuditAction.APPROVED,
                                actor,
                                instance.org_id,
                                new_values={"status": PRStatus.APPROVED.value, "approved_at": pr.approved_at.isoformat()},
                            )
                    elif final_action in ("REJECT", "RETURN", "CANCEL"):
                        if pr.status in (PRStatus.PENDING_APPROVAL, PRStatus.SUBMITTED):
                            pr.status = PRStatus.CANCELLED if final_action == "CANCEL" else PRStatus.REJECTED
                            pr.budget_reserved_amount = Decimal("0.0")
                            pr.updated_by = actor
                            await db.flush()
                            await OutboxPublisher.publish(
                                db,
                                "procurement.pr",
                                "pr.rejected" if final_action != "CANCEL" else "pr.cancelled",
                                {"pr_id": str(pr.id), "pr_number": pr.pr_number},
                                instance.org_id,
                            )
                            await audit_service.log(
                                db,
                                "REQUISITION",
                                pr.id,
                                AuditAction.CANCELLED if final_action == "CANCEL" else AuditAction.PR_REJECTED,
                                actor,
                                instance.org_id,
                                new_values={"status": pr.status.value},
                            )

            # 2. Purchase Orders (PO)
            elif entity_type_upper in ("PO", "PURCHASE_ORDER"):
                from app.modules.purchase_order.models import PurchaseOrder
                from app.db.enums import POStatus
                stmt = select(PurchaseOrder).where(
                    PurchaseOrder.id == instance.entity_id,
                    PurchaseOrder.org_id == instance.org_id,
                )
                res = await db.execute(stmt)
                po = res.scalar_one_or_none()
                if po and isinstance(po, PurchaseOrder):
                    actor = last_actor_id or po.created_by
                    if final_action in ("APPROVE", "FORCE_APPROVE"):
                        if po.status in (POStatus.PENDING_APPROVAL, POStatus.DRAFT):
                            po.status = POStatus.APPROVED
                            po.updated_by = actor
                            await db.flush()
                            await OutboxPublisher.publish(
                                db,
                                "procurement.po",
                                routing_key="po.approved",
                                payload={"po_id": str(po.id), "po_number": po.po_number},
                                org_id=instance.org_id,
                            )
                            await audit_service.log(
                                db,
                                "PURCHASE_ORDER",
                                po.id,
                                "PO_APPROVED",
                                actor,
                                instance.org_id,
                            )
                    elif final_action in ("REJECT", "RETURN", "CANCEL"):
                        if po.status in (POStatus.PENDING_APPROVAL, POStatus.DRAFT):
                            po.status = POStatus.CANCELLED if final_action == "CANCEL" else POStatus.REJECTED
                            po.updated_by = actor
                            await db.flush()
                            await audit_service.log(
                                db,
                                "PURCHASE_ORDER",
                                po.id,
                                "PO_REJECTED",
                                actor,
                                instance.org_id,
                            )

            # 3. Award Recommendation (ARN) / Evaluation
            elif entity_type_upper in ("ARN", "EVALUATION", "AWARD", "AWARD_RECOMMENDATION"):
                from app.modules.evaluation.models import AwardRecommendation, ComparativeStatement
                stmt = select(AwardRecommendation).where(
                    AwardRecommendation.id == instance.entity_id,
                    AwardRecommendation.org_id == instance.org_id,
                )
                res = await db.execute(stmt)
                arn = res.scalar_one_or_none()
                if arn and isinstance(arn, AwardRecommendation):
                    actor = last_actor_id or arn.created_by
                    if final_action in ("APPROVE", "FORCE_APPROVE"):
                        arn.status = "APPROVED"
                        arn.approved_by = actor
                        arn.approved_at = datetime.now(timezone.utc)
                        if arn.cs_id:
                            cs_stmt = select(ComparativeStatement).where(
                                ComparativeStatement.id == arn.cs_id,
                                ComparativeStatement.org_id == instance.org_id,
                            )
                            cs_res = await db.execute(cs_stmt)
                            cs = cs_res.scalar_one_or_none()
                            if cs and isinstance(cs, ComparativeStatement):
                                cs.status = "APPROVED"
                                cs.approved_by = actor
                                cs.approved_at = datetime.now(timezone.utc)
                        await db.flush()
                        await OutboxPublisher.publish(
                            db,
                            "procurement.evaluation",
                            routing_key="evaluation.award.approved",
                            payload={"arn_id": str(arn.id), "cs_id": str(arn.cs_id)},
                            org_id=instance.org_id,
                        )
                        await audit_service.log(
                            db,
                            "EVALUATION",
                            arn.id,
                            "AWARD_APPROVED",
                            actor,
                            instance.org_id,
                        )
                    elif final_action in ("REJECT", "RETURN", "CANCEL"):
                        arn.status = "REJECTED"
                        await db.flush()
                        await audit_service.log(
                            db,
                            "EVALUATION",
                            arn.id,
                            "AWARD_REJECTED",
                            actor,
                            instance.org_id,
                        )

            # 4. Invoices
            elif entity_type_upper in ("INVOICE", "INVOICES"):
                from app.modules.invoice.models import Invoice
                from app.db.enums import InvoiceStatusEnum
                stmt = select(Invoice).where(
                    Invoice.id == instance.entity_id,
                    Invoice.org_id == instance.org_id,
                )
                res = await db.execute(stmt)
                invoice = res.scalar_one_or_none()
                if invoice and isinstance(invoice, Invoice):
                    actor = last_actor_id or invoice.created_by
                    if final_action in ("APPROVE", "FORCE_APPROVE"):
                        invoice.status = InvoiceStatusEnum.APPROVED
                        invoice.updated_by = actor
                        await db.flush()
                        from app.modules.payment.service import payment_service
                        try:
                            await payment_service.create_scheduled_payment(
                                db, invoice.id, actor, instance.org_id
                            )
                        except Exception as e:
                            logger.warning(
                                "Auto-scheduling payment for invoice {} encountered: {}",
                                invoice.id,
                                e,
                            )
                        await OutboxPublisher.publish(
                            db,
                            "procurement.invoice",
                            routing_key="invoice.approved",
                            payload={"invoice_id": str(invoice.id), "invoice_number": invoice.invoice_number},
                            org_id=instance.org_id,
                        )
                        await audit_service.log(
                            db,
                            "INVOICE",
                            invoice.id,
                            "INVOICE_APPROVED",
                            actor,
                            instance.org_id,
                            new_values={"status": "APPROVED"},
                        )
                    elif final_action in ("REJECT", "RETURN", "CANCEL"):
                        invoice.status = InvoiceStatusEnum.REJECTED
                        invoice.updated_by = actor
                        await db.flush()
                        await audit_service.log(
                            db,
                            "INVOICE",
                            invoice.id,
                            "INVOICE_REJECTED",
                            actor,
                            instance.org_id,
                            new_values={"status": "REJECTED"},
                        )

            # 5. Contracts
            elif entity_type_upper in ("CONTRACT", "CONTRACTS"):
                from app.modules.contract.models import Contract, ContractStatusEnum
                stmt = select(Contract).where(
                    Contract.id == instance.entity_id,
                    Contract.org_id == instance.org_id,
                )
                res = await db.execute(stmt)
                contract = res.scalar_one_or_none()
                if contract and isinstance(contract, Contract):
                    actor = last_actor_id or contract.created_by
                    if final_action in ("APPROVE", "FORCE_APPROVE"):
                        contract.status = ContractStatusEnum.APPROVED
                        contract.updated_by = actor
                        await db.flush()
                    elif final_action in ("REJECT", "RETURN", "CANCEL"):
                        contract.status = ContractStatusEnum.TERMINATED
                        contract.updated_by = actor
                        await db.flush()

            # 6. Vendors
            elif entity_type_upper in ("VENDOR", "VENDORS"):
                from app.modules.vendor.models import Vendor
                from app.db.enums import VendorStatus
                stmt = select(Vendor).where(
                    Vendor.id == instance.entity_id,
                    Vendor.org_id == instance.org_id,
                )
                res = await db.execute(stmt)
                vendor = res.scalar_one_or_none()
                if vendor and isinstance(vendor, Vendor):
                    actor = last_actor_id or vendor.created_by
                    if final_action in ("APPROVE", "FORCE_APPROVE"):
                        vendor.status = VendorStatus.ACTIVE
                        vendor.updated_by = actor
                        await db.flush()
        except Exception as e:
            logger.warning("Error syncing entity on workflow completion: {}", e)


workflow_engine = WorkflowEngine(
    repo=workflow_repository,
    user_repo=user_repository,
    group_repo=approval_group_repository,
    publisher=workflow_event_publisher,
)
workflow_service = workflow_engine
