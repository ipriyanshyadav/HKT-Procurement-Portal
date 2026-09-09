from __future__ import annotations

from app.core.exceptions import ConflictError
from app.db.enums import VendorStatus

VENDOR_FSM: dict[str, list[str]] = {
    "INVITED":                  ["REGISTRATION_IN_PROGRESS", "DEACTIVATED"],
    "REGISTRATION_IN_PROGRESS": ["SUBMITTED", "DEACTIVATED"],
    "SUBMITTED":                ["UNDER_REVIEW", "DEACTIVATED"],
    "UNDER_REVIEW":             ["QUALIFIED", "RESUBMISSION_REQUESTED", "DEACTIVATED"],
    "RESUBMISSION_REQUESTED":   ["SUBMITTED", "DEACTIVATED"],
    "QUALIFIED":                ["ACTIVE", "DEACTIVATED"],
    "ACTIVE":                   ["SUSPENDED", "COMPLIANCE_HOLD", "BLACKLISTED", "DEACTIVATED"],
    "SUSPENDED":                ["ACTIVE", "BLACKLISTED", "DEACTIVATED"],
    "COMPLIANCE_HOLD":          ["ACTIVE", "BLACKLISTED", "DEACTIVATED"],
    "BLACKLISTED":              [],
    "DEACTIVATED":              [],
}


class InvalidStatusTransitionError(ConflictError):
    def __init__(self, current: str, target: str, allowed: list[str]):
        super().__init__(
            f"Cannot transition vendor from {current} to {target}",
            details={"current": current, "target": target, "allowed": allowed},
        )
        self.code = "INVALID_STATUS_TRANSITION"


def validate_transition(current: str | VendorStatus, target: str | VendorStatus) -> None:
    current_val = current.value if isinstance(current, VendorStatus) else str(current)
    target_val = target.value if isinstance(target, VendorStatus) else str(target)
    allowed = VENDOR_FSM.get(current_val, [])
    if target_val not in allowed:
        raise InvalidStatusTransitionError(current_val, target_val, allowed)
