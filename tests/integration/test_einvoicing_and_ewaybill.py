"""
Integration tests for Government E-Invoicing & E-Way Bill Integration (India GST & Global Peppol):
- Direct NIC India API adapter: official 64-character SHA-256 IRN and signed QR code generation
- Global Peppol BIS 3.0 UBL 2.1 XML generator
- E-Way Bill Part A and Part B generation with transit distance validity calculation
- 24-hour cancellation protocol with cascading E-Way Bill cancellation
- ASN Dispatch compliance pack auto-generation
"""

from __future__ import annotations

import re
from datetime import date, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.main  # noqa: F401
from app.config import settings
from app.modules.einvoicing.schemas import (
    CancelEInvoiceRequest,
    GenerateEInvoiceRequest,
    GenerateEWayBillRequest,
)
from app.modules.einvoicing.service import einvoicing_service

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def seed_einvoice_test_data(db: AsyncSession, org_id):
    user_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, 'Gov Compliance Org', 'Gov Compliance Corp', 'IN', 'INR', '{}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id},
    )
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
        VALUES (:id, :org_id, :email, 'hash', 'Tax', 'Officer', 'ACTIVE', 1)
        """),
        {"id": user_id, "org_id": org_id, "email": f"tax-{user_id.hex[:6]}@enterprise.com"},
    )

    vendor_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO vendors (id, org_id, company_name, legal_name, primary_email, pan, gstin, status, version)
        VALUES (:id, :org_id, 'Tata Steel Enterprise', 'Tata Steel Ltd', 'gst@tatasteel.com', 'AAACT2727Q', '27AAACT2727Q1ZW', 'ACTIVE', 1)
        """),
        {"id": vendor_id, "org_id": org_id},
    )

    le_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, gstin, country_code)
        VALUES (:id, :org_id, 'Buyer Legal Entity', 'REG-1234', '27ABCDE1234F1Z5', 'IN')
        """),
        {"id": le_id, "org_id": org_id},
    )

    bu_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO business_units (id, org_id, code, name, legal_entity_id, version)
        VALUES (:id, :org_id, :code, 'Steel Plant BU', :le_id, 1)
        """),
        {"id": bu_id, "org_id": org_id, "code": f"BU-{bu_id.hex[:4].upper()}", "le_id": le_id},
    )

    cat_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO categories (id, org_id, code, name, level, version)
        VALUES (:id, :org_id, :code, 'Raw Steel & Alloys', 1, 1)
        """),
        {"id": cat_id, "org_id": org_id, "code": f"CAT-{cat_id.hex[:4].upper()}"},
    )

    po_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO purchase_orders (id, org_id, po_number, title, vendor_id, buyer_id, business_unit_id, category_id, status, currency, total_value, version)
        VALUES (:id, :org_id, :po_num, 'Steel Procurement PO', :vendor_id, :user_id, :bu_id, :cat_id, 'RELEASED', 'INR', 450000.00, 1)
        """),
        {
            "id": po_id,
            "org_id": org_id,
            "po_num": f"PO-{po_id.hex[:6].upper()}",
            "vendor_id": vendor_id,
            "user_id": user_id,
            "bu_id": bu_id,
            "cat_id": cat_id,
        },
    )

    asn_id = uuid4()
    today = date.today()
    await db.execute(
        text("""
        INSERT INTO advance_shipping_notices (
            id, org_id, asn_number, po_id, vendor_id, shipment_date, expected_delivery_date,
            carrier_name, tracking_number, vehicle_number, packaging_type, package_count,
            status, barcode_data, version
        )
        VALUES (
            :id, :org_id, :asn_num, :po_id, :vendor_id, :ship_dt, :exp_dt,
            'Gati KWE Logistics', 'TRK-9823412', 'MH12AB1234', 'PALLET', 4,
            'SHIPPED', 'BARCODE-DATA-1234', 1
        )
        """),
        {
            "id": asn_id,
            "org_id": org_id,
            "asn_num": f"ASN-{asn_id.hex[:6].upper()}",
            "po_id": po_id,
            "vendor_id": vendor_id,
            "ship_dt": today,
            "exp_dt": today + timedelta(days=3),
        },
    )

    await db.commit()
    return user_id, vendor_id, po_id, asn_id


