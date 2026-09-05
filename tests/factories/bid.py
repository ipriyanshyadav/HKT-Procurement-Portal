from __future__ import annotations
import hashlib
import json
from decimal import Decimal
from typing import Optional, Any
from uuid import UUID, uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.enums import BidStatusEnum
from app.modules.bid.models import BidResponse, BidLineResponse
from tests.factories.organization import OrganizationFactory
from tests.factories.vendor import VendorFactory
from tests.factories.rfq import RfqFactory


class BidLineFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        bid_id: UUID,
        rfq_line_id: UUID,
        org_id: Optional[UUID] = None,
        quantity: Decimal = Decimal("50.0"),
        unit_price: Decimal = Decimal("950.0"),
        **overrides: Any,
    ) -> BidLineResponse:
        line = BidLineResponse(
            id=overrides.pop("id", uuid4()),
            org_id=org_id or uuid4(),
            bid_id=bid_id,
            rfq_line_id=rfq_line_id,
            currency=overrides.pop("currency", "INR"),
            normalized_price_inr=unit_price,
            **overrides,
        )
        db.add(line)
        await db.flush()
        return line


class BidFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        rfq_id: Optional[UUID] = None,
        vendor_id: Optional[UUID] = None,
        org_id: Optional[UUID] = None,
        status: BidStatusEnum = BidStatusEnum.SUBMITTED,
        amount: float = 47500.0,
        **overrides: Any,
    ) -> BidResponse:
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id
        if not vendor_id:
            v = await VendorFactory.create(db, org_id=org_id)
            vendor_id = v.id
        if not rfq_id:
            rfq = await RfqFactory.create(db, org_id=org_id)
            rfq_id = rfq.id

        bid_payload = {"rfq_id": str(rfq_id), "vendor_id": str(vendor_id), "amount": str(amount)}
        bid_hash = hashlib.sha256(json.dumps(bid_payload, sort_keys=True).encode()).hexdigest()

        bid = BidResponse(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            rfq_id=rfq_id,
            vendor_id=vendor_id,
            status=status,
            total_amount=Decimal(str(amount)),
            bid_hash=overrides.pop("bid_hash", bid_hash),
            **overrides,
        )
        db.add(bid)
        await db.flush()
        return bid
