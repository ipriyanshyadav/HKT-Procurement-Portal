import pytest
from uuid import uuid4
from decimal import Decimal
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch
from app.modules.master_data.models import Category, UomMaster, ItemMaster
from app.modules.notification.channels.whatsapp import whatsapp_channel
from app.modules.user.role_repository import role_repository


@pytest.fixture(autouse=True)
def allow_all_permissions():
    with patch.object(role_repository, "user_has_permission", AsyncMock(return_value=True)):
        yield

@pytest.mark.asyncio
async def test_item_master_crud_and_search(client: AsyncClient, admin_auth_headers: dict, admin_user, db):
    # 1. Create category and uom
    cat = Category(id=uuid4(), org_id=admin_user.org_id, code=f"CAT-{uuid4().hex[:6]}", name="Hardware", level=1)
    uom = UomMaster(id=uuid4(), org_id=admin_user.org_id, code=f"UOM-{uuid4().hex[:4]}", name="Piece")
    db.add_all([cat, uom])
    await db.commit()

    # 2. List items
    res = await client.get("/api/v1/master-data/items", headers=admin_auth_headers)
    assert res.status_code == 200
    assert "data" in res.json()

    # 3. Create new catalog item
    item_code = f"ITEM-{uuid4().hex[:6]}"
    create_payload = {
        "code": item_code,
        "name": "Ergonomic Monitor Arm",
        "description": "Heavy duty aluminum gas spring monitor arm",
        "category_id": str(cat.id),
        "uom_id": str(uom.id),
        "standard_price": 4500.0,
        "currency": "INR",
        "hsn_code": "84733092",
    }
    create_res = await client.post("/api/v1/master-data/items", headers=admin_auth_headers, json=create_payload)
    assert create_res.status_code == 201
    created_item = create_res.json()["data"]
    assert created_item["code"] == item_code
    item_id = created_item["id"]

    # 4. Search item by keyword
    search_res = await client.get(f"/api/v1/master-data/items?search={item_code[:8]}", headers=admin_auth_headers)
    assert search_res.status_code == 200
    items = search_res.json()["data"]
    assert any(i["code"] == item_code for i in items)

    # 5. Get by ID
    get_res = await client.get(f"/api/v1/master-data/items/{item_id}", headers=admin_auth_headers)
    assert get_res.status_code == 200
    assert get_res.json()["data"]["name"] == "Ergonomic Monitor Arm"

    # 6. Update item
    update_res = await client.put(
        f"/api/v1/master-data/items/{item_id}",
        headers=admin_auth_headers,
        json={"name": "Ergonomic Dual Monitor Arm", "standard_price": 5200.0},
    )
    assert update_res.status_code == 200
    assert update_res.json()["data"]["name"] == "Ergonomic Dual Monitor Arm"

    # 7. Delete item
    del_res = await client.delete(f"/api/v1/master-data/items/{item_id}", headers=admin_auth_headers)
    assert del_res.status_code == 200


@pytest.mark.asyncio
async def test_punchout_session_and_cart(client: AsyncClient, auth_headers: dict):
    # Create PunchOut session
    sess_res = await client.post(
        "/api/v1/master-data/punchout/session",
        headers=auth_headers,
        json={"return_url": "http://localhost:3000/requisitions/new"},
    )
    assert sess_res.status_code == 200
    data = sess_res.json()["data"]
    assert "session_id" in data
    assert "punchout_url" in data

    # Transfer cart items back
    cart_res = await client.post(
        "/api/v1/master-data/punchout/cart",
        headers=auth_headers,
        json=[
            {
                "item_code": "AMZN-STATIONERY-1",
                "item_description": "Wireless Keyboard and Mouse Combo",
                "quantity": 2,
                "unit_price": 1850.0,
                "currency": "INR",
            }
        ],
    )
    assert cart_res.status_code == 200
    assert cart_res.json()["data"]["received_count"] == 1


@pytest.mark.asyncio
async def test_multi_entity_csv_import(client: AsyncClient, admin_auth_headers: dict):
    # Test UOM import
    csv_uom = "code,name,iso_code\nBX1,Test Box,BX\n"
    files = {"file": ("uom.csv", csv_uom.encode("utf-8"), "text/csv")}
    res = await client.post("/api/v1/master-data/import/uom", headers=admin_auth_headers, files=files)
    assert res.status_code == 202
    job_id = res.json()["data"]["job_id"]

    # Check job status
    status_res = await client.get(f"/api/v1/master-data/import/jobs/{job_id}", headers=admin_auth_headers)
    assert status_res.status_code == 200
    assert "status" in status_res.json()["data"]


@pytest.mark.asyncio
async def test_turnstile_anti_bot_verification(client: AsyncClient):
    # Test verify-turnstile endpoint with mock pass token
    res = await client.post(
        "/api/v1/auth/verify-turnstile",
        json={"token": "mock-turnstile-pass-token"},
    )
    assert res.status_code == 200
    assert res.json()["data"]["success"] is True


@pytest.mark.asyncio
async def test_whatsapp_channel_dispatch():
    # Test simulated/mock WhatsApp dispatch
    code = await whatsapp_channel.send(
        to_phone="+919876543210",
        message="Your requisition PR-2026-001 has been approved.",
    )
    assert code in (200, 202)
