# IMPLEMENTATION PROMPT 24 — Portal Enhancements (SPEC_27)

Execute the complete implementation for `plans/plan_spec_27_portal_enhancements.md`.
Follow ALL GEMINI.md ABSOLUTE RULES. Do not stop until Steps 2–6 are fully verified.

---
## MANDATORY PRE-FLIGHT
```bash
graphify check --before-change
alembic current  # Must show 0034 (head from SPEC_26)
pytest tests/ -v --tb=no -q  # Full suite must be green before starting
cat README.md | grep -A 10 "Current Session State"
```

---
## STEP 2 — IMPLEMENT (exact order)

### Part A: Migrations (run after each to verify)
1. `0035_company_switcher.py` — user_org_memberships + org_switch_audit + users.primary_org_id
2. `0036_onboarding.py` — onboarding_sessions table
3. `0037_platform_admin.py` — users.is_platform_admin BOOL DEFAULT FALSE (no API to set it)
4. `0038_webhook_endpoints.py` — webhook_endpoints + webhook_deliveries tables
5. `0039_api_keys.py` — api_keys + api_key_usage_log (partitioned monthly)
6. `0040_export_jobs.py` — export_jobs table
7. `0041_payment_gateway.py` — payment_gateway_config + alter payment_records
8. `0042_test_records.py` — is_test_record BOOL DEFAULT FALSE on 7 tables
9. `0043_new_permissions.py` — 8 new permission codes + role assignments
10. `0044_new_indexes.py` — ALL CONCURRENTLY indexes for all new tables
```bash
alembic upgrade head && alembic current  # Must show 0044
```

### Part B: Backend Services (implement in dependency order)

#### 27-A Company Switcher
11. `app/auth/jwt.py` — ensure `portal` claim exists (from SPEC_26 — verify only)
12. `app/modules/organization/models.py` — add UserOrgMembership + OrgSwitchAudit models
13. `app/modules/organization/membership_repository.py` — get_all_for_user(), get(user_id, org_id)
14. `app/modules/organization/service.py` — add switch_org() with rate limit (10/hr), session revoke, audit log, new JWT issue
15. `app/auth/router.py` — add GET /auth/my-orgs + POST /auth/switch-org endpoints

#### 27-D Webhook Management
16. `app/modules/integration/models.py` — WebhookEndpoint + WebhookDelivery models
17. `app/modules/integration/webhook_management_service.py` — create(), rotate_secret(), test_delivery(), get_delivery_log()
    - RULE: URL must be HTTPS in production (settings.ENVIRONMENT check)
    - RULE: Raw secret returned ONCE; SHA-256 hash stored in DB
    - RULE: Custom headers encrypted via Fernet before storage
18. `app/modules/integration/webhook_management_router.py` — 9 endpoints

#### 27-E API Key Management
19. `app/modules/integration/models.py` — APIKey + APIKeyUsageLog models
20. `app/modules/integration/api_key_service.py` — create(), revoke(), rotate(), authenticate(), get_usage()
    - RULE: key format: `prc_{env}_{32_random_chars}`
    - RULE: SHA-256 hash stored; raw returned ONCE at create and rotate
    - RULE: Revoke adds key_hash to Redis revoked set for instant invalidation
21. `app/modules/integration/api_key_router.py` — 7 endpoints
22. `app/core/middleware.py` — add API key authentication path (check Bearer token → look up SHA-256 hash → validate scope)

#### 27-G Export Center
23. `app/modules/exports/models.py` — ExportJob model
24. `app/modules/exports/service.py` — request_export(), get_job(), refresh_presigned_url()
    - RULE: All export handlers in EXPORT_HANDLERS dict — no if/elif chains
    - RULE: Celery queue is `celery.exports` (dedicated, not celery.maintenance)
25. `app/modules/exports/handlers/` — one file per export type (requisitions.py, vendors.py, etc.) minimum 10 types
26. `app/tasks/export_tasks.py` — process_export_job Celery task (streams to MinIO, never loads all rows to memory)
27. `app/modules/exports/router.py` — 5 endpoints
28. `app/tasks/celery_app.py` — verify `celery.exports` queue exists in CELERY_TASK_ROUTES

