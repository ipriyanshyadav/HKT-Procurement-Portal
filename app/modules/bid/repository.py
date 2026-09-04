from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.enums import BidStatus
from app.modules.bid.models import BidResponse, BidLineResponse, BidVersion


class BidRepository:

    async def get(self, db: AsyncSession, bid_id: UUID, org_id: UUID) -> Optional[BidResponse]:
        stmt = (
            select(BidResponse)
            .where(
                and_(
                    BidResponse.id == bid_id,
                    BidResponse.org_id == org_id,
                    BidResponse.deleted_at.is_(None),
                )
            )
            .options(selectinload(BidResponse.lines))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_vendor_and_rfq(
        self, db: AsyncSession, rfq_id: UUID, vendor_id: UUID, org_id: UUID
    ) -> Optional[BidResponse]:
        stmt = (
            select(BidResponse)
            .where(
                and_(
                    BidResponse.rfq_id == rfq_id,
                    BidResponse.vendor_id == vendor_id,
                    BidResponse.org_id == org_id,
                    BidResponse.deleted_at.is_(None),
                )
            )
            .options(selectinload(BidResponse.lines))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_for_rfq(
        self, db: AsyncSession, rfq_id: UUID, org_id: UUID
    ) -> List[BidResponse]:
        stmt = (
            select(BidResponse)
            .where(
                and_(
                    BidResponse.rfq_id == rfq_id,
                    BidResponse.org_id == org_id,
                    BidResponse.deleted_at.is_(None),
                    BidResponse.status != BidStatus.WITHDRAWN.value,
                )
            )
            .options(selectinload(BidResponse.lines))
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def count_submitted(self, db: AsyncSession, rfq_id: UUID, org_id: UUID) -> int:
        stmt = select(func.count(BidResponse.id)).where(
            and_(
                BidResponse.rfq_id == rfq_id,
                BidResponse.org_id == org_id,
                BidResponse.status.in_([BidStatus.SUBMITTED.value, BidStatus.REOPENED.value]),
                BidResponse.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one() or 0

    async def list_for_rfq_with_count(
        self,
        db: AsyncSession,
        rfq_id: UUID,
        org_id: UUID,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[BidResponse], int]:
        filters = [
            BidResponse.rfq_id == rfq_id,
            BidResponse.org_id == org_id,
            BidResponse.deleted_at.is_(None),
        ]
        count_stmt = select(func.count(BidResponse.id)).where(and_(*filters))
        total = (await db.execute(count_stmt)).scalar_one() or 0

        stmt = (
            select(BidResponse)
            .where(and_(*filters))
            .order_by(desc(BidResponse.submitted_at))
            .offset(skip)
            .limit(limit)
            .options(selectinload(BidResponse.lines))
        )
        result = await db.execute(stmt)
        return list(result.scalars().all()), total


bid_repository = BidRepository()
