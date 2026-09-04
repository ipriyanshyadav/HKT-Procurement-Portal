"""
Workflow Repository — DB queries for templates, instances, tasks.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.enums import ApprovalTaskStatusEnum, WorkflowInstanceStatusEnum
from app.db.repository_base import BaseRepository
from app.modules.workflow.models import WorkflowInstance, WorkflowTask, WorkflowTemplate


class WorkflowRepository(BaseRepository[WorkflowInstance]):
    def __init__(self) -> None:
        super().__init__(WorkflowInstance)

    # ── Template queries ──────────────────────────────────────────────────────

    async def get_template_by_code(
        self, db: AsyncSession, code: str, org_id: UUID
    ) -> WorkflowTemplate:
        stmt = select(WorkflowTemplate).where(
            and_(
                WorkflowTemplate.code == code,
                WorkflowTemplate.org_id == org_id,
                WorkflowTemplate.is_active.is_(True),
                WorkflowTemplate.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        template = result.scalar_one_or_none()
        if not template:
            raise NotFoundError(f"Workflow template '{code}' not found")
        return template

    async def get_template(
        self, db: AsyncSession, template_id: UUID, org_id: UUID
    ) -> WorkflowTemplate:
        stmt = select(WorkflowTemplate).where(
            and_(
                WorkflowTemplate.id == template_id,
                WorkflowTemplate.org_id == org_id,
                WorkflowTemplate.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        template = result.scalar_one_or_none()
        if not template:
            raise NotFoundError(f"Workflow template '{template_id}' not found")
        return template

    # ── Instance queries ──────────────────────────────────────────────────────

    async def get_instance(
        self, db: AsyncSession, instance_id: UUID, org_id: UUID
    ) -> WorkflowInstance:
        stmt = select(WorkflowInstance).where(
            and_(
                WorkflowInstance.id == instance_id,
                WorkflowInstance.org_id == org_id,
            )
        )
        result = await db.execute(stmt)
        instance = result.scalar_one_or_none()
        if not instance:
            raise NotFoundError(f"Workflow instance '{instance_id}' not found")
        return instance

    async def get_active_instance_for_entity(
        self, db: AsyncSession, entity_id: UUID, org_id: UUID
    ) -> Optional[WorkflowInstance]:
        stmt = select(WorkflowInstance).where(
            and_(
                WorkflowInstance.entity_id == entity_id,
                WorkflowInstance.org_id == org_id,
                WorkflowInstance.status == WorkflowInstanceStatusEnum.ACTIVE,
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    # ── Task queries ──────────────────────────────────────────────────────────

    async def get_task(
        self, db: AsyncSession, task_id: UUID, org_id: UUID
    ) -> WorkflowTask:
        stmt = select(WorkflowTask).where(
            and_(
                WorkflowTask.id == task_id,
                WorkflowTask.org_id == org_id,
            )
        )
        result = await db.execute(stmt)
        task = result.scalar_one_or_none()
        if not task:
            raise NotFoundError(f"Workflow task '{task_id}' not found")
        return task

    async def get_tasks_by_group(
        self, db: AsyncSession, group_id: UUID, org_id: UUID
    ) -> list[WorkflowTask]:
        stmt = select(WorkflowTask).where(
            and_(
                WorkflowTask.parallel_task_group_id == group_id,
                WorkflowTask.org_id == org_id,
            )
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_pending_tasks_for_step(
        self, db: AsyncSession, instance_id: UUID, step_number: int, org_id: UUID
    ) -> list[WorkflowTask]:
        stmt = select(WorkflowTask).where(
            and_(
                WorkflowTask.workflow_instance_id == instance_id,
                WorkflowTask.step_number == step_number,
                WorkflowTask.status == ApprovalTaskStatusEnum.PENDING,
                WorkflowTask.org_id == org_id,
            )
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_all_pending_tasks_with_sla(
        self, db: AsyncSession
    ) -> list[WorkflowTask]:
        """Return all PENDING tasks that have an SLA deadline — cross-org for Celery."""
        stmt = select(WorkflowTask).where(
            and_(
                WorkflowTask.status == ApprovalTaskStatusEnum.PENDING,
                WorkflowTask.sla_deadline.is_not(None),
            )
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_pending_tasks_by_user(
        self, db: AsyncSession, user_id: UUID, org_id: UUID, skip: int = 0, limit: int = 25
    ) -> list[WorkflowTask]:
        stmt = (
            select(WorkflowTask)
            .where(
                and_(
                    WorkflowTask.assigned_to == user_id,
                    WorkflowTask.org_id == org_id,
                    WorkflowTask.status == ApprovalTaskStatusEnum.PENDING,
                )
            )
            .order_by(WorkflowTask.sla_deadline.asc().nullslast())
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def count_pending_tasks_by_user(
        self, db: AsyncSession, user_id: UUID, org_id: UUID
    ) -> int:
        from sqlalchemy import func
        stmt = (
            select(func.count())
            .select_from(WorkflowTask)
            .where(
                and_(
                    WorkflowTask.assigned_to == user_id,
                    WorkflowTask.org_id == org_id,
                    WorkflowTask.status == ApprovalTaskStatusEnum.PENDING,
                )
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one()


workflow_repository = WorkflowRepository()
