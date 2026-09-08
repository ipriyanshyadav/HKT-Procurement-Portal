from __future__ import annotations

from app.core.exceptions import AppException

TICKET_FSM: dict[str, list[str]] = {
    "OPEN": ["IN_PROGRESS", "CLOSED"],
    "IN_PROGRESS": ["PENDING_RESPONSE", "ESCALATED", "RESOLVED"],
    "PENDING_RESPONSE": ["IN_PROGRESS", "CLOSED"],
    "ESCALATED": ["IN_PROGRESS", "RESOLVED"],
    "RESOLVED": ["CLOSED", "REOPENED"],
    "CLOSED": ["REOPENED"],
    "REOPENED": ["IN_PROGRESS"],
}

# Suppliers may ONLY perform these transitions on their own tickets
SUPPLIER_ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    "RESOLVED": ["CLOSED", "REOPENED"],
}


def validate_ticket_transition(current: str, target: str, is_supplier: bool = False) -> None:
    allowed = (SUPPLIER_ALLOWED_TRANSITIONS if is_supplier else TICKET_FSM).get(current, [])
    if target not in allowed:
        raise AppException(
            message=f"Cannot transition ticket from {current} to {target}",
            code="INVALID_TICKET_TRANSITION",
            status_code=409,
            details={"current": current, "target": target, "allowed": allowed},
        )
