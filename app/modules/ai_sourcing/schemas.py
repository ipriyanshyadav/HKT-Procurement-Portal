from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


# 1. Smart RFQ Generator Schemas
class GenerateSmartRfqRequest(BaseModel):
    pr_id: UUID | None = None
    unmapped_exception_ids: list[UUID] | None = None
    custom_lot_items: list[dict[str, Any]] | None = None
    title: str | None = None


class AnomalyFlag(BaseModel):
    item_description: str
    proposed_unit_price: float
    benchmark_price: float
    variance_pct: float
    flag_type: str  # "HIGH_PRICE_OUTLIER", "LOW_PRICE_ANOMALY", "HISTORICAL_SPIKE"
    explanation: str


class AiRfqDraftResponse(BaseModel):
    id: UUID
    org_id: UUID
    pr_id: UUID | None = None
    rfq_title: str
    target_category_id: UUID | None = None
    lots: list[dict[str, Any]]
    anomaly_flags: list[dict[str, Any]]
    estimated_total_value: float
    status: str
    converted_rfq_id: UUID | None = None
    created_at: datetime


class ConvertDraftToRfqRequest(BaseModel):
    draft_id: UUID
    bid_submission_deadline: datetime | None = None


class ConvertDraftToRfqResponse(BaseModel):
    rfq_id: UUID
    rfq_number: str
    title: str
    status: str
    lot_count: int
    estimated_value: float


# 2. Autonomous Tail-Spend Negotiation Bot Schemas
class StartNegotiationSessionRequest(BaseModel):
    vendor_id: UUID
    item_description: str
    initial_quote_price: float
    target_price: float
    max_acceptable_price: float
    rfq_id: UUID | None = None
    concession_strategy: str = Field(default="BALANCED", description="AGGRESSIVE, BALANCED, or COLLABORATIVE")


class SubmitSupplierCounterRequest(BaseModel):
    session_id: UUID
    vendor_counter_price: float
    vendor_message: str | None = None


class NegotiationRoundResponse(BaseModel):
    id: UUID
    session_id: UUID
    round_number: int
    bidder_type: str
    offer_price: float
    counter_offer_price: float | None = None
    concession_amount: float
    rationale: str
    response_payload: dict[str, Any]
    created_at: datetime


class NegotiationSessionResponse(BaseModel):
    id: UUID
    org_id: UUID
    rfq_id: UUID | None = None
    vendor_id: UUID
    vendor_name: str | None = None
    item_description: str
    initial_quote_price: float
    target_price: float
    max_acceptable_price: float
    current_bid_price: float
    bot_status: str
    current_round: int
    max_rounds: int
    savings_achieved: float
    concession_strategy: str
    rounds: list[NegotiationRoundResponse]
    created_at: datetime


# 3. Supplier Recommendation Radar Schemas
class CalculateRadarScoresRequest(BaseModel):
    category_id: UUID | None = None
    vendor_ids: list[UUID] | None = None


class SupplierRadarScoreResponse(BaseModel):
    id: UUID
    org_id: UUID
    vendor_id: UUID
    vendor_name: str | None = None
    category_id: UUID | None = None
    category_name: str | None = None
    overall_fit_score: float
    quality_score: float
    esg_score: float
    lead_time_score: float
    price_competitiveness_score: float
    recommendation_tier: str
    insights: dict[str, Any]
    calculated_at: datetime
