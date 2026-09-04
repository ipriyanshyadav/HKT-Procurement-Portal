"""
Security tests for SPEC_11B Live Auction Visibility & Information Leakage Prevention.
1. Reserve price is NEVER leaked to vendors in bid rejection.
2. Reserve price is NEVER present in any WebSocket broadcast or vendor event.
3. rank_visibility = 'NO_RANK' conceals L1 price and rank in both WebSocket and HTTP responses.
4. rank_visibility = 'PRICE_AND_RANK' permits L1 price and rank disclosure.
5. Vendors cannot view buyer leaderboard with competitor identities.
"""
from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

import app.main  # noqa: F401
from app.config import settings
from app.core.exceptions import ForbiddenError
from app.modules.bid.schemas import AuctionConfig
from tests.integration.test_live_bidding import create_live_auction_fixtures, setup_auction_with_rfq

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


@pytest.mark.asyncio
async def test_reserve_price_never_revealed_on_above_reserve_bid():
    """Verify that when a vendor's bid exceeds reserve price, the rejection reason is masked."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_live_auction_fixtures(db, org_id)
        config = AuctionConfig(
            auction_start_at=datetime.now(timezone.utc),
            auction_duration_minutes=30,
            reserve_price_inr=Decimal("80000.00"),
            min_decrement_type="ABSOLUTE",
            min_decrement_value=Decimal("1000.00"),
            rank_visibility="RANK_ONLY",
            auto_extend=True,
            auto_extend_trigger_minutes=5,
            auto_extend_duration_minutes=10,
            max_extensions=3,
            allow_proxy_bid=True,
        )
        rfq, lot, auction, svc = await setup_auction_with_rfq(db, fix, org_id, config=config, open_now=True)

        v1_user = SimpleNamespace(id=fix["vendor1_user_id"], vendor_id=fix["vendor1_id"], org_id=org_id)

        # Intercept websocket notifications
        sent_messages = []
        async def mock_send(a_id, v_id, msg):
            sent_messages.append((v_id, msg))

        svc._send_to_vendor = AsyncMock(side_effect=mock_send)

        # Bid above reserve price: 90000 > 80000
        bid = await svc.submit_live_bid(db, auction.id, lot.id, Decimal("90000.00"), v1_user, org_id)
        assert bid.is_valid is False
        assert bid.invalidation_reason == "ABOVE_RESERVE_PRICE"

        # Verify vendor message contains strictly masked reason
        assert len(sent_messages) == 1
        recipient_id, message = sent_messages[0]
        assert recipient_id == fix["vendor1_id"]
        assert message["type"] == "BID_REJECTED"
        payload = message["payload"]
        assert payload["reason"] == "BID_NOT_COMPETITIVE"

        # Check payload does NOT mention reserve price or reveal value
        payload_str = str(payload).lower()
        assert "reserve" not in payload_str
        assert "80000" not in payload_str
        assert "reserve_price" not in payload


@pytest.mark.asyncio
async def test_reserve_price_not_in_websocket_broadcasts():
    """Verify that public and private WebSocket payloads never contain reserve_price."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_live_auction_fixtures(db, org_id)
        config = AuctionConfig(
            auction_start_at=datetime.now(timezone.utc),
            auction_duration_minutes=30,
            reserve_price_inr=Decimal("95000.00"),
            min_decrement_type="ABSOLUTE",
            min_decrement_value=Decimal("1000.00"),
            rank_visibility="RANK_ONLY",
            auto_extend=True,
            auto_extend_trigger_minutes=5,
            auto_extend_duration_minutes=10,
            max_extensions=3,
            allow_proxy_bid=True,
        )
        rfq, lot, auction, svc = await setup_auction_with_rfq(db, fix, org_id, config=config, open_now=True)

        broadcast_events = []
        vendor_events = []

        svc._broadcast = AsyncMock(side_effect=lambda a, o, m: broadcast_events.append(m))
        svc._send_to_vendor = AsyncMock(side_effect=lambda a, v, m: vendor_events.append(m))

        v1_user = SimpleNamespace(id=fix["vendor1_user_id"], vendor_id=fix["vendor1_id"], org_id=org_id)
        await svc.submit_live_bid(db, auction.id, lot.id, Decimal("90000.00"), v1_user, org_id)

        # Check all broadcast messages
        for msg in broadcast_events:
            msg_str = str(msg).lower()
            assert "reserve_price" not in msg_str
            assert "95000" not in msg_str

        # Check vendor messages
        for msg in vendor_events:
            msg_str = str(msg).lower()
            assert "reserve_price" not in msg_str
            assert "95000" not in msg_str


