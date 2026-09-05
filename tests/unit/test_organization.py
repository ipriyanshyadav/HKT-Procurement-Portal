from __future__ import annotations
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
import pytest

from app.modules.organization.models import BusinessUnit, CostCenter, Organization
from app.modules.organization.repository import (
    BusinessUnitRepository,
    CostCenterRepository,
    OrganizationRepository,
)
from app.modules.organization.service import OrganizationService
from app.modules.workflow.evaluator import safe_eval


@pytest.mark.asyncio
async def test_business_unit_repository():
    repo = BusinessUnitRepository()
    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalars.return_value.all.return_value = [MagicMock(spec=BusinessUnit)]
    mock_db.execute.return_value = mock_res

    org_id = uuid4()
    bus = await repo.list_by_org(mock_db, org_id, active_only=True)
    assert len(bus) == 1

    bus_inactive = await repo.list_by_org(mock_db, org_id, active_only=False)
    assert len(bus_inactive) == 1


@pytest.mark.asyncio
async def test_cost_center_repository():
    repo = CostCenterRepository()
    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalars.return_value.all.return_value = [MagicMock(spec=CostCenter)]
    mock_db.execute.return_value = mock_res

    org_id = uuid4()
    bu_id = uuid4()
    ccs = await repo.list_by_org(mock_db, org_id, business_unit_id=bu_id, active_only=True)
    assert len(ccs) == 1

    ccs_no_bu = await repo.list_by_org(mock_db, org_id, business_unit_id=None, active_only=False)
    assert len(ccs_no_bu) == 1


@pytest.mark.asyncio
async def test_organization_repository():
    repo = OrganizationRepository()
    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalars.return_value.all.return_value = [MagicMock(spec=Organization)]
    mock_res.scalar_one_or_none.return_value = MagicMock(spec=Organization)
    mock_db.execute.return_value = mock_res

    orgs = await repo.get_all_active(mock_db)
    assert len(orgs) == 1

    org = await repo.get(mock_db, uuid4())
    assert org is not None


@pytest.mark.asyncio
async def test_organization_service():
    bu_repo = AsyncMock()
    cc_repo = AsyncMock()
    bu_repo.list_by_org.return_value = []
    cc_repo.list_by_org.return_value = []

    svc = OrganizationService(bu_repo=bu_repo, cc_repo=cc_repo)
    mock_db = AsyncMock()
    org_id = uuid4()

    await svc.list_business_units(mock_db, org_id)
    bu_repo.list_by_org.assert_awaited_once_with(mock_db, org_id, active_only=True)

    await svc.list_cost_centers(mock_db, org_id)
    cc_repo.list_by_org.assert_awaited_once_with(mock_db, org_id, business_unit_id=None, active_only=True)


def test_evaluator_safe_eval():
    assert safe_eval(None, {}) is True
    assert safe_eval("", {}) is True
    assert safe_eval("amount > 1000", {"amount": 5000}) is True
    assert safe_eval("amount > 1000", {"amount": 500}) is False
    assert safe_eval("is_capex == True", {"is_capex": True}) is True
    assert safe_eval("is_emergency == True and amount > 5000", {"is_emergency": True, "amount": 6000}) is True
    # Test stripping unallowed names
    assert safe_eval("malicious_key == 1", {"malicious_key": 1}) is False
    # Test syntax error
    assert safe_eval("amount >>> 100", {"amount": 50}) is False
