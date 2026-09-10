from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import IntegrationJobStatusEnum
from app.modules.integration.models import ERPEntityMapping, IntegrationJob, ScheduledJobRun


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

    async def get_due_jobs(
        self,
        db: AsyncSession,
        now: Optional[datetime] = None,
        limit: int = 50,
    ) -> List[IntegrationJob]:
        from sqlalchemy import or_
        current_time = now or datetime.now(timezone.utc)
        stmt = (
            select(IntegrationJob)
            .where(
                and_(
                    IntegrationJob.status.in_([
                        IntegrationJobStatusEnum.PENDING,
                        IntegrationJobStatusEnum.RETRY_SCHEDULED,
                    ]),
                    or_(
                        IntegrationJob.next_retry_at.is_(None),
                        IntegrationJob.next_retry_at <= current_time,
                    ),
                    IntegrationJob.deleted_at.is_(None),
                )
            )
            .order_by(IntegrationJob.next_retry_at.asc().nullsfirst())
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    # ---------------------------------------------------------------------------
    # ERP Entity Mappings & Bi-Directional Sync Gateway (SPEC_20)
    # ---------------------------------------------------------------------------

    async def get_mapping_by_internal_id(
        self,
        db: AsyncSession,
        org_id: UUID,
        internal_id: UUID,
        erp_system: Optional[str] = None,
    ) -> Optional[ERPEntityMapping]:
        filters = [
            ERPEntityMapping.org_id == org_id,
            ERPEntityMapping.internal_id == internal_id,
            ERPEntityMapping.deleted_at.is_(None),
        ]
        if erp_system:
            filters.append(ERPEntityMapping.erp_system == erp_system)
        stmt = select(ERPEntityMapping).where(and_(*filters))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_mapping_by_external_id(
        self,
        db: AsyncSession,
        org_id: UUID,
        external_id: str,
        erp_system: Optional[str] = None,
    ) -> Optional[ERPEntityMapping]:
        filters = [
            ERPEntityMapping.org_id == org_id,
            ERPEntityMapping.external_id == external_id,
            ERPEntityMapping.deleted_at.is_(None),
        ]
        if erp_system:
            filters.append(ERPEntityMapping.erp_system == erp_system)
        stmt = select(ERPEntityMapping).where(and_(*filters))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_mapping_by_id(
        self,
        db: AsyncSession,
        mapping_id: UUID,
        org_id: UUID,
    ) -> Optional[ERPEntityMapping]:
        stmt = select(ERPEntityMapping).where(
            and_(
                ERPEntityMapping.id == mapping_id,
                ERPEntityMapping.org_id == org_id,
                ERPEntityMapping.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert_entity_mapping(
        self,
        db: AsyncSession,
        org_id: UUID,
        erp_system: str,
        entity_type: str,
        internal_id: UUID,
        external_id: str,
        sync_direction: str = "OUTBOUND",
        sync_status: str = "SUCCESS",
        retry_count: int = 0,
        last_error: Optional[str] = None,
        idoc_number: Optional[str] = None,
        payload_checksum: Optional[str] = None,
        reconciliation_hash: Optional[str] = None,
        metadata_json: Optional[Dict[str, Any]] = None,
    ) -> ERPEntityMapping:
        existing = await self.get_mapping_by_internal_id(db, org_id, internal_id, erp_system)
        if not existing:
            existing = await self.get_mapping_by_external_id(db, org_id, external_id, erp_system)

        if existing:
            existing.external_id = external_id
            existing.sync_direction = sync_direction
            existing.sync_status = sync_status
            existing.retry_count = retry_count
            existing.last_error = last_error
            if idoc_number:
                existing.idoc_number = idoc_number
            if payload_checksum:
                existing.payload_checksum = payload_checksum
            if reconciliation_hash:
                existing.reconciliation_hash = reconciliation_hash
            if metadata_json is not None:
                existing.metadata_json = metadata_json
            existing.last_synced_at = datetime.now(timezone.utc)
            await db.flush()
            return existing

        mapping = ERPEntityMapping(
            org_id=org_id,
            erp_system=erp_system,
            entity_type=entity_type,
            internal_id=internal_id,
            external_id=external_id,
            sync_direction=sync_direction,
            sync_status=sync_status,
            retry_count=retry_count,
            last_error=last_error,
            idoc_number=idoc_number,
            payload_checksum=payload_checksum,
            reconciliation_hash=reconciliation_hash,
            metadata_json=metadata_json or {},
            last_synced_at=datetime.now(timezone.utc),
        )
        db.add(mapping)
        await db.flush()
        return mapping

    async def list_entity_mappings(
        self,
        db: AsyncSession,
        org_id: UUID,
        erp_system: Optional[str] = None,
        entity_type: Optional[str] = None,
        sync_status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[ERPEntityMapping], int]:
        filters = [ERPEntityMapping.org_id == org_id, ERPEntityMapping.deleted_at.is_(None)]
        if erp_system:
            filters.append(ERPEntityMapping.erp_system == erp_system)
        if entity_type:
            filters.append(ERPEntityMapping.entity_type == entity_type)
        if sync_status:
            filters.append(ERPEntityMapping.sync_status == sync_status)

        count_stmt = select(func.count(ERPEntityMapping.id)).where(and_(*filters))
        total = (await db.execute(count_stmt)).scalar() or 0

        query = (
            select(ERPEntityMapping)
            .where(and_(*filters))
            .order_by(desc(ERPEntityMapping.last_synced_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(query)
        return list(result.scalars().all()), total

    async def get_dead_letter_mappings(
        self,
        db: AsyncSession,
        org_id: UUID,
        erp_system: Optional[str] = None,
    ) -> List[ERPEntityMapping]:
        filters = [
            ERPEntityMapping.org_id == org_id,
            ERPEntityMapping.sync_status == "DEAD_LETTER",
            ERPEntityMapping.deleted_at.is_(None),
        ]
        if erp_system:
            filters.append(ERPEntityMapping.erp_system == erp_system)
        stmt = select(ERPEntityMapping).where(and_(*filters)).order_by(desc(ERPEntityMapping.last_synced_at))
        result = await db.execute(stmt)
        return list(result.scalars().all())


integration_repository = IntegrationRepository()
