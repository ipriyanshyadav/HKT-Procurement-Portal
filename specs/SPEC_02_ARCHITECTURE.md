# SPEC_02_ARCHITECTURE.md

## Title
Enterprise S2P Procurement Portal — System Architecture

## Purpose
Define the complete system architecture, service module boundaries, communication patterns, infrastructure topology, and Python/FastAPI-specific design decisions for the S2P procurement portal.

## Scope
Covers modular monolith structure, directory layout, all 24 service modules, RabbitMQ topology, outbox pattern, SQLAlchemy async session management, Redis usage, MinIO bucket structure, Kong configuration, OpenTelemetry tracing, Loguru logging, Celery configuration, health checks, and error handling strategy.

## Dependencies
- SPEC_01_PROJECT_OVERVIEW.md (module inventory, phasing, tech stack)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. Architecture Decision: Modular Monolith

### Phase 1 — Modular Monolith
The system deploys as a **single FastAPI application** with strict internal module boundaries. Each functional domain is a self-contained module with its own router, service, repository, schema, model, and event definitions. Cross-module communication within the monolith uses direct Python function calls through well-defined service interfaces — never direct repository or model access across module boundaries.

### Phase 3 — Microservices Extraction Path
Modules with independent scaling needs (Notification, Analytics, Integration) will be extracted as separate FastAPI services. The modular monolith structure ensures clean extraction: each module already has defined inbound/outbound event contracts via RabbitMQ, and inter-module calls go through service interfaces that can be replaced with HTTP/gRPC clients.

**Extraction candidates (Phase 3):**
- `notification` → Independent service with dedicated RabbitMQ consumer and WebSocket server
- `analytics` → Independent service connected to read replica
- `integration` → Independent service with adapter registry and retry infrastructure
- `document` → Independent service with MinIO client and ClamAV integration

---

## 2. Project Directory Structure

```
procurement-portal/
├── app/
│   ├── __init__.py
│   ├── main.py                          # create_app() factory
│   ├── config.py                        # Pydantic Settings (env-based config)
│   ├── core/
│   │   ├── __init__.py
│   │   ├── security.py                  # JWT creation/validation, password hashing
│   │   ├── permissions.py               # Permission codes enum, RBAC check
│   │   ├── exceptions.py                # Custom exception classes
│   │   ├── middleware.py                # Request ID, logging context, timing
│   │   ├── pagination.py               # Cursor-based and offset-based pagination
│   │   ├── idempotency.py              # Idempotency key check/store
│   │   ├── optimistic_lock.py          # Version check mixin
│   │   ├── soft_delete.py              # Soft delete filter mixin
│   │   └── constants.py                # System-wide constants
│   ├── db/
│   │   ├── __init__.py
│   │   ├── session.py                   # AsyncSession factory, get_db dependency
│   │   ├── base.py                      # DeclarativeBase, BaseModel with org_id, version, timestamps
│   │   ├── enums.py                     # All PostgreSQL ENUM type definitions
│   │   └── rls.py                       # Row-level security helpers
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── router.py                    # /auth/login, /auth/refresh, /auth/logout, /auth/sso/*
│   │   ├── service.py                   # AuthService
│   │   ├── dependencies.py             # get_current_user, require_permission, require_scope
│   │   ├── jwt.py                       # JWT encode/decode, key management
│   │   ├── mfa.py                       # TOTP generation/verification
│   │   └── sso.py                       # SAML 2.0 + OIDC handlers
│   ├── events/
│   │   ├── __init__.py
│   │   ├── publisher.py                 # OutboxPublisher (writes to outbox table)
│   │   ├── consumer.py                  # RabbitMQ consumer base class
│   │   ├── outbox_worker.py             # Celery task: poll outbox → publish to RabbitMQ
│   │   └── schemas.py                   # Event payload Pydantic schemas
│   ├── tasks/
│   │   ├── __init__.py
│   │   ├── celery_app.py               # Celery application factory
│   │   ├── sla_timers.py               # check_workflow_sla_timers
│   │   ├── bid_window.py               # check_bid_windows
│   │   ├── vendor_compliance.py        # check_vendor_compliance_expiry
│   │   ├── erp_reconciliation.py       # nightly_erp_reconciliation
│   │   ├── analytics_refresh.py        # refresh_materialized_views
│   │   ├── dormant_users.py            # check_dormant_users
│   │   ├── document_retention.py       # enforce_document_retention
│   │   ├── integration_retry.py        # retry_failed_integration_jobs
│   │   ├── audit_archival.py           # archive_old_audit_logs
│   │   ├── notification_digest.py      # compile_notification_digests
│   │   ├── pr_aging.py                 # check_pr_aging
│   │   ├── contract_milestones.py      # check_contract_milestones
│   │   ├── unmapped_pr_sla.py          # check_unmapped_pr_sla
│   │   └── vendor_scorecard.py         # calculate_vendor_scorecards
│   ├── modules/
│   │   ├── organization/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   └── events.py
│   │   ├── user/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   └── events.py
│   │   ├── master_data/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   └── events.py
│   │   ├── vendor/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   ├── events.py
│   │   │   ├── verification.py          # GST/PAN/CIN external API clients
│   │   │   └── scorecard.py             # Scorecard calculation logic
│   │   ├── requisition/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   └── events.py
│   │   ├── unmapped_pr/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   ├── events.py
│   │   │   └── suggestion_engine.py     # Auto-suggestion logic
│   │   ├── sourcing/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   └── events.py
│   │   ├── bid/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   ├── events.py
│   │   │   └── sealing.py               # Bid encryption/decryption
│   │   ├── evaluation/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   ├── events.py
│   │   │   └── cs_engine.py             # Comparative statement generation
│   │   ├── award/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   └── events.py
│   │   ├── contract/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   ├── events.py
│   │   │   └── esignature.py            # eSign provider abstraction
│   │   ├── purchase_order/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   └── events.py
│   │   ├── grn/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   └── events.py
│   │   ├── invoice/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   ├── events.py
│   │   │   └── match_engine.py          # 3-way match logic
│   │   ├── payment/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   └── events.py
│   │   ├── notification/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   ├── events.py
│   │   │   ├── channels/
│   │   │   │   ├── email.py             # SendGrid client
│   │   │   │   ├── sms.py               # MSG91 + Twilio client
│   │   │   │   ├── websocket.py         # WebSocket endpoint + Redis pub/sub
│   │   │   │   └── whatsapp.py          # WhatsApp Business API (Phase 3)
│   │   │   └── digest.py               # Digest compilation logic
│   │   ├── document/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   ├── events.py
│   │   │   ├── scanner.py               # ClamAV integration
│   │   │   └── watermark.py             # PDF watermarking
│   │   ├── workflow/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py               # WorkflowEngine class
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   ├── events.py
│   │   │   ├── evaluator.py             # Safe expression evaluator
│   │   │   └── resolver.py              # Approver resolution logic
│   │   ├── approval_rules/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py               # ApprovalRulesEngine class
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   └── events.py
│   │   ├── integration/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py               # IntegrationService
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   ├── events.py
│   │   │   ├── adapters/
│   │   │   │   ├── base.py              # ERPAdapter abstract base
│   │   │   │   ├── sap.py              # SAPAdapter
│   │   │   │   ├── oracle.py           # OracleAdapter
│   │   │   │   └── generic_rest.py     # GenericRESTAdapter
│   │   │   ├── hrms.py                  # HRMS event handler
│   │   │   └── bank_validation.py       # Razorpay penny test
│   │   ├── analytics/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── repository.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py               # Materialized view definitions
│   │   │   └── report_builder.py       # Custom report SQL builder
│   │   └── admin/
│   │       ├── __init__.py
│   │       ├── router.py
│   │       ├── service.py
│   │       ├── schemas.py
│   │       └── models.py               # feature_flags, tenant_settings
├── alembic/
│   ├── alembic.ini
│   ├── env.py                           # Async Alembic env
│   └── versions/                        # Migration files
├── tests/
│   ├── conftest.py                      # Fixtures: AsyncSession, AsyncClient, factories
│   ├── unit/
│   ├── integration/
│   ├── workflow/
│   └── security/
├── scripts/
│   ├── seed_master_data.py
│   ├── create_superadmin.py
│   └── generate_rsa_keys.py
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.celery
│   ├── Dockerfile.frontend
│   └── docker-compose.yml
├── k8s/
│   ├── base/
│   └── overlays/
│       ├── dev/
│       ├── staging/
│       └── production/
├── kong/
│   └── kong.yml                         # Declarative Kong config
├── pyproject.toml
├── requirements.txt
└── README.md
```

