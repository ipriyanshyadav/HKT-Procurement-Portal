from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any
from uuid import UUID, uuid4
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, Numeric, Integer, Date, ForeignKey, Text, CHAR
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
    payment_terms_proposed_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("payment_terms.id"), nullable=True)
    commercial_deviations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    bid_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    bid_sealed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    bid_opened_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    technical_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    is_technically_qualified: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    current_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

class BidLineResponse(BaseModel):
    __tablename__ = "bid_line_responses"

    bid_id: Mapped[UUID] = mapped_column(ForeignKey("bid_responses.id"), nullable=False)
    rfq_line_id: Mapped[UUID] = mapped_column(ForeignKey("rfq_lines.id"), nullable=False)
    lot_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("rfq_lots.id"), nullable=True)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    tax_rate_declared: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    freight_quoted: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    delivery_lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False)
    country_of_origin: Mapped[str] = mapped_column(CHAR(2), default="IN", nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

class BidVersion(Base):
    __tablename__ = "bid_versions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(nullable=False)
    bid_id: Mapped[UUID] = mapped_column(ForeignKey("bid_responses.id"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    version_data: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    bid_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    versioned_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

class BidDocument(Base):
    __tablename__ = "bid_documents"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(nullable=False)
    bid_id: Mapped[UUID] = mapped_column(ForeignKey("bid_responses.id"), nullable=False)
    document_id: Mapped[UUID] = mapped_column(ForeignKey("documents.id"), nullable=False)
    document_type: Mapped[str] = mapped_column(String(20), nullable=False)
    is_technical: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
