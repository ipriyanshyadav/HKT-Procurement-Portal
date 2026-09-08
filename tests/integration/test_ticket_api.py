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
async def admin_ticket_user(db: AsyncSession, org, factory):
    """Admin user with PROCUREMENT_ADMIN role for full ticket permissions."""
    return await factory.user.create(db, org_id=org.id, role="PROCUREMENT_ADMIN")


@pytest.fixture
async def admin_ticket_headers(db: AsyncSession, admin_ticket_user):
    """Bearer authorization headers for admin_ticket_user."""
    jti = str(uuid4())
    token = create_access_token(
        user_id=admin_ticket_user.id,
        org_id=admin_ticket_user.org_id,
        email=admin_ticket_user.email,
        roles=["PROCUREMENT_ADMIN"],
        bu_scope=[],
        category_scope=[],
        plant_scope=[],
        is_supplier_user=False,
        vendor_id=None,
        jti=jti,
        portal="admin",
    )
    user_session = UserSession(
        id=uuid4(),
        org_id=admin_ticket_user.org_id,
        user_id=admin_ticket_user.id,
        token_jti=jti,
        expires_at=datetime.now(UTC) + timedelta(hours=8),
        is_revoked=False,
    )
    db.add(user_session)
    await db.flush()
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_ticket_success(client: AsyncClient, auth_headers: dict[str, str]):
    """Verify creating a ticket returns 201 with standard ticket number format."""
    payload = {
        "title": "Vendor invoice tax mismatch",
        "description": "Tax calculation in invoice does not match the purchase order specification.",
        "ticket_type": "DISCREPANCY",
        "priority": "HIGH",
        "tags": ["tax", "invoice"],
        "is_private": False,
    }
    response = await client.post("/api/v1/tickets", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["ticket_number"].startswith("TKT-")
    assert data["title"] == payload["title"]
    assert data["status"] == "OPEN"
    assert data["priority"] == "HIGH"
    assert data["ticket_type"] == "DISCREPANCY"


@pytest.mark.asyncio
async def test_create_ticket_validation_error(client: AsyncClient, auth_headers: dict[str, str]):
    """Verify description under 20 chars triggers 422 Unprocessable Entity."""
    payload = {
        "title": "Short issue",
        "description": "Too short",
        "ticket_type": "BUG",
        "priority": "LOW",
    }
    response = await client.post("/api/v1/tickets", json=payload, headers=auth_headers)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_ticket_detail(client: AsyncClient, auth_headers: dict[str, str]):
    """Verify retrieving ticket details returns all associated subcollections."""
    create_payload = {
        "title": "Detailed Ticket Test Case",
        "description": "Detailed description demonstrating full subcollection loading.",
        "ticket_type": "SUPPORT",
        "priority": "MEDIUM",
    }
    create_resp = await client.post("/api/v1/tickets", json=create_payload, headers=auth_headers)
    ticket_id = create_resp.json()["data"]["id"]

    response = await client.get(f"/api/v1/tickets/{ticket_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["id"] == ticket_id
    assert "comments" in data
    assert "watchers" in data
    assert "activity_logs" in data
    assert "attachments" in data


@pytest.mark.asyncio
async def test_list_tickets_with_filters(client: AsyncClient, auth_headers: dict[str, str]):
    """Verify listing tickets with status and priority filtering."""
    create_payload = {
        "title": "Filterable Ticket Test Item",
        "description": "Description ensuring filterable ticket is indexed properly.",
        "ticket_type": "QUERY",
        "priority": "CRITICAL",
    }
    await client.post("/api/v1/tickets", json=create_payload, headers=auth_headers)

    response = await client.get("/api/v1/tickets?status=OPEN&priority=CRITICAL", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert isinstance(data, list)
    assert any(t["priority"] == "CRITICAL" for t in data)


@pytest.mark.asyncio
async def test_update_ticket(client: AsyncClient, auth_headers: dict[str, str]):
    """Verify updating ticket fields via PUT /api/v1/tickets/{id}."""
    create_payload = {
        "title": "Initial Ticket Subject",
        "description": "Initial ticket description with at least 20 characters.",
        "ticket_type": "SUPPORT",
        "priority": "LOW",
    }
    create_resp = await client.post("/api/v1/tickets", json=create_payload, headers=auth_headers)
    ticket_id = create_resp.json()["data"]["id"]

    update_payload = {
        "title": "Revised Ticket Subject After Investigation",
        "priority": "MEDIUM",
    }
    response = await client.put(f"/api/v1/tickets/{ticket_id}", json=update_payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["title"] == "Revised Ticket Subject After Investigation"
    assert data["priority"] == "MEDIUM"


@pytest.mark.asyncio
async def test_ticket_lifecycle_transitions(
    client: AsyncClient, admin_ticket_headers: dict[str, str]
):
    """Verify end-to-end status transitions:
    OPEN -> IN_PROGRESS -> PENDING -> IN_PROGRESS -> ESCALATED -> RESOLVED -> CLOSED -> REOPENED.
    """
    create_payload = {
        "title": "Full Lifecycle Ticket Test",
        "description": "Validating complete state transitions across the full FSM matrix.",
        "ticket_type": "VENDOR_ISSUE",
        "priority": "HIGH",
    }
    res = await client.post("/api/v1/tickets", json=create_payload, headers=admin_ticket_headers)
    ticket_id = res.json()["data"]["id"]

    # 1. Start progress
    res = await client.post(f"/api/v1/tickets/{ticket_id}/start-progress", headers=admin_ticket_headers)
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "IN_PROGRESS"

    # 2. Pend response
    res = await client.post(f"/api/v1/tickets/{ticket_id}/pending-response", headers=admin_ticket_headers)
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "PENDING_RESPONSE"

    # 3. Resume progress
    res = await client.post(f"/api/v1/tickets/{ticket_id}/start-progress", headers=admin_ticket_headers)
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "IN_PROGRESS"

    # 4. Escalate
    res = await client.post(
        f"/api/v1/tickets/{ticket_id}/escalate",
        json={"reason": "Resolution delayed beyond critical threshold"},
        headers=admin_ticket_headers,
    )
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "ESCALATED"

    # 5. Resolve
    res = await client.post(
        f"/api/v1/tickets/{ticket_id}/resolve",
        json={"resolution_note": "Root cause identified and corrective action implemented"},
        headers=admin_ticket_headers,
    )
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "RESOLVED"

    # 6. Close
    res = await client.post(f"/api/v1/tickets/{ticket_id}/close", headers=admin_ticket_headers)
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "CLOSED"

    # 7. Reopen
    res = await client.post(
        f"/api/v1/tickets/{ticket_id}/reopen",
        json={"reason": "Issue re-occurred in production environment"},
        headers=admin_ticket_headers,
    )
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "REOPENED"


@pytest.mark.asyncio
async def test_comment_lifecycle(client: AsyncClient, auth_headers: dict[str, str]):
    """Verify adding, listing, editing, and deleting comments."""
    create_payload = {
        "title": "Comment Lifecycle Ticket",
        "description": "Ticket created to test comment threads and 15-minute edit window.",
        "ticket_type": "QUERY",
        "priority": "MEDIUM",
    }
    res = await client.post("/api/v1/tickets", json=create_payload, headers=auth_headers)
    ticket_id = res.json()["data"]["id"]

    # Add comment
    add_resp = await client.post(
        f"/api/v1/tickets/{ticket_id}/comments",
        json={"content": "Here is an initial observation note."},
        headers=auth_headers,
    )
    assert add_resp.status_code == 201
    comment_id = add_resp.json()["data"]["id"]

    # List comments
    list_resp = await client.get(f"/api/v1/tickets/{ticket_id}/comments", headers=auth_headers)
    assert list_resp.status_code == 200
    assert any(c["id"] == comment_id for c in list_resp.json()["data"])

    # Edit comment
    edit_resp = await client.put(
        f"/api/v1/tickets/{ticket_id}/comments/{comment_id}",
        json={"content": "Edited comment with updated observations."},
        headers=auth_headers,
    )
    assert edit_resp.status_code == 200
    assert edit_resp.json()["data"]["content"] == "Edited comment with updated observations."

    # Delete comment
    del_resp = await client.delete(
        f"/api/v1/tickets/{ticket_id}/comments/{comment_id}", headers=auth_headers
    )
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_watcher_lifecycle(
    client: AsyncClient, auth_headers: dict[str, str], buyer_user
):
    """Verify adding, listing, and removing ticket watchers."""
    create_payload = {
        "title": "Watcher Lifecycle Ticket",
        "description": "Testing watcher subscription and removal behavior.",
        "ticket_type": "SUPPORT",
        "priority": "LOW",
    }
    res = await client.post("/api/v1/tickets", json=create_payload, headers=auth_headers)
    ticket_id = res.json()["data"]["id"]

    # Add watcher
    add_resp = await client.post(
        f"/api/v1/tickets/{ticket_id}/watchers",
        json={"user_id": str(buyer_user.id)},
        headers=auth_headers,
    )
    assert add_resp.status_code == 201

    # List watchers
    list_resp = await client.get(f"/api/v1/tickets/{ticket_id}/watchers", headers=auth_headers)
    assert list_resp.status_code == 200
    assert any(w["user_id"] == str(buyer_user.id) for w in list_resp.json()["data"])

    # Remove watcher
    del_resp = await client.delete(
        f"/api/v1/tickets/{ticket_id}/watchers/{buyer_user.id}", headers=auth_headers
    )
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_activity_log(client: AsyncClient, auth_headers: dict[str, str]):
    """Verify activity audit log records creation event."""
    create_payload = {
        "title": "Audit Trail Verification Ticket",
        "description": "Verifying that creation and transition actions produce immutable audit rows.",
        "ticket_type": "AUDIT_QUERY",
        "priority": "HIGH",
    }
    res = await client.post("/api/v1/tickets", json=create_payload, headers=auth_headers)
    ticket_id = res.json()["data"]["id"]

    act_resp = await client.get(f"/api/v1/tickets/{ticket_id}/activity", headers=auth_headers)
    assert act_resp.status_code == 200
    logs = act_resp.json()["data"]
    assert len(logs) >= 1
    assert any(log["activity_type"] == "TICKET_CREATED" for log in logs)


@pytest.mark.asyncio
async def test_sla_config_admin(client: AsyncClient, admin_ticket_headers: dict[str, str]):
    """Verify retrieving and updating SLA configs as admin."""
    # Get current configs
    get_resp = await client.get("/api/v1/tickets/sla-config", headers=admin_ticket_headers)
    assert get_resp.status_code == 200
    configs = get_resp.json()["data"]
    assert isinstance(configs, list)

    # Update SLA config
    update_payload = [
        {
            "priority": "CRITICAL",
            "first_response_hours": 1,
            "resolution_hours": 6,
            "escalation_hours": 3,
            "escalate_to_role": "PROCUREMENT_ADMIN",
        }
    ]
    put_resp = await client.put(
        "/api/v1/tickets/sla-config", json=update_payload, headers=admin_ticket_headers
    )
    assert put_resp.status_code == 200


@pytest.mark.asyncio
async def test_dashboard_metrics(client: AsyncClient, admin_ticket_headers: dict[str, str]):
    """Verify dashboard metrics endpoint returns aggregated KPIs."""
    resp = await client.get("/api/v1/tickets/dashboard", headers=admin_ticket_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "total_tickets" in data
    assert "open_tickets" in data
    assert "sla_compliance_pct" in data


@pytest.mark.asyncio
async def test_export_csv(client: AsyncClient, admin_ticket_headers: dict[str, str]):
    """Verify CSV export endpoint streams tickets data."""
    resp = await client.get("/api/v1/tickets/export", headers=admin_ticket_headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers.get("content-type", "")
    content = resp.text
    assert "number" in content
    assert "title" in content