---

## 3. Service Module Registry

All 24 service modules, their responsibilities, and inter-module dependencies:

| # | Module | Service Class | Responsibilities | Inbound Dependencies | Outbound Dependencies | RabbitMQ Exchanges Consumed | RabbitMQ Exchanges Published |
|---|---|---|---|---|---|---|---|
| 1 | `organization` | `OrganizationService` | Org CRUD, BU/plant/cost center/department/legal entity management | None | None | None | `procurement.org` |
| 2 | `user` | `UserService` | User CRUD, role assignment, scope management, COI, delegation, session management | `organization` | `auth`, `notification` | `procurement.hrms` | `procurement.user` |
| 3 | `auth` | `AuthService` | Login, JWT issue/refresh, MFA, SSO, brute-force protection | `user` | `notification` | None | `procurement.audit` |
| 4 | `master_data` | `MasterDataService` | Category, UOM, currency, payment terms, incoterms, tax, delivery locations, document types, supplier categories | `organization` | `workflow`, `notification` | None | `procurement.master` |
| 5 | `vendor` | `VendorService` | Vendor lifecycle (invite → onboard → qualify → activate → suspend → blacklist), ERP sync, scorecard, compliance | `organization`, `master_data`, `user` | `workflow`, `notification`, `integration`, `document` | `procurement.integration` | `procurement.vendor` |
| 6 | `requisition` | `RequisitionService` | PR creation (all channels), budget check, merge/split, aging | `organization`, `master_data`, `user`, `vendor` | `workflow`, `notification`, `integration` | `procurement.integration` | `procurement.pr` |
| 7 | `unmapped_pr` | `UnmappedPRService` | Exception detection, queue, auto-suggestion, mapping, reprocessing | `requisition`, `master_data` | `workflow`, `notification` | `procurement.pr` | `procurement.unmapped` |
| 8 | `sourcing` | `SourcingService` | RFQ lifecycle (create → publish → amend → cancel), bidder management, clarifications, timeline | `requisition`, `vendor`, `master_data` | `workflow`, `notification`, `bid` | None | `procurement.rfq` |
| 9 | `bid` | `BidService` | Bid submission, draft save, hashing, versioning, sealing, opening | `sourcing`, `vendor` | `notification`, `document` | `procurement.rfq` | `procurement.bid` |
| 10 | `evaluation` | `EvaluationService` | Technical evaluation, CS generation, normalization, ranking, ARN trigger | `sourcing`, `bid`, `master_data` | `workflow`, `notification` | `procurement.bid` | `procurement.evaluation` |
| 11 | `award` | `AwardService` | ARN creation, approval, award notification, regret letters | `evaluation`, `sourcing`, `vendor` | `workflow`, `notification`, `contract`, `purchase_order` | `procurement.evaluation` | `procurement.award` |
| 12 | `contract` | `ContractService` | Contract workspace, approval, eSignature, amendments, milestones, renewal | `award`, `vendor`, `master_data` | `workflow`, `notification`, `document`, `integration` | `procurement.award` | `procurement.contract` |
| 13 | `purchase_order` | `POService` | PO generation, approval, release, amendment, supplier acceptance, delivery tracking | `award`, `contract`, `vendor`, `master_data` | `workflow`, `notification`, `integration`, `document` | `procurement.award` | `procurement.po` |
| 14 | `grn` | `GRNService` | GRN posting, partial receipt, quantity validation, quality inspection, SES | `purchase_order`, `vendor` | `notification`, `integration` | `procurement.po` | `procurement.grn` |
| 15 | `invoice` | `InvoiceService` | Invoice submission, duplicate detection, 3-way match, approval, disputes, debit/credit notes | `purchase_order`, `grn`, `vendor`, `master_data` | `workflow`, `notification`, `integration` | `procurement.grn` | `procurement.invoice` |
| 16 | `payment` | `PaymentService` | Payment record creation, UTR tracking, payment disputes | `invoice`, `vendor` | `notification` | `procurement.integration` | `procurement.payment` |
| 17 | `notification` | `NotificationService` | Event-driven notification dispatch (email, SMS, in-app, digest), template management, preference management | All modules (via RabbitMQ) | None (terminal) | `procurement.notification` | None |
| 18 | `document` | `DocumentService` | Upload, virus scan, hashing, pre-signed URLs, versioning, watermarking, retention, OCR | All modules | None (terminal) | None (called directly) | `procurement.document` |
| 19 | `workflow` | `WorkflowEngine` | Workflow instantiation, task creation, advancement, SLA, escalation, delegation, simulation | All approval-triggering modules | `notification`, `approval_rules` | None (called directly) | `procurement.workflow` |
| 20 | `approval_rules` | `ApprovalRulesEngine` | Rule evaluation, chain resolution, priority resolution, versioning, simulation | None | None | None (called directly) | `procurement.rules` |
| 21 | `integration` | `IntegrationService` | ERP adapter orchestration, HRMS sync, SSO, external API calls, job tracking, retry, reconciliation | All ERP-syncing modules | `notification` | `procurement.integration.inbound` | `procurement.integration` |
| 22 | `analytics` | `AnalyticsService` | Materialized view refresh, KPI computation, custom report builder, Superset dataset management | All modules (via read replica) | None | None | None |
| 23 | `admin` | `AdminService` | Tenant settings, feature flags, system info, scheduled job management | `organization` | All modules | None | `procurement.admin` |
| 24 | `audit` | `AuditService` | Audit log writing (INSERT-only), audit viewer API, archival | All modules | None (terminal) | None (called directly) | None |

