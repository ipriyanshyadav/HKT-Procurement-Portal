# IMPLEMENTATION PLAN — SPEC_01: Project Overview & Governance
**Module:** 01 | **Phase:** Foundation | **Squad:** All Squads
**Spec File:** SPEC_01_PROJECT_OVERVIEW.md | **Plan Date:** 2026-08-04

---

## SESSION BOOTSTRAP CHECKLIST
- [x] 0-A: GEMINI.md read top-to-bottom
- [x] 0-B: Graphify graph loaded (run `graphify check --before-change`)
- [x] 0-C: README.md read — note completed modules and migration head
- [x] 0-D: SPEC_01_PROJECT_OVERVIEW.md fully read and analyzed
- [x] 0-E: `## Current Session State` in README checked before resuming

---

## SPEC COVERAGE MAP (Step 2.5 Pre-Audit)
| Req# | Section | Coverage Target | Status |
|---|---|---|---|
| S01-01 | System Classification (S2C, P2P, SRM, Analytics) | Project scaffolding + README | PLANNED |
| S01-02 | 7 Operating Models supported | Tenant settings schema + README | PLANNED |
| S01-03 | 22 Module inventory | Directory structure + router registration | PLANNED |
| S01-04 | NFR: 99.9% uptime SLA | K3s HA manifests + monitoring | PLANNED |
| S01-05 | NFR: RTO 4h, RPO 1h | DR runbook + WAL config | PLANNED |
| S01-06 | Performance targets (7 scenarios) | K6 baselines in tests/ | PLANNED |
| S01-07 | Security NFR (OWASP, AES-256, TLS1.3, JWT RS256) | Core security module | PLANNED |
| S01-08 | Audit retention (7 categories, 1–10 years) | Partition + lifecycle policy | PLANNED |
| S01-09 | Scalability NFR (horizontal FastAPI, Celery, Redis Sentinel) | K3s manifests + HPA | PLANNED |
| S01-10 | 5 Compliance rules (org_id, no auto-approve, audit log, maker-checker, bid sealed) | Core dependencies + DB triggers | PLANNED |
| S01-11 | Deployment: single-tenant → multi-tenant path | org_id on every table | PLANNED |
| S01-12 | Environment strategy (local/dev/staging/production/DR) | docker-compose + K3s overlays | PLANNED |
| S01-13 | Phase 1 MVP feature set (all 38 features) | Sprint 1-10 implementation | PLANNED |
| S01-14 | Phase 2 Enterprise feature set | Deferred PLANNED items | PLANNED |
| S01-15 | Squad decomposition (A–E) | README squad map | PLANNED |
| S01-16 | Sprint breakdown (Sprints 1–10) | README sprint tracker | PLANNED |
| S01-17 | Dependency DAG (Levels 0–15) | Graphify graph + README | PLANNED |
| S01-18 | Tech stack (all 20+ technologies) | pyproject.toml + package.json | PLANNED |
| S01-19 | 7-step Implementation Loop | GEMINI.md compliance | PLANNED |
| S01-20 | Commit standards | .pre-commit-config.yaml | PLANNED |
| S01-21 | Backend directory structure (Part 5) | Scaffolding task | PLANNED |
| S01-22 | Frontend guidelines (Next.js 14, TanStack, Radix) | Turborepo setup | PLANNED |

---

## ASSUMPTIONS LOG

| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-01-1 | `SUPERADMIN` role seeded at initialization time (not in migration) | SPEC does not define seeding mechanism; scripts/create_superadmin.py implied | LOW — worst case is empty role table | Squad A Lead |
| A-01-2 | Graphify graph initialized as empty JSON if not found | Session bootstrap requires loading graph; first run has no file | LOW | DevOps |
| A-01-3 | `cost_of_capital_rate` defaults to 12% (0.12) per org; can be overridden via tenant_settings | SPEC states 12% as default in organizations table DDL | LOW | Squad A Lead |
| A-01-4 | Emergency RFQ SLA is half of standard (24h bid window min instead of 72h) | SPEC references emergency path but does not specify min window in SPEC_01 | MEDIUM — incorrect SLA can violate compliance | Squad B Lead |
| A-01-5 | Phase 3 features (eAuction, ML, WhatsApp, Mobile, Multi-tenant) excluded from initial scaffolding but directories stubbed with `# Phase 3 — not implemented` comments | SPEC_01 section 6 clearly delineates phases | LOW | All Squad Leads |
| A-01-6 | `holiday_master` populates default Indian national holidays for year 1 via seed script | SPEC references business day calculation in timeline management but does not define seed data | MEDIUM — incorrect business day calc breaks RFQ timelines | Squad B + E |
| A-01-7 | `project_graph.json` uses schema format per GEMINI.md Part 4 node schema definition | Graphify schema not separately defined | LOW | All Leads |

