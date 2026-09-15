"""Router for organization API key management.

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
from app.modules.integration.api_key_schemas import (
    ApiKeyCreateRequest,
    ApiKeyCreateResponse,
    ApiKeyLogResponse,
    ApiKeyResponse,
    ApiKeyUpdateRequest,
    ApiKeyUsageResponse,
)
from app.modules.integration.api_key_service import api_key_service
from app.modules.user.models import User

router = APIRouter(prefix="/api-keys", tags=["API Keys"])


@router.get("", response_model=APIResponse[list[ApiKeyResponse]])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all API keys for current organization."""
    keys = await api_key_service.list_api_keys(db, current_user.org_id)
    return success_response(keys)


@router.post("", response_model=APIResponse[ApiKeyCreateResponse])
async def create_api_key(
    data: ApiKeyCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new tenant API key and return raw secret once."""
    api_key, raw_key = await api_key_service.create_api_key(
        db, current_user.org_id, current_user.id, data
    )
    await db.commit()

    resp = ApiKeyCreateResponse(
        id=api_key.id,
        org_id=api_key.org_id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        key_type=api_key.key_type,
        scopes=api_key.scopes,
        rate_limit_tier=api_key.rate_limit_tier,
        is_active=api_key.is_active,
        expires_at=api_key.expires_at,
        last_used_at=api_key.last_used_at,
        total_requests=api_key.total_requests,
        created_at=api_key.created_at,
        raw_key=raw_key,
    )
    return created_response(resp)


@router.put("/{id}", response_model=APIResponse[ApiKeyResponse])
async def update_api_key(
    id: UUID,
    data: ApiKeyUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update API key scopes or state."""
    key = await api_key_service.update_api_key(db, current_user.org_id, current_user.id, id, data)
    await db.commit()
    return success_response(key)


@router.delete("/{id}", response_model=APIResponse[dict])
async def revoke_api_key(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke / deactivate an API key."""
    await api_key_service.revoke_api_key(db, current_user.org_id, current_user.id, id)
    await db.commit()
    return success_response({"id": str(id), "revoked": True})


@router.post("/{id}/rotate", response_model=APIResponse[ApiKeyCreateResponse])
async def rotate_api_key(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rotate an API key: grants 24h grace period to previous key and returns new key."""
    new_key, raw_key = await api_key_service.rotate_api_key(
        db, current_user.org_id, current_user.id, id
    )
    await db.commit()

    resp = ApiKeyCreateResponse(
        id=new_key.id,
        org_id=new_key.org_id,
        name=new_key.name,
        key_prefix=new_key.key_prefix,
        key_type=new_key.key_type,
        scopes=new_key.scopes,
        rate_limit_tier=new_key.rate_limit_tier,
        is_active=new_key.is_active,
        expires_at=new_key.expires_at,
        last_used_at=new_key.last_used_at,
        total_requests=new_key.total_requests,
        created_at=new_key.created_at,
        raw_key=raw_key,
    )
    return created_response(resp)


@router.get("/{id}/usage", response_model=APIResponse[ApiKeyUsageResponse])
async def get_api_key_usage(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch request telemetry for an API key."""
    usage = await api_key_service.get_usage_metrics(db, current_user.org_id, id)
    return success_response(usage)


@router.get("/{id}/log", response_model=APIResponse[list[ApiKeyLogResponse]])
async def get_api_key_logs(
    id: UUID,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch recent execution logs for an API key."""
    logs = await api_key_service.list_recent_logs(db, current_user.org_id, id, limit=limit)
    return success_response(logs)
