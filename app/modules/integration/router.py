"""
Integration module router.
Endpoints for managing integrations, monitoring sync jobs, retrying failures, and viewing run metrics.
"""
from __future__ import annotations

import math
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_any_permission
from app.core.constants import PermissionCode
from app.core.responses import APIResponse, PaginationMeta, success_response
from app.db.session import get_db
from app.modules.integration.schemas import (
    ERPConfigResponse,
    ERPConfigUpdateRequest,
    IntegrationJobResponse,
    IntegrationStatsResponse,
    ScheduledJobRunResponse,
    SyncTriggerRequest,
    SyncTriggerResponse,
)
from app.modules.integration.service import integration_service
from app.modules.user.models import User

router = APIRouter(tags=["Integration"])


@router.get("/stats", response_model=APIResponse[IntegrationStatsResponse])
async def get_integration_stats(
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.INTEGRATION_VIEW,
                PermissionCode.ADMIN_MANAGE_SYSTEM,
                PermissionCode.ADMIN_VIEW_SETTINGS,
            ]
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve aggregate statistics for external ERP and sync integration jobs."""
    stats = await integration_service.get_stats(db, org_id=current_user.org_id)
    return success_response(data=IntegrationStatsResponse(**stats))


@router.get("/jobs", response_model=APIResponse[List[IntegrationJobResponse]])
async def list_integration_jobs(
    status: Optional[str] = Query(None, description="Filter by job status (e.g. FAILED, COMPLETED, PENDING)"),
    job_type: Optional[str] = Query(None, description="Filter by job type"),
    adapter_type: Optional[str] = Query(None, description="Filter by adapter (e.g. SAP, ORACLE, WORKDAY, DIGIO)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.INTEGRATION_VIEW,
                PermissionCode.ADMIN_MANAGE_SYSTEM,
                PermissionCode.ADMIN_VIEW_SETTINGS,
            ]
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """List integration jobs with filtering and pagination."""
    jobs, total_count = await integration_service.list_jobs(
        db,
        org_id=current_user.org_id,
        status=status,
        job_type=job_type,
        adapter_type=adapter_type,
        page=page,
        page_size=page_size,
    )
    total_pages = math.ceil(total_count / page_size) if page_size > 0 else 1
    meta = PaginationMeta(
        total=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
    data = [
        IntegrationJobResponse(
            id=j.id,
            org_id=j.org_id,
            job_type=j.job_type,
            entity_type=j.entity_type,
            entity_id=j.entity_id,
            direction=j.direction,
            adapter_type=j.adapter_type,
            status=j.status.value if hasattr(j.status, "value") else str(j.status),
            request_payload=j.request_payload,
            response_payload=j.response_payload,
            error_message=j.error_message,
            retry_count=j.retry_count,
            max_retries=j.max_retries,
            next_retry_at=j.next_retry_at,
            completed_at=j.completed_at,
            created_at=j.created_at,
            updated_at=j.updated_at,
        )
        for j in jobs
    ]
    return success_response(data=data, meta=meta)


@router.get("/jobs/{job_id}", response_model=APIResponse[IntegrationJobResponse])
async def get_integration_job_detail(
    job_id: UUID,
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.INTEGRATION_VIEW,
                PermissionCode.ADMIN_MANAGE_SYSTEM,
                PermissionCode.ADMIN_VIEW_SETTINGS,
            ]
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Get single integration job detail including request and response payloads."""
    j = await integration_service.get_job(db, job_id=job_id, org_id=current_user.org_id)
    return success_response(
        data=IntegrationJobResponse(
            id=j.id,
            org_id=j.org_id,
            job_type=j.job_type,
            entity_type=j.entity_type,
            entity_id=j.entity_id,
            direction=j.direction,
            adapter_type=j.adapter_type,
            status=j.status.value if hasattr(j.status, "value") else str(j.status),
            request_payload=j.request_payload,
            response_payload=j.response_payload,
            error_message=j.error_message,
            retry_count=j.retry_count,
            max_retries=j.max_retries,
            next_retry_at=j.next_retry_at,
            completed_at=j.completed_at,
            created_at=j.created_at,
            updated_at=j.updated_at,
        )
    )


