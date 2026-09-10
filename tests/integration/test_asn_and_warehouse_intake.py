"""
Integration tests for Advance Shipping Notices (ASN) & Warehouse Barcode Intake:
- ASN creation against acknowledged Purchase Orders
- Open quantity validation (prevent over-shipping beyond open PO line quantity)
- Barcode & QR payload generation
- Barcode scan lookup (by raw ASN number, tracking number, and barcode string)
- Fast-track warehouse 1-click intake directly creating and confirming GRN
- Automatic PO line decrement (open_quantity) and increment (received_quantity)
- Repeated intake prevention (ASN_ALREADY_RECEIVED)
- Multi-tenant and supplier isolation
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.main  # noqa: F401
from app.config import settings
from app.core.exceptions import AppException, ForbiddenError, NotFoundError
from app.db.enums import POStatus
from app.modules.asn.schemas import (
    AsnCreateRequest,
    AsnDispatchPayload,
    AsnFastGrnRequest,
    AsnFilterParams,
    AsnLineCreate,
)
from app.modules.asn.service import asn_service
from app.modules.purchase_order.schemas import POCreateRequest, POLineCreate
from app.modules.purchase_order.service import purchase_order_service

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def seed_asn_test_fixtures(db: AsyncSession, org_id):
    buyer_id = uuid4()
    vendor_id = uuid4()
    other_vendor_id = uuid4()
    bu_id = uuid4()
    cat_id = uuid4()
    uom_id = uuid4()
    le_id = uuid4()

    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, :name, :legal_name, 'IN', 'INR', '{"budget_check_config": {"default_mode": "soft"}}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id, "name": f"Org {org_id.hex[:6]}", "legal_name": f"Legal {org_id.hex[:6]}"},
    )

    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
        VALUES (:id, :org_id, :email, 'hash', 'Buyer', 'One', 'ACTIVE', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": buyer_id, "org_id": org_id, "email": f"buyer-{buyer_id.hex[:6]}@test.com"},
    )

    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, country_code)
        VALUES (:id, :org_id, 'PO Test Entity', :reg, 'IN') ON CONFLICT (id) DO NOTHING
        """),
        {"id": le_id, "org_id": org_id, "reg": f"REG{le_id.hex[:8]}"},
    )

    await db.execute(
        text("""
        INSERT INTO business_units (id, org_id, name, code, legal_entity_id)
        VALUES (:id, :org_id, 'PO Test BU', :code, :le_id) ON CONFLICT (id) DO NOTHING
        """),
        {"id": bu_id, "org_id": org_id, "code": f"BU{bu_id.hex[:4]}", "le_id": le_id},
    )

    await db.execute(
        text("""
        INSERT INTO categories (id, org_id, name, code, level)
        VALUES (:id, :org_id, 'Industrial Components', :code, 1) ON CONFLICT (id) DO NOTHING
        """),
        {"id": cat_id, "org_id": org_id, "code": f"C{cat_id.hex[:6]}"},
    )

    await db.execute(
        text("""
        INSERT INTO uom_master (id, org_id, name, code)
        VALUES (:id, :org_id, 'Pieces', :code) ON CONFLICT (id) DO NOTHING
        """),
        {"id": uom_id, "org_id": org_id, "code": f"U{uom_id.hex[:4]}"},
    )

    for vid, vcode in [(vendor_id, "VEND1"), (other_vendor_id, "VEND2")]:
        await db.execute(
            text("""
            INSERT INTO vendors (id, org_id, vendor_code, company_name, primary_email, status, version)
            VALUES (:id, :org_id, :code, :name, :email, 'ACTIVE', 1) ON CONFLICT (id) DO NOTHING
            """),
            {
                "id": vid,
                "org_id": org_id,
                "code": f"V{vid.hex[:4]}",
                "name": f"Supplier {vcode}",
                "email": f"vend-{vid.hex[:4]}@test.com",
            },
        )

    await db.commit()
    return {
        "buyer_id": buyer_id,
        "vendor_id": vendor_id,
        "other_vendor_id": other_vendor_id,
        "bu_id": bu_id,
        "cat_id": cat_id,
        "uom_id": uom_id,
        "le_id": le_id,
    }


async def create_released_po(db: AsyncSession, org_id, fixtures, qty=Decimal("100.0")):
    po_req = POCreateRequest(
        title="PO for Industrial Sensors",
        category_id=fixtures["cat_id"],
        vendor_id=fixtures["vendor_id"],
        business_unit_id=fixtures["bu_id"],
        deviation_justification="Direct PO for critical spare parts",
        currency="INR",
        payment_terms_days=30,
        delivery_address={"city": "Bengaluru", "pincode": "560001"},
        billing_address={"city": "Bengaluru", "pincode": "560001"},
        lines=[
            POLineCreate(
                line_number=1,
                item_description="Industrial Pressure Sensor",
                category_id=fixtures["cat_id"],
                uom_id=fixtures["uom_id"],
                ordered_quantity=qty,
                unit_price=Decimal("250.00"),
                delivery_date=date.today() + timedelta(days=14),
            )
        ],
    )
    po = await purchase_order_service.create(db, po_req, fixtures["buyer_id"], org_id)
    if po.status == POStatus.PENDING_APPROVAL:
        po = await purchase_order_service.approve(db, po.id, fixtures["buyer_id"], org_id)
    po = await purchase_order_service.send_to_vendor(db, po.id, fixtures["buyer_id"], org_id)
    po = await purchase_order_service.record_vendor_acknowledgement(
        db, po.id, accepted=True, rejection_reason=None, actor_id=fixtures["buyer_id"], org_id=org_id
    )
    await db.commit()
    return po


