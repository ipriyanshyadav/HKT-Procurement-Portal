from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.modules.ticket.models import Ticket
from app.modules.ticket.repository import ticket_repository
from app.modules.ticket.schemas import TicketCreateRequest, TicketFilters
from app.modules.ticket.search_service import TicketSearchService
from app.modules.ticket.service import ticket_service

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_search_service_sql_fallback(db: AsyncSession, org, buyer_user):
    """Verify SQL fallback search works across title, ticket_number, and description."""
    search_svc = TicketSearchService(enabled=False)

    ticket = Ticket(
        org_id=org.id,
        ticket_number=f"TKT-SEARCH-{uuid4().hex[:6]}",
        title="Unique searchable keyword XYZ123",
        description="This ticket contains a specific search term inside the body description.",
        ticket_type="BUG",
        priority="HIGH",
        status="OPEN",
        raised_by=buyer_user.id,
        is_private=False,
    )
    db.add(ticket)
    await db.commit()

    # Search by keyword
    results = await search_svc.search(org.id, "XYZ123", {}, actor_id=buyer_user.id, is_admin=False, db=db)
    assert len(results) >= 1
    assert any(r["ticket_id"] == str(ticket.id) for r in results)

    # Search by status filter
    results_filtered = await search_svc.search(
        org.id, "XYZ123", {"status": "OPEN", "priority": "HIGH"}, actor_id=buyer_user.id, is_admin=False, db=db
    )
    assert len(results_filtered) >= 1

    # Search with non-matching filter
    results_empty = await search_svc.search(
        org.id, "XYZ123", {"status": "CLOSED"}, actor_id=buyer_user.id, is_admin=False, db=db
    )
    assert len(results_empty) == 0


@pytest.mark.asyncio
async def test_search_service_mock_es():
    """Verify ES indexing and search branches when ES client is active."""
    search_svc = TicketSearchService(enabled=True)
    mock_es = AsyncMock()
    mock_es.index.return_value = {"result": "created"}
    mock_es.search.return_value = {
        "hits": {
            "total": {"value": 1},
            "hits": [
                {
                    "_id": str(uuid4()),
                    "_source": {
                        "ticket_id": str(uuid4()),
                        "org_id": str(uuid4()),
                        "ticket_number": "TKT-HKT-2026-000001",
                        "title": "Mock Title",
                        "description": "Mock Description",
                        "ticket_type": "BUG",
                        "priority": "HIGH",
                        "status": "OPEN",
                    },
                    "highlight": {"title": ["Mock <em>Title</em>"]},
                }
            ],
        }
    }
    search_svc._es = mock_es

    # Test indexing
    mock_ticket = MagicMock()
    mock_ticket.id = uuid4()
    mock_ticket.org_id = uuid4()
    mock_ticket.ticket_number = "TKT-HKT-2026-000001"
    mock_ticket.title = "Mock Title"
    mock_ticket.description = "Mock Description"
    mock_ticket.ticket_type = "BUG"
    mock_ticket.priority = "HIGH"
    mock_ticket.status = "OPEN"
    mock_ticket.category = "Billing"
    mock_ticket.entity_type = None
    mock_ticket.entity_id = None
    mock_ticket.entity_number = None
    mock_ticket.tags = ["tag1"]
    mock_ticket.is_private = False
    mock_ticket.raised_by = uuid4()
    mock_ticket.assigned_to = None
    mock_ticket.created_at = datetime.now(UTC)
    mock_ticket.updated_at = datetime.now(UTC)

    await search_svc.index_ticket(mock_ticket)
    mock_es.index.assert_called_once()

    # Test searching with ES
    res = await search_svc.search(mock_ticket.org_id, "Mock", {"status": "OPEN", "priority": "HIGH"})
    assert len(res) == 1
    assert res[0]["ticket_number"] == "TKT-HKT-2026-000001"


@pytest.mark.asyncio
async def test_repository_queries(db: AsyncSession, org, buyer_user):
    """Verify ticket repository query methods."""
    ticket_num = f"TKT-TEST-{uuid4().hex[:6]}"
    now = datetime.now(UTC)

    ticket = Ticket(
        org_id=org.id,
        ticket_number=ticket_num,
        title="Repository Test Ticket",
        description="Testing specialized repository query methods.",
        ticket_type="QUERY",
        priority="CRITICAL",
        status="OPEN",
        raised_by=buyer_user.id,
        sla_breach_at=now + timedelta(hours=4),
        is_private=False,
    )
    db.add(ticket)
    await db.commit()

    # 1. get_by_number
    found = await ticket_repository.get_by_number(db, ticket_num, org.id)
    assert found is not None
    assert found.id == ticket.id

    # 2. get_active_with_sla
    active_sla = await ticket_repository.get_active_with_sla(db)
    assert any(t.id == ticket.id for t in active_sla)

    # 3. get_stale_resolved (none should match since status is OPEN)
    stale = await ticket_repository.get_stale_resolved(db, now + timedelta(days=1))
    assert not any(t.id == ticket.id for t in stale)

    # 4. get_stale_pending_response
    stale_pending = await ticket_repository.get_stale_pending_response(db, now + timedelta(days=1))
    assert not any(t.id == ticket.id for t in stale_pending)


@pytest.mark.asyncio
async def test_ticket_service_assign_and_filters(db: AsyncSession, org, buyer_user, admin_user):
    """Verify assigning ticket and filtering by view scopes."""
    data = TicketCreateRequest(
        title="Assignment and Scope Test Ticket",
        description="Testing ticket assignment to admin user and retrieval via scope filters.",
        ticket_type="SUPPORT",
        priority="MEDIUM",
        entity_type="PURCHASE_ORDER",
        entity_id=uuid4(),
        entity_number="PO-2026-9999",
        tags=["procurement", "hardware"],
    )
    created = await ticket_service.create(db, data, buyer_user.id, org.id, portal="buyer")
    await db.commit()

    # Assign ticket
    assigned = await ticket_service.assign(
        db, created.id, user_id=admin_user.id, team="Platform Ops", actor_id=buyer_user.id, org_id=org.id
    )
    assert assigned.assigned_to == admin_user.id
    assert assigned.assigned_team == "Platform Ops"

    # Filter by my_tickets
    my_tickets, count1 = await ticket_service.get_list(
        db, TicketFilters(view_scope="my_tickets"), buyer_user.id, org.id, is_supplier=False
    )
    assert any(t.id == created.id for t in my_tickets)

    # Filter by assigned_to_me
    assigned_tickets, count2 = await ticket_service.get_list(
        db, TicketFilters(view_scope="assigned_to_me"), admin_user.id, org.id, is_supplier=False
    )
    assert any(t.id == created.id for t in assigned_tickets)

    # Filter by entity
    entity_tickets, count3 = await ticket_service.get_list(
        db,
        TicketFilters(entity_type="PURCHASE_ORDER", entity_id=data.entity_id),
        buyer_user.id,
        org.id,
        is_supplier=False,
    )
    assert any(t.id == created.id for t in entity_tickets)

    # Soft delete
    await ticket_service.soft_delete(db, created.id, buyer_user.id, org.id)
    await db.commit()
