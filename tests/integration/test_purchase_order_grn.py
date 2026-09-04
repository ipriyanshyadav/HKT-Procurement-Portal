"""
Integration tests for SPEC_14 Purchase Order and GRN / Quality Inspection:
- S14-01 / S14-02: PO numbering & 9-status lifecycle FSM
- S14-03 / S14-04: Direct PO & Award conversion with price deviation tolerance (0.1%)
- S14-05 / S14-16: Line items with computed total_price
- S14-06: Formal versioned PO amendments and re-approval threshold
- S14-08: Vendor acknowledgment / rejection
- S14-10 / S14-12: GRN linking, partial receipts, open quantity decrement, auto-closure
- S14-11: Quality inspection gate (mandatory inspection before confirmation)
- S14-13: ReportLab PO PDF generation
- S14-14: Rate contract utilization tracking on PO creation & cancellation
- S14-15: 12 audit events
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
from app.core.exceptions import AppException, NotFoundError, ValidationError
from app.db.enums import POStatus
from app.modules.contract.models import Contract
from app.modules.grn.schemas import (
    GrnCreateRequest,
    GrnLineCreate,
    QualityInspectionCreate,
)
from app.modules.grn.service import grn_service
from app.modules.purchase_order.fsm import can_transition, validate_po_transition
from app.modules.purchase_order.models import PoLine, PurchaseOrder
from app.modules.purchase_order.schemas import (
    POAcknowledgeRequest,
    POAmendRequest,
    POCancelRequest,
    POCreateRequest,
    POFromAwardRequest,
    POLineCreate,
)
from app.modules.purchase_order.service import purchase_order_service

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def create_po_fixtures(db: AsyncSession, org_id):
    buyer_id = uuid4()
    vendor_id = uuid4()
    vendor2_id = uuid4()
    bu_id = uuid4()
    cat_id = uuid4()
    uom_id = uuid4()
    le_id = uuid4()
    rfq_id = uuid4()
    arn_id = uuid4()
    contract_id = uuid4()

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
        VALUES (:id, :org_id, 'Pieces', 'PCS') ON CONFLICT (id) DO NOTHING
        """),
        {"id": uom_id, "org_id": org_id},
    )

    await db.execute(
        text("""
        INSERT INTO vendors (id, org_id, vendor_code, company_name, primary_email, status, version)
        VALUES (:id, :org_id, :code, :name, :email, 'ACTIVE', 1) ON CONFLICT (id) DO NOTHING
        """),
        {"id": vendor_id, "org_id": org_id, "code": f"V{vendor_id.hex[:4]}", "name": "Global Supplies Ltd", "email": f"vendor-{vendor_id.hex[:4]}@test.com"},
    )

    await db.execute(
        text("""
        INSERT INTO vendors (id, org_id, vendor_code, company_name, primary_email, status, version)
        VALUES (:id, :org_id, :code, :name, :email, 'ACTIVE', 1) ON CONFLICT (id) DO NOTHING
        """),
        {"id": vendor2_id, "org_id": org_id, "code": f"V{vendor2_id.hex[:4]}", "name": "Precision Tools Inc", "email": f"vendor2-{vendor2_id.hex[:4]}@test.com"},
    )

    vendor_user_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, vendor_id, version)
        VALUES (:id, :org_id, :email, 'hash', 'Vendor', 'Rep', 'ACTIVE', :v_id, 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": vendor_user_id, "org_id": org_id, "email": f"vuser-{vendor_user_id.hex[:6]}@test.com", "v_id": vendor_id},
    )

    # Active Rate Contract
    await db.execute(
        text("""
        INSERT INTO contracts (id, org_id, contract_number, title, vendor_id, status, contract_type,
                               currency, total_value, utilized_value, start_date, end_date,
                               business_unit_id, category_id, signing_log, version)
        VALUES (:id, :org_id, :num, 'Master Rate Agreement', :vendor_id, 'ACTIVE', 'RATE_CONTRACT',
                'INR', 1000000.00, 0.00, CURRENT_DATE, CURRENT_DATE + INTERVAL '365 days',
                :bu_id, :cat_id, '[]'::jsonb, 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {
            "id": contract_id,
            "org_id": org_id,
            "num": f"CNT-{contract_id.hex[:6]}",
            "vendor_id": vendor_id,
            "bu_id": bu_id,
            "cat_id": cat_id,
        },
    )

    # RFQ
    await db.execute(
        text("""
        INSERT INTO rfqs (id, org_id, rfq_number, title, status, sourcing_type, rfq_type,
                          buyer_id, business_unit_id, category_id, estimated_value, currency)
        VALUES (:id, :org_id, :num, 'PO Source RFQ', 'AWARDED', 'GOODS', 'LIMITED_TENDER',
                :buyer_id, :bu_id, :cat_id, 300000.00, 'INR')
        ON CONFLICT (id) DO NOTHING
        """),
        {
            "id": rfq_id,
            "org_id": org_id,
            "num": f"RFQ-{rfq_id.hex[:6]}",
            "buyer_id": buyer_id,
            "bu_id": bu_id,
            "cat_id": cat_id,
        },
    )

    # RFQ Lines
    rfq_line1_id = uuid4()
    rfq_line2_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO rfq_lines (id, org_id, rfq_id, line_number, item_description, category_id, uom_id, quantity, estimated_unit_price)
        VALUES (:id, :org_id, :rfq_id, 1, 'Steel Valves 50mm', :cat_id, :uom_id, 100, 1500.00)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": rfq_line1_id, "org_id": org_id, "rfq_id": rfq_id, "cat_id": cat_id, "uom_id": uom_id},
    )
    await db.execute(
        text("""
        INSERT INTO rfq_lines (id, org_id, rfq_id, line_number, item_description, category_id, uom_id, quantity, estimated_unit_price)
        VALUES (:id, :org_id, :rfq_id, 2, 'Copper Fittings 25mm', :cat_id, :uom_id, 200, 750.00)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": rfq_line2_id, "org_id": org_id, "rfq_id": rfq_id, "cat_id": cat_id, "uom_id": uom_id},
    )

    # CS
    cs_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO comparative_statements (id, org_id, rfq_id, cs_number, status, cost_of_capital_rate,
                                           evaluation_methodology, total_estimated_value, generated_by)
        VALUES (:id, :org_id, :rfq_id, :cs_num, 'APPROVED', 0.10, 'L1', 300000.00, :gen_by)
        ON CONFLICT (id) DO NOTHING
        """),
        {
            "id": cs_id,
            "org_id": org_id,
            "rfq_id": rfq_id,
            "cs_num": f"CS-{cs_id.hex[:6]}",
            "gen_by": buyer_id,
        },
    )

    # Award Recommendation (ARN)
    await db.execute(
        text("""
        INSERT INTO award_recommendations (id, org_id, rfq_id, cs_id, arn_number, status,
                                           justification, total_awarded_value, recommended_by)
        VALUES (:id, :org_id, :rfq_id, :cs_id, :num, 'APPROVED', 'Split award', 300000.00, :buyer_id)
        ON CONFLICT (id) DO NOTHING
        """),
        {
            "id": arn_id,
            "org_id": org_id,
            "rfq_id": rfq_id,
            "cs_id": cs_id,
            "num": f"ARN-{arn_id.hex[:6]}",
            "buyer_id": buyer_id,
        },
    )

    # Bids
    bid1_id = uuid4()
    bid2_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO bid_responses (id, org_id, rfq_id, vendor_id, status)
        VALUES (:id, :org_id, :rfq_id, :vendor_id, 'SUBMITTED')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": bid1_id, "org_id": org_id, "rfq_id": rfq_id, "vendor_id": vendor_id},
    )
    await db.execute(
        text("""
        INSERT INTO bid_responses (id, org_id, rfq_id, vendor_id, status)
        VALUES (:id, :org_id, :rfq_id, :vendor_id, 'SUBMITTED')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": bid2_id, "org_id": org_id, "rfq_id": rfq_id, "vendor_id": vendor2_id},
    )

    # Award details (Split award between vendor1 and vendor2)
    await db.execute(
        text("""
        INSERT INTO award_details (id, org_id, arn_id, rfq_line_id, vendor_id, bid_id,
                                   awarded_quantity, awarded_unit_price, awarded_total, award_type)
        VALUES (:id, :org_id, :arn_id, :line_id, :vendor_id, :bid_id, 100, 1500.00, 150000.00, 'SPLIT')
        """),
        {
            "id": uuid4(),
            "org_id": org_id,
            "arn_id": arn_id,
            "line_id": rfq_line1_id,
            "vendor_id": vendor_id,
            "bid_id": bid1_id,
        },
    )
    await db.execute(
        text("""
        INSERT INTO award_details (id, org_id, arn_id, rfq_line_id, vendor_id, bid_id,
                                   awarded_quantity, awarded_unit_price, awarded_total, award_type)
        VALUES (:id, :org_id, :arn_id, :line_id, :vendor_id, :bid_id, 200, 750.00, 150000.00, 'SPLIT')
        """),
        {
            "id": uuid4(),
            "org_id": org_id,
            "arn_id": arn_id,
            "line_id": rfq_line2_id,
            "vendor_id": vendor2_id,
            "bid_id": bid2_id,
        },
    )

    await db.commit()

    return {
        "buyer_id": buyer_id,
        "vendor_id": vendor_id,
        "vendor2_id": vendor2_id,
        "vendor_user_id": vendor_user_id,
        "bu_id": bu_id,
        "cat_id": cat_id,
        "uom_id": uom_id,
        "rfq_id": rfq_id,
        "arn_id": arn_id,
        "contract_id": contract_id,
    }


