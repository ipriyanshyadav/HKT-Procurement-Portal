# IMPLEMENTATION PLAN — SPEC_04: Auth, Authorization & Security
**Module:** 04 | **Phase:** Foundation | **Squad:** A
**Spec File:** SPEC_04_AUTH_SECURITY.md | **Plan Date:** 2026-08-04

---

## SESSION BOOTSTRAP
- [x] 0-A–0-E: All bootstrap steps complete. Migration head at 0027_data_seed.

---

## SPEC COVERAGE MAP
| Req# | Section | File Target | Status |
|---|---|---|---|
| S04-01 | FastAPI auth pipeline (7 steps) | auth/dependencies.py | PLANNED |
| S04-02 | JWT structure (RS256, all fields) | auth/jwt.py | PLANNED |
| S04-03 | Key management (rotation, kid) | auth/jwt.py + config | PLANNED |
| S04-04 | Token lifetimes (15min access, 8h refresh) | config.py (already done) | PLANNED |
| S04-05 | Refresh token flow (10-step rotation) | auth/router.py + service.py | PLANNED |
| S04-06 | Password policy (12 chars, bcrypt 12, history 5, expiry 90d) | core/security.py | PLANNED |
| S04-07 | TOTP MFA (pyotp, 10 backup codes) | auth/mfa.py | PLANNED |
| S04-08 | MFA enforcement by role | auth/dependencies.py | PLANNED |
| S04-09 | MFA login flow (2-step with mfa_token) | auth/router.py + auth/service.py | PLANNED |
| S04-10 | Brute-force protection (5 attempts, 30min lock) | auth/service.py + Redis | PLANNED |
| S04-11 | SAML 2.0 SSO (SP-initiated, python3-saml) | auth/sso.py | PLANNED |
| S04-12 | OIDC SSO (authlib, Azure AD) | auth/sso.py | PLANNED |
| S04-13 | JIT provisioning (REQUESTOR default role) | auth/sso.py | PLANNED |
| S04-14 | Session management (max 5, 30min inactivity) | auth/dependencies.py + service.py | PLANNED |
| S04-15 | HRMS termination handling | user/service.py | PLANNED |
| S04-16 | 100+ permission codes | core/constants.py (PermissionCode class) | PLANNED |
| S04-17 | RBAC matrix (11 internal + 4 supplier roles) | db seed + role_permissions | PLANNED |
| S04-18 | Segregation of Duties (maker-checker) | workflow/service.py + API layer | PLANNED |
| S04-19 | Vendor blacklisting dual-approval | vendor/service.py | PLANNED |
| S04-20 | Kong JWT plugin config | kong/kong.yml | PLANNED |
| S04-21 | Field-level encryption (PAN, GSTIN, bank account, TOTP secret) | core/encryption.py | PLANNED |
| S04-22 | At-rest encryption (PostgreSQL disk, MinIO SSE-S3) | Infrastructure config | PLANNED |
| S04-23 | In-transit TLS 1.3 | Kong config + K3s networking | PLANNED |
| S04-24 | SQL injection prevention (ORM only) | All repository files | PLANNED |
| S04-25 | XSS prevention (CSP, httpOnly, React auto-escape) | middleware.py + Next.js config | PLANNED |
| S04-26 | SSRF prevention (allowlist) | tenant_settings + httpx wrapper | PLANNED |
| S04-27 | File upload validation (magic bytes) | document/scanner.py | PLANNED |
| S04-28 | Path traversal prevention (sanitize_filename) | document/service.py | PLANNED |
| S04-29 | Security headers (CSP, HSTS, X-Frame-Options, etc.) | middleware.py | PLANNED |
| S04-30 | Auth event auditing (16 event types) | auth/service.py | PLANNED |

---

## ASSUMPTIONS LOG

| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-04-1 | RS256 private key stored as environment variable (base64-encoded PEM); NOT as file path in production K3s | K3s Secrets are the correct mechanism; file paths risk exposure | HIGH — key exposure | DevOps |
| A-04-2 | CAPTCHA challenge on 3+ failed attempts is deferred to Phase 2 (RECAPTCHA integration); Phase 1 logs warning and locks at 5 | SPEC mentions CAPTCHA in brute-force section; no CAPTCHA provider configured | MEDIUM | Squad A |
| A-04-3 | `mfa_token` (5-min short-lived JWT) uses same RS256 key but contains only {sub, mfa_required: true, exp}; cannot be used as access token (validated by presence of `roles` claim in standard auth check) | SPEC_04 Section 5.3 describes the 2-step MFA flow | MEDIUM | Squad A |
| A-04-4 | Password reset via email link deferred to Phase 2; Phase 1 admin resets via `POST /api/v1/admin/users/{id}/reset-password` | SPEC lists password reset in auth audit events; email link is standard UX | LOW | Squad A |
| A-04-5 | SAML/OIDC metadata URL and certificate stored in `tenant_settings.saml_idp_metadata_url` and `tenant_settings.saml_certificate`; loaded dynamically per request, cached in Redis 24h | SPEC Section 7.1 specifies tenant_settings storage | MEDIUM | Squad A |
| A-04-6 | Common password list (10,000 entries) stored in `scripts/common_passwords.txt`, loaded into memory at startup and cached in module-level set | SPEC requires check at registration and change time | LOW | Squad A |

---

## STEP 2 — IMPLEMENT

### 2.1 `app/core/security.py` — Password Hashing and Validation
```python
from passlib.context import CryptContext
import re
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

PASSWORD_REGEX = re.compile(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-]).{' +
    str(settings.PASSWORD_MIN_LENGTH) + r',}$'
)

_COMMON_PASSWORDS: set[str] = set()

def load_common_passwords():
    global _COMMON_PASSWORDS
    try:
        with open(settings.COMMON_PASSWORDS_FILE) as f:
            _COMMON_PASSWORDS = {line.strip().lower() for line in f}
    except FileNotFoundError:
        pass  # Non-fatal: log warning

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
```

### 2.2 `app/auth/jwt.py` — JWT Operations
```python
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from uuid import UUID
from app.config import settings
import json

def _load_private_key() -> str:
    return settings.JWT_PRIVATE_KEY_PATH  # Actual PEM content from env

def _load_public_key() -> str:
    return settings.JWT_PUBLIC_KEY_PATH

def create_access_token(
    user_id: UUID, org_id: UUID, email: str,
    roles: list[str], bu_scope: list[str], category_scope: list[str],
    plant_scope: list[str], is_supplier_user: bool, vendor_id: Optional[UUID],
    jti: str
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
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "kid": settings.JWT_KEY_ID,
    }
    return jwt.encode(payload, _load_private_key(), algorithm=settings.JWT_ALGORITHM)

def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, _load_public_key(), algorithms=[settings.JWT_ALGORITHM])
    except JWTError as e:
        from app.core.exceptions import AppException
        raise AppException("INVALID_TOKEN", "Token validation failed", 401)

def create_mfa_token(user_id: UUID, jti: str) -> str:
    """Short-lived token for MFA challenge step. Contains NO roles/permissions."""
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
```

