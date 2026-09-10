from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ApiKeyCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    scopes: list[str] = Field(default_factory=list)
    ip_allowlist: list[str] = Field(default_factory=list)
    rate_limit_rpm: int = Field(default=120, ge=10, le=1000)
    expires_in_days: int | None = Field(default=90, ge=1, le=365)


class ApiKeyCreatedResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    key_prefix: str
    key_secret: str  # Raw secret key — shown ONLY ONCE upon creation
    scopes: list[str]
    ip_allowlist: list[str]
    rate_limit_rpm: int
    status: str
    expires_at: datetime | None = None
    created_at: datetime


class ApiKeyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    key_prefix: str
    scopes: list[str]
    ip_allowlist: list[str]
    rate_limit_rpm: int
    status: str
    expires_at: datetime | None = None
    last_used_at: datetime | None = None
    last_used_ip: str | None = None
    total_requests: int
    created_at: datetime


class ApiKeyRevokeRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=255)


class WebhookSubscriptionCreateRequest(BaseModel):
    endpoint_url: str = Field(..., min_length=10, max_length=500)
    description: str | None = Field(default=None, max_length=255)
    subscribed_events: list[str] = Field(..., min_length=1)


class WebhookSubscriptionUpdateRequest(BaseModel):
    endpoint_url: str | None = Field(default=None, min_length=10, max_length=500)
    description: str | None = Field(default=None, max_length=255)
    subscribed_events: list[str] | None = None
    is_active: bool | None = None


class WebhookSubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    endpoint_url: str
    secret_token: str
    description: str | None = None
    subscribed_events: list[str]
    is_active: bool
    failure_count: int
    last_delivery_at: datetime | None = None
    last_delivery_status: int | None = None
    created_at: datetime
    updated_at: datetime


class WebhookTestPingRequest(BaseModel):
    event_type: str = Field(default="ping.test")
    custom_payload: dict[str, Any] | None = None


class WebhookDeliveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    subscription_id: UUID
    event_type: str
    payload: dict[str, Any]
    response_status_code: int | None = None
    execution_time_ms: int | None = None
    is_success: bool
    attempt_number: int
    error_message: str | None = None
    created_at: datetime
