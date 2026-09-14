"""Admin, Onboarding & SuperAdmin Schemas — SPEC_27-B, SPEC_27-C.

Layer: schema
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OnboardingSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    initiated_by: UUID
    current_step: int
    completed_steps: list[int]
    step_data: dict[str, Any]
    status: str
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class OnboardingStepUpdateRequest(BaseModel):
    step: int = Field(ge=1, le=8)
    data: dict[str, Any] = Field(default_factory=dict)
    mark_step_completed: bool = True


class OnboardingChecklistItem(BaseModel):
    key: str
    title: str
    description: str
    is_completed: bool


class OnboardingChecklistResponse(BaseModel):
    total_steps: int = 8
    completed_count: int
    percent_complete: float
    items: list[OnboardingChecklistItem]
    is_ready_for_golive: bool


# SuperAdmin Platform Cross-Company Schemas (SPEC_27-C)
class SuperadminPlatformOverviewResponse(BaseModel):
    total_organizations: int
    active_organizations: int
    total_users: int
    total_vendors: int
    total_prs: int
    total_pos: int
    total_invoices: int
    total_gmv_inr: Decimal
    mom_growth_percent: float


class SuperadminOrgPerformanceItem(BaseModel):
    org_id: UUID
    org_name: str
    user_count: int
    vendor_count: int
    prs_count: int
    pos_count: int
    spend_mtd_inr: Decimal
    avg_sla_compliance_percent: float
    status: str
    created_at: datetime


class SuperadminOrgDetailResponse(BaseModel):
    org_id: UUID
    org_name: str
    legal_entities_count: int
    business_units_count: int
    active_users: int
    active_vendors: int
    total_spend_inr: Decimal
    open_tickets_count: int
    last_activity_at: datetime | None = None
