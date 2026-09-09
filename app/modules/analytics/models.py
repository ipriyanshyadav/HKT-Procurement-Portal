from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
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


class CarbonEmissionFactor(BaseModel):
    __tablename__ = "carbon_emission_factors"

    category_id: Mapped[UUID | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    category_name: Mapped[str] = mapped_column(String(100), nullable=False)
    scope1_factor: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("0.0500"), nullable=False)
    scope2_factor: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("0.1200"), nullable=False)
    scope3_factor: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("0.6500"), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    data_source: Mapped[str] = mapped_column(String(100), default="GHG_PROTOCOL_DEFRA_2026", nullable=False)
    effective_year: Mapped[int] = mapped_column(Integer, default=2026, nullable=False)


class SupplierESGMetric(BaseModel):
    __tablename__ = "supplier_esg_metrics"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    environmental_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("70.00"), nullable=False)
    social_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("75.00"), nullable=False)
    governance_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("80.00"), nullable=False)
    composite_esg_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("75.00"), nullable=False)
    esg_rating: Mapped[str] = mapped_column(String(10), default="A", nullable=False)  # AAA, AA, A, BBB, BB, B, CCC
    carbon_intensity_kg_per_spend: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("0.4500"), nullable=False)
    sbti_committed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    net_zero_target_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    iso_14001_certified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    renewable_energy_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"), nullable=False)
    last_audit_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    audit_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

