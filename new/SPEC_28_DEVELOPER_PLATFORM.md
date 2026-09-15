# SPEC_28: Developer Platform — Standalone App
**Version:** 1.0 | **Phase:** Enhancement | **Squad:** A (Platform)
**App:** developer.procureos.com (Next.js 14, port 3003)
**Depends on:** SPEC_04 (auth/API keys), SPEC_27-E (API Key Management)

---
## 1. OVERVIEW

A standalone developer portal for integration teams, third-party developers, and internal
engineers building on top of the ProcureOS API. Completely separate Next.js app — not visible
to buyers or suppliers. Authentication via API keys OR developer SSO (Google/GitHub OIDC).

### 1.1 Who Uses It
| User Type | Access |
|---|---|
| Internal engineers | All sections, sandbox management |
| Third-party integrators | Docs, sandbox, their own API keys |
| QA engineers | Sandbox, test data management |
| Implementation partners | Docs, changelog, limited sandbox |

---
## 2. MODULE 28-A: DEVELOPER SANDBOX

### 2.1 Overview
Isolated PostgreSQL schema (`sandbox` schema) with fake seed data. API requests to
`/sandbox/*` endpoints use sandbox data only. Sandbox state can be reset at any time.
Each developer or team gets their own sandbox organization.

### 2.2 Sandbox Architecture
```
Production DB: schema "public" — real org data, RLS enforced
Sandbox DB:    schema "sandbox" — same table structure, fake data, no RLS (isolated by sandbox_org_id)
```
OR: Separate lightweight PostgreSQL instance for sandbox (recommended for resource isolation).

### 2.3 Sandbox Features
```
- "Reset Sandbox" button → truncates all sandbox tables, re-seeds fake data
- Seed data includes: 1 org, 5 BUs, 20 users with different roles, 15 vendors,
  50 PRs in various statuses, 10 RFQs, 20 bids, 5 contracts, 10 POs, 10 invoices
- Fake vendor emails: all redirect to /dev/null (no real emails sent)
- Fake payment gateway: always returns SUCCESS for any payment
- ERP simulation: fake SAP endpoint that accepts any payload and returns 200
- Time travel: ability to artificially advance time (test SLA breaches, contract expiry)
- Pre-built scenarios: "PR to PO in 5 steps", "Vendor blacklisting flow", "Invoice discrepancy"
```

### 2.4 New Table: `sandbox_orgs`**
```sql
id              UUID PK
developer_id    UUID NOT NULL REFERENCES developer_accounts(id)
org_name        VARCHAR(200) DEFAULT 'Sandbox Org'
sandbox_org_id  UUID NOT NULL  -- org_id used in sandbox schema
api_key_test    VARCHAR(100)   -- pre-generated test API key (prc_test_...)
reset_count     INT DEFAULT 0
last_reset_at   TIMESTAMP WITH TIME ZONE
created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### 2.5 API Endpoints (all under /sandbox/api/v1/*)
```
POST /sandbox/api/v1/sandbox/reset          → reset sandbox to clean state
GET  /sandbox/api/v1/sandbox/status         → seed data summary (counts per entity)
POST /sandbox/api/v1/sandbox/time-travel    → body: {advance_by_days: 30}
GET  /sandbox/api/v1/sandbox/scenarios      → list of pre-built test scenarios
POST /sandbox/api/v1/sandbox/scenarios/{id}/run → execute a pre-built scenario
```

---
## 3. MODULE 28-B: SDK / CODE SNIPPETS

### 3.1 Overview
Auto-generated client libraries from OpenAPI spec, downloadable via developer portal.
Also a live code snippet explorer: choose language, pick endpoint, get ready-to-run code.

### 3.2 Supported Languages
```
Python    → procureos-python SDK (generated via openapi-generator-cli)
Node.js   → procureos-node SDK (TypeScript, generated)
Go        → procureos-go SDK (generated)
Java      → procureos-java SDK (generated)
cURL      → Shell script examples
PHP       → procureos-php SDK
```

### 3.3 SDK Generation Pipeline
```bash
# CI job runs on every API version bump:
openapi-generator-cli generate \
  -i http://api.procureos.com/api/v1/openapi.json \
  -g python \
  -o sdks/procureos-python \
  --additional-properties=packageName=procureos,packageVersion=1.2.3

