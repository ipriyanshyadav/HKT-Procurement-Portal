from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class EInvoice(Base):
    __tablename__ = "e_invoices"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False)
    invoice_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("invoices.id", ondelete="SET NULL"), index=True, nullable=True
    )
    asn_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("advance_shipping_notices.id", ondelete="SET NULL"), index=True, nullable=True
    )
    seller_gstin: Mapped[str] = mapped_column(String(15), nullable=False)
    buyer_gstin: Mapped[str] = mapped_column(String(15), nullable=False)
    doc_number: Mapped[str] = mapped_column(String(50), nullable=False)
    doc_type: Mapped[str] = mapped_column(String(10), default="INV", nullable=False)
    financial_year: Mapped[str] = mapped_column(String(10), nullable=False)
    irn: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    ack_number: Mapped[str] = mapped_column(String(30), nullable=False)
    ack_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    total_invoice_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    total_tax_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    signed_invoice: Mapped[str] = mapped_column(Text, nullable=False)
    signed_qr_code: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="GENERATED", nullable=False)
    cancellation_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    peppol_xml: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    e_way_bills: Mapped[list[EWayBill]] = relationship(
        "EWayBill", back_populates="e_invoice", cascade="all, delete-orphan"
    )


class EWayBill(Base):
    __tablename__ = "e_way_bills"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False)
    e_invoice_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("e_invoices.id", ondelete="CASCADE"), index=True, nullable=True
    )
    asn_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("advance_shipping_notices.id", ondelete="SET NULL"), index=True, nullable=True
    )
    ewb_number: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    ewb_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    transporter_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    transporter_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    vehicle_number: Mapped[str] = mapped_column(String(20), nullable=False)
    distance_km: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    from_pincode: Mapped[str] = mapped_column(String(10), nullable=False)
    to_pincode: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    e_invoice: Mapped[EInvoice | None] = relationship("EInvoice", back_populates="e_way_bills")
