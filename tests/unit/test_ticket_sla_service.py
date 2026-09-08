from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.modules.ticket.sla_service import _DEFAULT_SLA, TicketSLAService


@pytest.mark.asyncio
async def test_get_config_default_fallback():
    """Verify default SLA configs are used when no DB record exists."""
    service = TicketSLAService(repo=None)
    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_res

    org_id = uuid4()
    for priority, defaults in _DEFAULT_SLA.items():
        cfg = await service.get_config(mock_db, org_id, priority)
        assert cfg["first_response"] == defaults["first_response"]
        assert cfg["resolution"] == defaults["resolution"]
        assert cfg["escalation"] == defaults["escalation"]
        assert cfg["escalate_to_role"] == defaults["escalate_to_role"]


@pytest.mark.asyncio
async def test_get_config_from_repo():
    """Verify repo SLA config is respected when present."""
    mock_repo = AsyncMock()
    row = MagicMock()
    row.first_response_hours = 2
    row.resolution_hours = 10
    row.escalation_hours = 5
    row.escalate_to_role = "CUSTOM_ROLE"
    mock_repo.get_sla_config.return_value = row

    service = TicketSLAService(repo=mock_repo)
    mock_db = AsyncMock()
    org_id = uuid4()

    cfg = await service.get_config(mock_db, org_id, "HIGH")
    assert cfg["first_response"] == 2
    assert cfg["resolution"] == 10
    assert cfg["escalation"] == 5
    assert cfg["escalate_to_role"] == "CUSTOM_ROLE"


@pytest.mark.asyncio
async def test_compute_breach_at():
    """Verify compute_breach_at adds resolution hours to created_at."""
    service = TicketSLAService(repo=None)
    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_res

    org_id = uuid4()
    now = datetime(2026, 9, 8, 10, 0, 0)
    # CRITICAL resolution is 4 hours
    breach_at = await service.compute_breach_at(mock_db, org_id, "CRITICAL", now)
    assert breach_at == now + timedelta(hours=4)


def test_compute_status_within_sla():
    """Elapsed time < 50% should be WITHIN_SLA."""
    service = TicketSLAService()
    now = datetime.utcnow()
    created_at = now - timedelta(hours=1)
    breach_at = created_at + timedelta(hours=10)  # 10% elapsed
    status = service.compute_status(breach_at, created_at)
    assert status == "WITHIN_SLA"


def test_compute_status_at_risk():
    """Elapsed time >= 50% but < 100% should be AT_RISK."""
    service = TicketSLAService()
    now = datetime.utcnow()
    created_at = now - timedelta(hours=6)
    breach_at = created_at + timedelta(hours=10)  # 60% elapsed
    status = service.compute_status(breach_at, created_at)
    assert status == "AT_RISK"


def test_compute_status_breached():
    """Elapsed time >= 100% should be BREACHED."""
    service = TicketSLAService()
    now = datetime.utcnow()
    created_at = now - timedelta(hours=12)
    breach_at = created_at + timedelta(hours=10)  # 120% elapsed
    status = service.compute_status(breach_at, created_at)
    assert status == "BREACHED"


def test_compute_status_tz_aware():
    """Verify compute_status correctly handles timezone-aware datetimes."""
    service = TicketSLAService()
    now = datetime.now(UTC)
    created_at = now - timedelta(hours=2)
    breach_at = created_at + timedelta(hours=3)  # 66.6% elapsed -> AT_RISK
    status = service.compute_status(breach_at, created_at)
    assert status == "AT_RISK"