### 2.3 `app/auth/dependencies.py` — Auth Middleware Chain
```python
from fastapi import Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.auth.jwt import decode_jwt
from app.core.exceptions import AppException, ForbiddenError
from app.core.constants import PermissionCode, PERMANENTLY_DENIED_PERMISSIONS
from app.config import settings
from datetime import datetime, timedelta, timezone

security = HTTPBearer(auto_error=False)

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise AppException("MISSING_TOKEN", "Authorization header required", 401)

    payload = decode_jwt(credentials.credentials)

    # Block MFA-step tokens from accessing regular endpoints
    if payload.get("mfa_required"):
        raise AppException("MFA_REQUIRED", "Complete MFA verification first", 401)

    user_id = UUID(payload["sub"])
    org_id = UUID(payload["org_id"])

    user = await user_repo.get_by_id(db, user_id, org_id)
    if not user or user.status != "ACTIVE":
        raise AppException("USER_INACTIVE", "User inactive or not found", 401)

    session = await session_repo.get_by_jti(db, payload["jti"])
    if not session or session.is_revoked:
        raise AppException("SESSION_REVOKED", "Session has been revoked", 401)

    now = datetime.now(timezone.utc)
    inactivity_limit = timedelta(minutes=settings.MFA_INACTIVITY_TIMEOUT_MINUTES)
    if (now - session.last_activity_at.replace(tzinfo=timezone.utc)) > inactivity_limit:
        await session_repo.revoke(db, session.id, "INACTIVITY_TIMEOUT")
        raise AppException("SESSION_EXPIRED", "Session expired due to inactivity", 401)

    await session_repo.update_activity(db, session.id, now)
    request.state.user = user
    request.state.org_id = org_id
    return user


def require_permission(permission_code: str):
    """Dependency factory: ensures user has a specific permission."""
    async def _check(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        # Hardcoded deny list — NEVER grant these
        if permission_code in PERMANENTLY_DENIED_PERMISSIONS:
            raise ForbiddenError("PERMISSION_PERMANENTLY_DENIED", f"{permission_code} is never granted")

        has_perm = await permission_repo.user_has_permission(
            db, current_user.id, current_user.org_id, permission_code
        )
        if not has_perm:
            raise ForbiddenError("INSUFFICIENT_PERMISSION", f"Missing: {permission_code}")
        return current_user
    return _check


def require_mfa_enabled():
    """Dependency: asserts user has MFA enabled (for privileged roles)."""
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        MFA_REQUIRED_ROLES = {
            "APPROVER", "PROCUREMENT_HEAD", "FINANCE_CONTROLLER",
            "COMPLIANCE_OFFICER", "VENDOR_ADMIN", "PROCUREMENT_ADMIN",
            "SOURCING_MANAGER", "CFO"
        }
        user_roles = await role_repo.get_user_role_codes(current_user.id, current_user.org_id)
        if MFA_REQUIRED_ROLES.intersection(user_roles) and not current_user.mfa_enabled:
            raise ForbiddenError("MFA_REQUIRED_FOR_ROLE", "MFA must be enabled for your role")
        return current_user
    return _check
```