---

## 4. FastAPI Application Factory

```python
# app/main.py

from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.config import settings
from app.db.session import engine, async_session_factory
from app.core.middleware import RequestIDMiddleware, LoggingContextMiddleware, TimingMiddleware
from app.events.consumer import start_consumers, stop_consumers

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await start_consumers()
    yield
    # Shutdown
    await stop_consumers()
    await engine.dispose()

def create_app() -> FastAPI:
    app = FastAPI(
        title="S2P Procurement Portal API",
        version="1.0.0",
        openapi_url="/api/v1/openapi.json",
        docs_url="/api/v1/docs",
        redoc_url="/api/v1/redoc",
        lifespan=lifespan,
    )

    # Middleware stack (order matters — outermost first)
    app.add_middleware(TimingMiddleware)
    app.add_middleware(LoggingContextMiddleware)
    app.add_middleware(RequestIDMiddleware)

    # CORS handled by Kong in production; local dev CORS middleware added conditionally
    if settings.ENVIRONMENT == "local":
        from fastapi.middleware.cors import CORSMiddleware
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Register all module routers
    from app.modules.organization.router import router as org_router
    from app.modules.user.router import router as user_router
    from app.modules.master_data.router import router as master_router
    from app.modules.vendor.router import router as vendor_router
    from app.modules.requisition.router import router as pr_router
    from app.modules.unmapped_pr.router import router as unmapped_router
    from app.modules.sourcing.router import router as rfq_router
    from app.modules.bid.router import router as bid_router
    from app.modules.evaluation.router import router as eval_router
    from app.modules.award.router import router as award_router
    from app.modules.contract.router import router as contract_router
    from app.modules.purchase_order.router import router as po_router
    from app.modules.grn.router import router as grn_router
    from app.modules.invoice.router import router as invoice_router
    from app.modules.payment.router import router as payment_router
    from app.modules.notification.router import router as notification_router
    from app.modules.document.router import router as document_router
    from app.modules.workflow.router import router as workflow_router
    from app.modules.approval_rules.router import router as rules_router
    from app.modules.integration.router import router as integration_router
    from app.modules.analytics.router import router as analytics_router
    from app.modules.admin.router import router as admin_router
    from app.auth.router import router as auth_router

    app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
    app.include_router(org_router, prefix="/api/v1/organizations", tags=["Organizations"])
    app.include_router(user_router, prefix="/api/v1/users", tags=["Users"])
    app.include_router(master_router, prefix="/api/v1/master-data", tags=["Master Data"])
    app.include_router(vendor_router, prefix="/api/v1/vendors", tags=["Vendors"])
    app.include_router(pr_router, prefix="/api/v1/requisitions", tags=["Purchase Requisitions"])
    app.include_router(unmapped_router, prefix="/api/v1/unmapped-prs", tags=["Unmapped PRs"])
    app.include_router(rfq_router, prefix="/api/v1/rfqs", tags=["RFQ / Sourcing"])
    app.include_router(bid_router, prefix="/api/v1/bids", tags=["Bids"])
    app.include_router(eval_router, prefix="/api/v1/evaluations", tags=["Evaluation & CS"])
    app.include_router(award_router, prefix="/api/v1/awards", tags=["Awards"])
    app.include_router(contract_router, prefix="/api/v1/contracts", tags=["Contracts"])
    app.include_router(po_router, prefix="/api/v1/purchase-orders", tags=["Purchase Orders"])
    app.include_router(grn_router, prefix="/api/v1/grn", tags=["GRN / SES"])
    app.include_router(invoice_router, prefix="/api/v1/invoices", tags=["Invoices"])
    app.include_router(payment_router, prefix="/api/v1/payments", tags=["Payments"])
    app.include_router(notification_router, prefix="/api/v1/notifications", tags=["Notifications"])
    app.include_router(document_router, prefix="/api/v1/documents", tags=["Documents"])
    app.include_router(workflow_router, prefix="/api/v1/workflows", tags=["Workflows"])
    app.include_router(rules_router, prefix="/api/v1/approval-rules", tags=["Approval Rules"])
    app.include_router(integration_router, prefix="/api/v1/integrations", tags=["Integrations"])
    app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["Analytics"])
    app.include_router(admin_router, prefix="/api/v1/admin", tags=["Administration"])

    # Exception handlers
    from app.core.exceptions import register_exception_handlers
    register_exception_handlers(app)

    # Prometheus metrics
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")

    # OpenTelemetry instrumentation
    from app.core.telemetry import setup_telemetry
    setup_telemetry(app)

    return app
```

