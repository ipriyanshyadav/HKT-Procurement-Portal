from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

class CartCreateRequest(BaseModel):
    cart_name: str = Field(default='My Cart', min_length=1, max_length=200)
    business_unit_id: UUID
    cost_center_id: UUID
    delivery_location_id: UUID | None = None
    required_by_date: date | None = None
    # validator: required_by_date must be today or future

class CartItemRequest(BaseModel):
    item_description: str = Field(min_length=3, max_length=500)
    item_code: str | None = Field(None, max_length=50)
    category_id: UUID
    uom_id: UUID
    quantity: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    estimated_unit_price: Decimal = Field(default=Decimal('0.0'), ge=0, max_digits=18, decimal_places=4)
    hsn_code: str | None = Field(None, max_length=10)
    specifications: str | None = None
    required_by_date: date | None = None
    delivery_location_id: UUID | None = None
    catalog_item_id: UUID | None = None  # if from catalog
    is_from_catalog: bool = False

class CartItemUpdateRequest(BaseModel):
    quantity: Decimal | None = Field(None, gt=0, max_digits=18, decimal_places=4)
    estimated_unit_price: Decimal | None = Field(None, ge=0, max_digits=18, decimal_places=4)
    specifications: str | None = None
    required_by_date: date | None = None
    delivery_location_id: UUID | None = None

class CartTransferRequest(BaseModel):
    assigned_buyer_id: UUID | None = None
    transfer_note: str | None = Field(None, max_length=2000)
    # These override cart defaults if provided:
    business_unit_id: UUID | None = None
    cost_center_id: UUID | None = None
    delivery_location_id: UUID | None = None
    required_by_date: date | None = None

class CartItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    cart_id: UUID
    catalog_item_id: UUID | None = None
    line_number: int
    item_description: str
    item_code: str | None = None
    category_id: UUID
    uom_id: UUID
    quantity: Decimal
    estimated_unit_price: Decimal
    estimated_total: Decimal  # computed: quantity * estimated_unit_price
    hsn_code: str | None = None
    specifications: str | None = None
    required_by_date: date | None = None
    delivery_location_id: UUID | None = None
    is_from_catalog: bool
    created_at: datetime

    @property
    def estimated_total(self) -> Decimal:
        return self.quantity * self.estimated_unit_price

class CartResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    org_id: UUID
    indentor_id: UUID
    cart_name: str
    status: str
    assigned_buyer_id: UUID | None = None
    transfer_note: str | None = None
    transferred_at: datetime | None = None
    business_unit_id: UUID | None = None
    cost_center_id: UUID | None = None
    delivery_location_id: UUID | None = None
    required_by_date: date | None = None
    items: list[CartItemResponse] = Field(default_factory=list)
    item_count: int = 0  # computed
    estimated_total: Decimal = Decimal('0.0')  # computed: sum of item totals
    created_at: datetime
    updated_at: datetime

class CartValidationWarning(BaseModel):
    line_number: int
    field: str
    message: str

class CartSummary(BaseModel):
    cart_id: UUID
    item_count: int
    estimated_total: Decimal
    currency: str = 'INR'
    has_blocking_errors: bool
    warnings: list[CartValidationWarning] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    # errors: ['Cost center required for transfer', 'Business unit required for transfer']
    # warnings: items missing specifications, line items with past required_by_date

class ConsigneeConfirmRequest(BaseModel):
    confirmation_note: str | None = Field(None, max_length=2000)
    # line-level acceptances (if None, accepts all as-is)
    line_acceptances: list['ConsigneeLineAcceptance'] | None = None

class ConsigneeLineAcceptance(BaseModel):
    grn_line_id: UUID
    accepted_quantity: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    notes: str | None = None

class ConsigneeRejectRequest(BaseModel):
    rejection_reason: str = Field(min_length=10, max_length=2000)  # required
    line_rejections: list[UUID] | None = None  # specific line IDs rejected; None = all
