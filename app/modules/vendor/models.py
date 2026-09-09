from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import CHAR, Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base, BaseModel
from app.db.enums import (
    VENDOR_STATUS_PG,
    VendorStatusEnum,
)


class Vendor(BaseModel):
    __tablename__ = "vendors"

    vendor_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    company_name: Mapped[str] = mapped_column(String(300), nullable=False)
    legal_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    registration_type: Mapped[str] = mapped_column(String(50), default="DOMESTIC", nullable=False)
    pan: Mapped[str | None] = mapped_column(String(10), nullable=True)
    pan_encrypted: Mapped[str | None] = mapped_column(String(500), nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    gstin_encrypted: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cin: Mapped[str | None] = mapped_column(String(21), nullable=True)
    duns_number: Mapped[str | None] = mapped_column(String(13), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    primary_email: Mapped[str] = mapped_column(String(255), nullable=False)
    primary_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address_line1: Mapped[str | None] = mapped_column(String(300), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(300), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    country_code: Mapped[str] = mapped_column(CHAR(2), default="IN", nullable=False)
    status: Mapped[VendorStatusEnum] = mapped_column(VENDOR_STATUS_PG, default=VendorStatusEnum.INVITED, nullable=False)
    erp_vendor_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    erp_sync_status: Mapped[str | None] = mapped_column(String(20), default="NOT_SYNCED", nullable=True)
    erp_last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    onboarding_step: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    invitation_token: Mapped[str | None] = mapped_column(String(200), nullable=True)
    invitation_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    qualified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    blacklisted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    blacklist_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    blacklist_initiated_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    blacklist_confirmed_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    suspension_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    compliance_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    performance_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    last_scorecard_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tds_applicable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=True)
    tds_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=True)
    invited_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_by: Mapped[UUID | None] = mapped_column(nullable=True)
    updated_by: Mapped[UUID | None] = mapped_column(nullable=True)

    def __init__(self, **kwargs):
        # Support kwargs from test_all_models
        super().__init__(**kwargs)


class VendorContact(BaseModel):
    __tablename__ = "vendor_contacts"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    designation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
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
    branch_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    account_number_encrypted: Mapped[str] = mapped_column(String(500), nullable=False)
    ifsc_code: Mapped[str] = mapped_column(String(11), nullable=False)
    swift_code: Mapped[str | None] = mapped_column(String(11), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    penny_test_status: Mapped[str] = mapped_column(String(20), default="NOT_INITIATED", nullable=False)
    penny_test_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    penny_test_initiated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    penny_test_validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    validated_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

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
    qualified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class VendorDocument(BaseModel):
    __tablename__ = "vendor_documents"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    document_type_id: Mapped[UUID] = mapped_column(ForeignKey("document_types.id"), nullable=False)
    document_id: Mapped[UUID] = mapped_column(nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    verified_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)
    verification_notes: Mapped[str | None] = mapped_column(Text, nullable=True)


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
    erp_vendor_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    request_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    response_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class VendorRiskAssessment(BaseModel):
    __tablename__ = "vendor_risk_assessments"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    financial_risk_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    credit_rating: Mapped[str] = mapped_column(String(20), default="UNRATED", nullable=False)
    financial_stability_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    liquidity_risk: Mapped[str] = mapped_column(String(20), default="LOW", nullable=False)
    bankruptcy_risk: Mapped[str] = mapped_column(String(20), default="LOW", nullable=False)
    debt_to_equity_ratio: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    esg_risk_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    environmental_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    social_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    governance_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    esg_rating: Mapped[str] = mapped_column(String(20), default="NOT_ASSESSED", nullable=False)
    overall_risk_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.0"), nullable=False)
    risk_tier: Mapped[str] = mapped_column(String(20), default="LOW", nullable=False)
    risk_factors: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)
    mitigation_actions: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)
    last_assessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    assessed_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class VendorOnboardingApplication(BaseModel):
    __tablename__ = "vendor_onboarding_applications"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    application_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="SUBMITTED", nullable=False)
    gstin_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    pan_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    penny_drop_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    kyc_risk_tier: Mapped[str] = mapped_column(String(20), default="LOW", nullable=False)
    submitted_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

