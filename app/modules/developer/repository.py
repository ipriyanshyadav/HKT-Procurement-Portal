from __future__ import annotations

from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repository_base import BaseRepository
from app.modules.developer.models import ApiKey, WebhookDelivery, WebhookSubscription


class ApiKeyRepository(BaseRepository[ApiKey]):
    def __init__(self) -> None:
        super().__init__(ApiKey)

    async def get_by_id(self, db: AsyncSession, key_id: UUID, org_id: UUID) -> ApiKey | None:
        stmt = select(ApiKey).where(ApiKey.id == key_id, ApiKey.org_id == org_id)
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_hash(self, db: AsyncSession, key_hash: str) -> ApiKey | None:
        stmt = select(ApiKey).where(ApiKey.key_hash == key_hash)
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def list_by_org(self, db: AsyncSession, org_id: UUID) -> list[ApiKey]:
        stmt = (
            select(ApiKey)
            .where(ApiKey.org_id == org_id)
            .order_by(desc(ApiKey.created_at))
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())


class WebhookSubscriptionRepository(BaseRepository[WebhookSubscription]):
    def __init__(self) -> None:
        super().__init__(WebhookSubscription)

    async def get_by_id(self, db: AsyncSession, sub_id: UUID, org_id: UUID) -> WebhookSubscription | None:
        stmt = select(WebhookSubscription).where(
            WebhookSubscription.id == sub_id, WebhookSubscription.org_id == org_id
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def list_by_org(self, db: AsyncSession, org_id: UUID) -> list[WebhookSubscription]:
        stmt = (
            select(WebhookSubscription)
            .where(WebhookSubscription.org_id == org_id)
            .order_by(desc(WebhookSubscription.created_at))
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def get_active_for_event(
        self, db: AsyncSession, org_id: UUID, event_type: str
    ) -> list[WebhookSubscription]:
        stmt = select(WebhookSubscription).where(
            WebhookSubscription.org_id == org_id,
            WebhookSubscription.is_active.is_(True),
        )
        res = await db.execute(stmt)
        subs = res.scalars().all()
        # Filter subscriptions that subscribe to '*' or the specific event_type
        return [
            s
            for s in subs
            if "*" in s.subscribed_events or event_type in s.subscribed_events
        ]


class WebhookDeliveryRepository(BaseRepository[WebhookDelivery]):
    def __init__(self) -> None:
        super().__init__(WebhookDelivery)

    async def list_by_subscription(
        self, db: AsyncSession, subscription_id: UUID, limit: int = 50
    ) -> list[WebhookDelivery]:
        stmt = (
            select(WebhookDelivery)
            .where(WebhookDelivery.subscription_id == subscription_id)
            .order_by(desc(WebhookDelivery.created_at))
            .limit(limit)
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())


api_key_repository = ApiKeyRepository()
webhook_subscription_repository = WebhookSubscriptionRepository()
webhook_delivery_repository = WebhookDeliveryRepository()
