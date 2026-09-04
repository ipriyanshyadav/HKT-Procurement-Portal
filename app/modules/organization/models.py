from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any
from uuid import UUID, uuid4
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, Numeric, ForeignKey, CHAR, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import BaseModel, Base

class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    legal_name: Mapped[str] = mapped_column(String(300), nullable=False)
    country_code: Mapped[str] = mapped_column(CHAR(2), default="IN", nullable=False)
    base_currency: Mapped[str] = mapped_column(CHAR(3), default="INR", nullable=False)
    cost_of_capital_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=Decimal("0.1200"), nullable=False)
    settings: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    version: Mapped[int] = mapped_column(default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    @property
    def is_active(self) -> bool:
        return self.deleted_at is None

    @is_active.setter
    def is_active(self, value: bool) -> None:
        pass

class LegalEntity(BaseModel):
    __tablename__ = "legal_entities"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    registration_number: Mapped[str] = mapped_column(String(50), nullable=False)
    gstin: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    pan: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    cin: Mapped[Optional[str]] = mapped_column(String(21), nullable=True)
    address_line1: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    address_line2: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    country_code: Mapped[str] = mapped_column(CHAR(2), default="IN", nullable=False)

class BusinessUnit(BaseModel):
    __tablename__ = "business_units"

    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    legal_entity_id: Mapped[UUID] = mapped_column(ForeignKey("legal_entities.id"), nullable=False)
    erp_company_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    default_currency: Mapped[str] = mapped_column(CHAR(3), default="INR", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class Plant(BaseModel):
    __tablename__ = "plants"

    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    business_unit_id: Mapped[UUID] = mapped_column(ForeignKey("business_units.id"), nullable=False)
    plant_type: Mapped[str] = mapped_column(String(50), default="MANUFACTURING", nullable=False)
    erp_plant_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    address_line1: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    country_code: Mapped[str] = mapped_column(CHAR(2), default="IN", nullable=False)
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6), nullable=True)
    default_delivery_location_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class CostCenter(BaseModel):
    __tablename__ = "cost_centers"

    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    business_unit_id: Mapped[UUID] = mapped_column(ForeignKey("business_units.id"), nullable=False)
    gl_account: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    erp_cost_center_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    annual_budget: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    available_budget: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    budget_period_start: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    budget_period_end: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class Department(BaseModel):
    __tablename__ = "departments"

    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    business_unit_id: Mapped[UUID] = mapped_column(ForeignKey("business_units.id"), nullable=False)
    head_user_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
