from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ============================================================================
# Organization Schemas
# ============================================================================

class OrganizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    legal_name: str
    registration_number: Optional[str] = None
    tax_id: Optional[str] = None
    country_code: str = "IN"
    base_currency: str = "INR"
    cost_of_capital_rate: Decimal = Decimal("0.1200")
    logo_url: Optional[str] = None
    settings: Dict[str, Any] = Field(default_factory=dict)
    version: Optional[int] = 1
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class OrganizationUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    legal_name: Optional[str] = Field(default=None, min_length=1, max_length=300)
    registration_number: Optional[str] = Field(default=None, max_length=50)
    tax_id: Optional[str] = Field(default=None, max_length=50)
    country_code: Optional[str] = Field(default=None, min_length=2, max_length=2)
    base_currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    cost_of_capital_rate: Optional[Decimal] = None
    logo_url: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None

    @field_validator("country_code", mode="before")
    @classmethod
    def _uppercase_country_code(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if isinstance(v, str) else v

    @field_validator("base_currency", mode="before")
    @classmethod
    def _uppercase_base_currency(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if isinstance(v, str) else v


# ============================================================================
# Legal Entity Schemas
# ============================================================================

class LegalEntityCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    registration_number: str = Field(..., min_length=1, max_length=50)
    gstin: Optional[str] = Field(default=None, max_length=15)
    pan: Optional[str] = Field(default=None, max_length=10)
    cin: Optional[str] = Field(default=None, max_length=21)
    address_line1: Optional[str] = Field(default=None, max_length=300)
    address_line2: Optional[str] = Field(default=None, max_length=300)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    postal_code: Optional[str] = Field(default=None, max_length=10)
    country_code: str = Field(default="IN", min_length=2, max_length=2)

    @field_validator("country_code", mode="before")
    @classmethod
    def _uppercase_country_code(cls, v: str) -> str:
        return v.strip().upper() if isinstance(v, str) else v


class LegalEntityUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    registration_number: Optional[str] = Field(default=None, min_length=1, max_length=50)
    gstin: Optional[str] = Field(default=None, max_length=15)
    pan: Optional[str] = Field(default=None, max_length=10)
    cin: Optional[str] = Field(default=None, max_length=21)
    address_line1: Optional[str] = Field(default=None, max_length=300)
    address_line2: Optional[str] = Field(default=None, max_length=300)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    postal_code: Optional[str] = Field(default=None, max_length=10)
    country_code: Optional[str] = Field(default=None, min_length=2, max_length=2)

    @field_validator("country_code", mode="before")
    @classmethod
    def _uppercase_country_code(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if isinstance(v, str) else v


class LegalEntityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    name: str
    registration_number: str
    gstin: Optional[str] = None
    pan: Optional[str] = None
    cin: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country_code: str = "IN"
    version: Optional[int] = 1
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============================================================================
# Business Unit Schemas
# ============================================================================

class BusinessUnitCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    legal_entity_id: UUID
    erp_company_code: Optional[str] = Field(default=None, max_length=20)
    default_currency: str = Field(default="INR", min_length=3, max_length=3)
    is_active: bool = True

    @field_validator("code", mode="before")
    @classmethod
    def _strip_code(cls, v: str) -> str:
        return v.strip().upper() if isinstance(v, str) else v

    @field_validator("default_currency", mode="before")
    @classmethod
    def _uppercase_currency(cls, v: str) -> str:
        return v.strip().upper() if isinstance(v, str) else v


class BusinessUnitUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    legal_entity_id: Optional[UUID] = None
    erp_company_code: Optional[str] = Field(default=None, max_length=20)
    default_currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    is_active: Optional[bool] = None

    @field_validator("default_currency", mode="before")
    @classmethod
    def _uppercase_currency(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if isinstance(v, str) else v


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
    version: Optional[int] = 1
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============================================================================
# Plant Schemas
# ============================================================================

class PlantCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    business_unit_id: UUID
    plant_type: str = Field(default="MANUFACTURING", max_length=50)
    erp_plant_code: Optional[str] = Field(default=None, max_length=20)
    address_line1: Optional[str] = Field(default=None, max_length=300)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    postal_code: Optional[str] = Field(default=None, max_length=10)
    country_code: str = Field(default="IN", min_length=2, max_length=2)
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    default_delivery_location_id: Optional[UUID] = None
    is_active: bool = True

    @field_validator("code", mode="before")
    @classmethod
    def _strip_code(cls, v: str) -> str:
        return v.strip().upper() if isinstance(v, str) else v

    @field_validator("country_code", mode="before")
    @classmethod
    def _uppercase_country_code(cls, v: str) -> str:
        return v.strip().upper() if isinstance(v, str) else v


class PlantUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    business_unit_id: Optional[UUID] = None
    plant_type: Optional[str] = Field(default=None, max_length=50)
    erp_plant_code: Optional[str] = Field(default=None, max_length=20)
    address_line1: Optional[str] = Field(default=None, max_length=300)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    postal_code: Optional[str] = Field(default=None, max_length=10)
    country_code: Optional[str] = Field(default=None, min_length=2, max_length=2)
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    default_delivery_location_id: Optional[UUID] = None
    is_active: Optional[bool] = None

    @field_validator("country_code", mode="before")
    @classmethod
    def _uppercase_country_code(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if isinstance(v, str) else v


class PlantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    business_unit_id: UUID
    code: str
    name: str
    plant_type: str = "MANUFACTURING"
    erp_plant_code: Optional[str] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country_code: str = "IN"
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    default_delivery_location_id: Optional[UUID] = None
    is_active: bool = True
    version: Optional[int] = 1
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============================================================================
# Department Schemas
# ============================================================================

class DepartmentCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    business_unit_id: UUID
    head_user_id: Optional[UUID] = None
    is_active: bool = True

    @field_validator("code", mode="before")
    @classmethod
    def _strip_code(cls, v: str) -> str:
        return v.strip().upper() if isinstance(v, str) else v


class DepartmentUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    business_unit_id: Optional[UUID] = None
    head_user_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    business_unit_id: UUID
    code: str
    name: str
    head_user_id: Optional[UUID] = None
    is_active: bool = True
    version: Optional[int] = 1
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============================================================================
# Cost Center Schemas
# ============================================================================

class CostCenterCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    business_unit_id: UUID
    gl_account: Optional[str] = Field(default=None, max_length=20)
    erp_cost_center_code: Optional[str] = Field(default=None, max_length=20)
    annual_budget: Decimal = Field(default=Decimal("0.0"))
    available_budget: Decimal = Field(default=Decimal("0.0"))
    budget_period_start: Optional[date] = None
    budget_period_end: Optional[date] = None
    is_active: bool = True

    @field_validator("code", mode="before")
    @classmethod
    def _strip_code(cls, v: str) -> str:
        return v.strip().upper() if isinstance(v, str) else v


class CostCenterUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    business_unit_id: Optional[UUID] = None
    gl_account: Optional[str] = Field(default=None, max_length=20)
    erp_cost_center_code: Optional[str] = Field(default=None, max_length=20)
    annual_budget: Optional[Decimal] = None
    available_budget: Optional[Decimal] = None
    budget_period_start: Optional[date] = None
    budget_period_end: Optional[date] = None
    is_active: Optional[bool] = None


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
    budget_period_start: Optional[Union[date, datetime]] = None
    budget_period_end: Optional[Union[date, datetime]] = None
    is_active: bool = True
    version: Optional[int] = 1
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