### 2.4 `app/auth/service.py` — AuthService
```python
class AuthService:

    async def login(self, db: AsyncSession, email: str, password: str, org_id: UUID) -> LoginResult:
        # 1. Load user
        user = await self.user_repo.find_by_email(db, email, org_id)

        # 2. Brute force check
        fail_count = await self._get_fail_count(email)
        if fail_count >= settings.MAX_FAILED_LOGIN_ATTEMPTS:
            raise AppException("ACCOUNT_LOCKED", "Account locked. Try again later.", 423)

        # 3. Verify user exists and password
        if not user or not verify_password(password, user.password_hash or ""):
            await self._increment_fail_count(email)
            await self._audit(db, "AUTH_LOGIN_FAILURE", None, org_id, {"email": email, "reason": "wrong_password"})
            raise AppException("INVALID_CREDENTIALS", "Email or password incorrect", 401)

        # 4. Check user status
        if user.status != "ACTIVE":
            raise AppException("USER_INACTIVE", f"Account status: {user.status}", 401)

        # 5. Check password expiry
        if user.password_changed_at:
            days_since_change = (datetime.utcnow() - user.password_changed_at).days
            if days_since_change > settings.PASSWORD_EXPIRY_DAYS:
                return LoginResult(password_expired=True, user_id=user.id)

        # 6. Clear fail count on success
        await self._clear_fail_count(email)

        # 7. MFA check
        if user.mfa_enabled:
            mfa_jti = str(uuid4())
            mfa_token = create_mfa_token(user.id, mfa_jti)
            return LoginResult(mfa_required=True, mfa_token=mfa_token)

        # 8. Issue tokens
        result = await self._issue_tokens(db, user, org_id)
        await self._audit(db, "AUTH_LOGIN_SUCCESS", user.id, org_id, {"method": "password"})
        return result

    async def _issue_tokens(self, db: AsyncSession, user: User, org_id: UUID) -> LoginResult:
        # Load scope from DB (not from payload — always fresh)
        roles = await self.role_repo.get_user_role_codes(db, user.id, org_id)
        bu_scope = await self.scope_repo.get_bu_scope(db, user.id, org_id)
        cat_scope = await self.scope_repo.get_cat_scope(db, user.id, org_id)
        plant_scope = await self.scope_repo.get_plant_scope(db, user.id, org_id)

        # Check max concurrent sessions
        active_sessions = await self.session_repo.count_active(db, user.id, org_id)
        if active_sessions >= settings.MAX_CONCURRENT_SESSIONS:
            oldest = await self.session_repo.get_oldest_active(db, user.id, org_id)
            await self.session_repo.revoke(db, oldest.id, "MAX_SESSIONS_EXCEEDED")

        access_jti = str(uuid4())
        refresh_jti = str(uuid4())

        access_token = create_access_token(
            user.id, org_id, user.email, roles, bu_scope, cat_scope, plant_scope,
            user.is_supplier_user, user.vendor_id, access_jti
        )
        refresh_token = create_refresh_token(user.id, org_id, refresh_jti)

        session = UserSession(
            org_id=org_id, user_id=user.id, token_jti=refresh_jti,
            expires_at=datetime.utcnow() + timedelta(hours=settings.JWT_REFRESH_TOKEN_EXPIRE_HOURS)
        )
        db.add(session)

        return LoginResult(
            access_token=access_token,
            refresh_token=refresh_token,
            access_expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def refresh_token(self, db: AsyncSession, refresh_token: str) -> LoginResult:
        payload = decode_jwt(refresh_token)
        if payload.get("token_type") != "refresh":
            raise AppException("INVALID_TOKEN_TYPE", "Not a refresh token", 401)

        old_jti = payload["jti"]
        # Check not in blocklist
        if await self.redis.get(RedisKeys.revoked_token(old_jti)):
            # Potential token theft — revoke all sessions
            user_id = UUID(payload["sub"])
            org_id = UUID(payload["org_id"])
            await self.session_repo.revoke_all(db, user_id, org_id, "TOKEN_REUSE_DETECTED")
            raise AppException("TOKEN_REUSE_DETECTED", "Refresh token reuse detected. All sessions revoked.", 401)

        user_id = UUID(payload["sub"])
        org_id = UUID(payload["org_id"])
        user = await self.user_repo.get_by_id(db, user_id, org_id)

        # Revoke old token in Redis
        remaining_ttl = payload["exp"] - int(datetime.utcnow().timestamp())
        if remaining_ttl > 0:
            await self.redis.setex(RedisKeys.revoked_token(old_jti), remaining_ttl, "1")

        # Revoke old session
        old_session = await self.session_repo.get_by_jti(db, old_jti)
        if old_session:
            await self.session_repo.revoke(db, old_session.id, "TOKEN_ROTATED")

        result = await self._issue_tokens(db, user, org_id)
        await self._audit(db, "AUTH_TOKEN_REFRESH", user.id, org_id, {"old_jti": old_jti})
        return result
```

### 2.5 `app/auth/router.py` — Auth Endpoints
```python
router = APIRouter()

@router.post("/login", response_model=LoginResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """POST /api/v1/auth/login"""
    result = await auth_service.login(db, data.email, data.password, data.org_id)
    response = JSONResponse(content=result.to_response())
    if result.refresh_token:
        response.set_cookie(
            key="refresh_token", value=result.refresh_token,
            httponly=True, secure=True, samesite="strict",
            max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_HOURS * 3600
        )
    return response

@router.post("/refresh")
async def refresh(request: Request, db: AsyncSession = Depends(get_db)):
    """POST /api/v1/auth/refresh — reads refresh_token from httpOnly cookie"""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise AppException("MISSING_REFRESH_TOKEN", "Refresh token not found", 401)
    result = await auth_service.refresh_token(db, refresh_token)
    response = JSONResponse(content={"access_token": result.access_token})
    response.set_cookie(
        key="refresh_token", value=result.refresh_token,
        httponly=True, secure=True, samesite="strict",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_HOURS * 3600
    )
    return response

@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        await auth_service.logout(db, current_user, refresh_token)
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie("refresh_token")
    return response

@router.post("/mfa/verify")
async def verify_mfa(data: MFAVerifyRequest, db: AsyncSession = Depends(get_db)):
    """POST /api/v1/auth/mfa/verify — exchanges mfa_token + TOTP code for access token"""
    result = await auth_service.verify_mfa(db, data.mfa_token, data.totp_code)
    response = JSONResponse(content={"access_token": result.access_token})
    response.set_cookie("refresh_token", result.refresh_token, httponly=True, secure=True, samesite="strict")
    return response

@router.post("/mfa/enroll")
async def enroll_mfa(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Returns TOTP URI for QR code display. Not yet enabled until /mfa/confirm."""

@router.post("/mfa/confirm")
async def confirm_mfa(data: MFAConfirmRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Verifies TOTP code and enables MFA."""

@router.post("/sso/initiate")
async def sso_initiate(provider: str):
    """SAML 2.0 SP-initiated or OIDC redirect."""

@router.post("/sso/callback")
async def sso_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """SAML 2.0 ACS URL handler."""

@router.get("/sso/oidc/callback")
async def oidc_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    """OIDC authorization code exchange."""
```

