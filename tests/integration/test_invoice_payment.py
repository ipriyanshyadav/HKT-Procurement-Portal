"""
Integration tests for SPEC_15 Invoice & Payment:
- S15-01: Invoice submission by supplier
- S15-02 / S15-03: 3-way match (PO + GRN + Invoice) with FULL_MATCH, PARTIAL_MATCH, DISCREPANCY
- S15-04: Invoice approval workflow integration
- S15-05: Payment scheduling with business-day due date and holiday calendar
- S15-06: Payment record creation
- S15-07 / S15-08: Dispute management and message thread
- S15-09: Dispute resolution with credit note
- S15-10: TDS deduction on payment (vendor.tds_applicable / vendor.tds_percentage)
- S15-12: Duplicate invoice detection per vendor per FY
- S15-14: Invoice aging alerts (Celery task)
- S15-15: Financial Year computation (April 1 boundary)
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.main  # noqa: F401
from app.config import settings
from app.core.exceptions import ConflictError, ValidationError
from app.db.enums import InvoiceStatusEnum, PaymentStatusEnum, POStatus
from app.modules.invoice.models import Invoice, InvoiceLine, InvoiceMatchResult
from app.modules.invoice.schemas import (
    InvoiceDisputeRequest,
    InvoiceLineCreate,
    InvoiceRejectRequest,
    InvoiceSubmitRequest,
)
from app.modules.invoice.service import QUANTITY_TOLERANCE, invoice_service
from app.modules.master_data.models import HolidayMaster, PaymentTerm
from app.modules.payment.models import Dispute, DisputeMessage, PaymentRecord
from app.modules.payment.schemas import (
    DisputeMessageCreateRequest,
    DisputeResolveRequest,
    ErpPaymentWebhookRequest,
    PaymentProcessRequest,
)
from app.modules.payment.service import payment_service
from app.modules.purchase_order.models import PoLine, PurchaseOrder
from app.tasks.invoice_aging import async_check_invoice_aging

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def create_invoice_fixtures(db: AsyncSession, org_id):
    buyer_id = uuid4()
    vendor_id = uuid4()
    bu_id = uuid4()
    cat_id = uuid4()
    uom_id = uuid4()
    term_id = uuid4()
    po_id = uuid4()
    po_line_id = uuid4()
    grn_id = uuid4()
    grn_line_id = uuid4()

    # 1. Organization
    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, :name, :legal_name, 'IN', 'INR', '{"budget_check_config": {"default_mode": "soft"}}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id, "name": f"Org {org_id.hex[:6]}", "legal_name": f"Legal {org_id.hex[:6]}"},
    )

    # 2. Users (Buyer and Vendor Rep)
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
        VALUES (:id, :org_id, :email, 'hash', 'Finance', 'User', 'ACTIVE', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": buyer_id, "org_id": org_id, "email": f"finance-{buyer_id.hex[:6]}@test.com"},
    )

    vendor_user_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
        VALUES (:id, :org_id, :email, 'hash', 'Vendor', 'Rep', 'ACTIVE', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": vendor_user_id, "org_id": org_id, "email": f"vendor-rep-{vendor_user_id.hex[:6]}@test.com"},
    )

    le_id = uuid4()

    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, country_code)
        VALUES (:id, :org_id, 'Invoice Test Entity', :reg, 'IN') ON CONFLICT (id) DO NOTHING
        """),
        {"id": le_id, "org_id": org_id, "reg": f"REG{le_id.hex[:8]}"},
    )

    await db.execute(
        text("""
        INSERT INTO business_units (id, org_id, name, code, legal_entity_id)
        VALUES (:id, :org_id, 'Finance BU', :code, :le_id) ON CONFLICT (id) DO NOTHING
        """),
        {"id": bu_id, "org_id": org_id, "code": f"BU{bu_id.hex[:4]}", "le_id": le_id},
    )
    await db.execute(
        text("""
        INSERT INTO categories (id, org_id, name, code, level)
        VALUES (:id, :org_id, 'IT Supplies', :code, 1) ON CONFLICT (id) DO NOTHING
        """),
        {"id": cat_id, "org_id": org_id, "code": f"C{cat_id.hex[:6]}"},
    )
    await db.execute(
        text("""
        INSERT INTO uom_master (id, org_id, name, code)
        VALUES (:id, :org_id, 'Units', 'UNT') ON CONFLICT (id) DO NOTHING
        """),
        {"id": uom_id, "org_id": org_id},
    )
    await db.execute(
        text("""
        INSERT INTO payment_terms (id, org_id, code, name, net_days, payment_days, is_active)
        VALUES (:id, :org_id, 'NET30', 'Net 30 Days', 30, 30, true) ON CONFLICT (id) DO NOTHING
        """),
        {"id": term_id, "org_id": org_id},
    )

    # 4. Vendor with TDS configured
    await db.execute(
        text("""
        INSERT INTO vendors (id, org_id, vendor_code, company_name, primary_email, status, tds_applicable, tds_percentage, version)
        VALUES (:id, :org_id, :code, :name, :email, 'ACTIVE', true, 2.0, 1) ON CONFLICT (id) DO NOTHING
        """),
        {
            "id": vendor_id,
            "org_id": org_id,
            "code": f"V{vendor_id.hex[:4]}",
            "name": "Reliable Tech Services",
            "email": f"vendor-{vendor_id.hex[:4]}@test.com",
        },
    )

    # 5. Purchase Order (Released & Acknowledged)
    await db.execute(
        text("""
        INSERT INTO purchase_orders (
            id, org_id, po_number, title, vendor_id, status,
            business_unit_id, category_id, currency, total_value,
            payment_term_id, expected_delivery_date, buyer_id, version
        )
        VALUES (
            :po_id, :org_id, :po_number, 'PO for IT Equipment', :vendor_id, 'VENDOR_ACKNOWLEDGED',
            :bu_id, :cat_id, 'INR', 50000.00,
            :term_id, :delivery_date, :buyer_id, 1
        ) ON CONFLICT (id) DO NOTHING
        """),
        {
            "po_id": po_id,
            "org_id": org_id,
            "po_number": f"PO-{org_id.hex[:4]}-001",
            "vendor_id": vendor_id,
            "bu_id": bu_id,
            "cat_id": cat_id,
            "term_id": term_id,
            "delivery_date": date(2026, 6, 1),
            "buyer_id": buyer_id,
        },
    )

    # 6. PO Line: ordered 100 @ 500.00, tax 18%
    await db.execute(
        text("""
        INSERT INTO po_lines (
            id, org_id, po_id, line_number, item_description,
            uom_id, ordered_quantity, unit_price, tax_rate,
            open_quantity, received_quantity, version
        )
        VALUES (
            :line_id, :org_id, :po_id, 1, 'Laptops 16GB RAM',
            :uom_id, 100.0, 500.00, 18.00,
            0.0, 100.0, 1
        ) ON CONFLICT (id) DO NOTHING
        """),
        {
            "line_id": po_line_id,
            "org_id": org_id,
            "po_id": po_id,
            "uom_id": uom_id,
        },
    )

    # 7. GRN recording accepted delivery of 100 units
    await db.execute(
        text("""
        INSERT INTO goods_receipt_notes (
            id, org_id, grn_number, po_id, vendor_id,
            receipt_date, received_by, status, version
        )
        VALUES (
            :grn_id, :org_id, :grn_number, :po_id, :vendor_id,
            :receipt_date, :received_by, 'CONFIRMED', 1
        ) ON CONFLICT (id) DO NOTHING
        """),
        {
            "grn_id": grn_id,
            "org_id": org_id,
            "grn_number": f"GRN-{org_id.hex[:4]}-001",
            "po_id": po_id,
            "vendor_id": vendor_id,
            "receipt_date": date(2026, 5, 20),
            "received_by": buyer_id,
        },
    )

    await db.execute(
        text("""
        INSERT INTO grn_lines (
            id, org_id, grn_id, po_line_id,
            received_quantity, accepted_quantity, rejected_quantity, version
        )
        VALUES (
            :line_id, :org_id, :grn_id, :po_line_id,
            100.0, 100.0, 0.0, 1
        ) ON CONFLICT (id) DO NOTHING
        """),
        {
            "line_id": grn_line_id,
            "org_id": org_id,
            "grn_id": grn_id,
            "po_line_id": po_line_id,
        },
    )

    await db.commit()
    return {
        "org_id": org_id,
        "buyer_id": buyer_id,
        "vendor_id": vendor_id,
        "vendor_user_id": vendor_user_id,
        "po_id": po_id,
        "po_line_id": po_line_id,
        "term_id": term_id,
    }


