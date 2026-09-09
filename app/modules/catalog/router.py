from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_any_permission
from app.core.constants import PermissionCode
from app.core.responses import success_response
from app.db.session import get_db
from app.modules.catalog.schemas import (
    CartCheckoutRequest,
    CartItemAddRequest,
    CartItemUpdateRequest,
    PunchoutCallbackRequest,
    PunchoutConfigCreateRequest,
    PunchoutConfigResponse,
    PunchoutLaunchRequest,
)
from app.modules.catalog.service import catalog_service
from app.modules.user.models import User

router = APIRouter(tags=["Catalog & PunchOut"])


@router.get("/health")
async def health():
    return {"status": "ok", "module": "catalog"}


@router.get("/items", response_model=None)
async def search_catalog(
    q: str | None = Query(None, description="Keyword search across name, code, brand, specs"),
    category_id: UUID | None = Query(None, description="Category filter"),
    brand: str | None = Query(None, description="Brand filter"),
    min_price: float | None = Query(None, ge=0.0, description="Minimum price filter"),
    max_price: float | None = Query(None, ge=0.0, description="Maximum price filter"),
    contract_only: bool = Query(False, description="Filter for pre-approved contract items"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Parametric faceted search across hosted internal catalog items."""
    results = await catalog_service.search_catalog(
        db,
        org_id=current_user.org_id,
        query=q,
        category_id=category_id,
        brand=brand,
        min_price=min_price,
        max_price=max_price,
        contract_only=contract_only,
        page=page,
        page_size=page_size,
    )
    return success_response(data=results)


@router.get("/cart", response_model=None)
async def get_cart(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve active user shopping cart with itemized pricing and volume discounts."""
    cart = await catalog_service.get_user_cart_response(
        db, org_id=current_user.org_id, user_id=current_user.id
    )
    return success_response(data=cart)


@router.post("/cart/items", response_model=None, status_code=status.HTTP_201_CREATED)
async def add_item_to_cart(
    payload: CartItemAddRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a hosted item or punchout item to active cart."""
    cart = await catalog_service.add_item_to_cart(
        db, org_id=current_user.org_id, user_id=current_user.id, payload=payload
    )
    return success_response(data=cart, message="Item added to cart")


@router.patch("/cart/items/{cart_item_id}", response_model=None)
async def update_cart_item(
    cart_item_id: UUID,
    payload: CartItemUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update item quantity in cart with automatic volume pricing recalculation."""
    cart = await catalog_service.update_cart_item_quantity(
        db,
        org_id=current_user.org_id,
        user_id=current_user.id,
        cart_item_id=cart_item_id,
        quantity=payload.quantity,
    )
    return success_response(data=cart, message="Cart item updated")


@router.delete("/cart/items/{cart_item_id}", response_model=None)
async def remove_cart_item(
    cart_item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove item from cart."""
    cart = await catalog_service.remove_cart_item(
        db,
        org_id=current_user.org_id,
        user_id=current_user.id,
        cart_item_id=cart_item_id,
    )
    return success_response(data=cart, message="Item removed from cart")


@router.post("/cart/checkout", response_model=None, status_code=status.HTTP_201_CREATED)
async def checkout_cart_to_pr(
    payload: CartCheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Convert shopping cart items directly into a Purchase Requisition draft."""
    checkout_res = await catalog_service.checkout_cart_to_pr(
        db,
        org_id=current_user.org_id,
        user_id=current_user.id,
        payload=payload,
    )
    return success_response(data=checkout_res, message="Requisition created from cart")


@router.get("/punchout/configs", response_model=None)
async def list_punchout_configs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List available PunchOut marketplaces (Amazon Business, Coupa, Grainger)."""
    configs = await catalog_service.list_punchout_configs(db, org_id=current_user.org_id)
    return success_response(
        data=[PunchoutConfigResponse.model_validate(c) for c in configs]
    )


@router.post("/punchout/configs", response_model=None, status_code=status.HTTP_201_CREATED)
async def create_punchout_config(
    payload: PunchoutConfigCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            [
                PermissionCode.ADMIN_MANAGE_SYSTEM,
                PermissionCode.ADMIN_MANAGE_SETTINGS,
                PermissionCode.INTEGRATION_CONFIGURE,
            ]
        )
    ),
):
    """Admin configuration for a new external PunchOut supplier marketplace."""
    config = await catalog_service.create_punchout_config(
        db, org_id=current_user.org_id, payload=payload
    )
    return success_response(
        data=PunchoutConfigResponse.model_validate(config),
        message="PunchOut supplier configured successfully",
    )


@router.post("/punchout/launch", response_model=None)
async def launch_punchout_session(
    payload: PunchoutLaunchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Initiate an outbound PunchOut session (cXML 1.2 or OCI 4.0)."""
    launch_res = await catalog_service.launch_punchout_session(
        db,
        org_id=current_user.org_id,
        user_id=current_user.id,
        payload=payload,
    )
    return success_response(data=launch_res)


@router.post("/punchout/callback", response_model=None)
async def process_punchout_callback(
    payload: PunchoutCallbackRequest,
    db: AsyncSession = Depends(get_db),
):
    """Inbound callback receiving punchout cart message (cXML PunchOutOrderMessage / OCI POST)."""
    cart = await catalog_service.process_punchout_callback(db, payload)
    return success_response(data=cart, message="PunchOut cart items received")
