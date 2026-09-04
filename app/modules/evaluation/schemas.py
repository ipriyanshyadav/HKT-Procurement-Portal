from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


# ─── Comparative Statement Schemas ───────────────────────────────────────────

class CSGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cost_of_capital_rate: Optional[Decimal] = Field(default=None, description="Annual cost of capital (e.g. 0.12 for 12%)")
    evaluation_methodology: Optional[str] = Field(default=None, description="L1_PRICE_ONLY / QCBS / TECHNICAL_MERIT")


class CSLineRankingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cs_id: UUID
    lot_id: Optional[UUID] = None
    rfq_line_id: Optional[UUID] = None
    bid_id: UUID
    vendor_id: UUID
    raw_unit_price: Decimal
    freight_per_unit: Decimal
    tax_per_unit: Decimal
    landed_cost: Decimal
    npv_adjusted_cost: Decimal
    rank: int
    tax_discrepancy: bool
    supplier_declared_rate: Optional[Decimal] = None
    hsn_master_rate: Optional[Decimal] = None
    tie_breaking_applied: bool
    tie_breaking_reason: Optional[str] = None
    lot_total_inr: Optional[Decimal] = None
    technical_score: Optional[Decimal] = None
    commercial_score: Optional[Decimal] = None
    composite_score: Optional[Decimal] = None
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
    l1_total_value: Optional[Decimal] = None
    savings_percentage: Optional[Decimal] = None
    recommendations: Optional[str] = None
    generated_by: UUID
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    pdf_document_id: Optional[UUID] = None
    document_path: Optional[str] = None
    cs_version: int
    created_at: Optional[datetime] = None
    rankings: List[CSLineRankingResponse] = []


class CSVersionSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cs_number: str
    cs_version: int
    status: str
    l1_total_value: Optional[Decimal] = None
    savings_percentage: Optional[Decimal] = None
    created_at: Optional[datetime] = None
    generated_by: UUID


# ─── Shortlisting Schemas ─────────────────────────────────────────────────────

class ShortlistVendorsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vendor_ids: List[UUID] = Field(..., min_length=1, description="Vendors to shortlist for negotiation or award")
    criteria: Optional[str] = Field(default=None, description="Shortlisting rationale or filter (e.g. TOP_3, L1_AND_L2)")


class ShortlistResponse(BaseModel):
    cs_id: UUID
    shortlisted_vendor_ids: List[UUID]
    message: str


# ─── Negotiation Schemas ──────────────────────────────────────────────────────

class NegotiationStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vendor_ids: List[UUID] = Field(..., min_length=1, description="Shortlisted vendor IDs to initiate negotiations with")
    notes: Optional[str] = None


class NegotiatedPriceSubmitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    negotiated_price: Decimal = Field(..., gt=0, description="Revised negotiated total price in INR")
    notes: Optional[str] = None


class NegotiationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    rfq_id: UUID
    cs_id: Optional[UUID] = None
    vendor_id: UUID
    round_number: int
    original_price: Optional[Decimal] = None
    negotiated_price: Optional[Decimal] = None
    price_change_pct: Optional[Decimal] = None
    proposed_price: Optional[Decimal] = None
    counter_price: Optional[Decimal] = None
    status: str
    notes: Optional[str] = None
    negotiated_by: UUID
    initiated_by: Optional[UUID] = None
    created_at: Optional[datetime] = None


# ─── Award Schemas ────────────────────────────────────────────────────────────

class AwardRecommendationItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lot_id: Optional[UUID] = None
    rfq_line_id: Optional[UUID] = None
    vendor_id: UUID
    bid_id: UUID
    value: Decimal = Field(..., gt=0, description="Total awarded value in INR")
    quantity: Optional[Decimal] = Field(default=Decimal("1.0"), gt=0)
    unit_price: Optional[Decimal] = None
    award_type: Optional[str] = Field(default="FULL", description="FULL / SPLIT")
    justification: str = Field(..., min_length=3, description="Award reason / L1 justification")


class AwardRecommendRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    awards: List[AwardRecommendationItem] = Field(..., min_length=1)
    justification: str = Field(..., min_length=5, description="Overall business case justification for award")


class AwardDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    arn_id: UUID
    lot_id: Optional[UUID] = None
    rfq_line_id: Optional[UUID] = None
    vendor_id: UUID
    bid_id: UUID
    awarded_unit_price: Decimal
    awarded_quantity: Decimal
    awarded_total: Decimal
    award_type: str
    justification: Optional[str] = None
    created_at: Optional[datetime] = None


class AwardRecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    rfq_id: UUID
    cs_id: UUID
    arn_number: str
    status: str
    justification: str
    total_awarded_value: Optional[Decimal] = None
    recommended_by: UUID
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    details: List[AwardDetailResponse] = []


class AwardApprovalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    task_id: Optional[UUID] = None
    comments: Optional[str] = None


class RegretLettersResponse(BaseModel):
    sent_to_vendors: List[UUID]
    count: int
    message: str
