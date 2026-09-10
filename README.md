# 🏢 S2P Procurement Portal

> **Enterprise Source-to-Pay Platform** built with **FastAPI**, **Next.js 14 Turborepo**, **PostgreSQL**, **RabbitMQ**, and **Kong Gateway**.

---

### 🌐 Portals & Demo Accounts

All three portals run simultaneously with seeded test roles. Access them directly in your browser:

| Portal | Local URL | Primary Users | Real Human Name | Demo Account | Password | Assigned Roles |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **👑 Universal Super Admin** | **Any Portal** (`:3000`, `:3001`, `:3002`) | Universal Omnipotent Access & 1-Click Persona Switching | Alexander Vance | `superadmin@procurement.com` | `SuperAdmin123456!@#` | `SUPERADMIN` (All System & Org Roles, Omnipotent Bypass) |
| **Buyer Portal** | [http://localhost:3000](http://localhost:3000) | Procurement Team (PRs, RFQs, Bids, Tickets) | Sarah Jenkins | `buyer@procurement.com` | `Buyer123456!@#` | `REQUESTOR`, `BUYER`, `PROCUREMENT_OFFICER` |
| **Buyer Portal (Approver)** | [http://localhost:3000](http://localhost:3000) | Approvers & Leadership (Sign-offs) | Robert Taylor | `approver@procurement.com` | `Approver123!@#` | `APPROVER`, `PROCUREMENT_HEAD`, `FINANCE_CONTROLLER` |
| **Supplier Portal** | [http://localhost:3001](http://localhost:3001) | External Vendors (Bids, Invoices, Queries) | Rajesh Kumar | `supplier@acme.com` | `Supplier123456!@#` | `SUPPLIER`, `SUPPLIER_ADMIN` (Acme Tech Solutions) |
| **Admin Portal** | [http://localhost:3002](http://localhost:3002) | System Administrators (Master Data, SLAs, Tickets) | David Miller | `admin@procurement.com` | `Admin123456!@#` | `ORG_ADMIN`, `PROCUREMENT_MANAGER`, `PROCUREMENT_ADMIN` |

> 🔑 **Organization ID for all logins:** `00000000-0000-0000-0000-000000000001` (Default Organization)
>
> 👑 **Super Admin Universal Access & Switcher:**
> - **Omnipotent Permissions:** Can view, edit, approve, and execute any action across all modules without role or scope barriers.
> - **1-Click Portal Switcher:** Seamlessly switch between Buyer (`:3000`), Supplier (`:3001`), and Admin (`:3002`) with persistent cross-portal cookies.
> - **Interactive Persona Deck:** Click the `👑 Super Admin` header pill to switch views and deep link directly into any of the 8 enterprise personas.
>
> 🚪 **API Gateway (Kong):** [http://localhost:8000](http://localhost:8000) &nbsp;•&nbsp; **Direct Backend API:** [http://localhost:8080](http://localhost:8080)
>
> 📘 **Git & CI/CD Guide:** [Complete Beginner Guide to Git, GitHub & Branching](docs/GIT_AND_CICD_GUIDE.md)

---

### 🎭 Full Enterprise Role Demonstration (8 Personas)

The platform supports strict enterprise role separation (where each user only sees their own siloed screen) as well as an omnipotent **Super Admin** who can embody any persona on demand. Every persona is seeded as a real user in the database:

| # | Role / Persona | Real Human Name | Screen / Access Scope | Standalone Account | Password | Super Admin 1-Click Route |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **⚙️ System Admin** | David Miller | Admin Portal (Users, Workflows, Master Data, Audit Logs) | `admin@procurement.com` | `Admin123456!@#` | `http://localhost:3002/users` |
| **2** | **📝 Requestor** | Sarah Jenkins | Buyer Portal (Catalog browsing, PR draft, submit requisition) | `buyer@procurement.com` | `Buyer123456!@#` | `http://localhost:3000/purchase-requests` |
| **3** | **🎯 Buyer Specialist** | Sarah Jenkins | Buyer Portal (PR review, Sourcing RFQ, Bidding, PO generation) | `buyer@procurement.com` | `Buyer123456!@#` | `http://localhost:3000/sourcing` |
| **4** | **✅ Approver (L1)** | Robert Taylor | Buyer Portal (Line manager approvals, Task inbox) | `approver@procurement.com` | `Approver123!@#` | `http://localhost:3000/approvals` |
| **5** | **📊 Finance Manager (L2)** | Eleanor Vance | Buyer Portal (Finance sign-offs, budget controls, approvals) | `finance@procurement.com` | `Finance123!@#` | `http://localhost:3000/approvals` |
| **6** | **📦 Warehouse Manager** | Marcus Vance | Buyer Portal (Goods receipts, 3-way match inspect, GRN delivery) | `warehouse@procurement.com` | `Warehouse123!@#` | `http://localhost:3000/goods-receipts` |
| **7** | **💳 Accounts Payable** | Claire Redfield | Buyer Portal (Invoice processing, 2-way / 3-way match, payment holds) | `ap@procurement.com` | `Accounts123!@#` | `http://localhost:3000/invoices` |
| **8** | **🏭 Supplier Partner** | Rajesh Kumar | Supplier Portal (RFQ bids, PO acknowledgment, ASN, invoices) | `supplier@acme.com` | `Supplier123456!@#` | `http://localhost:3001/rfqs` |

#### How to Use the 1-Click Switcher & Persona Deck:
1. Log into **any portal** ([Buyer :3000](http://localhost:3000), [Supplier :3001](http://localhost:3001), or [Admin :3002](http://localhost:3002)) using `superadmin@procurement.com` / `SuperAdmin123456!@#`.
2. Look at the top navigation bar:
   - **Segmented Quick Switcher (`[ 🏢 Buyer | 🏭 Supplier | ⚙️ Admin ]`):** Click any portal name to jump directly to that application without needing to re-login. Cross-portal cookies and token refresh handle the transition instantly.
   - **Persona Control Deck (`👑 Super Admin`):** Click the golden crown pill in the header to open the interactive persona dropdown. Clicking any persona instantly routes you to that specific role's screen.


## Current Session State
- **Completed (Super Admin Universal Persona & Cross-Portal Navigation)**:
  1. **Backend Omnipotent Access & Cross-Portal Auth**:
     - `role_repository.py`: In `user_has_permission`, short-circuits to `True` for `RoleCode.SUPERADMIN`.
     - `service.py`: Allows `SUPERADMIN` login to any portal (Buyer, Supplier, Admin). In Supplier mode, dynamically injects vendor context (`V-10001`).
     - `dependencies.py`: Dynamically binds vendor context and sets `is_supplier_user=True` when `SUPERADMIN` accesses Supplier APIs; exempts `SUPERADMIN` from mandatory MFA lockout.
     - `router.py`: Dual-writes portal-isolated cookies and root cookies (`path="/"`) with cross-portal cookie fallback on refresh.
  2. **Frontend 1-Click Portal Switcher & Persona Deck**:
     - `Navbar.tsx`: Integrated segmented quick-switcher (`[ 🏢 Buyer | 🏭 Supplier | ⚙️ Admin ]`) and interactive `👑 Super Admin` Persona Deck with deep links to all 8 enterprise personas.
     - Middlewares updated across all 3 portals (`apps/*/middleware.ts`) to validate cross-portal auth cookies seamlessly.
  3. **Verification**:
     - 445/445 backend unit tests passing (`tests/unit/`).
     - 396/396 backend integration tests passing (`tests/integration/`).
     - 7/7 Turbo frontend packages passing strict typecheck with 0 errors.
     - Seeding verified via `scripts/seed_superadmin.py` and `scripts/seed_demo_user.py`.

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
.venv/bin/python scripts/seed_tickets.py

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
# 1. Apply all 45 database migrations
alembic upgrade head
# Expected output ends with:
# INFO  [alembic.runtime.migration] Running upgrade ... -> 0034_ticket_permissions

# 2. Verify migration head
alembic current
# Expected: 0034_ticket_permissions (head)

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
python3 scripts/seed_tickets.py

# Create superadmin account
python3 scripts/create_superadmin.py
```

> 💡 **Tip (Docker Mode):** You can also run seeding directly inside the running API container:
> ```bash
> docker compose -f docker/docker-compose.yml exec api python3 scripts/seed_tickets.py
> ```

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
| **Database & ORM** | SQLAlchemy 2.0 (asyncpg), Alembic, PostgreSQL 16 | 45 migrations, connection pooling, RLS |
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
| A-26-1 | @mention autocomplete fetches GET /api/v1/users?search={q}&active=true; results cached client-side 60s; only same-org users returned | LOW |
| A-26-2 | Markdown rendered client-side via react-markdown + remark-gfm; avoids latency on comment fetch | LOW |
| A-26-3 | ES search uses multi_match on title(x3), ticket_number(x5), description(x2), comments_text, entity_number(x4), tags with operator=or, min_score=0.3 | LOW |
| A-26-4 | Kanban drag uses @dnd-kit/core + @dnd-kit/sortable for React 18+ App Router compatibility | LOW |
| A-26-5 | Ticket sequence seq_tkt_{org_code}_{year} created with CREATE SEQUENCE IF NOT EXISTS inside transaction with unique retry | MEDIUM |
| A-26-6 | is_private enforced at SQL WHERE clause level: (is_private = FALSE OR raised_by = :actor OR assigned_to = :actor OR :is_admin = TRUE) | HIGH |
| A-26-7 | Comment 15-min edit enforced: elapsed seconds > 900 raises EDIT_WINDOW_CLOSED | LOW |
| A-26-8 | Supplier internal note filter: GET comments endpoint filters out is_internal=True rows at DB query level for supplier tokens | MEDIUM |
| A-26-9 | RESOLVED auto-close after 3 days; PENDING_RESPONSE auto-close after 7 days checked daily by Celery beat | LOW |
| A-26-10 | SLA computed on calendar hours in Phase 1; business-hours-aware SLA explicitly deferred to Phase 2 | MEDIUM |
| A-26-11 | Entity link stored as advisory soft FK (entity_type VARCHAR + entity_id UUID + entity_number VARCHAR) | LOW |
| A-26-12 | portal claim added to JWT access token (values: buyer/supplier/admin) for session isolation across portals | MEDIUM |
| A-26-13 | Due date stored as DATE in DB, nullable; approaching alert triggered 24h prior to due date | LOW |
| A-26-14 | Ticket linking uses ticket_links table with ENUM types (BLOCKS, IS_BLOCKED_BY, RELATES_TO, DUPLICATES, IS_DUPLICATED_BY, CLONES, IS_CLONED_BY); bidirectional query support | LOW |
| A-26-15 | Custom fields use EAV schema (ticket_custom_field_defs + ticket_custom_field_values) supporting TEXT, NUMBER, DATE, SELECT, MULTI_SELECT, BOOLEAN | MEDIUM |
| A-26-16 | Automation engine uses ticket_automation_rules with event triggers, conditions JSON, and actions JSON executing via Celery and service hooks | MEDIUM |
| A-26-17 | Round-robin assignee pointer persisted via Redis INCR per rule; balanced workload selects user with lowest count of active tickets | LOW |
| A-OPT-1 | N+1 ticket link queries eliminated using batch repository get_by_ids lookup | LOW |
| A-OPT-2 | MinIO S3 bucket health inspection wrapped in asyncio.to_thread to prevent ASGI event loop blocking | LOW |
| A-OPT-3 | Backend and Celery containers initialized with tini PID 1 for signal propagation and zombie process prevention | LOW |
| A-OPT-4 | Next.js standalone runner containers configured with HOSTNAME 0.0.0.0 for reliable container network binding | LOW |
| A-27-1 | Organization structure models (LegalEntity, BusinessUnit, Plant, Department, CostCenter) are scoped to org_id with unique code/registration constraints matching SPEC_03 | LOW |
| A-27-2 | Admin portal provides dedicated management pages under /organization/... with full CRUD and integrates with /master-data/locations for delivery locations | LOW |
| A-27-3 | Organization profile is viewable and editable by tenant administrators via GET/PATCH /api/v1/organizations/me and /organization | LOW |
| A-27-4 | Plants and Delivery Locations maintain bidirectional referential links (Plant.default_delivery_location_id <-> DeliveryLocation.plant_id) | LOW |
| A-24-4 | Item master frontend in Admin Portal (/master-data/items) provides full enterprise CRUD (search, category/status filters, pagination, create/edit modals, soft delete) | LOW |
| A-24-5 | Incoterms frontend in Admin Portal (/master-data/incoterms) provides CRUD and active state toggles backed by standardized REST endpoints | LOW |
| A-24-6 | Master Data Hub (/master-data) surfaces Item Master Catalog and Incoterms 2020 cards with live record counters | LOW |
| A-24-7 | IncotermSelect component in @procurement/ui unifies dynamic Incoterm selection across buyer and supplier portals | LOW |
| A-16-1 | Notification template endpoints require authentication, tenant isolation, and Jinja2 rendering | LOW |
| A-16-2 | Admin portal route /notifications/templates provides multi-channel template studio with live preview | LOW |
| A-DESIGN-SYS-1 | Light & Dark theme tokens calibrated for WCAG AA contrast (crisper hairlines 0.12/0.14, high-contrast labels, tiered dark surfaces #0D0D0F -> #1C1C1F -> #242428 -> #2E2E34) | LOW |
| A-DESIGN-SYS-2 | Tabs component augmented with subtab and underline variants, size scales (sm/md), auto-width, and dedicated SubTabs component for nested navigation hierarchy | LOW |
| A-DESIGN-SYS-3 | Table component & CSS enhanced with distinct header partition, clear cell padding, crisp 1px row borders, and non-overlapping hover states | LOW |
| A-DESIGN-SYS-4 | Button system standardized with explicit height scales (32px sm, 40px md, 48px lg), distinct secondary/ghost borders, and WCAG AA contrast in both themes | LOW |
| A-DESIGN-SYS-5 | Dark mode Tailwind color overrides in apple-base.css calibrated to high-contrast legible values (eliminating unreadable 38% opacity muted text) | LOW |
| A-DESIGN-SYS-6 | All three portals updated to use structured design system components, unified subtabs, and consistent object partitioning | LOW |
| A-ONBOARD-1 | Supplier KYC verification status overview consolidates PAN, GSTIN, Bank Penny Drop, and MSME into high-visibility compliance status chips on the Profile page | LOW |
| A-ONBOARD-2 | Bank penny drop verification normalizes both SUCCESS and VALIDATED to verified state, and PENDING / PENNY_TEST_INITIATED to awaiting verification | LOW |
| A-DOC-1 | Statutory document types encompass 11 canonical categories with standard template generation and client-side download capability | LOW |
| A-DOC-2 | ClamAV scan statuses (CLEAN, PENDING, INFECTED) block download at both client button state and backend API presigned URL boundary (403 Forbidden) | MEDIUM |
| A-MATCH-1 | Line-level 3-way match displays PO line vs. GRN accepted quantity vs. Invoiced quantity with ±2% quantity tolerance and ±0.5% price tolerance | LOW |
| A-MATCH-2 | Supplier portal exposes /invoices/[id] detail view mirroring buyer 3-way match breakdown so vendors can inspect discrepancy reasons and upload attachments | LOW |
| A-TKT-1 | Kanban board drag-and-drop transitions tickets across 5 columns (OPEN, IN_PROGRESS, PENDING_RESPONSE, RESOLVED, CLOSED) with column counters, Apple-styled draggable cards, and drop zones | LOW |
| A-TKT-2 | SLA breach countdown computes dynamic time-remaining with live visual tiers (<1h pulsing, <=4h at-risk, >4h on-track, overdue formatted as "Breached by Xh") | LOW |
| A-TKT-3 | @mentions in ticket comments are parsed via MentionParser into mentioned_users, auto-registered as watchers, and rendered as stylized interactive pill badges | LOW |
| A-TKT-4 | Internal notes (is_internal=True) are isolated strictly for Buyer & Admin users via database queries and role permissions, styled with high-contrast amber theme and lock badge | LOW |
| A-TKT-5 | Bidirectional issue linking supports relational types (BLOCKS, IS_BLOCKED_BY, RELATES_TO, DUPLICATES, CLONES) with an interactive ticket search selector to pick by ticket number or title | LOW |
| A-CON-1 | Contract lifecycle FSM supports DRAFT -> PENDING_REVIEW -> APPROVED -> PENDING_ESIGN -> ACTIVE -> EXPIRED/TERMINATED with dedicated transition endpoints and strict supplier read-only boundary on approvals | LOW |
| A-CON-2 | Contract milestones track deliverables with status (PENDING, COMPLETED, OVERDUE), responsible party (BUYER vs SUPPLIER), milestone weights, and completion notes for both buyer and supplier completion | LOW |
| A-CON-3 | Rate card lines support contracted quantities or open-ended rate catalog items with unit rates, HSN codes, and live rate contract spend ceiling utilization tracking | LOW |
| A-CON-4 | Contract amendments increment version counter, record immutable JSONB pre-change snapshots with field diffs, and update live contract parameters upon manager approval | LOW |
| A-CON-5 | Contract authoring wizard provides multi-step setup across General Info, Template Clauses, Rate Card lines, Milestone schedules, and Auto-Renewal configuration | LOW |
| A-CON-6 | Multi-portal Apple design calibration extends across Buyer Portal contracts suite and introduces dedicated Supplier Portal contracts view (/contracts, /contracts/[id]) with strict vendor isolation | LOW |
| A-ANA-1 | Spend Cube multi-dimensional analysis computes breakdowns across Category, BU, and Supplier Pareto (cumulative spend % curve) with CAPEX vs OPEX bifurcation | LOW |
| A-ANA-2 | Maverick spend identifies purchase orders created without linked rate contracts or formal competitive sourcing, calculating spend leakage rate and category risk | LOW |
| A-ANA-3 | Sourcing savings discovery computes budget vs. awarded L1 value; cycle time analytics isolates PR-to-PO, RFQ-to-Award, and role-based approval turnaround bottlenecks | LOW |
| A-ANA-4 | Custom report builder enables dynamic dimension grouping, multi-metric aggregations, filter predicates, and pagination with instant CSV and Excel export | LOW |
| A-ANA-5 | Compliance audit suite consolidates emergency RFQs, sole-source justifications, admin workflow force-approvals, and segregation-of-duties attempts from audit logs | LOW |
| A-ANA-6 | Analytics dashboards leverage Apple dark surface design tokens (#1C1C1F, #252529) with interactive Recharts visualizers and tabular drill-downs | LOW |
| A-ERP-1 | Tally XML integration conforms to standard Tally 9/Prime Import Data envelopes for Sundry Creditors Ledger, Purchase Voucher, and Payment Voucher posting | LOW |
| A-ERP-2 | Razorpay payouts use bank account transfer (NEFT/RTGS/IMPS) with HMAC-SHA256 signature verification over raw bytes for inbound webhooks | LOW |
| A-ERP-3 | Statutory PAN 4th-character entity mapping classifies Company (C), Individual (P), Trust (T), Firm (F); Bank penny drop checks ₹1.00 credit confirmation | LOW |
| A-AUD-1 | Immutable audit log chain of custody hashes canonical strings with previous block's SHA-256 hash stored in non-null metadata JSONB to eliminate table locks or schema migrations | LOW |
| A-AUD-2 | Client IP addresses are resolved via ipaddress module differentiating intranet / RFC-1918 LANs from public internet ingress addresses | LOW |
| A-NOT-1 | NotificationToast container renders floating Apple dark-glassmorphism stack with auto-dismiss timers, action deep-links, and category icons | LOW |
| A-SCR-1 | Automated scorecard weights 40% on-time delivery (GRN vs PO date), 30% quality acceptance (GRN accepted lines), 20% commercial compliance (matched invoices), 10% responsiveness/pricing (bid qualification); overall score < 60 triggers vendor.low_performance event | LOW |
| A-RSK-1 | Vendor risk assessment calculates composite risk as 45% financial risk, 35% ESG risk, and 20% performance risk (100 - performance score); risk tiers are LOW (<25), MEDIUM (25-50), HIGH (50-75), CRITICAL (>=75) | LOW |
| A-WFL-1 | Approval rule condition parser evaluates complex comparison operators (eq, neq, gt, gte, lt, lte, in, not_in, contains, is_true, is_false) against runtime context with priority and condition specificity tie-breaking | LOW |
| A-WFL-2 | Delegation rules support multi-entity type scoping (PR, PO, INVOICE, RFQ, CONTRACT, ARN, or ALL) with Maker-Checker conflict avoidance | LOW |
| A-WFL-3 | Parallel split approval convergence evaluates ALL (unanimous), ANY (first approval), MAJORITY (>50% approved), or QUORUM_N_OF_M | LOW |
| A-FLOW-1 | Workflow engine advance/force-advance synchronously synchronizes underlying entity status (Requisition->APPROVED, PO->APPROVED, ARN->APPROVED, Invoice->APPROVED+payment schedule, Contract->APPROVED, Vendor->ACTIVE) within the same DB session | LOW |
| A-FLOW-2 | Workflow engine rejection/cancellation synchronously transitions entity to REJECTED/CANCELLED, releases reserved PR budget, and logs tamper-evident audit records | LOW |
| A-FLOW-3 | Active delegation matrix authorizes runtime delegates to act on pending tasks at execution time if validity dates, BU, financial threshold, and Maker-Checker constraints are satisfied | LOW |
| A-FLOW-4 | Sourcing RFQ creation linked to source_pr_id transitions PR to IN_SOURCING, and PO creation from award transitions PR to CONVERTED, preserving bidirectional relational state | LOW |
| A-FLOW-5 | Full synchronous end-to-end flow from Requisition through Approval, RFQ, Bidding, CS/Award, Contract, PO, ASN, Fast GRN, 3-Way Invoice, Payment, Scorecard, ESG, Maverick AI, and Multi-ERP Gateway operates atomically with 0 broken linkages | LOW |

---

### Current Session State
- **Completed**: Cross-Portal Synchronous Flow verification across Admin, Buyer, and Supplier Portals.
- **Fixed Gateway**: Added missing routing definitions to `kong/kong.yml` for `/api/v1/asns`, `/api/v1/developer`, `/api/v1/audit`, `/api/v1/compliance`, and `/api/v1/einvoicing`.
- **Fixed Core**: Loop-safe Redis connection pool caching in `app/core/redis_client.py` and mock-safe row unpacking in `app/modules/workflow/service.py`.
- **Verified Cross-Portal Test**: `test_cross_portal_synchronous_flow.py` (Admin master data/rules -> Buyer PR -> Workflow Approval -> RFQ -> Supplier Bid -> Unseal/Award -> Contract e-Sign -> PO -> ASN -> Fast GRN -> Invoice -> 3-Way Match -> Settlement -> Remittance -> Ticket -> ERP Sync).
- **Tested**: All 964 backend tests passed (100% pass rate in 65s); frontend Turbo typecheck 7/7 packages clean with 0 errors; graphify updated (10,499 nodes, 28,359 edges, 582 communities).
- **Artifacts & Docs**: Saved comprehensive markdown specification to `docs/CROSS_PORTAL_ARCHITECTURE_AND_WORKFLOW_GUIDE.md` and compiled publication-grade interactive PDF with vector Mermaid diagrams and document bookmarks to `docs/CROSS_PORTAL_ARCHITECTURE_AND_WORKFLOW_GUIDE.pdf` via `scripts/generate_interactive_pdf.js`.

### 📊 SPEC Audit: Cross-Portal Synchronous Workflows & Gateway Routing (2026-09-10)
```
MODULE | SPEC REQUIREMENT | STATUS | ARTIFACT / CODE
XPORT.1 | Cross-Portal Synchronous Event Integration Test | [DONE] | test_cross_portal_synchronous_flow.py
XPORT.2 | Kong Gateway Proxy Integrity (Audit, ASNs, Einvoicing, Dev) | [DONE] | kong/kong.yml
XPORT.3 | Asyncio Redis Connection Pool Event Loop Isolation | [DONE] | app/core/redis_client.py
XPORT.4 | Workflow Engine Raw Row Sequence Safety Guard | [DONE] | app/modules/workflow/service.py
XPORT.5 | Cross-Portal Architecture & Synchronous Workflow Guide | [DONE] | docs/CROSS_PORTAL_ARCHITECTURE_AND_WORKFLOW_GUIDE.md
XPORT.6 | Publication-Grade Interactive PDF with Outlines & Vector SVGs | [DONE] | docs/CROSS_PORTAL_ARCHITECTURE_AND_WORKFLOW_GUIDE.pdf
OVERALL: 6/6 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100% | DOCS 100%
```


### 📊 SPEC Audit: Supplier Performance Scorecards & Risk (2026-09-09)
```
MODULE | SPEC REQUIREMENT | STATUS | ARTIFACT / CODE
SCR.1 | Automated Multi-Factor Scorecard Calculation Engine   | [DONE] | vendor/service.py, router.py, test_vendor_scorecard_and_risk_spec21.py
SCR.2 | Quality Rejection & Pricing Competitiveness Metrics   | [DONE] | vendor/schemas.py, vendor/service.py, useVendors.ts
SCR.3 | Low Performance Alert & Outbox Event Dispatch (<60)   | [DONE] | vendor/service.py, test_vendor_scorecard_and_risk_spec21.py
SCR.4 | Recalculate Scorecard Buyer Portal Action & UI Flow   | [DONE] | buyer-portal/vendors/[id]/page.tsx, useVendors.ts
RSK.1 | Vendor Financial & ESG Risk Assessment DB & Model    | [DONE] | 0040_vendor_risk_assessment.py, vendor/models.py
RSK.2 | Composite Risk Score Calculation & 4-Tier Bucketing   | [DONE] | vendor/service.py, schemas.py, repository.py
RSK.3 | Organization-Wide Vendor Risk Monitoring Dashboard   | [DONE] | vendor/service.py, router.py, test_vendor_scorecard_and_risk_spec21.py
RSK.4 | Buyer Portal Apple Dark Surface Risk Profile Card     | [DONE] | buyer-portal/vendors/[id]/page.tsx, useVendors.ts
RSK.5 | Org-Wide Vendor Risk & ESG Intelligence Dashboard Page| [DONE] | buyer-portal/vendors/risk/page.tsx, layout.tsx, useVendors.ts
OVERALL: 9/9 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```

### 📊 SPEC Audit: Advanced Workflow Rules & Delegation (2026-09-09)
```
MODULE | SPEC REQUIREMENT | STATUS | ARTIFACT / CODE
WFL.1 | Structured Multi-Criteria Rule Condition Evaluation   | [DONE] | approval_rules/service.py, test_workflow_delegation_and_split_spec04_05.py
WFL.2 | Priority & Condition Specificity Tie-Breaking        | [DONE] | approval_rules/service.py, test_workflow_delegation_and_split_spec04_05.py
WFL.3 | Resolve-Chain S2P Approval Pre-Flight Endpoint        | [DONE] | approval_rules/router.py, service.py, schemas.py
WFL.4 | Out-of-Office Delegation Scoped by Entity Type        | [DONE] | workflow/service.py, test_workflow_delegation_and_split_spec04_05.py
WFL.5 | Maker-Checker Conflict Avoidance Enforcement          | [DONE] | workflow/service.py, test_workflow_delegation_and_split_spec04_05.py
WFL.6 | Parallel Split Convergence (ALL, ANY, MAJORITY)      | [DONE] | workflow/service.py, test_workflow_delegation_and_split_spec04_05.py
OVERALL: 6/6 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```

### 📊 SPEC Audit: End-to-End Persona QA & Multi-Portal (2026-09-09)
```
MODULE | SPEC REQUIREMENT | STATUS | ARTIFACT / CODE
E2E.1 | Buyer Portal Flow (PR creation, RFQ, PO generation)   | [DONE] | test_persona_qa_walkthrough.py
E2E.2 | Approver Portal Flow (Tasks Queue, Contract Review)   | [DONE] | test_persona_qa_walkthrough.py, approver_and_admin_flows.spec.ts
E2E.3 | Supplier Portal Flow (Bid submission, Invoices, KYC)  | [DONE] | test_persona_qa_walkthrough.py
E2E.4 | Admin Portal Flow (Master Data, Audit Logs, Settings)  | [DONE] | test_persona_qa_walkthrough.py, approver_and_admin_flows.spec.ts
OVERALL: 4/4 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```

### 📊 SPEC Audit: ERP & Payment Gateways (2026-09-09)
```
MODULE | SPEC REQUIREMENT | STATUS | ARTIFACT / CODE
ERP.1 | Tally ERP XML Envelope Translation & Posting       | [DONE] | erp_tally.py, erp_base.py, test_erp_and_payment_spec20.py
ERP.2 | SAP RFC / NetWeaver BAPI Simulation & Execution   | [DONE] | erp_sap.py, test_erp_and_payment_spec20.py
ERP.3 | Statutory GSTIN & PAN Verification Adapters       | [DONE] | pan.py, gst.py, router.py, test_erp_and_payment_spec20.py
ERP.4 | Statutory Bank Account Penny Drop Deposit (₹1.00)  | [DONE] | bank.py, router.py, test_erp_and_payment_spec20.py
ERP.5 | Inbound ERP Webhook Synchronization Endpoint       | [DONE] | router.py, schemas.py, test_erp_and_payment_spec20.py
PAY.1 | Live Payout Execution Rail (NEFT/RTGS/IMPS)        | [DONE] | razorpay_adapter.py, payment/service.py, router.py
PAY.2 | HMAC-SHA256 Webhook Signature & Auto-Settlement   | [DONE] | razorpay_adapter.py, router.py, test_erp_and_payment_spec20.py
OVERALL: 7/7 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```

### 📊 SPEC Audit: Enterprise Notifications & Audit Trail (2026-09-09)
```
MODULE | SPEC REQUIREMENT | STATUS | ARTIFACT / CODE
AUD.1 | Cryptographic SHA-256 Tamper-Evident Chain Chaining | [DONE] | crypto_chain.py, audit/service.py, test_notifications_and_audit_spec16_22.py
AUD.2 | Client IP Geolocation Resolution (LAN vs Public)     | [DONE] | crypto_chain.py, audit/service.py, test_notifications_and_audit_spec16_22.py
AUD.3 | Audit Log Retrieval & Filtering API Endpoints        | [DONE] | audit/router.py, audit/service.py, main.py
AUD.4 | Audit Chain Integrity Verification Endpoint           | [DONE] | audit/router.py, crypto_chain.py, test_notifications_and_audit_spec16_22.py
AUD.5 | Compliance Export with SHA-256 Digest (JSON & CSV)   | [DONE] | audit/router.py, audit/service.py, test_notifications_and_audit_spec16_22.py
NOT.1 | Real-time Multi-Channel Event Dispatch & Bypass Rules| [DONE] | notification/router.py, notification/service.py
NOT.2 | Apple Glassmorphism Toast Floating Center Component  | [DONE] | NotificationToast.tsx, packages/ui/src/index.ts
OVERALL: 7/7 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```

### 📊 SPEC Audit: Analytics & Spend Cube (2026-09-09)
```
MODULE | SPEC REQUIREMENT | STATUS | ARTIFACT / CODE
ANA.1 | Multi-Dimensional Spend Cube Visualizer (Category/BU/Type) | [DONE] | SpendCubeVisualizer.tsx, router.py, service.py
ANA.2 | Supplier Pareto 80/20 Analysis & Cumulative Spend Curve   | [DONE] | SpendCubeVisualizer.tsx, service.py, test_analytics.py
ANA.3 | Maverick Spend Detection & Spend Leakage Rate Calculation   | [DONE] | MaverickSpendTable.tsx, service.py, test_analytics.py
ANA.4 | Sourcing Savings Discovery & Role Approval Bottlenecks      | [DONE] | service.py, test_analytics.py, KPICard.tsx
ANA.5 | Custom Report Builder with Dynamic Dimensions & Metrics     | [DONE] | CustomReportBuilder.tsx, router.py, service.py
ANA.6 | Compliance Audit Suite (Emergency/Single/Force/SoD)         | [DONE] | ComplianceReportsView.tsx, router.py, service.py
ANA.7 | Multi-Portal Apple Design Calibration & CSV/Excel Exports   | [DONE] | buyer-portal/analytics/page.tsx, spend/page.tsx
OVERALL: 7/7 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```

### 📊 SPEC Audit: Contract Management & Authoring (2026-09-09)
```
MODULE | SPEC REQUIREMENT | STATUS | ARTIFACT / CODE
CON.1 | Contract Lifecycle FSM & Status Transitions        | [DONE] | fsm.py, router.py, buyer-portal/contracts/[id]
CON.2 | Direct Activation & Cause-Based Termination Flows  | [DONE] | router.py, buyer-portal/contracts/[id], test_contract.py
CON.3 | Milestone Tracking, Weighting & Vendor Completion  | [DONE] | MilestoneTracker.tsx, router.py, service.py
CON.4 | Rate Card Line Item CRUD & Ceiling Drawdown Meter  | [DONE] | RateCardTable.tsx, router.py, test_contract.py
CON.5 | Amendment Lineage, Pre-Change Snapshot & Diff View | [DONE] | ContractAmendmentHistory.tsx, test_contract.py
CON.6 | Multi-Signatory eSign (Digio/DocuSign) Integration | [DONE] | router.py, buyer/supplier contracts/[id]
CON.7 | Supplier Portal Contracts Suite & Vendor Isolation | [DONE] | supplier-portal/contracts, test_contract.py
OVERALL: 7/7 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```

### 📊 SPEC Audit: Enterprise Ticketing & SLAs (2026-09-09)
```
MODULE | SPEC REQUIREMENT | STATUS | ARTIFACT / CODE
TKT.1 | Interactive 5-Column Kanban Board & Filters      | [DONE] | TicketCard.tsx, buyer/admin board pages
TKT.2 | Dynamic SLA Breach Countdowns & Visual Tiers     | [DONE] | TicketSLAIndicator.tsx, test_ticket_sla_service.py
TKT.3 | @mention Parser & Auto-Watcher Registration      | [DONE] | MentionParser, TicketCommentFeed.tsx, test_ticket_mention_parser.py
TKT.4 | Internal Comment Threading & Supplier Isolation  | [DONE] | TicketCommentFeed.tsx, test_ticket_service.py
TKT.5 | Bidirectional Issue Linking & Search Selector    | [DONE] | TicketLinkedIssues.tsx, test_ticket_jira_features.py
TKT.6 | Multi-Portal Lifecycle FSM & CSAT Rating Modal   | [DONE] | buyer/admin/supplier tickets/[id], test_ticket_fsm.py
TKT.7 | Custom Fields (EAV) Panel & Dynamic Schema       | [DONE] | TicketCustomFieldsPanel.tsx, test_ticket_jira_features.py
OVERALL: 7/7 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```


### 📊 SPEC Audit: Supplier Onboarding & Compliance (2026-09-09)
```
MODULE | SPEC REQUIREMENT | STATUS | ARTIFACT / CODE
ONB.1 | Vendor Registration, KYC & Penny Drop Status   | [DONE] | supplier-portal/profile/page.tsx, test_vendor.py
ONB.2 | Statutory Tax Identifiers (PAN/GSTIN/CIN/DUNS)  | [DONE] | vendor/schemas.py, buyer-portal/vendors/[id]
ONB.3 | Multi-State Vendor Lifecycle & FSM Actions     | [DONE] | vendor/service.py, buyer-portal/vendors/[id]
DOC.1 | 11 Statutory Document Upload & Expiry Tracking  | [DONE] | DocumentList.tsx, ComplianceExpiryAlert.tsx
DOC.2 | ClamAV Antivirus Scanning & Download Blocking   | [DONE] | scanner.py, test_document_scanner.py
INV.1 | Line-Level Invoice 3-Way Matching Engine       | [DONE] | ThreeWayMatchResult.tsx, invoice/service.py
INV.2 | Quantity (±2%) & Price (±0.5%) Tolerances      | [DONE] | test_invoice_payment.py, ThreeWayMatchResult
INV.3 | Statutory TDS & Business Day Payment Schedule  | [DONE] | PaymentSchedule.tsx, test_invoice_payment.py
INV.4 | Supplier Invoice Detail View & Dispute Links   | [DONE] | supplier-portal/invoices/[id]/page.tsx
OVERALL: 9/9 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```

### 📊 SPEC Audit: RFQ & Reverse Auction Bidding (2026-09-09)
```
MODULE | SPEC REQUIREMENT | STATUS | ARTIFACT / CODE
RFQ.1 | Emergency vs Standard RFQ (24h vs 72h window)  | [DONE] | rfqs/new/page.tsx, schemas.py
RFQ.2 | Cryptographically Sealed Bids (AES-256 at rest) | [DONE] | supplier-portal/.../bid/page.tsx, test_rfq.py
RFQ.3 | Dual-Authorization Bid Opening Ceremony        | [DONE] | rfqs/[id]/open-bids/page.tsx, BidSealedIndicator
AUC.1 | Real-time WebSocket Live Reverse Auction       | [DONE] | useAuctionSocket.ts, buyer/supplier auction rooms
AUC.2 | Anti-Sniping Dynamic Extensions (+10m triggers) | [DONE] | test_auction_tasks.py, PriceLeaderboard.tsx
AUC.3 | Automated Confidential Proxy Floor Bidding     | [DONE] | test_auction_permissions.py, BidEntryPanel
EVAL.1| L1 Comparative Statement & Landed Cost Discovery| [DONE] | ComparativeStatementTable.tsx, evaluation/page.tsx
EVAL.2| Evaluation Versions & Regret Letter Dispatch    | [DONE] | cs_service.py, evaluation/page.tsx
OVERALL: 8/8 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```

### 📊 SPEC Audit: Advance Shipping Notices (ASN) & Warehouse Barcode Intake (2026-09-09)
```
MODULE | SPEC REQUIREMENT | STATUS | ARTIFACT / CODE
ASN.1 | Schema & Migration for Advance Shipping Notices & Lines | [DONE] | 0041_advance_shipping_notices.py, models.py
ASN.2 | ASN Numbering & Over-Shipping Validation vs Open Qty   | [DONE] | asn/service.py, schemas.py, test_asn_and_warehouse_intake.py
ASN.3 | Barcode & QR Data Payload Generation (Code-128)        | [DONE] | asn/service.py, supplier-portal/asns/[id]
ASN.4 | Multi-Format Scan Lookup (ASN #, AWB Tracking, Code)   | [DONE] | asn/repository.py, buyer-portal/grn/scan
ASN.5 | 1-Click Fast-Track Intake to Confirmed GRN & PO Update | [DONE] | asn/service.py, buyer-portal/grn/scan
ASN.6 | Supplier Portal ASN Creation Wizard & Packaging Slip   | [DONE] | supplier-portal/asns/new, supplier-portal/asns/[id]
ASN.7 | Multi-Tenant & Supplier Vendor-Isolation Protection    | [DONE] | asn/router.py, test_asn_and_warehouse_intake.py
OVERALL: 7/7 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```

### 📊 SPEC Audit: Requisition-to-PO Workflow (2026-09-09)
```
MODULE | SPEC REQUIREMENT | STATUS | ARTIFACT / CODE
PR.1 | PR Creation, Submission & Multi-Tier Approvals | [DONE] | requisition/service.py, tasks/page.tsx
PR.2 | Budget Check & Hard Block Gate                 | [DONE] | test_requisition.py, BudgetIndicator.tsx
PR.3 | PR Splitting & Merging with Line Allocations   | [DONE] | test_split_pr, requisitions/[id]/page.tsx
PR.4 | Auto-Conversion of Approved PR to PO          | [DONE] | convert_to_po, purchase-orders/[id]/page.tsx
PR.5 | Bidirectional PR <-> PO Linkage & Navigation   | [DONE] | POResponse.source_pr_id, PO success banner
PO.1 | Vendor Acknowledgement / Rejection / Amendment | [DONE] | supplier-portal/purchase-orders/[id]/page.tsx
OVERALL: 6/6 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```

