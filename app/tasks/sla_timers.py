"""
SLA Timer Celery Task — checks all pending workflow tasks against SLA thresholds.

Thresholds (from settings, no magic numbers):
  50%  → WARNING   → reminder published
  100% → ESCALATED → escalation published
  150% → REASSIGNED → task reassigned to escalation chain
  200% → CRITICAL  → critical alert published

Business workflow SLAs read from UNMAPPED_PR_SLA_HOURS (index 0-3 = [4, 8, 24, 48]).
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from loguru import logger

from app.core.metrics import workflow_sla_breaches_total
from app.db.enums import ApprovalTaskStatusEnum
from app.modules.workflow.events import workflow_event_publisher
from app.modules.workflow.models import WorkflowTask
from app.modules.workflow.repository import workflow_repository
from app.tasks.async_runner import run_async
from app.tasks.celery_app import celery_app


@celery_app.task(
    name="app.tasks.sla_timers.check_workflow_sla_timers",
    queue="critical",
    bind=True,
    max_retries=3,
)
def check_workflow_sla_timers(self):
    """Celery beat task: check workflow SLA thresholds and fire escalation events."""
    run_async(_async_check_sla())


@celery_app.task(
    name="app.tasks.critical.check_slas",
    queue="critical",
)
def check_slas():
    """Alias for check_workflow_sla_timers."""
    run_async(_async_check_sla())


async def _async_check_sla() -> None:
    from app.db.session import async_session_factory

    async with async_session_factory() as db:
        now = datetime.now(timezone.utc)
        pending_tasks = await workflow_repository.get_all_pending_tasks_with_sla(db)

        for task in pending_tasks:
            try:
                await _evaluate_task_sla(db, task, now)
            except Exception as exc:
                logger.error(
                    "SLA evaluation failed for task",
                    task_id=str(task.id),
                    error=str(exc),
                )

        await db.commit()


async def _evaluate_task_sla(
    db,
    task: WorkflowTask,
    now: datetime,
) -> None:
    """Evaluate a single task's SLA and update status / publish events as needed."""
    if not task.sla_deadline or not task.created_at:
        return

    created_at = task.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    sla_deadline = task.sla_deadline
    if sla_deadline.tzinfo is None:
        sla_deadline = sla_deadline.replace(tzinfo=timezone.utc)

    sla_total_seconds = (sla_deadline - created_at).total_seconds()
    if sla_total_seconds <= 0:
        return

    elapsed_seconds = (now - created_at).total_seconds()
    pct = (elapsed_seconds / sla_total_seconds) * 100.0
    elapsed_hours = elapsed_seconds / 3600.0
    sla_total_hours = sla_total_seconds / 3600.0

    if pct >= 200.0 and task.sla_status != "CRITICAL":
        task.sla_status = "CRITICAL"
        await workflow_event_publisher.sla_critical(
            db,
            task.id,
            task.workflow_instance_id,
            task.assigned_to,
            hours_overdue=elapsed_hours - sla_total_hours,
            org_id=task.org_id,
        )
        logger.warning(
            "SLA CRITICAL",
            task_id=str(task.id),
            pct=round(pct, 1),
        )

    elif pct >= 150.0 and task.sla_status not in ("REASSIGNED", "CRITICAL"):
        task.sla_status = "REASSIGNED"
        await _reassign_task(db, task)
        await workflow_event_publisher.sla_escalation(
            db,
            task.id,
            task.workflow_instance_id,
            pct,
            org_id=task.org_id,
        )
        logger.warning(
            "SLA REASSIGNED",
            task_id=str(task.id),
            pct=round(pct, 1),
        )

    elif pct >= 100.0 and task.sla_status not in ("ESCALATED", "REASSIGNED", "CRITICAL"):
        task.sla_status = "ESCALATED"
        workflow_sla_breaches_total.labels(
            org_id=str(task.org_id),
            entity_type="WORKFLOW_TASK",
        ).inc()
        await workflow_event_publisher.sla_escalation(
            db,
            task.id,
            task.workflow_instance_id,
            pct,
            org_id=task.org_id,
        )
        logger.warning(
            "SLA ESCALATED",
            task_id=str(task.id),
            pct=round(pct, 1),
        )

    elif pct >= 50.0 and task.sla_status == "WITHIN_SLA":
        task.sla_status = "WARNING"
        await workflow_event_publisher.sla_reminder(
            db,
            task.id,
            task.assigned_to,
            pct,
            org_id=task.org_id,
        )
        logger.info(
            "SLA WARNING",
            task_id=str(task.id),
            pct=round(pct, 1),
        )


async def _reassign_task(db, task: WorkflowTask) -> None:
    """Reassign a timed-out task to the procurement admin escalation chain."""
    from app.modules.user.repository import user_repository
    from app.config import settings

    escalation_role = "PROCUREMENT_ADMIN"
    admins = await user_repository.get_active_users_with_role(
        db, task.org_id, escalation_role
    )
    if admins:
        task.assigned_to = admins[0].id
        logger.info(
            "Task reassigned to escalation admin",
            task_id=str(task.id),
            new_assignee=str(admins[0].id),
        )
