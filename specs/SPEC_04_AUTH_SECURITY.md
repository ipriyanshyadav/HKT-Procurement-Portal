# SPEC_04_AUTH_SECURITY.md

## Title
Enterprise S2P Procurement Portal — Authentication, Authorization & Security

## Purpose
Define the complete authentication system, JWT lifecycle, MFA, SSO, RBAC permission model, segregation of duties enforcement, data encryption, and all security controls.

## Scope
Covers FastAPI auth middleware, JWT structure, refresh token flow, password policies, MFA (TOTP), brute-force protection, SAML 2.0/OIDC SSO, session management, full permission model with 100+ codes, RBAC matrix for all roles, SoD enforcement, Kong JWT plugin, field-level encryption, vulnerability controls, security headers, and auth event auditing.

## Dependencies
- SPEC_02_ARCHITECTURE.md (middleware stack, Kong configuration)
- SPEC_03_DATABASE.md (users, roles, permissions, user_sessions, user_mfa tables)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. FastAPI Auth Middleware Pipeline

Every authenticated request passes through this dependency chain in order:

```
Request → Kong JWT validation (gateway) → FastAPI RequestIDMiddleware
→ extract_jwt_from_header → validate_jwt_signature (RS256)
→ load_user_from_db → check_user_active → check_session_valid
→ check_inactivity_timeout → check_permission → check_scope
→ Route Handler
```

### 1.1 FastAPI Dependencies

```python
# app/auth/dependencies.py

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    token = extract_bearer_token(request)
    payload = decode_jwt(token)

    user = await user_repository.get_by_id(db, payload["sub"], payload["org_id"])
    if not user or user.status != UserStatus.ACTIVE:
        raise HTTPException(401, detail="User inactive or not found")

    session = await session_repository.get_by_jti(db, payload["jti"])
    if not session or session.is_revoked:
        raise HTTPException(401, detail="Session revoked")

    now = datetime.utcnow()
    inactivity_limit = timedelta(minutes=30)
    if (now - session.last_activity_at) > inactivity_limit:
        await session_repository.revoke(db, session.id, "INACTIVITY_TIMEOUT")
        raise HTTPException(401, detail="Session expired due to inactivity")

    await session_repository.update_activity(db, session.id, now)
    request.state.user = user
    request.state.org_id = payload["org_id"]
    return user

def require_permission(permission_code: str):
    async def check(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        has_perm = await permission_repository.user_has_permission(
            db, current_user.id, current_user.org_id, permission_code
        )
        if not has_perm:
            raise ForbiddenError("INSUFFICIENT_PERMISSION", f"Missing: {permission_code}")
        return current_user
    return check

def require_scope(bu_ids: list[UUID] = None, category_ids: list[UUID] = None):
    async def check(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        if bu_ids:
            user_bu_scope = await scope_repository.get_user_bu_scope(db, current_user.id, current_user.org_id)
            if not set(bu_ids).issubset(user_bu_scope):
                raise ForbiddenError("SCOPE_VIOLATION", "Entity outside your business unit scope")
        if category_ids:
            user_cat_scope = await scope_repository.get_user_category_scope(db, current_user.id, current_user.org_id)
            if not set(category_ids).issubset(user_cat_scope):
                raise ForbiddenError("SCOPE_VIOLATION", "Entity outside your category scope")
        return current_user
    return check
```

---

## 2. JWT Structure

