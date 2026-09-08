from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING
from uuid import uuid4

import pytest

from app.auth.jwt import create_access_token
from app.modules.user.models import UserSession

if TYPE_CHECKING:
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
async def second_org(db: AsyncSession, factory):
    """Separate organization for multi-tenant cross-org isolation tests."""
    return await factory.organization.create(db)


@pytest.fixture
async def second_org_buyer(db: AsyncSession, second_org, factory):
    """Buyer belonging to second_org."""
    return await factory.user.create(db, org_id=second_org.id, role="BUYER")


@pytest.fixture
async def second_org_headers(db: AsyncSession, second_org_buyer):
    """Auth headers for second_org_buyer."""
    jti = str(uuid4())
    token = create_access_token(
        user_id=second_org_buyer.id,
        org_id=second_org_buyer.org_id,
        email=second_org_buyer.email,
        roles=["BUYER"],
        bu_scope=[],
        category_scope=[],
        plant_scope=[],
        is_supplier_user=False,
        vendor_id=None,
        jti=jti,
    )
    user_session = UserSession(
        id=uuid4(),
        org_id=second_org_buyer.org_id,
        user_id=second_org_buyer.id,
        token_jti=jti,
        expires_at=datetime.now(UTC) + timedelta(hours=8),
        is_revoked=False,
    )
    db.add(user_session)
    await db.flush()
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def second_buyer(db: AsyncSession, org, factory):
    """A second buyer in the same organization."""
    return await factory.user.create(db, org_id=org.id, role="BUYER")


@pytest.fixture
async def second_buyer_headers(db: AsyncSession, second_buyer):
    """Auth headers for second_buyer."""
    jti = str(uuid4())
    token = create_access_token(
        user_id=second_buyer.id,
        org_id=second_buyer.org_id,
        email=second_buyer.email,
        roles=["BUYER"],
        bu_scope=[],
        category_scope=[],
        plant_scope=[],
        is_supplier_user=False,
        vendor_id=None,
        jti=jti,
    )
    user_session = UserSession(
        id=uuid4(),
        org_id=second_buyer.org_id,
        user_id=second_buyer.id,
        token_jti=jti,
        expires_at=datetime.now(UTC) + timedelta(hours=8),
        is_revoked=False,
    )
    db.add(user_session)
    await db.flush()
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def requestor_user(db: AsyncSession, org, factory):
    """Requestor user who does NOT have admin or export permissions."""
    return await factory.user.create(db, org_id=org.id, role="REQUESTOR")


@pytest.fixture
async def requestor_headers(db: AsyncSession, requestor_user):
    """Auth headers for requestor_user."""
    jti = str(uuid4())
    token = create_access_token(
        user_id=requestor_user.id,
        org_id=requestor_user.org_id,
        email=requestor_user.email,
        roles=["REQUESTOR"],
        bu_scope=[],
        category_scope=[],
        plant_scope=[],
        is_supplier_user=False,
        vendor_id=None,
        jti=jti,
    )
    user_session = UserSession(
        id=uuid4(),
        org_id=requestor_user.org_id,
        user_id=requestor_user.id,
        token_jti=jti,
        expires_at=datetime.now(UTC) + timedelta(hours=8),
        is_revoked=False,
    )
    db.add(user_session)
    await db.flush()
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.security
@pytest.mark.asyncio
async def test_cross_org_isolation(
    client: AsyncClient, auth_headers: dict[str, str], second_org_headers: dict[str, str]
):
    """Verify Org B cannot view or access tickets belonging to Org A."""
    create_payload = {
        "title": "Org A Confidential Procurement Issue",
        "description": "Sensitive organizational ticket that must never leak across orgs.",
        "ticket_type": "AUDIT_QUERY",
        "priority": "HIGH",
    }
    create_resp = await client.post("/api/v1/tickets", json=create_payload, headers=auth_headers)
    assert create_resp.status_code == 201
    ticket_id = create_resp.json()["data"]["id"]

    # Org B attempts to read ticket
    get_resp = await client.get(f"/api/v1/tickets/{ticket_id}", headers=second_org_headers)
    assert get_resp.status_code == 404

    # Org B lists tickets — should not contain Org A's ticket
    list_resp = await client.get("/api/v1/tickets", headers=second_org_headers)
    assert list_resp.status_code == 200
    ids = [t["id"] for t in list_resp.json()["data"]]
    assert ticket_id not in ids


