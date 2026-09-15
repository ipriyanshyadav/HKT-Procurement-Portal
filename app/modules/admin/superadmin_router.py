"""SuperAdmin Cross-Company Analytics Router — SPEC_27-C.

Endpoints for platform superadmin cross-tenant telemetry.
Layer: router
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import APIResponse, success_response
from app.db.session import get_db
from app.modules.admin.schemas import (
    SuperadminOrgDetailResponse,
    SuperadminOrgPerformanceItem,
    SuperadminPlatformOverviewResponse,
)
from app.modules.admin.superadmin_reports_service import superadmin_reports_service
from app.modules.user.models import User

router = APIRouter(prefix="/superadmin/reports", tags=["SuperAdmin Platform Reports"])


@router.get("/overview", response_model=APIResponse[SuperadminPlatformOverviewResponse])
async def get_platform_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Platform-wide gross transaction metrics and company counts."""
    overview = await superadmin_reports_service.get_platform_overview(db, current_user)
    return success_response(overview)


@router.get("/orgs", response_model=APIResponse[list[SuperadminOrgPerformanceItem]])
async def list_org_performance(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Comparative benchmarking table of all registered organizations."""
    items = await superadmin_reports_service.list_org_performance(
        db, current_user, page=page, page_size=page_size
    )
    return success_response(items)


@router.get("/orgs/{org_id}", response_model=APIResponse[SuperadminOrgDetailResponse])
async def get_org_detail(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deep-dive aggregate telemetry for a specific tenant organization."""
    detail = await superadmin_reports_service.get_org_detail(db, current_user, org_id)
    return success_response(detail)
