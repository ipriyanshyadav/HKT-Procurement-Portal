from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.config import settings
from app.core.responses import success_response
from app.db.session import get_db
from app.modules.analytics.export_service import analytics_export_service
from app.modules.analytics.schemas import (
    ClusterStatusUpdateRequest,
    ComplianceAuditResponse,
    CustomReportRequest,
    CustomReportResponse,
    MaverickClusterResponse,
    MaverickSpendResponse,
    SpendCubeResponse,
)
from app.modules.analytics.service import analytics_service
from app.modules.user.models import User
from app.core.streaming import stream_csv, stream_pdf, generate_table_pdf
from app.modules.user.role_repository import role_repository

router = APIRouter(tags=["Analytics"])


class ExportRequest(BaseModel):
    data: Optional[List[Dict[str, Any]]] = None
    columns: Optional[List[str]] = None
    filename: Optional[str] = None
    sheet_name: Optional[str] = "Analytics"
    report_type: Optional[str] = None
    fiscal_year: Optional[str] = None
    group_by: Optional[str] = None


async def get_user_bu_scope(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    business_unit_id: Optional[UUID] = Query(None, description="Optional Business Unit filter"),
) -> List[UUID]:
    user_roles: set[str] = set()
    if hasattr(current_user, "roles") and current_user.roles:
        user_roles.update(r if isinstance(r, str) else getattr(r, "code", "") for r in current_user.roles)

    try:
        db_roles = await role_repository.get_user_role_codes(db, current_user.id, current_user.org_id)
        user_roles.update(db_roles)
    except Exception:
        pass

    unscoped_roles = set(settings.UNSCOPED_ANALYTICS_ROLES)

    if unscoped_roles.intersection(user_roles):
        if business_unit_id:
            return [business_unit_id]
        return []

    user_bu = getattr(current_user, "business_unit_id", None)
    if user_bu:
        return [user_bu]

    if business_unit_id:
        return [business_unit_id]

    return []


@router.get("/health")
async def health():
    return {"status": "ok", "module": "analytics"}


# 1. Dashboard (pre-aggregated)
@router.get("/dashboard")
async def get_dashboard(
    fiscal_year: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    user_bu_scope: List[UUID] = Depends(get_user_bu_scope),
    db: AsyncSession = Depends(get_db),
):
    data = await analytics_service.get_dashboard(db, current_user.org_id, fiscal_year, user_bu_scope)
    return success_response(data)


# 2. Spend summary
@router.get("/spend")
async def get_spend(
    group_by: Optional[str] = Query(None, description="category, vendor, bu, or all"),
    fiscal_year: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    user_bu_scope: List[UUID] = Depends(get_user_bu_scope),
    db: AsyncSession = Depends(get_db),
):
    if group_by in ("category", "vendor", "bu"):
        data = await analytics_service.get_spend_summary(
            db, current_user.org_id, fiscal_year, user_bu_scope, group_by=group_by
        )
    else:
        data = await analytics_service.get_all_spend(db, current_user.org_id, fiscal_year, user_bu_scope)
    return success_response(data)


# 2a. Spend Cube (Multi-dimensional slicing & Pareto 80/20)
@router.get("/spend-cube")
async def get_spend_cube(
    fiscal_year: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    user_bu_scope: List[UUID] = Depends(get_user_bu_scope),
    db: AsyncSession = Depends(get_db),
):
    data = await analytics_service.get_spend_cube(db, current_user.org_id, fiscal_year, user_bu_scope)
    return success_response(data)


# 2b. Maverick Spend Identification
@router.get("/maverick-spend")
async def get_maverick_spend(
    fiscal_year: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    user_bu_scope: List[UUID] = Depends(get_user_bu_scope),
    db: AsyncSession = Depends(get_db),
):
    data = await analytics_service.get_maverick_spend(db, current_user.org_id, fiscal_year, user_bu_scope, limit=limit)
    return success_response(data)


