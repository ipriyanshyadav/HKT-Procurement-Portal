# S2P Procurement Portal

Enterprise Source-to-Pay procurement platform built on FastAPI (backend) + Next.js 14 (frontend).

## Current Session State

**Status:** APPLE DESIGN SYSTEM: THEME SIMPLIFICATION, COMPREHENSIVE DARK MODE & HARDCODED DATA REMOVAL COMPLETE (2026-09-03)  
**Migration Head:** `0028_update_category_level_check`  
**Test Suite:** 142/142 backend unit tests passing cleanly (`pytest tests/unit/`), 100% frontend production builds passing across all 3 portals (86/86 routes compiled in 29.6s with `pnpm run build`), 0 TypeScript errors (`tsc --noEmit`).  
**Implementation Summary:**

1. **Liquid Glass Deprecation & Theme Streamlining:**
   - Completely removed Liquid Glass theme and associated CSS/TS/SVG artifacts across the monorepo per user directive.
   - Streamlined `ThemeProvider` and `ThemeSwitcher` to clean, high-performance 2-state toggle: **☀️ Light** (`apple-light`) and **🌙 Dark** (`apple-dark`).
   - Removed `<LiquidGlassBackground />`, SVG refraction filters, and liquid glass cursor trackers.
2. **Systemic Dark Mode Architecture Across All Portals & Tabs:**
   - Enabled `darkMode: 'class'` across all three Next.js applications (`admin-portal`, `buyer-portal`, `supplier-portal`).
   - Synced both `theme-apple-dark` and `dark` class tokens to `document.documentElement` to activate Tailwind `dark:` variants and CSS custom properties simultaneously.
   - Overhauled `apple-base.css` to guarantee dark mode adaptation: pure `#000000` background, elevated `#1C1C1E` card surfaces, `#2C2C2E` fills, hairline `#FFFFFF/12` borders, and high-contrast Apple SF typography.
2. **ThemeSwitcher, Universal Dark Mode & Popups/Blur:**
   - Mounted `ThemeSwitcher` (Apple segmented control: ☀️ Light / 🌙 Dark) directly into navbars of all 3 portals (`admin-portal`, `buyer-portal`, `supplier-portal`).
   - Extended `apple-base.css` and `apple-tokens.css` with unified `.dark`, `.theme-apple-dark`, and `[data-theme="apple-dark"]` selectors across all inputs, cards, selects, textareas, tables, hover states, and dynamic status badges.
   - Standardized Apple frosted glass vibrancy on all popups and modals: `backdrop-filter: blur(24px) saturate(190%)`, `-webkit-backdrop-filter`, dark translucent fills (`rgba(28, 28, 30, 0.85)`), hairline borders, and 20px radius.
   - Enforced Apple HIG pill shape (`rounded-full` / 980px) and spring micro-press (`scale(0.98)`) across primary and secondary buttons.
3. **Complete Elimination of Hardcoded Data & Account Recovery:**
   - Buyer Budgets, Buyer Catalog, Supplier Catalog, Deliveries, and Messages now exclusively use live hooks with zero hardcoded sample records.
   - Reactivated super administrator account `admin@yourcompany.com` in PostgreSQL with audit log verification.
4. **Verification:**
   - Frontend build: all 3 portals compiled & generated 86/86 static routes cleanly in 24.5s (`pnpm run build` exited with 0).
   - Backend unit suite: 142/142 tests passed in 26.08s.

**Next:** Final user walkthrough and interactive verification.

## Module Status

