# SPEC_27 Batch 2 Implementation Plan

## Overview
Implementation plan for Batch 2 of SPEC_27:
1. **27-A: Company Switcher**: Multi-org memberships (`user_org_memberships`), immutable switch audit (`org_switch_audit`), token re-issuance with target `org_id`, and navbar switcher UI.
2. **27-D: Webhook Management UI & Delivery Engine**: Webhook endpoints CRUD, HMAC-SHA256 signature, test delivery, delivery history log (`webhook_endpoints`, `webhook_deliveries`).
3. **27-E: API Key Management**: Scoped Bearer keys, SHA-256 hashing, rate limit tiers, rotation with 24h grace period, usage logs (`api_keys`, `api_key_usage_logs`).
4. **27-F: Tenant Branding**: Custom logo, primary color, company display name, custom domain verification, public unauthenticated branding endpoint (`tenant_brandings`).

---

## Logged Assumptions

- **ASSUMPTION [A-SPEC27A-1]**: `user_org_memberships` links user identity to tenant orgs. When switching orgs via `POST /api/v1/auth/switch-org`, if user has `is_platform_admin == True` or `users.org_id == target_org_id`, access is guaranteed and membership record is ensured.
  - *Risk*: None (safe backwards compatibility with single-org seeded accounts).
  - *Owner*: Backend Engineer.
- **ASSUMPTION [A-SPEC27A-2]**: `org_switch_audit` records immutable history including old JTI, new JTI, IP address, and timestamp.
  - *Risk*: Low.
  - *Owner*: Backend Engineer.
- **ASSUMPTION [A-SPEC27D-1]**: Webhook testing dispatches a sample payload with HMAC-SHA256 signature in `X-ProcureOS-Signature` and records the HTTP response in `webhook_deliveries`.
  - *Risk*: Low.
  - *Owner*: Backend Engineer.
- **ASSUMPTION [A-SPEC27E-1]**: API keys use format `prc_live_{32_chars}` or `prc_test_{32_chars}`. Raw secret is returned once on creation or rotation; SHA-256 hash is stored in DB.
  - *Risk*: Low.
  - *Owner*: Backend Engineer.
- **ASSUMPTION [A-SPEC27F-1]**: Tenant branding stores color codes, logo URLs, and custom domain info in `tenant_brandings`. A public endpoint `GET /api/v1/public/branding/{org_slug}` returns public styling variables for login pages.
  - *Risk*: Low.
  - *Owner*: Backend Engineer.

---

## Step-by-Step Implementation Sequence

1. **Alembic Migration (`0059_batch2_portal_enhancements.py`)**:
   - Create `user_org_memberships` table & unique constraint.
   - Create `org_switch_audit` table.
   - Add `primary_org_id` column to `users`.
   - Create `webhook_endpoints` and `webhook_deliveries` tables.
   - Create `api_keys` and `api_key_usage_logs` tables.
   - Create `tenant_brandings` table.
2. **Backend Models & Schemas**:
   - `app/modules/admin/company_switcher_models.py` & schemas.
   - `app/modules/integration/webhook_models.py` & schemas.
   - `app/modules/integration/api_key_models.py` & schemas.
   - `app/modules/admin/branding_models.py` & schemas.
3. **Backend Services & Routers**:
   - Company switcher service & endpoints in `app/auth/router.py` or `app/modules/admin/company_switcher_router.py`.
   - Webhooks service & router in `app/modules/integration/webhook_router.py`.
   - API keys service & router in `app/modules/integration/api_key_router.py`.
   - Branding service & router in `app/modules/admin/branding_router.py` and public branding endpoint in `app/main.py`.
4. **Unit & Integration Tests**:
   - `tests/unit/test_company_switcher_service.py`
   - `tests/unit/test_webhook_service.py`
   - `tests/unit/test_api_key_service.py`
   - `tests/unit/test_branding_service.py`
5. **Frontend Hooks & UI**:
   - Hooks: `useCompanySwitcher.ts`, `useWebhooks.ts`, `useApiKeys.ts`, `useTenantBranding.ts`.
   - Components: Company Switcher dropdown in top navbar (`admin-portal`, `buyer-portal`).
   - Pages:
     - `apps/admin-portal/app/(main)/integrations/webhooks/page.tsx`
     - `apps/admin-portal/app/(main)/integrations/api-keys/page.tsx`
     - `apps/admin-portal/app/(main)/settings/branding/page.tsx`
6. **Verification & Verification Persona Suite**:
   - Automated pytest run.
   - Turborepo typecheck.
   - Graphify update.
   - README update.
