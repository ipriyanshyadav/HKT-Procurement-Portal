"""
Integration tests for SPEC_11B Live / Reverse Auction Bidding:
1. Auction FSM invalid transition
2. Bid rejected when decrement is too small
3. Bid above reserve price rejected silently
4. Auto-extension triggered by late bid (anti-sniping)
5. Auto-extension capped at max_extensions
6. Rank computation (L1 is lowest price)
7. Proxy bid auto-fires on displacement
8. Proxy bid respects configured floor price
9. Close auction persists winning bids to bid_line_responses with source=LIVE_AUCTION
10. CS generation works with LIVE_AUCTION-sourced bids
11. Bid sequence is monotonic and unique
12. WebSocket broadcast and vendor rank update on new bid
13. No bid accepted after auction is closed
14. Full auction lifecycle logs audit events
"""
from __future__ import annotations
import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import text, select
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

import app.main  # noqa: F401
from app.config import settings
from app.core.exceptions import AppException, ForbiddenError, ValidationError
from app.db.enums import AuditEntityType, BiddingMode, RFQStatus
from app.modules.audit.models import AuditLog
from app.modules.bid.auction_fsm import validate_auction_transition
from app.modules.bid.live_bid_service import LiveBidService
from app.modules.bid.models import (
    LiveAuction,
    LiveBid,
    AuctionParticipant,
    BidResponse,
    BidLineResponse,
)
from app.modules.bid.schemas import AuctionConfig, AuctionCreateRequest
from app.modules.sourcing.models import Rfq, RfqLine, RfqLot
from app.modules.sourcing.schemas import (
    RfqCreateRequest,
    RfqLineCreateRequest,
    AddParticipantsRequest,
)
from app.modules.sourcing.service import rfq_service

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def create_live_auction_fixtures(db: AsyncSession, org_id):
    buyer_id = uuid4()
    vendor1_user_id = uuid4()
    vendor1_id = uuid4()
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

    for user_id, email_prefix in [
        (buyer_id, "buyer"),
        (vendor1_user_id, "vuser1"),
        (vendor2_user_id, "vuser2"),
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

    for v_id, v_code, name in [
        (vendor1_id, "V1", "Vendor Alpha"),
        (vendor2_id, "V2", "Vendor Beta"),
    ]:
        await db.execute(
            text("""
            INSERT INTO vendors (id, org_id, vendor_code, company_name, primary_email, status, version)
            VALUES (:id, :org_id, :code, :name, :email, 'ACTIVE', 1) ON CONFLICT (id) DO NOTHING
            """),
            {"id": v_id, "org_id": org_id, "code": f"{v_code}{v_id.hex[:6]}", "name": name, "email": f"vendor-{v_id.hex[:6]}@test.com"},
        )

    await db.commit()

    return {
        "buyer_id": buyer_id,
        "vendor1_user_id": vendor1_user_id,
        "vendor1_id": vendor1_id,
        "vendor2_user_id": vendor2_user_id,
        "vendor2_id": vendor2_id,
        "bu_id": bu_id,
        "cat_id": cat_id,
        "uom_id": uom_id,
    }


async def setup_auction_with_rfq(
    db: AsyncSession,
    fx: dict,
    org_id,
    config: Optional[AuctionConfig] = None,
    open_now: bool = True,
):
    rfq_req = RfqCreateRequest(
        title="Live Auction Test Tender",
        rfq_type="LIMITED_TENDER",
        business_unit_id=fx["bu_id"],
        category_id=fx["cat_id"],
        bid_close_at=datetime.now(timezone.utc) + timedelta(days=5),
        bid_validity_days=90,
        lines=[
            RfqLineCreateRequest(
                line_number=1,
                item_description="Industrial Valve",
                category_id=fx["cat_id"],
                uom_id=fx["uom_id"],
                quantity=Decimal("10"),
                estimated_unit_price=Decimal("10000.00"),
            )
        ],
    )
    rfq = await rfq_service.create(db, data=rfq_req, actor_id=fx["buyer_id"], org_id=org_id)
    rfq.bidding_mode = BiddingMode.LIVE_AUCTION
    rfq.status = RFQStatus.PUBLISHED
    rfq.published_at = datetime.now(timezone.utc)
    await db.commit()

    # Add participants
    await rfq_service.add_participants(
        db,
        rfq_id=rfq.id,
        data=AddParticipantsRequest(vendor_ids=[fx["vendor1_id"], fx["vendor2_id"]]),
        actor_id=fx["buyer_id"],
        org_id=org_id,
    )
    await db.commit()

    # Create lot
    lot = RfqLot(
        id=uuid4(),
        org_id=org_id,
        rfq_id=rfq.id,
        lot_number=1,
        title="Lot 1 - Industrial Equipment",
        estimated_value=Decimal("100000.00"),
    )
    db.add(lot)
    await db.flush()

    rfq_line = rfq.lines[0]
    rfq_line.lot_id = lot.id
    await db.commit()

    service = LiveBidService()
    now = datetime.now(timezone.utc)
    if config is None:
        config = AuctionConfig(
            auction_start_at=now,
            auction_duration_minutes=60,
            lot_ids=[lot.id],
            min_decrement_type="ABSOLUTE",
            min_decrement_value=Decimal("1000.00"),
            reserve_price_inr=Decimal("100000.00"),
            auto_extend=True,
            auto_extend_trigger_minutes=5,
            auto_extend_duration_minutes=10,
            max_extensions=3,
            allow_proxy_bid=True,
        )

    actor_buyer = SimpleNamespace(id=fx["buyer_id"])
    auction = await service.create_auction(
        db,
        AuctionCreateRequest(rfq_id=rfq.id, config=config),
        actor=actor_buyer,
        org_id=org_id,
    )

    if open_now:
        auction.status = "OPEN"
        auction.actual_start_at = now
        await db.commit()

    return rfq, lot, auction, service


@pytest.mark.asyncio
async def test_auction_fsm_invalid_transition():
    """1. CLOSED → OPEN transition raises INVALID_AUCTION_STATE_TRANSITION."""
    with pytest.raises(AppException) as exc_info:
        validate_auction_transition("CLOSED", "OPEN")
    assert exc_info.value.code == "INVALID_AUCTION_STATE_TRANSITION"


@pytest.mark.asyncio
async def test_bid_rejected_decrement_too_small():
    """2. Bid above min decrement threshold returns ValidationError DECREMENT_TOO_SMALL."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, service = await setup_auction_with_rfq(db, fx, org_id)

        actor_v1 = SimpleNamespace(id=fx["vendor1_user_id"], vendor_id=fx["vendor1_id"])
        actor_v2 = SimpleNamespace(id=fx["vendor2_user_id"], vendor_id=fx["vendor2_id"])

        # First bid by V1: 90000 INR
        bid1 = await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("90000.00"), actor_v1, org_id
        )
        assert bid1.is_valid is True

        # V2 tries to bid 89500 (decrement is 1000, so max allowed is 89000)
        with pytest.raises(ValidationError) as exc_info:
            await service.submit_live_bid(
                db, auction.id, lot.id, Decimal("89500.00"), actor_v2, org_id
            )
        assert exc_info.value.code == "DECREMENT_TOO_SMALL"


@pytest.mark.asyncio
async def test_bid_above_reserve_price_rejected_silently():
    """3. Bid above reserve is stored is_valid=False; reason masked in notifications."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, service = await setup_auction_with_rfq(db, fx, org_id)

        actor_v1 = SimpleNamespace(id=fx["vendor1_user_id"], vendor_id=fx["vendor1_id"])

        # Reserve price is 100000 INR. V1 bids 105000 INR.
        bid = await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("105000.00"), actor_v1, org_id
        )
        assert bid.is_valid is False
        assert bid.invalidation_reason == "ABOVE_RESERVE_PRICE"

        # Check that it is NOT considered for L1 best bid
        best = await service.live_bid_repo.get_auction_best_bid(db, auction.id, lot.id, org_id)
        assert best is None


