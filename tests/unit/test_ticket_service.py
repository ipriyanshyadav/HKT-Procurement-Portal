from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.core.exceptions import AppException, ForbiddenError
from app.modules.ticket.models import Ticket, TicketComment
from app.modules.ticket.service import TicketService


@pytest.fixture
def mock_deps():
    repo = AsyncMock()
    sla = AsyncMock()
    search = AsyncMock()
    mentions = AsyncMock()
    svc = TicketService(repo=repo, sla_svc=sla, search_svc=search, mention_parser=mentions)
    svc.publisher = AsyncMock()
    svc.audit = AsyncMock()
    return svc, repo, sla, mentions


@pytest.mark.asyncio
async def test_generate_ticket_number(mock_deps):
    """Verify sequence generation matches TKT-{org_code}-{year}-{number:06d}."""
    svc, repo, _, _ = mock_deps
    mock_db = AsyncMock()
    org_id = uuid4()

    # Mock org lookup via db.get
    mock_org = MagicMock()
    mock_org.name = "HKT Procurement"
    mock_db.get.return_value = mock_org

    # Mock sequence execution
    mock_seq_res = MagicMock()
    mock_seq_res.scalar.return_value = 42
    mock_seq_res.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_seq_res

    current_year = datetime.now(UTC).year
    ticket_num = await svc._generate_number(mock_db, org_id)

    assert ticket_num == f"TKT-HKT-{current_year}-000042"


@pytest.mark.asyncio
async def test_update_comment_within_15_minutes(mock_deps):
    """Updating comment within 15 minutes succeeds."""
    svc, repo, _, _ = mock_deps
    mock_db = AsyncMock()
    actor_id = uuid4()
    org_id = uuid4()
    ticket_id = uuid4()
    comment_id = uuid4()

    now = datetime.now(UTC)
    comment = TicketComment(
        id=comment_id,
        ticket_id=ticket_id,
        org_id=org_id,
        author_id=actor_id,
        content="Original message",
        is_internal=False,
        created_at=now - timedelta(minutes=5),
    )
    repo.get_comment.return_value = comment

    updated = await svc.edit_comment(
        mock_db,
        comment_id=comment_id,
        content="Updated message within 15m",
        actor_id=actor_id,
        org_id=org_id,
    )
    assert updated.content == "Updated message within 15m"


@pytest.mark.asyncio
async def test_update_comment_after_15_minutes_fails(mock_deps):
    """Updating comment after 15 minutes raises AppException(EDIT_WINDOW_CLOSED)."""
    svc, repo, _, _ = mock_deps
    mock_db = AsyncMock()
    actor_id = uuid4()
    org_id = uuid4()
    ticket_id = uuid4()
    comment_id = uuid4()

    now = datetime.now(UTC)
    comment = TicketComment(
        id=comment_id,
        ticket_id=ticket_id,
        org_id=org_id,
        author_id=actor_id,
        content="Original message",
        is_internal=False,
        created_at=now - timedelta(minutes=20),
    )
    repo.get_comment.return_value = comment

    with pytest.raises(AppException) as exc_info:
        await svc.edit_comment(
            mock_db,
            comment_id=comment_id,
            content="Attempted late edit",
            actor_id=actor_id,
            org_id=org_id,
        )
    assert exc_info.value.code == "EDIT_WINDOW_CLOSED"
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_update_comment_different_author_fails(mock_deps):
    """Only the comment author may edit their comment."""
    svc, repo, _, _ = mock_deps
    mock_db = AsyncMock()
    actor_id = uuid4()
    other_user_id = uuid4()
    org_id = uuid4()
    ticket_id = uuid4()
    comment_id = uuid4()

    now = datetime.now(UTC)
    comment = TicketComment(
        id=comment_id,
        ticket_id=ticket_id,
        org_id=org_id,
        author_id=other_user_id,
        content="Other user message",
        is_internal=False,
        created_at=now - timedelta(minutes=2),
    )
    repo.get_comment.return_value = comment

    with pytest.raises(ForbiddenError):
        await svc.edit_comment(
            mock_db,
            comment_id=comment_id,
            content="Unauthorized edit",
            actor_id=actor_id,
            org_id=org_id,
        )