### 2.1 Access Token Payload (RS256)

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "org_id": "660e8400-e29b-41d4-a716-446655440001",
  "email": "buyer@company.com",
  "roles": ["BUYER", "SOURCING_MANAGER"],
  "bu_scope": ["bu-uuid-1", "bu-uuid-2"],
  "category_scope": ["cat-uuid-1", "cat-uuid-3"],
  "plant_scope": ["plant-uuid-1"],
  "is_supplier_user": false,
  "vendor_id": null,
  "jti": "unique-token-id-abc123",
  "iat": 1719446400,
  "exp": 1719447300,
  "kid": "key-2026-06"
}
```

### 2.2 Key Management

- **Algorithm:** RS256 (RSA with SHA-256)
- **Key pair:** 2048-bit RSA; generated via `scripts/generate_rsa_keys.py`
- **Private key:** Stored in environment variable or vault; used by FastAPI to sign tokens
- **Public key:** Configured in Kong JWT consumer for gateway-level validation; shared with all services that need to verify tokens
- **Key rotation:** New key pair generated quarterly; old key ID (`kid`) remains valid for existing tokens until their natural expiry; new tokens use new `kid`

### 2.3 Token Lifetimes

| Token | Lifetime | Storage | Renewal |
|---|---|---|---|
| Access token | 15 minutes | Client memory (Authorization header) | Via refresh token |
| Refresh token | 8 hours | httpOnly, Secure, SameSite=Strict cookie | Rotation: old token revoked on use, new pair issued |

---

## 3. Refresh Token Flow

```
1. Client sends POST /api/v1/auth/refresh (refresh token in httpOnly cookie)
2. Server extracts refresh token from cookie
3. Validate refresh token signature (RS256)
4. Check refresh token JTI not in Redis blocklist (key: revoked:{jti})
5. Load user from DB; verify user.status == ACTIVE
6. Revoke current refresh token: SET revoked:{old_jti} in Redis with TTL = remaining expiry time
7. Generate new access token + new refresh token (new JTI)
8. Create new user_session record
9. Return new access token in response body
10. Set new refresh token as httpOnly cookie
```

**Token rotation:** Every refresh operation issues a new refresh token and revokes the old one. If an old refresh token is reused (detected via Redis blocklist), all sessions for that user are revoked as a security precaution (potential token theft).

---

## 4. Password Policy

Enforced in `app/core/security.py`:

| Rule | Implementation |
|---|---|
| Minimum length | 12 characters |
| Complexity | At least 1 uppercase, 1 lowercase, 1 digit, 1 special character. Regex: `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\#^()_+=\-]).{12,}$` |
| Hash algorithm | bcrypt with cost factor 12 |
| History | Last 5 passwords stored (hashed) in `password_history` table; new password compared against all 5 |
| Expiry | 90 days; enforced via `password_changed_at` check on login |
| Common password check | Checked against a list of 10,000 common passwords at registration and change time |

```python
# app/core/security.py

from passlib.context import CryptContext
import re

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

PASSWORD_REGEX = re.compile(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-]).{12,}$'
)

def validate_password_strength(password: str) -> bool:
    return bool(PASSWORD_REGEX.match(password))

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

async def check_password_history(db: AsyncSession, user_id: UUID, org_id: UUID, new_password: str) -> bool:
    last_5 = await password_history_repo.get_recent(db, user_id, org_id, limit=5)
    for old_hash in last_5:
        if verify_password(new_password, old_hash.password_hash):
            return False  # Password was used recently
    return True
```

---

## 5. Multi-Factor Authentication (MFA)

### 5.1 TOTP Implementation

Library: `pyotp`

```python
# app/auth/mfa.py

import pyotp

def generate_totp_secret() -> str:
    return pyotp.random_base32()

def generate_totp_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="S2P Procurement Portal")

def verify_totp(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)

def generate_backup_codes(count: int = 10) -> list[str]:
    import secrets
    return [secrets.token_hex(4).upper() for _ in range(count)]
```

### 5.2 MFA Enforcement Rules

| Role | MFA Requirement |
|---|---|
| `APPROVER` | Mandatory |
| `PROCUREMENT_HEAD` | Mandatory |
| `CFO` | Mandatory |
| `COMPLIANCE_OFFICER` | Mandatory |
| `VENDOR_ADMIN` | Mandatory |
| `PROCUREMENT_ADMIN` | Mandatory |
| `SOURCING_MANAGER` | Mandatory |
| `FINANCE_CONTROLLER` | Mandatory |
| All other internal roles | Optional (user can enable) |
| All supplier roles | Optional |

### 5.3 MFA Login Flow

```
1. User submits email + password → POST /api/v1/auth/login
2. If credentials valid AND user has MFA enabled:
   a. Return 200 with { "mfa_required": true, "mfa_token": "<short-lived-token>" }
   b. mfa_token is a JWT with 5-minute expiry, containing user_id only (no roles/permissions)
3. User submits TOTP code → POST /api/v1/auth/mfa/verify with mfa_token + code
4. If TOTP valid → issue full access token + refresh token
5. If TOTP invalid → increment attempt counter; lock after 5 failures
```