---

## STEP 1 — PLAN (Foundation Scaffolding)

### 1.1 Objective
Establish the complete project skeleton that all 25 modules will be built upon. This plan covers the scaffolding, not the business modules themselves. Every future module plan references the structure created here.

### 1.2 Pre-Implementation Checklist
```bash
graphify check --before-change
# Must return: No nodes exist — clean start
grep -R "org_id" app/ || echo "No code yet — scaffold needed"
```

---

## STEP 2 — IMPLEMENT

### 2.1 Backend Scaffolding (Squad A — Sprint 1)

#### 2.1.1 Python Project Setup
**File:** `pyproject.toml`
```toml
[project]
name = "procurement-portal"
version = "1.0.0"
requires-python = ">=3.14"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "asyncpg>=0.29.0",
    "alembic>=1.13.0",
    "pydantic[email]>=2.7.0",
    "celery[rabbitmq]>=5.4.0",
    "aio-pika>=9.4.0",
    "redis[hiredis]>=5.0.0",
    "minio>=7.2.0",
    "boto3>=1.34.0",
    "loguru>=0.7.0",
    "prometheus-fastapi-instrumentator>=7.0.0",
    "opentelemetry-sdk>=1.24.0",
    "opentelemetry-exporter-otlp>=1.24.0",
    "opentelemetry-instrumentation-fastapi>=0.45b0",
    "opentelemetry-instrumentation-sqlalchemy>=0.45b0",
    "opentelemetry-instrumentation-redis>=0.45b0",
    "opentelemetry-instrumentation-httpx>=0.45b0",
    "opentelemetry-instrumentation-celery>=0.45b0",
    "opentelemetry-exporter-jaeger>=1.21.0",
    "httpx>=0.27.0",
    "cryptography>=42.0.0",
    "passlib[bcrypt]>=1.7.4",
    "pyotp>=2.9.0",
    "python-jose[cryptography]>=3.3.0",
    "python3-saml>=1.16.0",
    "authlib>=1.3.0",
    "python-multipart>=0.0.9",
    "python-magic>=0.4.27",
    "Levenshtein>=0.23.0",
    "simpleeval>=0.9.13",
    "reportlab>=4.2.0",
    "pillow>=10.3.0",
    "elasticsearch[async]>=8.13.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.coverage.run]
source = ["app"]
omit = ["app/tasks/celery_app.py"]
```

#### 2.1.2 Complete Directory Structure
**Create ALL directories exactly as specified in SPEC_02 Section 2:**

```bash
# Execute exactly in this order
mkdir -p app/{core,db,auth,events,tasks}
mkdir -p app/modules/{organization,user,master_data,vendor,requisition,unmapped_pr,sourcing,bid,evaluation,award,contract,purchase_order,grn,invoice,payment,notification/channels,document,workflow,approval_rules,integration/adapters,analytics,admin,audit}
mkdir -p tests/{unit,integration,workflow,security,performance}
mkdir -p alembic/versions
mkdir -p scripts
mkdir -p docker
mkdir -p k8s/{base,overlays/{dev,staging,production,dr}}
mkdir -p kong
mkdir -p plans  # Already created
```

