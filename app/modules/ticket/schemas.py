from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TicketCreateRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=500)
    description: str = Field(..., min_length=20)
    ticket_type: str
    priority: str = "MEDIUM"
    category: str | None = None
    entity_type: str | None = None
    entity_id: UUID | None = None
    entity_number: str | None = None
    tags: list[str] | None = Field(default_factory=list)
    is_private: bool | None = False


class TicketUpdateRequest(BaseModel):
    title: str | None = Field(None, min_length=5, max_length=500)
    description: str | None = Field(None, min_length=20)
    priority: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    is_private: bool | None = None


class TicketFilters(BaseModel):
    status: str | None = None
    priority: str | None = None
    ticket_type: str | None = None
    entity_type: str | None = None
    entity_id: UUID | None = None
    view_scope: str | None = None  # "my_tickets", "assigned_to_me"
    tags: list[str] | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    limit: int = 25
    offset: int = 0


class TicketCommentRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)
    is_internal: bool | None = False


class TicketCommentEditRequest(BaseModel):
    content: str = Field(..., min_length=1)


class TicketAssignRequest(BaseModel):
    user_id: UUID
    team: str | None = None


class TicketResolveRequest(BaseModel):
    resolution_note: str = Field(..., min_length=10)


class TicketReopenRequest(BaseModel):
    reason: str = Field(..., min_length=5)


class TicketEscalateRequest(BaseModel):
    reason: str = Field(..., min_length=5)
    escalate_to_user_id: UUID | None = None


class TicketWatcherRequest(BaseModel):
    user_id: UUID


class TicketSearchRequest(BaseModel):
    query: str
    filters: dict[str, Any] | None = None


class TicketSLAConfigRequest(BaseModel):
    priority: str
    first_response_hours: int = Field(..., ge=1)
    resolution_hours: int = Field(..., ge=1)
    escalation_hours: int = Field(..., ge=1)
    escalate_to_role: str | None = None


class TicketWatcherResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    user_id: UUID
    added_by: UUID
    created_at: datetime
    user_name: str | None = None
    user_email: str | None = None


class TicketActivityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    actor_id: UUID
    activity_type: str
    old_value: str | None = None
    new_value: str | None = None
    created_at: datetime
    actor_name: str | None = None


class TicketAttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    comment_id: UUID | None = None
    document_id: UUID
    uploaded_by: UUID
    file_name: str
    created_at: datetime


class TicketCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    author_id: UUID
    content: str
    is_internal: bool
    mentioned_users: list[UUID] = Field(default_factory=list)
    edited_at: datetime | None = None
    edited_by: UUID | None = None
    parent_id: UUID | None = None
    created_at: datetime
    author_name: str | None = None
    author_email: str | None = None


class TicketListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_number: str
    title: str
    description: str
    ticket_type: str
    priority: str
    status: str
    category: str | None = None
    raised_by: UUID
    raised_by_portal: str
    assigned_to: UUID | None = None
    assigned_team: str | None = None
    entity_type: str | None = None
    entity_id: UUID | None = None
    entity_number: str | None = None
    resolution_note: str | None = None
    resolved_at: datetime | None = None
    sla_breach_at: datetime | None = None
    sla_status: str
    first_response_at: datetime | None = None
    reopen_count: int
    tags: list[str] = Field(default_factory=list)
    is_private: bool
    created_at: datetime
    updated_at: datetime
    raised_by_name: str | None = None
    assigned_to_name: str | None = None


class TicketDetailResponse(TicketListResponse):
    model_config = ConfigDict(from_attributes=True)

    comments: list[TicketCommentResponse] = Field(default_factory=list)
    watchers: list[TicketWatcherResponse] = Field(default_factory=list)
    activity_logs: list[TicketActivityLogResponse] = Field(default_factory=list)
    attachments: list[TicketAttachmentResponse] = Field(default_factory=list)
