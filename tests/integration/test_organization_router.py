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


def test_organization_profile_endpoints(client, mock_user, monkeypatch):
    from app.modules.organization.models import Organization
    org = Organization(
        id=mock_user.org_id,
        name="Acme Corp",
        legal_name="Acme Corporation Ltd",
        country_code="IN",
        base_currency="INR",
        cost_of_capital_rate=0.12,
        settings={},
        version=1,
    )
    async def mock_get_org(db, org_id):
        return org
    async def mock_update_org(db, org_id, payload):
        org.name = payload.name or org.name
        return org

    monkeypatch.setattr(organization_service, "get_organization", mock_get_org)
    monkeypatch.setattr(organization_service, "update_organization", mock_update_org)

    # GET
    res = client.get("/api/v1/organization")
    assert res.status_code == 200
    assert res.json()["data"]["name"] == "Acme Corp"

    # PATCH
    res_patch = client.patch("/api/v1/organization", json={"name": "Acme Updated"})
    assert res_patch.status_code == 200
    assert res_patch.json()["data"]["name"] == "Acme Updated"


def test_legal_entities_endpoints(client, mock_user, monkeypatch):
    from app.modules.organization.models import LegalEntity
    le = LegalEntity(
        id=uuid4(),
        org_id=mock_user.org_id,
        name="Acme Legal",
        registration_number="REG-100",
        country_code="IN",
        version=1,
    )
    async def mock_list(db, org_id):
        return [le]
    async def mock_create(db, org_id, payload):
        return le
    async def mock_get(db, id, org_id):
        return le
    async def mock_update(db, id, org_id, payload):
        return le
    async def mock_delete(db, id, org_id):
        return None

    monkeypatch.setattr(organization_service, "list_legal_entities", mock_list)
    monkeypatch.setattr(organization_service, "create_legal_entity", mock_create)
    monkeypatch.setattr(organization_service, "get_legal_entity", mock_get)
    monkeypatch.setattr(organization_service, "update_legal_entity", mock_update)
    monkeypatch.setattr(organization_service, "delete_legal_entity", mock_delete)

    # List
    res = client.get("/api/v1/legal-entities")
    assert res.status_code == 200
    assert len(res.json()["data"]) == 1

    # Create
    res_create = client.post("/api/v1/legal-entities", json={
        "name": "Acme Legal",
        "registration_number": "REG-100",
        "country_code": "IN",
    })
    assert res_create.status_code == 201

    # Delete
    res_del = client.delete(f"/api/v1/legal-entities/{le.id}")
    assert res_del.status_code == 200
    assert res_del.json()["data"]["deleted"] is True


def test_plants_endpoints(client, mock_user, monkeypatch):
    from app.modules.organization.models import Plant
    p = Plant(
        id=uuid4(),
        org_id=mock_user.org_id,
        business_unit_id=uuid4(),
        code="PLANT-01",
        name="Main Plant",
        plant_type="MANUFACTURING",
        country_code="IN",
        is_active=True,
        version=1,
    )
    async def mock_list(db, org_id, business_unit_id=None, active_only=True):
        return [p]
    async def mock_create(db, org_id, payload):
        return p
    async def mock_get(db, id, org_id):
        return p
    async def mock_update(db, id, org_id, payload):
        return p
    async def mock_delete(db, id, org_id):
        return None

    monkeypatch.setattr(organization_service, "list_plants", mock_list)
    monkeypatch.setattr(organization_service, "create_plant", mock_create)
    monkeypatch.setattr(organization_service, "get_plant", mock_get)
    monkeypatch.setattr(organization_service, "update_plant", mock_update)
    monkeypatch.setattr(organization_service, "delete_plant", mock_delete)

    res = client.get("/api/v1/plants")
    assert res.status_code == 200
    assert len(res.json()["data"]) == 1
    assert res.json()["data"][0]["code"] == "PLANT-01"

    res_post = client.post("/api/v1/plants", json={
        "code": "PLANT-01",
        "name": "Main Plant",
        "business_unit_id": str(p.business_unit_id),
    })
    assert res_post.status_code == 201

    res_del = client.delete(f"/api/v1/plants/{p.id}")
    assert res_del.status_code == 200


def test_departments_endpoints(client, mock_user, monkeypatch):
    from app.modules.organization.models import Department
    d = Department(
        id=uuid4(),
        org_id=mock_user.org_id,
        business_unit_id=uuid4(),
        code="DEPT-OPS",
        name="Operations",
        is_active=True,
        version=1,
    )
    async def mock_list(db, org_id, business_unit_id=None, active_only=True):
        return [d]
    async def mock_create(db, org_id, payload):
        return d
    async def mock_get(db, id, org_id):
        return d
    async def mock_update(db, id, org_id, payload):
        return d
    async def mock_delete(db, id, org_id):
        return None

    monkeypatch.setattr(organization_service, "list_departments", mock_list)
    monkeypatch.setattr(organization_service, "create_department", mock_create)
    monkeypatch.setattr(organization_service, "get_department", mock_get)
    monkeypatch.setattr(organization_service, "update_department", mock_update)
    monkeypatch.setattr(organization_service, "delete_department", mock_delete)

    res = client.get("/api/v1/departments")
    assert res.status_code == 200
    assert len(res.json()["data"]) == 1
    assert res.json()["data"][0]["code"] == "DEPT-OPS"

    res_post = client.post("/api/v1/departments", json={
        "code": "DEPT-OPS",
        "name": "Operations",
        "business_unit_id": str(d.business_unit_id),
    })
    assert res_post.status_code == 201

    res_del = client.delete(f"/api/v1/departments/{d.id}")
    assert res_del.status_code == 200

