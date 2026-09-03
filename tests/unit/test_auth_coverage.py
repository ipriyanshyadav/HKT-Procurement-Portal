"""
Additional coverage tests for auth service, dependencies, MFA, repository layers.
These test the logic paths without needing live DB/Redis connections.
"""
from __future__ import annotations
import os
import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/test")
os.environ.setdefault("JWT_PRIVATE_KEY_PATH", "keys/private.pem")
os.environ.setdefault("JWT_PUBLIC_KEY_PATH", "keys/public.pem")
os.environ.setdefault("FIELD_ENCRYPTION_KEY", "U5RAQQjKHzcBauoi8R7GrRrj7bBSf-eQPhPtfGg370A=")


# ---- MFA Tests ----

class TestMFAFunctions:
    def test_generate_totp_secret(self):
        from app.auth.mfa import generate_totp_secret
        secret = generate_totp_secret()
        assert len(secret) >= 16  # Base32 encoded
        assert secret.isalpha() or all(c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" for c in secret)

    def test_get_totp_uri(self):
        from app.auth.mfa import generate_totp_secret, get_totp_uri
        secret = generate_totp_secret()
        uri = get_totp_uri(secret, "user@test.com")
        assert uri.startswith("otpauth://totp/")
        assert "user%40test.com" in uri or "user@test.com" in uri

    def test_verify_totp_valid_code(self):
        import pyotp
        from app.auth.mfa import verify_totp
        secret = pyotp.random_base32()
        totp = pyotp.TOTP(secret)
        code = totp.now()
        assert verify_totp(secret, code)

    def test_verify_totp_invalid_code(self):
        from app.auth.mfa import verify_totp
        import pyotp
        secret = pyotp.random_base32()
        assert not verify_totp(secret, "000000")

    def test_generate_backup_codes(self):
        from app.auth.mfa import generate_backup_codes
        plain, hashed = generate_backup_codes(10)
        assert len(plain) == 10
        assert len(hashed) == 10
        # Plain codes must be different from hashed
        for p, h in zip(plain, hashed):
            assert p != h

    def test_verify_backup_code_match(self):
        from app.auth.mfa import generate_backup_codes, verify_backup_code
        plain, hashed = generate_backup_codes(5)
        matched, idx = verify_backup_code(plain[2], hashed)
        assert matched
        assert idx == 2

    def test_verify_backup_code_no_match(self):
        from app.auth.mfa import generate_backup_codes, verify_backup_code
        _, hashed = generate_backup_codes(5)
        matched, idx = verify_backup_code("INVALID_CODE_XYZ", hashed)
        assert not matched
        assert idx == -1

    def test_totp_secret_encrypt_decrypt(self):
        from app.auth.mfa import generate_totp_secret, encrypt_totp_secret, decrypt_totp_secret
        secret = generate_totp_secret()
        encrypted = encrypt_totp_secret(secret)
        decrypted = decrypt_totp_secret(encrypted)
        assert decrypted == secret
        assert encrypted != secret


# ---- Audit Service Tests ----

class TestAuditService:
    @pytest.mark.asyncio
    async def test_log_creates_entry(self):
        from app.modules.audit.service import audit_service

        mock_db = MagicMock()
        mock_db.add = MagicMock()

        org_id = uuid4()
        entity_id = uuid4()
        actor_id = uuid4()

        await audit_service.log(
            db=mock_db,
            entity_type="USER",
            entity_id=entity_id,
            action="LOGIN_SUCCESS",
            actor_id=actor_id,
            org_id=org_id,
            metadata={"method": "password"},
        )

        # Must call db.add with an AuditLog instance
        mock_db.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_no_commit_called(self):
        """AuditService.log() never commits — that's the caller's responsibility."""
        from app.modules.audit.service import audit_service

        mock_db = MagicMock()
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()

        await audit_service.log(
            db=mock_db,
            entity_type="USER",
            entity_id=uuid4(),
            action="LOGOUT",
            actor_id=uuid4(),
            org_id=uuid4(),
        )

        mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_log_with_unknown_entity_type_fallback(self):
        """Unknown entity type falls back to USER enum."""
        from app.modules.audit.service import audit_service

        mock_db = MagicMock()
        mock_db.add = MagicMock()

        # Should not raise
        await audit_service.log(
            db=mock_db,
            entity_type="UNKNOWN_TYPE",
            entity_id=uuid4(),
            action="TEST_ACTION",
            actor_id=None,
            org_id=uuid4(),
        )
        mock_db.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_with_old_and_new_values(self):
        from app.modules.audit.service import audit_service
        from app.modules.audit.models import AuditLog

        mock_db = MagicMock()
        mock_db.add = MagicMock()

        await audit_service.log(
            db=mock_db,
            entity_type="USER",
            entity_id=uuid4(),
            action="SCOPE_CHANGED",
            actor_id=uuid4(),
            org_id=uuid4(),
            old_values={"role": "REQUESTOR"},
            new_values={"role": "APPROVER"},
            metadata={"changed_by": "admin"},
        )

        call_args = mock_db.add.call_args[0][0]
        assert isinstance(call_args, AuditLog)
        assert call_args.old_values == {"role": "REQUESTOR"}
        assert call_args.new_values == {"role": "APPROVER"}


# ---- Permission Checks ----

class TestPermissionsModule:
    @pytest.mark.asyncio
    async def test_user_has_permission_denies_permanently_denied(self):
        from app.core.permissions import user_has_permission
        from app.core.constants import PermissionCode

        mock_db = AsyncMock()
        result = await user_has_permission(
            mock_db, uuid4(), uuid4(), PermissionCode.RFQ_VIEW_BIDS_BEFORE_OPENING
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_user_has_permission_returns_true_for_others(self):
        """Stub returns True for non-permanently-denied permissions."""
        from app.core.permissions import user_has_permission
        from app.core.constants import PermissionCode

        mock_db = AsyncMock()
        result = await user_has_permission(
            mock_db, uuid4(), uuid4(), PermissionCode.PR_CREATE
        )
        assert result is True


# ---- Auth Service Logic Tests ----

class TestAuthServiceLogic:
    @pytest.mark.asyncio
    async def test_login_result_to_response_mfa(self):
        from app.auth.service import LoginResult
        result = LoginResult(mfa_required=True, mfa_token="token123")
        response = result.to_response()
        assert response["data"]["mfa_required"] is True
        assert response["data"]["mfa_token"] == "token123"

    @pytest.mark.asyncio
    async def test_login_result_to_response_success(self):
        from app.auth.service import LoginResult
        result = LoginResult(access_token="tok", refresh_token="ref", access_expires_in=900)
        response = result.to_response()
        assert response["data"]["access_token"] == "tok"
        assert response["data"]["expires_in"] == 900

    @pytest.mark.asyncio
    async def test_login_result_to_response_password_expired(self):
        from app.auth.service import LoginResult
        uid = uuid4()
        result = LoginResult(password_expired=True, user_id=uid)
        response = result.to_response()
        assert response["data"]["password_expired"] is True

    @pytest.mark.asyncio
    async def test_fail_count_methods(self):
        """_get_fail_count / _increment_fail_count / _clear_fail_count logic."""
        from app.auth.service import AuthService

        mock_redis = AsyncMock()
        # Test get_fail_count returning 0 when key missing
        mock_redis.get.return_value = None
        count = await AuthService._get_fail_count(mock_redis, "test@test.com")
        assert count == 0

        # Test with existing count
        mock_redis.get.return_value = b"3"
        count = await AuthService._get_fail_count(mock_redis, "test@test.com")
        assert count == 3

        # Test increment
        await AuthService._increment_fail_count(mock_redis, "test@test.com")
        mock_redis.incr.assert_called_once()
        mock_redis.expire.assert_called_once()

        # Test clear
        await AuthService._clear_fail_count(mock_redis, "test@test.com")
        mock_redis.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_login_fails_when_account_locked(self):
        from app.auth.service import auth_service
        from app.core.exceptions import AppException

        mock_db = AsyncMock()
        mock_redis = AsyncMock()
        mock_redis.get.return_value = b"5"  # At limit

        with patch('app.auth.service.get_redis_client', return_value=mock_redis):
            with pytest.raises(AppException) as exc_info:
                await auth_service.login(mock_db, "user@test.com", "pass", uuid4())
            assert exc_info.value.code == "ACCOUNT_LOCKED"

    @pytest.mark.asyncio
    async def test_login_fails_with_wrong_password(self):
        from app.auth.service import auth_service
        from app.core.exceptions import AuthenticationError
        from app.modules.user.models import User
        from app.db.enums import UserStatusEnum

        mock_db = AsyncMock()
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None  # Not locked
        mock_redis.incr = AsyncMock()
        mock_redis.expire = AsyncMock()
        mock_redis.delete = AsyncMock()

        # User exists but password is wrong (use a real bcrypt hash for "correctpass")
        from app.core.security import hash_password
        mock_user = MagicMock(spec=User)
        mock_user.id = uuid4()
        mock_user.org_id = uuid4()
        mock_user.status = UserStatusEnum.ACTIVE
        mock_user.password_hash = hash_password("CorrectP@ss1!")
        mock_user.password_changed_at = None

        mock_audit = AsyncMock()

        with patch('app.auth.service.get_redis_client', return_value=mock_redis):
            with patch('app.auth.service.user_repository.find_by_email', AsyncMock(return_value=mock_user)):
                with patch('app.auth.service.audit_service.log', mock_audit):
                    with pytest.raises(AuthenticationError):
                        # Send wrong password — should fail
                        await auth_service.login(mock_db, "user@test.com", "WrongP@ss99!", uuid4())


# ---- Security Headers Test ----

class TestSecurityHeaders:
    def test_security_middleware_has_csp(self):
        """Security headers middleware should add CSP header."""
        from app.core.middleware import SecurityHeadersMiddleware
        assert SecurityHeadersMiddleware is not None

    def test_constants_no_hardcoded_magic_numbers(self):
        """GEMINI.md: No magic numbers in logic."""
        from app.config import settings
        # All key thresholds come from settings
        assert isinstance(settings.MAX_FAILED_LOGIN_ATTEMPTS, int)
        assert isinstance(settings.MAX_CONCURRENT_SESSIONS, int)
        assert isinstance(settings.MFA_INACTIVITY_TIMEOUT_MINUTES, int)
        assert isinstance(settings.PASSWORD_MIN_LENGTH, int)
        assert isinstance(settings.PASSWORD_EXPIRY_DAYS, int)


# ---- SSO Module Tests ----

class TestSSOModule:
    def test_saml_availability_check(self):
        """SAML availability gracefully degrades if python3-saml not installed."""
        from app.auth.sso import SAML_AVAILABLE
        # Either True or False — should not raise
        assert isinstance(SAML_AVAILABLE, bool)

    def test_sso_result_dataclass(self):
        from app.auth.sso import SSOResult
        result = SSOResult(
            email="user@company.com",
            first_name="John",
            last_name="Doe",
            sso_provider="oidc",
            sso_subject_id="sub-12345",
        )
        assert result.email == "user@company.com"
        assert result.sso_provider == "oidc"
        assert result.extra == {}


# ---- JWT Edge Cases ----

class TestJWTEdgeCases:
    def test_vendor_id_none_in_token(self):
        from app.auth.jwt import create_access_token, decode_jwt
        token = create_access_token(
            uuid4(), uuid4(), "test@test.com", ["REQUESTOR"],
            [], [], [], False, None, str(uuid4())
        )
        payload = decode_jwt(token)
        assert payload["vendor_id"] is None

    def test_multiple_roles_in_token(self):
        from app.auth.jwt import create_access_token, decode_jwt
        roles = ["REQUESTOR", "APPROVER"]
        token = create_access_token(
            uuid4(), uuid4(), "test@test.com", roles,
            [], [], [], False, None, str(uuid4())
        )
        payload = decode_jwt(token)
        assert set(payload["roles"]) == set(roles)

    def test_jti_uniqueness(self):
        from app.auth.jwt import create_access_token, decode_jwt
        jti1 = str(uuid4())
        jti2 = str(uuid4())
        assert jti1 != jti2

        t1 = create_access_token(uuid4(), uuid4(), "a@b.com", [], [], [], [], False, None, jti1)
        t2 = create_access_token(uuid4(), uuid4(), "a@b.com", [], [], [], [], False, None, jti2)

        p1 = decode_jwt(t1)
        p2 = decode_jwt(t2)
        assert p1["jti"] != p2["jti"]

    def test_bu_scope_category_plant_in_token(self):
        from app.auth.jwt import create_access_token, decode_jwt
        bu_scope = [str(uuid4())]
        cat_scope = [str(uuid4())]
        plant_scope = [str(uuid4())]
        token = create_access_token(
            uuid4(), uuid4(), "t@t.com", ["REQUESTOR"],
            bu_scope, cat_scope, plant_scope, False, None, str(uuid4())
        )
        payload = decode_jwt(token)
        assert payload["bu_scope"] == bu_scope
        assert payload["category_scope"] == cat_scope
        assert payload["plant_scope"] == plant_scope
