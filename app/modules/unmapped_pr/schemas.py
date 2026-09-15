from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.requisition.schemas import PRListResponse


class UnmappedPRMappingItem(BaseModel):
    field: str
    value: UUID
    source_value: str | None = None
    label: str | None = None


class UnmappedPRMapRequest(BaseModel):
    mappings: list[UnmappedPRMappingItem] = Field(min_length=1)
    notes: str | None = None


class UnmappedPRExceptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    requisition_id: UUID
    failed_fields: dict[str, Any] | list
    status: str
    assigned_to: UUID | None = None
    sla_deadline: datetime | None = None
    sla_breach_level: int
    proposed_mappings: dict[str, Any] | list | None = None
    resolution_notes: str | None = None
    resolved_at: datetime | None = None
    resolved_by: UUID | None = None
    reprocessing_attempts: int
    last_reprocessing_error: str | None = None
    created_at: datetime
    updated_at: datetime
    requisition: PRListResponse | None = None


class UnmappedPRDashboardResponse(BaseModel):
    total_pending: int
    tier_1_count: int
    tier_2_count: int
    tier_3_count: int
    tier_4_count: int
    total_blocked_value: Decimal


class MappingSuggestionItem(BaseModel):
    target_id: UUID
    label: str
    confidence: float
    method: str


class UnmappedPRSuggestionResponse(BaseModel):
    exception_id: UUID
    suggested_category_id: UUID | None = None
    confidence: float
    auto_apply: bool
    based_on_records: int
    suggestions: list[MappingSuggestionItem] = Field(default_factory=list)
    reason: str | None = None
