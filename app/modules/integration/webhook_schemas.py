"""Pydantic schemas for webhook management and delivery logs.

Module: integration
Layer: schema
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WebhookCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    url: str = Field(min_length=8, max_length=2000)
    subscribed_events: list[str] = Field(min_length=1)
    custom_headers: dict = Field(default_factory=dict)
    ip_allowlist: list[str] = Field(default_factory=list)
    max_retries: int = Field(default=5, ge=1, le=10)
    timeout_seconds: int = Field(default=30, ge=5, le=120)


class WebhookUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=200)
    url: str | None = Field(None, min_length=8, max_length=2000)
    subscribed_events: list[str] | None = None
    is_active: bool | None = None
    custom_headers: dict | None = None
    ip_allowlist: list[str] | None = None
    max_retries: int | None = Field(None, ge=1, le=10)
    timeout_seconds: int | None = Field(None, ge=5, le=120)


class WebhookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    name: str
    url: str
    secret_hint: str | None = None
    subscribed_events: list[str]
    is_active: bool
    max_retries: int
    timeout_seconds: int
    total_deliveries: int
    failed_deliveries: int
    last_delivery_at: datetime | None = None
    last_delivery_status: str | None = None
    created_at: datetime
    updated_at: datetime


class WebhookCreateResponse(WebhookResponse):
    raw_secret: str


class WebhookDeliveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_type: str
    payload: dict
    response_status: int | None = None
    response_body: str | None = None
    attempt_number: int
    delivered_at: datetime | None = None
    duration_ms: int | None = None
    is_success: bool | None = None
    error_message: str | None = None
    created_at: datetime


class WebhookTestResponse(BaseModel):
    is_success: bool
    response_status: int
    duration_ms: int
    message: str
