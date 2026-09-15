import pytest
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.db.enums import InvoiceStatusEnum
from app.modules.invoice.models import Invoice
from app.modules.invoice.schemas import EarlyDiscountRequest
from app.modules.invoice.service import InvoiceService


@pytest.mark.asyncio
async def test_calculate_early_discount_options_eligible():
    service = InvoiceService()
    org_id = uuid4()
    inv_id = uuid4()
    today = date.today()
    due_date = today + timedelta(days=20)

    invoice = MagicMock(spec=Invoice)
    invoice.id = inv_id
    invoice.org_id = org_id
    invoice.invoice_number = "INV-2026-001"
    invoice.total_amount = Decimal("100000.00")
    invoice.tds_amount = Decimal("2000.00")
    invoice.currency = "INR"
    invoice.status = InvoiceStatusEnum.MATCHED
    invoice.due_date = due_date

    with patch.object(service, "get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = invoice
        db = AsyncMock()
        resp = await service.calculate_early_discount_options(db, inv_id, org_id, custom_apr=0.18)

        assert resp.eligible is True
        assert resp.invoice_number == "INV-2026-001"
        assert len(resp.options) > 0
        opt = resp.options[0]
        assert opt.annual_percentage_rate == 0.18
        assert opt.discount_amount > Decimal("0.0")
        assert opt.net_payout_amount < invoice.total_amount


@pytest.mark.asyncio
async def test_calculate_early_discount_options_ineligible_short_due():
    service = InvoiceService()
    org_id = uuid4()
    inv_id = uuid4()
    today = date.today()
    due_date = today + timedelta(days=1)  # less than minimum 3 days

    invoice = MagicMock(spec=Invoice)
    invoice.id = inv_id
    invoice.org_id = org_id
    invoice.invoice_number = "INV-2026-002"
    invoice.total_amount = Decimal("50000.00")
    invoice.tds_amount = Decimal("0.00")
    invoice.currency = "INR"
    invoice.status = InvoiceStatusEnum.MATCHED
    invoice.due_date = due_date

    with patch.object(service, "get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = invoice
        db = AsyncMock()
        resp = await service.calculate_early_discount_options(db, inv_id, org_id)

        assert resp.eligible is False
        assert "minimum required" in resp.blocking_reason


@pytest.mark.asyncio
async def test_request_and_accept_early_payment():
    service = InvoiceService()
    org_id = uuid4()
    actor_id = uuid4()
    vendor_id = uuid4()
    inv_id = uuid4()
    today = date.today()
    due_date = today + timedelta(days=20)
    payout_date = today + timedelta(days=5)

    invoice = MagicMock(spec=Invoice)
    invoice.id = inv_id
    invoice.org_id = org_id
    invoice.vendor_id = vendor_id
    invoice.invoice_number = "INV-2026-003"
    invoice.total_amount = Decimal("100000.00")
    invoice.tds_amount = Decimal("0.00")
    invoice.currency = "INR"
    invoice.status = InvoiceStatusEnum.MATCHED
    invoice.due_date = due_date
    invoice.early_discount_status = "NONE"

    db = AsyncMock()
    with patch.object(service, "get", new_callable=AsyncMock) as mock_get, \
         patch.object(service.audit, "log", new_callable=AsyncMock), \
         patch.object(service.publisher, "publish", new_callable=AsyncMock):

        mock_get.return_value = invoice

        # 1. Request
        req_payload = EarlyDiscountRequest(
            accelerated_payout_date=payout_date,
            annual_percentage_rate=0.18,
            discount_amount=Decimal("1500.00"),
            notes="Fast supplier liquidity",
        )
        req_resp = await service.request_early_payment(
            db, inv_id, req_payload, actor_id, org_id, vendor_id=vendor_id
        )
        assert req_resp.early_discount_status == "REQUESTED"
        assert req_resp.discount_amount == Decimal("1500.00")
        assert req_resp.net_payable_amount == Decimal("98500.00")

        # 2. Accept
        invoice.early_discount_status = "REQUESTED"
        invoice.early_discount_amount = Decimal("1500.00")
        invoice.early_discount_payout_date = payout_date

        accept_resp = await service.accept_early_payment(db, inv_id, actor_id, org_id)
        assert accept_resp.early_discount_status == "ACCEPTED"
        assert accept_resp.net_payable_amount == Decimal("98500.00")
