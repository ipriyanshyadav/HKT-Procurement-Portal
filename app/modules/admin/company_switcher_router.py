"""Company switcher and multi-org membership router.

Module: admin / auth
Layer: router
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import APIResponse, created_response, success_response
from app.db.session import get_db
from app.modules.admin.company_switcher_schemas import (
    OrgMembershipResponse,
    SwitchOrgRequest,
    SwitchOrgResponse,
    UserOrgInviteRequest,
    UserOrgMemberResponse,
)
from app.modules.admin.company_switcher_service import company_switcher_service
from app.modules.user.models import User

# Sub-router for /api/v1/auth/my-orgs and switch-org
auth_org_router = APIRouter(prefix="/auth", tags=["Company Switcher"])

# Sub-router for admin org membership management
admin_org_router = APIRouter(prefix="/admin", tags=["Company Switcher Admin"])


@auth_org_router.get("/my-orgs", response_model=APIResponse[list[OrgMembershipResponse]])
async def get_my_organizations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all organizations accessible to current user."""
    orgs = await company_switcher_service.list_my_orgs(db, current_user)
    return success_response(orgs)


@auth_org_router.post("/switch-org", response_model=APIResponse[SwitchOrgResponse])
async def switch_organization(
    data: SwitchOrgRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Switch active organization context, revoke current session JTI, issue new scoped tokens."""
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    prev_jti = getattr(request.state, "jti", None) if hasattr(request, "state") else None

    result = await company_switcher_service.switch_org(
        db=db,
        user=current_user,
        target_org_id=data.org_id,
        ip_address=ip,
        user_agent=user_agent,
        previous_jti=prev_jti,
    )

    # Set refresh token cookie
    response.set_cookie(
        key="refresh_token",
        value=result.refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )
    await db.commit()
    return success_response(result)


@admin_org_router.post("/user-org-invite", response_model=APIResponse[UserOrgMemberResponse])
async def invite_user_to_organization(
    data: UserOrgInviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invite an existing user to belong to an organization with designated roles."""
    member = await company_switcher_service.invite_user_to_org(db, current_user, data)
    await db.commit()
    return created_response(member)


@admin_org_router.delete("/user-org/{membership_id}", response_model=APIResponse[dict])
async def remove_user_from_organization(
    membership_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove user membership from organization."""
    await company_switcher_service.remove_user_from_org(db, current_user, membership_id)
    await db.commit()
    return success_response({"membership_id": str(membership_id), "status": "REMOVED"})


@admin_org_router.get("/org-members", response_model=APIResponse[list[UserOrgMemberResponse]])
async def list_organization_members(
    org_id: UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List cross-org members in current or designated organization."""
    target_org = org_id or current_user.org_id
    members = await company_switcher_service.list_org_members(db, target_org)
    return success_response(members)
