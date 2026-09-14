"""Pydantic schemas for multi-org company switcher.

Module: admin / auth
Layer: schema
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OrgMembershipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    org_name: str
    org_slug: str | None = None
    logo_url: str | None = None
    roles: list[str] = Field(default_factory=list)
    is_primary: bool = False
    is_current: bool = False


class SwitchOrgRequest(BaseModel):
    org_id: UUID


class SwitchOrgResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    org_id: UUID
    org_name: str
    roles: list[str] = Field(default_factory=list)


class UserOrgInviteRequest(BaseModel):
    email: EmailStr
    org_id: UUID
    roles: list[str] = Field(default_factory=lambda: ["REQUESTOR"])


class UserOrgMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    membership_id: UUID
    user_id: UUID
    email: str
    full_name: str
    roles: list[str]
    is_primary: bool
    status: str
    joined_at: datetime | None
