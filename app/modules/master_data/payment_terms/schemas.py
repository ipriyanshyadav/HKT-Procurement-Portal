from __future__ import annotations

from decimal import Decimal
from typing import Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field


class PaymentTermCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    net_days: int = Field(..., ge=0, le=365)
    discount_percentage: Decimal = Field(default=Decimal("0"), ge=Decimal("0"), le=Decimal("100"))
    discount_days: int = Field(default=0, ge=0)
    description: Optional[str] = None


class PaymentTermUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    net_days: Optional[int] = Field(default=None, ge=0, le=365)
    discount_percentage: Optional[Decimal] = Field(default=None, ge=Decimal("0"), le=Decimal("100"))
    discount_days: Optional[int] = Field(default=None, ge=0)
    description: Optional[str] = None


class PaymentTermResponse(BaseModel):
    id: UUID
    org_id: UUID
    code: str
    name: str
    net_days: int
    discount_percentage: Decimal
    discount_days: int
    description: Optional[str]
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
