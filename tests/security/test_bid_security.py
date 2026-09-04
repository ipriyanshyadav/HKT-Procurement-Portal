"""
Security tests for SPEC_10/11 bid visibility enforcement.
Tests: bid sealed before opening, dual-auth enforcement, clarification anonymization.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

import app.main  # noqa: F401
from app.config import settings
from app.core.exceptions import AppException, ForbiddenError, ConflictError, ValidationError
from app.db.enums import RFQStatus, BidStatus
from app.modules.sourcing.service import rfq_service
from app.modules.sourcing.schemas import (
    RfqCreateRequest,
    RfqLotCreateRequest,
    RfqLineCreateRequest,
    ClarificationCreateRequest,
    ClarificationRespondRequest,
    AddParticipantsRequest,
)
from app.modules.bid.service import bid_service
from app.modules.bid.schemas import BidSubmitRequest, BidLineSubmitRequest

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def create_base_fixtures(db: AsyncSession, org_id):
    """Create minimal test data for RFQ/Bid tests."""
    buyer_id = uuid4()
    vendor_id = uuid4()
    co_auth_id = uuid4()
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

    vendor_user_id = uuid4()
    for user_id, email_prefix in [(buyer_id, "buyer"), (co_auth_id, "coauth"), (vendor_user_id, "vendor_user"), (uuid4(), "extra")]:
        await db.execute(
            text("""
            INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
            VALUES (:id, :org_id, :email, 'hash', 'Test', 'User', 'ACTIVE', 1)
            ON CONFLICT (id) DO NOTHING
            """),
            {"id": user_id, "org_id": org_id, "email": f"{email_prefix}-{user_id.hex[:6]}@test.com"},
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
    await db.execute(
        text("""
        INSERT INTO vendors (id, org_id, vendor_code, company_name, primary_email, status, version)
        VALUES (:id, :org_id, :code, 'Test Vendor', :email, 'ACTIVE', 1) ON CONFLICT (id) DO NOTHING
        """),
        {"id": vendor_id, "org_id": org_id, "code": f"V{vendor_id.hex[:6]}", "email": f"vendor-{vendor_id.hex[:6]}@test.com"},
    )
    await db.commit()

    return {
        "buyer_id": buyer_id,
        "co_auth_id": co_auth_id,
        "vendor_id": vendor_id,
        "vendor_user_id": vendor_user_id,
        "bu_id": bu_id,
        "cat_id": cat_id,
        "uom_id": uom_id,
    }


def make_rfq_request(fx: dict, hours_until_close: float = 120.0) -> RfqCreateRequest:
    return RfqCreateRequest(
        title="Test RFQ for Security Tests",
        rfq_type="LIMITED_TENDER",
        business_unit_id=fx["bu_id"],
        category_id=fx["cat_id"],
        bid_close_at=datetime.now(timezone.utc) + timedelta(hours=hours_until_close),
        bid_validity_days=90,
        lines=[
            RfqLineCreateRequest(
                line_number=1,
                item_description="Test Item",
                category_id=fx["cat_id"],
                uom_id=fx["uom_id"],
                quantity=Decimal("10"),
                estimated_unit_price=Decimal("100"),
            )
        ],
    )


def make_bid_request(rfq_line_id) -> BidSubmitRequest:
    return BidSubmitRequest(
        has_deviations=False,
        technical_offer_compliant=True,
        bid_validity_days=90,
        lines=[
            BidLineSubmitRequest(
                rfq_line_id=rfq_line_id,
                unit_price=Decimal("95.00"),
                total_price=Decimal("950.00"),
                currency="INR",
                quantity=Decimal("10"),
                delivery_days=14,
            )
        ],
    )


# ─── TEST: bid visibility blocked pre-opening ──────────────────────────────────

@pytest.mark.asyncio
async def test_bid_visibility_sealed_before_opening():
    """
    CRITICAL SECURITY TEST (SPEC_10 S10-08 / SPEC_11 S11-12):
    Buyer cannot view bid content before bids_opened_at is set.
    Returns ForbiddenError with code BID_SEALED.
    """
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_base_fixtures(db, org_id)

        rfq = await rfq_service.create(db, data=make_rfq_request(fx), actor_id=fx["buyer_id"], org_id=org_id)
        await db.commit()

        from app.modules.sourcing.repository import rfq_repository
        from app.modules.bid.models import BidResponse, BidLineResponse
        from app.core.encryption import encrypt_field

        rfq_loaded = await rfq_repository.get(db, rfq.id, org_id)
        line = rfq_loaded.lines[0]

        bid = BidResponse(
            org_id=org_id,
            rfq_id=rfq.id,
            vendor_id=fx["vendor_id"],
            status=BidStatus.SUBMITTED,
            current_version=1,
            submitted_at=datetime.now(timezone.utc),
            bid_validity_days=90,
        )
        db.add(bid)
        await db.flush()

        bid_line = BidLineResponse(
            org_id=org_id,
            bid_id=bid.id,
            rfq_line_id=line.id,
            unit_price_encrypted=encrypt_field("95.00"),
            total_price_encrypted=encrypt_field("950.00"),
            currency="INR",
            quantity=Decimal("10"),
            delivery_days=14,
            tax_rate_declared=Decimal("0"),
            freight_quoted=Decimal("0"),
        )
        db.add(bid_line)
        await db.commit()

        # Non-vendor buyer tries to access bid before opening
        with pytest.raises(ForbiddenError) as exc_info:
            await bid_service.get_bid_details(
                db,
                bid_id=bid.id,
                actor_id=fx["buyer_id"],
                org_id=org_id,
                actor_vendor_id=None,  # buyer has no vendor_id
            )
        assert exc_info.value.code == "BID_SEALED"


# ─── TEST: Dual-auth same user blocked ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_dual_auth_same_user_blocked():
    """
    SPEC_10 S10-07 / A-10-2: Co-authorizer cannot be same user as initiator.
    """
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_base_fixtures(db, org_id)

        rfq = await rfq_service.create(db, data=make_rfq_request(fx), actor_id=fx["buyer_id"], org_id=org_id)

        # Simulate past deadline
        rfq.bid_close_at = datetime.now(timezone.utc) - timedelta(hours=1)
        rfq.status = RFQStatus.PUBLISHED
        # buyer_id != created_by needed for initiation — set created_by to different user
        rfq.created_by = fx["co_auth_id"]
        await db.flush()
        await db.commit()

        # Step 1: initiate by buyer_id (different from created_by=co_auth_id)
        await rfq_service.initiate_bid_opening(db, rfq_id=rfq.id, actor_id=fx["buyer_id"], org_id=org_id)
        await db.commit()

        # Step 2: try to co-authorize with SAME user (buyer_id) — must fail
        with pytest.raises(ForbiddenError) as exc_info:
            await rfq_service.co_authorize_bid_opening(db, rfq_id=rfq.id, actor_id=fx["buyer_id"], org_id=org_id)
        assert exc_info.value.code == "SAME_USER_OPENING"


# ─── TEST: Clarification broadcast anonymized ──────────────────────────────────

@pytest.mark.asyncio
async def test_clarification_broadcast_anonymous():
    """
    SPEC_10 A-10-3: Clarification broadcast must NOT reveal vendor identity.
    """
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_base_fixtures(db, org_id)

        rfq = await rfq_service.create(db, data=make_rfq_request(fx), actor_id=fx["buyer_id"], org_id=org_id)
        rfq.status = RFQStatus.PUBLISHED
        await db.flush()
        await db.commit()

        clarification = await rfq_service.add_clarification(
            db,
            rfq_id=rfq.id,
            data=ClarificationCreateRequest(question="What is the delivery location?"),
            actor_id=fx["vendor_user_id"],
            org_id=org_id,
            vendor_id=fx["vendor_id"],
        )
        await db.commit()

        assert clarification.asked_by_vendor_id == fx["vendor_id"]

        # When vendor reads clarifications, vendor identity is masked
        clarifications = await rfq_service.get_clarifications(
            db, rfq_id=rfq.id, org_id=org_id, actor_vendor_id=fx["vendor_id"]
        )
        # Clarification not published yet, so vendor sees nothing
        assert len(clarifications) == 0

        # Respond and broadcast
        await rfq_service.respond_to_clarification(
            db,
            clarification_id=clarification.id,
            data=ClarificationRespondRequest(answer="Delivery to Mumbai warehouse.", broadcast=True),
            actor_id=fx["buyer_id"],
            org_id=org_id,
        )
        await db.commit()

        # Now vendor reads again — should see published clarification
        clarifications = await rfq_service.get_clarifications(
            db, rfq_id=rfq.id, org_id=org_id, actor_vendor_id=fx["vendor_id"]
        )
        assert len(clarifications) == 1
        # Vendor identity MUST be masked
        assert clarifications[0].asked_by_vendor_id is None


# ─── TEST: Bid window too short for standard RFQ ───────────────────────────────

@pytest.mark.asyncio
async def test_bid_window_too_short_standard():
    """SPEC_10 S10-05: BID_WINDOW_TOO_SHORT when < 72h for non-emergency RFQ."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_base_fixtures(db, org_id)

        short_window_request = make_rfq_request(fx, hours_until_close=10.0)
        short_window_request.rfq_type = "LIMITED_TENDER"

        with pytest.raises(ValidationError) as exc_info:
            await rfq_service.create(db, data=short_window_request, actor_id=fx["buyer_id"], org_id=org_id)
        assert exc_info.value.code == "BID_WINDOW_TOO_SHORT"


