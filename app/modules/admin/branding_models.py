"""SQLAlchemy model for tenant branding and white-label theming.

Module: admin
Layer: model
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class TenantBranding(Base):
    __tablename__ = "tenant_brandings"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), unique=True, nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    favicon_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    primary_color: Mapped[str] = mapped_column(String(20), default="#2563eb", nullable=False)
    primary_color_dark: Mapped[str] = mapped_column(String(20), default="#1d4ed8", nullable=False)
    secondary_color: Mapped[str] = mapped_column(String(20), default="#f59e0b", nullable=False)
    company_display_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    portal_title_suffix: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email_sender_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email_sender_domain: Mapped[str | None] = mapped_column(String(200), nullable=True)
    custom_domain: Mapped[str | None] = mapped_column(String(200), nullable=True)
    custom_domain_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    login_page_headline: Mapped[str | None] = mapped_column(String(300), nullable=True)
    login_page_subheading: Mapped[str | None] = mapped_column(String(500), nullable=True)
    footer_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    support_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    help_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
