from __future__ import annotations
from decimal import Decimal
from typing import Optional, Any
from uuid import UUID, uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.master_data.models import (
    Category,
    UomMaster,
    CurrencyMaster,
    PaymentTerm,
    TaxCode,
    Incoterm,
)
from tests.factories.organization import OrganizationFactory


class CategoryFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        **overrides: Any,
    ) -> Category:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id

        cat = Category(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            code=code or f"CAT-{suffix}",
            name=name or f"Category {suffix}",
            level=overrides.pop("level", 1),
            is_active=overrides.pop("is_active", True),
            requires_quality_inspection=overrides.pop("requires_quality_inspection", False),
            **overrides,
        )
        db.add(cat)
        await db.flush()
        return cat


class UOMFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        **overrides: Any,
    ) -> UomMaster:
        suffix = uuid4().hex[:4].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id

        uom = UomMaster(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            code=code or f"U{suffix}",
            name=name or f"Unit {suffix}",
            iso_code=overrides.pop("iso_code", f"U{suffix}"),
            is_active=overrides.pop("is_active", True),
            **overrides,
        )
        db.add(uom)
        await db.flush()
        return uom


class CurrencyFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        **overrides: Any,
    ) -> CurrencyMaster:
        suffix = uuid4().hex[:3].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id

        curr = CurrencyMaster(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            code=code or suffix,
            name=name or f"Currency {suffix}",
            symbol=overrides.pop("symbol", "₹"),
            exchange_rate_to_base=overrides.pop("exchange_rate_to_base", Decimal("1.0")),
            is_base_currency=overrides.pop("is_base_currency", False),
            is_active=overrides.pop("is_active", True),
            **overrides,
        )
        db.add(curr)
        await db.flush()
        return curr


class PaymentTermFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        **overrides: Any,
    ) -> PaymentTerm:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id

        pt = PaymentTerm(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            code=code or f"NET{suffix[:2]}",
            name=name or f"Net {suffix[:2]} Days",
            net_days=overrides.pop("net_days", 30),
            payment_days=overrides.pop("payment_days", 30),
            discount_percentage=overrides.pop("discount_percentage", Decimal("0.0")),
            discount_days=overrides.pop("discount_days", 0),
            is_active=overrides.pop("is_active", True),
            **overrides,
        )
        db.add(pt)
        await db.flush()
        return pt


class TaxCodeFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        rate: Decimal = Decimal("18.00"),
        **overrides: Any,
    ) -> TaxCode:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id

        tax = TaxCode(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            code=code or f"GST{suffix[:2]}",
            name=name or f"GST {rate}%",
            rate=rate,
            tax_type=overrides.pop("tax_type", "GST"),
            hsn_chapter=overrides.pop("hsn_chapter", "84"),
            is_active=overrides.pop("is_active", True),
            **overrides,
        )
        db.add(tax)
        await db.flush()
        return tax


class IncotermFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        **overrides: Any,
    ) -> Incoterm:
        suffix = uuid4().hex[:3].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id

        inc = Incoterm(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            code=code or suffix,
            name=name or f"Incoterm {suffix}",
            edition_year=overrides.pop("edition_year", 2020),
            risk_transfer_point=overrides.pop("risk_transfer_point", "Destination"),
            is_active=overrides.pop("is_active", True),
            **overrides,
        )
        db.add(inc)
        await db.flush()
        return inc