@pytest.mark.asyncio
async def test_asn_create_and_validation():
    org_id = uuid4()
    async with TestSession() as db:
        fixtures = await seed_asn_test_fixtures(db, org_id)
        po = await create_released_po(db, org_id, fixtures, qty=Decimal("50.0"))
        po_line = po.lines[0]

        # 1. Over-shipping rejection: trying to ship 60 when open is 50
        over_ship_req = AsnCreateRequest(
            po_id=po.id,
            shipment_date=date.today(),
            expected_delivery_date=date.today() + timedelta(days=3),
            carrier_name="DHL Express",
            tracking_number="DHL-998877",
            packaging_type="BOX",
            package_count=2,
            gross_weight_kg=Decimal("12.5"),
            lines=[
                AsnLineCreate(
                    po_line_id=po_line.id,
                    shipped_quantity=Decimal("60.0"),
                    lot_number="LOT-2026-A",
                    serial_numbers=["SN-001", "SN-002"],
                )
            ],
        )
        with pytest.raises(AppException) as exc_info:
            await asn_service.create_asn(db, over_ship_req, fixtures["buyer_id"], org_id)
        assert exc_info.value.code == "OVER_SHIPPING_EXCEEDED"

        # 2. Supplier isolation: other vendor cannot create ASN for this PO
        with pytest.raises(ForbiddenError):
            await asn_service.create_asn(
                db,
                over_ship_req,
                fixtures["buyer_id"],
                org_id,
                vendor_id=fixtures["other_vendor_id"],
            )

        # 3. Successful partial ASN creation: ship 20 of 50
        valid_asn_req = AsnCreateRequest(
            po_id=po.id,
            shipment_date=date.today(),
            expected_delivery_date=date.today() + timedelta(days=3),
            carrier_name="DHL Express",
            tracking_number="DHL-998877",
            vehicle_number="KA-01-AB-1234",
            driver_name="Rajesh Kumar",
            driver_phone="+919876543210",
            packaging_type="PALLET",
            package_count=1,
            gross_weight_kg=Decimal("15.0"),
            notes="Handle with care - fragile sensors",
            lines=[
                AsnLineCreate(
                    po_line_id=po_line.id,
                    shipped_quantity=Decimal("20.0"),
                    lot_number="LOT-2026-A",
                    serial_numbers=["SN-001", "SN-002"],
                    expiry_date=date.today() + timedelta(days=365),
                )
            ],
        )
        asn = await asn_service.create_asn(
            db, valid_asn_req, fixtures["buyer_id"], org_id, vendor_id=fixtures["vendor_id"]
        )
        await db.commit()

        assert asn.id is not None
        assert asn.asn_number.startswith("ASN-")
        assert asn.status == "SHIPPED"
        assert asn.carrier_name == "DHL Express"
        assert asn.tracking_number == "DHL-998877"
        assert "ASN|" in asn.barcode_data
        assert asn.shipped_at is not None
        assert len(asn.lines) == 1
        assert asn.lines[0].shipped_quantity == Decimal("20.0")
        assert asn.lines[0].lot_number == "LOT-2026-A"
        assert asn.lines[0].serial_numbers == ["SN-001", "SN-002"]


@pytest.mark.asyncio
async def test_asn_barcode_scan_lookup_and_dispatch():
    org_id = uuid4()
    async with TestSession() as db:
        fixtures = await seed_asn_test_fixtures(db, org_id)
        po = await create_released_po(db, org_id, fixtures, qty=Decimal("40.0"))
        po_line = po.lines[0]

        asn_req = AsnCreateRequest(
            po_id=po.id,
            shipment_date=date.today(),
            expected_delivery_date=date.today() + timedelta(days=2),
            carrier_name="BlueDart",
            tracking_number="BD-44556677",
            lines=[
                AsnLineCreate(
                    po_line_id=po_line.id,
                    shipped_quantity=Decimal("15.0"),
                )
            ],
        )
        asn = await asn_service.create_asn(db, asn_req, fixtures["buyer_id"], org_id)
        await db.commit()

        # 1. Scan lookup by ASN Number
        found_by_num = await asn_service.scan_lookup(db, asn.asn_number, org_id)
        assert found_by_num.id == asn.id

        # 2. Scan lookup by Tracking Number
        found_by_tracking = await asn_service.scan_lookup(db, "BD-44556677", org_id)
        assert found_by_tracking.id == asn.id

        # 3. Scan lookup by exact barcode string
        found_by_barcode = await asn_service.scan_lookup(db, asn.barcode_data, org_id)
        assert found_by_barcode.id == asn.id

        # 4. Unknown code raises NotFoundError
        with pytest.raises(NotFoundError):
            await asn_service.scan_lookup(db, "NON-EXISTENT-CODE", org_id)

        # 5. Dispatch / update carrier details
        dispatched = await asn_service.dispatch_asn(
            db,
            asn.id,
            AsnDispatchPayload(
                carrier_name="BlueDart Apex",
                tracking_number="BD-99999999",
                vehicle_number="MH-02-XY-9999",
                notes="Driver changed at hub",
            ),
            actor_id=fixtures["buyer_id"],
            org_id=org_id,
        )
        await db.commit()

        assert dispatched.carrier_name == "BlueDart Apex"
        assert dispatched.tracking_number == "BD-99999999"
        assert dispatched.vehicle_number == "MH-02-XY-9999"


