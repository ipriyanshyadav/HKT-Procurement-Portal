from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class VendorInviteRequest(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=300)
    primary_email: EmailStr
    primary_phone: str | None = Field(None, max_length=20)
    category_ids: list[UUID] = Field(default_factory=list)
    invited_note: str | None = None


class VendorContactCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    designation: str | None = Field(None, max_length=100)
    email: EmailStr
    phone: str | None = Field(None, max_length=20)
    is_primary: bool = False


class VendorContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vendor_id: UUID
    name: str
    designation: str | None = None
    email: str
    phone: str | None = None
    is_primary: bool = False
    is_active: bool = True
    created_at: datetime


class VendorBankAccountCreateRequest(BaseModel):
    account_holder_name: str = Field(..., min_length=2, max_length=200)
    bank_name: str = Field(..., min_length=2, max_length=200)
    branch_name: str | None = Field(None, max_length=200)
    account_number: str = Field(..., min_length=8, max_length=50)
    ifsc_code: str = Field(..., min_length=11, max_length=11)
    swift_code: str | None = Field(None, max_length=11)
    is_primary: bool = False


class VendorBankAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vendor_id: UUID
    account_holder_name: str
    bank_name: str
    branch_name: str | None = None
    account_number_masked: str | None = None
    ifsc_code: str
    swift_code: str | None = None
    is_primary: bool = False
    penny_test_status: str
    penny_test_reference: str | None = None
    penny_test_initiated_at: datetime | None = None
    penny_test_validated_at: datetime | None = None


class VendorCategoryMappingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vendor_id: UUID
    category_id: UUID
    is_qualified: bool = False
    qualified_at: datetime | None = None


class VendorDocumentCreateRequest(BaseModel):
    document_id: UUID
    document_type_id: UUID
    expiry_date: date | None = None
    verification_notes: str | None = None


class VendorDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vendor_id: UUID
    document_id: UUID
    document_type_id: UUID
    document_type_name: str | None = None
    expiry_date: date | None = None
    verification_status: str
    verification_notes: str | None = None
    verified_by: UUID | None = None
    verified_at: datetime | None = None
    created_at: datetime
    clamav_status: str | None = "CLEAN"


class VendorScorecardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vendor_id: UUID
    period_start: date
    period_end: date
    on_time_delivery_rate: Decimal
    quality_acceptance_rate: Decimal
    commercial_compliance_score: Decimal
    responsiveness_score: Decimal
    overall_score: Decimal
    quality_rejection_rate: Decimal | None = None
    pricing_competitiveness: Decimal | None = None
    calculated_at: datetime


class VendorScorecardUpdateRequest(BaseModel):
    period_start: date | None = None
    period_end: date | None = None
    on_time_delivery_rate: Decimal | None = None
    quality_acceptance_rate: Decimal | None = None
    commercial_compliance_score: Decimal | None = None
    responsiveness_score: Decimal | None = None


class VendorRegistrationRequest(BaseModel):
    company_name: str | None = Field(None, min_length=2, max_length=300)
    legal_name: str | None = Field(None, max_length=300)
    pan: str | None = Field(None, max_length=10)
    gstin: str | None = Field(None, max_length=15)
    cin: str | None = Field(None, max_length=21)
    duns_number: str | None = Field(None, max_length=13)
    website: str | None = Field(None, max_length=500)
    primary_phone: str | None = Field(None, max_length=20)
    address_line1: str | None = Field(None, max_length=300)
    address_line2: str | None = Field(None, max_length=300)
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    postal_code: str | None = Field(None, max_length=10)
    country_code: str = Field("IN", max_length=2)
    category_ids: list[UUID] = Field(default_factory=list)
    contacts: list[VendorContactCreateRequest] = Field(default_factory=list)
    bank_accounts: list[VendorBankAccountCreateRequest] = Field(default_factory=list)
    turnstile_token: str | None = None


