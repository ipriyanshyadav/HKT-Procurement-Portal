from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseModel


class MaverickSpendCluster(BaseModel):
    __tablename__ = "maverick_spend_clusters"

    cluster_type: Mapped[str] = mapped_column(String(50), nullable=False)
    cluster_title: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="MEDIUM", nullable=False)
    affected_spend: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    potential_savings: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    affected_entity_ids: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)
    root_cause_analysis: Mapped[str] = mapped_column(Text, nullable=False)
    ai_recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="DETECTED", nullable=False)
