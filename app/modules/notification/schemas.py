from __future__ import annotations
from datetime import datetime, time
from typing import Optional, List, Any
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
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    status: NotificationStatusEnum
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    error_message: Optional[str] = None
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
    quiet_hours_start: Optional[time] = None
    quiet_hours_end: Optional[time] = None

class NotificationPreferencesResponse(BaseModel):
    preferences: List[NotificationPreferenceItem]

class NotificationPreferencesUpdateRequest(BaseModel):
    preferences: List[NotificationPreferenceItem]

class NotificationSendRequest(BaseModel):
    user_id: UUID
    notification_type: str
    title: str
    body: str
    channel: Optional[NotificationChannelEnum] = None
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    context: Optional[dict[str, Any]] = None

class NotificationTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    template_code: str
    channel: NotificationChannelEnum
    language: str
    subject_template: Optional[str] = None
    body_template: str
    variables: List[str] = Field(default_factory=list)
    is_active: bool = True
