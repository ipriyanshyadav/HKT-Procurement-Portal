from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List
from uuid import UUID, uuid4
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, Numeric, Integer, Date, ForeignKey, Text, CHAR, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import BaseModel, Base
from app.db.enums import ContractStatusEnum, CONTRACT_STATUS_PG

class ContractTemplate(BaseModel):
    __tablename__ = "contract_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    contract_type: Mapped[str] = mapped_column(String(50), nullable=False)
    template_content: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    updated_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)

class Contract(BaseModel):
    __tablename__ = "contracts"

    contract_number: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    rfq_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("rfqs.id"), nullable=True)
    arn_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("award_recommendations.id"), nullable=True)
    status: Mapped[ContractStatusEnum] = mapped_column(CONTRACT_STATUS_PG, default=ContractStatusEnum.DRAFT, nullable=False)
    contract_type: Mapped[str] = mapped_column(String(50), default="RATE_CONTRACT", nullable=False)
    currency: Mapped[str] = mapped_column(CHAR(3), default="INR", nullable=False)
    total_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_term_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("payment_terms.id"), nullable=True)
    incoterm_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("incoterms.id"), nullable=True)
    business_unit_id: Mapped[UUID] = mapped_column(ForeignKey("business_units.id"), nullable=False)
    category_id: Mapped[UUID] = mapped_column(ForeignKey("categories.id"), nullable=False)
    template_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("contract_templates.id"), nullable=True)
    signing_log: Mapped[List[Any]] = mapped_column(JSONB, default=list, nullable=False)
    signed_document_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("documents.id"), nullable=True)
    esign_request_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    esign_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    amendment_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    renewal_alert_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    auto_renew: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    erp_contract_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    award_recommendation_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("award_recommendations.id"), nullable=True)
    contract_document_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    signed_document_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    utilized_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    sla_terms: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    renewal_notice_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    original_contract_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("contracts.id"), nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)

    lines: Mapped[List[ContractLine]] = relationship("ContractLine", back_populates="contract", cascade="all, delete-orphan", lazy="selectin")
    milestones: Mapped[List[ContractMilestone]] = relationship("ContractMilestone", back_populates="contract", cascade="all, delete-orphan", lazy="selectin")
    amendments: Mapped[List[ContractAmendment]] = relationship("ContractAmendment", back_populates="contract", cascade="all, delete-orphan", lazy="selectin")
    documents: Mapped[List[ContractDocument]] = relationship("ContractDocument", back_populates="contract", cascade="all, delete-orphan", lazy="selectin")

class ContractLine(BaseModel):
    __tablename__ = "contract_lines"

    contract_id: Mapped[UUID] = mapped_column(ForeignKey("contracts.id"), nullable=False)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    item_description: Mapped[str] = mapped_column(String(500), nullable=False)
    uom_id: Mapped[UUID] = mapped_column(ForeignKey("uom_master.id"), nullable=False)
    contracted_quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    unit_rate: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    utilized_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0"), nullable=False)
    hsn_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

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
    changes_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    change_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    field_changes: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    original_snapshot: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    new_document_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("documents.id"), nullable=True)
    amended_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    approved_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    contract: Mapped[Contract] = relationship("Contract", back_populates="amendments")

class ContractMilestone(BaseModel):
    __tablename__ = "contract_milestones"

    contract_id: Mapped[UUID] = mapped_column(ForeignKey("contracts.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    responsible_party: Mapped[str] = mapped_column(String(20), nullable=False)
    responsible_user_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completion_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    milestone_weight: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)

    contract: Mapped[Contract] = relationship("Contract", back_populates="milestones")
