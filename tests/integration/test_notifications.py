from __future__ import annotations
import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4, UUID
import pytest
import httpx
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.auth.jwt import create_access_token
from app.auth.dependencies import get_current_user
from app.config import settings
from app.core.exceptions import ExternalServiceError
from app.core.redis_client import RedisKeys
from app.db.enums import NotificationChannelEnum, NotificationStatusEnum, UserStatusEnum
from app.db.session import get_db
from app.main import app
from app.modules.notification.channels.email import EmailChannel
from app.modules.notification.channels.sms import SMSChannel
from app.modules.notification.channels.inapp import InAppChannel
from app.modules.notification.channels.whatsapp import WhatsAppChannel
from app.modules.notification.consumer import NotificationConsumer
from app.modules.notification.models import Notification, NotificationPreference, NotificationTemplate
from app.modules.notification.repository import notification_repo, preference_repo, template_repo
from app.modules.notification.service import NotificationService
from app.modules.user.models import User
from app.tasks.notification_digest import is_digest_excluded, compile_notification_digests_async

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)

@asynccontextmanager
async def get_test_db_session():
    async with TestSession() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

async def create_test_org_and_user(db: AsyncSession, org_id: UUID, user_id: UUID) -> User:
    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency)
        VALUES (:id, :name, :legal_name, 'IN', 'INR')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id, "name": f"Org {org_id.hex[:6]}", "legal_name": f"Legal {org_id.hex[:6]}"},
    )
    email = f"user-{user_id.hex[:6]}@test.com"
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
        VALUES (:id, :org_id, :email, 'hash', 'Test', 'User', 'ACTIVE', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": user_id, "org_id": org_id, "email": email},
    )
    await db.commit()
    return User(
        id=user_id,
        org_id=org_id,
        email=email,
        first_name="Test",
        last_name="User",
        status=UserStatusEnum.ACTIVE,
    )

# ==========================================
# 1. WebSocket Authentication Tests
# ==========================================

def test_websocket_auth_invalid_token():
    """Invalid token → WebSocket closed with 4001."""
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/notifications?token=invalid_token"):
            pass
    assert exc_info.value.code == 4001

def test_websocket_auth_missing_token():
    """Missing token → WebSocket closed with 4001."""
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/notifications"):
            pass
    assert exc_info.value.code == 4001

def test_websocket_connect_valid_token():
    """Valid token → WebSocket connects and responds to ping."""
    client = TestClient(app)
    user_id = uuid4()
    org_id = uuid4()
    token = create_access_token(
        user_id=user_id,
        org_id=org_id,
        email="test@user.com",
        roles=["REQUESTOR"],
        bu_scope=[],
        category_scope=[],
        plant_scope=[],
        is_supplier_user=False,
        vendor_id=None,
        jti=f"jti-{uuid4()}",
    )
    with client.websocket_connect(f"/ws/notifications?token={token}") as ws:
        ws.send_text(json.dumps({"type": "ping"}))
        response = ws.receive_text()
        data = json.loads(response)
        assert data.get("type") == "pong"

# ==========================================
# 2. In-App Channel Redis Pub/Sub Tests
# ==========================================

@pytest.mark.asyncio
async def test_inapp_notification_delivered_via_redis():
    """InAppChannel.send() publishes notification payload to correct Redis channel."""
    inapp = InAppChannel()
    user_id = uuid4()
    channel_key = RedisKeys.notification_channel(user_id)

    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock(return_value=1)

    with patch("app.modules.notification.channels.inapp.get_redis", return_value=mock_redis):
        result = await inapp.send(
            user_id=user_id,
            notification={
                "id": str(uuid4()),
                "title": "PR Approved",
                "body": "Your PR PR-001 has been approved.",
                "notification_type": "pr_approved",
            },
        )
        assert result is True
        assert mock_redis.publish.called
        call_channel, call_payload = mock_redis.publish.call_args[0]
        assert call_channel == channel_key
        payload_dict = json.loads(call_payload)
        assert payload_dict["title"] == "PR Approved"
        assert payload_dict["user_id"] == str(user_id)

# ==========================================
# 3. WhatsApp Stub Channel Tests
# ==========================================

@pytest.mark.asyncio
async def test_whatsapp_stub_returns_202():
    """WhatsApp channel returns 202 with stub warning log."""
    wa = WhatsAppChannel()
    status_code = await wa.send(
        to_phone="+919876543210",
        message="Hello from Procurement",
        template_code="po_released",
    )
    assert status_code == 202

# ==========================================
# 4. Email Channel & Failure Handling Tests
# ==========================================

