from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_any_permission
from app.core.constants import PermissionCode
from app.core.responses import success_response
from app.db.session import get_db
from app.modules.compliance.schemas import (
    CompliancePolicyResponse,
    CompliancePolicyToggleRequest,
    ComplianceScanResponse,
    ComplianceScanRunRequest,
)
from app.modules.compliance.service import compliance_service
from app.modules.user.models import User

router = APIRouter(tags=["Compliance"])


@router.get("/health")
async def health():
    return {"status": "ok", "module": "compliance"}


@router.get("/latest", response_model=None)
async def get_latest_compliance_scan(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.ADMIN_VIEW_SETTINGS,
                PermissionCode.ADMIN_MANAGE_SETTINGS,
                PermissionCode.ADMIN_VIEW_AUDIT_LOG,
                PermissionCode.ANALYTICS_VIEW_DASHBOARD,
            ]
        )
    ),
):
    """Retrieve the latest enterprise compliance & security posture scan with itemized findings."""
    scan = await compliance_service.get_latest_scan(db, org_id=current_user.org_id)
    return success_response(data=ComplianceScanResponse.model_validate(scan))


@router.post("/scan", response_model=None, status_code=status.HTTP_201_CREATED)
async def run_compliance_scan(
    request: ComplianceScanRunRequest = ComplianceScanRunRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.ADMIN_MANAGE_SYSTEM,
                PermissionCode.ADMIN_MANAGE_SETTINGS,
                PermissionCode.ADMIN_VIEW_SETTINGS,
            ]
        )
    ),
):
    """Trigger a real-time live compliance and security scan across ISO 27001, SOC 2, DPDP, and CVC frameworks."""
    scan = await compliance_service.run_live_compliance_scan(
        db,
        org_id=current_user.org_id,
        user_id=current_user.id,
        request=request,
    )
    return success_response(
        data=ComplianceScanResponse.model_validate(scan),
        message="Compliance scan completed successfully",
    )


@router.get("/scans", response_model=None)
async def list_compliance_scans(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.ADMIN_VIEW_SETTINGS,
                PermissionCode.ADMIN_MANAGE_SETTINGS,
                PermissionCode.ADMIN_VIEW_AUDIT_LOG,
                PermissionCode.ANALYTICS_VIEW_DASHBOARD,
            ]
        )
    ),
):
    """Retrieve historical compliance scan executions."""
    scans = await compliance_service.list_scans(db, org_id=current_user.org_id, limit=limit)
    return success_response(
        data=[ComplianceScanResponse.model_validate(s) for s in scans]
    )


@router.get("/scans/{scan_id}", response_model=None)
async def get_compliance_scan_detail(
    scan_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.ADMIN_VIEW_SETTINGS,
                PermissionCode.ADMIN_MANAGE_SETTINGS,
                PermissionCode.ADMIN_VIEW_AUDIT_LOG,
                PermissionCode.ANALYTICS_VIEW_DASHBOARD,
            ]
        )
    ),
):
    """Retrieve detailed scan record and findings by ID."""
    scan = await compliance_service.get_scan_detail(db, scan_id=scan_id, org_id=current_user.org_id)
    return success_response(data=ComplianceScanResponse.model_validate(scan))


@router.post("/scans/{scan_id}/attestation", response_model=None)
async def generate_compliance_attestation(
    scan_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.ADMIN_MANAGE_SYSTEM,
                PermissionCode.ADMIN_MANAGE_SETTINGS,
                PermissionCode.ADMIN_VIEW_SETTINGS,
            ]
        )
    ),
):
    """Generate a tamper-evident cryptographic compliance attestation report."""
    attestation = await compliance_service.generate_attestation(
        db,
        scan_id=scan_id,
        org_id=current_user.org_id,
        issued_by_email=current_user.email,
    )
    return success_response(data=attestation)


@router.get("/policies", response_model=None)
async def list_compliance_policies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.ADMIN_VIEW_SETTINGS,
                PermissionCode.ADMIN_MANAGE_SETTINGS,
                PermissionCode.ADMIN_VIEW_AUDIT_LOG,
            ]
        )
    ),
):
    """List configurable compliance policies for the organization."""
    policies = await compliance_service.list_policies(db, org_id=current_user.org_id)
    return success_response(
        data=[CompliancePolicyResponse.model_validate(p) for p in policies]
    )


@router.patch("/policies/{policy_id}", response_model=None)
async def toggle_compliance_policy(
    policy_id: UUID,
    payload: CompliancePolicyToggleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.ADMIN_MANAGE_SYSTEM,
                PermissionCode.ADMIN_MANAGE_SETTINGS,
            ]
        )
    ),
):
    """Toggle a compliance policy check on or off."""
    policy = await compliance_service.toggle_policy(
        db,
        policy_id=policy_id,
        org_id=current_user.org_id,
        is_enabled=payload.is_enabled,
    )
    return success_response(
        data=CompliancePolicyResponse.model_validate(policy),
        message=f"Policy {'enabled' if payload.is_enabled else 'disabled'} successfully",
    )