@pytest.mark.asyncio
async def test_po_fsm_and_direct_creation():
    """Verify PO creation, auto-numbering, auto-approval threshold, and FSM transition matrix."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_po_fixtures(db, org_id)

        # 1. Direct PO without justification fails
        req_no_just = POCreateRequest(
            title="Direct PO Without Justification",
            vendor_id=fix["vendor_id"],
            business_unit_id=fix["bu_id"],
            category_id=fix["cat_id"],
            currency="INR",
            lines=[
                POLineCreate(
                    item_description="Precision Bearings",
                    uom_id=fix["uom_id"],
                    ordered_quantity=Decimal("10"),
                    unit_price=Decimal("1000.00"),
                )
            ],
        )
        with pytest.raises(ValidationError):
            await purchase_order_service.create(db, req_no_just, fix["buyer_id"], org_id)

        # 2. Direct PO with justification succeeds (Below 2L threshold -> AUTO APPROVED)
        req_small = POCreateRequest(
            title="Small Direct PO",
            vendor_id=fix["vendor_id"],
            business_unit_id=fix["bu_id"],
            category_id=fix["cat_id"],
            currency="INR",
            deviation_justification="Emergency replacement approved by plant manager",
            lines=[
                POLineCreate(
                    item_description="Emergency Seals",
                    uom_id=fix["uom_id"],
                    ordered_quantity=Decimal("20"),
                    unit_price=Decimal("2500.00"),  # Total: 50,000 <= 200,000
                )
            ],
        )
        po = await purchase_order_service.create(db, req_small, fix["buyer_id"], org_id)
        assert po.po_number.startswith("BU")
        assert "PO-20" in po.po_number
        assert po.status == POStatus.APPROVED
        assert po.total_value == Decimal("50000.00")

        # 3. Direct PO above 2L threshold -> PENDING_APPROVAL
        req_large = POCreateRequest(
            title="Large Direct PO",
            vendor_id=fix["vendor_id"],
            business_unit_id=fix["bu_id"],
            category_id=fix["cat_id"],
            currency="INR",
            deviation_justification="Direct OEM procurement",
            lines=[
                POLineCreate(
                    item_description="High-voltage Transformers",
                    uom_id=fix["uom_id"],
                    ordered_quantity=Decimal("5"),
                    unit_price=Decimal("100000.00"),  # Total: 500,000 > 200,000
                )
            ],
        )
        po_large = await purchase_order_service.create(db, req_large, fix["buyer_id"], org_id)
        assert po_large.status == POStatus.PENDING_APPROVAL

        # Approve large PO
        po_large = await purchase_order_service.approve(db, po_large.id, fix["buyer_id"], org_id)
        assert po_large.status == POStatus.APPROVED

        # 4. Validate FSM checks
        assert can_transition(POStatus.DRAFT, POStatus.PENDING_APPROVAL)
        assert can_transition(POStatus.APPROVED, POStatus.RELEASED)
        assert can_transition("RELEASED", "ACKNOWLEDGED")
        assert not can_transition(POStatus.CLOSED, POStatus.DRAFT)


@pytest.mark.asyncio
async def test_po_price_deviation_and_computed_total():
    """Verify price deviation validation (0.1% tolerance) and DB computed total_price column."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_po_fixtures(db, org_id)

        # Price deviation > 0.1% without justification fails
        req_deviant = POCreateRequest(
            title="Deviant Price PO",
            vendor_id=fix["vendor_id"],
            business_unit_id=fix["bu_id"],
            category_id=fix["cat_id"],
            rfq_id=fix["rfq_id"],
            currency="INR",
            lines=[
                POLineCreate(
                    item_description="Valves",
                    uom_id=fix["uom_id"],
                    ordered_quantity=Decimal("10"),
                    unit_price=Decimal("1100.00"),  # 10% higher than awarded 1000
                    awarded_unit_price=Decimal("1000.00"),
                )
            ],
        )
        with pytest.raises(AppException) as exc:
            await purchase_order_service.create(db, req_deviant, fix["buyer_id"], org_id)
        assert exc.value.code == "PRICE_DEVIATION"

        # Price deviation within 0.1% succeeds
        req_tolerance = POCreateRequest(
            title="Tolerance Price PO",
            vendor_id=fix["vendor_id"],
            business_unit_id=fix["bu_id"],
            category_id=fix["cat_id"],
            currency="INR",
            deviation_justification="Minor rounding difference",
            lines=[
                POLineCreate(
                    item_description="Valves",
                    uom_id=fix["uom_id"],
                    ordered_quantity=Decimal("10"),
                    unit_price=Decimal("1000.80"),  # 0.08% deviation <= 0.1%
                    awarded_unit_price=Decimal("1000.00"),
                )
            ],
        )
        po = await purchase_order_service.create(db, req_tolerance, fix["buyer_id"], org_id)
        assert po is not None

        # Verify computed column in DB
        line_stmt = text("SELECT total_price FROM po_lines WHERE po_id = :po_id")
        res = await db.execute(line_stmt, {"po_id": po.id})
        computed_total = res.scalar()
        assert computed_total == Decimal("10008.00")


