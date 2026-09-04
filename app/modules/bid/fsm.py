from __future__ import annotations
from typing import Union
from app.core.exceptions import ConflictError
from app.db.enums import BidStatus


# 11-status Bid FSM per SPEC_11 Section 3
BID_FSM: dict[str, list[str]] = {
    BidStatus.DRAFT.value:                     [BidStatus.SUBMITTED.value, BidStatus.WITHDRAWN.value],
    BidStatus.SUBMITTED.value:                 [BidStatus.REOPENED.value, BidStatus.WITHDRAWN.value, BidStatus.OPENED.value, BidStatus.NOT_AWARDED.value],
    BidStatus.REOPENED.value:                  [BidStatus.SUBMITTED.value, BidStatus.WITHDRAWN.value],
    BidStatus.OPENED.value:                    [BidStatus.TECHNICALLY_QUALIFIED.value, BidStatus.TECHNICALLY_DISQUALIFIED.value],
    BidStatus.TECHNICALLY_QUALIFIED.value:     [BidStatus.EVALUATED.value, BidStatus.NOT_AWARDED.value],
    BidStatus.TECHNICALLY_DISQUALIFIED.value:  [],
    BidStatus.EVALUATED.value:                 [BidStatus.AWARDED.value, BidStatus.NOT_AWARDED.value],
    BidStatus.WITHDRAWN.value:                 [],
    BidStatus.AWARDED.value:                   [],
    BidStatus.NOT_AWARDED.value:               [],
    BidStatus.INTEGRITY_FAIL.value:            [],
}


class InvalidBidTransitionError(ConflictError):
    def __init__(self, current: str, target: str, allowed: list[str]) -> None:
        super().__init__(
            f"Cannot transition bid from {current} to {target}",
            details={"current": current, "target": target, "allowed": allowed},
        )
        self.code = "INVALID_BID_TRANSITION"


def validate_bid_transition(
    current: Union[str, BidStatus],
    target: Union[str, BidStatus],
) -> None:
    current_val = current.value if isinstance(current, BidStatus) else str(current)
    target_val = target.value if isinstance(target, BidStatus) else str(target)

    allowed = BID_FSM.get(current_val, [])
    if target_val not in allowed:
        raise InvalidBidTransitionError(current_val, target_val, allowed)
