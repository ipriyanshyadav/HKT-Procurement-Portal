from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Any, Dict
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class VendorInviteRequest(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=300)
    primary_email: EmailStr
    primary_phone: Optional[str] = Field(None, max_length=20)
    category_ids: List[UUID] = Field(default_factory=list)
    invited_note: Optional[str] = None


class VendorContactCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    designation: Optional[str] = Field(None, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)
    is_primary: bool = False


class VendorContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vendor_id: UUID
    name: str
    designation: Optional[str] = None
    email: str
    phone: Optional[str] = None
    is_primary: bool = False
    is_active: bool = True
    created_at: datetime


class VendorBankAccountCreateRequest(BaseModel):
    account_holder_name: str = Field(..., min_length=2, max_length=200)
    bank_name: str = Field(..., min_length=2, max_length=200)
    branch_name: Optional[str] = Field(None, max_length=200)
    account_number: str = Field(..., min_length=8, max_length=50)
    ifsc_code: str = Field(..., min_length=11, max_length=11)
    swift_code: Optional[str] = Field(None, max_length=11)
    is_primary: bool = False


class VendorBankAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vendor_id: UUID
    account_holder_name: str
    bank_name: str
    branch_name: Optional[str] = None
    account_number_masked: Optional[str] = None
    ifsc_code: str
    swift_code: Optional[str] = None
    is_primary: bool = False
    penny_test_status: str
    penny_test_reference: Optional[str] = None
    penny_test_initiated_at: Optional[datetime] = None
    penny_test_validated_at: Optional[datetime] = None


class VendorCategoryMappingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vendor_id: UUID
    category_id: UUID
    is_qualified: bool = False
    qualified_at: Optional[datetime] = None


class VendorDocumentCreateRequest(BaseModel):
    document_id: UUID
    document_type_id: UUID
    expiry_date: Optional[date] = None
    verification_notes: Optional[str] = None


class VendorDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vendor_id: UUID
    document_id: UUID
    document_type_id: UUID
    document_type_name: Optional[str] = None
    expiry_date: Optional[date] = None
    verification_status: str
    verification_notes: Optional[str] = None
    verified_by: Optional[UUID] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    clamav_status: Optional[str] = "CLEAN"


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
    calculated_at: datetime


class VendorScorecardUpdateRequest(BaseModel):
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    on_time_delivery_rate: Optional[Decimal] = None
    quality_acceptance_rate: Optional[Decimal] = None
    commercial_compliance_score: Optional[Decimal] = None
    responsiveness_score: Optional[Decimal] = None


class VendorRegistrationRequest(BaseModel):
    company_name: Optional[str] = Field(None, min_length=2, max_length=300)
    legal_name: Optional[str] = Field(None, max_length=300)
    pan: Optional[str] = Field(None, max_length=10)
    gstin: Optional[str] = Field(None, max_length=15)
    cin: Optional[str] = Field(None, max_length=21)
    duns_number: Optional[str] = Field(None, max_length=13)
    website: Optional[str] = Field(None, max_length=500)
    primary_phone: Optional[str] = Field(None, max_length=20)
    address_line1: Optional[str] = Field(None, max_length=300)
    address_line2: Optional[str] = Field(None, max_length=300)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=10)
    country_code: str = Field("IN", max_length=2)
    category_ids: List[UUID] = Field(default_factory=list)
    contacts: List[VendorContactCreateRequest] = Field(default_factory=list)
    bank_accounts: List[VendorBankAccountCreateRequest] = Field(default_factory=list)
    turnstile_token: Optional[str] = None


