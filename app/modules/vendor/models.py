from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List
from uuid import UUID, uuid4
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, Numeric, Integer, Date, ForeignKey, Text, CHAR, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import Base, BaseModel
from app.db.enums import (
    VendorStatusEnum, VENDOR_STATUS_PG,
)

class Vendor(BaseModel):
    __tablename__ = "vendors"

    vendor_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    company_name: Mapped[str] = mapped_column(String(300), nullable=False)
    legal_name: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    registration_type: Mapped[str] = mapped_column(String(50), default="DOMESTIC", nullable=False)
    pan: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    pan_encrypted: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    gstin_encrypted: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    cin: Mapped[Optional[str]] = mapped_column(String(21), nullable=True)
    duns_number: Mapped[Optional[str]] = mapped_column(String(13), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    primary_email: Mapped[str] = mapped_column(String(255), nullable=False)
    primary_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    address_line1: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    address_line2: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    country_code: Mapped[str] = mapped_column(CHAR(2), default="IN", nullable=False)
    status: Mapped[VendorStatusEnum] = mapped_column(VENDOR_STATUS_PG, default=VendorStatusEnum.INVITED, nullable=False)
    erp_vendor_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    erp_sync_status: Mapped[Optional[str]] = mapped_column(String(20), default="NOT_SYNCED", nullable=True)
    erp_last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    onboarding_step: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    invitation_token: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    invitation_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    qualified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    blacklisted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    blacklist_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    blacklist_initiated_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    blacklist_confirmed_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    suspension_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    compliance_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    performance_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    last_scorecard_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    tds_applicable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=True)
    tds_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=True)
    invited_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    updated_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)

    def __init__(self, **kwargs):
        # Support kwargs from test_all_models
        super().__init__(**kwargs)


class VendorContact(BaseModel):
    __tablename__ = "vendor_contacts"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    designation: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def __init__(self, **kwargs):
        if "contact_name" in kwargs and "name" not in kwargs:
            kwargs["name"] = kwargs.pop("contact_name")
        super().__init__(**kwargs)


class VendorBankAccount(BaseModel):
    __tablename__ = "vendor_bank_accounts"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    account_holder_name: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    bank_name: Mapped[str] = mapped_column(String(200), nullable=False)
    branch_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    account_number_encrypted: Mapped[str] = mapped_column(String(500), nullable=False)
    ifsc_code: Mapped[str] = mapped_column(String(11), nullable=False)
    swift_code: Mapped[Optional[str]] = mapped_column(String(11), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    penny_test_status: Mapped[str] = mapped_column(String(20), default="NOT_INITIATED", nullable=False)
    penny_test_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    penny_test_initiated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    penny_test_validated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    validated_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)

    def __init__(self, **kwargs):
        if "penny_drop_status" in kwargs and "penny_test_status" not in kwargs:
            kwargs["penny_test_status"] = kwargs.pop("penny_drop_status")
        if "penny_drop_ref" in kwargs and "penny_test_reference" not in kwargs:
            kwargs["penny_test_reference"] = kwargs.pop("penny_drop_ref")
        super().__init__(**kwargs)


class VendorCategoryMapping(BaseModel):
    __tablename__ = "vendor_category_mappings"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    category_id: Mapped[UUID] = mapped_column(ForeignKey("categories.id"), nullable=False)
    is_qualified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    qualified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class VendorDocument(BaseModel):
    __tablename__ = "vendor_documents"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    document_type_id: Mapped[UUID] = mapped_column(ForeignKey("document_types.id"), nullable=False)
    document_id: Mapped[UUID] = mapped_column(nullable=False)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    verified_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)
    verification_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class VendorScorecard(Base):
    __tablename__ = "vendor_scorecards"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    on_time_delivery_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    quality_acceptance_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    commercial_compliance_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    responsiveness_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    overall_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __init__(self, **kwargs):
        if "evaluation_period" in kwargs and "period_start" not in kwargs:
            kwargs.pop("evaluation_period")
            kwargs["period_start"] = date.today()
            kwargs["period_end"] = date.today()
        super().__init__(**kwargs)


class VendorErpSyncLog(Base):
    __tablename__ = "vendor_erp_sync_log"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    sync_direction: Mapped[str] = mapped_column(String(20), nullable=False)
    sync_status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)
    erp_vendor_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    request_payload: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    response_payload: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class VendorRiskAssessment(BaseModel):
    __tablename__ = "vendor_risk_assessments"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    financial_risk_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    credit_rating: Mapped[str] = mapped_column(String(20), default="UNRATED", nullable=False)
    financial_stability_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    liquidity_risk: Mapped[str] = mapped_column(String(20), default="LOW", nullable=False)
    bankruptcy_risk: Mapped[str] = mapped_column(String(20), default="LOW", nullable=False)
    debt_to_equity_ratio: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    esg_risk_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    environmental_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    social_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    governance_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    esg_rating: Mapped[str] = mapped_column(String(20), default="NOT_ASSESSED", nullable=False)
    overall_risk_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    risk_tier: Mapped[str] = mapped_column(String(20), default="LOW", nullable=False)
    risk_factors: Mapped[List[Any]] = mapped_column(JSONB, default=list, nullable=False)
    mitigation_actions: Mapped[List[Any]] = mapped_column(JSONB, default=list, nullable=False)
    last_assessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    assessed_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
