"""
Purchase Order Repository (SPEC_14).

Provides database queries and transactions for purchase_orders, po_lines, and po_amendments.
Layer discipline: router -> service -> repository -> model.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.organization.models import BusinessUnit
from app.modules.purchase_order.models import PoAmendment, PoLine, PurchaseOrder
from app.modules.purchase_order.schemas import POFilterParams


class PurchaseOrderRepository:
    """Repository for Purchase Order domain operations."""

    async def get(
        self,
        db: AsyncSession,
        po_id: UUID,
        org_id: UUID,
    ) -> Optional[PurchaseOrder]:
        stmt = (
            select(PurchaseOrder)
            .where(
                and_(
                    PurchaseOrder.id == po_id,
                    PurchaseOrder.org_id == org_id,
                    PurchaseOrder.deleted_at.is_(None),
                )
            )
            .options(
                selectinload(PurchaseOrder.lines),
                selectinload(PurchaseOrder.amendments),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_number(
        self,
        db: AsyncSession,
        po_number: str,
        org_id: UUID,
    ) -> Optional[PurchaseOrder]:
        stmt = (
            select(PurchaseOrder)
            .where(
                and_(
                    PurchaseOrder.po_number == po_number,
                    PurchaseOrder.org_id == org_id,
                    PurchaseOrder.deleted_at.is_(None),
                )
            )
            .options(
                selectinload(PurchaseOrder.lines),
                selectinload(PurchaseOrder.amendments),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        org_id: UUID,
        filters: POFilterParams,
    ) -> Tuple[List[PurchaseOrder], int]:
        conditions = [
            PurchaseOrder.org_id == org_id,
            PurchaseOrder.deleted_at.is_(None),
        ]

        if filters.status:
            conditions.append(PurchaseOrder.status == filters.status)
        if filters.vendor_id:
            conditions.append(PurchaseOrder.vendor_id == filters.vendor_id)
        if filters.business_unit_id:
            conditions.append(PurchaseOrder.business_unit_id == filters.business_unit_id)
        if filters.rfq_id:
            conditions.append(PurchaseOrder.rfq_id == filters.rfq_id)
        if filters.contract_id:
            conditions.append(PurchaseOrder.contract_id == filters.contract_id)
        if filters.search:
            term = f"%{filters.search}%"
            conditions.append(
                or_(
                    PurchaseOrder.po_number.ilike(term),
                    PurchaseOrder.title.ilike(term),
                )
            )

        count_stmt = select(func.count(PurchaseOrder.id)).where(and_(*conditions))
        total_count = (await db.execute(count_stmt)).scalar() or 0

        offset = (filters.page - 1) * filters.page_size
        stmt = (
            select(PurchaseOrder)
            .where(and_(*conditions))
            .options(
                selectinload(PurchaseOrder.lines),
                selectinload(PurchaseOrder.amendments),
            )
            .order_by(PurchaseOrder.created_at.desc())
            .offset(offset)
            .limit(filters.page_size)
        )
        res = await db.execute(stmt)
        pos = list(res.scalars().all())

        return pos, total_count

    async def create(
        self,
        db: AsyncSession,
        po: PurchaseOrder,
    ) -> PurchaseOrder:
        db.add(po)
        await db.flush()
        return po

    async def update(
        self,
        db: AsyncSession,
        po: PurchaseOrder,
    ) -> PurchaseOrder:
        await db.flush()
        return po

    async def get_line(
        self,
        db: AsyncSession,
        po_line_id: UUID,
        org_id: UUID,
    ) -> Optional[PoLine]:
        stmt = select(PoLine).where(
            and_(
                PoLine.id == po_line_id,
                PoLine.org_id == org_id,
                PoLine.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def create_amendment(
        self,
        db: AsyncSession,
        amendment: PoAmendment,
    ) -> PoAmendment:
        db.add(amendment)
        await db.flush()
        return amendment

    async def get_amendments(
        self,
        db: AsyncSession,
        po_id: UUID,
        org_id: UUID,
    ) -> List[PoAmendment]:
        stmt = (
            select(PoAmendment)
            .where(
                and_(
                    PoAmendment.po_id == po_id,
                    PoAmendment.org_id == org_id,
                )
            )
            .order_by(PoAmendment.amendment_number.asc())
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def next_amendment_number(
        self,
        db: AsyncSession,
        po_id: UUID,
        org_id: UUID,
    ) -> int:
        stmt = select(func.coalesce(func.max(PoAmendment.amendment_number), 0)).where(
            and_(
                PoAmendment.po_id == po_id,
                PoAmendment.org_id == org_id,
            )
        )
        res = await db.execute(stmt)
        val = res.scalar() or 0
        return int(val) + 1

    async def generate_po_number(
        self,
        db: AsyncSession,
        bu_id: UUID,
        org_id: UUID,
    ) -> str:
        bu_stmt = select(BusinessUnit).where(
            BusinessUnit.id == bu_id,
            BusinessUnit.org_id == org_id,
        )
        bu_res = await db.execute(bu_stmt)
        bu = bu_res.scalar_one_or_none()
        bu_code = bu.code.upper() if bu and bu.code else "CORP"
        year = datetime.now(timezone.utc).year
        seq_name = f"seq_po_{bu_code.lower()}_{year}"

        try:
            await db.execute(
                text(f"CREATE SEQUENCE IF NOT EXISTS {seq_name} START WITH 1 INCREMENT BY 1;")
            )
            result = await db.execute(text(f"SELECT nextval('{seq_name}')"))
            n = result.scalar()
        except Exception:
            # Fallback count
            cnt_stmt = select(func.count(PurchaseOrder.id)).where(
                PurchaseOrder.org_id == org_id
            )
            cnt = (await db.execute(cnt_stmt)).scalar() or 0
            n = cnt + 1

        return f"{bu_code}-PO-{year}-{str(n).zfill(6)}"


purchase_order_repository = PurchaseOrderRepository()
