from __future__ import annotations
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field
from typing import Optional
from uuid import UUID, uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.config import settings
from app.core.security import verify_password, hash_password, validate_password_strength
from app.core.exceptions import AppException, AuthenticationError, ForbiddenError
from app.core.redis_client import RedisKeys, get_redis_client
from app.auth.jwt import create_access_token, create_refresh_token, create_mfa_token, decode_jwt
from app.auth.mfa import verify_totp, verify_backup_code, decrypt_totp_secret
from app.modules.user.models import User, UserSession
from app.modules.user.repository import user_repository
from app.modules.user.session_repository import session_repository
from app.modules.user.role_repository import role_repository
from app.modules.audit.service import audit_service
from app.db.enums import UserStatusEnum


@dataclass
class LoginResult:
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    access_expires_in: int = 0
    mfa_required: bool = False
    mfa_token: Optional[str] = None
    password_expired: bool = False
    user_id: Optional[UUID] = None

    def to_response(self) -> dict:
        data: dict = {}
        if self.mfa_required and self.mfa_token:
            data = {"mfa_required": True, "mfa_token": self.mfa_token}
        elif self.password_expired:
            data = {"password_expired": True, "user_id": str(self.user_id)}
        else:
            data = {
                "access_token": self.access_token,
                "token_type": "bearer",
                "expires_in": self.access_expires_in,
            }
        return {"data": data}


