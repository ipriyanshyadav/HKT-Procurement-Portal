from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.core.exceptions import ValidationError
from app.modules.ticket.automation_engine import TicketAutomationEngine
from app.modules.ticket.models import (
    Ticket,
    TicketAutomationRule,
    TicketCustomFieldDef,
    TicketCustomFieldValue,
    TicketLink,
)
from app.modules.ticket.schemas import (
    AutomationRuleCreateRequest,
    AutomationRuleUpdateRequest,
    CustomFieldDefCreateRequest,
    CustomFieldDefUpdateRequest,
    CustomFieldValueItem,
    TicketCreateRequest,
    TicketFilters,
    TicketUpdateRequest,
)
from app.modules.ticket.service import TicketService


@pytest.fixture
def mock_db():
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def mock_repo():
    repo = AsyncMock()
    return repo


@pytest.fixture
def mock_redis():
    client = AsyncMock()
    client.incr = AsyncMock(return_value=1)
    client.publish = AsyncMock()
    return client


@pytest.fixture
def ticket_service(mock_repo):
    svc = TicketService(repo=mock_repo)
    svc.publisher = AsyncMock()
    svc.audit = AsyncMock()
    svc.search_service = AsyncMock()
    svc.sla = AsyncMock()
    svc.sla.compute_breach_at = AsyncMock(return_value=datetime.now(timezone.utc) + timedelta(hours=24))
    svc.automation = AsyncMock()
    svc._generate_number = AsyncMock(return_value="TKT-HKT-2026-000101")
    return svc


# --- 1. Due Date Tests ---
@pytest.mark.asyncio
async def test_ticket_creation_with_due_date(mock_db, ticket_service):
    org_id = uuid4()
    actor_id = uuid4()
    target_due = date.today() + timedelta(days=7)

    req = TicketCreateRequest(
        title="Procurement ERP Integration Issue",
        description="Detailed description for the integration bug exceeding 20 characters.",
        ticket_type="BUG",
        priority="HIGH",
        due_date=target_due,
    )

    ticket = await ticket_service.create(mock_db, req, actor_id, org_id)

    assert ticket.due_date == target_due
    assert ticket.ticket_number == "TKT-HKT-2026-000101"
    assert ticket.priority == "HIGH"
    mock_db.add.assert_called()


@pytest.mark.asyncio
async def test_ticket_update_due_date(mock_db, ticket_service, mock_repo):
    org_id = uuid4()
    actor_id = uuid4()
    ticket_id = uuid4()
    initial_due = date.today() + timedelta(days=3)
    new_due = date.today() + timedelta(days=10)

    existing_ticket = Ticket(
        id=ticket_id,
        org_id=org_id,
        ticket_number="TKT-HKT-2026-000102",
        title="Existing ticket title",
        description="Detailed existing ticket description",
        ticket_type="QUERY",
        priority="MEDIUM",
        status="OPEN",
        raised_by=actor_id,
        due_date=initial_due,
    )
    mock_repo.get.return_value = existing_ticket

    update_req = TicketUpdateRequest(due_date=new_due)
    updated = await ticket_service.update(mock_db, ticket_id, update_req, actor_id, org_id)

    assert updated.due_date == new_due


# --- 2. Issue Linking Tests ---
@pytest.mark.asyncio
async def test_create_ticket_link_success(mock_db, ticket_service, mock_repo):
    org_id = uuid4()
    actor_id = uuid4()
    t1_id = uuid4()
    t2_id = uuid4()

    t1 = Ticket(id=t1_id, org_id=org_id, ticket_number="TKT-001", title="PR block", description="desc", ticket_type="BUG", raised_by=actor_id)
    t2 = Ticket(id=t2_id, org_id=org_id, ticket_number="TKT-002", title="PO error", description="desc", ticket_type="BUG", raised_by=actor_id)

    mock_repo.get = AsyncMock(side_effect=lambda db, tid, oid: t1 if tid == t1_id else t2)
    mock_exec_res = MagicMock()
    mock_exec_res.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_exec_res

    link = await ticket_service.create_link(mock_db, t1_id, t2_id, "BLOCKS", actor_id, org_id)

    assert link.source_ticket_id == t1_id
    assert link.target_ticket_id == t2_id
    assert link.link_type == "BLOCKS"
    assert link.created_by == actor_id
    mock_db.add.assert_called()


