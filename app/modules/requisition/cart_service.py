"""Indent cart service — manages server-side shopping cart for Indentor role.

Layer: service
Dependencies (inbound): cart_router
Dependencies (outbound): cart_models, requisition models, audit_service, notification event publisher
Events published: indent.cart_transferred, indent.cart_abandoned
"""
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.exceptions import AppException, ForbiddenError, NotFoundError
from app.db.enums import PrSourceEnum
from app.events.publisher import OutboxPublisher
from app.modules.audit.service import audit_service
from app.modules.requisition.cart_models import IndentCart, IndentCartItem
from app.modules.requisition.cart_schemas import (
    CartCreateRequest,
    CartItemRequest,
    CartItemUpdateRequest,
    CartSummary,
    CartTransferRequest,
    CartValidationWarning,
)
from app.modules.requisition.models import Requisition, RequisitionLine
from app.modules.requisition.service import requisition_service


class IndentCartService:
    CART_MAX_ITEMS = 50

    async def get_active_cart(self, db: AsyncSession, indentor_id: UUID, org_id: UUID) -> IndentCart | None:
        stmt = select(IndentCart).where(
            IndentCart.indentor_id == indentor_id,
            IndentCart.org_id == org_id,
            IndentCart.status == 'ACTIVE',
            IndentCart.deleted_at.is_(None)
        )
        result = await db.execute(stmt)
        return result.scalars().first()

    async def create_cart(self, db: AsyncSession, indentor_id: UUID, org_id: UUID, data: CartCreateRequest) -> IndentCart:
        existing = await self.get_active_cart(db, indentor_id, org_id)
        if existing:
            raise AppException(message='An active cart already exists', code='ACTIVE_CART_EXISTS', status_code=409)

        cart = IndentCart(
            org_id=org_id,
            indentor_id=indentor_id,
            cart_name=data.cart_name,
            business_unit_id=data.business_unit_id,
            cost_center_id=data.cost_center_id,
            delivery_location_id=data.delivery_location_id,
            required_by_date=data.required_by_date,
            status='ACTIVE'
        )
        db.add(cart)
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type="REQUISITION",
            entity_id=cart.id,
            action=AuditAction.INDENT_CART_CREATED,
            actor_id=indentor_id,
            org_id=org_id,
            new_values={'cart_name': cart.cart_name}
        )
        return cart

    async def add_item(self, db: AsyncSession, cart_id: UUID, org_id: UUID, indentor_id: UUID, data: CartItemRequest) -> IndentCartItem:
        stmt = select(IndentCart).where(IndentCart.id == cart_id, IndentCart.deleted_at.is_(None))
        result = await db.execute(stmt)
        cart = result.scalars().first()

        if not cart or cart.org_id != org_id or cart.status != 'ACTIVE':
            raise NotFoundError("Active cart not found")
        if cart.indentor_id != indentor_id:
            raise ForbiddenError("Not authorized to modify this cart")

        active_items_count = len([i for i in cart.items if i.deleted_at is None])
        if active_items_count >= self.CART_MAX_ITEMS:
            raise AppException(message='Cart cannot exceed 50 items', code='CART_MAX_ITEMS', status_code=422)

        max_line_number = max([i.line_number for i in cart.items] + [0])
        line_number = max_line_number + 1

        item = IndentCartItem(
            org_id=org_id,
            cart_id=cart_id,
            line_number=line_number,
            item_description=data.item_description,
            item_code=data.item_code,
            category_id=data.category_id,
            uom_id=data.uom_id,
            quantity=data.quantity,
            estimated_unit_price=data.estimated_unit_price,
            hsn_code=data.hsn_code,
            specifications=data.specifications,
            required_by_date=data.required_by_date,
            delivery_location_id=data.delivery_location_id,
            catalog_item_id=data.catalog_item_id,
            is_from_catalog=data.is_from_catalog
        )
        db.add(item)
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type="REQUISITION",
            entity_id=item.id,
            action=AuditAction.INDENT_CART_ITEM_ADDED,
            actor_id=indentor_id,
            org_id=org_id,
            new_values={'cart_id': str(cart_id), 'item_description': item.item_description}
        )
        return item

    async def update_item(self, db: AsyncSession, cart_id: UUID, item_id: UUID, org_id: UUID, indentor_id: UUID, data: CartItemUpdateRequest) -> IndentCartItem:
        stmt = select(IndentCart).where(IndentCart.id == cart_id, IndentCart.deleted_at.is_(None))
        result = await db.execute(stmt)
        cart = result.scalars().first()

        if not cart or cart.org_id != org_id or cart.status != 'ACTIVE':
            raise NotFoundError("Active cart not found")
        if cart.indentor_id != indentor_id:
            raise ForbiddenError("Not authorized to modify this cart")

        stmt_item = select(IndentCartItem).where(
            IndentCartItem.id == item_id,
            IndentCartItem.cart_id == cart_id,
            IndentCartItem.deleted_at.is_(None)
        )
        result_item = await db.execute(stmt_item)
        item = result_item.scalars().first()
        if not item:
            raise NotFoundError("Item not found in cart")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(item, key, value)

        await db.flush()
        return item

    async def remove_item(self, db: AsyncSession, cart_id: UUID, item_id: UUID, org_id: UUID, indentor_id: UUID) -> None:
        stmt = select(IndentCart).where(IndentCart.id == cart_id, IndentCart.deleted_at.is_(None))
        result = await db.execute(stmt)
        cart = result.scalars().first()

        if not cart or cart.org_id != org_id or cart.status != 'ACTIVE':
            raise NotFoundError("Active cart not found")
        if cart.indentor_id != indentor_id:
            raise ForbiddenError("Not authorized to modify this cart")

        stmt_item = select(IndentCartItem).where(
            IndentCartItem.id == item_id,
            IndentCartItem.cart_id == cart_id,
            IndentCartItem.deleted_at.is_(None)
        )
        result_item = await db.execute(stmt_item)
        item = result_item.scalars().first()
        if not item:
            raise NotFoundError("Item not found in cart")

        item.deleted_at = datetime.now(UTC)
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type="REQUISITION",
            entity_id=item.id,
            action=AuditAction.INDENT_CART_ITEM_REMOVED,
            actor_id=indentor_id,
            org_id=org_id,
            old_values={'cart_id': str(cart_id), 'item_id': str(item_id)}
        )

    async def clear_cart(self, db: AsyncSession, cart_id: UUID, org_id: UUID, indentor_id: UUID) -> IndentCart:
        stmt = select(IndentCart).where(IndentCart.id == cart_id, IndentCart.deleted_at.is_(None))
        result = await db.execute(stmt)
        cart = result.scalars().first()

        if not cart or cart.org_id != org_id or cart.status != 'ACTIVE':
            raise NotFoundError("Active cart not found")
        if cart.indentor_id != indentor_id:
            raise ForbiddenError("Not authorized to modify this cart")

        for item in cart.items:
            if item.deleted_at is None:
                item.deleted_at = datetime.now(UTC)

        await db.flush()
        return cart

    async def transfer_cart_to_buyer(self, db: AsyncSession, cart_id: UUID, org_id: UUID, actor_id: UUID, data: CartTransferRequest) -> Requisition:
        stmt = select(IndentCart).where(IndentCart.id == cart_id, IndentCart.deleted_at.is_(None))
        result = await db.execute(stmt)
        cart = result.scalars().first()

        if not cart or cart.org_id != org_id or cart.status != 'ACTIVE':
            raise NotFoundError("Active cart not found")
        if cart.indentor_id != actor_id:
            raise ForbiddenError("Not authorized to transfer this cart")

        active_items = [i for i in cart.items if i.deleted_at is None]
        if not active_items:
            raise AppException(code='CART_EMPTY', message='Cart is empty')

        business_unit_id = data.business_unit_id or cart.business_unit_id
        if not business_unit_id:
            raise AppException(code='CART_INVALID', message='Business unit required for transfer')

        cost_center_id = data.cost_center_id or cart.cost_center_id
        if not cost_center_id:
            raise AppException(code='CART_INVALID', message='Cost center required for transfer')

        delivery_location_id = data.delivery_location_id or cart.delivery_location_id
        required_by_date = data.required_by_date or cart.required_by_date

        pr_number = await requisition_service._generate_pr_number(db, business_unit_id, org_id)

        category_id = active_items[0].category_id

        requisition = Requisition(
            org_id=org_id,
            pr_number=pr_number,
            title=f"Indent: {cart.cart_name}",
            source=PrSourceEnum.INDENT_CART,
            is_indent=True,
            indentor_id=actor_id,
            requestor_id=actor_id,
            assigned_buyer_id=data.assigned_buyer_id,
            indent_notes=data.transfer_note,
            business_unit_id=business_unit_id,
            cost_center_id=cost_center_id,
            category_id=category_id,
            delivery_location_id=delivery_location_id,
            required_by_date=required_by_date,
        )

        for i, item in enumerate(active_items):
            line = RequisitionLine(
                org_id=org_id,
                line_number=i + 1,
                item_description=item.item_description,
                item_code=item.item_code,
                category_id=item.category_id,
                uom_id=item.uom_id,
                quantity=item.quantity,
                estimated_unit_price=item.estimated_unit_price,
                estimated_total=item.quantity * item.estimated_unit_price,
                hsn_code=item.hsn_code,
                specifications=item.specifications,
                required_by_date=item.required_by_date or required_by_date,
                delivery_location_id=item.delivery_location_id or delivery_location_id,
            )
            requisition.lines.append(line)

        db.add(requisition)

        cart.status = 'TRANSFERRED'
        cart.transferred_at = datetime.now(UTC)
        cart.assigned_buyer_id = data.assigned_buyer_id
        cart.transfer_note = data.transfer_note

        await db.flush()

        if data.assigned_buyer_id:
            await OutboxPublisher.publish(
                db,
                org_id,
                "indent.cart_transferred",
                {"cart_id": str(cart.id), "requisition_id": str(requisition.id), "assigned_buyer_id": str(data.assigned_buyer_id)}
            )

        await audit_service.log(
            db=db,
            entity_type="REQUISITION",
            entity_id=requisition.id,
            action=AuditAction.INDENT_CART_TRANSFERRED,
            actor_id=actor_id,
            org_id=org_id,
            new_values={'requisition_id': str(requisition.id), 'cart_id': str(cart.id)}
        )

        return requisition

    async def get_cart_summary(self, db: AsyncSession, cart_id: UUID, org_id: UUID, indentor_id: UUID) -> CartSummary:
        stmt = select(IndentCart).where(IndentCart.id == cart_id, IndentCart.deleted_at.is_(None))
        result = await db.execute(stmt)
        cart = result.scalars().first()

        if not cart or cart.org_id != org_id:
            raise NotFoundError("Cart not found")
        if cart.indentor_id != indentor_id:
            raise ForbiddenError("Not authorized to view this cart")

        active_items = [i for i in cart.items if i.deleted_at is None]
        item_count = len(active_items)
        estimated_total = sum((i.quantity * i.estimated_unit_price for i in active_items), Decimal('0.0'))

        errors = []
        warnings = []

        if not cart.cost_center_id:
            errors.append('Cost center required for transfer')
        if not cart.business_unit_id:
            errors.append('Business unit required for transfer')
        if item_count == 0:
            errors.append('Cart is empty')

        for item in active_items:
            if not item.specifications:
                warnings.append(CartValidationWarning(
                    line_number=item.line_number,
                    field="specifications",
                    message="Item missing specifications"
                ))
            if item.required_by_date and item.required_by_date < datetime.now(UTC).date():
                warnings.append(CartValidationWarning(
                    line_number=item.line_number,
                    field="required_by_date",
                    message="Line item has a past required_by_date"
                ))

        has_blocking_errors = len(errors) > 0

        return CartSummary(
            cart_id=cart_id,
            item_count=item_count,
            estimated_total=estimated_total,
            has_blocking_errors=has_blocking_errors,
            warnings=warnings,
            errors=errors
        )

    async def abandon_cart(self, db: AsyncSession, cart_id: UUID, org_id: UUID, indentor_id: UUID) -> None:
        stmt = select(IndentCart).where(IndentCart.id == cart_id, IndentCart.deleted_at.is_(None))
        result = await db.execute(stmt)
        cart = result.scalars().first()

        if not cart or cart.org_id != org_id:
            raise NotFoundError("Cart not found")
        if cart.indentor_id != indentor_id:
            raise ForbiddenError("Not authorized to modify this cart")

        cart.status = 'ABANDONED'
        cart.deleted_at = datetime.now(UTC)
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type="REQUISITION",
            entity_id=cart.id,
            action=AuditAction.INDENT_CART_ABANDONED,
            actor_id=indentor_id,
            org_id=org_id,
            old_values={'cart_id': str(cart.id)}
        )

indent_cart_service = IndentCartService()
