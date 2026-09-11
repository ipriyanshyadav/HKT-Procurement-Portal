from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class QualityInspectionCreate(BaseModel):
    grn_line_id: UUID
    result: str = Field(..., pattern="^(PASSED|REJECTED|PARTIAL)$")
    accepted_quantity: Decimal = Field(..., ge=Decimal("0"))
    rejected_quantity: Decimal = Field(default=Decimal("0.0"), ge=Decimal("0"))
    remarks: str | None = None
    inspection_date: date | None = None


class QualityInspectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    grn_line_id: UUID
    inspector_id: UUID
    inspection_date: date
    result: str
    accepted_quantity: Decimal
    rejected_quantity: Decimal
    remarks: str | None = None
    created_at: datetime


class GrnLineCreate(BaseModel):
    po_line_id: UUID
    received_quantity: Decimal = Field(..., gt=Decimal("0"))
    qc_required: bool = False
    rejection_reason: str | None = None


class GrnLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    grn_id: UUID
    po_line_id: UUID
    received_quantity: Decimal
    accepted_quantity: Decimal
    rejected_quantity: Decimal = Decimal("0")
    rejection_reason: str | None = None
    qc_required: bool = False
    qc_status: str
    inspections: list[QualityInspectionResponse] = Field(default_factory=list)


class GrnCreateRequest(BaseModel):
    po_id: UUID
    receipt_date: date | None = None
    challan_number: str | None = Field(None, max_length=50)
    challan_date: date | None = None
    transporter_name: str | None = Field(None, max_length=200)
    lr_number: str | None = Field(None, max_length=50)
    notes: str | None = None
    lines: list[GrnLineCreate] = Field(..., min_length=1)


class GrnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    grn_number: str
    po_id: UUID
    vendor_id: UUID
    receipt_date: date
    received_by: UUID
    challan_number: str | None = None
    challan_date: date | None = None
    transporter_name: str | None = None
    lr_number: str | None = None
    status: str
    erp_grn_number: str | None = None
    notes: str | None = None
    grn_document_path: str | None = None
    confirmed_at: datetime | None = None
    confirmed_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    lines: list[GrnLineResponse] = Field(default_factory=list)


class GrnFilterParams(BaseModel):
    po_id: UUID | None = None
    vendor_id: UUID | None = None
    status: str | None = None
    search: str | None = None
    page: int = 1
    page_size: int = 20
