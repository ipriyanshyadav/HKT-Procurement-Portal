from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import String, and_, cast, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repository_base import BaseRepository
from app.modules.user.models import User, UserSession


class SessionRepository(BaseRepository[UserSession]):
    def __init__(self) -> None:
        super().__init__(UserSession)

    async def get_by_jti(self, db: AsyncSession, jti: str) -> UserSession | None:
        stmt = select(UserSession).where(UserSession.token_jti == jti)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def count_active(self, db: AsyncSession, user_id: UUID, org_id: UUID) -> int:
        stmt = select(func.count()).where(
            and_(
                UserSession.user_id == user_id,
                UserSession.org_id == org_id,
                UserSession.is_revoked.is_(False),
                UserSession.expires_at > datetime.now(UTC),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one() or 0

    async def get_oldest_active(
        self, db: AsyncSession, user_id: UUID, org_id: UUID
    ) -> UserSession | None:
        stmt = (
            select(UserSession)
            .where(
                and_(
                    UserSession.user_id == user_id,
                    UserSession.org_id == org_id,
                    UserSession.is_revoked.is_(False),
                    UserSession.expires_at > datetime.now(UTC),
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

    async def get_by_id(self, db: AsyncSession, session_id: UUID) -> UserSession | None:
        stmt = select(UserSession).where(UserSession.id == session_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_sessions(
        self,
        db: AsyncSession,
        org_id: UUID,
        active_only: bool = False,
        search: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[tuple[UserSession, User]], int]:
        stmt = (
            select(UserSession, User)
            .join(User, User.id == UserSession.user_id)
            .where(UserSession.org_id == org_id)
        )
        if active_only:
            now = datetime.now(UTC)
            stmt = stmt.where(
                UserSession.is_revoked.is_(False),
                UserSession.expires_at > now,
            )
        if search:
            term = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(User.email).like(term),
                    func.lower(User.first_name).like(term),
                    func.lower(User.last_name).like(term),
                    cast(UserSession.ip_address, String).like(term),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await db.execute(count_stmt)).scalar_one() or 0

        stmt = (
            stmt.order_by(UserSession.last_activity_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(stmt)
        rows = result.all()
        return [(r[0], r[1]) for r in rows], total


session_repository = SessionRepository()
