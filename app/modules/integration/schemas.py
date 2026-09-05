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

