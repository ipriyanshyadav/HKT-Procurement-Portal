# IMPLEMENTATION PLAN — SPEC_27: Portal Enhancements (10 Modules)
**Module:** 27 | **Phase:** Enhancement | **Squad:** A+B+C+D+E
**Plan Date:** 2026-08-04

---
## SESSION BOOTSTRAP
- [x] GEMINI.md read; all ABSOLUTE RULES apply
- [x] Graphify loaded — SPEC_01–26 all implemented
- [x] README Current Session State reviewed
- [x] SPEC_27 fully analyzed (10 modules, A through J)

---
## ASSUMPTIONS LOG

| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-27-1 | Company Switcher: after org switch, client does full `window.location.reload()` to clear all TanStack Query cache; no partial cache invalidation | Cross-org data must never bleed | HIGH | FE Lead |
| A-27-2 | Cross-Company Reports use `SET LOCAL row_security = OFF` on a dedicated superuser DB role (not `SET ROLE`) to bypass RLS | PostgreSQL RLS bypass requires superuser or BYPASSRLS attribute | HIGH | Squad A |
| A-27-3 | `is_platform_admin` column added to `users` table; cannot be set via any API (migration only, no endpoint) | Platform admin is system-level privilege | HIGH | Squad A |
| A-27-4 | Webhook endpoint URLs must be HTTPS in production; HTTP allowed only when `settings.ENVIRONMENT != "production"` | Security; SSRF risk on HTTP callbacks | HIGH | Squad E |
| A-27-5 | API key raw value shown ONLY in POST /api-keys response body and POST .../rotate-secret response; never stored in DB (SHA-256 hash only) | Plaintext key storage is critical vulnerability | HIGH | Squad A |
| A-27-6 | Export Center uses a dedicated Celery queue `celery.exports` separate from `celery.maintenance` to avoid blocking maintenance tasks | Large exports can take minutes | MEDIUM | Squad E |
| A-27-7 | Branding colors validated for WCAG AA contrast ratio at service layer before save; reject if contrast < 4.5:1 for normal text | Accessibility requirement | MEDIUM | Squad B |
| A-27-8 | UAT/QA role: `is_test_record=TRUE` entities excluded from all reports/analytics by default; opt-in via `include_test=true` query param | Prevents test data polluting real reports | MEDIUM | Squad C |
| A-27-9 | Payment gateway webhook endpoints (`/api/v1/webhooks/gateway/razorpay` and `/stripe`) are PUBLIC (no JWT auth); verify by HMAC signature only | Gateway cannot send JWT | HIGH | Squad D |
| A-27-10 | Onboarding session persisted in DB (not client-side only); survives browser close/reopen | Users often interrupt onboarding | LOW | Squad B |
| A-27-11 | Razorpay primary for INR transactions; Stripe for non-INR; selection based on invoice currency NOT manual choice | Auto-routing by currency | MEDIUM | Squad D |

---
## MIGRATIONS REQUIRED (in order)

```
0035_company_switcher.py         → user_org_memberships, org_switch_audit tables; primary_org_id on users
0036_onboarding.py               → onboarding_sessions table
0037_platform_admin.py           → users.is_platform_admin BOOL DEFAULT FALSE
0038_webhook_endpoints.py        → webhook_endpoints, webhook_deliveries tables
0039_api_keys.py                 → api_keys table; api_key_usage_log (partitioned monthly)
0040_export_jobs.py              → export_jobs table
0041_payment_gateway.py          → payment_gateway_config table; alter payment_records (add gateway columns)
0042_test_records.py             → is_test_record BOOL DEFAULT FALSE on: requisitions, rfqs, bid_responses, purchase_orders, invoices, tickets, vendors
0043_new_permissions.py          → new permissions: switcher.switch_org, report.cross_company, webhook.manage, api_key.manage, export.create, payment.initiate, payment.refund, qa.access_test_mode
0044_new_indexes.py              → all CONCURRENTLY indexes for new tables
0045_new_sequences.py            → sequences for new ticket numbering if needed
```

---
## STEP 2 — IMPLEMENT (ordered by dependency)

### PRIORITY 1: Infrastructure (no UI dependencies)

