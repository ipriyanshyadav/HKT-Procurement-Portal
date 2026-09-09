from __future__ import annotations

from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.einvoicing.models import EInvoice, EWayBill


class EInvoiceRepository:
    async def get_by_id(self, db: AsyncSession, record_id: UUID, org_id: UUID | None = None) -> EInvoice | None:
        stmt = select(EInvoice).options(selectinload(EInvoice.e_way_bills)).where(EInvoice.id == record_id)
        if org_id:
            stmt = stmt.where(EInvoice.org_id == org_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_irn(self, db: AsyncSession, irn: str) -> EInvoice | None:
        stmt = select(EInvoice).options(selectinload(EInvoice.e_way_bills)).where(EInvoice.irn == irn)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_invoice(self, db: AsyncSession, invoice_id: UUID) -> EInvoice | None:
        stmt = select(EInvoice).options(selectinload(EInvoice.e_way_bills)).where(EInvoice.invoice_id == invoice_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_asn(self, db: AsyncSession, asn_id: UUID) -> EInvoice | None:
        stmt = select(EInvoice).options(selectinload(EInvoice.e_way_bills)).where(EInvoice.asn_id == asn_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_org(self, db: AsyncSession, org_id: UUID) -> list[EInvoice]:
        stmt = (
            select(EInvoice)
            .options(selectinload(EInvoice.e_way_bills))
            .where(EInvoice.org_id == org_id)
            .order_by(desc(EInvoice.created_at))
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())


class EWayBillRepository:
    async def get_by_id(self, db: AsyncSession, record_id: UUID, org_id: UUID | None = None) -> EWayBill | None:
        stmt = select(EWayBill).where(EWayBill.id == record_id)
        if org_id:
            stmt = stmt.where(EWayBill.org_id == org_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_ewb_number(self, db: AsyncSession, ewb_number: str) -> EWayBill | None:
        stmt = select(EWayBill).where(EWayBill.ewb_number == ewb_number)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_org(self, db: AsyncSession, org_id: UUID) -> list[EWayBill]:
        stmt = select(EWayBill).where(EWayBill.org_id == org_id).order_by(desc(EWayBill.created_at))
        result = await db.execute(stmt)
        return list(result.scalars().all())


e_invoice_repository = EInvoiceRepository()
e_way_bill_repository = EWayBillRepository()
