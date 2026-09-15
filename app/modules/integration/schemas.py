from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class IntegrationJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    job_type: str
    entity_type: str
    entity_id: UUID
    direction: str
    adapter_type: str
    status: str
    request_payload: dict[str, Any] | None = None
    response_payload: dict[str, Any] | None = None
    error_message: str | None = None
    retry_count: int = 0
    max_retries: int = 7
    next_retry_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None


class IntegrationStatsResponse(BaseModel):
    total_jobs: int
    pending_jobs: int
    in_progress_jobs: int
    completed_jobs: int
    failed_jobs: int
    retry_scheduled_jobs: int
    success_rate: float


class ScheduledJobRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID | None = None
    job_name: str
    started_at: datetime
    completed_at: datetime | None = None
    status: str
    records_processed: int = 0
    error_message: str | None = None
    created_at: datetime


class SyncTriggerRequest(BaseModel):
    adapter_type: str = "SAP"
    entity_type: str | None = None


class SyncTriggerResponse(BaseModel):
    status: str
    adapter_type: str
    jobs_created: int
    records_processed: int
    message: str
    job_run_id: UUID | None = None


class ERPConfigResponse(BaseModel):
    erp_provider: str = "SAP"
    endpoint_url: str | None = None
    auth_type: str = "API_KEY"
    api_key_masked: str | None = None
    allowed_domains: list[str] = []
    is_enabled: bool = True
    updated_at: datetime | None = None


class ERPConfigUpdateRequest(BaseModel):
    erp_provider: str = "SAP"
    endpoint_url: str | None = None
    auth_type: str = "API_KEY"
    api_key: str | None = None
    allowed_domains: list[str] = []
    is_enabled: bool = True


class GSTVerificationRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    gstin: str
    legal_name: str | None = None


class PANVerificationRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pan: str
    name: str | None = None


class BankPennyDropRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    vendor_id: UUID | None = None
    account_number: str
    ifsc_code: str
    account_holder_name: str


class InboundSyncRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    provider: str = "SAP"
    entity_type: str
    data: dict[str, Any]


class ERPEntityMappingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    erp_system: str
    entity_type: str
    internal_id: UUID
    external_id: str
    sync_direction: str
    sync_status: str
    retry_count: int
    last_error: str | None = None
    idoc_number: str | None = None
    payload_checksum: str | None = None
    reconciliation_hash: str | None = None
    metadata_json: dict[str, Any] = {}
    last_synced_at: datetime
    created_at: datetime


class ERPSyncTriggerRequest(BaseModel):
    erp_system: str = "SAP_S4HANA"  # SAP_S4HANA, NETSUITE, ORACLE_CLOUD
    entity_type: str  # PURCHASE_ORDER, INVOICE, VENDOR, GOODS_RECEIPT
    internal_id: UUID
    force_retry: bool = False


class ERPSyncTriggerResponse(BaseModel):
    status: str
    erp_system: str
    entity_type: str
    internal_id: UUID
    external_id: str
    idoc_number: str | None = None
    payload_checksum: str | None = None
    synced_at: datetime
    message: str


class ERPReconciliationReportResponse(BaseModel):
    org_id: UUID
    erp_system: str | None = None
    total_mapped_entities: int
    success_count: int
    pending_count: int
    failed_count: int
    dead_letter_count: int
    parity_percentage: float
    recent_mappings: list[ERPEntityMappingResponse]
    dead_letter_queue: list[ERPEntityMappingResponse]


