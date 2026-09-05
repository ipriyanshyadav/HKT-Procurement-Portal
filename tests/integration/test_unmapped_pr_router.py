from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.db.enums import PrSourceEnum, PrStatusEnum, ProcurementTypeEnum, UnmappedPrStatusEnum, UserStatusEnum
from app.db.session import get_db
from app.main import app
from app.modules.requisition.models import Requisition, RequisitionLine, UnmappedPrException
from app.modules.unmapped_pr.schemas import (
    UnmappedPRDashboardResponse,
    UnmappedPRSuggestionResponse,
    MappingSuggestionItem,
)
from app.modules.unmapped_pr.service import unmapped_pr_service
from app.modules.user.models import User
from app.modules.user.role_repository import role_repository


@pytest.fixture
def mock_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "buyer@example.com"
    user.first_name = "Buyer"
    user.last_name = "User"
    user.full_name = "Buyer User"
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
class TestUnmappedPRRouter:
    def _make_pr(self, org_id, user_id):
        pr_id = uuid4()
        now = datetime.now(timezone.utc)
        line = RequisitionLine(
            id=uuid4(),
            org_id=org_id,
            requisition_id=pr_id,
            line_number=1,
            item_description="Test Item Description",
            category_id=uuid4(),
            uom_id=uuid4(),
            quantity=Decimal("10.0"),
            estimated_unit_price=Decimal("100.0"),
            created_at=now,
            updated_at=now,
        )
        pr = Requisition(
            id=pr_id,
            org_id=org_id,
            pr_number=f"PR-{uuid4().hex[:6].upper()}",
            title="Procurement Requisition",
            source=PrSourceEnum.MANUAL,
            status=PrStatusEnum.DRAFT,
            procurement_type=ProcurementTypeEnum.OPEX,
            requestor_id=user_id,
            business_unit_id=uuid4(),
            cost_center_id=uuid4(),
            category_id=uuid4(),
            currency="INR",
            estimated_value=Decimal("1000.00"),
            budget_check_status="SUFFICIENT",
            budget_reserved_amount=Decimal("1000.00"),
            is_emergency=False,
            is_capex=False,
            erp_sync_status="NOT_SYNCED",
            aging_alert_level=0,
            created_at=now,
            updated_at=now,
        )
        pr.lines = [line]
        return pr

    def _make_exception(self, org_id):
        now = datetime.now(timezone.utc)
        exc = UnmappedPrException(
            id=uuid4(),
            org_id=org_id,
            requisition_id=uuid4(),
            failed_fields={"category": "Unknown category"},
            status=UnmappedPrStatusEnum.PENDING,
            sla_breach_level=0,
            reprocessing_attempts=0,
            created_at=now,
            updated_at=now,
        )
        exc.requisition = None
        return exc

    def test_list_unmapped_prs(self, client, mock_user):
        exc = self._make_exception(mock_user.org_id)
        with patch.object(unmapped_pr_service.repo, "list", new_callable=AsyncMock, return_value=([exc], 1)):
            res = client.get("/api/v1/unmapped-prs?page=1&page_size=10")
            assert res.status_code == 200
            assert res.json()["meta"]["total_records"] == 1
            assert len(res.json()["data"]) == 1

    def test_get_unmapped_pr_dashboard(self, client, mock_user):
        dashboard_data = {
            "total_pending": 5,
            "tier_1_count": 2,
            "tier_2_count": 1,
            "tier_3_count": 1,
            "tier_4_count": 1,
            "total_blocked_value": Decimal("50000.00"),
        }
        with patch.object(unmapped_pr_service.repo, "get_dashboard_data", new_callable=AsyncMock, return_value=dashboard_data):
            res = client.get("/api/v1/unmapped-prs/dashboard")
            assert res.status_code == 200
            assert res.json()["data"]["total_pending"] == 5

    def test_map_unmapped_pr(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        exc_id = uuid4()
        with patch.object(unmapped_pr_service, "map_pr", new_callable=AsyncMock, return_value=pr):
            payload = {
                "mappings": [
                    {
                        "field": "category_id",
                        "value": str(uuid4()),
                        "label": "Hardware",
                    }
                ],
                "notes": "Resolved mapping",
            }
            res = client.post(f"/api/v1/unmapped-prs/{exc_id}/map", json=payload)
            assert res.status_code == 200
            assert res.json()["data"]["id"] == str(pr.id)

    def test_get_mapping_suggestions(self, client, mock_user):
        exc_id = uuid4()
        suggestion_data = {
            "exception_id": exc_id,
            "suggested_category_id": uuid4(),
            "confidence": 0.95,
            "auto_apply": True,
            "based_on_records": 10,
            "suggestions": [
                {
                    "target_id": uuid4(),
                    "label": "Laptops",
                    "confidence": 0.95,
                    "method": "EXACT_MATCH",
                }
            ],
            "reason": "Matched historical data",
        }
        with patch.object(unmapped_pr_service, "suggest_mapping", new_callable=AsyncMock, return_value=suggestion_data):
            res = client.get(f"/api/v1/unmapped-prs/{exc_id}/suggest")
            assert res.status_code == 200
            assert res.json()["data"]["confidence"] == 0.95

    def test_auto_map_pr(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        exc_id = uuid4()
        with patch.object(unmapped_pr_service, "auto_map", new_callable=AsyncMock, return_value=pr):
            res = client.post(f"/api/v1/unmapped-prs/{exc_id}/auto-map")
            assert res.status_code == 200
            assert res.json()["data"]["id"] == str(pr.id)
