from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from app.db.enums import UnmappedPRStatus
from app.modules.requisition.schemas import PRListResponse


class UnmappedPRMappingItem(BaseModel):
    field: str
    value: UUID
    source_value: Optional[str] = None
    label: Optional[str] = None


class UnmappedPRMapRequest(BaseModel):
    mappings: list[UnmappedPRMappingItem] = Field(min_length=1)
    notes: Optional[str] = None


class UnmappedPRExceptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    requisition_id: UUID
    failed_fields: Dict[str, Any] | list
    status: str
    assigned_to: Optional[UUID] = None
    sla_deadline: Optional[datetime] = None
    sla_breach_level: int
    proposed_mappings: Optional[Dict[str, Any] | list] = None
    resolution_notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[UUID] = None
    reprocessing_attempts: int
    last_reprocessing_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    requisition: Optional[PRListResponse] = None


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
    suggested_category_id: Optional[UUID] = None
    confidence: float
    auto_apply: bool
    based_on_records: int
    suggestions: list[MappingSuggestionItem] = Field(default_factory=list)
    reason: Optional[str] = None