# ─── TEST: Emergency RFQ allows 24h window ─────────────────────────────────────

@pytest.mark.asyncio
async def test_emergency_rfq_24h_allowed():
    """SPEC_10 S10-05: 24h window is allowed for EMERGENCY RFQ."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_base_fixtures(db, org_id)

        emergency_request = make_rfq_request(fx, hours_until_close=25.0)
        emergency_request.rfq_type = "EMERGENCY"

        rfq = await rfq_service.create(db, data=emergency_request, actor_id=fx["buyer_id"], org_id=org_id)
        await db.commit()
        assert rfq.rfq_number is not None
        assert rfq.status.value == "DRAFT"


# ─── TEST: Bid prices encrypted at rest ────────────────────────────────────────

@pytest.mark.asyncio
async def test_bid_prices_encrypted_in_db():
    """SPEC_11 A-11-1: unit_price_encrypted in DB must not be plaintext."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_base_fixtures(db, org_id)

        rfq = await rfq_service.create(db, data=make_rfq_request(fx), actor_id=fx["buyer_id"], org_id=org_id)
        rfq.status = RFQStatus.PUBLISHED
        await db.flush()

        # Add vendor as participant
        from app.modules.sourcing.models import RfqParticipant
        participant = RfqParticipant(
            org_id=org_id,
            rfq_id=rfq.id,
            vendor_id=fx["vendor_id"],
            invitation_status="INVITED",
        )
        db.add(participant)
        await db.flush()
        await db.commit()

        # Load rfq lines
        from app.modules.sourcing.repository import rfq_repository
        rfq = await rfq_repository.get(db, rfq.id, org_id)
        line = rfq.lines[0]

        bid = await bid_service.submit_bid(
            db,
            rfq_id=rfq.id,
            data=make_bid_request(line.id),
            actor_id=fx["vendor_user_id"],
            vendor_id=fx["vendor_id"],
            org_id=org_id,
        )
        await db.commit()

        # Read raw encrypted value from DB
        result = await db.execute(
            text("SELECT unit_price_encrypted FROM bid_line_responses WHERE bid_id = :bid_id LIMIT 1"),
            {"bid_id": bid.id}
        )
        raw = result.scalar_one_or_none()

        assert raw is not None
        assert raw != "95.00"  # Must not be plaintext
        assert raw != "95"
        # Fernet tokens are base64 and start with 'gAAA' typically
        assert len(raw) > 20


