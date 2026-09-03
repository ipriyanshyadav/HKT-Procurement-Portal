from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, Numeric, Integer, ForeignKey, Text
from sqlalchemy.sql import func
from app.db.base import BaseModel, Base
from app.db.enums import EvaluationTypeEnum, EVALUATION_TYPE_PG

class Evaluation(BaseModel):
    __tablename__ = "evaluations"

    rfq_id: Mapped[UUID] = mapped_column(ForeignKey("rfqs.id"), nullable=False)
    evaluation_type: Mapped[EvaluationTypeEnum] = mapped_column(EVALUATION_TYPE_PG, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="IN_PROGRESS", nullable=False)
    evaluated_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

class EvaluationScore(BaseModel):
    __tablename__ = "evaluation_scores"

    evaluation_id: Mapped[UUID] = mapped_column(ForeignKey("evaluations.id"), nullable=False)
    bid_id: Mapped[UUID] = mapped_column(ForeignKey("bid_responses.id"), nullable=False)
    criterion: Mapped[str] = mapped_column(String(200), nullable=False)
    max_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    awarded_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scored_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

class ComparativeStatement(BaseModel):
    __tablename__ = "comparative_statements"

    rfq_id: Mapped[UUID] = mapped_column(ForeignKey("rfqs.id"), nullable=False)
    cs_number: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", nullable=False)
    cost_of_capital_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    evaluation_methodology: Mapped[str] = mapped_column(Text, nullable=False)
    total_estimated_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    l1_total_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    savings_percentage: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    recommendations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    generated_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    approved_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    pdf_document_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("documents.id"), nullable=True)
    cs_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

class CsLineRanking(Base):
    __tablename__ = "cs_line_rankings"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(nullable=False)
    cs_id: Mapped[UUID] = mapped_column(ForeignKey("comparative_statements.id"), nullable=False)
    rfq_line_id: Mapped[UUID] = mapped_column(ForeignKey("rfq_lines.id"), nullable=False)
    bid_id: Mapped[UUID] = mapped_column(ForeignKey("bid_responses.id"), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    raw_unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    freight_per_unit: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0"), nullable=False)
    tax_per_unit: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0"), nullable=False)
    landed_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    npv_adjusted_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_discrepancy: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    supplier_declared_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    hsn_master_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    tie_breaking_applied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tie_breaking_reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

class Negotiation(BaseModel):
    __tablename__ = "negotiations"

    rfq_id: Mapped[UUID] = mapped_column(ForeignKey("rfqs.id"), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    round_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    proposed_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    counter_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="OPEN", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    negotiated_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

class AwardRecommendation(BaseModel):
    __tablename__ = "award_recommendations"

    rfq_id: Mapped[UUID] = mapped_column(ForeignKey("rfqs.id"), nullable=False)
    cs_id: Mapped[UUID] = mapped_column(ForeignKey("comparative_statements.id"), nullable=False)
    arn_number: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", nullable=False)
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    recommended_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    approved_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

class AwardDetail(Base):
    __tablename__ = "award_details"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(nullable=False)
    arn_id: Mapped[UUID] = mapped_column(ForeignKey("award_recommendations.id"), nullable=False)
    rfq_line_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("rfq_lines.id"), nullable=True)
    lot_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("rfq_lots.id"), nullable=True)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    bid_id: Mapped[UUID] = mapped_column(ForeignKey("bid_responses.id"), nullable=False)
    awarded_unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    awarded_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    awarded_total: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    award_type: Mapped[str] = mapped_column(String(20), default="FULL", nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