@pytest.mark.asyncio
async def test_po_creation_from_award_split():
    """Verify creating POs from Award Recommendation with split award generating multiple POs."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_po_fixtures(db, org_id)

        req = POFromAwardRequest(arn_id=fix["arn_id"])
        pos = await purchase_order_service.create_from_award(db, req, fix["buyer_id"], org_id)

        # 2 vendors in split award -> 2 separate POs
        assert len(pos) == 2
        vendor_ids = {p.vendor_id for p in pos}
        assert fix["vendor_id"] in vendor_ids
        assert fix["vendor2_id"] in vendor_ids

        for p in pos:
            assert p.rfq_id == fix["rfq_id"]
            assert p.arn_id == fix["arn_id"]
            assert len(p.lines) == 1
            assert p.total_value == Decimal("150000.00")


@pytest.mark.asyncio
async def test_rate_contract_utilization_on_po():
    """Verify creating PO against rate contract updates contract utilized_value, and cancellation reverts it."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_po_fixtures(db, org_id)

        # Initial contract utilized value
        cnt_stmt = text("SELECT utilized_value FROM contracts WHERE id = :id")
        res = await db.execute(cnt_stmt, {"id": fix["contract_id"]})
        assert res.scalar() == Decimal("0.00")

        # Create PO against rate contract
        po_req = POCreateRequest(
            title="Rate Contract Release Order",
            vendor_id=fix["vendor_id"],
            business_unit_id=fix["bu_id"],
            category_id=fix["cat_id"],
            contract_id=fix["contract_id"],
            currency="INR",
            lines=[
                POLineCreate(
                    item_description="Catalog Components",
                    uom_id=fix["uom_id"],
                    ordered_quantity=Decimal("50"),
                    unit_price=Decimal("1000.00"),  # Total: 50,000
                )
            ],
        )
        po = await purchase_order_service.create(db, po_req, fix["buyer_id"], org_id)

        # Check utilization increased
        res = await db.execute(cnt_stmt, {"id": fix["contract_id"]})
        assert res.scalar() == Decimal("50000.00")

        # Cancel PO -> reverts utilization
        await purchase_order_service.cancel_po(
            db, po.id, "Reverted release order", fix["buyer_id"], org_id
        )
        res = await db.execute(cnt_stmt, {"id": fix["contract_id"]})
        assert res.scalar() == Decimal("0.00")


