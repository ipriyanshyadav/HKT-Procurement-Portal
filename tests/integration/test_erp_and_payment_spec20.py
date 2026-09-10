from __future__ import annotations
from datetime import datetime, timezone
import hmac
import hashlib
import json
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.config import settings
from app.db.enums import PaymentStatusEnum, UserStatusEnum
from app.db.session import get_db
from app.main import app
from app.modules.integration.adapters.erp_base import ERPAdapterFactory
from app.modules.integration.adapters.erp_tally import TallyXMLAdapter
from app.modules.integration.adapters.erp_sap import SAPAdapter
from app.modules.integration.adapters.bank import BankVerificationAdapter
from app.modules.integration.adapters.pan import PANAdapter
from app.modules.payment.razorpay_adapter import RazorpayPaymentAdapter
from app.modules.payment.models import PaymentRecord
from app.modules.payment.service import payment_service
from app.modules.user.models import User
from app.modules.user.role_repository import role_repository


@pytest.fixture
def mock_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "finance_admin@example.com"
    user.first_name = "Finance"
    user.last_name = "Admin"
    user.full_name = "Finance Admin"
    user.status = UserStatusEnum.ACTIVE
    user.is_supplier_user = False
    user.vendor_id = None
    return user


@pytest.fixture
def client(mock_user):
    async def _fake_db():
        mock = AsyncMock()
        mock.execute = AsyncMock()
        mock.commit = AsyncMock()
        mock.flush = AsyncMock()
        mock.refresh = AsyncMock()
        mock.add = MagicMock()
        yield mock

    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[get_current_user] = lambda: mock_user

    with patch.object(role_repository, "user_has_permission", new_callable=AsyncMock, return_value=True):
        yield TestClient(app)

    app.dependency_overrides.clear()


@pytest.mark.integration
class TestTallyXMLAdapter:
    """SPEC_20: Tally ERP XML Envelope Integration Tests."""

    def test_factory_resolves_tally(self):
        adapter = ERPAdapterFactory.get_adapter("TALLY", {"base_url": "http://localhost:9000"})
        assert isinstance(adapter, TallyXMLAdapter)

    def test_build_envelope(self):
        adapter = TallyXMLAdapter()
        env = adapter._build_envelope("Import Data", "        <LEDGER NAME=\"Test\">Acme</LEDGER>")
        assert "<ENVELOPE>" in env
        assert "<HEADER>" in env
        assert "<TALLYREQUEST>Import Data</TALLYREQUEST>" in env
        assert "<LEDGER NAME=\"Test\">Acme</LEDGER>" in env

    @pytest.mark.asyncio
    async def test_tally_sync_operations(self):
        adapter = TallyXMLAdapter()
        v_id = uuid4()
        org_id = uuid4()

        # Sync Vendor
        vendor_res = await adapter.sync_vendor(v_id, org_id)
        assert vendor_res["status"] == "SYNCHRONIZED"
        assert vendor_res["provider"] == "TALLY"
        assert "Sundry Creditors" in vendor_res["xml_envelope"]
        assert f"SUPPLIER-{str(v_id)[:8].upper()}" in vendor_res["xml_envelope"]

        # Create PO
        po_id = uuid4()
        po_res = await adapter.create_po(po_id, org_id)
        assert po_res["status"] == "POSTED"
        assert po_res["provider"] == "TALLY"
        assert "Purchase Order" in po_res["xml_envelope"]

        # Sync Invoice
        inv_id = uuid4()
        inv_res = await adapter.sync_invoice(inv_id, org_id)
        assert inv_res["status"] == "SYNCHRONIZED"
        assert "Purchase" in inv_res["xml_envelope"]

        # Confirm Payment
        pay_id = uuid4()
        pay_res = await adapter.confirm_payment(pay_id, org_id)
        assert pay_res["status"] == "SETTLED"
        assert "Payment" in pay_res["xml_envelope"]

        # Material Master
        mat_res = await adapter.get_material_master("STEEL-001", org_id)
        assert mat_res["status"] == "SUCCESS"
        assert mat_res["stock_item_name"] == "ITEM-STEEL-001"

    @pytest.mark.asyncio
    async def test_tally_ping(self):
        adapter = TallyXMLAdapter()
        is_alive = await adapter.health_check()
        assert is_alive is True


