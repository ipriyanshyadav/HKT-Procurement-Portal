from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.db.enums import UserStatusEnum
from app.db.session import get_db
from app.main import app
from app.modules.requisition.models import Requisition
from app.modules.requisition.schemas import BuyerSelectionItem
from app.modules.requisition.service import requisition_service
from app.modules.user.models import User
from app.modules.user.role_repository import role_repository


@pytest.fixture
def indentor_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "indentor@procurement.com"
    user.first_name = "Priya"
    user.last_name = "Mehta"
    user.full_name = "Priya Mehta"
    user.status = UserStatusEnum.ACTIVE
    user.is_supplier_user = False
    user.vendor_id = None
    return user


@pytest.fixture
def client(indentor_user):
    async def _fake_db():
        mock = AsyncMock()
        mock_res = MagicMock()
        mock_res.scalars.return_value.all.return_value = []
        mock_res.scalar.return_value = 0
        mock_res.scalar_one_or_none.return_value = None
        mock.execute = AsyncMock(return_value=mock_res)
        mock.commit = AsyncMock()
        mock.flush = AsyncMock()
        mock.add = MagicMock()
        yield mock

    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[get_current_user] = lambda: indentor_user

    with patch.object(role_repository, "user_has_permission", new_callable=AsyncMock, return_value=True):
        yield TestClient(app)

    app.dependency_overrides.clear()


def _build_test_indent_pr(org_id, user_id, pr_number="PR-IND-2026-000001"):
    now = datetime.now(timezone.utc)
    return Requisition(
        id=uuid4(),
        org_id=org_id,
        pr_number=pr_number,
        title="Lab Test Equipment Demand",
        source="INDENT_CART",
        status="SUBMITTED",
        procurement_type="OPEX",
        requestor_id=user_id,
        business_unit_id=uuid4(),
        cost_center_id=uuid4(),
        category_id=uuid4(),
        currency="INR",
        estimated_value=Decimal("95000.00"),
        budget_check_status="NOT_CHECKED",
        budget_reserved_amount=Decimal("0.00"),
        is_emergency=False,
        is_capex=False,
        erp_sync_status="PENDING",
        aging_alert_level=0,
        is_indent=True,
        indentor_id=user_id,
        assigned_buyer_id=uuid4(),
        indent_notes="Urgent procurement request",
        created_at=now,
        updated_at=now,
        lines=[],
    )


@pytest.mark.integration
class TestIndentorFlow:
    def test_list_available_buyers(self, client):
        """GET /api/v1/requisitions/indent/buyers returns available buyers."""
        buyer_id = uuid4()
        mock_buyers = [
            BuyerSelectionItem(
                id=buyer_id,
                name="Sarah Jenkins",
                email="buyer@procurement.com",
                department="IT Procurement",
                workload=2,
            )
        ]

        with patch.object(requisition_service, "get_available_buyers", new_callable=AsyncMock, return_value=mock_buyers):
            resp = client.get("/api/v1/requisitions/indent/buyers")
            assert resp.status_code == 200
            data = resp.json()["data"]
            assert len(data) == 1
            assert data[0]["name"] == "Sarah Jenkins"
            assert data[0]["email"] == "buyer@procurement.com"

    def test_transfer_indent_creates_submitted_pr(self, client, indentor_user):
        """POST /api/v1/requisitions/indent creates a new indent PR in SUBMITTED state."""
        created_pr = _build_test_indent_pr(indentor_user.org_id, indentor_user.id, "PR-IND-2026-000001")

        with patch.object(requisition_service, "create_indent", new_callable=AsyncMock, return_value=created_pr):
            payload = {
                "title": "Lab Test Equipment Demand",
                "procurement_type": "OPEX",
                "business_unit_id": str(uuid4()),
                "cost_center_id": str(uuid4()),
                "category_id": str(uuid4()),
                "indent_notes": "Urgent procurement request",
                "assigned_buyer_id": str(uuid4()),
                "lines": [
                    {
                        "line_number": 1,
                        "item_description": "Oscilloscope 100MHz",
                        "category_id": str(uuid4()),
                        "uom_id": str(uuid4()),
                        "quantity": 2,
                        "estimated_unit_price": 47500,
                    }
                ],
            }
            resp = client.post("/api/v1/requisitions/indent", json=payload)
            assert resp.status_code == 201
            res_data = resp.json()["data"]
            assert res_data["pr_number"] == "PR-IND-2026-000001"
            assert res_data["is_indent"] is True
            assert res_data["status"] == "SUBMITTED"

    def test_transfer_cart_as_indent(self, client, indentor_user):
        """POST /api/v1/requisitions/indent/from-cart transfers active cart to indent."""
        created_pr = _build_test_indent_pr(indentor_user.org_id, indentor_user.id, "PR-IND-2026-000002")

        with patch.object(requisition_service, "create_indent_from_cart", new_callable=AsyncMock, return_value=created_pr):
            payload = {
                "business_unit_id": str(uuid4()),
                "cost_center_id": str(uuid4()),
                "indent_notes": "From cart checkout",
            }
            resp = client.post("/api/v1/requisitions/indent/from-cart", json=payload)
            assert resp.status_code == 201
            res_data = resp.json()["data"]
            assert res_data["pr_number"] == "PR-IND-2026-000002"
            assert res_data["is_indent"] is True

    def test_get_indent_tracking(self, client, indentor_user):
        """GET /api/v1/requisitions/indent/tracking returns paginated tracking list."""
        pr = _build_test_indent_pr(indentor_user.org_id, indentor_user.id, "PR-IND-2026-000003")

        with patch.object(requisition_service, "get_indentor_tracking", new_callable=AsyncMock, return_value=([pr], 1)):
            resp = client.get("/api/v1/requisitions/indent/tracking")
            assert resp.status_code == 200
            data = resp.json()["data"]
            assert len(data) == 1
            assert data[0]["pr_number"] == "PR-IND-2026-000003"
            meta = resp.json()["meta"]
            assert meta["total_count"] == 1
