from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class POLineCreate(BaseModel):
    item_description: str = Field(..., min_length=1, max_length=500)
    item_code: Optional[str] = Field(None, max_length=50)
    uom_id: UUID
    ordered_quantity: Decimal = Field(..., gt=Decimal("0"))
    unit_price: Decimal = Field(..., gt=Decimal("0"))
    awarded_unit_price: Optional[Decimal] = None
    hsn_code: Optional[str] = Field(None, max_length=10)
    tax_rate: Decimal = Field(default=Decimal("0.0"), ge=Decimal("0"))
    delivery_date: Optional[date] = None


class POLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    po_id: UUID
    line_number: int
    item_description: str
    item_code: Optional[str] = None
    uom_id: UUID
    ordered_quantity: Decimal
    unit_price: Decimal
    total_price: Optional[Decimal] = None
    awarded_unit_price: Optional[Decimal] = None
    hsn_code: Optional[str] = None
    tax_rate: Decimal
    open_quantity: Decimal
    received_quantity: Decimal = Decimal("0")
    invoiced_quantity: Decimal = Decimal("0")
    delivery_date: Optional[date] = None
    created_at: Optional[datetime] = None


class POCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=300)
    vendor_id: UUID
    business_unit_id: UUID
    category_id: UUID
    currency: str = Field(default="INR", min_length=3, max_length=3)
    lines: List[POLineCreate] = Field(..., min_length=1)
    rfq_id: Optional[UUID] = None
    arn_id: Optional[UUID] = None
    contract_id: Optional[UUID] = None
    plant_id: Optional[UUID] = None
    payment_term_id: Optional[UUID] = None
    incoterm_id: Optional[UUID] = None
    delivery_location_id: Optional[UUID] = None
    expected_delivery_date: Optional[date] = None
    deviation_justification: Optional[str] = None
    po_type: Optional[str] = "STANDARD"


class POFromAwardRequest(BaseModel):
    arn_id: UUID
    deviation_justification: Optional[str] = None


class POAmendRequest(BaseModel):
    reason: str = Field(..., min_length=3)
    value_change: Optional[Decimal] = Decimal("0.0")
    field_changes: Dict[str, Any] = Field(default_factory=dict)
    line_updates: Optional[List[Dict[str, Any]]] = None


class POAmendmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    po_id: UUID
    amendment_number: int
    reason: str
    field_changes: Dict[str, Any]
    value_change: Decimal
    re_approval_required: bool
    amended_by: UUID
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    created_at: datetime


class POAcknowledgeRequest(BaseModel):
    accepted: bool = True
    rejection_reason: Optional[str] = None


class POCancelRequest(BaseModel):
    cancellation_reason: str = Field(..., min_length=3)


class POResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    po_number: str
    title: str
    vendor_id: UUID
    vendor_name: Optional[str] = None
    rfq_id: Optional[UUID] = None
    arn_id: Optional[UUID] = None
    contract_id: Optional[UUID] = None
    status: str
    business_unit_id: UUID
    plant_id: Optional[UUID] = None
    category_id: UUID
    currency: str
    total_value: Decimal
    payment_term_id: Optional[UUID] = None
    incoterm_id: Optional[UUID] = None
    delivery_location_id: Optional[UUID] = None
    expected_delivery_date: Optional[date] = None
    buyer_id: UUID
    erp_po_number: Optional[str] = None
    erp_sync_status: str
    po_document_path: Optional[str] = None
    sent_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    vendor_acknowledged_at: Optional[datetime] = None
    rejected_reason: Optional[str] = None
    vendor_rejection_reason: Optional[str] = None
    deviation_justification: Optional[str] = None
    cancellation_reason: Optional[str] = None
    amendment_count: int
    created_at: datetime
    updated_at: datetime
    lines: List[POLineResponse] = Field(default_factory=list)
    amendments: List[POAmendmentResponse] = Field(default_factory=list)


class POFilterParams(BaseModel):
    status: Optional[str] = None
    vendor_id: Optional[UUID] = None
    business_unit_id: Optional[UUID] = None
    rfq_id: Optional[UUID] = None
    contract_id: Optional[UUID] = None
    search: Optional[str] = None
    page: int = 1
    page_size: int = 20
