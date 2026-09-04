from __future__ import annotations
from typing import Dict, List

AUCTION_FSM: dict[str, list[str]] = {
    "SCHEDULED":        ["OPEN", "CANCELLED"],
    "OPEN":             ["EXTENDED", "CLOSING", "CLOSED", "PAUSED", "CANCELLED"],
    "EXTENDED":         ["OPEN", "CLOSING", "CLOSED", "PAUSED", "CANCELLED"],
    "PAUSED":           ["OPEN", "CANCELLED"],
    "CLOSING":          ["CLOSED", "CANCELLED"],
    "CLOSED":           ["RESULTS_RELEASED"],
    "RESULTS_RELEASED": [],
    "CANCELLED":        [],
}

def validate_auction_transition(current: str, target: str) -> None:
    allowed = AUCTION_FSM.get(current, [])
    if target not in allowed:
        from app.core.exceptions import AppException
        raise AppException(
            "INVALID_AUCTION_STATE_TRANSITION",
            f"Cannot transition auction from {current} to {target}. Allowed: {allowed}",
            409,
        )