---

## 5. RabbitMQ Topology

### 5.1 Exchange Definitions

All exchanges use **topic** type for flexible routing key matching.

| Exchange Name | Type | Durable | Description |
|---|---|---|---|
| `procurement.org` | topic | yes | Organization structure events |
| `procurement.user` | topic | yes | User lifecycle events |
| `procurement.audit` | topic | yes | Security and auth events |
| `procurement.master` | topic | yes | Master data change events |
| `procurement.vendor` | topic | yes | Vendor lifecycle events |
| `procurement.pr` | topic | yes | Purchase requisition events |
| `procurement.unmapped` | topic | yes | Unmapped PR exception events |
| `procurement.rfq` | topic | yes | RFQ lifecycle events |
| `procurement.bid` | topic | yes | Bid submission and opening events |
| `procurement.evaluation` | topic | yes | Evaluation and CS events |
| `procurement.award` | topic | yes | Award recommendation events |
| `procurement.contract` | topic | yes | Contract lifecycle events |
| `procurement.po` | topic | yes | Purchase order events |
| `procurement.grn` | topic | yes | GRN/SES events |
| `procurement.invoice` | topic | yes | Invoice and match events |
| `procurement.payment` | topic | yes | Payment events |
| `procurement.notification` | topic | yes | Notification dispatch events |
| `procurement.document` | topic | yes | Document upload/scan events |
| `procurement.workflow` | topic | yes | Workflow engine events |
| `procurement.rules` | topic | yes | Approval rule change events |
| `procurement.integration` | topic | yes | Outbound integration events |
| `procurement.integration.inbound` | topic | yes | Inbound ERP/HRMS webhook events |
| `procurement.admin` | topic | yes | Admin and system events |
| `procurement.alert` | topic | yes | Critical alert events (SLA, compliance, system) |
| `procurement.dlx` | topic | yes | Dead letter exchange for all failed messages |

### 5.2 Routing Key Convention

Pattern: `{entity}.{action}[.{qualifier}]`

**Examples:**
- `vendor.invited` — Vendor invitation sent
- `vendor.submitted` — Vendor submitted onboarding
- `vendor.activated` — Vendor activated
- `vendor.blacklisted` — Vendor blacklisted
- `rfq.created` — RFQ draft created
- `rfq.published` — RFQ published to bidders
- `rfq.amended` — RFQ amended (version incremented)
- `rfq.cancelled` — RFQ cancelled
- `rfq.bid_window_closed` — Bid submission window closed
- `rfq.bids_opened` — Bids formally opened
- `bid.submitted` — Bid submitted by supplier
- `bid.reopened` — Bid reopened for editing
- `bid.integrity_fail` — Bid hash verification failed
- `pr.submitted` — PR submitted for approval
- `pr.approved` — PR approved
- `pr.aging.warning` — PR aging threshold reached
- `workflow.task.created` — Workflow task created for approver
- `workflow.task.completed` — Workflow task completed
- `workflow.sla.escalation` — SLA escalation triggered
- `invoice.submitted` — Invoice submitted
- `invoice.matched` — 3-way match completed
- `invoice.disputed` — Invoice auto-disputed
- `integration.erp.po_push` — PO pushed to ERP
- `integration.erp.sync_failed` — ERP sync failure

