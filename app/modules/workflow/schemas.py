"""
Workflow Schemas — request/response Pydantic models.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
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
    role: Optional[str]


class WorkflowSimulateStepResponse(BaseModel):
    step_number: int
    step_name: Optional[str]
    step_type: Optional[str] = None
    approvers: Optional[list[WorkflowStepApprover]] = None
    sla_hours: Optional[int] = None
    convergence: Optional[str] = None
    condition_met: bool
    condition_expression: Optional[str] = None


class WorkflowSimulateResponse(BaseModel):
    chain: list[WorkflowSimulateStepResponse]


class WorkflowTaskResponse(BaseModel):
    id: UUID
    workflow_instance_id: UUID
    step_number: int
    assigned_to: UUID
    assigned_role: Optional[str]
    status: str
    action: Optional[str]
    comment: Optional[str]
    acted_at: Optional[datetime]
    sla_deadline: Optional[datetime]
    sla_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkflowInstanceResponse(BaseModel):
    id: UUID
    template_id: UUID
    entity_type: str
    entity_id: UUID
    status: str
    current_step_number: int
    started_at: datetime
    completed_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    cancel_reason: Optional[str]

    model_config = {"from_attributes": True}
