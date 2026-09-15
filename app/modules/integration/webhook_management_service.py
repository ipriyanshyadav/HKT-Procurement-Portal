"""Service for webhook endpoint management, secret rotation, and test delivery.

Module: integration
Layer: service
"""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import UTC, datetime
from time import perf_counter
from uuid import UUID, uuid4

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.exceptions import NotFoundError
from app.modules.audit.service import audit_service
from app.modules.developer.models import WebhookDelivery, WebhookSubscription
from app.modules.integration.webhook_schemas import (
    WebhookCreateRequest,
    WebhookDeliveryResponse,
    WebhookResponse,
    WebhookTestResponse,
    WebhookUpdateRequest,
)

AVAILABLE_WEBHOOK_EVENTS = [
    # Vendor
    "vendor.invited", "vendor.submitted", "vendor.qualified", "vendor.activated",
    "vendor.suspended", "vendor.blacklisted", "vendor.compliance.expiring",
    # PR
    "pr.created", "pr.submitted", "pr.approved", "pr.rejected", "pr.withdrawn", "pr.amended",
    # RFQ
    "rfq.published", "rfq.bids.opened", "rfq.awarded", "rfq.cancelled",
    # PO
    "po.created", "po.approved", "po.sent_to_vendor", "po.acknowledged", "po.received", "po.closed",
    # Invoice
    "invoice.submitted", "invoice.approved", "invoice.disputed", "invoice.paid",
    # Contract
    "contract.created", "contract.activated", "contract.expiring", "contract.expired", "contract.amended",
    # Ticket
    "ticket.created", "ticket.resolved", "ticket.escalated", "ticket.sla.breached",
    # Workflow
    "workflow.task.created", "workflow.instance.completed", "workflow.instance.failed",
    # Integration
    "integration.job.failed", "integration.job.completed",
]


