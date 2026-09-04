from __future__ import annotations
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis_client import RedisKeys
from app.modules.bid.models import LiveAuction, LiveBid, AuctionParticipant, AuctionRankSnapshot


class LiveBidRepository:

    async def get(
        self, db: AsyncSession, auction_id: UUID, org_id: Optional[UUID] = None
    ) -> Optional[LiveAuction]:
        stmt = select(LiveAuction).where(
            LiveAuction.id == auction_id,
            LiveAuction.deleted_at.is_(None),
        )
        if org_id:
            stmt = stmt.where(LiveAuction.org_id == org_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_auctions(
        self,
        db: AsyncSession,
        org_id: UUID,
        rfq_id: Optional[UUID] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[LiveAuction], int]:
        base_stmt = select(LiveAuction).where(
            LiveAuction.org_id == org_id,
            LiveAuction.deleted_at.is_(None),
        )
        if rfq_id:
            base_stmt = base_stmt.where(LiveAuction.rfq_id == rfq_id)
        if status:
            base_stmt = base_stmt.where(LiveAuction.status == status)

        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        total = (await db.execute(count_stmt)).scalar_one()

        stmt = base_stmt.order_by(LiveAuction.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all()), total

    async def get_best_per_vendor(
        self, db: AsyncSession, auction_id: UUID, lot_id: Optional[UUID], org_id: UUID
    ) -> List[LiveBid]:
        """
        Returns the lowest valid bid per vendor for this auction+lot,
        ordered by bid_amount_inr ASC (L1 first).
        Uses DISTINCT ON for efficiency.
        """
        stmt = (
            select(LiveBid)
            .distinct(LiveBid.vendor_id)
            .where(
                LiveBid.auction_id == auction_id,
                LiveBid.org_id == org_id,
                LiveBid.is_valid == True,
                (LiveBid.lot_id == lot_id) if lot_id else True,
            )
            .order_by(LiveBid.vendor_id, LiveBid.bid_amount_inr.asc())
        )
        result = await db.execute(stmt)
        rows = result.scalars().all()
        # Re-sort by bid_amount_inr for ranking
        return sorted(rows, key=lambda b: b.bid_amount_inr)

    async def get_best_for_vendor_lot(
        self,
        db: AsyncSession,
        auction_id: UUID,
        vendor_id: UUID,
        lot_id: Optional[UUID],
        org_id: UUID,
    ) -> Optional[LiveBid]:
        stmt = (
            select(LiveBid)
            .where(
                LiveBid.auction_id == auction_id,
                LiveBid.vendor_id == vendor_id,
                LiveBid.org_id == org_id,
                LiveBid.is_valid == True,
                (LiveBid.lot_id == lot_id) if lot_id else True,
            )
            .order_by(LiveBid.bid_amount_inr.asc())
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_auction_best_bid(
        self, db: AsyncSession, auction_id: UUID, lot_id: Optional[UUID], org_id: UUID
    ) -> Optional[Decimal]:
        """Returns current L1 price across all vendors for this lot."""
        stmt = (
            select(func.min(LiveBid.bid_amount_inr))
            .where(
                LiveBid.auction_id == auction_id,
                LiveBid.org_id == org_id,
                LiveBid.is_valid == True,
                (LiveBid.lot_id == lot_id) if lot_id else True,
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def next_sequence(self, redis_client, auction_id: UUID, db: Optional[AsyncSession] = None) -> int:
        """Atomic Redis INCR for monotonic bid_sequence. Falls back to DB count."""
        if redis_client is not None:
            try:
                key = RedisKeys.auction_sequence(auction_id)
                seq = await redis_client.incr(key)
                return int(seq)
            except Exception:
                pass
        if db is not None:
            stmt = select(func.coalesce(func.max(LiveBid.bid_sequence), 0)).where(
                LiveBid.auction_id == auction_id
            )
            res = await db.execute(stmt)
            return int(res.scalar_one()) + 1
        return 1

    async def count_submitted(self, db: AsyncSession, auction_id: UUID, org_id: UUID) -> int:
        stmt = select(func.count()).where(
            LiveBid.auction_id == auction_id,
            LiveBid.org_id == org_id,
            LiveBid.is_valid == True,
        )
        result = await db.execute(stmt)
        return result.scalar_one()

    async def get_proxy_eligible(
        self, db: AsyncSession, auction_id: UUID, org_id: UUID
    ) -> List[AuctionParticipant]:
        stmt = select(AuctionParticipant).where(
            AuctionParticipant.auction_id == auction_id,
            AuctionParticipant.org_id == org_id,
            AuctionParticipant.proxy_floor_inr.is_not(None),
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_due_to_open(self, db: AsyncSession) -> List[LiveAuction]:
        now = datetime.now(timezone.utc)
        stmt = select(LiveAuction).where(
            LiveAuction.status == "SCHEDULED",
            LiveAuction.scheduled_start_at <= now,
            LiveAuction.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_due_to_close(self, db: AsyncSession) -> List[LiveAuction]:
        now = datetime.now(timezone.utc)
        stmt = (
            update(LiveAuction)
            .where(
                LiveAuction.status.in_(["OPEN", "EXTENDED", "CLOSING"]),
                LiveAuction.current_close_at <= now,
                LiveAuction.deleted_at.is_(None),
            )
            .values(status="CLOSED", updated_at=now)
            .returning(LiveAuction)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_closing_soon(self, db: AsyncSession, seconds: int) -> List[LiveAuction]:
        now = datetime.now(timezone.utc)
        window = now + timedelta(seconds=seconds)
        stmt = select(LiveAuction).where(
            LiveAuction.status.in_(["OPEN", "EXTENDED"]),
            LiveAuction.current_close_at >= now,
            LiveAuction.current_close_at <= window,
            LiveAuction.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_starting_in(self, db: AsyncSession, minutes: int) -> List[LiveAuction]:
        now = datetime.now(timezone.utc)
        target = now + timedelta(minutes=minutes)
        lower = target - timedelta(seconds=30)
        upper = target + timedelta(seconds=30)
        stmt = select(LiveAuction).where(
            LiveAuction.status == "SCHEDULED",
            LiveAuction.scheduled_start_at >= lower,
            LiveAuction.scheduled_start_at <= upper,
            LiveAuction.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_participant(
        self, db: AsyncSession, auction_id: UUID, vendor_id: UUID, org_id: Optional[UUID] = None
    ) -> Optional[AuctionParticipant]:
        stmt = select(AuctionParticipant).where(
            AuctionParticipant.auction_id == auction_id,
            AuctionParticipant.vendor_id == vendor_id,
        )
        if org_id:
            stmt = stmt.where(AuctionParticipant.org_id == org_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_participants(
        self, db: AsyncSession, auction_id: UUID, org_id: Optional[UUID] = None
    ) -> List[AuctionParticipant]:
        stmt = select(AuctionParticipant).where(AuctionParticipant.auction_id == auction_id)
        if org_id:
            stmt = stmt.where(AuctionParticipant.org_id == org_id)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_bid_history(
        self, db: AsyncSession, auction_id: UUID, org_id: UUID
    ) -> List[LiveBid]:
        stmt = (
            select(LiveBid)
            .where(
                LiveBid.auction_id == auction_id,
                LiveBid.org_id == org_id,
                LiveBid.is_valid == True,
            )
            .order_by(LiveBid.bid_sequence.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())