### 5.4 Backup Codes

- 10 single-use backup codes generated at MFA enrollment
- Stored as bcrypt hashes in `user_mfa.backup_codes_hashed` array
- Each code removed from array after successful use
- User can regenerate codes (invalidates all existing codes; audit logged)

---

## 6. Brute-Force Protection

### 6.1 Application Layer (Redis)

```python
# On login failure:
key = f"failed_login:{email}"
count = await redis.incr(key)
if count == 1:
    await redis.expire(key, 1800)  # 30-minute window

if count >= 3:
    # Require CAPTCHA on subsequent attempts
    # Return 200 with captcha_required: true

if count >= 5:
    # Lock account
    await user_repository.lock_user(db, user_id, locked_until=utcnow() + timedelta(minutes=30))
    # Publish audit event: account_locked
    # Send email notification to user
    raise AppException("ACCOUNT_LOCKED", "Account locked due to multiple failed attempts", 423)
```

### 6.2 Kong Layer (Second Defense)

Kong rate limiting plugin on `/api/v1/auth/login`:
- 5 requests per minute per IP address
- Returns 429 with `Retry-After` header

---

## 7. SSO Integration

### 7.1 SAML 2.0 (SP-Initiated)

Library: `python3-saml`

```python
# app/auth/sso.py

# SP-initiated flow:
# GET /api/v1/auth/sso/initiate?provider=company-idp
#   → Build AuthnRequest → Redirect to IDP SSO URL

# POST /api/v1/auth/sso/callback
#   → Receive SAML Response → Validate assertion signature + conditions
#   → Extract attributes: email, first_name, last_name, employee_id, department
#   → JIT provision: if user doesn't exist, create with default role (REQUESTOR)
#   → If user exists, update non-critical fields from SAML attributes
#   → Issue access token + refresh token
```

**SAML Configuration:**
- SP Entity ID: `https://procurement.example.com/saml/metadata`
- SP ACS URL: `https://procurement.example.com/api/v1/auth/sso/callback`
- IDP Metadata URL: Configured per tenant in `tenant_settings`
- Certificate: IDP signing certificate stored in `tenant_settings`; validated on every assertion
- Attribute mapping stored in `tenant_settings`:

```json
{
  "saml_attribute_map": {
    "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "first_name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
    "last_name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
    "employee_id": "urn:oid:0.9.2342.19200300.100.1.1",
    "department": "urn:oid:2.5.4.11"
  }
}
```

### 7.2 OIDC

Library: `authlib`

```python
# GET /api/v1/auth/sso/oidc/initiate?provider=azure-ad
#   → Build authorization URL with scopes: openid, profile, email
#   → Redirect to IDP authorization endpoint

# GET /api/v1/auth/sso/oidc/callback?code=...&state=...
#   → Exchange code for tokens at IDP token endpoint
#   → Validate ID token signature (JWK from IDP)
#   → Extract claims: email, name, sub
#   → JIT provision or login existing user
#   → Issue portal access token + refresh token
```

### 7.3 JIT Provisioning

On first SSO login, if user email does not exist in the portal:
1. Create user with `status = ACTIVE`, `sso_provider = "{provider}"`, `sso_subject_id = "{sub}"`
2. Assign default role: `REQUESTOR`
3. Set `password_hash = NULL` (SSO users cannot use password login)
4. Publish `user.created.sso` audit event
5. Send welcome notification

---

## 8. Session Management

| Parameter | Value |
|---|---|
| Access token lifetime | 15 minutes |
| Refresh token lifetime | 8 hours |
| Inactivity timeout | 30 minutes (sliding window tracked in Redis) |
| Max concurrent sessions per user | 5 (oldest session revoked when exceeded) |

### 8.1 HRMS Termination Handling

When `UserService.process_hrms_event(event)` receives a `TERMINATE` event:
1. Set `user.status = TERMINATED`
2. Revoke all active sessions (set `is_revoked = TRUE` on all `user_sessions`)
3. Add all active JTIs to Redis revocation blocklist
4. Cancel all pending workflow tasks assigned to this user
5. Reassign open tasks to backup approver or Procurement Admin
6. Publish `user.terminated` audit event
7. Send notification to admin

