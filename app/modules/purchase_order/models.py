from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List
from uuid import UUID, uuid4
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, Numeric, Integer, Date, ForeignKey, Text, CHAR, DateTime, FetchedValue
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import BaseModel, Base
from app.db.enums import PoStatusEnum, PO_STATUS_PG


class PurchaseOrder(BaseModel):
    __tablename__ = "purchase_orders"

    po_number: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    rfq_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("rfqs.id"), nullable=True)
    arn_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("award_recommendations.id"), nullable=True)
    contract_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("contracts.id"), nullable=True)
    status: Mapped[PoStatusEnum] = mapped_column(PO_STATUS_PG, default=PoStatusEnum.DRAFT, nullable=False)
    business_unit_id: Mapped[UUID] = mapped_column(ForeignKey("business_units.id"), nullable=False)
    plant_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("plants.id"), nullable=True)
    category_id: Mapped[UUID] = mapped_column(ForeignKey("categories.id"), nullable=False)
    currency: Mapped[str] = mapped_column(CHAR(3), default="INR", nullable=False)
    total_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    payment_term_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("payment_terms.id"), nullable=True)
    incoterm_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("incoterms.id"), nullable=True)
    delivery_location_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("delivery_locations.id"), nullable=True)
    expected_delivery_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    buyer_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    erp_po_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    erp_sync_status: Mapped[str] = mapped_column(String(20), default="NOT_SYNCED", nullable=False)
    po_pdf_document_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("documents.id"), nullable=True)
    po_document_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    vendor_acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vendor_rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    deviation_justification: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    amendment_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)

    lines: Mapped[List[PoLine]] = relationship("PoLine", back_populates="po", cascade="all, delete-orphan", order_by="PoLine.line_number")
    amendments: Mapped[List[PoAmendment]] = relationship("PoAmendment", back_populates="po", cascade="all, delete-orphan", order_by="PoAmendment.amendment_number")


class PoLine(BaseModel):
    __tablename__ = "po_lines"

    po_id: Mapped[UUID] = mapped_column(ForeignKey("purchase_orders.id"), nullable=False)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    item_description: Mapped[str] = mapped_column(String(500), nullable=False)
    item_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    uom_id: Mapped[UUID] = mapped_column(ForeignKey("uom_master.id"), nullable=False)
    ordered_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    total_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), server_default=FetchedValue(), nullable=True)
    awarded_unit_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    hsn_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    open_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    received_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0"), nullable=False)
    invoiced_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0"), nullable=False)
    delivery_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    po: Mapped[PurchaseOrder] = relationship("PurchaseOrder", back_populates="lines")


class PoAmendment(Base):
    __tablename__ = "po_amendments"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(nullable=False)
    po_id: Mapped[UUID] = mapped_column(ForeignKey("purchase_orders.id"), nullable=False)
    amendment_number: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    field_changes: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    value_change: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    re_approval_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    amended_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    approved_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    po: Mapped[PurchaseOrder] = relationship("PurchaseOrder", back_populates="amendments")
