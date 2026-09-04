from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, Numeric, Integer, Date, DateTime, ForeignKey, Text, CHAR
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.sql import func
from app.db.base import BaseModel
from app.db.enums import (
    RfqStatusEnum, RFQ_STATUS_PG,
    RfqTypeEnum, RFQ_TYPE_PG,
    SourcingTypeEnum, SOURCING_TYPE_PG,
    EvaluationTypeEnum, EVALUATION_TYPE_PG,
    ProcurementTypeEnum, PROCUREMENT_TYPE_PG,
)


class Rfq(BaseModel):
    __tablename__ = "rfqs"

    rfq_number: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rfq_type: Mapped[RfqTypeEnum] = mapped_column(RFQ_TYPE_PG, default=RfqTypeEnum.LIMITED_TENDER, nullable=False)
    sourcing_type: Mapped[SourcingTypeEnum] = mapped_column(SOURCING_TYPE_PG, default=SourcingTypeEnum.GOODS, nullable=False)
    evaluation_type: Mapped[EvaluationTypeEnum] = mapped_column(EVALUATION_TYPE_PG, default=EvaluationTypeEnum.L1_PRICE_ONLY, nullable=False)
    procurement_type: Mapped[ProcurementTypeEnum] = mapped_column(PROCUREMENT_TYPE_PG, default=ProcurementTypeEnum.OPEX, nullable=False)
    status: Mapped[RfqStatusEnum] = mapped_column(RFQ_STATUS_PG, default=RfqStatusEnum.DRAFT, nullable=False)
    buyer_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    business_unit_id: Mapped[UUID] = mapped_column(ForeignKey("business_units.id"), nullable=False)
    category_id: Mapped[UUID] = mapped_column(ForeignKey("categories.id"), nullable=False)
    currency: Mapped[str] = mapped_column(CHAR(3), default="INR", nullable=False)
    estimated_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    payment_term_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    incoterm_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    delivery_location_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    # bid_open_at = when bids CAN be opened (the scheduled opening datetime)
    bid_open_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # bid_close_at = submission deadline (bids must be received by this time)
    bid_close_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    technical_close_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    bid_validity_days: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    is_multi_lot: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    lot_participation_mode: Mapped[str] = mapped_column(String(20), default="MANDATORY_ALL", nullable=False)
    is_emergency: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_single_vendor: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    single_vendor_justification: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requires_co_authorization: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    amendment_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    wizard_step: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    wizard_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    linked_pr_ids: Mapped[List[UUID]] = mapped_column(ARRAY(PGUUID(as_uuid=True)), default=list, nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # bids_opened_at = when the dual-auth opening was completed (CRITICAL: used for sealed bid enforcement)
    bids_opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    bids_opened_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    co_authorized_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    # Dual-auth Step 1 fields
    bid_opening_initiated_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    bid_opening_initiated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    # Source PR for conversion tracking
    source_pr_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("requisitions.id"), nullable=True)
    bidding_mode: Mapped[str] = mapped_column(String(32), default="SEALED", nullable=False)
    auction_config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Relationships
    lots: Mapped[List["RfqLot"]] = relationship("RfqLot", back_populates="rfq", lazy="select")
    lines: Mapped[List["RfqLine"]] = relationship("RfqLine", back_populates="rfq", lazy="select")
    participants: Mapped[List["RfqParticipant"]] = relationship("RfqParticipant", back_populates="rfq", lazy="select")
    clarifications: Mapped[List["RfqClarification"]] = relationship("RfqClarification", back_populates="rfq", lazy="select")
    amendments: Mapped[List["RfqAmendment"]] = relationship("RfqAmendment", back_populates="rfq", lazy="select")


class RfqLot(BaseModel):
    __tablename__ = "rfq_lots"

    rfq_id: Mapped[UUID] = mapped_column(ForeignKey("rfqs.id"), nullable=False)
    lot_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estimated_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    payment_term_override_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    incoterm_override_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)

    rfq: Mapped["Rfq"] = relationship("Rfq", back_populates="lots")


class RfqLine(BaseModel):
    __tablename__ = "rfq_lines"

    rfq_id: Mapped[UUID] = mapped_column(ForeignKey("rfqs.id"), nullable=False)
    lot_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("rfq_lots.id"), nullable=True)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    item_description: Mapped[str] = mapped_column(String(500), nullable=False)
    item_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    category_id: Mapped[UUID] = mapped_column(ForeignKey("categories.id"), nullable=False)
    uom_id: Mapped[UUID] = mapped_column(ForeignKey("uom_master.id"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    estimated_unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0"), nullable=False)
    hsn_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    specifications: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    delivery_location_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    required_by_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    rfq: Mapped["Rfq"] = relationship("Rfq", back_populates="lines")


class RfqParticipant(BaseModel):
    __tablename__ = "rfq_participants"

    rfq_id: Mapped[UUID] = mapped_column(ForeignKey("rfqs.id"), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    invited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    invitation_status: Mapped[str] = mapped_column(String(20), default="INVITED", nullable=False)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    regretted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    regret_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    rfq: Mapped["Rfq"] = relationship("Rfq", back_populates="participants")


class RfqClarification(BaseModel):
    __tablename__ = "rfq_clarifications"

    rfq_id: Mapped[UUID] = mapped_column(ForeignKey("rfqs.id"), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    asked_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    asked_by_vendor_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("vendors.id"), nullable=True)
    answered_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    answered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    rfq: Mapped["Rfq"] = relationship("Rfq", back_populates="clarifications")


class RfqAmendment(BaseModel):
    __tablename__ = "rfq_amendments"

    rfq_id: Mapped[UUID] = mapped_column(ForeignKey("rfqs.id"), nullable=False)
    amendment_number: Mapped[int] = mapped_column(Integer, nullable=False)
    changes_summary: Mapped[str] = mapped_column(Text, nullable=False)
    field_changes: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    previous_bid_close_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    new_bid_close_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    bids_reset: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    admin_waiver: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    amended_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    rfq: Mapped["Rfq"] = relationship("Rfq", back_populates="amendments")