| Module                          | Status     | Migration                        | Tests                                     |
| ------------------------------- | ---------- | -------------------------------- | ----------------------------------------- |
| Core Scaffolding (SPEC_01)      | ✅ Complete | —                                | ✅ Unit passing                            |
| Architecture Wiring (SPEC_02)   | ✅ Complete | —                                | ✅ Unit passing                            |
| Database Schema (SPEC_03)       | ✅ Complete | 0027_data_seed                   | ✅ 28 passing                              |
| Auth / Security (SPEC_04)       | ✅ Complete | 0027_data_seed                   | ✅ 69 passing (85% cov)                    |
| Workflow Engine (SPEC_05)       | ✅ Complete | 0027_data_seed                   | ✅ Passing                                 |
| Approval Rules (SPEC_06)        | ✅ Complete | 0027_data_seed                   | ✅ Passing                                 |
| Vendor Management (SPEC_07)     | ✅ Complete | 0027_data_seed                   | ✅ 8 passing                               |
| Purchase Requisition (SPEC_08)  | ✅ Complete | 0027_data_seed                   | ✅ 9 passing                               |
| Unmapped PR (SPEC_09)           | ✅ Complete | 0027_data_seed                   | ✅ 9 passing                               |
| RFQ Lifecycle (SPEC_10)         | ✅ Complete | 0027_data_seed                   | ✅ 7 passing                               |
| Bid Management (SPEC_11)        | ✅ Complete | 0027_data_seed                   | ✅ 7 passing                               |
| Comparative Statement (SPEC_12) | ✅ Complete | 0028_update_category_level_check | ✅ 6 passing                               |
| Contract Management (SPEC_13)   | ✅ Complete | 0028_update_category_level_check | ✅ 6 passing                               |
| Purchase Order (SPEC_14)        | ✅ Complete | 0028_update_category_level_check | ✅ 6 passing                               |
| Invoice / Payment (SPEC_15)     | ✅ Complete | 0028_update_category_level_check | ✅ 6 passing                               |
| Notifications (SPEC_16)         | ✅ Complete | 0028_update_category_level_check | ✅ 9 passing                               |
| Document Management (SPEC_17)   | ✅ Complete | 0028_update_category_level_check | ✅ 9 passing                               |
| API Design Standards (SPEC_18)  | ✅ Complete | —                                | ✅ 138 passing                             |
| Frontend (SPEC_19)              | ✅ Complete | —                                | ✅ 3 portals built cleanly                 |
| Integration (SPEC_20)           | ✅ Complete | 0028_update_category_level_check | ✅ 11 passing                              |
| Infrastructure (SPEC_21)        | ✅ Complete | —                                | ✅ Manifest validation passing             |
| Observability (SPEC_22)         | ✅ Complete | —                                | ✅ Unit passing                            |
| Testing (SPEC_23)               | ✅ Complete | —                                | ✅ 229 backend / 3 frontend suites passing |
| Master Data (SPEC_24)           | ✅ Complete | 0028_update_category_level_check | ✅ Passing                                 |
| Analytics (SPEC_25)             | ✅ Complete | 0028_update_category_level_check | ✅ 6 passing                               |

## Tech Stack

| Layer            | Technology                                                            |
| ---------------- | --------------------------------------------------------------------- |
| API              | FastAPI 0.115+, Python 3.12, Uvicorn                                  |
| ORM              | SQLAlchemy 2.0 async + asyncpg                                        |
| Migrations       | Alembic (async env)                                                   |
| Queue            | RabbitMQ 3.13 via aio-pika                                            |
| Cache / Sessions | Redis 7 via redis-py async                                            |
| Object Storage   | MinIO                                                                 |
| Task Queue       | Celery 5.4 + Beat                                                     |
| Gateway          | Kong 3.6 (DB-less declarative)                                        |
| Tracing          | OpenTelemetry + Jaeger                                                |
| Metrics          | Prometheus + Grafana                                                  |
| Auth             | JWT RS256, TOTP MFA, SAML 2.0, OIDC                                   |
| Frontend         | Next.js 14 (App Router), Turborepo, TanStack Query, Zustand, Radix UI |

## Quickstart & Verification

### Mode 1: Complete Docker Stack
```bash
# Start all containers (Postgres, Redis, RabbitMQ, MinIO, Kong, API, Worker, Portals)
docker compose -f docker/docker-compose.yml up -d
```
Portals:
- Buyer Portal: http://localhost:3000
- Supplier Portal: http://localhost:3001
- Admin Portal: http://localhost:3002
- API Gateway (Kong): http://localhost:8000

### Mode 2: Local Development (Hybrid)
```bash
# 1. Start backing services only in Docker (do NOT start kong or api)
docker compose -f docker/docker-compose.yml up -d postgres redis rabbitmq minio jaeger elasticsearch

# 2. Seed data
.venv/bin/python scripts/generate_rsa_keys.py
.venv/bin/python scripts/seed_master_data.py
.venv/bin/python scripts/seed_demo_user.py

# 3. Start API backend locally on port 8000
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 4. Start Celery worker locally
.venv/bin/celery -A app.tasks.celery_app worker -l info

# 5. Start frontends locally
cd procurement-portal-frontend && pnpm dev
```

### Run Tests
```bash
.venv/bin/pytest tests/ -v
cd procurement-portal-frontend && pnpm typecheck
```

## Test Commands

