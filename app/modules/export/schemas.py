"""Schemas for Export Center (SPEC 27-G).

Module: export
Layer: schema
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

SUPPORTED_EXPORT_TYPES = [
    "REQUISITIONS",
    "RFQS",
    "BIDS",
    "VENDORS",
    "CONTRACTS",
    "PURCHASE_ORDERS",
    "GRN",
    "INVOICES",
    "PAYMENTS",
    "TICKETS",
    "AUDIT_TRAIL",
    "ANALYTICS_SPEND",
    "ANALYTICS_VENDORS",
    "UNMAPPED_PRS",
    "WORKFLOW_TASKS",
    "USERS",
    "API_KEY_USAGE",
]


class ExportJobCreateRequest(BaseModel):
    export_type: str = Field(
        ...,
        description="Type of entity to export (e.g. REQUISITIONS, INVOICES, PURCHASE_ORDERS, TICKETS)",
    )
    filters: dict[str, Any] = Field(
        default_factory=dict,
        description="Snapshot of active search/filter parameters for the export",
    )
    format: Literal["CSV", "EXCEL"] = Field(
        default="CSV",
        description="Target output file format",
    )


class ExportJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    requested_by: UUID
    export_type: str
    filters: dict[str, Any] = Field(default_factory=dict)
    format: str
    status: str
    total_rows: int | None = None
    processed_rows: int = 0
    file_size_bytes: int | None = None
    presigned_url: str | None = None
    error_message: str | None = None
    expires_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class ExportJobRefreshUrlResponse(BaseModel):
    job_id: UUID
    presigned_url: str
    expires_at: datetime