@router.get("/maverick-spend/clusters")
async def get_maverick_clusters(
    status: Optional[str] = Query(
        None, description="Filter by status (DETECTED, INVESTIGATING, RESOLVED, FALSE_POSITIVE)"
    ),
    cluster_type: Optional[str] = Query(None, description="Filter by cluster type"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve AI-identified Maverick Spend Anomaly Clusters for the organization."""
    data = await analytics_service.get_maverick_clusters(
        db, current_user.org_id, status=status, cluster_type=cluster_type
    )
    return success_response(data)


@router.post("/maverick-spend/detect-anomalies")
async def detect_maverick_anomalies(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run real-time anomaly detection scan across POs, invoices, contracts, and line items."""
    data = await analytics_service.detect_maverick_clusters(db, current_user.org_id)
    return success_response(data)


@router.post("/maverick-spend/clusters/{cluster_id}/status")
async def update_maverick_cluster_status(
    cluster_id: UUID,
    payload: ClusterStatusUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update triage or resolution status for a specific Maverick Spend cluster."""
    data = await analytics_service.update_maverick_cluster_status(
        db, cluster_id=cluster_id, org_id=current_user.org_id, status=payload.status
    )
    return success_response(data)


# 3. Savings analysis
@router.get("/savings")
async def get_savings(
    fiscal_year: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    user_bu_scope: List[UUID] = Depends(get_user_bu_scope),
    db: AsyncSession = Depends(get_db),
):
    data = await analytics_service.get_savings_analysis(db, current_user.org_id, fiscal_year, user_bu_scope)
    return success_response(data)


# 4. Cycle time analysis
@router.get("/cycle-times")
async def get_cycle_times(
    fiscal_year: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    user_bu_scope: List[UUID] = Depends(get_user_bu_scope),
    db: AsyncSession = Depends(get_db),
):
    data = await analytics_service.get_cycle_time_analysis(db, current_user.org_id, fiscal_year, user_bu_scope)
    return success_response(data)


# 5. Overall vendor performance comparison table
@router.get("/vendor-performance")
async def get_all_vendor_performance(
    current_user: User = Depends(get_current_user),
    user_bu_scope: List[UUID] = Depends(get_user_bu_scope),
    db: AsyncSession = Depends(get_db),
):
    data = await analytics_service.get_vendor_performance(
        db, current_user.org_id, vendor_id=None, user_bu_scope=user_bu_scope
    )
    return success_response(data)


# 6. Single vendor scorecard
@router.get("/vendor-performance/{vendor_id}")
async def get_single_vendor_performance(
    vendor_id: UUID,
    current_user: User = Depends(get_current_user),
    user_bu_scope: List[UUID] = Depends(get_user_bu_scope),
    db: AsyncSession = Depends(get_db),
):
    data = await analytics_service.get_vendor_performance(
        db, current_user.org_id, vendor_id=vendor_id, user_bu_scope=user_bu_scope
    )
    return success_response(data)


# 7. SLA compliance
@router.get("/sla-compliance")
async def get_sla_compliance(
    current_user: User = Depends(get_current_user),
    user_bu_scope: List[UUID] = Depends(get_user_bu_scope),
    db: AsyncSession = Depends(get_db),
):
    data = await analytics_service.get_sla_compliance(db, current_user.org_id, user_bu_scope)
    return success_response(data)


# 8. Compliance dashboard
@router.get("/compliance")
async def get_compliance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await analytics_service.get_compliance_dashboard(db, current_user.org_id)
    return success_response(data)


# 8b. Compliance Audit Reports (Emergency RFQs, Single-Vendor, Force-Approvals, SoD Violations)
@router.get("/compliance-reports")
async def get_compliance_reports(
    report_type: Optional[str] = Query(None),
    fiscal_year: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await analytics_service.get_compliance_audit_reports(
        db, current_user.org_id, report_type=report_type, fiscal_year=fiscal_year, page=page, page_size=page_size
    )
    return success_response(data)


# 8c. Custom Report Builder Query Engine
@router.post("/reports")
async def execute_custom_report(
    req: CustomReportRequest,
    current_user: User = Depends(get_current_user),
    user_bu_scope: List[UUID] = Depends(get_user_bu_scope),
    db: AsyncSession = Depends(get_db),
):
    data = await analytics_service.execute_custom_report(db, current_user.org_id, req, user_bu_scope=user_bu_scope)
    return success_response(data)


# 9. Unmapped PR analytics
@router.get("/unmapped-prs")
async def get_unmapped_prs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await analytics_service.get_unmapped_pr_analytics(db, current_user.org_id)
    return success_response(data)


# 10. Invoice processing analytics
@router.get("/invoices")
async def get_invoices(
    current_user: User = Depends(get_current_user),
    user_bu_scope: List[UUID] = Depends(get_user_bu_scope),
    db: AsyncSession = Depends(get_db),
):
    data = await analytics_service.get_invoice_analytics(db, current_user.org_id, user_bu_scope)
    return success_response(data)


# 11. Ad-hoc CSV export
@router.get("/export/csv")
async def get_export_csv(
    report_type: Optional[str] = Query("spend", description="spend, vendors, or kpis"),
    fiscal_year: Optional[str] = Query(None),
    group_by: Optional[str] = Query("category"),
    current_user: User = Depends(get_current_user),
    user_bu_scope: List[UUID] = Depends(get_user_bu_scope),
    db: AsyncSession = Depends(get_db),
):
    """Stream CSV export for analytics report."""
    if report_type == "spend":
        data = await analytics_service.get_spend_summary(
            db, current_user.org_id, fiscal_year, user_bu_scope, group_by=group_by or "category"
        )
    elif report_type == "vendors":
        data = await analytics_service.get_vendor_performance(
            db, current_user.org_id, vendor_id=None, user_bu_scope=user_bu_scope
        )
    else:
        kpis = await analytics_service.get_procurement_kpis(db, current_user.org_id, fiscal_year, user_bu_scope)
        data = [{"metric": k, "value": v} for k, v in kpis.items()]

    headers = list(data[0].keys()) if data and isinstance(data[0], dict) else ["key", "value"]
    return stream_csv(
        headers=headers, rows=data or [], filename=f"analytics_{report_type}_{current_user.org_id.hex[:6]}"
    )


@router.get("/export/pdf")
async def get_export_pdf(
    report_type: Optional[str] = Query("spend", description="spend, vendors, or kpis"),
    fiscal_year: Optional[str] = Query(None),
    group_by: Optional[str] = Query("category"),
    current_user: User = Depends(get_current_user),
    user_bu_scope: List[UUID] = Depends(get_user_bu_scope),
    db: AsyncSession = Depends(get_db),
):
    """Stream PDF export for analytics report."""
    if report_type == "spend":
        data = await analytics_service.get_spend_summary(
            db, current_user.org_id, fiscal_year, user_bu_scope, group_by=group_by or "category"
        )
        title = f"Spend Summary Report ({group_by or 'category'})"
    elif report_type == "vendors":
        data = await analytics_service.get_vendor_performance(
            db, current_user.org_id, vendor_id=None, user_bu_scope=user_bu_scope
        )
        title = "Vendor Performance Report"
    else:
        kpis = await analytics_service.get_procurement_kpis(db, current_user.org_id, fiscal_year, user_bu_scope)
        data = [{"metric": k, "value": v} for k, v in kpis.items()]
        title = "Procurement KPIs Summary Report"

    headers = list(data[0].keys()) if data and isinstance(data[0], dict) else ["key", "value"]
    pdf_bytes = generate_table_pdf(title, headers, data or [])
    return stream_pdf(pdf_bytes, f"analytics_{report_type}_{current_user.org_id.hex[:6]}")


@router.post("/export/csv")
async def export_csv(
    req: ExportRequest,
    current_user: User = Depends(get_current_user),
    user_bu_scope: List[UUID] = Depends(get_user_bu_scope),
    db: AsyncSession = Depends(get_db),
):
    data = req.data
    if not data and req.report_type:
        if req.report_type == "spend":
            data = await analytics_service.get_spend_summary(
                db, current_user.org_id, req.fiscal_year, user_bu_scope, group_by=req.group_by or "category"
            )
        elif req.report_type == "vendors":
            data = await analytics_service.get_vendor_performance(
                db, current_user.org_id, vendor_id=None, user_bu_scope=user_bu_scope
            )
        elif req.report_type == "kpis":
            kpis = await analytics_service.get_procurement_kpis(db, current_user.org_id, req.fiscal_year, user_bu_scope)
            data = [{"metric": k, "value": v} for k, v in kpis.items()]
    filename = req.filename or f"analytics_export_{current_user.org_id.hex[:6]}.csv"
    return await analytics_export_service.export_csv(data or [], columns=req.columns, filename=filename)


# 12. Ad-hoc Excel export
@router.post("/export/excel")
async def export_excel(
    req: ExportRequest,
    current_user: User = Depends(get_current_user),
    user_bu_scope: List[UUID] = Depends(get_user_bu_scope),
    db: AsyncSession = Depends(get_db),
):
    data = req.data
    if not data and req.report_type:
        if req.report_type == "spend":
            data = await analytics_service.get_spend_summary(
                db, current_user.org_id, req.fiscal_year, user_bu_scope, group_by=req.group_by or "category"
            )
        elif req.report_type == "vendors":
            data = await analytics_service.get_vendor_performance(
                db, current_user.org_id, vendor_id=None, user_bu_scope=user_bu_scope
            )
        elif req.report_type == "kpis":
            kpis = await analytics_service.get_procurement_kpis(db, current_user.org_id, req.fiscal_year, user_bu_scope)
            data = [{"metric": k, "value": v} for k, v in kpis.items()]
    filename = req.filename or f"analytics_export_{current_user.org_id.hex[:6]}.xlsx"
    return await analytics_export_service.export_excel(
        data or [], sheet_name=req.sheet_name or "Analytics", filename=filename
    )
