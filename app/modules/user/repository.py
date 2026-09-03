from __future__ import annotations
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.db.repository_base import BaseRepository
from app.modules.user.models import User
from app.db.enums import UserStatusEnum


class UserRepository(BaseRepository[User]):
    def __init__(self) -> None:
        super().__init__(User)

    async def find_by_email(self, db: AsyncSession, email: str, org_id: UUID) -> Optional[User]:
        stmt = select(User).where(
            and_(User.email == email, User.org_id == org_id, User.deleted_at.is_(None))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(self, db: AsyncSession, user_id: UUID, org_id: UUID) -> Optional[User]:
        stmt = select(User).where(
            and_(User.id == user_id, User.org_id == org_id, User.deleted_at.is_(None))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_users_with_role(
        self, db: AsyncSession, org_id: UUID, role_code: str
    ) -> list[User]:
        from app.modules.user.models import UserRoleAssignment, Role
        stmt = (
            select(User)
            .join(UserRoleAssignment, UserRoleAssignment.user_id == User.id)
            .join(Role, Role.id == UserRoleAssignment.role_id)
            .where(
                and_(
                    User.org_id == org_id,
                    User.status == UserStatusEnum.ACTIVE,
                    User.deleted_at.is_(None),
                    Role.code == role_code,
                    Role.org_id == org_id,
                )
            )
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def find_by_employee_id(
        self, db: AsyncSession, employee_id: str, org_id: UUID
    ) -> Optional[User]:
        stmt = select(User).where(
            and_(
                User.employee_id == employee_id,
                User.org_id == org_id,
                User.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


user_repository = UserRepository()