@router.post("/jobs/{job_id}/retry", response_model=APIResponse[IntegrationJobResponse])
async def retry_integration_job(
    job_id: UUID,
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.INTEGRATION_TRIGGER,
                PermissionCode.INTEGRATION_CONFIGURE,
                PermissionCode.ADMIN_MANAGE_SYSTEM,
            ]
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger a retry for a failed or stalled integration job."""
    j = await integration_service.retry_job(
        db, job_id=job_id, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(
        data=IntegrationJobResponse(
            id=j.id,
            org_id=j.org_id,
            job_type=j.job_type,
            entity_type=j.entity_type,
            entity_id=j.entity_id,
            direction=j.direction,
            adapter_type=j.adapter_type,
            status=j.status.value if hasattr(j.status, "value") else str(j.status),
            request_payload=j.request_payload,
            response_payload=j.response_payload,
            error_message=j.error_message,
            retry_count=j.retry_count,
            max_retries=j.max_retries,
            next_retry_at=j.next_retry_at,
            completed_at=j.completed_at,
            created_at=j.created_at,
            updated_at=j.updated_at,
        )
    )


@router.get("/scheduled-runs", response_model=APIResponse[List[ScheduledJobRunResponse]])
async def list_scheduled_runs(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.INTEGRATION_VIEW,
                PermissionCode.ADMIN_MANAGE_SYSTEM,
                PermissionCode.ADMIN_VIEW_SETTINGS,
            ]
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """List recent scheduled cron and background integration job executions."""
    runs = await integration_service.list_scheduled_runs(db, limit=limit)
    data = [
        ScheduledJobRunResponse(
            id=r.id,
            org_id=r.org_id,
            job_name=r.job_name,
            started_at=r.started_at,
            completed_at=r.completed_at,
            status=r.status,
            records_processed=r.records_processed,
            error_message=r.error_message,
            created_at=r.created_at,
        )
        for r in runs
    ]
    return success_response(
        data=data,
        meta=PaginationMeta(total=len(data), page=1, page_size=limit),
    )


@router.post("/sync/trigger", response_model=APIResponse[SyncTriggerResponse])
async def trigger_erp_sync(
    payload: SyncTriggerRequest = SyncTriggerRequest(),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.INTEGRATION_TRIGGER,
                PermissionCode.INTEGRATION_CONFIGURE,
                PermissionCode.ADMIN_MANAGE_SYSTEM,
            ]
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger an outbound/bidirectional ERP synchronization run."""
    result = await integration_service.trigger_sync(
        db,
        org_id=current_user.org_id,
        actor_id=current_user.id,
        adapter_type=payload.adapter_type,
        entity_type=payload.entity_type,
    )
    await db.commit()
    return success_response(data=SyncTriggerResponse(**result))


@router.get("/config", response_model=APIResponse[ERPConfigResponse])
async def get_integration_config(
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.INTEGRATION_VIEW,
                PermissionCode.INTEGRATION_CONFIGURE,
                PermissionCode.ADMIN_MANAGE_SYSTEM,
                PermissionCode.ADMIN_VIEW_SETTINGS,
            ]
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve current ERP adapter configuration and allowed integration domains for SSRF prevention."""
    config = await integration_service.get_erp_config(db, org_id=current_user.org_id)
    return success_response(data=ERPConfigResponse(**config))


@router.put("/config", response_model=APIResponse[ERPConfigResponse])
async def update_integration_config(
    payload: ERPConfigUpdateRequest,
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.INTEGRATION_CONFIGURE,
                PermissionCode.ADMIN_MANAGE_SYSTEM,
            ]
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Update active ERP provider settings and allowed outbound domains."""
    updated = await integration_service.update_erp_config(
        db,
        org_id=current_user.org_id,
        actor_id=current_user.id,
        erp_provider=payload.erp_provider,
        endpoint_url=payload.endpoint_url,
        auth_type=payload.auth_type,
        api_key=payload.api_key,
        allowed_domains=payload.allowed_domains,
        is_enabled=payload.is_enabled,
    )
    await db.commit()
    return success_response(data=ERPConfigResponse(**updated))
