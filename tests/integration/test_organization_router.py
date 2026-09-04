"""
Integration tests for the Organization Router (/api/v1/business-units, /api/v1/cost-centers).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.main import app
from app.modules.organization.models import BusinessUnit, CostCenter
from app.modules.organization.service import organization_service
from app.modules.user.models import User


async def _fake_db():
    mock = AsyncMock()
    yield mock


@pytest.fixture
def mock_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "requestor@procurement.test"
    user.roles = ["REQUESTOR"]
    return user


@pytest.fixture
def client(mock_user):
    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[get_current_user] = lambda: mock_user
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_organization_health(client):
    res = client.get("/api/v1/organizations/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["module"] == "organization"


def test_list_business_units(client, mock_user, monkeypatch):
    bu = BusinessUnit(
        id=uuid4(),
        org_id=mock_user.org_id,
        legal_entity_id=uuid4(),
        code="BU-ENG",
        name="Engineering",
        default_currency="INR",
        is_active=True,
    )
    async def mock_list_bus(db, org_id, active_only=True):
        return [bu]

    monkeypatch.setattr(organization_service, "list_business_units", mock_list_bus)

    res = client.get("/api/v1/business-units")
    assert res.status_code == 200
    data = res.json()
    assert "data" in data
    assert len(data["data"]) == 1
    assert data["data"][0]["code"] == "BU-ENG"
    assert data["data"][0]["name"] == "Engineering"


def test_list_cost_centers(client, mock_user, monkeypatch):
    bu_id = uuid4()
    cc = CostCenter(
        id=uuid4(),
        org_id=mock_user.org_id,
        business_unit_id=bu_id,
        code="CC-ENG-01",
        name="Engineering Core",
        annual_budget=500000,
        available_budget=500000,
        is_active=True,
    )
    async def mock_list_ccs(db, org_id, business_unit_id=None, active_only=True):
        if business_unit_id and business_unit_id != bu_id:
            return []
        return [cc]

    monkeypatch.setattr(organization_service, "list_cost_centers", mock_list_ccs)

    res = client.get("/api/v1/cost-centers")
    assert res.status_code == 200
    data = res.json()
    assert "data" in data
    assert len(data["data"]) == 1
    assert data["data"][0]["code"] == "CC-ENG-01"

    # With matching BU filter
    res_filtered = client.get(f"/api/v1/cost-centers?business_unit_id={bu_id}")
    assert res_filtered.status_code == 200
    assert len(res_filtered.json()["data"]) == 1

    # With non-matching BU filter
    other_id = uuid4()
    res_empty = client.get(f"/api/v1/cost-centers?business_unit_id={other_id}")
    assert res_empty.status_code == 200
    assert len(res_empty.json()["data"]) == 0
