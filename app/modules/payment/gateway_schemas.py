"""Schemas for Online Payment Gateway integration (SPEC 27-J).

Module: payment
Layer: schema
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CreatePaymentOrderRequest(BaseModel):
    invoice_id: UUID
    amount: Decimal | None = Field(
        None,
        gt=0,
        description="Optional partial or custom amount; defaults to remaining invoice balance",
    )
    currency: str = Field("INR", max_length=3)
    gateway_provider: Literal["RAZORPAY", "STRIPE"] = "RAZORPAY"


class PaymentOrderResponse(BaseModel):
    order_id: str
    amount: Decimal
    currency: str
    gateway_provider: str
    key_id: str
    invoice_id: UUID
    vendor_name: str | None = None


class VerifyPaymentRequest(BaseModel):
    invoice_id: UUID
    gateway_order_id: str
    gateway_payment_id: str
    gateway_signature: str


class PaymentGatewayConfigUpdate(BaseModel):
    razorpay_key_id: str | None = None
    razorpay_secret: str | None = None
    stripe_pub_key: str | None = None
    stripe_secret: str | None = None
    default_provider: Literal["RAZORPAY", "STRIPE"] = "RAZORPAY"
    auto_pay_enabled: bool = False
    webhook_secret: str | None = None


class PaymentGatewayConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    razorpay_key_id_masked: str | None = None
    stripe_pub_key_masked: str | None = None
    default_provider: str
    auto_pay_enabled: bool
