"""
Integration tests for SPEC_12 Comparative Statement & Evaluation:
- S12-01 / S12-02: CS auto-generation, L1 discovery per lot/line
- S12-03 / S12-04 / S12-05: Weighted technical/commercial/composite score calculation (L1 commercial score = 100)
- S12-06 / S12-17: CS PDF generation via ReportLab & MinIO bucket storage
- S12-07 / S12-08 / S12-09: Vendor shortlisting & negotiation round tracking
- S12-10 / S12-11 / S12-12: Award recommendation & approval workflow
- S12-13: Price tolerance validation against settings.PRICE_TOLERANCE_DEFAULT (0.5%)
- S12-15: Regret letters dispatched to non-awarded vendors only
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

import app.main  # noqa: F401
from app.config import settings
from app.core.exceptions import AppException, ValidationError, NotFoundError
from app.db.enums import RFQStatus
from app.modules.sourcing.service import rfq_service
from app.modules.sourcing.schemas import (
    RfqCreateRequest,
    RfqLineCreateRequest,
    RfqLotCreateRequest,
    AddParticipantsRequest,
)
from app.modules.sourcing.repository import rfq_repository
from app.modules.bid.service import bid_service
from app.modules.bid.schemas import (
    BidSubmitRequest,
    BidLineSubmitRequest,
)
from app.modules.bid.repository import bid_repository
from app.modules.evaluation.service import evaluation_service
from app.modules.evaluation.repository import (
    evaluation_repository,
    negotiation_repository,
    award_repository,
)
from app.modules.evaluation.schemas import (
    AwardRecommendationItem,
)
from app.modules.evaluation.pdf_generator import pdf_generator

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def create_evaluation_fixtures(db: AsyncSession, org_id):
    buyer_id = uuid4()
    co_auth_id = uuid4()
    creator_id = uuid4()
    vendor1_id = uuid4()
    vendor2_id = uuid4()
    vendor3_id = uuid4()
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

    for uid, prefix in [
        (buyer_id, "buyer"),
        (co_auth_id, "coauth"),
        (creator_id, "creator"),
    ]:
        await db.execute(
            text("""
            INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
            VALUES (:id, :org_id, :email, 'hash', 'Test', 'User', 'ACTIVE', 1)
            ON CONFLICT (id) DO NOTHING
            """),
            {"id": uid, "org_id": org_id, "email": f"{prefix}-{uid.hex[:6]}@test.com"},
        )

    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, country_code)
        VALUES (:id, :org_id, 'Test Entity', :reg, 'IN') ON CONFLICT (id) DO NOTHING
        """),
        {"id": le_id, "org_id": org_id, "reg": f"REG{le_id.hex[:8]}"},
    )
    await db.execute(
        text("""
        INSERT INTO business_units (id, org_id, name, code, legal_entity_id)
        VALUES (:id, :org_id, 'Test BU', :code, :le_id) ON CONFLICT (id) DO NOTHING
        """),
        {"id": bu_id, "org_id": org_id, "code": f"BU{bu_id.hex[:4]}", "le_id": le_id},
    )
    await db.execute(
        text("""
        INSERT INTO categories (id, org_id, name, code, level)
        VALUES (:id, :org_id, 'Test Cat', :code, 1) ON CONFLICT (id) DO NOTHING
        """),
        {"id": cat_id, "org_id": org_id, "code": f"C{cat_id.hex[:6]}"},
    )
    await db.execute(
        text("""
        INSERT INTO uom_master (id, org_id, name, code)
        VALUES (:id, :org_id, 'Each', 'EA') ON CONFLICT (id) DO NOTHING
        """),
        {"id": uom_id, "org_id": org_id},
    )

    for vid, vcode, vname in [
        (vendor1_id, "V1", "Alpha Technologies Ltd"),
        (vendor2_id, "V2", "Beta Systems Corp"),
        (vendor3_id, "V3", "Gamma Solutions Inc"),
    ]:
        await db.execute(
            text("""
            INSERT INTO vendors (id, org_id, vendor_code, company_name, primary_email, status, version)
            VALUES (:id, :org_id, :code, :name, :email, 'ACTIVE', 1) ON CONFLICT (id) DO NOTHING
            """),
            {"id": vid, "org_id": org_id, "code": f"{vcode}{vid.hex[:6]}", "name": vname, "email": f"{vcode.lower()}@test.com"},
        )

    await db.commit()

    return {
        "buyer_id": buyer_id,
        "co_auth_id": co_auth_id,
        "creator_id": creator_id,
        "vendor1_id": vendor1_id,
        "vendor2_id": vendor2_id,
        "vendor3_id": vendor3_id,
        "bu_id": bu_id,
        "cat_id": cat_id,
        "uom_id": uom_id,
    }


