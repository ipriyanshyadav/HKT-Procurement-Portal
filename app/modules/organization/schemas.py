from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
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
    registration_number: str | None = None
    tax_id: str | None = None
    country_code: str = "IN"
    base_currency: str = "INR"
    cost_of_capital_rate: Decimal = Decimal("0.1200")
    logo_url: str | None = None
    settings: dict[str, Any] = Field(default_factory=dict)
    version: int | None = 1
    created_at: datetime | None = None
    updated_at: datetime | None = None


class OrganizationUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    legal_name: str | None = Field(default=None, min_length=1, max_length=300)
    registration_number: str | None = Field(default=None, max_length=50)
    tax_id: str | None = Field(default=None, max_length=50)
    country_code: str | None = Field(default=None, min_length=2, max_length=2)
    base_currency: str | None = Field(default=None, min_length=3, max_length=3)
    cost_of_capital_rate: Decimal | None = None
    logo_url: str | None = None
    settings: dict[str, Any] | None = None

    @field_validator("country_code", mode="before")
    @classmethod
    def _uppercase_country_code(cls, v: str | None) -> str | None:
        return v.strip().upper() if isinstance(v, str) else v

    @field_validator("base_currency", mode="before")
    @classmethod
    def _uppercase_base_currency(cls, v: str | None) -> str | None:
        return v.strip().upper() if isinstance(v, str) else v


# ============================================================================
# Legal Entity Schemas
# ============================================================================

class LegalEntityCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    registration_number: str = Field(..., min_length=1, max_length=50)
    gstin: str | None = Field(default=None, max_length=15)
    pan: str | None = Field(default=None, max_length=10)
    cin: str | None = Field(default=None, max_length=21)
    address_line1: str | None = Field(default=None, max_length=300)
    address_line2: str | None = Field(default=None, max_length=300)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=10)
    country_code: str = Field(default="IN", min_length=2, max_length=2)

    @field_validator("country_code", mode="before")
    @classmethod
    def _uppercase_country_code(cls, v: str) -> str:
        return v.strip().upper() if isinstance(v, str) else v


class LegalEntityUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    registration_number: str | None = Field(default=None, min_length=1, max_length=50)
    gstin: str | None = Field(default=None, max_length=15)
    pan: str | None = Field(default=None, max_length=10)
    cin: str | None = Field(default=None, max_length=21)
    address_line1: str | None = Field(default=None, max_length=300)
    address_line2: str | None = Field(default=None, max_length=300)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=10)
    country_code: str | None = Field(default=None, min_length=2, max_length=2)

    @field_validator("country_code", mode="before")
    @classmethod
    def _uppercase_country_code(cls, v: str | None) -> str | None:
        return v.strip().upper() if isinstance(v, str) else v


class LegalEntityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    name: str
    registration_number: str
    gstin: str | None = None
    pan: str | None = None
    cin: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country_code: str = "IN"
    version: int | None = 1
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ============================================================================
# Business Unit Schemas
# ============================================================================

class BusinessUnitCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    legal_entity_id: UUID
    erp_company_code: str | None = Field(default=None, max_length=20)
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
    name: str | None = Field(default=None, min_length=1, max_length=200)
    legal_entity_id: UUID | None = None
    erp_company_code: str | None = Field(default=None, max_length=20)
    default_currency: str | None = Field(default=None, min_length=3, max_length=3)
    is_active: bool | None = None

    @field_validator("default_currency", mode="before")
    @classmethod
    def _uppercase_currency(cls, v: str | None) -> str | None:
        return v.strip().upper() if isinstance(v, str) else v


class BusinessUnitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    code: str
    name: str
    legal_entity_id: UUID
    erp_company_code: str | None = None
    default_currency: str = "INR"
    is_active: bool = True
    version: int | None = 1
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ============================================================================
# Plant Schemas
# ============================================================================

class PlantCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    business_unit_id: UUID
    plant_type: str = Field(default="MANUFACTURING", max_length=50)
    erp_plant_code: str | None = Field(default=None, max_length=20)
    address_line1: str | None = Field(default=None, max_length=300)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=10)
    country_code: str = Field(default="IN", min_length=2, max_length=2)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    default_delivery_location_id: UUID | None = None
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
    name: str | None = Field(default=None, min_length=1, max_length=200)
    business_unit_id: UUID | None = None
    plant_type: str | None = Field(default=None, max_length=50)
    erp_plant_code: str | None = Field(default=None, max_length=20)
    address_line1: str | None = Field(default=None, max_length=300)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=10)
    country_code: str | None = Field(default=None, min_length=2, max_length=2)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    default_delivery_location_id: UUID | None = None
    is_active: bool | None = None

    @field_validator("country_code", mode="before")
    @classmethod
    def _uppercase_country_code(cls, v: str | None) -> str | None:
        return v.strip().upper() if isinstance(v, str) else v


class PlantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    business_unit_id: UUID
    code: str
    name: str
    plant_type: str = "MANUFACTURING"
    erp_plant_code: str | None = None
    address_line1: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country_code: str = "IN"
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    default_delivery_location_id: UUID | None = None
    is_active: bool = True
    version: int | None = 1
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ============================================================================
# Department Schemas
# ============================================================================

class DepartmentCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    business_unit_id: UUID
    head_user_id: UUID | None = None
    is_active: bool = True

    @field_validator("code", mode="before")
    @classmethod
    def _strip_code(cls, v: str) -> str:
        return v.strip().upper() if isinstance(v, str) else v


class DepartmentUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    business_unit_id: UUID | None = None
    head_user_id: UUID | None = None
    is_active: bool | None = None


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    business_unit_id: UUID
    code: str
    name: str
    head_user_id: UUID | None = None
    is_active: bool = True
    version: int | None = 1
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ============================================================================
# Cost Center Schemas
# ============================================================================

class CostCenterCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    business_unit_id: UUID
    gl_account: str | None = Field(default=None, max_length=20)
    erp_cost_center_code: str | None = Field(default=None, max_length=20)
    annual_budget: Decimal = Field(default=Decimal("0.0"))
    available_budget: Decimal = Field(default=Decimal("0.0"))
    budget_period_start: date | None = None
    budget_period_end: date | None = None
    is_active: bool = True

    @field_validator("code", mode="before")
    @classmethod
    def _strip_code(cls, v: str) -> str:
        return v.strip().upper() if isinstance(v, str) else v


class CostCenterUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    business_unit_id: UUID | None = None
    gl_account: str | None = Field(default=None, max_length=20)
    erp_cost_center_code: str | None = Field(default=None, max_length=20)
    annual_budget: Decimal | None = None
    available_budget: Decimal | None = None
    budget_period_start: date | None = None
    budget_period_end: date | None = None
    is_active: bool | None = None


class CostCenterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    code: str
    name: str
    business_unit_id: UUID
    gl_account: str | None = None
    erp_cost_center_code: str | None = None
    annual_budget: Decimal = Decimal("0.0")
    available_budget: Decimal = Decimal("0.0")
    budget_period_start: date | datetime | None = None
    budget_period_end: date | datetime | None = None
    is_active: bool = True
    version: int | None = 1
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ============================================================================
# Multi-Tenant Active Company Switcher & Cross-Tenant Rollup Schemas
# ============================================================================

class CompanyContextResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    name: str
    code: str | None = None
    registration_number: str
    country_code: str
    currency: str = "INR"
    gstin: str | None = None
    business_unit_count: int = 0
    is_active_context: bool = False


class SwitchCompanyContextRequest(BaseModel):
    target_legal_entity_id: UUID
    target_org_id: UUID | None = None


class SwitchCompanyContextResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    active_company: CompanyContextResponse
    user_id: UUID
    email: str


class EntityRollupItem(BaseModel):
    entity_id: UUID
    entity_name: str
    country_code: str
    spend: Decimal
    po_count: int
    average_po_value: Decimal
    spend_percentage: float
    pr_to_po_cycle_days: float
    invoice_processing_days: float
    discount_capture_rate: float


class VendorOverlapItem(BaseModel):
    vendor_id: UUID
    vendor_name: str
    entity_count: int
    entity_names: list[str]
    total_group_spend: Decimal
    po_count: int
    consolidation_opportunity: str


class CategoryRollupItem(BaseModel):
    category_name: str
    spend: Decimal
    spend_percentage: float


class CrossTenantRollupResponse(BaseModel):
    total_spend: Decimal
    total_po_count: int
    total_pr_count: int
    active_vendors_count: int
    total_entities_count: int
    group_currency: str
    entities: list[EntityRollupItem]
    vendor_overlaps: list[VendorOverlapItem]
    top_categories: list[CategoryRollupItem]