@pytest.mark.asyncio
async def test_three_way_match_full():
    """Perfect match -> FULL_MATCH, match_status = MATCHED, status = PENDING_APPROVAL."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_invoice_fixtures(db, org_id)

        req = InvoiceSubmitRequest(
            po_id=f["po_id"],
            vendor_invoice_number="INV-2026-001",
            invoice_date=date(2026, 5, 25),
            currency="INR",
            subtotal=Decimal("50000.00"),
            tax_amount=Decimal("9000.00"),
            total_amount=Decimal("59000.00"),
            lines=[
                InvoiceLineCreate(
                    po_line_id=f["po_line_id"],
                    line_number=1,
                    item_description="Laptops 16GB RAM",
                    quantity=Decimal("100.0"),
                    unit_price=Decimal("500.00"),
                    tax_rate=Decimal("18.00"),
                    tax_amount=Decimal("9000.00"),
                    line_total=Decimal("59000.00"),
                )
            ],
        )

        invoice = await invoice_service.submit_invoice(
            db, req, actor_id=f["buyer_id"], vendor_id=f["vendor_id"], org_id=org_id
        )

        assert invoice.match_status == "MATCHED"
        assert invoice.status.value == "PENDING_APPROVAL"
        assert len(invoice.lines) == 1
        assert len(invoice.match_results) == 1
        mr = invoice.match_results[0]
        assert mr.overall_match is True
        assert mr.price_match is True
        assert mr.quantity_match is True
        assert mr.tax_match is True
        assert mr.po_reference_valid is True


@pytest.mark.asyncio
async def test_three_way_match_quantity_variance():
    """Quantity variance > 2% -> PARTIAL_MATCH with QUANTITY_MISMATCH reason."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_invoice_fixtures(db, org_id)

        # 105 units invoiced against 100 received (5% variance > 2% QUANTITY_TOLERANCE)
        req = InvoiceSubmitRequest(
            po_id=f["po_id"],
            vendor_invoice_number="INV-2026-002",
            invoice_date=date(2026, 5, 25),
            currency="INR",
            subtotal=Decimal("52500.00"),
            tax_amount=Decimal("9450.00"),
            total_amount=Decimal("61950.00"),
            lines=[
                InvoiceLineCreate(
                    po_line_id=f["po_line_id"],
                    line_number=1,
                    item_description="Laptops 16GB RAM",
                    quantity=Decimal("105.0"),
                    unit_price=Decimal("500.00"),
                    tax_rate=Decimal("18.00"),
                    tax_amount=Decimal("9450.00"),
                    line_total=Decimal("61950.00"),
                )
            ],
        )

        invoice = await invoice_service.submit_invoice(
            db, req, actor_id=f["buyer_id"], vendor_id=f["vendor_id"], org_id=org_id
        )

        assert invoice.match_status == "PARTIAL_MATCH"
        assert invoice.status.value == "PARTIALLY_MATCHED"
        mr = invoice.match_results[0]
        assert mr.overall_match is False
        assert mr.quantity_match is False
        assert "QUANTITY_MISMATCH" in mr.mismatch_reasons