async def setup_opened_rfq_with_bids(db: AsyncSession, org_id: UUID, fx: dict):
    """Helper to create an RFQ with two lots and three submitted, unsealed bids."""
    lot1_id = uuid4()
    lot2_id = uuid4()

    rfq = await rfq_service.create(
        db,
        data=RfqCreateRequest(
            title="Evaluation Integration Test RFQ",
            rfq_type="LIMITED_TENDER",
            business_unit_id=fx["bu_id"],
            category_id=fx["cat_id"],
            bid_close_at=datetime.now(timezone.utc) + timedelta(days=5),
            bid_validity_days=90,
            estimated_value=Decimal("500000.00"),
            is_multi_lot=True,
            lots=[
                RfqLotCreateRequest(
                    lot_number=1,
                    title="Hardware Lot",
                    description="Servers and racks",
                    estimated_value=Decimal("300000.00"),
                ),
                RfqLotCreateRequest(
                    lot_number=2,
                    title="Networking Lot",
                    description="Switches and cables",
                    estimated_value=Decimal("200000.00"),
                ),
            ],
            lines=[
                RfqLineCreateRequest(
                    line_number=1,
                    item_description="Server Rack Units",
                    category_id=fx["cat_id"],
                    uom_id=fx["uom_id"],
                    quantity=Decimal("5"),
                    estimated_unit_price=Decimal("60000.00"),
                ),
                RfqLineCreateRequest(
                    line_number=2,
                    item_description="10GbE Switch 48-port",
                    category_id=fx["cat_id"],
                    uom_id=fx["uom_id"],
                    quantity=Decimal("2"),
                    estimated_unit_price=Decimal("100000.00"),
                ),
            ],
        ),
        actor_id=fx["buyer_id"],
        org_id=org_id,
    )

    # Publish RFQ
    rfq.status = RFQStatus.PUBLISHED
    rfq.published_at = datetime.now(timezone.utc)
    await db.commit()

    # Invite participants
    vendor_ids = [fx["vendor1_id"], fx["vendor2_id"], fx["vendor3_id"]]
    await rfq_service.add_participants(
        db, rfq_id=rfq.id, data=AddParticipantsRequest(vendor_ids=vendor_ids), actor_id=fx["buyer_id"], org_id=org_id
    )
    await db.commit()

    loaded_rfq = await rfq_repository.get(db, rfq.id, org_id)
    line1 = loaded_rfq.lines[0]
    line2 = loaded_rfq.lines[1]
    lot1 = loaded_rfq.lots[0]
    lot2 = loaded_rfq.lots[1]

    # Assign lot_id to lines
    line1.lot_id = lot1.id
    line2.lot_id = lot2.id
    await db.commit()

    # Vendor 1: Total Lot 1 = 200,000 (L1), Lot 2 = 180,000
    bid1 = await bid_service.submit_bid(
        db,
        rfq_id=rfq.id,
        data=BidSubmitRequest(
            has_deviations=False,
            technical_offer_compliant=True,
            bid_validity_days=90,
            lines=[
                BidLineSubmitRequest(
                    rfq_line_id=line1.id,
                    lot_id=lot1.id,
                    unit_price=Decimal("40000.00"),
                    total_price=Decimal("200000.00"),
                    currency="INR",
                    quantity=Decimal("5"),
                    delivery_days=14,
                ),
                BidLineSubmitRequest(
                    rfq_line_id=line2.id,
                    lot_id=lot2.id,
                    unit_price=Decimal("90000.00"),
                    total_price=Decimal("180000.00"),
                    currency="INR",
                    quantity=Decimal("2"),
                    delivery_days=21,
                ),
            ],
        ),
        vendor_id=fx["vendor1_id"],
        actor_id=fx["buyer_id"],
        org_id=org_id,
    )
    bid1.technical_score = Decimal("90.0")

    # Vendor 2: Total Lot 1 = 250,000, Lot 2 = 150,000 (L1)
    bid2 = await bid_service.submit_bid(
        db,
        rfq_id=rfq.id,
        data=BidSubmitRequest(
            has_deviations=False,
            technical_offer_compliant=True,
            bid_validity_days=90,
            lines=[
                BidLineSubmitRequest(
                    rfq_line_id=line1.id,
                    lot_id=lot1.id,
                    unit_price=Decimal("50000.00"),
                    total_price=Decimal("250000.00"),
                    currency="INR",
                    quantity=Decimal("5"),
                    delivery_days=10,
                ),
                BidLineSubmitRequest(
                    rfq_line_id=line2.id,
                    lot_id=lot2.id,
                    unit_price=Decimal("75000.00"),
                    total_price=Decimal("150000.00"),
                    currency="INR",
                    quantity=Decimal("2"),
                    delivery_days=15,
                ),
            ],
        ),
        vendor_id=fx["vendor2_id"],
        actor_id=fx["buyer_id"],
        org_id=org_id,
    )
    bid2.technical_score = Decimal("95.0")

    # Vendor 3: Total Lot 1 = 280,000, Lot 2 = 190,000
    bid3 = await bid_service.submit_bid(
        db,
        rfq_id=rfq.id,
        data=BidSubmitRequest(
            has_deviations=False,
            technical_offer_compliant=True,
            bid_validity_days=90,
            lines=[
                BidLineSubmitRequest(
                    rfq_line_id=line1.id,
                    lot_id=lot1.id,
                    unit_price=Decimal("56000.00"),
                    total_price=Decimal("280000.00"),
                    currency="INR",
                    quantity=Decimal("5"),
                    delivery_days=30,
                ),
                BidLineSubmitRequest(
                    rfq_line_id=line2.id,
                    lot_id=lot2.id,
                    unit_price=Decimal("95000.00"),
                    total_price=Decimal("190000.00"),
                    currency="INR",
                    quantity=Decimal("2"),
                    delivery_days=25,
                ),
            ],
        ),
        vendor_id=fx["vendor3_id"],
        actor_id=fx["buyer_id"],
        org_id=org_id,
    )
    bid3.technical_score = Decimal("85.0")
    await db.commit()

    # Deadline passes and creator set so buyer_id can initiate
    rfq.bid_close_at = datetime.now(timezone.utc) - timedelta(hours=1)
    rfq.created_by = fx["creator_id"]
    await db.commit()

    # Perform dual-authorization opening
    await rfq_service.initiate_bid_opening(db, rfq_id=rfq.id, actor_id=fx["buyer_id"], org_id=org_id)
    await db.commit()
    await rfq_service.co_authorize_bid_opening(db, rfq_id=rfq.id, actor_id=fx["co_auth_id"], org_id=org_id)
    await db.commit()

    # Price normalization (INR)
    await bid_service.normalize_prices_on_opening(db, rfq_id=rfq.id, org_id=org_id)
    await db.commit()

    # Re-fetch RFQ after opening
    reloaded_rfq = await rfq_repository.get(db, rfq.id, org_id)
    return reloaded_rfq, [bid1, bid2, bid3], [lot1, lot2]


