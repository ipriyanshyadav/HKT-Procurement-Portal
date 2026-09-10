from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.disaster_recovery.models import DRBackupCheckpoint, DRFailoverDrill


class DRRepository:
    async def create_checkpoint(self, db: AsyncSession, checkpoint: DRBackupCheckpoint) -> DRBackupCheckpoint:
        db.add(checkpoint)
        await db.flush()
        await db.refresh(checkpoint)
        return checkpoint

    async def get_checkpoint(self, db: AsyncSession, checkpoint_id: UUID, org_id: UUID) -> DRBackupCheckpoint | None:
        stmt = select(DRBackupCheckpoint).where(
            DRBackupCheckpoint.id == checkpoint_id,
            DRBackupCheckpoint.org_id == org_id,
            DRBackupCheckpoint.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_latest_checkpoint(
        self,
        db: AsyncSession,
        org_id: UUID,
        checkpoint_type: str | None = None,
    ) -> DRBackupCheckpoint | None:
        stmt = (
            select(DRBackupCheckpoint)
            .where(
                DRBackupCheckpoint.org_id == org_id,
                DRBackupCheckpoint.deleted_at.is_(None),
                DRBackupCheckpoint.status.in_(["COMPLETED", "VERIFIED"]),
            )
            .order_by(desc(DRBackupCheckpoint.created_at))
        )
        if checkpoint_type:
            stmt = stmt.where(DRBackupCheckpoint.checkpoint_type == checkpoint_type)
        result = await db.execute(stmt.limit(1))
        return result.scalar_one_or_none()

    async def list_checkpoints(
        self,
        db: AsyncSession,
        org_id: UUID,
        checkpoint_type: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[DRBackupCheckpoint]:
        stmt = (
            select(DRBackupCheckpoint)
            .where(
                DRBackupCheckpoint.org_id == org_id,
                DRBackupCheckpoint.deleted_at.is_(None),
            )
            .order_by(desc(DRBackupCheckpoint.created_at))
        )
        if checkpoint_type:
            stmt = stmt.where(DRBackupCheckpoint.checkpoint_type == checkpoint_type)
        if status:
            stmt = stmt.where(DRBackupCheckpoint.status == status)
        stmt = stmt.offset(offset).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def count_checkpoints(
        self,
        db: AsyncSession,
        org_id: UUID,
    ) -> tuple[int, int, int]:
        """Returns (total_count, worm_locked_count, total_size_bytes)."""
        stmt = select(
            func.count(DRBackupCheckpoint.id),
            func.count().filter(DRBackupCheckpoint.worm_locked.is_(True)),
            func.coalesce(func.sum(DRBackupCheckpoint.size_bytes), 0),
        ).where(
            DRBackupCheckpoint.org_id == org_id,
            DRBackupCheckpoint.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        row = result.one()
        return int(row[0] or 0), int(row[1] or 0), int(row[2] or 0)

    async def create_drill(self, db: AsyncSession, drill: DRFailoverDrill) -> DRFailoverDrill:
        db.add(drill)
        await db.flush()
        await db.refresh(drill)
        return drill

    async def get_drill(self, db: AsyncSession, drill_id: UUID, org_id: UUID) -> DRFailoverDrill | None:
        stmt = select(DRFailoverDrill).where(
            DRFailoverDrill.id == drill_id,
            DRFailoverDrill.org_id == org_id,
            DRFailoverDrill.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_drills(
        self,
        db: AsyncSession,
        org_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[DRFailoverDrill]:
        stmt = (
            select(DRFailoverDrill)
            .where(
                DRFailoverDrill.org_id == org_id,
                DRFailoverDrill.deleted_at.is_(None),
            )
            .order_by(desc(DRFailoverDrill.created_at))
            .offset(offset)
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_next_drill_code(self, db: AsyncSession, org_id: UUID) -> str:
        import secrets

        stmt = select(func.count(DRFailoverDrill.id))
        result = await db.execute(stmt)
        count = (result.scalar_one() or 0) + 1
        current_year = datetime.now(UTC).year
        suffix = secrets.token_hex(2).upper()
        return f"DR-DRILL-{current_year}-{count:04d}-{suffix}"


dr_repository = DRRepository()
