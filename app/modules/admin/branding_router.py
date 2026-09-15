"""Router for tenant white-label branding.

Module: admin
Layer: router
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import APIResponse, success_response
from app.db.session import get_db
from app.modules.admin.branding_schemas import (
    PublicBrandingResponse,
    TenantBrandingResponse,
    TenantBrandingUpdateRequest,
)
from app.modules.admin.branding_service import branding_service
from app.modules.user.models import User

admin_branding_router = APIRouter(prefix="/admin/branding", tags=["Tenant Branding"])
public_branding_router = APIRouter(prefix="/public/branding", tags=["Public Branding"])


@admin_branding_router.get("", response_model=APIResponse[TenantBrandingResponse])
async def get_branding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch branding settings for current organization."""
    branding = await branding_service.get_or_create_branding(db, current_user.org_id)
    return success_response(branding)


@admin_branding_router.put("", response_model=APIResponse[TenantBrandingResponse])
async def update_branding(
    data: TenantBrandingUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update branding configuration for current organization."""
    branding = await branding_service.update_branding(
        db, current_user.org_id, current_user.id, data
    )
    await db.commit()
    return success_response(branding)


@admin_branding_router.post("/verify-domain", response_model=APIResponse[dict])
async def verify_custom_domain(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate DNS CNAME verification for tenant custom domain."""
    result = await branding_service.verify_custom_domain(
        db, current_user.org_id, current_user.id
    )
    await db.commit()
    return success_response(result)


@public_branding_router.get("/{org_slug}", response_model=APIResponse[PublicBrandingResponse])
async def get_public_branding(
    org_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Fetch public branding tokens for login page styling (no authentication required)."""
    branding = await branding_service.get_public_branding(db, org_slug)
    return success_response(branding)
