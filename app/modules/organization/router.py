from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import APIResponse, PaginationMeta, success_response
from app.db.session import get_db
from app.modules.organization.schemas import BusinessUnitResponse, CostCenterResponse
from app.modules.organization.service import organization_service
from app.modules.user.models import User

router = APIRouter(tags=["Organization"])


@router.get("/health")
@router.get("/organizations/health")
async def health():
    return {"status": "ok", "module": "organization"}


@router.get("/business-units", response_model=APIResponse[List[BusinessUnitResponse]])
@router.get("/organizations/business-units", response_model=APIResponse[List[BusinessUnitResponse]])
async def list_business_units(
    active_only: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List business units for the current user's organization."""
    bus = await organization_service.list_business_units(
        db, current_user.org_id, active_only=active_only
    )
    data = [BusinessUnitResponse.model_validate(b) for b in bus]
    meta = PaginationMeta(total=len(data), page=1, page_size=len(data) or 20)
    return success_response(data, meta=meta)


@router.get("/cost-centers", response_model=APIResponse[List[CostCenterResponse]])
@router.get("/organizations/cost-centers", response_model=APIResponse[List[CostCenterResponse]])
async def list_cost_centers(
    business_unit_id: Optional[UUID] = Query(default=None),
    active_only: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List cost centers for the current user's organization, optionally filtered by business unit."""
    ccs = await organization_service.list_cost_centers(
        db, current_user.org_id, business_unit_id=business_unit_id, active_only=active_only
    )
    data = [CostCenterResponse.model_validate(c) for c in ccs]
    meta = PaginationMeta(total=len(data), page=1, page_size=len(data) or 20)
    return success_response(data, meta=meta)