@pytest.mark.asyncio
async def test_po_release_and_pdf_generation():
    """Verify PO release to vendor, ReportLab PDF generation, and document path assignment."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_po_fixtures(db, org_id)

        po_req = POCreateRequest(
            title="PO for PDF Test",
            vendor_id=fix["vendor_id"],
            business_unit_id=fix["bu_id"],
            category_id=fix["cat_id"],
            currency="INR",
            deviation_justification="Test release",
            lines=[
                POLineCreate(
                    item_description="Heavy Duty Gaskets",
                    uom_id=fix["uom_id"],
                    ordered_quantity=Decimal("100"),
                    unit_price=Decimal("250.00"),
                )
            ],
        )
        po = await purchase_order_service.create(db, po_req, fix["buyer_id"], org_id)
        assert po.status == POStatus.APPROVED

        # Send to vendor
        po_released = await purchase_order_service.send_to_vendor(
            db, po.id, fix["buyer_id"], org_id
        )
        assert po_released.status == POStatus.RELEASED
        assert po_released.sent_at is not None
        assert po_released.po_document_path is not None
        assert "po/" in po_released.po_document_path

        # Verify PDF bytes can be built directly
        pdf_bytes = purchase_order_service.pdf_generator.build_pdf_bytes(
            po_released, lines=po_released.lines
        )
        assert len(pdf_bytes) > 500
        assert pdf_bytes.startswith(b"%PDF")


@pytest.mark.asyncio
async def test_vendor_acknowledgement_and_rejection():
    """Verify supplier portal acknowledgment and rejection workflows."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_po_fixtures(db, org_id)

        # 1. Test Accept
        po1 = await purchase_order_service.create(
            db,
            POCreateRequest(
                title="PO Acknowledgment Test",
                vendor_id=fix["vendor_id"],
                business_unit_id=fix["bu_id"],
                category_id=fix["cat_id"],
                currency="INR",
                deviation_justification="Direct order",
                lines=[
                    POLineCreate(
                        item_description="Alloy Tubes",
                        uom_id=fix["uom_id"],
                        ordered_quantity=Decimal("20"),
                        unit_price=Decimal("500.00"),
                    )
                ],
            ),
            fix["buyer_id"],
            org_id,
        )
        await purchase_order_service.send_to_vendor(db, po1.id, fix["buyer_id"], org_id)
        po1_ack = await purchase_order_service.record_vendor_acknowledgement(
            db, po1.id, accepted=True, rejection_reason=None, actor_id=fix["vendor_user_id"], org_id=org_id
        )
        assert po1_ack.status == POStatus.ACKNOWLEDGED
        assert po1_ack.acknowledged_at is not None

        # 2. Test Reject
        po2 = await purchase_order_service.create(
            db,
            POCreateRequest(
                title="PO Rejection Test",
                vendor_id=fix["vendor_id"],
                business_unit_id=fix["bu_id"],
                category_id=fix["cat_id"],
                currency="INR",
                deviation_justification="Direct order",
                lines=[
                    POLineCreate(
                        item_description="Alloy Tubes",
                        uom_id=fix["uom_id"],
                        ordered_quantity=Decimal("20"),
                        unit_price=Decimal("500.00"),
                    )
                ],
            ),
            fix["buyer_id"],
            org_id,
        )
        await purchase_order_service.send_to_vendor(db, po2.id, fix["buyer_id"], org_id)
        po2_rej = await purchase_order_service.record_vendor_acknowledgement(
            db,
            po2.id,
            accepted=False,
            rejection_reason="Material out of stock for 4 weeks",
            actor_id=fix["vendor_user_id"],
            org_id=org_id,
        )
        assert po2_rej.status == POStatus.REJECTED_BY_SUPPLIER
        assert po2_rej.rejected_reason == "Material out of stock for 4 weeks"