class VendorUpdateRequest(BaseModel):
    company_name: Optional[str] = Field(None, min_length=2, max_length=300)
    legal_name: Optional[str] = Field(None, max_length=300)
    pan: Optional[str] = Field(None, max_length=10)
    gstin: Optional[str] = Field(None, max_length=15)
    cin: Optional[str] = Field(None, max_length=21)
    duns_number: Optional[str] = Field(None, max_length=13)
    website: Optional[str] = Field(None, max_length=500)
    primary_phone: Optional[str] = Field(None, max_length=20)
    address_line1: Optional[str] = Field(None, max_length=300)
    address_line2: Optional[str] = Field(None, max_length=300)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=10)
    country_code: Optional[str] = Field(None, max_length=2)
    onboarding_step: Optional[int] = None


class VendorSubmitRequest(BaseModel):
    notes: Optional[str] = None


class VendorQualifyRequest(BaseModel):
    notes: Optional[str] = None


class VendorRejectRequest(BaseModel):
    reason: str = Field(..., min_length=3)


class VendorResubmissionRequest(BaseModel):
    reason: str = Field(..., min_length=3)


class VendorSuspendRequest(BaseModel):
    reason: str = Field(..., min_length=3)


class VendorReinstateRequest(BaseModel):
    reason: Optional[str] = None


class VendorBlacklistInitiateRequest(BaseModel):
    reason: str = Field(..., min_length=3)


class VendorBlacklistConfirmRequest(BaseModel):
    workflow_task_id: Optional[UUID] = None
    reason: Optional[str] = None


class VendorCategoriesUpdateRequest(BaseModel):
    category_ids: List[UUID] = Field(..., min_length=1)


class PennyTestConfirmRequest(BaseModel):
    amount_received: float = Field(..., gt=0)


class DuplicateCheckRequest(BaseModel):
    company_name: Optional[str] = None
    pan: Optional[str] = None
    gstin: Optional[str] = None
    email: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc: Optional[str] = None


class DuplicateMatch(BaseModel):
    code: str
    message: str
    vendor_id: UUID


class DuplicateCheckResult(BaseModel):
    has_hard_blocks: bool = False
    has_soft_warnings: bool = False
    has_fraud_flags: bool = False
    hard_blocks: List[DuplicateMatch] = Field(default_factory=list)
    soft_warnings: List[DuplicateMatch] = Field(default_factory=list)
    fraud_flags: List[DuplicateMatch] = Field(default_factory=list)


class VendorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    vendor_code: Optional[str] = None
    company_name: str
    legal_name: Optional[str] = None
    registration_type: str = "DOMESTIC"
    pan: Optional[str] = None
    gstin: Optional[str] = None
    cin: Optional[str] = None
    duns_number: Optional[str] = None
    website: Optional[str] = None
    primary_email: str
    primary_phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country_code: str = "IN"
    status: str
    erp_vendor_code: Optional[str] = None
    erp_sync_status: Optional[str] = None
    erp_last_synced_at: Optional[datetime] = None
    onboarding_step: int = 0
    submitted_at: Optional[datetime] = None
    qualified_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    blacklisted_at: Optional[datetime] = None
    blacklist_reason: Optional[str] = None
    suspension_reason: Optional[str] = None
    compliance_score: Optional[Decimal] = None
    performance_score: Optional[Decimal] = None
    last_scorecard_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class VendorDetailResponse(VendorResponse):
    category_ids: List[UUID] = Field(default_factory=list)
    contacts: List[VendorContactResponse] = Field(default_factory=list)
    bank_accounts: List[VendorBankAccountResponse] = Field(default_factory=list)
    documents: List[VendorDocumentResponse] = Field(default_factory=list)
    scorecard: Optional[VendorScorecardResponse] = None


class BulkVendorCategoryMappingItem(BaseModel):
    vendor_id: Optional[UUID] = None
    vendor_code: Optional[str] = None
    category_ids: List[UUID] = Field(default_factory=list)


class BulkVendorCategoryMappingRequest(BaseModel):
    mappings: List[BulkVendorCategoryMappingItem]


class BulkVendorCategoryMappingResponse(BaseModel):
    total_processed: int
    updated_vendors: int
    errors: List[str] = Field(default_factory=list)

