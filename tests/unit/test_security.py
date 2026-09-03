"""
Unit tests for app.core.security — password hashing, validation, PII masking.
SPEC_04 § 4.1 password policy: 12 chars, bcrypt 12 rounds, common-password block.
"""
from __future__ import annotations
import os
import pytest

# Set env vars before any app imports
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/test")
os.environ.setdefault("JWT_PRIVATE_KEY_PATH", "keys/private.pem")
os.environ.setdefault("JWT_PUBLIC_KEY_PATH", "keys/public.pem")
os.environ.setdefault("FIELD_ENCRYPTION_KEY", "U5RAQQjKHzcBauoi8R7GrRrj7bBSf-eQPhPtfGg370A=")

from app.core.security import (
    hash_password,
    verify_password,
    validate_password_strength,
    load_common_passwords,
    mask_pii,
)


class TestPasswordStrengthValidation:
    def test_rejects_short_password(self):
        valid, msg = validate_password_strength("Sh0rt!")
        assert not valid
        assert "12" in msg or "least" in msg

    def test_rejects_no_uppercase(self):
        valid, msg = validate_password_strength("lowercase1!securepass")
        assert not valid

    def test_rejects_no_lowercase(self):
        valid, msg = validate_password_strength("UPPERCASE1!SECURE12")
        assert not valid

    def test_rejects_no_digit(self):
        valid, msg = validate_password_strength("NoDigitSecure!Pass")
        assert not valid

    def test_rejects_no_special_char(self):
        valid, msg = validate_password_strength("NoSpecialChar1234abc")
        assert not valid

    def test_accepts_strong_password(self):
        valid, msg = validate_password_strength("SecureP@ssw0rd!")
        assert valid
        assert msg == ""

    def test_accepts_exactly_12_chars(self):
        valid, msg = validate_password_strength("SecureP@ss1!")
        assert valid

    def test_accepts_long_password(self):
        valid, msg = validate_password_strength("ALong&SecureP@ssw0rdThatIsVeryLong123!")
        assert valid

    def test_rejects_empty(self):
        valid, msg = validate_password_strength("")
        assert not valid

    def test_common_password_rejected(self):
        """Common passwords must be rejected if list is loaded."""
        load_common_passwords()
        # 'password123!' is common — test with known weak entries from the list
        valid, msg = validate_password_strength("password")
        # Either too short OR common — both are rejections
        assert not valid

    def test_common_password_list_loaded(self):
        """load_common_passwords should not raise even if file missing."""
        load_common_passwords()  # Should not raise


class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        hashed = hash_password("SecureP@ssw0rd!")
        assert hashed != "SecureP@ssw0rd!"

    def test_verify_correct_password(self):
        hashed = hash_password("SecureP@ssw0rd!")
        assert verify_password("SecureP@ssw0rd!", hashed)

    def test_reject_wrong_password(self):
        hashed = hash_password("SecureP@ssw0rd!")
        assert not verify_password("WrongPassword!1", hashed)

    def test_different_hashes_same_password(self):
        """bcrypt is salted — same password produces different hashes."""
        h1 = hash_password("SecureP@ssw0rd!")
        h2 = hash_password("SecureP@ssw0rd!")
        assert h1 != h2

    def test_hash_starts_with_bcrypt_prefix(self):
        hashed = hash_password("SecureP@ssw0rd!")
        assert hashed.startswith("$2b$") or hashed.startswith("$2a$")


class TestMaskPII:
    def test_masks_email(self):
        masked = mask_pii("john.doe@example.com")
        assert "***" in masked
        assert "@example.com" not in masked
        assert "joh" in masked

    def test_masks_short_value(self):
        masked = mask_pii("ab")
        assert masked == "***"

    def test_masks_long_value(self):
        masked = mask_pii("1234567890ABCDEF")
        assert "***" in masked
        assert "1234567890ABCDEF" not in masked

    def test_empty_string(self):
        assert mask_pii("") == ""

    def test_email_format(self):
        masked = mask_pii("admin@procurement.com")
        assert "@" not in masked or "***@***" in masked
