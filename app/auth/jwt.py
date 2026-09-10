from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID
from jose import jwt, JWTError
from app.config import settings
from app.core.exceptions import AuthenticationError

def _read_key(path: str) -> str:
    """Read PEM key from file path."""
    with open(path) as f:
        return f.read()

def _load_private_key() -> str:
    return _read_key(settings.JWT_PRIVATE_KEY_PATH)

def _load_public_key() -> str:
    return _read_key(settings.JWT_PUBLIC_KEY_PATH)

def create_access_token(
    user_id: UUID,
    org_id: UUID,
    email: str,
    roles: list[str],
    bu_scope: list[str],
    category_scope: list[str],
    plant_scope: list[str],
    is_supplier_user: bool,
    vendor_id: Optional[UUID],
    jti: str,
    portal: str = "buyer",
    active_legal_entity_id: Optional[UUID] = None,
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "org_id": str(org_id),
        "email": email,
        "roles": roles,
        "bu_scope": [str(b) for b in bu_scope],
        "category_scope": [str(c) for c in category_scope],
        "plant_scope": [str(p) for p in plant_scope],
        "is_supplier_user": is_supplier_user,
        "vendor_id": str(vendor_id) if vendor_id else None,
        "active_legal_entity_id": str(active_legal_entity_id) if active_legal_entity_id else None,
        "jti": jti,
        "portal": portal,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "kid": settings.JWT_KEY_ID,
    }
    return jwt.encode(payload, _load_private_key(), algorithm=settings.JWT_ALGORITHM)

def create_refresh_token(user_id: UUID, org_id: UUID, jti: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=settings.JWT_REFRESH_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(user_id),
        "org_id": str(org_id),
        "token_type": "refresh",
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "kid": settings.JWT_KEY_ID,
    }
    return jwt.encode(payload, _load_private_key(), algorithm=settings.JWT_ALGORITHM)

def create_mfa_token(user_id: UUID, jti: str) -> str:
    """Short-lived token for MFA challenge. Contains NO roles/permissions."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=5)
    payload = {
        "sub": str(user_id),
        "mfa_required": True,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "kid": settings.JWT_KEY_ID,
    }
    return jwt.encode(payload, _load_private_key(), algorithm=settings.JWT_ALGORITHM)

def decode_jwt(token: str) -> dict:
    """Decode and verify a JWT. Raises AuthenticationError on failure."""
    try:
        return jwt.decode(token, _load_public_key(), algorithms=[settings.JWT_ALGORITHM])
    except JWTError as e:
        raise AuthenticationError(f"Token validation failed: {e}")
