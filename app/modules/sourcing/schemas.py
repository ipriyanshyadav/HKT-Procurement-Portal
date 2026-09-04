from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Any, Dict
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, ConfigDict

from app.db.enums import RfqTypeEnum, SourcingTypeEnum, EvaluationTypeEnum, ProcurementTypeEnum


# ─── Request Schemas ─────────────────────────────────────────────────────────

class RfqLotCreateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: Optional[str] = None
    estimated_value: Decimal = Field(default=Decimal("0.0"), ge=0)
    payment_term_override_id: Optional[UUID] = None
    incoterm_override_id: Optional[UUID] = None


class RfqLineCreateRequest(BaseModel):
    lot_id: Optional[UUID] = None
    line_number: int = Field(ge=1)
    item_description: str = Field(min_length=3, max_length=500)
    item_code: Optional[str] = Field(None, max_length=50)
    category_id: UUID
    uom_id: UUID
    quantity: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    estimated_unit_price: Decimal = Field(default=Decimal("0.0"), ge=0)
    hsn_code: Optional[str] = Field(None, max_length=10)
    specifications: Optional[str] = None
    required_by_date: Optional[date] = None
    delivery_location_id: Optional[UUID] = None


class RfqCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    description: Optional[str] = None
    rfq_type: str = Field(default="LIMITED_TENDER")
    sourcing_type: str = Field(default="GOODS")
    evaluation_type: str = Field(default="L1_PRICE_ONLY")
    procurement_type: str = Field(default="OPEX")
    business_unit_id: UUID
    category_id: UUID
    currency: str = Field(default="INR", min_length=3, max_length=3)
    estimated_value: Decimal = Field(default=Decimal("0.0"), ge=0)
    payment_term_id: Optional[UUID] = None
    incoterm_id: Optional[UUID] = None
    delivery_location_id: Optional[UUID] = None
    bid_close_at: datetime
    bid_open_at: Optional[datetime] = None
    bid_validity_days: int = Field(default=90, ge=1)
    is_multi_lot: bool = False
    lot_participation_mode: str = "MANDATORY_ALL"
    source_pr_id: Optional[UUID] = None
    lots: List[RfqLotCreateRequest] = Field(default_factory=list)
    lines: List[RfqLineCreateRequest] = Field(default_factory=list)


class RfqUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=300)
    description: Optional[str] = None
    rfq_type: Optional[str] = None
    sourcing_type: Optional[str] = None
    evaluation_type: Optional[str] = None
    estimated_value: Optional[Decimal] = None
    bid_close_at: Optional[datetime] = None
    bid_open_at: Optional[datetime] = None
    bid_validity_days: Optional[int] = Field(None, ge=1)
    lots: Optional[List[RfqLotCreateRequest]] = None
    lines: Optional[List[RfqLineCreateRequest]] = None


class AddParticipantsRequest(BaseModel):
    vendor_ids: List[UUID] = Field(min_length=1)


class AmendRequest(BaseModel):
    changes_summary: str = Field(min_length=5)
    new_bid_close_at: Optional[datetime] = None
    field_changes: Dict[str, Any] = Field(default_factory=dict)


class CancelRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=1000)


class ExtendDeadlineRequest(BaseModel):
    new_bid_close_at: datetime
    reason: str = Field(min_length=5, max_length=500)


class ClarificationCreateRequest(BaseModel):
    question: str = Field(min_length=10)


class ClarificationRespondRequest(BaseModel):
    answer: str = Field(min_length=5)
    broadcast: bool = True


# ─── Response Schemas ─────────────────────────────────────────────────────────

class RfqLotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    rfq_id: UUID
    lot_number: int
    title: str
    description: Optional[str] = None
    estimated_value: Decimal
    created_at: datetime
    updated_at: datetime


class RfqLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    rfq_id: UUID
    lot_id: Optional[UUID] = None
    line_number: int
    item_description: str
    item_code: Optional[str] = None
    category_id: UUID
    uom_id: UUID
    quantity: Decimal
    estimated_unit_price: Decimal
    hsn_code: Optional[str] = None
    specifications: Optional[str] = None
    required_by_date: Optional[date] = None
    delivery_location_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class RfqParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    rfq_id: UUID
    vendor_id: UUID
    invited_at: datetime
    invitation_status: str
    accepted_at: Optional[datetime] = None
    regretted_at: Optional[datetime] = None


class RfqClarificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    rfq_id: UUID
    question: str
    answer: Optional[str] = None
    asked_by: UUID
    asked_by_vendor_id: Optional[UUID] = None
    answered_by: Optional[UUID] = None
    answered_at: Optional[datetime] = None
    is_published: bool
    published_at: Optional[datetime] = None
    created_at: datetime


class RfqDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    rfq_number: str
    title: str
    description: Optional[str] = None
    rfq_type: str
    sourcing_type: str
    evaluation_type: str
    procurement_type: str
    status: str
    buyer_id: UUID
    business_unit_id: UUID
    category_id: UUID
    currency: str
    estimated_value: Decimal
    bid_close_at: Optional[datetime] = None
    bid_open_at: Optional[datetime] = None
    bid_validity_days: int
    is_multi_lot: bool
    is_emergency: bool
    is_single_vendor: bool
    amendment_count: int
    published_at: Optional[datetime] = None
    bids_opened_at: Optional[datetime] = None
    bid_opening_initiated_by: Optional[UUID] = None
    bid_opening_initiated_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancel_reason: Optional[str] = None
    source_pr_id: Optional[UUID] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    lots: List[RfqLotResponse] = Field(default_factory=list)
    lines: List[RfqLineResponse] = Field(default_factory=list)
    participants: List[RfqParticipantResponse] = Field(default_factory=list)
    clarifications: List[RfqClarificationResponse] = Field(default_factory=list)


class RfqListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    rfq_number: str
    title: str
    rfq_type: str
    status: str
    buyer_id: UUID
    business_unit_id: UUID
    category_id: UUID
    currency: str
    estimated_value: Decimal
    bid_close_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    bids_opened_at: Optional[datetime] = None
    amendment_count: int
    created_at: datetime
    updated_at: datetime


class BidCountResponse(BaseModel):
    rfq_id: UUID
    bid_count: int
    bids_opened: bool
    bids_opened_at: Optional[datetime] = None


class RfqDashboardResponse(BaseModel):
    rfq_id: UUID
    status: str
    bid_count: int
    bids_opened: bool
    participant_count: int
    clarification_count: int
    unanswered_clarifications: int
    bid_opening_step: int
    days_to_deadline: Optional[int] = None