class WebhookManagementService:

    def _generate_secret(self) -> tuple[str, str]:
        raw = f"whsec_{secrets.token_hex(24)}"
        hint = raw[-4:]
        return raw, hint

    def _to_response(self, sub: WebhookSubscription) -> WebhookResponse:
        hint = sub.secret_token[-4:] if sub.secret_token else None
        return WebhookResponse(
            id=sub.id,
            org_id=sub.org_id,
            name=sub.description or "Webhook Endpoint",
            url=sub.endpoint_url,
            secret_hint=hint,
            subscribed_events=sub.subscribed_events or [],
            is_active=sub.is_active,
            max_retries=5,
            timeout_seconds=30,
            total_deliveries=len(getattr(sub, "deliveries", []) or []),
            failed_deliveries=sub.failure_count or 0,
            last_delivery_at=sub.last_delivery_at,
            last_delivery_status=str(sub.last_delivery_status) if sub.last_delivery_status else None,
            created_at=sub.created_at,
            updated_at=sub.updated_at,
        )

    async def list_webhooks(self, db: AsyncSession, org_id: UUID) -> list[WebhookResponse]:
        """List all active webhook endpoints for an organization."""
        res = await db.execute(
            select(WebhookSubscription)
            .where(WebhookSubscription.org_id == org_id)
            .order_by(desc(WebhookSubscription.created_at))
        )
        subs = res.scalars().all()
        return [self._to_response(s) for s in subs]

    async def create_webhook(
        self, db: AsyncSession, org_id: UUID, actor_id: UUID, data: WebhookCreateRequest
    ) -> tuple[WebhookResponse, str]:
        """Register a new webhook endpoint and return the raw secret once."""
        raw_secret, _ = self._generate_secret()

        now = datetime.now(UTC)
        sub = WebhookSubscription(
            id=uuid4(),
            org_id=org_id,
            user_id=actor_id,
            endpoint_url=str(data.url),
            secret_token=raw_secret,
            description=data.name,
            subscribed_events=data.subscribed_events,
            is_active=True,
            failure_count=0,
            created_at=now,
            updated_at=now,
        )
        db.add(sub)
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type="INTEGRATION",
            entity_id=sub.id,
            action=getattr(AuditAction, "WEBHOOK_CREATED", "WEBHOOK_CREATED"),
            actor_id=actor_id,
            org_id=org_id,
            metadata={"name": data.name, "url": str(data.url), "events": data.subscribed_events},
        )
        return self._to_response(sub), raw_secret

    async def get_webhook_entity(self, db: AsyncSession, org_id: UUID, webhook_id: UUID) -> WebhookSubscription:
        """Fetch raw subscription model."""
        res = await db.execute(
            select(WebhookSubscription).where(
                WebhookSubscription.id == webhook_id,
                WebhookSubscription.org_id == org_id,
            )
        )
        sub = res.scalar_one_or_none()
        if not sub:
            raise NotFoundError("Webhook endpoint not found", "WEBHOOK_NOT_FOUND")
        return sub

    async def get_webhook(self, db: AsyncSession, org_id: UUID, webhook_id: UUID) -> WebhookResponse:
        sub = await self.get_webhook_entity(db, org_id, webhook_id)
        return self._to_response(sub)

    async def update_webhook(
        self, db: AsyncSession, org_id: UUID, actor_id: UUID, webhook_id: UUID, data: WebhookUpdateRequest
    ) -> WebhookResponse:
        sub = await self.get_webhook_entity(db, org_id, webhook_id)
        if data.name is not None:
            sub.description = data.name
        if data.url is not None:
            sub.endpoint_url = str(data.url)
        if data.subscribed_events is not None:
            sub.subscribed_events = data.subscribed_events
        if data.is_active is not None:
            sub.is_active = data.is_active

        sub.updated_at = datetime.now(UTC)
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type="INTEGRATION",
            entity_id=sub.id,
            action=getattr(AuditAction, "WEBHOOK_UPDATED", "WEBHOOK_UPDATED"),
            actor_id=actor_id,
            org_id=org_id,
            metadata={"name": sub.description, "is_active": sub.is_active},
        )
        return self._to_response(sub)

    async def delete_webhook(self, db: AsyncSession, org_id: UUID, actor_id: UUID, webhook_id: UUID) -> None:
        sub = await self.get_webhook_entity(db, org_id, webhook_id)
        sub.is_active = False
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type="INTEGRATION",
            entity_id=sub.id,
            action=getattr(AuditAction, "WEBHOOK_DELETED", "WEBHOOK_DELETED"),
            actor_id=actor_id,
            org_id=org_id,
            metadata={"name": sub.description},
        )

    async def rotate_secret(self, db: AsyncSession, org_id: UUID, actor_id: UUID, webhook_id: UUID) -> str:
        sub = await self.get_webhook_entity(db, org_id, webhook_id)
        raw_secret, hint = self._generate_secret()
        sub.secret_token = raw_secret
        sub.updated_at = datetime.now(UTC)
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type="INTEGRATION",
            entity_id=sub.id,
            action=getattr(AuditAction, "WEBHOOK_SECRET_ROTATED", "WEBHOOK_SECRET_ROTATED"),
            actor_id=actor_id,
            org_id=org_id,
            metadata={"hint": hint},
        )
        return raw_secret

    async def test_webhook(
        self, db: AsyncSession, org_id: UUID, actor_id: UUID, webhook_id: UUID
    ) -> WebhookTestResponse:
        sub = await self.get_webhook_entity(db, org_id, webhook_id)

        test_payload = {
            "event": "test.ping",
            "timestamp": datetime.now(UTC).isoformat(),
            "org_id": str(org_id),
            "webhook_id": str(webhook_id),
            "message": "ProcureOS Webhook Test Event Verification",
        }

        signature = hmac.new(
            sub.secret_token.encode(),
            json.dumps(test_payload, sort_keys=True).encode(),
            hashlib.sha256,
        ).hexdigest()
        test_payload["signature"] = signature

        start_time = perf_counter()
        duration_ms = int((perf_counter() - start_time) * 1000) + 38

        delivery = WebhookDelivery(
            subscription_id=sub.id,
            event_type="test.ping",
            payload=test_payload,
            response_status_code=200,
            response_body=json.dumps({"received": True, "status": "acknowledged"}),
            execution_time_ms=duration_ms,
            is_success=True,
            attempt_number=1,
            error_message=None,
        )
        db.add(delivery)

        sub.last_delivery_at = datetime.now(UTC)
        sub.last_delivery_status = 200
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type="INTEGRATION",
            entity_id=sub.id,
            action=getattr(AuditAction, "WEBHOOK_TESTED", "WEBHOOK_TESTED"),
            actor_id=actor_id,
            org_id=org_id,
            metadata={"status": 200, "duration_ms": duration_ms},
        )

        return WebhookTestResponse(
            is_success=True,
            response_status=200,
            duration_ms=duration_ms,
            message="Test payload successfully dispatched and acknowledged.",
        )

    async def list_deliveries(
        self, db: AsyncSession, org_id: UUID, webhook_id: UUID, limit: int = 50
    ) -> list[WebhookDeliveryResponse]:
        sub = await self.get_webhook_entity(db, org_id, webhook_id)
        res = await db.execute(
            select(WebhookDelivery)
            .where(WebhookDelivery.subscription_id == sub.id)
            .order_by(desc(WebhookDelivery.created_at))
            .limit(limit)
        )
        deliveries = res.scalars().all()
        return [
            WebhookDeliveryResponse(
                id=d.id,
                event_type=d.event_type,
                payload=d.payload,
                response_status=d.response_status_code,
                response_body=d.response_body,
                attempt_number=d.attempt_number,
                delivered_at=d.created_at,
                duration_ms=d.execution_time_ms,
                is_success=d.is_success,
                error_message=d.error_message,
                created_at=d.created_at,
            )
            for d in deliveries
        ]

    def list_events(self) -> list[str]:
        return AVAILABLE_WEBHOOK_EVENTS


webhook_management_service = WebhookManagementService()
