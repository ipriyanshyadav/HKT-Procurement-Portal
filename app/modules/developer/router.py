from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import APIResponse, created_response, success_response
from app.db.session import get_db
from app.modules.developer.schemas import (
    ApiKeyCreatedResponse,
    ApiKeyCreateRequest,
    ApiKeyResponse,
    ApiKeyRevokeRequest,
    WebhookDeliveryResponse,
    WebhookSubscriptionCreateRequest,
    WebhookSubscriptionResponse,
    WebhookSubscriptionUpdateRequest,
    WebhookTestPingRequest,
)
from app.modules.developer.service import developer_service
from app.modules.user.models import User

router = APIRouter(tags=["Developer Platform"])

AVAILABLE_SCOPES = [
    {"scope": "read:prs", "description": "Read purchase requisitions and approval status"},
    {"scope": "write:prs", "description": "Create and submit purchase requisitions"},
    {"scope": "read:pos", "description": "Read purchase orders and order line items"},
    {"scope": "write:pos", "description": "Acknowledge and amend purchase orders"},
    {"scope": "read:asns", "description": "Read advance shipping notices and tracking details"},
    {"scope": "write:asns", "description": "Create and dispatch advance shipping notices"},
    {"scope": "read:grns", "description": "Read goods receipts and warehouse intake logs"},
    {"scope": "write:grns", "description": "Perform barcode dock intake and confirm GRNs"},
    {"scope": "read:invoices", "description": "Read invoices, 3-way match results, and payment schedules"},
    {"scope": "write:invoices", "description": "Submit invoices and handle disputes"},
    {"scope": "read:vendors", "description": "Read supplier profiles, compliance scores, and scorecards"},
    {"scope": "read:analytics", "description": "Access spend cubes, cycle times, and rollup metrics"},
    {"scope": "read:master_data", "description": "Read categories, departments, cost centers, and UOMs"},
]

AVAILABLE_WEBHOOK_EVENTS = [
    {"event": "pr.submitted", "description": "Triggered when a requisition is submitted for approval"},
    {"event": "pr.approved", "description": "Triggered when a requisition is fully approved"},
    {"event": "po.created", "description": "Triggered when a purchase order is created"},
    {"event": "po.acknowledged", "description": "Triggered when a vendor acknowledges a purchase order"},
    {"event": "asn.dispatched", "description": "Triggered when an advance shipping notice is dispatched"},
    {"event": "grn.received", "description": "Triggered when goods receipt (GRN) is confirmed at warehouse"},
    {"event": "invoice.matched", "description": "Triggered when 3-way matching evaluates an invoice"},
    {"event": "payment.processed", "description": "Triggered when a payment batch is executed or reconciled"},
]


@router.get("/scopes", response_model=APIResponse[dict])
async def list_available_scopes(
    current_user: User = Depends(get_current_user),
):
    """List available OAuth/API key permission scopes and webhook event topics."""
    return success_response(
        {
            "scopes": AVAILABLE_SCOPES,
            "webhook_events": AVAILABLE_WEBHOOK_EVENTS,
        }
    )


# ============================================================================
# API Key Management
# ============================================================================

@router.get("/keys", response_model=APIResponse[list[ApiKeyResponse]])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all API keys for the current organization."""
    keys = await developer_service.list_api_keys(db, current_user.org_id)
    return success_response(keys)


@router.post(
    "/keys",
    response_model=APIResponse[ApiKeyCreatedResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_api_key(
    payload: ApiKeyCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new secure API key. The plain-text key_secret is returned only once."""
    api_key = await developer_service.create_api_key(db, current_user, payload)
    return created_response(api_key)


@router.post("/keys/{id}/revoke", response_model=APIResponse[ApiKeyResponse])
async def revoke_api_key(
    payload: ApiKeyRevokeRequest,
    key_id: UUID = Path(..., alias="id"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Immediately revoke an API key."""
    api_key = await developer_service.revoke_api_key(db, current_user, key_id, payload.reason)
    return success_response(api_key)


# ============================================================================
# Webhook Subscriptions
# ============================================================================

@router.get("/webhooks", response_model=APIResponse[list[WebhookSubscriptionResponse]])
async def list_webhooks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all registered webhook subscriptions."""
    subs = await developer_service.list_webhook_subscriptions(db, current_user.org_id)
    return success_response(subs)


@router.post(
    "/webhooks",
    response_model=APIResponse[WebhookSubscriptionResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_webhook(
    payload: WebhookSubscriptionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new webhook subscription with automatic HMAC signing."""
    sub = await developer_service.create_webhook_subscription(db, current_user, payload)
    return created_response(sub)


@router.patch("/webhooks/{id}", response_model=APIResponse[WebhookSubscriptionResponse])
async def update_webhook(
    payload: WebhookSubscriptionUpdateRequest,
    subscription_id: UUID = Path(..., alias="id"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update webhook endpoint URL, events or active status."""
    sub = await developer_service.update_webhook_subscription(
        db, current_user, subscription_id, payload
    )
    return success_response(sub)


@router.delete("/webhooks/{id}", response_model=APIResponse[dict])
async def delete_webhook(
    subscription_id: UUID = Path(..., alias="id"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a webhook subscription."""
    await developer_service.delete_webhook_subscription(db, current_user, subscription_id)
    return success_response({"deleted": True, "id": str(subscription_id)})


@router.post("/webhooks/{id}/test", response_model=APIResponse[WebhookDeliveryResponse])
async def test_ping_webhook(
    payload: WebhookTestPingRequest,
    subscription_id: UUID = Path(..., alias="id"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dispatch a test ping event to verify webhook reachability and HMAC signature."""
    delivery = await developer_service.test_ping_webhook(
        db, current_user, subscription_id, payload
    )
    return success_response(delivery)


@router.get("/webhooks/{id}/deliveries", response_model=APIResponse[list[WebhookDeliveryResponse]])
async def list_webhook_deliveries(
    subscription_id: UUID = Path(..., alias="id"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List recent delivery attempt logs and responses for a webhook."""
    deliveries = await developer_service.list_deliveries(db, current_user, subscription_id)
    return success_response(deliveries)