@pytest.mark.integration
class TestSAPBAPISimulation:
    """SPEC_20: SAP RFC / BAPI NetWeaver Simulation Tests."""

    @pytest.mark.asyncio
    async def test_sap_execute_bapi(self):
        adapter = SAPAdapter()
        res = await adapter.execute_bapi(
            function_module="BAPI_PO_CREATE1",
            import_params={"POHEADER": {"DOC_TYPE": "NB", "VENDOR": "VEND001"}},
        )
        assert res["status"] == "SUCCESS"
        assert res["RETURN"]["TYPE"] == "S"
        assert "RFC BAPI_PO_CREATE1 executed successfully" in res["RETURN"]["MESSAGE"]

    @pytest.mark.asyncio
    async def test_sap_bapi_po_create1(self):
        adapter = SAPAdapter()
        po_id = uuid4()
        res = await adapter.bapi_po_create1(
            po_id=po_id,
            po_header={"DOC_TYPE": "NB", "PURCH_ORG": "1000"},
            po_items=[{"ITEM_NO": "10", "MATERIAL": "MAT01", "QUANTITY": 100}],
        )
        assert res["status"] == "SUCCESS"
        assert res["po_id"] == str(po_id)
        assert res["purchase_order"].startswith("SAP-")

    @pytest.mark.asyncio
    async def test_sap_bapi_incominginvoice_create(self):
        adapter = SAPAdapter()
        inv_id = uuid4()
        res = await adapter.bapi_incominginvoice_create(
            invoice_id=inv_id,
            invoice_header={"INVOICE_DOC_TYPE": "RE", "GROSS_AMNT": 5000},
            invoice_items=[{"ITEM_NO": "1", "ITEM_AMNT": 5000}],
        )
        assert res["status"] == "SUCCESS"
        assert res["invoicedocnumber"].startswith("SAP-FI-")

    @pytest.mark.asyncio
    async def test_sap_sync_po(self):
        adapter = SAPAdapter()
        po_id = uuid4()
        org_id = uuid4()
        res = await adapter.create_po(po_id, org_id)
        assert res["status"] == "POSTED"
        assert res["provider"] == "SAP"
        assert res["message_type"] == "ORDERS05"


@pytest.mark.integration
class TestStatutoryAndBankingAdapters:
    """SPEC_20 & SPEC_15: PAN, GSTIN, and Bank Penny Drop Validation."""

    def test_pan_format_and_entity_type(self):
        assert PANAdapter.validate_format("AAACR1234F") is True
        assert PANAdapter.validate_format("ABCDE1234F") is True
        assert PANAdapter.validate_format("INVALID") is False
        assert PANAdapter.validate_format("12345ABCDE") is False

    @pytest.mark.asyncio
    async def test_pan_adapter_verify(self):
        adapter = PANAdapter()
        res = await adapter.validate("AAACR1234F", name="Reliance Industries")
        assert res["pan"] == "AAACR1234F"
        assert res["is_valid"] is True
        assert res["pan_status"] == "VALID"
        assert res["entity_type"] == "COMPANY"

    def test_bank_ifsc_and_account_validation(self):
        assert BankVerificationAdapter.validate_ifsc("HDFC0001234") is True
        assert BankVerificationAdapter.validate_ifsc("SBIN0000123") is True
        assert BankVerificationAdapter.validate_ifsc("INVALID") is False
        assert BankVerificationAdapter.validate_ifsc("HDFC0123") is False

        assert BankVerificationAdapter.validate_account_number("123456789012") is True
        assert BankVerificationAdapter.validate_account_number("12345") is False
        assert BankVerificationAdapter.validate_account_number("ABC12345678") is False

    @pytest.mark.asyncio
    async def test_bank_penny_drop_verification(self):
        adapter = BankVerificationAdapter()
        res = await adapter.initiate_penny_test(
            vendor_id=uuid4(),
            account_number="123456789012",
            ifsc_code="HDFC0001234",
            account_holder_name="Infosys Technologies Ltd",
        )
        assert res["status"] == "PENNY_TEST_INITIATED"
        assert res["reference"].startswith("PENNY-")
        assert res["amount"] == 1.00

        verify_res = await adapter.verify_penny_test(res["reference"], 1.00)
        assert verify_res["status"] == "VALIDATED"
        assert verify_res["is_valid"] is True


@pytest.mark.integration
class TestRazorpayAndLivePayments:
    """SPEC_15 & SPEC_20: Razorpay Payouts, HMAC Webhook & Payment Execution."""

    def test_razorpay_webhook_signature_verification(self):
        adapter = RazorpayPaymentAdapter()
        secret = "test_webhook_secret_key"
        payload = b'{"event":"payout.processed","payload":{"payout":{"entity":{"id":"pout_123"}}}}'

        # Valid signature
        valid_sig = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        assert adapter.verify_webhook_signature(payload, valid_sig, secret=secret) is True

        # Invalid signature
        assert adapter.verify_webhook_signature(payload, "invalid_signature_hex", secret=secret) is False

    @pytest.mark.asyncio
    async def test_razorpay_create_payout(self):
        adapter = RazorpayPaymentAdapter()
        res = await adapter.create_payout(
            account_number="123456789012",
            ifsc_code="HDFC0001234",
            beneficiary_name="Acme Corp",
            amount=Decimal("25000.00"),
            currency="INR",
            mode="NEFT",
            purpose="vendor_payment",
            reference_id="PAY-REF-101",
        )
        assert res["status"] == "PROCESSING"
        assert res["mode"] == "NEFT"
        assert res["amount"] == 25000.0
        assert res["reference_id"] == "PAY-REF-101"


