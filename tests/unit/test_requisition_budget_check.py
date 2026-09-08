from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.modules.organization.models import CostCenter, Organization
from app.modules.requisition.service import RequisitionService


@pytest.fixture
def requisition_service():
    repo = AsyncMock()
    return RequisitionService(repo=repo)


@pytest.mark.asyncio
async def test_budget_preflight_sufficient(requisition_service):
    """When requested amount is within available budget, return SUFFICIENT status."""
    mock_db = AsyncMock()
    org_id = uuid4()
    cost_center_id = uuid4()

    mock_org = MagicMock(spec=Organization)
    mock_org.settings = {"budget_check_config": {"default_mode": "hard"}}

    mock_cc = MagicMock(spec=CostCenter)
    mock_cc.available_budget = Decimal("50000.00")

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=mock_org)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=mock_cc)),
    ]

    result = await requisition_service.check_budget_preflight(
        mock_db,
        cost_center_id=cost_center_id,
        amount=Decimal("15000.00"),
        org_id=org_id,
    )

    assert result.status == "SUFFICIENT"
    assert result.available == Decimal("50000.00")
    assert result.requested == Decimal("15000.00")
    assert "Budget sufficient" in (result.message or "")


@pytest.mark.asyncio
async def test_budget_preflight_warning_in_soft_mode(requisition_service):
    """When budget is exceeded in soft mode, return WARNING status without throwing."""
    mock_db = AsyncMock()
    org_id = uuid4()
    cost_center_id = uuid4()

    mock_org = MagicMock(spec=Organization)
    mock_org.settings = {"budget_check_config": {"default_mode": "soft"}}

    mock_cc = MagicMock(spec=CostCenter)
    mock_cc.available_budget = Decimal("10000.00")

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=mock_org)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=mock_cc)),
    ]

    result = await requisition_service.check_budget_preflight(
        mock_db,
        cost_center_id=cost_center_id,
        amount=Decimal("25000.00"),
        org_id=org_id,
    )

    assert result.status == "WARNING"
    assert result.available == Decimal("10000.00")
    assert result.requested == Decimal("25000.00")
    assert "warning" in (result.message or "").lower()


@pytest.mark.asyncio
async def test_budget_preflight_blocked_in_hard_mode(requisition_service):
    """When budget is exceeded in hard mode, return BLOCKED status with available amount."""
    mock_db = AsyncMock()
    org_id = uuid4()
    cost_center_id = uuid4()

    mock_org = MagicMock(spec=Organization)
    mock_org.settings = {"budget_check_config": {"default_mode": "hard"}}

    mock_cc = MagicMock(spec=CostCenter)
    mock_cc.available_budget = Decimal("5000.00")

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=mock_org)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=mock_cc)),
    ]

    result = await requisition_service.check_budget_preflight(
        mock_db,
        cost_center_id=cost_center_id,
        amount=Decimal("12000.00"),
        org_id=org_id,
    )

    assert result.status == "BLOCKED"
    assert result.available == Decimal("5000.00")
    assert result.requested == Decimal("12000.00")
    assert "Insufficient budget" in (result.message or "")


@pytest.mark.asyncio
async def test_budget_preflight_bu_override(requisition_service):
    """Category or BU override can force hard mode over default soft mode."""
    mock_db = AsyncMock()
    org_id = uuid4()
    cost_center_id = uuid4()
    bu_id = uuid4()

    mock_org = MagicMock(spec=Organization)
    mock_org.settings = {
        "budget_check_config": {
            "default_mode": "soft",
            "overrides": [{"bu_id": str(bu_id), "mode": "hard"}],
        }
    }

    mock_cc = MagicMock(spec=CostCenter)
    mock_cc.available_budget = Decimal("2000.00")

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=mock_org)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=mock_cc)),
    ]

    result = await requisition_service.check_budget_preflight(
        mock_db,
        cost_center_id=cost_center_id,
        amount=Decimal("5000.00"),
        org_id=org_id,
        bu_id=bu_id,
    )

    assert result.status == "BLOCKED"
    assert result.available == Decimal("2000.00")


@pytest.mark.asyncio
async def test_budget_check_endpoint_via_client():
    """Verify GET /api/v1/requisitions/budget-check returns 200 and BudgetCheckResult."""
    from unittest.mock import patch
    from fastapi.testclient import TestClient
    from app.main import app
    from app.auth.dependencies import get_current_user
    from app.db.session import get_db
    from app.modules.requisition.schemas import BudgetCheckResult
    from app.modules.requisition.service import requisition_service

    mock_user = MagicMock()
    mock_user.id = uuid4()
    mock_user.org_id = uuid4()
    mock_user.is_supplier_user = False

    async def fake_db():
        yield AsyncMock()

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: mock_user

    expected_result = BudgetCheckResult(
        status="SUFFICIENT",
        available=Decimal("100000.00"),
        requested=Decimal("25000.00"),
        message="Budget sufficient",
    )

    with patch.object(requisition_service, "check_budget_preflight", AsyncMock(return_value=expected_result)):
        with TestClient(app) as client:
            cc_id = uuid4()
            response = client.get(
                "/api/v1/requisitions/budget-check",
                params={"cost_center_id": str(cc_id), "amount": "25000.00"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["data"]["status"] == "SUFFICIENT"
            assert Decimal(str(data["data"]["available"])) == Decimal("100000.00")
            assert Decimal(str(data["data"]["requested"])) == Decimal("25000.00")

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)

