from __future__ import annotations
import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest

from app.core.exceptions import ExternalServiceError
from app.modules.notification.consumer import NotificationConsumer


class AsyncContextManager:
    def __init__(self, msg):
        self.msg = msg

    async def __aenter__(self):
        return self.msg

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return False


class DummyMessage:
    def __init__(self, body_dict: dict, routing_key: str, headers: dict = None):
        self.body = json.dumps(body_dict).encode()
        self.routing_key = routing_key
        self.headers = headers or {}
        self.rejected = False
        self.requeue_val = None

    def process(self, requeue=True):
        return AsyncContextManager(self)

    async def reject(self, requeue=False):
        self.rejected = True
        self.requeue_val = requeue


@pytest.mark.asyncio
async def test_start_consuming():
    mock_channel = AsyncMock()
    mock_queue = AsyncMock()
    mock_channel.declare_queue.return_value = mock_queue

    consumer = NotificationConsumer()
    await consumer.start_consuming(mock_channel)
    assert mock_channel.declare_queue.call_count == len(consumer.QUEUES)
    assert mock_queue.consume.call_count == len(consumer.QUEUES)


@pytest.mark.asyncio
async def test_route_email_message():
    email_ch = AsyncMock()
    consumer = NotificationConsumer(email_ch=email_ch)
    body = {
        "to_email": "test@example.com",
        "subject": "Hello",
        "body": "<p>World</p>",
        "org_id": str(uuid4()),
        "user_id": str(uuid4()),
    }
    msg = DummyMessage(body, "notification.email.send")
    with patch.object(consumer, "_persist_notification", new_callable=AsyncMock) as mock_persist:
        await consumer._route_message(msg)
        email_ch.send.assert_awaited_once()
        mock_persist.assert_awaited_once()


@pytest.mark.asyncio
async def test_route_sms_message():
    sms_ch = AsyncMock()
    consumer = NotificationConsumer(sms_ch=sms_ch)
    body = {
        "to_phone": "+919876543210",
        "message": "OTP is 1234",
        "org_id": str(uuid4()),
        "user_id": str(uuid4()),
    }
    msg = DummyMessage(body, "notification.sms.send")
    with patch.object(consumer, "_persist_notification", new_callable=AsyncMock) as mock_persist:
        await consumer._route_message(msg)
        sms_ch.send.assert_awaited_once()
        mock_persist.assert_awaited_once()


@pytest.mark.asyncio
async def test_route_inapp_message():
    inapp_ch = AsyncMock()
    consumer = NotificationConsumer(inapp_ch=inapp_ch)
    user_id = uuid4()
    body = {
        "user_id": str(user_id),
        "org_id": str(uuid4()),
        "title": "PR Approved",
    }
    msg = DummyMessage(body, "notification.inapp.alert")
    with patch.object(consumer, "_persist_notification", new_callable=AsyncMock) as mock_persist:
        await consumer._route_message(msg)
        inapp_ch.send.assert_awaited_once()
        mock_persist.assert_awaited_once()


@pytest.mark.asyncio
async def test_route_digest_message():
    consumer = NotificationConsumer()
    body = {"user_id": str(uuid4()), "items": []}
    msg = DummyMessage(body, "notification.digest.daily")
    with patch.object(consumer, "_persist_notification", new_callable=AsyncMock) as mock_persist:
        await consumer._route_message(msg)
        mock_persist.assert_awaited_once()


@pytest.mark.asyncio
async def test_external_service_error_dlq():
    email_ch = AsyncMock()
    email_ch.send.side_effect = ExternalServiceError("SMTP down")
    consumer = NotificationConsumer(email_ch=email_ch)
    body = {"to_email": "test@example.com", "subject": "Hi"}
    msg = DummyMessage(body, "notification.email.send", headers={"x-retry-count": 10})

    await consumer._route_message(msg)
    assert msg.rejected is True
    assert msg.requeue_val is False


@pytest.mark.asyncio
async def test_unexpected_error_dlq():
    email_ch = AsyncMock()
    email_ch.send.side_effect = RuntimeError("Fatal crash")
    consumer = NotificationConsumer(email_ch=email_ch)
    body = {"to_email": "test@example.com"}
    msg = DummyMessage(body, "notification.email.send", headers={"x-retry-count": 10})

    await consumer._route_message(msg)
    assert msg.rejected is True
    assert msg.requeue_val is False


@pytest.mark.asyncio
async def test_persist_notification():
    consumer = NotificationConsumer()
    user_id = str(uuid4())
    org_id = str(uuid4())
    entity_id = str(uuid4())
    body = {
        "user_id": user_id,
        "org_id": org_id,
        "entity_id": entity_id,
        "notification_type": "PR_APPROVAL",
        "title": "Requisition Approved",
        "body": "PR-001 has been approved",
    }
    with patch("app.modules.notification.consumer.get_db_ctx") as mock_ctx, \
         patch("app.modules.notification.consumer.notification_repo.create", new_callable=AsyncMock) as mock_create:
        mock_db = AsyncMock()
        mock_ctx.return_value.__aenter__.return_value = mock_db

        await consumer._persist_notification(body, "notification.email.send")
        mock_create.assert_awaited_once()
        mock_db.commit.assert_awaited_once()