#### 27-J Payment Gateway
29. `app/modules/payment/models.py` — PaymentGatewayConfig model + alter PaymentRecord model
30. `app/modules/payment/gateway_service.py` — initiate_payment(), handle_razorpay_webhook(), handle_stripe_webhook(), refund()
    - RULE: Webhook endpoints (`/api/v1/webhooks/gateway/razorpay` and `/stripe`) are PUBLIC — no JWT auth
    - RULE: Signature verified BEFORE any DB write (fail fast on invalid signature)
    - RULE: Gateway credentials stored encrypted (Fernet); never logged
    - RULE: Auto-route: INR → Razorpay, non-INR → Stripe
31. `app/modules/payment/gateway_router.py` — 8 endpoints; mark 2 webhook endpoints as no-auth

#### 27-I UAT/QA Role
32. `app/modules/user/constants.py` — add QA_TESTER to role definitions
33. `app/core/context.py` — RequestContext dataclass: `{user, org_id, is_test_mode, portal}`
34. All create endpoints — accept RequestContext, set `is_test_record=True` when `is_test_mode=True`
35. Analytics queries — add `AND is_test_record = FALSE` by default; `include_test: bool = False` query param
36. `app/tasks/maintenance.py` — add `purge_test_records` weekly Celery task

#### 27-F Branding
37. `app/modules/admin/branding_service.py` — update_branding() with WCAG contrast validation, logo upload, favicon upload, domain verification trigger
38. `app/modules/admin/branding_router.py` — 7 endpoints; `/public/branding/{org_slug}` is no-auth, cached in Redis 1h

#### 27-B Onboarding Wizard
39. `app/modules/admin/onboarding_service.py` — get_or_create_session(), save_step(), complete()
40. `app/modules/admin/onboarding_router.py` — 7 endpoints

#### 27-C Cross-Company Reports
41. `app/modules/superadmin/reports_service.py` — all 5 report types using dedicated `superuser` DB role (bypasses RLS)
42. `app/modules/superadmin/reports_router.py` — 6 endpoints with `require_platform_admin()` dependency
43. `app/auth/dependencies.py` — add `require_platform_admin()` that checks `users.is_platform_admin == True`

#### 27-H Buyer Activity Reports
44. `app/modules/analytics/activity_service.py` — buyer_activity(), heatmap(), procurement_velocity(), bottleneck_analysis()
45. `app/modules/analytics/router.py` — add 6 new endpoints to existing analytics router

### Part C: Frontend (ALL 3 portals)

46. Run `pnpm generate:types` to regenerate TypeScript types from updated OpenAPI spec
47. **Company Switcher** — `packages/components/OrgSwitcher.tsx`:
    - Org pill in ALL 3 portal navbars
    - Dropdown shows user's orgs from GET /auth/my-orgs
    - Click switch → POST /auth/switch-org → window.location.reload() on success
    - Show spinner while switching; error toast on failure
    - Only render if user has > 1 org membership

48. **Export Center** — `packages/components/ExportButton.tsx`:
    - Replace all sync export buttons across all listing pages
    - POST /api/v1/exports → "Export queued!" toast
    - New page: `apps/*/app/(main)/export-center/page.tsx` — job history + status + download
    - WebSocket notification when export completes

49. **Webhook Management** — `apps/admin-portal/app/(main)/integrations/webhooks/`:
    - List page: table with name, URL, events count, last delivery status, actions
    - Create/Edit modal: URL input, event type multi-select (all 35 event types), retry config
    - Detail page: delivery log (30-day), test delivery button, secret rotation
    - Secret shown in modal ONCE after create/rotate — copy button + "I've saved this" confirm

50. **API Key Management** — `apps/admin-portal/app/(main)/integrations/api-keys/`:
    - List page: keys with prefix (never full key), scope badges, last used, usage bar
    - Create modal: name, scope multi-select, tier, expiry
    - Key shown ONCE in modal after create/rotate — monospace display + copy button
    - Usage chart: requests over time (recharts AreaChart)

51. **Branding** — `apps/admin-portal/app/(main)/settings/branding/page.tsx`:
    - Logo upload with live preview
    - Color picker with WCAG contrast indicator (shows ratio, green if ≥4.5:1)
    - Custom domain section: CNAME record to copy, verify button
    - Live preview pane: small portal mockup with current branding applied