@pytest.mark.asyncio
async def test_auto_extension_triggered():
    """4. Bid within auto_extend_trigger_minutes extends close time and increments extension_count."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, service = await setup_auction_with_rfq(db, fx, org_id)

        # Set close_at to 3 minutes from now (trigger is 5 minutes)
        now = datetime.now(timezone.utc)
        original_close = now + timedelta(minutes=3)
        auction.current_close_at = original_close
        auction.extension_count = 0
        await db.commit()

        actor_v1 = SimpleNamespace(id=fx["vendor1_user_id"], vendor_id=fx["vendor1_id"])
        await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("85000.00"), actor_v1, org_id
        )
        await db.refresh(auction)

        assert auction.extension_count == 1
        assert auction.status == "EXTENDED"
        assert auction.current_close_at > original_close


@pytest.mark.asyncio
async def test_auto_extension_capped_at_max():
    """5. Extension count >= max_extensions: no further extension on late bid."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, service = await setup_auction_with_rfq(db, fx, org_id)

        now = datetime.now(timezone.utc)
        close_time = now + timedelta(minutes=2)
        auction.current_close_at = close_time
        auction.extension_count = 3  # max_extensions is 3
        await db.commit()

        actor_v1 = SimpleNamespace(id=fx["vendor1_user_id"], vendor_id=fx["vendor1_id"])
        await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("80000.00"), actor_v1, org_id
        )
        await db.refresh(auction)

        assert auction.extension_count == 3
        assert auction.current_close_at == close_time


