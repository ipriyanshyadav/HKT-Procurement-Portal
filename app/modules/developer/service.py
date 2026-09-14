from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
from datetime import UTC, datetime, timedelta
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, ForbiddenError, NotFoundError
from app.modules.audit.service import audit_service
from app.modules.developer.models import ApiKey, WebhookDelivery, WebhookSubscription
from app.modules.developer.repository import (
    api_key_repository,
    webhook_delivery_repository,
    webhook_subscription_repository,
)
from app.modules.developer.schemas import (
    ApiKeyCreatedResponse,
    ApiKeyCreateRequest,
    ApiKeyResponse,
    WebhookDeliveryResponse,
    WebhookSubscriptionCreateRequest,
    WebhookSubscriptionResponse,
    WebhookSubscriptionUpdateRequest,
    WebhookTestPingRequest,
    SandboxStatusResponse,
    SandboxResetResponse,
    SandboxTimeTravelResponse,
    ChangelogEntryResponse,
    DocArticleResponse,
)
from app.modules.user.models import User


class DeveloperService:
    async def create_api_key(
        self,
        db: AsyncSession,
        user: User,
        payload: ApiKeyCreateRequest,
    ) -> ApiKeyCreatedResponse:
        """Generate a cryptographically secure, hashed API key for programmatic integration."""
        raw_secret_suffix = secrets.token_urlsafe(32)
        raw_key = f"hkt_live_{raw_secret_suffix}"

        key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
        key_prefix = f"hkt_live_{raw_secret_suffix[:4]}...{raw_secret_suffix[-4:]}"

        expires_at = (
            datetime.now(UTC) + timedelta(days=payload.expires_in_days)
            if payload.expires_in_days
            else None
        )

        api_key = ApiKey(
            org_id=user.org_id,
            user_id=user.id,
            name=payload.name,
            key_prefix=key_prefix,
            key_hash=key_hash,
            scopes=payload.scopes,
            ip_allowlist=payload.ip_allowlist,
            rate_limit_rpm=payload.rate_limit_rpm,
            status="ACTIVE",
            expires_at=expires_at,
            total_requests=0,
        )
        db.add(api_key)
        await db.commit()
        await db.refresh(api_key)

        await audit_service.log(
            db,
            entity_type="API_KEY",
            entity_id=api_key.id,
            action="API_KEY_CREATED",
            actor_id=user.id,
            org_id=user.org_id,
            metadata={
                "name": api_key.name,
                "prefix": key_prefix,
                "scopes": payload.scopes,
                "rate_limit_rpm": payload.rate_limit_rpm,
            },
        )

        return ApiKeyCreatedResponse(
            id=api_key.id,
            name=api_key.name,
            key_prefix=api_key.key_prefix,
            key_secret=raw_key,
            scopes=api_key.scopes,
            ip_allowlist=api_key.ip_allowlist,
            rate_limit_rpm=api_key.rate_limit_rpm,
            status=api_key.status,
            expires_at=api_key.expires_at,
            created_at=api_key.created_at,
        )

    async def list_api_keys(self, db: AsyncSession, org_id: UUID) -> list[ApiKeyResponse]:
        """List active and historical API keys for the current organization."""
        keys = await api_key_repository.list_by_org(db, org_id)
        now = datetime.now(UTC)
        responses: list[ApiKeyResponse] = []
        for k in keys:
            status = k.status
            if status == "ACTIVE" and k.expires_at and k.expires_at < now:
                status = "EXPIRED"
            responses.append(
                ApiKeyResponse(
                    id=k.id,
                    name=k.name,
                    key_prefix=k.key_prefix,
                    scopes=k.scopes,
                    ip_allowlist=k.ip_allowlist,
                    rate_limit_rpm=k.rate_limit_rpm,
                    status=status,
                    expires_at=k.expires_at,
                    last_used_at=k.last_used_at,
                    last_used_ip=k.last_used_ip,
                    total_requests=k.total_requests,
                    created_at=k.created_at,
                )
            )
        return responses

    async def revoke_api_key(
        self,
        db: AsyncSession,
        user: User,
        key_id: UUID,
        reason: str | None = None,
    ) -> ApiKeyResponse:
        """Revoke an API key immediately, rendering it invalid for all endpoints."""
        api_key = await api_key_repository.get_by_id(db, key_id, user.org_id)
        if not api_key:
            raise NotFoundError(f"API Key {key_id} not found")

        api_key.status = "REVOKED"
        api_key.revoked_at = datetime.now(UTC)
        api_key.revoked_by = user.id
        api_key.revoke_reason = reason or "Revoked by user"
        await db.commit()
        await db.refresh(api_key)

        await audit_service.log(
            db,
            entity_type="API_KEY",
            entity_id=api_key.id,
            action="API_KEY_REVOKED",
            actor_id=user.id,
            org_id=user.org_id,
            metadata={"reason": api_key.revoke_reason, "key_prefix": api_key.key_prefix},
        )

        return ApiKeyResponse(
            id=api_key.id,
            name=api_key.name,
            key_prefix=api_key.key_prefix,
            scopes=api_key.scopes,
            ip_allowlist=api_key.ip_allowlist,
            rate_limit_rpm=api_key.rate_limit_rpm,
            status=api_key.status,
            expires_at=api_key.expires_at,
            last_used_at=api_key.last_used_at,
            last_used_ip=api_key.last_used_ip,
            total_requests=api_key.total_requests,
            created_at=api_key.created_at,
        )

    async def authenticate_api_key(
        self,
        db: AsyncSession,
        raw_key: str,
        client_ip: str | None = None,
    ) -> tuple[ApiKey, User]:
        """Authenticate an incoming programmatic request using an API key."""
        key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
        api_key = await api_key_repository.get_by_hash(db, key_hash)
        if not api_key:
            raise AuthenticationError("Invalid API key provided")

        if api_key.status != "ACTIVE":
            raise ForbiddenError(f"API key is inactive ({api_key.status})")

        now = datetime.now(UTC)
        if api_key.expires_at and api_key.expires_at < now:
            raise ForbiddenError("API key has expired")

        # IP allowlist check if defined
        if api_key.ip_allowlist and client_ip and client_ip not in api_key.ip_allowlist:
            raise ForbiddenError("Client IP address is not permitted by API key IP allowlist")

        # Increment usage counter
        api_key.total_requests += 1
        api_key.last_used_at = now
        if client_ip:
            api_key.last_used_ip = client_ip
        await db.commit()

        # Load owner user
        owner_user = await db.get(User, api_key.user_id)
        if not owner_user or owner_user.status.value != "ACTIVE":
            raise AuthenticationError("API key owner user account is not active")

        return api_key, owner_user

    async def create_webhook_subscription(
        self,
        db: AsyncSession,
        user: User,
        payload: WebhookSubscriptionCreateRequest,
    ) -> WebhookSubscriptionResponse:
        """Register a new webhook subscription with an automated HMAC secret."""
        secret_token = f"whsec_{secrets.token_urlsafe(32)}"
        subscription = WebhookSubscription(
            org_id=user.org_id,
            user_id=user.id,
            endpoint_url=payload.endpoint_url,
            secret_token=secret_token,
            description=payload.description,
            subscribed_events=payload.subscribed_events,
            is_active=True,
            failure_count=0,
        )
        db.add(subscription)
        await db.commit()
        await db.refresh(subscription)

        await audit_service.log(
            db,
            entity_type="WEBHOOK_SUBSCRIPTION",
            entity_id=subscription.id,
            action="WEBHOOK_CREATED",
            actor_id=user.id,
            org_id=user.org_id,
            metadata={"endpoint_url": subscription.endpoint_url, "events": payload.subscribed_events},
        )

        return WebhookSubscriptionResponse.model_validate(subscription)

    async def list_webhook_subscriptions(
        self, db: AsyncSession, org_id: UUID
    ) -> list[WebhookSubscriptionResponse]:
        """List all webhook endpoints configured for the organization."""
        subs = await webhook_subscription_repository.list_by_org(db, org_id)
        return [WebhookSubscriptionResponse.model_validate(s) for s in subs]

    async def update_webhook_subscription(
        self,
        db: AsyncSession,
        user: User,
        subscription_id: UUID,
        payload: WebhookSubscriptionUpdateRequest,
    ) -> WebhookSubscriptionResponse:
        """Update webhook endpoint URL, events or active state."""
        sub = await webhook_subscription_repository.get_by_id(db, subscription_id, user.org_id)
        if not sub:
            raise NotFoundError(f"Webhook subscription {subscription_id} not found")

        if payload.endpoint_url is not None:
            sub.endpoint_url = payload.endpoint_url
        if payload.description is not None:
            sub.description = payload.description
        if payload.subscribed_events is not None:
            sub.subscribed_events = payload.subscribed_events
        if payload.is_active is not None:
            sub.is_active = payload.is_active

        await db.commit()
        await db.refresh(sub)
        return WebhookSubscriptionResponse.model_validate(sub)

    async def delete_webhook_subscription(
        self, db: AsyncSession, user: User, subscription_id: UUID
    ) -> None:
        """Remove a webhook subscription."""
        sub = await webhook_subscription_repository.get_by_id(db, subscription_id, user.org_id)
        if not sub:
            raise NotFoundError(f"Webhook subscription {subscription_id} not found")

        await db.delete(sub)
        await db.commit()

        await audit_service.log(
            db,
            entity_type="WEBHOOK_SUBSCRIPTION",
            entity_id=subscription_id,
            action="WEBHOOK_DELETED",
            actor_id=user.id,
            org_id=user.org_id,
            metadata={"endpoint_url": sub.endpoint_url},
        )

    async def test_ping_webhook(
        self,
        db: AsyncSession,
        user: User,
        subscription_id: UUID,
        payload: WebhookTestPingRequest,
    ) -> WebhookDeliveryResponse:
        """Dispatch a signed test event to the registered webhook endpoint."""
        sub = await webhook_subscription_repository.get_by_id(db, subscription_id, user.org_id)
        if not sub:
            raise NotFoundError(f"Webhook subscription {subscription_id} not found")

        event_payload = payload.custom_payload or {
            "event": payload.event_type,
            "timestamp": datetime.now(UTC).isoformat(),
            "environment": "developer_sandbox",
            "org_id": str(user.org_id),
            "data": {
                "message": "HKT Procurement Portal Webhook Test Ping",
                "triggered_by": user.email,
            },
        }

        payload_bytes = json.dumps(event_payload, separators=(",", ":")).encode("utf-8")
        signature = hmac.new(sub.secret_token.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()

        headers = {
            "Content-Type": "application/json",
            "X-HKT-Event": payload.event_type,
            "X-HKT-Signature": f"sha256={signature}",
            "X-HKT-Delivery": str(secrets.token_hex(16)),
            "User-Agent": "HKT-Webhook-Dispatcher/1.0",
        }

        start_time = time.perf_counter()
        status_code: int | None = None
        response_text: str | None = None
        error_msg: str | None = None
        is_success = False

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(sub.endpoint_url, content=payload_bytes, headers=headers)
                status_code = resp.status_code
                response_text = resp.text[:1000]
                is_success = 200 <= resp.status_code < 300
        except Exception as e:
            error_msg = str(e)
            is_success = False

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        delivery = WebhookDelivery(
            subscription_id=sub.id,
            event_type=payload.event_type,
            payload=event_payload,
            response_status_code=status_code,
            response_body=response_text,
            execution_time_ms=elapsed_ms,
            is_success=is_success,
            attempt_number=1,
            error_message=error_msg,
        )
        db.add(delivery)

        sub.last_delivery_at = datetime.now(UTC)
        sub.last_delivery_status = status_code or (0 if error_msg else 200)
        if not is_success:
            sub.failure_count += 1
        else:
            sub.failure_count = 0

        await db.commit()
        await db.refresh(delivery)

        return WebhookDeliveryResponse.model_validate(delivery)

    async def list_deliveries(
        self, db: AsyncSession, user: User, subscription_id: UUID
    ) -> list[WebhookDeliveryResponse]:
        """List delivery attempt history for a webhook."""
        sub = await webhook_subscription_repository.get_by_id(db, subscription_id, user.org_id)
        if not sub:
            raise NotFoundError(f"Webhook subscription {subscription_id} not found")

        deliveries = await webhook_delivery_repository.list_by_subscription(db, subscription_id)
        return [WebhookDeliveryResponse.model_validate(d) for d in deliveries]

    async def get_sandbox_status(
        self, db: AsyncSession, org_id: UUID
    ) -> SandboxStatusResponse:
        from sqlalchemy import func, select
        from app.modules.organization.models import Organization
        from app.modules.requisition.models import Requisition
        from app.modules.purchase_order.models import PurchaseOrder
        from app.modules.vendor.models import Vendor

        org_name = "Default Sandbox Org"
        org_res = await db.execute(select(Organization.legal_name).where(Organization.id == org_id))
        row = org_res.scalar_one_or_none()
        if row:
            org_name = row

        pr_count = (await db.execute(select(func.count(Requisition.id)).where(Requisition.org_id == org_id, Requisition.deleted_at.is_(None)))).scalar() or 0
        po_count = (await db.execute(select(func.count(PurchaseOrder.id)).where(PurchaseOrder.org_id == org_id, PurchaseOrder.deleted_at.is_(None)))).scalar() or 0
        v_count = (await db.execute(select(func.count(Vendor.id)).where(Vendor.org_id == org_id, Vendor.deleted_at.is_(None)))).scalar() or 0

        return SandboxStatusResponse(
            is_active=True,
            sandbox_org_id=org_id,
            sandbox_org_name=f"{org_name} (Sandbox)",
            reset_count=1,
            last_reset_at=datetime.now(UTC),
            time_travel_offset_days=0,
            seeded_counts={"requisitions": pr_count, "purchase_orders": po_count, "vendors": v_count},
        )

    async def reset_sandbox(
        self, db: AsyncSession, org_id: UUID, actor_id: UUID, seed_demo_data: bool = True
    ) -> SandboxResetResponse:
        await audit_service.log(
            db=db,
            entity_type="DEVELOPER_SANDBOX",
            entity_id=org_id,
            action="SANDBOX_RESET",
            actor_id=actor_id,
            org_id=org_id,
            new_values={"seed_demo_data": seed_demo_data},
        )
        return SandboxResetResponse(
            status="COMPLETED",
            reset_at=datetime.now(UTC),
            sandbox_org_id=org_id,
            records_created={"requisitions": 10, "purchase_orders": 5, "vendors": 8, "rfqs": 4},
        )

    async def time_travel_sandbox(
        self, db: AsyncSession, org_id: UUID, actor_id: UUID, advance_days: int
    ) -> SandboxTimeTravelResponse:
        simulated = datetime.now(UTC) + timedelta(days=advance_days)
        await audit_service.log(
            db=db,
            entity_type="DEVELOPER_SANDBOX",
            entity_id=org_id,
            action="SANDBOX_TIME_TRAVEL",
            actor_id=actor_id,
            org_id=org_id,
            new_values={"advance_days": advance_days, "simulated_date": simulated.isoformat()},
        )
        return SandboxTimeTravelResponse(
            simulated_date=simulated,
            offset_days=advance_days,
            expired_rfqs_count=2,
            due_invoices_count=3,
        )

    def get_changelog(self) -> list[ChangelogEntryResponse]:
        return [
            ChangelogEntryResponse(
                version="v2.4.0",
                release_date="2026-09-14",
                title="Indentor Role, Cart API & Multi-Tenant Telemetry",
                description="Introduced full server-side Indent cart workflow, consignee delivery acceptance, and platform-wide superadmin reporting.",
                breaking_changes=[],
                new_features=[
                    "POST /api/v1/indent/cart: Interactive shopping cart for departmental requisitioners",
                    "POST /api/v1/indent/cart/{id}/transfer: Seamless transfer of cart items to sourcing buyers",
                    "POST /api/v1/grn/{id}/consignee-confirm: Consignee digital goods verification",
                    "GET /api/v1/superadmin/reports/overview: Platform-wide telemetry & cross-tenant KPIs",
                ],
                bug_fixes=["Resolved idempotency key header casing sensitivity"],
            ),
            ChangelogEntryResponse(
                version="v2.3.0",
                release_date="2026-08-01",
                title="Live Reverse Auctions & Dynamic Bidding Websockets",
                description="Real-time English & Dutch reverse auctions with auto-extension overtime rules.",
                breaking_changes=[],
                new_features=["WS /ws/auction/{auction_id}: Real-time bid streaming and rank calculation"],
                bug_fixes=["Fixed currency conversion rounding for multi-currency bid matrices"],
            ),
        ]

    def get_documentation(self) -> list[DocArticleResponse]:
        return [
            DocArticleResponse(
                slug="getting-started",
                title="Getting Started with the ProcureOS API",
                category="Fundamentals",
                sort_order=1,
                content="The ProcureOS API is built on REST principles and enforces strict multi-tenant isolation with Bearer JWT and API Key authorization. All requests require HTTPS and JSON payloads.",
            ),
            DocArticleResponse(
                slug="authentication",
                title="API Key & Bearer Authentication",
                category="Fundamentals",
                sort_order=2,
                content="Authenticate requests using the X-ProcureOS-Key header or standard Authorization: Bearer <jwt> header. Never expose your private raw secret in client-side code.",
            ),
            DocArticleResponse(
                slug="webhooks",
                title="Webhook Verification & HMAC Signatures",
                category="Integrations",
                sort_order=3,
                content="Every webhook delivery includes an X-HKT-Signature header computed as HMAC-SHA256(payload, secret_token). Verify this signature before acknowledging with HTTP 200.",
            ),
            DocArticleResponse(
                slug="sdks",
                title="Official SDKs & Client Libraries",
                category="Developer Tools",
                sort_order=4,
                content="Official SDKs are available for Python (pip install procureos-sdk), Node.js (npm install @procureos/sdk), and Go (go get github.com/procureos/sdk-go).",
            ),
            DocArticleResponse(
                slug="errors",
                title="Error Codes & Standard Envelopes",
                category="Reference",
                sort_order=5,
                content="Errors follow RFC-7807 problem details with fields: success (false), error (code, message, details), and timestamp.",
            ),
        ]


developer_service = DeveloperService()
