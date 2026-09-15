from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base
from app.db.enums import AUDIT_ENTITY_TYPE_PG, AuditEntityTypeEnum


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True, server_default=func.now(), nullable=False)
    org_id: Mapped[UUID] = mapped_column(nullable=False)
    entity_type: Mapped[AuditEntityTypeEnum] = mapped_column(AUDIT_ENTITY_TYPE_PG, nullable=False)
    entity_id: Mapped[UUID] = mapped_column(nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    actor_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    actor_ip: Mapped[str | None] = mapped_column(INET, nullable=True)
    field_changes: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    old_values: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    new_values: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict, nullable=False)
    trace_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
