from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.repository_base import BaseRepository
from app.db.enums import InvoiceStatusEnum, POStatus
from app.modules.grn.models import GoodsReceiptNote, GrnLine
from app.modules.invoice.models import Invoice, InvoiceLine, InvoiceMatchResult
from app.modules.invoice.schemas import InvoiceFilterParams
from app.modules.purchase_order.models import PoLine, PurchaseOrder


class InvoiceRepository(BaseRepository[Invoice]):
    def __init__(self) -> None:
        super().__init__(Invoice)

    async def get_with_relations(
        self,
        db: AsyncSession,
        invoice_id: UUID,
        org_id: UUID,
    ) -> Optional[Invoice]:
        stmt = (
            select(Invoice)
            .options(
                selectinload(Invoice.lines),
                selectinload(Invoice.match_results),
            )
            .where(
                and_(
                    Invoice.id == invoice_id,
                    Invoice.org_id == org_id,
                    Invoice.deleted_at.is_(None),
                )
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def find_by_vendor_invoice_number(
        self,
        db: AsyncSession,
        org_id: UUID,
        vendor_id: UUID,
        vendor_invoice_number: str,
        financial_year: Optional[str] = None,
    ) -> Optional[Invoice]:
        conditions = [
            Invoice.org_id == org_id,
            Invoice.vendor_id == vendor_id,
            Invoice.vendor_invoice_number == vendor_invoice_number,
            Invoice.deleted_at.is_(None),
        ]
        if financial_year:
            conditions.append(Invoice.financial_year == financial_year)

        stmt = select(Invoice).where(and_(*conditions))
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def find_by_invoice_number(
        self,
        db: AsyncSession,
        org_id: UUID,
        invoice_number: str,
    ) -> Optional[Invoice]:
        stmt = select(Invoice).where(
            and_(
                Invoice.org_id == org_id,
                Invoice.invoice_number == invoice_number,
                Invoice.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def list_invoices(
        self,
        db: AsyncSession,
        org_id: UUID,
        filters: InvoiceFilterParams,
    ) -> Tuple[List[Invoice], int]:
        conditions = [
            Invoice.org_id == org_id,
            Invoice.deleted_at.is_(None),
        ]

        if filters.po_id:
            conditions.append(Invoice.po_id == filters.po_id)
        if filters.vendor_id:
            conditions.append(Invoice.vendor_id == filters.vendor_id)
        if filters.status:
            conditions.append(Invoice.status == filters.status)
        if filters.match_status:
            conditions.append(Invoice.match_status == filters.match_status)
        if filters.payment_status:
            conditions.append(Invoice.payment_status == filters.payment_status)
        if filters.financial_year:
            conditions.append(Invoice.financial_year == filters.financial_year)
        if filters.search:
            term = f"%{filters.search}%"
            conditions.append(
                Invoice.invoice_number.ilike(term)
                | Invoice.vendor_invoice_number.ilike(term)
            )

        count_stmt = select(func.count(Invoice.id)).where(and_(*conditions))
        count_res = await db.execute(count_stmt)
        total = count_res.scalar_one() or 0

        query_stmt = (
            select(Invoice)
            .options(
                selectinload(Invoice.lines),
                selectinload(Invoice.match_results),
            )
            .where(and_(*conditions))
            .order_by(Invoice.created_at.desc())
            .offset((filters.page - 1) * filters.page_size)
            .limit(filters.page_size)
        )
        res = await db.execute(query_stmt)
        return list(res.scalars().all()), total

    async def generate_invoice_number(
        self,
        db: AsyncSession,
        org_id: UUID,
    ) -> str:
        year = datetime.now(timezone.utc).year
        seq_name = f"seq_inv_{year}"

        try:
            await db.execute(
                text(f"CREATE SEQUENCE IF NOT EXISTS {seq_name} START WITH 1 INCREMENT BY 1;")
            )
            result = await db.execute(text(f"SELECT nextval('{seq_name}')"))
            n = result.scalar()
        except Exception:
            count_stmt = select(func.count(Invoice.id)).where(
                Invoice.org_id == org_id
            )
            count_res = await db.execute(count_stmt)
            n = (count_res.scalar() or 0) + 1

        return f"INV-{year}-{int(n):05d}"

    async def get_total_invoiced_quantity(
        self,
        db: AsyncSession,
        po_line_id: UUID,
        org_id: UUID,
        exclude_invoice_id: Optional[UUID] = None,
    ) -> Decimal:
        conditions = [
            InvoiceLine.po_line_id == po_line_id,
            InvoiceLine.org_id == org_id,
            Invoice.id == InvoiceLine.invoice_id,
            Invoice.deleted_at.is_(None),
            Invoice.status != InvoiceStatusEnum.CANCELLED,
        ]
        if exclude_invoice_id:
            conditions.append(Invoice.id != exclude_invoice_id)

        stmt = select(func.coalesce(func.sum(InvoiceLine.quantity), 0)).join(
            Invoice, Invoice.id == InvoiceLine.invoice_id
        ).where(and_(*conditions))
        res = await db.execute(stmt)
        return Decimal(str(res.scalar() or 0))

    async def get_eligible_lines(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        org_id: UUID,
    ) -> List[dict]:
        """
        Returns PO lines where GRN accepted quantity > previously invoiced quantity.
        """
        valid_po_statuses = [
            POStatus.RELEASED.value if hasattr(POStatus.RELEASED, "value") else "RELEASED",
            POStatus.ACKNOWLEDGED.value if hasattr(POStatus.ACKNOWLEDGED, "value") else "ACKNOWLEDGED",
            "VENDOR_ACKNOWLEDGED",
            POStatus.PARTIALLY_RECEIVED.value if hasattr(POStatus.PARTIALLY_RECEIVED, "value") else "PARTIALLY_RECEIVED",
            POStatus.FULLY_RECEIVED.value if hasattr(POStatus.FULLY_RECEIVED, "value") else "FULLY_RECEIVED",
        ]

        stmt = (
            select(PoLine, PurchaseOrder)
            .join(PurchaseOrder, PoLine.po_id == PurchaseOrder.id)
            .where(
                and_(
                    PurchaseOrder.vendor_id == vendor_id,
                    PurchaseOrder.org_id == org_id,
                    PurchaseOrder.status.in_(valid_po_statuses),
                    PurchaseOrder.deleted_at.is_(None),
                    PoLine.deleted_at.is_(None),
                )
            )
            .order_by(PurchaseOrder.created_at.desc(), PoLine.line_number.asc())
        )
        res = await db.execute(stmt)
        rows = res.all()

        eligible = []
        for po_line, po in rows:
            # Calculate total accepted quantity from GRNs
            grn_stmt = (
                select(func.coalesce(func.sum(GrnLine.accepted_quantity), 0))
                .join(GoodsReceiptNote, GrnLine.grn_id == GoodsReceiptNote.id)
                .where(
                    and_(
                        GrnLine.po_line_id == po_line.id,
                        GoodsReceiptNote.org_id == org_id,
                        GoodsReceiptNote.deleted_at.is_(None),
                    )
                )
            )
            grn_res = await db.execute(grn_stmt)
            total_accepted = Decimal(str(grn_res.scalar() or 0))

            if total_accepted <= 0 and (po_line.received_quantity or 0) > 0:
                total_accepted = Decimal(str(po_line.received_quantity))

            # Calculate already invoiced quantity
            already_invoiced = await self.get_total_invoiced_quantity(db, po_line.id, org_id)

            remaining = total_accepted - already_invoiced
            if remaining > 0:
                eligible.append({
                    "po_id": po.id,
                    "po_number": po.po_number,
                    "po_line_id": po_line.id,
                    "line_number": po_line.line_number,
                    "item_description": po_line.item_description,
                    "ordered_quantity": po_line.ordered_quantity,
                    "unit_price": po_line.unit_price,
                    "tax_rate": po_line.tax_rate,
                    "received_quantity": total_accepted,
                    "already_invoiced_quantity": already_invoiced,
                    "eligible_quantity": remaining,
                })

        return eligible


invoice_repository = InvoiceRepository()
