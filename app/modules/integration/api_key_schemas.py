"""Pydantic schemas for tenant API key management and usage.

Module: integration
Layer: schema
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ApiKeyCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    scopes: list[str] = Field(default_factory=lambda: ["read:pr", "read:po", "read:invoice"])
    rate_limit_tier: str = Field(default="STANDARD")
    key_type: str = Field(default="LIVE")
    expires_in_days: int | None = Field(default=None, ge=1, le=365)


class ApiKeyUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=200)
    scopes: list[str] | None = None
    rate_limit_tier: str | None = None
    is_active: bool | None = None


class ApiKeyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    name: str
    key_prefix: str
    key_type: str
    scopes: list[str]
    rate_limit_tier: str
    is_active: bool
    expires_at: datetime | None = None
    last_used_at: datetime | None = None
    total_requests: int = 0
    created_at: datetime


class ApiKeyCreateResponse(ApiKeyResponse):
    raw_key: str


class ApiKeyUsageResponse(BaseModel):
    total_requests_today: int
    total_requests_this_month: int
    error_count: int
    avg_response_ms: float


class ApiKeyLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    endpoint: str
    method: str
    status_code: int
    response_ms: int
    ip_address: str | None = None
    created_at: datetime