@pytest.mark.asyncio
async def test_email_retry_on_sendgrid_failure():
    """SendGrid 500 → raises ExternalServiceError for consumer retry."""
    email_ch = EmailChannel(api_url="https://api.sendgrid.com/v3/mail/send")

    mock_response = MagicMock()
    mock_response.status_code = 500

    with patch("app.modules.notification.channels.email.settings.SENDGRID_API_KEY", "real-sg-key"):
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
            with pytest.raises(ExternalServiceError) as exc_info:
                await email_ch.send(
                    to_email="vendor@example.com",
                    subject="PO Released",
                    body_html="<p>PO Released</p>",
                )
            assert "SENDGRID_FAILED" in str(exc_info.value.code)

# ==========================================
# 5. SMS Channel Tests (160 char splitting)
# ==========================================

def test_sms_channel_split_long_message():
    """SMS channel correctly splits messages longer than 160 characters."""
    sms_ch = SMSChannel()
    short_msg = "Short message under limit"
    assert len(sms_ch.split_message(short_msg)) == 1

    long_msg = "A" * 350
    chunks = sms_ch.split_message(long_msg)
    assert len(chunks) == 3
    assert len(chunks[0]) == 160
    assert len(chunks[1]) == 160
    assert len(chunks[2]) == 30

# ==========================================
# 6. Digest Exclusion Tests (NEVER SLA_BREACH / COMPLIANCE)
# ==========================================

def test_digest_excludes_sla_breach_and_compliance():
    """SLA_BREACH and COMPLIANCE notification types are identified as excluded from digest."""
    assert is_digest_excluded("sla_breach") is True
    assert is_digest_excluded("SLA_BREACH_WARNING") is True
    assert is_digest_excluded("approval_sla_escalation") is True
    assert is_digest_excluded("vendor_compliance_hold") is True
    assert is_digest_excluded("compliance_alert") is True
    assert is_digest_excluded("pr_submitted") is False
    assert is_digest_excluded("invoice_matched") is False

@pytest.mark.asyncio
async def test_digest_task_aggregates_eligible_notifications():
    """Digest task aggregates pending digest notifications and sends single email."""
    org_id = uuid4()
    user_id = uuid4()

    async with TestSession() as db:
        await db.execute(text("DELETE FROM notifications WHERE channel = 'DIGEST' AND status = 'PENDING'"))
        user = await create_test_org_and_user(db, org_id, user_id)

        # 1 eligible digest notification
        n1 = Notification(
            org_id=org_id,
            user_id=user_id,
            notification_type="pr_approved",
            channel=NotificationChannelEnum.DIGEST,
            title="PR Approved Digest",
            body="PR 100 has been approved.",
            status=NotificationStatusEnum.PENDING,
        )
        # 1 SLA_BREACH notification (should be excluded)
        n2 = Notification(
            org_id=org_id,
            user_id=user_id,
            notification_type="sla_breach_warning",
            channel=NotificationChannelEnum.DIGEST,
            title="SLA Breach Alert",
            body="PR 100 breached 24h SLA threshold.",
            status=NotificationStatusEnum.PENDING,
        )
        db.add_all([n1, n2])
        await db.commit()

    with patch("app.tasks.notification_digest.get_db_ctx", side_effect=get_test_db_session):
        with patch("app.tasks.notification_digest.email_channel.send", new_callable=AsyncMock, return_value=True) as mock_send:
            sent_count = await compile_notification_digests_async()
            assert sent_count >= 1
            user_calls = [c.kwargs for c in mock_send.call_args_list if c.kwargs.get("to_email") == user.email]
            assert len(user_calls) == 1
            args = user_calls[0]
            assert "Digest (1 updates)" in args["subject"]
            assert "PR Approved Digest" in args["body_html"]
            assert "SLA Breach Alert" not in args["body_html"]

# ==========================================
# 7. Service Layer & Preferences Tests
# ==========================================

@pytest.mark.asyncio
async def test_user_preferences_respected():
    """User preference email_enabled=False results in no email notification."""
    org_id = uuid4()
    user_id = uuid4()

    service = NotificationService()
    mock_email = AsyncMock(return_value=True)
    service.email_channel.send = mock_email
    service.inapp_channel.send = AsyncMock(return_value=True)

    async with TestSession() as db:
        await create_test_org_and_user(db, org_id, user_id)

        # Set user preference: email disabled
        await preference_repo.upsert_preference(
            db,
            user_id=user_id,
            org_id=org_id,
            notification_type="pr_submitted",
            email_enabled=False,
            inapp_enabled=True,
        )
        await db.commit()

        # Dispatch PR submitted
        notifs = await service.dispatch(
            db,
            user_id=user_id,
            org_id=org_id,
            notification_type="pr_submitted",
            title="PR Submitted",
            body="A PR was submitted",
            to_email="test@example.com",
        )

        channels = [n.channel for n in notifs]
        assert NotificationChannelEnum.IN_APP in channels
        assert NotificationChannelEnum.EMAIL not in channels
        assert not mock_email.called

