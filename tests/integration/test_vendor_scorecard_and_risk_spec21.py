"""Integration tests for Supplier Performance Scorecards & Risk Assessment (SPEC_21 & SPEC_07).

Covers:
- Automated scorecard rating calculation (Delivery adherence, Quality rejection, Commercial compliance, Responsiveness, Pricing competitiveness)
- Financial and ESG risk assessment profiles & tier classification (LOW, MEDIUM, HIGH, CRITICAL)
- Organization-wide Vendor Risk Dashboard
- API endpoints & role-based access enforcement
"""
from __future__ import annotations
from datetime import datetime, timezone, date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.db.enums import VendorStatusEnum, UserStatusEnum, PoStatusEnum, InvoiceStatusEnum
from app.db.session import get_db
from app.main import app
from app.modules.user.models import User
from app.modules.user.role_repository import role_repository
from app.modules.vendor.models import Vendor, VendorScorecard, VendorRiskAssessment
from app.modules.vendor.service import vendor_service
from app.modules.purchase_order.models import PurchaseOrder
from app.modules.grn.models import GoodsReceiptNote, GrnLine
from app.modules.invoice.models import Invoice
from app.modules.bid.models import BidResponse


@pytest.fixture
def buyer_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "buyer@procurement.example.com"
    user.first_name = "Buyer"
    user.last_name = "Officer"
    user.status = UserStatusEnum.ACTIVE
    user.is_supplier_user = False
    user.vendor_id = None
    return user


@pytest.fixture
def supplier_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "supplier@vendor.example.com"
    user.first_name = "Supplier"
    user.last_name = "Representative"
    user.status = UserStatusEnum.ACTIVE
    user.is_supplier_user = True
    user.vendor_id = uuid4()
    return user


@pytest.fixture
def client_buyer(buyer_user):
    async def _fake_db():
        mock = AsyncMock()
        mock.execute = AsyncMock()
        mock.commit = AsyncMock()
        mock.flush = AsyncMock()
        mock.refresh = AsyncMock()
        mock.add = MagicMock()
        yield mock

    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[get_current_user] = lambda: buyer_user

    with patch.object(role_repository, "user_has_permission", new_callable=AsyncMock, return_value=True):
        yield TestClient(app)

    app.dependency_overrides.clear()


@pytest.fixture
def client_supplier(supplier_user):
    async def _fake_db():
        mock = AsyncMock()
        mock.execute = AsyncMock()
        mock.commit = AsyncMock()
        mock.flush = AsyncMock()
        mock.refresh = AsyncMock()
        mock.add = MagicMock()
        yield mock

    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[get_current_user] = lambda: supplier_user

    with patch.object(role_repository, "user_has_permission", new_callable=AsyncMock, return_value=True):
        yield TestClient(app)

    app.dependency_overrides.clear()