@pytest.mark.asyncio
async def test_three_way_match_price_variance():
    """Price variance > 0.5% default tolerance -> DISCREPANCY with PRICE_MISMATCH & Auto-Dispute."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_invoice_fixtures(db, org_id)

        # Invoiced price 510.00 vs PO price 500.00 (2% variance > 0.5%)
        req = InvoiceSubmitRequest(
            po_id=f["po_id"],
            vendor_invoice_number="INV-2026-003",
            invoice_date=date(2026, 5, 25),
            currency="INR",
            subtotal=Decimal("51000.00"),
            tax_amount=Decimal("9180.00"),
            total_amount=Decimal("60180.00"),
            lines=[
                InvoiceLineCreate(
                    po_line_id=f["po_line_id"],
                    line_number=1,
                    item_description="Laptops 16GB RAM",
                    quantity=Decimal("100.0"),
                    unit_price=Decimal("510.00"),
                    tax_rate=Decimal("18.00"),
                    tax_amount=Decimal("9180.00"),
                    line_total=Decimal("60180.00"),
                )
            ],
        )

        invoice = await invoice_service.submit_invoice(
            db, req, actor_id=f["buyer_id"], vendor_id=f["vendor_id"], org_id=org_id
        )

        assert invoice.match_status == "DISCREPANCY"
        assert invoice.status.value == "DISPUTED"
        mr = invoice.match_results[0]
        assert mr.overall_match is False
        assert mr.price_match is False
        assert "PRICE_MISMATCH" in mr.mismatch_reasons

        # Verify auto-generated dispute record exists
        disputes = await payment_service.list_disputes(db, org_id, invoice_id=invoice.id)
        assert len(disputes) == 1
        assert disputes[0].reason_code == "PRICE_MISMATCH"
        assert disputes[0].status == "OPEN"


@pytest.mark.asyncio
async def test_payment_due_date_skips_weekends_and_holidays():
    """Payment due date landing on weekend or active holiday advances to next business day."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_invoice_fixtures(db, org_id)

        # Invoice Date: Friday 2026-05-01
        # Payment term with 1 net day -> lands on Saturday 2026-05-02
        # Monday is 2026-05-04. Let's add 2026-05-04 as a holiday!
        # Expected due date: Tuesday 2026-05-05.
        holiday = HolidayMaster(
            org_id=org_id,
            name="Bank Labour Holiday",
            holiday_date=date(2026, 5, 4),
            is_active=True,
        )
        db.add(holiday)

        term_1d = PaymentTerm(
            org_id=org_id,
            code="NET1",
            name="Net 1 Day",
            payment_days=1,
            net_days=1,
            is_active=True,
        )
        db.add(term_1d)
        await db.commit()

        due_date = await invoice_service.calculate_payment_due_date(
            db,
            po=None,
            invoice_date=date(2026, 5, 1),
            org_id=org_id,
            payment_terms_code="NET1",
        )

        assert due_date == date(2026, 5, 5)  # Tuesday


