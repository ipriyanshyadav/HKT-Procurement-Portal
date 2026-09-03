from __future__ import annotations
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.db.repository_base import BaseRepository
from app.modules.user.models import Role, UserRoleAssignment, RolePermission, Permission


class RoleRepository(BaseRepository[Role]):
    def __init__(self) -> None:
        super().__init__(Role)

    async def get_user_role_codes(self, db: AsyncSession, user_id: UUID, org_id: UUID) -> list[str]:
        stmt = (
            select(Role.code)
            .join(UserRoleAssignment, UserRoleAssignment.role_id == Role.id)
            .where(
                and_(
                    UserRoleAssignment.user_id == user_id,
                    Role.org_id == org_id,
                    Role.is_active.is_(True),
                    Role.deleted_at.is_(None),
                )
            )
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def user_has_permission(
        self, db: AsyncSession, user_id: UUID, org_id: UUID, permission_code: str
    ) -> bool:
        stmt = (
            select(Permission.id)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(Role, Role.id == RolePermission.role_id)
            .join(UserRoleAssignment, UserRoleAssignment.role_id == Role.id)
            .where(
                and_(
                    UserRoleAssignment.user_id == user_id,
                    Role.org_id == org_id,
                    Permission.code == permission_code,
                    Role.is_active.is_(True),
                )
            )
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none() is not None


role_repository = RoleRepository()