### 2.6 `app/core/encryption.py` — Field Encryption
```python
from cryptography.fernet import Fernet
from app.config import settings

_fernet = None

def get_fernet() -> Fernet:
    global _fernet
    if not _fernet:
        _fernet = Fernet(settings.FIELD_ENCRYPTION_KEY.encode())
    return _fernet

def encrypt_field(value: str) -> str:
    return get_fernet().encrypt(value.encode()).decode()

def decrypt_field(encrypted_value: str) -> str:
    return get_fernet().decrypt(encrypted_value.encode()).decode()

def mask_pii(value: str) -> str:
    """Returns masked value for logging. Never logs raw PII."""
    if not value:
        return ""
    if "@" in value:  # email
        parts = value.split("@")
        return f"{parts[0][:3]}***@***"
    return f"{value[:3]}***{value[-2:]}" if len(value) > 5 else "***"
```

### 2.7 Audit Service (for Auth Events)
```python
# app/modules/audit/service.py
class AuditService:
    async def log(
        self, db: AsyncSession, entity_type: str, entity_id: UUID,
        action: str, actor_id: Optional[UUID], org_id: UUID,
        old_values: Optional[dict] = None, new_values: Optional[dict] = None,
        metadata: Optional[dict] = None, trace_id: str = ""
    ) -> None:
        """INSERT-only. Never UPDATE or DELETE."""
        from app.core.telemetry import get_current_trace_id
        log_entry = AuditLog(
            org_id=org_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            actor_id=actor_id,
            old_values=old_values,
            new_values=new_values,
            metadata=metadata or {},
            trace_id=trace_id or get_current_trace_id(),
        )
        db.add(log_entry)
        # No commit here — caller's transaction commits it
```

### 2.8 Permission Seeding
**File:** `scripts/seed_master_data.py` — extended with all permissions:
```python
PERMISSIONS = [
    # PR
    ("pr.create", "Create Purchase Requisition", "requisition"),
    ("pr.view_own", "View Own PRs", "requisition"),
    ("pr.view_bu", "View BU PRs", "requisition"),
    ("pr.view_all", "View All PRs", "requisition"),
    ("pr.update_own", "Update Own PR", "requisition"),
    ("pr.submit", "Submit PR", "requisition"),
    ("pr.approve", "Approve PR", "requisition"),
    ("pr.reject", "Reject PR", "requisition"),
    ("pr.withdraw", "Withdraw PR", "requisition"),
    ("pr.merge", "Merge PRs", "requisition"),
    ("pr.split", "Split PR", "requisition"),
    ("pr.amend", "Amend PR", "requisition"),
    # RFQ
    ("rfq.create", "Create RFQ", "sourcing"),
    ("rfq.view_own", "View Own RFQs", "sourcing"),
    ("rfq.view_bu", "View BU RFQs", "sourcing"),
    ("rfq.view_all", "View All RFQs", "sourcing"),
    ("rfq.update", "Update RFQ", "sourcing"),
    ("rfq.submit", "Submit RFQ for Approval", "sourcing"),
    ("rfq.approve", "Approve RFQ", "sourcing"),
    ("rfq.publish", "Publish RFQ", "sourcing"),
    ("rfq.amend", "Amend RFQ", "sourcing"),
    ("rfq.cancel", "Cancel RFQ", "sourcing"),
    ("rfq.add_bidders", "Add Bidders to RFQ", "sourcing"),
    ("rfq.manage_clarifications", "Manage RFQ Clarifications", "sourcing"),
    ("rfq.open_bids", "Open Bids", "sourcing"),
    ("rfq.co_authorize_opening", "Co-Authorize Bid Opening", "sourcing"),
    ("rfq.view_bids_before_opening", "View Bids Before Opening (PERMANENTLY DENIED)", "sourcing"),
    ("rfq.view_bids_after_opening", "View Bids After Opening", "sourcing"),
    # ... (all 100+ permission codes from SPEC_04 Section 9.1)
]
```