@pytest.mark.integration
class TestIntegrationAndPaymentRouters:
    """End-to-End API Router Verification for Integrations & Payment Gateways."""

    def test_verify_gstin_endpoint(self, client):
        resp = client.post(
            "/api/v1/integrations/verify/gstin",
            json={"gstin": "27AAPFU0939F1ZV"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["gstin"] == "27AAPFU0939F1ZV"
        assert data["is_valid"] is True

    def test_verify_pan_endpoint(self, client):
        resp = client.post(
            "/api/v1/integrations/verify/pan",
            json={"pan": "AAACR1234F", "name": "Acme Corp"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["pan"] == "AAACR1234F"
        assert data["pan_status"] == "VALID"
        assert data["is_valid"] is True

    def test_verify_bank_penny_drop_endpoint(self, client):
        resp = client.post(
            "/api/v1/integrations/verify/bank-penny-drop",
            json={
                "account_number": "123456789012",
                "ifsc_code": "HDFC0001234",
                "account_holder_name": "Tata Motors Limited",
            },
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "PENNY_TEST_INITIATED"
        assert data["amount"] == 1.0

    def test_inbound_erp_sync_endpoint(self, client):
        resp = client.post(
            "/api/v1/integrations/erp/sync/inbound",
            json={
                "provider": "TALLY",
                "entity_type": "PURCHASE_ORDER",
                "data": {"po_number": "PO-501", "status": "APPROVED", "amount": 75000},
            },
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "ACCEPTED"
        assert data["provider"] == "TALLY"
        assert data["entity_type"] == "PURCHASE_ORDER"

    def test_execute_live_payment_endpoint(self, client):
        payment_id = uuid4()
        with patch.object(payment_service, "execute_live_payment", new_callable=AsyncMock) as mock_exec, \
             patch("app.modules.payment.router.invoice_repository.get_with_relations", new_callable=AsyncMock) as mock_inv, \
             patch("app.modules.payment.router.vendor_repository.find_by_id", new_callable=AsyncMock) as mock_vend:
            mock_inv.return_value = None
            mock_vend.return_value = None

            now = datetime.now(timezone.utc)
            mock_payment = MagicMock(spec=PaymentRecord)
            mock_payment.id = payment_id
            mock_payment.org_id = uuid4()
            mock_payment.invoice_id = uuid4()
            mock_payment.vendor_id = uuid4()
            mock_payment.payment_date = now.date()
            mock_payment.amount = Decimal("15000.00")
            mock_payment.gross_amount = Decimal("15000.00")
            mock_payment.tds_amount = Decimal("0.00")
            mock_payment.net_amount = Decimal("15000.00")
            mock_payment.payment_due_date = now.date()
            mock_payment.currency = "INR"
            mock_payment.utr_number = "CMS99887766"
            mock_payment.payment_method = "RAZORPAY_PAYOUT"
            mock_payment.erp_payment_reference = "ERP-PAY-999"
            mock_payment.status = PaymentStatusEnum.PROCESSING
            mock_payment.created_at = now
            mock_payment.updated_at = now
            mock_payment.initiated_at = now
            mock_payment.completed_at = None
            mock_payment.failure_reason = None
            mock_exec.return_value = mock_payment

            resp = client.post(
                f"/api/v1/payments/{payment_id}/execute-live",
                json={
                    "method": "RAZORPAY_PAYOUT",
                    "notes": "Live vendor payout",
                },
            )
            assert resp.status_code == 200
            data = resp.json()["data"]
            assert data["id"] == str(payment_id)
            assert data["status"] == PaymentStatusEnum.PROCESSING.value

    def test_razorpay_webhook_endpoint(self, client):
        secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "mock_razorpay_webhook_secret")
        webhook_payload = {
            "event": "payout.processed",
            "payload": {
                "payout": {
                    "entity": {
                        "id": "pout_live_999",
                        "status": "processed",
                        "utr": "CMS998877665",
                        "amount": 1500000,
                        "currency": "INR",
                        "reference_id": "PAY-REF-999",
                    }
                }
            },
        }
        body_bytes = json.dumps(webhook_payload).encode("utf-8")
        signature = hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

        with patch.object(payment_service, "process_razorpay_webhook", new_callable=AsyncMock) as mock_webhook:
            mock_webhook.return_value = {
                "processed": True,
                "event": "payout.processed",
                "payment_id": "PAY-REF-999",
                "status": "COMPLETED",
            }
            resp = client.post(
                "/api/v1/payments/webhooks/razorpay",
                content=body_bytes,
                headers={"Content-Type": "application/json", "x-razorpay-signature": signature},
            )
            assert resp.status_code == 200
            data = resp.json()["data"]
            assert data["processed"] is True
            assert data["event"] == "payout.processed"
