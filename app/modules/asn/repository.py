from __future__ import annotations

import builtins
import contextlib
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.repository_base import BaseRepository
from app.modules.asn.models import AdvanceShippingNotice, AsnLine
from app.modules.asn.schemas import AsnFilterParams


class AsnRepository(BaseRepository[AdvanceShippingNotice]):
    """Repository for Advance Shipping Notices."""

    def __init__(self) -> None:
        super().__init__(AdvanceShippingNotice)

    async def get(
        self,
        db: AsyncSession,
        asn_id: UUID,
        org_id: UUID,
    ) -> AdvanceShippingNotice | None:
        stmt = (
            select(AdvanceShippingNotice)
            .where(
                and_(
                    AdvanceShippingNotice.id == asn_id,
                    AdvanceShippingNotice.org_id == org_id,
                    AdvanceShippingNotice.deleted_at.is_(None),
                )
            )
            .options(
                selectinload(AdvanceShippingNotice.lines),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_number(
        self,
        db: AsyncSession,
        asn_number: str,
        org_id: UUID,
    ) -> AdvanceShippingNotice | None:
        stmt = (
            select(AdvanceShippingNotice)
            .where(
                and_(
                    AdvanceShippingNotice.asn_number == asn_number,
                    AdvanceShippingNotice.org_id == org_id,
                    AdvanceShippingNotice.deleted_at.is_(None),
                )
            )
            .options(
                selectinload(AdvanceShippingNotice.lines),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def lookup_by_code(
        self,
        db: AsyncSession,
        raw_code: str,
        org_id: UUID,
    ) -> AdvanceShippingNotice | None:
        code = raw_code.strip()
        # Parse piped or delimited barcode payload if formatted e.g. "ASN|ASN-2026-00001|..."
        extracted_asn_number = None
        if code.startswith(("ASN|", "ASN:")):
            parts = code.replace(":", "|").split("|")
            if len(parts) >= 2 and parts[1]:
                extracted_asn_number = parts[1]

        conditions = [
            AdvanceShippingNotice.asn_number == code,
            AdvanceShippingNotice.barcode_data == code,
            AdvanceShippingNotice.tracking_number == code,
        ]
        if extracted_asn_number:
            conditions.append(AdvanceShippingNotice.asn_number == extracted_asn_number)

        stmt = (
            select(AdvanceShippingNotice)
            .where(
                and_(
                    AdvanceShippingNotice.org_id == org_id,
                    AdvanceShippingNotice.deleted_at.is_(None),
                    or_(*conditions),
                )
            )
            .options(
                selectinload(AdvanceShippingNotice.lines),
            )
        )
        res = await db.execute(stmt)
        record = res.scalar_one_or_none()
        if record:
            return record

        # Fallback to partial match on tracking number or barcode data
        stmt_fallback = (
            select(AdvanceShippingNotice)
            .where(
                and_(
                    AdvanceShippingNotice.org_id == org_id,
                    AdvanceShippingNotice.deleted_at.is_(None),
                    or_(
                        AdvanceShippingNotice.tracking_number.ilike(f"%{code}%"),
                        AdvanceShippingNotice.barcode_data.ilike(f"%{code}%"),
                    ),
                )
            )
            .options(
                selectinload(AdvanceShippingNotice.lines),
            )
        )
        res_fallback = await db.execute(stmt_fallback)
        return res_fallback.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        org_id: UUID,
        filters: AsnFilterParams,
        vendor_id: UUID | None = None,
    ) -> tuple[builtins.list[AdvanceShippingNotice], int]:
        conditions = [
            AdvanceShippingNotice.org_id == org_id,
            AdvanceShippingNotice.deleted_at.is_(None),
        ]

        if vendor_id:
            conditions.append(AdvanceShippingNotice.vendor_id == vendor_id)
        elif filters.vendor_id:
            conditions.append(AdvanceShippingNotice.vendor_id == filters.vendor_id)

        if filters.po_id:
            conditions.append(AdvanceShippingNotice.po_id == filters.po_id)
        if filters.status:
            conditions.append(AdvanceShippingNotice.status == filters.status)

        if filters.search:
            term = f"%{filters.search}%"
            conditions.append(
                or_(
                    AdvanceShippingNotice.asn_number.ilike(term),
                    AdvanceShippingNotice.tracking_number.ilike(term),
                    AdvanceShippingNotice.carrier_name.ilike(term),
                    AdvanceShippingNotice.vehicle_number.ilike(term),
                )
            )

        count_stmt = select(func.count(AdvanceShippingNotice.id)).where(and_(*conditions))
        total = (await db.execute(count_stmt)).scalar() or 0

        offset = (filters.page - 1) * filters.page_size
        stmt = (
            select(AdvanceShippingNotice)
            .where(and_(*conditions))
            .options(
                selectinload(AdvanceShippingNotice.lines),
            )
            .order_by(AdvanceShippingNotice.created_at.desc())
            .offset(offset)
            .limit(filters.page_size)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all()), total

    async def create(
        self,
        db: AsyncSession,
        asn: AdvanceShippingNotice,
    ) -> AdvanceShippingNotice:
        db.add(asn)
        await db.flush()
        return asn

    async def get_line(
        self,
        db: AsyncSession,
        line_id: UUID,
        org_id: UUID,
    ) -> AsnLine | None:
        stmt = select(AsnLine).where(
            and_(
                AsnLine.id == line_id,
                AsnLine.org_id == org_id,
                AsnLine.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def generate_asn_number(
        self,
        db: AsyncSession,
        org_id: UUID,
    ) -> str:
        year = datetime.now(UTC).year
        seq_name = f"seq_asn_{year}"

        try:
            await db.execute(text(f"CREATE SEQUENCE IF NOT EXISTS {seq_name} START WITH 1 INCREMENT BY 1;"))
            result = await db.execute(text(f"SELECT nextval('{seq_name}')"))
            n = result.scalar()
        except Exception:
            cnt_stmt = select(func.count(AdvanceShippingNotice.id)).where(AdvanceShippingNotice.org_id == org_id)
            cnt = (await db.execute(cnt_stmt)).scalar() or 0
            n = cnt + 1

        with contextlib.suppress(Exception):
            max_res = await db.execute(
                text("""
                SELECT COALESCE(
                    MAX(CAST(NULLIF(regexp_replace(asn_number, '^ASN-[0-9]+-', ''), '') AS INTEGER)),
                    0
                ) FROM advance_shipping_notices WHERE org_id = :org_id AND asn_number LIKE :prefix
                """),
                {"org_id": org_id, "prefix": f"ASN-{year}-%"},
            )
            max_val = max_res.scalar() or 0
            if n <= max_val:
                n = max_val + 1
                with contextlib.suppress(Exception):
                    await db.execute(text(f"SELECT setval('{seq_name}', {n})"))

        return f"ASN-{year}-{str(n).zfill(5)}"


asn_repository = AsnRepository()
