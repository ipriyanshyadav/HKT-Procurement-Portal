from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
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
    request_payload: Optional[Dict[str, Any]] = None
    response_payload: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 7
    next_retry_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


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
    org_id: Optional[UUID] = None
    job_name: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str
    records_processed: int = 0
    error_message: Optional[str] = None
    created_at: datetime


class SyncTriggerRequest(BaseModel):
    adapter_type: str = "SAP"
    entity_type: Optional[str] = None


class SyncTriggerResponse(BaseModel):
    status: str
    adapter_type: str
    jobs_created: int
    records_processed: int
    message: str
    job_run_id: Optional[UUID] = None


class ERPConfigResponse(BaseModel):
    erp_provider: str = "SAP"
    endpoint_url: Optional[str] = None
    auth_type: str = "API_KEY"
    api_key_masked: Optional[str] = None
    allowed_domains: List[str] = []
    is_enabled: bool = True
    updated_at: Optional[datetime] = None


class ERPConfigUpdateRequest(BaseModel):
    erp_provider: str = "SAP"
    endpoint_url: Optional[str] = None
    auth_type: str = "API_KEY"
    api_key: Optional[str] = None
    allowed_domains: List[str] = []
    is_enabled: bool = True


class GSTVerificationRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    gstin: str
    legal_name: Optional[str] = None


class PANVerificationRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pan: str
    name: Optional[str] = None


class BankPennyDropRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    vendor_id: Optional[UUID] = None
    account_number: str
    ifsc_code: str
    account_holder_name: str


class InboundSyncRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    provider: str = "SAP"
    entity_type: str
    data: Dict[str, Any]


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
    last_error: Optional[str] = None
    idoc_number: Optional[str] = None
    payload_checksum: Optional[str] = None
    reconciliation_hash: Optional[str] = None
    metadata_json: Dict[str, Any] = {}
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
    idoc_number: Optional[str] = None
    payload_checksum: Optional[str] = None
    synced_at: datetime
    message: str


class ERPReconciliationReportResponse(BaseModel):
    org_id: UUID
    erp_system: Optional[str] = None
    total_mapped_entities: int
    success_count: int
    pending_count: int
    failed_count: int
    dead_letter_count: int
    parity_percentage: float
    recent_mappings: List[ERPEntityMappingResponse]
    dead_letter_queue: List[ERPEntityMappingResponse]


