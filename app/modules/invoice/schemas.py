from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InvoiceLineCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    po_line_id: UUID
    grn_line_id: UUID | None = None
    line_number: int = Field(..., ge=1)
    item_description: str = Field(..., min_length=1, max_length=500)
    quantity: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., gt=0)
    tax_rate: Decimal = Field(default=Decimal("0.0"), ge=0)
    tax_amount: Decimal = Field(default=Decimal("0.0"), ge=0)
    line_total: Decimal | None = None


class InvoiceLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    invoice_id: UUID
    po_line_id: UUID
    grn_line_id: UUID | None = None
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
    price_deviation: Decimal | None = None
    quantity_match: bool
    quantity_deviation: Decimal | None = None
    po_reference_valid: bool
    tax_match: bool
    tax_deviation: Decimal
    overall_match: bool
    mismatch_reasons: list[str] | None = None
    created_at: datetime


class InvoiceSubmitRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    po_id: UUID
    vendor_invoice_number: str = Field(..., min_length=1, max_length=50)
    invoice_date: date
    due_date: date | None = None
    currency: str = Field(default="INR", max_length=3)
    subtotal: Decimal = Field(..., ge=0)
    tax_amount: Decimal = Field(default=Decimal("0.0"), ge=0)
    total_amount: Decimal = Field(..., gt=0)
    payment_terms_code: str | None = None
    notes: str | None = None
    lines: list[InvoiceLineCreate] = Field(..., min_length=1)


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    invoice_number: str
    vendor_invoice_number: str
    vendor_id: UUID
    vendor_name: str | None = None
    po_id: UUID
    po_number: str | None = None
    status: str
    invoice_date: date
    due_date: date
    currency: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    tds_amount: Decimal | None = Decimal("0.0")
    financial_year: str | None = None
    payment_terms_code: str | None = None
    match_status: str
    price_tolerance: Decimal
    erp_invoice_number: str | None = None
    erp_sync_status: str
    payment_status: str
    paid_amount: Decimal
    early_discount_amount: Decimal | None = Decimal("0.0")
    early_discount_status: str | None = "NONE"
    early_discount_payout_date: date | None = None
    early_discount_apr: Decimal | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    lines: list[InvoiceLineResponse] = Field(default_factory=list)
    match_results: list[InvoiceMatchLineResultResponse] = Field(default_factory=list)


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
    po_id: UUID | None = None
    vendor_id: UUID | None = None
    status: str | None = None
    match_status: str | None = None
    payment_status: str | None = None
    financial_year: str | None = None
    search: str | None = None
    page: int = 1
    page_size: int = 20


class InvoiceDisputeRequest(BaseModel):
    reason_code: str = Field(..., min_length=2, max_length=30)
    description: str = Field(..., min_length=3)


class InvoiceRejectRequest(BaseModel):
    rejection_reason: str = Field(..., min_length=3)


class AdvancedReconciliationRequest(BaseModel):
    match_mode: str = Field(default="FOUR_WAY", description="THREE_WAY or FOUR_WAY")
    price_tolerance_pct: float = Field(default=2.0, ge=0.0, le=20.0)
    quantity_tolerance_pct: float = Field(default=5.0, ge=0.0, le=20.0)
    auto_approve_if_matched: bool = Field(default=True)


class ReconciliationDiscrepancyItem(BaseModel):
    line_number: int
    item_description: str
    po_unit_price: float
    invoice_unit_price: float
    price_variance_pct: float
    po_quantity: float
    grn_received_quantity: float
    quality_inspected_quantity: float
    invoice_quantity: float
    quantity_variance_pct: float
    status: str
    reasons: list[str]
    suggested_credit_note_amount: float


class AdvancedReconciliationResponse(BaseModel):
    invoice_id: UUID
    invoice_number: str
    match_mode: str
    price_tolerance_pct: float
    quantity_tolerance_pct: float
    overall_status: str
    matched_lines_count: int
    discrepancy_lines_count: int
    total_invoice_amount: float
    suggested_credit_note_total: float
    auto_approved: bool
    line_details: list[ReconciliationDiscrepancyItem]
    reconciliation_timestamp: datetime


class PoFlipLineDraft(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    po_line_id: UUID
    line_number: int
    item_description: str
    po_quantity: Decimal
    received_quantity: Decimal
    invoiced_quantity: Decimal
    invoiceable_quantity: Decimal
    unit_price: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    line_total: Decimal


class PoFlipDraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    po_id: UUID
    po_number: str
    vendor_id: UUID
    vendor_name: str | None = None
    currency: str
    payment_terms_code: str | None = None
    suggested_invoice_date: date
    suggested_due_date: date | None = None
    suggested_vendor_invoice_number: str
    lines: list[PoFlipLineDraft]
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    can_invoice: bool
    blocking_reason: str | None = None


class EarlyDiscountOption(BaseModel):
    days_early: int
    accelerated_payout_date: date
    annual_percentage_rate: float
    discount_percentage: float
    discount_amount: Decimal
    gross_amount: Decimal
    net_payout_amount: Decimal
    cash_yield_annualized_pct: float


class EarlyDiscountOptionsResponse(BaseModel):
    invoice_id: UUID
    invoice_number: str
    original_due_date: date
    currency: str
    total_amount: Decimal
    eligible: bool
    blocking_reason: str | None = None
    options: list[EarlyDiscountOption] = Field(default_factory=list)


class EarlyDiscountRequest(BaseModel):
    accelerated_payout_date: date
    annual_percentage_rate: float = Field(..., ge=0.01, le=0.50)
    discount_amount: Decimal = Field(..., gt=Decimal("0.0"))
    notes: str | None = None


class EarlyDiscountActionResponse(BaseModel):
    invoice_id: UUID
    invoice_number: str
    early_discount_status: str
    original_due_date: date
    accelerated_payout_date: date | None = None
    discount_amount: Decimal
    net_payable_amount: Decimal
    currency: str
    message: str
