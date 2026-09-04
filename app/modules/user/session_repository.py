from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, update
from app.db.repository_base import BaseRepository
from app.modules.user.models import UserSession


class SessionRepository(BaseRepository[UserSession]):
    def __init__(self) -> None:
        super().__init__(UserSession)

    async def get_by_jti(self, db: AsyncSession, jti: str) -> Optional[UserSession]:
        stmt = select(UserSession).where(UserSession.token_jti == jti)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def count_active(self, db: AsyncSession, user_id: UUID, org_id: UUID) -> int:
        stmt = select(func.count()).where(
            and_(
                UserSession.user_id == user_id,
                UserSession.org_id == org_id,
                UserSession.is_revoked.is_(False),
                UserSession.expires_at > datetime.now(timezone.utc),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one() or 0

    async def get_oldest_active(
        self, db: AsyncSession, user_id: UUID, org_id: UUID
    ) -> Optional[UserSession]:
        stmt = (
            select(UserSession)
            .where(
                and_(
                    UserSession.user_id == user_id,
                    UserSession.org_id == org_id,
                    UserSession.is_revoked.is_(False),
                    UserSession.expires_at > datetime.now(timezone.utc),
                )
            )
            .order_by(UserSession.created_at.asc())
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def revoke(self, db: AsyncSession, session_id: UUID, reason: str) -> None:
        stmt = (
            update(UserSession)
            .where(UserSession.id == session_id)
            .values(is_revoked=True, revoked_reason=reason[:100])
        )
        await db.execute(stmt)

    async def revoke_all(
        self, db: AsyncSession, user_id: UUID, org_id: UUID, reason: str
    ) -> None:
        stmt = (
            update(UserSession)
            .where(
                and_(
                    UserSession.user_id == user_id,
                    UserSession.org_id == org_id,
                    UserSession.is_revoked.is_(False),
                )
            )
            .values(is_revoked=True, revoked_reason=reason[:100])
        )
        await db.execute(stmt)

    async def update_activity(self, db: AsyncSession, session_id: UUID, now: datetime) -> None:
        stmt = (
            update(UserSession)
            .where(UserSession.id == session_id)
            .values(last_activity_at=now)
        )
        await db.execute(stmt)


session_repository = SessionRepository()
