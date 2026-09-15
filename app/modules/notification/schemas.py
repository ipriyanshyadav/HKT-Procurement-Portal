from __future__ import annotations

from datetime import datetime, time
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.db.enums import NotificationChannelEnum, NotificationStatusEnum


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    user_id: UUID
    notification_type: str
    channel: NotificationChannelEnum
    title: str
    body: str
    entity_type: str | None = None
    entity_id: UUID | None = None
    status: NotificationStatusEnum
    sent_at: datetime | None = None
    delivered_at: datetime | None = None
    read_at: datetime | None = None
    error_message: str | None = None
    retry_count: int = 0
    created_at: datetime
    is_read: bool = False

class NotificationPreferenceItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    notification_type: str
    email_enabled: bool = True
    sms_enabled: bool = False
    inapp_enabled: bool = True
    digest_mode: bool = False
    quiet_hours_start: time | None = None
    quiet_hours_end: time | None = None

class NotificationPreferencesResponse(BaseModel):
    preferences: list[NotificationPreferenceItem]

class NotificationPreferencesUpdateRequest(BaseModel):
    preferences: list[NotificationPreferenceItem]

class NotificationSendRequest(BaseModel):
    user_id: UUID
    notification_type: str
    title: str
    body: str
    channel: NotificationChannelEnum | None = None
    entity_type: str | None = None
    entity_id: UUID | None = None
    context: dict[str, Any] | None = None

class NotificationTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID | None = None
    template_code: str
    channel: NotificationChannelEnum
    language: str
    subject_template: str | None = None
    body_template: str
    variables: list[str] = Field(default_factory=list)
    is_active: bool = True
    created_at: datetime | None = None
    updated_at: datetime | None = None

class NotificationTemplateCreateRequest(BaseModel):
    template_code: str = Field(..., min_length=2, max_length=100)
    channel: NotificationChannelEnum
    language: str = Field(default="en", max_length=5)
    subject_template: str | None = Field(default=None, max_length=500)
    body_template: str = Field(..., min_length=1)
    variables: list[str] = Field(default_factory=list)
    is_active: bool = True

class NotificationTemplateUpdateRequest(BaseModel):
    language: str | None = Field(default=None, max_length=5)
    subject_template: str | None = Field(default=None, max_length=500)
    body_template: str | None = None
    variables: list[str] | None = None
    is_active: bool | None = None

class NotificationTemplatePreviewRequest(BaseModel):
    subject_template: str | None = None
    body_template: str
    context: dict[str, Any] = Field(default_factory=dict)

class NotificationTemplatePreviewResponse(BaseModel):
    rendered_subject: str | None = None
    rendered_body: str
    detected_variables: list[str] = Field(default_factory=list)

