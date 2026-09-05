"""
Goods Receipt Note (GRN) Repository (SPEC_14 / SPEC_17).

Provides database operations for goods_receipt_notes, grn_lines, and quality_inspections.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.grn.models import GoodsReceiptNote, GrnLine, QualityInspection
from app.modules.grn.schemas import GrnFilterParams


class GrnRepository:
    """Repository for GRN operations."""

    async def get(
        self,
        db: AsyncSession,
        grn_id: UUID,
        org_id: UUID,
    ) -> Optional[GoodsReceiptNote]:
        stmt = (
            select(GoodsReceiptNote)
            .where(
                and_(
                    GoodsReceiptNote.id == grn_id,
                    GoodsReceiptNote.org_id == org_id,
                    GoodsReceiptNote.deleted_at.is_(None),
                )
            )
            .options(
                selectinload(GoodsReceiptNote.lines).selectinload(GrnLine.inspections),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_number(
        self,
        db: AsyncSession,
        grn_number: str,
        org_id: UUID,
    ) -> Optional[GoodsReceiptNote]:
        stmt = (
            select(GoodsReceiptNote)
            .where(
                and_(
                    GoodsReceiptNote.grn_number == grn_number,
                    GoodsReceiptNote.org_id == org_id,
                    GoodsReceiptNote.deleted_at.is_(None),
                )
            )
            .options(
                selectinload(GoodsReceiptNote.lines).selectinload(GrnLine.inspections),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        org_id: UUID,
        filters: GrnFilterParams,
    ) -> Tuple[List[GoodsReceiptNote], int]:
        conditions = [
            GoodsReceiptNote.org_id == org_id,
            GoodsReceiptNote.deleted_at.is_(None),
        ]

        if filters.po_id:
            conditions.append(GoodsReceiptNote.po_id == filters.po_id)
        if filters.vendor_id:
            conditions.append(GoodsReceiptNote.vendor_id == filters.vendor_id)
        if filters.status:
            conditions.append(GoodsReceiptNote.status == filters.status)
        if filters.search:
            term = f"%{filters.search}%"
            conditions.append(
                or_(
                    GoodsReceiptNote.grn_number.ilike(term),
                    GoodsReceiptNote.challan_number.ilike(term),
                )
            )

        count_stmt = select(func.count(GoodsReceiptNote.id)).where(and_(*conditions))
        total_count = (await db.execute(count_stmt)).scalar() or 0

        offset = (filters.page - 1) * filters.page_size
        stmt = (
            select(GoodsReceiptNote)
            .where(and_(*conditions))
            .options(
                selectinload(GoodsReceiptNote.lines).selectinload(GrnLine.inspections),
            )
            .order_by(GoodsReceiptNote.created_at.desc())
            .offset(offset)
            .limit(filters.page_size)
        )
        res = await db.execute(stmt)
        grns = list(res.scalars().all())

        return grns, total_count

    async def create(
        self,
        db: AsyncSession,
        grn: GoodsReceiptNote,
    ) -> GoodsReceiptNote:
        db.add(grn)
        await db.flush()
        return grn

    async def update(
        self,
        db: AsyncSession,
        grn: GoodsReceiptNote,
    ) -> GoodsReceiptNote:
        await db.flush()
        return grn

    async def get_line(
        self,
        db: AsyncSession,
        grn_line_id: UUID,
        org_id: UUID,
    ) -> Optional[GrnLine]:
        stmt = (
            select(GrnLine)
            .where(
                and_(
                    GrnLine.id == grn_line_id,
                    GrnLine.org_id == org_id,
                )
            )
            .options(selectinload(GrnLine.inspections))
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def create_inspection(
        self,
        db: AsyncSession,
        qi: QualityInspection,
    ) -> QualityInspection:
        db.add(qi)
        await db.flush()
        return qi

    async def generate_grn_number(
        self,
        db: AsyncSession,
        org_id: UUID,
    ) -> str:
        year = datetime.now(timezone.utc).year
        seq_name = f"seq_grn_{year}"

        try:
            await db.execute(
                text(f"CREATE SEQUENCE IF NOT EXISTS {seq_name} START WITH 1 INCREMENT BY 1;")
            )
            result = await db.execute(text(f"SELECT nextval('{seq_name}')"))
            n = result.scalar()
        except Exception:
            cnt_stmt = select(func.count(GoodsReceiptNote.id)).where(
                GoodsReceiptNote.org_id == org_id
            )
            cnt = (await db.execute(cnt_stmt)).scalar() or 0
            n = cnt + 1

        try:
            max_res = await db.execute(
                text("""
                SELECT COALESCE(
                    MAX(CAST(NULLIF(regexp_replace(grn_number, '^GRN-[0-9]+-', ''), '') AS INTEGER)),
                    0
                ) FROM goods_receipt_notes WHERE org_id = :org_id AND grn_number LIKE :prefix
                """),
                {"org_id": org_id, "prefix": f"GRN-{year}-%"},
            )
            max_val = max_res.scalar() or 0
            if n <= max_val:
                n = max_val + 1
                try:
                    await db.execute(text(f"SELECT setval('{seq_name}', {n})"))
                except Exception:
                    pass
        except Exception:
            pass

        return f"GRN-{year}-{str(n).zfill(6)}"


grn_repository = GrnRepository()
