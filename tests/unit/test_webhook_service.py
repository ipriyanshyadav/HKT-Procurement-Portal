"""Unit tests for WebhookManagementService — SPEC_27-D."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, UTC

from app.modules.integration.webhook_management_service import WebhookManagementService
from app.modules.integration.webhook_schemas import WebhookCreateRequest, WebhookUpdateRequest
from app.core.exceptions import NotFoundError


@pytest.mark.asyncio
@patch("app.modules.integration.webhook_management_service.audit_service.log", new_callable=AsyncMock)
async def test_create_webhook(mock_audit):
    service = WebhookManagementService()
    db = AsyncMock()
    org_id = uuid4()
    actor_id = uuid4()

    req = WebhookCreateRequest(
        name="ERP Webhook",
        url="https://erp.example.com/webhooks/procure",
        subscribed_events=["pr.created", "po.created"],
    )

    endpoint, raw_secret = await service.create_webhook(db, org_id, actor_id, req)
    assert endpoint.name == "ERP Webhook"
    assert endpoint.url == "https://erp.example.com/webhooks/procure"
    assert raw_secret.startswith("whsec_")
    assert endpoint.secret_hint is not None
    assert db.add.called
    mock_audit.assert_called_once()


@pytest.mark.asyncio
async def test_get_webhook_not_found():
    service = WebhookManagementService()
    db = AsyncMock()

    res = MagicMock()
    res.scalar_one_or_none.return_value = None
    db.execute.return_value = res

    with pytest.raises(NotFoundError):
        await service.get_webhook(db, org_id=uuid4(), webhook_id=uuid4())


@pytest.mark.asyncio
@patch("app.modules.integration.webhook_management_service.audit_service.log", new_callable=AsyncMock)
async def test_update_webhook(mock_audit):
    service = WebhookManagementService()
    db = AsyncMock()
    org_id = uuid4()
    webhook_id = uuid4()

    sub = MagicMock()
    sub.id = webhook_id
    sub.org_id = org_id
    sub.description = "Old Name"
    sub.endpoint_url = "https://example.com"
    sub.secret_token = "whsec_1234"
    sub.subscribed_events = ["pr.created"]
    sub.is_active = True
    sub.failure_count = 0
    sub.last_delivery_at = None
    sub.last_delivery_status = None
    sub.created_at = datetime.now(UTC)
    sub.updated_at = datetime.now(UTC)

    res = MagicMock()
    res.scalar_one_or_none.return_value = sub
    db.execute.return_value = res

    req = WebhookUpdateRequest(name="Updated Name", is_active=False)
    updated = await service.update_webhook(db, org_id, uuid4(), webhook_id, req)
    assert updated.name == "Updated Name"
    assert updated.is_active is False
    mock_audit.assert_called_once()


@pytest.mark.asyncio
@patch("app.modules.integration.webhook_management_service.audit_service.log", new_callable=AsyncMock)
async def test_rotate_secret(mock_audit):
    service = WebhookManagementService()
    db = AsyncMock()
    org_id = uuid4()
    webhook_id = uuid4()

    sub = MagicMock()
    sub.id = webhook_id
    sub.secret_token = "old_secret_hash"

    res = MagicMock()
    res.scalar_one_or_none.return_value = sub
    db.execute.return_value = res

    new_raw = await service.rotate_secret(db, org_id, uuid4(), webhook_id)
    assert new_raw.startswith("whsec_")
    assert sub.secret_token == new_raw
    mock_audit.assert_called_once()


@pytest.mark.asyncio
@patch("app.modules.integration.webhook_management_service.audit_service.log", new_callable=AsyncMock)
async def test_test_webhook_delivery(mock_audit):
    service = WebhookManagementService()
    db = AsyncMock()
    org_id = uuid4()
    webhook_id = uuid4()

    sub = MagicMock()
    sub.id = webhook_id
    sub.secret_token = "whsec_secret"

    res = MagicMock()
    res.scalar_one_or_none.return_value = sub
    db.execute.return_value = res

    result = await service.test_webhook(db, org_id, uuid4(), webhook_id)
    assert result.is_success is True
    assert result.response_status == 200
    assert db.add.called
    mock_audit.assert_called_once()


def test_list_available_events():
    service = WebhookManagementService()
    events = service.list_events()
    assert "pr.created" in events
    assert "po.created" in events
    assert "invoice.approved" in events