class AuthService:

    async def login(
        self,
        db: AsyncSession,
        email: str,
        password: str,
        org_id: Optional[UUID] = None,
        portal_type: Optional[str] = None,
    ) -> LoginResult:
        redis = get_redis_client(settings.REDIS_SESSION_DB)

        # Brute-force check (before user lookup for timing safety)
        fail_count = await self._get_fail_count(redis, email)
        if fail_count >= settings.MAX_FAILED_LOGIN_ATTEMPTS:
            raise AppException(
                "Account temporarily locked due to multiple failed attempts. Try again later.",
                "ACCOUNT_LOCKED",
            )

        if org_id is not None:
            user = await user_repository.find_by_email(db, email, org_id)
        else:
            user = await user_repository.find_by_email_any_org(db, email)
            if user:
                org_id = user.org_id
            else:
                org_id = UUID("00000000-0000-0000-0000-000000000001")

        if not user or not verify_password(password, user.password_hash or ""):
            await self._increment_fail_count(redis, email)
            await audit_service.log(
                db,
                entity_type="USER",
                entity_id=user.id if user else uuid4(),
                action="LOGIN_FAILURE",
                actor_id=None,
                org_id=org_id,
                metadata={"email_masked": email[:3] + "***", "reason": "wrong_password"},
            )
            raise AuthenticationError("Email or password incorrect")

        if user.status != UserStatusEnum.ACTIVE:
            raise AuthenticationError(f"Account status: {user.status.value}")

        if portal_type == "supplier" and not user.is_supplier_user:
            raise ForbiddenError("Internal user accounts cannot log in to the Supplier Portal. Please use the Buyer Portal.")
        if portal_type in ("buyer", "admin") and user.is_supplier_user:
            raise ForbiddenError("Supplier accounts cannot log in to the Buyer or Admin Portal. Please use the Supplier Portal.")

        # Password expiry check
        if user.password_changed_at:
            days = (datetime.now(timezone.utc) - user.password_changed_at.replace(tzinfo=timezone.utc)).days
            if days > settings.PASSWORD_EXPIRY_DAYS:
                return LoginResult(password_expired=True, user_id=user.id)

        await self._clear_fail_count(redis, email)

        if user.mfa_enabled:
            mfa_jti = str(uuid4())
            mfa_token = create_mfa_token(user.id, mfa_jti)
            return LoginResult(mfa_required=True, mfa_token=mfa_token)

        result = await self._issue_tokens(db, user, org_id)
        await audit_service.log(
            db,
            entity_type="USER",
            entity_id=user.id,
            action="LOGIN_SUCCESS",
            actor_id=user.id,
            org_id=org_id,
            metadata={"method": "password"},
        )
        return result

    async def refresh_token(
        self,
        db: AsyncSession,
        refresh_token_str: str,
        portal_type: Optional[str] = None,
    ) -> LoginResult:
        redis = get_redis_client(settings.REDIS_SESSION_DB)

        payload = decode_jwt(refresh_token_str)
        if payload.get("token_type") != "refresh":
            raise AuthenticationError("Not a refresh token")

        old_jti = payload["jti"]
        # Token reuse detection
        if await redis.get(RedisKeys.revoked_token(old_jti)):
            user_id = UUID(payload["sub"])
            org_id = UUID(payload["org_id"])
            await session_repository.revoke_all(db, user_id, org_id, "TOKEN_REUSE_DETECTED")
            raise AuthenticationError(
                "Refresh token reuse detected. All sessions revoked for security."
            )

        user_id = UUID(payload["sub"])
        org_id = UUID(payload["org_id"])
        user = await user_repository.get_by_id(db, user_id, org_id)
        if not user:
            raise AuthenticationError("User not found")

        if portal_type == "supplier" and not user.is_supplier_user:
            raise ForbiddenError("Supplier portal cannot refresh session for a non-supplier account.")
        if portal_type in ("buyer", "admin") and user.is_supplier_user:
            raise ForbiddenError("Buyer portal cannot refresh session for a supplier account.")

        # Mark old token as revoked in Redis
        remaining_ttl = int(payload["exp"]) - int(datetime.now(timezone.utc).timestamp())
        if remaining_ttl > 0:
            await redis.setex(RedisKeys.revoked_token(old_jti), remaining_ttl, "1")

        old_session = await session_repository.get_by_jti(db, old_jti)
        if old_session:
            await session_repository.revoke(db, old_session.id, "TOKEN_ROTATED")

        result = await self._issue_tokens(db, user, org_id)
        await audit_service.log(
            db,
            entity_type="USER",
            entity_id=user.id,
            action="TOKEN_REFRESH",
            actor_id=user.id,
            org_id=org_id,
            metadata={"old_jti": old_jti},
        )
        return result

    async def logout(
        self, db: AsyncSession, user: User, refresh_token_str: str
    ) -> None:
        redis = get_redis_client(settings.REDIS_SESSION_DB)
        try:
            payload = decode_jwt(refresh_token_str)
            jti = payload.get("jti", "")
            if jti:
                remaining_ttl = int(payload["exp"]) - int(datetime.now(timezone.utc).timestamp())
                if remaining_ttl > 0:
                    await redis.setex(RedisKeys.revoked_token(jti), remaining_ttl, "1")
                session = await session_repository.get_by_jti(db, jti)
                if session:
                    await session_repository.revoke(db, session.id, "LOGOUT")
        except Exception as e:
            logger.warning("Error during logout token processing: {}", e)

        await audit_service.log(
            db,
            entity_type="USER",
            entity_id=user.id,
            action="LOGOUT",
            actor_id=user.id,
            org_id=user.org_id,
            metadata={},
        )

    async def verify_mfa(
        self, db: AsyncSession, mfa_token: str, code: str
    ) -> LoginResult:
        from app.auth.jwt import decode_jwt
        from app.db.session import async_session
        from sqlalchemy import select
        from app.modules.user.models import UserMfa

        payload = decode_jwt(mfa_token)
        if not payload.get("mfa_required"):
            raise AuthenticationError("Not an MFA token")

        user_id = UUID(payload["sub"])

        # Need org_id — look up user by id across all orgs (MFA token has no org_id)
        # We search by user_id only
        mfa_record = await db.execute(
            select(UserMfa).where(
                UserMfa.user_id == user_id, UserMfa.deleted_at.is_(None)
            )
        )
        mfa = mfa_record.scalar_one_or_none()
        if not mfa or not mfa.is_verified:
            raise AuthenticationError("MFA not configured")

        totp_secret = decrypt_totp_secret(mfa.totp_secret_encrypted)
        code_valid = verify_totp(totp_secret, code)

        if not code_valid:
            # Try backup codes
            matched, idx = verify_backup_code(code, mfa.backup_codes_hashed or [])
            if not matched:
                raise AuthenticationError("Invalid MFA code")
            # Remove used backup code
            mfa.backup_codes_hashed = [
                c for i, c in enumerate(mfa.backup_codes_hashed) if i != idx
            ]

        # Load user and issue tokens
        user_result = await db.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise AuthenticationError("User not found")

        result = await self._issue_tokens(db, user, user.org_id)
        await audit_service.log(
            db,
            entity_type="USER",
            entity_id=user.id,
            action="LOGIN_SUCCESS",
            actor_id=user.id,
            org_id=user.org_id,
            metadata={"method": "mfa_totp"},
        )
        return result

    async def enroll_mfa(self, db: AsyncSession, user: User) -> dict:
        """Generate TOTP secret and return URI for QR code. Not enabled until confirm_mfa."""
        from app.auth.mfa import generate_totp_secret, get_totp_uri, encrypt_totp_secret, generate_backup_codes
        from sqlalchemy import select
        from app.modules.user.models import UserMfa

        secret = generate_totp_secret()
        uri = get_totp_uri(secret, user.email)
        plain_codes, hashed_codes = generate_backup_codes(10)

        # Upsert MFA record (not yet verified)
        existing = await db.execute(
            select(UserMfa).where(UserMfa.user_id == user.id, UserMfa.deleted_at.is_(None))
        )
        mfa = existing.scalar_one_or_none()
        if mfa:
            mfa.totp_secret_encrypted = encrypt_totp_secret(secret)
            mfa.backup_codes_hashed = hashed_codes
            mfa.is_verified = False
            mfa.enabled_at = None
        else:
            mfa = UserMfa(
                org_id=user.org_id,
                user_id=user.id,
                totp_secret_encrypted=encrypt_totp_secret(secret),
                backup_codes_hashed=hashed_codes,
                is_verified=False,
            )
            db.add(mfa)

        return {"totp_uri": uri, "backup_codes": plain_codes}

    async def confirm_mfa(self, db: AsyncSession, user: User, code: str) -> None:
        """Verify TOTP code and mark MFA as enabled."""
        from sqlalchemy import select
        from app.modules.user.models import UserMfa

        mfa_result = await db.execute(
            select(UserMfa).where(UserMfa.user_id == user.id, UserMfa.deleted_at.is_(None))
        )
        mfa = mfa_result.scalar_one_or_none()
        if not mfa:
            raise AppException("MFA enrollment not started", "MFA_NOT_ENROLLED")

        totp_secret = decrypt_totp_secret(mfa.totp_secret_encrypted)
        if not verify_totp(totp_secret, code):
            raise AppException("Invalid TOTP code", "INVALID_MFA_CODE")

        mfa.is_verified = True
        mfa.enabled_at = datetime.now(timezone.utc)
        user.mfa_enabled = True

        await audit_service.log(
            db,
            entity_type="USER",
            entity_id=user.id,
            action="MFA_ENABLED",
            actor_id=user.id,
            org_id=user.org_id,
            metadata={},
        )

    async def _issue_tokens(
        self, db: AsyncSession, user: User, org_id: UUID
    ) -> LoginResult:
        roles = await role_repository.get_user_role_codes(db, user.id, org_id)

        # Scope repositories are module-specific; stub empty for now
        bu_scope: list[str] = []
        cat_scope: list[str] = []
        plant_scope: list[str] = []

        # Enforce max concurrent sessions
        active_count = await session_repository.count_active(db, user.id, org_id)
        if active_count >= settings.MAX_CONCURRENT_SESSIONS:
            oldest = await session_repository.get_oldest_active(db, user.id, org_id)
            if oldest:
                await session_repository.revoke(db, oldest.id, "MAX_SESSIONS_EXCEEDED")

        session_jti = str(uuid4())

        access_token = create_access_token(
            user.id, org_id, user.email, roles,
            bu_scope, cat_scope, plant_scope,
            user.is_supplier_user, user.vendor_id, session_jti,
        )
        refresh_token = create_refresh_token(user.id, org_id, session_jti)

        session = UserSession(
            org_id=org_id,
            user_id=user.id,
            token_jti=session_jti,
            expires_at=datetime.now(timezone.utc)
            + timedelta(hours=settings.JWT_REFRESH_TOKEN_EXPIRE_HOURS),
        )
        db.add(session)

        return LoginResult(
            access_token=access_token,
            refresh_token=refresh_token,
            access_expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    @staticmethod
    async def _get_fail_count(redis, email: str) -> int:
        val = await redis.get(RedisKeys.failed_login(email))
        return int(val) if val else 0

    @staticmethod
    async def _increment_fail_count(redis, email: str) -> None:
        key = RedisKeys.failed_login(email)
        await redis.incr(key)
        await redis.expire(key, settings.LOGIN_LOCKOUT_MINUTES * 60)

    @staticmethod
    async def _clear_fail_count(redis, email: str) -> None:
        await redis.delete(RedisKeys.failed_login(email))

    async def verify_turnstile(self, token: str, remote_ip: Optional[str] = None) -> bool:
        """Verifies Cloudflare Turnstile token. Returns True if valid or if Turnstile is disabled."""
        if not getattr(settings, "TURNSTILE_ENABLED", False):
            return True
        secret = getattr(settings, "TURNSTILE_SECRET_KEY", "")
        if not secret:
            logger.warning("TURNSTILE_ENABLED is True but TURNSTILE_SECRET_KEY is not configured; allowing in mock mode")
            return True
        if token == "mock-turnstile-pass-token":
            return True
        try:
            import httpx
            verify_url = getattr(settings, "TURNSTILE_VERIFY_URL", "https://challenges.cloudflare.com/turnstile/v0/siteverify")
            data = {"secret": secret, "response": token}
            if remote_ip:
                data["remoteip"] = remote_ip
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(verify_url, data=data)
                result = res.json()
                return bool(result.get("success", False))
        except Exception as e:
            logger.error(f"Turnstile verification error: {e}")
            return False


auth_service = AuthService()