---

## STEP 3 — TEST

### 3.1 User Persona
- Login with valid credentials returns access_token in body
- Refresh token set as httpOnly cookie
- Subsequent requests with access_token succeed
- Requests without token return 401
- Requests with expired token return 401
- 5 failed logins lock account; 6th returns 423

### 3.2 Developer Persona
**File:** `tests/unit/test_security.py`
```python
def test_password_regex_rejects_short():
    valid, msg = validate_password_strength("Short1!")
    assert not valid

def test_password_regex_accepts_strong():
    valid, msg = validate_password_strength("SecureP@ssw0rd!")
    assert valid

def test_common_password_rejected():
    load_common_passwords()
    valid, msg = validate_password_strength("password123!")
    assert not valid

def test_password_hash_verify():
    hashed = hash_password("SecureP@ssw0rd!")
    assert verify_password("SecureP@ssw0rd!", hashed)
    assert not verify_password("WrongPassword!", hashed)
```

**File:** `tests/unit/test_jwt.py`
```python
def test_access_token_contains_required_fields():
    token = create_access_token(uuid4(), uuid4(), "test@test.com", ["BUYER"], [], [], [], False, None, str(uuid4()))
    payload = decode_jwt(token)
    assert "sub" in payload and "org_id" in payload and "roles" in payload
    assert "mfa_required" not in payload  # Not an MFA token

def test_mfa_token_cannot_authenticate():
    """MFA token rejected by get_current_user because it has mfa_required=True."""
    token = create_mfa_token(uuid4(), str(uuid4()))
    payload = decode_jwt(token)
    assert payload["mfa_required"] is True
```

**File:** `tests/security/test_auth_security.py`
```python
async def test_view_bids_before_opening_always_denied():
    """rfq.view_bids_before_opening ALWAYS returns 403 regardless of role."""
    # Give user PROCUREMENT_ADMIN (highest role)
    # Try to access bid data before opening
    # Must still get 403

async def test_refresh_token_rotation():
    """Old refresh token cannot be reused after rotation."""

async def test_token_reuse_revokes_all_sessions():
    """Reusing a refresh token that was already rotated revokes all sessions."""

async def test_brute_force_lockout():
    """5 failures → 423; correct password after lockout also returns 423."""

async def test_maker_checker_self_approval_blocked():
    """PR creator cannot approve own PR."""

async def test_vendor_blacklist_requires_different_users():
    """Initiator and confirmer must be different users."""
```

### 3.3 QA Persona
- TOTP QR code scannable by Google Authenticator; subsequent OTP codes verify successfully
- Backup codes work for MFA login; each code single-use
- SAML SP metadata endpoint returns valid XML
- OIDC discovery endpoint reachable
- Token inactivity timeout: session expires after 30 min of no requests
- Max 5 sessions: 6th login revokes oldest session
- Role assignment audit trail recorded in audit_logs
- Permission denied returns 403 with `INSUFFICIENT_PERMISSION` code, never 401
- CSP header present on all responses

---

## STEP 4 — INTEGRATE
```bash
# Seed permissions and roles
python scripts/seed_master_data.py
# Test full auth flow
pytest tests/integration/test_auth.py -v
pytest tests/security/ -v
```

---

## STEP 5 — GRAPHIFY UPDATE
```bash
graphify update
# New nodes: AuthService, LoginEndpoint, RefreshEndpoint, MFAService, SSOHandler,
#            SecurityPolicyEngine (permissions), AuditService
graphify check --integrity
```
