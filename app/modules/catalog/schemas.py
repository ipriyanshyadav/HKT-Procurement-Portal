from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PunchoutProtocolEnum(StrEnum):
    CXML = "CXML"
    OCI = "OCI"


class CatalogTierPricingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    min_quantity: float
    unit_price: float
    contract_id: UUID | None = None


class CatalogItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str
    description: str | None = None
    category_id: UUID
    category_name: str | None = None
    uom_id: UUID
    uom_code: str | None = None
    standard_price: float
    currency: str
    hsn_code: str | None = None
    image_url: str | None = None
    brand: str | None = None
    manufacturer: str | None = None
    lead_time_days: int = 3
    min_order_qty: float = 1.0
    specifications: dict[str, Any] = Field(default_factory=dict)
    is_contract_item: bool = False
    is_punchout: bool = False
    tiers: list[CatalogTierPricingResponse] = Field(default_factory=list)


class FacetOption(BaseModel):
    value: str
    count: int


class CatalogSearchResponse(BaseModel):
    items: list[CatalogItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    facets: dict[str, list[FacetOption]]


class CartItemAddRequest(BaseModel):
    item_id: UUID | None = None
    item_code: str
    item_name: str
    quantity: float = 1.0
    unit_price: float | None = None
    currency: str = "INR"
    punchout_payload: dict[str, Any] = Field(default_factory=dict)


class CartItemUpdateRequest(BaseModel):
    quantity: float


class CartItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cart_id: UUID
    item_id: UUID | None = None
    item_code: str
    item_name: str
    quantity: float
    unit_price: float
    total_price: float
    currency: str
    punchout_payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class UserCartResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    user_id: UUID
    currency: str
    status: str
    subtotal: float
    total_items: int
    items: list[CartItemResponse] = Field(default_factory=list)


class CartCheckoutRequest(BaseModel):
    title: str = "Catalog Storefront PR Checkout"
    business_unit_id: UUID
    plant_id: UUID | None = None
    department_id: UUID | None = None
    delivery_location_id: UUID | None = None
    needed_by_date: str | None = None
    notes: str | None = None


class CartCheckoutResponse(BaseModel):
    pr_id: UUID
    pr_number: str
    title: str
    total_value: float
    currency: str
    line_count: int
    status: str


class PunchoutConfigCreateRequest(BaseModel):
    supplier_name: str
    protocol: PunchoutProtocolEnum = PunchoutProtocolEnum.CXML
    inbound_url: str
    shared_secret: str
    sender_identity: str
    buyer_identity: str
    vendor_id: UUID | None = None
    logo_url: str | None = None
    is_active: bool = True


class PunchoutConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    supplier_name: str
    protocol: str
    inbound_url: str
    sender_identity: str
    buyer_identity: str
    vendor_id: UUID | None = None
    logo_url: str | None = None
    is_active: bool
    created_at: datetime


class PunchoutLaunchRequest(BaseModel):
    config_id: UUID
    return_url: str = "http://localhost:3000/marketplace/cart"


class PunchoutLaunchResponse(BaseModel):
    session_id: UUID
    session_token: str
    supplier_name: str
    protocol: str
    redirect_url: str
    form_params: dict[str, str] = Field(default_factory=dict)


class PunchoutCallbackItem(BaseModel):
    item_code: str
    item_name: str
    quantity: float
    unit_price: float
    currency: str = "INR"
    uom: str | None = None
    supplier_part_id: str | None = None


class PunchoutCallbackRequest(BaseModel):
    session_token: str
    items: list[PunchoutCallbackItem] = Field(default_factory=list)
    cxml_payload: str | None = None
    oci_params: dict[str, Any] | None = None