52. **UAT Overlay** — `packages/components/UATOverlay.tsx`:
    - Rendered in root layout of ALL 3 portals
    - Only visible when user has QA_TESTER role (from Zustand permissions)
    - Amber top bar (1px) + bottom-right badge "🧪 UAT / Test Mode"
    - "Exit Test Mode" link → navigates to role management

53. **Buyer Activity Report** — `apps/buyer-portal/app/(main)/analytics/activity/page.tsx`:
    - User activity timeline + heatmap (calendar-style, GitHub contribution graph)
    - Procurement velocity histogram (recharts BarChart)
    - Bottleneck table: step name, avg days, worst case
    - Export via Export Center button

54. **Onboarding Wizard** — `apps/admin-portal/app/(main)/onboarding/page.tsx`:
    - 8-step wizard with progress bar
    - Each step: form + validation + save partial progress before advancing
    - Resume: GET /onboarding/session on load → jump to current_step
    - Step 7 (rule simulator): calls POST /approval-rules/simulate, shows result inline

55. **Payment Gateway** — `apps/admin-portal/app/(main)/settings/payment-gateway/page.tsx`:
    - Config form: provider selection, credentials (masked), test connection button
    - `apps/buyer-portal/app/(main)/invoices/[id]/page.tsx` — add "Pay Online" button (shown when gateway configured + invoice APPROVED)
    - Payment status widget with gateway provider logo

56. **Cross-Company Reports** — `apps/admin-portal/app/(main)/superadmin/reports/page.tsx`:
    - Only renders if `user.is_platform_admin === true` (Zustand check)
    - Platform overview KPI row + per-org performance table + feature adoption heatmap

---
## STEP 2.5 — SPEC AUDIT
Produce `reports/spec_27_audit.md`. Mark each of the 10 modules (A–J) as DONE/PARTIAL/MISSING.
BLOCK on any PARTIAL or MISSING before Step 3.

---
## STEP 3 — TEST
```bash
# Run targeted test suite
pytest tests/unit/test_company_switcher.py -v
pytest tests/unit/test_webhook_management.py -v
pytest tests/unit/test_api_key_service.py -v
pytest tests/unit/test_export_center.py -v
pytest tests/unit/test_payment_gateway.py -v
pytest tests/unit/test_branding_service.py -v
pytest tests/unit/test_uat_role.py -v
pytest tests/integration/test_spec_27.py -v

# Critical security tests — ALL must pass:
pytest tests/security/test_spec_27_security.py -v
# Must include:
# test_switch_org_rate_limited_after_10
# test_webhook_raw_secret_not_stored_in_db
# test_api_key_hash_not_plaintext
# test_razorpay_webhook_invalid_sig_rejected
# test_platform_admin_endpoint_requires_flag
# test_cross_org_data_not_accessible_after_switch
# test_is_test_record_excluded_from_analytics

# Full regression
pytest tests/ -v --cov=app --cov-fail-under=80

# Frontend build verification
cd procurement-portal-frontend
pnpm generate:types
pnpm build --filter=buyer-portal --filter=supplier-portal --filter=admin-portal
```

---
## STEP 4 — INTEGRATE
```bash
alembic upgrade head  # 0035–0044
python scripts/rabbitmq_setup.py  # No new exchanges; verify existing still intact
python scripts/seed_notification_templates.py  # Add export + payment templates
# Verify payment gateway public endpoints (no JWT required):
curl -X POST http://localhost:8000/api/v1/webhooks/gateway/razorpay \
  -H "Content-Type: application/json" -d '{"event":"test"}' \
  # Must return 401 (bad signature) NOT 401 (missing JWT) — different error
# Verify API key auth:
curl http://localhost:8000/api/v1/requisitions \
  -H "Authorization: Bearer prc_test_$(openssl rand -hex 16)"
  # Must return 401 INVALID_API_KEY (not JWT error)
```

---
## STEP 5 — GRAPHIFY + STEP 6 — README + COMMIT
```bash
graphify update && graphify check --integrity
git add -A
git commit -m "[NON-BREAKING] feat: SPEC_27 — Company Switcher, Webhooks, API Keys, Export Center, Payment Gateway, Branding, UAT/QA Role, Onboarding Wizard, Cross-Company Reports, Buyer Activity"
```
