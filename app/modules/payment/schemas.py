from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PaymentRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    invoice_id: UUID
    invoice_number: Optional[str] = None
    vendor_id: UUID
    vendor_name: Optional[str] = None
    payment_date: date
    amount: Decimal
    gross_amount: Optional[Decimal] = Decimal("0.0")
    tds_amount: Optional[Decimal] = Decimal("0.0")
    net_amount: Optional[Decimal] = Decimal("0.0")
    payment_due_date: Optional[date] = None
    currency: str
    utr_number: Optional[str] = None
    payment_method: Optional[str] = None
    erp_payment_reference: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime


class PaymentProcessRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    utr_number: str = Field(..., min_length=3, max_length=50)
    payment_method: str = Field(default="NEFT", max_length=30)
    payment_date: Optional[date] = None
    erp_payment_reference: Optional[str] = None


class PaymentScheduleRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invoice_id: UUID


class PaymentFilterParams(BaseModel):
    invoice_id: Optional[UUID] = None
    vendor_id: Optional[UUID] = None
    status: Optional[str] = None
    page: int = 1
    page_size: int = 20


class DisputeMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    dispute_id: UUID
    sender_id: UUID
    sender_name: Optional[str] = None
    message: str
    attachments: Optional[List[UUID]] = None
    created_at: datetime


class DisputeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    invoice_id: UUID
    vendor_id: UUID
    reason_code: str
    description: str
    status: str
    raised_by: UUID
    resolved_by: Optional[UUID] = None
    resolution_notes: Optional[str] = None
    resolution_action: Optional[str] = None
    credit_note_amount: Optional[Decimal] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    messages: List[DisputeMessageResponse] = Field(default_factory=list)


class DisputeCreateRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invoice_id: UUID
    reason_code: str = Field(..., min_length=2, max_length=30)
    description: str = Field(..., min_length=5)


class DisputeMessageCreateRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    message: str = Field(..., min_length=1)
    attachments: Optional[List[UUID]] = None


class DisputeResolveRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    resolution_notes: str = Field(..., min_length=3)
    resolution_action: str = Field(..., pattern="^(RESOLVED_ACCEPTED|RESOLVED_REJECTED|RESOLVED_CREDIT_NOTE)$")
    credit_note_amount: Optional[Decimal] = None


class ErpPaymentWebhookRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invoice_number: str
    utr_number: str
    amount: Decimal
    payment_date: date
    payment_method: Optional[str] = "NEFT"
    erp_reference: Optional[str] = None


class PaymentLiveExecuteRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    method: str = Field(default="RAZORPAY_PAYOUT", description="Payment rail: RAZORPAY_PAYOUT | BANK_NEFT | BANK_RTGS")
    bank_account_id: Optional[UUID] = None
    notes: Optional[str] = None