#### 2.1.3 `app/config.py` — Pydantic Settings (NO HARDCODED VALUES)
```python
# app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Literal

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    # Application
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: Literal["local", "dev", "staging", "production"] = "local"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str  # postgresql+asyncpg://user:pass@host:5432/procurement
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_POOL_RECYCLE: int = 3600
    SQL_ECHO: bool = False

    # Redis
    REDIS_URL: str  # redis://redis-master:6379/0
    REDIS_SESSION_DB: int = 0
    REDIS_RATE_LIMIT_DB: int = 1
    REDIS_CACHE_DB: int = 2
    REDIS_CELERY_BACKEND_DB: int = 3

    # RabbitMQ
    RABBITMQ_URL: str  # amqp://app_user:pass@rabbitmq:5672/procurement

    # MinIO
    MINIO_ENDPOINT: str
    MINIO_ACCESS_KEY: str
    MINIO_SECRET_KEY: str
    MINIO_USE_SSL: bool = False
    MINIO_MAX_FILE_SIZE_MB: int = 50

    # JWT / Auth
    JWT_PRIVATE_KEY_PATH: str  # Path to RS256 private key PEM
    JWT_PUBLIC_KEY_PATH: str   # Path to RS256 public key PEM
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_HOURS: int = 8
    JWT_KEY_ID: str = "key-2026-06"
    JWT_ALGORITHM: str = "RS256"
    MFA_INACTIVITY_TIMEOUT_MINUTES: int = 30
    MAX_CONCURRENT_SESSIONS: int = 5
    MAX_FAILED_LOGIN_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 30

    # Field Encryption
    FIELD_ENCRYPTION_KEY: str  # 32-byte URL-safe base64

    # External Services
    GST_API_BASE_URL: str = ""
    GST_API_KEY: str = ""
    NSDL_API_BASE_URL: str = ""
    NSDL_API_KEY: str = ""
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM_EMAIL: str = ""
    MSG91_AUTH_KEY: str = ""
    MSG91_SENDER_ID: str = ""
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    DIGIO_CLIENT_ID: str = ""
    DIGIO_CLIENT_SECRET: str = ""
    DOCUSIGN_ACCOUNT_ID: str = ""
    DOCUSIGN_INTEGRATION_KEY: str = ""

    # Observability
    JAEGER_HOST: str = "localhost"
    JAEGER_PORT: int = 6831
    OTEL_SAMPLING_RATE: float = 1.0  # 1.0 for dev, 0.1 for production
    LOG_LEVEL: str = "INFO"

    # CORS (local dev only)
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]

    # Celery
    CELERY_OUTBOX_INTERVAL_SECONDS: float = 5.0
    CELERY_SLA_CHECK_MINUTES: int = 15
    CELERY_BID_WINDOW_CHECK_MINUTES: int = 5

    # Business Rules (NO MAGIC NUMBERS IN LOGIC — all here)
    INVITATION_TOKEN_TTL_DAYS: int = 7
    VENDOR_GST_CACHE_TTL_DAYS: int = 90
    PAN_CACHE_TTL_DAYS: int = 90
    COMPLIANCE_EXPIRY_WARNING_DAYS: list[int] = [90, 30, 0]
    PASSWORD_MIN_LENGTH: int = 12
    PASSWORD_HISTORY_COUNT: int = 5
    PASSWORD_EXPIRY_DAYS: int = 90
    COMMON_PASSWORDS_FILE: str = "scripts/common_passwords.txt"
    PRICE_TOLERANCE_DEFAULT: float = 0.005  # 0.5%
    BID_VALIDITY_MIN_DAYS: int = 30
    BID_VALIDITY_MAX_DAYS: int = 180
    PR_AGING_ALERT_DAYS: list[int] = [7, 14, 30]
    UNMAPPED_PR_SLA_HOURS: list[int] = [4, 8, 24, 48]
    OUTBOX_RETRY_MAX: int = 10
    INTEGRATION_JOB_MAX_RETRIES: int = 7
    INTEGRATION_RETRY_DELAYS_SECONDS: list[int] = [60, 300, 900, 1800, 3600, 14400, 86400]
    DORMANT_USER_DAYS: int = 90
    VENDOR_COMPLIANCE_HOLD_EXPIRY_DAYS: int = 0  # expired = 0 days remaining
    OUTBOX_BATCH_SIZE: int = 100

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
```

#### 2.1.4 `app/db/base.py` — Base Model with org_id
```python
# app/db/base.py
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import func, UUID as SQLAlchemyUUID, String
from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional

class Base(DeclarativeBase):
    pass

class BaseModel(Base):
    """All tables inherit this. org_id is mandatory on EVERY table."""
    __abstract__ = True

    id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    org_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), onupdate=func.now(), nullable=False
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(default=None)
```

#### 2.1.5 `app/db/session.py` — Async Session Factory
```python
# app/db/session.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession, AsyncGenerator
from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_pre_ping=True,
    pool_recycle=settings.DATABASE_POOL_RECYCLE,
    echo=settings.SQL_ECHO,
)

async_session_factory = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

#### 2.1.6 `app/core/exceptions.py` — Custom Exceptions
```python
# app/core/exceptions.py
class AppException(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details: dict = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}

