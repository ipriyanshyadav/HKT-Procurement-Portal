import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.modules.evaluation.models import ComparativeStatement, CsLineRanking
from app.modules.evaluation.schemas import ApplyOptimizationScenarioRequest
from app.modules.evaluation.service import EvaluationService
from app.modules.sourcing.models import Rfq, RfqLine


@pytest.mark.asyncio
async def test_generate_award_optimization_scenarios():
    service = EvaluationService()
    org_id = uuid4()
    cs_id = uuid4()
    rfq_id = uuid4()
    v1_id = uuid4()
    v2_id = uuid4()
    line1_id = uuid4()
    line2_id = uuid4()

    rfq_line1 = MagicMock(spec=RfqLine)
    rfq_line1.id = line1_id
    rfq_line1.line_number = 1
    rfq_line1.item_description = "Server Rack"
    rfq_line1.quantity = Decimal("10")

    rfq_line2 = MagicMock(spec=RfqLine)
    rfq_line2.id = line2_id
    rfq_line2.line_number = 2
    rfq_line2.item_description = "Switch 48-Port"
    rfq_line2.quantity = Decimal("5")

    rfq = MagicMock(spec=Rfq)
    rfq.id = rfq_id
    rfq.estimated_value = Decimal("500000.00")
    rfq.currency = "INR"
    rfq.lines = [rfq_line1, rfq_line2]

    # Vendor 1: Line 1 = 20,000 (total 200k), Line 2 = 50,000 (total 250k) -> Overall: 450k
    # Vendor 2: Line 1 = 22,000 (total 220k), Line 2 = 40,000 (total 200k) -> Overall: 420k
    r1 = MagicMock(spec=CsLineRanking)
    r1.rfq_line_id = line1_id
    r1.lot_id = None
    r1.vendor_id = v1_id
    r1.bid_id = uuid4()
    r1.raw_unit_price = Decimal("20000.00")
    r1.landed_cost = Decimal("20000.00")
    r1.lot_total_inr = Decimal("200000.00")
    r1.rank = 1
    r1.is_l1 = True

    r2 = MagicMock(spec=CsLineRanking)
    r2.rfq_line_id = line1_id
    r2.lot_id = None
    r2.vendor_id = v2_id
    r2.bid_id = uuid4()
    r2.raw_unit_price = Decimal("22000.00")
    r2.landed_cost = Decimal("22000.00")
    r2.lot_total_inr = Decimal("220000.00")
    r2.rank = 2
    r2.is_l1 = False

    r3 = MagicMock(spec=CsLineRanking)
    r3.rfq_line_id = line2_id
    r3.lot_id = None
    r3.vendor_id = v1_id
    r3.bid_id = uuid4()
    r3.raw_unit_price = Decimal("50000.00")
    r3.landed_cost = Decimal("50000.00")
    r3.lot_total_inr = Decimal("250000.00")
    r3.rank = 2
    r3.is_l1 = False

    r4 = MagicMock(spec=CsLineRanking)
    r4.rfq_line_id = line2_id
    r4.lot_id = None
    r4.vendor_id = v2_id
    r4.bid_id = uuid4()
    r4.raw_unit_price = Decimal("40000.00")
    r4.landed_cost = Decimal("40000.00")
    r4.lot_total_inr = Decimal("200000.00")
    r4.rank = 1
    r4.is_l1 = True

    cs = MagicMock(spec=ComparativeStatement)
    cs.id = cs_id
    cs.cs_number = "CS-2026-001"
    cs.rfq_id = rfq_id
    cs.total_estimated_value = Decimal("500000.00")
    cs.rankings = [r1, r2, r3, r4]

    db = AsyncMock()
    with patch.object(service.eval_repo, "get_cs", new_callable=AsyncMock) as mock_get_cs, \
         patch.object(service.rfq_repo, "get", new_callable=AsyncMock) as mock_get_rfq, \
         patch.object(service.vendor_repo, "find_by_ids", new_callable=AsyncMock) as mock_find_vendors:

        mock_get_cs.return_value = cs
        mock_get_rfq.return_value = rfq
        v1 = MagicMock(id=v1_id, company_name="Acme Hardware")
        v2 = MagicMock(id=v2_id, company_name="Globex Tech")
        mock_find_vendors.return_value = [v1, v2]

        resp = await service.generate_award_optimization_scenarios(db, cs_id, org_id)

        assert resp.cs_id == cs_id
        assert len(resp.scenarios) == 3

        # Scenario 1: Winner-Take-All -> Best is v2 (total 420,000)
        s1 = next(s for s in resp.scenarios if s.scenario_type == "WINNER_TAKE_ALL")
        assert s1.total_value == Decimal("420000.00")
        assert s1.vendor_count == 1
        assert "Globex Tech" in s1.awarded_vendor_names

        # Scenario 2: Line Item Best -> Line 1 to v1 (200k) + Line 2 to v2 (200k) = 400,000 total!
        s2 = next(s for s in resp.scenarios if s.scenario_type == "LINE_ITEM_BEST")
        assert s2.total_value == Decimal("400000.00")
        assert s2.vendor_count == 2
        assert s2.projected_savings_value == Decimal("100000.00")  # 500k - 400k = 100k savings (20%)
        assert s2.projected_savings_percentage == 20.0

        # Scenario 3: Dual Sourcing 70/30
        s3 = next(s for s in resp.scenarios if s.scenario_type == "DUAL_SOURCING_70_30")
        assert s3.vendor_count == 2
        assert s3.risk_rating == "VERY_LOW"
        assert len(s3.line_allocations) == 4  # 2 lines * 2 vendors each = 4 allocations


