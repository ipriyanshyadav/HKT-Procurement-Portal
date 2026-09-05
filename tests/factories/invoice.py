from __future__ import annotations
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, Any
from uuid import UUID, uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.enums import InvoiceStatusEnum, PaymentStatusEnum
from app.modules.invoice.models import Invoice, InvoiceLine
from app.modules.payment.models import PaymentRecord
from tests.factories.organization import OrganizationFactory
from tests.factories.vendor import VendorFactory
from tests.factories.purchase_order import PurchaseOrderFactory, POLineFactory


class InvoiceLineFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        invoice_id: UUID,
        po_line_id: UUID,
        org_id: Optional[UUID] = None,
        line_number: int = 1,
        item_description: str = "High Pressure Valve",
        quantity: Decimal = Decimal("10.0"),
        unit_price: Decimal = Decimal("5000.0"),
        tax_rate: Decimal = Decimal("18.00"),
        **overrides: Any,
    ) -> InvoiceLine:
        tax_amount = (quantity * unit_price * tax_rate) / Decimal("100.0")
        line_total = (quantity * unit_price) + tax_amount

        line = InvoiceLine(
            id=overrides.pop("id", uuid4()),
            org_id=org_id or uuid4(),
            invoice_id=invoice_id,
            po_line_id=po_line_id,
            line_number=line_number,
            item_description=item_description,
            quantity=quantity,
            unit_price=unit_price,
            tax_rate=tax_rate,
            tax_amount=tax_amount,
            line_total=line_total,
            **overrides,
        )
        db.add(line)
        await db.flush()
        return line


class InvoiceFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        po_id: Optional[UUID] = None,
        vendor_id: Optional[UUID] = None,
        org_id: Optional[UUID] = None,
        status: InvoiceStatusEnum = InvoiceStatusEnum.APPROVED,
        amount: float = 50000.0,
        lines_count: int = 1,
        **overrides: Any,
    ) -> Invoice:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id
        if not vendor_id:
            v = await VendorFactory.create(db, org_id=org_id)
            vendor_id = v.id
        if not po_id:
            po = await PurchaseOrderFactory.create(db, org_id=org_id, vendor_id=vendor_id, amount=amount)
            po_id = po.id

        subtotal = Decimal(str(amount))
        tax_amount = subtotal * Decimal("0.18")
        total_amount = subtotal + tax_amount

        inv = Invoice(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            invoice_number=overrides.pop("invoice_number", f"INV-{suffix}"),
            vendor_invoice_number=overrides.pop("vendor_invoice_number", f"VINV-{suffix}"),
            vendor_id=vendor_id,
            po_id=po_id,
            invoice_date=overrides.pop("invoice_date", date.today()),
            due_date=overrides.pop("due_date", date.today() + timedelta(days=30)),
            currency=overrides.pop("currency", "INR"),
            subtotal=subtotal,
            tax_amount=tax_amount,
            total_amount=total_amount,
            status=status,
            match_status=overrides.pop("match_status", "MATCHED"),
            **overrides,
        )
        db.add(inv)
        await db.flush()
        return inv


class PaymentFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        invoice_id: UUID,
        vendor_id: UUID,
        org_id: Optional[UUID] = None,
        amount: Decimal = Decimal("59000.00"),
        status: PaymentStatusEnum = PaymentStatusEnum.COMPLETED,
        **overrides: Any,
    ) -> PaymentRecord:
        suffix = uuid4().hex[:6].upper()
        payment = PaymentRecord(
            id=overrides.pop("id", uuid4()),
            org_id=org_id or uuid4(),
            invoice_id=invoice_id,
            vendor_id=vendor_id,
            payment_date=overrides.pop("payment_date", date.today()),
            amount=amount,
            gross_amount=overrides.pop("gross_amount", amount),
            net_amount=overrides.pop("net_amount", amount),
            currency=overrides.pop("currency", "INR"),
            utr_number=overrides.pop("utr_number", f"UTR-{suffix}"),
            status=status,
            **overrides,
        )
        db.add(payment)
        await db.flush()
        return payment
