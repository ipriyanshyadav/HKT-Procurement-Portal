"""Unit tests for SupportService (SPEC_29)."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, timezone

from app.core.exceptions import NotFoundError
from app.modules.support.service import support_service
from app.modules.support.models import SupportTicket, SupportTicketMessage
from app.modules.support.schemas import (
    SupportTicketCreateRequest,
    SupportTicketMessageCreateRequest,
    SupportTicketUpdateRequest,
    SupportTicketCSATRequest,
)
from app.modules.user.models import User


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.fixture
def mock_customer():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = "customer@acme.com"
    user.org_id = uuid4()
    return user


@pytest.fixture
def mock_agent():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = "agent@support.procureos.com"
    user.org_id = uuid4()
    return user


@pytest.mark.asyncio
async def test_create_ticket_success(mock_db, mock_customer):
    payload = SupportTicketCreateRequest(
        subject="Invoice discrepancy on PO-10023",
        description="Line 2 unit price does not match contract rate card.",
        priority="HIGH",
        category="INVOICING",
    )

    with patch("app.modules.audit.service.audit_service.log", new_callable=AsyncMock) as mock_audit:
        ticket = await support_service.create_ticket(mock_db, mock_customer.org_id, mock_customer, payload)
        assert ticket.subject == payload.subject
        assert ticket.customer_email == mock_customer.email
        assert ticket.status == "OPEN"
        assert ticket.ticket_number.startswith("SUP-")
        assert mock_db.add.call_count == 2  # ticket + initial message
        assert mock_db.flush.call_count == 2
        mock_audit.assert_called_once()


@pytest.mark.asyncio
async def test_get_ticket_not_found(mock_db):
    org_id = uuid4()
    ticket_id = uuid4()

    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_res

    with pytest.raises(NotFoundError):
        await support_service.get_ticket(mock_db, org_id, ticket_id)


@pytest.mark.asyncio
async def test_add_message_by_agent_updates_first_response(mock_db, mock_customer, mock_agent):
    ticket = SupportTicket(
        id=uuid4(),
        org_id=mock_customer.org_id,
        ticket_number="SUP-2026-ABC123",
        customer_id=mock_customer.id,
        customer_email=mock_customer.email,
        subject="Query",
        description="Help needed",
        status="OPEN",
        first_response_at=None,
    )

    with patch.object(support_service, "get_ticket", new_callable=AsyncMock) as mock_get, \
         patch("app.modules.audit.service.audit_service.log", new_callable=AsyncMock):
        mock_get.return_value = ticket

        msg_payload = SupportTicketMessageCreateRequest(
            message_text="We have reviewed the line item and escalated to buyer.",
            is_internal_note=False,
        )

        msg = await support_service.add_message(mock_db, mock_customer.org_id, mock_agent, ticket.id, msg_payload)
        assert msg.sender_type == "AGENT"
        assert ticket.first_response_at is not None
        assert ticket.status == "IN_PROGRESS"


@pytest.mark.asyncio
async def test_update_ticket_status_resolved(mock_db, mock_customer, mock_agent):
    ticket = SupportTicket(
        id=uuid4(),
        org_id=mock_customer.org_id,
        ticket_number="SUP-2026-ABC123",
        customer_id=mock_customer.id,
        customer_email=mock_customer.email,
        subject="Query",
        description="Help needed",
        status="IN_PROGRESS",
    )

    with patch.object(support_service, "get_ticket", new_callable=AsyncMock) as mock_get, \
         patch("app.modules.audit.service.audit_service.log", new_callable=AsyncMock):
        mock_get.return_value = ticket

        payload = SupportTicketUpdateRequest(status="RESOLVED", priority="LOW")
        updated = await support_service.update_ticket(mock_db, mock_customer.org_id, mock_agent, ticket.id, payload)
        assert updated.status == "RESOLVED"
        assert updated.resolved_at is not None
        assert updated.priority == "LOW"


@pytest.mark.asyncio
async def test_submit_csat(mock_db, mock_customer):
    ticket = SupportTicket(
        id=uuid4(),
        org_id=mock_customer.org_id,
        ticket_number="SUP-2026-ABC123",
        customer_id=mock_customer.id,
        customer_email=mock_customer.email,
        subject="Query",
        description="Help needed",
        status="RESOLVED",
    )

    with patch.object(support_service, "get_ticket", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = ticket
        payload = SupportTicketCSATRequest(rating=5, comment="Resolved in minutes. Great service!")
        res = await support_service.submit_csat(mock_db, mock_customer.org_id, ticket.id, payload)
        assert res.csat_rating == 5
        assert res.csat_comment == "Resolved in minutes. Great service!"


@pytest.mark.asyncio
async def test_get_metrics(mock_db):
    org_id = uuid4()

    open_res = MagicMock()
    open_res.scalar.return_value = 8

    resolved_res = MagicMock()
    resolved_res.scalar.return_value = 14

    csat_res = MagicMock()
    csat_res.scalar.return_value = 4.9

    mock_db.execute.side_effect = [open_res, resolved_res, csat_res]

    metrics = await support_service.get_metrics(mock_db, org_id)
    assert metrics.open_tickets_count == 8
    assert metrics.resolved_today_count == 14
    assert metrics.csat_average == 4.9


@pytest.mark.asyncio
async def test_list_kb_articles(mock_db):
    mock_res = MagicMock()
    mock_res.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_res

    articles = await support_service.list_kb_articles(mock_db)
    assert len(articles) >= 3
    slugs = [a.slug for a in articles]
    assert "how-to-submit-indent" in slugs
    assert "consignee-crac-verification" in slugs
