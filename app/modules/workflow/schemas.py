"""
Workflow Schemas — request/response Pydantic models.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class TaskActionRequest(BaseModel):
    comment: str = Field(default="", max_length=2000)


class CancelRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=500)


class ForceAdvanceRequest(BaseModel):
    reason: str = Field(..., min_length=10, max_length=1000)


class SimulateRequest(BaseModel):
    template_code: str = Field(..., min_length=1, max_length=100)
    entity_context: dict[str, Any] = Field(default_factory=dict)


class WorkflowStepApprover(BaseModel):
    id: str
    name: str
    role: str | None


class WorkflowSimulateStepResponse(BaseModel):
    step_number: int
    step_name: str | None
    step_type: str | None = None
    approvers: list[WorkflowStepApprover] | None = None
    sla_hours: int | None = None
    convergence: str | None = None
    condition_met: bool
    condition_expression: str | None = None


class WorkflowSimulateResponse(BaseModel):
    chain: list[WorkflowSimulateStepResponse]


class WorkflowTaskResponse(BaseModel):
    id: UUID
    workflow_instance_id: UUID
    step_number: int
    assigned_to: UUID
    assigned_role: str | None
    status: str
    action: str | None
    comment: str | None
    acted_at: datetime | None
    sla_deadline: datetime | None
    sla_status: str
    created_at: datetime

    # Rich metadata for Approval Inbox
    entity_type: str | None = None
    entity_id: UUID | None = None
    entity_number: str | None = None
    title: str | None = None
    raised_by_id: UUID | None = None
    raised_by_name: str | None = None
    raised_by_email: str | None = None
    department: str | None = None
    total_amount: float | None = None
    currency: str | None = "INR"
    priority: str | None = "MEDIUM"

    model_config = {"from_attributes": True}


class WorkflowInstanceResponse(BaseModel):
    id: UUID
    template_id: UUID
    entity_type: str
    entity_id: UUID
    status: str
    current_step_number: int
    started_at: datetime
    completed_at: datetime | None
    cancelled_at: datetime | None
    cancel_reason: str | None

    model_config = {"from_attributes": True}
