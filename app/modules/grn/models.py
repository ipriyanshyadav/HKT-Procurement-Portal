from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, Numeric, Date, ForeignKey, Text, DateTime
from sqlalchemy.sql import func
from app.db.base import BaseModel


class GoodsReceiptNote(BaseModel):
    __tablename__ = "goods_receipt_notes"

    grn_number: Mapped[str] = mapped_column(String(30), nullable=False)
    po_id: Mapped[UUID] = mapped_column(ForeignKey("purchase_orders.id"), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    receipt_date: Mapped[date] = mapped_column(Date, nullable=False)
    received_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    challan_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    challan_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    transporter_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    lr_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", nullable=False)
    erp_grn_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    grn_document_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)

    lines: Mapped[List[GrnLine]] = relationship("GrnLine", back_populates="grn", cascade="all, delete-orphan")


class GrnLine(BaseModel):
    __tablename__ = "grn_lines"

    grn_id: Mapped[UUID] = mapped_column(ForeignKey("goods_receipt_notes.id"), nullable=False)
    po_line_id: Mapped[UUID] = mapped_column(ForeignKey("po_lines.id"), nullable=False)
    received_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    accepted_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    rejected_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0"), nullable=False)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    qc_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    qc_status: Mapped[str] = mapped_column(String(20), default="NOT_REQUIRED", nullable=False)
    inspected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    inspected_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)

    grn: Mapped[GoodsReceiptNote] = relationship("GoodsReceiptNote", back_populates="lines")
    inspections: Mapped[List[QualityInspection]] = relationship("QualityInspection", back_populates="grn_line", cascade="all, delete-orphan")


class ServiceEntrySheet(BaseModel):
    __tablename__ = "service_entry_sheets"

    ses_number: Mapped[str] = mapped_column(String(30), nullable=False)
    po_id: Mapped[UUID] = mapped_column(ForeignKey("purchase_orders.id"), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    service_period_start: Mapped[date] = mapped_column(Date, nullable=False)
    service_period_end: Mapped[date] = mapped_column(Date, nullable=False)
    certified_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", nullable=False)
    erp_ses_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)

    lines: Mapped[List[SesLine]] = relationship("SesLine", back_populates="ses", cascade="all, delete-orphan")


class SesLine(BaseModel):
    __tablename__ = "ses_lines"

    ses_id: Mapped[UUID] = mapped_column(ForeignKey("service_entry_sheets.id"), nullable=False)
    po_line_id: Mapped[UUID] = mapped_column(ForeignKey("po_lines.id"), nullable=False)
    service_description: Mapped[str] = mapped_column(String(500), nullable=False)
    completed_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    completion_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("100.00"), nullable=False)

    ses: Mapped[ServiceEntrySheet] = relationship("ServiceEntrySheet", back_populates="lines")


class QualityInspection(BaseModel):
    __tablename__ = "quality_inspections"

    grn_line_id: Mapped[UUID] = mapped_column(ForeignKey("grn_lines.id"), nullable=False)
    inspector_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    inspection_date: Mapped[date] = mapped_column(Date, nullable=False)
    result: Mapped[str] = mapped_column(String(20), nullable=False)
    accepted_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    rejected_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0"), nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    grn_line: Mapped[GrnLine] = relationship("GrnLine", back_populates="inspections")
