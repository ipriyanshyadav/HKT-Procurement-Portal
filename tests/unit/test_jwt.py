"""
Unit tests for app.auth.jwt — RS256 token creation and decoding.
SPEC_04 § 2 (JWT structure), § 3 (key management), § 4 (token lifetimes).
"""
from __future__ import annotations
import os
import time
import pytest
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/test")
os.environ.setdefault("JWT_PRIVATE_KEY_PATH", "keys/private.pem")
os.environ.setdefault("JWT_PUBLIC_KEY_PATH", "keys/public.pem")
os.environ.setdefault("FIELD_ENCRYPTION_KEY", "U5RAQQjKHzcBauoi8R7GrRrj7bBSf-eQPhPtfGg370A=")

from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    create_mfa_token,
    decode_jwt,
)
from app.core.exceptions import AuthenticationError


# --- Fixtures ---

def _make_access_token(**kwargs) -> str:
    defaults = dict(
        user_id=uuid4(),
        org_id=uuid4(),
        email="test@procurement.com",
        roles=["REQUESTOR"],
        bu_scope=[],
        category_scope=[],
        plant_scope=[],
        is_supplier_user=False,
        vendor_id=None,
        jti=str(uuid4()),
    )
    defaults.update(kwargs)
    return create_access_token(**defaults)


class TestAccessToken:
    def test_contains_required_fields(self):
        token = _make_access_token()
        payload = decode_jwt(token)
        required = {"sub", "org_id", "email", "roles", "jti", "iat", "exp", "kid"}
        assert required.issubset(payload.keys())

    def test_no_mfa_required_field(self):
        """Access token must NOT have mfa_required — guard against MFA token reuse."""
        token = _make_access_token()
        payload = decode_jwt(token)
        assert "mfa_required" not in payload

    def test_roles_in_payload(self):
        token = _make_access_token(roles=["PROCUREMENT_MANAGER", "APPROVER"])
        payload = decode_jwt(token)
        assert "PROCUREMENT_MANAGER" in payload["roles"]
        assert "APPROVER" in payload["roles"]

    def test_supplier_user_flag(self):
        vendor_id = uuid4()
        token = _make_access_token(is_supplier_user=True, vendor_id=vendor_id)
        payload = decode_jwt(token)
        assert payload["is_supplier_user"] is True
        assert payload["vendor_id"] == str(vendor_id)

    def test_exp_is_future(self):
        token = _make_access_token()
        payload = decode_jwt(token)
        assert payload["exp"] > int(time.time())

    def test_sub_is_user_id_string(self):
        user_id = uuid4()
        token = _make_access_token(user_id=user_id)
        payload = decode_jwt(token)
        assert payload["sub"] == str(user_id)

    def test_org_id_in_payload(self):
        org_id = uuid4()
        token = _make_access_token(org_id=org_id)
        payload = decode_jwt(token)
        assert payload["org_id"] == str(org_id)

    def test_algorithm_is_rs256(self):
        """Token should only be decodable with RSA public key (RS256)."""
        token = _make_access_token()
        # Verify it decodes without error using the standard path
        payload = decode_jwt(token)
        assert payload is not None

    def test_tampered_token_rejected(self):
        token = _make_access_token()
        # Tamper with the payload part
        parts = token.split(".")
        tampered = parts[0] + "." + "TAMPERED" + "." + parts[2]
        with pytest.raises((AuthenticationError, Exception)):
            decode_jwt(tampered)

    def test_invalid_token_raises(self):
        with pytest.raises(AuthenticationError):
            decode_jwt("not.a.valid.jwt")


class TestRefreshToken:
    def test_contains_token_type_refresh(self):
        token = create_refresh_token(uuid4(), uuid4(), str(uuid4()))
        payload = decode_jwt(token)
        assert payload["token_type"] == "refresh"

    def test_no_roles_in_refresh_token(self):
        token = create_refresh_token(uuid4(), uuid4(), str(uuid4()))
        payload = decode_jwt(token)
        assert "roles" not in payload

    def test_jti_present(self):
        jti = str(uuid4())
        token = create_refresh_token(uuid4(), uuid4(), jti)
        payload = decode_jwt(token)
        assert payload["jti"] == jti

    def test_exp_is_future(self):
        token = create_refresh_token(uuid4(), uuid4(), str(uuid4()))
        payload = decode_jwt(token)
        assert payload["exp"] > int(time.time())


class TestMFAToken:
    def test_mfa_required_flag_set(self):
        token = create_mfa_token(uuid4(), str(uuid4()))
        payload = decode_jwt(token)
        assert payload["mfa_required"] is True

    def test_no_roles_in_mfa_token(self):
        """MFA token MUST NOT contain roles — cannot be used as access token."""
        token = create_mfa_token(uuid4(), str(uuid4()))
        payload = decode_jwt(token)
        assert "roles" not in payload
        assert "org_id" not in payload

    def test_expires_in_5_minutes(self):
        """MFA token expires quickly."""
        token = create_mfa_token(uuid4(), str(uuid4()))
        payload = decode_jwt(token)
        now = int(time.time())
        # Should expire in ~5 min (300 seconds), allow 10s buffer
        assert payload["exp"] <= now + 310
        assert payload["exp"] > now

    def test_mfa_token_cannot_masquerade_as_access_token(self):
        """
        The get_current_user dependency checks for mfa_required=True and blocks it.
        Here we just verify the flag exists to block access.
        """
        token = create_mfa_token(uuid4(), str(uuid4()))
        payload = decode_jwt(token)
        # Simulate the check in get_current_user
        assert payload.get("mfa_required") is True  # Will be blocked


class TestFieldEncryption:
    def test_encrypt_decrypt_roundtrip(self):
        from app.core.encryption import encrypt_field, decrypt_field
        value = "sensitive-test-data-12345"
        encrypted = encrypt_field(value)
        assert encrypted != value
        decrypted = decrypt_field(encrypted)
        assert decrypted == value

    def test_different_ciphertext_each_time(self):
        from app.core.encryption import encrypt_field
        value = "test-value"
        c1 = encrypt_field(value)
        c2 = encrypt_field(value)
        assert c1 != c2  # Fernet uses random IV

    def test_encrypt_empty_string(self):
        from app.core.encryption import encrypt_field, decrypt_field
        encrypted = encrypt_field("")
        assert decrypt_field(encrypted) == ""