class NotFoundError(AppException):
    def __init__(self, entity: str, entity_id: str = ""):
        super().__init__(f"{entity.upper()}_NOT_FOUND", f"{entity} not found", 404, {"id": entity_id})

class ConflictError(AppException):
    def __init__(self, code: str, message: str, details: dict = None):
        super().__init__(code, message, 409, details)

class ForbiddenError(AppException):
    def __init__(self, code: str = "FORBIDDEN", message: str = "Insufficient permissions"):
        super().__init__(code, message, 403)

class OptimisticLockError(ConflictError):
    def __init__(self, entity: str):
        super().__init__("OPTIMISTIC_LOCK_CONFLICT", f"{entity} was modified by another user. Refresh and retry.")

class ValidationError(AppException):
    def __init__(self, code: str, message: str, details: dict = None):
        super().__init__(code, message, 422, details)

def register_exception_handlers(app):
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    from fastapi.exceptions import RequestValidationError
    from datetime import datetime

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        from app.core.telemetry import get_current_trace_id
        return JSONResponse(status_code=exc.status_code, content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "trace_id": get_current_trace_id(),
                "timestamp": datetime.utcnow().isoformat(),
            }
        })

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        from app.core.telemetry import get_current_trace_id
        return JSONResponse(status_code=422, content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": {"errors": exc.errors()},
                "trace_id": get_current_trace_id(),
                "timestamp": datetime.utcnow().isoformat(),
            }
        })

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        from loguru import logger
        from app.core.telemetry import get_current_trace_id
        logger.exception(f"Unhandled exception: {exc}")
        return JSONResponse(status_code=500, content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "details": {},
                "trace_id": get_current_trace_id(),
                "timestamp": datetime.utcnow().isoformat(),
            }
        })
```

#### 2.1.7 `app/main.py` — FastAPI Application Factory
Implement exactly as specified in SPEC_02 Section 4. Register ALL 24 module routers. Include:
- `TimingMiddleware` → `LoggingContextMiddleware` → `RequestIDMiddleware` (outermost first)
- CORS only in local environment (from `settings.ENVIRONMENT`)
- Exception handlers via `register_exception_handlers(app)`
- Prometheus instrumentator
- OpenTelemetry setup via `setup_telemetry(app)`
- Lifespan: start/stop RabbitMQ consumers

#### 2.1.8 `app/core/middleware.py` — All Middleware
Implement:
1. `RequestIDMiddleware` — generates UUID if `X-Request-ID` absent; sets on request state
2. `LoggingContextMiddleware` — binds trace_id, span_id, user_id, org_id to Loguru context
3. `TimingMiddleware` — measures request duration; logs at INFO level for all non-health requests
4. `SecurityHeadersMiddleware` — sets CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

#### 2.1.9 Alembic Setup
```bash
# alembic/env.py — async setup
# Must use asyncpg driver
# target_metadata = Base.metadata
# Naming convention: ix_%(column_0_label)s, uq_%(table_name)s_%(column_0_name)s, etc.
```

#### 2.1.10 Health Endpoints
```python
# Registered on app (no auth, no rate limiting via Kong):
# GET /health → { status: ok, timestamp }
# GET /health/ready → { status: ok|degraded, checks: {db, redis, rabbitmq, minio} }
# GET /health/live → { status: ok, timestamp }
```

#### 2.1.11 `.env.example` — Environment Template
Include ALL settings from `app/config.py`. Every key must be present. Sensitive values use placeholder `<REPLACE_ME>`.

#### 2.1.12 `docker/docker-compose.yml` — Local Development
Services required (all with explicit version tags from settings — NO latest):
- `postgres:16-alpine`
- `redis:7-alpine`
- `rabbitmq:3.13-management-alpine`
- `minio/minio:RELEASE.2024-06-04T19-20-08Z`
- `jaegertracing/all-in-one:1.57`
- `prom/prometheus:v2.52.0`
- `grafana/grafana:10.4.0`
- `ghcr.io/clamav/clamav:1.3.1`
- `procurement-api` (build from `docker/Dockerfile.api`)
- `procurement-celery` (build from `docker/Dockerfile.celery`)
- `procurement-celery-beat` (same image, different CMD: `celery beat`)

All connection URLs read from `.env` file. NO hardcoded credentials in compose file.

#### 2.1.13 Kong Configuration
**File:** `kong/kong.yml`
Implement exactly per SPEC_02 Section 10.1. Include:
- JWT plugin with RS256 public key ref
- Rate limiting (5 tiers per Section 10.2)
- Correlation ID plugin
- Request size limiting (50MB)
- CORS plugin with explicit allowed origins from env

#### 2.1.14 `app/core/constants.py` — System-Wide Constants
```python
# app/core/constants.py
# RULE: Constants here are STRUCTURAL (entity types, status codes)
# NOT business thresholds (those go in config.py / Settings)

