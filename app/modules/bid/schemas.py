from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Any, Literal
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


# ─── Request Schemas ─────────────────────────────────────────────────────────

class BidLineSubmitRequest(BaseModel):
    lot_id: Optional[UUID] = None
    rfq_line_id: UUID
    unit_price: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    total_price: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    quantity: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    delivery_days: int = Field(ge=0)
    tax_rate_declared: Decimal = Field(default=Decimal("0.0"), ge=0)
    freight_quoted: Decimal = Field(default=Decimal("0.0"), ge=0)
    country_of_origin: str = Field(default="IN", max_length=2)
    remarks: Optional[str] = None


class BidSubmitRequest(BaseModel):
    has_deviations: bool = False
    deviation_details: Optional[str] = None
    technical_offer_compliant: bool = True
    payment_terms_code: Optional[str] = None
    delivery_terms_incoterm: Optional[str] = None
    bid_validity_days: int = Field(default=90, ge=1)
    covering_letter: Optional[str] = None
    lines: List[BidLineSubmitRequest] = Field(min_length=1)


class BidReviseRequest(BaseModel):
    has_deviations: Optional[bool] = None
    deviation_details: Optional[str] = None
    technical_offer_compliant: Optional[bool] = None
    payment_terms_code: Optional[str] = None
    delivery_terms_incoterm: Optional[str] = None
    bid_validity_days: Optional[int] = Field(None, ge=1)
    covering_letter: Optional[str] = None
    lines: List[BidLineSubmitRequest] = Field(min_length=1)


class BidWithdrawRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


# ─── Response Schemas ─────────────────────────────────────────────────────────

class BidLineDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    bid_id: UUID
    rfq_line_id: UUID
    lot_id: Optional[UUID] = None
    currency: str
    quantity: Decimal
    delivery_days: int
    # Price only populated after bids opened
    unit_price: Optional[Decimal] = None
    total_price: Optional[Decimal] = None
    normalized_price_inr: Optional[Decimal] = None
    exchange_rate_used: Optional[Decimal] = None
    tax_rate_declared: Decimal
    freight_quoted: Decimal
    country_of_origin: str
    remarks: Optional[str] = None


class BidDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    rfq_id: UUID
    vendor_id: UUID
    status: str
    current_version: int
    submitted_at: Optional[datetime] = None
    has_deviations: bool
    deviation_details: Optional[str] = None
    technical_offer_compliant: bool
    payment_terms_code: Optional[str] = None
    delivery_terms_incoterm: Optional[str] = None
    bid_validity_days: int
    covering_letter: Optional[str] = None
    is_single_vendor_situation: bool
    bid_opened_at: Optional[datetime] = None
    is_technically_qualified: Optional[bool] = None
    technical_score: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime
    # Lines included — prices masked until bids_opened
    lines: List[BidLineDetailResponse] = Field(default_factory=list)


class BidListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    rfq_id: UUID
    vendor_id: UUID
    status: str
    current_version: int
    submitted_at: Optional[datetime] = None
    is_single_vendor_situation: bool
    created_at: datetime


class SingleVendorCheckResponse(BaseModel):
    rfq_id: UUID
    is_single_vendor: bool
    bid_count: int
    requires_override: bool


class BidCountResponse(BaseModel):
    rfq_id: UUID
    bid_count: int
    bids_opened: bool
    bids_opened_at: Optional[datetime] = None


# ─── Live Auction Schemas (SPEC_11B) ──────────────────────────────────────────

class AuctionConfig(BaseModel):
    """Stored in rfq.auction_config JSONB column."""
    auction_start_at: datetime            # Scheduled start time (UTC)
    auction_duration_minutes: int = Field(ge=5, le=480, default=60)
    lot_ids: list[UUID] = Field(default_factory=list) # Which lots are in auction (all lots if empty)
    reserve_price_inr: Optional[Decimal] = None   # Hidden from suppliers; bid rejected if above
    min_decrement_type: Literal["PERCENTAGE", "ABSOLUTE"] = "PERCENTAGE"
    min_decrement_value: Decimal = Field(gt=0, default=Decimal("0.5"))  # 0.5% or INR amount
    rank_visibility: Literal["RANK_ONLY", "PRICE_AND_RANK", "NO_RANK"] = "RANK_ONLY"
    auto_extend: bool = True
    auto_extend_trigger_minutes: int = Field(ge=1, le=15, default=5)   # Bid in last N mins triggers extension
    auto_extend_duration_minutes: int = Field(ge=1, le=30, default=10) # Extend by M mins
    max_extensions: int = Field(ge=0, le=10, default=3)
    allow_proxy_bid: bool = False         # Supplier sets floor; system auto-bids to maintain rank
    require_all_lots: bool = True         # Supplier must bid on ALL lots to be ranked


class AuctionCreateRequest(BaseModel):
    rfq_id: UUID
    config: AuctionConfig


class LiveAuctionDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    rfq_id: UUID
    rfq_number: Optional[str] = None
    rfq_title: Optional[str] = None
    status: str
    config: dict
    scheduled_start_at: datetime
    actual_start_at: Optional[datetime] = None
    current_close_at: datetime
    extension_count: int
    winner_vendor_id: Optional[UUID] = None
    winning_bid_id: Optional[UUID] = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime

