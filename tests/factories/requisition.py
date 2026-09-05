from __future__ import annotations
from decimal import Decimal
from typing import Optional, Any, List
from uuid import UUID, uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.enums import PrStatusEnum, ProcurementTypeEnum
from app.modules.requisition.models import Requisition, RequisitionLine
from tests.factories.organization import (
    OrganizationFactory,
    BusinessUnitFactory,
    CostCenterFactory,
)
from tests.factories.user import UserFactory
from tests.factories.master_data import CategoryFactory, UOMFactory


class RequisitionLineFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        requisition_id: UUID,
        org_id: Optional[UUID] = None,
        line_number: int = 1,
        item_description: str = "Industrial Standard Valve",
        quantity: Decimal = Decimal("10.0"),
        estimated_unit_price: Decimal = Decimal("5000.0"),
        category_id: Optional[UUID] = None,
        uom_id: Optional[UUID] = None,
        **overrides: Any,
    ) -> RequisitionLine:
        if not org_id:
            org_id = uuid4()
        if not category_id:
            cat = await CategoryFactory.create(db, org_id=org_id)
            category_id = cat.id
        if not uom_id:
            uom = await UOMFactory.create(db, org_id=org_id)
            uom_id = uom.id

        line = RequisitionLine(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            requisition_id=requisition_id,
            line_number=line_number,
            item_description=item_description,
            category_id=category_id,
            uom_id=uom_id,
            quantity=quantity,
            estimated_unit_price=estimated_unit_price,
            **overrides,
        )
        db.add(line)
        await db.flush()
        return line


class RequisitionFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        requestor_id: Optional[UUID] = None,
        business_unit_id: Optional[UUID] = None,
        cost_center_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        title: Optional[str] = None,
        amount: float = 50000.0,
        status: PrStatusEnum = PrStatusEnum.DRAFT,
        lines_count: int = 1,
        **overrides: Any,
    ) -> Requisition:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id
        if not business_unit_id:
            bu = await BusinessUnitFactory.create(db, org_id=org_id)
            business_unit_id = bu.id
        if not cost_center_id:
            cc = await CostCenterFactory.create(db, org_id=org_id, business_unit_id=business_unit_id)
            cost_center_id = cc.id
        if not category_id:
            cat = await CategoryFactory.create(db, org_id=org_id)
            category_id = cat.id
        if not requestor_id:
            u = await UserFactory.create(db, org_id=org_id, role="REQUESTOR")
            requestor_id = u.id

        dec_amount = Decimal(str(amount))
        pr = Requisition(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            pr_number=overrides.pop("pr_number", f"PR-{suffix}"),
            title=title or f"Requisition {suffix}",
            requestor_id=requestor_id,
            business_unit_id=business_unit_id,
            cost_center_id=cost_center_id,
            category_id=category_id,
            currency=overrides.pop("currency", "INR"),
            estimated_value=dec_amount,
            status=status,
            procurement_type=overrides.pop("procurement_type", ProcurementTypeEnum.OPEX),
            **overrides,
        )
        db.add(pr)
        await db.flush()

        if lines_count > 0:
            unit_price = dec_amount / Decimal(str(lines_count * 10))
            for i in range(1, lines_count + 1):
                await RequisitionLineFactory.create(
                    db,
                    requisition_id=pr.id,
                    org_id=org_id,
                    line_number=i,
                    quantity=Decimal("10.0"),
                    estimated_unit_price=unit_price,
                    category_id=category_id,
                )

        return pr
