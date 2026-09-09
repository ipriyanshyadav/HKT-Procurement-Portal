from __future__ import annotations
from typing import Optional, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.db.repository_base import BaseRepository
from app.modules.user.models import User, DelegationRule
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

    async def find_by_email_any_org(self, db: AsyncSession, email: str) -> Optional[User]:
        stmt = select(User).where(
            and_(User.email == email, User.deleted_at.is_(None))
        )
        result = await db.execute(stmt)
        return result.scalars().first()

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

    async def find_by_username_or_email_prefix(
        self, db: AsyncSession, username: str, org_id: UUID
    ) -> Optional[User]:
        from sqlalchemy import or_, func
        clean = username.strip()
        stmt = select(User).where(
            User.org_id == org_id,
            User.deleted_at.is_(None),
            or_(
                User.email.ilike(f"{clean}@%"),
                User.email.ilike(f"{clean}%"),
                User.first_name.ilike(clean),
                func.concat(User.first_name, User.last_name).ilike(clean.replace("_", "").replace(".", "")),
                func.concat(User.first_name, "_", User.last_name).ilike(clean),
                func.concat(User.first_name, ".", User.last_name).ilike(clean),
                User.employee_id.ilike(clean),
            )
        )
        result = await db.execute(stmt)
        return result.scalars().first()


class DelegationRepository(BaseRepository[DelegationRule]):
    def __init__(self) -> None:
        from app.modules.user.models import DelegationRule
        super().__init__(DelegationRule)

    async def list_by_delegator(
        self, db: AsyncSession, delegator_id: UUID, org_id: UUID
    ) -> list[tuple[Any, User]]:
        from app.modules.user.models import DelegationRule
        stmt = (
            select(DelegationRule, User)
            .join(User, User.id == DelegationRule.delegate_id)
            .where(
                and_(
                    DelegationRule.delegator_id == delegator_id,
                    DelegationRule.org_id == org_id,
                    DelegationRule.deleted_at.is_(None),
                )
            )
            .order_by(DelegationRule.created_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.all())

    async def get_by_id_and_delegator(
        self, db: AsyncSession, rule_id: UUID, delegator_id: UUID, org_id: UUID
    ) -> Optional[Any]:
        from app.modules.user.models import DelegationRule
        stmt = select(DelegationRule).where(
            and_(
                DelegationRule.id == rule_id,
                DelegationRule.delegator_id == delegator_id,
                DelegationRule.org_id == org_id,
                DelegationRule.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def check_circular_delegation(
        self,
        db: AsyncSession,
        delegator_id: UUID,
        delegate_id: UUID,
        org_id: UUID,
        valid_from: Any,
        valid_until: Any,
    ) -> bool:
        from app.modules.user.models import DelegationRule
        stmt = select(DelegationRule).where(
            and_(
                DelegationRule.delegator_id == delegator_id,
                DelegationRule.delegate_id == delegate_id,
                DelegationRule.org_id == org_id,
                DelegationRule.is_active.is_(True),
                DelegationRule.deleted_at.is_(None),
                DelegationRule.valid_from <= valid_until,
                DelegationRule.valid_until >= valid_from,
            )
        )
        res = await db.execute(stmt)
        val = res.scalar_one_or_none()
        return isinstance(val, DelegationRule)


user_repository = UserRepository()
delegation_repository = DelegationRepository()

