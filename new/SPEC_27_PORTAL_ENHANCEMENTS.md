# SPEC_27: Portal Enhancements — 10 New Modules
**Version:** 1.0 | **Phase:** Enhancement | **Squad:** A+B+C+D+E
**Depends on:** SPEC_01–26 fully implemented

---
## MODULE INDEX
| # | Module | Portal | Priority |
|---|---|---|---|
| 27-A | Company Switcher | Admin navbar | P0 |
| 27-B | Unified Buyer Onboarding Wizard | Admin Portal | P0 |
| 27-C | Cross-Company Reports | Admin Portal (SuperAdmin) | P1 |
| 27-D | Webhook Management UI | Admin → Integrations | P0 |
| 27-E | API Key Management | Admin → Integrations | P0 |
| 27-F | Branding per Tenant | Admin → Settings | P1 |
| 27-G | Export Center (Async) | All 3 portals | P0 |
| 27-H | Buyer Activity Report UI | Buyer → Analytics | P1 |
| 27-I | UAT Overlay / QA Role | All 3 portals | P1 |
| 27-J | Payment Gateway (Online) | Buyer Portal | P0 |

---
## MODULE 27-A: COMPANY SWITCHER

### A.1 Overview
Multi-org membership allows a single user account (identified by email) to belong to multiple
organizations with different roles in each. The Company Switcher in the navbar lets them switch
context without logging out and back in.

### A.2 Database Changes

**New table: `user_org_memberships`**
```sql
id            UUID PK
primary_user_id   UUID NOT NULL REFERENCES users(id)  -- canonical user identity
org_id        UUID NOT NULL REFERENCES organizations(id)
role_in_org   JSONB NOT NULL DEFAULT '[]'             -- list of role codes in that org
is_primary_org BOOL DEFAULT FALSE
invited_by    UUID REFERENCES users(id)
joined_at     TIMESTAMP WITH TIME ZONE
status        VARCHAR(20) DEFAULT 'ACTIVE'            -- ACTIVE, SUSPENDED, REMOVED
version       INT DEFAULT 1
created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
UNIQUE (primary_user_id, org_id)
```

**New table: `org_switch_audit`** (immutable log)
```sql
id              UUID PK
user_id         UUID NOT NULL REFERENCES users(id)
from_org_id     UUID REFERENCES organizations(id)
to_org_id       UUID NOT NULL REFERENCES organizations(id)
switched_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
ip_address      INET
user_agent      TEXT
previous_jti    VARCHAR(100)     -- old session JTI revoked
new_jti         VARCHAR(100)     -- new session JTI issued
```

**Alter: `users` table**
Add column: `primary_org_id UUID REFERENCES organizations(id)` — canonical home org for cross-org users.

### A.3 API Endpoints
```
GET  /api/v1/auth/my-orgs          → list all orgs user belongs to (id, name, logo_url, user_role_in_org, is_current)
POST /api/v1/auth/switch-org       → body: {org_id} → revoke current session, issue new JWT for target org
POST /api/v1/admin/user-org-invite → body: {email, org_id, roles} → invite existing user to join another org
DELETE /api/v1/admin/user-org/{membership_id} → remove user from org
GET  /api/v1/admin/org-members     → list all cross-org members
```

### A.4 Switch-Org Flow (Backend)
```
1. Validate user membership in target org (user_org_memberships table)
2. Validate target org is ACTIVE and not suspended
3. Revoke current JWT session in Redis (add JTI to revoked set)
4. Log switch in org_switch_audit (immutable)
5. Load roles, BU scope, category scope for target org
6. Issue new access_token + refresh_token with target org_id
7. Return new tokens (refresh in httpOnly cookie)
8. Emit audit event: AUTH_ORG_SWITCHED
```

### A.5 Frontend (Admin Portal Navbar)
```
Current org pill → click → dropdown:
  - List of orgs with logo thumbnails and user's role in each
  - Current org highlighted with checkmark
  - "Switch" button per org
  - Loading spinner while switch API call in progress
  - On success: full page reload (clears all TanStack Query cache for old org)
  - On error: toast notification "Unable to switch org"
```
RULE: Full page reload on org switch is mandatory — no stale cached data from previous org must remain.

### A.6 Security Requirements
- Switch-org endpoint rate-limited: max 10 switches per hour per user
- Cross-org data NEVER accessible — each switch issues fresh tokens scoped to new org_id
- RLS re-evaluated on new org context (SET LOCAL app.current_org_id)
- Audit log entry created on every switch (immutable)
- If user has `is_supplier_user=True` in one org but not another, JWT claim updated accordingly

