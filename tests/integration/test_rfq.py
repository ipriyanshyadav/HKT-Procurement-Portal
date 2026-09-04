"""
Integration tests for SPEC_10 RFQ Lifecycle:
- Creation, validation, lot/line management
- Participant addition & removal
- FSM transitions: DRAFT -> PENDING_APPROVAL -> APPROVED -> PUBLISHED -> BID_OPEN -> BIDS_OPENED
- Amendments and deadline extension
- Celery auto-close task check_bid_windows
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
from app.core.exceptions import AppException, ConflictError, ValidationError, NotFoundError
from app.db.enums import RFQStatus
from app.modules.sourcing.fsm import validate_rfq_transition, InvalidRfqTransitionError
from app.modules.sourcing.service import rfq_service
from app.modules.sourcing.schemas import (
    RfqCreateRequest,
    RfqLotCreateRequest,
    RfqLineCreateRequest,
    RfqUpdateRequest,
    AddParticipantsRequest,
    AmendRequest,
    CancelRequest,
    ExtendDeadlineRequest,
)
from app.modules.sourcing.repository import rfq_repository, rfq_participant_repository
from app.tasks.rfq_lifecycle import _async_check_bid_windows

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def create_rfq_fixtures(db: AsyncSession, org_id):
    buyer_id = uuid4()
    co_auth_id = uuid4()
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

    for user_id, email_prefix in [(buyer_id, "buyer"), (co_auth_id, "coauth")]:
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

    for v_id, v_code in [(vendor1_id, "V1"), (vendor2_id, "V2"), (vendor3_id, "V3")]:
        await db.execute(
            text("""
            INSERT INTO vendors (id, org_id, vendor_code, company_name, primary_email, status, version)
            VALUES (:id, :org_id, :code, 'Test Vendor', :email, 'ACTIVE', 1) ON CONFLICT (id) DO NOTHING
            """),
            {"id": v_id, "org_id": org_id, "code": f"{v_code}{v_id.hex[:6]}", "email": f"vendor-{v_id.hex[:6]}@test.com"},
        )

    await db.commit()

    return {
        "buyer_id": buyer_id,
        "co_auth_id": co_auth_id,
        "vendor1_id": vendor1_id,
        "vendor2_id": vendor2_id,
        "vendor3_id": vendor3_id,
        "bu_id": bu_id,
        "cat_id": cat_id,
        "uom_id": uom_id,
    }


def sample_rfq_req(fx: dict, days_ahead: int = 5) -> RfqCreateRequest:
    return RfqCreateRequest(
        title="Procurement of Laptops 2026",
        description="Annual IT Hardware Sourcing",
        rfq_type="LIMITED_TENDER",
        sourcing_type="GOODS",
        evaluation_type="L1_PRICE_ONLY",
        procurement_type="OPEX",
        business_unit_id=fx["bu_id"],
        category_id=fx["cat_id"],
        currency="INR",
        estimated_value=Decimal("500000.00"),
        bid_close_at=datetime.now(timezone.utc) + timedelta(days=days_ahead),
        bid_validity_days=90,
        is_multi_lot=True,
        lots=[
            RfqLotCreateRequest(
                title="Lot 1: Developer Laptops",
                estimated_value=Decimal("300000.00"),
            ),
            RfqLotCreateRequest(
                title="Lot 2: Standard Laptops",
                estimated_value=Decimal("200000.00"),
            ),
        ],
        lines=[
            RfqLineCreateRequest(
                line_number=1,
                item_description="16-inch MacBooks",
                category_id=fx["cat_id"],
                uom_id=fx["uom_id"],
                quantity=Decimal("10"),
                estimated_unit_price=Decimal("30000.00"),
            ),
            RfqLineCreateRequest(
                line_number=2,
                item_description="14-inch ThinkPads",
                category_id=fx["cat_id"],
                uom_id=fx["uom_id"],
                quantity=Decimal("20"),
                estimated_unit_price=Decimal("10000.00"),
            ),
        ],
    )


@pytest.mark.asyncio
async def test_rfq_creation_and_lines_lots():
    """Verify RFQ creation with multi-lot, line items, and auto-generated RFQ number."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_rfq_fixtures(db, org_id)
        rfq = await rfq_service.create(db, data=sample_rfq_req(fx), actor_id=fx["buyer_id"], org_id=org_id)
        await db.commit()

        rfq_loaded = await rfq_repository.get(db, rfq.id, org_id)
        assert rfq_loaded is not None
        assert "RFQ-2026-" in rfq_loaded.rfq_number
        assert rfq_loaded.status.value == "DRAFT"
        assert len(rfq_loaded.lots) == 2
        assert len(rfq_loaded.lines) == 2


