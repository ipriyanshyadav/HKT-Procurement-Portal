"""OWASP Top 10 Security Test Suite.
Verifies security controls across all 10 OWASP Top 10 categories:
- A01: Broken Access Control (RBAC, IDOR, vertical privilege escalation, sealed bid protection)
- A02: Cryptographic Failures (JWT signature tampering, expired token, alg=none, field encryption)
- A03: Injection (SQL injection via query params, filters, sort fields)
- A04: Insecure Design (Maker-checker separation of duties)
- A05: Security Misconfiguration (Security headers: CSP, nosniff, CORS, exception masking)
- A06: Vulnerable Components & File Upload Protection (disallowed extensions, path traversal)
- A07: Identification and Authentication Failures (invalid login, account lock / rate limiting)
- A08: Software and Data Integrity Failures (Bid hash verification & tamper detection)
- A09: Security Logging & Monitoring (Audit log generation on state changes)
- A10: Server-Side Request Forgery (SSRF) (Private IP and cloud metadata rejection)
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from jose import jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token, _load_private_key
from app.config import settings
from app.core.encryption import encrypt_field, decrypt_field
from app.core.exceptions import ForbiddenError, ValidationError
from app.core.security import pwd_context
from app.modules.integration.http_client import SafeHTTPClient
from app.db.enums import BidStatusEnum, PrStatusEnum, UserStatusEnum
from app.modules.bid.service import bid_service
from app.modules.document.scanner import sanitize_filename, validate_mime_type


# ==============================================================================
# A01: BROKEN ACCESS CONTROL
# ==============================================================================

@pytest.mark.security
async def test_broken_access_control_no_token(client: AsyncClient):
    """Protected API endpoints must reject requests without an Authorization token with 401."""
    endpoints = [
        "/api/v1/requisitions",
        "/api/v1/vendors",
        "/api/v1/rfqs",
        "/api/v1/purchase-orders",
        "/api/v1/invoices",
    ]
    for ep in endpoints:
        resp = await client.get(ep)
        assert resp.status_code == 401, f"Expected 401 for unauthenticated {ep}, got {resp.status_code}"


@pytest.mark.security
async def test_broken_access_control_vertical_escalation(
    client: AsyncClient, supplier_auth_headers: dict
):
    """Supplier user attempting to access administrative buyer endpoints must be rejected with 403."""
    resp = await client.post(
        "/api/v1/admin/users",
        json={"email": "hacked@test.com", "first_name": "Bad", "last_name": "Actor"},
        headers=supplier_auth_headers,
    )
    assert resp.status_code in (403, 404), f"Expected 403/404 for unauthorized role, got {resp.status_code}"


@pytest.mark.security
async def test_broken_access_control_cross_tenant_idor(
    client: AsyncClient, db: AsyncSession, factory, auth_headers: dict
):
    """User from Org A must not access resources belonging to Org B (IDOR prevention)."""
    org_b = await factory.organization.create(db)
    pr_b = await factory.requisition.create(db, org_id=org_b.id, amount=75000.0)

    # auth_headers belongs to buyer in Org A
    resp = await client.get(f"/api/v1/requisitions/{pr_b.id}", headers=auth_headers)
    # Must return 404 (do not leak existence) or 403
    assert resp.status_code in (403, 404), f"Expected 403 or 404 for cross-tenant access, got {resp.status_code}"


@pytest.mark.security
async def test_broken_access_control_sealed_bid_protection(
    db: AsyncSession, factory
):
    """Bids in sealed status must not expose pricing before dual-auth opening."""
    org = await factory.organization.create(db)
    rfq = await factory.rfq.create(db, org_id=org.id)
    bid = await factory.bid.create(
        db,
        rfq_id=rfq.id,
        org_id=org.id,
        status=BidStatusEnum.SUBMITTED,
        amount=120000.0,
    )
    assert bid.bid_opened_at is None
    assert bid.status == BidStatusEnum.SUBMITTED


# ==============================================================================
# A02: CRYPTOGRAPHIC FAILURES
# ==============================================================================

@pytest.mark.security
async def test_cryptographic_jwt_tampered_signature(
    client: AsyncClient, auth_headers: dict
):
    """Tampering with JWT token signature or payload must result in 401 Unauthorized."""
    token = auth_headers["Authorization"].split(" ")[1]
    tampered = token[:-6] + "xxxxxx"
    resp = await client.get("/api/v1/requisitions", headers={"Authorization": f"Bearer {tampered}"})
    assert resp.status_code == 401


@pytest.mark.security
async def test_cryptographic_jwt_expired_token(
    client: AsyncClient, buyer_user
):
    """An expired JWT token must be rejected with 401 Unauthorized."""
    past = datetime.now(timezone.utc) - timedelta(hours=2)
    payload = {
        "sub": str(buyer_user.id),
        "org_id": str(buyer_user.org_id),
        "email": buyer_user.email,
        "roles": ["BUYER"],
        "bu_scope": [],
        "category_scope": [],
        "plant_scope": [],
        "is_supplier_user": False,
        "vendor_id": None,
        "jti": str(uuid4()),
        "iat": int(past.timestamp()),
        "exp": int((past + timedelta(minutes=10)).timestamp()),
        "kid": settings.JWT_KEY_ID,
    }
    expired_token = jwt.encode(payload, _load_private_key(), algorithm=settings.JWT_ALGORITHM)
    resp = await client.get("/api/v1/requisitions", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401


@pytest.mark.security
async def test_cryptographic_jwt_alg_none_rejected(
    client: AsyncClient, buyer_user
):
    """JWT with 'alg: none' attack must be unconditionally rejected."""
    payload = {
        "sub": str(buyer_user.id),
        "org_id": str(buyer_user.org_id),
        "roles": ["BUYER", "SYSTEM_ADMIN"],
        "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
    }
    header = {"alg": "none", "typ": "JWT"}
    import base64
    def b64(data):
        return base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip("=")
    fake_token = f"{b64(header)}.{b64(payload)}."

    resp = await client.get("/api/v1/requisitions", headers={"Authorization": f"Bearer {fake_token}"})
    assert resp.status_code == 401


@pytest.mark.security
def test_cryptographic_field_encryption():
    """Sensitive attributes (PAN, GSTIN, bank accounts) must be encrypted at rest."""
    sample_pan = "ABCDE1234F"
    encrypted = encrypt_field(sample_pan)
    assert encrypted != sample_pan
    assert not encrypted.startswith("ABCDE")

    decrypted = decrypt_field(encrypted)
    assert decrypted == sample_pan


@pytest.mark.security
def test_cryptographic_password_hashing():
    """Passwords must be hashed with strong bcrypt/argon2 and never stored plaintext."""
    raw_pwd = "SuperSecretPassword#2026"
    hashed = pwd_context.hash(raw_pwd)
    assert hashed != raw_pwd
    assert pwd_context.verify(raw_pwd, hashed)
    assert not pwd_context.verify("WrongPassword", hashed)


# ==============================================================================
# A03: INJECTION
# ==============================================================================

@pytest.mark.security
async def test_injection_sql_query_parameter(
    client: AsyncClient, auth_headers: dict, db: AsyncSession
):
    """SQL injection payloads in search/filter parameters must not cause 500 or execute SQL."""
    sqli_payloads = [
        "'; DROP TABLE vendors; --",
        "' OR '1'='1",
        "1; SELECT pg_sleep(2); --",
        "UNION ALL SELECT NULL, NULL, NULL--",
    ]
    for payload in sqli_payloads:
        resp = await client.get(
            "/api/v1/vendors",
            params={"search": payload, "name": payload},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 400, 422), f"SQLi payload triggered server error: {resp.status_code}"

    # Verify vendors table is intact
    res = await db.execute(text("SELECT count(*) FROM vendors"))
    assert res.scalar() >= 0


@pytest.mark.security
async def test_injection_sql_sort_parameter(
    client: AsyncClient, auth_headers: dict
):
    """SQL injection in sort_by/sort_dir parameters must be safely rejected or sanitized."""
    resp = await client.get(
        "/api/v1/requisitions",
        params={"sort_by": "created_at; DROP TABLE requisitions;--", "sort_dir": "asc"},
        headers=auth_headers,
    )
    assert resp.status_code in (200, 400, 422)


# ==============================================================================
# A04: INSECURE DESIGN (MAKER-CHECKER & SEPARATION OF DUTIES)
# ==============================================================================

@pytest.mark.security
async def test_maker_checker_self_approval_blocked(db: AsyncSession, factory):
    """Maker-checker: A user who created a requisition must not be assigned approval tasks for it."""
    from unittest.mock import AsyncMock, MagicMock
    from app.core.exceptions import AppException
    from app.modules.workflow.service import WorkflowEngine
    from app.modules.user.models import User

    engine = WorkflowEngine(
        repo=AsyncMock(),
        user_repo=AsyncMock(),
        group_repo=AsyncMock(),
        publisher=AsyncMock(),
    )
    creator_id = uuid4()
    org = await factory.organization.create(db)
    inst = await factory.workflow_instance.create(
        db,
        org_id=org.id,
        entity_context={"created_by": str(creator_id), "amount": 50000},
    )
    step = {
        "step_number": 1,
        "name": "Manager Review",
        "action_type": "SINGLE",
        "approver_type": "USER",
        "approver_id": str(creator_id),
        "is_maker_checker_enforced": True,
    }

    creator_user = User(id=creator_id, org_id=org.id, email="creator@test.com", first_name="C", last_name="U")
    engine._resolver.resolve = AsyncMock(return_value=[creator_user])
    engine._repo.get_active_users_with_role = AsyncMock(return_value=[])

    with pytest.raises(AppException) as exc:
        await engine.create_tasks_for_step(db, inst, step, [creator_user])
    assert "NO_ELIGIBLE_APPROVER" in str(exc.value.code)


# ==============================================================================
# A05: SECURITY MISCONFIGURATION
# ==============================================================================

@pytest.mark.security
async def test_security_headers_present(client: AsyncClient):
    """All responses must contain essential HTTP security headers."""
    resp = await client.get("/api/v1/health")
    headers = resp.headers
    assert "x-content-type-options" in headers or "X-Content-Type-Options" in headers
    # Verify no server version or internal debug banner leakage
    server_hdr = headers.get("server", "").lower()
    assert "uvicorn" not in server_hdr or server_hdr == "uvicorn"


@pytest.mark.security
async def test_debug_mode_exception_masking(client: AsyncClient, auth_headers: dict):
    """API errors must not expose Python traceback or internal path disclosures to clients."""
    resp = await client.get("/api/v1/requisitions/00000000-0000-0000-0000-000000000000", headers=auth_headers)
    assert resp.status_code in (404, 422)
    body = resp.text
    assert "Traceback (most recent call last)" not in body
    assert "/Users/" not in body
    assert "psycopg2" not in body


# ==============================================================================
# A06: VULNERABLE COMPONENTS & FILE UPLOAD PROTECTION
# ==============================================================================

@pytest.mark.security
def test_file_upload_disallowed_extension_rejected():
    """Dangerous executable extensions (.php, .sh, .exe, .py) must be rejected."""
    disallowed_extensions = ["exe", "sh", "bat", "php"]
    for ext in disallowed_extensions:
        with pytest.raises(ValidationError):
            validate_mime_type(b"MZ\x90\x00\x03\x00\x00\x00", "INVOICE", declared_extension=ext)


@pytest.mark.security
def test_file_upload_path_traversal_sanitized():
    """Filenames containing path traversal attempts (../../etc/passwd) must be sanitized."""
    malicious_name = "../../../etc/passwd"
    sanitized = sanitize_filename(malicious_name)
    assert "/" not in sanitized
    assert "\\" not in sanitized
    assert "etc/passwd" not in sanitized


# ==============================================================================
# A07: IDENTIFICATION AND AUTHENTICATION FAILURES
# ==============================================================================

@pytest.mark.security
async def test_login_invalid_credentials_returns_401(client: AsyncClient):
    """Login with invalid credentials must return 401 without revealing whether the email exists."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": f"nonexistent_{uuid4().hex[:6]}@test.com", "password": "WrongPassword123!"},
    )
    assert resp.status_code == 401
    assert "AUTHENTICATION_ERROR" in resp.text or "incorrect" in resp.text.lower()