---
## MODULE 27-B: UNIFIED BUYER ONBOARDING WIZARD

### B.1 Overview
A guided 8-step wizard in Admin Portal that walks a SUPERADMIN or PROCUREMENT_ADMIN through
setting up a new organization from scratch. Packages existing scattered admin pages into a
structured flow with progress persistence and validation at each step.

### B.2 Data Model

**New table: `onboarding_sessions`**
```sql
id              UUID PK
org_id          UUID NOT NULL REFERENCES organizations(id)
initiated_by    UUID NOT NULL REFERENCES users(id)
current_step    INT DEFAULT 1            -- 1 through 8
completed_steps INT[] DEFAULT '{}'       -- e.g. {1,2,3}
step_data       JSONB DEFAULT '{}'       -- persisted partial data per step
status          VARCHAR(20) DEFAULT 'IN_PROGRESS'  -- IN_PROGRESS, COMPLETED, ABANDONED
completed_at    TIMESTAMP WITH TIME ZONE
version         INT DEFAULT 1
created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
deleted_at      TIMESTAMP WITH TIME ZONE
```

### B.3 Onboarding Steps
```
Step 1: Organization Basics
  - Legal name, trade name, registration number, PAN, GSTIN
  - Country, base currency, timezone, cost_of_capital_rate
  - Logo upload (MinIO compliance-documents bucket)
  Validates: GSTIN format, PAN format

Step 2: Structure Setup
  - Create Legal Entities (at least 1)
  - Create Business Units under each LE (at least 1)
  - Create Plants (optional)
  - Create Departments (optional)
  Validates: At least 1 BU before proceeding

Step 3: ERP & Integration Config
  - ERP provider select (SAP/Oracle/Custom/None)
  - ERP base URL + credentials test
  - eSign provider (Digio/DocuSign/None)
  - HRMS endpoint (optional)
  - Allowed integration domains (SSRF allowlist)

Step 4: Master Data Seeding
  - Import categories from CSV OR use pre-built templates
    (Templates: Manufacturing, IT Services, FMCG, Healthcare, Infrastructure)
  - Confirm UOM list (system defaults + custom adds)
  - Add custom payment terms (default: Net 30, Net 45, Net 60 pre-seeded)
  - Add delivery locations
  - Import holiday calendar for country

Step 5: User Roles & Permissions
  - Invite admin users (PROCUREMENT_ADMIN, FINANCE_CONTROLLER)
  - Assign BU scopes to each user
  - Configure approval group memberships
  - Review default role-permission matrix (read-only table)

Step 6: Vendor Invite & Onboarding Setup
  - Bulk vendor invite (CSV upload: company name, email, categories)
  - Configure vendor qualification checklist (which doc types required)
  - Set compliance expiry reminder days

Step 7: Approval Rules Configuration
  - Configure PR approval rules (guided form: amount thresholds, CAPEX flag)
  - Configure PO approval rules
  - Configure vendor approval rules
  - Run rule simulator on sample scenarios to verify

Step 8: Go-Live Checklist & Test Run
  - Checklist: org setup ✓, BU ✓, users invited ✓, rules configured ✓
  - Create 1 test PR → submit → approve → convert to PO (guided walkthrough)
  - Mark onboarding complete → send "Welcome to ProcureOS" email to all invited users
  - Show summary: X users invited, Y vendors invited, Z rules configured
```

### B.4 API Endpoints
```
GET  /api/v1/onboarding/session           → current session state or create new
PUT  /api/v1/onboarding/session/step/{n}  → save step N data (partial save)
POST /api/v1/onboarding/session/complete  → mark complete
GET  /api/v1/onboarding/templates         → list category templates
POST /api/v1/onboarding/bulk-invite       → CSV vendor bulk invite (async job)
POST /api/v1/onboarding/test-erp          → test ERP connection from step 3
GET  /api/v1/onboarding/checklist         → go-live checklist status
```

### B.5 Frontend
- Persists step data in `onboarding_sessions` DB table (survives browser refresh)
- Back navigation allowed on all steps
- Skip optional steps (3, 4 partial)
- Progress bar showing X/8 steps complete
- Each step shows validation errors inline before advancing

---
## MODULE 27-C: CROSS-COMPANY REPORTS (SUPERADMIN)

