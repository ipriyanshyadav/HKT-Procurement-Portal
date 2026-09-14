"""Unit tests for BuyerActivityService (SPEC 27-H)."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
from datetime import UTC, datetime

from app.modules.analytics.buyer_activity_service import BuyerActivityService


@pytest.mark.asyncio
async def test_get_summary():
    service = BuyerActivityService()
    db = AsyncMock()
    org_id = uuid4()
    user_id = uuid4()

    m1, m2, m3 = MagicMock(), MagicMock(), MagicMock()
    m1.scalar.return_value = 15
    m2.scalar.return_value = 5
    m3.scalar.return_value = 3

    db.execute.side_effect = [m1, m2, m3]

    summary = await service.get_summary(db, org_id, user_id, "Sarah Jenkins")
    assert summary.user_id == user_id
    assert summary.full_name == "Sarah Jenkins"
    assert summary.total_actions == 15
    assert summary.prs_created == 5
    assert summary.pos_processed == 3


@pytest.mark.asyncio
async def test_get_heatmap():
    service = BuyerActivityService()
    db = AsyncMock()
    org_id = uuid4()

    res = MagicMock()
    now = datetime.now(UTC)
    res.scalars.return_value.all.return_value = [now, now, now]
    db.execute.return_value = res

    heatmap = await service.get_heatmap(db, org_id)
    assert len(heatmap.matrix) == 7 * 24  # 168 hours in a week
    assert heatmap.total_actions == 3


@pytest.mark.asyncio
async def test_get_procurement_velocity():
    service = BuyerActivityService()
    db = AsyncMock()
    org_id = uuid4()

    vel = await service.get_procurement_velocity(db, org_id)
    assert vel.avg_cycle_days > 0
    assert len(vel.distribution) > 0
    assert vel.distribution[0].bucket_label == "< 1 Day"


@pytest.mark.asyncio
async def test_get_bottlenecks():
    service = BuyerActivityService()
    db = AsyncMock()
    org_id = uuid4()

    bottlenecks = await service.get_bottlenecks(db, org_id)
    assert len(bottlenecks) >= 3
    assert bottlenecks[0].avg_duration_hours >= bottlenecks[-1].avg_duration_hours
