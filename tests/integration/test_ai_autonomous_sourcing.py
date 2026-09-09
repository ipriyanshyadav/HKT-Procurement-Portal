"""
Integration tests for AI-Powered Autonomous Sourcing & Negotiation Copilot:
- Smart RFQ Generator: converts PR line items into structured RFQ lots with pricing anomaly flags
- Converting Smart RFQ draft into real RFQ
- Autonomous Tail-Spend Negotiation Bot: counter-bidding within target budget corridors
- Supplier Recommendation Radar: multi-factor AI scoring (Quality, ESG, Lead Time, Price)
"""

from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.main  # noqa: F401
from app.config import settings
from app.db.enums import VendorStatusEnum
from app.modules.ai_sourcing.schemas import (
    CalculateRadarScoresRequest,
    ConvertDraftToRfqRequest,
    GenerateSmartRfqRequest,
    StartNegotiationSessionRequest,
    SubmitSupplierCounterRequest,
)
from app.modules.ai_sourcing.service import ai_sourcing_service
from app.modules.master_data.models import Category, ItemMaster, UomMaster
from app.modules.organization.models import BusinessUnit, CostCenter
from app.modules.requisition.models import Requisition, RequisitionLine
from app.modules.vendor.models import Vendor

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def seed_ai_sourcing_test_data(db: AsyncSession, org_id):
    user_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, 'AI Sourcing Org', 'AI Sourcing Corp', 'IN', 'INR', '{}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id},
    )
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
        VALUES (:id, :org_id, :email, 'hash', 'Buyer', 'User', 'ACTIVE', 1)
        """),
        {"id": user_id, "org_id": org_id, "email": f"buyer-{user_id.hex[:6]}@sourcing.com"},
    )

    le_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, gstin, country_code)
        VALUES (:id, :org_id, 'Sourcing Legal Entity', :reg, '27ABCDE1234F1Z5', 'IN')
        """),
        {"id": le_id, "org_id": org_id, "reg": f"REG-SRC-{le_id.hex[:4]}"},
    )

    cat = Category(
        id=uuid4(),
        org_id=org_id,
        code=f"CAT-{uuid4().hex[:4].upper()}",
        name="Network Infrastructure",
        level=1,
    )
    uom = UomMaster(
        id=uuid4(),
        org_id=org_id,
        code=f"EA-{uuid4().hex[:3].upper()}",
        name="Each",
    )
    bu = BusinessUnit(
        id=uuid4(),
        org_id=org_id,
        code=f"BU-{uuid4().hex[:4].upper()}",
        name="Infrastructure Operations",
        legal_entity_id=le_id,
    )
    db.add_all([cat, uom, bu])
    await db.flush()

    cc = CostCenter(
        id=uuid4(),
        org_id=org_id,
        code=f"CC-{uuid4().hex[:4].upper()}",
        name="Networking Cost Center",
        business_unit_id=bu.id,
    )
    db.add(cc)
    await db.flush()

    vendor = Vendor(
        id=uuid4(),
        org_id=org_id,
        company_name="Cisco Enterprise Direct",
        legal_name="Cisco Systems Premier Partner",
        primary_email=f"cisco-{uuid4().hex[:6]}@enterprise.com",
        pan="ABCDE1234F",
        performance_score=Decimal("92.00"),
        compliance_score=Decimal("88.00"),
        status=VendorStatusEnum.ACTIVE,
    )
    db.add(vendor)
    await db.commit()

    return user_id, cat.id, uom.id, bu.id, cc.id, vendor.id


