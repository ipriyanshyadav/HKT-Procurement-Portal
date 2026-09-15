"""Unit tests for PaymentGatewayService (SPEC 27-J)."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from decimal import Decimal

from app.core.exceptions import NotFoundError
from app.db.enums import PaymentStatusEnum
from app.modules.payment.gateway_schemas import (
    CreatePaymentOrderRequest,
    PaymentGatewayConfigUpdate,
    VerifyPaymentRequest,
)
from app.modules.payment.gateway_service import PaymentGatewayService
from app.modules.payment.models import PaymentGatewayConfig, PaymentRecord


@pytest.mark.asyncio
async def test_get_or_create_config_creates_default():
    service = PaymentGatewayService()
    db = AsyncMock()
    org_id = uuid4()

    res = MagicMock()
    res.scalar_one_or_none.return_value = None
    db.execute.return_value = res

    cfg = await service.get_or_create_config(db, org_id)
    assert cfg.org_id == org_id
    assert cfg.default_provider == "RAZORPAY"
    assert db.add.called
    assert db.flush.called


@pytest.mark.asyncio
async def test_update_config():
    service = PaymentGatewayService()
    db = AsyncMock()
    org_id = uuid4()

    existing_cfg = PaymentGatewayConfig(
        id=uuid4(),
        org_id=org_id,
        default_provider="RAZORPAY",
        auto_pay_enabled=False,
    )

    with patch.object(service, "get_or_create_config", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = existing_cfg
        update_data = PaymentGatewayConfigUpdate(
            razorpay_key_id="rzp_live_12345678",
            razorpay_secret="sec_87654321",
            default_provider="RAZORPAY",
            auto_pay_enabled=True,
        )
        updated = await service.update_config(db, org_id, update_data)

        assert updated.razorpay_key_id == "rzp_live_12345678"
        assert updated.auto_pay_enabled is True
        assert db.flush.called


@pytest.mark.asyncio
@patch("app.modules.payment.gateway_service.audit_service.log", new_callable=AsyncMock)
async def test_create_payment_order(mock_audit):
    service = PaymentGatewayService()
    db = AsyncMock()
    org_id = uuid4()
    actor_id = uuid4()
    invoice_id = uuid4()

    inv = MagicMock()
    inv.id = invoice_id
    inv.org_id = org_id
    inv.vendor_id = uuid4()
    inv.total_amount = Decimal("25000.00")

    inv_res = MagicMock()
    inv_res.scalar_one_or_none.return_value = inv

    v_res = MagicMock()
    v_res.scalar_one_or_none.return_value = None

    cfg = MagicMock()
    cfg.default_provider = "RAZORPAY"
    cfg.razorpay_key_id = "rzp_test_mock_key_id"
    cfg_res = MagicMock()
    cfg_res.scalar_one_or_none.return_value = cfg

    db.execute.side_effect = [inv_res, v_res, cfg_res]

    req = CreatePaymentOrderRequest(
        invoice_id=invoice_id,
        amount=Decimal("25000.00"),
        currency="INR",
        gateway_provider="RAZORPAY",
    )

    order = await service.create_payment_order(db, org_id, actor_id, req)
    assert "order_raz_" in order.order_id
    assert order.amount == Decimal("25000.00")
    assert order.currency == "INR"
    assert db.add.called
    assert db.flush.called


@pytest.mark.asyncio
@patch("app.modules.payment.gateway_service.audit_service.log", new_callable=AsyncMock)
async def test_verify_payment_success(mock_audit):
    service = PaymentGatewayService()
    db = AsyncMock()
    org_id = uuid4()
    actor_id = uuid4()
    invoice_id = uuid4()

    payment = MagicMock(spec=PaymentRecord)
    payment.id = uuid4()
    payment.invoice_id = invoice_id
    payment.status = PaymentStatusEnum.PENDING

    p_res = MagicMock()
    p_res.scalar_one_or_none.return_value = payment

    cfg = MagicMock()
    cfg.razorpay_secret = "mock_rzp_secret"
    cfg_res = MagicMock()
    cfg_res.scalar_one_or_none.return_value = cfg

    inv = MagicMock()
    inv.id = invoice_id
    inv_res = MagicMock()
    inv_res.scalar_one_or_none.return_value = inv

    db.execute.side_effect = [p_res, cfg_res, inv_res]

    req = VerifyPaymentRequest(
        invoice_id=invoice_id,
        gateway_order_id="order_raz_123456",
        gateway_payment_id="pay_987654",
        gateway_signature="mock_sig_signature_xyz",
    )

    verified = await service.verify_payment(db, org_id, actor_id, req)
    assert verified.gateway_payment_id == "pay_987654"
    assert verified.status == PaymentStatusEnum.COMPLETED
    assert inv.status == "PAID"
    assert db.flush.called
