"""
Pydantic Schemas for SPEC_13 Contract Management.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import RoleCode


class ContractLineCreate(BaseModel):
    line_number: int
    item_description: str
    uom_id: UUID
    contracted_quantity: Decimal | None = None
    unit_rate: Decimal
    hsn_code: str | None = None


class ContractLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contract_id: UUID
    line_number: int
    item_description: str
    uom_id: UUID
    contracted_quantity: Decimal | None = None
    unit_rate: Decimal
    utilized_quantity: Decimal
    hsn_code: str | None = None


class ContractMilestoneCreate(BaseModel):
    title: str
    description: str | None = None
    due_date: date
    responsible_party: str = RoleCode.BUYER  # BUYER, VENDOR, ESCROW
    responsible_user_id: UUID | None = None
    milestone_weight: Decimal | None = None


class ContractMilestoneUpdate(BaseModel):
    status: str
    completion_notes: str | None = None


class ContractMilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contract_id: UUID
    title: str
    description: str | None = None
    due_date: date
    responsible_party: str
    responsible_user_id: UUID | None = None
    status: str
    completed_at: datetime | None = None
    completion_notes: str | None = None
    milestone_weight: Decimal | None = None
    created_at: datetime


class ContractAmendmentCreate(BaseModel):
    amendment_type: str = "VALUE_CHANGE"
    change_description: str
    new_total_value: Decimal | None = None
    new_end_date: date | None = None
    field_changes: dict[str, Any] | None = None


class ContractAmendmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contract_id: UUID
    amendment_number: int
    amendment_type: str
    changes_summary: str | None = None
    change_description: str | None = None
    field_changes: dict[str, Any] | None = None
    original_snapshot: dict[str, Any] = Field(default_factory=dict)
    new_document_id: UUID | None = None
    amended_by: UUID
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    created_at: datetime


class ContractCreateRequest(BaseModel):
    title: str
    vendor_id: UUID
    contract_type: str = "RATE_CONTRACT"
    currency: str = "INR"
    total_value: Decimal
    start_date: date
    end_date: date
    business_unit_id: UUID
    category_id: UUID
    payment_term_id: UUID | None = None
    incoterm_id: UUID | None = None
    template_id: UUID | None = None
    rfq_id: UUID | None = None
    award_recommendation_id: UUID | None = None
    auto_renew: bool = False
    renewal_notice_days: int = 30
    sla_terms: dict[str, Any] | None = None
    lines: list[ContractLineCreate] = Field(default_factory=list)
    milestones: list[ContractMilestoneCreate] | None = None


class ContractFromAwardRequest(BaseModel):
    award_recommendation_id: UUID
    title: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    auto_renew: bool = False
    renewal_notice_days: int = 30
    sla_terms: dict[str, Any] | None = None
    template_id: UUID | None = None
    payment_term_id: UUID | None = None
    incoterm_id: UUID | None = None
    milestones: list[ContractMilestoneCreate] | None = None


class ContractAmendRequest(BaseModel):
    amendment_type: str = "VALUE_CHANGE"
    change_description: str
    new_total_value: Decimal | None = None
    new_end_date: date | None = None
    field_changes: dict[str, Any] | None = None


class ContractStatusUpdateRequest(BaseModel):
    status: str
    notes: str | None = None


class ContractUtilizationUpdateRequest(BaseModel):
    po_value: Decimal = Field(..., gt=0)
    po_number: str | None = None


class EsignInitiateRequest(BaseModel):
    provider: str | None = None  # digio or docusign
    signatories: list[dict[str, Any]] | None = None


class EsignInitiateResponse(BaseModel):
    request_id: str
    provider: str
    signing_url: str | None = None
    status: str


class EsignConfirmRequest(BaseModel):
    signed_doc_path: str | None = None
    request_id: str | None = None


class EsignWebhookPayload(BaseModel):
    request_id: str
    event: str
    status: str | None = None
    signed_pdf_base64: str | None = None
    metadata: dict[str, Any] | None = None


class ContractResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    contract_number: str
    title: str
    vendor_id: UUID
    rfq_id: UUID | None = None
    arn_id: UUID | None = None
    award_recommendation_id: UUID | None = None
    status: str
    contract_type: str
    currency: str
    total_value: Decimal
    utilized_value: Decimal = Decimal("0.0")
    start_date: date
    end_date: date
    payment_term_id: UUID | None = None
    incoterm_id: UUID | None = None
    business_unit_id: UUID
    category_id: UUID
    template_id: UUID | None = None
    signing_log: list[Any] = Field(default_factory=list)
    signed_document_id: UUID | None = None
    contract_document_path: str | None = None
    signed_document_path: str | None = None
    esign_request_id: str | None = None
    esign_provider: str | None = None
    amendment_count: int = 0
    renewal_alert_sent: bool = False
    auto_renew: bool = False
    renewal_notice_days: int = 30
    sla_terms: dict[str, Any] = Field(default_factory=dict)
    erp_contract_number: str | None = None
    activated_at: datetime | None = None
    original_contract_id: UUID | None = None
    version: int
    created_at: datetime
    updated_at: datetime
    created_by: UUID | None = None
    updated_by: UUID | None = None

    # Computed attributes
    days_remaining: int | None = None
    expiry_warning_level: str | None = None  # CRITICAL, WARNING, SAFE, EXPIRED

    lines: list[ContractLineResponse] = Field(default_factory=list)
    milestones: list[ContractMilestoneResponse] = Field(default_factory=list)
    amendments: list[ContractAmendmentResponse] = Field(default_factory=list)


class ContractListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    contract_number: str
    title: str
    vendor_id: UUID
    vendor_name: str | None = None
    status: str
    contract_type: str
    currency: str
    total_value: Decimal
    utilized_value: Decimal = Decimal("0.0")
    start_date: date
    end_date: date
    days_remaining: int
    expiry_warning_level: str  # CRITICAL, WARNING, SAFE, EXPIRED
    auto_renew: bool = False
    amendment_count: int = 0
    esign_provider: str | None = None
    created_at: datetime


class ContractTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    name: str
    contract_type: str
    template_content: dict[str, Any]
    is_active: bool
    created_at: datetime


class ContractReviewSubmitRequest(BaseModel):
    comment: str | None = None


class ContractApproveRequest(BaseModel):
    comment: str | None = None


class ContractReturnRequest(BaseModel):
    reason: str


class ContractTerminateRequest(BaseModel):
    reason: str


# ============================================================================
# SPEC_13 Clause Library, Collaborative Redlining & E-Sign Ceremony Schemas
# ============================================================================

class ContractClauseCreate(BaseModel):
    clause_code: str
    title: str
    category: str = "STANDARD"
    standard_text: str
    risk_level: str = "MEDIUM"
    is_mandatory: bool = True
    guidance_notes: str | None = None


class ContractClauseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    clause_code: str
    title: str
    category: str
    standard_text: str
    risk_level: str
    is_mandatory: bool
    guidance_notes: str | None = None
    version: int
    created_at: datetime


class ContractClauseInstanceCreate(BaseModel):
    clause_id: UUID | None = None
    title: str
    text: str
    order_index: int = 0


class ContractClauseInstanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contract_id: UUID
    clause_id: UUID | None = None
    title: str
    current_text: str
    original_text: str
    status: str
    deviation_risk: str
    order_index: int
    redlines_count: int = 0


class ContractRedlineCreate(BaseModel):
    clause_instance_id: UUID | None = None
    original_text: str
    proposed_text: str
    change_rationale: str
    author_type: str = "BUYER"  # BUYER, SUPPLIER, LEGAL_COUNSEL


class ContractRedlineReviewRequest(BaseModel):
    action: str  # ACCEPT, REJECT, PROPOSE_ALTERNATIVE
    review_comment: str | None = None


class ContractRedlineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contract_id: UUID
    clause_instance_id: UUID | None = None
    author_id: UUID | None = None
    author_type: str
    original_text: str
    proposed_text: str
    change_rationale: str
    diff_summary: dict[str, Any] = Field(default_factory=dict)
    status: str
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
    review_comment: str | None = None
    created_at: datetime


class InitiateSigningCeremonyRequest(BaseModel):
    signers: list[dict[str, Any]] = Field(default_factory=list)


class SubmitDigitalSignatureRequest(BaseModel):
    signer_email: str
    signature_token: str | None = None


class ContractEsignSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contract_id: UUID
    ceremony_status: str
    signers: list[dict[str, Any]] = Field(default_factory=list)
    audit_trail_hash: str
    completed_at: datetime | None = None
    created_at: datetime