@pytest.mark.asyncio
async def test_smart_rfq_generator_and_conversion():
    org_id = uuid4()
    async with TestSession() as db:
        user_id, cat_id, uom_id, bu_id, cc_id, _ = await seed_ai_sourcing_test_data(db, org_id)

        # Baseline catalog item: ₹10,000 standard price
        item = ItemMaster(
            id=uuid4(),
            org_id=org_id,
            code=f"CISCO-{uuid4().hex[:4].upper()}",
            name="Cisco Catalyst 24-Port Gigabit Switch",
            category_id=cat_id,
            uom_id=uom_id,
            standard_price=Decimal("10000.00"),
            currency="INR",
            is_active=True,
        )
        db.add(item)
        await db.flush()

        # PR with an inflated unit price: ₹15,000 (50% above baseline -> should trigger anomaly flag)
        req = Requisition(
            id=uuid4(),
            org_id=org_id,
            pr_number=f"PR-{uuid4().hex[:6].upper()}",
            title="Core Network Switch Upgrade",
            requestor_id=user_id,
            business_unit_id=bu_id,
            cost_center_id=cc_id,
            category_id=cat_id,
            currency="INR",
            estimated_value=Decimal("150000.00"),
        )
        db.add(req)
        await db.flush()

        line = RequisitionLine(
            id=uuid4(),
            org_id=org_id,
            requisition_id=req.id,
            line_number=1,
            item_code=item.code,
            item_description=item.name,
            category_id=cat_id,
            uom_id=uom_id,
            quantity=Decimal("10.0"),
            estimated_unit_price=Decimal("15000.00"),
        )
        db.add(line)
        await db.commit()

        # 1. Generate Smart RFQ
        draft = await ai_sourcing_service.generate_smart_rfq(
            db,
            org_id=org_id,
            payload=GenerateSmartRfqRequest(
                pr_id=req.id,
                title="Q3 Network Refresh Sourcing",
            ),
        )

        assert draft.id is not None
        assert draft.status == "DRAFT"
        assert len(draft.lots) == 1
        assert draft.lots[0]["anomaly_detected"] is True
        assert len(draft.anomaly_flags) >= 1
        assert draft.anomaly_flags[0]["flag_type"] == "HIGH_PRICE_OUTLIER"
        assert draft.anomaly_flags[0]["variance_pct"] == 50.0

        # 2. Convert draft to real RFQ
        converted = await ai_sourcing_service.convert_draft_to_rfq(
            db,
            org_id=org_id,
            user_id=user_id,
            payload=ConvertDraftToRfqRequest(draft_id=draft.id),
        )

        assert converted.rfq_id is not None
        assert converted.rfq_number.startswith("RFQ-")
        assert converted.status == "DRAFT"
        assert converted.lot_count == 1


@pytest.mark.asyncio
async def test_autonomous_tail_spend_negotiation_bot():
    org_id = uuid4()
    async with TestSession() as db:
        user_id, _, _, _, _, vendor_id = await seed_ai_sourcing_test_data(db, org_id)

        # 1. Start autonomous negotiation session
        # Initial supplier quote: ₹50,000, target: ₹40,000, max acceptable ceiling: ₹45,000
        session = await ai_sourcing_service.start_negotiation_session(
            db,
            org_id=org_id,
            payload=StartNegotiationSessionRequest(
                vendor_id=vendor_id,
                item_description="Annual Maintenance Contract for Data Center UPS",
                initial_quote_price=50000.0,
                target_price=40000.0,
                max_acceptable_price=45000.0,
                concession_strategy="BALANCED",
            ),
        )

        assert session.bot_status == "ACTIVE"
        assert session.current_round == 1
        assert len(session.rounds) == 1
        assert session.rounds[0].counter_offer_price == 40000.0

        # 2. Supplier counters with ₹47,000 (above target, bot should calculate intermediate counter)
        session_r2 = await ai_sourcing_service.submit_supplier_counter(
            db,
            org_id=org_id,
            payload=SubmitSupplierCounterRequest(
                session_id=session.id,
                vendor_counter_price=47000.0,
                vendor_message="We can offer 6% discount for annual upfront payment.",
            ),
        )

        assert session_r2.bot_status == "ACTIVE"
        assert session_r2.current_round == 2
        assert len(session_r2.rounds) == 2
        # Intermediate counter should be between 40000 and 45000
        assert 40000.0 < session_r2.rounds[1].counter_offer_price <= 45000.0

        # 3. Supplier accepts and meets target price: ₹39,500 (< ₹40,000 target)
        session_concluded = await ai_sourcing_service.submit_supplier_counter(
            db,
            org_id=org_id,
            payload=SubmitSupplierCounterRequest(
                session_id=session.id,
                vendor_counter_price=39500.0,
                vendor_message="Special volume agreement granted.",
            ),
        )

        assert session_concluded.bot_status == "CONCLUDED_SUCCESS"
        assert session_concluded.savings_achieved == 10500.0  # 50,000 - 39,500
        assert session_concluded.current_bid_price == 39500.0


@pytest.mark.asyncio
async def test_supplier_recommendation_radar():
    org_id = uuid4()
    async with TestSession() as db:
        _, cat_id, _, _, _, vendor_id = await seed_ai_sourcing_test_data(db, org_id)

        # Calculate radar scores
        scores = await ai_sourcing_service.calculate_supplier_radar_scores(
            db,
            org_id=org_id,
            payload=CalculateRadarScoresRequest(category_id=cat_id),
        )

        assert len(scores) >= 1
        v_score = next(s for s in scores if s.vendor_id == vendor_id)
        assert v_score.overall_fit_score >= 80.0
        assert v_score.recommendation_tier in ["PREFERRED", "RECOMMENDED"]
        assert "strengths" in v_score.insights
        assert v_score.quality_score > 80.0
