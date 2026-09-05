from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from uuid import UUID, uuid4
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, Numeric, Integer, Date, ForeignKey, Text, CHAR
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.sql import func
from app.db.base import BaseModel, Base
from app.db.enums import (
    InvoiceStatusEnum, INVOICE_STATUS_PG,
    PaymentStatusEnum, PAYMENT_STATUS_PG,
)

class Invoice(BaseModel):
    __tablename__ = "invoices"

    invoice_number: Mapped[str] = mapped_column(String(50), nullable=False)
    vendor_invoice_number: Mapped[str] = mapped_column(String(50), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    po_id: Mapped[UUID] = mapped_column(ForeignKey("purchase_orders.id"), nullable=False)
    status: Mapped[InvoiceStatusEnum] = mapped_column(INVOICE_STATUS_PG, default=InvoiceStatusEnum.DRAFT, nullable=False)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    currency: Mapped[str] = mapped_column(CHAR(3), default="INR", nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    tds_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=True)
    financial_year: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    payment_terms_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    match_status: Mapped[str] = mapped_column(String(20), default="NOT_MATCHED", nullable=False)
    price_tolerance: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=Decimal("0.0050"), nullable=False)
    erp_invoice_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    erp_sync_status: Mapped[str] = mapped_column(String(20), default="NOT_SYNCED", nullable=False)
    payment_status: Mapped[PaymentStatusEnum] = mapped_column(PAYMENT_STATUS_PG, default=PaymentStatusEnum.PENDING, nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)

    lines: Mapped[List[InvoiceLine]] = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan", lazy="selectin")
    match_results: Mapped[List[InvoiceMatchResult]] = relationship("InvoiceMatchResult", back_populates="invoice", cascade="all, delete-orphan", lazy="selectin")


class InvoiceLine(BaseModel):
    __tablename__ = "invoice_lines"

    invoice_id: Mapped[UUID] = mapped_column(ForeignKey("invoices.id"), nullable=False)
    po_line_id: Mapped[UUID] = mapped_column(ForeignKey("po_lines.id"), nullable=False)
    grn_line_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("grn_lines.id"), nullable=True)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    item_description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)

    invoice: Mapped[Invoice] = relationship("Invoice", back_populates="lines")


class InvoiceMatchResult(Base):
    __tablename__ = "invoice_match_results"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(nullable=False)
    invoice_id: Mapped[UUID] = mapped_column(ForeignKey("invoices.id"), nullable=False)
    invoice_line_id: Mapped[UUID] = mapped_column(ForeignKey("invoice_lines.id"), nullable=False)
    po_line_id: Mapped[UUID] = mapped_column(ForeignKey("po_lines.id"), nullable=False)
    price_match: Mapped[bool] = mapped_column(Boolean, nullable=False)
    price_deviation: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    quantity_match: Mapped[bool] = mapped_column(Boolean, nullable=False)
    quantity_deviation: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    po_reference_valid: Mapped[bool] = mapped_column(Boolean, nullable=False)
    tax_match: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    tax_deviation: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    overall_match: Mapped[bool] = mapped_column(Boolean, nullable=False)
    mismatch_reasons: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    invoice: Mapped[Invoice] = relationship("Invoice", back_populates="match_results")
