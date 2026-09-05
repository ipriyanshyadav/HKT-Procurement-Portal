from __future__ import annotations
import math
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import APIResponse, PaginationMeta, success_response
from app.db.session import get_db
from app.modules.requisition.schemas import PRDetailResponse
from app.modules.unmapped_pr.schemas import (
    UnmappedPRDashboardResponse,
    UnmappedPRExceptionResponse,
    UnmappedPRMapRequest,
    UnmappedPRSuggestionResponse,
)
from app.modules.unmapped_pr.service import unmapped_pr_service
from app.modules.user.models import User

router = APIRouter(tags=["Unmapped PR"])


@router.get("", response_model=APIResponse[List[UnmappedPRExceptionResponse]])
async def list_unmapped_prs(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    skip = (page - 1) * page_size
    items, total = await unmapped_pr_service.repo.list(
        db,
        org_id=current_user.org_id,
        status=status,
        skip=skip,
        limit=page_size,
    )
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    meta = PaginationMeta(
        total_records=total,
        page_number=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next_page=page < total_pages,
        has_prev_page=page > 1,
    )
    return success_response(
        data=[UnmappedPRExceptionResponse.model_validate(e) for e in items],
        meta=meta,
    )


@router.get("/dashboard", response_model=APIResponse[UnmappedPRDashboardResponse])
async def get_unmapped_pr_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await unmapped_pr_service.repo.get_dashboard_data(db, current_user.org_id)
    return success_response(UnmappedPRDashboardResponse.model_validate(data))


@router.post("/{id}/map", response_model=APIResponse[PRDetailResponse])
async def map_unmapped_pr(
    id: UUID,
    data: UnmappedPRMapRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pr = await unmapped_pr_service.map_pr(
        db,
        exception_id=id,
        mappings=data.mappings,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        notes=data.notes,
    )
    await db.commit()
    return success_response(PRDetailResponse.model_validate(pr))


@router.get("/{id}/suggest", response_model=APIResponse[UnmappedPRSuggestionResponse])
async def get_mapping_suggestions(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    suggestions = await unmapped_pr_service.suggest_mapping(db, id, current_user.org_id)
    return success_response(UnmappedPRSuggestionResponse.model_validate(suggestions))


@router.post("/{id}/auto-map", response_model=APIResponse[PRDetailResponse])
async def auto_map_pr(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pr = await unmapped_pr_service.auto_map(
        db,
        exception_id=id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(PRDetailResponse.model_validate(pr))