@pytest.mark.asyncio
async def test_rank_visibility_no_rank_masks_rank_and_l1_price():
    """Verify that rank_visibility = 'NO_RANK' masks rank and L1 price in broadcasts and my-rank."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_live_auction_fixtures(db, org_id)
        config = AuctionConfig(
            auction_start_at=datetime.now(timezone.utc),
            auction_duration_minutes=30,
            reserve_price_inr=Decimal("100000.00"),
            min_decrement_type="ABSOLUTE",
            min_decrement_value=Decimal("1000.00"),
            rank_visibility="NO_RANK",
            auto_extend=True,
            auto_extend_trigger_minutes=5,
            auto_extend_duration_minutes=10,
            max_extensions=3,
            allow_proxy_bid=True,
        )
        rfq, lot, auction, svc = await setup_auction_with_rfq(db, fix, org_id, config=config, open_now=True)

        broadcast_events = []
        vendor_events = []
        svc._broadcast = AsyncMock(side_effect=lambda a, o, m: broadcast_events.append(m))
        svc._send_to_vendor = AsyncMock(side_effect=lambda a, v, m: vendor_events.append(m))

        v1_user = SimpleNamespace(id=fix["vendor1_user_id"], vendor_id=fix["vendor1_id"], org_id=org_id)
        await svc.submit_live_bid(db, auction.id, lot.id, Decimal("90000.00"), v1_user, org_id)

        # Public broadcast NEW_BID must NOT include l1_price_inr
        new_bid_events = [m for m in broadcast_events if m["type"] == "NEW_BID"]
        assert len(new_bid_events) > 0
        for ev in new_bid_events:
            assert "l1_price_inr" not in ev["payload"]

        # Private RANK_UPDATE must NOT include your_rank or l1_price_inr
        rank_updates = [m for m in vendor_events if m["type"] == "RANK_UPDATE"]
        assert len(rank_updates) > 0
        for ev in rank_updates:
            assert "your_rank" not in ev["payload"]
            assert "l1_price_inr" not in ev["payload"]

        # get_my_rank endpoint query
        my_rank_data = await svc.get_my_rank(db, auction.id, v1_user, org_id)
        assert my_rank_data["your_rank"] is None
        assert my_rank_data["l1_price_inr"] is None
        assert my_rank_data["your_bid_inr"] == 90000.00


@pytest.mark.asyncio
async def test_rank_visibility_price_and_rank_discloses_l1():
    """Verify that rank_visibility = 'PRICE_AND_RANK' shows rank and L1 price."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_live_auction_fixtures(db, org_id)
        config = AuctionConfig(
            auction_start_at=datetime.now(timezone.utc),
            auction_duration_minutes=30,
            reserve_price_inr=Decimal("100000.00"),
            min_decrement_type="ABSOLUTE",
            min_decrement_value=Decimal("1000.00"),
            rank_visibility="PRICE_AND_RANK",
            auto_extend=True,
            auto_extend_trigger_minutes=5,
            auto_extend_duration_minutes=10,
            max_extensions=3,
            allow_proxy_bid=True,
        )
        rfq, lot, auction, svc = await setup_auction_with_rfq(db, fix, org_id, config=config, open_now=True)

        broadcast_events = []
        svc._broadcast = AsyncMock(side_effect=lambda a, o, m: broadcast_events.append(m))

        v1_user = SimpleNamespace(id=fix["vendor1_user_id"], vendor_id=fix["vendor1_id"], org_id=org_id)
        await svc.submit_live_bid(db, auction.id, lot.id, Decimal("90000.00"), v1_user, org_id)

        new_bid_events = [m for m in broadcast_events if m["type"] == "NEW_BID"]
        assert len(new_bid_events) > 0
        assert new_bid_events[0]["payload"]["l1_price_inr"] == 90000.00

        my_rank_data = await svc.get_my_rank(db, auction.id, v1_user, org_id)
        assert my_rank_data["your_rank"] == 1
        assert my_rank_data["l1_price_inr"] == 90000.00


@pytest.mark.asyncio
async def test_vendor_cannot_view_buyer_leaderboard():
    """Verify that vendors attempting to call get_leaderboard receive ForbiddenError."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, svc = await setup_auction_with_rfq(db, fix, org_id, open_now=True)

        # Actor is a vendor user without LIVE_AUCTION_MONITOR permission
        v1_user = SimpleNamespace(
            id=fix["vendor1_user_id"],
            vendor_id=fix["vendor1_id"],
            org_id=org_id,
            roles=["VENDOR"],
            permissions=[],
        )

        with pytest.raises(ForbiddenError):
            await svc.get_leaderboard(db, auction.id, v1_user, org_id)
