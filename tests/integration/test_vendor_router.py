from __future__ import annotations
from datetime import datetime, timezone, date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.db.enums import VendorStatusEnum, UserStatusEnum
from app.db.session import get_db
from app.main import app
from app.modules.user.models import User
from app.modules.user.role_repository import role_repository
from app.modules.vendor.models import Vendor, VendorBankAccount, VendorScorecard
from app.modules.vendor.schemas import DuplicateCheckResult, BulkVendorCategoryMappingResponse


@pytest.fixture
def mock_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "procurement@example.com"
    user.first_name = "Procurement"
    user.last_name = "Manager"
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
class TestVendorRouter:
    def _make_vendor(self, org_id):
        return Vendor(
            id=uuid4(),
            org_id=org_id,
            vendor_code="VEND-001",
            company_name="Acme Corp",
            legal_name="Acme Global Corp",
            registration_type="DOMESTIC",
            pan="ABCDE1234F",
            gstin="29ABCDE1234F1Z5",
            primary_email="contact@acme.example.com",
            country_code="IN",
            status=VendorStatusEnum.INVITED,
            onboarding_step=1,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )


    def test_invitation_token(self, client, mock_user):
        vendor = self._make_vendor(mock_user.org_id)
        with patch("app.modules.vendor.router.vendor_service.get_by_invitation_token", new_callable=AsyncMock, return_value=vendor):
            res = client.get("/api/v1/vendors/invitation/valid-token-123")
            assert res.status_code == 200
            assert res.json()["data"]["id"] == str(vendor.id)

    def test_register_vendor_with_token(self, client, mock_user):
        vendor = self._make_vendor(mock_user.org_id)
        with patch("app.modules.vendor.router.vendor_service.register_with_token", new_callable=AsyncMock, return_value=vendor):
            res = client.post(
                "/api/v1/vendors/register/valid-token-123",
                json={
                    "company_name": "Acme Updated",
                    "pan": "ABCDE1234F",
                    "gstin": "29ABCDE1234F1Z5",
                },
            )
            assert res.status_code == 200
            assert res.json()["data"]["id"] == str(vendor.id)

    def test_list_vendors(self, client, mock_user):
        vendor = self._make_vendor(mock_user.org_id)
        with patch("app.modules.vendor.router.vendor_service.repo.list_vendors", new_callable=AsyncMock, return_value=([vendor], 1)):
            res = client.get("/api/v1/vendors")
            assert res.status_code == 200
            assert len(res.json()["data"]) == 1

    def test_export_vendors(self, client, mock_user):
        vendor = self._make_vendor(mock_user.org_id)
        with patch("app.modules.vendor.router.vendor_service.repo.list_vendors", new_callable=AsyncMock, return_value=([vendor], 1)):
            res_csv = client.get("/api/v1/vendors/export/csv")
            assert res_csv.status_code == 200
            assert "text/csv" in res_csv.headers["content-type"]

            res_pdf = client.get("/api/v1/vendors/export/pdf")
            assert res_pdf.status_code == 200
            assert "application/pdf" in res_pdf.headers["content-type"]

    def test_check_duplicates(self, client):
        result = DuplicateCheckResult(
            has_hard_blocks=False,
            has_soft_warnings=False,
            has_fraud_flags=False,
        )
        with patch("app.modules.vendor.router.vendor_service.detect_duplicates", new_callable=AsyncMock, return_value=result):
            res = client.post(
                "/api/v1/vendors/check-duplicates",
                json={"pan": "ABCDE1234F"},
            )
            assert res.status_code == 200
            assert res.json()["data"]["has_hard_blocks"] is False

    def test_bulk_category_mapping(self, client):
        bulk_resp = BulkVendorCategoryMappingResponse(
            total_processed=1,
            updated_vendors=1,
            errors=[],
        )
        with patch("app.modules.vendor.router.vendor_service.bulk_map_categories", new_callable=AsyncMock, return_value=bulk_resp):
            res = client.post(
                "/api/v1/vendors/bulk-category-mapping",
                json={"mappings": [{"vendor_code": "V001", "category_ids": [str(uuid4())]}]},
            )
            assert res.status_code == 200
            assert res.json()["data"]["updated_vendors"] == 1

    def test_lifecycle_actions(self, client, mock_user):
        vendor = self._make_vendor(mock_user.org_id)
        with patch("app.modules.vendor.router.vendor_service.submit_registration", new_callable=AsyncMock, return_value=vendor):
            res = client.post(f"/api/v1/vendors/{vendor.id}/submit", json={})
            assert res.status_code == 200

        with patch("app.modules.vendor.router.vendor_service.qualify", new_callable=AsyncMock, return_value=vendor):
            res = client.post(f"/api/v1/vendors/{vendor.id}/qualify", json={})
            assert res.status_code == 200

        with patch("app.modules.vendor.router.vendor_service.reject", new_callable=AsyncMock, return_value=vendor):
            res = client.post(f"/api/v1/vendors/{vendor.id}/reject", json={"reason": "Incomplete documents"})
            assert res.status_code == 200

        with patch("app.modules.vendor.router.vendor_service.suspend", new_callable=AsyncMock, return_value=vendor):
            res = client.post(f"/api/v1/vendors/{vendor.id}/suspend", json={"reason": "Audit review"})
            assert res.status_code == 200

        with patch("app.modules.vendor.router.vendor_service.reinstate", new_callable=AsyncMock, return_value=vendor):
            res = client.post(f"/api/v1/vendors/{vendor.id}/reinstate", json={})
            assert res.status_code == 200

    def test_blacklist_actions(self, client, mock_user):
        vendor = self._make_vendor(mock_user.org_id)
        with patch("app.modules.vendor.router.vendor_service.initiate_blacklist", new_callable=AsyncMock, return_value=vendor):
            res = client.post(f"/api/v1/vendors/{vendor.id}/initiate-blacklist", json={"reason": "Fraud detected"})
            assert res.status_code == 200

        with patch("app.modules.vendor.router.vendor_service.confirm_blacklist", new_callable=AsyncMock, return_value=vendor):
            res = client.post(f"/api/v1/vendors/{vendor.id}/confirm-blacklist", json={"reason": "Confirmed fraud"})
            assert res.status_code == 200

    def test_bank_accounts_and_penny_test(self, client, mock_user):
        vendor = self._make_vendor(mock_user.org_id)
        bank = VendorBankAccount(
            id=uuid4(),
            org_id=vendor.org_id,
            vendor_id=vendor.id,
            bank_name="State Bank of India",
            account_number_encrypted="encrypted",
            ifsc_code="SBIN0001234",
            account_holder_name="Acme Corp",
            is_primary=True,
            penny_test_status="PASSED",
            penny_test_reference="REF-001",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        with patch("app.modules.vendor.router.vendor_service.add_bank_account", new_callable=AsyncMock, return_value=bank):
            res_add = client.post(
                f"/api/v1/vendors/{vendor.id}/bank-accounts",
                json={
                    "bank_name": "State Bank of India",
                    "account_number": "123456789012",
                    "ifsc_code": "SBIN0001234",
                    "account_holder_name": "Acme Corp",
                },
            )
            assert res_add.status_code == 201

        with patch("app.modules.vendor.router.vendor_service.confirm_penny_test", new_callable=AsyncMock, return_value=bank):
            res_confirm = client.post(
                f"/api/v1/vendors/{vendor.id}/bank-accounts/{bank.id}/confirm-penny-test",
                json={"amount_received": 1.05},
            )
            assert res_confirm.status_code == 200

    def test_scorecard(self, client, mock_user):
        vendor = self._make_vendor(mock_user.org_id)
        card = VendorScorecard(
            id=uuid4(),
            org_id=vendor.org_id,
            vendor_id=vendor.id,
            period_start=date(2026, 1, 1),
            period_end=date(2026, 3, 31),
            on_time_delivery_rate=Decimal("95.00"),
            quality_acceptance_rate=Decimal("98.00"),
            commercial_compliance_score=Decimal("90.00"),
            responsiveness_score=Decimal("85.00"),
            overall_score=Decimal("93.00"),
            calculated_at=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc),
        )

        with patch("app.modules.vendor.router.vendor_service.repo.get_latest_scorecard", new_callable=AsyncMock, return_value=card):
            res = client.get(f"/api/v1/vendors/{vendor.id}/scorecard")
            assert res.status_code == 200
            assert float(res.json()["data"]["overall_score"]) == 93.0

        with patch("app.modules.vendor.router.vendor_service.update_scorecard", new_callable=AsyncMock, return_value=card):
            res_post = client.post(
                f"/api/v1/vendors/{vendor.id}/scorecard",
                json={"on_time_delivery_rate": "96.00"},
            )
            assert res_post.status_code == 200


