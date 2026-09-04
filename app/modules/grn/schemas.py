from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class QualityInspectionCreate(BaseModel):
    grn_line_id: UUID
    result: str = Field(..., pattern="^(PASSED|REJECTED|PARTIAL)$")
    accepted_quantity: Decimal = Field(..., ge=Decimal("0"))
    rejected_quantity: Decimal = Field(default=Decimal("0.0"), ge=Decimal("0"))
    remarks: Optional[str] = None
    inspection_date: Optional[date] = None


class QualityInspectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    grn_line_id: UUID
    inspector_id: UUID
    inspection_date: date
    result: str
    accepted_quantity: Decimal
    rejected_quantity: Decimal
    remarks: Optional[str] = None
    created_at: datetime


class GrnLineCreate(BaseModel):
    po_line_id: UUID
    received_quantity: Decimal = Field(..., gt=Decimal("0"))
    qc_required: bool = False
    rejection_reason: Optional[str] = None


class GrnLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    grn_id: UUID
    po_line_id: UUID
    received_quantity: Decimal
    accepted_quantity: Decimal
    rejected_quantity: Decimal = Decimal("0")
    rejection_reason: Optional[str] = None
    qc_required: bool = False
    qc_status: str
    inspections: List[QualityInspectionResponse] = Field(default_factory=list)


class GrnCreateRequest(BaseModel):
    po_id: UUID
    receipt_date: Optional[date] = None
    challan_number: Optional[str] = Field(None, max_length=50)
    challan_date: Optional[date] = None
    transporter_name: Optional[str] = Field(None, max_length=200)
    lr_number: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None
    lines: List[GrnLineCreate] = Field(..., min_length=1)


class GrnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    grn_number: str
    po_id: UUID
    vendor_id: UUID
    receipt_date: date
    received_by: UUID
    challan_number: Optional[str] = None
    challan_date: Optional[date] = None
    transporter_name: Optional[str] = None
    lr_number: Optional[str] = None
    status: str
    erp_grn_number: Optional[str] = None
    notes: Optional[str] = None
    grn_document_path: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    lines: List[GrnLineResponse] = Field(default_factory=list)


class GrnFilterParams(BaseModel):
    po_id: Optional[UUID] = None
    vendor_id: Optional[UUID] = None
    status: Optional[str] = None
    search: Optional[str] = None
    page: int = 1
    page_size: int = 20
