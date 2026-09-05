from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.db.enums import PaymentStatusEnum, UserStatusEnum
from app.db.session import get_db
from app.main import app
from app.modules.payment.models import PaymentRecord, Dispute, DisputeMessage
from app.modules.payment.service import payment_service
from app.modules.user.models import User
from app.modules.user.role_repository import role_repository


@pytest.fixture
def mock_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "finance@example.com"
    user.first_name = "Finance"
    user.last_name = "User"
    user.full_name = "Finance User"
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
class TestPaymentRouter:
    def _make_payment(self, org_id):
        p = MagicMock(spec=PaymentRecord)
        p.id = uuid4()
        p.org_id = org_id
        p.invoice_id = uuid4()
        p.vendor_id = uuid4()
        p.payment_date = datetime.now(timezone.utc).date()
        p.payment_due_date = datetime.now(timezone.utc).date()
        p.amount = Decimal("5000.00")
        p.gross_amount = Decimal("5000.00")
        p.tds_amount = Decimal("500.00")
        p.net_amount = Decimal("4500.00")
        p.currency = "INR"
        p.utr_number = "UTR123456"
        p.payment_method = "NEFT"
        p.erp_payment_reference = "ERP-PAY-01"
        p.status = PaymentStatusEnum.SCHEDULED
        p.created_at = datetime.now(timezone.utc)
        p.updated_at = datetime.now(timezone.utc)
        return p


    def _make_dispute(self, org_id):
        d = MagicMock(spec=Dispute)
        d.id = uuid4()

        d.org_id = org_id
        d.invoice_id = uuid4()
        d.vendor_id = uuid4()
        d.reason_code = "PRICE_MISMATCH"
        d.description = "Invoice amount does not match PO"
        d.status = "OPEN"
        d.raised_by = uuid4()
        d.resolved_by = None
        d.resolution_notes = None
        d.resolution_action = None
        d.credit_note_amount = None
        d.resolved_at = None
        d.created_at = datetime.now(timezone.utc)
        d.updated_at = datetime.now(timezone.utc)
        d.messages = []
        return d

    def test_health(self, client):
        res = client.get("/api/v1/payments/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    def test_list_payments(self, client, mock_user):
        payment = self._make_payment(mock_user.org_id)
        with patch("app.modules.payment.router.payment_service.list_payments", new_callable=AsyncMock, return_value=([payment], 1)), \
             patch("app.modules.payment.router.invoice_repository.get_with_relations", new_callable=AsyncMock, return_value=None), \
             patch("app.modules.payment.router.vendor_repository.find_by_id", new_callable=AsyncMock, return_value=None):
            res = client.get("/api/v1/payments")
            assert res.status_code == 200
            assert len(res.json()["data"]) == 1

    def test_schedule_payment(self, client, mock_user):
        payment = self._make_payment(mock_user.org_id)
        with patch("app.modules.payment.router.payment_service.create_scheduled_payment", new_callable=AsyncMock, return_value=payment), \
             patch("app.modules.payment.router.invoice_repository.get_with_relations", new_callable=AsyncMock, return_value=None), \
             patch("app.modules.payment.router.vendor_repository.find_by_id", new_callable=AsyncMock, return_value=None):
            res = client.post(
                "/api/v1/payments/schedule",
                json={"invoice_id": str(payment.invoice_id)},
            )
            assert res.status_code == 201

    def test_get_payment(self, client, mock_user):
        payment = self._make_payment(mock_user.org_id)
        with patch("app.modules.payment.router.payment_service.get_payment", new_callable=AsyncMock, return_value=payment), \
             patch("app.modules.payment.router.invoice_repository.get_with_relations", new_callable=AsyncMock, return_value=None), \
             patch("app.modules.payment.router.vendor_repository.find_by_id", new_callable=AsyncMock, return_value=None):
            res = client.get(f"/api/v1/payments/{payment.id}")
            assert res.status_code == 200
            assert res.json()["data"]["id"] == str(payment.id)

    def test_download_remittance_pdf(self, client, mock_user):
        payment = self._make_payment(mock_user.org_id)
        with patch("app.modules.payment.router.payment_service.get_payment", new_callable=AsyncMock, return_value=payment), \
             patch("app.modules.payment.router.invoice_repository.get_with_relations", new_callable=AsyncMock, return_value=None), \
             patch("app.modules.payment.router.vendor_repository.find_by_id", new_callable=AsyncMock, return_value=None), \
             patch.object(payment_service, "generate_remittance_pdf", return_value=b"%PDF-1.4 remittance"):
            res = client.get(f"/api/v1/payments/{payment.id}/remittance-pdf")
            assert res.status_code == 200
            assert res.headers["content-type"] == "application/pdf"

    def test_process_payment(self, client, mock_user):
        payment = self._make_payment(mock_user.org_id)
        with patch("app.modules.payment.router.payment_service.process_payment", new_callable=AsyncMock, return_value=payment), \
             patch("app.modules.payment.router.invoice_repository.get_with_relations", new_callable=AsyncMock, return_value=None), \
             patch("app.modules.payment.router.vendor_repository.find_by_id", new_callable=AsyncMock, return_value=None):
            res = client.post(
                f"/api/v1/payments/{payment.id}/process",
                json={
                    "payment_date": datetime.now(timezone.utc).date().isoformat(),
                    "utr_number": "UTRNEW999",
                    "payment_method": "NEFT",
                },
            )
            assert res.status_code == 200

    def test_erp_webhook(self, client):
        with patch("app.modules.payment.router.payment_service.process_erp_webhook", new_callable=AsyncMock, return_value={"status": "SETTLED"}):
            res = client.post(
                "/api/v1/payments/webhook",
                json={
                    "invoice_number": "INV-2026-001",
                    "utr_number": "UTR888",
                    "amount": "5000.00",
                    "payment_date": datetime.now(timezone.utc).date().isoformat(),
                    "payment_method": "NEFT",
                },
            )
            assert res.status_code == 200
            assert res.json()["data"]["status"] == "SETTLED"

    def test_list_disputes(self, client, mock_user):
        dispute = self._make_dispute(mock_user.org_id)
        with patch("app.modules.payment.router.payment_service.list_disputes", new_callable=AsyncMock, return_value=[dispute]):
            res = client.get("/api/v1/payments/disputes/all")
            assert res.status_code == 200
            assert len(res.json()["data"]) == 1

    def test_create_dispute(self, client, mock_user):
        dispute = self._make_dispute(mock_user.org_id)
        with patch("app.modules.payment.router.payment_service.create_dispute", new_callable=AsyncMock, return_value=dispute):
            res = client.post(
                "/api/v1/payments/disputes",
                json={
                    "invoice_id": str(dispute.invoice_id),
                    "reason_code": "RATE_DIFFERENCE",
                    "description": "Tax was overcharged",
                },
            )
            assert res.status_code == 201

    def test_add_dispute_message(self, client, mock_user):
        msg = MagicMock(spec=DisputeMessage)
        msg.id = uuid4()

        msg.org_id = mock_user.org_id
        msg.dispute_id = uuid4()
        msg.sender_id = mock_user.id
        msg.message = "Clarification provided"
        msg.attachments = []
        msg.created_at = datetime.now(timezone.utc)

        with patch("app.modules.payment.router.payment_service.add_dispute_message", new_callable=AsyncMock, return_value=msg):
            res = client.post(
                f"/api/v1/payments/disputes/{msg.dispute_id}/messages",
                json={"message": "Clarification provided"},
            )
            assert res.status_code == 200

    def test_resolve_dispute(self, client, mock_user):
        dispute = self._make_dispute(mock_user.org_id)
        with patch("app.modules.payment.router.payment_service.resolve_dispute", new_callable=AsyncMock, return_value=dispute):
            res = client.post(
                f"/api/v1/payments/disputes/{dispute.id}/resolve",
                json={
                    "resolution_action": "RESOLVED_CREDIT_NOTE",
                    "resolution_notes": "Credit note issued for variance",
                    "credit_note_amount": "500.00",
                },
            )
            assert res.status_code == 200