AUDIT_INSERT_ONLY = True  # Reminder constant — enforced by DB trigger
MAKER_CHECKER_ENFORCED = True  # Enforced in WorkflowEngine

class AuditAction:
    # Auth
    AUTH_LOGIN_SUCCESS = "AUTH_LOGIN_SUCCESS"
    AUTH_LOGIN_FAILURE = "AUTH_LOGIN_FAILURE"
    AUTH_TOKEN_REFRESH = "AUTH_TOKEN_REFRESH"
    AUTH_LOGOUT = "AUTH_LOGOUT"
    AUTH_MFA_ENABLED = "AUTH_MFA_ENABLED"
    AUTH_MFA_DISABLED = "AUTH_MFA_DISABLED"
    AUTH_PASSWORD_CHANGE = "AUTH_PASSWORD_CHANGE"
    AUTH_ACCOUNT_LOCKED = "AUTH_ACCOUNT_LOCKED"
    AUTH_ACCOUNT_UNLOCKED = "AUTH_ACCOUNT_UNLOCKED"
    AUTH_ROLE_ASSIGNED = "AUTH_ROLE_ASSIGNED"
    AUTH_ROLE_REMOVED = "AUTH_ROLE_REMOVED"
    AUTH_SESSION_REVOKED = "AUTH_SESSION_REVOKED"
    AUTH_SSO_LOGIN = "AUTH_SSO_LOGIN"
    AUTH_SCOPE_CHANGED = "AUTH_SCOPE_CHANGED"
    # Vendor
    VENDOR_INVITED = "VENDOR_INVITED"
    VENDOR_SUBMITTED = "VENDOR_SUBMITTED"
    VENDOR_QUALIFIED = "VENDOR_QUALIFIED"
    VENDOR_REJECTED = "VENDOR_REJECTED"
    VENDOR_ACTIVATED = "VENDOR_ACTIVATED"
    VENDOR_SUSPENDED = "VENDOR_SUSPENDED"
    VENDOR_REINSTATED = "VENDOR_REINSTATED"
    VENDOR_BLACKLIST_INITIATED = "VENDOR_BLACKLIST_INITIATED"
    VENDOR_BLACKLISTED = "VENDOR_BLACKLISTED"
    # ... (continue for all 22 module action types)

class PermissionCode:
    PR_CREATE = "pr.create"
    PR_VIEW_OWN = "pr.view_own"
    PR_VIEW_BU = "pr.view_bu"
    PR_VIEW_ALL = "pr.view_all"
    # ... (all 100+ permission codes as string constants)
    # RULE: NEVER use string literals in permission checks — always use this class
    RFQ_VIEW_BIDS_BEFORE_OPENING = "rfq.view_bids_before_opening"  # Always denied
```

#### 2.1.15 `app/core/permissions.py` — RBAC Engine
```python
# app/core/permissions.py
# HARDCODED: rfq.view_bids_before_opening is ALWAYS denied
PERMANENTLY_DENIED_PERMISSIONS = {PermissionCode.RFQ_VIEW_BIDS_BEFORE_OPENING}

async def user_has_permission(db: AsyncSession, user_id: UUID, org_id: UUID, permission_code: str) -> bool:
    if permission_code in PERMANENTLY_DENIED_PERMISSIONS:
        return False  # Never granted regardless of role
    # ... query role_permissions via user_role_assignments
