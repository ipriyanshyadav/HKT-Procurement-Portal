from __future__ import annotations
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, Any, Dict
from uuid import UUID, uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.enums import ContractStatusEnum
from app.modules.contract.models import Contract, ContractTemplate
from tests.factories.organization import OrganizationFactory, BusinessUnitFactory
from tests.factories.vendor import VendorFactory
from tests.factories.master_data import CategoryFactory


class ContractTemplateFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        name: Optional[str] = None,
        contract_type: str = "RATE_CONTRACT",
        template_content: Optional[Dict[str, Any]] = None,
        **overrides: Any,
    ) -> ContractTemplate:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id

        tmpl = ContractTemplate(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            name=name or f"Template {suffix}",
            contract_type=contract_type,
            template_content=template_content or {"sections": ["Terms", "Scope", "Pricing"]},
            is_active=overrides.pop("is_active", True),
            **overrides,
        )
        db.add(tmpl)
        await db.flush()
        return tmpl


class ContractFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        vendor_id: Optional[UUID] = None,
        business_unit_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        title: Optional[str] = None,
        amount: float = 1000000.0,
        status: ContractStatusEnum = ContractStatusEnum.ACTIVE,
        **overrides: Any,
    ) -> Contract:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id
        if not vendor_id:
            v = await VendorFactory.create(db, org_id=org_id)
            vendor_id = v.id
        if not business_unit_id:
            bu = await BusinessUnitFactory.create(db, org_id=org_id)
            business_unit_id = bu.id
        if not category_id:
            cat = await CategoryFactory.create(db, org_id=org_id)
            category_id = cat.id

        contract = Contract(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            contract_number=overrides.pop("contract_number", f"CTR-{suffix}"),
            title=title or f"Contract {suffix}",
            vendor_id=vendor_id,
            business_unit_id=business_unit_id,
            category_id=category_id,
            currency=overrides.pop("currency", "INR"),
            total_value=Decimal(str(amount)),
            status=status,
            start_date=overrides.pop("start_date", date.today()),
            end_date=overrides.pop("end_date", date.today() + timedelta(days=365)),
            **overrides,
        )
        db.add(contract)
        await db.flush()
        return contract
