"""Router for Online Payment Gateway (SPEC 27-J).

Module: payment
Layer: router
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import APIResponse, created_response, success_response
from app.db.session import get_db
from app.modules.payment.gateway_schemas import (
    CreatePaymentOrderRequest,
    PaymentGatewayConfigResponse,
    PaymentGatewayConfigUpdate,
    PaymentOrderResponse,
    VerifyPaymentRequest,
)
from app.modules.payment.gateway_service import payment_gateway_service
from app.modules.user.models import User

router = APIRouter(prefix="/payments/gateway", tags=["Payment Gateway"])


@router.get("/config", response_model=APIResponse[PaymentGatewayConfigResponse])
async def get_gateway_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Get payment gateway configuration with masked credentials."""
    cfg = await payment_gateway_service.get_or_create_config(db, current_user.org_id)
    masked_rzp = (
        f"{cfg.razorpay_key_id[:6]}...{cfg.razorpay_key_id[-4:]}"
        if cfg.razorpay_key_id and len(cfg.razorpay_key_id) > 10
        else None
    )
    masked_stripe = (
        f"{cfg.stripe_pub_key[:6]}...{cfg.stripe_pub_key[-4:]}"
        if cfg.stripe_pub_key and len(cfg.stripe_pub_key) > 10
        else None
    )
    return success_response(
        PaymentGatewayConfigResponse(
            id=cfg.id,
            org_id=cfg.org_id,
            razorpay_key_id_masked=masked_rzp,
            stripe_pub_key_masked=masked_stripe,
            default_provider=cfg.default_provider,
            auto_pay_enabled=cfg.auto_pay_enabled,
        )
    )


@router.put("/config", response_model=APIResponse[PaymentGatewayConfigResponse])
async def update_gateway_config(
    data: PaymentGatewayConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Update payment gateway provider credentials and options."""
    cfg = await payment_gateway_service.update_config(db, current_user.org_id, data)
    masked_rzp = (
        f"{cfg.razorpay_key_id[:6]}...{cfg.razorpay_key_id[-4:]}"
        if cfg.razorpay_key_id and len(cfg.razorpay_key_id) > 10
        else None
    )
    masked_stripe = (
        f"{cfg.stripe_pub_key[:6]}...{cfg.stripe_pub_key[-4:]}"
        if cfg.stripe_pub_key and len(cfg.stripe_pub_key) > 10
        else None
    )
    return success_response(
        PaymentGatewayConfigResponse(
            id=cfg.id,
            org_id=cfg.org_id,
            razorpay_key_id_masked=masked_rzp,
            stripe_pub_key_masked=masked_stripe,
            default_provider=cfg.default_provider,
            auto_pay_enabled=cfg.auto_pay_enabled,
        )
    )


@router.post("/create-order", response_model=APIResponse[PaymentOrderResponse], status_code=201)
async def create_payment_order(
    data: CreatePaymentOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Initiate an online payment order against an approved invoice."""
    order = await payment_gateway_service.create_payment_order(
        db, current_user.org_id, current_user.id, data
    )
    return created_response(order)


@router.post("/verify", response_model=APIResponse[dict])
async def verify_payment(
    data: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Verify payment signature from checkout and mark invoice paid."""
    payment = await payment_gateway_service.verify_payment(
        db, current_user.org_id, current_user.id, data
    )
    return success_response({
        "payment_id": str(payment.id),
        "status": payment.status,
        "amount": str(payment.amount),
        "currency": payment.currency,
        "utr_number": payment.utr_number,
    })
