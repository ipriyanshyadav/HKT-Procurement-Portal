"""
Security tests for SPEC_11B Live Auction Access Control & Authorization.
1. Unadmitted vendor cannot submit bids (NOT_PARTICIPANT).
2. Unadmitted vendor cannot set proxy floor (NOT_PARTICIPANT).
3. Non-vendor (buyer) cannot submit bids (NOT_A_VENDOR).
4. Non-vendor (buyer) cannot set proxy floor (NOT_A_VENDOR).
5. Unadmitted vendor WebSocket connection is closed with WS_1008.
6. Buyer without LIVE_AUCTION_MONITOR WebSocket connection is closed with WS_1008.
7. Unauthenticated WebSocket connection without token is closed with WS_1008.
"""
from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import WebSocket, status
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

import app.main  # noqa: F401
from app.auth.dependencies import get_current_user_ws
from app.config import settings
from app.core.constants import PermissionCode
from app.core.exceptions import AppException, ForbiddenError
from app.modules.bid.auction_ws import AuctionConnectionManager
from app.modules.bid.schemas import AuctionConfig
from tests.integration.test_live_bidding import create_live_auction_fixtures, setup_auction_with_rfq

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


@pytest.mark.asyncio
async def test_unadmitted_vendor_bid_forbidden():
    """Verify that a vendor who is not a registered participant cannot submit a bid."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, svc = await setup_auction_with_rfq(db, fix, org_id, open_now=True)

        uninvited_vendor_id = uuid4()
        uninvited_user = SimpleNamespace(
            id=uuid4(),
            vendor_id=uninvited_vendor_id,
            org_id=org_id,
            roles=["VENDOR"],
        )

        with pytest.raises(ForbiddenError) as exc_info:
            await svc.submit_live_bid(
                db, auction.id, lot.id, Decimal("90000.00"), uninvited_user, org_id
            )
        assert exc_info.value.code == "NOT_PARTICIPANT" or "participant" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_unadmitted_vendor_proxy_floor_forbidden():
    """Verify that a vendor who is not a registered participant cannot set proxy floor."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, svc = await setup_auction_with_rfq(db, fix, org_id, open_now=True)

        uninvited_vendor_id = uuid4()
        uninvited_user = SimpleNamespace(
            id=uuid4(),
            vendor_id=uninvited_vendor_id,
            org_id=org_id,
            roles=["VENDOR"],
        )

        with pytest.raises(ForbiddenError) as exc_info:
            await svc.set_proxy_floor(
                db, auction.id, lot.id, Decimal("80000.00"), uninvited_user, org_id
            )
        assert exc_info.value.code == "NOT_PARTICIPANT" or "participant" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_non_vendor_cannot_submit_live_bid():
    """Verify that a non-vendor (e.g., internal buyer) cannot submit a live bid."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, svc = await setup_auction_with_rfq(db, fix, org_id, open_now=True)

        buyer_user = SimpleNamespace(
            id=fix["buyer_id"],
            vendor_id=None,
            org_id=org_id,
            roles=["BUYER"],
        )

        with pytest.raises(ForbiddenError) as exc_info:
            await svc.submit_live_bid(
                db, auction.id, lot.id, Decimal("90000.00"), buyer_user, org_id
            )
        assert exc_info.value.code == "NOT_A_VENDOR" or "vendor" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_non_vendor_cannot_set_proxy_floor():
    """Verify that a non-vendor cannot configure proxy floor."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, svc = await setup_auction_with_rfq(db, fix, org_id, open_now=True)

        buyer_user = SimpleNamespace(
            id=fix["buyer_id"],
            vendor_id=None,
            org_id=org_id,
            roles=["BUYER"],
        )

        with pytest.raises(ForbiddenError) as exc_info:
            await svc.set_proxy_floor(
                db, auction.id, lot.id, Decimal("80000.00"), buyer_user, org_id
            )
        assert exc_info.value.code == "NOT_A_VENDOR" or "vendor" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_unadmitted_vendor_ws_connection_closed():
    """Verify that WebSocket manager terminates connection with WS_1008 if vendor is not a participant."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, svc = await setup_auction_with_rfq(db, fix, org_id, open_now=True)

        ws_manager = AuctionConnectionManager()

        mock_ws = AsyncMock(spec=WebSocket)
        mock_ws.close = AsyncMock()
        mock_ws.accept = AsyncMock()

        uninvited_user = SimpleNamespace(
            id=uuid4(),
            vendor_id=uuid4(),
            org_id=org_id,
        )

        mock_redis = AsyncMock()

        await ws_manager.handle(mock_ws, auction.id, uninvited_user, mock_redis, db)

        # Connection should be closed with policy violation and never accepted
        mock_ws.close.assert_called_once_with(code=status.WS_1008_POLICY_VIOLATION)
        mock_ws.accept.assert_not_called()


@pytest.mark.asyncio
async def test_buyer_without_monitor_permission_ws_closed():
    """Verify that WebSocket manager closes connection if buyer lacks LIVE_AUCTION_MONITOR."""
    org_id = uuid4()
    async with TestSession() as db:
        fix = await create_live_auction_fixtures(db, org_id)
        rfq, lot, auction, svc = await setup_auction_with_rfq(db, fix, org_id, open_now=True)

        ws_manager = AuctionConnectionManager()

        mock_ws = AsyncMock(spec=WebSocket)
        mock_ws.close = AsyncMock()
        mock_ws.accept = AsyncMock()

        unauthorized_buyer = SimpleNamespace(
            id=uuid4(),
            vendor_id=None,
            org_id=org_id,
        )

        mock_redis = AsyncMock()

        with patch("app.modules.bid.auction_ws.role_repository.user_has_permission", new=AsyncMock(return_value=False)):
            await ws_manager.handle(mock_ws, auction.id, unauthorized_buyer, mock_redis, db)

        mock_ws.close.assert_called_once_with(code=status.WS_1008_POLICY_VIOLATION)
        mock_ws.accept.assert_not_called()


@pytest.mark.asyncio
async def test_unauthenticated_ws_connection_closed():
    """Verify that get_current_user_ws closes websocket and raises 401 when token is absent."""
    mock_ws = AsyncMock(spec=WebSocket)
    mock_ws.close = AsyncMock()
    mock_ws.query_params = {}

    async with TestSession() as db:
        with pytest.raises(AppException) as exc_info:
            await get_current_user_ws(mock_ws, token=None, db=db)

        assert exc_info.value.status_code == 401
        mock_ws.close.assert_called_once_with(code=status.WS_1008_POLICY_VIOLATION)
