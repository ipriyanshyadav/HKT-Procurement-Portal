from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List
from uuid import UUID, uuid4
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, Numeric, Integer, Date, DateTime, ForeignKey, Text, CHAR
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import BaseModel, Base
from app.db.enums import BidStatusEnum, BID_STATUS_PG


class BidResponse(BaseModel):
    __tablename__ = "bid_responses"

    rfq_id: Mapped[UUID] = mapped_column(ForeignKey("rfqs.id"), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    status: Mapped[BidStatusEnum] = mapped_column(BID_STATUS_PG, default=BidStatusEnum.INVITED, nullable=False)
    bid_validity_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    covering_letter: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payment_terms_proposed_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    commercial_deviations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Encrypted total — decrypted only after bids_opened_at IS NOT NULL on parent RFQ
    total_amount_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Plaintext total (set only after opening for display)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    bid_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    bid_sealed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    bid_opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    technical_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    is_technically_qualified: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    current_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Bid revision / commercial metadata
    has_deviations: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deviation_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    technical_offer_compliant: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    payment_terms_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    delivery_terms_incoterm: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    bid_validity_days: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    is_single_vendor_situation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    lines: Mapped[List["BidLineResponse"]] = relationship("BidLineResponse", back_populates="bid", lazy="select")


class BidLineResponse(BaseModel):
    __tablename__ = "bid_line_responses"

    bid_id: Mapped[UUID] = mapped_column(ForeignKey("bid_responses.id"), nullable=False)
    rfq_line_id: Mapped[UUID] = mapped_column(ForeignKey("rfq_lines.id"), nullable=False)
    lot_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("rfq_lots.id"), nullable=True)
    # Encrypted price fields — SPEC_11 A-11-1
    unit_price_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    total_price_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Normalized INR price set at bid opening
    normalized_price_inr: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    exchange_rate_used: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 6), nullable=True)
    currency: Mapped[str] = mapped_column(CHAR(3), default="INR", nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0"), nullable=False)
    delivery_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tax_rate_declared: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    freight_quoted: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    country_of_origin: Mapped[str] = mapped_column(CHAR(2), default="IN", nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    bid: Mapped["BidResponse"] = relationship("BidResponse", back_populates="lines")


class BidVersion(Base):
    __tablename__ = "bid_versions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(nullable=False)
    bid_id: Mapped[UUID] = mapped_column(ForeignKey("bid_responses.id"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    # Snapshot encrypted per A-11-1
    snapshot_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    bid_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    versioned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class BidDocument(Base):
    __tablename__ = "bid_documents"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(nullable=False)
    bid_id: Mapped[UUID] = mapped_column(ForeignKey("bid_responses.id"), nullable=False)
    document_id: Mapped[UUID] = mapped_column(nullable=False)
    document_type: Mapped[str] = mapped_column(String(20), nullable=False)
    is_technical: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
