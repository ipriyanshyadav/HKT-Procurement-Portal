from __future__ import annotations
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    entity_type: str
    entity_id: UUID
    category: str
    original_filename: str
    stored_filename: Optional[str] = None
    content_type: str
    file_size_bytes: int
    scan_status: str
    scan_result: Optional[str] = None
    current_version: int = 1
    created_at: datetime


class DocumentVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    document_id: UUID
    version_number: int
    file_size_bytes: int
    sha256_hash: str
    uploaded_by: UUID
    created_at: datetime


class PresignedUrlResponse(BaseModel):
    url: str
    expires_in: int
