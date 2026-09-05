from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from uuid import UUID, uuid4
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Numeric, Date, ForeignKey, Text, CHAR, DateTime
from sqlalchemy.dialects.postgresql import ARRAY, UUID as PGUUID
from sqlalchemy.sql import func
from app.db.base import BaseModel, Base
from app.db.enums import PaymentStatusEnum, PAYMENT_STATUS_PG

class PaymentRecord(BaseModel):
    __tablename__ = "payment_records"

    invoice_id: Mapped[UUID] = mapped_column(ForeignKey("invoices.id"), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    gross_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=True)
    tds_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=True)
    net_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=True)
    payment_due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    currency: Mapped[str] = mapped_column(CHAR(3), default="INR", nullable=False)
    utr_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    erp_payment_reference: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[PaymentStatusEnum] = mapped_column(PAYMENT_STATUS_PG, default=PaymentStatusEnum.COMPLETED, nullable=False)

class Dispute(BaseModel):
    __tablename__ = "disputes"

    invoice_id: Mapped[UUID] = mapped_column(ForeignKey("invoices.id"), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    reason_code: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="OPEN", nullable=False)
    raised_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    resolved_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolution_action: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    credit_note_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    messages: Mapped[List[DisputeMessage]] = relationship("DisputeMessage", back_populates="dispute", cascade="all, delete-orphan", lazy="selectin")

class DisputeMessage(Base):
    __tablename__ = "dispute_messages"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(nullable=False)
    dispute_id: Mapped[UUID] = mapped_column(ForeignKey("disputes.id"), nullable=False)
    sender_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    attachments: Mapped[Optional[List[UUID]]] = mapped_column(ARRAY(PGUUID(as_uuid=True)), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    dispute: Mapped[Dispute] = relationship("Dispute", back_populates="messages")