@pytest.mark.asyncio
async def test_tds_deduction_computed():
    """Vendor with tds_applicable=True and tds_percentage=2% -> payment net_amount = gross - TDS."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_invoice_fixtures(db, org_id)

        req = InvoiceSubmitRequest(
            po_id=f["po_id"],
            vendor_invoice_number="INV-2026-TDS",
            invoice_date=date(2026, 5, 25),
            currency="INR",
            subtotal=Decimal("50000.00"),
            tax_amount=Decimal("9000.00"),
            total_amount=Decimal("59000.00"),
            lines=[
                InvoiceLineCreate(
                    po_line_id=f["po_line_id"],
                    line_number=1,
                    item_description="Laptops 16GB RAM",
                    quantity=Decimal("100.0"),
                    unit_price=Decimal("500.00"),
                    tax_rate=Decimal("18.00"),
                    tax_amount=Decimal("9000.00"),
                    line_total=Decimal("59000.00"),
                )
            ],
        )

        invoice = await invoice_service.submit_invoice(
            db, req, actor_id=f["buyer_id"], vendor_id=f["vendor_id"], org_id=org_id
        )

        # Approve invoice -> triggers scheduled payment with TDS
        approved_inv = await invoice_service.approve(
            db, invoice.id, actor_id=f["buyer_id"], org_id=org_id
        )
        assert approved_inv.status.value == "APPROVED"

        payments = await payment_service.list_payments(
            db, org_id, filters=None or type("F", (), {"invoice_id": invoice.id, "vendor_id": None, "status": None, "page": 1, "page_size": 10})()
        )
        payment = payments[0][0]

        # TDS @ 2% of subtotal (50,000) = 1,000.00
        # Gross = 59,000.00, Net = 58,000.00
        assert Decimal(str(payment.gross_amount)) == Decimal("59000.00")
        assert Decimal(str(payment.tds_amount)) == Decimal("1000.00")
        assert Decimal(str(payment.net_amount)) == Decimal("58000.00")
        assert Decimal(str(payment.amount)) == Decimal("58000.00")
        assert payment.status.value == "SCHEDULED"


@pytest.mark.asyncio
async def test_duplicate_invoice_rejected_same_fy():
    """Duplicate vendor_invoice_number in the same financial year raises ConflictError."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_invoice_fixtures(db, org_id)

        req = InvoiceSubmitRequest(
            po_id=f["po_id"],
            vendor_invoice_number="INV-DUP-001",
            invoice_date=date(2026, 6, 1),
            currency="INR",
            subtotal=Decimal("50000.00"),
            tax_amount=Decimal("9000.00"),
            total_amount=Decimal("59000.00"),
            lines=[
                InvoiceLineCreate(
                    po_line_id=f["po_line_id"],
                    line_number=1,
                    item_description="Laptops 16GB RAM",
                    quantity=Decimal("100.0"),
                    unit_price=Decimal("500.00"),
                    tax_rate=Decimal("18.00"),
                    tax_amount=Decimal("9000.00"),
                    line_total=Decimal("59000.00"),
                )
            ],
        )

        await invoice_service.submit_invoice(
            db, req, actor_id=f["buyer_id"], vendor_id=f["vendor_id"], org_id=org_id
        )

        # Attempt duplicate submission
        with pytest.raises(ConflictError) as exc_info:
            await invoice_service.submit_invoice(
                db, req, actor_id=f["buyer_id"], vendor_id=f["vendor_id"], org_id=org_id
            )
        assert exc_info.value.code == "DUPLICATE_INVOICE" or "already exists" in str(exc_info.value)


