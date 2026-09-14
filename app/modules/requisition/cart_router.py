from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.core.exceptions import NotFoundError
from app.core.responses import APIResponse, success_response, created_response
from app.modules.user.models import User
from app.modules.requisition.cart_schemas import (
    CartCreateRequest,
    CartItemRequest,
    CartItemUpdateRequest,
    CartTransferRequest,
    CartResponse,
    CartItemResponse,
    CartSummary
)
from app.modules.requisition.cart_service import indent_cart_service
from app.modules.requisition.schemas import PRDetailResponse

router = APIRouter(prefix='/indent/cart', tags=['Indent Cart'])

@router.get("", response_model=APIResponse[CartResponse])
async def get_active_cart(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cart = await indent_cart_service.get_active_cart(db, current_user.id, current_user.org_id)
    if not cart:
        raise NotFoundError("No active cart found")
    
    # Filter deleted items
    cart.items = [i for i in cart.items if i.deleted_at is None]
    cart.item_count = len(cart.items)
    cart.estimated_total = sum((i.quantity * i.estimated_unit_price for i in cart.items), 0)
    
    return success_response(cart)

@router.post("", response_model=APIResponse[CartResponse])
async def create_cart(
    data: CartCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cart = await indent_cart_service.create_cart(db, current_user.id, current_user.org_id, data)
    await db.commit()
    await db.refresh(cart)
    cart.items = []
    cart.item_count = 0
    cart.estimated_total = 0
    return created_response(cart)

@router.delete("/{cart_id}", response_model=APIResponse[dict])
async def abandon_cart(
    cart_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await indent_cart_service.abandon_cart(db, cart_id, current_user.org_id, current_user.id)
    await db.commit()
    return success_response({"status": "abandoned"})

@router.get("/{cart_id}/items", response_model=APIResponse[list[CartItemResponse]])
async def list_items(
    cart_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cart = await indent_cart_service.get_active_cart(db, current_user.id, current_user.org_id)
    if not cart or cart.id != cart_id:
        raise NotFoundError("Cart not found")
    items = [i for i in cart.items if i.deleted_at is None]
    return success_response(items)

@router.post("/{cart_id}/items", response_model=APIResponse[CartItemResponse])
async def add_item(
    cart_id: UUID,
    data: CartItemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    item = await indent_cart_service.add_item(db, cart_id, current_user.org_id, current_user.id, data)
    await db.commit()
    await db.refresh(item)
    return created_response(item)

@router.put("/{cart_id}/items/{item_id}", response_model=APIResponse[CartItemResponse])
async def update_item(
    cart_id: UUID,
    item_id: UUID,
    data: CartItemUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    item = await indent_cart_service.update_item(db, cart_id, item_id, current_user.org_id, current_user.id, data)
    await db.commit()
    await db.refresh(item)
    return success_response(item)

@router.delete("/{cart_id}/items/{item_id}", response_model=APIResponse[dict])
async def remove_item(
    cart_id: UUID,
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await indent_cart_service.remove_item(db, cart_id, item_id, current_user.org_id, current_user.id)
    await db.commit()
    return success_response({"status": "removed"})

@router.post("/{cart_id}/transfer", response_model=APIResponse[PRDetailResponse])
async def transfer_cart_to_buyer(
    cart_id: UUID,
    data: CartTransferRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    req = await indent_cart_service.transfer_cart_to_buyer(db, cart_id, current_user.org_id, current_user.id, data)
    await db.commit()
    await db.refresh(req)
    return success_response(req)

@router.get("/{cart_id}/summary", response_model=APIResponse[CartSummary])
async def get_cart_summary(
    cart_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    summary = await indent_cart_service.get_cart_summary(db, cart_id, current_user.org_id, current_user.id)
    return success_response(summary)
