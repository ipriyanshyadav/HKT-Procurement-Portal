from __future__ import annotations
from typing import Optional, Any
from uuid import UUID, uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.enums import VendorStatusEnum
from app.modules.vendor.models import Vendor, VendorContact, VendorBankAccount
from tests.factories.organization import OrganizationFactory


class VendorFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        company_name: Optional[str] = None,
        primary_email: Optional[str] = None,
        status: VendorStatusEnum = VendorStatusEnum.ACTIVE,
        **overrides: Any,
    ) -> Vendor:
        suffix = uuid4().hex[:8]
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id

        vendor = Vendor(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            vendor_code=overrides.pop("vendor_code", f"V-{suffix[:6].upper()}"),
            company_name=company_name or f"Vendor Corp {suffix}",
            legal_name=overrides.pop("legal_name", f"Vendor Corp Legal {suffix}"),
            registration_type=overrides.pop("registration_type", "DOMESTIC"),
            primary_email=primary_email or f"vendor_{suffix}@testvendor.internal",
            primary_phone=overrides.pop("primary_phone", "+919876543210"),
            pan=overrides.pop("pan", f"AAACV{suffix[:4].upper()}Z"),
            gstin=overrides.pop("gstin", f"27AAACV{suffix[:4].upper()}1Z5"),
            status=status,
            city=overrides.pop("city", "Mumbai"),
            state=overrides.pop("state", "Maharashtra"),
            country_code=overrides.pop("country_code", "IN"),
            **overrides,
        )
        db.add(vendor)
        await db.flush()
        return vendor


class VendorContactFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        vendor_id: UUID,
        org_id: Optional[UUID] = None,
        name: Optional[str] = None,
        email: Optional[str] = None,
        **overrides: Any,
    ) -> VendorContact:
        suffix = uuid4().hex[:6]
        contact = VendorContact(
            id=overrides.pop("id", uuid4()),
            org_id=org_id or uuid4(),
            vendor_id=vendor_id,
            name=name or f"Contact {suffix}",
            email=email or f"contact_{suffix}@testvendor.internal",
            phone=overrides.pop("phone", "+919876543211"),
            is_primary=overrides.pop("is_primary", True),
            is_active=overrides.pop("is_active", True),
            **overrides,
        )
        db.add(contact)
        await db.flush()
        return contact


class VendorBankFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        vendor_id: UUID,
        org_id: Optional[UUID] = None,
        bank_name: str = "State Bank of India",
        **overrides: Any,
    ) -> VendorBankAccount:
        suffix = uuid4().hex[:6].upper()
        bank = VendorBankAccount(
            id=overrides.pop("id", uuid4()),
            org_id=org_id or uuid4(),
            vendor_id=vendor_id,
            account_holder_name=overrides.pop("account_holder_name", f"Vendor Account {suffix}"),
            bank_name=bank_name,
            account_number_encrypted=overrides.pop("account_number_encrypted", f"ENC-{suffix}"),
            ifsc_code=overrides.pop("ifsc_code", "SBIN0001234"),
            is_primary=overrides.pop("is_primary", True),
            penny_test_status=overrides.pop("penny_test_status", "VERIFIED"),
            **overrides,
        )
        db.add(bank)
        await db.flush()
        return bank
