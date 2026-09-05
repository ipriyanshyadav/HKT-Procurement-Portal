from __future__ import annotations

from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.repository_base import BaseRepository
from app.modules.payment.models import Dispute, DisputeMessage, PaymentRecord
from app.modules.payment.schemas import PaymentFilterParams


class PaymentRepository(BaseRepository[PaymentRecord]):
    def __init__(self) -> None:
        super().__init__(PaymentRecord)

    async def get_payment(
        self,
        db: AsyncSession,
        payment_id: UUID,
        org_id: UUID,
    ) -> Optional[PaymentRecord]:
        stmt = select(PaymentRecord).where(
            and_(
                PaymentRecord.id == payment_id,
                PaymentRecord.org_id == org_id,
                PaymentRecord.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def find_by_invoice_id(
        self,
        db: AsyncSession,
        invoice_id: UUID,
        org_id: UUID,
    ) -> List[PaymentRecord]:
        stmt = (
            select(PaymentRecord)
            .where(
                and_(
                    PaymentRecord.invoice_id == invoice_id,
                    PaymentRecord.org_id == org_id,
                    PaymentRecord.deleted_at.is_(None),
                )
            )
            .order_by(PaymentRecord.created_at.desc())
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def list_payments(
        self,
        db: AsyncSession,
        org_id: UUID,
        filters: PaymentFilterParams,
    ) -> Tuple[List[PaymentRecord], int]:
        conditions = [
            PaymentRecord.org_id == org_id,
            PaymentRecord.deleted_at.is_(None),
        ]
        if filters.invoice_id:
            conditions.append(PaymentRecord.invoice_id == filters.invoice_id)
        if filters.vendor_id:
            conditions.append(PaymentRecord.vendor_id == filters.vendor_id)
        if filters.status:
            conditions.append(PaymentRecord.status == filters.status)

        count_stmt = select(func.count(PaymentRecord.id)).where(and_(*conditions))
        count_res = await db.execute(count_stmt)
        total = count_res.scalar_one() or 0

        query_stmt = (
            select(PaymentRecord)
            .where(and_(*conditions))
            .order_by(PaymentRecord.created_at.desc())
            .offset((filters.page - 1) * filters.page_size)
            .limit(filters.page_size)
        )
        res = await db.execute(query_stmt)
        return list(res.scalars().all()), total

    # Dispute operations
    async def create_dispute(self, db: AsyncSession, dispute: Dispute) -> Dispute:
        db.add(dispute)
        await db.flush()
        return dispute

    async def get_dispute(
        self,
        db: AsyncSession,
        dispute_id: UUID,
        org_id: UUID,
    ) -> Optional[Dispute]:
        stmt = (
            select(Dispute)
            .options(selectinload(Dispute.messages))
            .where(
                and_(
                    Dispute.id == dispute_id,
                    Dispute.org_id == org_id,
                    Dispute.deleted_at.is_(None),
                )
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def list_disputes(
        self,
        db: AsyncSession,
        org_id: UUID,
        invoice_id: Optional[UUID] = None,
        vendor_id: Optional[UUID] = None,
        status: Optional[str] = None,
    ) -> List[Dispute]:
        conditions = [
            Dispute.org_id == org_id,
            Dispute.deleted_at.is_(None),
        ]
        if invoice_id:
            conditions.append(Dispute.invoice_id == invoice_id)
        if vendor_id:
            conditions.append(Dispute.vendor_id == vendor_id)
        if status:
            conditions.append(Dispute.status == status)

        stmt = (
            select(Dispute)
            .options(selectinload(Dispute.messages))
            .where(and_(*conditions))
            .order_by(Dispute.created_at.desc())
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def create_dispute_message(
        self,
        db: AsyncSession,
        message: DisputeMessage,
    ) -> DisputeMessage:
        db.add(message)
        await db.flush()
        return message


payment_repository = PaymentRepository()
