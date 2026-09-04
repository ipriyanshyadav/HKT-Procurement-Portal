"""
Pydantic Schemas for SPEC_13 Contract Management.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ContractLineCreate(BaseModel):
    line_number: int
    item_description: str
    uom_id: UUID
    contracted_quantity: Optional[Decimal] = None
    unit_rate: Decimal
    hsn_code: Optional[str] = None


class ContractLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contract_id: UUID
    line_number: int
    item_description: str
    uom_id: UUID
    contracted_quantity: Optional[Decimal] = None
    unit_rate: Decimal
    utilized_quantity: Decimal
    hsn_code: Optional[str] = None


class ContractMilestoneCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: date
    responsible_party: str = "BUYER"  # BUYER, VENDOR, ESCROW
    responsible_user_id: Optional[UUID] = None
    milestone_weight: Optional[Decimal] = None


class ContractMilestoneUpdate(BaseModel):
    status: str
    completion_notes: Optional[str] = None


class ContractMilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contract_id: UUID
    title: str
    description: Optional[str] = None
    due_date: date
    responsible_party: str
    responsible_user_id: Optional[UUID] = None
    status: str
    completed_at: Optional[datetime] = None
    completion_notes: Optional[str] = None
    milestone_weight: Optional[Decimal] = None
    created_at: datetime


class ContractAmendmentCreate(BaseModel):
    amendment_type: str = "VALUE_CHANGE"
    change_description: str
    new_total_value: Optional[Decimal] = None
    new_end_date: Optional[date] = None
    field_changes: Optional[Dict[str, Any]] = None


class ContractAmendmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contract_id: UUID
    amendment_number: int
    amendment_type: str
    changes_summary: Optional[str] = None
    change_description: Optional[str] = None
    field_changes: Optional[Dict[str, Any]] = None
    original_snapshot: Dict[str, Any] = Field(default_factory=dict)
    new_document_id: Optional[UUID] = None
    amended_by: UUID
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
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
    payment_term_id: Optional[UUID] = None
    incoterm_id: Optional[UUID] = None
    template_id: Optional[UUID] = None
    rfq_id: Optional[UUID] = None
    award_recommendation_id: Optional[UUID] = None
    auto_renew: bool = False
    renewal_notice_days: int = 30
    sla_terms: Optional[Dict[str, Any]] = None
    lines: List[ContractLineCreate] = Field(default_factory=list)
    milestones: Optional[List[ContractMilestoneCreate]] = None


class ContractFromAwardRequest(BaseModel):
    award_recommendation_id: UUID
    title: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    auto_renew: bool = False
    renewal_notice_days: int = 30
    sla_terms: Optional[Dict[str, Any]] = None
    template_id: Optional[UUID] = None
    payment_term_id: Optional[UUID] = None
    incoterm_id: Optional[UUID] = None
    milestones: Optional[List[ContractMilestoneCreate]] = None


class ContractAmendRequest(BaseModel):
    amendment_type: str = "VALUE_CHANGE"
    change_description: str
    new_total_value: Optional[Decimal] = None
    new_end_date: Optional[date] = None
    field_changes: Optional[Dict[str, Any]] = None


class ContractStatusUpdateRequest(BaseModel):
    status: str
    notes: Optional[str] = None


class ContractUtilizationUpdateRequest(BaseModel):
    po_value: Decimal = Field(..., gt=0)
    po_number: Optional[str] = None


class EsignInitiateRequest(BaseModel):
    provider: Optional[str] = None  # digio or docusign
    signatories: Optional[List[Dict[str, Any]]] = None


class EsignInitiateResponse(BaseModel):
    request_id: str
    provider: str
    signing_url: Optional[str] = None
    status: str


class EsignConfirmRequest(BaseModel):
    signed_doc_path: Optional[str] = None
    request_id: Optional[str] = None


class EsignWebhookPayload(BaseModel):
    request_id: str
    event: str
    status: Optional[str] = None
    signed_pdf_base64: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class ContractResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    contract_number: str
    title: str
    vendor_id: UUID
    rfq_id: Optional[UUID] = None
    arn_id: Optional[UUID] = None
    award_recommendation_id: Optional[UUID] = None
    status: str
    contract_type: str
    currency: str
    total_value: Decimal
    utilized_value: Decimal = Decimal("0.0")
    start_date: date
    end_date: date
    payment_term_id: Optional[UUID] = None
    incoterm_id: Optional[UUID] = None
    business_unit_id: UUID
    category_id: UUID
    template_id: Optional[UUID] = None
    signing_log: List[Any] = Field(default_factory=list)
    signed_document_id: Optional[UUID] = None
    contract_document_path: Optional[str] = None
    signed_document_path: Optional[str] = None
    esign_request_id: Optional[str] = None
    esign_provider: Optional[str] = None
    amendment_count: int = 0
    renewal_alert_sent: bool = False
    auto_renew: bool = False
    renewal_notice_days: int = 30
    sla_terms: Dict[str, Any] = Field(default_factory=dict)
    erp_contract_number: Optional[str] = None
    activated_at: Optional[datetime] = None
    original_contract_id: Optional[UUID] = None
    version: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None

    # Computed attributes
    days_remaining: Optional[int] = None
    expiry_warning_level: Optional[str] = None  # CRITICAL, WARNING, SAFE, EXPIRED

    lines: List[ContractLineResponse] = Field(default_factory=list)
    milestones: List[ContractMilestoneResponse] = Field(default_factory=list)
    amendments: List[ContractAmendmentResponse] = Field(default_factory=list)


class ContractListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    contract_number: str
    title: str
    vendor_id: UUID
    vendor_name: Optional[str] = None
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
    esign_provider: Optional[str] = None
    created_at: datetime


class ContractTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    name: str
    contract_type: str
    template_content: Dict[str, Any]
    is_active: bool
    created_at: datetime
