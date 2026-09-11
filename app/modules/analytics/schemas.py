from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Spend Cube & Pareto 80/20 Schemas
# ---------------------------------------------------------------------------

class SpendCubeCategoryItem(BaseModel):
    category_id: UUID | None = None
    category_name: str
    total_spend: float
    po_count: int
    capex_spend: float
    opex_spend: float
    percentage: float


class SpendCubeBUItem(BaseModel):
    business_unit_id: UUID | None = None
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
    by_category: list[SpendCubeCategoryItem]
    by_bu: list[SpendCubeBUItem]
    pareto_vendors: list[ParetoVendorItem]
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
    by_category: list[MaverickCategoryBreakdown]
    by_bu: list[MaverickBUBreakdown]
    uncontracted_pos: list[MaverickPOItem]


# ---------------------------------------------------------------------------
# Approval Bottlenecks Schemas
# ---------------------------------------------------------------------------

class ApprovalBottleneckItem(BaseModel):
    assigned_role: str
    approver_name: str | None = None
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
    day: str | None = None
    time: str | None = None
    format: Literal["CSV", "XLSX"] = "XLSX"


class CustomReportRequest(BaseModel):
    name: str = "Custom Report"
    dimensions: list[str] = Field(default_factory=lambda: ["category_name"])
    metrics: list[str] = Field(default_factory=lambda: ["total_po_value", "po_count"])
    filters: list[CustomReportFilter] | None = None
    sort: list[CustomReportSort] | None = None
    page: int = 1
    page_size: int = 50
    schedule: CustomReportSchedule | None = None


class CustomReportResponse(BaseModel):
    name: str
    dimensions: list[str]
    metrics: list[str]
    total_records: int
    page: int
    page_size: int
    data: list[dict[str, Any]]


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
    justification: str | None = None
    published_at: datetime | None = None
    status: str


class SingleVendorRFQItem(BaseModel):
    id: UUID
    rfq_number: str
    title: str
    category_name: str
    bu_name: str
    estimated_value: float
    single_vendor_justification: str | None = None
    created_at: datetime
    status: str


class ForceApproveItem(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    actor_email: str | None = None
    action: str
    created_at: datetime
    reason: str | None = None


class SoDViolationItem(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    actor_email: str | None = None
    action: str
    created_at: datetime
    details: dict[str, Any] | None = None


class ComplianceAuditResponse(BaseModel):
    emergency_rfqs: list[EmergencyRFQItem]
    single_vendor_rfqs: list[SingleVendorRFQItem]
    force_approves: list[ForceApproveItem]
    sod_violations: list[SoDViolationItem]
    summary: dict[str, int]


class MaverickClusterItem(BaseModel):
    id: UUID
    cluster_type: str
    cluster_title: str
    severity: str
    affected_spend: float
    potential_savings: float
    affected_entity_ids: list[Any]
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
    clusters: list[MaverickClusterItem]


class ClusterStatusUpdateRequest(BaseModel):
    status: str
    notes: str | None = None


# ---------------------------------------------------------------------------
# Carbon ESG Footprint & Supplier ESG Schemas
# ---------------------------------------------------------------------------

class CategoryEmissionFactorItem(BaseModel):
    id: UUID
    category_id: UUID | None = None
    category_name: str
    scope1_factor: float
    scope2_factor: float
    scope3_factor: float
    currency: str
    data_source: str
    effective_year: int


class CategoryEmissionFactorCreate(BaseModel):
    category_id: UUID | None = None
    category_name: str
    scope1_factor: float = Field(0.05, ge=0.0)
    scope2_factor: float = Field(0.12, ge=0.0)
    scope3_factor: float = Field(0.65, ge=0.0)
    currency: str = "INR"
    data_source: str = "GHG_PROTOCOL_DEFRA_2026"
    effective_year: int = 2026


class SupplierESGScorecardItem(BaseModel):
    id: UUID
    vendor_id: UUID
    vendor_name: str
    vendor_code: str
    environmental_score: float
    social_score: float
    governance_score: float
    composite_esg_score: float
    esg_rating: str
    carbon_intensity_kg_per_spend: float
    sbti_committed: bool
    net_zero_target_year: int | None = None
    iso_14001_certified: bool
    renewable_energy_pct: float
    last_audit_date: datetime | None = None
    audit_notes: str | None = None


class SupplierESGScorecardUpdate(BaseModel):
    environmental_score: float | None = Field(None, ge=0.0, le=100.0)
    social_score: float | None = Field(None, ge=0.0, le=100.0)
    governance_score: float | None = Field(None, ge=0.0, le=100.0)
    esg_rating: str | None = None
    carbon_intensity_kg_per_spend: float | None = Field(None, ge=0.0)
    sbti_committed: bool | None = None
    net_zero_target_year: int | None = None
    iso_14001_certified: bool | None = None
    renewable_energy_pct: float | None = Field(None, ge=0.0, le=100.0)
    audit_notes: str | None = None


class CarbonCategoryBreakdown(BaseModel):
    category_name: str
    spend: float
    scope1_co2e_tonnes: float
    scope2_co2e_tonnes: float
    scope3_co2e_tonnes: float
    total_co2e_tonnes: float
    emission_intensity: float
    percentage_of_total: float


class SupplierCarbonLeagueItem(BaseModel):
    vendor_id: UUID
    vendor_name: str
    total_spend: float
    scope3_co2e_tonnes: float
    esg_rating: str
    composite_esg_score: float
    sbti_committed: bool
    iso_14001_certified: bool
    risk_level: str


class NetZeroTrajectoryYear(BaseModel):
    year: int
    target_co2e_tonnes: float
    projected_co2e_tonnes: float
    actual_co2e_tonnes: float | None = None


class CarbonFootprintResponse(BaseModel):
    total_co2e_tonnes: float
    scope1_co2e_tonnes: float
    scope2_co2e_tonnes: float
    scope3_co2e_tonnes: float
    scope1_pct: float
    scope2_pct: float
    scope3_pct: float
    total_evaluated_spend: float
    avg_carbon_intensity_kg_per_spend: float
    high_risk_supplier_count: int
    sbti_compliant_spend_pct: float
    category_breakdown: list[CarbonCategoryBreakdown]
    supplier_league_table: list[SupplierCarbonLeagueItem]
    net_zero_trajectory: list[NetZeroTrajectoryYear]
    decarbonization_recommendations: list[str]


