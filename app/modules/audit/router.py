"""
Audit Log Router (SPEC_04 & SPEC_22).
Endpoints for:
- Querying immutable audit trail with Elasticsearch or SQL fallback
- Cryptographic SHA-256 chain of custody verification
- Exporting compliance reports with tamper-evident hash manifest
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_any_permission
from app.core.constants import PermissionCode
from app.core.responses import PaginationMeta, success_response
from app.db.session import get_db
from app.modules.audit.search_service import AuditSearchQuery
from app.modules.audit.service import audit_service
from app.modules.user.models import User

router = APIRouter(tags=["Audit"])


class AuditExportRequest(BaseModel):
    date_from: datetime | None = None
    date_to: datetime | None = None
    format: str = Field(default="json", pattern="^(json|csv|JSON|CSV)$")


@router.get("/health")
async def health():
    return {"status": "ok", "module": "audit"}


@router.get("/logs")
async def list_audit_logs(
    entity_type: str | None = Query(None, description="Entity type (e.g. PURCHASE_ORDER, VENDOR, INVOICE)"),
    action: str | None = Query(None, description="Action (e.g. CREATED, APPROVED, SUBMITTED)"),
    actor_id: UUID | None = Query(None, description="Actor User UUID"),
    actor_email: str | None = Query(None, description="Actor Email substring"),
    entity_id: UUID | None = Query(None, description="Entity UUID"),
    search: str | None = Query(None, description="Keyword search across field changes and metadata"),
    date_from: datetime | None = Query(None, description="Start timestamp"),
    date_to: datetime | None = Query(None, description="End timestamp"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.ADMIN_MANAGE_SYSTEM,
                PermissionCode.ADMIN_VIEW_SETTINGS,
                PermissionCode.INTEGRATION_VIEW,
            ]
        )
    ),
):
    """
    Retrieve paginated immutable audit records.
    Uses Elasticsearch for high-performance log querying with seamless PostgreSQL fallback.
    """
    query = AuditSearchQuery(
        entity_type=entity_type,
        action=action,
        actor_id=actor_id,
        actor_email=actor_email,
        entity_id=entity_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    result = await audit_service.get_audit_logs(db, org_id=current_user.org_id, query=query)
    meta = PaginationMeta(
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
        total_pages=result["total_pages"],
    )
    return success_response(data=result["items"], meta=meta)


@router.get("/verify-chain")
async def verify_audit_chain(
    entity_type: str | None = Query(None, description="Filter verification to a specific entity type"),
    limit: int = Query(500, ge=1, le=2000, description="Max consecutive records to verify"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.ADMIN_MANAGE_SYSTEM,
                PermissionCode.ADMIN_VIEW_SETTINGS,
            ]
        )
    ),
):
    """
    Cryptographically verify the SHA-256 chain of custody across stored audit logs.
    Detects any row alteration, deleted records, or broken hash linkages.
    """
    verification = await audit_service.verify_chain_integrity(
        db,
        org_id=current_user.org_id,
        entity_type=entity_type,
        limit=limit,
    )
    return success_response(data=verification)


@router.post("/export")
async def export_audit_compliance_report(
    payload: AuditExportRequest = AuditExportRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.ADMIN_MANAGE_SYSTEM,
                PermissionCode.ADMIN_VIEW_SETTINGS,
            ]
        )
    ),
):
    """
    Export tamper-evident audit logs with cryptographic hash manifest (JSON or CSV).
    """
    export_data = await audit_service.export_compliance_report(
        db,
        org_id=current_user.org_id,
        date_from=payload.date_from,
        date_to=payload.date_to,
        format_type=payload.format,
    )

    if payload.format.lower() == "csv":
        return Response(
            content=export_data["csv_content"],
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=compliance_audit_export_{current_user.org_id}.csv"
            },
        )

    return success_response(data=export_data)
