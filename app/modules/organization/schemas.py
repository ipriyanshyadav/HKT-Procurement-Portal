from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BusinessUnitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    code: str
    name: str
    legal_entity_id: UUID
    erp_company_code: Optional[str] = None
    default_currency: str = "INR"
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CostCenterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    code: str
    name: str
    business_unit_id: UUID
    gl_account: Optional[str] = None
    erp_cost_center_code: Optional[str] = None
    annual_budget: Decimal = Decimal("0.0")
    available_budget: Decimal = Decimal("0.0")
    budget_period_start: Optional[datetime] = None
    budget_period_end: Optional[datetime] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
