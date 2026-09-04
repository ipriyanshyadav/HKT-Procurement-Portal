from __future__ import annotations
from typing import Union
from app.core.exceptions import ConflictError
from app.db.enums import RFQStatus


# 14-status RFQ FSM per SPEC_10 Section 3
RFQ_FSM: dict[str, list[str]] = {
    RFQStatus.DRAFT.value:             [RFQStatus.PENDING_APPROVAL.value, RFQStatus.CANCELLED.value],
    RFQStatus.PENDING_APPROVAL.value:  [RFQStatus.APPROVED.value, RFQStatus.CANCELLED.value, RFQStatus.AMENDMENT_PENDING.value],
    RFQStatus.AMENDMENT_PENDING.value: [RFQStatus.PENDING_APPROVAL.value, RFQStatus.CANCELLED.value],
    RFQStatus.APPROVED.value:          [RFQStatus.PUBLISHED.value, RFQStatus.CANCELLED.value],
    RFQStatus.PUBLISHED.value:         [RFQStatus.BID_OPEN.value, RFQStatus.AMENDMENT_PENDING.value, RFQStatus.CANCELLED.value, RFQStatus.NO_BIDS.value],
    RFQStatus.BID_OPEN.value:          [RFQStatus.BIDS_OPENED.value, RFQStatus.CANCELLED.value],
    RFQStatus.BIDS_OPENED.value:       [RFQStatus.UNDER_EVALUATION.value, RFQStatus.CANCELLED.value],
    RFQStatus.UNDER_EVALUATION.value:  [RFQStatus.CS_GENERATED.value, RFQStatus.CANCELLED.value],
    RFQStatus.CS_GENERATED.value:      [RFQStatus.CS_APPROVED.value, RFQStatus.CANCELLED.value],
    RFQStatus.CS_APPROVED.value:       [RFQStatus.AWARDED.value, RFQStatus.CANCELLED.value],
    RFQStatus.AWARDED.value:           [],
    RFQStatus.NO_BIDS.value:           [RFQStatus.PUBLISHED.value, RFQStatus.CANCELLED.value],
    RFQStatus.COMPLIANCE_HOLD.value:   [RFQStatus.PUBLISHED.value, RFQStatus.CANCELLED.value],
    RFQStatus.CANCELLED.value:         [],
}


class InvalidRfqTransitionError(ConflictError):
    def __init__(self, current: str, target: str, allowed: list[str]) -> None:
        super().__init__(
            f"Cannot transition RFQ from {current} to {target}",
            details={"current": current, "target": target, "allowed": allowed},
        )
        self.code = "INVALID_RFQ_TRANSITION"


def validate_rfq_transition(
    current: Union[str, RFQStatus],
    target: Union[str, RFQStatus],
) -> None:
    current_val = current.value if isinstance(current, RFQStatus) else str(current)
    target_val = target.value if isinstance(target, RFQStatus) else str(target)

    allowed = RFQ_FSM.get(current_val, [])
    if target_val not in allowed:
        raise InvalidRfqTransitionError(current_val, target_val, allowed)
