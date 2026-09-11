from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import BaseModel
from app.db.enums import (
    APPROVAL_TASK_STATUS_PG,
    TASK_ACTION_PG,
    WORKFLOW_INSTANCE_STATUS_PG,
    ApprovalTaskStatusEnum,
    TaskActionEnum,
    WorkflowInstanceStatusEnum,
)
from app.modules.approval_rules.models import ApprovalRule, ApprovalRuleVersion

__all__ = [
    "ApprovalGroup",
    "ApprovalGroupMember",
    "WorkflowTemplate",
    "WorkflowInstance",
    "WorkflowTask",
    "WorkflowEvent",
    "ApprovalRule",
    "ApprovalRuleVersion",
]


class ApprovalGroup(BaseModel):
    __tablename__ = "approval_groups"

    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(nullable=True)
    updated_by: Mapped[UUID | None] = mapped_column(nullable=True)

class ApprovalGroupMember(BaseModel):
    __tablename__ = "approval_group_members"

    approval_group_id: Mapped[UUID] = mapped_column(ForeignKey("approval_groups.id"), nullable=False)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(nullable=True)

class WorkflowTemplate(BaseModel):
    __tablename__ = "workflow_templates"

    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    steps: Mapped[list[Any]] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(nullable=True)
    updated_by: Mapped[UUID | None] = mapped_column(nullable=True)

class WorkflowInstance(BaseModel):
    __tablename__ = "workflow_instances"

    template_id: Mapped[UUID] = mapped_column(ForeignKey("workflow_templates.id"), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[UUID] = mapped_column(nullable=False)
    status: Mapped[WorkflowInstanceStatusEnum] = mapped_column(WORKFLOW_INSTANCE_STATUS_PG, default=WorkflowInstanceStatusEnum.ACTIVE, nullable=False)
    current_step_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    entity_context: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    rule_version_id: Mapped[UUID | None] = mapped_column(ForeignKey("approval_rule_versions.id"), nullable=True)
    started_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancelled_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

class WorkflowTask(BaseModel):
    __tablename__ = "workflow_tasks"

    workflow_instance_id: Mapped[UUID] = mapped_column(ForeignKey("workflow_instances.id"), nullable=False)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    assigned_to: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    assigned_role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[ApprovalTaskStatusEnum] = mapped_column(APPROVAL_TASK_STATUS_PG, default=ApprovalTaskStatusEnum.PENDING, nullable=False)
    action: Mapped[TaskActionEnum | None] = mapped_column(TASK_ACTION_PG, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    acted_at: Mapped[datetime | None] = mapped_column(nullable=True)
    sla_deadline: Mapped[datetime | None] = mapped_column(nullable=True)
    sla_status: Mapped[str] = mapped_column(String(20), default="WITHIN_SLA", nullable=False)
    parallel_task_group_id: Mapped[UUID | None] = mapped_column(nullable=True)
    delegated_from: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    is_maker_checker_enforced: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class WorkflowEvent(BaseModel):
    __tablename__ = "workflow_events"

    workflow_instance_id: Mapped[UUID] = mapped_column(ForeignKey("workflow_instances.id"), nullable=False)
    workflow_task_id: Mapped[UUID | None] = mapped_column(ForeignKey("workflow_tasks.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    event_data: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
