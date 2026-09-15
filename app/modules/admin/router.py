from __future__ import annotations

import math
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import APIResponse, PaginationMeta, success_response
from app.db.session import get_db
from app.modules.audit.search_service import AuditSearchQuery, audit_search_service
from app.modules.user.models import User

router = APIRouter(tags=["Admin"])


@router.get("/health")
async def health():
    return {"status": "ok", "module": "admin"}


@router.get("/audit-logs", response_model=APIResponse[list[dict]])
async def get_audit_logs(
    entity_type: str | None = Query(None, description="Entity type filter"),
    action: str | None = Query(None, description="Action filter"),
    actor_id: UUID | None = Query(None, description="Actor user ID"),
    actor_email: str | None = Query(None, description="Actor email"),
    entity_id: UUID | None = Query(None, description="Entity ID"),
    date_from: datetime | None = Query(None, description="Start date filter"),
    date_to: datetime | None = Query(None, description="End date filter"),
    search: str | None = Query(None, description="Full-text search query"),
    exclude_token_refresh: bool = Query(True, description="Exclude token refresh logs"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Elasticsearch-backed audit log search with date range, entity type, action, actor filters."""
    query = AuditSearchQuery(
        entity_type=entity_type,
        action=action,
        actor_id=actor_id,
        actor_email=actor_email,
        entity_id=entity_id,
        date_from=date_from,
        date_to=date_to,
        search=search,
        exclude_token_refresh=exclude_token_refresh,
        page=page,
        page_size=page_size,
    )
    result = await audit_search_service.search(
        org_id=current_user.org_id,
        query=query,
        db_fallback=db,
    )
    total_pages = math.ceil(result["total"] / page_size) if page_size else 1
    meta = PaginationMeta(
        total=result["total"],
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
    return success_response(data=result["items"], meta=meta)