@pytest.mark.asyncio
async def test_create_ticket_link_self_fails(mock_db, ticket_service):
    org_id = uuid4()
    actor_id = uuid4()
    t1_id = uuid4()

    with pytest.raises(ValidationError) as exc:
        await ticket_service.create_link(mock_db, t1_id, t1_id, "BLOCKS", actor_id, org_id)
    assert exc.value.code == "SELF_LINK_NOT_ALLOWED"


@pytest.mark.asyncio
async def test_get_ticket_links_bidirectional(mock_db, ticket_service, mock_repo):
    org_id = uuid4()
    actor_id = uuid4()
    t1_id = uuid4()
    t2_id = uuid4()

    link = TicketLink(
        id=uuid4(),
        org_id=org_id,
        source_ticket_id=t2_id,
        target_ticket_id=t1_id,
        link_type="BLOCKS",
        created_by=actor_id,
        created_at=datetime.now(timezone.utc),
    )
    mock_repo.get_links.return_value = [link]
    t2 = Ticket(id=t2_id, org_id=org_id, ticket_number="TKT-002", title="Blocking Task", status="OPEN", priority="HIGH", description="d", ticket_type="BUG", raised_by=actor_id)
    mock_repo.get.return_value = t2
    mock_repo.get_by_ids.return_value = {t2_id: t2}

    # Query links from perspective of t1 (target of link)
    links = await ticket_service.get_ticket_links(mock_db, t1_id, org_id)
    assert len(links) == 1
    # Inverse of BLOCKS is IS_BLOCKED_BY
    assert links[0]["link_type"] == "IS_BLOCKED_BY"
    assert links[0]["target_ticket_number"] == "TKT-002"


# --- 3. Custom Fields Tests ---
@pytest.mark.asyncio
async def test_create_custom_field_def(mock_db, ticket_service, mock_repo):
    org_id = uuid4()
    actor_id = uuid4()
    mock_repo.get_custom_field_def_by_key.return_value = None

    req = CustomFieldDefCreateRequest(
        name="Procurement Cost Center",
        field_key="cost_center",
        field_type="SELECT",
        options=["IT", "OPS", "MARKETING"],
        is_required=True,
    )
    cf_def = await ticket_service.create_custom_field_def(mock_db, req, actor_id, org_id)

    assert cf_def.name == "Procurement Cost Center"
    assert cf_def.field_key == "cost_center"
    assert cf_def.field_type == "SELECT"
    assert cf_def.options == ["IT", "OPS", "MARKETING"]
    assert cf_def.is_required is True


@pytest.mark.asyncio
async def test_create_ticket_with_custom_fields(mock_db, ticket_service):
    org_id = uuid4()
    actor_id = uuid4()
    field_id = uuid4()

    req = TicketCreateRequest(
        title="Custom Fields Verification Ticket",
        description="Checking that custom field values persist properly on ticket creation.",
        ticket_type="QUERY",
        priority="LOW",
        custom_fields=[
            CustomFieldValueItem(field_def_id=field_id, value_text="OPS")
        ],
    )
    ticket = await ticket_service.create(mock_db, req, actor_id, org_id)
    assert ticket.ticket_number == "TKT-HKT-2026-000101"
    # Verify custom field value added
    added_objects = [call[0][0] for call in mock_db.add.call_args_list]
    cf_vals = [o for o in added_objects if isinstance(o, TicketCustomFieldValue)]
    assert len(cf_vals) == 1
    assert cf_vals[0].field_def_id == field_id
    assert cf_vals[0].value_text == "OPS"