### 5.3 Queue Definitions

| Queue Name | Bound Exchange | Routing Key Pattern | DLQ | Consumer |
|---|---|---|---|---|
| `q.notification.email` | `procurement.notification` | `notification.email.*` | `q.dlq.notification.email` | `NotificationService.dispatch_email` |
| `q.notification.sms` | `procurement.notification` | `notification.sms.*` | `q.dlq.notification.sms` | `NotificationService.dispatch_sms` |
| `q.notification.inapp` | `procurement.notification` | `notification.inapp.*` | `q.dlq.notification.inapp` | `NotificationService.dispatch_inapp` |
| `q.notification.digest` | `procurement.notification` | `notification.digest.*` | `q.dlq.notification.digest` | `NotificationService.queue_for_digest` |
| `q.integration.erp.outbound` | `procurement.integration` | `integration.erp.*` | `q.dlq.integration.erp` | `IntegrationService.process_erp_event` |
| `q.integration.hrms` | `procurement.integration.inbound` | `hrms.*` | `q.dlq.integration.hrms` | `IntegrationService.process_hrms_event` |
| `q.vendor.lifecycle` | `procurement.vendor` | `vendor.*` | `q.dlq.vendor` | `VendorEventHandler.handle` |
| `q.rfq.lifecycle` | `procurement.rfq` | `rfq.*` | `q.dlq.rfq` | `SourcingEventHandler.handle` |
| `q.bid.lifecycle` | `procurement.bid` | `bid.*` | `q.dlq.bid` | `BidEventHandler.handle` |
| `q.workflow.events` | `procurement.workflow` | `workflow.*` | `q.dlq.workflow` | `WorkflowEventHandler.handle` |
| `q.alert.critical` | `procurement.alert` | `alert.*` | `q.dlq.alert` | `AlertHandler.handle` |
| `q.audit.write` | `procurement.audit` | `audit.*` | `q.dlq.audit` | `AuditService.write_log` |

### 5.4 Dead Letter Queue (DLQ) Configuration

Every queue has a corresponding DLQ with the following policy:
- `x-dead-letter-exchange`: `procurement.dlx`
- `x-dead-letter-routing-key`: Original routing key prefixed with `dlq.`
- `x-message-ttl` on DLQ: 7 days (604800000 ms)
- DLQ messages monitored via Prometheus `rabbitmq_queue_messages` metric; Grafana alert fires when DLQ depth > 50

---

## 6. Outbox Pattern Implementation

### 6.1 `outbox_messages` Table Schema

```sql
CREATE TABLE outbox_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    exchange VARCHAR(100) NOT NULL,
    routing_key VARCHAR(200) NOT NULL,
    payload JSONB NOT NULL,
    headers JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    CONSTRAINT chk_outbox_status CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED'))
);

CREATE INDEX idx_outbox_pending ON outbox_messages (status, created_at) WHERE status = 'PENDING';
CREATE INDEX idx_outbox_org ON outbox_messages (org_id, created_at);
```

### 6.2 Publisher (Application Side)

```python
# app/events/publisher.py

class OutboxPublisher:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def publish(
        self, exchange: str, routing_key: str, payload: dict, org_id: UUID
    ) -> None:
        outbox_msg = OutboxMessage(
            org_id=org_id,
            exchange=exchange,
            routing_key=routing_key,
            payload=payload,
            status="PENDING",
        )
        self.session.add(outbox_msg)
        # Committed as part of the caller's transaction — atomic with business data
```

### 6.3 Outbox Worker (Celery Task)

```python
# app/events/outbox_worker.py

@celery_app.task(queue="celery.outbox")
def publish_outbox_messages():
    """Polls outbox table for PENDING messages, publishes to RabbitMQ, marks PUBLISHED."""
    # SELECT ... FROM outbox_messages WHERE status = 'PENDING' ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED
    # For each message: publish to RabbitMQ → UPDATE status = 'PUBLISHED', published_at = NOW()
    # On publish failure: INCREMENT retry_count, SET last_error; after 10 retries → status = 'FAILED' + alert
```

**Celery Beat schedule:** Every 5 seconds (`*/5 * * * * *` — uses `celery.schedules.schedule(run_every=5.0)`)

---

## 7. SQLAlchemy Async Session Management

```python
# app/db/session.py

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,  # postgresql+asyncpg://user:pass@host:5432/procurement
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,
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

FastAPI dependency injection:

```python
from fastapi import Depends
from app.db.session import get_db, AsyncSession

