from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CHAR, Boolean, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base, BaseModel
from app.db.enums import PAYMENT_STATUS_PG, PaymentStatusEnum


class PaymentGatewayConfig(BaseModel):
    __tablename__ = "payment_gateway_config"

    razorpay_key_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    razorpay_secret: Mapped[str | None] = mapped_column(Text, nullable=True)
    stripe_pub_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    stripe_secret: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_provider: Mapped[str] = mapped_column(String(20), default="RAZORPAY", nullable=False)
    auto_pay_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    webhook_secret: Mapped[str | None] = mapped_column(Text, nullable=True)


class PaymentRecord(BaseModel):
    __tablename__ = "payment_records"

    invoice_id: Mapped[UUID] = mapped_column(ForeignKey("invoices.id"), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    gross_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=True)
    tds_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=True)
    net_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=True)
    discount_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=True)
    payment_due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    currency: Mapped[str] = mapped_column(CHAR(3), default="INR", nullable=False)
    utr_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(30), nullable=True)
    erp_payment_reference: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[PaymentStatusEnum] = mapped_column(PAYMENT_STATUS_PG, default=PaymentStatusEnum.COMPLETED, nullable=False)

    # Online Payment Gateway Integration (SPEC 27-J)
    gateway_provider: Mapped[str | None] = mapped_column(String(20), nullable=True)
    gateway_order_id: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    gateway_payment_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    gateway_signature: Mapped[str | None] = mapped_column(String(500), nullable=True)
    gateway_fee: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    gateway_fee_currency: Mapped[str | None] = mapped_column(String(3), default="INR", nullable=True)
    gateway_response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    refund_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refund_amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    refund_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_link_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    payment_link_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class Dispute(BaseModel):
    __tablename__ = "disputes"

    invoice_id: Mapped[UUID] = mapped_column(ForeignKey("invoices.id"), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    reason_code: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="OPEN", nullable=False)
    raised_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    resolved_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution_action: Mapped[str | None] = mapped_column(String(30), nullable=True)
    credit_note_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    messages: Mapped[list[DisputeMessage]] = relationship("DisputeMessage", back_populates="dispute", cascade="all, delete-orphan", lazy="selectin")

class DisputeMessage(Base):
    __tablename__ = "dispute_messages"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(nullable=False)
    dispute_id: Mapped[UUID] = mapped_column(ForeignKey("disputes.id"), nullable=False)
    sender_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    attachments: Mapped[list[UUID] | None] = mapped_column(ARRAY(PGUUID(as_uuid=True)), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    dispute: Mapped[Dispute] = relationship("Dispute", back_populates="messages")