# Packages pushed to:
# - PyPI: procureos-python
# - npm: @procureos/sdk
# - GitHub Packages: procureos/procureos-go
```

### 3.4 Code Snippet Explorer (Frontend Component)
```
Left panel: API endpoint browser (same structure as OpenAPI spec)
Right panel: Language tabs (Python | Node.js | cURL | Go)
Below endpoint selection → live code example with:
  - Auth header with user's test API key pre-filled
  - Required parameters with example values
  - Copy button
  - "Run in Sandbox" button → executes against sandbox, shows response
```

### 3.5 Table: `sdk_downloads`** (analytics)
```sql
id              UUID PK
developer_id    UUID REFERENCES developer_accounts(id)
sdk_language    VARCHAR(50)
sdk_version     VARCHAR(20)
downloaded_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
ip_address      INET
```

---
## 4. MODULE 28-C: PUBLIC CHANGELOG & API VERSIONING

### 4.1 Overview
Developer-facing changelog showing API version history, breaking changes, deprecations,
and upcoming sunset dates. Feeds RSS/Atom for programmatic consumption.

### 4.2 Table: `api_changelog`**
```sql
id              UUID PK
version         VARCHAR(20) NOT NULL   -- e.g. "1.3.0", "2.0.0"
release_date    DATE NOT NULL
release_type    VARCHAR(20)            -- MAJOR, MINOR, PATCH, SECURITY
title           VARCHAR(500) NOT NULL
description     TEXT NOT NULL          -- Markdown supported
breaking_changes JSONB DEFAULT '[]'    -- [{endpoint, old_behavior, new_behavior, migration_guide}]
deprecations    JSONB DEFAULT '[]'     -- [{endpoint, sunset_date, replacement}]
new_features    JSONB DEFAULT '[]'
bug_fixes       JSONB DEFAULT '[]'
is_published    BOOL DEFAULT FALSE
published_at    TIMESTAMP WITH TIME ZONE
authored_by     VARCHAR(200)           -- Author name (not FK — could be contractor)
version         INT DEFAULT 1
created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### 4.3 API Endpoints (no auth required — public)
```
GET /api/v1/public/changelog           → list published entries (newest first)
GET /api/v1/public/changelog/{version} → single version detail
GET /api/v1/public/changelog/rss       → RSS 2.0 feed
GET /api/v1/public/changelog/atom      → Atom 1.0 feed
GET /api/v1/public/api-versions        → list of supported API versions + status
```

### 4.4 Admin Endpoints (internal team)
```
POST /api/v1/admin/changelog           → create changelog entry (draft)
PUT  /api/v1/admin/changelog/{id}      → update entry
POST /api/v1/admin/changelog/{id}/publish → publish entry
GET  /api/v1/admin/changelog/deprecation-report → list all active deprecations + sunset dates
```

### 4.5 Deprecation Header Injection (existing `core/deprecation.py`)
When a deprecated endpoint is called, inject headers:
```
Deprecation: true
Sunset: Mon, 01 Jan 2027 00:00:00 GMT
Link: <https://developer.procureos.com/changelog/v2.0.0>; rel="successor-version"
```
These sunset dates come from `api_changelog.deprecations` JSONB — not hardcoded.

### 4.6 Frontend Pages
- `/changelog` — Timeline of all versions (GitHub-style release notes layout)
- `/changelog/{version}` — Single version: breaking changes in red, new features in green, deprecations in amber
- `/api-versions` — Supported versions table with sunset dates
- RSS widget: "Subscribe to changelog" → copy RSS URL
- Breaking change alert banner for logged-in devs with active API keys hitting deprecated endpoints

---
## 5. MODULE 28-D: RATE LIMITING DASHBOARD

### 5.1 Overview
Per-API-key rate limit visualization. Shows quota consumption, throttle events, top endpoints
by request volume, and time-series charts.

### 5.2 Data Sources
- `api_key_usage_log` table (partitioned monthly, 90-day retention)
- Kong rate limiting plugin events (forwarded via Prometheus metrics)
- Redis rate limit counters (real-time current window usage)

### 5.3 Dashboard Sections

**Real-time Quota Widget**
```
API Key: prc_live_a1b2...
Standard Tier: 100 req/min
Current: 23/100 (23%) ████░░░░░░
Daily: 4,521/10,000 (45%) ████████░░
```

**Request Volume Chart** (recharts AreaChart)
- X: time (last 24h in 15-min buckets, or last 7d in hourly buckets)
- Y: requests per bucket
- Series: 2xx (green), 4xx (amber), 5xx (red)
- Overlay: rate limit threshold line

**Throttle Events Log**
```
Table: Timestamp | Endpoint | Requests in Window | Limit | Retry-After
```