@pytest.mark.asyncio
async def test_l1_identified_per_lot():
    """L1 is vendor with lowest normalized_price_inr per lot."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_evaluation_fixtures(db, org_id)
        rfq, bids, lots = await setup_opened_rfq_with_bids(db, org_id, fx)

        cs = await evaluation_service.generate_comparative_statement(
            db, rfq_id=rfq.id, actor_id=fx["buyer_id"], org_id=org_id
        )
        await db.commit()

        assert cs is not None
        assert cs.status == "DRAFT"
        assert cs.cs_number.startswith("CS-")

        # Verify rankings
        rankings = cs.rankings
        assert len(rankings) == 6  # 3 vendors x 2 lots

        # Lot 1: Vendor 1 should be L1 (200,000 < 250,000 < 280,000)
        lot1_rankings = [r for r in rankings if r.lot_id == lots[0].id]
        lot1_l1 = next((r for r in lot1_rankings if r.rank == 1), None)
        assert lot1_l1 is not None
        assert lot1_l1.vendor_id == fx["vendor1_id"]
        assert lot1_l1.is_l1 is True
        assert lot1_l1.lot_total_inr == Decimal("200000.00")

        # Lot 2: Vendor 2 should be L1 (150,000 < 180,000 < 190,000)
        lot2_rankings = [r for r in rankings if r.lot_id == lots[1].id]
        lot2_l1 = next((r for r in lot2_rankings if r.rank == 1), None)
        assert lot2_l1 is not None
        assert lot2_l1.vendor_id == fx["vendor2_id"]
        assert lot2_l1.is_l1 is True
        assert lot2_l1.lot_total_inr == Decimal("150000.00")

        # L1 Total Value = 200,000 + 150,000 = 350,000
        assert cs.l1_total_value == Decimal("350000.00")
        # Savings against 500,000 estimated = (500000 - 350000) / 500000 * 100 = 30.00%
        assert cs.savings_percentage == Decimal("30.00")


@pytest.mark.asyncio
async def test_cs_fails_without_normalized_prices():
    """Missing normalized prices → MISSING_NORMALIZED_PRICES error."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_evaluation_fixtures(db, org_id)
        rfq, bids, lots = await setup_opened_rfq_with_bids(db, org_id, fx)

        # Deliberately set a bid line's normalized_price_inr to None
        all_bids = await bid_repository.get_all_for_rfq(db, rfq.id, org_id)
        target_line = all_bids[0].lines[0]
        target_line.normalized_price_inr = None
        await db.commit()

        with pytest.raises(AppException) as exc_info:
            await evaluation_service.generate_comparative_statement(
                db, rfq_id=rfq.id, actor_id=fx["buyer_id"], org_id=org_id
            )
        assert exc_info.value.code == "MISSING_NORMALIZED_PRICES"