### C.1 Overview
Platform-level analytics visible ONLY to SUPERADMIN across ALL organizations. Bypasses RLS.
Uses read replica. Shows platform health, org performance comparisons, and revenue metrics.

### C.2 Security
- Accessed via `/api/v1/superadmin/reports/*` — separate router prefix
- `require_platform_admin()` dependency — checks `users.is_platform_admin = TRUE` (new column)
- RLS bypassed via dedicated connection: `SET LOCAL row_security = OFF` + `SET ROLE superuser`
- All queries use explicit org_id filters even without RLS (defense in depth)
- Every access logged to audit_logs with entity_type = 'PLATFORM_REPORT'

**New column: `users.is_platform_admin BOOL DEFAULT FALSE`**
Set only by DB migration for designated platform admins. Cannot be set via API.

### C.3 Available Reports
```
1. Platform Overview
   - Total orgs (active/trial/suspended/churned)
   - Total users, vendors, PRs, POs, invoices across platform
   - Total GMV (Gross Merchandise Value = sum of all PO values across all orgs)
   - Month-over-month growth rates

2. Per-Org Performance
   - Table: org name, user count, vendor count, PRs this month, spend this month, avg SLA compliance %
   - Sortable, filterable by country/plan tier
   - Click org → drill into org-specific summary (no access to raw data, only aggregates)

3. Feature Adoption
   - Which features each org uses (workflows enabled, integrations active, vendor count, etc.)
   - Cohort analysis: orgs by signup month, feature adoption rate over time

4. Platform SLA Health
   - Celery task success rates across all orgs
   - RabbitMQ DLQ depth trends
   - API error rate per org (from metrics)
   - Average API response time per org

5. Billing & Usage (stub for Phase 2)
   - API calls per org per month
   - Storage used per org
   - User seat counts
```

### C.4 API Endpoints
```
GET /api/v1/superadmin/reports/overview         → platform-wide KPIs
GET /api/v1/superadmin/reports/orgs             → per-org performance table
GET /api/v1/superadmin/reports/orgs/{id}/summary → single org aggregated metrics
GET /api/v1/superadmin/reports/feature-adoption → feature usage heatmap data
GET /api/v1/superadmin/reports/platform-health  → infra health aggregates
POST /api/v1/superadmin/reports/export          → async export (cross-org CSV)
```

---
## MODULE 27-D: WEBHOOK MANAGEMENT UI

### D.1 Overview
Admins configure outbound webhooks for their org: endpoint URL, event subscriptions, secret,
retry policy, and test delivery. Backend webhook delivery already exists (SPEC_20). This adds
the full CRUD UI + delivery log.

### D.2 Data Model Additions to `integration_jobs` / New Tables

**New table: `webhook_endpoints`**
```sql
id              UUID PK
org_id          UUID NOT NULL
name            VARCHAR(200) NOT NULL
url             VARCHAR(2000) NOT NULL           -- Validated: HTTPS only in production
secret          VARCHAR(255) NOT NULL             -- SHA-256 hashed; raw only at creation time
secret_hint     VARCHAR(20)                       -- Last 4 chars of raw secret for display
subscribed_events TEXT[] NOT NULL DEFAULT '{}'    -- e.g. '{ticket.created,po.sent_to_vendor}'
is_active       BOOL DEFAULT TRUE
max_retries     INT DEFAULT 5
retry_delay_seconds INT DEFAULT 60
timeout_seconds INT DEFAULT 30
ip_allowlist    TEXT[]                            -- Optional: restrict deliveries to these IPs
custom_headers  JSONB DEFAULT '{}'               -- e.g. {"X-Custom-Auth": "token123"}
last_delivery_at     TIMESTAMP WITH TIME ZONE
last_delivery_status VARCHAR(20)                  -- SUCCESS, FAILED, PENDING
total_deliveries     INT DEFAULT 0
failed_deliveries    INT DEFAULT 0
version         INT DEFAULT 1
created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
deleted_at      TIMESTAMP WITH TIME ZONE
```

**New table: `webhook_deliveries`** (retention: 30 days rolling)
```sql
id              UUID PK
org_id          UUID NOT NULL
webhook_id      UUID NOT NULL REFERENCES webhook_endpoints(id)
event_type      VARCHAR(100) NOT NULL
payload         JSONB NOT NULL
response_status INT                       -- HTTP status code received
response_body   TEXT                      -- First 1000 chars
request_headers JSONB
attempt_number  INT DEFAULT 1
delivered_at    TIMESTAMP WITH TIME ZONE
duration_ms     INT
is_success      BOOL
error_message   TEXT
created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### D.3 All Available Webhook Events (comprehensive list)
```
# Vendor events
vendor.invited | vendor.submitted | vendor.qualified | vendor.activated
vendor.suspended | vendor.blacklisted | vendor.compliance.expiring