#### 27-A: Company Switcher — Backend
**File:** `app/modules/organization/service.py` — add `switch_org()` method:
```python
async def switch_org(self, db, target_org_id: UUID, actor_id: UUID, current_org_id: UUID,
                      current_jti: str, ip: str) -> LoginResult:
    # 1. Verify membership
    membership = await self.membership_repo.get(db, actor_id, target_org_id)
    if not membership or membership.status != "ACTIVE":
        raise ForbiddenError("NOT_ORG_MEMBER", "You are not a member of this organization")
    # 2. Rate limit: max 10 switches per hour
    switch_count_key = f"org_switches:{actor_id}"
    count = await self.redis.incr(switch_count_key)
    if count == 1:
        await self.redis.expire(switch_count_key, 3600)
    if count > 10:
        raise AppException("SWITCH_RATE_LIMIT", "Too many org switches. Try again in an hour.", 429)
    # 3. Revoke current session
    await self.session_repo.revoke_by_jti(db, current_jti, "ORG_SWITCH")
    # 4. Log audit (immutable)
    db.add(OrgSwitchAudit(user_id=actor_id, from_org_id=current_org_id,
        to_org_id=target_org_id, ip_address=ip, previous_jti=current_jti))
    # 5. Issue new tokens for target org
    user = await self.user_repo.get_by_id(db, actor_id, target_org_id)
    result = await self.auth_service._issue_tokens(db, user, target_org_id)
    await self.audit.log(db, "USER", actor_id, "AUTH_ORG_SWITCHED", actor_id, current_org_id,
        new_values={"to_org_id": str(target_org_id)})
    return result
```

**New endpoint in `app/auth/router.py`:**
```python
@router.get("/my-orgs")
async def get_my_orgs(current_user = Depends(get_current_user), db = Depends(get_db)):
    memberships = await membership_repo.get_all_for_user(db, current_user.id)
    return success_response([{
        "org_id": str(m.org_id), "org_name": m.org.name, "logo_url": m.org.logo_url,
        "roles": m.role_in_org, "is_current": m.org_id == current_user.org_id,
        "is_primary": m.is_primary_org,
    } for m in memberships])

@router.post("/switch-org")
async def switch_org(data: SwitchOrgRequest, request: Request,
    current_user = Depends(get_current_user), db = Depends(get_db)):
    payload = decode_jwt(request.headers.get("Authorization", "").replace("Bearer ", ""))
    result = await org_service.switch_org(db, data.org_id, current_user.id,
        current_user.org_id, payload["jti"], request.client.host)
    response = JSONResponse(content={"access_token": result.access_token,
        "message": "Organization switched successfully"})
    response.set_cookie("refresh_token", result.refresh_token, httponly=True,
        secure=True, samesite="strict")
    return response
```

**Frontend — Admin Portal Navbar `OrgSwitcher` component:**
```tsx
// Show in ALL 3 portals (not just admin) — users can belong to multiple orgs
// Current org pill with logo thumbnail + org name
// Dropdown: list of orgs from GET /api/v1/auth/my-orgs
// Click "Switch" → POST /api/v1/auth/switch-org → on 200: window.location.reload()
// Loading state: spinner overlay during switch
// Error toast: "Unable to switch organization"
```

#### 27-D: Webhook Management — Backend
**File:** `app/modules/integration/webhook_service.py`:
```python
class WebhookManagementService:

    async def create(self, db, data: WebhookCreateRequest, actor_id: UUID, org_id: UUID) -> WebhookEndpoint:
        # Validate URL: HTTPS in production
        if settings.ENVIRONMENT == "production" and not data.url.startswith("https://"):
            raise ValidationError("WEBHOOK_URL_MUST_BE_HTTPS", "Webhook URL must use HTTPS in production")
        # SSRF check: URL must be in org's allowed domains (or bypass if no allowlist set)
        await self._check_ssrf(data.url, org_id)
        # Generate secret (raw) — stored as SHA-256 hash
        raw_secret = secrets.token_urlsafe(32)
        secret_hash = hashlib.sha256(raw_secret.encode()).hexdigest()
        webhook = WebhookEndpoint(
            org_id=org_id, name=data.name, url=data.url,
            secret=secret_hash, secret_hint=raw_secret[-4:],
            subscribed_events=data.events, max_retries=data.max_retries or 5,
            retry_delay_seconds=data.retry_delay_seconds or 60,
            timeout_seconds=data.timeout_seconds or 30,
            ip_allowlist=data.ip_allowlist or [],
            custom_headers=self._encrypt_headers(data.custom_headers or {}),
        )
        db.add(webhook)
        await self.audit.log(db, "WEBHOOK", webhook.id, "WEBHOOK_CREATED", actor_id, org_id,
            new_values={"name": data.name, "url": data.url, "events": data.events})
        # Return raw secret ONCE — caller must save it
        return webhook, raw_secret

    async def rotate_secret(self, db, webhook_id: UUID, actor_id: UUID, org_id: UUID) -> tuple:
        webhook = await self.repo.get(db, webhook_id, org_id)
        raw_secret = secrets.token_urlsafe(32)
        webhook.secret = hashlib.sha256(raw_secret.encode()).hexdigest()
        webhook.secret_hint = raw_secret[-4:]
        await self.audit.log(db, "WEBHOOK", webhook_id, "WEBHOOK_SECRET_ROTATED", actor_id, org_id)
        return webhook, raw_secret  # raw_secret returned ONCE

    async def test_delivery(self, db, webhook_id: UUID, actor_id: UUID, org_id: UUID) -> dict:
        webhook = await self.repo.get(db, webhook_id, org_id)
        test_payload = {
            "event": "webhook.test", "timestamp": datetime.utcnow().isoformat(),
            "org_id": str(org_id), "message": "This is a test delivery from ProcureOS"
        }
        raw_secret = webhook.secret  # We have the hash; use it for HMAC? No — need raw.
        # For test: use a test HMAC with known test secret
        delivery_svc = WebhookDeliveryService()
        success = await delivery_svc.deliver(webhook.url, "webhook_test", test_payload, "webhook.test")
        return {"success": success, "url": webhook.url, "timestamp": datetime.utcnow().isoformat()}
```

