from __future__ import annotations
from typing import Optional, List, Tuple
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.evaluation.models import (
    ComparativeStatement,
    CsLineRanking,
    Evaluation,
    EvaluationScore,
    Negotiation,
    AwardRecommendation,
    AwardDetail,
)


class EvaluationRepository:

    async def get_cs(
        self, db: AsyncSession, cs_id: UUID, org_id: UUID
    ) -> Optional[ComparativeStatement]:
        stmt = (
            select(ComparativeStatement)
            .where(
                and_(
                    ComparativeStatement.id == cs_id,
                    ComparativeStatement.org_id == org_id,
                    ComparativeStatement.deleted_at.is_(None),
                )
            )
            .options(
                selectinload(ComparativeStatement.rankings),
                selectinload(ComparativeStatement.negotiations),
                selectinload(ComparativeStatement.award_recommendation).selectinload(AwardRecommendation.details),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_latest_cs_by_rfq(
        self, db: AsyncSession, rfq_id: UUID, org_id: UUID
    ) -> Optional[ComparativeStatement]:
        stmt = (
            select(ComparativeStatement)
            .where(
                and_(
                    ComparativeStatement.rfq_id == rfq_id,
                    ComparativeStatement.org_id == org_id,
                    ComparativeStatement.deleted_at.is_(None),
                )
            )
            .order_by(desc(ComparativeStatement.cs_version))
            .options(
                selectinload(ComparativeStatement.rankings),
                selectinload(ComparativeStatement.negotiations),
                selectinload(ComparativeStatement.award_recommendation).selectinload(AwardRecommendation.details),
            )
            .limit(1)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def list_cs_versions(
        self, db: AsyncSession, rfq_id: UUID, org_id: UUID
    ) -> List[ComparativeStatement]:
        stmt = (
            select(ComparativeStatement)
            .where(
                and_(
                    ComparativeStatement.rfq_id == rfq_id,
                    ComparativeStatement.org_id == org_id,
                    ComparativeStatement.deleted_at.is_(None),
                )
            )
            .order_by(desc(ComparativeStatement.cs_version))
            .options(
                selectinload(ComparativeStatement.rankings),
            )
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def get_next_cs_version(
        self, db: AsyncSession, rfq_id: UUID, org_id: UUID
    ) -> int:
        stmt = select(func.coalesce(func.max(ComparativeStatement.cs_version), 0)).where(
            and_(
                ComparativeStatement.rfq_id == rfq_id,
                ComparativeStatement.org_id == org_id,
            )
        )
        res = await db.execute(stmt)
        return int(res.scalar_one() or 0) + 1

    async def get_evaluation_by_rfq(
        self, db: AsyncSession, rfq_id: UUID, org_id: UUID
    ) -> Optional[Evaluation]:
        stmt = (
            select(Evaluation)
            .where(
                and_(
                    Evaluation.rfq_id == rfq_id,
                    Evaluation.org_id == org_id,
                    Evaluation.deleted_at.is_(None),
                )
            )
            .options(selectinload(Evaluation.scores))
            .order_by(desc(Evaluation.created_at))
            .limit(1)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_scores_for_rfq(
        self, db: AsyncSession, rfq_id: UUID, org_id: UUID
    ) -> List[EvaluationScore]:
        stmt = (
            select(EvaluationScore)
            .join(Evaluation, EvaluationScore.evaluation_id == Evaluation.id)
            .where(
                and_(
                    Evaluation.rfq_id == rfq_id,
                    Evaluation.org_id == org_id,
                    EvaluationScore.deleted_at.is_(None),
                )
            )
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())


class NegotiationRepository:

    async def get(
        self, db: AsyncSession, negotiation_id: UUID, org_id: UUID
    ) -> Optional[Negotiation]:
        stmt = select(Negotiation).where(
            and_(
                Negotiation.id == negotiation_id,
                Negotiation.org_id == org_id,
                Negotiation.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def list_by_cs(
        self, db: AsyncSession, cs_id: UUID, org_id: UUID
    ) -> List[Negotiation]:
        stmt = (
            select(Negotiation)
            .where(
                and_(
                    Negotiation.cs_id == cs_id,
                    Negotiation.org_id == org_id,
                    Negotiation.deleted_at.is_(None),
                )
            )
            .order_by(Negotiation.round_number, desc(Negotiation.created_at))
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def list_by_rfq(
        self, db: AsyncSession, rfq_id: UUID, org_id: UUID
    ) -> List[Negotiation]:
        stmt = (
            select(Negotiation)
            .where(
                and_(
                    Negotiation.rfq_id == rfq_id,
                    Negotiation.org_id == org_id,
                    Negotiation.deleted_at.is_(None),
                )
            )
            .order_by(Negotiation.round_number, desc(Negotiation.created_at))
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())


class AwardRepository:

    async def get(
        self, db: AsyncSession, arn_id: UUID, org_id: UUID
    ) -> Optional[AwardRecommendation]:
        stmt = (
            select(AwardRecommendation)
            .where(
                and_(
                    AwardRecommendation.id == arn_id,
                    AwardRecommendation.org_id == org_id,
                    AwardRecommendation.deleted_at.is_(None),
                )
            )
            .options(selectinload(AwardRecommendation.details))
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_cs(
        self, db: AsyncSession, cs_id: UUID, org_id: UUID
    ) -> Optional[AwardRecommendation]:
        stmt = (
            select(AwardRecommendation)
            .where(
                and_(
                    AwardRecommendation.cs_id == cs_id,
                    AwardRecommendation.org_id == org_id,
                    AwardRecommendation.deleted_at.is_(None),
                )
            )
            .options(selectinload(AwardRecommendation.details))
            .order_by(desc(AwardRecommendation.created_at))
            .limit(1)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_rfq(
        self, db: AsyncSession, rfq_id: UUID, org_id: UUID
    ) -> Optional[AwardRecommendation]:
        stmt = (
            select(AwardRecommendation)
            .where(
                and_(
                    AwardRecommendation.rfq_id == rfq_id,
                    AwardRecommendation.org_id == org_id,
                    AwardRecommendation.deleted_at.is_(None),
                )
            )
            .options(selectinload(AwardRecommendation.details))
            .order_by(desc(AwardRecommendation.created_at))
            .limit(1)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()


evaluation_repository = EvaluationRepository()
negotiation_repository = NegotiationRepository()
award_repository = AwardRepository()