class VendorUpdateRequest(BaseModel):
    company_name: str | None = Field(None, min_length=2, max_length=300)
    legal_name: str | None = Field(None, max_length=300)
    pan: str | None = Field(None, max_length=10)
    gstin: str | None = Field(None, max_length=15)
    cin: str | None = Field(None, max_length=21)
    duns_number: str | None = Field(None, max_length=13)
    website: str | None = Field(None, max_length=500)
    primary_phone: str | None = Field(None, max_length=20)
    address_line1: str | None = Field(None, max_length=300)
    address_line2: str | None = Field(None, max_length=300)
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    postal_code: str | None = Field(None, max_length=10)
    country_code: str | None = Field(None, max_length=2)
    onboarding_step: int | None = None


class VendorSubmitRequest(BaseModel):
    notes: str | None = None


class VendorQualifyRequest(BaseModel):
    notes: str | None = None


class VendorRejectRequest(BaseModel):
    reason: str = Field(..., min_length=3)


class VendorResubmissionRequest(BaseModel):
    reason: str = Field(..., min_length=3)


class VendorSuspendRequest(BaseModel):
    reason: str = Field(..., min_length=3)


class VendorReinstateRequest(BaseModel):
    reason: str | None = None


class VendorBlacklistInitiateRequest(BaseModel):
    reason: str = Field(..., min_length=3)


class VendorBlacklistConfirmRequest(BaseModel):
    workflow_task_id: UUID | None = None
    reason: str | None = None


class VendorCategoriesUpdateRequest(BaseModel):
    category_ids: list[UUID] = Field(..., min_length=1)


class PennyTestConfirmRequest(BaseModel):
    amount_received: float = Field(..., gt=0)


class DuplicateCheckRequest(BaseModel):
    company_name: str | None = None
    pan: str | None = None
    gstin: str | None = None
    email: str | None = None
    bank_account: str | None = None
    ifsc: str | None = None


class DuplicateMatch(BaseModel):
    code: str
    message: str
    vendor_id: UUID


class DuplicateCheckResult(BaseModel):
    has_hard_blocks: bool = False
    has_soft_warnings: bool = False
    has_fraud_flags: bool = False
    hard_blocks: list[DuplicateMatch] = Field(default_factory=list)
    soft_warnings: list[DuplicateMatch] = Field(default_factory=list)
    fraud_flags: list[DuplicateMatch] = Field(default_factory=list)


class VendorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    vendor_code: str | None = None
    company_name: str
    legal_name: str | None = None
    registration_type: str = "DOMESTIC"
    pan: str | None = None
    gstin: str | None = None
    cin: str | None = None
    duns_number: str | None = None
    website: str | None = None
    primary_email: str
    primary_phone: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country_code: str = "IN"
    status: str
    erp_vendor_code: str | None = None
    erp_sync_status: str | None = None
    erp_last_synced_at: datetime | None = None
    onboarding_step: int = 0
    submitted_at: datetime | None = None
    qualified_at: datetime | None = None
    activated_at: datetime | None = None
    blacklisted_at: datetime | None = None
    blacklist_reason: str | None = None
    suspension_reason: str | None = None
    compliance_score: Decimal | None = None
    performance_score: Decimal | None = None
    last_scorecard_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class VendorDetailResponse(VendorResponse):
    category_ids: list[UUID] = Field(default_factory=list)
    contacts: list[VendorContactResponse] = Field(default_factory=list)
    bank_accounts: list[VendorBankAccountResponse] = Field(default_factory=list)
    documents: list[VendorDocumentResponse] = Field(default_factory=list)
    scorecard: VendorScorecardResponse | None = None
    risk_assessment: VendorRiskAssessmentResponse | None = None


class BulkVendorCategoryMappingItem(BaseModel):
    vendor_id: UUID | None = None
    vendor_code: str | None = None
    category_ids: list[UUID] = Field(default_factory=list)


class BulkVendorCategoryMappingRequest(BaseModel):
    mappings: list[BulkVendorCategoryMappingItem]


class BulkVendorCategoryMappingResponse(BaseModel):
    total_processed: int
    updated_vendors: int
    errors: list[str] = Field(default_factory=list)


