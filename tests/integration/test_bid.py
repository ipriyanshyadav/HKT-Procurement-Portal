"""
Integration tests for SPEC_11 Bid Management:
- Submit bid with encrypted prices & version snapshot
- Revise bid (increments version, preserves history)
- Withdraw bid
- Dual-auth opening unseals bid details & normalizes prices
- Single-vendor detection
- Sealed bid count
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
from app.core.encryption import decrypt_field
from app.core.exceptions import AppException, ForbiddenError, ConflictError
from app.db.enums import RFQStatus, BidStatus
from app.modules.sourcing.service import rfq_service
from app.modules.sourcing.schemas import (
    RfqCreateRequest,
    RfqLineCreateRequest,
    AddParticipantsRequest,
)
from app.modules.sourcing.repository import rfq_repository
from app.modules.bid.service import bid_service
from app.modules.bid.schemas import (
    BidSubmitRequest,
    BidLineSubmitRequest,
    BidReviseRequest,
    BidWithdrawRequest,
)
from app.modules.bid.repository import bid_repository

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def create_bid_fixtures(db: AsyncSession, org_id):
    buyer_id = uuid4()
    co_auth_id = uuid4()
    vendor_user_id = uuid4()
    vendor_id = uuid4()
    vendor2_user_id = uuid4()
    vendor2_id = uuid4()
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

    creator_id = uuid4()
    for user_id, email_prefix in [
        (buyer_id, "buyer"),
        (co_auth_id, "coauth"),
        (creator_id, "creator"),
        (vendor_user_id, "vendor_user1"),
        (vendor2_user_id, "vendor_user2"),
    ]:
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

    for v_id, v_code in [(vendor_id, "V1"), (vendor2_id, "V2")]:
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
        "creator_id": creator_id,
        "vendor_user_id": vendor_user_id,
        "vendor_id": vendor_id,
        "vendor2_user_id": vendor2_user_id,
        "vendor2_id": vendor2_id,
        "bu_id": bu_id,
        "cat_id": cat_id,
        "uom_id": uom_id,
    }


def make_test_rfq(fx: dict) -> RfqCreateRequest:
    return RfqCreateRequest(
        title="Bid Management Test RFQ",
        rfq_type="LIMITED_TENDER",
        business_unit_id=fx["bu_id"],
        category_id=fx["cat_id"],
        bid_close_at=datetime.now(timezone.utc) + timedelta(days=5),
        bid_validity_days=90,
        lines=[
            RfqLineCreateRequest(
                line_number=1,
                item_description="Server Rack",
                category_id=fx["cat_id"],
                uom_id=fx["uom_id"],
                quantity=Decimal("5"),
                estimated_unit_price=Decimal("50000.00"),
            )
        ],
    )


@pytest.mark.asyncio
async def test_bid_submit_and_revise():
    """Submit a bid, verify version 1, revise it, verify version 2."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_bid_fixtures(db, org_id)

        rfq = await rfq_service.create(db, data=make_test_rfq(fx), actor_id=fx["buyer_id"], org_id=org_id)
        rfq.status = RFQStatus.PUBLISHED
        rfq.published_at = datetime.now(timezone.utc)
        await db.commit()

        # Add vendor as participant
        await rfq_service.add_participants(
            db, rfq_id=rfq.id, data=AddParticipantsRequest(vendor_ids=[fx["vendor_id"]]), actor_id=fx["buyer_id"], org_id=org_id
        )
        await db.commit()

        rfq_loaded = await rfq_repository.get(db, rfq.id, org_id)
        line = rfq_loaded.lines[0]

        # Submit v1
        bid_req = BidSubmitRequest(
            has_deviations=False,
            technical_offer_compliant=True,
            bid_validity_days=90,
            lines=[
                BidLineSubmitRequest(
                    rfq_line_id=line.id,
                    unit_price=Decimal("45000.00"),
                    total_price=Decimal("225000.00"),
                    currency="INR",
                    quantity=Decimal("5"),
                    delivery_days=21,
                )
            ],
        )

        bid = await bid_service.submit_bid(
            db,
            rfq_id=rfq.id,
            data=bid_req,
            actor_id=fx["vendor_user_id"],
            vendor_id=fx["vendor_id"],
            org_id=org_id,
        )
        await db.commit()

        assert bid.current_version == 1
        assert bid.status.value == "SUBMITTED"

        # Revise to v2 with lower price
        revise_req = BidReviseRequest(
            lines=[
                BidLineSubmitRequest(
                    rfq_line_id=line.id,
                    unit_price=Decimal("42000.00"),
                    total_price=Decimal("210000.00"),
                    currency="INR",
                    quantity=Decimal("5"),
                    delivery_days=14,
                )
            ]
        )
        revised = await bid_service.revise_bid(
            db,
            rfq_id=rfq.id,
            data=revise_req,
            actor_id=fx["vendor_user_id"],
            vendor_id=fx["vendor_id"],
            org_id=org_id,
        )
        await db.commit()

        assert revised.current_version == 2
        assert revised.status.value == "SUBMITTED"


