from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# ─── Comparative Statement Schemas ───────────────────────────────────────────

class CSGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cost_of_capital_rate: Decimal | None = Field(default=None, description="Annual cost of capital (e.g. 0.12 for 12%)")
    evaluation_methodology: str | None = Field(default=None, description="L1_PRICE_ONLY / QCBS / TECHNICAL_MERIT")


class CSLineRankingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cs_id: UUID
    lot_id: UUID | None = None
    rfq_line_id: UUID | None = None
    bid_id: UUID
    vendor_id: UUID
    raw_unit_price: Decimal
    freight_per_unit: Decimal
    tax_per_unit: Decimal
    landed_cost: Decimal
    npv_adjusted_cost: Decimal
    rank: int
    tax_discrepancy: bool
    supplier_declared_rate: Decimal | None = None
    hsn_master_rate: Decimal | None = None
    tie_breaking_applied: bool
    tie_breaking_reason: str | None = None
    lot_total_inr: Decimal | None = None
    technical_score: Decimal | None = None
    commercial_score: Decimal | None = None
    composite_score: Decimal | None = None
    is_l1: bool


class ComparativeStatementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    rfq_id: UUID
    cs_number: str
    status: str
    cost_of_capital_rate: Decimal
    evaluation_methodology: str
    total_estimated_value: Decimal
    l1_total_value: Decimal | None = None
    savings_percentage: Decimal | None = None
    recommendations: str | None = None
    generated_by: UUID
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    pdf_document_id: UUID | None = None
    document_path: str | None = None
    cs_version: int
    created_at: datetime | None = None
    rankings: list[CSLineRankingResponse] = []


class CSVersionSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cs_number: str
    cs_version: int
    status: str
    l1_total_value: Decimal | None = None
    savings_percentage: Decimal | None = None
    created_at: datetime | None = None
    generated_by: UUID


# ─── Shortlisting Schemas ─────────────────────────────────────────────────────

class ShortlistVendorsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vendor_ids: list[UUID] = Field(..., min_length=1, description="Vendors to shortlist for negotiation or award")
    criteria: str | None = Field(default=None, description="Shortlisting rationale or filter (e.g. TOP_3, L1_AND_L2)")


class ShortlistResponse(BaseModel):
    cs_id: UUID
    shortlisted_vendor_ids: list[UUID]
    message: str


# ─── Negotiation Schemas ──────────────────────────────────────────────────────

class NegotiationStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vendor_ids: list[UUID] = Field(..., min_length=1, description="Shortlisted vendor IDs to initiate negotiations with")
    notes: str | None = None


class NegotiatedPriceSubmitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    negotiated_price: Decimal = Field(..., gt=0, description="Revised negotiated total price in INR")
    notes: str | None = None


class NegotiationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    rfq_id: UUID
    cs_id: UUID | None = None
    vendor_id: UUID
    round_number: int
    original_price: Decimal | None = None
    negotiated_price: Decimal | None = None
    price_change_pct: Decimal | None = None
    proposed_price: Decimal | None = None
    counter_price: Decimal | None = None
    status: str
    notes: str | None = None
    negotiated_by: UUID
    initiated_by: UUID | None = None
    created_at: datetime | None = None


# ─── Award Schemas ────────────────────────────────────────────────────────────

class AwardRecommendationItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lot_id: UUID | None = None
    rfq_line_id: UUID | None = None
    vendor_id: UUID
    bid_id: UUID
    value: Decimal = Field(..., gt=0, description="Total awarded value in INR")
    quantity: Decimal | None = Field(default=Decimal("1.0"), gt=0)
    unit_price: Decimal | None = None
    award_type: str | None = Field(default="FULL", description="FULL / SPLIT")
    justification: str = Field(..., min_length=3, description="Award reason / L1 justification")


class AwardRecommendRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    awards: list[AwardRecommendationItem] = Field(..., min_length=1)
    justification: str = Field(..., min_length=5, description="Overall business case justification for award")


class AwardDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    arn_id: UUID
    lot_id: UUID | None = None
    rfq_line_id: UUID | None = None
    vendor_id: UUID
    bid_id: UUID
    awarded_unit_price: Decimal
    awarded_quantity: Decimal
    awarded_total: Decimal
    award_type: str
    justification: str | None = None
    created_at: datetime | None = None


class AwardRecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    rfq_id: UUID
    cs_id: UUID
    arn_number: str
    status: str
    justification: str
    total_awarded_value: Decimal | None = None
    recommended_by: UUID
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    created_at: datetime | None = None
    details: list[AwardDetailResponse] = []


class AwardApprovalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    task_id: UUID | None = None
    comments: str | None = None


class RegretLettersResponse(BaseModel):
    sent_to_vendors: list[UUID]
    count: int
    message: str
