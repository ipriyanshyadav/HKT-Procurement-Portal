from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import CHAR, Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base, BaseModel
from app.db.enums import CONTRACT_STATUS_PG, ContractStatusEnum


class ContractTemplate(BaseModel):
    __tablename__ = "contract_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    contract_type: Mapped[str] = mapped_column(String(50), nullable=False)
    template_content: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(nullable=True)
    updated_by: Mapped[UUID | None] = mapped_column(nullable=True)

class Contract(BaseModel):
    __tablename__ = "contracts"

    contract_number: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    rfq_id: Mapped[UUID | None] = mapped_column(ForeignKey("rfqs.id"), nullable=True)
    arn_id: Mapped[UUID | None] = mapped_column(ForeignKey("award_recommendations.id"), nullable=True)
    status: Mapped[ContractStatusEnum] = mapped_column(CONTRACT_STATUS_PG, default=ContractStatusEnum.DRAFT, nullable=False)
    contract_type: Mapped[str] = mapped_column(String(50), default="RATE_CONTRACT", nullable=False)
    currency: Mapped[str] = mapped_column(CHAR(3), default="INR", nullable=False)
    total_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_term_id: Mapped[UUID | None] = mapped_column(ForeignKey("payment_terms.id"), nullable=True)
    incoterm_id: Mapped[UUID | None] = mapped_column(ForeignKey("incoterms.id"), nullable=True)
    business_unit_id: Mapped[UUID] = mapped_column(ForeignKey("business_units.id"), nullable=False)
    category_id: Mapped[UUID] = mapped_column(ForeignKey("categories.id"), nullable=False)
    template_id: Mapped[UUID | None] = mapped_column(ForeignKey("contract_templates.id"), nullable=True)
    signing_log: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)
    signed_document_id: Mapped[UUID | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    esign_request_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    esign_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    amendment_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    renewal_alert_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    auto_renew: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    erp_contract_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    award_recommendation_id: Mapped[UUID | None] = mapped_column(ForeignKey("award_recommendations.id"), nullable=True)
    contract_document_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    signed_document_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    utilized_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    sla_terms: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    renewal_notice_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    original_contract_id: Mapped[UUID | None] = mapped_column(ForeignKey("contracts.id"), nullable=True)
    created_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    lines: Mapped[list[ContractLine]] = relationship("ContractLine", back_populates="contract", cascade="all, delete-orphan", lazy="selectin")
    milestones: Mapped[list[ContractMilestone]] = relationship("ContractMilestone", back_populates="contract", cascade="all, delete-orphan", lazy="selectin")
    amendments: Mapped[list[ContractAmendment]] = relationship("ContractAmendment", back_populates="contract", cascade="all, delete-orphan", lazy="selectin")
    documents: Mapped[list[ContractDocument]] = relationship("ContractDocument", back_populates="contract", cascade="all, delete-orphan", lazy="selectin")
    clause_instances: Mapped[list[ContractClauseInstance]] = relationship("ContractClauseInstance", back_populates="contract", cascade="all, delete-orphan", lazy="selectin")
    redlines: Mapped[list[ContractRedline]] = relationship("ContractRedline", back_populates="contract", cascade="all, delete-orphan", lazy="selectin")
    esign_sessions: Mapped[list[ContractEsignSession]] = relationship("ContractEsignSession", back_populates="contract", cascade="all, delete-orphan", lazy="selectin")

class ContractLine(BaseModel):
    __tablename__ = "contract_lines"

    contract_id: Mapped[UUID] = mapped_column(ForeignKey("contracts.id"), nullable=False)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    item_description: Mapped[str] = mapped_column(String(500), nullable=False)
    uom_id: Mapped[UUID] = mapped_column(ForeignKey("uom_master.id"), nullable=False)
    contracted_quantity: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    unit_rate: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    utilized_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0"), nullable=False)
    hsn_code: Mapped[str | None] = mapped_column(String(10), nullable=True)

    contract: Mapped[Contract] = relationship("Contract", back_populates="lines")

class ContractDocument(Base):
    __tablename__ = "contract_documents"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(nullable=False)
    contract_id: Mapped[UUID] = mapped_column(ForeignKey("contracts.id"), nullable=False)
    document_id: Mapped[UUID] = mapped_column(ForeignKey("documents.id"), nullable=False)
    document_purpose: Mapped[str] = mapped_column(String(50), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    contract: Mapped[Contract] = relationship("Contract", back_populates="documents")

class ContractAmendment(Base):
    __tablename__ = "contract_amendments"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(nullable=False)
    contract_id: Mapped[UUID] = mapped_column(ForeignKey("contracts.id"), nullable=False)
    amendment_number: Mapped[int] = mapped_column(Integer, nullable=False)
    amendment_type: Mapped[str] = mapped_column(String(50), default="VALUE_CHANGE", nullable=False)
    changes_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    change_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    field_changes: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    original_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    new_document_id: Mapped[UUID | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    amended_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    approved_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    contract: Mapped[Contract] = relationship("Contract", back_populates="amendments")

class ContractMilestone(BaseModel):
    __tablename__ = "contract_milestones"

    contract_id: Mapped[UUID] = mapped_column(ForeignKey("contracts.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    responsible_party: Mapped[str] = mapped_column(String(20), nullable=False)
    responsible_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completion_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    milestone_weight: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)

    contract: Mapped[Contract] = relationship("Contract", back_populates="milestones")


class ContractClause(BaseModel):
    __tablename__ = "contract_clauses"

    clause_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="STANDARD", nullable=False)
    standard_text: Mapped[str] = mapped_column(Text, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), default="MEDIUM", nullable=False)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    guidance_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class ContractClauseInstance(BaseModel):
    __tablename__ = "contract_clause_instances"

    contract_id: Mapped[UUID] = mapped_column(ForeignKey("contracts.id"), nullable=False, index=True)
    clause_id: Mapped[UUID | None] = mapped_column(ForeignKey("contract_clauses.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    current_text: Mapped[str] = mapped_column(Text, nullable=False)
    original_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="ORIGINAL", nullable=False)
    deviation_risk: Mapped[str] = mapped_column(String(20), default="LOW", nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    contract: Mapped[Contract] = relationship("Contract", back_populates="clause_instances")
    clause: Mapped[ContractClause | None] = relationship("ContractClause")
    redlines: Mapped[list[ContractRedline]] = relationship("ContractRedline", back_populates="clause_instance", cascade="all, delete-orphan")


class ContractRedline(BaseModel):
    __tablename__ = "contract_redlines"

    contract_id: Mapped[UUID] = mapped_column(ForeignKey("contracts.id"), nullable=False, index=True)
    clause_instance_id: Mapped[UUID | None] = mapped_column(ForeignKey("contract_clause_instances.id"), nullable=True, index=True)
    author_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    author_type: Mapped[str] = mapped_column(String(20), default="BUYER", nullable=False)
    original_text: Mapped[str] = mapped_column(Text, nullable=False)
    proposed_text: Mapped[str] = mapped_column(Text, nullable=False)
    change_rationale: Mapped[str] = mapped_column(Text, nullable=False)
    diff_summary: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)
    reviewed_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    contract: Mapped[Contract] = relationship("Contract", back_populates="redlines")
    clause_instance: Mapped[ContractClauseInstance | None] = relationship("ContractClauseInstance", back_populates="redlines")


class ContractEsignSession(BaseModel):
    __tablename__ = "contract_esign_sessions"

    contract_id: Mapped[UUID] = mapped_column(ForeignKey("contracts.id"), nullable=False, index=True)
    ceremony_status: Mapped[str] = mapped_column(String(30), default="INITIALIZED", nullable=False)
    signers: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    audit_trail_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    contract: Mapped[Contract] = relationship("Contract", back_populates="esign_sessions")