@pytest.mark.asyncio
async def test_po_amendment_versioning_and_reapproval():
    """Verify formal PO amendments with version increment and re-approval triggers."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_po_fixtures(db, org_id)

        po = await purchase_order_service.create(
            db,
            POCreateRequest(
                title="PO Amendment Test",
                vendor_id=fix["vendor_id"],
                business_unit_id=fix["bu_id"],
                category_id=fix["cat_id"],
                currency="INR",
                deviation_justification="Order for amendment test",
                lines=[
                    POLineCreate(
                        item_description="Standard Bolts",
                        uom_id=fix["uom_id"],
                        ordered_quantity=Decimal("100"),
                        unit_price=Decimal("100.00"),  # Total: 10,000
                    )
                ],
            ),
            fix["buyer_id"],
            org_id,
        )
        await purchase_order_service.send_to_vendor(db, po.id, fix["buyer_id"], org_id)
        await purchase_order_service.record_vendor_acknowledgement(
            db, po.id, accepted=True, rejection_reason=None, actor_id=fix["vendor_user_id"], org_id=org_id
        )

        # Minor amendment (value change < 10% -> no re-approval)
        amend_res = await purchase_order_service.amend_po(
            db,
            po.id,
            POAmendRequest(
                reason="Minor packaging requirement update",
                value_change=Decimal("500.00"),  # 5% change
                field_changes={"packaging": "Corrugated export box"},
            ),
            fix["buyer_id"],
            org_id,
        )
        assert amend_res.amendment_count == 1
        assert amend_res.total_value == Decimal("10500.00")
        assert amend_res.status == POStatus.AMENDED

        # Major amendment (value change > 10% -> re-approval required)
        amend_res_major = await purchase_order_service.amend_po(
            db,
            po.id,
            POAmendRequest(
                reason="Additional quantity ordered by operations",
                value_change=Decimal("3000.00"),  # > 10%
                field_changes={"ordered_quantity": 130},
            ),
            fix["buyer_id"],
            org_id,
        )
        assert amend_res_major.amendment_count == 2
        assert amend_res_major.status == POStatus.PENDING_APPROVAL


@pytest.mark.asyncio
async def test_grn_creation_and_quality_inspection_gate():
    """Verify GRN creation against PO, open quantity validation, and mandatory QC inspection gate."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_po_fixtures(db, org_id)

        # Create and acknowledge PO
        po = await purchase_order_service.create(
            db,
            POCreateRequest(
                title="PO for GRN Quality Test",
                vendor_id=fix["vendor_id"],
                business_unit_id=fix["bu_id"],
                category_id=fix["cat_id"],
                currency="INR",
                deviation_justification="Direct QC test",
                lines=[
                    POLineCreate(
                        item_description="Critical Aerospace Bearings",
                        uom_id=fix["uom_id"],
                        ordered_quantity=Decimal("50"),
                        unit_price=Decimal("1000.00"),
                    )
                ],
            ),
            fix["buyer_id"],
            org_id,
        )
        await purchase_order_service.send_to_vendor(db, po.id, fix["buyer_id"], org_id)
        await purchase_order_service.record_vendor_acknowledgement(
            db, po.id, accepted=True, rejection_reason=None, actor_id=fix["vendor_user_id"], org_id=org_id
        )

        po_line_id = po.lines[0].id

        # 1. Over-receipt validation
        with pytest.raises(AppException) as exc:
            await grn_service.create_grn(
                db,
                GrnCreateRequest(
                    po_id=po.id,
                    challan_number="CH-9999",
                    lines=[
                        GrnLineCreate(
                            po_line_id=po_line_id,
                            received_quantity=Decimal("60"),  # Open is 50 -> exceeds!
                        )
                    ],
                ),
                fix["buyer_id"],
                org_id,
            )
        assert exc.value.code == "OVER_RECEIPT_EXCEEDED"

        # 2. GRN creation with QC required -> status PENDING_QC
        grn = await grn_service.create_grn(
            db,
            GrnCreateRequest(
                po_id=po.id,
                challan_number="CH-001",
                transporter_name="FastFreight Logistics",
                lines=[
                    GrnLineCreate(
                        po_line_id=po_line_id,
                        received_quantity=Decimal("50"),
                        qc_required=True,
                    )
                ],
            ),
            fix["buyer_id"],
            org_id,
        )
        assert grn.status == "PENDING_QC"
        assert grn.lines[0].qc_status == "PENDING"
        assert grn.lines[0].accepted_quantity == Decimal("0.0")

        # 3. Confirming GRN before QC is completed MUST fail
        with pytest.raises(AppException) as exc:
            await grn_service.confirm_grn(db, grn.id, fix["buyer_id"], org_id)
        assert exc.value.code == "QC_PENDING"

        # 4. Perform Quality Inspection: 45 accepted, 5 rejected
        qi = await grn_service.quality_inspection(
            db,
            QualityInspectionCreate(
                grn_line_id=grn.lines[0].id,
                result="PARTIAL",
                accepted_quantity=Decimal("45"),
                rejected_quantity=Decimal("5"),
                remarks="5 units failed micro-surface smoothness test",
            ),
            inspector_id=fix["buyer_id"],
            org_id=org_id,
        )
        assert qi.result == "PARTIAL"
        assert qi.accepted_quantity == Decimal("45")

        # Line updated
        grn_refreshed = await grn_service.get(db, grn.id, org_id)
        assert grn_refreshed.lines[0].accepted_quantity == Decimal("45")
        assert grn_refreshed.lines[0].rejected_quantity == Decimal("5")
        assert grn_refreshed.lines[0].qc_status == "PARTIAL"


