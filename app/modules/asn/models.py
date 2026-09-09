from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel


class AdvanceShippingNotice(BaseModel):
    __tablename__ = "advance_shipping_notices"

    asn_number: Mapped[str] = mapped_column(String(30), nullable=False)
    po_id: Mapped[UUID] = mapped_column(ForeignKey("purchase_orders.id"), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    shipment_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_delivery_date: Mapped[date] = mapped_column(Date, nullable=False)
    carrier_name: Mapped[str] = mapped_column(String(100), nullable=False)
    tracking_number: Mapped[str] = mapped_column(String(100), nullable=False)
    vehicle_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    driver_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    driver_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    packaging_type: Mapped[str] = mapped_column(String(30), default="BOX", nullable=False)
    package_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    gross_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", nullable=False)
    barcode_data: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    grn_id: Mapped[UUID | None] = mapped_column(ForeignKey("goods_receipt_notes.id"), nullable=True)
    created_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    lines: Mapped[list[AsnLine]] = relationship("AsnLine", back_populates="asn", cascade="all, delete-orphan")
    po = relationship("PurchaseOrder", foreign_keys=[po_id], lazy="joined")
    vendor = relationship("Vendor", foreign_keys=[vendor_id], lazy="joined")


class AsnLine(BaseModel):
    __tablename__ = "asn_lines"

    asn_id: Mapped[UUID] = mapped_column(ForeignKey("advance_shipping_notices.id"), nullable=False)
    po_line_id: Mapped[UUID] = mapped_column(ForeignKey("po_lines.id"), nullable=False)
    item_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    item_description: Mapped[str] = mapped_column(String(500), nullable=False)
    uom: Mapped[str] = mapped_column(String(20), default="UNIT", nullable=False)
    ordered_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    shipped_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    received_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0"), nullable=False)
    lot_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    serial_numbers: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    manufacturing_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    asn: Mapped[AdvanceShippingNotice] = relationship("AdvanceShippingNotice", back_populates="lines")
    po_line = relationship("PoLine", foreign_keys=[po_line_id], lazy="joined")