**Top Endpoints by Volume**
```
Ranked list: endpoint | avg response time | error rate | total requests (last 24h)
```

**Per-Key Comparison** (for orgs with multiple keys)
Side-by-side quota consumption chart per key.

### 5.4 API Endpoints
```
GET /api/v1/api-keys/{id}/rate-limit-status    → real-time quota from Redis
GET /api/v1/api-keys/{id}/usage-timeseries     → time-series data for charts
GET /api/v1/api-keys/{id}/throttle-events      → list of throttle events (30-day)
GET /api/v1/api-keys/{id}/top-endpoints        → top N endpoints by request count
GET /api/v1/admin/rate-limits                  → org-wide rate limit overview
```

### 5.5 Alert Configuration
```
Admins can set alerts on API key usage:
- "Notify me when daily quota > 80%"
- "Notify me on any throttle event"
Published via procurement.notification exchange → email/in-app
```

---
## 6. MODULE 28-E: API DOCUMENTATION HUB

### 6.1 Overview
Branded developer documentation portal combining:
1. Auto-generated Swagger UI (from /openapi.json)
2. Hand-written guides and tutorials
3. Authentication guide
4. Integration recipes ("How to sync POs to SAP")
5. Embedded code sandbox

### 6.2 Architecture
```
developer.procureos.com (Next.js 14 standalone app, port 3003)
├── / → Landing page with quick-start CTA
├── /docs → Documentation landing (category tree)
│   ├── /docs/getting-started → Auth, first API call, sandbox setup
│   ├── /docs/authentication → API keys, OAuth, JWT explanation
│   ├── /docs/webhooks → Webhook setup, event catalog, signature verification
│   ├── /docs/sdks → SDK downloads and installation guides
│   ├── /docs/guides → Integration recipes (ERP, HRMS, GEM)
│   └── /docs/errors → Error code reference
├── /reference → Interactive Swagger/Redoc API reference
│   └── Auto-rendered from /api/v1/openapi.json
├── /sandbox → Developer sandbox console
├── /changelog → API changelog
├── /rate-limits → Rate limit dashboard (authenticated)
├── /keys → API key management (authenticated)
└── /status → Platform status page (uptime, incidents)
```

### 6.3 Table: `doc_pages`** (CMS for hand-written docs)
```sql
id              UUID PK
slug            VARCHAR(300) NOT NULL UNIQUE  -- /docs/getting-started
title           VARCHAR(500) NOT NULL
content         TEXT NOT NULL                 -- MDX (Markdown + JSX components)
category        VARCHAR(100)
sort_order      INT DEFAULT 0
is_published    BOOL DEFAULT FALSE
last_edited_by  VARCHAR(200)
version         INT DEFAULT 1
created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### 6.4 Platform Status Page (`/status`)
```
Overall Status: ● Operational

Component Status:
  API (api.procureos.com)          ● Operational — 99.98% uptime (30d)
  Buyer Portal (app.procureos.com) ● Operational
  Supplier Portal                   ● Operational
  Admin Portal                      ● Operational
  Sandbox Environment               ● Degraded (scheduled maintenance)

Recent Incidents:
  2026-07-28: Database failover — resolved in 12 minutes
  2026-07-15: API latency spike — resolved

Subscribe to incidents: RSS feed or email
```

Status data from: Prometheus healthcheck metrics + manual incident CMS entries.

### 6.5 Developer Account Model

**New table: `developer_accounts`**
```sql
id              UUID PK
email           VARCHAR(255) NOT NULL UNIQUE
full_name       VARCHAR(255)
company         VARCHAR(255)
auth_provider   VARCHAR(20) DEFAULT 'EMAIL'  -- EMAIL, GOOGLE, GITHUB
auth_provider_id VARCHAR(255)               -- OAuth sub claim
is_verified     BOOL DEFAULT FALSE
is_internal     BOOL DEFAULT FALSE           -- Internal Anthropic/company engineers
sandbox_org_id  UUID                         -- Their sandbox org
api_keys_count  INT DEFAULT 0
last_login_at   TIMESTAMP WITH TIME ZONE
version         INT DEFAULT 1
created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
deleted_at      TIMESTAMP WITH TIME ZONE
```

### 6.6 Developer Auth (separate from main procurement auth)
- Sign up with email + password OR Google/GitHub OIDC
- Email verification required
- JWT scoped to developer platform (separate RS256 key pair)
- No access to production procurement data (only sandbox)
- Developer JWT does NOT work on /api/v1/* endpoints (separate auth path)

