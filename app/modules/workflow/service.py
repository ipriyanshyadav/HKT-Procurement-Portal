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
        self._resolver = ApproverResolver(user_repo=user_repo, group_repo=group_repo)
        self._publisher = publisher

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
        if task.assigned_to != actor_id:
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
        task.comment = comment
        task.acted_at = datetime.now(timezone.utc)

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
        approvers = await self._apply_delegation(db, approvers, instance.org_id)
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

        group_id = uuid4() if step["step_type"] == "PARALLEL" else None
        sla_hours: int = step["sla_hours"]
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

        if step["step_type"] == "PARALLEL":
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

    # ─────────────────────────────────────────────────────────────────────────
    # Delegation helpers
    # ─────────────────────────────────────────────────────────────────────────

    async def _apply_delegation(
        self,
        db: AsyncSession,
        approvers: list[User],
        org_id: UUID,
    ) -> list[User]:
        """Replace delegating users with their delegates (checked at task creation time)."""
        from sqlalchemy import and_, select, text

        now = datetime.now(timezone.utc)
        result_users: list[User] = []

        for approver in approvers:
            row = None
            try:
                delegation_stmt = text(
                    """
                    SELECT delegate_id FROM delegation_rules
                    WHERE delegator_id = :delegator_id
                      AND org_id = :org_id
                      AND is_active = TRUE
                      AND valid_from <= :now
                      AND (valid_until IS NULL OR valid_until >= :now)
                    LIMIT 1
                    """
                )
                res = await db.execute(
                    delegation_stmt,
                    {
                        "delegator_id": str(approver.id),
                        "org_id": str(org_id),
                        "now": now.isoformat(),
                    },
                )
                row = res.fetchone()
            except Exception:
                row = None

            if row:
                try:
                    delegate_id = row[0] if isinstance(row[0], UUID) else UUID(str(row[0]))
                    from app.modules.user.repository import user_repository as u_repo

                    delegate = await u_repo.get_by_id(db, delegate_id, org_id)
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


workflow_engine = WorkflowEngine(
    repo=workflow_repository,
    user_repo=user_repository,
    group_repo=approval_group_repository,
    publisher=workflow_event_publisher,
)
