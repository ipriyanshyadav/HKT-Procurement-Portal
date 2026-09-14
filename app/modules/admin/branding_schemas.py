"""Pydantic schemas for tenant white-label branding.

Module: admin
Layer: schema
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TenantBrandingUpdateRequest(BaseModel):
    logo_url: str | None = None
    favicon_url: str | None = None
    primary_color: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")
    primary_color_dark: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")
    secondary_color: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")
    company_display_name: str | None = Field(None, max_length=200)
    portal_title_suffix: str | None = Field(None, max_length=200)
    email_sender_name: str | None = Field(None, max_length=200)
    email_sender_domain: str | None = Field(None, max_length=200)
    custom_domain: str | None = Field(None, max_length=200)
    login_page_headline: str | None = Field(None, max_length=300)
    login_page_subheading: str | None = Field(None, max_length=500)
    footer_text: str | None = Field(None, max_length=500)
    support_email: str | None = Field(None, max_length=255)
    help_url: str | None = Field(None, max_length=500)


class TenantBrandingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    logo_url: str | None = None
    favicon_url: str | None = None
    primary_color: str
    primary_color_dark: str
    secondary_color: str
    company_display_name: str | None = None
    portal_title_suffix: str | None = None
    email_sender_name: str | None = None
    email_sender_domain: str | None = None
    custom_domain: str | None = None
    custom_domain_verified: bool
    login_page_headline: str | None = None
    login_page_subheading: str | None = None
    footer_text: str | None = None
    support_email: str | None = None
    help_url: str | None = None
    updated_at: datetime


class PublicBrandingResponse(BaseModel):
    logo_url: str | None = None
    favicon_url: str | None = None
    primary_color: str = "#2563eb"
    company_display_name: str | None = None
    login_page_headline: str | None = None
    login_page_subheading: str | None = None
