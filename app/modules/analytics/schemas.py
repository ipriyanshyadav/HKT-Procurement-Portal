from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Spend Cube & Pareto 80/20 Schemas
# ---------------------------------------------------------------------------

class SpendCubeCategoryItem(BaseModel):
    category_id: Optional[UUID] = None
    category_name: str
    total_spend: float
    po_count: int
    capex_spend: float
    opex_spend: float
    percentage: float


class SpendCubeBUItem(BaseModel):
    business_unit_id: Optional[UUID] = None
    bu_name: str
    bu_code: str
    total_spend: float
    po_count: int
    capex_spend: float
    opex_spend: float
    percentage: float


class ParetoVendorItem(BaseModel):
    vendor_id: UUID
    vendor_name: str
    vendor_code: str
    total_spend: float
    po_count: int
    cumulative_spend: float
    cumulative_percentage: float
    pareto_tier: Literal["TOP_80", "LONG_TAIL"]


class ParetoSummary(BaseModel):
    total_vendors: int
    top_vendors_count: int
    top_vendors_spend_pct: float
    tail_vendors_count: int
    tail_vendors_spend_pct: float


class SpendCubeResponse(BaseModel):
    total_spend: float
    capex_spend: float
    opex_spend: float
    capex_percentage: float
    opex_percentage: float
    by_category: List[SpendCubeCategoryItem]
    by_bu: List[SpendCubeBUItem]
    pareto_vendors: List[ParetoVendorItem]
    pareto_summary: ParetoSummary


# ---------------------------------------------------------------------------
# Maverick Spend Schemas
# ---------------------------------------------------------------------------

class MaverickPOItem(BaseModel):
    po_id: UUID
    po_number: str
    vendor_name: str
    category_name: str
    bu_name: str
    total_value: float
    created_at: datetime
    risk_level: Literal["HIGH", "MEDIUM", "LOW"]


class MaverickCategoryBreakdown(BaseModel):
    category_name: str
    maverick_spend: float
    compliant_spend: float
    total_spend: float
    leakage_rate: float
    risk_level: Literal["HIGH", "MEDIUM", "LOW"]


class MaverickBUBreakdown(BaseModel):
    bu_name: str
    maverick_spend: float
    total_spend: float
    leakage_rate: float


class MaverickSpendResponse(BaseModel):
    total_po_spend: float
    contracted_spend: float
    sourced_spend: float
    maverick_spend: float
    leakage_rate: float
    total_po_count: int
    maverick_po_count: int
    compliant_po_count: int
    by_category: List[MaverickCategoryBreakdown]
    by_bu: List[MaverickBUBreakdown]
    uncontracted_pos: List[MaverickPOItem]


# ---------------------------------------------------------------------------
# Approval Bottlenecks Schemas
# ---------------------------------------------------------------------------

class ApprovalBottleneckItem(BaseModel):
    assigned_role: str
    approver_name: Optional[str] = None
    avg_turnaround_hours: float
    p95_turnaround_hours: float
    total_tasks: int
    sla_breaches: int
    is_bottleneck: bool


# ---------------------------------------------------------------------------
# Custom Report Builder Schemas
# ---------------------------------------------------------------------------

class CustomReportFilter(BaseModel):
    field: str
    operator: Literal["eq", "neq", "gt", "gte", "lt", "lte", "like", "in"]
    value: Any


class CustomReportSort(BaseModel):
    field: str
    direction: Literal["asc", "desc"] = "desc"


class CustomReportSchedule(BaseModel):
    frequency: Literal["DAILY", "WEEKLY", "MONTHLY"]
    day: Optional[str] = None
    time: Optional[str] = None
    format: Literal["CSV", "XLSX"] = "XLSX"


class CustomReportRequest(BaseModel):
    name: str = "Custom Report"
    dimensions: List[str] = Field(default_factory=lambda: ["category_name"])
    metrics: List[str] = Field(default_factory=lambda: ["total_po_value", "po_count"])
    filters: Optional[List[CustomReportFilter]] = None
    sort: Optional[List[CustomReportSort]] = None
    page: int = 1
    page_size: int = 50
    schedule: Optional[CustomReportSchedule] = None


class CustomReportResponse(BaseModel):
    name: str
    dimensions: List[str]
    metrics: List[str]
    total_records: int
    page: int
    page_size: int
    data: List[Dict[str, Any]]


# ---------------------------------------------------------------------------
# Compliance Audit Reports Schemas
# ---------------------------------------------------------------------------

class EmergencyRFQItem(BaseModel):
    id: UUID
    rfq_number: str
    title: str
    category_name: str
    bu_name: str
    estimated_value: float
    justification: Optional[str] = None
    published_at: Optional[datetime] = None
    status: str


class SingleVendorRFQItem(BaseModel):
    id: UUID
    rfq_number: str
    title: str
    category_name: str
    bu_name: str
    estimated_value: float
    single_vendor_justification: Optional[str] = None
    created_at: datetime
    status: str


class ForceApproveItem(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    actor_email: Optional[str] = None
    action: str
    created_at: datetime
    reason: Optional[str] = None


class SoDViolationItem(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    actor_email: Optional[str] = None
    action: str
    created_at: datetime
    details: Optional[Dict[str, Any]] = None


class ComplianceAuditResponse(BaseModel):
    emergency_rfqs: List[EmergencyRFQItem]
    single_vendor_rfqs: List[SingleVendorRFQItem]
    force_approves: List[ForceApproveItem]
    sod_violations: List[SoDViolationItem]
    summary: Dict[str, int]


class MaverickClusterItem(BaseModel):
    id: UUID
    cluster_type: str
    cluster_title: str
    severity: str
    affected_spend: float
    potential_savings: float
    affected_entity_ids: List[Any]
    root_cause_analysis: str
    ai_recommendation: str
    status: str
    created_at: datetime


class MaverickClusterResponse(BaseModel):
    total_clusters: int
    critical_count: int
    high_count: int
    total_leaked_spend: float
    projected_savings_recovery: float
    clusters: List[MaverickClusterItem]


class ClusterStatusUpdateRequest(BaseModel):
    status: str
    notes: Optional[str] = None