@pytest.mark.asyncio
async def test_supplier_cannot_create_internal_comment(mock_deps):
    """Suppliers cannot set is_internal=True when adding comments."""
    svc, repo, _, mentions = mock_deps
    mock_db = AsyncMock()
    actor_id = uuid4()
    org_id = uuid4()
    ticket_id = uuid4()

    with pytest.raises(ForbiddenError) as exc_info:
        await svc.add_comment(
            mock_db,
            ticket_id=ticket_id,
            content="Attempted internal note",
            is_internal=True,
            actor_id=actor_id,
            org_id=org_id,
            is_supplier=True,
        )
    assert exc_info.value.code == "SUPPLIER_CANNOT_ADD_INTERNAL"


@pytest.mark.asyncio
async def test_reopen_window_enforcement(mock_deps):
    """Tickets closed more than 30 days ago cannot be reopened by non-admin."""
    svc, repo, _, _ = mock_deps
    mock_db = AsyncMock()
    actor_id = uuid4()
    org_id = uuid4()
    ticket_id = uuid4()

    now = datetime.now(UTC)
    ticket = Ticket(
        id=ticket_id,
        org_id=org_id,
        ticket_number="TKT-HKT-2026-000001",
        title="Closed Ticket",
        description="Ticket closed for more than 30 days",
        ticket_type="QUERY",
        priority="MEDIUM",
        status="CLOSED",
        raised_by=actor_id,
        updated_at=now - timedelta(days=35),
    )
    repo.get.return_value = ticket
    mock_db.execute.return_value = MagicMock(scalars=lambda: MagicMock(all=list))

    with pytest.raises(AppException) as exc_info:
        await svc.reopen(
            mock_db,
            ticket_id=ticket_id,
            reason="Want to reopen old closed ticket",
            actor_id=actor_id,
            org_id=org_id,
            is_supplier=False,
        )
    assert exc_info.value.code == "REOPEN_WINDOW_EXPIRED"
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_get_detail_private_ticket_access_check(mock_deps):
    """Private tickets can only be accessed by creator, assignee, or admin."""
    svc, repo, _, _ = mock_deps
    mock_db = AsyncMock()
    actor_id = uuid4()
    other_user_id = uuid4()
    org_id = uuid4()
    ticket_id = uuid4()

    ticket = Ticket(
        id=ticket_id,
        org_id=org_id,
        ticket_number="TKT-HKT-2026-000002",
        title="Private Issue",
        description="Confidential HR grievance",
        ticket_type="BUG",
        priority="HIGH",
        status="OPEN",
        raised_by=other_user_id,
        assigned_to=None,
        is_private=True,
    )
    repo.get.return_value = ticket

    # Mock _is_admin to return False
    mock_role_res = MagicMock()
    mock_role_res.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_role_res

    # Unauthorized user
    with pytest.raises(ForbiddenError):
        await svc.get_detail(mock_db, ticket_id=ticket_id, actor_id=actor_id, org_id=org_id, is_supplier=False)

    # Creator access allowed
    result = await svc.get_detail(
        mock_db, ticket_id=ticket_id, actor_id=other_user_id, org_id=org_id, is_supplier=False
    )
    assert result.id == ticket_id


@pytest.mark.asyncio
async def test_get_detail_supplier_access_check(mock_deps):
    """Suppliers cannot view tickets raised by other users."""
    svc, repo, _, _ = mock_deps
    mock_db = AsyncMock()
    actor_id = uuid4()
    other_user_id = uuid4()
    org_id = uuid4()
    ticket_id = uuid4()

    ticket = Ticket(
        id=ticket_id,
        org_id=org_id,
        ticket_number="TKT-HKT-2026-000003",
        title="Other Supplier Query",
        description="Ticket query from another supplier",
        ticket_type="QUERY",
        priority="MEDIUM",
        status="OPEN",
        raised_by=other_user_id,
        is_private=False,
    )
    repo.get.return_value = ticket

    with pytest.raises(ForbiddenError):
        await svc.get_detail(mock_db, ticket_id=ticket_id, actor_id=actor_id, org_id=org_id, is_supplier=True)