@pytest.mark.asyncio
async def test_rank_computation_l1_is_lowest():
    """6. Vendor with lowest valid bid per lot gets rank=1."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, service = await setup_auction_with_rfq(db, fx, org_id)

        actor_v1 = SimpleNamespace(id=fx["vendor1_user_id"], vendor_id=fx["vendor1_id"])
        actor_v2 = SimpleNamespace(id=fx["vendor2_user_id"], vendor_id=fx["vendor2_id"])

        await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("90000.00"), actor_v1, org_id
        )
        await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("85000.00"), actor_v2, org_id
        )

        ranks = await service._compute_ranks(db, auction.id, lot.id, org_id)
        assert len(ranks) == 2
        assert ranks[0]["rank"] == 1
        assert ranks[0]["vendor_id"] == str(fx["vendor2_id"])
        assert ranks[0]["bid_amount_inr"] == Decimal("85000.00")

        assert ranks[1]["rank"] == 2
        assert ranks[1]["vendor_id"] == str(fx["vendor1_id"])
        assert ranks[1]["bid_amount_inr"] == Decimal("90000.00")


@pytest.mark.asyncio
async def test_proxy_bid_auto_fires():
    """7. Vendor with proxy floor auto-bids when displaced from L1."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, service = await setup_auction_with_rfq(db, fx, org_id)

        actor_v1 = SimpleNamespace(id=fx["vendor1_user_id"], vendor_id=fx["vendor1_id"])
        actor_v2 = SimpleNamespace(id=fx["vendor2_user_id"], vendor_id=fx["vendor2_id"])

        # Vendor 1 sets proxy floor of 70000 INR
        await service.set_proxy_floor(
            db, auction.id, lot.id, Decimal("70000.00"), actor_v1, org_id
        )

        # Vendor 1 places initial bid of 90000 INR
        await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("90000.00"), actor_v1, org_id
        )

        # Vendor 2 bids 85000 INR -> triggers V1's proxy to counter at 84000 INR!
        await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("85000.00"), actor_v2, org_id
        )

        # Check that V1 auto-countered and is now L1
        ranks = await service._compute_ranks(db, auction.id, lot.id, org_id)
        assert ranks[0]["rank"] == 1
        assert ranks[0]["vendor_id"] == str(fx["vendor1_id"])
        assert ranks[0]["bid_amount_inr"] == Decimal("84000.00")