### 8.2 Forced Logout

Triggered by:
- HRMS termination event
- Admin manual action (`POST /api/v1/admin/users/{user_id}/force-logout`)
- Password change (all other sessions revoked)
- Security incident (bulk session revocation)

---

## 9. Permission Model

### 9.1 Permission Code Inventory

Organized by module. Every code follows the pattern `{module}.{action}`:

**Purchase Requisition:**
`pr.create`, `pr.view_own`, `pr.view_bu`, `pr.view_all`, `pr.update_own`, `pr.submit`, `pr.approve`, `pr.reject`, `pr.withdraw`, `pr.merge`, `pr.split`, `pr.amend`

**RFQ / Sourcing:**
`rfq.create`, `rfq.view_own`, `rfq.view_bu`, `rfq.view_all`, `rfq.update`, `rfq.submit`, `rfq.approve`, `rfq.publish`, `rfq.amend`, `rfq.cancel`, `rfq.add_bidders`, `rfq.manage_clarifications`, `rfq.open_bids`, `rfq.co_authorize_opening`, `rfq.view_bids_before_opening` (HARDCODED FALSE — never granted to any role), `rfq.view_bids_after_opening`

**Bid:**
`bid.submit`, `bid.view_own`, `bid.reopen`, `bid.withdraw`

**Evaluation:**
`eval.assign_evaluators`, `eval.submit_technical_scores`, `eval.view_technical_scores`, `eval.generate_cs`, `eval.view_cs`, `eval.approve_cs`

**Award:**
`award.create_arn`, `award.view_arn`, `award.approve_arn`, `award.notify_vendors`

**Contract:**
`contract.create`, `contract.view_own`, `contract.view_bu`, `contract.view_all`, `contract.update`, `contract.submit`, `contract.approve`, `contract.legal_review`, `contract.send_for_signature`, `contract.amend`, `contract.terminate`

**Purchase Order:**
`po.create`, `po.view_own`, `po.view_bu`, `po.view_all`, `po.update`, `po.submit`, `po.approve`, `po.release`, `po.amend`, `po.cancel`, `po.acknowledge` (supplier)

**GRN / SES:**
`grn.create`, `grn.view`, `grn.approve`, `ses.create`, `ses.view`, `ses.approve`, `qc.inspect`, `qc.view`

**Invoice:**
`invoice.create` (supplier), `invoice.view_own`, `invoice.view_bu`, `invoice.view_all`, `invoice.approve`, `invoice.dispute`, `invoice.resolve_dispute`, `invoice.create_credit_note`, `invoice.create_debit_note`

**Payment:**
`payment.view_own`, `payment.view_all`, `payment.record`, `payment.dispute`

**Vendor:**
`vendor.invite`, `vendor.view`, `vendor.view_all`, `vendor.approve_qualification`, `vendor.reject_qualification`, `vendor.request_resubmission`, `vendor.activate`, `vendor.suspend`, `vendor.reinstate`, `vendor.blacklist` (requires COMPLIANCE_OFFICER + PROCUREMENT_HEAD), `vendor.view_bank_details`, `vendor.manage_scorecard`

**Workflow:**
`workflow.view_own_tasks`, `workflow.view_all_tasks`, `workflow.force_advance` (admin only), `workflow.pause`, `workflow.resume`, `workflow.cancel`, `workflow.simulate`

**Approval Rules:**
`rules.view`, `rules.create`, `rules.update`, `rules.activate`, `rules.deactivate`, `rules.simulate`

**Master Data:**
`master.category.create`, `master.category.update`, `master.category.deactivate`, `master.uom.create`, `master.uom.update`, `master.currency.create`, `master.currency.update`, `master.payment_terms.create`, `master.payment_terms.update`, `master.incoterms.create`, `master.incoterms.update`, `master.tax_codes.create`, `master.tax_codes.update`, `master.delivery_locations.create`, `master.delivery_locations.update`, `master.document_types.create`, `master.document_types.update`, `master.supplier_categories.create`, `master.supplier_categories.update`