# --- 4. Automation Engine Tests ---
@pytest.mark.asyncio
async def test_automation_engine_round_robin_assignment(mock_db, mock_redis):
    engine = TicketAutomationEngine()
    engine.redis = mock_redis
    org_id = uuid4()
    creator_id = uuid4()
    u1 = uuid4()
    u2 = uuid4()
    u3 = uuid4()

    ticket = Ticket(
        id=uuid4(),
        org_id=org_id,
        ticket_number="TKT-001",
        title="Test Bug",
        description="desc",
        ticket_type="BUG",
        priority="CRITICAL",
        status="OPEN",
        raised_by=creator_id,
    )

    rule = TicketAutomationRule(
        id=uuid4(),
        org_id=org_id,
        name="Auto assign critical bugs round-robin",
        is_enabled=True,
        trigger_type="TICKET_CREATED",
        trigger_config={},
        conditions=[{"field": "priority", "operator": "eq", "value": "CRITICAL"}],
        actions=[{"action": "ASSIGN_ROUND_ROBIN", "user_ids": [str(u1), str(u2), str(u3)]}],
        created_by=creator_id,
    )
    engine.repo = AsyncMock()
    engine.repo.get_automation_rules.return_value = [rule]

    # First call: mock_redis.incr returns 1 -> 1 % 3 = index 1 (u2)
    mock_redis.incr.return_value = 1
    results = await engine.trigger(mock_db, "TICKET_CREATED", ticket, org_id, {"priority": "CRITICAL"})

    assert len(results) == 1
    assert results[0]["rule_name"] == "Auto assign critical bugs round-robin"
    assert ticket.assigned_to == u2
    assert ticket.status == "IN_PROGRESS"


@pytest.mark.asyncio
async def test_automation_engine_balanced_workload_assignment(mock_db, mock_redis):
    engine = TicketAutomationEngine()
    engine.redis = mock_redis
    org_id = uuid4()
    creator_id = uuid4()
    u1 = uuid4()
    u2 = uuid4()

    ticket = Ticket(
        id=uuid4(),
        org_id=org_id,
        ticket_number="TKT-002",
        title="Test Query",
        description="desc",
        ticket_type="QUERY",
        priority="MEDIUM",
        status="OPEN",
        raised_by=creator_id,
    )

    rule = TicketAutomationRule(
        id=uuid4(),
        org_id=org_id,
        name="Balanced workload assignment",
        is_enabled=True,
        trigger_type="TICKET_CREATED",
        trigger_config={},
        conditions=[],
        actions=[{"action": "ASSIGN_BALANCED", "user_ids": [str(u1), str(u2)]}],
        created_by=creator_id,
    )
    engine.repo = AsyncMock()
    engine.repo.get_automation_rules.return_value = [rule]
    # User 1 has 5 active tickets, User 2 has 1 active ticket -> should pick u2
    engine.repo.count_open_tickets_by_users.return_value = {u1: 5, u2: 1}

    results = await engine.trigger(mock_db, "TICKET_CREATED", ticket, org_id, {})

    assert len(results) == 1
    assert ticket.assigned_to == u2


@pytest.mark.asyncio
async def test_automation_engine_condition_filtering(mock_db, mock_redis):
    engine = TicketAutomationEngine()
    engine.redis = mock_redis
    org_id = uuid4()
    creator_id = uuid4()

    ticket = Ticket(
        id=uuid4(),
        org_id=org_id,
        ticket_number="TKT-003",
        title="Low priority query",
        description="desc",
        ticket_type="QUERY",
        priority="LOW",
        status="OPEN",
        raised_by=creator_id,
    )

    rule = TicketAutomationRule(
        id=uuid4(),
        org_id=org_id,
        name="Critical only rule",
        is_enabled=True,
        trigger_type="TICKET_CREATED",
        trigger_config={},
        conditions=[{"field": "priority", "operator": "eq", "value": "CRITICAL"}],
        actions=[{"action": "CHANGE_PRIORITY", "priority": "HIGH"}],
        created_by=creator_id,
    )
    engine.repo = AsyncMock()
    engine.repo.get_automation_rules.return_value = [rule]

    # Should not trigger because priority is LOW not CRITICAL
    results = await engine.trigger(mock_db, "TICKET_CREATED", ticket, org_id, {"priority": "LOW"})

    assert len(results) == 0
    assert ticket.priority == "LOW"
