from __future__ import annotations

from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.ai_sourcing.models import (
    AiRfqDraft,
    NegotiationRound,
    NegotiationSession,
    SupplierRadarScore,
)


class AiRfqDraftRepository:
    async def get_by_id(self, db: AsyncSession, draft_id: UUID, org_id: UUID) -> AiRfqDraft | None:
        stmt = select(AiRfqDraft).where(AiRfqDraft.id == draft_id, AiRfqDraft.org_id == org_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_org(self, db: AsyncSession, org_id: UUID) -> list[AiRfqDraft]:
        stmt = select(AiRfqDraft).where(AiRfqDraft.org_id == org_id).order_by(desc(AiRfqDraft.created_at))
        result = await db.execute(stmt)
        return list(result.scalars().all())


class NegotiationSessionRepository:
    async def get_by_id(
        self, db: AsyncSession, session_id: UUID, org_id: UUID | None = None
    ) -> NegotiationSession | None:
        stmt = (
            select(NegotiationSession)
            .options(selectinload(NegotiationSession.rounds))
            .where(NegotiationSession.id == session_id)
        )
        if org_id:
            stmt = stmt.where(NegotiationSession.org_id == org_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_org(
        self, db: AsyncSession, org_id: UUID, vendor_id: UUID | None = None
    ) -> list[NegotiationSession]:
        stmt = (
            select(NegotiationSession)
            .options(selectinload(NegotiationSession.rounds))
            .where(NegotiationSession.org_id == org_id)
        )
        if vendor_id:
            stmt = stmt.where(NegotiationSession.vendor_id == vendor_id)
        stmt = stmt.order_by(desc(NegotiationSession.created_at))
        result = await db.execute(stmt)
        return list(result.scalars().all())


class NegotiationRoundRepository:
    async def list_by_session(self, db: AsyncSession, session_id: UUID) -> list[NegotiationRound]:
        stmt = (
            select(NegotiationRound)
            .where(NegotiationRound.session_id == session_id)
            .order_by(NegotiationRound.round_number.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())


class SupplierRadarScoreRepository:
    async def list_by_org(
        self, db: AsyncSession, org_id: UUID, category_id: UUID | None = None
    ) -> list[SupplierRadarScore]:
        stmt = select(SupplierRadarScore).where(SupplierRadarScore.org_id == org_id)
        if category_id:
            stmt = stmt.where(SupplierRadarScore.category_id == category_id)
        stmt = stmt.order_by(desc(SupplierRadarScore.overall_fit_score))
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_vendor(
        self, db: AsyncSession, org_id: UUID, vendor_id: UUID, category_id: UUID | None = None
    ) -> SupplierRadarScore | None:
        stmt = select(SupplierRadarScore).where(
            SupplierRadarScore.org_id == org_id, SupplierRadarScore.vendor_id == vendor_id
        )
        if category_id:
            stmt = stmt.where(SupplierRadarScore.category_id == category_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


ai_rfq_draft_repository = AiRfqDraftRepository()
negotiation_session_repository = NegotiationSessionRepository()
negotiation_round_repository = NegotiationRoundRepository()
supplier_radar_score_repository = SupplierRadarScoreRepository()
