from __future__ import annotations
import re
from passlib.context import CryptContext
from app.config import settings
from loguru import logger

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

PASSWORD_REGEX = re.compile(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-]).{12,}$'
)

_COMMON_PASSWORDS: set[str] = set()

def load_common_passwords() -> None:
    global _COMMON_PASSWORDS
    try:
        with open(settings.COMMON_PASSWORDS_FILE) as f:
            _COMMON_PASSWORDS = {line.strip().lower() for line in f if line.strip()}
        logger.info("Loaded {} common passwords", len(_COMMON_PASSWORDS))
    except FileNotFoundError:
        logger.warning("Common passwords file not found: {}", settings.COMMON_PASSWORDS_FILE)

def validate_password_strength(password: str) -> tuple[bool, str]:
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        return False, f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters"
    if not PASSWORD_REGEX.match(password):
        return False, "Password must contain uppercase, lowercase, digit, and special character"
    if password.lower() in _COMMON_PASSWORDS:
        return False, "Password is too common. Choose a more unique password"
    return True, ""

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def mask_pii(value: str) -> str:
    """Returns masked value for logging. Never logs raw PII."""
    if not value:
        return ""
    if "@" in value:
        parts = value.split("@")
        return f"{parts[0][:3]}***@***"
    return f"{value[:3]}***{value[-2:]}" if len(value) > 5 else "***"
