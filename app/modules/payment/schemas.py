from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PaymentRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    invoice_id: UUID
    invoice_number: str | None = None
    vendor_id: UUID
    vendor_name: str | None = None
    payment_date: date
    amount: Decimal
    gross_amount: Decimal | None = Decimal("0.0")
    tds_amount: Decimal | None = Decimal("0.0")
    net_amount: Decimal | None = Decimal("0.0")
    payment_due_date: date | None = None
    currency: str
    utr_number: str | None = None
    payment_method: str | None = None
    erp_payment_reference: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime


class PaymentProcessRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    utr_number: str = Field(..., min_length=3, max_length=50)
    payment_method: str = Field(default="NEFT", max_length=30)
    payment_date: date | None = None
    erp_payment_reference: str | None = None


class PaymentScheduleRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invoice_id: UUID


class PaymentFilterParams(BaseModel):
    invoice_id: UUID | None = None
    vendor_id: UUID | None = None
    status: str | None = None
    page: int = 1
    page_size: int = 20


class DisputeMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    dispute_id: UUID
    sender_id: UUID
    sender_name: str | None = None
    message: str
    attachments: list[UUID] | None = None
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
    resolved_by: UUID | None = None
    resolution_notes: str | None = None
    resolution_action: str | None = None
    credit_note_amount: Decimal | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    messages: list[DisputeMessageResponse] = Field(default_factory=list)


class DisputeCreateRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invoice_id: UUID
    reason_code: str = Field(..., min_length=2, max_length=30)
    description: str = Field(..., min_length=5)


class DisputeMessageCreateRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    message: str = Field(..., min_length=1)
    attachments: list[UUID] | None = None


class DisputeResolveRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    resolution_notes: str = Field(..., min_length=3)
    resolution_action: str = Field(..., pattern="^(RESOLVED_ACCEPTED|RESOLVED_REJECTED|RESOLVED_CREDIT_NOTE)$")
    credit_note_amount: Decimal | None = None


class ErpPaymentWebhookRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invoice_number: str
    utr_number: str
    amount: Decimal
    payment_date: date
    payment_method: str | None = "NEFT"
    erp_reference: str | None = None


class PaymentLiveExecuteRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    method: str = Field(default="RAZORPAY_PAYOUT", description="Payment rail: RAZORPAY_PAYOUT | BANK_NEFT | BANK_RTGS")
    bank_account_id: UUID | None = None
    notes: str | None = None

