from __future__ import annotations

import builtins
from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.enums import RFQStatus
from app.modules.sourcing.models import Rfq, RfqClarification, RfqParticipant


class RfqRepository:

    async def get(self, db: AsyncSession, rfq_id: UUID, org_id: UUID) -> Rfq | None:
        stmt = (
            select(Rfq)
            .where(
                and_(
                    Rfq.id == rfq_id,
                    Rfq.org_id == org_id,
                    Rfq.deleted_at.is_(None),
                )
            )
            .options(
                selectinload(Rfq.lots),
                selectinload(Rfq.lines),
                selectinload(Rfq.participants),
                selectinload(Rfq.clarifications),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        org_id: UUID,
        status: str | None = None,
        rfq_type: str | None = None,
        business_unit_id: UUID | None = None,
        category_id: UUID | None = None,
        buyer_id: UUID | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[builtins.list[Rfq], int]:
        filters = [Rfq.org_id == org_id, Rfq.deleted_at.is_(None)]

        if status:
            filters.append(Rfq.status == status)
        if rfq_type:
            filters.append(Rfq.rfq_type == rfq_type)
        if business_unit_id:
            filters.append(Rfq.business_unit_id == business_unit_id)
        if category_id:
            filters.append(Rfq.category_id == category_id)
        if buyer_id:
            filters.append(Rfq.buyer_id == buyer_id)
        if search:
            pat = f"%{search}%"
            filters.append(
                or_(
                    Rfq.rfq_number.ilike(pat),
                    Rfq.title.ilike(pat),
                )
            )

        count_stmt = select(func.count(Rfq.id)).where(and_(*filters))
        total = (await db.execute(count_stmt)).scalar_one() or 0

        stmt = (
            select(Rfq)
            .where(and_(*filters))
            .order_by(desc(Rfq.created_at))
            .offset(skip)
            .limit(limit)
            .options(selectinload(Rfq.lots), selectinload(Rfq.lines))
        )
        result = await db.execute(stmt)
        return list(result.scalars().all()), total

    async def list_for_supplier(
        self,
        db: AsyncSession,
        org_id: UUID,
        vendor_id: UUID,
        status: str | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[builtins.list[Rfq], int]:
        invited_subq = (
            select(RfqParticipant.rfq_id)
            .where(
                and_(
                    RfqParticipant.vendor_id == vendor_id,
                    RfqParticipant.deleted_at.is_(None),
                )
            )
            .scalar_subquery()
        )
        non_visible = [
            RFQStatus.DRAFT.value,
            RFQStatus.PENDING_APPROVAL.value,
            RFQStatus.APPROVED.value,
            RFQStatus.COMPLIANCE_HOLD.value,
        ]
        filters = [
            Rfq.org_id == org_id,
            Rfq.deleted_at.is_(None),
            Rfq.status.notin_(non_visible),
            or_(
                Rfq.id.in_(invited_subq),
                Rfq.rfq_type == "OPEN_TENDER",
            ),
        ]
        if status:
            filters.append(Rfq.status == status)
        if search:
            pat = f"%{search}%"
            filters.append(
                or_(
                    Rfq.rfq_number.ilike(pat),
                    Rfq.title.ilike(pat),
                )
            )

        count_stmt = select(func.count(Rfq.id)).where(and_(*filters))
        total = (await db.execute(count_stmt)).scalar_one() or 0

        stmt = (
            select(Rfq)
            .where(and_(*filters))
            .order_by(desc(Rfq.created_at))
            .offset(skip)
            .limit(limit)
            .options(selectinload(Rfq.lots), selectinload(Rfq.lines))
        )
        result = await db.execute(stmt)
        return list(result.scalars().all()), total

    async def get_published_past_deadline(self, db: AsyncSession, now: datetime) -> builtins.list[Rfq]:
        stmt = (
            select(Rfq)
            .where(
                and_(
                    Rfq.status == RFQStatus.PUBLISHED.value,
                    Rfq.bid_close_at <= now,
                    Rfq.deleted_at.is_(None),
                )
            )
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def count_by_status(self, db: AsyncSession, org_id: UUID, status: str) -> int:
        stmt = select(func.count(Rfq.id)).where(
            and_(
                Rfq.org_id == org_id,
                Rfq.status == status,
                Rfq.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one() or 0

    async def next_sequence(self, db: AsyncSession, org_id: UUID, year: int) -> int:
        stmt = select(func.count(Rfq.id)).where(
            and_(
                Rfq.org_id == org_id,
                func.extract("year", Rfq.created_at) == year,
            )
        )
        res = await db.execute(stmt)
        return (res.scalar_one() or 0) + 1


class RfqParticipantRepository:

    async def get_all(self, db: AsyncSession, rfq_id: UUID, org_id: UUID) -> list[RfqParticipant]:
        stmt = (
            select(RfqParticipant)
            .where(
                and_(
                    RfqParticipant.rfq_id == rfq_id,
                    RfqParticipant.org_id == org_id,
                    RfqParticipant.deleted_at.is_(None),
                )
            )
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_vendor(self, db: AsyncSession, rfq_id: UUID, vendor_id: UUID, org_id: UUID) -> RfqParticipant | None:
        stmt = (
            select(RfqParticipant)
            .where(
                and_(
                    RfqParticipant.rfq_id == rfq_id,
                    RfqParticipant.vendor_id == vendor_id,
                    RfqParticipant.org_id == org_id,
                    RfqParticipant.deleted_at.is_(None),
                )
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


class RfqClarificationRepository:

    async def get(self, db: AsyncSession, clarification_id: UUID, org_id: UUID) -> RfqClarification | None:
        stmt = (
            select(RfqClarification)
            .where(
                and_(
                    RfqClarification.id == clarification_id,
                    RfqClarification.org_id == org_id,
                    RfqClarification.deleted_at.is_(None),
                )
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_for_rfq(self, db: AsyncSession, rfq_id: UUID, org_id: UUID) -> list[RfqClarification]:
        stmt = (
            select(RfqClarification)
            .where(
                and_(
                    RfqClarification.rfq_id == rfq_id,
                    RfqClarification.org_id == org_id,
                    RfqClarification.deleted_at.is_(None),
                )
            )
            .order_by(RfqClarification.created_at)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())


rfq_repository = RfqRepository()
rfq_participant_repository = RfqParticipantRepository()
rfq_clarification_repository = RfqClarificationRepository()
