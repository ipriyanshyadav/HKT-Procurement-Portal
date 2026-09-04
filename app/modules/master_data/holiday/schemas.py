from __future__ import annotations
from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class HolidayCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    holiday_date: date
    plant_id: Optional[UUID] = None


class HolidayResponse(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    holiday_date: date
    plant_id: Optional[UUID] = None
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
