"""
Integration tests for Option C: Developer Platform & API Key Management:
- Programmatic API key generation with secure prefixing (hkt_live_*)
- Cryptographic SHA-256 key hashing (raw secret never stored in database)
- API key authentication, rate limits, and usage analytics tracking
- Instant key revocation and security isolation
- Webhook subscription lifecycle, HMAC-SHA256 signature generation, and test dispatch
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.main  # noqa: F401
from app.config import settings
from app.core.exceptions import ForbiddenError
from app.modules.developer.models import ApiKey
from app.modules.developer.schemas import (
    ApiKeyCreateRequest,
    WebhookSubscriptionCreateRequest,
    WebhookSubscriptionUpdateRequest,
    WebhookTestPingRequest,
)
from app.modules.developer.service import developer_service
from app.modules.user.models import User

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def seed_developer_test_user(db: AsyncSession, org_id):
    user_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, 'Dev Org', 'Dev Corp', 'IN', 'INR', '{}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id},
    )
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
        VALUES (:id, :org_id, :email, 'hash', 'Dev', 'Lead', 'ACTIVE', 1)
        """),
        {"id": user_id, "org_id": org_id, "email": f"dev-{user_id.hex[:6]}@enterprise.com"},
    )
    await db.commit()
    return user_id


@pytest.mark.asyncio
async def test_api_key_creation_and_hashing():
    org_id = uuid4()
    async with TestSession() as db:
        user_id = await seed_developer_test_user(db, org_id)
        user = await db.get(User, user_id)
        assert user is not None

        req = ApiKeyCreateRequest(
            name="SAP S/4HANA ERP Connector",
            scopes=["read:pos", "write:pos", "read:invoices"],
            rate_limit_rpm=300,
            expires_in_days=30,
        )

        created = await developer_service.create_api_key(db, user, req)

        # Raw secret returned only on creation
        assert created.key_secret.startswith("hkt_live_")
        assert len(created.key_secret) > 30
        assert created.status == "ACTIVE"
        assert created.rate_limit_rpm == 300
        assert "read:pos" in created.scopes

        # Raw secret is NOT stored in DB, only key_hash is stored
        db_key = await db.get(ApiKey, created.id)
        assert db_key is not None
        assert db_key.key_hash != created.key_secret
        assert len(db_key.key_hash) == 64  # SHA-256 hex string

        # Listing keys
        all_keys = await developer_service.list_api_keys(db, org_id)
        assert len(all_keys) >= 1
        found = next(k for k in all_keys if k.id == created.id)
        assert found.name == "SAP S/4HANA ERP Connector"
        assert found.total_requests == 0


@pytest.mark.asyncio
async def test_api_key_authentication_and_usage():
    org_id = uuid4()
    async with TestSession() as db:
        user_id = await seed_developer_test_user(db, org_id)
        user = await db.get(User, user_id)
        assert user is not None

        req = ApiKeyCreateRequest(
            name="Warehouse Intake Scanner Bot",
            scopes=["read:asns", "write:grns"],
            rate_limit_rpm=60,
        )
        created = await developer_service.create_api_key(db, user, req)

        # Authenticate using raw key
        api_key, auth_user = await developer_service.authenticate_api_key(
            db, created.key_secret, client_ip="192.168.1.100"
        )
        assert api_key.id == created.id
        assert auth_user.id == user.id

        # Check usage metrics incremented
        await db.refresh(api_key)
        assert api_key.total_requests == 1
        assert api_key.last_used_ip == "192.168.1.100"
        assert api_key.last_used_at is not None

        # Re-authenticate increments again
        await developer_service.authenticate_api_key(db, created.key_secret)
        await db.refresh(api_key)
        assert api_key.total_requests == 2


@pytest.mark.asyncio
async def test_api_key_revocation():
    org_id = uuid4()
    async with TestSession() as db:
        user_id = await seed_developer_test_user(db, org_id)
        user = await db.get(User, user_id)
        assert user is not None

        req = ApiKeyCreateRequest(name="Legacy Integration Key", scopes=["read:prs"])
        created = await developer_service.create_api_key(db, user, req)

        # Revoke the key
        revoked = await developer_service.revoke_api_key(
            db, user, created.id, reason="Credential rotation policy"
        )
        assert revoked.status == "REVOKED"

        # Subsequent authentication with this key must be rejected
        with pytest.raises(ForbiddenError) as exc_info:
            await developer_service.authenticate_api_key(db, created.key_secret)
        assert "inactive" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_webhook_subscription_lifecycle_and_test_dispatch():
    org_id = uuid4()
    async with TestSession() as db:
        user_id = await seed_developer_test_user(db, org_id)
        user = await db.get(User, user_id)
        assert user is not None

        # 1. Create webhook subscription
        sub_req = WebhookSubscriptionCreateRequest(
            endpoint_url="https://httpbin.org/post",
            description="ERP PO Notifications",
            subscribed_events=["po.created", "asn.dispatched"],
        )
        sub = await developer_service.create_webhook_subscription(db, user, sub_req)
        assert sub.endpoint_url == "https://httpbin.org/post"
        assert sub.secret_token.startswith("whsec_")
        assert "po.created" in sub.subscribed_events

        # 2. Update webhook subscription
        update_req = WebhookSubscriptionUpdateRequest(
            description="Updated ERP Inbound Webhook",
            subscribed_events=["po.created", "asn.dispatched", "grn.received"],
        )
        updated = await developer_service.update_webhook_subscription(
            db, user, sub.id, update_req
        )
        assert updated.description == "Updated ERP Inbound Webhook"
        assert len(updated.subscribed_events) == 3

        # 3. Test ping dispatch
        ping_req = WebhookTestPingRequest(
            event_type="test.ping",
            custom_payload={"test": True, "ping_id": str(uuid4())},
        )
        delivery = await developer_service.test_ping_webhook(db, user, sub.id, ping_req)
        assert delivery.subscription_id == sub.id
        assert delivery.event_type == "test.ping"
        assert delivery.execution_time_ms is not None

        # 4. List deliveries
        deliveries = await developer_service.list_deliveries(db, user, sub.id)
        assert len(deliveries) >= 1
        assert deliveries[0].id == delivery.id

        # 5. Delete webhook subscription
        await developer_service.delete_webhook_subscription(db, user, sub.id)
        remaining = await developer_service.list_webhook_subscriptions(db, org_id)
        assert not any(s.id == sub.id for s in remaining)
