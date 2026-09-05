from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.db.enums import POStatusEnum, UserStatusEnum
from app.db.session import get_db
from app.main import app
from app.modules.purchase_order.models import PurchaseOrder
from app.modules.purchase_order.service import purchase_order_service
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
class TestPurchaseOrderRouter:
    def _make_po(self, org_id, user_id):
        po = MagicMock(spec=PurchaseOrder)
        po.id = uuid4()
        po.org_id = org_id
        po.po_number = "PO-2026-0001"
        po.title = "Office Supplies PO"
        po.vendor_id = uuid4()
        po.vendor_name = "Acme Supplies"
        po.rfq_id = None
        po.arn_id = None
        po.contract_id = None
        po.status = POStatusEnum.DRAFT
        po.business_unit_id = uuid4()
        po.plant_id = None
        po.category_id = uuid4()
        po.currency = "USD"
        po.total_value = Decimal("2500.00")
        po.payment_term_id = None
        po.incoterm_id = None
        po.delivery_location_id = None
        po.expected_delivery_date = None
        po.buyer_id = user_id
        po.erp_po_number = None
        po.erp_sync_status = "PENDING"
        po.po_document_path = None
        po.sent_at = None
        po.acknowledged_at = None
        po.vendor_acknowledged_at = None
        po.rejected_reason = None
        po.vendor_rejection_reason = None
        po.deviation_justification = None
        po.cancellation_reason = None
        po.amendment_count = 0
        po.created_at = datetime.now(timezone.utc)
        po.updated_at = datetime.now(timezone.utc)
        po.lines = []
        po.amendments = []
        return po

    def test_health(self, client):
        res = client.get("/api/v1/purchase-orders/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    def test_list_pos(self, client, mock_user):
        po = self._make_po(mock_user.org_id, mock_user.id)
        with patch("app.modules.purchase_order.router.purchase_order_service.list", new_callable=AsyncMock, return_value=([po], 1)):
            res = client.get("/api/v1/purchase-orders?page=1&page_size=10")
            assert res.status_code == 200
            data = res.json()["data"]
            assert len(data) == 1
            assert data[0]["id"] == str(po.id)

    def test_create_po(self, client, mock_user):
        po = self._make_po(mock_user.org_id, mock_user.id)
        with patch("app.modules.purchase_order.router.purchase_order_service.create", new_callable=AsyncMock, return_value=po):
            res = client.post(
                "/api/v1/purchase-orders",
                json={
                    "title": "New PO",
                    "vendor_id": str(po.vendor_id),
                    "business_unit_id": str(po.business_unit_id),
                    "category_id": str(po.category_id),
                    "currency": "USD",
                    "lines": [
                        {
                            "item_description": "Widget",
                            "uom_id": str(uuid4()),
                            "ordered_quantity": "10",
                            "unit_price": "25.00",
                        }
                    ],
                },
            )
            assert res.status_code == 201

    def test_create_from_award(self, client, mock_user):
        po = self._make_po(mock_user.org_id, mock_user.id)
        with patch("app.modules.purchase_order.router.purchase_order_service.create_from_award", new_callable=AsyncMock, return_value=[po]):
            res = client.post(
                "/api/v1/purchase-orders/from-award",
                json={
                    "arn_id": str(uuid4()),
                    "deviation_justification": "Approved override",
                },
            )
            assert res.status_code == 201


    def test_get_po(self, client, mock_user):
        po = self._make_po(mock_user.org_id, mock_user.id)
        with patch("app.modules.purchase_order.router.purchase_order_service.get", new_callable=AsyncMock, return_value=po):
            res = client.get(f"/api/v1/purchase-orders/{po.id}")
            assert res.status_code == 200
            assert res.json()["data"]["id"] == str(po.id)

    def test_approve_po(self, client, mock_user):
        po = self._make_po(mock_user.org_id, mock_user.id)
        with patch("app.modules.purchase_order.router.purchase_order_service.approve", new_callable=AsyncMock, return_value=po), \
             patch("app.modules.purchase_order.router.purchase_order_service.get", new_callable=AsyncMock, return_value=po):
            res = client.post(f"/api/v1/purchase-orders/{po.id}/approve")
            assert res.status_code == 200

    def test_reject_po(self, client, mock_user):
        po = self._make_po(mock_user.org_id, mock_user.id)
        with patch("app.modules.purchase_order.router.purchase_order_service.reject", new_callable=AsyncMock, return_value=po), \
             patch("app.modules.purchase_order.router.purchase_order_service.get", new_callable=AsyncMock, return_value=po):
            res = client.post(f"/api/v1/purchase-orders/{po.id}/reject?rejection_reason=PriceTooHigh")
            assert res.status_code == 200

    def test_send_to_vendor(self, client, mock_user):
        po = self._make_po(mock_user.org_id, mock_user.id)
        with patch("app.modules.purchase_order.router.purchase_order_service.send_to_vendor", new_callable=AsyncMock, return_value=po), \
             patch("app.modules.purchase_order.router.purchase_order_service.get", new_callable=AsyncMock, return_value=po):
            res = client.post(f"/api/v1/purchase-orders/{po.id}/send-to-vendor")
            assert res.status_code == 200

    def test_acknowledge_po(self, client, mock_user):
        po = self._make_po(mock_user.org_id, mock_user.id)
        with patch("app.modules.purchase_order.router.purchase_order_service.record_vendor_acknowledgement", new_callable=AsyncMock, return_value=po), \
             patch("app.modules.purchase_order.router.purchase_order_service.get", new_callable=AsyncMock, return_value=po):
            res = client.post(
                f"/api/v1/purchase-orders/{po.id}/acknowledge",
                json={"accepted": True},
            )
            assert res.status_code == 200

    def test_amend_po(self, client, mock_user):
        po = self._make_po(mock_user.org_id, mock_user.id)
        with patch("app.modules.purchase_order.router.purchase_order_service.amend_po", new_callable=AsyncMock, return_value=po):
            res = client.post(
                f"/api/v1/purchase-orders/{po.id}/amend",
                json={
                    "reason": "Quantity increase",
                    "lines": [
                        {
                            "item_description": "Widget",
                            "uom_id": str(uuid4()),
                            "ordered_quantity": "15",
                            "unit_price": "25.00",
                        }
                    ],
                },
            )
            assert res.status_code == 200

    def test_close_po(self, client, mock_user):
        po = self._make_po(mock_user.org_id, mock_user.id)
        with patch("app.modules.purchase_order.router.purchase_order_service.close_po", new_callable=AsyncMock, return_value=po):
            res = client.post(f"/api/v1/purchase-orders/{po.id}/close")
            assert res.status_code == 200

    def test_cancel_po(self, client, mock_user):
        po = self._make_po(mock_user.org_id, mock_user.id)
        with patch("app.modules.purchase_order.router.purchase_order_service.cancel_po", new_callable=AsyncMock, return_value=po):
            res = client.post(
                f"/api/v1/purchase-orders/{po.id}/cancel",
                json={"cancellation_reason": "No longer needed"},
            )
            assert res.status_code == 200

    def test_download_pdf(self, client, mock_user):
        po = self._make_po(mock_user.org_id, mock_user.id)
        with patch("app.modules.purchase_order.router.purchase_order_service.get", new_callable=AsyncMock, return_value=po), \
             patch.object(purchase_order_service.pdf_generator, "build_pdf_bytes", return_value=b"%PDF-1.4 dummy"):
            res = client.get(f"/api/v1/purchase-orders/{po.id}/pdf")
            assert res.status_code == 200
            assert res.headers["content-type"] == "application/pdf"
