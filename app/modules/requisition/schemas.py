from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.db.enums import ProcurementType


class PRLineItemRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    line_number: int = Field(ge=1)
    item_description: str = Field(min_length=3, max_length=500)
    item_code: str | None = Field(None, max_length=50)
    category_id: UUID
    uom_id: UUID
    quantity: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    estimated_unit_price: Decimal = Field(default=Decimal("0.0"), ge=0, max_digits=18, decimal_places=4)
    hsn_code: str | None = Field(None, max_length=10)
    specifications: str | None = None
    required_by_date: date | None = None
    delivery_location_id: UUID | None = None

    @field_validator("required_by_date")
    @classmethod
    def validate_future_date(cls, v: date | None) -> date | None:
        if v and v < date.today():
            raise ValueError("Required-by date must be in the future")
        return v

    @computed_field
    @property
    def estimated_total(self) -> Decimal:
        return self.quantity * self.estimated_unit_price


class PRCreateRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str = Field(min_length=3, max_length=300)
    description: str | None = None
    procurement_type: ProcurementType = Field(default=ProcurementType.OPEX)
    business_unit_id: UUID
    plant_id: UUID | None = None
    department_id: UUID | None = None
    cost_center_id: UUID
    category_id: UUID
    currency: str = Field(default="INR", min_length=3, max_length=3)
    is_emergency: bool = False
    is_capex: bool = False
    required_by_date: date | None = None
    delivery_location_id: UUID | None = None
    lines: list[PRLineItemRequest] = Field(default_factory=list, max_length=100)

    @field_validator("lines")
    @classmethod
    def validate_unique_line_numbers(cls, v: list[PRLineItemRequest]) -> list[PRLineItemRequest]:
        numbers = [line.line_number for line in v]
        if len(numbers) != len(set(numbers)):
            raise ValueError("Line numbers must be unique")
        return v

    @computed_field
    @property
    def estimated_value(self) -> Decimal:
        return sum(line.estimated_total for line in self.lines)


class PRUpdateRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str | None = Field(None, min_length=3, max_length=300)
    description: str | None = None
    procurement_type: ProcurementType | None = None
    business_unit_id: UUID | None = None
    plant_id: UUID | None = None
    department_id: UUID | None = None
    cost_center_id: UUID | None = None
    category_id: UUID | None = None
    currency: str | None = Field(None, min_length=3, max_length=3)
    is_emergency: bool | None = None
    is_capex: bool | None = None
    required_by_date: date | None = None
    delivery_location_id: UUID | None = None
    lines: list[PRLineItemRequest] | None = None


class PRApprovalAction(BaseModel):
    action: str = Field(pattern="^(APPROVE|REJECT|RETURN)$")
    comment: str | None = Field(None, max_length=1000)

    @field_validator("comment")
    @classmethod
    def require_comment_on_reject(cls, v: str | None, info: Any) -> str | None:
        action = info.data.get("action")
        if action in ("REJECT", "RETURN") and not v:
            raise ValueError("Comment is required for REJECT or RETURN actions")
        return v


class PRMergeRequest(BaseModel):
    pr_ids: list[UUID] = Field(min_length=2, max_length=20)
    merged_title: str | None = Field(None, min_length=3, max_length=300)


class PRSplitItem(BaseModel):
    category_id: UUID
    line_numbers: list[int] = Field(min_length=1)
    title: str | None = None
    cost_center_id: UUID | None = None


class PRSplitRequest(BaseModel):
    splits: list[PRSplitItem] = Field(min_length=2)


class PRLineItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    requisition_id: UUID
    line_number: int
    item_description: str
    item_code: str | None = None
    category_id: UUID
    uom_id: UUID
    quantity: Decimal
    estimated_unit_price: Decimal
    estimated_total: Decimal | None = None
    hsn_code: str | None = None
    specifications: str | None = None
    required_by_date: date | None = None
    delivery_location_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class PRDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    pr_number: str
    title: str
    description: str | None = None
    source: str
    status: str
    procurement_type: str
    requestor_id: UUID
    business_unit_id: UUID
    plant_id: UUID | None = None
    department_id: UUID | None = None
    cost_center_id: UUID
    category_id: UUID
    currency: str
    estimated_value: Decimal
    budget_check_status: str
    budget_reserved_amount: Decimal
    is_emergency: bool
    is_capex: bool
    required_by_date: date | None = None
    delivery_location_id: UUID | None = None
    erp_pr_number: str | None = None
    erp_sync_status: str
    merged_from: list[UUID] | None = None
    split_into: list[UUID] | None = None
    split_from: UUID | None = None
    approved_at: datetime | None = None
    aging_alert_level: int
    po_id: UUID | None = None
    po_number: str | None = None
    is_indent: bool = False
    indentor_id: UUID | None = None
    assigned_buyer_id: UUID | None = None
    indent_notes: str | None = None
    created_at: datetime
    updated_at: datetime
    created_by: UUID | None = None
    updated_by: UUID | None = None
    lines: list[PRLineItemResponse] = Field(default_factory=list)

    @field_validator("is_indent", mode="before")
    @classmethod
    def coerce_is_indent(cls, v: Any) -> bool:
        if v is None:
            return False
        return bool(v)


class PRConvertToPORequest(BaseModel):
    vendor_id: UUID | None = None


class PRListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    pr_number: str
    title: str
    source: str
    status: str
    procurement_type: str
    requestor_id: UUID
    business_unit_id: UUID
    category_id: UUID
    currency: str
    estimated_value: Decimal
    budget_check_status: str
    required_by_date: date | None = None
    is_indent: bool = False
    indentor_id: UUID | None = None
    assigned_buyer_id: UUID | None = None
    indent_notes: str | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("is_indent", mode="before")
    @classmethod
    def coerce_is_indent(cls, v: Any) -> bool:
        if v is None:
            return False
        return bool(v)


class BudgetCheckResult(BaseModel):
    status: str  # SUFFICIENT, WARNING, BLOCKED
    available: Decimal
    requested: Decimal
    message: str | None = None


class SourcingPathResult(BaseModel):
    path: str  # CONTRACT_CALLOFF, SPOT_BUY, RFQ
    contract_id: UUID | None = None
    contract_number: str | None = None
    vendor_id: UUID | None = None


class IndentTransferRequest(PRCreateRequest):
    assigned_buyer_id: UUID | None = None
    indent_notes: str | None = None


class IndentCartTransferRequest(BaseModel):
    assigned_buyer_id: UUID | None = None
    indent_notes: str | None = None
    business_unit_id: UUID
    cost_center_id: UUID
    delivery_location_id: UUID | None = None
    required_by_date: date | None = None


class BuyerSelectionItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    email: str
    department: str | None = None
    workload: int = 0


class IndentTransferResponse(PRDetailResponse):
    pass


class IndentorTrackingResponse(PRListResponse):
    assigned_buyer_name: str | None = None
    po_id: UUID | None = None
    po_number: str | None = None
    po_status: str | None = None
    grn_status: str | None = None

    @computed_field
    @property
    def pr_id(self) -> UUID:
        return self.id

