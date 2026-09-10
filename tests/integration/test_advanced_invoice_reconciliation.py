"""
Integration tests for SPEC_15 Automated 3-Way & 4-Way Invoice Matching & Variance Tolerances.
Tests:
- 3-Way reconciliation within tolerance with auto-approval
- Price variance exceeding tolerance with credit memo suggestion
- 4-Way reconciliation with dock quality inspection rejections
- Reconciliation dashboard metrics
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.main  # noqa: F401
from app.config import settings
from app.db.enums import InvoiceStatusEnum
from app.modules.invoice.schemas import AdvancedReconciliationRequest
from app.modules.invoice.service import invoice_service

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def setup_base_fixtures(db: AsyncSession, org_id):
    buyer_id = uuid4()
    vendor_id = uuid4()
    bu_id = uuid4()
    cat_id = uuid4()
    uom_id = uuid4()
    le_id = uuid4()

    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, :name, :legal_name, 'IN', 'INR', '{}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id, "name": f"Org {org_id.hex[:6]}", "legal_name": f"Legal {org_id.hex[:6]}"},
    )
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
        VALUES (:id, :org_id, :email, 'hash', 'Test', 'Buyer', 'ACTIVE', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": buyer_id, "org_id": org_id, "email": f"b-{buyer_id.hex[:6]}@t.com"},
    )
    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, country_code)
        VALUES (:id, :org_id, 'Legal Entity', :reg, 'IN')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": le_id, "org_id": org_id, "reg": f"R-{le_id.hex[:6]}"},
    )
    await db.execute(
        text("""
        INSERT INTO business_units (id, org_id, name, code, legal_entity_id)
        VALUES (:id, :org_id, 'Finance BU', :code, :le_id)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": bu_id, "org_id": org_id, "code": f"BU-{bu_id.hex[:4]}", "le_id": le_id},
    )
    await db.execute(
        text("""
        INSERT INTO categories (id, org_id, name, code, level)
        VALUES (:id, :org_id, 'Hardware', :code, 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": cat_id, "org_id": org_id, "code": f"C-{cat_id.hex[:4]}"},
    )
    await db.execute(
        text("""
        INSERT INTO uom_master (id, org_id, name, code)
        VALUES (:id, :org_id, 'Pieces', 'PCS')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": uom_id, "org_id": org_id},
    )
    await db.execute(
        text("""
        INSERT INTO vendors (id, org_id, vendor_code, company_name, primary_email, status, version)
        VALUES (:id, :org_id, :code, 'Tech Corp', 'v@t.com', 'ACTIVE', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": vendor_id, "org_id": org_id, "code": f"V-{vendor_id.hex[:4]}"},
    )

    return {
        "buyer_id": buyer_id,
        "vendor_id": vendor_id,
        "bu_id": bu_id,
        "cat_id": cat_id,
        "uom_id": uom_id,
    }


@pytest.mark.asyncio
async def test_3way_reconciliation_within_tolerance_auto_approves():
    async with TestSession() as db:
        org_id = uuid4()
        f = await setup_base_fixtures(db, org_id)

        po_id = uuid4()
        po_line_id = uuid4()
        grn_id = uuid4()
        grn_line_id = uuid4()
        invoice_id = uuid4()
        inv_line_id = uuid4()

        await db.execute(
            text("""
            INSERT INTO purchase_orders (
                id, org_id, po_number, title, vendor_id, status,
                business_unit_id, category_id, currency, total_value, buyer_id, version
            )
            VALUES (
                :po_id, :org_id, :po_number, 'PO Server RAM', :vendor_id, 'RELEASED',
                :bu_id, :cat_id, 'INR', 10000.00, :buyer_id, 1
            )
            """),
            {
                "po_id": po_id,
                "org_id": org_id,
                "po_number": f"PO-{po_id.hex[:6]}",
                "vendor_id": f["vendor_id"],
                "bu_id": f["bu_id"],
                "cat_id": f["cat_id"],
                "buyer_id": f["buyer_id"],
            },
        )

        await db.execute(
            text("""
            INSERT INTO po_lines (
                id, org_id, po_id, line_number, item_description,
                uom_id, ordered_quantity, unit_price, tax_rate,
                open_quantity, received_quantity, version
            )
            VALUES (
                :line_id, :org_id, :po_id, 1, 'Server RAM 32GB',
                :uom_id, 10.0, 1000.00, 18.00,
                0.0, 10.0, 1
            )
            """),
            {"line_id": po_line_id, "org_id": org_id, "po_id": po_id, "uom_id": f["uom_id"]},
        )

        await db.execute(
            text("""
            INSERT INTO goods_receipt_notes (
                id, org_id, grn_number, po_id, vendor_id,
                receipt_date, received_by, status, version
            )
            VALUES (
                :grn_id, :org_id, :grn_number, :po_id, :vendor_id,
                :receipt_date, :received_by, 'CONFIRMED', 1
            )
            """),
            {
                "grn_id": grn_id,
                "org_id": org_id,
                "grn_number": f"GRN-{grn_id.hex[:6]}",
                "po_id": po_id,
                "vendor_id": f["vendor_id"],
                "receipt_date": date(2026, 5, 20),
                "received_by": f["buyer_id"],
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
                10.0, 10.0, 0.0, 1
            )
            """),
            {"line_id": grn_line_id, "org_id": org_id, "grn_id": grn_id, "po_line_id": po_line_id},
        )

        await db.execute(
            text("""
            INSERT INTO invoices (
                id, org_id, invoice_number, vendor_invoice_number, vendor_id, po_id,
                status, invoice_date, due_date, currency, subtotal, tax_amount, total_amount, match_status, version
            )
            VALUES (
                :inv_id, :org_id, :inv_num, :vinv_num, :vendor_id, :po_id,
                'SUBMITTED', :inv_date, :due_date, 'INR', 10000.00, 0.00, 10000.00, 'PENDING', 1
            )
            """),
            {
                "inv_id": invoice_id,
                "org_id": org_id,
                "inv_num": f"INV-{invoice_id.hex[:6]}",
                "vinv_num": f"VINV-{invoice_id.hex[:6]}",
                "vendor_id": f["vendor_id"],
                "po_id": po_id,
                "inv_date": date.today(),
                "due_date": date.today(),
            },
        )

        await db.execute(
            text("""
            INSERT INTO invoice_lines (
                id, org_id, invoice_id, po_line_id, line_number,
                item_description, quantity, unit_price, tax_rate, tax_amount, line_total, version
            )
            VALUES (
                :line_id, :org_id, :inv_id, :po_line_id, 1,
                'Server RAM 32GB', 10.0, 1000.00, 0.0, 0.0, 10000.00, 1
            )
            """),
            {"line_id": inv_line_id, "org_id": org_id, "inv_id": invoice_id, "po_line_id": po_line_id},
        )
        await db.commit()

        # Execute 3-Way match
        req = AdvancedReconciliationRequest(
            match_mode="THREE_WAY",
            price_tolerance_pct=2.0,
            quantity_tolerance_pct=5.0,
            auto_approve_if_matched=True,
        )
        resp = await invoice_service.perform_advanced_reconciliation(
            db, invoice_id, req, f["buyer_id"], org_id
        )

        assert resp.overall_status == "FULLY_MATCHED"
        assert resp.matched_lines_count == 1
        assert resp.discrepancy_lines_count == 0
        assert resp.auto_approved is True
        assert resp.suggested_credit_note_total == 0.0

        updated_inv = await invoice_service.get(db, invoice_id, org_id)
        assert updated_inv.status == InvoiceStatusEnum.APPROVED
        assert updated_inv.match_status == "MATCHED"


@pytest.mark.asyncio
async def test_4way_reconciliation_detects_quality_rejection_and_variance():
    async with TestSession() as db:
        org_id = uuid4()
        f = await setup_base_fixtures(db, org_id)

        po_id = uuid4()
        po_line_id = uuid4()
        grn_id = uuid4()
        grn_line_id = uuid4()
        invoice_id = uuid4()
        inv_line_id = uuid4()

        await db.execute(
            text("""
            INSERT INTO purchase_orders (
                id, org_id, po_number, title, vendor_id, status,
                business_unit_id, category_id, currency, total_value, buyer_id, version
            )
            VALUES (
                :po_id, :org_id, :po_number, 'PO SSDs', :vendor_id, 'RELEASED',
                :bu_id, :cat_id, 'INR', 50000.00, :buyer_id, 1
            )
            """),
            {
                "po_id": po_id,
                "org_id": org_id,
                "po_number": f"PO-{po_id.hex[:6]}",
                "vendor_id": f["vendor_id"],
                "bu_id": f["bu_id"],
                "cat_id": f["cat_id"],
                "buyer_id": f["buyer_id"],
            },
        )

        await db.execute(
            text("""
            INSERT INTO po_lines (
                id, org_id, po_id, line_number, item_description,
                uom_id, ordered_quantity, unit_price, tax_rate,
                open_quantity, received_quantity, version
            )
            VALUES (
                :line_id, :org_id, :po_id, 1, 'Enterprise SSD 1TB',
                :uom_id, 50.0, 1000.00, 18.00,
                0.0, 50.0, 1
            )
            """),
            {"line_id": po_line_id, "org_id": org_id, "po_id": po_id, "uom_id": f["uom_id"]},
        )

        # GRN received 50, but dock Quality Inspection rejected 10 units!
        await db.execute(
            text("""
            INSERT INTO goods_receipt_notes (
                id, org_id, grn_number, po_id, vendor_id,
                receipt_date, received_by, status, version
            )
            VALUES (
                :grn_id, :org_id, :grn_number, :po_id, :vendor_id,
                :receipt_date, :received_by, 'CONFIRMED', 1
            )
            """),
            {
                "grn_id": grn_id,
                "org_id": org_id,
                "grn_number": f"GRN-{grn_id.hex[:6]}",
                "po_id": po_id,
                "vendor_id": f["vendor_id"],
                "receipt_date": date(2026, 5, 20),
                "received_by": f["buyer_id"],
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
                50.0, 40.0, 10.0, 1
            )
            """),
            {"line_id": grn_line_id, "org_id": org_id, "grn_id": grn_id, "po_line_id": po_line_id},
        )

        # Vendor invoiced for 50 units @ 1100 INR (+10% price variance over 1000 PO price)
        await db.execute(
            text("""
            INSERT INTO invoices (
                id, org_id, invoice_number, vendor_invoice_number, vendor_id, po_id,
                status, invoice_date, due_date, currency, subtotal, tax_amount, total_amount, match_status, version
            )
            VALUES (
                :inv_id, :org_id, :inv_num, :vinv_num, :vendor_id, :po_id,
                'SUBMITTED', :inv_date, :due_date, 'INR', 55000.00, 0.00, 55000.00, 'PENDING', 1
            )
            """),
            {
                "inv_id": invoice_id,
                "org_id": org_id,
                "inv_num": f"INV-{invoice_id.hex[:6]}",
                "vinv_num": f"VINV-{invoice_id.hex[:6]}",
                "vendor_id": f["vendor_id"],
                "po_id": po_id,
                "inv_date": date.today(),
                "due_date": date.today(),
            },
        )

        await db.execute(
            text("""
            INSERT INTO invoice_lines (
                id, org_id, invoice_id, po_line_id, line_number,
                item_description, quantity, unit_price, tax_rate, tax_amount, line_total, version
            )
            VALUES (
                :line_id, :org_id, :inv_id, :po_line_id, 1,
                'Enterprise SSD 1TB', 50.0, 1100.00, 0.0, 0.0, 55000.00, 1
            )
            """),
            {"line_id": inv_line_id, "org_id": org_id, "inv_id": invoice_id, "po_line_id": po_line_id},
        )
        await db.commit()

        # Perform 4-Way match with 2% price and 5% qty tolerance
        req = AdvancedReconciliationRequest(
            match_mode="FOUR_WAY",
            price_tolerance_pct=2.0,
            quantity_tolerance_pct=5.0,
            auto_approve_if_matched=True,
        )
        resp = await invoice_service.perform_advanced_reconciliation(
            db, invoice_id, req, f["buyer_id"], org_id
        )

        assert resp.overall_status == "VARIANCE_DETECTED"
        assert resp.discrepancy_lines_count == 1
        assert resp.auto_approved is False
        assert resp.suggested_credit_note_total > Decimal("0.00")

        item = resp.line_details[0]
        assert item.status == "VARIANCE_DETECTED"
        assert item.price_variance_pct == 10.0
        assert any("Quality rejection detected" in r for r in item.reasons)
        assert any("Price exceeds PO rate" in r for r in item.reasons)

        dashboard = await invoice_service.get_reconciliation_dashboard(db, org_id)
        assert dashboard["total_invoices"] >= 1
        assert dashboard["discrepancy_count"] >= 1
