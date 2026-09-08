from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CustomFieldValueItem(BaseModel):
    field_def_id: UUID
    value_text: str | None = None
    value_number: float | None = None
    value_json: Any | None = None


class TicketCreateRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=500)
    description: str = Field(..., min_length=20)
    ticket_type: str
    priority: str = "MEDIUM"
    category: str | None = None
    due_date: date | None = None
    entity_type: str | None = None
    entity_id: UUID | None = None
    entity_number: str | None = None
    tags: list[str] | None = Field(default_factory=list)
    is_private: bool | None = False
    custom_fields: list[CustomFieldValueItem] | None = Field(default_factory=list)


class TicketUpdateRequest(BaseModel):
    title: str | None = Field(None, min_length=5, max_length=500)
    description: str | None = Field(None, min_length=20)
    priority: str | None = None
    category: str | None = None
    due_date: date | None = None
    tags: list[str] | None = None
    is_private: bool | None = None
    custom_fields: list[CustomFieldValueItem] | None = None


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
    due_date_from: date | None = None
    due_date_to: date | None = None
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


class TicketLinkCreateRequest(BaseModel):
    target_ticket_id: UUID
    link_type: str  # BLOCKS, IS_BLOCKED_BY, RELATES_TO, DUPLICATES, IS_DUPLICATED_BY, CLONES, IS_CLONED_BY


class TicketLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source_ticket_id: UUID
    target_ticket_id: UUID
    link_type: str
    created_by: UUID
    created_at: datetime
    target_ticket_number: str | None = None
    target_ticket_title: str | None = None
    target_ticket_status: str | None = None
    target_ticket_priority: str | None = None


class CustomFieldDefCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    field_key: str = Field(..., min_length=2, max_length=100)
    field_type: str  # TEXT, NUMBER, DATE, SELECT, MULTI_SELECT, BOOLEAN
    description: str | None = None
    is_required: bool = False
    default_value: str | None = None
    options: list[Any] = Field(default_factory=list)
    applies_to_ticket_types: list[str] = Field(default_factory=list)


class CustomFieldDefUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    is_required: bool | None = None
    default_value: str | None = None
    options: list[Any] | None = None
    applies_to_ticket_types: list[str] | None = None


class CustomFieldDefResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    field_key: str
    field_type: str
    description: str | None = None
    is_required: bool
    default_value: str | None = None
    options: list[Any] = Field(default_factory=list)
    applies_to_ticket_types: list[str] = Field(default_factory=list)
    created_at: datetime


class CustomFieldValueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    field_def_id: UUID
    field_key: str | None = None
    field_name: str | None = None
    field_type: str | None = None
    value_text: str | None = None
    value_number: float | None = None
    value_json: Any | None = None


class AutomationRuleCreateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=150)
    description: str | None = None
    is_enabled: bool = True
    trigger_type: str  # TICKET_CREATED, STATUS_CHANGED, FIELD_CHANGED, SLA_BREACHED, SCHEDULE
    trigger_config: dict[str, Any] = Field(default_factory=dict)
    conditions: list[dict[str, Any]] = Field(default_factory=list)
    actions: list[dict[str, Any]] = Field(default_factory=list)


class AutomationRuleUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    is_enabled: bool | None = None
    trigger_type: str | None = None
    trigger_config: dict[str, Any] | None = None
    conditions: list[dict[str, Any]] | None = None
    actions: list[dict[str, Any]] | None = None


class AutomationRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None = None
    is_enabled: bool
    trigger_type: str
    trigger_config: dict[str, Any]
    conditions: list[dict[str, Any]]
    actions: list[dict[str, Any]]
    execution_count: int
    last_executed_at: datetime | None = None
    created_at: datetime


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
    due_date: date | None = None
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
    links: list[TicketLinkResponse] = Field(default_factory=list)
    custom_fields: list[CustomFieldValueResponse] = Field(default_factory=list)
