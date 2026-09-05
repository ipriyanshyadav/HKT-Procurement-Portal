from __future__ import annotations
from decimal import Decimal
from typing import Optional, Any
from uuid import UUID, uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.enums import RfqStatusEnum, RfqTypeEnum, SourcingTypeEnum, EvaluationTypeEnum
from app.modules.sourcing.models import Rfq, RfqLine, RfqParticipant
from tests.factories.organization import OrganizationFactory, BusinessUnitFactory
from tests.factories.user import UserFactory
from tests.factories.master_data import CategoryFactory, UOMFactory
from tests.factories.vendor import VendorFactory


class RfqLineFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        rfq_id: UUID,
        org_id: Optional[UUID] = None,
        line_number: int = 1,
        item_description: str = "Precision Steel Bearing",
        quantity: Decimal = Decimal("50.0"),
        estimated_unit_price: Decimal = Decimal("1000.0"),
        category_id: Optional[UUID] = None,
        uom_id: Optional[UUID] = None,
        **overrides: Any,
    ) -> RfqLine:
        if not org_id:
            org_id = uuid4()
        if not category_id:
            cat = await CategoryFactory.create(db, org_id=org_id)
            category_id = cat.id
        if not uom_id:
            uom = await UOMFactory.create(db, org_id=org_id)
            uom_id = uom.id

        line = RfqLine(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            rfq_id=rfq_id,
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


class RfqParticipantFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        rfq_id: UUID,
        vendor_id: Optional[UUID] = None,
        org_id: Optional[UUID] = None,
        **overrides: Any,
    ) -> RfqParticipant:
        if not org_id:
            org_id = uuid4()
        if not vendor_id:
            v = await VendorFactory.create(db, org_id=org_id)
            vendor_id = v.id

        p = RfqParticipant(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            rfq_id=rfq_id,
            vendor_id=vendor_id,
            invitation_status=overrides.pop("invitation_status", "INVITED"),
            **overrides,
        )
        db.add(p)
        await db.flush()
        return p


class RfqFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        buyer_id: Optional[UUID] = None,
        business_unit_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        title: Optional[str] = None,
        status: RfqStatusEnum = RfqStatusEnum.DRAFT,
        amount: float = 100000.0,
        lines_count: int = 1,
        **overrides: Any,
    ) -> Rfq:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id
        if not buyer_id:
            b = await UserFactory.create(db, org_id=org_id, role="BUYER")
            buyer_id = b.id
        if not business_unit_id:
            bu = await BusinessUnitFactory.create(db, org_id=org_id)
            business_unit_id = bu.id
        if not category_id:
            cat = await CategoryFactory.create(db, org_id=org_id)
            category_id = cat.id

        rfq = Rfq(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            rfq_number=overrides.pop("rfq_number", f"RFQ-{suffix}"),
            title=title or f"RFQ {suffix}",
            buyer_id=buyer_id,
            business_unit_id=business_unit_id,
            category_id=category_id,
            currency=overrides.pop("currency", "INR"),
            status=status,
            rfq_type=overrides.pop("rfq_type", RfqTypeEnum.LIMITED_TENDER),
            sourcing_type=overrides.pop("sourcing_type", SourcingTypeEnum.GOODS),
            evaluation_type=overrides.pop("evaluation_type", EvaluationTypeEnum.L1_PRICE_ONLY),
            estimated_value=Decimal(str(amount)),
            bid_validity_days=overrides.pop("bid_validity_days", 90),
            **overrides,
        )
        db.add(rfq)
        await db.flush()

        for i in range(1, lines_count + 1):
            await RfqLineFactory.create(
                db,
                rfq_id=rfq.id,
                org_id=org_id,
                line_number=i,
                category_id=category_id,
            )

        return rfq