# PR events
pr.created | pr.submitted | pr.approved | pr.rejected | pr.withdrawn | pr.amended

# RFQ events
rfq.published | rfq.bids.opened | rfq.awarded | rfq.cancelled

# PO events
po.created | po.approved | po.sent_to_vendor | po.acknowledged | po.received | po.closed

# Invoice events
invoice.submitted | invoice.approved | invoice.disputed | invoice.paid

# Contract events
contract.created | contract.activated | contract.expiring | contract.expired | contract.amended

# Ticket events
ticket.created | ticket.resolved | ticket.escalated | ticket.sla.breached

# Workflow events
workflow.task.created | workflow.instance.completed | workflow.instance.failed | workflow.sla.breached

# Integration events
integration.job.failed | integration.job.completed

# User events
user.created | user.deactivated | user.role.changed
```

### D.4 API Endpoints
```
GET    /api/v1/webhooks                     → list org webhooks
POST   /api/v1/webhooks                     → create webhook endpoint
GET    /api/v1/webhooks/{id}                → webhook detail
PUT    /api/v1/webhooks/{id}                → update (URL, events, policy)
DELETE /api/v1/webhooks/{id}                → soft delete
POST   /api/v1/webhooks/{id}/rotate-secret  → rotate HMAC secret (returns new raw secret ONCE)
POST   /api/v1/webhooks/{id}/test           → send test payload → return delivery result
GET    /api/v1/webhooks/{id}/deliveries     → paginated delivery log (30-day retention)
GET    /api/v1/webhooks/{id}/deliveries/{did}/retry → manually retry a failed delivery
GET    /api/v1/webhooks/events              → list of all subscribable event types
```

### D.5 Security
- URL must be HTTPS in production (HTTP allowed in dev/staging only)
- HMAC-SHA256 signature on every delivery via `X-ProcureOS-Signature` header
- Raw secret shown ONLY once at creation or rotation → store hashed in DB
- IP allowlist validation before delivery
- Custom headers encrypted in JSONB column (same Fernet encryption as field-level encryption)
- Rate limit: max 100 webhooks per org, max 10,000 deliveries per day per org

---
## MODULE 27-E: API KEY MANAGEMENT

### E.1 Overview
Tenant-scoped API keys for programmatic access (machine-to-machine). Keys use Bearer token format
with granular scopes, rate limit tiers, and usage analytics. Keys are SHA-256 hashed in DB;
raw key shown once at creation.

### E.2 Data Model

**New table: `api_keys`**
```sql
id              UUID PK
org_id          UUID NOT NULL REFERENCES organizations(id)
name            VARCHAR(200) NOT NULL          -- Human label: "ERP Integration Key"
key_hash        VARCHAR(64) NOT NULL UNIQUE    -- SHA-256(raw_key), indexed
key_prefix      VARCHAR(12) NOT NULL           -- First 12 chars for display: "prc_live_a1b2"
key_type        VARCHAR(20) DEFAULT 'LIVE'     -- LIVE, TEST, SANDBOX
scopes          TEXT[] NOT NULL DEFAULT '{}'   -- ['read:pr','write:po','read:vendor']
rate_limit_tier VARCHAR(20) DEFAULT 'STANDARD' -- STANDARD, PREMIUM, UNLIMITED
is_active       BOOL DEFAULT TRUE
expires_at      TIMESTAMP WITH TIME ZONE       -- NULL = never expires
last_used_at    TIMESTAMP WITH TIME ZONE
last_used_ip    INET
total_requests  BIGINT DEFAULT 0
created_by      UUID NOT NULL REFERENCES users(id)
rotated_at      TIMESTAMP WITH TIME ZONE       -- when key was last rotated
rotated_by      UUID REFERENCES users(id)
grace_period_ends_at TIMESTAMP WITH TIME ZONE  -- old key still valid during rotation grace period
version         INT DEFAULT 1
created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
deleted_at      TIMESTAMP WITH TIME ZONE
```

**New table: `api_key_usage_log`** (partition by month, retain 90 days)
```sql
id              UUID PK
org_id          UUID NOT NULL
api_key_id      UUID NOT NULL REFERENCES api_keys(id)
endpoint        VARCHAR(200)
method          VARCHAR(10)
status_code     INT
response_ms     INT
ip_address      INET
user_agent      TEXT
created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
-- Partitioned by created_at (monthly)
```

### E.3 API Key Format
```
Format:  prc_{env}_{random_32_chars}
Example: prc_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p
Prefix stored: prc_live_a1b2 (first 12 chars + prefix label)
Full key returned ONCE at creation or rotation.
```

### E.4 Available Scopes
```python
API_KEY_SCOPES = [
    # Read scopes
    "read:vendor", "read:pr", "read:rfq", "read:po", "read:invoice",
    "read:contract", "read:grn", "read:payment", "read:ticket",
    "read:analytics", "read:master_data", "read:users",
    # Write scopes
    "write:vendor", "write:pr", "write:rfq", "write:po",
    "write:invoice", "write:grn", "write:ticket",
    # Special scopes
    "webhook:receive",     # Can receive webhook callbacks
    "admin:users",         # User management
    "admin:master_data",   # Master data management
]
```

### E.5 Authentication via API Key
Kong plugin (key-auth) validates `Authorization: Bearer prc_live_...` header.
Backend middleware: if key present → look up by SHA-256 hash → validate active + not expired +
org matches + scope allows requested endpoint → set request.state.api_key_context.

Rate limit tiers:
- STANDARD: 100 req/min, 10,000 req/day
- PREMIUM: 1,000 req/min, 100,000 req/day
- UNLIMITED: No limit (platform admin grant only)

### E.6 API Endpoints
```
GET    /api/v1/api-keys               → list org API keys (shows prefix + metadata, never full key)
POST   /api/v1/api-keys               → create new key → returns full raw key ONCE
PUT    /api/v1/api-keys/{id}          → update (name, scopes, rate_limit_tier, expires_at)
DELETE /api/v1/api-keys/{id}          → revoke (soft delete + add to revoked set in Redis)
POST   /api/v1/api-keys/{id}/rotate   → issue new key, set grace period 24h for old key
GET    /api/v1/api-keys/{id}/usage    → usage stats (requests today/week/month, by endpoint)
GET    /api/v1/api-keys/{id}/log      → recent request log (last 100 entries)
```

---
## MODULE 27-F: BRANDING PER TENANT

### F.1 Overview
Each org can customize its portal appearance: logo, primary color, custom domain, email sender
name. Stored in `tenant_settings.branding` JSONB. Applied via CSS variables and Next.js theme.

### F.2 Branding Schema (inside `tenant_settings.branding` JSONB)
```json
{
  "logo_url": "https://minio.../org-id/branding/logo.png",
  "favicon_url": "https://minio.../org-id/branding/favicon.ico",
  "primary_color": "#2563eb",
  "primary_color_dark": "#1d4ed8",
  "secondary_color": "#f59e0b",
  "company_display_name": "Acme Corp Procurement",
  "portal_title_suffix": "Acme Procurement Portal",
  "email_sender_name": "Acme Procurement Team",
  "email_sender_domain": "procurement.acme.com",
  "custom_domain": "procurement.acme.com",
  "custom_domain_verified": false,
  "custom_domain_cname_target": "buyer.procureos.com",
  "login_page_headline": "Welcome to Acme Procurement",
  "login_page_subheading": "Streamline your procurement workflow",
  "login_page_bg_image_url": null,
  "footer_text": "© 2026 Acme Corp. All rights reserved.",
  "support_email": "procurement-support@acme.com",
  "help_url": "https://help.acme.com/procurement"
}
```

### F.3 API Endpoints
```
GET  /api/v1/admin/branding           → current branding config
PUT  /api/v1/admin/branding           → update branding settings
POST /api/v1/admin/branding/logo      → upload logo (returns URL; stored in MinIO compliance-documents)
POST /api/v1/admin/branding/favicon   → upload favicon
GET  /api/v1/admin/branding/domain    → custom domain status + verification instructions
POST /api/v1/admin/branding/verify-domain → trigger DNS CNAME verification check
GET  /api/v1/public/branding/{org_slug} → PUBLIC endpoint for login page (no auth required)
```

### F.4 Public Branding Endpoint
Used by Next.js login page before user authenticates. Returns safe subset:
`{logo_url, primary_color, company_display_name, login_page_headline, login_page_subheading}`
Cached in CDN (Cache-Control: public, max-age=3600).

### F.5 Frontend
- CSS variables injected into `<style>` tag in `_document.tsx`: `--color-primary: {primary_color}`
- Logo in sidebar replaced dynamically from branding config
- Login page uses `getStaticProps` with `revalidate: 3600` to SSR branding per org slug
- Admin Settings → Branding page: live preview pane shows changes before save
- Color picker: hex input + visual palette with accessibility contrast checker (WCAG AA minimum)

---
## MODULE 27-G: EXPORT CENTER (ASYNC)

### G.1 Overview
Replace all synchronous CSV/Excel exports with async queue-based system.
User requests export → job queued → background processing → user notified → 7-day download link.
Handles large datasets (100k+ rows) without timeout or memory issues.

### G.2 Data Model

**New table: `export_jobs`**
```sql
id              UUID PK
org_id          UUID NOT NULL
requested_by    UUID NOT NULL REFERENCES users(id)
export_type     VARCHAR(100) NOT NULL  -- REQUISITIONS, RFQS, VENDORS, INVOICES, TICKETS, etc.
filters         JSONB DEFAULT '{}'     -- Applied filters snapshot
format          VARCHAR(10) DEFAULT 'CSV'  -- CSV, EXCEL, PDF
status          VARCHAR(20) DEFAULT 'QUEUED'  -- QUEUED, PROCESSING, COMPLETED, FAILED, EXPIRED
total_rows      INT
processed_rows  INT DEFAULT 0
file_path       VARCHAR(500)           -- MinIO path when complete
file_size_bytes BIGINT
presigned_url   TEXT                   -- Cached presigned URL (15 min TTL)
presigned_url_expires_at TIMESTAMP WITH TIME ZONE
error_message   TEXT
expires_at      TIMESTAMP WITH TIME ZONE  -- 7 days from completion
started_at      TIMESTAMP WITH TIME ZONE
completed_at    TIMESTAMP WITH TIME ZONE
version         INT DEFAULT 1
created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
deleted_at      TIMESTAMP WITH TIME ZONE
```

### G.3 Export Types Supported
```
REQUISITIONS | RFQS | BIDS | VENDORS | CONTRACTS | PURCHASE_ORDERS | GRN |
INVOICES | PAYMENTS | TICKETS | AUDIT_TRAIL | ANALYTICS_SPEND | ANALYTICS_VENDORS |
UNMAPPED_PRS | WORKFLOW_TASKS | USERS | API_KEY_USAGE
```

### G.4 API Endpoints
```
POST /api/v1/exports               → request new export (queues job, returns job_id)
GET  /api/v1/exports               → list user's export history (last 30 jobs)
GET  /api/v1/exports/{id}          → job status + download URL (when COMPLETED)
DELETE /api/v1/exports/{id}        → cancel QUEUED job or delete record
POST /api/v1/exports/{id}/refresh-url → generate fresh presigned URL (15 min)
```

### G.5 Celery Task
```python
@celery_app.task(queue="celery.exports", name="process_export_job")
def process_export_job(job_id: str, org_id: str):
    # 1. Load job from DB, set status=PROCESSING
    # 2. Run query with filters (same filters as UI listing)
    # 3. Stream to temp file (avoid loading all into memory)
    # 4. Upload to MinIO exports bucket
    # 5. Update job: status=COMPLETED, file_path, total_rows, file_size_bytes
    # 6. Publish notification to requested_by user
    # 7. Set expires_at = now() + 7 days
