"""Admin & Onboarding SQLAlchemy Models — SPEC_27-B.

Layer: model
Tables: onboarding_sessions
"""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseModel


class OnboardingSession(BaseModel):
    """Guided 8-step buyer organization onboarding session."""

    __tablename__ = "onboarding_sessions"

    org_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    initiated_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    current_step: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    completed_steps: Mapped[list[int]] = mapped_column(
        ARRAY(Integer), default=list, nullable=False
    )
    step_data: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, nullable=False
    )
    # IN_PROGRESS | COMPLETED | ABANDONED
    status: Mapped[str] = mapped_column(
        String(20), default="IN_PROGRESS", nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
