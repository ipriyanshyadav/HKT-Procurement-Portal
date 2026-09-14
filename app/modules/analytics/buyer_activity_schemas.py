"""Schemas for Buyer Activity and Procurement Velocity Reports (SPEC 27-H).

Module: analytics
Layer: schema
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class BuyerActivitySummary(BaseModel):
    user_id: UUID
    full_name: str
    total_actions: int = 0
    prs_created: int = 0
    pos_processed: int = 0
    tickets_raised: int = 0
    avg_turnaround_hours: float = 0.0


class HeatmapDataPoint(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    hour_of_day: int = Field(..., ge=0, le=23, description="0 to 23")
    count: int = 0


class HeatmapResponse(BaseModel):
    matrix: list[HeatmapDataPoint] = Field(default_factory=list)
    total_actions: int = 0
    peak_day: str = "Monday"
    peak_hour: int = 14


class BuyerPerformanceRow(BaseModel):
    rank: int
    buyer_id: UUID
    buyer_name: str
    prs_created: int = 0
    prs_approved: int = 0
    avg_approval_hours: float = 0.0
    tickets_raised: int = 0
    sla_compliance_rate: float = 100.0


class ProcurementVelocityBucket(BaseModel):
    bucket_label: str
    count: int
    percentage: float


class ProcurementVelocityResponse(BaseModel):
    avg_cycle_days: float = 0.0
    median_cycle_days: float = 0.0
    distribution: list[ProcurementVelocityBucket] = Field(default_factory=list)


class BottleneckStep(BaseModel):
    step_name: str
    avg_duration_hours: float
    max_duration_hours: float
    delayed_count: int


class SessionSecurityAnalytics(BaseModel):
    active_users_today: int = 0
    dormant_users_30d: int = 0
    concurrent_sessions_peak: int = 0
    failed_login_attempts_today: int = 0