@pytest.mark.asyncio
async def test_fast_track_barcode_intake_to_grn():
    org_id = uuid4()
    async with TestSession() as db:
        fixtures = await seed_asn_test_fixtures(db, org_id)
        po = await create_released_po(db, org_id, fixtures, qty=Decimal("100.0"))
        po_line = po.lines[0]
        assert po_line.open_quantity == Decimal("100.0")
        assert po_line.received_quantity == Decimal("0.0")

        # Create ASN for 45 units
        asn_req = AsnCreateRequest(
            po_id=po.id,
            shipment_date=date.today(),
            expected_delivery_date=date.today() + timedelta(days=1),
            carrier_name="FedEx Freight",
            tracking_number="FX-12345678",
            package_count=3,
            lines=[
                AsnLineCreate(
                    po_line_id=po_line.id,
                    shipped_quantity=Decimal("45.0"),
                    lot_number="BATCH-X9",
                )
            ],
        )
        asn = await asn_service.create_asn(db, asn_req, fixtures["buyer_id"], org_id)
        await db.commit()

        # Perform 1-Click Fast GRN Intake at warehouse
        intake_req = AsnFastGrnRequest(
            challan_number="CHALLAN-WH-001",
            notes="Scanned at Bay 4 dock intake",
        )
        updated_asn, grn = await asn_service.fast_grn_intake(
            db,
            asn_id=asn.id,
            data=intake_req,
            actor_id=fixtures["buyer_id"],
            org_id=org_id,
        )
        await db.commit()

        # Verify ASN state
        assert updated_asn.status == "RECEIVED"
        assert updated_asn.grn_id == grn.id
        assert updated_asn.received_at is not None
        assert updated_asn.lines[0].received_quantity == Decimal("45.0")

        # Verify generated GRN state
        assert grn.id is not None
        assert grn.grn_number.startswith("GRN-")
        assert grn.status == "CONFIRMED"
        assert grn.challan_number == "CHALLAN-WH-001"
        assert grn.transporter_name == "FedEx Freight"
        assert grn.lr_number == "FX-12345678"
        assert len(grn.lines) == 1
        assert grn.lines[0].received_quantity == Decimal("45.0")
        assert grn.lines[0].accepted_quantity == Decimal("45.0")

        # Verify PO line balances updated
        reloaded_po = await purchase_order_service.get(db, po.id, org_id)
        reloaded_line = reloaded_po.lines[0]
        assert reloaded_line.received_quantity == Decimal("45.0")
        assert reloaded_line.open_quantity == Decimal("55.0")
        assert reloaded_po.status == POStatus.PARTIALLY_RECEIVED

        # Verify idempotency: repeat fast-grn fails with ASN_ALREADY_RECEIVED
        with pytest.raises(AppException) as repeat_exc:
            await asn_service.fast_grn_intake(
                db,
                asn_id=asn.id,
                data=intake_req,
                actor_id=fixtures["buyer_id"],
                org_id=org_id,
            )
        assert repeat_exc.value.code == "ASN_ALREADY_RECEIVED"


@pytest.mark.asyncio
async def test_asn_listing_and_filtering():
    org_id = uuid4()
    async with TestSession() as db:
        fixtures = await seed_asn_test_fixtures(db, org_id)
        po = await create_released_po(db, org_id, fixtures, qty=Decimal("80.0"))
        po_line = po.lines[0]

        # Create two ASNs
        for i, carrier in enumerate(["CarrierAlpha", "CarrierBeta"]):
            asn_req = AsnCreateRequest(
                po_id=po.id,
                shipment_date=date.today(),
                expected_delivery_date=date.today() + timedelta(days=2),
                carrier_name=carrier,
                tracking_number=f"TRK-00{i+1}",
                lines=[
                    AsnLineCreate(
                        po_line_id=po_line.id,
                        shipped_quantity=Decimal("10.0"),
                    )
                ],
            )
            await asn_service.create_asn(db, asn_req, fixtures["buyer_id"], org_id)
        await db.commit()

        # List all
        asns, total = await asn_service.list(db, org_id, AsnFilterParams())
        assert total >= 2

        # Filter by search
        filtered, count = await asn_service.list(db, org_id, AsnFilterParams(search="CarrierAlpha"))
        assert count == 1
        assert filtered[0].carrier_name == "CarrierAlpha"
