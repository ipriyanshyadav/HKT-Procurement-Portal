"""
Contract Lifecycle Finite State Machine (FSM).

SPEC_13 S13-02:
Defines allowed state transitions across the 10+ status lifecycle:
DRAFT -> PENDING_REVIEW -> PENDING_ESIGN -> ACTIVE -> AMENDED / SUSPENDED / TERMINATION_NOTICE / EXPIRED / CANCELLED.
Also bridges approval & execution states.
"""
from __future__ import annotations

from typing import Dict, List, Union
from app.core.exceptions import AppException
from app.db.enums import ContractStatusEnum


CONTRACT_FSM: Dict[str, List[str]] = {
    "DRAFT": ["PENDING_REVIEW", "PENDING_APPROVAL", "CANCELLED"],
    "PENDING_REVIEW": ["APPROVED", "PENDING_ESIGN", "PENDING_SIGNATURE", "RETURNED", "CANCELLED"],
    "PENDING_APPROVAL": ["APPROVED", "RETURNED", "PENDING_ESIGN", "PENDING_SIGNATURE", "CANCELLED"],
    "APPROVED": ["PENDING_ESIGN", "PENDING_SIGNATURE", "ACTIVE", "CANCELLED"],
    "RETURNED": ["PENDING_REVIEW", "PENDING_APPROVAL", "DRAFT", "CANCELLED"],
    "PENDING_ESIGN": ["ACTIVE", "EXECUTED", "PARTIALLY_SIGNED", "RETURNED", "CANCELLED"],
    "PENDING_SIGNATURE": ["ACTIVE", "EXECUTED", "PARTIALLY_SIGNED", "CANCELLED"],
    "PARTIALLY_SIGNED": ["ACTIVE", "EXECUTED", "CANCELLED"],
    "EXECUTED": ["ACTIVE", "SUSPENDED", "TERMINATION_NOTICE", "EXPIRED", "AMENDED"],
    "ACTIVE": ["SUSPENDED", "TERMINATION_NOTICE", "EXPIRED", "AMENDED", "RENEWED", "TERMINATED"],
    "AMENDED": ["ACTIVE", "AMENDMENT_PENDING"],
    "AMENDMENT_PENDING": ["AMENDED", "ACTIVE"],
    "SUSPENDED": ["ACTIVE", "TERMINATED"],
    "TERMINATION_NOTICE": ["TERMINATED", "ACTIVE"],
    "RENEWED": ["ACTIVE", "EXPIRED"],
    "TERMINATED": [],
    "EXPIRED": [],
    "CANCELLED": [],
}


def _normalize_status(status: Union[str, ContractStatusEnum]) -> str:
    if hasattr(status, "value"):
        return str(status.value)
    return str(status)


def can_transition(
    current_status: Union[str, ContractStatusEnum],
    target_status: Union[str, ContractStatusEnum],
) -> bool:
    curr = _normalize_status(current_status)
    target = _normalize_status(target_status)
    allowed = CONTRACT_FSM.get(curr, [])
    return target in allowed


def get_allowed_transitions(current_status: Union[str, ContractStatusEnum]) -> List[str]:
    curr = _normalize_status(current_status)
    return list(CONTRACT_FSM.get(curr, []))


def validate_contract_transition(
    current_status: Union[str, ContractStatusEnum],
    target_status: Union[str, ContractStatusEnum],
) -> None:
    curr = _normalize_status(current_status)
    target = _normalize_status(target_status)

    if not can_transition(curr, target):
        allowed = CONTRACT_FSM.get(curr, [])
        raise AppException(
            "INVALID_STATE_TRANSITION",
            f"Cannot transition contract from {curr} to {target}. Allowed transitions: {allowed}",
        )
