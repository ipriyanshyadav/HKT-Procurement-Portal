from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FrameworkEnum(StrEnum):
    ISO_27001 = "ISO_27001"
    SOC_2 = "SOC_2"
    DPDP = "DPDP"
    CVC = "CVC"


class SeverityEnum(StrEnum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class FindingStatusEnum(StrEnum):
    PASS = "PASS"  # noqa: S105
    WARN = "WARN"
    FAIL = "FAIL"


class CompliancePolicyBase(BaseModel):
    code: str = Field(..., max_length=50)
    title: str = Field(..., max_length=200)
    framework: str
    severity: str = "HIGH"
    is_enabled: bool = True


class CompliancePolicyResponse(CompliancePolicyBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    created_at: datetime
    updated_at: datetime


class CompliancePolicyToggleRequest(BaseModel):
    is_enabled: bool


class ComplianceFindingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scan_id: UUID
    policy_code: str
    title: str
    framework: str
    severity: str
    status: str
    score: float
    evidence_summary: str | None = None
    remediation_guidance: str | None = None
    created_at: datetime


class ComplianceScanRunRequest(BaseModel):
    frameworks: list[str] | None = None
    notes: str | None = None


class ComplianceScanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    scanned_by: UUID | None = None
    overall_score: float
    status: str
    total_checks: int
    passed_checks: int
    warning_checks: int
    failed_checks: int
    framework_scores: dict[str, float]
    summary_notes: str | None = None
    created_at: datetime
    findings: list[ComplianceFindingResponse] | None = None


class ComplianceAttestationResponse(BaseModel):
    attestation_id: str
    scan_id: UUID
    org_id: UUID
    issued_at: datetime
    issued_by_email: str
    overall_score: float
    grade: str
    framework_breakdown: dict[str, float]
    findings_count: dict[str, int]
    cryptographic_checksum_sha256: str
    digital_signature_manifest: str
    compliance_status: str
