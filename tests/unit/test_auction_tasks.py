from __future__ import annotations
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest

from app.tasks.auction import (
    open_scheduled_auctions,
    close_due_auctions,
    send_auction_closing_warning,
    notify_auction_start_reminders,
    execute_proxy_bids_task,
)


def test_open_scheduled_auctions():
    with patch("app.tasks.auction.get_db_ctx") as mock_ctx, \
         patch("app.tasks.auction.LiveBidService") as MockSvc:
        mock_db = AsyncMock()
        mock_ctx.return_value.__aenter__.return_value = mock_db
        svc = MockSvc.return_value

        a1 = MagicMock()
        a1.id = uuid4()
        a1.org_id = uuid4()
        svc.live_bid_repo.get_due_to_open = AsyncMock(return_value=[a1])
        svc.open_auction = AsyncMock()

        open_scheduled_auctions()
        svc.open_auction.assert_awaited_once_with(mock_db, a1.id, a1.org_id)
        mock_db.commit.assert_awaited_once()


def test_open_scheduled_auctions_error():
    with patch("app.tasks.auction.get_db_ctx") as mock_ctx, \
         patch("app.tasks.auction.LiveBidService") as MockSvc:
        mock_db = AsyncMock()
        mock_ctx.return_value.__aenter__.return_value = mock_db
        svc = MockSvc.return_value

        a1 = MagicMock()
        a1.id = uuid4()
        a1.org_id = uuid4()
        svc.live_bid_repo.get_due_to_open = AsyncMock(return_value=[a1])
        svc.open_auction = AsyncMock(side_effect=RuntimeError("Open failed"))

        open_scheduled_auctions()
        mock_db.rollback.assert_awaited_once()


def test_close_due_auctions():
    with patch("app.tasks.auction.get_db_ctx") as mock_ctx, \
         patch("app.tasks.auction.LiveBidService") as MockSvc:
        mock_db = AsyncMock()
        mock_ctx.return_value.__aenter__.return_value = mock_db
        svc = MockSvc.return_value

        a1 = MagicMock()
        a1.id = uuid4()
        a1.org_id = uuid4()
        svc.live_bid_repo.get_due_to_close = AsyncMock(return_value=[a1])
        svc.close_auction = AsyncMock()

        close_due_auctions()
        svc.close_auction.assert_awaited_once_with(mock_db, a1.id, a1.org_id)
        mock_db.commit.assert_awaited_once()


def test_close_due_auctions_error():
    with patch("app.tasks.auction.get_db_ctx") as mock_ctx, \
         patch("app.tasks.auction.LiveBidService") as MockSvc:
        mock_db = AsyncMock()
        mock_ctx.return_value.__aenter__.return_value = mock_db
        svc = MockSvc.return_value

        a1 = MagicMock()
        a1.id = uuid4()
        a1.org_id = uuid4()
        svc.live_bid_repo.get_due_to_close = AsyncMock(return_value=[a1])
        svc.close_auction = AsyncMock(side_effect=RuntimeError("Close failed"))

        close_due_auctions()
        mock_db.rollback.assert_awaited_once()


def test_send_auction_closing_warning():
    with patch("app.tasks.auction.get_db_ctx") as mock_ctx, \
         patch("app.tasks.auction.LiveBidService") as MockSvc:
        mock_db = AsyncMock()
        mock_ctx.return_value.__aenter__.return_value = mock_db
        svc = MockSvc.return_value

        a1 = MagicMock()
        a1.id = uuid4()
        a1.org_id = uuid4()
        svc.live_bid_repo.get_closing_soon = AsyncMock(return_value=[a1])
        svc.send_closing_warning = AsyncMock()

        send_auction_closing_warning()
        svc.send_closing_warning.assert_awaited_once_with(mock_db, a1, a1.org_id)
        mock_db.commit.assert_awaited_once()


def test_send_auction_closing_warning_error():
    with patch("app.tasks.auction.get_db_ctx") as mock_ctx, \
         patch("app.tasks.auction.LiveBidService") as MockSvc:
        mock_db = AsyncMock()
        mock_ctx.return_value.__aenter__.return_value = mock_db
        svc = MockSvc.return_value

        a1 = MagicMock()
        a1.id = uuid4()
        a1.org_id = uuid4()
        svc.live_bid_repo.get_closing_soon = AsyncMock(return_value=[a1])
        svc.send_closing_warning = AsyncMock(side_effect=RuntimeError("Warning failed"))

        send_auction_closing_warning()
        mock_db.rollback.assert_awaited_once()


def test_notify_auction_start_reminders():
    with patch("app.tasks.auction.get_db_ctx") as mock_ctx, \
         patch("app.tasks.auction.LiveBidService") as MockSvc, \
         patch("app.events.publisher.OutboxPublisher") as MockPub:
        mock_db = AsyncMock()
        mock_ctx.return_value.__aenter__.return_value = mock_db
        svc = MockSvc.return_value
        pub = MockPub.return_value
        pub.publish = AsyncMock()

        a1 = MagicMock()
        a1.id = uuid4()
        a1.org_id = uuid4()
        p1 = MagicMock()
        p1.vendor_id = uuid4()

        svc.live_bid_repo.get_starting_in = AsyncMock(return_value=[a1])
        svc.live_bid_repo.get_participants = AsyncMock(return_value=[p1])

        notify_auction_start_reminders()
        assert pub.publish.await_count >= 2


def test_execute_proxy_bids_task():
    with patch("app.tasks.auction.get_db_ctx") as mock_ctx, \
         patch("app.tasks.auction.LiveBidService") as MockSvc:
        mock_db = AsyncMock()
        mock_ctx.return_value.__aenter__.return_value = mock_db
        svc = MockSvc.return_value
        svc.execute_proxy_bids = AsyncMock()

        mock_bid = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_bid
        mock_db.execute = AsyncMock(return_value=mock_result)

        a_id = str(uuid4())
        lot_id = str(uuid4())
        bid_id = str(uuid4())
        org_id = str(uuid4())

        execute_proxy_bids_task(a_id, lot_id, bid_id, org_id, cascade_count=1)
        svc.execute_proxy_bids.assert_awaited_once()
        mock_db.commit.assert_awaited_once()
