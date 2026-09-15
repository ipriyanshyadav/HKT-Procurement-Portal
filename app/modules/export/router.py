"""Router for Asynchronous Export Center (SPEC 27-G).

Module: export
Layer: router
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import Response as RawResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import APIResponse, created_response, success_response
from app.db.session import get_db
from app.modules.export.schemas import (
    ExportJobCreateRequest,
    ExportJobRefreshUrlResponse,
    ExportJobResponse,
)
from app.modules.export.service import export_center_service
from app.modules.user.models import User

router = APIRouter(prefix="/exports", tags=["Export Center"])


@router.post("", response_model=APIResponse[ExportJobResponse], status_code=201)
async def request_export(
    data: ExportJobCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Request a new asynchronous data export job."""
    job = await export_center_service.request_export(
        db, current_user.org_id, current_user.id, data
    )
    return created_response(ExportJobResponse.model_validate(job))


@router.get("", response_model=APIResponse[list[ExportJobResponse]])
async def list_my_exports(
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """List recent export jobs requested by the current user."""
    jobs = await export_center_service.list_user_exports(
        db, current_user.org_id, current_user.id, limit=limit
    )
    return success_response([ExportJobResponse.model_validate(j) for j in jobs])


@router.get("/{id}", response_model=APIResponse[ExportJobResponse])
async def get_export_status(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Get status, progress, and download link for an export job."""
    job = await export_center_service.get_export_job(
        db, current_user.org_id, current_user.id, id
    )
    return success_response(ExportJobResponse.model_validate(job))


@router.delete("/{id}", status_code=204)
async def cancel_or_delete_export(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Cancel a queued job or delete an export record."""
    await export_center_service.cancel_or_delete_export(
        db, current_user.org_id, current_user.id, id
    )
    return Response(status_code=204)


@router.post("/{id}/refresh-url", response_model=APIResponse[ExportJobRefreshUrlResponse])
async def refresh_export_url(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Regenerate a fresh download URL with renewed TTL."""
    url, expires_at = await export_center_service.refresh_download_url(
        db, current_user.org_id, current_user.id, id
    )
    return success_response(
        ExportJobRefreshUrlResponse(job_id=id, presigned_url=url, expires_at=expires_at)
    )


@router.get("/{id}/download")
async def download_export_file(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RawResponse:
    """Download the generated export file (CSV format)."""
    content, filename = await export_center_service.get_export_file_content(
        db, current_user.org_id, current_user.id, id
    )
    return RawResponse(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
