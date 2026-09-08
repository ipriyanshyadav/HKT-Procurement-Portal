from __future__ import annotations

import pytest

from app.core.exceptions import AppException
from app.modules.ticket.fsm import TICKET_FSM, validate_ticket_transition


def test_fsm_structure():
    """Verify all 7 states are present in the FSM definition."""
    expected_states = {"OPEN", "IN_PROGRESS", "PENDING_RESPONSE", "ESCALATED", "RESOLVED", "CLOSED", "REOPENED"}
    assert set(TICKET_FSM.keys()) == expected_states


def test_all_legal_buyer_transitions():
    """Verify all legal buyer transitions execute without exception."""
    legal_pairs = [
        ("OPEN", "IN_PROGRESS"),
        ("OPEN", "CLOSED"),
        ("IN_PROGRESS", "PENDING_RESPONSE"),
        ("IN_PROGRESS", "ESCALATED"),
        ("IN_PROGRESS", "RESOLVED"),
        ("PENDING_RESPONSE", "IN_PROGRESS"),
        ("PENDING_RESPONSE", "CLOSED"),
        ("ESCALATED", "IN_PROGRESS"),
        ("ESCALATED", "RESOLVED"),
        ("RESOLVED", "CLOSED"),
        ("RESOLVED", "REOPENED"),
        ("CLOSED", "REOPENED"),
        ("REOPENED", "IN_PROGRESS"),
    ]
    for current, target in legal_pairs:
        validate_ticket_transition(current, target, is_supplier=False)


@pytest.mark.parametrize(
    "current,target",
    [
        ("OPEN", "RESOLVED"),
        ("OPEN", "PENDING_RESPONSE"),
        ("OPEN", "ESCALATED"),
        ("OPEN", "REOPENED"),
        ("IN_PROGRESS", "CLOSED"),
        ("IN_PROGRESS", "OPEN"),
        ("RESOLVED", "IN_PROGRESS"),
        ("RESOLVED", "OPEN"),
        ("CLOSED", "IN_PROGRESS"),
        ("CLOSED", "OPEN"),
        ("REOPENED", "RESOLVED"),
        ("REOPENED", "CLOSED"),
        ("UNKNOWN", "OPEN"),
    ],
)
def test_illegal_buyer_transitions(current: str, target: str):
    """Verify illegal transitions raise AppException with code INVALID_TICKET_TRANSITION."""
    with pytest.raises(AppException) as exc_info:
        validate_ticket_transition(current, target, is_supplier=False)
    assert exc_info.value.code == "INVALID_TICKET_TRANSITION"
    assert exc_info.value.status_code == 409


def test_supplier_allowed_transitions():
    """Suppliers can close or reopen RESOLVED tickets."""
    validate_ticket_transition("RESOLVED", "CLOSED", is_supplier=True)
    validate_ticket_transition("RESOLVED", "REOPENED", is_supplier=True)


@pytest.mark.parametrize(
    "current,target",
    [
        ("OPEN", "IN_PROGRESS"),
        ("OPEN", "CLOSED"),
        ("IN_PROGRESS", "RESOLVED"),
        ("IN_PROGRESS", "PENDING_RESPONSE"),
        ("ESCALATED", "RESOLVED"),
        ("CLOSED", "REOPENED"),
    ],
)
def test_supplier_forbidden_transitions(current: str, target: str):
    """Suppliers are blocked from buyer-only workflow transitions."""
    with pytest.raises(AppException) as exc_info:
        validate_ticket_transition(current, target, is_supplier=True)
    assert exc_info.value.code == "INVALID_TICKET_TRANSITION"
    assert exc_info.value.status_code == 409