@pytest.mark.asyncio
async def test_confirm_grn_triggers_po_receipt_and_scorecard():
    """Verify confirming GRN updates PO line quantities, transitions PO status, and updates vendor scorecard."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_po_fixtures(db, org_id)

        # Create PO for 100 items
        po = await purchase_order_service.create(
            db,
            POCreateRequest(
                title="PO Full Receipt Workflow",
                vendor_id=fix["vendor_id"],
                business_unit_id=fix["bu_id"],
                category_id=fix["cat_id"],
                currency="INR",
                expected_delivery_date=date.today() + timedelta(days=10),
                deviation_justification="Standard delivery test",
                lines=[
                    POLineCreate(
                        item_description="Industrial Solenoid Valves",
                        uom_id=fix["uom_id"],
                        ordered_quantity=Decimal("100"),
                        unit_price=Decimal("500.00"),
                    )
                ],
            ),
            fix["buyer_id"],
            org_id,
        )
        await purchase_order_service.send_to_vendor(db, po.id, fix["buyer_id"], org_id)
        await purchase_order_service.record_vendor_acknowledgement(
            db, po.id, accepted=True, rejection_reason=None, actor_id=fix["vendor_user_id"], org_id=org_id
        )

        po_line_id = po.lines[0].id

        # Partial GRN: receive 40 units (no QC needed)
        grn1 = await grn_service.create_grn(
            db,
            GrnCreateRequest(
                po_id=po.id,
                challan_number="CH-PARTIAL",
                lines=[
                    GrnLineCreate(
                        po_line_id=po_line_id,
                        received_quantity=Decimal("40"),
                        qc_required=False,
                    )
                ],
            ),
            fix["buyer_id"],
            org_id,
        )
        assert grn1.lines[0].accepted_quantity == Decimal("40")

        # Confirm partial GRN
        await grn_service.confirm_grn(db, grn1.id, fix["buyer_id"], org_id)

        # Check PO updated to PARTIALLY_RECEIVED
        po_updated = await purchase_order_service.get(db, po.id, org_id)
        assert po_updated.status == POStatus.PARTIALLY_RECEIVED
        assert po_updated.lines[0].received_quantity == Decimal("40")
        assert po_updated.lines[0].open_quantity == Decimal("60")

        # Second GRN: receive remaining 60 units
        grn2 = await grn_service.create_grn(
            db,
            GrnCreateRequest(
                po_id=po.id,
                challan_number="CH-FINAL",
                lines=[
                    GrnLineCreate(
                        po_line_id=po_line_id,
                        received_quantity=Decimal("60"),
                        qc_required=False,
                    )
                ],
            ),
            fix["buyer_id"],
            org_id,
        )
        await grn_service.confirm_grn(db, grn2.id, fix["buyer_id"], org_id)

        # Check PO updated to FULLY_RECEIVED
        po_final = await purchase_order_service.get(db, po.id, org_id)
        assert po_final.status == POStatus.FULLY_RECEIVED
        assert po_final.lines[0].received_quantity == Decimal("100")
        assert po_final.lines[0].open_quantity == Decimal("0")

        # Check Vendor Scorecard was updated
        scorecard_stmt = text(
            "SELECT on_time_delivery_rate, quality_acceptance_rate FROM vendor_scorecards WHERE vendor_id = :v_id"
        )
        res = await db.execute(scorecard_stmt, {"v_id": fix["vendor_id"]})
        scorecard = res.fetchone()
        assert scorecard is not None
        assert scorecard[0] == Decimal("100.00")  # Delivered on time
        assert scorecard[1] == Decimal("100.00")  # 100% accepted

        # Now PO can be closed
        po_closed = await purchase_order_service.close_po(
            db, po.id, fix["buyer_id"], org_id
        )
        assert po_closed.status == POStatus.CLOSED