@pytest.mark.asyncio
async def test_critical_notification_bypasses_mute_and_digest():
    """Critical notifications (e.g. approval_sla_escalation) bypass muted preferences."""
    org_id = uuid4()
    user_id = uuid4()

    service = NotificationService()
    mock_email = AsyncMock(return_value=True)
    service.email_channel.send = mock_email
    service.inapp_channel.send = AsyncMock(return_value=True)

    async with TestSession() as db:
        await create_test_org_and_user(db, org_id, user_id)

        # Mute everything for approval_sla_escalation
        await preference_repo.upsert_preference(
            db,
            user_id=user_id,
            org_id=org_id,
            notification_type="approval_sla_escalation",
            email_enabled=False,
            inapp_enabled=False,
            digest_mode=True,
        )
        await db.commit()

        notifs = await service.dispatch(
            db,
            user_id=user_id,
            org_id=org_id,
            notification_type="approval_sla_escalation",
            title="CRITICAL SLA ESCALATION",
            body="Task overdue",
            to_email="test@example.com",
        )

        channels = [n.channel for n in notifs]
        assert NotificationChannelEnum.IN_APP in channels
        assert NotificationChannelEnum.EMAIL in channels
        assert NotificationChannelEnum.DIGEST not in channels
        assert mock_email.called

# ==========================================
# 8. Notification Router REST Endpoints
# ==========================================

@pytest.mark.asyncio
async def test_notification_router_crud():
    """Test full HTTP notification lifecycle: list, mark read, mark all read, preferences."""
    org_id = uuid4()
    user_id = uuid4()

    async with TestSession() as db:
        user = await create_test_org_and_user(db, org_id, user_id)

        # Create two notifications for user
        n1 = Notification(
            org_id=org_id,
            user_id=user_id,
            notification_type="rfq_published",
            channel=NotificationChannelEnum.IN_APP,
            title="New RFQ Available",
            body="RFQ 2026-001 has been published.",
            status=NotificationStatusEnum.SENT,
        )
        n2 = Notification(
            org_id=org_id,
            user_id=user_id,
            notification_type="po_released",
            channel=NotificationChannelEnum.IN_APP,
            title="PO Released",
            body="PO 2026-009 released.",
            status=NotificationStatusEnum.SENT,
        )
        db.add_all([n1, n2])
        await db.commit()
        n1_id = n1.id

    async def override_get_db():
        async with TestSession() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: user

    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. GET /api/v1/notifications
            res = await client.get("/api/v1/notifications")
            assert res.status_code == 200
            data = res.json()
            assert len(data["data"]) >= 2
            assert data["meta"]["unread_count"] >= 2

            # 2. POST /api/v1/notifications/{id}/read
            res_read = await client.post(f"/api/v1/notifications/{n1_id}/read")
            assert res_read.status_code == 200
            assert res_read.json()["data"]["is_read"] is True

            # Check list again — unread_count decremented
            res_list2 = await client.get("/api/v1/notifications")
            assert res_list2.json()["meta"]["unread_count"] == data["meta"]["unread_count"] - 1

            # 3. POST /api/v1/notifications/mark-all-read
            res_mark_all = await client.post("/api/v1/notifications/mark-all-read")
            assert res_mark_all.status_code == 200
            assert res_mark_all.json()["data"]["updated_count"] >= 1

            # Check list again — unread_count is 0
            res_list3 = await client.get("/api/v1/notifications")
            assert res_list3.json()["meta"]["unread_count"] == 0

            # 4. GET & PUT /api/v1/notifications/preferences
            pref_payload = {
                "preferences": [
                    {
                        "notification_type": "pr_submitted",
                        "email_enabled": True,
                        "sms_enabled": False,
                        "inapp_enabled": True,
                        "digest_mode": False,
                    },
                    {
                        "notification_type": "pr_aging",
                        "email_enabled": False,
                        "sms_enabled": False,
                        "inapp_enabled": True,
                        "digest_mode": True,
                    },
                ]
            }
            res_put_pref = await client.put("/api/v1/notifications/preferences", json=pref_payload)
            assert res_put_pref.status_code == 200
            assert len(res_put_pref.json()["data"]) == 2

            res_get_pref = await client.get("/api/v1/notifications/preferences")
            assert res_get_pref.status_code == 200
            saved_types = [p["notification_type"] for p in res_get_pref.json()["data"]]
            assert "pr_submitted" in saved_types
            assert "pr_aging" in saved_types
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
