from __future__ import annotations
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    entity_type: str
    entity_id: UUID
    category: str
    original_filename: str
    content_type: str
    file_size_bytes: int
    scan_status: str
    created_at: datetime


class PresignedUrlResponse(BaseModel):
    url: str
    expires_in: int
