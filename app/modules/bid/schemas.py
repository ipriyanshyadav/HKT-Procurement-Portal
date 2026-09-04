from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Any
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