```

### G.6 Frontend — Export Center Page (`/export-center`)
Available in all 3 portals sidebar (new section "Tools"):
- List of past exports with status, type, row count, file size, expires-in countdown
- "Download" button when COMPLETED (fetches fresh presigned URL)
- "Cancel" button when QUEUED
- "New Export" button → modal with export type and filter selections
- Progress bar for PROCESSING jobs (polls status every 5s via TanStack Query refetchInterval)
- Toast notification when export completes (via WebSocket)

### G.7 "Export" buttons on all listing pages
Replace current synchronous download with async:
```tsx
// Before (sync):
<button onClick={() => window.location.href = '/api/v1/tickets/export'}>Export CSV</button>

// After (async):
<ExportButton exportType="TICKETS" filters={currentFilters} format="CSV" />
// ExportButton calls POST /api/v1/exports, shows "Export queued!" toast,
// user sees notification when ready
```

---
## MODULE 27-H: BUYER ACTIVITY REPORT UI

### H.1 Overview
Backend analytics data already exists. This module adds the frontend UI showing per-user
activity patterns, action heatmaps, and procurement velocity metrics.

### H.2 Data Sources (no new tables — reuses audit_logs + existing tables)
- `audit_logs`: every user action with timestamp
- `tickets`: tickets created per user
- `requisitions`: PRs submitted per user
- `workflow_tasks`: tasks completed per user (approval velocity)
- `api_key_usage_log`: programmatic access patterns

### H.3 Report Sections

**Section 1: User Activity Timeline**
- Per-user: list of actions in chronological order (audit_log entries)
- Filter by user, date range, action type
- Exportable via Export Center

**Section 2: Activity Heatmap**
- Calendar heatmap (GitHub contribution graph style)
- X-axis: days, Y-axis: hours of day
- Color intensity = number of actions in that hour
- Shows busiest procurement hours across the org

**Section 3: Buyer Performance League Table**
```
Rank | Buyer Name | PRs Created | PRs Approved | Avg Approval Time | Tickets Raised | SLA Compliance %
```

**Section 4: Procurement Velocity Metrics**
- PR to PO cycle time: histogram showing distribution (1d, 2d, ... 30d+)
- Approval turnaround: per step, per approver
- Bottleneck identification: which steps take longest on average
- Vendor response time: time from PO sent to vendor acknowledged

**Section 5: Login & Session Analytics (Admin only)**
- Login frequency per user
- Last login per user (for dormant user detection)
- Concurrent session counts
- Failed login attempts heatmap (security monitoring)

### H.4 API Endpoints
```
GET /api/v1/analytics/buyer-activity          → summary for current user (scope-aware)
GET /api/v1/analytics/buyer-activity/heatmap  → 52-week heatmap data
GET /api/v1/analytics/buyer-activity/users    → per-user stats table (PROCUREMENT_HEAD+ only)
GET /api/v1/analytics/buyer-activity/{user_id} → single user activity detail
GET /api/v1/analytics/procurement-velocity    → cycle time histogram data
GET /api/v1/analytics/bottlenecks             → approval step duration analysis
```

---
## MODULE 27-I: UAT OVERLAY / QA ROLE

### I.1 Overview
Add a `QA_TESTER` role that allows designated testers to perform UAT in a production-like
environment with visual overlay distinguishing test actions from real ones. Test entities
prefixed with `TEST_` and periodically purged. No real vendor emails sent in test mode.

### I.2 Changes Required

**New role: `QA_TESTER`**
Permissions: All `*.view_*` permissions + `*.create` + `*.submit` but NOT `*.approve` or `*.close`.
Cannot: Approve real workflow tasks, create real POs above threshold, send real vendor notifications.

**New column on multiple tables: `is_test_record BOOL DEFAULT FALSE`**
Add to: requisitions, rfqs, bid_responses, purchase_orders, invoices, tickets, vendors.

**New tenant_settings field: `qa_mode_enabled: bool`**
When TRUE: all records created by QA_TESTER users get `is_test_record = TRUE`.

**Test record isolation:**
- Test records EXCLUDED from all reports and analytics by default
- Analytics queries add `AND is_test_record = FALSE` automatically
- Separate "Test Mode" toggle in analytics to include test data

### I.3 UAT Overlay (Frontend)
```tsx
// In root layout — shown when user has QA_TESTER role:
<div className="fixed top-0 left-0 right-0 h-1 bg-amber-400 z-[9999]" />
<div className="fixed bottom-4 right-4 bg-amber-100 border border-amber-400 rounded-lg p-3 z-[9999]">
  <span className="text-amber-700 font-bold text-sm">🧪 UAT / Test Mode Active</span>
  <div className="text-xs text-amber-600">Actions create TEST records only</div>