**User Management:**
`user.create`, `user.view`, `user.update`, `user.deactivate`, `user.assign_role`, `user.manage_scope`, `user.force_logout`, `user.manage_delegation`

**Document:**
`document.upload`, `document.view`, `document.download`, `document.delete`

**Notification:**
`notification.manage_templates`, `notification.view_logs`

**Integration:**
`integration.view_jobs`, `integration.retry_job`, `integration.manage_adapters`

**Analytics:**
`analytics.view_dashboards`, `analytics.view_spend`, `analytics.view_compliance`, `analytics.create_reports`, `analytics.export`

**Admin:**
`admin.manage_settings`, `admin.manage_feature_flags`, `admin.view_audit_logs`, `admin.manage_scheduled_jobs`, `admin.system_info`

**Audit:**
`audit.view_own`, `audit.view_all`, `audit.export`

---

### 9.2 Full RBAC Matrix

#### Internal Roles

| Permission | REQUESTOR | BUYER | SOURCING_MGR | CATEGORY_MGR | PROC_HEAD | FINANCE_CTRL | LEGAL | COMPLIANCE | VENDOR_ADMIN | AUDIT_USER | PROC_ADMIN |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `pr.create` | Y | Y | Y | Y | Y | — | — | — | — | — | Y |
| `pr.view_own` | Y | Y | Y | Y | Y | Y | — | Y | — | Y | Y |
| `pr.view_bu` | — | Y | Y | Y | Y | Y | — | Y | — | Y | Y |
| `pr.view_all` | — | — | — | Y | Y | Y | — | Y | — | Y | Y |
| `pr.submit` | Y | Y | Y | Y | Y | — | — | — | — | — | Y |
| `pr.approve` | — | Y | Y | Y | Y | — | — | — | — | — | Y |
| `rfq.create` | — | Y | Y | Y | Y | — | — | — | — | — | Y |
| `rfq.approve` | — | — | Y | Y | Y | — | — | — | — | — | Y |
| `rfq.publish` | — | Y | Y | Y | Y | — | — | — | — | — | Y |
| `rfq.open_bids` | — | Y | Y | Y | Y | — | — | — | — | — | Y |
| `rfq.view_bids_before_opening` | — | — | — | — | — | — | — | — | — | — | — |
| `rfq.view_bids_after_opening` | — | Y | Y | Y | Y | — | — | Y | — | Y | Y |
| `eval.generate_cs` | — | Y | Y | Y | — | — | — | — | — | — | Y |
| `eval.approve_cs` | — | — | Y | Y | Y | — | — | — | — | — | Y |
| `award.approve_arn` | — | — | Y | Y | Y | Y | — | — | — | — | Y |
| `contract.approve` | — | — | Y | Y | Y | Y | Y | — | — | — | Y |
| `contract.legal_review` | — | — | — | — | — | — | Y | — | — | — | — |
| `po.approve` | — | Y | Y | Y | Y | — | — | — | — | — | Y |
| `po.release` | — | Y | Y | Y | Y | — | — | — | — | — | Y |
| `invoice.approve` | — | — | — | — | — | Y | — | — | — | — | Y |
| `vendor.invite` | — | Y | Y | Y | Y | — | — | — | Y | — | Y |
| `vendor.approve_qualification` | — | — | — | Y | Y | — | — | — | Y | — | Y |
| `vendor.blacklist` | — | — | — | — | Y | — | — | Y | — | — | — |
| `vendor.activate` | — | — | — | — | — | — | — | — | Y | — | Y |
| `workflow.force_advance` | — | — | — | — | — | — | — | — | — | — | Y |
| `audit.view_all` | — | — | — | — | Y | — | — | Y | — | Y | Y |
| `admin.manage_settings` | — | — | — | — | — | — | — | — | — | — | Y |
| `analytics.view_spend` | — | Y | Y | Y | Y | Y | — | Y | — | Y | Y |

#### Supplier Roles