@router.post("/vendors")
async def create_vendor(
    data: VendorCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ...
```

---

## 8. Redis Usage Map

| Use Case | Key Pattern | TTL | Data Type | Description |
|---|---|---|---|---|
| User sessions | `session:{token_jti}` | 8 hours | Hash | Stores session metadata (user_id, org_id, ip, user_agent, created_at) |
| Revoked tokens | `revoked:{token_jti}` | Until original token expiry | String (1) | Blocklist for revoked refresh tokens |
| Rate limiting | `ratelimit:{user_id}:{endpoint_tier}` | 60 seconds | String (counter) | Per-user per-tier request count |
| Failed logins | `failed_login:{email}` | 30 minutes | String (counter) | Brute-force protection counter |
| Idempotency | `idem:{idempotency_key}` | 24 hours | Hash | Cached response for duplicate POST/PATCH |
| WebSocket sessions | `ws:user:{user_id}` | No expiry (removed on disconnect) | Set | Set of WebSocket connection IDs per user (for multi-instance pub/sub) |
| Notification pub/sub | `channel:notifications:{user_id}` | N/A (pub/sub channel) | Pub/Sub | Real-time notification delivery channel |
| Hot cache: PR counts | `cache:pr_count:{org_id}:{status}` | 5 minutes | String (integer) | Dashboard widget cache |
| Hot cache: RFQ counts | `cache:rfq_count:{org_id}:{status}` | 5 minutes | String (integer) | Dashboard widget cache |
| Hot cache: Unmapped PR value | `cache:unmapped_pr_value:{org_id}` | 5 minutes | String (decimal) | Admin dashboard aggregate |
| Hot cache: Pending approvals | `cache:pending_approvals:{user_id}` | 2 minutes | String (integer) | Approval inbox badge count |
| Vendor verification cache | `vendor_verify:{verification_type}:{identifier}` | 90 days | Hash | Cached GST/PAN/CIN verification results |
| Exchange rates | `exchange_rate:{base}:{target}` | 24 hours | String (decimal) | Cached currency exchange rates |

---

## 9. MinIO Bucket Structure

| Bucket Name | Purpose | Versioning | Lifecycle Rules | Access Policy |
|---|---|---|---|---|
| `tender-documents` | RFQ-related documents (NIT, scope, BOQ, drawings, terms) | Enabled | Archive to cold after 7 years; delete after 10 years | Private; access via pre-signed URLs only; scoped to `org_id` prefix |
| `bid-documents` | Supplier bid attachments (technical docs, commercial offers, covering letters) | Enabled | Archive after 7 years; delete after 10 years | Private; encrypted at rest (AES-256); access restricted to post-opening only |
| `compliance-documents` | Vendor compliance docs (registration certs, tax certs, insurance, quality certs) | Enabled | Archive 7 years post-vendor-deactivation | Private; supplier uploads; buyer/admin reads |
| `contract-documents` | Contract PDFs, amendments, signed copies, supporting docs | Enabled | Archive 10 years post-contract-expiry | Private; watermarked on download; eSign integration stores signed PDFs here |
| `po-documents` | PO PDFs, acknowledgment receipts, amendment docs | Enabled | Archive after 10 years | Private; auto-generated PO PDFs stored here |
| `grn-ses-documents` | GRN photos, SES completion certificates, QC reports | Enabled | Archive after 7 years | Private; inspector uploads; buyer reads |
| `invoice-documents` | Supplier invoice PDFs, credit/debit notes, supporting docs | Enabled | Archive after 10 years | Private; supplier uploads; finance reads |
| `audit-documents` | Exported audit reports, compliance reports, bid opening reports | Enabled | No deletion; permanent retention | Private; read-only for AUDIT_USER and COMPLIANCE_OFFICER roles |

**Additional internal buckets:**
- `key-vault` — Stores RFQ-specific bid sealing encryption keys; strict access control (only `BidService.open_bids` can retrieve); AES-256 SSE; no lifecycle deletion
- `quarantine` — ClamAV-flagged files; reviewed by admin; 90-day retention then permanent delete

**Key path convention:** `{bucket}/{org_id}/{entity_type}/{entity_id}/{uuid}/{original_filename}`

**Server-side encryption:** All buckets configured with SSE-S3 (AES-256) via MinIO auto-encryption.

---

## 10. Kong Gateway Configuration

### 10.1 Services and Routes

```yaml
# kong/kong.yml (declarative DB-less mode)
_format_version: "3.0"

services:
  - name: procurement-api
    url: http://procurement-api:8000
    routes:
      - name: api-v1
        paths:
          - /api/v1
        strip_path: false
    plugins:
      - name: jwt
        config:
          key_claim_name: kid
          claims_to_verify:
            - exp
          header_names:
            - Authorization
          uri_param_names: []
          cookie_names: []
          run_on_preflight: true
      - name: rate-limiting
        config:
          minute: 100
          policy: redis
          redis_host: redis-master
          redis_port: 6379
          redis_database: 1
          fault_tolerant: true
          hide_client_headers: false
      - name: correlation-id
        config:
          header_name: X-Request-ID
          generator: uuid
          echo_downstream: true
      - name: request-size-limiting
        config:
          allowed_payload_size: 50
          size_unit: megabytes
      - name: cors
        config:
          origins:
            - https://buyer.procurement.example.com
            - https://supplier.procurement.example.com
            - https://admin.procurement.example.com
          methods:
            - GET
            - POST
            - PUT
            - PATCH
            - DELETE
            - OPTIONS
          headers:
            - Authorization
            - Content-Type
            - X-Request-ID
            - Idempotency-Key
          credentials: true
          max_age: 3600

  - name: procurement-ws
    url: http://procurement-api:8000
    routes:
      - name: websocket
        paths:
          - /ws
        strip_path: false
    plugins:
      - name: rate-limiting
        config:
          minute: 10
          policy: redis
          redis_host: redis-master
```

### 10.2 Rate Limiting Tiers (Applied via Route-Level Plugin Overrides)

| Tier | Limit | Endpoints |
|---|---|---|
| Standard | 100 req/min per user | All CRUD endpoints |
| Search | 30 req/min per user | `GET /api/v1/*/search`, Elasticsearch queries |
| File Upload | 10 req/min per user | `POST /api/v1/documents/upload` |
| Auth | 5 req/min per IP | `POST /api/v1/auth/login` |
| Webhooks | Unlimited (IP allowlist) | `POST /api/v1/webhooks/*` |

---

## 11. OpenTelemetry Integration

```python
# app/core/telemetry.py

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.celery import CeleryInstrumentor
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased, ParentBasedTraceIdRatio
from app.config import settings

def setup_telemetry(app):
    resource = Resource.create({
        "service.name": "procurement-api",
        "service.version": settings.APP_VERSION,
        "deployment.environment": settings.ENVIRONMENT,
    })

    sampling_rate = 1.0 if settings.ENVIRONMENT != "production" else 0.1
    sampler = ParentBasedTraceIdRatio(TraceIdRatioBased(sampling_rate))

    provider = TracerProvider(resource=resource, sampler=sampler)
    processor = BatchSpanProcessor(
        JaegerExporter(
            agent_host_name=settings.JAEGER_HOST,
            agent_port=settings.JAEGER_PORT,
        )
    )
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)

    FastAPIInstrumentor.instrument_app(app)
    SQLAlchemyInstrumentor().instrument(engine=engine.sync_engine)
    RedisInstrumentor().instrument()
    HTTPXClientInstrumentor().instrument()
    CeleryInstrumentor().instrument()
```

**Trace context propagation:** OpenTelemetry W3C TraceContext propagator enabled by default. `traceparent` header propagated across all `httpx` outbound calls (ERP, GST API, eSign provider). Celery tasks receive trace context via task headers.

**Error sampling override:** All spans with `status = ERROR` are force-sampled at 100% regardless of the base sampling rate, ensuring error traces are never lost.

---

## 12. Loguru Configuration

```python
# app/core/logging.py

import sys
from loguru import logger
from app.config import settings

def setup_logging():
    logger.remove()

    if settings.ENVIRONMENT == "local":
        logger.add(
            sys.stderr,
            level="DEBUG",
            format="<green>{time:HH:mm:ss}</green> | <level>{level:<8}</level> | <cyan>{module}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | {extra[trace_id]:-} | {message}",
            colorize=True,
        )
    else:
        logger.add(
            sys.stdout,
            level="INFO",
            format="{message}",
            serialize=True,  # JSON output
        )

    # Bind default extras
    logger.configure(extra={
        "trace_id": "",
        "span_id": "",
        "user_id": "",
        "org_id": "",
        "request_id": "",
        "entity_type": "",
        "entity_id": "",
    })
```

**Structured JSON output fields (production):**
`timestamp`, `level`, `message`, `module`, `function`, `line`, `trace_id`, `span_id`, `user_id`, `org_id`, `request_id`, `entity_type`, `entity_id`

**Log level per environment:**
- Local/Dev: `DEBUG`
- Staging: `DEBUG`
- Production: `INFO`

**Promtail pipeline:** Reads JSON logs from container stdout → extracts `app`, `namespace`, `pod` labels → drops health check logs (`GET /health*`) → ships to Loki.

**Trace correlation:** `LoggingContextMiddleware` extracts `trace_id` and `span_id` from the current OpenTelemetry span context and binds them to Loguru's context via `contextvars`, ensuring every log line within a request includes the active trace ID.

---

## 13. Celery Configuration

```python
# app/tasks/celery_app.py

from celery import Celery
from celery.schedules import crontab, schedule
from app.config import settings

celery_app = Celery(
    "procurement",
    broker=settings.RABBITMQ_URL,       # amqp://app_user:pass@rabbitmq:5672/procurement
    backend=settings.REDIS_URL,          # redis://redis-master:6379/2
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.tasks.notification_*": {"queue": "celery.notification"},
        "app.tasks.integration_*": {"queue": "celery.integration"},
        "app.tasks.sla_*": {"queue": "celery.sla_timers"},
        "app.events.outbox_worker.*": {"queue": "celery.outbox"},
        "app.tasks.analytics_*": {"queue": "celery.analytics"},
        "app.tasks.document_*": {"queue": "celery.document"},
    },
    worker_concurrency=4,
    task_soft_time_limit=300,
    task_time_limit=600,
)
```

### 13.1 Celery Beat Schedule

| Task | Function Path | Schedule | Queue | Description |
|---|---|---|---|---|
| Outbox publisher | `app.events.outbox_worker.publish_outbox_messages` | Every 5 seconds | `celery.outbox` | Polls `outbox_messages` and publishes to RabbitMQ |
| SLA timer check | `app.tasks.sla_timers.check_workflow_sla_timers` | `*/15 * * * *` (every 15 min) | `celery.sla_timers` | Scans workflow tasks for SLA threshold breaches |
| Bid window check | `app.tasks.bid_window.check_bid_windows` | `*/5 * * * *` (every 5 min) | `celery.sla_timers` | Detects closed bid windows; fires `rfq.bid_window_closed` |
| Vendor compliance check | `app.tasks.vendor_compliance.check_vendor_compliance_expiry` | `0 2 * * *` (daily 02:00 UTC) | `celery.integration` | Checks vendor doc expiry; sends 90/30/0-day alerts |
| ERP reconciliation | `app.tasks.erp_reconciliation.nightly_erp_reconciliation` | `0 1 * * *` (daily 01:00 UTC) | `celery.integration` | Compares portal vs ERP entity counts |
| Analytics refresh | `app.tasks.analytics_refresh.refresh_materialized_views` | `*/15 * * * *` (every 15 min) | `celery.analytics` | Refreshes all 11 materialized views |
| Dormant user check | `app.tasks.dormant_users.check_dormant_users` | `0 3 * * 0` (weekly Sunday 03:00 UTC) | `celery.notification` | Flags users with no login > 90 days |
| Document retention | `app.tasks.document_retention.enforce_document_retention` | `0 4 1 * *` (monthly 1st 04:00 UTC) | `celery.document` | Archives/deletes expired documents per retention policy |
| Integration retry | `app.tasks.integration_retry.retry_failed_integration_jobs` | `*/30 * * * *` (every 30 min) | `celery.integration` | Retries failed integration jobs with exponential backoff |
| Audit archival | `app.tasks.audit_archival.archive_old_audit_logs` | `0 5 1 * *` (monthly 1st 05:00 UTC) | `celery.analytics` | Partitions old audit logs to cold storage |
| Notification digest | `app.tasks.notification_digest.compile_notification_digests` | `0 7 * * *` (daily 07:00 UTC) | `celery.notification` | Compiles per-user digest emails (adjusted for user timezone) |
| PR aging | `app.tasks.pr_aging.check_pr_aging` | `0 6 * * *` (daily 06:00 UTC) | `celery.sla_timers` | Checks approved PRs not yet in sourcing; fires aging alerts |
| Contract milestones | `app.tasks.contract_milestones.check_contract_milestones` | `0 3 * * *` (daily 03:00 UTC) | `celery.sla_timers` | Checks overdue milestones; sends renewal/expiry alerts |
| Unmapped PR SLA | `app.tasks.unmapped_pr_sla.check_unmapped_pr_sla` | `*/15 * * * *` (every 15 min) | `celery.sla_timers` | Checks unmapped PR SLA thresholds (4h/8h/24h/48h) |
| Vendor scorecard | `app.tasks.vendor_scorecard.calculate_vendor_scorecards` | `0 2 1 */3 *` (quarterly, 1st of month 02:00 UTC) | `celery.analytics` | Calculates vendor performance scores |
| Exchange rate refresh | `app.tasks.analytics_refresh.refresh_exchange_rates` | `0 0 * * *` (daily midnight UTC) | `celery.integration` | Fetches latest exchange rates from configured provider |

---

## 14. Health Check Endpoints

```python
# Registered directly on the FastAPI app (no auth required)

@app.get("/health")
async def health_basic():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

@app.get("/health/ready")
async def health_ready():
    checks = {}
    checks["database"] = await check_db_connection()       # SELECT 1
    checks["redis"] = await check_redis_connection()        # PING
    checks["rabbitmq"] = await check_rabbitmq_connection()  # connection.open check
    checks["minio"] = await check_minio_connection()        # bucket_exists check
    all_healthy = all(v["status"] == "ok" for v in checks.values())
    return {
        "status": "ok" if all_healthy else "degraded",
        "checks": checks,
        "timestamp": datetime.utcnow().isoformat(),
    }

@app.get("/health/live")
async def health_live():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}
```

**Kong health check:** Kong upstream health checks configured to poll `/health/live` every 10 seconds; 3 consecutive failures → mark upstream unhealthy → stop routing traffic → Grafana alert fires.

---

## 15. Error Handling Strategy

### 15.1 Custom Exception Classes

```python
# app/core/exceptions.py