@pytest.mark.asyncio
async def test_financial_year_indian_boundary():
    """Verify Indian financial year computation around April 1."""
    assert invoice_service._compute_financial_year(date(2026, 4, 1)) == "FY2026-27"
    assert invoice_service._compute_financial_year(date(2026, 3, 31)) == "FY2025-26"
    assert invoice_service._compute_financial_year(date(2026, 12, 31)) == "FY2026-27"
    assert invoice_service._compute_financial_year(date(2027, 1, 15)) == "FY2026-27"


@pytest.mark.asyncio
async def test_payment_process_and_settlement():
    """Payment processing records banking UTR, marks payment COMPLETED, and sets invoice to PAID."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_invoice_fixtures(db, org_id)

        req = InvoiceSubmitRequest(
            po_id=f["po_id"],
            vendor_invoice_number="INV-PAY-001",
            invoice_date=date(2026, 5, 25),
            currency="INR",
            subtotal=Decimal("50000.00"),
            tax_amount=Decimal("9000.00"),
            total_amount=Decimal("59000.00"),
            lines=[
                InvoiceLineCreate(
                    po_line_id=f["po_line_id"],
                    line_number=1,
                    item_description="Laptops 16GB RAM",
                    quantity=Decimal("100.0"),
                    unit_price=Decimal("500.00"),
                    tax_rate=Decimal("18.00"),
                    tax_amount=Decimal("9000.00"),
                    line_total=Decimal("59000.00"),
                )
            ],
        )

        invoice = await invoice_service.submit_invoice(
            db, req, actor_id=f["buyer_id"], vendor_id=f["vendor_id"], org_id=org_id
        )
        await invoice_service.approve(db, invoice.id, actor_id=f["buyer_id"], org_id=org_id)

        # Get scheduled payment
        payments = await payment_service.repo.find_by_invoice_id(db, invoice.id, org_id)
        payment = payments[0]

        # Process payment via bank UTR
        proc_req = PaymentProcessRequest(
            utr_number="HDFC00012345678",
            payment_method="NEFT",
            payment_date=date(2026, 6, 25),
        )
        updated_payment = await payment_service.process_payment(
            db, payment.id, proc_req, actor_id=f["buyer_id"], org_id=org_id
        )

        assert updated_payment.status.value == "COMPLETED"
        assert updated_payment.utr_number == "HDFC00012345678"

        updated_inv = await invoice_service.get(db, invoice.id, org_id)
        assert updated_inv.payment_status.value == "COMPLETED"
        assert updated_inv.status.value == "PAID"


@pytest.mark.asyncio
async def test_dispute_lifecycle_and_credit_note():
    """Full dispute lifecycle: raise dispute -> post thread message -> resolve with credit note."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_invoice_fixtures(db, org_id)

        req = InvoiceSubmitRequest(
            po_id=f["po_id"],
            vendor_invoice_number="INV-DISP-001",
            invoice_date=date(2026, 5, 25),
            currency="INR",
            subtotal=Decimal("50000.00"),
            tax_amount=Decimal("9000.00"),
            total_amount=Decimal("59000.00"),
            lines=[
                InvoiceLineCreate(
                    po_line_id=f["po_line_id"],
                    line_number=1,
                    item_description="Laptops 16GB RAM",
                    quantity=Decimal("100.0"),
                    unit_price=Decimal("500.00"),
                    tax_rate=Decimal("18.00"),
                    tax_amount=Decimal("9000.00"),
                    line_total=Decimal("59000.00"),
                )
            ],
        )
        invoice = await invoice_service.submit_invoice(
            db, req, actor_id=f["buyer_id"], vendor_id=f["vendor_id"], org_id=org_id
        )

        # 1. Raise dispute
        dispute = await payment_service.create_dispute(
            db,
            invoice_id=invoice.id,
            reason_code="QUALITY_ISSUE",
            description="5 laptop screens were damaged in transit.",
            actor_id=f["buyer_id"],
            org_id=org_id,
        )
        assert dispute.status == "OPEN"

        # 2. Add message from supplier
        msg = await payment_service.add_dispute_message(
            db,
            dispute.id,
            DisputeMessageCreateRequest(message="Acknowledged. We will issue a credit note for INR 2,950."),
            actor_id=f["vendor_user_id"],
            org_id=org_id,
        )
        assert msg.message == "Acknowledged. We will issue a credit note for INR 2,950."

        # 3. Resolve dispute with credit note
        resolved = await payment_service.resolve_dispute(
            db,
            dispute.id,
            DisputeResolveRequest(
                resolution_action="RESOLVED_CREDIT_NOTE",
                resolution_notes="Credit note applied for 5 damaged units.",
                credit_note_amount=Decimal("2950.00"),
            ),
            actor_id=f["buyer_id"],
            org_id=org_id,
        )
        assert resolved.status == "RESOLVED_CREDIT_NOTE"
        assert resolved.credit_note_amount == Decimal("2950.00")

        updated_inv = await invoice_service.get(db, invoice.id, org_id)
        assert updated_inv.total_amount == Decimal("56050.00")  # 59,000 - 2,950


@pytest.mark.asyncio
async def test_invoice_aging_celery_task():
    """Invoice aging Celery task identifies overdue invoices and generates alerts."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_invoice_fixtures(db, org_id)

        # Create an overdue invoice with due_date 40 days ago
        overdue_date = date.today() - timedelta(days=40)
        inv = Invoice(
            org_id=org_id,
            invoice_number=f"INV-OVERDUE-{org_id.hex[:4]}",
            vendor_invoice_number="VIN-OVERDUE-01",
            vendor_id=f["vendor_id"],
            po_id=f["po_id"],
            status=InvoiceStatusEnum.SUBMITTED,
            invoice_date=overdue_date - timedelta(days=30),
            due_date=overdue_date,
            currency="INR",
            subtotal=Decimal("20000.00"),
            tax_amount=Decimal("3600.00"),
            total_amount=Decimal("23600.00"),
            payment_status=PaymentStatusEnum.PENDING,
        )
        db.add(inv)
        await db.commit()

        # Run aging scanner
        result = await async_check_invoice_aging(session_factory=TestSession)
        assert result["alerts_sent"] >= 1