@pytest.mark.asyncio
async def test_commercial_score_l1_is_100():
    """L1 vendor gets commercial_score=100; higher price gets proportional score."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_evaluation_fixtures(db, org_id)
        rfq, bids, lots = await setup_opened_rfq_with_bids(db, org_id, fx)

        cs = await evaluation_service.generate_comparative_statement(
            db, rfq_id=rfq.id, actor_id=fx["buyer_id"], org_id=org_id
        )
        await db.commit()

        lot1_rankings = [r for r in cs.rankings if r.lot_id == lots[0].id]
        v1_rank = next(r for r in lot1_rankings if r.vendor_id == fx["vendor1_id"])
        v2_rank = next(r for r in lot1_rankings if r.vendor_id == fx["vendor2_id"])

        # Vendor 1 is L1 with 200,000 -> commercial score = 100
        assert v1_rank.commercial_score == Decimal("100.00")

        # Vendor 2 is 250,000 -> commercial score = (200000 / 250000) * 100 = 80.00
        assert v2_rank.commercial_score == Decimal("80.00")

        # Weights: 70% technical, 30% commercial
        # Vendor 1: tech=90 -> composite = 90 * 0.70 + 100 * 0.30 = 63 + 30 = 93.00
        expected_v1_composite = Decimal("90.0") * Decimal("0.70") + Decimal("100.0") * Decimal("0.30")
        assert v1_rank.composite_score == expected_v1_composite


@pytest.mark.asyncio
async def test_price_tolerance_validation():
    """Negotiated price >0.5% above original → ValidationError; decrease or <=0.5% succeeds."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_evaluation_fixtures(db, org_id)
        rfq, bids, lots = await setup_opened_rfq_with_bids(db, org_id, fx)

        cs = await evaluation_service.generate_comparative_statement(
            db, rfq_id=rfq.id, actor_id=fx["buyer_id"], org_id=org_id
        )
        await db.commit()

        # Start negotiation with Vendor 1 (original price = 200,000)
        negs = await evaluation_service.start_negotiation(
            db, cs_id=cs.id, vendor_ids=[fx["vendor1_id"]], actor_id=fx["buyer_id"], org_id=org_id
        )
        await db.commit()
        assert len(negs) == 1
        neg = negs[0]
        assert neg.original_price == Decimal("200000.00")

        # Attempt price increase of 1.0% (202,000 > 201,000 max allowed for 0.5% tolerance)
        with pytest.raises(ValidationError) as exc_info:
            await evaluation_service.submit_negotiated_price(
                db, negotiation_id=neg.id, new_price=Decimal("202000.00"), actor_id=fx["buyer_id"], org_id=org_id
            )
        assert exc_info.value.code == "PRICE_TOLERANCE_EXCEEDED"

        # Valid price reduction: 190,000 (5% savings)
        updated_neg = await evaluation_service.submit_negotiated_price(
            db, negotiation_id=neg.id, new_price=Decimal("190000.00"), actor_id=fx["buyer_id"], org_id=org_id
        )
        await db.commit()
        assert updated_neg.negotiated_price == Decimal("190000.00")
        assert updated_neg.status == "PRICE_SUBMITTED"
        assert updated_neg.price_change_pct == Decimal("-5.0000")


