"""
Approver Resolver — resolves approvers from ROLE, NAMED_USER, or APPROVAL_GROUP.
All scope filters (same_bu, same_category, same_bu_and_category, vendor_category) applied here.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.modules.user.models import User
from app.modules.user.repository import UserRepository
from app.modules.workflow.group_repository import ApprovalGroupRepository


class ApproverResolver:
    """
    Resolves approver lists for a workflow step.
    Supports ROLE (with scope filters + fallback), NAMED_USER, and APPROVAL_GROUP.
    """

    def __init__(
        self,
        user_repo: UserRepository,
        group_repo: ApprovalGroupRepository,
    ) -> None:
        self._user_repo = user_repo
        self._group_repo = group_repo

    async def resolve(
        self,
        db: AsyncSession,
        resolver: str,
        resolver_config: dict,
        entity_context: dict,
        org_id: UUID,
    ) -> list[User]:
        """Dispatch to the correct resolver strategy."""
        if resolver == "ROLE":
            return await self._by_role(db, resolver_config, entity_context, org_id)
        if resolver == "NAMED_USER":
            user_id = UUID(resolver_config["user_id"])
            user = await self._user_repo.get_by_id(db, user_id, org_id)
            return [user] if user else []
        if resolver == "APPROVAL_GROUP":
            return await self._by_group(db, resolver_config["group_code"], org_id)
        raise AppException(
            f"Unknown resolver type: {resolver}",
            "INVALID_RESOLVER",
        )

    async def _by_role(
        self,
        db: AsyncSession,
        config: dict,
        ctx: dict,
        org_id: UUID,
    ) -> list[User]:
        """Resolve users by role code, applying scope filters."""
        role_code: str = config["role_code"]
        scope_filter: str | None = config.get("scope_filter")

        users = await self._user_repo.get_active_users_with_role(db, org_id, role_code)

        if scope_filter == "same_bu":
            bu_id = ctx.get("business_unit_id") or ctx.get("bu_id")
            if bu_id:
                users = [
                    u for u in users
                    if await self._user_has_bu_scope(db, u.id, UUID(str(bu_id)), org_id)
                ]

        elif scope_filter == "same_category":
            cat_id = ctx.get("category_id")
            if cat_id:
                users = [
                    u for u in users
                    if await self._user_has_cat_scope(db, u.id, UUID(str(cat_id)), org_id)
                ]

        elif scope_filter == "same_bu_and_category":
            bu_id = ctx.get("business_unit_id") or ctx.get("bu_id")
            cat_id = ctx.get("category_id")
            if bu_id and cat_id:
                users = [
                    u for u in users
                    if (
                        await self._user_has_bu_scope(db, u.id, UUID(str(bu_id)), org_id)
                        and await self._user_has_cat_scope(db, u.id, UUID(str(cat_id)), org_id)
                    )
                ]

        elif scope_filter == "vendor_category":
            vendor_cats: list = ctx.get("vendor_category_ids", [])
            filtered = []
            for u in users:
                for cat in vendor_cats:
                    if await self._user_has_cat_scope(db, u.id, UUID(str(cat)), org_id):
                        filtered.append(u)
                        break
            users = filtered

        # Fallback role when no users found after scope filtering
        if not users and "fallback_role" in config:
            users = await self._user_repo.get_active_users_with_role(
                db, org_id, config["fallback_role"]
            )

        return users

    async def _by_group(
        self,
        db: AsyncSession,
        group_code: str,
        org_id: UUID,
    ) -> list[User]:
        """Resolve users from an approval group by its code."""
        group = await self._group_repo.get_by_code(db, group_code, org_id)
        return await self._group_repo.get_members(db, group.id, org_id)

    async def _user_has_bu_scope(
        self, db: AsyncSession, user_id: UUID, bu_id: UUID, org_id: UUID
    ) -> bool:
        """Check if user's assigned business_unit_id matches the given BU."""
        from sqlalchemy import select, and_
        from app.modules.user.models import User as UserModel
        from sqlalchemy.orm import load_only

        stmt = (
            select(UserModel)
            .where(
                and_(
                    UserModel.id == user_id,
                    UserModel.org_id == org_id,
                    UserModel.business_unit_id == bu_id,
                    UserModel.deleted_at.is_(None),
                )
            )
            .options(load_only(UserModel.id))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def _user_has_cat_scope(
        self, db: AsyncSession, user_id: UUID, category_id: UUID, org_id: UUID
    ) -> bool:
        """Check if user has explicit category scope (via user_category_scopes table)."""
        from sqlalchemy import select, and_, text

        stmt = text(
            """
            SELECT 1 FROM user_category_scopes
            WHERE user_id = :user_id
              AND category_id = :category_id
              AND org_id = :org_id
              AND is_active = TRUE
            LIMIT 1
            """
        )
        result = await db.execute(
            stmt,
            {"user_id": str(user_id), "category_id": str(category_id), "org_id": str(org_id)},
        )
        return result.fetchone() is not None


approver_resolver = ApproverResolver(
    user_repo=None,  # type: ignore[arg-type]
    group_repo=None,  # type: ignore[arg-type]
)