| Permission | SUPPLIER_ADMIN | SUPPLIER_BID_SUBMITTER | SUPPLIER_FINANCE_USER | SUPPLIER_VIEWER |
|---|---|---|---|---|
| `bid.submit` | Y | Y | — | — |
| `bid.view_own` | Y | Y | Y | Y |
| `bid.reopen` | Y | Y | — | — |
| `po.acknowledge` | Y | — | — | — |
| `invoice.create` | Y | — | Y | — |
| `payment.view_own` | Y | — | Y | Y |
| `document.upload` | Y | Y | Y | — |
| `vendor.view` (own profile) | Y | Y | Y | Y |

---

## 10. Segregation of Duties (SoD) Enforcement

### 10.1 DB Constraint

```sql
-- On workflow_tasks table
ALTER TABLE workflow_tasks ADD CONSTRAINT chk_maker_checker
    CHECK (
        -- This is enforced at application layer using entity creator context
        -- DB constraint prevents assignment to same user as entity creator
        TRUE -- Actual enforcement in WorkflowEngine.create_tasks_for_step()
    );
```

### 10.2 API Layer Enforcement

```python
# app/modules/workflow/service.py — WorkflowEngine.create_tasks_for_step()

async def create_tasks_for_step(self, instance, step, entity_context):
    approvers = await self.resolve_approvers(step.resolver, step.resolver_config, entity_context)
    entity_creator_id = entity_context.get("created_by")
    entity_submitter_id = entity_context.get("submitted_by")

    eligible_approvers = [
        a for a in approvers
        if a.id != entity_creator_id and a.id != entity_submitter_id
    ]

    if not eligible_approvers:
        # Escalate to next level or Procurement Admin
        eligible_approvers = await self.get_escalation_approvers(instance, step)

    if not eligible_approvers:
        raise AppException("NO_ELIGIBLE_APPROVER", "Maker-checker: no eligible approver found after escalation")

    # Create task for first eligible approver (or all in parallel step)
    ...
```

### 10.3 Vendor Blacklisting Dual-Approval

Blacklisting requires exactly two different roles acting in sequence:
1. `COMPLIANCE_OFFICER` initiates blacklist request
2. `PROCUREMENT_HEAD` confirms in a separate session
3. Both user IDs stored in `vendors.blacklist_initiated_by` and `vendors.blacklist_confirmed_by`
4. API enforces `blacklist_initiated_by != blacklist_confirmed_by`

---

## 11. Kong JWT Plugin Configuration

```yaml
# In kong.yml — applied to procurement-api service
plugins:
  - name: jwt
    config:
      key_claim_name: kid
      claims_to_verify:
        - exp
      header_names:
        - Authorization
      secret_is_base64: false
      run_on_preflight: true

consumers:
  - username: procurement-api
    jwt_secrets:
      - key: "key-2026-06"
        algorithm: RS256
        rsa_public_key: |
          -----BEGIN PUBLIC KEY-----
          ... (RSA public key content) ...
          -----END PUBLIC KEY-----
```

Kong validates the JWT signature and expiry at the gateway level. If validation fails, Kong returns 401 before the request reaches FastAPI. Kong injects the following upstream headers:
- `X-Consumer-ID`
- `X-Consumer-Username`
- `X-Credential-Identifier`

---

## 12. Data Encryption

### 12.1 Field-Level Encryption (PII)

Library: `cryptography.fernet`

```python
# app/core/encryption.py

from cryptography.fernet import Fernet

# Key loaded from environment variable or vault
ENCRYPTION_KEY = settings.FIELD_ENCRYPTION_KEY  # 32-byte URL-safe base64-encoded key

fernet = Fernet(ENCRYPTION_KEY)

def encrypt_field(value: str) -> str:
    return fernet.encrypt(value.encode()).decode()

def decrypt_field(encrypted_value: str) -> str:
    return fernet.decrypt(encrypted_value.encode()).decode()
```

**Encrypted fields:**
- `vendor_bank_accounts.account_number_encrypted`
- `vendors.pan_encrypted`
- `vendors.gstin_encrypted`
- `user_mfa.totp_secret_encrypted`

### 12.2 At-Rest Encryption

- **PostgreSQL:** Disk-level encryption (LUKS or cloud provider encryption)
- **MinIO:** Server-side encryption (SSE-S3) with AES-256; all buckets configured with auto-encryption
- **Redis:** Encrypted at rest via disk encryption; sensitive data (session tokens) stored as hashes

### 12.3 In-Transit Encryption