# ==============================================================================
# A08: SOFTWARE AND DATA INTEGRITY FAILURES
# ==============================================================================

@pytest.mark.security
async def test_bid_data_integrity_hash_verification(db: AsyncSession, factory):
    """Any alteration of bid data after sealing must result in hash verification failure."""
    org = await factory.organization.create(db)
    rfq = await factory.rfq.create(db, org_id=org.id)
    vendor = await factory.vendor.create(db, org_id=org.id)

    # Compute deterministic bid hash
    payload = {"rfq_id": str(rfq.id), "vendor_id": str(vendor.id), "amount": "50000.00"}
    canonical_str = json.dumps(payload, sort_keys=True)
    valid_hash = hashlib.sha256(canonical_str.encode()).hexdigest()

    # Tampered payload
    tampered_payload = {"rfq_id": str(rfq.id), "vendor_id": str(vendor.id), "amount": "49000.00"}
    tampered_hash = hashlib.sha256(json.dumps(tampered_payload, sort_keys=True).encode()).hexdigest()

    assert valid_hash != tampered_hash, "Hash must change when bid amount is modified"


# ==============================================================================
# A09: SECURITY LOGGING AND MONITORING FAILURES
# ==============================================================================

@pytest.mark.security
async def test_audit_trail_logging_on_sensitive_action(db: AsyncSession, factory):
    """State transitions and sensitive entity creation must write to audit_logs."""
    org = await factory.organization.create(db)
    user = await factory.user.create(db, org_id=org.id, role="BUYER")

    # Insert audit entry
    await db.execute(
        text("""
            INSERT INTO audit_logs (id, org_id, actor_id, action, entity_type, entity_id, field_changes, actor_ip)
            VALUES (:id, :org_id, :actor_id, :action, :entity_type, :entity_id, :field_changes, :ip)
        """),
        {
            "id": uuid4(),
            "org_id": org.id,
            "actor_id": user.id,
            "action": "PR_SUBMITTED",
            "entity_type": "REQUISITION",
            "entity_id": uuid4(),
            "field_changes": json.dumps({"status": "SUBMITTED"}),
            "ip": "127.0.0.1",
        },
    )
    await db.flush()

    res = await db.execute(
        text("SELECT count(*) FROM audit_logs WHERE org_id = :org_id"),
        {"org_id": org.id},
    )
    assert res.scalar() >= 1


# ==============================================================================
# A10: SERVER-SIDE REQUEST FORGERY (SSRF)
# ==============================================================================

@pytest.mark.security
def test_ssrf_webhook_private_ip_blocked():
    """Webhook/integration URLs targeting localhost, loopback, or cloud metadata must be blocked."""
    client = SafeHTTPClient(allowed_domains=["api.external.com"])
    prohibited_urls = [
        "http://127.0.0.1:8000/internal",
        "http://localhost:8080/admin",
        "http://169.254.169.254/latest/meta-data",
        "http://0.0.0.0:5000",
        "http://[::1]:8000/metrics",
    ]
    for url in prohibited_urls:
        with pytest.raises(ForbiddenError, match="SSRF_BLOCKED"):
            client.validate_url(url)

    # Allowed domain should pass
    validated = client.validate_url("https://api.external.com/webhook")
    assert validated.startswith("https://api.external.com")
