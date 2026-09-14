"""Service for multi-org membership and company switcher.

Module: admin / auth
Layer: service
"""
from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token, create_refresh_token
from app.config import settings
from app.core.constants import AuditAction
from app.core.exceptions import AppException, ForbiddenError, NotFoundError
from app.core.redis_client import get_redis_client
from app.modules.admin.company_switcher_models import OrgSwitchAudit, UserOrgMembership
from app.modules.admin.company_switcher_schemas import (
    OrgMembershipResponse,
    SwitchOrgResponse,
    UserOrgInviteRequest,
    UserOrgMemberResponse,
)
from app.modules.audit.service import audit_service
from app.modules.organization.models import Organization
from app.modules.user.models import User


class CompanySwitcherService:

    async def list_my_orgs(self, db: AsyncSession, user: User) -> list[OrgMembershipResponse]:
        """List all organizations accessible to the current user."""
        org_map: dict[UUID, OrgMembershipResponse] = {}

        # 1. Platform admin has access to ALL active organizations
        if getattr(user, "is_platform_admin", False):
            result = await db.execute(
                select(Organization).where(Organization.deleted_at.is_(None))
            )
            all_orgs = result.scalars().all()
            for org in all_orgs:
                org_map[org.id] = OrgMembershipResponse(
                    id=org.id,
                    org_id=org.id,
                    org_name=org.name,
                    org_slug=getattr(org, "code", None),
                    logo_url=getattr(org, "logo_url", None),
                    roles=["SUPERADMIN"],
                    is_primary=(org.id == user.org_id),
                    is_current=(org.id == user.org_id),
                )
            return list(org_map.values())

        # 2. Add current home organization
        home_org_res = await db.execute(
            select(Organization).where(Organization.id == user.org_id, Organization.deleted_at.is_(None))
        )
        home_org = home_org_res.scalar_one_or_none()
        if home_org:
            org_map[home_org.id] = OrgMembershipResponse(
                id=home_org.id,
                org_id=home_org.id,
                org_name=home_org.name,
                org_slug=getattr(home_org, "code", None),
                logo_url=getattr(home_org, "logo_url", None),
                roles=["ORG_ADMIN"] if not user.is_supplier_user else ["SUPPLIER"],
                is_primary=True,
                is_current=True,
            )

        # 3. Add explicit memberships
        memberships_res = await db.execute(
            select(UserOrgMembership, Organization)
            .join(Organization, Organization.id == UserOrgMembership.org_id)
            .where(
                UserOrgMembership.primary_user_id == user.id,
                UserOrgMembership.status == "ACTIVE",
                Organization.deleted_at.is_(None),
            )
        )
        for membership, org in memberships_res.all():
            org_map[org.id] = OrgMembershipResponse(
                id=membership.id,
                org_id=org.id,
                org_name=org.name,
                org_slug=getattr(org, "code", None),
                logo_url=getattr(org, "logo_url", None),
                roles=membership.role_in_org or ["REQUESTOR"],
                is_primary=membership.is_primary_org,
                is_current=(org.id == user.org_id),
            )

        return list(org_map.values())

    async def switch_org(
        self,
        db: AsyncSession,
        user: User,
        target_org_id: UUID,
        ip_address: str | None = None,
        user_agent: str | None = None,
        previous_jti: str | None = None,
        portal: str = "admin",
    ) -> SwitchOrgResponse:
        """Switch tenant organization, invalidate old session, and issue new scoped tokens."""
        # 1. Target org check
        org_res = await db.execute(
            select(Organization).where(Organization.id == target_org_id, Organization.deleted_at.is_(None))
        )
        target_org = org_res.scalar_one_or_none()
        if not target_org:
            raise NotFoundError("Target organization not found or inactive", "ORG_NOT_FOUND")

        # 2. Authorization check
        effective_roles: list[str] = []
        if getattr(user, "is_platform_admin", False):
            effective_roles = ["SUPERADMIN", "ORG_ADMIN"]
        elif user.org_id == target_org_id:
            effective_roles = ["ORG_ADMIN"] if not user.is_supplier_user else ["SUPPLIER"]
        else:
            membership_res = await db.execute(
                select(UserOrgMembership).where(
                    UserOrgMembership.primary_user_id == user.id,
                    UserOrgMembership.org_id == target_org_id,
                    UserOrgMembership.status == "ACTIVE",
                )
            )
            membership = membership_res.scalar_one_or_none()
            if not membership:
                raise ForbiddenError("You do not have membership in target organization", "ORG_MEMBERSHIP_REQUIRED")
            effective_roles = membership.role_in_org or ["REQUESTOR"]

        # 3. Revoke previous session in Redis if provided
        new_jti = str(uuid4())
        try:
            redis = get_redis_client(settings.REDIS_SESSION_DB)
            if previous_jti:
                await redis.setex(f"revoked_jti:{previous_jti}", 86400, "1")
        except Exception as e:
            logger.warning(f"Redis session revocation warning during org switch: {e}")

        # 4. Log immutable switch audit
        switch_log = OrgSwitchAudit(
            user_id=user.id,
            from_org_id=user.org_id,
            to_org_id=target_org_id,
            switched_at=datetime.now(UTC),
            ip_address=ip_address,
            user_agent=user_agent,
            previous_jti=previous_jti,
            new_jti=new_jti,
        )
        db.add(switch_log)

        # 5. Issue new access and refresh tokens
        access_token = create_access_token(
            user_id=user.id,
            org_id=target_org_id,
            email=user.email,
            roles=effective_roles,
            bu_scope=[],
            category_scope=[],
            plant_scope=[],
            is_supplier_user=user.is_supplier_user,
            vendor_id=getattr(user, "vendor_id", None),
            jti=new_jti,
            portal=portal,
            active_legal_entity_id=getattr(user, "active_legal_entity_id", None),
        )

        refresh_token = create_refresh_token(
            user_id=user.id,
            org_id=target_org_id,
            jti=new_jti,
        )

        await db.flush()

        # 6. Audit action
        await audit_service.log(
            db=db,
            entity_type="USER",
            entity_id=user.id,
            action=getattr(AuditAction, "AUTH_ORG_SWITCHED", "AUTH_ORG_SWITCHED"),
            actor_id=user.id,
            org_id=target_org_id,
            metadata={
                "from_org_id": str(user.org_id),
                "to_org_id": str(target_org_id),
                "roles": effective_roles,
            },
        )

        return SwitchOrgResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            org_id=target_org_id,
            org_name=target_org.name,
            roles=effective_roles,
        )

    async def invite_user_to_org(
        self, db: AsyncSession, actor: User, data: UserOrgInviteRequest
    ) -> UserOrgMemberResponse:
        """Invite an existing user into an organization."""
        user_res = await db.execute(select(User).where(User.email == data.email))
        target_user = user_res.scalar_one_or_none()
        if not target_user:
            raise NotFoundError(f"User with email {data.email} not found", "USER_NOT_FOUND")

        # Check existing membership
        m_res = await db.execute(
            select(UserOrgMembership).where(
                UserOrgMembership.primary_user_id == target_user.id,
                UserOrgMembership.org_id == data.org_id,
            )
        )
        membership = m_res.scalar_one_or_none()
        if membership:
            membership.role_in_org = data.roles
            membership.status = "ACTIVE"
        else:
            membership = UserOrgMembership(
                id=uuid4(),
                primary_user_id=target_user.id,
                org_id=data.org_id,
                role_in_org=data.roles,
                is_primary_org=False,
                invited_by=actor.id,
                joined_at=datetime.now(UTC),
                status="ACTIVE",
            )
            db.add(membership)

        await db.flush()
        return UserOrgMemberResponse(
            membership_id=membership.id,
            user_id=target_user.id,
            email=target_user.email,
            full_name=f"{target_user.first_name} {target_user.last_name}",
            roles=membership.role_in_org,
            is_primary=bool(membership.is_primary_org),
            status=membership.status,
            joined_at=membership.joined_at,
        )

    async def remove_user_from_org(
        self, db: AsyncSession, actor: User, membership_id: UUID
    ) -> None:
        """Remove a user membership from an organization."""
        m_res = await db.execute(
            select(UserOrgMembership).where(UserOrgMembership.id == membership_id)
        )
        membership = m_res.scalar_one_or_none()
        if not membership:
            raise NotFoundError("Membership record not found", "MEMBERSHIP_NOT_FOUND")
        membership.status = "REMOVED"
        await db.flush()

    async def list_org_members(
        self, db: AsyncSession, org_id: UUID
    ) -> list[UserOrgMemberResponse]:
        """List cross-org members for an organization."""
        results = await db.execute(
            select(UserOrgMembership, User)
            .join(User, User.id == UserOrgMembership.primary_user_id)
            .where(UserOrgMembership.org_id == org_id, UserOrgMembership.status == "ACTIVE")
        )
        members: list[UserOrgMemberResponse] = []
        for m, u in results.all():
            members.append(
                UserOrgMemberResponse(
                    membership_id=m.id,
                    user_id=u.id,
                    email=u.email,
                    full_name=f"{u.first_name} {u.last_name}",
                    roles=m.role_in_org,
                    is_primary=bool(m.is_primary_org),
                    status=m.status,
                    joined_at=m.joined_at,
                )
            )
        return members


company_switcher_service = CompanySwitcherService()
