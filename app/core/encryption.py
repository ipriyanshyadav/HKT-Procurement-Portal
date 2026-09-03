from __future__ import annotations
from cryptography.fernet import Fernet
from app.config import settings
from loguru import logger

_fernet: Fernet | None = None

def get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = settings.FIELD_ENCRYPTION_KEY
        # Key must be 32 url-safe base64-encoded bytes
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet

def encrypt_field(value: str) -> str:
    """Encrypt a string field. Returns base64-encoded ciphertext string."""
    return get_fernet().encrypt(value.encode()).decode()

def decrypt_field(encrypted_value: str) -> str:
    """Decrypt a previously encrypted field."""
    return get_fernet().decrypt(encrypted_value.encode()).decode()