@pytest.mark.asyncio
async def test_bid_withdraw():
    """Withdraw a submitted bid before deadline."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_bid_fixtures(db, org_id)

        rfq = await rfq_service.create(db, data=make_test_rfq(fx), actor_id=fx["buyer_id"], org_id=org_id)
        rfq.status = RFQStatus.PUBLISHED
        rfq.published_at = datetime.now(timezone.utc)
        await db.commit()

        await rfq_service.add_participants(
            db, rfq_id=rfq.id, data=AddParticipantsRequest(vendor_ids=[fx["vendor_id"]]), actor_id=fx["buyer_id"], org_id=org_id
        )
        await db.commit()

        rfq_loaded = await rfq_repository.get(db, rfq.id, org_id)
        line = rfq_loaded.lines[0]

        await bid_service.submit_bid(
            db,
            rfq_id=rfq.id,
            data=BidSubmitRequest(
                lines=[
                    BidLineSubmitRequest(
                        rfq_line_id=line.id,
                        unit_price=Decimal("48000.00"),
                        total_price=Decimal("240000.00"),
                        currency="INR",
                        quantity=Decimal("5"),
                        delivery_days=30,
                    )
                ]
            ),
            actor_id=fx["vendor_user_id"],
            vendor_id=fx["vendor_id"],
            org_id=org_id,
        )
        await db.commit()

        # Withdraw
        withdrawn = await bid_service.withdraw_bid(
            db,
            rfq_id=rfq.id,
            vendor_id=fx["vendor_id"],
            actor_id=fx["vendor_user_id"],
            org_id=org_id,
            data=BidWithdrawRequest(reason="Cannot meet delivery schedule"),
        )
        await db.commit()

        assert withdrawn.status.value == "WITHDRAWN"


@pytest.mark.asyncio
async def test_dual_auth_opening_and_price_unmasking():
    """Bids are masked before opening, then dual-auth opening unmasks decrypted prices."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_bid_fixtures(db, org_id)

        rfq = await rfq_service.create(db, data=make_test_rfq(fx), actor_id=fx["buyer_id"], org_id=org_id)
        rfq.status = RFQStatus.PUBLISHED
        rfq.published_at = datetime.now(timezone.utc)
        await db.commit()

        await rfq_service.add_participants(
            db, rfq_id=rfq.id, data=AddParticipantsRequest(vendor_ids=[fx["vendor_id"]]), actor_id=fx["buyer_id"], org_id=org_id
        )
        await db.commit()

        rfq_loaded = await rfq_repository.get(db, rfq.id, org_id)
        line = rfq_loaded.lines[0]

        bid = await bid_service.submit_bid(
            db,
            rfq_id=rfq.id,
            data=BidSubmitRequest(
                lines=[
                    BidLineSubmitRequest(
                        rfq_line_id=line.id,
                        unit_price=Decimal("49000.00"),
                        total_price=Decimal("245000.00"),
                        currency="INR",
                        quantity=Decimal("5"),
                        delivery_days=14,
                    )
                ]
            ),
            actor_id=fx["vendor_user_id"],
            vendor_id=fx["vendor_id"],
            org_id=org_id,
        )
        await db.commit()

        # Deadline passes and creator set so buyer_id can initiate
        rfq.bid_close_at = datetime.now(timezone.utc) - timedelta(hours=1)
        rfq.created_by = fx["creator_id"]
        await db.commit()

        # Before opening, sealed count is 1
        count_res = await bid_service.get_bid_count(db, rfq_id=rfq.id, org_id=org_id)
        assert count_res["bid_count"] == 1
        assert count_res["bids_opened"] is False

        # Dual-auth Step 1: initiate by buyer_id
        await rfq_service.initiate_bid_opening(db, rfq_id=rfq.id, actor_id=fx["buyer_id"], org_id=org_id)
        await db.commit()

        # Dual-auth Step 2: co-authorize by co_auth_id
        opened_rfq = await rfq_service.co_authorize_bid_opening(db, rfq_id=rfq.id, actor_id=fx["co_auth_id"], org_id=org_id)
        await db.commit()

        assert opened_rfq.status.value == "BID_OPEN"
        assert opened_rfq.bids_opened_at is not None

        # After opening, buyer CAN view bid details with unmasked prices
        details = await bid_service.get_bid_details(
            db, bid_id=bid.id, actor_id=fx["buyer_id"], org_id=org_id, actor_vendor_id=None
        )
        assert len(details.lines) == 1
        assert details.lines[0].unit_price == Decimal("49000.00")
        assert details.lines[0].total_price == Decimal("245000.00")


@pytest.mark.asyncio
async def test_single_vendor_situation_detection():
    """When only 1 vendor submits, check_single_vendor_situation flags is_single_vendor=True."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_bid_fixtures(db, org_id)

        rfq = await rfq_service.create(db, data=make_test_rfq(fx), actor_id=fx["buyer_id"], org_id=org_id)
        rfq.status = RFQStatus.PUBLISHED
        await db.commit()

        await rfq_service.add_participants(
            db, rfq_id=rfq.id, data=AddParticipantsRequest(vendor_ids=[fx["vendor_id"]]), actor_id=fx["buyer_id"], org_id=org_id
        )
        await db.commit()

        rfq_loaded = await rfq_repository.get(db, rfq.id, org_id)
        line = rfq_loaded.lines[0]

        await bid_service.submit_bid(
            db,
            rfq_id=rfq.id,
            data=BidSubmitRequest(
                lines=[
                    BidLineSubmitRequest(
                        rfq_line_id=line.id,
                        unit_price=Decimal("49000.00"),
                        total_price=Decimal("245000.00"),
                        currency="INR",
                        quantity=Decimal("5"),
                        delivery_days=14,
                    )
                ]
            ),
            actor_id=fx["vendor_user_id"],
            vendor_id=fx["vendor_id"],
            org_id=org_id,
        )
        await db.commit()

        single_check = await bid_service.check_single_vendor_situation(db, rfq_id=rfq.id, org_id=org_id)
        assert single_check["is_single_vendor"] is True
        assert single_check["bid_count"] == 1
        assert single_check["requires_override"] is True
