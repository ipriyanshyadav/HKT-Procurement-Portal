from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AsnLineCreate(BaseModel):
    po_line_id: UUID
    shipped_quantity: Decimal = Field(..., gt=Decimal("0"))
    lot_number: str | None = Field(None, max_length=100)
    serial_numbers: list[str] = Field(default_factory=list)
    expiry_date: date | None = None
    manufacturing_date: date | None = None


class AsnCreateRequest(BaseModel):
    po_id: UUID
    shipment_date: date | None = None
    expected_delivery_date: date
    carrier_name: str = Field(..., min_length=1, max_length=100)
    tracking_number: str = Field(..., min_length=1, max_length=100)
    vehicle_number: str | None = Field(None, max_length=50)
    driver_name: str | None = Field(None, max_length=100)
    driver_phone: str | None = Field(None, max_length=30)
    packaging_type: str = Field(default="BOX", max_length=30)
    package_count: int = Field(default=1, ge=1)
    gross_weight_kg: Decimal | None = Field(None, ge=Decimal("0"))
    notes: str | None = None
    lines: list[AsnLineCreate] = Field(..., min_length=1)


class AsnDispatchPayload(BaseModel):
    carrier_name: str | None = Field(None, max_length=100)
    tracking_number: str | None = Field(None, max_length=100)
    vehicle_number: str | None = Field(None, max_length=50)
    notes: str | None = None


class AsnLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asn_id: UUID
    po_line_id: UUID
    item_code: str | None = None
    item_description: str
    uom: str
    ordered_quantity: Decimal
    shipped_quantity: Decimal
    received_quantity: Decimal
    lot_number: str | None = None
    serial_numbers: list[str] = Field(default_factory=list)
    expiry_date: date | None = None
    manufacturing_date: date | None = None


class AsnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    asn_number: str
    po_id: UUID
    vendor_id: UUID
    shipment_date: date
    expected_delivery_date: date
    carrier_name: str
    tracking_number: str
    vehicle_number: str | None = None
    driver_name: str | None = None
    driver_phone: str | None = None
    packaging_type: str
    package_count: int
    gross_weight_kg: Decimal | None = None
    status: str
    barcode_data: str
    notes: str | None = None
    shipped_at: datetime | None = None
    received_at: datetime | None = None
    grn_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    lines: list[AsnLineResponse] = Field(default_factory=list)
    po_number: str | None = None
    vendor_name: str | None = None


AsnDetailResponse = AsnResponse


class AsnFilterParams(BaseModel):
    po_id: UUID | None = None
    vendor_id: UUID | None = None
    status: str | None = None
    search: str | None = None
    page: int = 1
    page_size: int = 20


class AsnScanLookupRequest(BaseModel):
    code: str = Field(..., min_length=1)


class AsnFastGrnRequest(BaseModel):
    challan_number: str | None = Field(None, max_length=50)
    notes: str | None = None