</div>
```

### I.4 Test Data Purge
```python
@celery_app.task(queue="celery.maintenance", name="purge_test_records")
def purge_test_records():
    """Weekly: soft-delete all is_test_record=TRUE records older than 30 days."""
```

### I.5 API Middleware Addition
```python
# In request middleware: if current_user has QA_TESTER role, set request.state.is_test_mode = True
# All create endpoints check this flag and set is_test_record = True on created entities
# Notification service: if is_test_record → log notification instead of sending real email/SMS
```

---
## MODULE 27-J: PAYMENT GATEWAY (ONLINE)

### J.1 Overview
Wire online payment capability to the existing payment_records table. Buyers can initiate
auto-debit for approved invoices. Razorpay primary (India), Stripe international fallback.
Payment gateway webhooks update payment_records status.

### J.2 Data Model Additions

**Alter `payment_records` table — add columns:**
```sql
payment_method       VARCHAR(30)    -- BANK_TRANSFER, RAZORPAY, STRIPE, NEFT, RTGS, CHEQUE
gateway_provider     VARCHAR(20)    -- RAZORPAY, STRIPE, MANUAL
gateway_order_id     VARCHAR(200)   -- Provider's order/payment intent ID
gateway_payment_id   VARCHAR(200)   -- Provider's payment ID (after capture)
gateway_signature    VARCHAR(500)   -- Verification signature from gateway webhook
gateway_fee          NUMERIC(15,2)  -- Transaction fee charged by gateway
gateway_fee_currency CHAR(3)
gateway_response     JSONB          -- Full provider response (for reconciliation)
refund_id            VARCHAR(200)   -- If payment refunded
refunded_at          TIMESTAMP WITH TIME ZONE
refund_amount        NUMERIC(15,2)
refund_reason        TEXT
payment_link_url     VARCHAR(500)   -- Razorpay payment link URL (for email to vendor)
payment_link_expires_at TIMESTAMP WITH TIME ZONE
```

**New table: `payment_gateway_config`** (per org, encrypted)
```sql
id                UUID PK
org_id            UUID NOT NULL UNIQUE
razorpay_key_id   TEXT              -- Encrypted via Fernet
razorpay_secret   TEXT              -- Encrypted via Fernet
stripe_pub_key    TEXT
stripe_secret     TEXT              -- Encrypted
default_provider  VARCHAR(20) DEFAULT 'RAZORPAY'
auto_pay_enabled  BOOL DEFAULT FALSE
auto_pay_threshold NUMERIC(15,2)   -- Only auto-pay invoices below this amount
virtual_account_id VARCHAR(200)     -- Razorpay virtual account for collections
webhook_secret    VARCHAR(200)      -- Gateway webhook verification secret (encrypted)
is_configured     BOOL DEFAULT FALSE
version           INT DEFAULT 1
created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### J.3 Payment Flow
```
1. Invoice approved → payment_record created with status=SCHEDULED
2. Buyer clicks "Pay Now" OR auto-pay threshold triggers
3. POST /api/v1/payments/{id}/initiate-gateway-payment
   → Creates Razorpay order or Stripe payment intent
   → Returns checkout URL or payment link
4. Gateway processes payment → fires webhook to /api/v1/webhooks/gateway/razorpay
5. Webhook handler verifies signature → updates payment_record: status=PAID, gateway_payment_id
6. Notification sent to vendor: payment processed
7. ERP sync: payment record synced to ERP via integration job
```