class AppException(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details: dict = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}

class NotFoundError(AppException):
    def __init__(self, entity: str, entity_id: str):
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
```

### 15.2 Exception Handlers

```python
def register_exception_handlers(app: FastAPI):
    @app.exception_handler(AppException)
    async def app_exception_handler(request, exc):
        trace_id = get_current_trace_id()
        return JSONResponse(status_code=exc.status_code, content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "trace_id": trace_id,
                "timestamp": datetime.utcnow().isoformat(),
            }
        })

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request, exc):
        # Returns 422 with field-level error details

    @app.exception_handler(Exception)
    async def unhandled_handler(request, exc):
        # Logs full traceback with trace_id; returns generic 500
```

### 15.3 HTTP Status Code Usage

| Status Code | When Used |
|---|---|
| 200 | Successful GET, PATCH, PUT |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE |
| 400 | Business rule violation (invalid state transition, budget exceeded, etc.) |
| 401 | Missing or invalid JWT |
| 403 | Valid JWT but insufficient permission or scope |
| 404 | Resource not found (within user's org_id scope) |
| 409 | Optimistic lock conflict (version mismatch), duplicate resource |
| 422 | Request validation error (Pydantic) |
| 429 | Rate limit exceeded (Kong returns this) |
| 500 | Unhandled server error (logged with trace_id, generic message to client) |
