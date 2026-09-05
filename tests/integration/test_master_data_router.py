"""
Integration tests for the Master Data Router (/api/v1/master-data).
Tests all 15 endpoints via FastAPI TestClient with dependency overrides.
"""
from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.db.enums import IntegrationJobStatusEnum
from app.db.session import get_db
from app.main import app
from app.modules.integration.models import IntegrationJob
from app.modules.master_data.models import (
    Category,
    CurrencyMaster,
    DeliveryLocation,
    HolidayMaster,
    Incoterm,
    PaymentTerm,
    TaxCode,
    UomMaster,
)
from app.modules.user.models import User
from app.modules.user.role_repository import role_repository


async def _fake_db():
    mock = AsyncMock()
    mock.commit = AsyncMock()
    mock.rollback = AsyncMock()
    yield mock


@pytest.fixture
def mock_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "admin@procurement.test"
    user.roles = ["ADMIN"]
    return user


@pytest.fixture
def client(mock_user):
    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[get_current_user] = lambda: mock_user

    with patch.object(role_repository, "user_has_permission", AsyncMock(return_value=True)):
        with TestClient(app) as test_client:
            yield test_client

    app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# Tests
# -----------------------------------------------------------------------------


def test_master_data_health(client):
    response = client.get("/api/v1/master-data/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["module"] == "master_data"


def test_list_categories_flat(client, mock_user):
    cat = Category(
        id=uuid4(),
        org_id=mock_user.org_id,
        code="IT",
        name="Information Technology",
        level=1,
        path="/IT",
        parent_id=None,
        unspsc_code=None,
        is_active=True,
        version=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    with patch("app.modules.master_data.category.service.category_service.list_all", AsyncMock(return_value=[cat])):
        response = client.get("/api/v1/master-data/categories")
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) == 1
    assert data[0]["code"] == "IT"


def test_list_categories_tree(client, mock_user):
    tree_data = [
        {
            "id": str(uuid4()),
            "code": "IT",
            "name": "Information Technology",
            "level": 1,
            "path": "/IT",
            "parent_id": None,
            "is_active": True,
            "unspsc_code": None,
            "children": [],
        }
    ]
    with patch("app.modules.master_data.category.service.category_service.get_tree", AsyncMock(return_value=tree_data)):
        response = client.get("/api/v1/master-data/categories/tree")
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) == 1
    assert data[0]["code"] == "IT"


