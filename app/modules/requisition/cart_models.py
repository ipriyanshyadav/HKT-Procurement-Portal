"""Indent Cart SQLAlchemy models — server-side cart for Indentor role.

Layer: model (no imports from router, service, or repository).
Tables: indent_carts, indent_cart_items
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel


class IndentCart(BaseModel):
    """One active indent cart per indentor. Status lifecycle:
    ACTIVE → TRANSFERRED (creates Requisition with is_indent=True)
    ACTIVE → ABANDONED   (indentor explicitly clears cart)
    ACTIVE → EXPIRED     (Celery purge after settings.INDENT_CART_EXPIRY_DAYS)
    """

    __tablename__ = "indent_carts"

    indentor_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cart_name: Mapped[str] = mapped_column(String(200), nullable=False, default="My Cart")
    # ACTIVE | TRANSFERRED | ABANDONED | EXPIRED
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    assigned_buyer_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    transfer_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    transferred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    business_unit_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("business_units.id", ondelete="SET NULL"), nullable=True
    )
    cost_center_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("cost_centers.id", ondelete="SET NULL"), nullable=True
    )
    delivery_location_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("delivery_locations.id", ondelete="SET NULL"), nullable=True
    )
    required_by_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    items: Mapped[list[IndentCartItem]] = relationship(
        "IndentCartItem",
        back_populates="cart",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="IndentCartItem.line_number",
    )


class IndentCartItem(BaseModel):
    """A single line within an indent cart. May come from catalog or be manually entered."""

    __tablename__ = "indent_cart_items"

    cart_id: Mapped[UUID] = mapped_column(
        ForeignKey("indent_carts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    catalog_item_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
    )
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    item_description: Mapped[str] = mapped_column(String(500), nullable=False)
    item_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    category_id: Mapped[UUID] = mapped_column(
        ForeignKey("categories.id"), nullable=False
    )
    uom_id: Mapped[UUID] = mapped_column(ForeignKey("uom_master.id"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    estimated_unit_price: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=Decimal("0.0")
    )
    hsn_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    specifications: Mapped[str | None] = mapped_column(Text, nullable=True)
    required_by_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    delivery_location_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("delivery_locations.id", ondelete="SET NULL"), nullable=True
    )
    is_from_catalog: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    cart: Mapped[IndentCart] = relationship("IndentCart", back_populates="items")