**File:** `app/modules/integration/router.py` — add webhook management endpoints (10 endpoints per SPEC_27-D).

#### 27-E: API Key Management — Backend
**File:** `app/modules/integration/api_key_service.py`:
```python
class APIKeyService:

    API_KEY_PREFIX = "prc"

    async def create(self, db, data: APIKeyCreateRequest, actor_id: UUID, org_id: UUID) -> tuple:
        env = "live" if settings.ENVIRONMENT == "production" else "test"
        raw_key = f"{self.API_KEY_PREFIX}_{env}_{''.join(secrets.choice('abcdefghijklmnopqrstuvwxyz0123456789') for _ in range(32))}"
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        key_prefix = raw_key[:12]  # prc_live_a1b2
        api_key = APIKey(
            org_id=org_id, name=data.name, key_hash=key_hash, key_prefix=key_prefix,
            key_type=env.upper(), scopes=data.scopes,
            rate_limit_tier=data.rate_limit_tier or "STANDARD",
            expires_at=data.expires_at, created_by=actor_id,
        )
        db.add(api_key)
        await self.audit.log(db, "API_KEY", api_key.id, "API_KEY_CREATED", actor_id, org_id,
            new_values={"name": data.name, "scopes": data.scopes, "prefix": key_prefix})
        return api_key, raw_key  # raw_key returned ONCE

    async def authenticate(self, db, raw_key: str) -> Optional[APIKey]:
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        api_key = await self.repo.get_by_hash(db, key_hash)
        if not api_key or not api_key.is_active:
            return None
        if api_key.expires_at and api_key.expires_at < datetime.utcnow():
            return None
        api_key.last_used_at = datetime.utcnow()
        api_key.total_requests += 1
        return api_key

    async def revoke(self, db, key_id: UUID, actor_id: UUID, org_id: UUID) -> None:
        key = await self.repo.get(db, key_id, org_id)
        key.is_active = False
        key.deleted_at = datetime.utcnow()
        # Add to Redis revoked set for instant invalidation
        await self.redis.sadd(f"revoked_api_keys", key.key_hash)
        await self.audit.log(db, "API_KEY", key_id, "API_KEY_REVOKED", actor_id, org_id)
```

**Kong integration:** Add `key-auth` plugin per-route for API key authentication.

#### 27-G: Export Center — Backend
**File:** `app/modules/exports/service.py`:
```python
class ExportService:

    EXPORT_HANDLERS: dict[str, Callable] = {
        "REQUISITIONS": _export_requisitions,
        "RFQS": _export_rfqs,
        "VENDORS": _export_vendors,
        "INVOICES": _export_invoices,
        "TICKETS": _export_tickets,
        "AUDIT_TRAIL": _export_audit_trail,
        "PURCHASE_ORDERS": _export_purchase_orders,
        "PAYMENTS": _export_payments,
        "ANALYTICS_SPEND": _export_analytics_spend,
        "USERS": _export_users,
    }

    async def request_export(self, db, export_type: str, filters: dict,
                              fmt: str, actor_id: UUID, org_id: UUID) -> ExportJob:
        if export_type not in self.EXPORT_HANDLERS:
            raise ValidationError("INVALID_EXPORT_TYPE", f"Unknown type: {export_type}",
                {"valid": list(self.EXPORT_HANDLERS.keys())})
        job = ExportJob(
            org_id=org_id, requested_by=actor_id, export_type=export_type,
            filters=filters, format=fmt, status="QUEUED",
            expires_at=datetime.utcnow() + timedelta(days=7),
        )
        db.add(job)
        await db.flush()
        # Enqueue Celery task
        from app.tasks.export_tasks import process_export_job
        process_export_job.apply_async(
            args=[str(job.id), str(org_id)],
            queue="celery.exports",
            countdown=0,
        )
        return job
```

**File:** `app/tasks/export_tasks.py`:
```python
@celery_app.task(queue="celery.exports", name="process_export_job",
                  max_retries=3, default_retry_delay=60)
def process_export_job(job_id: str, org_id: str):
    asyncio.run(_async_process_export(job_id, org_id))

async def _async_process_export(job_id: str, org_id: str):
    async with async_session_factory() as db:
        job = await export_repo.get(db, UUID(job_id), UUID(org_id))
        job.status = "PROCESSING"
        job.started_at = datetime.utcnow()
        await db.commit()
        try:
            handler = ExportService.EXPORT_HANDLERS[job.export_type]
            rows, columns = await handler(db, job.filters, UUID(org_id))
            filename = f"{job.export_type.lower()}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{job.format.lower()}"
            minio_path = f"{org_id}/exports/{job_id}/{filename}"
            file_bytes = await _serialize(rows, columns, job.format)
            minio_client.put_object("exports", minio_path, file_bytes, len(file_bytes))
            job.status = "COMPLETED"
            job.file_path = minio_path
            job.total_rows = len(rows)
            job.file_size_bytes = len(file_bytes)
            job.completed_at = datetime.utcnow()
            await db.commit()
            # Notify user
            await publisher.publish("procurement.notification", "notification.inapp.export_ready", {
                "job_id": str(job.id), "export_type": job.export_type,
                "total_rows": len(rows), "recipient_id": str(job.requested_by),
            }, UUID(org_id))
        except Exception as e:
            job.status = "FAILED"
            job.error_message = str(e)[:500]
            await db.commit()
```

#### 27-J: Payment Gateway — Backend
**File:** `app/modules/payment/gateway_service.py`:
```python
class PaymentGatewayService:

    async def initiate_payment(self, db, payment_id: UUID, actor_id: UUID, org_id: UUID) -> dict:
        payment = await self.payment_repo.get(db, payment_id, org_id)
        if payment.gateway_order_id:
            raise ConflictError("PAYMENT_ALREADY_INITIATED", "Payment already initiated with gateway")
        config = await self._get_gateway_config(db, org_id)
        # Auto-route by currency
        provider = "RAZORPAY" if payment.currency == "INR" else "STRIPE"
        if provider == "RAZORPAY":
            result = await self._razorpay_create_order(config, payment)
        else:
            result = await self._stripe_create_intent(config, payment)
        payment.gateway_provider = provider
        payment.gateway_order_id = result["order_id"]
        payment.payment_link_url = result.get("payment_link_url")
        payment.payment_link_expires_at = datetime.utcnow() + timedelta(hours=24)
        await self.audit.log(db, "PAYMENT", payment_id, "PAYMENT_GATEWAY_INITIATED", actor_id, org_id,
            new_values={"provider": provider, "order_id": result["order_id"]})
        return {"checkout_url": result.get("checkout_url"), "payment_link": result.get("payment_link_url")}

    async def handle_razorpay_webhook(self, db, payload: dict, signature: str, org_id: UUID) -> None:
        config = await self._get_gateway_config(db, org_id)
        # Verify signature BEFORE any processing
        expected = hmac.new(
            decrypt_field(config.webhook_secret).encode(),
            json.dumps(payload, separators=(',',':')).encode(),
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise AppException("INVALID_WEBHOOK_SIGNATURE", "Razorpay signature verification failed", 401)
        event = payload.get("event")
        if event == "payment.captured":
            payment_id_str = payload["payload"]["payment"]["entity"]["notes"].get("payment_record_id")
            if payment_id_str:
                payment = await self.payment_repo.get(db, UUID(payment_id_str), org_id)
                payment.status = "PAID"
                payment.gateway_payment_id = payload["payload"]["payment"]["entity"]["id"]
                payment.gateway_response = payload
                payment.gateway_fee = payload["payload"]["payment"]["entity"].get("fee", 0) / 100
                await self._trigger_erp_sync(db, payment, org_id)
                await self.audit.log(db, "PAYMENT", payment.id, "PAYMENT_COMPLETED", None, org_id)
        elif event == "payment.failed":
            payment_id_str = payload["payload"]["payment"]["entity"]["notes"].get("payment_record_id")
            if payment_id_str:
                payment = await self.payment_repo.get(db, UUID(payment_id_str), org_id)
                payment.status = "FAILED"
                payment.gateway_response = payload

    async def _get_gateway_config(self, db, org_id: UUID) -> PaymentGatewayConfig:
        config = await self.config_repo.get(db, org_id)
        if not config or not config.is_configured:
            raise AppException("PAYMENT_GATEWAY_NOT_CONFIGURED",
                "Payment gateway not configured for this organization. Please contact admin.", 503)
        return config
```

### PRIORITY 2: UAT/QA Role
**File:** `app/core/middleware.py` — detect QA_TESTER role and set `request.state.is_test_mode`:
```python
# In get_current_user dependency:
if "QA_TESTER" in roles:
    request.state.is_test_mode = True
else:
    request.state.is_test_mode = False
```

**All create service methods** — check `request.state.is_test_mode` and set `is_test_record=True`.
Pass request to service layer via `context: RequestContext` dataclass (not raw Request object).

### PRIORITY 3: Branding
**File:** `app/modules/admin/branding_service.py`:
```python
WCAG_MIN_CONTRAST = 4.5  # AA standard

async def update_branding(self, db, data: BrandingUpdateRequest, actor_id: UUID, org_id: UUID) -> dict:
    if data.primary_color:
        contrast = self._calculate_contrast(data.primary_color, "#ffffff")
        if contrast < WCAG_MIN_CONTRAST:
            raise ValidationError("LOW_CONTRAST_COLOR",
                f"Primary color contrast ratio {contrast:.1f}:1 is below WCAG AA minimum {WCAG_MIN_CONTRAST}:1")
    settings_obj = await self.tenant_repo.get_settings(db, org_id)
    branding = settings_obj.branding or {}
    branding.update(data.model_dump(exclude_none=True))
    settings_obj.branding = branding
    await self.audit.log(db, "ORG", org_id, "BRANDING_UPDATED", actor_id, org_id)
    # Invalidate CDN cache for public branding endpoint
    await self.redis.delete(f"branding:{org_id}")
    return branding
```

### PRIORITY 4: Frontend Pages

**Admin Portal new sidebar sections:**
```
Organization
  ├── Org Structure (existing)
  ├── Company Switcher (new)       → shows all orgs user belongs to
  └── Onboarding Wizard (new)      → for setting up new org

Integrations (existing section, add:)
  ├── Integration Jobs (existing)
  ├── Webhook Management (new)     → CRUD + delivery log + test
  └── API Keys (new)               → generate/revoke/usage

Settings (existing section, add:)
  └── Branding (new)               → logo + color + domain

Tools (new section, ALL 3 portals)
  └── Export Center (new)          → async export queue
```

**All 3 portal navbars:**
- Company Switcher pill (if user has > 1 org membership)
- Export Center notification: badge count when export ready

---
## STEP 3 — TEST

### Unit Tests
```python
test_switch_org_requires_membership()
test_switch_org_rate_limited_after_10()
test_switch_org_revokes_old_session()
test_webhook_url_must_be_https_production()
test_webhook_secret_stored_as_hash()
test_webhook_raw_secret_not_in_db()
test_api_key_format_prefix()
test_api_key_hash_stored_not_plaintext()
test_api_key_raw_returned_once_only()
test_razorpay_webhook_signature_invalid_raises()
test_razorpay_webhook_updates_payment_status()
test_export_job_queued_returns_immediately()
test_export_celery_task_uploads_to_minio()
test_branding_low_contrast_rejected()
test_qa_role_sets_is_test_record_true()
test_is_test_record_excluded_from_analytics()
test_cross_company_report_requires_platform_admin()
test_onboarding_session_persists_across_requests()
```

### QA / Integration Tests
```
- Company switch: switch org A → B → verify JWT claims org_B, all API calls return org_B data
- Webhook test delivery: create endpoint, fire test → verify delivery log entry created
- API key scoped: key with only read:pr cannot POST /api/v1/requisitions → 403
- Export Center: request VENDORS export → poll status → download → verify row count matches GET /vendors
- Payment gateway: mock Razorpay → initiate → simulate webhook → verify payment.status=PAID
- Cross-company report: non-platform-admin gets 403; platform admin gets aggregated data
- Branding: update primary_color → public endpoint returns new color → portal CSS variable updated
- QA test mode: QA user creates PR → is_test_record=TRUE in DB → not in reports
```

---
## STEP 5 — GRAPHIFY UPDATE
```bash
graphify update
# New nodes: OrgSwitchService, WebhookManagementService, APIKeyService,
#            ExportService, PaymentGatewayService, BrandingService,
#            OnboardingService, CrossCompanyReportService
graphify check --integrity
```
