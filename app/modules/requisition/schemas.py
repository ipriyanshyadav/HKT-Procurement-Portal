from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Any
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, computed_field, ConfigDict
from app.db.enums import ProcurementType, PRStatus, PRSource


class PRLineItemRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    line_number: int = Field(ge=1)
    item_description: str = Field(min_length=3, max_length=500)
    item_code: Optional[str] = Field(None, max_length=50)
    category_id: UUID
    uom_id: UUID
    quantity: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    estimated_unit_price: Decimal = Field(default=Decimal("0.0"), ge=0, max_digits=18, decimal_places=4)
    hsn_code: Optional[str] = Field(None, max_length=10)
    specifications: Optional[str] = None
    required_by_date: Optional[date] = None
    delivery_location_id: Optional[UUID] = None

    @field_validator("required_by_date")
    @classmethod
    def validate_future_date(cls, v: Optional[date]) -> Optional[date]:
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
    description: Optional[str] = None
    procurement_type: ProcurementType = Field(default=ProcurementType.OPEX)
    business_unit_id: UUID
    plant_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    cost_center_id: UUID
    category_id: UUID
    currency: str = Field(default="INR", min_length=3, max_length=3)
    is_emergency: bool = False
    is_capex: bool = False
    required_by_date: Optional[date] = None
    delivery_location_id: Optional[UUID] = None
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

    title: Optional[str] = Field(None, min_length=3, max_length=300)
    description: Optional[str] = None
    procurement_type: Optional[ProcurementType] = None
    business_unit_id: Optional[UUID] = None
    plant_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    cost_center_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    is_emergency: Optional[bool] = None
    is_capex: Optional[bool] = None
    required_by_date: Optional[date] = None
    delivery_location_id: Optional[UUID] = None
    lines: Optional[list[PRLineItemRequest]] = None


class PRApprovalAction(BaseModel):
    action: str = Field(pattern="^(APPROVE|REJECT|RETURN)$")
    comment: Optional[str] = Field(None, max_length=1000)

    @field_validator("comment")
    @classmethod
    def require_comment_on_reject(cls, v: Optional[str], info: Any) -> Optional[str]:
        action = info.data.get("action")
        if action in ("REJECT", "RETURN") and not v:
            raise ValueError("Comment is required for REJECT or RETURN actions")
        return v


class PRMergeRequest(BaseModel):
    pr_ids: list[UUID] = Field(min_length=2, max_length=20)
    merged_title: Optional[str] = Field(None, min_length=3, max_length=300)


class PRSplitItem(BaseModel):
    category_id: UUID
    line_numbers: list[int] = Field(min_length=1)
    title: Optional[str] = None
    cost_center_id: Optional[UUID] = None


class PRSplitRequest(BaseModel):
    splits: list[PRSplitItem] = Field(min_length=2)


class PRLineItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    requisition_id: UUID
    line_number: int
    item_description: str
    item_code: Optional[str] = None
    category_id: UUID
    uom_id: UUID
    quantity: Decimal
    estimated_unit_price: Decimal
    estimated_total: Optional[Decimal] = None
    hsn_code: Optional[str] = None
    specifications: Optional[str] = None
    required_by_date: Optional[date] = None
    delivery_location_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class PRDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    pr_number: str
    title: str
    description: Optional[str] = None
    source: str
    status: str
    procurement_type: str
    requestor_id: UUID
    business_unit_id: UUID
    plant_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    cost_center_id: UUID
    category_id: UUID
    currency: str
    estimated_value: Decimal
    budget_check_status: str
    budget_reserved_amount: Decimal
    is_emergency: bool
    is_capex: bool
    required_by_date: Optional[date] = None
    delivery_location_id: Optional[UUID] = None
    erp_pr_number: Optional[str] = None
    erp_sync_status: str
    merged_from: Optional[list[UUID]] = None
    split_into: Optional[list[UUID]] = None
    split_from: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    aging_alert_level: int
    po_id: Optional[UUID] = None
    po_number: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None
    lines: list[PRLineItemResponse] = Field(default_factory=list)


class PRConvertToPORequest(BaseModel):
    vendor_id: Optional[UUID] = None


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
    required_by_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime


class BudgetCheckResult(BaseModel):
    status: str  # SUFFICIENT, WARNING, BLOCKED
    available: Decimal
    requested: Decimal
    message: Optional[str] = None


class SourcingPathResult(BaseModel):
    path: str  # CONTRACT_CALLOFF, SPOT_BUY, RFQ
    contract_id: Optional[UUID] = None
    contract_number: Optional[str] = None
    vendor_id: Optional[UUID] = None
