from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DRCheckpointCreateRequest(BaseModel):
    checkpoint_type: str = Field(..., description="e.g. POSTGRES_PITR_WAL, MINIO_WORM_SNAPSHOT, REDIS_RDB, ELASTICSEARCH_SNAPSHOT")
    storage_tier: str = Field("HOT_STANDBY", description="HOT_STANDBY, COLD_S3_GLACIER, CROSS_REGION_REPLICA")
    storage_location: str
    wal_start_lsn: str | None = None
    wal_end_lsn: str | None = None
    size_bytes: int = 0
    checksum_sha256: str | None = None
    worm_locked: bool = False
    worm_retention_until: datetime | None = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class TriggerPITRSnapshotRequest(BaseModel):
    checkpoint_type: str = Field("POSTGRES_PITR_WAL", description="POSTGRES_PITR_WAL or MINIO_WORM_SNAPSHOT")
    storage_tier: str = "HOT_STANDBY"
    worm_locked: bool = True
    retention_days: int = Field(30, ge=1, le=365)
    custom_tag: str | None = None


class VerifyCheckpointResponse(BaseModel):
    checkpoint_id: UUID
    status: str
    checksum_sha256: str
    is_valid: bool
    worm_locked: bool
    verification_notes: str


class DRCheckpointResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    checkpoint_type: str
    status: str
    storage_tier: str
    storage_location: str
    wal_start_lsn: str | None
    wal_end_lsn: str | None
    size_bytes: int
    checksum_sha256: str
    worm_locked: bool
    worm_retention_until: datetime | None
    metadata_json: dict[str, Any]
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class RunFailoverDrillRequest(BaseModel):
    drill_name: str = Field(..., min_length=3, max_length=255)
    simulated_disaster_scenario: str = Field(
        "PRIMARY_REGION_OUTAGE",
        description="PRIMARY_REGION_OUTAGE, DATABASE_CORRUPTION, RANSOMWARE_EVENT",
    )
    target_environment: str = Field("SECONDARY_K3S_COLD_STANDBY")
    target_rpo_minutes: int = Field(60, ge=1)
    target_rto_minutes: int = Field(240, ge=1)


class DRFailoverDrillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    drill_code: str
    drill_name: str
    target_environment: str
    status: str
    simulated_disaster_scenario: str
    target_rpo_minutes: int
    target_rto_minutes: int
    actual_rpo_minutes: Decimal | None
    actual_rto_minutes: Decimal | None
    rpo_compliant: bool | None
    rto_compliant: bool | None
    initiated_by: UUID | None
    started_at: datetime | None
    completed_at: datetime | None
    drill_phases: list[dict[str, Any]]
    audit_report: dict[str, Any]
    created_at: datetime


class DRPostureMetricsResponse(BaseModel):
    current_rpo_minutes: Decimal
    target_rpo_minutes: int
    target_rto_minutes: int
    dr_readiness_status: str  # HEALTHY, WARNING, CRITICAL
    last_checkpoint_timestamp: datetime | None
    last_verified_checksum: str | None
    worm_locked_percentage: Decimal
    total_checkpoints_count: int
    total_storage_bytes: int
    secondary_cluster_status: str
    dns_failover_ttl_seconds: int
    recent_drills_passed: int
    recent_drills_total: int
