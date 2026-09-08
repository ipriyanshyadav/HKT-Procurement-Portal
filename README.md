# 🏢 S2P Procurement Portal

> **Enterprise Source-to-Pay Platform** built with **FastAPI**, **Next.js 14 Turborepo**, **PostgreSQL**, **RabbitMQ**, and **Kong Gateway**.

---

### 🌐 Portals & Demo Accounts

All three portals run simultaneously with seeded test roles. Access them directly in your browser:

| Portal | Local URL | Primary Users | Demo Account | Password | Assigned Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Buyer Portal** | [http://localhost:3000](http://localhost:3000) | Procurement Team (PRs, RFQs, Bids) | `buyer@procurement.com` | `Buyer123456!@#` | `REQUESTOR`, `BUYER`, `PROCUREMENT_OFFICER` |
| **Buyer Portal (Approver)** | [http://localhost:3000](http://localhost:3000) | Approvers & Leadership (Sign-offs) | `approver@procurement.com` | `Approver123!@#` | `APPROVER`, `PROCUREMENT_HEAD`, `FINANCE_MANAGER` |
| **Supplier Portal** | [http://localhost:3001](http://localhost:3001) | External Vendors (Bids, Invoices) | `supplier@acme.com` | `Supplier123456!@#` | `SUPPLIER` (Acme Tech Solutions) |
| **Admin Portal** | [http://localhost:3002](http://localhost:3002) | System Administrators (Master Data) | `admin@procurement.com` | `Admin123456!@#` | `SUPERADMIN`, `ORG_ADMIN`, `PROCUREMENT_MANAGER` |

> 🔑 **Organization ID for all logins:** `00000000-0000-0000-0000-000000000001` (Default Organization)
>
> 🚪 **API Gateway (Kong):** [http://localhost:8000](http://localhost:8000) &nbsp;•&nbsp; **Direct Backend API:** [http://localhost:8080](http://localhost:8080)
>
> 📘 **Git & CI/CD Guide:** [Complete Beginner Guide to Git, GitHub & Branching](docs/GIT_AND_CICD_GUIDE.md)
>
> 🪟 **Windows PC Guide:** [Running Docker on Windows (WSL2 Setup & Troubleshooting)](docs/WINDOWS_DOCKER_GUIDE.md)

---

## ⚡ Quickstart & Verification

### Mode 1: Complete Docker Stack (Fastest)

Start all services (PostgreSQL, Redis, RabbitMQ, MinIO, Kong, FastAPI, Celery, and all 3 Next.js Portals) in Docker:

```bash
docker compose -f docker/docker-compose.yml up -d
```

---

### Mode 2: Local Development (Hybrid)

Run databases and message queues in Docker while developing FastAPI and Next.js locally:

```bash
# 1. Start backing services only in Docker (do NOT start kong or api)
docker compose -f docker/docker-compose.yml up -d postgres redis rabbitmq minio jaeger elasticsearch

# 2. Initialize schema, messaging topology & seed data
.venv/bin/python scripts/generate_rsa_keys.py
.venv/bin/alembic upgrade head
.venv/bin/python scripts/rabbitmq_setup.py
.venv/bin/python scripts/minio_setup.py
.venv/bin/python scripts/seed_master_data.py
.venv/bin/python scripts/seed_demo_user.py

# 3. Start API backend locally on port 8000 (direct mode, no Kong)
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 4. Start Celery worker locally
.venv/bin/celery -A app.tasks.celery_app worker -l info

# 5. Start frontends locally
cd procurement-portal-frontend && pnpm dev
```

---

### Quick Test Commands

```bash
# Backend unit tests
.venv/bin/pytest tests/unit/ -v

# Frontend typecheck
cd procurement-portal-frontend && pnpm run typecheck
```

---

## 🛠️ Step-by-Step Local Setup

Follow these structured steps for a clean, brand-new environment.

### Step 1 — Prerequisites & Environment

Make sure every tool below is installed on your machine:

| Tool | Minimum Version | Install Command / Link |
| :--- | :--- | :--- |
| **Python** | 3.14+ | `brew install python@3.14` (macOS) / [python.org](https://python.org) |
| **pip / pip3** | bundled with Python | — |
| **Node.js** | 20 LTS+ | `brew install node` / [nodejs.org](https://nodejs.org) |
| **pnpm** | 9+ | `npm install -g pnpm` |
| **Docker Desktop** | 4.x+ | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Docker Compose** | v2 (bundled in Desktop) | `docker compose version` |
| **Git** | 2.x+ | `brew install git` |

Verify everything is ready:

```bash
python3 --version      # Python 3.14.x
node --version         # v20.x.x
pnpm --version         # 9.x.x
docker --version       # Docker version 26.x.x
docker compose version # Docker Compose version v2.x.x
git --version          # git version 2.x.x
```

Clone the repository and set up the Python virtual environment:

```bash
git clone <your-repo-url> procurement-portal
cd procurement-portal

python3 -m venv .venv
source .venv/bin/activate

pip install --upgrade pip
pip install -e .

cd procurement-portal-frontend && pnpm install && cd ..
```

---

### Step 2 — Configuration & Environment Variables (`.env`)

Copy the documented template:

```bash
cp .env.example .env
```

#### Understanding the Template

`.env.example` is divided into sections. Here is what each section is for and what you need to do:

| Section | What it controls | Action required? |
| :--- | :--- | :--- |
| **# Application** | App version, environment, debug flag | ✅ Leave as-is for local dev (`ENVIRONMENT=local`, `DEBUG=true`) |
| **# Database** | PostgreSQL connection URLs and pool settings | ✅ Leave default credentials or update to match PostgreSQL |
| **# PostgreSQL (docker-compose)** | Credentials Docker uses to initialize the DB container | ✅ Must match `DATABASE_URL` credentials |
| **# Redis** | Cache, sessions, rate limits, Celery backend | ✅ Leave as-is (default `localhost:6379`) |
| **# RabbitMQ** | Message queue connection & vhost | ✅ Default `guest / guest` on `localhost:5672` with `/procurement` vhost |
| **# MinIO** | Object storage (documents, attachments) | ✅ Use `minioadmin / minioadmin` on port `9000` for local dev |
| **# JWT / Auth** | Key file paths + token expiry settings | ⚠️ Key paths default to `keys/*.pem` — generated in Step 3 |
| **# Field Encryption** | AES-256 encryption key for sensitive DB columns | ✅ Must generate — see command below |
| **# ClamAV Antivirus** | Document antivirus scanning | ⬜ Disabled by default (`CLAMAV_ENABLED=false`) for local dev |
| **# Enterprise SSO (SAML / OIDC)** | Corporate identity providers (SAML 2.0 / Azure AD OIDC) | ⬜ Leave blank unless configuring corporate SSO |
| **# External Services** | SendGrid, Razorpay, MSG91, Twilio, Digio, DocuSign | ⬜ Leave blank for local dev — features degrade gracefully (see 2c) |
| **# Observability** | OpenTelemetry, Jaeger host/port, Elasticsearch | ✅ Leave as-is (`localhost:4317` & `localhost:9200`) |
| **# CORS** | Allowed frontend origins | ✅ Pre-configured for ports `3000`, `3001`, `3002` (both `localhost` and `127.0.0.1`) |
| **# Celery** | Task queues, broker, result backend & schedules | ✅ Leave as-is |
| **# Business Rules** | Thresholds, limits, SLAs, aging alert windows | ✅ Leave as-is |
| **# Superadmin Seed** | First admin account credentials | ✅ Default `admin@procurement.com` / `Admin123456!@#` |
| **# Grafana** | Dashboard admin password | ✅ Set any password (default `admin`) |
| **# Frontend Portals** | API & WebSocket URLs called by Next.js apps | ✅ Leave as-is (Kong Gateway on port 8000; direct API on 8080) |

Generate the mandatory 32-byte URL-safe base64 field encryption key:

```bash
python3 -c "import secrets, base64; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
```

#### 2a — Minimum Required `.env` Values for Local Dev

Copy these default values into `.env` (replacing `<paste generated key here>` with your generated encryption key):

```dotenv
# --- PostgreSQL ---
POSTGRES_USER=app_user
POSTGRES_PASSWORD=dev_password_123
POSTGRES_DB=procurement
DATABASE_URL=postgresql+asyncpg://app_user:dev_password_123@localhost:5432/procurement
ANALYTICS_DATABASE_URL=postgresql+asyncpg://app_user:dev_password_123@localhost:5432/procurement

# --- Redis ---
REDIS_URL=redis://localhost:6379/0

# --- RabbitMQ ---
RABBITMQ_URL=amqp://app_user:dev_password_123@localhost:5672/procurement
RABBITMQ_USER=app_user
RABBITMQ_PASSWORD=dev_password_123
RABBITMQ_PASS=dev_password_123
RABBITMQ_VHOST=/procurement

# --- MinIO ---
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# --- Field Encryption (REQUIRED) ---
FIELD_ENCRYPTION_KEY=<paste generated key here>

# --- Superadmin Seed ---
SUPERADMIN_EMAIL=admin@yourcompany.com
SUPERADMIN_PASSWORD=SecurePass123!
SUPERADMIN_ORG_NAME="Acme Corp"
SUPERADMIN_ORG_CODE="ACME"

# --- Grafana ---
GRAFANA_PASSWORD=admin

# --- Frontend Portals ---
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
INTERNAL_API_URL=http://api:8000
```

#### 2b — JWT Authentication Key Paths

Leave `JWT_PRIVATE_KEY_PATH` and `JWT_PUBLIC_KEY_PATH` at their defaults (`keys/private.pem` and `keys/public.pem`). Step 3 generates the RSA-256 key pair:

```dotenv
JWT_PRIVATE_KEY_PATH=keys/private.pem
JWT_PUBLIC_KEY_PATH=keys/public.pem
```

#### 2c — External Services (Optional for Local Dev)

Third-party integrations degrade gracefully if omitted for local development:

| Variable | Service | What breaks if missing |
| :--- | :--- | :--- |
| `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` | Email delivery | Notification emails not sent |
| `MSG91_AUTH_KEY` / `MSG91_SENDER_ID` | SMS delivery | SMS notifications not sent |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | SMS (alternative) | SMS notifications not sent |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Payment gateway | Payment initiation disabled |
| `DIGIO_CLIENT_ID` / `DIGIO_CLIENT_SECRET` | e-Signing (Digio) | Digital signature flow disabled |
| `DOCUSIGN_ACCOUNT_ID` / `DOCUSIGN_INTEGRATION_KEY` | e-Signing (DocuSign) | DocuSign flow disabled |
| `GST_API_KEY` / `NSDL_API_KEY` | GST/PAN verification | Compliance checks skipped |
| `SAML_IDP_METADATA_URL` | SAML SSO | SSO login unavailable |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` / `OIDC_DISCOVERY_URL` | OIDC / Azure AD SSO | OIDC login unavailable |

#### 2d — Sanity Check Before Continuing

```bash
# Check that no <REPLACE_ME> placeholders remain in required fields
grep "<REPLACE_ME>" .env

# Verify the encryption key is present
grep "FIELD_ENCRYPTION_KEY" .env
```

---

### Step 3 — Generate RSA Keys (JWT Auth)

```bash
python3 scripts/generate_rsa_keys.py
```

This creates `keys/private.pem` and `keys/public.pem`.

---

### Step 4 — Start Backing Services (Docker)

```bash
docker compose -f docker/docker-compose.yml up -d \
  postgres redis rabbitmq minio jaeger prometheus grafana clamav elasticsearch
```

Wait ~20 seconds for services to become healthy. If any service shows unhealthy, inspect its logs:

```bash
docker compose -f docker/docker-compose.yml logs <service-name>
```

---

### Step 5 — Database Migrations & Messaging Setup

```bash
# 1. Apply all 38 database migrations
alembic upgrade head
# Expected output ends with:
# INFO  [alembic.runtime.migration] Running upgrade ... -> 0037_trgm_search_indexes

# 2. Verify migration head
alembic current
# Expected: 0037_trgm_search_indexes (head)

# 3. Setup RabbitMQ topology & MinIO buckets
python3 scripts/rabbitmq_setup.py
python3 scripts/minio_setup.py
```

---

### Step 6 — Seed Master Data & Create Superadmin

```bash
# Seed reference data and demo accounts
python3 scripts/seed_master_data.py
python3 scripts/seed_demo_user.py
python3 scripts/seed_workflows.py
python3 scripts/seed_notification_templates.py
python3 scripts/seed_demo_notifications.py
python3 scripts/seed_catalog_items.py

# Create superadmin account
python3 scripts/create_superadmin.py
```

Expected output for superadmin creation:

```
✅ Organisation "Acme Corp" created
✅ Superadmin admin@yourcompany.com created with SUPERADMIN role
```

---

### Step 7 (Docker Mode) — Start All Remaining Application Containers

Run from the project root:

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

(Alternatively, simply `docker compose up -d --build` from the root directory).

This builds and launches the API backend (`api`), API Gateway (`kong`), background workers (`celery-worker`, `celery-beat`), and all three Next.js portals (`buyer-portal`, `supplier-portal`, `admin-portal`) in the background.

---

### Step 7 (Alternative: Local / Hybrid Mode) — Start Application Services Locally

Open separate terminal windows (ensure `.venv` is activated):

```bash
# Terminal 1 — Backend API (port 8080 behind Kong, or 8000 for direct dev)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080

# Terminal 2 — Background Celery Worker
celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4

# Terminal 3 — Scheduled Tasks (Celery Beat)
celery -A app.tasks.celery_app beat --loglevel=info

# Terminal 4 — API Gateway (Kong on port 8000)
docker compose -f docker/docker-compose.yml up -d kong

# Terminal 5 — Frontend Portals (Turborepo Next.js)
cd procurement-portal-frontend
pnpm dev
```

---

## 🔍 Full-Stack Verification Checklist

Run these quick checks to verify complete system health:

```bash
# 1. API Gateway health (Kong)
curl http://localhost:8000/health
# → {"status":"ok","version":"1.0.0"}

# 2. Direct Backend health (FastAPI)
curl http://localhost:8080/health
# → {"status":"ok","version":"1.0.0"}

# 3. Superadmin API authentication (get JWT access token)
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@procurement.com","password":"Admin123456!@#","org_id":"00000000-0000-0000-0000-000000000001"}' | python3 -m json.tool

# 4. PostgreSQL connectivity (lists all ~30+ tables)
docker compose -f docker/docker-compose.yml exec postgres \
  psql -U app_user -d procurement -c "\dt" | head -20

# 5. Redis connectivity
docker compose -f docker/docker-compose.yml exec redis redis-cli ping
# → PONG
```

Interactive API Documentation:
- **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs) (or direct: [http://localhost:8080/docs](http://localhost:8080/docs))
- **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc) (or direct: [http://localhost:8080/redoc](http://localhost:8080/redoc))

---

## 🔄 Rebuilding Docker Containers

Pass the `--build` flag to force Docker Compose to recompile the Next.js apps and re-copy the Python codebase:

```bash
docker compose down
docker compose up -d --build
```

*(Alternatively, if passing the file path explicitly: `docker compose -f docker/docker-compose.yml down && docker compose -f docker/docker-compose.yml up -d --build`)*

If you want to ensure a 100% clean rebuild without using any Docker build cache layers:

```bash
docker compose build --no-cache
docker compose up -d
```

---

## 🧪 Testing Suite

```bash
# Backend unit tests (fast, no infrastructure required)
pytest tests/unit/ -v

# Full test suite with coverage gate (requires running infra)
pytest tests/ -v --cov=app --cov-fail-under=80

# Auth & Security tests with 85% coverage gate
pytest tests/ -v --cov=app/auth --cov=app/modules/user --cov-fail-under=85

# Backend integration tests
pytest tests/integration/ -v

# Frontend TypeScript validation & unit tests
cd procurement-portal-frontend
pnpm run typecheck
pnpm test

# Frontend production build validation (all 3 portals)
pnpm run build
```

---

## 🔌 Service Port Directory

| Service | Local URL / Port | Protocol | Description | Live Logs Command |
| :--- | :--- | :--- | :--- | :--- |
| **FastAPI Backend** | [http://localhost:8080](http://localhost:8080) | HTTP | Direct API & Uvicorn ASGI server | `docker compose logs -f api` |
| **All Portals (Combined)** | Ports 3000, 3001, 3002 | HTTP | Combined stream for all 3 frontends | `docker compose logs -f buyer-portal supplier-portal admin-portal` |
| **Buyer Portal** | [http://localhost:3000](http://localhost:3000) | HTTP | Next.js Buyer app (PRs, RFQs, POs) | `docker compose logs -f buyer-portal` |
| **Supplier Portal** | [http://localhost:3001](http://localhost:3001) | HTTP | Next.js Supplier app (Bids, Invoices) | `docker compose logs -f supplier-portal` |
| **Admin Portal** | [http://localhost:3002](http://localhost:3002) | HTTP | Next.js Admin app (Settings, Master Data) | `docker compose logs -f admin-portal` |
| **Kong Gateway** | [http://localhost:8000](http://localhost:8000) | HTTP | API Gateway proxy for frontend traffic | `docker compose logs -f kong` |
| **Celery Worker** | *(Internal)* | TCP | Asynchronous background tasks & outbox | `docker compose logs -f celery-worker` |
| **Celery Beat** | *(Internal)* | TCP | Scheduled periodic tasks | `docker compose logs -f celery-beat` |
| **PostgreSQL** | `localhost:5432` | TCP | Relational database (PgBouncer on 6432) | `docker compose logs -f postgres` |
| **Redis** | `localhost:6379` | TCP | Caching, session store & task broker | `docker compose logs -f redis` |
| **RabbitMQ UI** | [http://localhost:15672](http://localhost:15672) | HTTP | Message broker UI (`guest` / `guest`) | `docker compose logs -f rabbitmq` |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) | HTTP | Object storage UI (`minioadmin` / `minioadmin`) | `docker compose logs -f minio` |
| **Grafana** | [http://localhost:3003](http://localhost:3003) | HTTP | Metrics dashboards (`admin` / `$GRAFANA_PASSWORD`) | `docker compose logs -f grafana` |
| **Jaeger UI** | [http://localhost:16686](http://localhost:16686) | HTTP | Distributed trace visualization | `docker compose logs -f jaeger` |
| **Prometheus** | [http://localhost:9090](http://localhost:9090) | HTTP | Metrics collection server | `docker compose logs -f prometheus` |
| **ClamAV** | `localhost:3310` | TCP | Antivirus scanning service (internal) | `docker compose logs -f clamav` |

### 📜 Live Terminal Log Streaming

Stream real-time terminal output (Uvicorn requests, SQL queries, errors, Next.js logs, background tasks):

```bash
# 🖥️ All Frontend Portals in a single command (Buyer, Supplier & Admin combined):
docker compose logs -f buyer-portal supplier-portal admin-portal

# Individual portal frontend logs:
docker compose logs -f buyer-portal
docker compose logs -f supplier-portal
docker compose logs -f admin-portal

# FastAPI / Uvicorn server logs (shows live incoming HTTP requests, errors, SQL queries)
docker compose logs -f api

# Direct Docker container command alternative for API:
docker logs -f procurement_api

# Celery background worker logs (shows async jobs, emails, virus scans)
docker compose logs -f celery-worker

# Kong API Gateway proxy logs
docker compose logs -f kong

# Stream all running container logs simultaneously with timestamps
docker compose logs -f -t
```

---

## 🏗️ Architecture & Tech Stack

| Domain | Technology | Key Highlights |
| :--- | :--- | :--- |
| **API & Core** | FastAPI 0.115+, Python 3.14, Uvicorn | Async ASGI, Pydantic v2 validation |
| **Database & ORM** | SQLAlchemy 2.0 (asyncpg), Alembic, PostgreSQL 16 | 37 migrations, connection pooling, RLS |
| **Asynchronous Jobs** | Celery 5.4 + Beat, RabbitMQ 3.13, Redis 7 | Event outbox pattern, scheduled tasks |
| **API Gateway** | Kong 3.7 (DB-less declarative) | Centralized rate limiting, CORS, routing |
| **Storage & Security** | MinIO S3, ClamAV, RS256 JWT, TOTP MFA, AES-256 | Presigned URLs, antivirus scanning |
| **Observability** | OpenTelemetry, Jaeger, Prometheus, Grafana, Elasticsearch | Distributed tracing, audit logs, metrics |
| **Frontend Monorepo** | Next.js 14 (App Router), Turborepo, TanStack Query | Shared `@procurement/*` packages, Tailwind, Radix |

---

## 📋 Assumptions Log

| ID | Assumption | Risk |
| :--- | :--- | :--- |
| A-01-1 | SUPERADMIN role seeded at initialization via scripts/create_superadmin.py | LOW |
| A-01-2 | Graphify initialised as empty JSON if not found (first run) | LOW |
| A-01-3 | cost_of_capital_rate defaults to 0.12 (12%) per org in settings | LOW |
| A-01-4 | Emergency RFQ SLA = half of standard (24h vs 72h min bid window) | MEDIUM |
| A-01-5 | Phase 3 features (eAuction, ML, WhatsApp, Mobile) excluded from scaffold | LOW |
| A-01-6 | Holiday master populated by seed script for default calendar | MEDIUM |
| A-02-1 | RabbitMQ topology initialised via scripts/rabbitmq_setup.py not app startup | LOW |
| A-02-2 | MinIO buckets initialised via scripts/minio_setup.py not app startup | LOW |
| A-02-3 | Cross-module calls use direct Python function calls in Phase 1 monolith | LOW |
| A-02-4 | Celery Beat runs in dedicated container separate from worker | LOW |
| A-02-5 | audit module is service-layer only — no public router | LOW |
| A-04-1 | OIDC SSO defaults to azure-ad provider configuration if omitted | LOW |
| A-04-2 | Just-In-Time provisioned SSO users are assigned default REQUESTOR role | LOW |
| A-08-1 | PR number format `{BU_CODE}-PR-{YYYY}-{NNNNNN}` generated per BU and year | LOW |
| A-08-2 | Merge PRs requires same BU, same Category, minimum 2 PRs, maximum 10 PRs | LOW |
| A-08-3 | Budget check is SOFT by default; HARD block enabled per tenant setting or capex budget breach | MEDIUM |
| A-08-4 | PR aging alerts task checks pending PRs older than settings.PR_AGING_ALERT_DAYS thresholds | LOW |
| A-08-5 | Redis cache for PR counts by status is invalidated on PR status changes | LOW |
| A-09-1 | Unmapped PR exception created when ERP PR lacks category or business unit | MEDIUM |
| A-09-2 | SLA escalation tiers defined by settings.UNMAPPED_PR_SLA_HOURS ([4, 8, 24, 48]) | LOW |
| A-09-3 | ML auto-mapping requires confidence score >= 0.85 and 100+ mapping log entries | MEDIUM |
| A-12-1 | L1 calculated on landed_cost per line. Missing price raises MISSING_NORMALIZED_PRICES (400) | LOW |
| A-12-2 | Technical + Commercial weights default to 70/30 split if omitted on RFQ | LOW |
| A-12-3 | Negotiated price increase > 0.5% tolerance threshold raises PRICE_TOLERANCE_EXCEEDED | LOW |
| A-12-4 | CS PDF uploaded to MinIO comparative-statement bucket using reportlab | LOW |
| A-12-5 | Regret letters published as outbox events to non-awarded vendors on award approval | LOW |
| A-17-1 | ClamAV scan runs async via Celery; file stored with scan_status=PENDING initially; updated to CLEAN/INFECTED | MEDIUM |
| A-17-2 | Infected files moved to quarantine bucket; original MinIO path deleted; scan_status=INFECTED | LOW |
| A-17-3 | Presigned URL TTL = 900s (15 min); generated on demand | LOW |
| A-17-4 | sanitize_filename strips path separators, null bytes, and non-ASCII; truncates to 255 chars | LOW |
| A-17-5 | ALLOWED_MIME_TYPES by document_type stored in config; validated against magic bytes | LOW |
| A-19-1 | Access token stored in memory (Zustand state); refresh token in httpOnly cookie | HIGH |
| A-19-2 | `packages/types/` generated at build time via `pnpm generate:types` | MEDIUM |
| A-AUTH-1 | Frontend API client dynamically adapts baseURL when accessed via 127.0.0.1 to maintain cookie domain consistency | LOW |
| A-AUTH-2 | User input email is trimmed both in frontend login forms and backend login methods to avoid whitespace auth failures | LOW |
| A-AUTH-3 | Frontend login forms extract and display structured server error messages (401/403/429) rather than generic status strings | LOW |
| A-21-1 | Line endings normalized via .gitattributes and Dockerfile sed sanitization for seamless Windows, Mac, and Linux builds | LOW |
| A-21-2 | Kong Gateway default declarative config routes to internal Docker DNS (http://api:8000), avoiding Windows host firewall blocks | LOW |
| A-21-3 | JWT key path configuration normalizes Windows backslashes to forward slashes across platforms | LOW |
| A-PERF-1 | Redis client uses cached async connection pools per DB index to eliminate connection creation overhead and prevent FD leaks | LOW |
| A-PERF-2 | Database engine enables pool_pre_ping=True to discard disconnected sockets transparently without request errors | LOW |
| A-PERF-3 | Search queries using ILIKE on entity identifiers and names leverage pg_trgm GIN indexes in migration 0037 | LOW |
| A-PERF-4 | Sourcing, Bid, and Evaluation models declare selectin eager loading on collections to prevent N+1 query cascades | LOW |
| A-PERF-5 | Security headers, request ID, and timing middlewares use pure ASGI classes to eliminate BaseHTTPMiddleware generator overhead | LOW |
| A-PERF-6 | Clean up redundant sync/async Redis client calls across service modules | LOW |
| A-PERF-7 | Celery worker tasks reuse persistent asyncio loop via app.tasks.async_runner.run_async to eliminate loop recreation overhead | LOW |
| A-PERF-8 | Evaluation comparative statement PDF generation uses batch vendor querying (Vendor.id.in_) to eliminate N+1 query loop | LOW |
| A-SEC-1 | Reverse auction WebSocket /ws requires authenticated JWT token via get_current_user_ws and binds counter-bids to verified identity | MEDIUM |
| A-DOCKER-1 | Frontend Dockerfiles run as unprivileged nextjs:nodejs user and ignore node_modules, .next, .turbo via .dockerignore | LOW |

---

## Current Session State
- **Planned**: SPEC_26 Ticket & Query Management System end-to-end implementation and relational demo seeding.
- **Implemented**: 6 models, 7 migrations (0028-0034), 7-state FSM, SLA engine, MentionParser, ES/SQL search, 30+ endpoints, Celery tasks, RabbitMQ topology, 12 portal pages, and relational ticket seeding (`scripts/seed_tickets.py`) wired into `seed_demo_user.py`.
- **Tested**: 63 ticket tests green (86.42% module coverage); all 46 baseline integration/security tests green (109 total); E2E verification across Buyer, Supplier, and Admin portals verified.
- **Next**: Phase 1 MVP production deployment and documentation.
