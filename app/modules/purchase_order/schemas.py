from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class POLineCreate(BaseModel):
    item_description: str = Field(..., min_length=1, max_length=500)
    item_code: str | None = Field(None, max_length=50)
    uom_id: UUID
    ordered_quantity: Decimal = Field(..., gt=Decimal("0"))
    unit_price: Decimal = Field(..., gt=Decimal("0"))
    awarded_unit_price: Decimal | None = None
    hsn_code: str | None = Field(None, max_length=10)
    tax_rate: Decimal = Field(default=Decimal("0.0"), ge=Decimal("0"))
    delivery_date: date | None = None


class POLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    po_id: UUID
    line_number: int
    item_description: str
    item_code: str | None = None
    uom_id: UUID
    ordered_quantity: Decimal
    unit_price: Decimal
    total_price: Decimal | None = None
    awarded_unit_price: Decimal | None = None
    hsn_code: str | None = None
    tax_rate: Decimal
    open_quantity: Decimal
    received_quantity: Decimal = Decimal("0")
    invoiced_quantity: Decimal = Decimal("0")
    delivery_date: date | None = None
    created_at: datetime | None = None


class POCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=300)
    vendor_id: UUID
    business_unit_id: UUID
    category_id: UUID
    currency: str = Field(default="INR", min_length=3, max_length=3)
    lines: list[POLineCreate] = Field(..., min_length=1)
    rfq_id: UUID | None = None
    arn_id: UUID | None = None
    contract_id: UUID | None = None
    plant_id: UUID | None = None
    payment_term_id: UUID | None = None
    incoterm_id: UUID | None = None
    delivery_location_id: UUID | None = None
    expected_delivery_date: date | None = None
    deviation_justification: str | None = None
    source_pr_id: UUID | None = None
    po_type: str | None = "STANDARD"


class POFromAwardRequest(BaseModel):
    arn_id: UUID
    deviation_justification: str | None = None


class POAmendRequest(BaseModel):
    reason: str = Field(..., min_length=3)
    value_change: Decimal | None = Decimal("0.0")
    field_changes: dict[str, Any] = Field(default_factory=dict)
    line_updates: list[dict[str, Any]] | None = None


class POAmendmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    po_id: UUID
    amendment_number: int
    reason: str
    field_changes: dict[str, Any]
    value_change: Decimal
    re_approval_required: bool
    amended_by: UUID
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    created_at: datetime


class POAcknowledgeRequest(BaseModel):
    accepted: bool = True
    rejection_reason: str | None = None


class POCancelRequest(BaseModel):
    cancellation_reason: str = Field(..., min_length=3)


class POResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    po_number: str
    title: str
    vendor_id: UUID
    vendor_name: str | None = None
    source_pr_id: UUID | None = None
    rfq_id: UUID | None = None
    arn_id: UUID | None = None
    contract_id: UUID | None = None
    status: str
    business_unit_id: UUID
    plant_id: UUID | None = None
    category_id: UUID
    currency: str
    total_value: Decimal
    payment_term_id: UUID | None = None
    incoterm_id: UUID | None = None
    delivery_location_id: UUID | None = None
    expected_delivery_date: date | None = None
    buyer_id: UUID
    erp_po_number: str | None = None
    erp_sync_status: str
    po_document_path: str | None = None
    sent_at: datetime | None = None
    acknowledged_at: datetime | None = None
    vendor_acknowledged_at: datetime | None = None
    rejected_reason: str | None = None
    vendor_rejection_reason: str | None = None
    deviation_justification: str | None = None
    cancellation_reason: str | None = None
    amendment_count: int
    created_at: datetime
    updated_at: datetime
    lines: list[POLineResponse] = Field(default_factory=list)
    amendments: list[POAmendmentResponse] = Field(default_factory=list)


class POFilterParams(BaseModel):
    status: str | None = None
    vendor_id: UUID | None = None
    business_unit_id: UUID | None = None
    rfq_id: UUID | None = None
    contract_id: UUID | None = None
    search: str | None = None
    page: int = 1
    page_size: int = 20
