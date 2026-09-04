from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repository_base import BaseRepository
from app.modules.master_data.models import PaymentTerm


class PaymentTermsRepository(BaseRepository[PaymentTerm]):
    """DB-layer for PaymentTerm — scoped to org, never crosses tenant boundary."""

    def __init__(self) -> None:
        super().__init__(PaymentTerm)

    async def get_all(
        self,
        db: AsyncSession,
        org_id: UUID,
        active_only: bool = True,
    ) -> list[PaymentTerm]:
        """Return all payment terms for an org, optionally filtered to active records."""
        filters = [
            PaymentTerm.org_id == org_id,
            PaymentTerm.deleted_at.is_(None),
        ]
        if active_only:
            filters.append(PaymentTerm.is_active.is_(True))

        stmt = (
            select(PaymentTerm)
            .where(and_(*filters))
            .order_by(PaymentTerm.code.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_code(
        self,
        db: AsyncSession,
        code: str,
        org_id: UUID,
        exclude_id: Optional[UUID] = None,
    ) -> Optional[PaymentTerm]:
        """Fetch a payment term by its code within an org; optionally exclude one ID (for updates)."""
        filters = [
            PaymentTerm.code == code,
            PaymentTerm.org_id == org_id,
            PaymentTerm.deleted_at.is_(None),
        ]
        if exclude_id is not None:
            filters.append(PaymentTerm.id != exclude_id)

        stmt = select(PaymentTerm).where(and_(*filters))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


payment_terms_repository = PaymentTermsRepository()
