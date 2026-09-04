"""
Unit tests for SPEC_11B Live Auction Bid Sequence Generation & Monotonicity.
Tests:
1. Redis atomic INCR sequence increment.
2. Database fallback when Redis client is None.
3. Database fallback when Redis client raises an exception.
4. Default sequence = 1 when neither is available.
5. Redis key formatting for auction sequence and channels.
6. Concurrent sequence generation uniqueness and strict monotonicity.
"""
from __future__ import annotations
import asyncio
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import select, func
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

import app.main  # noqa: F401
from app.config import settings
from app.core.redis_client import RedisKeys
from app.modules.bid.live_bid_repository import LiveBidRepository
from app.modules.bid.models import LiveBid

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


@pytest.mark.asyncio
async def test_redis_sequence_increment_success():
    """Verify that next_sequence uses Redis INCR when client is operational."""
    repo = LiveBidRepository()
    mock_redis = AsyncMock()
    mock_redis.incr = AsyncMock(return_value=42)

    auction_id = uuid4()
    seq = await repo.next_sequence(mock_redis, auction_id)

    assert seq == 42
    mock_redis.incr.assert_called_once_with(RedisKeys.auction_sequence(auction_id))


@pytest.mark.asyncio
async def test_sequence_fallback_to_db_when_redis_none():
    """Verify that next_sequence queries the database when Redis client is None."""
    repo = LiveBidRepository()
    auction_id = uuid4()

    mock_db = AsyncMock(spec=AsyncSession)
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = 15
    mock_db.execute = AsyncMock(return_value=mock_result)

    seq = await repo.next_sequence(None, auction_id, db=mock_db)

    assert seq == 16
    mock_db.execute.assert_called_once()


@pytest.mark.asyncio
async def test_sequence_fallback_when_redis_raises():
    """Verify that next_sequence gracefully catches Redis errors and falls back to DB."""
    repo = LiveBidRepository()
    auction_id = uuid4()

    mock_redis = AsyncMock()
    mock_redis.incr = AsyncMock(side_effect=ConnectionError("Redis connection refused"))

    mock_db = AsyncMock(spec=AsyncSession)
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = 7
    mock_db.execute = AsyncMock(return_value=mock_result)

    seq = await repo.next_sequence(mock_redis, auction_id, db=mock_db)

    assert seq == 8
    mock_redis.incr.assert_called_once()
    mock_db.execute.assert_called_once()


@pytest.mark.asyncio
async def test_default_sequence_when_no_redis_and_no_db():
    """Verify that next_sequence returns 1 when neither Redis nor DB session are provided."""
    repo = LiveBidRepository()
    auction_id = uuid4()

    seq = await repo.next_sequence(None, auction_id, db=None)
    assert seq == 1


def test_redis_keys_formatting():
    """Verify Redis key and channel format conventions for live auctions."""
    auction_id = uuid4()
    vendor_id = uuid4()

    assert RedisKeys.auction_channel(auction_id) == f"auction:{auction_id}:broadcast"
    assert RedisKeys.auction_vendor_channel(auction_id, vendor_id) == f"auction:{auction_id}:vendor:{vendor_id}"
    assert RedisKeys.auction_sequence(auction_id) == f"auction:{auction_id}:seq"
    assert RedisKeys.auction_best_bid(auction_id) == f"auction:{auction_id}:best:all"


@pytest.mark.asyncio
async def test_concurrent_sequence_monotonicity():
    """Verify that concurrent sequence requests result in unique, strictly ascending sequences."""
    repo = LiveBidRepository()
    auction_id = uuid4()

    current_seq = 0
    lock = asyncio.Lock()

    async def mock_incr(key):
        nonlocal current_seq
        async with lock:
            current_seq += 1
            return current_seq

    mock_redis = AsyncMock()
    mock_redis.incr = AsyncMock(side_effect=mock_incr)

    # Spawn 20 concurrent requests
    results = await asyncio.gather(
        *(repo.next_sequence(mock_redis, auction_id) for _ in range(20))
    )

    assert len(results) == 20
    assert len(set(results)) == 20  # All unique
    assert sorted(results) == list(range(1, 21))  # Monotonic 1 through 20
