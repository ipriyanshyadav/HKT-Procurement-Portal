from __future__ import annotations
import pyotp
import secrets
import bcrypt
from app.core.encryption import encrypt_field, decrypt_field

def generate_totp_secret() -> str:
    """Generate a new TOTP secret (base32)."""
    return pyotp.random_base32()

def get_totp_uri(secret: str, email: str, issuer: str = "ProcurementPortal") -> str:
    """Return otpauth:// URI for QR code display."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=issuer)

def verify_totp(secret: str, code: str, valid_window: int = 1) -> bool:
    """Verify TOTP code. Allows 1 step drift."""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=valid_window)

def generate_backup_codes(count: int = 10) -> tuple[list[str], list[str]]:
    """
    Generate `count` backup codes.
    Returns (plaintext_codes, hashed_codes) — store ONLY hashed_codes.
    """
    plain_codes = [secrets.token_hex(8).upper() for _ in range(count)]
    hashed_codes = [
        bcrypt.hashpw(code.encode("utf-8")[:72], bcrypt.gensalt(rounds=10)).decode("utf-8")
        for code in plain_codes
    ]
    return plain_codes, hashed_codes

def verify_backup_code(plain_code: str, hashed_codes: list[str]) -> tuple[bool, int]:
    """
    Check if plain_code matches any stored hashed code.
    Returns (matched, index) — caller must remove the used code at index.
    """
    for i, hashed in enumerate(hashed_codes):
        try:
            if bcrypt.checkpw(plain_code.encode("utf-8")[:72], hashed.encode("utf-8")):
                return True, i
        except Exception:
            continue
    return False, -1

def encrypt_totp_secret(secret: str) -> str:
    return encrypt_field(secret)

def decrypt_totp_secret(encrypted: str) -> str:
    return decrypt_field(encrypted)
