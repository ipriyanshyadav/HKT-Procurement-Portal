"""
Workflow Events — all 10 RabbitMQ event routing keys published via outbox pattern.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.events.publisher import OutboxPublisher

# Exchange name — all workflow events go here
WORKFLOW_EXCHANGE = "procurement.workflow"
ALERT_EXCHANGE = "procurement.alert"

# Routing key constants
RK_INSTANCE_CREATED = "workflow.instance.created"
RK_INSTANCE_COMPLETED = "workflow.instance.completed"
RK_INSTANCE_FAILED = "workflow.instance.failed"
RK_INSTANCE_CANCELLED = "workflow.instance.cancelled"
RK_INSTANCE_PAUSED = "workflow.instance.paused"
RK_INSTANCE_RESUMED = "workflow.instance.resumed"
RK_TASK_CREATED = "workflow.task.created"
RK_TASK_COMPLETED = "workflow.task.completed"
RK_SLA_REMINDER = "workflow.sla.reminder"
RK_SLA_ESCALATION = "workflow.sla.escalation"
RK_SLA_CRITICAL = "workflow.sla.critical"
RK_FORCE_ADVANCED = "workflow.force.advanced"


class WorkflowEventPublisher:
    """Thin wrapper over OutboxPublisher scoped to workflow events."""

    @staticmethod
    async def instance_created(
        db: AsyncSession,
        instance_id: UUID,
        entity_type: str,
        entity_id: UUID,
        template_code: str,
        org_id: UUID,
    ) -> None:
        await OutboxPublisher.publish(
            db,
            WORKFLOW_EXCHANGE,
            RK_INSTANCE_CREATED,
            {
                "instance_id": str(instance_id),
                "entity_type": entity_type,
                "entity_id": str(entity_id),
                "template_code": template_code,
            },
            org_id,
        )

    @staticmethod
    async def instance_completed(
        db: AsyncSession,
        instance_id: UUID,
        entity_type: str,
        entity_id: UUID,
        org_id: UUID,
    ) -> None:
        await OutboxPublisher.publish(
            db,
            WORKFLOW_EXCHANGE,
            RK_INSTANCE_COMPLETED,
            {
                "instance_id": str(instance_id),
                "entity_type": entity_type,
                "entity_id": str(entity_id),
            },
            org_id,
        )

    @staticmethod
    async def instance_failed(
        db: AsyncSession,
        instance_id: UUID,
        entity_type: str,
        entity_id: UUID,
        failed_at_step: int,
        rejection_comment: str,
        org_id: UUID,
    ) -> None:
        await OutboxPublisher.publish(
            db,
            WORKFLOW_EXCHANGE,
            RK_INSTANCE_FAILED,
            {
                "instance_id": str(instance_id),
                "entity_type": entity_type,
                "entity_id": str(entity_id),
                "failed_at_step": failed_at_step,
                "rejection_comment": rejection_comment,
            },
            org_id,
        )

    @staticmethod
    async def instance_cancelled(
        db: AsyncSession,
        instance_id: UUID,
        cancel_reason: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        await OutboxPublisher.publish(
            db,
            WORKFLOW_EXCHANGE,
            RK_INSTANCE_CANCELLED,
            {
                "instance_id": str(instance_id),
                "cancel_reason": cancel_reason,
                "actor_id": str(actor_id),
            },
            org_id,
        )

    @staticmethod
    async def instance_paused(
        db: AsyncSession,
        instance_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        await OutboxPublisher.publish(
            db,
            WORKFLOW_EXCHANGE,
            RK_INSTANCE_PAUSED,
            {"instance_id": str(instance_id), "actor_id": str(actor_id)},
            org_id,
        )

    @staticmethod
    async def instance_resumed(
        db: AsyncSession,
        instance_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        await OutboxPublisher.publish(
            db,
            WORKFLOW_EXCHANGE,
            RK_INSTANCE_RESUMED,
            {"instance_id": str(instance_id), "actor_id": str(actor_id)},
            org_id,
        )

    @staticmethod
    async def task_created(
        db: AsyncSession,
        task_id: UUID,
        instance_id: UUID,
        assigned_to: UUID,
        step_name: str,
        sla_deadline_iso: str,
        org_id: UUID,
    ) -> None:
        await OutboxPublisher.publish(
            db,
            WORKFLOW_EXCHANGE,
            RK_TASK_CREATED,
            {
                "task_id": str(task_id),
                "instance_id": str(instance_id),
                "assigned_to": str(assigned_to),
                "step_name": step_name,
                "sla_deadline": sla_deadline_iso,
            },
            org_id,
        )

    @staticmethod
    async def task_completed(
        db: AsyncSession,
        task_id: UUID,
        instance_id: UUID,
        action: str,
        actor_id: UUID,
        comment: str,
        org_id: UUID,
    ) -> None:
        await OutboxPublisher.publish(
            db,
            WORKFLOW_EXCHANGE,
            RK_TASK_COMPLETED,
            {
                "task_id": str(task_id),
                "instance_id": str(instance_id),
                "action": action,
                "actor_id": str(actor_id),
                "comment": comment,
            },
            org_id,
        )

    @staticmethod
    async def sla_reminder(
        db: AsyncSession,
        task_id: UUID,
        assigned_to: UUID,
        sla_pct: float,
        org_id: UUID,
    ) -> None:
        await OutboxPublisher.publish(
            db,
            WORKFLOW_EXCHANGE,
            RK_SLA_REMINDER,
            {
                "task_id": str(task_id),
                "assigned_to": str(assigned_to),
                "sla_pct": round(sla_pct, 1),
            },
            org_id,
        )

    @staticmethod
    async def sla_escalation(
        db: AsyncSession,
        task_id: UUID,
        instance_id: UUID,
        sla_pct: float,
        org_id: UUID,
    ) -> None:
        await OutboxPublisher.publish(
            db,
            WORKFLOW_EXCHANGE,
            RK_SLA_ESCALATION,
            {
                "task_id": str(task_id),
                "instance_id": str(instance_id),
                "sla_pct": round(sla_pct, 1),
            },
            org_id,
        )

    @staticmethod
    async def sla_critical(
        db: AsyncSession,
        task_id: UUID,
        instance_id: UUID,
        assigned_to: UUID,
        hours_overdue: float,
        org_id: UUID,
    ) -> None:
        await OutboxPublisher.publish(
            db,
            WORKFLOW_EXCHANGE,
            RK_SLA_CRITICAL,
            {
                "task_id": str(task_id),
                "instance_id": str(instance_id),
                "assigned_to": str(assigned_to),
                "hours_overdue": round(hours_overdue, 2),
            },
            org_id,
        )

    @staticmethod
    async def force_advanced(
        db: AsyncSession,
        instance_id: UUID,
        from_step: int,
        to_step: int,
        actor_id: UUID,
        reason: str,
        org_id: UUID,
    ) -> None:
        await OutboxPublisher.publish(
            db,
            WORKFLOW_EXCHANGE,
            RK_FORCE_ADVANCED,
            {
                "instance_id": str(instance_id),
                "from_step": from_step,
                "to_step": to_step,
                "actor_id": str(actor_id),
                "reason": reason,
            },
            org_id,
        )


workflow_event_publisher = WorkflowEventPublisher()
