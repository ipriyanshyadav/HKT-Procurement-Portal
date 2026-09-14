"""Router for organization webhook management.

Module: integration
Layer: router
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import APIResponse, created_response, success_response
from app.db.session import get_db
from app.modules.integration.webhook_management_service import webhook_management_service
from app.modules.integration.webhook_schemas import (
    WebhookCreateRequest,
    WebhookCreateResponse,
    WebhookDeliveryResponse,
    WebhookResponse,
    WebhookTestResponse,
    WebhookUpdateRequest,
)
from app.modules.user.models import User

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.get("", response_model=APIResponse[list[WebhookResponse]])
async def list_webhooks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all registered webhook endpoints for current organization."""
    webhooks = await webhook_management_service.list_webhooks(db, current_user.org_id)
    return success_response(webhooks)


@router.get("/events", response_model=APIResponse[list[str]])
async def list_available_events(
    current_user: User = Depends(get_current_user),
):
    """List all available system event types available for subscription."""
    events = webhook_management_service.list_events()
    return success_response(events)


@router.post("", response_model=APIResponse[WebhookCreateResponse])
async def create_webhook(
    data: WebhookCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new outbound webhook and return the raw HMAC secret once."""
    endpoint, raw_secret = await webhook_management_service.create_webhook(
        db, current_user.org_id, current_user.id, data
    )
    await db.commit()

    resp = WebhookCreateResponse(
        id=endpoint.id,
        org_id=endpoint.org_id,
        name=endpoint.name,
        url=endpoint.url,
        secret_hint=endpoint.secret_hint,
        subscribed_events=endpoint.subscribed_events,
        is_active=endpoint.is_active,
        max_retries=endpoint.max_retries,
        timeout_seconds=endpoint.timeout_seconds,
        total_deliveries=endpoint.total_deliveries,
        failed_deliveries=endpoint.failed_deliveries,
        last_delivery_at=endpoint.last_delivery_at,
        last_delivery_status=endpoint.last_delivery_status,
        created_at=endpoint.created_at,
        updated_at=endpoint.updated_at,
        raw_secret=raw_secret,
    )
    return created_response(resp)


@router.get("/{id}", response_model=APIResponse[WebhookResponse])
async def get_webhook(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch webhook endpoint details."""
    endpoint = await webhook_management_service.get_webhook(db, current_user.org_id, id)
    return success_response(endpoint)


@router.put("/{id}", response_model=APIResponse[WebhookResponse])
async def update_webhook(
    id: UUID,
    data: WebhookUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update webhook endpoint configuration."""
    endpoint = await webhook_management_service.update_webhook(
        db, current_user.org_id, current_user.id, id, data
    )
    await db.commit()
    return success_response(endpoint)


@router.delete("/{id}", response_model=APIResponse[dict])
async def delete_webhook(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a webhook endpoint."""
    await webhook_management_service.delete_webhook(db, current_user.org_id, current_user.id, id)
    await db.commit()
    return success_response({"id": str(id), "deleted": True})


@router.post("/{id}/rotate-secret", response_model=APIResponse[dict])
async def rotate_webhook_secret(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rotate HMAC signing secret for a webhook endpoint, returning the new raw secret once."""
    new_secret = await webhook_management_service.rotate_secret(
        db, current_user.org_id, current_user.id, id
    )
    await db.commit()
    return success_response({"webhook_id": str(id), "raw_secret": new_secret})


@router.post("/{id}/test", response_model=APIResponse[WebhookTestResponse])
async def test_webhook_delivery(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dispatch a test verification ping to the webhook endpoint and record delivery log."""
    result = await webhook_management_service.test_webhook(
        db, current_user.org_id, current_user.id, id
    )
    await db.commit()
    return success_response(result)


@router.get("/{id}/deliveries", response_model=APIResponse[list[WebhookDeliveryResponse]])
async def list_webhook_deliveries(
    id: UUID,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List recent delivery logs for a webhook endpoint."""
    deliveries = await webhook_management_service.list_deliveries(
        db, current_user.org_id, id, limit=limit
    )
    return success_response(deliveries)
