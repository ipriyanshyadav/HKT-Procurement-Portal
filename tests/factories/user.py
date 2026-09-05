from __future__ import annotations
from typing import Optional, List, Any
from uuid import UUID, uuid4
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.enums import UserStatusEnum
from app.modules.user.models import User, Role, UserRoleAssignment
from tests.factories.organization import OrganizationFactory

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
DEFAULT_PASSWORD_HASH = pwd_context.hash("TestPassword@123")


class RoleFactory:
    @staticmethod
    async def get_or_create(
        db: AsyncSession,
        code: str = "BUYER",
        name: Optional[str] = None,
        is_supplier_role: bool = False,
        **overrides: Any,
    ) -> Role:
        stmt = select(Role).where(Role.code == code)
        res = await db.execute(stmt)
        existing = res.scalars().first()
        if existing:
            return existing

        role = Role(
            id=overrides.pop("id", uuid4()),
            org_id=overrides.pop("org_id", uuid4()),
            code=code,
            name=name or code.replace("_", " ").title(),
            is_system_role=overrides.pop("is_system_role", True),
            is_supplier_role=is_supplier_role,
            is_active=overrides.pop("is_active", True),
            **overrides,
        )
        db.add(role)
        await db.flush()
        return role


class UserFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        email: Optional[str] = None,
        role: Optional[str] = "BUYER",
        roles: Optional[List[str]] = None,
        is_supplier_user: bool = False,
        vendor_id: Optional[UUID] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        **overrides: Any,
    ) -> User:
        suffix = uuid4().hex[:8]
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id

        user = User(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            email=email or f"user_{suffix}@testcorp.internal",
            password_hash=overrides.pop("password_hash", DEFAULT_PASSWORD_HASH),
            first_name=first_name or f"First{suffix[:4]}",
            last_name=last_name or f"Last{suffix[4:]}",
            status=overrides.pop("status", UserStatusEnum.ACTIVE),
            is_supplier_user=is_supplier_user,
            vendor_id=vendor_id,
            timezone=overrides.pop("timezone", "UTC"),
            language=overrides.pop("language", "en"),
            **overrides,
        )
        db.add(user)
        await db.flush()

        role_codes = roles if roles is not None else ([role] if role else [])
        for r_code in role_codes:
            role_obj = await RoleFactory.get_or_create(db, code=r_code, org_id=org_id, is_supplier_role=is_supplier_user)
            assignment = UserRoleAssignment(
                id=uuid4(),
                org_id=org_id,
                user_id=user.id,
                role_id=role_obj.id,
                is_active=True,
            )
            db.add(assignment)
        if role_codes:
            await db.flush()

        return user


class UserRoleAssignmentFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        user_id: UUID,
        role_id: UUID,
        org_id: Optional[UUID] = None,
        **overrides: Any,
    ) -> UserRoleAssignment:
        assignment = UserRoleAssignment(
            id=overrides.pop("id", uuid4()),
            org_id=org_id or uuid4(),
            user_id=user_id,
            role_id=role_id,
            is_active=overrides.pop("is_active", True),
            **overrides,
        )
        db.add(assignment)
        await db.flush()
        return assignment
