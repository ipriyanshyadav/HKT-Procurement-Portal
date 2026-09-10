from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, Any
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr

from app.auth.dependencies import get_current_user, require_permission
from app.core.exceptions import AppException, ForbiddenError
from app.core.responses import APIResponse, PaginationMeta, created_response, success_response
from app.core.security import hash_password, verify_password, validate_password_strength
from app.db.session import get_db
from app.modules.user.models import User, DelegationRule
from app.modules.user.repository import user_repository, delegation_repository
from app.modules.user.role_repository import role_repository
from app.modules.user.session_repository import session_repository
from app.modules.audit.service import audit_service
from app.core.constants import PermissionCode
from app.db.enums import UserStatusEnum

router = APIRouter(tags=["User"])


class DelegationRuleCreateRequest(BaseModel):
    delegate_id: UUID
    reason: str
    valid_from: datetime
    valid_until: datetime
    entity_types: Optional[list[str]] = None
    max_amount_threshold: Optional[float] = None
    bu_ids: Optional[list[UUID]] = None


class DelegationRuleResponse(BaseModel):
    id: UUID
    org_id: UUID
    delegator_id: UUID
    delegate_id: UUID
    delegate_name: Optional[str] = None
    delegate_email: Optional[str] = None
    reason: str
    valid_from: datetime
    valid_until: datetime
    entity_types: list[str] = []
    max_amount_threshold: Optional[float] = None
    bu_ids: list[Any] = []
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    status: str
    mfa_enabled: bool
    is_supplier_user: bool
    vendor_id: Optional[UUID] = None
    org_id: UUID

    model_config = {"from_attributes": True}


class UserCreateRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    password: str
    employee_id: Optional[str] = None
    roles: Optional[list[str]] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None
    roles: Optional[list[str]] = None


class AssignRoleRequest(BaseModel):
    role_code: str


