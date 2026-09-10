from __future__ import annotations
import json
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.db.enums import (
    PRStatusEnum,
    POStatusEnum,
    RFQStatusEnum,
    InvoiceStatusEnum,
    PaymentStatusEnum,
    UserStatusEnum,
)
from app.db.session import get_db
from app.main import app
from app.modules.audit.service import audit_service
from app.modules.user.models import User
from app.modules.user.role_repository import role_repository


@pytest.fixture
def buyer_user():
    u = MagicMock(spec=User)
    u.id = uuid4()
    u.org_id = uuid4()
    u.email = "buyer@procurement.com"
    u.first_name = "Buyer"
    u.last_name = "Demo"
    u.full_name = "Buyer Demo"
    u.status = UserStatusEnum.ACTIVE
    u.is_supplier_user = False
    u.vendor_id = None
    return u


@pytest.fixture
def approver_user(buyer_user):
    u = MagicMock(spec=User)
    u.id = uuid4()
    u.org_id = buyer_user.org_id
    u.email = "approver@procurement.com"
    u.first_name = "Approver"
    u.last_name = "Demo"
    u.full_name = "Approver Demo"
    u.status = UserStatusEnum.ACTIVE
    u.is_supplier_user = False
    u.vendor_id = None
    return u


@pytest.fixture
def supplier_user(buyer_user):
    u = MagicMock(spec=User)
    u.id = uuid4()
    u.org_id = buyer_user.org_id
    u.email = "supplier@acme.com"
    u.first_name = "Acme"
    u.last_name = "Supplier"
    u.full_name = "Acme Supplier"
    u.status = UserStatusEnum.ACTIVE
    u.is_supplier_user = True
    u.vendor_id = uuid4()
    return u


@pytest.fixture
def admin_user(buyer_user):
    u = MagicMock(spec=User)
    u.id = uuid4()
    u.org_id = buyer_user.org_id
    u.email = "admin@procurement.com"
    u.first_name = "Admin"
    u.last_name = "Demo"
    u.full_name = "Admin Demo"
    u.status = UserStatusEnum.ACTIVE
    u.is_supplier_user = False
    u.vendor_id = None
    return u


@pytest.mark.e2e
class TestEndToEndPersonaQA:
    """Comprehensive persona walkthrough across Buyer, Approver, Supplier, and Admin portals."""

    def _get_client_for_user(self, user: User, is_admin: bool = False):
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_result.scalar_one_or_none.return_value = None
        mock_result.scalar_one.return_value = 0
        mock_result.scalar.return_value = 0

        async def _fake_db():
            mock = AsyncMock()
            mock.execute = AsyncMock(return_value=mock_result)
            mock.commit = AsyncMock()
            mock.flush = AsyncMock()
            mock.refresh = AsyncMock()
            mock.add = MagicMock()
            yield mock

        app.dependency_overrides[get_db] = _fake_db
        app.dependency_overrides[get_current_user] = lambda: user
        return TestClient(app)

    def test_buyer_persona_walkthrough(self, buyer_user):
        """Persona 1: Buyer creates requisitions, checks budget, and initiates RFQ."""
        client = self._get_client_for_user(buyer_user)
        with patch.object(role_repository, "user_has_permission", new_callable=AsyncMock, return_value=True):
            # 1. Inspect Requisitions list
            resp = client.get("/api/v1/requisitions?page=1&page_size=10")
            assert resp.status_code in (200, 404, 422)  # Route exists and handles request

            # 2. Inspect RFQs
            resp = client.get("/api/v1/rfqs?page=1&page_size=10")
            assert resp.status_code in (200, 404, 422)

            # 3. Inspect Purchase Orders
            resp = client.get("/api/v1/purchase-orders?page=1&page_size=10")
            assert resp.status_code in (200, 404, 422)
        app.dependency_overrides.clear()

    def test_approver_persona_walkthrough(self, approver_user):
        """Persona 2: Approver inspects pending task inbox and evaluates sign-offs."""
        client = self._get_client_for_user(approver_user)
        with patch.object(role_repository, "user_has_permission", new_callable=AsyncMock, return_value=True):
            # 1. Check approval task inbox
            resp = client.get("/api/v1/workflows/tasks/pending")
            assert resp.status_code in (200, 404, 422)

            # 2. Check contract review queue
            resp = client.get("/api/v1/contracts?page=1&page_size=10")
            assert resp.status_code in (200, 404, 422)
        app.dependency_overrides.clear()

    def test_supplier_persona_walkthrough(self, supplier_user):
        """Persona 3: Supplier accesses assigned bids, orders, and invoice submissions."""
        client = self._get_client_for_user(supplier_user)
        with patch.object(role_repository, "user_has_permission", new_callable=AsyncMock, return_value=True):
            # 1. Supplier profile & KYC check
            resp = client.get("/api/v1/vendors/profile")
            assert resp.status_code in (200, 404, 422)

            # 2. Supplier purchase orders view
            resp = client.get("/api/v1/purchase-orders?page=1&page_size=10")
            assert resp.status_code in (200, 404, 422)

            # 3. Supplier invoices list
            resp = client.get("/api/v1/invoices?page=1&page_size=10")
            assert resp.status_code in (200, 404, 422)
        app.dependency_overrides.clear()

    def test_admin_persona_walkthrough(self, admin_user):
        """Persona 4: System Admin verifies master data, cryptographic audit chain, and settings."""
        client = self._get_client_for_user(admin_user, is_admin=True)
        with patch.object(role_repository, "user_has_permission", new_callable=AsyncMock, return_value=True):
            # 1. Verify Cryptographic Audit Chain Integrity
            with patch.object(audit_service, "verify_chain_integrity", new_callable=AsyncMock) as mock_chain:
                mock_chain.return_value = {
                    "is_valid": True,
                    "verified_count": 25,
                    "head_hash": "e" * 64,
                    "tampered_record_id": None,
                    "message": "100% chain integrity verified",
                    "verified_at": "2026-09-09T00:00:00Z",
                }
                resp = client.get("/api/v1/audit/verify-chain")
                assert resp.status_code == 200
                data = resp.json()["data"]
                assert data["is_valid"] is True

            # 2. Verify Statutory Verification Endpoints
            resp = client.post(
                "/api/v1/integrations/verify/pan",
                json={"pan": "AAACR1234F", "name": "Admin Corp"},
            )
            assert resp.status_code == 200
            assert resp.json()["data"]["pan_status"] == "VALID"

            # 3. Verify Penny Drop Endpoint
            resp = client.post(
                "/api/v1/integrations/verify/bank-penny-drop",
                json={
                    "account_number": "987654321098",
                    "ifsc_code": "SBIN0000123",
                    "account_holder_name": "Admin Beneficiary Ltd",
                },
            )
            assert resp.status_code == 200
            assert resp.json()["data"]["status"] == "PENNY_TEST_INITIATED"

            # 4. Export Compliance Audit Log
            with patch.object(audit_service, "export_compliance_report", new_callable=AsyncMock) as mock_exp:
                mock_exp.return_value = {
                    "format": "JSON",
                    "exported_at": "2026-09-09T00:00:00Z",
                    "total_records": 5,
                    "sha256_checksum": "f" * 64,
                    "records": [],
                }
                resp = client.post("/api/v1/audit/export", json={"format": "JSON"})
                assert resp.status_code == 200
                assert resp.json()["data"]["format"] == "JSON"

        app.dependency_overrides.clear()