# ─── TEST: Late bid rejected ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_late_bid_rejected():
    """SPEC_11 S11-13: Submission after deadline returns ConflictError LATE_BID_REJECTED."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_base_fixtures(db, org_id)

        rfq = await rfq_service.create(db, data=make_rfq_request(fx), actor_id=fx["buyer_id"], org_id=org_id)
        # Set deadline in the past
        rfq.bid_close_at = datetime.now(timezone.utc) - timedelta(hours=1)
        rfq.status = RFQStatus.PUBLISHED
        await db.flush()

        from app.modules.sourcing.models import RfqParticipant
        participant = RfqParticipant(
            org_id=org_id,
            rfq_id=rfq.id,
            vendor_id=fx["vendor_id"],
            invitation_status="INVITED",
        )
        db.add(participant)
        await db.flush()

        from app.modules.sourcing.repository import rfq_repository
        rfq = await rfq_repository.get(db, rfq.id, org_id)
        line = rfq.lines[0] if rfq.lines else None

        # Need at least one line
        if not line:
            from app.modules.sourcing.models import RfqLine
            line = RfqLine(
                org_id=org_id,
                rfq_id=rfq.id,
                line_number=1,
                item_description="Test",
                category_id=fx["cat_id"],
                uom_id=fx["uom_id"],
                quantity=Decimal("10"),
            )
            db.add(line)
            await db.flush()

        await db.commit()

        with pytest.raises(ConflictError) as exc_info:
            await bid_service.submit_bid(
                db,
                rfq_id=rfq.id,
                data=make_bid_request(line.id),
                actor_id=fx["vendor_user_id"],
                vendor_id=fx["vendor_id"],
                org_id=org_id,
            )
        assert exc_info.value.code == "LATE_BID_REJECTED"