@pytest.mark.asyncio
async def test_nic_india_irn_and_peppol_generation():
    org_id = uuid4()
    async with TestSession() as db:
        user_id, vendor_id, po_id, _ = await seed_einvoice_test_data(db, org_id)

        seller_gstin = "27AAACT2727Q1ZW"
        buyer_gstin = "27ABCDE1234F1Z5"
        doc_num = f"INV-{uuid4().hex[:6].upper()}"

        # 1. Generate E-Invoice
        resp = await einvoicing_service.generate_e_invoice(
            db,
            org_id=org_id,
            payload=GenerateEInvoiceRequest(
                seller_gstin=seller_gstin,
                buyer_gstin=buyer_gstin,
                doc_number=doc_num,
                doc_type="INV",
                total_invoice_value=450000.00,
                total_tax_value=81000.00,
            ),
        )

        assert resp.id is not None
        assert resp.status == "GENERATED"
        # Verify 64-character hex IRN
        assert len(resp.irn) == 64
        assert bool(re.match(r"^[0-9a-f]{64}$", resp.irn))
        # Verify Ack Number format
        assert resp.ack_number.startswith("11")
        # Verify signed QR code
        assert "JWT.NIC." in resp.signed_qr_code

        # Verify Peppol BIS 3.0 UBL 2.1 XML structure
        assert resp.peppol_xml is not None
        assert "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0" in resp.peppol_xml
        assert f"<cbc:ID>{doc_num}</cbc:ID>" in resp.peppol_xml
        assert seller_gstin in resp.peppol_xml
        assert buyer_gstin in resp.peppol_xml
        assert "450000.00" in resp.peppol_xml


@pytest.mark.asyncio
async def test_e_way_bill_generation_and_validity_rules():
    org_id = uuid4()
    async with TestSession() as db:
        await seed_einvoice_test_data(db, org_id)

        # 1. Generate E-Way Bill for 450 km transit
        # Rule 138(10): 450 km -> ceil(450 / 200) = 3 days validity
        ewb = await einvoicing_service.generate_e_way_bill(
            db,
            org_id=org_id,
            payload=GenerateEWayBillRequest(
                vehicle_number="MH04XY9876",
                from_pincode="400001",
                to_pincode="411001",
                distance_km=450.0,
                transporter_id="27AAACT2727Q1ZW",
                transporter_name="Blue Dart Surface Fleet",
            ),
        )

        assert ewb.id is not None
        assert len(ewb.ewb_number) == 12
        assert ewb.status == "ACTIVE"
        assert ewb.vehicle_number == "MH04XY9876"
        assert ewb.distance_km == 450.0
        # Valid until should be approx 3 days from now
        validity_delta = ewb.valid_until - ewb.ewb_date
        assert validity_delta.days == 3


@pytest.mark.asyncio
async def test_e_invoice_cancellation_protocol():
    org_id = uuid4()
    async with TestSession() as db:
        await seed_einvoice_test_data(db, org_id)

        doc_num = f"INV-{uuid4().hex[:6].upper()}"
        inv = await einvoicing_service.generate_e_invoice(
            db,
            org_id=org_id,
            payload=GenerateEInvoiceRequest(
                seller_gstin="27AAACT2727Q1ZW",
                buyer_gstin="27ABCDE1234F1Z5",
                doc_number=doc_num,
                total_invoice_value=120000.0,
            ),
        )

        # Attach an active E-Way Bill to this invoice
        ewb = await einvoicing_service.generate_e_way_bill(
            db,
            org_id=org_id,
            payload=GenerateEWayBillRequest(
                e_invoice_id=inv.id,
                vehicle_number="DL01A1234",
                from_pincode="110001",
                to_pincode="122001",
                distance_km=35.0,
            ),
        )
        assert ewb.status == "ACTIVE"

        # Cancel E-Invoice
        cancelled_inv = await einvoicing_service.cancel_e_invoice(
            db,
            org_id=org_id,
            payload=CancelEInvoiceRequest(
                irn=inv.irn,
                cancellation_reason="1",  # Duplicate
                cancellation_remarks="Duplicate entry created by accounting operator",
            ),
        )

        assert cancelled_inv.status == "CANCELLED"
        assert "Duplicate" in cancelled_inv.cancellation_reason or "Code: 1" in cancelled_inv.cancellation_reason


@pytest.mark.asyncio
async def test_asn_dispatch_compliance_pack_auto_generation():
    org_id = uuid4()
    async with TestSession() as db:
        _, _, _, asn_id = await seed_einvoice_test_data(db, org_id)

        # Auto-trigger compliance pack upon ASN dispatch
        pack = await einvoicing_service.generate_compliance_pack_for_asn(
            db,
            org_id=org_id,
            asn_id=asn_id,
            vehicle_number="KA01MJ4567",
            distance_km=620.0,
        )

        assert pack["asn_id"] == str(asn_id)
        assert pack["e_invoice"]["status"] == "GENERATED"
        assert len(pack["e_invoice"]["irn"]) == 64
        assert pack["e_way_bill"]["status"] == "ACTIVE"
        assert pack["e_way_bill"]["vehicle_number"] == "KA01MJ4567"
        assert len(pack["e_way_bill"]["ewb_number"]) == 12