```bash
# Backend unit tests
pytest tests/unit/ -v

# Auth & Security tests with 85% coverage
pytest tests/ -v --cov=app/auth --cov=app/modules/user --cov-fail-under=85

# Backend integration tests (requires running infra)
pytest tests/integration/ -v

# All tests with coverage
pytest tests/ -v --cov=app --cov-fail-under=80

# Frontend
cd procurement-portal-frontend
pnpm test --all-projects
pnpm run typecheck
pnpm run build
```

## Quick Start

> **For a brand-new engineer.** Follow every step in order. Do not skip. Each step depends on the one before.

---

### Prerequisites — Install These First

Before touching any project code, make sure every tool below is installed on your machine.

| Tool               | Minimum Version         | Install Command / Link                                                                |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------- |
| **Python**         | 3.12+                   | `brew install python@3.12` (macOS) / [python.org](https://python.org)                 |
| **pip / pip3**     | bundled with Python     | —                                                                                     |
| **Node.js**        | 20 LTS+                 | `brew install node` / [nodejs.org](https://nodejs.org)                                |
| **pnpm**           | 9+                      | `npm install -g pnpm`                                                                 |
| **Docker Desktop** | 4.x+                    | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Docker Compose** | v2 (bundled in Desktop) | `docker compose version`                                                              |
| **Git**            | 2.x+                    | `brew install git`                                                                    |

Verify everything is ready:

```bash
python3 --version      # Python 3.12.x
node --version         # v20.x.x
pnpm --version         # 9.x.x
docker --version       # Docker version 26.x.x
docker compose version # Docker Compose version v2.x.x
git --version          # git version 2.x.x
```

---

### Step 1 — Clone the Repository

```bash
git clone <your-repo-url> procurement-portal
cd procurement-portal
```

> **If you already have the directory** (e.g. handed off from a colleague), just `cd` into it.

---

### Step 2 — Create & Activate a Python Virtual Environment

All Python commands in this guide must be run inside the virtual environment.

```bash
# Create the venv (one-time)
python3 -m venv .venv

# Activate it — macOS / Linux
source .venv/bin/activate

# Activate it — Windows (PowerShell)
# .venv\Scripts\Activate.ps1

# Your prompt should now show (.venv) at the start
```

Install all Python dependencies:

```bash
pip install --upgrade pip
pip install -e .          # installs from pyproject.toml
```

> `pip install -e .` installs the project in "editable" mode, meaning code changes are reflected immediately without reinstalling.

---

### Step 3 — Set Up Environment Variables

> **This is the most common place where new engineers get stuck.** Read this section fully before touching `.env`.

The application reads **all** configuration from a `.env` file in the project root. **No value is hardcoded.** The file `.env.example` is a fully documented template — your job is to copy it and fill in the blanks.

```bash
cp .env.example .env
```

Open `.env` in your editor. Every value marked `<REPLACE_ME>` **must** be filled in before the application will start.

---

#### 3a — Understanding the Template

`.env.example` is divided into sections. Here is what each section is for and what you need to do:

| Section                         | What it controls                                       | Action required?                                          |
| ------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| `# Application`                 | App version, environment, debug flag                   | ✅ Leave as-is for local dev                               |
| `# Database`                    | PostgreSQL connection URLs and pool settings           | ✅ Fill in user/password (Step 3b)                         |
| `# PostgreSQL (docker-compose)` | Credentials Docker uses to initialize the DB container | ✅ Must match `DATABASE_URL` exactly                       |
| `# Redis`                       | Cache, sessions, Celery backend                        | ✅ Leave as-is (default port)                              |
| `# RabbitMQ`                    | Message queue connection                               | ✅ Fill in user/password                                   |
| `# MinIO`                       | Object storage (documents, attachments)                | ✅ Use `minioadmin` / `minioadmin` for local dev           |
| `# JWT / Auth`                  | Key file paths + token expiry settings                 | ⚠️ Key paths set in Step 4 — leave defaults now           |
| `# Field Encryption`            | AES-256 encryption key for sensitive DB columns        | ✅ **Must generate** — see Step 3c                         |
| `# Superadmin`                  | First admin account credentials                        | ✅ Fill in (used once by `create_superadmin.py`)           |
| `# External Services`           | SendGrid, Razorpay, MSG91, Twilio, Digio, DocuSign     | ⬜ Leave blank for local dev — features degrade gracefully |
| `# Observability`               | Jaeger host/port, log level                            | ✅ Leave as-is                                             |
| `# CORS`                        | Allowed frontend origins                               | ✅ Leave as-is for local dev                               |
| `# Celery schedule intervals`   | Background task frequency                              | ✅ Leave as-is                                             |
| `# Business rules`              | Thresholds, limits, SLAs                               | ✅ Leave as-is                                             |
| `# Grafana`                     | Dashboard admin password                               | ✅ Set any password                                        |
| `# Frontend portals`            | API URL that the Next.js apps call                     | ✅ Leave as-is (Kong on port 8080)                         |
| `# SSRF Prevention`             | Allowed external HTTP domains                          | ✅ Leave as-is                                             |
| `# SSO / SAML 2.0`              | SAML identity provider                                 | ⬜ Leave blank unless you have a SAML IdP                  |
| `# OIDC / Azure AD`             | OAuth2/OIDC client credentials                         | ⬜ Leave blank unless you have Azure AD / OIDC             |

---

#### 3b — Minimum Required Values for Local Dev

Copy these into your `.env`, replacing the placeholders with your chosen credentials. **Keep the same value everywhere the same credential appears** — mismatches are the #1 cause of startup failures.

```dotenv
# --- PostgreSQL ---
# These THREE values must be consistent with each other:
# POSTGRES_USER / POSTGRES_PASSWORD are what Docker uses to create the DB.
# DATABASE_URL must embed the same user/password/host/dbname.
POSTGRES_USER=app_user
POSTGRES_PASSWORD=dev_password_123
POSTGRES_DB=procurement
DATABASE_URL=postgresql+asyncpg://app_user:dev_password_123@localhost:5432/procurement
ANALYTICS_DATABASE_URL=postgresql+asyncpg://app_user:dev_password_123@localhost:5432/procurement

# --- Redis ---
# Default — no auth needed for local dev
REDIS_URL=redis://localhost:6379/0

# --- RabbitMQ ---
# Again: RABBITMQ_USER/RABBITMQ_PASS must match the URL embedded credentials
RABBITMQ_URL=amqp://app_user:dev_password_123@localhost:5672/
RABBITMQ_USER=app_user
RABBITMQ_PASS=dev_password_123
RABBITMQ_VHOST=/

# --- MinIO ---
# These are the default MinIO dev credentials — fine for local use
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# --- Field Encryption (REQUIRED — see Step 3c for how to generate) ---
FIELD_ENCRYPTION_KEY=<paste generated key here>

# --- Superadmin ---
SUPERADMIN_EMAIL=admin@yourcompany.com
SUPERADMIN_PASSWORD=SecurePass123!
SUPERADMIN_ORG_NAME=Acme Corp

# --- Grafana ---
GRAFANA_PASSWORD=admin

# --- Frontend portals ---
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080
INTERNAL_API_URL=http://api:8000
```

> ⚠️ **Critical rule:** `POSTGRES_USER` + `POSTGRES_PASSWORD` in the Docker section **must exactly match** the credentials embedded in `DATABASE_URL`. If they differ, Alembic migrations and the API will fail with authentication errors.

---

#### 3c — Generate the Field Encryption Key

`FIELD_ENCRYPTION_KEY` is **mandatory**. The app will refuse to start without it. It must be a 32-byte URL-safe base64-encoded secret. Generate it with one command:

```bash
python3 -c "import secrets, base64; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
```

Copy the output (looks like `abc123XYZ...==`) and paste it into `.env`:

```dotenv
FIELD_ENCRYPTION_KEY=abc123XYZ...==
```

> 🔒 **Never reuse this key across environments.** Generate a fresh one for staging and production. Losing it means you cannot decrypt existing encrypted fields.

---

#### 3d — JWT Key Paths (Step 4 handles this)

Leave `JWT_PRIVATE_KEY_PATH` and `JWT_PUBLIC_KEY_PATH` at their defaults for now. **Step 4** runs the key-generation script that creates the `.pem` files. You will update these paths after Step 4 if needed.

```dotenv
# Leave these as-is — Step 4 generates the actual files
JWT_PRIVATE_KEY_PATH=jwt_private.pem
JWT_PUBLIC_KEY_PATH=jwt_public.pem
```

---

#### 3e — External Services (Leave Blank for Local Dev)

The following variables are for third-party integrations. **Leave them blank or with** `<REPLACE_ME>` **for local dev** — the application handles their absence gracefully (those features will simply be unavailable):

| Variable                                                       | Service              | What breaks if missing          |
| -------------------------------------------------------------- | -------------------- | ------------------------------- |
| `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL`                     | Email delivery       | Notification emails not sent    |
| `MSG91_AUTH_KEY` / `MSG91_SENDER_ID`                           | SMS delivery         | SMS notifications not sent      |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`                     | SMS (alternative)    | SMS notifications not sent      |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`                      | Payment gateway      | Payment initiation disabled     |
| `DIGIO_CLIENT_ID` / `DIGIO_CLIENT_SECRET`                      | e-Signing (Digio)    | Digital signature flow disabled |
| `DOCUSIGN_ACCOUNT_ID` / `DOCUSIGN_INTEGRATION_KEY`             | e-Signing (DocuSign) | DocuSign flow disabled          |
| `GST_API_KEY` / `NSDL_API_KEY`                                 | GST/PAN verification | Compliance checks skipped       |
| `SAML_IDP_METADATA_URL`                                        | SAML SSO             | SSO login unavailable           |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` / `OIDC_DISCOVERY_URL` | OIDC / Azure AD SSO  | OIDC login unavailable          |

---

#### 3f — Validate Your `.env` Before Continuing

Before moving to Step 4, do a quick sanity check:

```bash
# Check no <REPLACE_ME> placeholders remain in required fields
grep "<REPLACE_ME>" .env

# If the output includes any of these lines, you must fill them in:
#   DATABASE_URL, POSTGRES_USER, POSTGRES_PASSWORD, RABBITMQ_URL,
#   RABBITMQ_USER, RABBITMQ_PASS, FIELD_ENCRYPTION_KEY,
#   SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD

# Verify the encryption key is present and non-empty
grep "FIELD_ENCRYPTION_KEY" .env
# Should show: FIELD_ENCRYPTION_KEY=<a long base64 string, NOT <REPLACE_ME>>
```

If `grep "<REPLACE_ME>" .env` returns no lines for the required fields listed above, you are ready to continue.

---

### Step 4 — Generate RSA Keys (JWT Auth)

The API uses RS256 asymmetric keys for JWT tokens. Generate them once:

```bash
python3 scripts/generate_rsa_keys.py
```

This creates `jwt_private.pem` and `jwt_public.pem` in the project root. Update `.env` if your paths differ:

```dotenv
JWT_PRIVATE_KEY_PATH=jwt_private.pem
JWT_PUBLIC_KEY_PATH=jwt_public.pem
```

---

### Step 5 — Start All Infrastructure Services (Docker)

This single command starts PostgreSQL, Redis, RabbitMQ, MinIO, Jaeger, Prometheus, Grafana, and ClamAV:

```bash
docker compose -f docker/docker-compose.yml up -d \
  postgres redis rabbitmq minio jaeger prometheus grafana clamav
```

> **Note:** We start only the infrastructure services here, not the application containers (`api`, `celery-`*, `kong`, portals). The application will be started directly in later steps, which makes development faster (no Docker rebuild needed on every code change).

Wait ~20 seconds, then verify all services are healthy:

```bash
docker compose -f docker/docker-compose.yml ps
```

Expected output — all infra services should show `healthy` or `running`:

```
NAME        STATUS
postgres    running (healthy)
redis       running (healthy)
rabbitmq    running (healthy)
minio       running (healthy)
jaeger      running
prometheus  running
grafana     running
clamav      running
```

If any service shows `unhealthy`, inspect its logs:

```bash
docker compose -f docker/docker-compose.yml logs <service-name>
# e.g.:
docker compose -f docker/docker-compose.yml logs postgres
```

---

### Step 6 — Set Up RabbitMQ Exchange / Queue Topology

The application uses specific exchanges and queues that must be declared before the app starts:

```bash
# Make sure your .venv is active
python3 scripts/rabbitmq_setup.py
```

Expected output: `✅ RabbitMQ topology created successfully`

> If it fails with a connection error, wait a few more seconds for RabbitMQ to fully initialize and retry.

---

### Step 7 — Set Up MinIO Buckets

Document storage requires pre-created buckets in MinIO:

```bash
python3 scripts/minio_setup.py
```

Expected output: `✅ MinIO buckets created successfully`

You can browse the MinIO console at **[http://localhost:9001](http://localhost:9001)** (login: `minioadmin` / `minioadmin`) to visually confirm the buckets exist.

---

### Step 8 — Run Database Migrations

Apply all Alembic migrations to create the full schema (28 migration files):

```bash
alembic upgrade head
```

Expected output ends with something like:

```
INFO  [alembic.runtime.migration] Running upgrade ... -> 0028_update_category_level_check
```

Verify the current migration head:

```bash
alembic current
```

Should show: `0028_update_category_level_check (head)`

---

### Step 9 — Seed Master Data & Reference Data

Populate the database with required reference data (categories, currencies, units of measure, approval rules, workflow definitions, notification templates):

```bash
# Core master data (categories, UoMs, currencies, business units, etc.)
python3 scripts/seed_master_data.py

# Workflow templates (approval chains, escalation rules)
python3 scripts/seed_workflows.py

# Notification templates (email/SMS/in-app templates)
python3 scripts/seed_notification_templates.py
```

Each script prints a summary of records created. If a script fails mid-way, it is safe to re-run — it uses upsert semantics.

---

### Step 10 — Create the Superadmin User

Create the first administrator account for your organisation:

```bash
SUPERADMIN_EMAIL=admin@yourcompany.com \
SUPERADMIN_PASSWORD=SecurePass123! \
SUPERADMIN_ORG_NAME="Acme Corp" \
python scripts/create_superadmin.py
```

Or, if you already set these values in `.env`, simply run:

```bash
python3 scripts/create_superadmin.py
```

Expected output:

```
✅ Organisation "Acme Corp" created
✅ Superadmin admin@yourcompany.com created with SUPERADMIN role
```

---

### Step 11 — Start the Backend API

```bash
# Make sure .venv is active
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The `--reload` flag automatically restarts the server when you change Python files.

Verify the API is running:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{"status": "ok", "version": "1.0.0"}
```

Interactive API docs are available at:

- **Swagger UI:** [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs) (or [http://localhost:8000/docs](http://localhost:8000/docs))
- **ReDoc:** [http://localhost:8000/api/v1/redoc](http://localhost:8000/api/v1/redoc) (or [http://localhost:8000/redoc](http://localhost:8000/redoc))

---

### Step 12 — Start the Celery Workers (Background Tasks)

Open **two new terminal tabs/windows** (keep the API running in its own terminal). Activate `.venv` in each:

```bash
# Terminal 2 — Celery worker (processes async tasks)
source .venv/bin/activate
celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
```

```bash
# Terminal 3 — Celery Beat (scheduled/periodic tasks)
source .venv/bin/activate
celery -A app.tasks.celery_app beat --loglevel=info
```

> Workers handle background jobs like notification delivery, document virus scanning, outbox event publishing, and SLA checks. The app works without them, but background features will not process.

---

### Step 13 — Start the API Gateway (Kong)

Kong proxies all frontend traffic to the API and enforces rate limiting, auth, and routing:

```bash
docker compose -f docker/docker-compose.yml up -d kong
```

Verify Kong is ready:

```bash
curl http://localhost:8080/health
```

Should return the same `{"status": "ok"}` response proxied through Kong.

---

### Step 14 — Start the Frontend Portals

The frontend is a **Turborepo monorepo** with three Next.js apps. Open a new terminal:

```bash
cd procurement-portal-frontend

# Install dependencies (first time only)
pnpm install

# Start all three portals in development mode
pnpm dev
```

This starts:

| Portal              | URL                                            | Who Uses It                                                            |
| ------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| **Buyer Portal**    | [http://localhost:3000](http://localhost:3000) | Internal procurement team (create PRs, evaluate bids, approve POs)     |
| **Supplier Portal** | [http://localhost:3001](http://localhost:3001) | External vendors (respond to RFQs, submit bids, upload invoices)       |
| **Admin Portal**    | [http://localhost:3002](http://localhost:3002) | System administrators (manage users, roles, master data, org settings) |

> First run may take 2–3 minutes as Next.js compiles all pages.

---

### Step 15 — Verify the Full Stack

Run this checklist to confirm everything is wired up correctly:

```bash
# 1. Backend health
curl http://localhost:8000/health
# → {"status":"ok","version":"1.0.0"}

# 2. Kong gateway health
curl http://localhost:8080/health
# → same response, proxied

# 3. Login as superadmin (get a JWT token)
# First fetch your organization ID:
# ORG_ID=$(docker compose -f docker/docker-compose.yml exec -T postgres psql -U app_user -d procurement -t -A -c "SELECT org_id FROM users WHERE email='admin@yourcompany.com';")
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@yourcompany.com\",\"password\":\"SecurePass123!\",\"org_id\":\"${ORG_ID:-14a30ee4-aa19-4137-871c-e511c65f9067}\"}" | python3 -m json.tool
# → {"access_token":"eyJ...","token_type":"bearer"}

# 4. PostgreSQL connectivity
docker compose -f docker/docker-compose.yml exec postgres \
  psql -U app_user -d procurement -c "\dt" | head -20
# → lists all ~30+ tables

# 5. Redis connectivity
docker compose -f docker/docker-compose.yml exec redis redis-cli ping
# → PONG

# 6. RabbitMQ management UI
open http://localhost:15672
# Login: app_user / dev_password_123

# 7. MinIO console
open http://localhost:9001
# Login: minioadmin / minioadmin

# 8. Jaeger tracing UI
open http://localhost:16686

# 9. Prometheus metrics
open http://localhost:9090

# 10. Grafana dashboards
open http://localhost:3003
# Login: admin / (your GRAFANA_PASSWORD from .env)
```

---

### Running the Test Suite

```bash
# All backend tests with coverage (requires infra running)
pytest tests/ -v --cov=app --cov-fail-under=80

# Backend unit tests only (no infra needed)
pytest tests/unit/ -v

# Auth & security tests (85% coverage gate)
pytest tests/ -v --cov=app/auth --cov=app/modules/user --cov-fail-under=85

# Integration tests (requires full infra)
pytest tests/integration/ -v

# Frontend — type-check + build validation
cd procurement-portal-frontend
pnpm run typecheck
pnpm test --all-projects

# Frontend — production build (slow, validates all pages compile)
pnpm run build
```

---

### Service Port Reference

| Service          | Local URL                                        | Purpose                                     |
| ---------------- | ------------------------------------------------ | ------------------------------------------- |
| FastAPI (direct) | [http://localhost:8000](http://localhost:8000)   | Backend API, health, docs                   |
| Kong Gateway     | [http://localhost:8080](http://localhost:8080)   | API gateway (use this for frontend traffic) |
| Kong Admin       | [http://localhost:8001](http://localhost:8001)   | Kong route inspection                       |
| Buyer Portal     | [http://localhost:3000](http://localhost:3000)   | Buyer-facing Next.js app                    |
| Supplier Portal  | [http://localhost:3001](http://localhost:3001)   | Supplier-facing Next.js app                 |
| Admin Portal     | [http://localhost:3002](http://localhost:3002)   | Admin-facing Next.js app                    |
| Grafana          | [http://localhost:3003](http://localhost:3003)   | Metrics dashboards                          |
| PostgreSQL       | localhost:5432                                   | Main database                               |
| Redis            | localhost:6379                                   | Cache & sessions                            |
| RabbitMQ AMQP    | localhost:5672                                   | Message queue                               |
| RabbitMQ UI      | [http://localhost:15672](http://localhost:15672) | Queue management                            |
| MinIO API        | localhost:9000                                   | Object storage                              |
| MinIO Console    | [http://localhost:9001](http://localhost:9001)   | Bucket management UI                        |
| Jaeger UI        | [http://localhost:16686](http://localhost:16686) | Distributed tracing                         |
| Prometheus       | [http://localhost:9090](http://localhost:9090)   | Raw metrics                                 |
| ClamAV           | localhost:3310                                   | Virus scanning (internal)                   |

---

### Common Troubleshooting

`connection refused` **on** `localhost:5432` — PostgreSQL isn't ready yet. Run `docker compose -f docker/docker-compose.yml ps` and wait for `healthy` status.

`alembic upgrade head` **fails with** `asyncpg` **error** — your `DATABASE_URL` in `.env` is incorrect. Double-check the user, password, host, and db name match what you set for `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`.

`rabbitmq_setup.py` **fails with** `ACCESS_REFUSED` — the `RABBITMQ_USER` / `RABBITMQ_PASS` in `.env` doesn't match what the Docker container was initialised with. Destroy the volume and recreate: `docker compose -f docker/docker-compose.yml down -v && docker compose -f docker/docker-compose.yml up -d rabbitmq`.

`ModuleNotFoundError` — you forgot to activate the virtual environment. Run `source .venv/bin/activate`.

`pnpm: command not found` — install pnpm: `npm install -g pnpm`.

**Frontend** `ECONNREFUSED` **(API calls failing)** — make sure `NEXT_PUBLIC_API_URL=http://localhost:8080` is set in `.env` and Kong is running (`docker compose -f docker/docker-compose.yml ps kong`).

**Celery tasks not processing** — confirm the Celery worker terminal is showing `celery@... ready`. Check `RABBITMQ_URL` in `.env` is reachable.

`nodename nor servname provided, or not known` **when running any** `scripts/*.py` — your `.env` URLs contain Docker-internal service names (`postgres`, `rabbitmq`, `redis`, `minio`) instead of `localhost`. These hostnames only work *inside* the Docker network. For scripts you run directly in your terminal, every URL must use `localhost`:

```dotenv
# ✅ Correct for local scripts
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/procurement
RABBITMQ_URL=amqp://user:pass@localhost:5672/vhost
REDIS_URL=redis://localhost:6379/0
MINIO_ENDPOINT=localhost:9000

# ❌ Wrong — Docker-internal names, unreachable from your Mac terminal
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/procurement
RABBITMQ_URL=amqp://user:pass@rabbitmq:5672/vhost
```

Quick scan to find any remaining Docker hostnames in your `.env`:

```bash
grep -E "@(postgres|rabbitmq|redis|minio):" .env
# Should return nothing. If it does, replace those hostnames with localhost.
```

## ASSUMPTIONS LOG

| ID     | Assumption                                                                                                   | Risk   |
| ------ | ------------------------------------------------------------------------------------------------------------ | ------ |
| A-01-1 | SUPERADMIN role seeded at initialization via scripts/create_superadmin.py                                    | LOW    |
| A-01-2 | Graphify initialised as empty JSON if not found (first run)                                                  | LOW    |
| A-01-3 | cost_of_capital_rate defaults to 0.12 (12%) per org in settings                                              | LOW    |
| A-01-4 | Emergency RFQ SLA = half of standard (24h vs 72h min bid window)                                             | MEDIUM |
| A-01-5 | Phase 3 features (eAuction, ML, WhatsApp, Mobile) excluded from scaffold                                     | LOW    |
| A-01-6 | Holiday master populated by seed script for default calendar                                                 | MEDIUM |
| A-02-1 | RabbitMQ topology initialised via scripts/rabbitmq_setup.py not app startup                                  | LOW    |
| A-02-2 | MinIO buckets initialised via scripts/minio_setup.py not app startup                                         | LOW    |
| A-02-3 | Cross-module calls use direct Python function calls in Phase 1 monolith                                      | LOW    |
| A-02-4 | Celery Beat runs in dedicated container separate from worker                                                 | LOW    |
| A-02-5 | audit module is service-layer only — no public router                                                        | LOW    |
| A-04-1 | OIDC SSO defaults to azure-ad provider configuration if omitted                                              | LOW    |
| A-04-2 | Just-In-Time provisioned SSO users are assigned default REQUESTOR role                                       | LOW    |
| A-08-1 | PR number format `{BU_CODE}-PR-{YYYY}-{NNNNNN}` generated per BU and year                                    | LOW    |
| A-08-2 | Merge PRs requires same BU, same Category, minimum 2 PRs, maximum 10 PRs                                     | LOW    |
| A-08-3 | Budget check is SOFT by default; HARD block enabled per tenant setting or capex budget breach                | MEDIUM |
| A-08-4 | PR aging alerts task checks pending PRs older than settings.PR_AGING_ALERT_DAYS thresholds                   | LOW    |
| A-08-5 | Redis cache for PR counts by status is invalidated on PR status changes                                      | LOW    |
| A-09-1 | Unmapped PR exception created when ERP PR lacks category or business unit                                    | MEDIUM |
| A-09-2 | SLA escalation tiers defined by settings.UNMAPPED_PR_SLA_HOURS ([4, 8, 24, 48])                              | LOW    |
| A-09-3 | ML auto-mapping requires confidence score >= 0.85 and 100+ mapping log entries                               | MEDIUM |
| A-12-1 | L1 calculated on landed_cost per line. Missing price raises MISSING_NORMALIZED_PRICES (400)                  | LOW    |
| A-12-2 | Technical + Commercial weights default to 70/30 split if omitted on RFQ                                      | LOW    |
| A-12-3 | Negotiated price increase > 0.5% tolerance threshold raises PRICE_TOLERANCE_EXCEEDED                         | LOW    |
| A-12-4 | CS PDF uploaded to MinIO comparative-statement bucket using reportlab                                        | LOW    |
| A-12-5 | Regret letters published as outbox events to non-awarded vendors on award approval                           | LOW    |
| A-17-1 | ClamAV scan runs async via Celery; file stored with scan_status=PENDING initially; updated to CLEAN/INFECTED | MEDIUM |
| A-17-2 | Infected files moved to quarantine bucket; original MinIO path deleted; scan_status=INFECTED                 | LOW    |
| A-17-3 | Presigned URL TTL = 900s (15 min); generated on demand                                                       | LOW    |
| A-17-4 | sanitize_filename strips path separators, null bytes, and non-ASCII; truncates to 255 chars                  | LOW    |
| A-17-5 | ALLOWED_MIME_TYPES by document_type stored in config; validated against magic bytes                          | LOW    |
| A-19-1 | Access token stored in memory (Zustand state); refresh token in httpOnly cookie                              | HIGH   |
| A-19-2 | `packages/types/` generated at build time via `pnpm generate:types`                                          | MEDIUM |