### J.4 API Endpoints
```
POST /api/v1/payments/{id}/initiate-gateway-payment → create gateway order, return checkout URL
GET  /api/v1/payments/{id}/gateway-status           → check live status from gateway API
POST /api/v1/webhooks/gateway/razorpay              → PUBLIC: Razorpay webhook receiver
POST /api/v1/webhooks/gateway/stripe                → PUBLIC: Stripe webhook receiver
POST /api/v1/payments/{id}/refund                   → initiate refund (FINANCE_CONTROLLER)
GET  /api/v1/admin/payment-gateway                  → gateway configuration
PUT  /api/v1/admin/payment-gateway                  → update gateway config (encrypted save)
POST /api/v1/admin/payment-gateway/test             → test connection with saved credentials
GET  /api/v1/admin/payment-gateway/reconciliation   → reconcile portal records vs gateway records
```

### J.5 Security
- Webhook signature verified BEFORE processing (HMAC-SHA256 for Razorpay, Stripe-Signature for Stripe)
- Gateway credentials stored encrypted (Fernet, same as field-level encryption)
- Payment initiation requires `payment.initiate` permission (new — added to FINANCE_CONTROLLER role)
- Idempotency: same payment_record cannot be initiated twice (check gateway_order_id IS NULL)
- Refund requires dual approval (FINANCE_CONTROLLER + CFO) via workflow

### J.6 Frontend
- Invoice detail page: "Pay Online" button (shown if gateway configured + invoice APPROVED)
- Payment status widget: shows RAZORPAY/STRIPE icon + status + transaction ID
- Admin Settings → Payment Gateway: config form + test connection + reconciliation report
- Buyer Analytics: payment method breakdown chart (Bank Transfer vs Online vs Razorpay)

