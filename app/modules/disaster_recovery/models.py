from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseModel


class DRBackupCheckpoint(BaseModel):
    __tablename__ = "dr_backup_checkpoints"

    checkpoint_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="COMPLETED", nullable=False)
    storage_tier: Mapped[str] = mapped_column(String(30), default="HOT_STANDBY", nullable=False)
    storage_location: Mapped[str] = mapped_column(String(500), nullable=False)
    wal_start_lsn: Mapped[str | None] = mapped_column(String(64), nullable=True)
    wal_end_lsn: Mapped[str | None] = mapped_column(String(64), nullable=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    worm_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    worm_retention_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DRFailoverDrill(BaseModel):
    __tablename__ = "dr_failover_drills"

    drill_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    drill_name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_environment: Mapped[str] = mapped_column(String(50), default="SECONDARY_K3S_COLD_STANDBY", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="SCHEDULED", nullable=False)
    simulated_disaster_scenario: Mapped[str] = mapped_column(String(100), nullable=False)
    target_rpo_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    target_rto_minutes: Mapped[int] = mapped_column(Integer, default=240, nullable=False)
    actual_rpo_minutes: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    actual_rto_minutes: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    rpo_compliant: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    rto_compliant: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    initiated_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    drill_phases: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    audit_report: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
