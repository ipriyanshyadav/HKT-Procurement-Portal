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
    BankPennyDropRequest,
    ERPConfigResponse,
    ERPConfigUpdateRequest,
    ERPEntityMappingResponse,
    ERPReconciliationReportResponse,
    ERPSyncTriggerRequest,
    ERPSyncTriggerResponse,
    GSTVerificationRequest,
    InboundSyncRequest,
    IntegrationJobResponse,
    IntegrationStatsResponse,
    PANVerificationRequest,
    ScheduledJobRunResponse,
    SyncTriggerRequest,
    SyncTriggerResponse,
)
from app.modules.integration.adapters.gst import GSTAdapter
from app.modules.integration.adapters.pan import pan_adapter
from app.modules.integration.adapters.bank import bank_adapter
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
    j = await integration_service.retry_job(db, job_id=job_id, actor_id=current_user.id, org_id=current_user.org_id)
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


@router.post("/verify/gstin")
async def verify_gstin(
    payload: GSTVerificationRequest,
    current_user: User = Depends(get_current_user),
):
    """Real-time GSTIN format validation, status lookup, and NSDL/GSTN cache query."""
    adapter = GSTAdapter()
    result = await adapter.validate(payload.gstin, vendor_legal_name=payload.legal_name)
    return success_response(data=result)


@router.post("/verify/pan")
async def verify_pan(
    payload: PANVerificationRequest,
    current_user: User = Depends(get_current_user),
):
    """Real-time PAN format validation, entity type extraction, and NSDL verification."""
    result = await pan_adapter.validate(payload.pan, name=payload.name)
    return success_response(data=result)


@router.post("/verify/bank-penny-drop")
async def verify_bank_penny_drop(
    payload: BankPennyDropRequest,
    current_user: User = Depends(get_current_user),
):
    """Initiate statutory bank account penny drop test (₹1.00 credit) to confirm beneficiary account."""
    from uuid import uuid4

    v_id = payload.vendor_id or uuid4()
    result = await bank_adapter.initiate_penny_test(
        vendor_id=v_id,
        account_number=payload.account_number,
        ifsc_code=payload.ifsc_code,
        account_holder_name=payload.account_holder_name,
    )
    return success_response(data=result)


@router.post("/erp/sync/inbound")
async def inbound_erp_sync(
    payload: InboundSyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.INTEGRATION_TRIGGER,
                PermissionCode.INTEGRATION_CONFIGURE,
                PermissionCode.ADMIN_MANAGE_SYSTEM,
            ]
        )
    ),
):
    """Process inbound synchronization payload pushed from SAP / Oracle / Tally ERP systems."""
    from datetime import datetime, timezone

    result = {
        "status": "ACCEPTED",
        "provider": payload.provider,
        "entity_type": payload.entity_type,
        "received_at": datetime.now(timezone.utc).isoformat(),
        "processed_records": 1,
        "details": payload.data,
    }
    return success_response(data=result)


# ---------------------------------------------------------------------------
# Multi-ERP Bi-Directional Sync Gateway (SPEC_20)
# ---------------------------------------------------------------------------


@router.get("/erp-gateway/mappings", response_model=APIResponse[List[ERPEntityMappingResponse]])
async def list_erp_mappings(
    erp_system: Optional[str] = Query(None, description="Filter by ERP (SAP_S4HANA, NETSUITE, ORACLE_CLOUD)"),
    entity_type: Optional[str] = Query(None, description="Filter by entity (PURCHASE_ORDER, INVOICE, VENDOR)"),
    sync_status: Optional[str] = Query(None, description="Filter by status (SUCCESS, PENDING, FAILED, DEAD_LETTER)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List bi-directional ERP entity mappings with sync statuses and checksums."""
    mappings, total = await integration_service.list_entity_mappings(
        db,
        org_id=current_user.org_id,
        erp_system=erp_system,
        entity_type=entity_type,
        sync_status=sync_status,
        page=page,
        page_size=page_size,
    )
    meta = PaginationMeta(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if page_size > 0 else 1,
    )
    return success_response(data=[ERPEntityMappingResponse.model_validate(m) for m in mappings], meta=meta)


@router.post("/erp-gateway/sync", response_model=APIResponse[ERPSyncTriggerResponse])
async def trigger_erp_sync(
    payload: ERPSyncTriggerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger outbound synchronization of a specific entity (PO, Invoice, Vendor) to ERP."""
    result = await integration_service.sync_entity_to_erp(
        db=db,
        org_id=current_user.org_id,
        erp_system=payload.erp_system,
        entity_type=payload.entity_type,
        internal_id=payload.internal_id,
        force_retry=payload.force_retry,
    )
    await db.commit()
    return success_response(data=ERPSyncTriggerResponse(**result))


@router.post("/erp-gateway/inbound")
async def inbound_gateway_sync(
    payload: InboundSyncRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Process inbound synchronization payload from external ERP webhook/integration agent."""
    from uuid import uuid4

    ext_id = str(payload.data.get("external_id") or payload.data.get("id") or uuid4().hex[:12])
    result = await integration_service.process_inbound_erp_payload(
        db=db,
        org_id=current_user.org_id,
        erp_system=payload.provider,
        entity_type=payload.entity_type,
        external_id=ext_id,
        payload=payload.data,
    )
    await db.commit()
    return success_response(data=result)


@router.get("/erp-gateway/reconciliation", response_model=APIResponse[ERPReconciliationReportResponse])
async def get_erp_reconciliation(
    erp_system: Optional[str] = Query(None, description="Optional ERP system filter"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate system parity reconciliation report across ERP mappings, sync statuses, and Dead Letter Queue."""
    report = await integration_service.get_erp_reconciliation_report(
        db, org_id=current_user.org_id, erp_system=erp_system
    )
    return success_response(
        data=ERPReconciliationReportResponse(
            org_id=report["org_id"],
            erp_system=report["erp_system"],
            total_mapped_entities=report["total_mapped_entities"],
            success_count=report["success_count"],
            pending_count=report["pending_count"],
            failed_count=report["failed_count"],
            dead_letter_count=report["dead_letter_count"],
            parity_percentage=report["parity_percentage"],
            recent_mappings=[ERPEntityMappingResponse.model_validate(m) for m in report["recent_mappings"]],
            dead_letter_queue=[ERPEntityMappingResponse.model_validate(m) for m in report["dead_letter_queue"]],
        )
    )


@router.post("/erp-gateway/mappings/{mapping_id}/retry")
async def retry_erp_mapping(
    mapping_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Force re-trigger an ERP synchronization for a failed or Dead Letter record."""
    result = await integration_service.retry_dlq_mapping(db, org_id=current_user.org_id, mapping_id=mapping_id)
    await db.commit()
    return success_response(data=result)
