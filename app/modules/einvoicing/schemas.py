from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class GenerateEInvoiceRequest(BaseModel):
    seller_gstin: str = Field(min_length=15, max_length=15)
    buyer_gstin: str = Field(min_length=15, max_length=15)
    doc_number: str
    doc_type: str = "INV"
    total_invoice_value: float
    total_tax_value: float = 0.0
    invoice_id: UUID | None = None
    asn_id: UUID | None = None
    items: list[dict[str, Any]] | None = None


class EInvoiceResponse(BaseModel):
    id: UUID
    org_id: UUID
    invoice_id: UUID | None = None
    asn_id: UUID | None = None
    seller_gstin: str
    buyer_gstin: str
    doc_number: str
    doc_type: str
    financial_year: str
    irn: str
    ack_number: str
    ack_date: datetime
    total_invoice_value: float
    total_tax_value: float
    signed_invoice: str
    signed_qr_code: str
    status: str
    cancellation_reason: str | None = None
    peppol_xml: str | None = None
    created_at: datetime


class CancelEInvoiceRequest(BaseModel):
    irn: str
    cancellation_reason: str = Field(description="1=Duplicate, 2=Data entry mistake, 3=Order cancelled, 4=Others")
    cancellation_remarks: str | None = None


class GenerateEWayBillRequest(BaseModel):
    vehicle_number: str
    from_pincode: str
    to_pincode: str
    distance_km: float
    transporter_id: str | None = None
    transporter_name: str | None = None
    e_invoice_id: UUID | None = None
    asn_id: UUID | None = None


class EWayBillResponse(BaseModel):
    id: UUID
    org_id: UUID
    e_invoice_id: UUID | None = None
    asn_id: UUID | None = None
    ewb_number: str
    ewb_date: datetime
    valid_until: datetime
    transporter_id: str | None = None
    transporter_name: str | None = None
    vehicle_number: str
    distance_km: float
    from_pincode: str
    to_pincode: str
    status: str
    created_at: datetime
