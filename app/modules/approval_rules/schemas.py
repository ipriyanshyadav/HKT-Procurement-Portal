"""
Approval Rules Schemas — request/response Pydantic models.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

# Valid entity types for approval rules
VALID_ENTITY_TYPES = frozenset({"PR", "RFQ", "PO", "VENDOR", "CONTRACT"})


class ApprovalRuleCreateRequest(BaseModel):
    entity_type: str = Field(..., description="One of: PR, RFQ, PO, VENDOR, CONTRACT")
    rule_code: str = Field(..., min_length=3, max_length=100)
    rule_name: str = Field(..., min_length=3, max_length=255)
    priority: int = Field(..., ge=1, le=1000)
    conditions: dict[str, Any] = Field(default_factory=dict)
    condition_expression: str | None = Field(None, max_length=1000)
    workflow_template_code: str = Field(..., min_length=1, max_length=100)
    is_catch_all: bool = Field(default=False)
    effective_from: datetime | None = None
    effective_to: datetime | None = None


class ApprovalRuleUpdateRequest(BaseModel):
    rule_name: str | None = Field(None, min_length=3, max_length=255)
    priority: int | None = Field(None, ge=1, le=1000)
    conditions: dict[str, Any] | None = None
    condition_expression: str | None = Field(None, max_length=1000)
    workflow_template_code: str | None = Field(None, min_length=1, max_length=100)
    effective_to: datetime | None = None


class ApprovalRuleSimulateRequest(BaseModel):
    entity_type: str
    entity_context: dict[str, Any] = Field(default_factory=dict)


class ApprovalRuleResponse(BaseModel):
    id: UUID
    entity_type: str
    rule_code: str
    rule_name: str
    priority: int
    conditions: Any = Field(default_factory=dict)
    condition_expression: str | None = None
    workflow_template_code: str = ""
    is_active: bool = True
    is_catch_all: bool = False
    effective_from: datetime | None = None
    effective_to: datetime | None = None
    created_by: UUID | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ApprovalRuleVersionResponse(BaseModel):
    id: UUID
    rule_id: UUID
    snapshot: dict[str, Any]
    activated_by: UUID
    activated_at: datetime

    model_config = {"from_attributes": True}


class ApprovalRuleSimulateResponse(BaseModel):
    matched_rule: ApprovalRuleResponse | None
    workflow_template_code: str | None
    match_type: str  # "SPECIFIC", "CATCH_ALL", or "NONE"
    evaluated_rules_count: int