@pytest.mark.asyncio
async def test_proxy_bid_respects_floor():
    """8. Proxy does not bid below proxy_floor_inr."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, service = await setup_auction_with_rfq(db, fx, org_id)

        actor_v1 = SimpleNamespace(id=fx["vendor1_user_id"], vendor_id=fx["vendor1_id"])
        actor_v2 = SimpleNamespace(id=fx["vendor2_user_id"], vendor_id=fx["vendor2_id"])

        # Vendor 1 sets proxy floor of 80000 INR
        await service.set_proxy_floor(
            db, auction.id, lot.id, Decimal("80000.00"), actor_v1, org_id
        )

        # Vendor 1 places initial bid of 90000 INR
        await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("90000.00"), actor_v1, org_id
        )

        # Vendor 2 bids 79000 INR (below V1's proxy floor of 80000)
        await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("79000.00"), actor_v2, org_id
        )

        # V1 proxy must NOT fire below 80000; V2 remains L1 at 79000
        ranks = await service._compute_ranks(db, auction.id, lot.id, org_id)
        assert ranks[0]["rank"] == 1
        assert ranks[0]["vendor_id"] == str(fx["vendor2_id"])
        assert ranks[0]["bid_amount_inr"] == Decimal("79000.00")


@pytest.mark.asyncio
async def test_close_auction_persists_winning_bids():
    """9. close_auction() writes bid_line_responses with source=LIVE_AUCTION and normalized_price_inr set."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, service = await setup_auction_with_rfq(db, fx, org_id)

        actor_v1 = SimpleNamespace(id=fx["vendor1_user_id"], vendor_id=fx["vendor1_id"])
        actor_v2 = SimpleNamespace(id=fx["vendor2_user_id"], vendor_id=fx["vendor2_id"])

        await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("90000.00"), actor_v1, org_id
        )
        await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("82000.00"), actor_v2, org_id
        )

        # Close auction
        closed_auction = await service.close_auction(db, auction.id, org_id)
        assert closed_auction.status == "CLOSED"
        assert closed_auction.winner_vendor_id == fx["vendor2_id"]

        # Verify persisted rows in bid_line_responses
        res = await db.execute(
            select(BidLineResponse).where(BidLineResponse.rfq_line_id == rfq.lines[0].id)
        )
        line_responses = res.scalars().all()
        assert len(line_responses) >= 1

        winning_line = next(lr for lr in line_responses if lr.normalized_price_inr == Decimal("82000.00"))
        assert winning_line.remarks == "source=LIVE_AUCTION"
        assert winning_line.normalized_price_inr == Decimal("82000.00")
        assert winning_line.exchange_rate_used == Decimal("1.0")


@pytest.mark.asyncio
async def test_cs_generation_works_with_live_auction_bids():
    """10. Evaluation / Comparative statement queries operate successfully on LIVE_AUCTION-sourced bids."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, service = await setup_auction_with_rfq(db, fx, org_id)

        actor_v2 = SimpleNamespace(id=fx["vendor2_user_id"], vendor_id=fx["vendor2_id"])
        await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("75000.00"), actor_v2, org_id
        )

        await service.close_auction(db, auction.id, org_id)

        # Verify that bid_responses and bid_line_responses queryable by RFQ id
        res = await db.execute(
            select(BidResponse).where(BidResponse.rfq_id == rfq.id)
        )
        bid_responses = res.scalars().all()
        assert len(bid_responses) > 0

        # Verify line response details for evaluation CS calculations
        line_res = await db.execute(
            select(BidLineResponse).join(BidResponse).where(BidResponse.rfq_id == rfq.id)
        )
        lines = line_res.scalars().all()
        assert any(l.normalized_price_inr == Decimal("75000.00") and l.remarks == "source=LIVE_AUCTION" for l in lines)


@pytest.mark.asyncio
async def test_bid_sequence_monotonic():
    """11. Bid submissions yield unique, monotonically increasing bid_sequence values."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, service = await setup_auction_with_rfq(db, fx, org_id)

        actor_v1 = SimpleNamespace(id=fx["vendor1_user_id"], vendor_id=fx["vendor1_id"])
        actor_v2 = SimpleNamespace(id=fx["vendor2_user_id"], vendor_id=fx["vendor2_id"])

        bid1 = await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("90000.00"), actor_v1, org_id
        )
        bid2 = await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("88000.00"), actor_v2, org_id
        )
        bid3 = await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("86000.00"), actor_v1, org_id
        )

        assert bid1.bid_sequence < bid2.bid_sequence < bid3.bid_sequence
        assert len({bid1.bid_sequence, bid2.bid_sequence, bid3.bid_sequence}) == 3


