from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_any_permission
from app.core.constants import PermissionCode
from app.core.responses import success_response
from app.db.session import get_db
from app.modules.disaster_recovery.schemas import (
    DRCheckpointCreateRequest,
    DRCheckpointResponse,
    DRFailoverDrillResponse,
    RunFailoverDrillRequest,
    TriggerPITRSnapshotRequest,
)
from app.modules.disaster_recovery.service import dr_service
from app.modules.user.models import User

router = APIRouter(tags=["Disaster Recovery"])


@router.get("/health")
async def dr_health():
    return {"status": "ok", "module": "disaster_recovery"}


@router.get("/posture", response_model=None)
async def get_dr_posture(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.ADMIN_MANAGE_SYSTEM,
                PermissionCode.ADMIN_VIEW_SETTINGS,
                PermissionCode.ADMIN_MANAGE_SETTINGS,
                PermissionCode.ADMIN_VIEW_HEALTH,
            ]
        )
    ),
):
    """Retrieve executive DR readiness posture metrics (RPO/RTO SLA gauges, WORM status)."""
    posture = await dr_service.get_dr_posture(db, org_id=current_user.org_id)
    return success_response(data=posture.model_dump())


@router.get("/checkpoints", response_model=None)
async def list_checkpoints(
    checkpoint_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.ADMIN_MANAGE_SYSTEM,
                PermissionCode.ADMIN_VIEW_SETTINGS,
                PermissionCode.ADMIN_MANAGE_SETTINGS,
            ]
        )
    ),
):
    """List PITR WAL archives and storage snapshot checkpoints."""
    checkpoints = await dr_service.list_checkpoints(
        db,
        org_id=current_user.org_id,
        checkpoint_type=checkpoint_type,
        status=status_filter,
        limit=limit,
        offset=offset,
    )
    return success_response(data=[DRCheckpointResponse.model_validate(c).model_dump() for c in checkpoints])


@router.post("/checkpoints", response_model=None, status_code=status.HTTP_201_CREATED)
async def create_checkpoint(
    payload: DRCheckpointCreateRequest,
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
    """Register a new backup checkpoint."""
    checkpoint = await dr_service.create_checkpoint(db, org_id=current_user.org_id, payload=payload)
    await db.commit()
    return success_response(data=DRCheckpointResponse.model_validate(checkpoint).model_dump())


@router.post("/checkpoints/snapshot", response_model=None, status_code=status.HTTP_201_CREATED)
async def trigger_pitr_snapshot(
    payload: TriggerPITRSnapshotRequest,
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
    """Trigger an on-demand PostgreSQL PITR WAL archive or MinIO WORM snapshot."""
    checkpoint = await dr_service.trigger_pitr_snapshot(db, org_id=current_user.org_id, payload=payload)
    await db.commit()
    return success_response(data=DRCheckpointResponse.model_validate(checkpoint).model_dump())


@router.post("/checkpoints/{checkpoint_id}/verify", response_model=None)
async def verify_checkpoint(
    checkpoint_id: UUID,
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
    """Verify cryptographic SHA-256 and WORM object lock integrity of a checkpoint."""
    verification = await dr_service.verify_checkpoint(db, checkpoint_id=checkpoint_id, org_id=current_user.org_id)
    return success_response(data=verification.model_dump())


@router.get("/drills", response_model=None)
async def list_drills(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.ADMIN_MANAGE_SYSTEM,
                PermissionCode.ADMIN_VIEW_SETTINGS,
                PermissionCode.ADMIN_MANAGE_SETTINGS,
            ]
        )
    ),
):
    """List disaster recovery failover drill history with RPO/RTO metrics."""
    drills = await dr_service.list_drills(db, org_id=current_user.org_id, limit=limit, offset=offset)
    return success_response(data=[DRFailoverDrillResponse.model_validate(d).model_dump() for d in drills])


@router.post("/drills/run", response_model=None, status_code=status.HTTP_201_CREATED)
async def run_failover_drill(
    payload: RunFailoverDrillRequest,
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
    """Execute an automated simulated failover drill against secondary K3s cluster."""
    drill = await dr_service.run_failover_drill(
        db,
        org_id=current_user.org_id,
        actor_id=current_user.id,
        payload=payload,
    )
    await db.commit()
    return success_response(data=DRFailoverDrillResponse.model_validate(drill).model_dump())


@router.get("/drills/{drill_id}", response_model=None)
async def get_drill_detail(
    drill_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.ADMIN_MANAGE_SYSTEM,
                PermissionCode.ADMIN_VIEW_SETTINGS,
                PermissionCode.ADMIN_MANAGE_SETTINGS,
            ]
        )
    ),
):
    """Retrieve detailed drill audit report and execution step phases."""
    drill = await dr_service.get_drill(db, drill_id=drill_id, org_id=current_user.org_id)
    return success_response(data=DRFailoverDrillResponse.model_validate(drill).model_dump())
