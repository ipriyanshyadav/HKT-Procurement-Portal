"""Unit tests for ApiKeyService — SPEC_27-E."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, UTC

from app.modules.integration.api_key_service import ApiKeyService
from app.modules.integration.api_key_schemas import ApiKeyCreateRequest
from app.core.exceptions import NotFoundError


@pytest.mark.asyncio
@patch("app.modules.integration.api_key_service.audit_service.log", new_callable=AsyncMock)
async def test_create_api_key(mock_audit):
    service = ApiKeyService()
    db = AsyncMock()
    org_id = uuid4()
    actor_id = uuid4()

    req = ApiKeyCreateRequest(
        name="Automation Key",
        scopes=["read:pr", "write:po"],
        rate_limit_tier="STANDARD",
        key_type="LIVE",
        expires_in_days=90,
    )

    api_key, raw_key = await service.create_api_key(db, org_id, actor_id, req)
    assert api_key.name == "Automation Key"
    assert raw_key.startswith("prc_live_")
    assert api_key.key_prefix == raw_key[:12]
    assert api_key.scopes == ["read:pr", "write:po"]
    assert api_key.expires_at is not None
    assert db.add.called
    mock_audit.assert_called_once()


@pytest.mark.asyncio
async def test_get_api_key_not_found():
    service = ApiKeyService()
    db = AsyncMock()

    res = MagicMock()
    res.scalar_one_or_none.return_value = None
    db.execute.return_value = res

    with pytest.raises(NotFoundError):
        await service.get_api_key_entity(db, org_id=uuid4(), key_id=uuid4())


@pytest.mark.asyncio
@patch("app.modules.integration.api_key_service.audit_service.log", new_callable=AsyncMock)
async def test_revoke_api_key(mock_audit):
    service = ApiKeyService()
    db = AsyncMock()
    org_id = uuid4()
    key_id = uuid4()

    key = MagicMock()
    key.id = key_id
    key.status = "ACTIVE"
    key.key_prefix = "prc_live_123"

    res = MagicMock()
    res.scalar_one_or_none.return_value = key
    db.execute.return_value = res

    await service.revoke_api_key(db, org_id, uuid4(), key_id)
    assert key.status == "REVOKED"
    assert key.revoked_at is not None
    mock_audit.assert_called_once()


@pytest.mark.asyncio
@patch("app.modules.integration.api_key_service.audit_service.log", new_callable=AsyncMock)
async def test_rotate_api_key(mock_audit):
    service = ApiKeyService()
    db = AsyncMock()
    org_id = uuid4()
    key_id = uuid4()

    old_key = MagicMock()
    old_key.id = key_id
    old_key.name = "Old Key"
    old_key.scopes = ["read:pr"]
    old_key.ip_allowlist = []
    old_key.rate_limit_rpm = 120
    old_key.key_prefix = "prc_live_old"

    res = MagicMock()
    res.scalar_one_or_none.return_value = old_key
    db.execute.return_value = res

    new_key, raw_key = await service.rotate_api_key(db, org_id, uuid4(), key_id)
    assert old_key.expires_at is not None
    assert raw_key.startswith("prc_live_")
    assert db.add.called
    mock_audit.assert_called_once()


@pytest.mark.asyncio
async def test_get_usage_metrics():
    service = ApiKeyService()
    db = AsyncMock()
    org_id = uuid4()
    key_id = uuid4()

    key = MagicMock()
    key.id = key_id
    key.total_requests = 120

    res = MagicMock()
    res.scalar_one_or_none.return_value = key
    db.execute.return_value = res

    metrics = await service.get_usage_metrics(db, org_id, key_id)
    assert metrics.total_requests_today == 120
    assert metrics.total_requests_this_month == 120
    assert metrics.avg_response_ms > 0