@pytest.mark.asyncio
async def test_cs_pdf_uploaded_to_minio():
    """CS generation uploads PDF using ReportLab to MinIO 'comparative-statement' bucket."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_evaluation_fixtures(db, org_id)
        rfq, bids, lots = await setup_opened_rfq_with_bids(db, org_id, fx)

        cs = await evaluation_service.generate_comparative_statement(
            db, rfq_id=rfq.id, actor_id=fx["buyer_id"], org_id=org_id
        )
        await db.commit()

        assert cs.document_path is not None
        assert cs.document_path.startswith(f"{org_id}/rfq/{rfq.id}/cs/")
        assert cs.document_path.endswith(".pdf")

        # Direct verification of PDF byte generation
        raw_pdf = pdf_generator.build_pdf_bytes(cs, rfq, bids, lots)
        assert raw_pdf.startswith(b"%PDF")
        assert len(raw_pdf) > 500


@pytest.mark.asyncio
async def test_regret_letters_exclude_awarded_vendors():
    """Awarded vendors not in regret letter notification list."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_evaluation_fixtures(db, org_id)
        rfq, bids, lots = await setup_opened_rfq_with_bids(db, org_id, fx)

        cs = await evaluation_service.generate_comparative_statement(
            db, rfq_id=rfq.id, actor_id=fx["buyer_id"], org_id=org_id
        )
        await db.commit()

        # Award Lot 1 and Lot 2 to Vendor 1 only
        rec = await evaluation_service.recommend_award(
            db,
            cs_id=cs.id,
            awards=[
                AwardRecommendationItem(
                    lot_id=lots[0].id,
                    vendor_id=fx["vendor1_id"],
                    bid_id=bids[0].id,
                    value=Decimal("200000.00"),
                    quantity=Decimal("1.0"),
                    unit_price=Decimal("200000.00"),
                    justification="Lowest landed cost L1",
                ),
                AwardRecommendationItem(
                    lot_id=lots[1].id,
                    vendor_id=fx["vendor1_id"],
                    bid_id=bids[0].id,
                    value=Decimal("180000.00"),
                    quantity=Decimal("1.0"),
                    unit_price=Decimal("180000.00"),
                    justification="Sole lot winner",
                ),
            ],
            justification="L1 vendor selected for contract award",
            actor_id=fx["buyer_id"],
            org_id=org_id,
        )
        await db.commit()

        # Re-fetch CS so relationship is loaded
        loaded_cs = await evaluation_repository.get_cs(db, cs.id, org_id)

        # Dispatch regret letters
        non_awarded, count = await evaluation_service.send_regret_letters(
            db, cs_id=loaded_cs.id, actor_id=fx["buyer_id"], org_id=org_id
        )
        await db.commit()

        # Vendor 1 is awarded; Vendor 2 and Vendor 3 should receive regret letters
        assert fx["vendor1_id"] not in non_awarded
        assert fx["vendor2_id"] in non_awarded
        assert fx["vendor3_id"] in non_awarded
        assert count == 2


@pytest.mark.asyncio
async def test_full_award_approval_flow():
    """Full end-to-end: recommend award -> pending approval -> approve award."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_evaluation_fixtures(db, org_id)
        rfq, bids, lots = await setup_opened_rfq_with_bids(db, org_id, fx)

        cs = await evaluation_service.generate_comparative_statement(
            db, rfq_id=rfq.id, actor_id=fx["buyer_id"], org_id=org_id
        )
        await db.commit()

        # Recommend award
        rec = await evaluation_service.recommend_award(
            db,
            cs_id=cs.id,
            awards=[
                AwardRecommendationItem(
                    lot_id=lots[0].id,
                    vendor_id=fx["vendor1_id"],
                    bid_id=bids[0].id,
                    value=Decimal("200000.00"),
                    justification="L1 on Lot 1",
                ),
                AwardRecommendationItem(
                    lot_id=lots[1].id,
                    vendor_id=fx["vendor2_id"],
                    bid_id=bids[1].id,
                    value=Decimal("150000.00"),
                    justification="L1 on Lot 2",
                ),
            ],
            justification="Split award based on lot-level L1 discovery",
            actor_id=fx["buyer_id"],
            org_id=org_id,
        )
        await db.commit()

        assert rec.status == "PENDING_APPROVAL"
        assert rec.total_awarded_value == Decimal("350000.00")
        assert len(rec.details) == 2

        # Approve award
        approved_rec = await evaluation_service.approve_award(
            db, arn_id=rec.id, actor_id=fx["buyer_id"], org_id=org_id, comments="Approved split award"
        )
        await db.commit()

        assert approved_rec.status == "APPROVED"
        assert approved_rec.approved_by == fx["buyer_id"]
        assert approved_rec.approved_at is not None

        # Re-fetch CS and check status
        updated_cs = await evaluation_repository.get_cs(db, cs.id, org_id)
        assert updated_cs.status == "APPROVED"