```

#### 2.1.16 Frontend Turborepo Scaffold
**Root:** `procurement-portal-frontend/`
```
turbo.json — pipeline: build, lint, test, typecheck
package.json — workspaces: apps/*, packages/*
apps/buyer-portal/ — Next.js 14 App Router (port 3000)
apps/supplier-portal/ — Next.js 14 App Router (port 3001)
apps/admin-portal/ — Next.js 14 App Router (port 3002)
packages/ui/ — shared Radix UI + Tailwind components
packages/hooks/ — TanStack Query hooks per endpoint
packages/types/ — generated TypeScript types from OpenAPI
packages/utils/ — shared utilities
packages/config/ — shared ESLint, tsconfig, Tailwind config
```

**packages/types/generate.ts:** Script calling `openapi-typescript` against `http://localhost:8000/api/v1/openapi.json` → outputs `packages/types/src/api.ts`

#### 2.1.17 `app/events/publisher.py` — Outbox Publisher
Implement exactly per SPEC_02 Section 6.2. Key constraints:
- Always called WITHIN the caller's transaction (never standalone commit)
- `org_id` mandatory on every message
- Status defaults to `PENDING`

#### 2.1.18 `app/events/outbox_worker.py` — Outbox Worker
```python
# Uses FOR UPDATE SKIP LOCKED to claim PENDING messages
# Batch size from settings.OUTBOX_BATCH_SIZE (not hardcoded)
# Publishes to RabbitMQ; marks PUBLISHED on success
# On failure: increment retry_count; after settings.OUTBOX_RETRY_MAX → FAILED + alert
# Uses aio-pika for async RabbitMQ connection
```

#### 2.1.19 `app/tasks/celery_app.py` — Celery Configuration
Implement exactly per SPEC_02 Section 13. ALL schedule intervals from `settings.*` — NO hardcoded cron expressions.

```python
from celery.schedules import crontab, schedule
# Outbox: schedule(run_every=settings.CELERY_OUTBOX_INTERVAL_SECONDS)
# SLA: crontab(minute=f'*/{settings.CELERY_SLA_CHECK_MINUTES}')
# etc.
```

#### 2.1.20 `app/core/telemetry.py` — OpenTelemetry Setup
Implement exactly per SPEC_02 Section 11. Key: sampling rate from `settings.OTEL_SAMPLING_RATE`. Force-sample all ERROR spans.

```python
def get_current_trace_id() -> str:
    span = trace.get_current_span()
    ctx = span.get_span_context()
    if ctx and ctx.trace_id:
        return format(ctx.trace_id, "032x")
    return ""
```

#### 2.1.21 Scripts
```
scripts/generate_rsa_keys.py — generates RS256 key pair; saves to configured paths
scripts/seed_master_data.py — seeds default incoterms (Incoterms 2020), default roles, permissions, approval groups
scripts/create_superadmin.py — creates org + SUPERADMIN user (reads from env)
scripts/common_passwords.txt — 10,000 most common passwords (one per line)
```

#### 2.1.22 `.github/workflows/ci.yml` — GitHub Actions CI
```yaml
# Triggers: push to main/develop, PR to main
# Steps:
# 1. checkout
# 2. setup Python 3.14
# 3. pip install -r requirements.txt
# 4. pytest tests/ -v --cov=app --cov-fail-under=80
# 5. pnpm install --frozen-lockfile
# 6. pnpm test --all-projects
# 7. pnpm run typecheck
# 8. trivy image scan on built Docker image
# 9. Snyk dependency scan
# Environment: all secrets from GitHub Secrets (never in yaml)
```

#### 2.1.23 `.pre-commit-config.yaml`
```yaml
repos:
  - repo: https://github.com/psf/black
    hooks: [{ id: black }]
  - repo: https://github.com/charliermarsh/ruff-pre-commit
    hooks: [{ id: ruff, args: [--fix] }]
  - repo: local
    hooks:
      - id: no-print-statements
        name: No print() statements
        language: pygrep
        entry: "(?<!#.*)(^|\s)print\("
        types: [python]
      - id: no-console-log
        name: No console.log statements
        language: pygrep
        entry: "console\.log\("
        types: [ts, tsx, js]
      - id: no-todo-without-ticket
        name: No TODO without ticket
        language: pygrep
        entry: "# TODO(?! #[0-9]+)"
        types: [python]
