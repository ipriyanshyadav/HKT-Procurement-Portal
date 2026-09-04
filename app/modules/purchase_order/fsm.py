"""
Purchase Order Lifecycle Finite State Machine (FSM).

SPEC_14 S14-02:
Defines allowed state transitions across the full PO lifecycle:
DRAFT -> PENDING_APPROVAL -> APPROVED -> RELEASED/SENT_TO_VENDOR -> ACKNOWLEDGED / REJECTED_BY_SUPPLIER
-> PARTIALLY_RECEIVED -> FULLY_RECEIVED -> CLOSED
(with support for AMENDMENT_PENDING / AMENDED and CANCELLED).
"""
from __future__ import annotations

from typing import Dict, List, Union
from app.core.exceptions import AppException
from app.db.enums import POStatus


PO_FSM: Dict[str, List[str]] = {
    "DRAFT": ["PENDING_APPROVAL", "APPROVED", "RELEASED", "SENT_TO_VENDOR", "CANCELLED"],
    "PENDING_APPROVAL": ["APPROVED", "REJECTED", "CANCELLED"],
    "APPROVED": ["RELEASED", "SENT_TO_VENDOR", "CANCELLED"],
    "RELEASED": [
        "ACKNOWLEDGED",
        "VENDOR_ACKNOWLEDGED",
        "REJECTED_BY_SUPPLIER",
        "VENDOR_REJECTED",
        "SYNC_PENDING",
        "CANCELLED",
    ],
    "SENT_TO_VENDOR": [
        "ACKNOWLEDGED",
        "VENDOR_ACKNOWLEDGED",
        "REJECTED_BY_SUPPLIER",
        "VENDOR_REJECTED",
        "CANCELLED",
    ],
    "SYNC_PENDING": ["RELEASED", "SENT_TO_VENDOR", "CANCELLED"],
    "ACKNOWLEDGED": [
        "PARTIALLY_RECEIVED",
        "FULLY_RECEIVED",
        "AMENDMENT_PENDING",
        "AMENDED",
        "CANCELLED",
    ],
    "VENDOR_ACKNOWLEDGED": [
        "PARTIALLY_RECEIVED",
        "FULLY_RECEIVED",
        "AMENDMENT_PENDING",
        "AMENDED",
        "CANCELLED",
    ],
    "REJECTED_BY_SUPPLIER": ["AMENDMENT_PENDING", "AMENDED", "CANCELLED"],
    "VENDOR_REJECTED": ["AMENDMENT_PENDING", "AMENDED", "CANCELLED"],
    "AMENDMENT_PENDING": [
        "AMENDED",
        "PENDING_APPROVAL",
        "APPROVED",
        "RELEASED",
        "SENT_TO_VENDOR",
        "CANCELLED",
    ],
    "AMENDED": [
        "RELEASED",
        "SENT_TO_VENDOR",
        "PENDING_APPROVAL",
        "APPROVED",
        "CANCELLED",
    ],
    "PARTIALLY_RECEIVED": ["FULLY_RECEIVED", "CANCELLED"],
    "FULLY_RECEIVED": ["CLOSED"],
    "CLOSED": [],
    "CANCELLED": [],
    "REJECTED": [],
}

# Equivalence map for synonym statuses between plan and database enum
STATUS_EQUIVALENCES = {
    "SENT_TO_VENDOR": "RELEASED",
    "VENDOR_ACKNOWLEDGED": "ACKNOWLEDGED",
    "VENDOR_REJECTED": "REJECTED_BY_SUPPLIER",
}


def normalize_status(status: Union[str, POStatus]) -> str:
    if hasattr(status, "value"):
        return str(status.value)
    return str(status)


def can_transition(
    current_status: Union[str, POStatus],
    target_status: Union[str, POStatus],
) -> bool:
    curr = normalize_status(current_status)
    target = normalize_status(target_status)

    allowed = PO_FSM.get(curr, [])
    if target in allowed:
        return True

    # Check equivalent forms
    curr_equiv = STATUS_EQUIVALENCES.get(curr, curr)
    target_equiv = STATUS_EQUIVALENCES.get(target, target)

    allowed_equiv = PO_FSM.get(curr_equiv, [])
    return target in allowed_equiv or target_equiv in allowed_equiv


def get_allowed_transitions(current_status: Union[str, POStatus]) -> List[str]:
    curr = normalize_status(current_status)
    return list(PO_FSM.get(curr, []))


def validate_po_transition(
    current_status: Union[str, POStatus],
    target_status: Union[str, POStatus],
) -> None:
    curr = normalize_status(current_status)
    target = normalize_status(target_status)

    if not can_transition(curr, target):
        allowed = PO_FSM.get(curr, [])
        raise AppException(
            "INVALID_STATE_TRANSITION",
            f"Cannot transition purchase order from {curr} to {target}. Allowed transitions: {allowed}",
        )
