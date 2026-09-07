from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID
from fastapi import Depends, Request, WebSocket, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.auth.jwt import decode_jwt
from app.config import settings
from app.core.exceptions import AppException, AuthenticationError, ForbiddenError
from app.core.permissions import PERMANENTLY_DENIED_PERMISSIONS
from app.db.session import get_db
from app.modules.user.models import User
from app.modules.user.repository import user_repository
from app.modules.user.session_repository import session_repository
from app.modules.user.role_repository import role_repository
from app.db.enums import UserStatusEnum

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """7-step auth pipeline: validate token → check user → check session → inactivity."""
    # Step 1: Token presence
    if not credentials or not credentials.credentials:
        raise AuthenticationError("Authorization header required")

    # Step 2: Decode and verify JWT
    payload = decode_jwt(credentials.credentials)

    # Step 3: Block MFA-step tokens
    if payload.get("mfa_required"):
        raise AuthenticationError("Complete MFA verification first")

    # Step 4: Check required claims
    user_id_str = payload.get("sub")
    org_id_str = payload.get("org_id")
    jti = payload.get("jti")
    if not user_id_str or not org_id_str or not jti:
        raise AuthenticationError("Token missing required claims")

    user_id = UUID(user_id_str)
    org_id = UUID(org_id_str)

    # Step 5: Load and verify user
    user = await user_repository.get_by_id(db, user_id, org_id)
    if not user or user.status != UserStatusEnum.ACTIVE:
        raise AuthenticationError("User inactive or not found")

    # Step 6: Verify session exists and not revoked
    session = await session_repository.get_by_jti(db, jti)
    if not session:
        logger.warning(f"get_current_user: session NOT FOUND for jti={jti}")
        raise AuthenticationError("Session has been revoked")
    if session.is_revoked:
        if session.revoked_reason == "TOKEN_ROTATED":
            logger.info(f"get_current_user: session is_revoked=True for jti={jti}, reason={session.revoked_reason}")
        else:
            logger.warning(f"get_current_user: session is_revoked=True for jti={jti}, reason={session.revoked_reason}")
        raise AuthenticationError("Session has been revoked")

    # Step 7: Inactivity timeout check
    now = datetime.now(timezone.utc)
    inactivity_limit = timedelta(minutes=settings.MFA_INACTIVITY_TIMEOUT_MINUTES)
    last_activity = session.last_activity_at
    if last_activity.tzinfo is None:
        last_activity = last_activity.replace(tzinfo=timezone.utc)
    if (now - last_activity) > inactivity_limit:
        await session_repository.revoke(db, session.id, "INACTIVITY_TIMEOUT")
        raise AuthenticationError("Session expired due to inactivity")

    await session_repository.update_activity(db, session.id, now)
    request.state.user = user
    request.state.org_id = org_id
    return user


async def get_optional_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Returns the authenticated user if valid, or None if unauthenticated."""
    if not credentials or not credentials.credentials:
        return None
    try:
        return await get_current_user(request, credentials, db)
    except Exception:
        return None


def require_permission(permission_code: str):
    """Dependency factory: ensures user has a specific permission."""
    async def _check(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        if permission_code in PERMANENTLY_DENIED_PERMISSIONS:
            raise ForbiddenError(
                f"{permission_code} is permanently denied and cannot be granted to any user"
            )
        has_perm = await role_repository.user_has_permission(
            db, current_user.id, current_user.org_id, permission_code
        )
        if not has_perm:
            raise ForbiddenError(f"Missing required permission: {permission_code}")
        return current_user
    return _check


def require_any_permission(*permission_codes: str | list[str] | tuple[str, ...]):
    """Dependency factory: ensures user has AT LEAST ONE of the specified permissions."""
    flat_codes: list[str] = []
    for code in permission_codes:
        if isinstance(code, (list, tuple, set)):
            flat_codes.extend(str(c) for c in code)
        else:
            flat_codes.append(str(code))

    async def _check(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        for pcode in flat_codes:
            if pcode in PERMANENTLY_DENIED_PERMISSIONS:
                continue
            has_perm = await role_repository.user_has_permission(
                db, current_user.id, current_user.org_id, pcode
            )
            if has_perm:
                return current_user
        raise ForbiddenError(f"Missing required permission: one of {flat_codes}")
    return _check



def require_mfa_enabled():
    """Dependency: asserts user has MFA enabled (for privileged roles)."""
    mfa_roles = set(settings.MFA_REQUIRED_ROLES)
    async def _check(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        user_roles = set(await role_repository.get_user_role_codes(db, current_user.id, current_user.org_id))
        if mfa_roles.intersection(user_roles) and not current_user.mfa_enabled:
            raise ForbiddenError(
                "MFA must be enabled for your role. Please complete MFA enrollment."
            )
        return current_user
    return _check


async def get_current_user_ws(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not token:
        token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise AppException("UNAUTHORIZED", "Missing authentication token", 401)

    try:
        payload = decode_jwt(token)
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise AppException("UNAUTHORIZED", "Invalid token", 401)

    if payload.get("mfa_required"):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise AppException("UNAUTHORIZED", "Complete MFA verification first", 401)

    user_id_str = payload.get("sub")
    org_id_str = payload.get("org_id")
    jti = payload.get("jti")
    if not user_id_str or not org_id_str or not jti:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise AppException("UNAUTHORIZED", "Token missing required claims", 401)

    user_id = UUID(user_id_str)
    org_id = UUID(org_id_str)

    user = await user_repository.get_by_id(db, user_id, org_id)
    if not user or user.status != UserStatusEnum.ACTIVE:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise AppException("UNAUTHORIZED", "User inactive or not found", 401)

    session = await session_repository.get_by_jti(db, jti)
    if not session:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise AppException("UNAUTHORIZED", "Session has been revoked", 401)

    return user