@pytest.mark.asyncio
async def test_websocket_broadcast_on_new_bid():
    """12. Valid bid triggers LEADERBOARD_UPDATE broadcast + RANK_UPDATE to submitting vendor."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, service = await setup_auction_with_rfq(db, fx, org_id)

        actor_v1 = SimpleNamespace(id=fx["vendor1_user_id"], vendor_id=fx["vendor1_id"])

        broadcast_mock = AsyncMock()
        send_to_vendor_mock = AsyncMock()
        service._broadcast = broadcast_mock
        service._send_to_vendor = send_to_vendor_mock

        await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("89000.00"), actor_v1, org_id
        )

        # Verify broadcast was called with LEADERBOARD_UPDATE and NEW_BID
        assert broadcast_mock.called
        broadcast_types = [call[0][2]["type"] for call in broadcast_mock.call_args_list]
        assert "LEADERBOARD_UPDATE" in broadcast_types
        assert "NEW_BID" in broadcast_types

        # Verify rank update was sent to vendor
        assert send_to_vendor_mock.called
        vendor_call_args = send_to_vendor_mock.call_args[0]
        assert vendor_call_args[1] == fx["vendor1_id"]
        assert vendor_call_args[2]["type"] == "RANK_UPDATE"
        assert vendor_call_args[2]["payload"]["your_rank"] == 1


@pytest.mark.asyncio
async def test_no_bid_after_auction_closed():
    """13. submit_live_bid after current_close_at raises AppException AUCTION_CLOSED."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, service = await setup_auction_with_rfq(db, fx, org_id)

        # Set close_at 5 minutes in the past
        past_close = datetime.now(timezone.utc) - timedelta(minutes=5)
        auction.current_close_at = past_close
        await db.commit()

        actor_v1 = SimpleNamespace(id=fx["vendor1_user_id"], vendor_id=fx["vendor1_id"])
        with pytest.raises(AppException) as exc_info:
            await service.submit_live_bid(
                db, auction.id, lot.id, Decimal("85000.00"), actor_v1, org_id
            )
        assert exc_info.value.code == "AUCTION_CLOSED"


@pytest.mark.asyncio
async def test_audit_events_count():
    """14. Full auction lifecycle logs required audit event codes."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, service = await setup_auction_with_rfq(
            db, fx, org_id, open_now=False
        )

        # Open auction
        await service.open_auction(db, auction.id, org_id)

        # Bid
        actor_v1 = SimpleNamespace(id=fx["vendor1_user_id"], vendor_id=fx["vendor1_id"])
        await service.submit_live_bid(
            db, auction.id, lot.id, Decimal("90000.00"), actor_v1, org_id
        )

        # Close
        await service.close_auction(db, auction.id, org_id)

        # Query audit logs for this auction
        res = await db.execute(
            select(AuditLog).where(AuditLog.entity_id == auction.id)
        )
        logs = res.scalars().all()
        actions = [log.action for log in logs]

        assert "AUCTION_CREATED" in actions
        assert "AUCTION_OPENED" in actions
        assert "BID_SUBMITTED" in actions
        assert "AUCTION_CLOSED" in actions


@pytest.mark.asyncio
async def test_list_and_get_auctions_enrich_rfq_number_and_title():
    """Verify list_auctions and get_auction enrich LiveAuction models with rfq_number and rfq_title."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, service = await setup_auction_with_rfq(db, fx, org_id)

        buyer_actor = SimpleNamespace(id=fx["buyer_id"], org_id=org_id)
        assert auction.rfq_number == rfq.rfq_number
        assert auction.rfq_title == rfq.title

        # Test get_auction
        fetched = await service.get_auction(db, auction.id, org_id)
        assert fetched is not None
        assert fetched.rfq_number == rfq.rfq_number
        assert fetched.rfq_title == rfq.title

        # Test list_auctions (buyer)
        auctions, total = await service.list_auctions(db, org_id)
        assert total >= 1
        matching = next((a for a in auctions if a.id == auction.id), None)
        assert matching is not None
        assert matching.rfq_number == rfq.rfq_number
        assert matching.rfq_title == rfq.title

        # Test list_auctions (supplier)
        vendor_auctions, v_total = await service.list_auctions(
            db, org_id, vendor_id=fx["vendor1_id"]
        )
        assert v_total >= 1
        v_matching = next((a for a in vendor_auctions if a.id == auction.id), None)
        assert v_matching is not None
        assert v_matching.rfq_number == rfq.rfq_number
        assert v_matching.rfq_title == rfq.title

        # Test _sanitize_auction_for_actor serialization
        from app.modules.bid.auction_router import _sanitize_auction_for_actor
        buyer_sanitized = _sanitize_auction_for_actor(matching, buyer_actor)
        assert buyer_sanitized["rfq_number"] == rfq.rfq_number
        assert buyer_sanitized["rfq_title"] == rfq.title

        supplier_actor = SimpleNamespace(id=fx["vendor1_user_id"], vendor_id=fx["vendor1_id"])
        supplier_sanitized = _sanitize_auction_for_actor(v_matching, supplier_actor)
        assert supplier_sanitized["rfq_number"] == rfq.rfq_number
        assert supplier_sanitized["rfq_title"] == rfq.title