class RoleCreateRequest(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    is_supplier_role: bool = False
    permission_codes: Optional[list[str]] = None


class RoleUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class RolePermissionsUpdateRequest(BaseModel):
    permission_codes: list[str]


class ToggleRolePermissionRequest(BaseModel):
    role_code: str
    permission_code: str
    granted: bool


class RevokeSessionRequest(BaseModel):
    reason: Optional[str] = "Revoked by Administrator"


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """GET /api/v1/users/me — returns current user profile."""
    roles = await role_repository.get_user_role_codes(db, current_user.id, current_user.org_id)
    return success_response({
        "id": str(current_user.id),
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "status": current_user.status.value,
        "mfa_enabled": current_user.mfa_enabled,
        "is_supplier_user": current_user.is_supplier_user,
        "vendor_id": str(current_user.vendor_id) if current_user.vendor_id else None,
        "org_id": str(current_user.org_id),
        "roles": roles,
        "role_names": roles,
    })


@router.get("/me/permissions")
async def get_my_permissions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """GET /api/v1/users/me/permissions — returns user's permission codes."""
    from sqlalchemy import select
    from app.modules.user.models import UserRoleAssignment, Role, RolePermission, Permission

    stmt = (
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .join(UserRoleAssignment, UserRoleAssignment.role_id == Role.id)
        .where(
            UserRoleAssignment.user_id == current_user.id,
            Role.org_id == current_user.org_id,
            Role.is_active.is_(True),
        )
        .distinct()
    )
    result = await db.execute(stmt)
    permissions = list(result.scalars().all())
    return success_response({"permissions": permissions})


@router.put("/me/password")
async def change_my_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """PUT /api/v1/users/me/password — change own password."""
    if not verify_password(data.current_password, current_user.password_hash or ""):
        raise AppException("Current password is incorrect", "INVALID_CREDENTIALS")

    valid, msg = validate_password_strength(data.new_password)
    if not valid:
        raise AppException(msg, "WEAK_PASSWORD")

    current_user.password_hash = hash_password(data.new_password)
    from datetime import datetime, timezone
    current_user.password_changed_at = datetime.now(timezone.utc)

    await audit_service.log(
        db,
        entity_type="USER",
        entity_id=current_user.id,
        action="PASSWORD_CHANGE",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        metadata={},
    )
    return success_response({"message": "Password changed successfully"})


@router.get("/me/delegations", response_model=APIResponse[list[DelegationRuleResponse]])
async def list_my_delegations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """GET /api/v1/users/me/delegations — list delegation rules created by current user."""
    items = await delegation_repository.list_by_delegator(db, current_user.id, current_user.org_id)
    response_items = []
    for rule, delegate in items:
        response_items.append(
            DelegationRuleResponse(
                id=rule.id,
                org_id=rule.org_id,
                delegator_id=rule.delegator_id,
                delegate_id=rule.delegate_id,
                delegate_name=f"{delegate.first_name} {delegate.last_name}".strip() or delegate.email,
                delegate_email=delegate.email,
                reason=rule.reason,
                valid_from=rule.valid_from,
                valid_until=rule.valid_until,
                entity_types=rule.entity_types or [],
                max_amount_threshold=float(rule.max_amount_threshold) if rule.max_amount_threshold is not None else None,
                bu_ids=rule.bu_ids or [],
                is_active=rule.is_active,
                created_at=rule.created_at or datetime.now(timezone.utc),
            )
        )
    return success_response(response_items)


@router.get("/delegations/matrix", response_model=APIResponse[list[DelegationRuleResponse]])
async def list_org_delegation_matrix(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """GET /api/v1/users/delegations/matrix — list all active delegation rules in org for governance audit."""
    stmt = (
        select(DelegationRule, User)
        .join(User, User.id == DelegationRule.delegate_id)
        .where(
            DelegationRule.org_id == current_user.org_id,
            DelegationRule.is_active.is_(True),
            DelegationRule.deleted_at.is_(None),
        )
        .order_by(DelegationRule.created_at.desc())
    )
    res = await db.execute(stmt)
    items = res.all()
    response_items = []
    for rule, delegate in items:
        response_items.append(
            DelegationRuleResponse(
                id=rule.id,
                org_id=rule.org_id,
                delegator_id=rule.delegator_id,
                delegate_id=rule.delegate_id,
                delegate_name=f"{delegate.first_name} {delegate.last_name}".strip() or delegate.email,
                delegate_email=delegate.email,
                reason=rule.reason,
                valid_from=rule.valid_from,
                valid_until=rule.valid_until,
                entity_types=rule.entity_types or [],
                max_amount_threshold=float(rule.max_amount_threshold) if rule.max_amount_threshold is not None else None,
                bu_ids=rule.bu_ids or [],
                is_active=rule.is_active,
                created_at=rule.created_at or datetime.now(timezone.utc),
            )
        )
    return success_response(response_items)


@router.post("/me/delegations", response_model=APIResponse[DelegationRuleResponse])
async def create_my_delegation(
    data: DelegationRuleCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """POST /api/v1/users/me/delegations — create a new delegation / out-of-office rule with SoD guards."""
    if data.delegate_id == current_user.id:
        raise AppException("Cannot delegate approvals to yourself", "INVALID_DELEGATE")

    delegate = await user_repository.get_by_id(db, data.delegate_id, current_user.org_id)
    if not delegate or delegate.status != UserStatusEnum.ACTIVE:
        raise AppException("Delegate user not found or inactive", "INVALID_DELEGATE")

    if data.valid_until <= data.valid_from:
        raise AppException("valid_until must be after valid_from", "INVALID_DATE_RANGE")

    # Guard: Circular delegation prevention (delegate already has active delegation to current user)
    has_circular = await delegation_repository.check_circular_delegation(
        db,
        delegator_id=data.delegate_id,
        delegate_id=current_user.id,
        org_id=current_user.org_id,
        valid_from=data.valid_from,
        valid_until=data.valid_until,
    )
    if has_circular:
        raise AppException(
            "Circular delegation prohibited: Selected delegate already has an active delegation rule assigned to you during this period",
            "CIRCULAR_DELEGATION_PROHIBITED",
        )

    rule = DelegationRule(
        id=uuid4(),
        org_id=current_user.org_id,
        delegator_id=current_user.id,
        delegate_id=data.delegate_id,
        reason=data.reason,
        valid_from=data.valid_from,
        valid_until=data.valid_until,
        entity_types=data.entity_types or ["PR", "PO", "INVOICE", "RFQ", "ARN"],
        max_amount_threshold=Decimal(str(data.max_amount_threshold)) if data.max_amount_threshold is not None else None,
        bu_ids=[str(b) for b in data.bu_ids] if data.bu_ids else [],
        is_active=True,
        created_by=current_user.id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    await audit_service.log(
        db,
        entity_type="USER",
        entity_id=current_user.id,
        action="DELEGATION_CREATED",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        new_values={
            "rule_id": str(rule.id),
            "delegate_id": str(delegate.id),
            "reason": rule.reason,
            "valid_from": rule.valid_from.isoformat(),
            "valid_until": rule.valid_until.isoformat(),
            "max_amount_threshold": float(rule.max_amount_threshold) if rule.max_amount_threshold is not None else None,
        },
    )

    return success_response(
        DelegationRuleResponse(
            id=rule.id,
            org_id=rule.org_id,
            delegator_id=rule.delegator_id,
            delegate_id=rule.delegate_id,
            delegate_name=f"{delegate.first_name} {delegate.last_name}".strip() or delegate.email,
            delegate_email=delegate.email,
            reason=rule.reason,
            valid_from=rule.valid_from,
            valid_until=rule.valid_until,
            entity_types=rule.entity_types or [],
            max_amount_threshold=float(rule.max_amount_threshold) if rule.max_amount_threshold is not None else None,
            bu_ids=rule.bu_ids or [],
            is_active=rule.is_active,
            created_at=rule.created_at or datetime.now(timezone.utc),
        )
    )


@router.delete("/me/delegations/{rule_id}")
async def delete_my_delegation(
    rule_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """DELETE /api/v1/users/me/delegations/{rule_id} — revoke an active delegation rule."""
    rule = await delegation_repository.get_by_id_and_delegator(
        db, rule_id, current_user.id, current_user.org_id
    )
    if not rule:
        raise AppException("Delegation rule not found", "NOT_FOUND")

    rule.is_active = False
    rule.deleted_at = datetime.now(timezone.utc)
    await db.commit()

    await audit_service.log(
        db,
        entity_type="USER",
        entity_id=current_user.id,
        action="DELEGATION_REVOKED",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        new_values={"rule_id": str(rule.id)},
    )
    return success_response({"message": "Delegation revoked successfully"})


@router.get("/")
async def list_users(
    current_user: User = Depends(require_permission(PermissionCode.USER_VIEW_ALL)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """GET /api/v1/users — list users (requires user.view_all permission)."""
    users = await user_repository.get_multi(db, current_user.org_id)
    user_list = []
    for u in users:
        roles = await role_repository.get_user_role_codes(db, u.id, current_user.org_id)
        user_list.append({
            "id": str(u.id),
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "status": u.status.value,
            "roles": roles,
        })
    meta = PaginationMeta(total=len(user_list), page=1, page_size=len(user_list) or 20)
    return success_response(user_list, meta=meta)


@router.get("/roles")
async def list_roles(
    current_user: User = Depends(require_permission(PermissionCode.USER_VIEW_ALL)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """GET /api/v1/users/roles — list available roles with descriptions, access scope, and permissions."""
    roles_data = await role_repository.get_roles_with_permissions(db, current_user.org_id)
    meta = PaginationMeta(total=len(roles_data), page=1, page_size=len(roles_data) or 20)
    return success_response(roles_data, meta=meta)


@router.post("/roles")
async def create_role(
    data: RoleCreateRequest,
    current_user: User = Depends(require_permission(PermissionCode.USER_MANAGE_PERMISSIONS)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """POST /api/v1/users/roles — create a new role with description and permissions."""
    from sqlalchemy import select
    from app.modules.user.models import Role, RolePermission, Permission

    code = data.code.strip().upper()
    stmt = select(Role).where(
        Role.code == code,
        Role.org_id == current_user.org_id,
        Role.deleted_at.is_(None),
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise AppException(f"Role code '{code}' already exists", "CONFLICT")

    role = Role(
        org_id=current_user.org_id,
        code=code,
        name=data.name.strip(),
        description=data.description,
        is_system_role=False,
        is_supplier_role=data.is_supplier_role,
        is_active=True,
    )
    db.add(role)
    await db.flush()

    if data.permission_codes:
        for p_code in data.permission_codes:
            perm_stmt = select(Permission).where(Permission.code == p_code)
            perm = (await db.execute(perm_stmt)).scalar_one_or_none()
            if perm:
                db.add(RolePermission(
                    org_id=current_user.org_id,
                    role_id=role.id,
                    permission_id=perm.id,
                    granted_by=current_user.id,
                ))
        await db.flush()

    await audit_service.log(
        db,
        entity_type="ROLE",
        entity_id=role.id,
        action="CREATED",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        metadata={"code": role.code, "name": role.name},
    )
    await db.commit()
    return created_response({"id": str(role.id), "code": role.code, "name": role.name})


@router.get("/roles/{role_id}")
async def get_role(
    role_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.USER_VIEW_ALL)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """GET /api/v1/users/roles/{role_id} — get detailed role metadata and its assigned permissions."""
    from sqlalchemy import select
    from app.modules.user.models import Role, RolePermission, Permission

    stmt = select(Role).where(
        Role.id == role_id,
        Role.deleted_at.is_(None),
    )
    role = (await db.execute(stmt)).scalar_one_or_none()
    if not role:
        raise AppException("Role not found", "NOT_FOUND")

    perm_stmt = (
        select(Permission)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id == role.id)
        .order_by(Permission.module.asc(), Permission.code.asc())
    )
    perms = (await db.execute(perm_stmt)).scalars().all()

    return success_response({
        "id": str(role.id),
        "code": role.code,
        "name": role.name,
        "description": role.description or "",
        "is_system_role": role.is_system_role,
        "is_supplier_role": role.is_supplier_role,
        "is_active": role.is_active,
        "permissions": [
            {
                "id": str(p.id),
                "code": p.code,
                "name": p.name,
                "module": p.module,
                "description": p.description or "",
            }
            for p in perms
        ],
    })


@router.put("/roles/{role_id}")
async def update_role(
    role_id: UUID,
    data: RoleUpdateRequest,
    current_user: User = Depends(require_permission(PermissionCode.USER_MANAGE_PERMISSIONS)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """PUT /api/v1/users/roles/{role_id} — update role details."""
    from sqlalchemy import select
    from app.modules.user.models import Role

    stmt = select(Role).where(Role.id == role_id, Role.deleted_at.is_(None))
    role = (await db.execute(stmt)).scalar_one_or_none()
    if not role:
        raise AppException("Role not found", "NOT_FOUND")

    if data.name is not None:
        role.name = data.name.strip()
    if data.description is not None:
        role.description = data.description
    if data.is_active is not None:
        role.is_active = data.is_active

    await audit_service.log(
        db,
        entity_type="ROLE",
        entity_id=role.id,
        action="UPDATED",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        metadata={"name": role.name, "is_active": role.is_active},
    )
    await db.commit()
    return success_response({"id": str(role.id), "message": "Role updated successfully"})


@router.put("/roles/{role_id}/permissions")
async def update_role_permissions(
    role_id: UUID,
    data: RolePermissionsUpdateRequest,
    current_user: User = Depends(require_permission(PermissionCode.USER_MANAGE_PERMISSIONS)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """PUT /api/v1/users/roles/{role_id}/permissions — batch update permissions assigned to a role."""
    from sqlalchemy import select, delete
    from app.modules.user.models import Role, RolePermission, Permission

    stmt = select(Role).where(Role.id == role_id, Role.deleted_at.is_(None))
    role = (await db.execute(stmt)).scalar_one_or_none()
    if not role:
        raise AppException("Role not found", "NOT_FOUND")

    await db.execute(delete(RolePermission).where(RolePermission.role_id == role.id))

    if data.permission_codes:
        perms_stmt = select(Permission).where(Permission.code.in_(data.permission_codes))
        perms = (await db.execute(perms_stmt)).scalars().all()
        for p in perms:
            db.add(RolePermission(
                org_id=role.org_id,
                role_id=role.id,
                permission_id=p.id,
                granted_by=current_user.id,
            ))

    await audit_service.log(
        db,
        entity_type="ROLE",
        entity_id=role.id,
        action="PERMISSIONS_UPDATED",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        metadata={"role_code": role.code, "permissions_count": len(data.permission_codes)},
    )
    await db.commit()
    return success_response({"message": f"Updated permissions for role '{role.code}'"})


@router.get("/permissions")
async def list_permissions(
    module: Optional[str] = Query(None, description="Module filter, e.g. PR, RFQ, USER"),
    search: Optional[str] = Query(None, description="Search in permission code, name, description"),
    current_user: User = Depends(require_permission(PermissionCode.USER_VIEW_ALL)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """GET /api/v1/users/permissions — full catalog of system permissions."""
    perms_data = await role_repository.get_all_permissions(
        db, current_user.org_id, module=module, search=search
    )
    meta = PaginationMeta(total=len(perms_data), page=1, page_size=len(perms_data) or 200)
    return success_response(perms_data, meta=meta)


@router.get("/role-permissions/matrix")
async def get_role_permissions_matrix(
    current_user: User = Depends(require_permission(PermissionCode.USER_VIEW_ALL)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """GET /api/v1/users/role-permissions/matrix — RBAC matrix mapping permissions to roles."""
    matrix_data = await role_repository.get_permissions_matrix(db, current_user.org_id)
    return success_response(matrix_data)


@router.post("/role-permissions/toggle")
async def toggle_role_permission(
    data: ToggleRolePermissionRequest,
    current_user: User = Depends(require_permission(PermissionCode.USER_MANAGE_PERMISSIONS)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """POST /api/v1/users/role-permissions/toggle — toggle a permission on a role."""
    changed = await role_repository.toggle_role_permission(
        db,
        current_user.org_id,
        data.role_code,
        data.permission_code,
        data.granted,
        current_user.id,
    )
    await audit_service.log(
        db,
        entity_type="ROLE_PERMISSION",
        entity_id=current_user.id,
        action="PERMISSION_TOGGLED",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        metadata={
            "role_code": data.role_code,
            "permission_code": data.permission_code,
            "granted": data.granted,
        },
    )
    return success_response({"changed": changed, "granted": data.granted})


@router.get("/sessions")
async def list_sessions(
    active_only: bool = Query(False, description="Filter for active, unexpired sessions"),
    search: Optional[str] = Query(None, description="Search by user email, name, or IP"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_permission(PermissionCode.USER_VIEW_ALL)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """GET /api/v1/users/sessions — list user sessions across the organization."""
    now = datetime.now(timezone.utc)
    sessions_with_users, total = await session_repository.list_sessions(
        db,
        current_user.org_id,
        active_only=active_only,
        search=search,
        page=page,
        page_size=page_size,
    )
    items = []
    for sess, u in sessions_with_users:
        is_active = not sess.is_revoked and sess.expires_at > now
        items.append({
            "id": str(sess.id),
            "user_id": str(u.id),
            "user_email": u.email,
            "user_name": f"{u.first_name} {u.last_name}".strip(),
            "token_jti": sess.token_jti,
            "ip_address": str(sess.ip_address) if sess.ip_address else "127.0.0.1",
            "user_agent": sess.user_agent or "Unknown Client",
            "created_at": sess.created_at.isoformat() if sess.created_at else None,
            "last_activity_at": sess.last_activity_at.isoformat() if sess.last_activity_at else None,
            "expires_at": sess.expires_at.isoformat() if sess.expires_at else None,
            "is_revoked": sess.is_revoked,
            "revoked_reason": sess.revoked_reason,
            "is_active": is_active,
        })
    meta = PaginationMeta(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size or 1,
    )
    return success_response(items, meta=meta)


@router.post("/sessions/{session_id}/revoke")
async def revoke_session(
    session_id: UUID,
    data: Optional[RevokeSessionRequest] = None,
    current_user: User = Depends(require_permission(PermissionCode.USER_UPDATE_ALL)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """POST /api/v1/users/sessions/{session_id}/revoke — force-revoke an active user session."""
    reason = data.reason if data and data.reason else "Revoked by Administrator"
    sess = await session_repository.get_by_id(db, session_id)
    if not sess:
        raise AppException("Session not found", "NOT_FOUND")

    await session_repository.revoke(db, session_id, reason)
    await audit_service.log(
        db,
        entity_type="USER_SESSION",
        entity_id=session_id,
        action="SESSION_REVOKED",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        metadata={"user_id": str(sess.user_id), "reason": reason},
    )
    await db.commit()
    return success_response({"message": "Session successfully revoked"})


@router.post("/sessions/user/{user_id}/revoke-all")
async def revoke_all_user_sessions(
    user_id: UUID,
    data: Optional[RevokeSessionRequest] = None,
    current_user: User = Depends(require_permission(PermissionCode.USER_UPDATE_ALL)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """POST /api/v1/users/sessions/user/{user_id}/revoke-all — force-revoke all active sessions for a user."""
    reason = data.reason if data and data.reason else "All sessions revoked by Administrator"
    await session_repository.revoke_all(db, user_id, current_user.org_id, reason)
    await audit_service.log(
        db,
        entity_type="USER_SESSION",
        entity_id=user_id,
        action="ALL_SESSIONS_REVOKED",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        metadata={"user_id": str(user_id), "reason": reason},
    )
    await db.commit()
    return success_response({"message": "All active sessions revoked for user"})


@router.post("/")
async def create_user(
    data: UserCreateRequest,
    current_user: User = Depends(require_permission(PermissionCode.USER_CREATE)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """POST /api/v1/users — create a new user."""
    from sqlalchemy import select
    from app.modules.user.models import Role, UserRoleAssignment

    valid, msg = validate_password_strength(data.password)
    if not valid:
        raise AppException(msg, "WEAK_PASSWORD")

    existing = await user_repository.find_by_email(db, data.email, current_user.org_id)
    if existing:
        raise AppException("Email already registered", "EMAIL_CONFLICT")

    user = User(
        org_id=current_user.org_id,
        email=data.email,
        first_name=data.first_name,
        last_name=data.last_name,
        password_hash=hash_password(data.password),
        employee_id=data.employee_id,
        status=UserStatusEnum.ACTIVE,
        created_by=current_user.id,
    )
    db.add(user)
    await db.flush()

    if data.roles:
        for r_code in data.roles:
            r_stmt = select(Role).where(Role.code == r_code, Role.org_id == current_user.org_id)
            role = (await db.execute(r_stmt)).scalar_one_or_none()
            if role:
                db.add(UserRoleAssignment(
                    org_id=current_user.org_id,
                    user_id=user.id,
                    role_id=role.id,
                    is_active=True,
                ))
        await db.flush()

    await audit_service.log(
        db,
        entity_type="USER",
        entity_id=user.id,
        action="CREATED",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        metadata={"email": user.email},
    )
    await db.commit()
    await db.commit()
    return created_response({"id": str(user.id), "email": user.email})


@router.post("/{user_id}/roles")
async def assign_user_role(
    user_id: UUID,
    data: AssignRoleRequest,
    current_user: User = Depends(require_permission(PermissionCode.USER_UPDATE_ALL)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """POST /api/v1/users/{user_id}/roles — assign a role to user."""
    from sqlalchemy import select
    from app.modules.user.models import Role, UserRoleAssignment

    user = await user_repository.get_by_id(db, user_id, current_user.org_id)
    if not user:
        raise AppException("User not found", "NOT_FOUND")

    stmt = select(Role).where(Role.code == data.role_code, Role.org_id == current_user.org_id)
    res = await db.execute(stmt)
    role = res.scalar_one_or_none()
    if not role:
        raise AppException(f"Role '{data.role_code}' not found", "NOT_FOUND")

    check_stmt = select(UserRoleAssignment).where(
        UserRoleAssignment.user_id == user_id,
        UserRoleAssignment.role_id == role.id,
    )
    existing = (await db.execute(check_stmt)).scalar_one_or_none()
    if not existing:
        assignment = UserRoleAssignment(
            org_id=current_user.org_id,
            user_id=user_id,
            role_id=role.id,
            is_active=True,
        )
        db.add(assignment)
        await db.commit()
    return success_response({"message": f"Role '{data.role_code}' assigned to user"})


@router.delete("/{user_id}/roles/{role_code}")
async def remove_user_role(
    user_id: UUID,
    role_code: str,
    current_user: User = Depends(require_permission(PermissionCode.USER_UPDATE_ALL)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """DELETE /api/v1/users/{user_id}/roles/{role_code} — remove role from user."""
    from sqlalchemy import select, delete
    from app.modules.user.models import Role, UserRoleAssignment

    stmt = select(Role).where(Role.code == role_code, Role.org_id == current_user.org_id)
    role = (await db.execute(stmt)).scalar_one_or_none()
    if not role:
        raise AppException(f"Role '{role_code}' not found", "NOT_FOUND")

    del_stmt = delete(UserRoleAssignment).where(
        UserRoleAssignment.user_id == user_id,
        UserRoleAssignment.role_id == role.id,
    )
    await db.execute(del_stmt)
    await db.commit()
    return success_response({"message": f"Role '{role_code}' removed from user"})


@router.get("/{user_id}")
async def get_user(
    user_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.USER_VIEW_ALL)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """GET /api/v1/users/{id}."""
    user = await user_repository.get_by_id(db, user_id, current_user.org_id)
    if not user:
        raise AppException("User not found", "NOT_FOUND")
    return success_response({
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "status": user.status.value,
        "mfa_enabled": user.mfa_enabled,
    })


@router.put("/{user_id}")
async def update_user(
    user_id: UUID,
    data: UserUpdateRequest,
    current_user: User = Depends(require_permission(PermissionCode.USER_UPDATE_ALL)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """PUT /api/v1/users/{id}."""
    user = await user_repository.get_by_id(db, user_id, current_user.org_id)
    if not user:
        raise AppException("User not found", "NOT_FOUND")

    if data.first_name is not None:
        user.first_name = data.first_name
    if data.last_name is not None:
        user.last_name = data.last_name
    if data.phone is not None:
        user.phone = data.phone
    if data.language is not None:
        user.language = data.language
    if data.timezone is not None:
        user.timezone = data.timezone

    return success_response({"id": str(user.id), "message": "Updated"})


@router.post("/{user_id}/activate")
async def activate_user(
    user_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.USER_UPDATE_ALL)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """POST /api/v1/users/{id}/activate."""
    user = await user_repository.get_by_id(db, user_id, current_user.org_id)
    if not user:
        raise AppException("User not found", "NOT_FOUND")
    user.status = UserStatusEnum.ACTIVE
    await audit_service.log(
        db, entity_type="USER", entity_id=user.id,
        action="ACTIVATED", actor_id=current_user.id, org_id=current_user.org_id,
    )
    return success_response({"message": "User activated"})


@router.post("/{user_id}/deactivate")
async def deactivate_user(
    user_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.USER_DEACTIVATE)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """POST /api/v1/users/{id}/deactivate."""
    user = await user_repository.get_by_id(db, user_id, current_user.org_id)
    if not user:
        raise AppException("User not found", "NOT_FOUND")
    user.status = UserStatusEnum.INACTIVE
    await audit_service.log(
        db, entity_type="USER", entity_id=user.id,
        action="DEACTIVATED", actor_id=current_user.id, org_id=current_user.org_id,
    )
    return success_response({"message": "User deactivated"})
