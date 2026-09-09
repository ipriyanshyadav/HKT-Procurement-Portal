from __future__ import annotations
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.db.enums import (
    RfqStatusEnum,
    RfqTypeEnum,
    SourcingTypeEnum,
    EvaluationTypeEnum,
    ProcurementTypeEnum,
    UserStatusEnum,
)
from app.db.session import get_db
from app.main import app
from app.modules.sourcing.models import Rfq, RfqParticipant, RfqClarification
from app.modules.user.models import User
from app.modules.user.role_repository import role_repository


@pytest.fixture
def mock_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "sourcing@example.com"
    user.first_name = "Sourcing"
    user.last_name = "Lead"
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
class TestSourcingRouter:
    def _make_rfq(self, org_id, user_id):
        rfq = MagicMock(spec=Rfq)
        rfq.id = uuid4()
        rfq.org_id = org_id
        rfq.rfq_number = "RFQ-2026-0001"
        rfq.title = "Test Hardware Sourcing"
        rfq.description = "Procuring laptops"
        rfq.rfq_type = RfqTypeEnum.LIMITED_TENDER
        rfq.sourcing_type = SourcingTypeEnum.GOODS
        rfq.evaluation_type = EvaluationTypeEnum.L1_PRICE_ONLY
        rfq.procurement_type = ProcurementTypeEnum.CAPEX
        rfq.status = RfqStatusEnum.DRAFT
        rfq.buyer_id = user_id
        rfq.business_unit_id = uuid4()
        rfq.category_id = uuid4()
        rfq.currency = "INR"
        rfq.estimated_value = Decimal("500000.00")
        rfq.bid_close_at = datetime.now(timezone.utc) + timedelta(days=14)
        rfq.bid_open_at = datetime.now(timezone.utc) + timedelta(days=15)
        rfq.bid_validity_days = 90
        rfq.is_multi_lot = False
        rfq.is_emergency = False
        rfq.is_single_vendor = False
        rfq.amendment_count = 0
        rfq.published_at = None
        rfq.bids_opened_at = None
        rfq.bid_opening_initiated_by = None
        rfq.bid_opening_initiated_at = None
        rfq.cancelled_at = None
        rfq.cancel_reason = None
        rfq.source_pr_id = None
        rfq.bidding_mode = "SEALED"
        rfq.auction_config = None
        rfq.created_by = user_id
        rfq.created_at = datetime.now(timezone.utc)
        rfq.updated_at = datetime.now(timezone.utc)
        rfq.lots = []
        rfq.lines = []
        rfq.participants = []
        rfq.clarifications = []
        return rfq

    def test_create_rfq(self, client, mock_user):
        rfq = self._make_rfq(mock_user.org_id, mock_user.id)
        with patch("app.modules.sourcing.router.rfq_service.create", new_callable=AsyncMock, return_value=rfq):
            res = client.post(
                "/api/v1/rfqs",
                json={
                    "title": "Hardware Sourcing",
                    "business_unit_id": str(rfq.business_unit_id),
                    "category_id": str(rfq.category_id),
                    "currency": "INR",
                    "estimated_value": "500000.00",
                    "bid_close_at": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
                    "lines": [
                        {
                            "line_number": 1,
                            "item_description": "Laptop 16GB",
                            "category_id": str(rfq.category_id),
                            "uom_id": str(uuid4()),
                            "quantity": "10",
                            "estimated_unit_price": "50000.00",
                        }
                    ],
                },
            )
            assert res.status_code == 201

    def test_list_rfqs(self, client, mock_user):
        rfq = self._make_rfq(mock_user.org_id, mock_user.id)
        with patch("app.modules.sourcing.router.rfq_service.list_rfqs", new_callable=AsyncMock, return_value=([rfq], 1)):
            res = client.get("/api/v1/rfqs")
            assert res.status_code == 200
            assert len(res.json()["data"]) == 1

    def test_export_csv_and_pdf(self, client, mock_user):
        rfq = self._make_rfq(mock_user.org_id, mock_user.id)
        with patch("app.modules.sourcing.router.rfq_service.list_rfqs", new_callable=AsyncMock, return_value=([rfq], 1)):
            res_csv = client.get("/api/v1/rfqs/export/csv")
            assert res_csv.status_code == 200
            assert "text/csv" in res_csv.headers["content-type"]

            res_pdf = client.get("/api/v1/rfqs/export/pdf")
            assert res_pdf.status_code == 200
            assert "application/pdf" in res_pdf.headers["content-type"]

    def test_get_rfq(self, client, mock_user):
        rfq = self._make_rfq(mock_user.org_id, mock_user.id)
        with patch("app.modules.sourcing.router.rfq_service.get_by_id", new_callable=AsyncMock, return_value=rfq):
            res = client.get(f"/api/v1/rfqs/{rfq.id}")
            assert res.status_code == 200
            assert res.json()["data"]["id"] == str(rfq.id)

    def test_update_rfq(self, client, mock_user):
        rfq = self._make_rfq(mock_user.org_id, mock_user.id)
        with patch("app.modules.sourcing.router.rfq_service.update", new_callable=AsyncMock, return_value=rfq):
            res = client.put(
                f"/api/v1/rfqs/{rfq.id}",
                json={"title": "Updated Hardware Sourcing"},
            )
            assert res.status_code == 200

    def test_submit_rfq(self, client, mock_user):
        rfq = self._make_rfq(mock_user.org_id, mock_user.id)
        with patch("app.modules.sourcing.router.rfq_service.submit", new_callable=AsyncMock, return_value=rfq):
            res = client.post(f"/api/v1/rfqs/{rfq.id}/submit")
            assert res.status_code == 200

    def test_publish_rfq(self, client, mock_user):
        rfq = self._make_rfq(mock_user.org_id, mock_user.id)
        with patch("app.modules.sourcing.router.rfq_service.publish", new_callable=AsyncMock, return_value=rfq):
            res = client.post(f"/api/v1/rfqs/{rfq.id}/publish")
            assert res.status_code == 200

    def test_amend_rfq(self, client, mock_user):
        rfq = self._make_rfq(mock_user.org_id, mock_user.id)
        with patch("app.modules.sourcing.router.rfq_service.amend", new_callable=AsyncMock, return_value=rfq):
            res = client.post(
                f"/api/v1/rfqs/{rfq.id}/amend",
                json={"changes_summary": "Changed processor spec from i5 to i7"},
            )
            assert res.status_code == 200

    def test_cancel_rfq(self, client, mock_user):
        rfq = self._make_rfq(mock_user.org_id, mock_user.id)
        with patch("app.modules.sourcing.router.rfq_service.cancel", new_callable=AsyncMock, return_value=rfq):
            res = client.post(
                f"/api/v1/rfqs/{rfq.id}/cancel",
                json={"reason": "Budget cuts for Q3"},
            )
            assert res.status_code == 200

    def test_extend_deadline(self, client, mock_user):
        rfq = self._make_rfq(mock_user.org_id, mock_user.id)
        with patch("app.modules.sourcing.router.rfq_service.extend_deadline", new_callable=AsyncMock, return_value=rfq):
            res = client.post(
                f"/api/v1/rfqs/{rfq.id}/extend-deadline",
                json={
                    "new_bid_close_at": (datetime.now(timezone.utc) + timedelta(days=20)).isoformat(),
                    "reason": "Vendor request for deadline extension",
                },
            )
            assert res.status_code == 200


    def test_participants_management(self, client, mock_user):
        participant = MagicMock(spec=RfqParticipant)
        participant.id = uuid4()
        participant.rfq_id = uuid4()
        participant.vendor_id = uuid4()
        participant.invited_at = datetime.now(timezone.utc)
        participant.invitation_status = "INVITED"
        participant.accepted_at = None
        participant.regretted_at = None

        with patch("app.modules.sourcing.router.rfq_service.add_participants", new_callable=AsyncMock, return_value=[participant]):
            res = client.post(
                f"/api/v1/rfqs/{participant.rfq_id}/add-participants",
                json={"vendor_ids": [str(participant.vendor_id)]},
            )
            assert res.status_code == 200

        with patch("app.modules.sourcing.router.rfq_service.remove_participant", new_callable=AsyncMock):
            res_del = client.delete(f"/api/v1/rfqs/{participant.rfq_id}/participants/{participant.vendor_id}")
            assert res_del.status_code == 204

    def test_dual_auth_bid_opening(self, client, mock_user):
        rfq = self._make_rfq(mock_user.org_id, mock_user.id)
        with patch("app.modules.sourcing.router.rfq_service.initiate_bid_opening", new_callable=AsyncMock, return_value={"message": "Initiated"}):
            res_init = client.post(f"/api/v1/rfqs/{rfq.id}/initiate-bid-opening")
            assert res_init.status_code == 200

        with patch("app.modules.sourcing.router.rfq_service.co_authorize_bid_opening", new_callable=AsyncMock, return_value=rfq):
            res_co = client.post(f"/api/v1/rfqs/{rfq.id}/co-authorize-opening")
            assert res_co.status_code == 200

    def test_clarifications(self, client, mock_user):
        rfq = self._make_rfq(mock_user.org_id, mock_user.id)
        clarif = MagicMock(spec=RfqClarification)
        clarif.id = uuid4()
        clarif.rfq_id = rfq.id
        clarif.question = "Can we bid partially?"
        clarif.answer = None
        clarif.asked_by = mock_user.id
        clarif.asked_by_vendor_id = None
        clarif.answered_by = None
        clarif.answered_at = None
        clarif.is_published = True
        clarif.published_at = None
        clarif.created_at = datetime.now(timezone.utc)

        with patch("app.modules.sourcing.router.rfq_service.get_by_id", new_callable=AsyncMock, return_value=rfq), \
             patch("app.modules.sourcing.router.rfq_service.get_clarifications", new_callable=AsyncMock, return_value=[clarif]):
            res_list = client.get(f"/api/v1/rfqs/{rfq.id}/clarifications")
            assert res_list.status_code == 200
            assert len(res_list.json()["data"]) == 1

        with patch("app.modules.sourcing.router.rfq_service.get_by_id", new_callable=AsyncMock, return_value=rfq), \
             patch("app.modules.sourcing.router.rfq_service.add_clarification", new_callable=AsyncMock, return_value=clarif):
            res_add = client.post(
                f"/api/v1/rfqs/{rfq.id}/clarifications",
                json={"question": "Can we bid partially?"},
            )
            assert res_add.status_code == 201

        with patch("app.modules.sourcing.router.rfq_service.respond_to_clarification", new_callable=AsyncMock, return_value=clarif):
            res_resp = client.put(
                f"/api/v1/rfqs/{rfq.id}/clarifications/{clarif.id}/respond",
                json={"answer": "Yes, partial bids are permitted.", "is_published": True},
            )
            assert res_resp.status_code == 200

    def test_rfq_audit_trail_and_dashboard(self, client, mock_user):
        rfq = self._make_rfq(mock_user.org_id, mock_user.id)
        with patch("app.modules.sourcing.router.rfq_service.get_by_id", new_callable=AsyncMock, return_value=rfq):
            res_audit = client.get(f"/api/v1/rfqs/{rfq.id}/audit-trail")
            assert res_audit.status_code == 200

        dashboard_data = {
            "rfq_id": rfq.id,
            "status": "PUBLISHED",
            "bid_count": 5,
            "bids_opened": False,
            "participant_count": 10,
            "clarification_count": 3,
            "unanswered_clarifications": 1,
            "bid_opening_step": 0,
            "days_to_deadline": 5,
        }
        with patch("app.modules.sourcing.router.rfq_service.get_dashboard", new_callable=AsyncMock, return_value=dashboard_data):
            res_dash = client.get(f"/api/v1/rfqs/{rfq.id}/dashboard")
            assert res_dash.status_code == 200