@pytest.mark.asyncio
async def test_rfq_participant_management():
    """Add and remove participants in DRAFT status."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_rfq_fixtures(db, org_id)
        rfq = await rfq_service.create(db, data=sample_rfq_req(fx), actor_id=fx["buyer_id"], org_id=org_id)
        await db.commit()

        # Add 3 participants
        added = await rfq_service.add_participants(
            db,
            rfq_id=rfq.id,
            data=AddParticipantsRequest(vendor_ids=[fx["vendor1_id"], fx["vendor2_id"], fx["vendor3_id"]]),
            actor_id=fx["buyer_id"],
            org_id=org_id,
        )
        await db.commit()
        assert len(added) == 3

        all_p = await rfq_participant_repository.get_all(db, rfq.id, org_id)
        assert len(all_p) == 3

        # Remove 1 participant
        await rfq_service.remove_participant(
            db, rfq_id=rfq.id, vendor_id=fx["vendor3_id"], actor_id=fx["buyer_id"], org_id=org_id
        )
        await db.commit()

        p3 = await rfq_participant_repository.get_by_vendor(db, rfq.id, fx["vendor3_id"], org_id)
        assert p3 is None


@pytest.mark.asyncio
async def test_rfq_publish_requires_min_participants():
    """Publishing a LIMITED_TENDER requires at least MIN_CLOSED_RFQ_PARTICIPANTS."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_rfq_fixtures(db, org_id)
        rfq = await rfq_service.create(db, data=sample_rfq_req(fx), actor_id=fx["buyer_id"], org_id=org_id)
        # Advance to APPROVED
        rfq.status = RFQStatus.APPROVED
        await db.commit()

        # With 0 participants, publish must fail
        with pytest.raises(ValidationError) as exc:
            await rfq_service.publish(db, rfq_id=rfq.id, actor_id=fx["buyer_id"], org_id=org_id)
        assert exc.value.code == "INSUFFICIENT_PARTICIPANTS"

        # Add 3 participants
        await rfq_service.add_participants(
            db,
            rfq_id=rfq.id,
            data=AddParticipantsRequest(vendor_ids=[fx["vendor1_id"], fx["vendor2_id"], fx["vendor3_id"]]),
            actor_id=fx["buyer_id"],
            org_id=org_id,
        )
        await db.commit()

        # Now publish should succeed
        pub_rfq = await rfq_service.publish(db, rfq_id=rfq.id, actor_id=fx["buyer_id"], org_id=org_id)
        await db.commit()
        assert pub_rfq.status.value == "PUBLISHED"
        assert pub_rfq.published_at is not None


@pytest.mark.asyncio
async def test_rfq_amendment_and_deadline_extension():
    """Amend an RFQ, update close date, and extend deadline."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_rfq_fixtures(db, org_id)
        rfq = await rfq_service.create(db, data=sample_rfq_req(fx), actor_id=fx["buyer_id"], org_id=org_id)
        rfq.status = RFQStatus.PUBLISHED
        rfq.published_at = datetime.now(timezone.utc)
        await db.commit()

        new_close = datetime.now(timezone.utc) + timedelta(days=10)
        amended = await rfq_service.amend(
            db,
            rfq_id=rfq.id,
            data=AmendRequest(
                changes_summary="Extended delivery date specifications",
                new_bid_close_at=new_close,
                field_changes={"specifications": "Updated to M3 Pro chips"},
            ),
            actor_id=fx["buyer_id"],
            org_id=org_id,
        )
        await db.commit()
        assert amended.amendment_count == 1
        assert amended.status.value == "AMENDMENT_PENDING"

        # Extend deadline further
        further_close = datetime.now(timezone.utc) + timedelta(days=14)
        extended = await rfq_service.extend_deadline(
            db,
            rfq_id=rfq.id,
            data=ExtendDeadlineRequest(new_bid_close_at=further_close, reason="Supplier request for extension"),
            actor_id=fx["buyer_id"],
            org_id=org_id,
        )
        await db.commit()
        assert extended.bid_close_at == further_close


@pytest.mark.asyncio
async def test_rfq_auto_close_task():
    """Celery task _async_check_bid_windows auto-cancels RFQs with NO_BIDS if deadline passed."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_rfq_fixtures(db, org_id)
        rfq = await rfq_service.create(db, data=sample_rfq_req(fx), actor_id=fx["buyer_id"], org_id=org_id)
        rfq.status = RFQStatus.PUBLISHED
        rfq.bid_close_at = datetime.now(timezone.utc) - timedelta(hours=2)
        await db.commit()

        # Run background check
        res = await _async_check_bid_windows(session_factory=TestSession)
        assert res["rfqs_processed"] >= 1

        await db.refresh(rfq)
        assert rfq.status.value == "NO_BIDS"
        assert rfq.cancel_reason == "NO_BIDS_RECEIVED"
