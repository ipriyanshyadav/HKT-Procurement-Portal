from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, Numeric, Integer, Date, ForeignKey, Text, CHAR
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import BaseModel
from app.db.enums import (
    VendorStatusEnum, VENDOR_STATUS_PG,
)

class Vendor(BaseModel):
    __tablename__ = "vendors"

    vendor_code: Mapped[str] = mapped_column(String(50), nullable=False)
    company_name: Mapped[str] = mapped_column(String(300), nullable=False)
    trade_name: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    vendor_type: Mapped[str] = mapped_column(String(50), default="MANUFACTURER", nullable=False)
    status: Mapped[VendorStatusEnum] = mapped_column(VENDOR_STATUS_PG, default=VendorStatusEnum.INVITED, nullable=False)
    pan: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    tan: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    msme_registered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    msme_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    msme_category: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    address_line1: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    address_line2: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    postal_code: Mapped[str] = mapped_column(String(20), nullable=False)
    country_code: Mapped[str] = mapped_column(CHAR(2), default="IN", nullable=False)
    website: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    primary_email: Mapped[str] = mapped_column(String(255), nullable=False)
    primary_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    risk_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    profile_completion_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    invited_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    invited_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    erp_vendor_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    erp_sync_status: Mapped[str] = mapped_column(String(20), default="NOT_SYNCED", nullable=False)
    erp_synced_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    blacklist_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    blacklist_initiated_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    blacklist_confirmed_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    blacklisted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    updated_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)

class VendorContact(BaseModel):
    __tablename__ = "vendor_contacts"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    contact_name: Mapped[str] = mapped_column(String(100), nullable=False)
    designation: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    updated_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)

class VendorBankAccount(BaseModel):
    __tablename__ = "vendor_bank_accounts"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    bank_name: Mapped[str] = mapped_column(String(200), nullable=False)
    branch_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    account_number_encrypted: Mapped[str] = mapped_column(String(500), nullable=False)
    ifsc_code: Mapped[str] = mapped_column(String(20), nullable=False)
    swift_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    account_type: Mapped[str] = mapped_column(String(20), default="CURRENT", nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    penny_drop_status: Mapped[str] = mapped_column(String(20), default="NOT_INITIATED", nullable=False)
    penny_drop_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    name_as_per_bank: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    name_match_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    validated_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    validated_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    updated_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)

class VendorCategoryMapping(BaseModel):
    __tablename__ = "vendor_category_mappings"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    category_id: Mapped[UUID] = mapped_column(ForeignKey("categories.id"), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)

class VendorDocument(BaseModel):
    __tablename__ = "vendor_documents"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    document_type_id: Mapped[UUID] = mapped_column(ForeignKey("document_types.id"), nullable=False)
    document_id: Mapped[UUID] = mapped_column(ForeignKey("documents.id"), nullable=False)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    verified_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    verification_status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)
    verification_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

class VendorScorecard(BaseModel):
    __tablename__ = "vendor_scorecards"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    evaluation_period: Mapped[str] = mapped_column(String(20), nullable=False)
    quality_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    delivery_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    commercial_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    service_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    overall_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    evaluated_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    evaluated_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

class VendorErpSyncLog(BaseModel):
    __tablename__ = "vendor_erp_sync_log"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    sync_direction: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)
    payload_sent: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    payload_received: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    synced_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
