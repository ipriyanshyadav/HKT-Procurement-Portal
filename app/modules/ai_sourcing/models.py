from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AiRfqDraft(Base):
    __tablename__ = "ai_rfq_drafts"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False)
    pr_id: Mapped[UUID | None] = mapped_column(ForeignKey("requisitions.id", ondelete="SET NULL"), nullable=True)
    rfq_title: Mapped[str] = mapped_column(String(255), nullable=False)
    target_category_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    lots: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    anomaly_flags: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    estimated_total_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="DRAFT", nullable=False)
    converted_rfq_id: Mapped[UUID | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class NegotiationSession(Base):
    __tablename__ = "negotiation_sessions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False)
    rfq_id: Mapped[UUID | None] = mapped_column(nullable=True)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    item_description: Mapped[str] = mapped_column(String(255), nullable=False)
    initial_quote_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    target_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    max_acceptable_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    current_bid_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    bot_status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False)
    current_round: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    max_rounds: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    savings_achieved: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    concession_strategy: Mapped[str] = mapped_column(String(50), default="BALANCED", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    rounds: Mapped[list[NegotiationRound]] = relationship(
        "NegotiationRound",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="NegotiationRound.round_number",
    )


class NegotiationRound(Base):
    __tablename__ = "negotiation_rounds"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("negotiation_sessions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    bidder_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "VENDOR" or "AI_BOT"
    offer_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    counter_offer_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    concession_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    response_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session: Mapped[NegotiationSession] = relationship("NegotiationSession", back_populates="rounds")


class SupplierRadarScore(Base):
    __tablename__ = "supplier_radar_scores"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id", ondelete="CASCADE"), index=True, nullable=False)
    category_id: Mapped[UUID | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    overall_fit_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    quality_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    esg_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    lead_time_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    price_competitiveness_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    recommendation_tier: Mapped[str] = mapped_column(String(30), default="RECOMMENDED", nullable=False)
    insights: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
