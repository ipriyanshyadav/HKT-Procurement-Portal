from __future__ import annotations
from datetime import date
from decimal import Decimal
from typing import Optional, Any
from uuid import UUID, uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.enums import PoStatusEnum
from app.modules.purchase_order.models import PurchaseOrder, PoLine
from app.modules.grn.models import GoodsReceiptNote, GrnLine
from tests.factories.organization import OrganizationFactory, BusinessUnitFactory
from tests.factories.user import UserFactory
from tests.factories.vendor import VendorFactory
from tests.factories.master_data import CategoryFactory, UOMFactory


class POLineFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        po_id: UUID,
        org_id: Optional[UUID] = None,
        line_number: int = 1,
        item_description: str = "High Pressure Valve",
        ordered_quantity: Decimal = Decimal("10.0"),
        unit_price: Decimal = Decimal("5000.0"),
        uom_id: Optional[UUID] = None,
        **overrides: Any,
    ) -> PoLine:
        if not org_id:
            org_id = uuid4()
        if not uom_id:
            uom = await UOMFactory.create(db, org_id=org_id)
            uom_id = uom.id

        line = PoLine(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            po_id=po_id,
            line_number=line_number,
            item_description=item_description,
            ordered_quantity=ordered_quantity,
            unit_price=unit_price,
            uom_id=uom_id,
            **overrides,
        )
        db.add(line)
        await db.flush()
        return line


class PurchaseOrderFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        vendor_id: Optional[UUID] = None,
        buyer_id: Optional[UUID] = None,
        business_unit_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        title: Optional[str] = None,
        amount: float = 50000.0,
        status: PoStatusEnum = PoStatusEnum.RELEASED,
        lines_count: int = 1,
        **overrides: Any,
    ) -> PurchaseOrder:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id
        if not vendor_id:
            v = await VendorFactory.create(db, org_id=org_id)
            vendor_id = v.id
        if not buyer_id:
            b = await UserFactory.create(db, org_id=org_id, role="BUYER")
            buyer_id = b.id
        if not business_unit_id:
            bu = await BusinessUnitFactory.create(db, org_id=org_id)
            business_unit_id = bu.id
        if not category_id:
            cat = await CategoryFactory.create(db, org_id=org_id)
            category_id = cat.id

        dec_amount = Decimal(str(amount))
        po = PurchaseOrder(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            po_number=overrides.pop("po_number", f"PO-{suffix}"),
            title=title or f"Purchase Order {suffix}",
            vendor_id=vendor_id,
            buyer_id=buyer_id,
            business_unit_id=business_unit_id,
            category_id=category_id,
            currency=overrides.pop("currency", "INR"),
            total_value=dec_amount,
            status=status,
            **overrides,
        )
        db.add(po)
        await db.flush()

        if lines_count > 0:
            unit_price = dec_amount / Decimal(str(lines_count * 10))
            for i in range(1, lines_count + 1):
                await POLineFactory.create(
                    db,
                    po_id=po.id,
                    org_id=org_id,
                    line_number=i,
                    ordered_quantity=Decimal("10.0"),
                    unit_price=unit_price,
                )

        return po


class GrnLineFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        grn_id: UUID,
        po_line_id: UUID,
        org_id: Optional[UUID] = None,
        received_quantity: Decimal = Decimal("10.0"),
        accepted_quantity: Decimal = Decimal("10.0"),
        rejected_quantity: Decimal = Decimal("0.0"),
        **overrides: Any,
    ) -> GrnLine:
        line = GrnLine(
            id=overrides.pop("id", uuid4()),
            org_id=org_id or uuid4(),
            grn_id=grn_id,
            po_line_id=po_line_id,
            received_quantity=received_quantity,
            accepted_quantity=accepted_quantity,
            rejected_quantity=rejected_quantity,
            **overrides,
        )
        db.add(line)
        await db.flush()
        return line


class GRNFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        po_id: Optional[UUID] = None,
        vendor_id: Optional[UUID] = None,
        org_id: Optional[UUID] = None,
        received_by: Optional[UUID] = None,
        status: str = "CONFIRMED",
        **overrides: Any,
    ) -> GoodsReceiptNote:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id
        if not vendor_id:
            v = await VendorFactory.create(db, org_id=org_id)
            vendor_id = v.id
        if not po_id:
            po = await PurchaseOrderFactory.create(db, org_id=org_id, vendor_id=vendor_id)
            po_id = po.id
        if not received_by:
            u = await UserFactory.create(db, org_id=org_id, role="WAREHOUSE_USER")
            received_by = u.id

        grn = GoodsReceiptNote(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            grn_number=overrides.pop("grn_number", f"GRN-{suffix}"),
            po_id=po_id,
            vendor_id=vendor_id,
            receipt_date=overrides.pop("receipt_date", date.today()),
            received_by=received_by,
            status=status,
            **overrides,
        )
        db.add(grn)
        await db.flush()
        return grn