@pytest.mark.security
@pytest.mark.asyncio
async def test_private_ticket_isolation(
    client: AsyncClient, auth_headers: dict[str, str], second_buyer_headers: dict[str, str]
):
    """Verify private ticket is invisible to non-creator/non-assignee in the same org."""
    create_payload = {
        "title": "Confidential Whistleblower Query",
        "description": "Sensitive internal investigation ticket requiring complete privacy.",
        "ticket_type": "COMPLAINT",
        "priority": "CRITICAL",
        "is_private": True,
    }
    create_resp = await client.post("/api/v1/tickets", json=create_payload, headers=auth_headers)
    assert create_resp.status_code == 201
    ticket_id = create_resp.json()["data"]["id"]

    # Creator can access
    creator_resp = await client.get(f"/api/v1/tickets/{ticket_id}", headers=auth_headers)
    assert creator_resp.status_code == 200

    # Another buyer in same org is forbidden
    other_resp = await client.get(f"/api/v1/tickets/{ticket_id}", headers=second_buyer_headers)
    assert other_resp.status_code == 403

    # Another buyer listing tickets should not see this private ticket
    list_resp = await client.get("/api/v1/tickets", headers=second_buyer_headers)
    assert list_resp.status_code == 200
    ids = [t["id"] for t in list_resp.json()["data"]]
    assert ticket_id not in ids


@pytest.mark.security
@pytest.mark.asyncio
async def test_supplier_isolation_and_internal_notes(
    client: AsyncClient, auth_headers: dict[str, str], supplier_auth_headers: dict[str, str]
):
    """Verify suppliers cannot see internal comments or tickets from others."""
    # Buyer creates ticket
    create_payload = {
        "title": "Internal Supplier Performance Review",
        "description": "Discussion about supplier delivery metrics and potential penalties.",
        "ticket_type": "VENDOR_ISSUE",
        "priority": "MEDIUM",
        "is_private": False,
    }
    create_resp = await client.post("/api/v1/tickets", json=create_payload, headers=auth_headers)
    assert create_resp.status_code == 201
    ticket_id = create_resp.json()["data"]["id"]

    # Supplier attempts to view buyer-raised ticket -> Forbidden
    supp_resp = await client.get(f"/api/v1/tickets/{ticket_id}", headers=supplier_auth_headers)
    assert supp_resp.status_code == 403

    # Now supplier raises their own ticket
    supp_create_payload = {
        "title": "Supplier Query on PO Payment Status",
        "description": "Inquiry regarding scheduled payment date for processed invoice.",
        "ticket_type": "QUERY",
        "priority": "HIGH",
    }
    supp_create_resp = await client.post(
        "/api/v1/tickets", json=supp_create_payload, headers=supplier_auth_headers
    )
    assert supp_create_resp.status_code == 201
    supp_ticket_id = supp_create_resp.json()["data"]["id"]

    # Buyer adds an internal note and a public note
    await client.post(
        f"/api/v1/tickets/{supp_ticket_id}/comments",
        json={"content": "Confidential margin analysis note.", "is_internal": True},
        headers=auth_headers,
    )
    await client.post(
        f"/api/v1/tickets/{supp_ticket_id}/comments",
        json={"content": "Public response: Payment is scheduled for Friday.", "is_internal": False},
        headers=auth_headers,
    )

    # Supplier lists comments -> should NOT see the internal note
    supp_comments_resp = await client.get(
        f"/api/v1/tickets/{supp_ticket_id}/comments", headers=supplier_auth_headers
    )
    assert supp_comments_resp.status_code == 200
    comments = supp_comments_resp.json()["data"]
    assert any("Public response" in c["content"] for c in comments)
    assert not any("Confidential margin analysis" in c["content"] for c in comments)

    # Supplier attempts to add internal note -> Forbidden
    supp_add_internal = await client.post(
        f"/api/v1/tickets/{supp_ticket_id}/comments",
        json={"content": "Supplier trying to hide note", "is_internal": True},
        headers=supplier_auth_headers,
    )
    assert supp_add_internal.status_code == 403


@pytest.mark.security
@pytest.mark.asyncio
async def test_sla_config_requires_admin(client: AsyncClient, requestor_headers: dict[str, str]):
    """Verify non-admin cannot access SLA configuration endpoints."""
    resp = await client.get("/api/v1/tickets/sla-config", headers=requestor_headers)
    assert resp.status_code == 403


@pytest.mark.security
@pytest.mark.asyncio
async def test_export_requires_permission(client: AsyncClient, requestor_headers: dict[str, str]):
    """Verify user without ticket.export permission gets 403 on export."""
    resp = await client.get("/api/v1/tickets/export", headers=requestor_headers)
    assert resp.status_code == 403