class VendorScorecardCalculateRequest(BaseModel):
    period_start: date | None = None
    period_end: date | None = None


class VendorRiskAssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vendor_id: UUID
    financial_risk_score: Decimal
    credit_rating: str
    financial_stability_score: Decimal
    liquidity_risk: str
    bankruptcy_risk: str
    debt_to_equity_ratio: Decimal | None = None
    esg_risk_score: Decimal
    environmental_score: Decimal
    social_score: Decimal
    governance_score: Decimal
    esg_rating: str
    overall_risk_score: Decimal
    risk_tier: str
    risk_factors: list[Any] = Field(default_factory=list)
    mitigation_actions: list[Any] = Field(default_factory=list)
    last_assessed_at: datetime
    assessed_by: UUID | None = None


class VendorRiskAssessmentUpdateRequest(BaseModel):
    financial_risk_score: Decimal | None = None
    credit_rating: str | None = None
    financial_stability_score: Decimal | None = None
    liquidity_risk: str | None = None
    bankruptcy_risk: str | None = None
    debt_to_equity_ratio: Decimal | None = None
    esg_risk_score: Decimal | None = None
    environmental_score: Decimal | None = None
    social_score: Decimal | None = None
    governance_score: Decimal | None = None
    esg_rating: str | None = None
    risk_factors: list[Any] | None = None
    mitigation_actions: list[Any] | None = None


class VendorRiskSummaryItem(BaseModel):
    vendor_id: UUID
    vendor_code: str | None = None
    company_name: str
    overall_risk_score: Decimal
    risk_tier: str
    financial_risk_score: Decimal
    credit_rating: str
    esg_risk_score: Decimal
    esg_rating: str
    performance_score: Decimal | None = None


class VendorRiskDashboardResponse(BaseModel):
    total_vendors_monitored: int
    low_risk_count: int
    medium_risk_count: int
    high_risk_count: int
    critical_risk_count: int
    avg_financial_risk_score: Decimal
    avg_esg_risk_score: Decimal
    avg_overall_risk_score: Decimal
    high_risk_watchlist: list[VendorRiskSummaryItem] = Field(default_factory=list)
    esg_ratings_distribution: dict[str, int] = Field(default_factory=dict)


class VendorSelfRegistrationRequest(BaseModel):
    org_id: UUID
    company_name: str = Field(..., min_length=2, max_length=300)
    legal_name: str | None = Field(None, max_length=300)
    primary_email: EmailStr
    primary_phone: str | None = Field(None, max_length=20)
    pan: str | None = Field(None, max_length=10)
    gstin: str | None = Field(None, max_length=15)
    cin: str | None = Field(None, max_length=21)
    duns_number: str | None = Field(None, max_length=13)
    website: str | None = Field(None, max_length=500)
    address_line1: str | None = Field(None, max_length=300)
    address_line2: str | None = Field(None, max_length=300)
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    postal_code: str | None = Field(None, max_length=10)
    country_code: str = Field("IN", max_length=2)
    contact_name: str = Field(..., min_length=2, max_length=200)
    contact_designation: str | None = Field(None, max_length=100)
    contact_phone: str | None = Field(None, max_length=20)
    bank_account_holder: str | None = None
    bank_name: str | None = None
    branch_name: str | None = None
    account_number: str | None = None
    ifsc_code: str | None = None
    category_ids: list[UUID] = Field(default_factory=list)
    coi_declared: bool = False
    turnstile_token: str | None = None


class VendorKYCReviewRequest(BaseModel):
    action: str = Field(..., pattern="^(APPROVE|REJECT)$")
    review_notes: str | None = None
    assigned_category_ids: list[UUID] = Field(default_factory=list)


class VendorOnboardingApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    vendor_id: UUID
    application_number: str
    status: str
    gstin_verified: bool
    pan_verified: bool
    penny_drop_verified: bool
    kyc_risk_tier: str
    submitted_payload: dict[str, Any]
    review_notes: str | None = None
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    company_name: str | None = None
    primary_email: str | None = None


