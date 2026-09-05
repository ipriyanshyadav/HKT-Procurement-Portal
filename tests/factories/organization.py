from __future__ import annotations
from decimal import Decimal
from typing import Optional, Dict, Any
from uuid import UUID, uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.organization.models import (
    Organization,
    LegalEntity,
    BusinessUnit,
    Plant,
    CostCenter,
    Department,
)
from app.modules.master_data.models import DeliveryLocation


class OrganizationFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        name: Optional[str] = None,
        legal_name: Optional[str] = None,
        base_currency: str = "INR",
        country_code: str = "IN",
        **overrides: Any,
    ) -> Organization:
        suffix = uuid4().hex[:8]
        org = Organization(
            id=overrides.pop("id", uuid4()),
            name=name or f"Test Org {suffix}",
            legal_name=legal_name or f"Test Org Legal {suffix}",
            country_code=country_code,
            base_currency=base_currency,
            cost_of_capital_rate=overrides.pop("cost_of_capital_rate", Decimal("0.1200")),
            settings=overrides.pop("settings", {"budget_check_config": {"default_mode": "soft"}}),
            **overrides,
        )
        db.add(org)
        await db.flush()
        return org


class LegalEntityFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        name: Optional[str] = None,
        **overrides: Any,
    ) -> LegalEntity:
        suffix = uuid4().hex[:8]
        le = LegalEntity(
            id=overrides.pop("id", uuid4()),
            org_id=org_id or uuid4(),
            name=name or f"Legal Entity {suffix}",
            registration_number=overrides.pop("registration_number", f"REG-{suffix.upper()}"),
            gstin=overrides.pop("gstin", f"27{uuid4().hex[:10].upper()}1Z5"),
            pan=overrides.pop("pan", f"{uuid4().hex[:5].upper()}{uuid4().hex[:4].upper()}A"),
            country_code=overrides.pop("country_code", "IN"),
            **overrides,
        )
        db.add(le)
        await db.flush()
        return le


class BusinessUnitFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        legal_entity_id: Optional[UUID] = None,
        name: Optional[str] = None,
        code: Optional[str] = None,
        **overrides: Any,
    ) -> BusinessUnit:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id
        if not legal_entity_id:
            le = await LegalEntityFactory.create(db, org_id=org_id)
            legal_entity_id = le.id

        bu = BusinessUnit(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            code=code or f"BU-{suffix}",
            name=name or f"Business Unit {suffix}",
            legal_entity_id=legal_entity_id,
            default_currency=overrides.pop("default_currency", "INR"),
            is_active=overrides.pop("is_active", True),
            **overrides,
        )
        db.add(bu)
        await db.flush()
        return bu


class PlantFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        business_unit_id: Optional[UUID] = None,
        name: Optional[str] = None,
        code: Optional[str] = None,
        **overrides: Any,
    ) -> Plant:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id
        if not business_unit_id:
            bu = await BusinessUnitFactory.create(db, org_id=org_id)
            business_unit_id = bu.id

        plant = Plant(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            code=code or f"PL-{suffix}",
            name=name or f"Plant {suffix}",
            business_unit_id=business_unit_id,
            plant_type=overrides.pop("plant_type", "MANUFACTURING"),
            city=overrides.pop("city", "Mumbai"),
            state=overrides.pop("state", "Maharashtra"),
            country_code=overrides.pop("country_code", "IN"),
            is_active=overrides.pop("is_active", True),
            **overrides,
        )
        db.add(plant)
        await db.flush()
        return plant


class CostCenterFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        business_unit_id: Optional[UUID] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        **overrides: Any,
    ) -> CostCenter:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id
        if not business_unit_id:
            bu = await BusinessUnitFactory.create(db, org_id=org_id)
            business_unit_id = bu.id

        cc = CostCenter(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            code=code or f"CC-{suffix}",
            name=name or f"Cost Center {suffix}",
            business_unit_id=business_unit_id,
            annual_budget=overrides.pop("annual_budget", Decimal("10000000.00")),
            available_budget=overrides.pop("available_budget", Decimal("10000000.00")),
            is_active=overrides.pop("is_active", True),
            **overrides,
        )
        db.add(cc)
        await db.flush()
        return cc


class DepartmentFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        business_unit_id: Optional[UUID] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        **overrides: Any,
    ) -> Department:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id
        if not business_unit_id:
            bu = await BusinessUnitFactory.create(db, org_id=org_id)
            business_unit_id = bu.id

        dept = Department(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            code=code or f"DEPT-{suffix}",
            name=name or f"Department {suffix}",
            business_unit_id=business_unit_id,
            is_active=overrides.pop("is_active", True),
            **overrides,
        )
        db.add(dept)
        await db.flush()
        return dept


class DeliveryLocationFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        plant_id: Optional[UUID] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        **overrides: Any,
    ) -> DeliveryLocation:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id

        loc = DeliveryLocation(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            code=code or f"LOC-{suffix}",
            name=name or f"Location {suffix}",
            address=overrides.pop("address", f"{suffix} Warehouse Road"),
            city=overrides.pop("city", "Mumbai"),
            state=overrides.pop("state", "Maharashtra"),
            postal_code=overrides.pop("postal_code", "400001"),
            country_code=overrides.pop("country_code", "IN"),
            plant_id=plant_id,
            is_active=overrides.pop("is_active", True),
            **overrides,
        )
        db.add(loc)
        await db.flush()
        return loc
