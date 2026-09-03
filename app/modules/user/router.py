from __future__ import annotations
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr

from app.auth.dependencies import get_current_user, require_permission
from app.core.exceptions import AppException, ForbiddenError
from app.core.security import hash_password, verify_password, validate_password_strength
from app.db.session import get_db
from app.modules.user.models import User
from app.modules.user.repository import user_repository
from app.modules.user.role_repository import role_repository
from app.modules.audit.service import audit_service
from app.core.constants import PermissionCode
from app.db.enums import UserStatusEnum

router = APIRouter()


class UserResponse(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    status: str
    mfa_enabled: bool
    is_supplier_user: bool
    org_id: UUID

    model_config = {"from_attributes": True}


class UserCreateRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    password: str
    employee_id: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)) -> dict:
    """GET /api/v1/users/me — returns current user profile."""
    return {
        "data": {
            "id": str(current_user.id),
            "email": current_user.email,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "status": current_user.status.value,
            "mfa_enabled": current_user.mfa_enabled,
            "is_supplier_user": current_user.is_supplier_user,
            "org_id": str(current_user.org_id),
        }
    }


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
    return {"data": {"permissions": permissions}}


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
    return {"data": {"message": "Password changed successfully"}}


@router.get("/")
async def list_users(
    current_user: User = Depends(require_permission(PermissionCode.USER_VIEW_ALL)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """GET /api/v1/users — list users (requires user.view_all permission)."""
    users = await user_repository.get_multi(db, current_user.org_id)
    return {
        "data": [
            {
                "id": str(u.id),
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "status": u.status.value,
            }
            for u in users
        ]
    }


@router.post("/")
async def create_user(
    data: UserCreateRequest,
    current_user: User = Depends(require_permission(PermissionCode.USER_CREATE)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """POST /api/v1/users — create a new user."""
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
        status=UserStatusEnum.PENDING_ACTIVATION,
        created_by=current_user.id,
    )
    db.add(user)
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
    return {"data": {"id": str(user.id), "email": user.email}}


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
    return {
        "data": {
            "id": str(user.id),
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "status": user.status.value,
            "mfa_enabled": user.mfa_enabled,
        }
    }


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

    return {"data": {"id": str(user.id), "message": "Updated"}}


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
    return {"data": {"message": "User activated"}}


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
    return {"data": {"message": "User deactivated"}}
