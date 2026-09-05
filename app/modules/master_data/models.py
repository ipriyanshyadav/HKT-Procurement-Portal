from __future__ import annotations
from datetime import date
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, Numeric, Integer, Date, ForeignKey, CHAR
from sqlalchemy.dialects.postgresql import ARRAY
from app.db.base import BaseModel

class Category(BaseModel):
    __tablename__ = "categories"

    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    erp_material_group: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    gl_account_mapping: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    synonyms: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), default=list, nullable=True)
    requires_quality_inspection: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    @property
    def path(self) -> str:
        return getattr(self, "_path", "") or f"/{self.code}"

    @path.setter
    def path(self, value: str) -> None:
        self._path = value

    @property
    def unspsc_code(self) -> Optional[str]:
        return getattr(self, "_unspsc_code", None)

    @unspsc_code.setter
    def unspsc_code(self, value: Optional[str]) -> None:
        self._unspsc_code = value

class UomMaster(BaseModel):
    __tablename__ = "uom_master"

    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    iso_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class CurrencyMaster(BaseModel):
    __tablename__ = "currency_master"

    code: Mapped[str] = mapped_column(CHAR(3), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    symbol: Mapped[str] = mapped_column(String(10), default="", nullable=False)
    exchange_rate_to_base: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=Decimal("1.0"), nullable=False)
    is_base_currency: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class PaymentTerm(BaseModel):
    __tablename__ = "payment_terms"

    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    payment_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    net_days: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    discount_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class Incoterm(BaseModel):
    __tablename__ = "incoterms"

    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    edition_year: Mapped[int] = mapped_column(Integer, default=2020, nullable=False)
    risk_transfer_point: Mapped[str] = mapped_column(nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class TaxCode(BaseModel):
    __tablename__ = "tax_codes"

    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    tax_type: Mapped[str] = mapped_column(String(50), nullable=False)
    hsn_chapter: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    effective_from: Mapped[Optional[date]] = mapped_column(Date, default=date.today, nullable=True)
    effective_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class DeliveryLocation(BaseModel):
    __tablename__ = "delivery_locations"

    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column("address_line1", String(300), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    postal_code: Mapped[str] = mapped_column(String(20), nullable=False)
    country_code: Mapped[str] = mapped_column(CHAR(2), default="IN", nullable=False)
    plant_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("plants.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class DocumentType(BaseModel):
    __tablename__ = "document_types"

    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_mandatory_for_vendor: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_expiry_date: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    validity_alert_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class SupplierCategory(BaseModel):
    __tablename__ = "supplier_categories"

    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class HolidayMaster(BaseModel):
    __tablename__ = "holiday_master"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    holiday_date: Mapped[date] = mapped_column(Date, nullable=False)
    plant_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("plants.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class ErpMaterialGroupMapping(BaseModel):
    __tablename__ = "erp_material_group_mapping"

    erp_material_group: Mapped[str] = mapped_column(String(50), nullable=False)
    category_id: Mapped[UUID] = mapped_column(ForeignKey("categories.id"), nullable=False)
    confidence: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("1.0"), nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class ItemMaster(BaseModel):
    __tablename__ = "item_master"

    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    category_id: Mapped[UUID] = mapped_column(ForeignKey("categories.id"), nullable=False)
    uom_id: Mapped[UUID] = mapped_column(ForeignKey("uom_master.id"), nullable=False)
    standard_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0"), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_punchout: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    punchout_vendor_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