@pytest.mark.integration
class TestVendorScorecardAndRiskSpec21:

    def _make_vendor(self, org_id: uuid4, vendor_id: uuid4 = None):
        return Vendor(
            id=vendor_id or uuid4(),
            org_id=org_id,
            vendor_code="VEND-101",
            company_name="Alpha Tech Solutions",
            legal_name="Alpha Technologies Pvt Ltd",
            registration_type="DOMESTIC",
            pan="ABCDE1234F",
            gstin="27ABCDE1234F1Z5",
            primary_email="info@alphatech.example.com",
            country_code="IN",
            status=VendorStatusEnum.ACTIVE,
            performance_score=Decimal("88.50"),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

    def _make_scorecard(self, org_id: uuid4, vendor_id: uuid4):
        return VendorScorecard(
            id=uuid4(),
            org_id=org_id,
            vendor_id=vendor_id,
            period_start=date.today() - timedelta(days=90),
            period_end=date.today(),
            on_time_delivery_rate=Decimal("94.50"),
            quality_acceptance_rate=Decimal("98.20"),
            commercial_compliance_score=Decimal("92.00"),
            responsiveness_score=Decimal("89.00"),
            overall_score=Decimal("94.39"),
            calculated_at=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc),
        )

    def _make_risk_assessment(self, org_id: uuid4, vendor_id: uuid4):
        return VendorRiskAssessment(
            id=uuid4(),
            org_id=org_id,
            vendor_id=vendor_id,
            financial_risk_score=Decimal("22.50"),
            credit_rating="AA",
            financial_stability_score=Decimal("82.00"),
            liquidity_risk="LOW",
            bankruptcy_risk="LOW",
            debt_to_equity_ratio=Decimal("0.45"),
            esg_risk_score=Decimal("18.00"),
            environmental_score=Decimal("85.00"),
            social_score=Decimal("88.00"),
            governance_score=Decimal("92.00"),
            esg_rating="LEADER",
            overall_risk_score=Decimal("18.73"),
            risk_tier="LOW",
            risk_factors=["Low volatility in supplier revenue", "Standard supply chain carbon footprint"],
            mitigation_actions=["Quarterly audited balance sheet review"],
            last_assessed_at=datetime.now(timezone.utc),
        )

    @pytest.mark.asyncio
    async def test_automated_scorecard_calculation_service(self):
        """Test the automated calculation logic using simulated database records."""
        org_id = uuid4()
        vendor_id = uuid4()
        vendor = self._make_vendor(org_id, vendor_id)

        db = AsyncMock()

        # Mock repo.find_by_id
        with patch.object(vendor_service.repo, "find_by_id", new_callable=AsyncMock, return_value=vendor), \
             patch.object(vendor_service.repo, "create_scorecard", new_callable=AsyncMock) as mock_create_sc, \
             patch("app.events.publisher.OutboxPublisher.publish", new_callable=AsyncMock) as mock_pub:

            # Create mock GRN & PO
            po = MagicMock(spec=PurchaseOrder)
            po.expected_delivery_date = date.today() - timedelta(days=10)

            grn = MagicMock(spec=GoodsReceiptNote)
            grn.id = uuid4()
            grn.receipt_date = date.today() - timedelta(days=12)  # Delivered 2 days early!

            # Mock GRN Line
            line = MagicMock(spec=GrnLine)
            line.received_quantity = Decimal("100.0")
            line.accepted_quantity = Decimal("98.0")
            line.rejected_quantity = Decimal("2.0")

            # Mock Invoice
            invoice = MagicMock(spec=Invoice)
            invoice.match_status = "MATCHED"

            # Mock Bid
            bid = MagicMock(spec=BidResponse)
            bid.status = "SUBMITTED"

            # Setup db.execute returns
            async def fake_execute(stmt, *args, **kwargs):
                mock_res = MagicMock()
                s = str(stmt)
                if "goods_receipt_notes" in s.lower() and "purchase_orders" in s.lower():
                    mock_res.all.return_value = [(grn, po)]
                elif "grn_lines" in s.lower():
                    mock_res.scalars.return_value.all.return_value = [line]
                elif "invoices" in s.lower():
                    mock_res.scalars.return_value.all.return_value = [invoice]
                elif "bid_responses" in s.lower():
                    mock_res.scalars.return_value.all.return_value = [bid]
                else:
                    mock_res.all.return_value = []
                    mock_res.scalars.return_value.all.return_value = []
                return mock_res

            db.execute = AsyncMock(side_effect=fake_execute)

            def fake_create_sc(session, org_id, vendor_id, data):
                return VendorScorecard(
                    id=uuid4(),
                    org_id=org_id,
                    vendor_id=vendor_id,
                    **data,
                )
            mock_create_sc.side_effect = fake_create_sc

            scorecard = await vendor_service.calculate_scorecard_automated(
                db, vendor_id, org_id
            )

            assert scorecard.on_time_delivery_rate == Decimal("100.00")
            assert scorecard.quality_acceptance_rate == Decimal("98.00")
            assert scorecard.quality_rejection_rate == Decimal("2.00")
            assert scorecard.commercial_compliance_score == Decimal("100.00")
            assert scorecard.responsiveness_score == Decimal("100.00")
            # 100*0.4 + 98*0.3 + 100*0.2 + 100*0.1 = 40 + 29.4 + 20 + 10 = 99.40
            assert scorecard.overall_score == Decimal("99.40")
            assert vendor.performance_score == Decimal("99.40")
            # Low performance event not triggered since overall_score >= 60
            assert mock_pub.call_count == 0

    @pytest.mark.asyncio
    async def test_low_performance_triggers_advisory_alert(self):
        """Test that scorecard overall_score < 60 publishes vendor.low_performance alert."""
        org_id = uuid4()
        vendor_id = uuid4()
        vendor = self._make_vendor(org_id, vendor_id)
        db = AsyncMock()

        with patch.object(vendor_service.repo, "find_by_id", new_callable=AsyncMock, return_value=vendor), \
             patch.object(vendor_service.repo, "create_scorecard", new_callable=AsyncMock) as mock_create_sc, \
             patch("app.events.publisher.OutboxPublisher.publish", new_callable=AsyncMock) as mock_pub:

            po = MagicMock(spec=PurchaseOrder)
            po.expected_delivery_date = date.today() - timedelta(days=20)
            grn = MagicMock(spec=GoodsReceiptNote)
            grn.id = uuid4()
            grn.receipt_date = date.today() - timedelta(days=5)  # 15 days late!

            line = MagicMock(spec=GrnLine)
            line.received_quantity = Decimal("100.0")
            line.accepted_quantity = Decimal("40.0")
            line.rejected_quantity = Decimal("60.0")

            invoice = MagicMock(spec=Invoice)
            invoice.match_status = "MISMATCH"

            async def fake_execute(stmt, *args, **kwargs):
                mock_res = MagicMock()
                s = str(stmt)
                if "goods_receipt_notes" in s.lower() and "purchase_orders" in s.lower():
                    mock_res.all.return_value = [(grn, po)]
                elif "grn_lines" in s.lower():
                    mock_res.scalars.return_value.all.return_value = [line]
                elif "invoices" in s.lower():
                    mock_res.scalars.return_value.all.return_value = [invoice]
                else:
                    mock_res.all.return_value = []
                    mock_res.scalars.return_value.all.return_value = []
                return mock_res

            db.execute = AsyncMock(side_effect=fake_execute)
            mock_create_sc.side_effect = lambda session, org_id, vendor_id, data: VendorScorecard(
                id=uuid4(), org_id=org_id, vendor_id=vendor_id, **data
            )

            scorecard = await vendor_service.calculate_scorecard_automated(db, vendor_id, org_id)

            assert scorecard.on_time_delivery_rate == Decimal("0.00")
            assert scorecard.quality_acceptance_rate == Decimal("40.00")
            assert scorecard.quality_rejection_rate == Decimal("60.00")
            assert scorecard.overall_score < Decimal("60.00")
            # Should have published low_performance event
            assert mock_pub.call_count == 1
            call_args = mock_pub.call_args[0]
            assert call_args[2] == "vendor.low_performance"

    def test_post_scorecard_calculate_api(self, client_buyer, buyer_user):
        """Test POST /api/v1/vendors/{id}/scorecard/calculate endpoint."""
        vendor = self._make_vendor(buyer_user.org_id)
        card = self._make_scorecard(buyer_user.org_id, vendor.id)
        card.quality_rejection_rate = Decimal("1.80")
        card.pricing_competitiveness = Decimal("95.00")

        with patch.object(vendor_service, "calculate_scorecard_automated", new_callable=AsyncMock, return_value=card):
            res = client_buyer.post(
                f"/api/v1/vendors/{vendor.id}/scorecard/calculate",
                json={
                    "period_start": (date.today() - timedelta(days=90)).isoformat(),
                    "period_end": date.today().isoformat(),
                },
            )
            assert res.status_code == 200
            data = res.json()["data"]
            assert float(data["on_time_delivery_rate"]) == 94.5
            assert float(data["quality_rejection_rate"]) == 1.8
            assert float(data["pricing_competitiveness"]) == 95.0
            assert float(data["overall_score"]) == 94.39

    def test_supplier_forbidden_from_calculating_scorecard(self, client_supplier, supplier_user):
        """Test that supplier persona cannot trigger scorecard calculation."""
        res = client_supplier.post(f"/api/v1/vendors/{supplier_user.vendor_id}/scorecard/calculate")
        assert res.status_code == 403

    def test_get_and_put_risk_assessment_api(self, client_buyer, buyer_user):
        """Test GET and PUT /api/v1/vendors/{id}/risk-assessment endpoints."""
        vendor = self._make_vendor(buyer_user.org_id)
        risk = self._make_risk_assessment(buyer_user.org_id, vendor.id)

        # GET risk assessment
        with patch.object(vendor_service, "get_risk_assessment", new_callable=AsyncMock, return_value=risk):
            res_get = client_buyer.get(f"/api/v1/vendors/{vendor.id}/risk-assessment")
            assert res_get.status_code == 200
            data = res_get.json()["data"]
            assert data["credit_rating"] == "AA"
            assert data["risk_tier"] == "LOW"
            assert data["esg_rating"] == "LEADER"

        # PUT risk assessment (upgrade risk parameters to HIGH)
        updated_risk = self._make_risk_assessment(buyer_user.org_id, vendor.id)
        updated_risk.financial_risk_score = Decimal("65.00")
        updated_risk.esg_risk_score = Decimal("55.00")
        updated_risk.overall_risk_score = Decimal("61.00")
        updated_risk.risk_tier = "HIGH"

        with patch.object(vendor_service, "update_risk_assessment", new_callable=AsyncMock, return_value=updated_risk):
            res_put = client_buyer.put(
                f"/api/v1/vendors/{vendor.id}/risk-assessment",
                json={
                    "financial_risk_score": 65.0,
                    "esg_risk_score": 55.0,
                    "credit_rating": "BBB",
                    "liquidity_risk": "MEDIUM",
                },
            )
            assert res_put.status_code == 200
            put_data = res_put.json()["data"]
            assert put_data["risk_tier"] == "HIGH"
            assert float(put_data["financial_risk_score"]) == 65.0

    def test_get_risk_dashboard_api(self, client_buyer, buyer_user):
        """Test GET /api/v1/vendors/risk/dashboard aggregator endpoint."""
        dashboard_data = {
            "total_vendors_monitored": 14,
            "low_risk_count": 9,
            "medium_risk_count": 3,
            "high_risk_count": 2,
            "critical_risk_count": 0,
            "avg_financial_risk_score": Decimal("26.40"),
            "avg_esg_risk_score": Decimal("21.10"),
            "avg_overall_risk_score": Decimal("24.80"),
            "high_risk_watchlist": [
                {
                    "vendor_id": uuid4(),
                    "vendor_code": "VEND-009",
                    "company_name": "At-Risk Logistics Ltd",
                    "overall_risk_score": Decimal("68.50"),
                    "risk_tier": "HIGH",
                    "financial_risk_score": Decimal("72.00"),
                    "credit_rating": "B",
                    "esg_risk_score": Decimal("65.00"),
                    "esg_rating": "LAGGARD",
                    "performance_score": Decimal("55.00"),
                }
            ],
            "esg_ratings_distribution": {
                "LEADER": 5,
                "AVERAGE": 7,
                "LAGGARD": 2,
            },
        }

        with patch.object(vendor_service, "get_risk_dashboard", new_callable=AsyncMock, return_value=dashboard_data):
            res = client_buyer.get("/api/v1/vendors/risk/dashboard")
            assert res.status_code == 200
            data = res.json()["data"]
            assert data["total_vendors_monitored"] == 14
            assert data["low_risk_count"] == 9
            assert data["high_risk_count"] == 2
            assert len(data["high_risk_watchlist"]) == 1
            assert data["high_risk_watchlist"][0]["company_name"] == "At-Risk Logistics Ltd"
            assert data["esg_ratings_distribution"]["LEADER"] == 5
