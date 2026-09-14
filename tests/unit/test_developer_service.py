"""Unit tests for Developer Sandbox & Platform Service (SPEC_28)."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, timezone

from app.modules.developer.service import developer_service


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.mark.asyncio
async def test_get_sandbox_status(mock_db):
    org_id = uuid4()

    mock_org = MagicMock()
    mock_org.scalar_one_or_none.return_value = "Test Org Ltd"

    count_res = MagicMock()
    count_res.scalar.return_value = 15

    mock_db.execute.side_effect = [
        mock_org,
        count_res,  # prs
        count_res,  # pos
        count_res,  # vendors
    ]

    status = await developer_service.get_sandbox_status(mock_db, org_id)
    assert status.is_active is True
    assert status.sandbox_org_id == org_id
    assert "Test Org Ltd" in status.sandbox_org_name
    assert status.seeded_counts["requisitions"] == 15
    assert status.seeded_counts["purchase_orders"] == 15
    assert status.seeded_counts["vendors"] == 15


@pytest.mark.asyncio
async def test_reset_sandbox(mock_db):
    org_id = uuid4()
    actor_id = uuid4()

    with patch("app.modules.audit.service.audit_service.log", new_callable=AsyncMock) as mock_audit:
        resp = await developer_service.reset_sandbox(mock_db, org_id, actor_id, seed_demo_data=True)
        assert resp.status == "COMPLETED"
        assert resp.sandbox_org_id == org_id
        assert resp.records_created["requisitions"] == 10
        mock_audit.assert_called_once()


@pytest.mark.asyncio
async def test_time_travel_sandbox(mock_db):
    org_id = uuid4()
    actor_id = uuid4()

    with patch("app.modules.audit.service.audit_service.log", new_callable=AsyncMock) as mock_audit:
        resp = await developer_service.time_travel_sandbox(mock_db, org_id, actor_id, advance_days=14)
        assert resp.offset_days == 14
        assert resp.expired_rfqs_count == 2
        assert resp.due_invoices_count == 3
        mock_audit.assert_called_once()


def test_get_changelog():
    entries = developer_service.get_changelog()
    assert len(entries) >= 2
    assert entries[0].version == "v2.4.0"
    assert len(entries[0].new_features) >= 1


def test_get_documentation():
    docs = developer_service.get_documentation()
    assert len(docs) >= 5
    slugs = [d.slug for d in docs]
    assert "getting-started" in slugs
    assert "authentication" in slugs
    assert "webhooks" in slugs
