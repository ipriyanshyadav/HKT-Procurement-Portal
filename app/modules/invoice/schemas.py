from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InvoiceLineCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    po_line_id: UUID
    grn_line_id: Optional[UUID] = None
    line_number: int = Field(..., ge=1)
    item_description: str = Field(..., min_length=1, max_length=500)
    quantity: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., gt=0)
    tax_rate: Decimal = Field(default=Decimal("0.0"), ge=0)
    tax_amount: Decimal = Field(default=Decimal("0.0"), ge=0)
    line_total: Optional[Decimal] = None


class InvoiceLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    invoice_id: UUID
    po_line_id: UUID
    grn_line_id: Optional[UUID] = None
    line_number: int
    item_description: str
    quantity: Decimal
    unit_price: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    line_total: Decimal


class InvoiceMatchLineResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    invoice_line_id: UUID
    po_line_id: UUID
    price_match: bool
    price_deviation: Optional[Decimal] = None
    quantity_match: bool
    quantity_deviation: Optional[Decimal] = None
    po_reference_valid: bool
    tax_match: bool
    tax_deviation: Decimal
    overall_match: bool
    mismatch_reasons: Optional[List[str]] = None
    created_at: datetime


class InvoiceSubmitRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    po_id: UUID
    vendor_invoice_number: str = Field(..., min_length=1, max_length=50)
    invoice_date: date
    due_date: Optional[date] = None
    currency: str = Field(default="INR", max_length=3)
    subtotal: Decimal = Field(..., ge=0)
    tax_amount: Decimal = Field(default=Decimal("0.0"), ge=0)
    total_amount: Decimal = Field(..., gt=0)
    payment_terms_code: Optional[str] = None
    notes: Optional[str] = None
    lines: List[InvoiceLineCreate] = Field(..., min_length=1)


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    invoice_number: str
    vendor_invoice_number: str
    vendor_id: UUID
    vendor_name: Optional[str] = None
    po_id: UUID
    po_number: Optional[str] = None
    status: str
    invoice_date: date
    due_date: date
    currency: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    tds_amount: Optional[Decimal] = Decimal("0.0")
    financial_year: Optional[str] = None
    payment_terms_code: Optional[str] = None
    match_status: str
    price_tolerance: Decimal
    erp_invoice_number: Optional[str] = None
    erp_sync_status: str
    payment_status: str
    paid_amount: Decimal
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: List[InvoiceLineResponse] = Field(default_factory=list)
    match_results: List[InvoiceMatchLineResultResponse] = Field(default_factory=list)


class EligibleLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    po_id: UUID
    po_number: str
    po_line_id: UUID
    line_number: int
    item_description: str
    ordered_quantity: Decimal
    unit_price: Decimal
    tax_rate: Decimal
    received_quantity: Decimal
    already_invoiced_quantity: Decimal
    eligible_quantity: Decimal


class InvoiceFilterParams(BaseModel):
    po_id: Optional[UUID] = None
    vendor_id: Optional[UUID] = None
    status: Optional[str] = None
    match_status: Optional[str] = None
    payment_status: Optional[str] = None
    financial_year: Optional[str] = None
    search: Optional[str] = None
    page: int = 1
    page_size: int = 20


class InvoiceDisputeRequest(BaseModel):
    reason_code: str = Field(..., min_length=2, max_length=30)
    description: str = Field(..., min_length=3)


class InvoiceRejectRequest(BaseModel):
    rejection_reason: str = Field(..., min_length=3)