def test_create_category_endpoint(client, mock_user):
    new_cat = Category(
        id=uuid4(),
        org_id=mock_user.org_id,
        code="HARDWARE",
        name="Hardware",
        level=1,
        path="/HARDWARE",
        parent_id=None,
        unspsc_code="43211500",
        is_active=True,
        version=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    with patch("app.modules.master_data.category.service.category_service.create", AsyncMock(return_value=new_cat)):
        response = client.post(
            "/api/v1/master-data/categories",
            json={"code": "HARDWARE", "name": "Hardware", "unspsc_code": "43211500"},
        )
    assert response.status_code == 201
    assert response.json()["data"]["code"] == "HARDWARE"


def test_update_category_endpoint(client, mock_user):
    cat_id = uuid4()
    updated_cat = Category(
        id=cat_id,
        org_id=mock_user.org_id,
        code="HARDWARE",
        name="Hardware Updated",
        level=1,
        path="/HARDWARE",
        parent_id=None,
        unspsc_code=None,
        is_active=True,
        version=2,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    with patch("app.modules.master_data.category.service.category_service.update", AsyncMock(return_value=updated_cat)):
        response = client.put(
            f"/api/v1/master-data/categories/{cat_id}",
            json={"name": "Hardware Updated"},
        )
    assert response.status_code == 200
    assert response.json()["data"]["name"] == "Hardware Updated"


def test_delete_category_endpoint(client, mock_user):
    cat_id = uuid4()
    with patch("app.modules.master_data.category.service.category_service.soft_delete", AsyncMock(return_value=None)):
        response = client.delete(f"/api/v1/master-data/categories/{cat_id}")
    assert response.status_code == 200
    assert response.json()["data"]["message"] == "Category deleted successfully"


def test_list_uom_endpoint(client, mock_user):
    uom = UomMaster(
        id=uuid4(),
        org_id=mock_user.org_id,
        code="EA",
        name="Each",
        iso_code="EA",
        is_active=True,
        version=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    with patch("app.modules.master_data.uom.service.uom_service.list_all", AsyncMock(return_value=[uom])):
        response = client.get("/api/v1/master-data/uom")
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) == 1
    assert data[0]["code"] == "EA"


def test_list_currencies_endpoint(client, mock_user):
    curr = CurrencyMaster(
        id=uuid4(),
        org_id=mock_user.org_id,
        code="INR",
        name="Indian Rupee",
        symbol="₹",
        exchange_rate_to_base=Decimal("1.0"),
        is_base_currency=True,
        is_active=True,
        version=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    with patch("app.modules.master_data.currency.service.currency_service.list_all", AsyncMock(return_value=[curr])):
        response = client.get("/api/v1/master-data/currencies")
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) == 1
    assert data[0]["code"] == "INR"


def test_list_payment_terms_endpoint(client, mock_user):
    term = PaymentTerm(
        id=uuid4(),
        org_id=mock_user.org_id,
        code="NET30",
        name="Net 30 Days",
        net_days=30,
        discount_percentage=Decimal("0.0"),
        discount_days=0,
        description="Standard 30 days",
        is_active=True,
        version=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    with patch("app.modules.master_data.payment_terms.service.payment_terms_service.list_all", AsyncMock(return_value=[term])):
        response = client.get("/api/v1/master-data/payment-terms")
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) == 1
    assert data[0]["code"] == "NET30"


def test_list_tax_codes_endpoint(client, mock_user):
    tax = TaxCode(
        id=uuid4(),
        org_id=mock_user.org_id,
        code="GST18",
        name="GST 18%",
        rate=Decimal("18.00"),
        tax_type="GST",
        hsn_chapter="84",
        is_active=True,
        version=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    with patch("app.modules.master_data.tax.service.tax_service.list_all", AsyncMock(return_value=[tax])):
        response = client.get("/api/v1/master-data/tax-codes")
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) == 1
    assert data[0]["code"] == "GST18"


def test_create_delivery_location_endpoint(client, mock_user):
    loc = DeliveryLocation(
        id=uuid4(),
        org_id=mock_user.org_id,
        code="BLR-PLANT",
        name="Bangalore Plant",
        address="Electronic City Phase 1",
        city="Bangalore",
        state="Karnataka",
        postal_code="560100",
        country_code="IN",
        plant_id=None,
        is_active=True,
        version=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    with patch("app.modules.master_data.location.service.delivery_location_service.create", AsyncMock(return_value=loc)):
        response = client.post(
            "/api/v1/master-data/delivery-locations",
            json={
                "code": "BLR-PLANT",
                "name": "Bangalore Plant",
                "address": "Electronic City Phase 1",
                "city": "Bangalore",
                "state": "Karnataka",
                "postal_code": "560100",
                "country_code": "IN",
            },
        )
    assert response.status_code == 201
    assert response.json()["data"]["code"] == "BLR-PLANT"


def test_create_holiday_endpoint(client, mock_user):
    hol_date = (datetime.now(timezone.utc) + timedelta(days=60)).date()
    h = HolidayMaster(
        id=uuid4(),
        org_id=mock_user.org_id,
        name="Diwali",
        holiday_date=hol_date,
        plant_id=None,
        is_active=True,
        version=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    with patch("app.modules.master_data.holiday.service.holiday_service.create", AsyncMock(return_value=h)):
        response = client.post(
            "/api/v1/master-data/holidays",
            json={"name": "Diwali", "holiday_date": hol_date.isoformat()},
        )
    assert response.status_code == 201
    assert response.json()["data"]["name"] == "Diwali"


def test_import_categories_csv_endpoint(client, mock_user):
    job_id = uuid4()
    job = MagicMock(spec=IntegrationJob, id=job_id, status=IntegrationJobStatusEnum.PENDING)
    with patch("app.modules.master_data.import_service.master_data_import_service.import_categories_csv", AsyncMock(return_value=job)):
        response = client.post(
            "/api/v1/master-data/import/categories",
            files={"file": ("test.csv", b"code,name,parent_code\nA,B,\n", "text/csv")},
        )
    assert response.status_code == 202
    assert response.json()["data"]["job_id"] == str(job_id)
    assert response.json()["data"]["status"] == "PENDING"


def test_create_uom_endpoint(client, mock_user):
    uom = UomMaster(
        id=uuid4(),
        org_id=mock_user.org_id,
        code="BOX",
        name="Box of 10",
        iso_code="BX",
        is_active=True,
        version=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    with patch("app.modules.master_data.uom.service.uom_service.create", AsyncMock(return_value=uom)):
        response = client.post(
            "/api/v1/master-data/uoms",
            json={"code": "BOX", "name": "Box of 10", "iso_code": "BX"},
        )
    assert response.status_code == 201
    assert response.json()["data"]["code"] == "BOX"


def test_create_currency_endpoint(client, mock_user):
    curr = CurrencyMaster(
        id=uuid4(),
        org_id=mock_user.org_id,
        code="EUR",
        name="Euro",
        symbol="€",
        exchange_rate_to_base=Decimal("90.5"),
        is_base_currency=False,
        is_active=True,
        version=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    with patch("app.modules.master_data.currency.service.currency_service.create", AsyncMock(return_value=curr)):
        response = client.post(
            "/api/v1/master-data/currencies",
            json={"code": "EUR", "name": "Euro", "symbol": "€", "exchange_rate_to_base": "90.5"},
        )
    assert response.status_code == 201
    assert response.json()["data"]["code"] == "EUR"


def test_create_payment_term_endpoint(client, mock_user):
    term = PaymentTerm(
        id=uuid4(),
        org_id=mock_user.org_id,
        code="NET45",
        name="Net 45 Days",
        net_days=45,
        discount_percentage=Decimal("0.00"),
        discount_days=0,
        description="Payment due within 45 days",
        is_active=True,
        version=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    with patch("app.modules.master_data.payment_terms.service.payment_terms_service.create", AsyncMock(return_value=term)):
        response = client.post(
            "/api/v1/master-data/payment-terms",
            json={"code": "NET45", "name": "Net 45 Days", "net_days": 45},
        )
    assert response.status_code == 201
    assert response.json()["data"]["code"] == "NET45"


def test_create_tax_code_endpoint(client, mock_user):
    tax = TaxCode(
        id=uuid4(),
        org_id=mock_user.org_id,
        code="GST28",
        name="GST 28%",
        rate=Decimal("28.00"),
        tax_type="GST",
        hsn_chapter="87",
        is_active=True,
        version=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    with patch("app.modules.master_data.tax.service.tax_service.create", AsyncMock(return_value=tax)):
        response = client.post(
            "/api/v1/master-data/tax-codes",
            json={"code": "GST28", "name": "GST 28%", "rate": "28.00", "tax_type": "GST", "hsn_chapter": "87"},
        )
    assert response.status_code == 201
    assert response.json()["data"]["code"] == "GST28"


def test_delete_holiday_endpoint(client, mock_user):
    hol_id = uuid4()
    with patch("app.modules.master_data.holiday.service.holiday_service.delete", AsyncMock(return_value=None)):
        response = client.delete(f"/api/v1/master-data/holidays/{hol_id}")
    assert response.status_code == 200
    assert response.json()["data"]["message"] == "Holiday deleted successfully"


