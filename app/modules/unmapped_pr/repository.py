from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.enums import UnmappedPrStatusEnum
from app.modules.requisition.models import Requisition, UnmappedPrException, UnmappedPrMappingLog


class UnmappedPrRepository:

    async def get(
        self, db: AsyncSession, exception_id: UUID, org_id: UUID
    ) -> Optional[UnmappedPrException]:
        stmt = (
            select(UnmappedPrException)
            .where(
                and_(
                    UnmappedPrException.id == exception_id,
                    UnmappedPrException.org_id == org_id,
                )
            )
            .options(selectinload(UnmappedPrException.requisition))
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        org_id: UUID,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[UnmappedPrException], int]:
        filters = [UnmappedPrException.org_id == org_id]
        if status:
            filters.append(UnmappedPrException.status == status)

        count_stmt = select(func.count(UnmappedPrException.id)).where(and_(*filters))
        total_res = await db.execute(count_stmt)
        total = total_res.scalar_one() or 0

        stmt = (
            select(UnmappedPrException)
            .where(and_(*filters))
            .order_by(desc(UnmappedPrException.created_at))
            .offset(skip)
            .limit(limit)
            .options(selectinload(UnmappedPrException.requisition))
        )
        res = await db.execute(stmt)
        items = list(res.scalars().all())

        return items, total

    async def get_all_pending(
        self, db: AsyncSession, org_id: Optional[UUID] = None
    ) -> List[UnmappedPrException]:
        filters = [
            UnmappedPrException.status.in_([
                UnmappedPrStatusEnum.PENDING,
                UnmappedPrStatusEnum.ASSIGNED,
                UnmappedPrStatusEnum.REPROCESSING_FAILED,
            ])
        ]
        if org_id:
            filters.append(UnmappedPrException.org_id == org_id)

        stmt = (
            select(UnmappedPrException)
            .where(and_(*filters))
            .order_by(UnmappedPrException.created_at)
            .options(selectinload(UnmappedPrException.requisition))
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def create(
        self, db: AsyncSession, exception: UnmappedPrException
    ) -> UnmappedPrException:
        db.add(exception)
        await db.flush()
        return exception

    async def update(
        self, db: AsyncSession, exception: UnmappedPrException
    ) -> UnmappedPrException:
        exception.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return exception

    async def log_mapping(
        self, db: AsyncSession, log: UnmappedPrMappingLog
    ) -> UnmappedPrMappingLog:
        db.add(log)
        await db.flush()
        return log

    async def get_mapping_history(
        self, db: AsyncSession, org_id: UUID, field_name: str, source_value: str
    ) -> Optional[UnmappedPrMappingLog]:
        stmt = (
            select(UnmappedPrMappingLog)
            .where(
                and_(
                    UnmappedPrMappingLog.org_id == org_id,
                    UnmappedPrMappingLog.field_name == field_name,
                    UnmappedPrMappingLog.source_value == source_value,
                )
            )
            .order_by(desc(UnmappedPrMappingLog.created_at))
            .limit(1)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_similar_history(
        self, db: AsyncSession, org_id: UUID, limit: int = 100
    ) -> List[UnmappedPrMappingLog]:
        stmt = (
            select(UnmappedPrMappingLog)
            .where(UnmappedPrMappingLog.org_id == org_id)
            .order_by(desc(UnmappedPrMappingLog.created_at))
            .limit(limit)
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def get_dashboard_data(
        self, db: AsyncSession, org_id: UUID
    ) -> dict:
        stmt = (
            select(
                UnmappedPrException.sla_breach_level,
                func.count(UnmappedPrException.id).label("count"),
                func.sum(Requisition.estimated_value).label("total_value"),
            )
            .join(Requisition, UnmappedPrException.requisition_id == Requisition.id)
            .where(
                and_(
                    UnmappedPrException.org_id == org_id,
                    UnmappedPrException.status.in_([
                        UnmappedPrStatusEnum.PENDING,
                        UnmappedPrStatusEnum.ASSIGNED,
                        UnmappedPrStatusEnum.CHECKER_PENDING,
                        UnmappedPrStatusEnum.REPROCESSING_FAILED,
                    ]),
                )
            )
            .group_by(UnmappedPrException.sla_breach_level)
        )
        res = await db.execute(stmt)
        rows = res.all()

        total_pending = 0
        total_blocked_value = Decimal("0.0")
        tier_counts = {1: 0, 2: 0, 3: 0, 4: 0}

        for level, count, val in rows:
            total_pending += count or 0
            total_blocked_value += val or Decimal("0.0")
            if level in tier_counts:
                tier_counts[level] = count or 0
            elif level == 0:
                tier_counts[1] += count or 0

        return {
            "total_pending": total_pending,
            "tier_1_count": tier_counts[1],
            "tier_2_count": tier_counts[2],
            "tier_3_count": tier_counts[3],
            "tier_4_count": tier_counts[4],
            "total_blocked_value": total_blocked_value,
        }


unmapped_pr_repository = UnmappedPrRepository()