- **External:** TLS 1.3 enforced on Kong for all client connections
- **Internal:** TLS between all services within K3s (mTLS via service mesh or K3s built-in)
- **Database:** `sslmode=require` in PostgreSQL connection string

---

## 13. Vulnerability Controls

### 13.1 SQL Injection Prevention
- All database queries use SQLAlchemy ORM with parameterized queries
- No raw SQL string concatenation anywhere in the codebase
- Code review checklist includes SQL injection verification

### 13.2 XSS Prevention
- Pydantic v2 output serialization sanitizes all string fields
- CSP header prevents inline scripts
- React (Next.js) auto-escapes all rendered content
- `httpOnly` cookies prevent JavaScript access to tokens

### 13.3 SSRF Prevention
- Outbound HTTP calls (`httpx`) restricted to allowlisted domains
- Allowlist stored in `tenant_settings`: ERP endpoints, GST API, NSDL API, eSign provider, email/SMS providers
- Private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x) blocked in outbound URL validation

### 13.4 File Upload Validation
```python
# app/modules/document/scanner.py

import magic

ALLOWED_MAGIC_BYTES = {
    "application/pdf": b"%PDF",
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": b"PK\x03\x04",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": b"PK\x03\x04",
}

async def validate_file(file_content: bytes, declared_content_type: str) -> bool:
    detected_type = magic.from_buffer(file_content[:2048], mime=True)
    if detected_type != declared_content_type:
        raise AppException("FILE_TYPE_MISMATCH", f"Declared: {declared_content_type}, Detected: {detected_type}")
    return True
```

### 13.5 Path Traversal Prevention
MinIO object keys are constructed server-side using UUID components only:
```python
key = f"{bucket}/{org_id}/{entity_type}/{entity_id}/{uuid4()}/{sanitize_filename(original_name)}"
```
`sanitize_filename()` strips `..`, `/`, `\`, and null bytes.

---

## 14. Security Headers Middleware

```python
# app/core/middleware.py

class SecurityHeadersMiddleware:
    async def __call__(self, request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; font-src 'self'; connect-src 'self'; "
            "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        )
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["X-XSS-Protection"] = "0"  # Disabled in favor of CSP
        return response
```

---

## 15. Auth Event Auditing

Every authentication and authorization event generates an immutable audit log entry:

| Event | Audit Action | Fields Logged |
|---|---|---|
| Successful login | `AUTH_LOGIN_SUCCESS` | user_id, email, ip, user_agent, method (password/sso/mfa) |
| Failed login | `AUTH_LOGIN_FAILURE` | email, ip, user_agent, failure_reason (wrong_password, user_not_found, account_locked, mfa_failed) |
| Token refresh | `AUTH_TOKEN_REFRESH` | user_id, old_jti, new_jti, ip |
| Logout | `AUTH_LOGOUT` | user_id, jti, method (manual/forced/timeout) |
| MFA enabled | `AUTH_MFA_ENABLED` | user_id, method (totp) |
| MFA disabled | `AUTH_MFA_DISABLED` | user_id, disabled_by |
| Password change | `AUTH_PASSWORD_CHANGE` | user_id, changed_by (self/admin/hrms) |
| Password reset | `AUTH_PASSWORD_RESET` | user_id, reset_method (email_link/admin) |
| Account locked | `AUTH_ACCOUNT_LOCKED` | user_id, email, failed_attempts, locked_until |
| Account unlocked | `AUTH_ACCOUNT_UNLOCKED` | user_id, unlocked_by |
| Role assigned | `AUTH_ROLE_ASSIGNED` | user_id, role_code, assigned_by |
| Role removed | `AUTH_ROLE_REMOVED` | user_id, role_code, removed_by |
| Permission changed | `AUTH_PERMISSION_CHANGED` | role_id, permission_code, action (grant/revoke), changed_by |
| Session revoked | `AUTH_SESSION_REVOKED` | user_id, jti, reason, revoked_by |
| SSO login | `AUTH_SSO_LOGIN` | user_id, provider, subject_id, is_jit_provisioned |
| Scope changed | `AUTH_SCOPE_CHANGED` | user_id, scope_type (bu/category/plant), action (add/remove), value, changed_by |
