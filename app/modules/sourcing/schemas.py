from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# ─── Request Schemas ─────────────────────────────────────────────────────────

class RfqLotCreateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str | None = None
    estimated_value: Decimal = Field(default=Decimal("0.0"), ge=0)
    payment_term_override_id: UUID | None = None
    incoterm_override_id: UUID | None = None


class RfqLineCreateRequest(BaseModel):
    lot_id: UUID | None = None
    line_number: int = Field(ge=1)
    item_description: str = Field(min_length=3, max_length=500)
    item_code: str | None = Field(None, max_length=50)
    category_id: UUID
    uom_id: UUID
    quantity: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    estimated_unit_price: Decimal = Field(default=Decimal("0.0"), ge=0)
    hsn_code: str | None = Field(None, max_length=10)
    specifications: str | None = None
    required_by_date: date | None = None
    delivery_location_id: UUID | None = None


class RfqCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    description: str | None = None
    rfq_type: str = Field(default="LIMITED_TENDER")
    sourcing_type: str = Field(default="GOODS")
    evaluation_type: str = Field(default="L1_PRICE_ONLY")
    procurement_type: str = Field(default="OPEX")
    business_unit_id: UUID
    category_id: UUID
    currency: str = Field(default="INR", min_length=3, max_length=3)
    estimated_value: Decimal = Field(default=Decimal("0.0"), ge=0)
    payment_term_id: UUID | None = None
    incoterm_id: UUID | None = None
    delivery_location_id: UUID | None = None
    bid_close_at: datetime
    bid_open_at: datetime | None = None
    bid_validity_days: int = Field(default=90, ge=1)
    is_multi_lot: bool = False
    lot_participation_mode: str = "MANDATORY_ALL"
    bidding_mode: str = Field(default="SEALED")
    auction_config: dict[str, Any] | None = None
    source_pr_id: UUID | None = None
    lots: list[RfqLotCreateRequest] = Field(default_factory=list)
    lines: list[RfqLineCreateRequest] = Field(default_factory=list)


class RfqUpdateRequest(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=300)
    description: str | None = None
    rfq_type: str | None = None
    sourcing_type: str | None = None
    evaluation_type: str | None = None
    estimated_value: Decimal | None = None
    bid_close_at: datetime | None = None
    bid_open_at: datetime | None = None
    bid_validity_days: int | None = Field(None, ge=1)
    bidding_mode: str | None = None
    auction_config: dict[str, Any] | None = None
    lots: list[RfqLotCreateRequest] | None = None
    lines: list[RfqLineCreateRequest] | None = None


class AddParticipantsRequest(BaseModel):
    vendor_ids: list[UUID] = Field(min_length=1)


class AmendRequest(BaseModel):
    changes_summary: str = Field(min_length=5)
    new_bid_close_at: datetime | None = None
    field_changes: dict[str, Any] = Field(default_factory=dict)


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
    description: str | None = None
    estimated_value: Decimal
    created_at: datetime
    updated_at: datetime


class RfqLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    rfq_id: UUID
    lot_id: UUID | None = None
    line_number: int
    item_description: str
    item_code: str | None = None
    category_id: UUID
    uom_id: UUID
    quantity: Decimal
    estimated_unit_price: Decimal
    hsn_code: str | None = None
    specifications: str | None = None
    required_by_date: date | None = None
    delivery_location_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class RfqParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    rfq_id: UUID
    vendor_id: UUID
    invited_at: datetime
    invitation_status: str
    accepted_at: datetime | None = None
    regretted_at: datetime | None = None


class RfqClarificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    rfq_id: UUID
    question: str
    answer: str | None = None
    asked_by: UUID
    asked_by_vendor_id: UUID | None = None
    answered_by: UUID | None = None
    answered_at: datetime | None = None
    is_published: bool
    published_at: datetime | None = None
    created_at: datetime


class RfqDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    rfq_number: str
    title: str
    description: str | None = None
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
    bid_close_at: datetime | None = None
    bid_open_at: datetime | None = None
    bid_validity_days: int
    is_multi_lot: bool
    is_emergency: bool
    is_single_vendor: bool
    amendment_count: int
    published_at: datetime | None = None
    bids_opened_at: datetime | None = None
    bid_opening_initiated_by: UUID | None = None
    bid_opening_initiated_at: datetime | None = None
    cancelled_at: datetime | None = None
    cancel_reason: str | None = None
    source_pr_id: UUID | None = None
    bidding_mode: str = "SEALED"
    auction_config: dict[str, Any] | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    lots: list[RfqLotResponse] = Field(default_factory=list)
    lines: list[RfqLineResponse] = Field(default_factory=list)
    participants: list[RfqParticipantResponse] = Field(default_factory=list)
    clarifications: list[RfqClarificationResponse] = Field(default_factory=list)


class RfqListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    rfq_number: str
    title: str
    rfq_type: str
    bidding_mode: str = "SEALED"
    status: str
    buyer_id: UUID
    business_unit_id: UUID
    category_id: UUID
    currency: str
    estimated_value: Decimal
    bid_close_at: datetime | None = None
    published_at: datetime | None = None
    bids_opened_at: datetime | None = None
    amendment_count: int
    created_at: datetime
    updated_at: datetime


class BidCountResponse(BaseModel):
    rfq_id: UUID
    bid_count: int
    bids_opened: bool
    bids_opened_at: datetime | None = None


class RfqDashboardResponse(BaseModel):
    rfq_id: UUID
    status: str
    bid_count: int
    bids_opened: bool
    participant_count: int
    clarification_count: int
    unanswered_clarifications: int
    bid_opening_step: int
    days_to_deadline: int | None = None
