from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.repository_base import BaseRepository
from app.modules.catalog.models import (
    CartItem,
    CatalogTierPricing,
    PunchoutConfig,
    PunchoutSession,
    UserCart,
)


class PunchoutConfigRepository(BaseRepository[PunchoutConfig]):
    def __init__(self) -> None:
        super().__init__(PunchoutConfig)

    async def list_by_org(self, db: AsyncSession, org_id: UUID) -> list[PunchoutConfig]:
        stmt = (
            select(PunchoutConfig)
            .where(PunchoutConfig.org_id == org_id)
            .order_by(PunchoutConfig.supplier_name.asc())
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def get_by_id(self, db: AsyncSession, config_id: UUID, org_id: UUID) -> PunchoutConfig | None:
        stmt = select(PunchoutConfig).where(
            PunchoutConfig.id == config_id, PunchoutConfig.org_id == org_id
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()


class PunchoutSessionRepository(BaseRepository[PunchoutSession]):
    def __init__(self) -> None:
        super().__init__(PunchoutSession)

    async def get_by_token(self, db: AsyncSession, token: str) -> PunchoutSession | None:
        stmt = (
            select(PunchoutSession)
            .options(selectinload(PunchoutSession.config))
            .where(PunchoutSession.session_token == token)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_id(self, db: AsyncSession, session_id: UUID, org_id: UUID) -> PunchoutSession | None:
        stmt = (
            select(PunchoutSession)
            .options(selectinload(PunchoutSession.config))
            .where(PunchoutSession.id == session_id, PunchoutSession.org_id == org_id)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()


class CatalogTierPricingRepository(BaseRepository[CatalogTierPricing]):
    def __init__(self) -> None:
        super().__init__(CatalogTierPricing)

    async def list_by_item(self, db: AsyncSession, item_id: UUID) -> list[CatalogTierPricing]:
        stmt = (
            select(CatalogTierPricing)
            .where(CatalogTierPricing.item_id == item_id)
            .order_by(CatalogTierPricing.min_quantity.asc())
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def get_best_tier_price(
        self, db: AsyncSession, item_id: UUID, quantity: Decimal
    ) -> Decimal | None:
        stmt = (
            select(CatalogTierPricing.unit_price)
            .where(
                CatalogTierPricing.item_id == item_id,
                CatalogTierPricing.min_quantity <= quantity,
            )
            .order_by(desc(CatalogTierPricing.min_quantity))
            .limit(1)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()


class UserCartRepository(BaseRepository[UserCart]):
    def __init__(self) -> None:
        super().__init__(UserCart)

    async def get_active_cart(self, db: AsyncSession, org_id: UUID, user_id: UUID) -> UserCart | None:
        stmt = (
            select(UserCart)
            .options(selectinload(UserCart.items))
            .where(
                UserCart.org_id == org_id,
                UserCart.user_id == user_id,
                UserCart.status == "ACTIVE",
            )
            .order_by(desc(UserCart.created_at))
            .limit(1)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()


class CartItemRepository(BaseRepository[CartItem]):
    def __init__(self) -> None:
        super().__init__(CartItem)

    async def get_by_id(self, db: AsyncSession, item_id: UUID) -> CartItem | None:
        stmt = select(CartItem).where(CartItem.id == item_id)
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def find_existing(
        self, db: AsyncSession, cart_id: UUID, item_code: str
    ) -> CartItem | None:
        stmt = select(CartItem).where(
            CartItem.cart_id == cart_id,
            CartItem.item_code == item_code,
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def list_by_cart(self, db: AsyncSession, cart_id: UUID) -> list[CartItem]:
        stmt = (
            select(CartItem)
            .where(CartItem.cart_id == cart_id)
            .order_by(desc(CartItem.created_at))
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())


punchout_config_repository = PunchoutConfigRepository()
punchout_session_repository = PunchoutSessionRepository()
catalog_tier_pricing_repository = CatalogTierPricingRepository()
user_cart_repository = UserCartRepository()
cart_item_repository = CartItemRepository()