```

---

## STEP 3 — TEST

### 3.1 User Persona Tests
- Health endpoints return 200 without authentication
- Login works for seeded superadmin user
- Unauthorized requests return 401
- Rate limiting returns 429 after threshold
- CORS headers present in responses from allowed origins only

### 3.2 Developer Persona Tests
**File:** `tests/unit/test_config.py`
- All settings load without error with `.env.example`
- `settings.OUTBOX_RETRY_MAX` is accessible (not hardcoded)
- `PERMANENTLY_DENIED_PERMISSIONS` contains `rfq.view_bids_before_opening`

**File:** `tests/unit/test_exceptions.py`
- `NotFoundError("Vendor", "uuid")` produces status_code=404, code="VENDOR_NOT_FOUND"
- `ForbiddenError()` produces status_code=403
- `OptimisticLockError("RFQ")` produces status_code=409

**File:** `tests/integration/test_health.py`
- `GET /health` → 200, `{"status": "ok"}`
- `GET /health/ready` → 200 or 503 (with check details)
- `GET /health/live` → 200

**File:** `tests/unit/test_base_model.py`
- BaseModel subclass always has `org_id`, `version`, `created_at`, `updated_at`, `deleted_at`
- `uuid4()` generates unique IDs (not hardcoded)

### 3.3 QA Persona Tests
- Docker-compose `up` starts ALL services without error
- MinIO buckets created on startup (8 primary + 2 internal)
- RabbitMQ exchanges and queues match SPEC_02 topology exactly
- Kong routes all 24 module prefixes
- `grep -R "org_id" app/db/base.py` confirms it's in BaseModel
- `git grep "auto_approve"` returns empty (no auto-approve logic)
- Pre-commit hooks reject `print()` statements and `TODO` without ticket
- Promtail config drops `/health*` logs

---

## STEP 4 — INTEGRATE

```bash
# 1. Run full stack locally
docker-compose up -d
# 2. Run migrations
alembic upgrade head
# 3. Seed data
python scripts/generate_rsa_keys.py
python scripts/seed_master_data.py
python scripts/create_superadmin.py
# 4. Verify Kong routes
curl http://localhost:8001/services
# 5. Full test suite
pytest tests/ -v --cov=app
# 6. Check graphify
graphify update
graphify check --integrity
```

---

## STEP 5 — GRAPHIFY UPDATE

After scaffolding complete:
```bash
graphify update
# Nodes to add:
# - type: config_module, name: app.config, module: core, file_path: app/config.py
# - type: middleware, name: RequestIDMiddleware, module: core, file_path: app/core/middleware.py
# - type: middleware, name: LoggingContextMiddleware, module: core, file_path: app/core/middleware.py
# - type: middleware, name: SecurityHeadersMiddleware, module: core, file_path: app/core/middleware.py
# - type: factory, name: create_app, module: main, file_path: app/main.py
# - type: session, name: get_db, module: db, file_path: app/db/session.py
# - type: base_model, name: BaseModel, module: db, file_path: app/db/base.py
# - type: publisher, name: OutboxPublisher, module: events, file_path: app/events/publisher.py
# - type: worker, name: publish_outbox_messages, module: events, file_path: app/events/outbox_worker.py
# - type: celery_app, name: celery_app, module: tasks, file_path: app/tasks/celery_app.py
graphify check --integrity
graphify diff > graphify_diff_$(date +%Y%m%d_%H%M%S).txt
```

---

## STEP 6 — README UPDATE

Add/update sections:
```markdown
## Current Session State
**Status:** SPEC_01 scaffolding COMPLETED
**Completed:** Project structure, config, BaseModel, middleware, main.py factory, health endpoints,
               outbox publisher/worker, celery_app, docker-compose, Kong config, Alembic setup,
               CI pipeline, pre-commit hooks, RSA key generation script
**Migration Head:** 0001_initial_empty (no tables yet — tables added per module)
**Test Commands:** pytest tests/ -v --cov=app | pnpm test --all-projects
**Next:** SPEC_02 Architecture verification → SPEC_03 Database schema migration
**Graphify:** All core nodes added; 0 broken links

## Module Status
| Module | Status | Migration | Tests |
|---|---|---|---|
| Core Scaffolding (SPEC_01) | ✅ Complete | 0001_empty | ✅ Passing |
```

---

## DOWNSTREAM PREPARATION (What Modules 2-25 Depend On)
1. `BaseModel` — every SQLAlchemy model inherits this
2. `get_db` — every router uses this dependency
3. `settings.*` — every module reads configuration from here
4. `AppException` / `register_exception_handlers` — every module raises typed exceptions
5. `OutboxPublisher` — every state-changing service uses this
6. `celery_app` — every Celery task imports this
7. `PermissionCode` — every permission check uses this
8. `AuditAction` — every audit log entry uses this
9. `get_current_trace_id` — every exception handler uses this
