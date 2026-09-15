"""Support Portal Pydantic Schemas — SPEC_29.

Layer: schema
"""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SupportTicketCreateRequest(BaseModel):
    subject: str = Field(..., min_length=5, max_length=500)
    description: str = Field(..., min_length=10)
    priority: str = Field(default="MEDIUM")
    category: str = Field(default="GENERAL")


class SupportTicketMessageCreateRequest(BaseModel):
    message_text: str = Field(..., min_length=1)
    is_internal_note: bool = False
    attachments: list[dict[str, Any]] = Field(default_factory=list)


class SupportTicketUpdateRequest(BaseModel):
    status: str | None = None
    priority: str | None = None
    assigned_agent_id: UUID | None = None
    category: str | None = None


class SupportTicketCSATRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = None


class SupportTicketMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    sender_id: UUID | None = None
    sender_type: str
    message_text: str
    is_internal_note: bool
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime


class SupportTicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    ticket_number: str
    customer_id: UUID | None = None
    customer_email: str
    subject: str
    description: str
    priority: str
    status: str
    category: str
    assigned_agent_id: UUID | None = None
    csat_rating: int | None = None
    csat_comment: str | None = None
    first_response_at: datetime | None = None
    resolved_at: datetime | None = None
    closed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    messages: list[SupportTicketMessageResponse] = Field(default_factory=list)


class KnowledgeBaseArticleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    title: str
    category: str
    content: str
    is_published: bool
    helpful_votes: int
    unhelpful_votes: int
    created_at: datetime
    updated_at: datetime


class SupportMetricsResponse(BaseModel):
    open_tickets_count: int
    resolved_today_count: int
    avg_response_time_minutes: float
    csat_average: float