@pytest.mark.asyncio
async def test_apply_optimization_scenario():
    service = EvaluationService()
    org_id = uuid4()
    cs_id = uuid4()
    actor_id = uuid4()

    with patch.object(service, "generate_award_optimization_scenarios", new_callable=AsyncMock) as mock_gen, \
         patch.object(service, "recommend_award", new_callable=AsyncMock) as mock_rec:

        from app.modules.evaluation.schemas import (
            AwardOptimizationScenario,
            AwardOptimizationScenariosResponse,
            ScenarioLineItemAllocation,
        )

        mock_scenario = AwardOptimizationScenario(
            scenario_type="LINE_ITEM_BEST",
            title="Line-Item Best Bid",
            description="Cherry-pick",
            total_value=Decimal("400000.00"),
            baseline_estimated_value=Decimal("500000.00"),
            projected_savings_value=Decimal("100000.00"),
            projected_savings_percentage=20.0,
            vendor_count=2,
            risk_rating="LOW",
            awarded_vendor_names=["Acme", "Globex"],
            line_allocations=[
                ScenarioLineItemAllocation(
                    vendor_id=uuid4(),
                    bid_id=uuid4(),
                    unit_price=Decimal("20000.00"),
                    quantity=Decimal("10.0"),
                    total_value=Decimal("200000.00"),
                    allocation_percentage=100.0,
                )
            ],
        )

        mock_gen.return_value = AwardOptimizationScenariosResponse(
            cs_id=cs_id,
            cs_number="CS-001",
            rfq_id=uuid4(),
            currency="INR",
            total_estimated_value=Decimal("500000.00"),
            recommended_scenario="LINE_ITEM_BEST",
            scenarios=[mock_scenario],
        )

        mock_rec.return_value = MagicMock(id=uuid4(), arn_number="ARN-001")

        db = AsyncMock()
        payload = ApplyOptimizationScenarioRequest(
            scenario_type="LINE_ITEM_BEST",
            justification="Best line item pricing accepted",
        )
        res = await service.apply_optimization_scenario(db, cs_id, payload, actor_id, org_id)

        assert res.arn_number == "ARN-001"
        mock_rec.assert_called_once()
