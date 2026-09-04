from __future__ import annotations
from typing import Union
from app.core.exceptions import ConflictError
from app.db.enums import PRStatus


# 12-status PR FSM according to SPEC_08 Section 9
PR_FSM: dict[str, list[str]] = {
    PRStatus.DRAFT.value: [PRStatus.SUBMITTED.value, PRStatus.WITHDRAWN.value],
    PRStatus.SUBMITTED.value: [
        PRStatus.PENDING_APPROVAL.value,
        PRStatus.APPROVED.value,
        PRStatus.REJECTED.value,
        PRStatus.WITHDRAWN.value,
    ],
    PRStatus.PENDING_APPROVAL.value: [
        PRStatus.APPROVED.value,
        PRStatus.REJECTED.value,
        PRStatus.WITHDRAWN.value,
    ],
    PRStatus.APPROVED.value: [
        PRStatus.IN_SOURCING.value,
        PRStatus.CONVERTED.value,
        PRStatus.CANCELLED.value,
        PRStatus.AMENDMENT_PENDING.value,
        PRStatus.SPLIT.value,
    ],
    PRStatus.REJECTED.value: [PRStatus.DRAFT.value],
    PRStatus.WITHDRAWN.value: [PRStatus.DRAFT.value],
    PRStatus.IN_SOURCING.value: [PRStatus.CONVERTED.value, PRStatus.CANCELLED.value],
    PRStatus.CONVERTED.value: [],
    PRStatus.CANCELLED.value: [],
    PRStatus.UNMAPPED.value: [
        PRStatus.SUBMITTED.value,
        PRStatus.DRAFT.value,
        PRStatus.CANCELLED.value,
    ],
    PRStatus.AMENDMENT_PENDING.value: [
        PRStatus.APPROVED.value,
        PRStatus.REJECTED.value,
        PRStatus.SUBMITTED.value,
    ],
    PRStatus.SPLIT.value: [],
}

# Compatibility aliases mapping legacy/alternate names to canonical enum statuses
_STATUS_ALIASES: dict[str, str] = {
    "CONVERTED_TO_RFQ": PRStatus.IN_SOURCING.value,
    "CONVERTED_TO_PO": PRStatus.CONVERTED.value,
    "AMENDED": PRStatus.AMENDMENT_PENDING.value,
    "RETURNED": PRStatus.DRAFT.value,
}


class InvalidPrTransitionError(ConflictError):
    def __init__(self, current: str, target: str, allowed: list[str]):
        super().__init__(
            f"Cannot transition PR from {current} to {target}",
            details={"current": current, "target": target, "allowed": allowed},
        )
        self.code = "INVALID_PR_TRANSITION"


def validate_pr_transition(
    current: Union[str, PRStatus],
    target: Union[str, PRStatus],
) -> None:
    current_val = current.value if isinstance(current, PRStatus) else str(current)
    target_val = target.value if isinstance(target, PRStatus) else str(target)

    # Normalize aliases if provided
    canonical_current = _STATUS_ALIASES.get(current_val, current_val)
    canonical_target = _STATUS_ALIASES.get(target_val, target_val)

    allowed = PR_FSM.get(canonical_current, [])
    # Check if target matches either directly or via alias
    if target_val not in allowed and canonical_target not in allowed:
        raise InvalidPrTransitionError(current_val, target_val, allowed)
