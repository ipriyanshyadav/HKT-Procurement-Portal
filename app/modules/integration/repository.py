from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import IntegrationJobStatusEnum
from app.modules.integration.models import IntegrationJob, ScheduledJobRun


class IntegrationRepository:
    """Repository for Integration Jobs and Scheduled Job Runs."""

    async def list_jobs(
        self,
        db: AsyncSession,
        org_id: UUID,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        adapter_type: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[IntegrationJob], int]:
        filters = [IntegrationJob.org_id == org_id, IntegrationJob.deleted_at.is_(None)]

        if status:
            filters.append(IntegrationJob.status == status)
        if job_type:
            filters.append(IntegrationJob.job_type == job_type)
        if adapter_type:
            filters.append(IntegrationJob.adapter_type == adapter_type)

        count_stmt = select(func.count(IntegrationJob.id)).where(and_(*filters))
        total = (await db.execute(count_stmt)).scalar() or 0

        query = (
            select(IntegrationJob)
            .where(and_(*filters))
            .order_by(desc(IntegrationJob.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(query)
        jobs = list(result.scalars().all())
        return jobs, total

    async def get_job_by_id(
        self,
        db: AsyncSession,
        job_id: UUID,
        org_id: UUID,
    ) -> Optional[IntegrationJob]:
        stmt = select(IntegrationJob).where(
            and_(
                IntegrationJob.id == job_id,
                IntegrationJob.org_id == org_id,
                IntegrationJob.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_stats(self, db: AsyncSession, org_id: UUID) -> Dict[str, Any]:
        stmt = (
            select(IntegrationJob.status, func.count(IntegrationJob.id))
            .where(
                and_(
                    IntegrationJob.org_id == org_id,
                    IntegrationJob.deleted_at.is_(None),
                )
            )
            .group_by(IntegrationJob.status)
        )
        result = await db.execute(stmt)
        counts = {str(row[0].value if hasattr(row[0], "value") else row[0]): row[1] for row in result.all()}

        total = sum(counts.values())
        completed = counts.get("COMPLETED", 0)
        pending = counts.get("PENDING", 0)
        in_progress = counts.get("IN_PROGRESS", 0)
        failed = counts.get("FAILED", 0) + counts.get("MAX_RETRIES_EXCEEDED", 0)
        retry_sched = counts.get("RETRY_SCHEDULED", 0)
        rate = round((completed / total) * 100, 1) if total > 0 else 100.0

        return {
            "total_jobs": total,
            "pending_jobs": pending,
            "in_progress_jobs": in_progress,
            "completed_jobs": completed,
            "failed_jobs": failed,
            "retry_scheduled_jobs": retry_sched,
            "success_rate": rate,
        }

    async def list_scheduled_runs(
        self,
        db: AsyncSession,
        limit: int = 20,
    ) -> List[ScheduledJobRun]:
        stmt = select(ScheduledJobRun).order_by(desc(ScheduledJobRun.started_at)).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())


integration_repository = IntegrationRepository()
