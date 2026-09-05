from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.db.enums import PrSourceEnum, PrStatusEnum, ProcurementTypeEnum, UserStatusEnum
from app.db.session import get_db
from app.main import app
from app.modules.requisition.models import Requisition, RequisitionLine
from app.modules.requisition.service import requisition_service
from app.modules.user.models import User
from app.modules.user.role_repository import role_repository


@pytest.fixture
def mock_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "requester@example.com"
    user.first_name = "Jane"
    user.last_name = "Requester"
    user.full_name = "Jane Requester"
    user.status = UserStatusEnum.ACTIVE
    user.is_supplier_user = False
    user.vendor_id = None
    return user


@pytest.fixture
def client(mock_user):
    async def _fake_db():
        mock = AsyncMock()
        mock_res = MagicMock()
        mock_res.scalars.return_value.all.return_value = []
        mock.execute = AsyncMock(return_value=mock_res)
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
class TestRequisitionRouter:
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

    def test_create_requisition(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        with patch.object(requisition_service, "create", new_callable=AsyncMock, return_value=pr), \
             patch.object(requisition_service, "get_by_id", new_callable=AsyncMock, return_value=pr):
            payload = {
                "title": "Office Supplies",
                "business_unit_id": str(pr.business_unit_id),
                "cost_center_id": str(pr.cost_center_id),
                "category_id": str(pr.category_id),
                "currency": "INR",
                "procurement_type": "OPEX",
                "lines": [
                    {
                        "line_number": 1,
                        "item_description": "Printer Paper",
                        "category_id": str(pr.category_id),
                        "uom_id": str(pr.lines[0].uom_id),
                        "quantity": 10.0,
                        "estimated_unit_price": 100.0,
                    }
                ],
            }
            res = client.post("/api/v1/requisitions", json=payload)
            assert res.status_code == 201
            assert res.json()["data"]["id"] == str(pr.id)

    def test_bulk_create_requisitions(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        with patch.object(requisition_service, "create", new_callable=AsyncMock, return_value=pr):
            payload = {
                "items": [
                    {
                        "title": "Bulk PR 1",
                        "business_unit_id": str(pr.business_unit_id),
                        "cost_center_id": str(pr.cost_center_id),
                        "category_id": str(pr.category_id),
                        "currency": "INR",
                        "procurement_type": "OPEX",
                        "lines": [
                            {
                                "line_number": 1,
                                "item_description": "Item 1",
                                "category_id": str(pr.category_id),
                                "uom_id": str(pr.lines[0].uom_id),
                                "quantity": 5.0,
                                "estimated_unit_price": 50.0,
                            }
                        ],
                    }
                ]
            }
            res = client.post("/api/v1/requisitions/bulk", json=payload)
            assert res.status_code == 201
            assert len(res.json()["data"]) == 1

    def test_list_requisitions(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        with patch.object(requisition_service, "list_prs", new_callable=AsyncMock, return_value=([pr], 1)):
            res = client.get("/api/v1/requisitions?page=1&page_size=10")
            assert res.status_code == 200
            assert res.json()["meta"]["total_records"] == 1
            assert len(res.json()["data"]) == 1

    def test_export_csv(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        with patch.object(requisition_service, "list_prs", new_callable=AsyncMock, return_value=([pr], 1)):
            res = client.get("/api/v1/requisitions/export/csv")
            assert res.status_code == 200
            assert "text/csv" in res.headers.get("content-type", "")

    def test_export_pdf(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        with patch.object(requisition_service, "list_prs", new_callable=AsyncMock, return_value=([pr], 1)):
            res = client.get("/api/v1/requisitions/export/pdf")
            assert res.status_code == 200
            assert "application/pdf" in res.headers.get("content-type", "")

    def test_get_requisition(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        with patch.object(requisition_service, "get_by_id", new_callable=AsyncMock, return_value=pr):
            res = client.get(f"/api/v1/requisitions/{pr.id}")
            assert res.status_code == 200
            assert res.json()["data"]["pr_number"] == pr.pr_number

    def test_update_requisition(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        with patch.object(requisition_service, "update", new_callable=AsyncMock, return_value=pr):
            res = client.put(f"/api/v1/requisitions/{pr.id}", json={"title": "Updated PR Title"})
            assert res.status_code == 200
            assert res.json()["data"]["title"] == pr.title

    def test_submit_requisition(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        with patch.object(requisition_service, "submit", new_callable=AsyncMock, return_value=pr):
            res = client.post(f"/api/v1/requisitions/{pr.id}/submit")
            assert res.status_code == 200

    def test_withdraw_requisition(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        with patch.object(requisition_service, "withdraw", new_callable=AsyncMock, return_value=pr):
            res = client.post(f"/api/v1/requisitions/{pr.id}/withdraw")
            assert res.status_code == 200

    def test_amend_requisition(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        with patch.object(requisition_service, "amend", new_callable=AsyncMock, return_value=pr):
            res = client.post(f"/api/v1/requisitions/{pr.id}/amend", json={"title": "Amended Title"})
            assert res.status_code == 200

    def test_merge_requisitions(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        with patch.object(requisition_service, "merge_prs", new_callable=AsyncMock, return_value=pr):
            res = client.post(
                "/api/v1/requisitions/merge",
                json={"pr_ids": [str(uuid4()), str(uuid4())], "merged_title": "Merged PR"},
            )
            assert res.status_code == 200

    def test_split_requisition(self, client, mock_user):
        pr1 = self._make_pr(mock_user.org_id, mock_user.id)
        pr2 = self._make_pr(mock_user.org_id, mock_user.id)
        with patch.object(requisition_service, "split_pr", new_callable=AsyncMock, return_value=[pr1, pr2]):
            res = client.post(
                f"/api/v1/requisitions/{pr1.id}/split",
                json={
                    "splits": [
                        {"category_id": str(uuid4()), "line_numbers": [1]},
                        {"category_id": str(uuid4()), "line_numbers": [2]},
                    ]
                },
            )
            assert res.status_code == 200
            assert len(res.json()["data"]) == 2

    def test_convert_to_rfq(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        with patch.object(requisition_service, "convert_to_rfq", new_callable=AsyncMock, return_value=pr):
            res = client.post(f"/api/v1/requisitions/{pr.id}/convert-to-rfq")
            assert res.status_code == 200

    def test_convert_to_po(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        with patch.object(requisition_service, "convert_to_po", new_callable=AsyncMock, return_value=pr):
            res = client.post(f"/api/v1/requisitions/{pr.id}/convert-to-po")
            assert res.status_code == 200

    def test_approve_and_reject_requisition(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        with patch.object(requisition_service, "approve", new_callable=AsyncMock, return_value=pr):
            res = client.post(f"/api/v1/requisitions/{pr.id}/approve", json={"action": "APPROVE", "comment": "Looks good"})
            assert res.status_code == 200

        with patch.object(requisition_service, "reject", new_callable=AsyncMock, return_value=pr):
            res = client.post(f"/api/v1/requisitions/{pr.id}/reject", json={"action": "REJECT", "comment": "Budget exceeded"})
            assert res.status_code == 200

    def test_audit_trail(self, client, mock_user):
        pr = self._make_pr(mock_user.org_id, mock_user.id)
        with patch.object(requisition_service, "get_by_id", new_callable=AsyncMock, return_value=pr):
            res = client.get(f"/api/v1/requisitions/{pr.id}/audit-trail")
            assert res.status_code == 200
            assert "data" in res.json()
