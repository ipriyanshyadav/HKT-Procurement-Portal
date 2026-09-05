# Procurement Portal — Enterprise S2C & P2P Platform

## Current Session State
**Status:** SPEC_15 — Invoice & Payment Modules (100% Complete)
**Completed:**
- **Backend Implementation:**
  - `InvoiceService` & `InvoiceRepository`: 3-way match engine (2% hardcoded physical quantity tolerance, configurable price tolerance from settings, 1% tax tolerance), Indian financial year detection (`FY{YYYY}-{YY}`), duplicate invoice check per vendor per financial year, business-day due date calculation with `holiday_master` calendar, invoice approval/rejection/dispute workflow.
  - `PaymentService` & `PaymentRepository`: TDS deduction computation (2% on subtotal per Indian tax code), scheduled payment creation on approval, UTR recording and payment completion, dispute lifecycle with threaded conversation (`dispute_messages`) and credit note resolution (`invoices.total_amount` reduction).
  - Celery task `app/tasks/invoice_aging.py`: periodic scan emitting `invoice.aging.warning` alerts at 15, 30, 45, 60 days.
  - 14 REST endpoints at `/api/v1/invoices/*` and 10 REST endpoints at `/api/v1/payments/*`.
- **Database Migration:**
  - `0033_invoice_payment_spec15`: Added `financial_year`, `tds_amount`, `payment_terms_code`, `notes` to `invoices`; `gross_amount`, `tds_amount`, `net_amount`, `payment_due_date` to `payment_records`; `tds_applicable`, `tds_percentage` to `vendors`; and 15 performance indexes across foreign keys and status.
- **Frontend Applications & Wiring:**
  - Shared `ThreeWayMatchResult` and `PaymentSchedule` components in `@procurement/ui` and `@procurement/components`.
  - Buyer Portal pages:
    - `/invoices`: Invoice listing with 3-way match badges, filter tabs, KPI summary cards.
    - `/invoices/[id]`: Invoice detail workspace with line-by-line 3-way match breakdown, discrepancy alerts, Approve/Dispute/Reject actions.
  - Supplier Portal pages:
    - `/invoices`: Invoices assigned to vendor with payment status tracking.
    - `/invoices/new`: Invoice submission form linked to PO lines with tax calculation and draft validation.
  - TanStack Query hooks: `useInvoices` and `usePayments` in `@procurement/hooks`.
- **Verification:**
  - `tests/integration/test_invoice_payment.py` (10/10 passing, 100%).
  - Full regression suite: 370/370 passing across all modules.
  - Frontend Typecheck: 0 TypeScript errors across all 7 Turbo packages (`pnpm turbo run typecheck`).
  - Step 2.5 SPEC Audit report committed at `docs/audits/SPEC_15_AUDIT.md`.
  - Knowledge graph updated via `graphify update .`.
**Migration Head:** 0033_invoice_payment_spec15
**Test Commands:** `.venv/bin/pytest tests/integration/test_invoice_payment.py -v` & `cd procurement-portal-frontend && pnpm turbo run typecheck`
**Next:** SPEC_16 Notification Service
**Graphify:** 5326 nodes, 13348 edges, 368 communities

---

## System Overview

The Procurement Portal is an enterprise-grade Source-to-Contract (S2C), Procure-to-Pay (P2P), Supplier Relationship Management (SRM), and Analytics platform built as a modular monolith in Python/FastAPI with a Turborepo Next.js 14 frontend.

### Squad Decomposition
- **Squad A (Platform & Core):** SPEC_01, SPEC_02, SPEC_03, SPEC_04, SPEC_18, SPEC_21, SPEC_22
- **Squad B (Sourcing & Bids):** SPEC_08, SPEC_09, SPEC_10, SPEC_11, SPEC_11B, SPEC_12
- **Squad C (Contracts & PO):** SPEC_13, SPEC_14, SPEC_15, SPEC_20
- **Squad D (SRM & Master Data):** SPEC_07, SPEC_16, SPEC_17, SPEC_24
- **Squad E (Engine & Frontend):** SPEC_05, SPEC_06, SPEC_19, SPEC_23, SPEC_25

### Module Status
| Module | Name | Spec | Status | Migration | Tests |
|---|---|---|---|---|---|
| 01 | Project Overview & Scaffolding | SPEC_01 | ✅ Complete | 0001_initial_empty | ✅ 50 Passing |
| 02 | System Architecture & Wiring | SPEC_02 | ✅ Complete | 0001_initial_empty | ✅ 50 Passing |
| 03 | Database Architecture & Schema | SPEC_03 | ✅ Complete | 0027_data_seed | ✅ 72 Passing (98% cov) |
| 04 | Auth & RBAC Security | SPEC_04 | ✅ Complete | 0027_data_seed | ✅ 205 Passing (89% cov) |
| 05 | Workflow Engine | SPEC_05 | ✅ Complete | 0027_data_seed | ✅ 38 Passing (100% cov) |
| 06 | Approval Rules Engine | SPEC_06 | ✅ Complete | 0027_data_seed | ✅ 9 Passing (100% cov) |
| 07 | Vendor Management | SPEC_07 | ✅ Complete | 0027_data_seed | ✅ 21 Passing (100% cov) |
| 08 | Purchase Requisition (PR) | SPEC_08 | ✅ Complete | 0027_data_seed | ✅ 10 Passing (100% cov) |
| 09 | Unmapped PR | SPEC_09 | ✅ Complete | 0027_data_seed | ✅ 7 Passing (100% cov) |
| 10 | RFQ Lifecycle | SPEC_10 | ✅ Complete | 0029_rfq_bid_spec10_11 | ✅ 12 Passing (100% cov) |
| 11 | Bid Management | SPEC_11 | ✅ Complete | 0029_rfq_bid_spec10_11 | ✅ 11 Passing (100% cov) |
| 11B | Live Reverse Auction | SPEC_11B | ✅ Complete | 0028_live_auction | ✅ 32 Passing (100% cov) |
| 12 | Comparative Statement (CS) | SPEC_12 | ✅ Complete | 0030_evaluation_spec12 | ✅ 7 Passing (100% cov) |
| 13 | Contract Management | SPEC_13 | ✅ Complete | 0031_contract_spec13 | ✅ 9 Passing (100% cov) |
| 14 | Purchase Order (PO) | SPEC_14 | ✅ Complete | 0032_purchase_order_grn_spec14 | ✅ 9 Passing (100% cov) |
| 15 | Invoice & Payment | SPEC_15 | ✅ Complete | 0033_invoice_payment_spec15 | ✅ 10 Passing (100% cov) |
| 16 | Notification Service | SPEC_16 | ⏳ Planned | Pending | Pending |
| 17 | Document Management | SPEC_17 | ⏳ Planned | Pending | Pending |
| 18 | API Standards & Resilience | SPEC_18 | ⏳ Planned | Pending | Pending |
| 19 | Frontend Applications | SPEC_19 | ✅ Complete | Apple & Glass active | ✅ Turborepo passing |
| 20 | Integration Hub | SPEC_20 | ⏳ Planned | Pending | Pending |
| 21 | Infrastructure & Deployment | SPEC_21 | 🔄 Scaffolded | Docker/Kong ready | K8s stubs |
| 22 | Observability & Telemetry | SPEC_22 | 🔄 Scaffolded | OTel/Jaeger ready | Passing |
| 23 | Testing Strategy | SPEC_23 | 🔄 Active | Pytest suite active | 50 Passing |
| 24 | Master Data Management | SPEC_24 | ✅ Complete | 0027_data_seed | ✅ 38 Passing (100% cov) |
| 25 | Analytics & Reporting | SPEC_25 | ⏳ Planned | Pending | Pending |

---

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
docker compose -f docker/docker-compose.yml up -d postgres redis rabbitmq minio jaeger

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

## Current Session State
- **Session Focus:** STATUS and ACTIONS button standardization across all portal tables to match Approval Rules Engine.
- **Completed Standardization:**
  1. Shared UI Package: Extended `Badge` component and `badge.css` with semantic color mappings; updated `PRLineItemTable` with right-aligned Actions column and `Button` remove actions.
  2. Admin Portal: Updated Users directory (`/users`), Master Data Modules overview (`/dashboard`), and Categories hierarchy (`/master-data/categories`) to match Approval Rules (`/approval-rules`).
  3. Buyer Portal: Updated Purchase Requisitions (`/requisitions`), RFQ Opportunities (`/rfqs`), Vendor Directory (`/vendors`), Unmapped PR Exceptions (`/unmapped-prs`), and Requisition Bulk Import Preview (`/requisitions/import`).
  4. Supplier Portal: Added right-aligned Actions column and unified `Badge` status to Supplier Compliance Documents (`/documents`).
- **Verification:** Turborepo 9-package typecheck passed (`pnpm typecheck`); Next.js production build succeeded for all portals (`pnpm build`); unit test suite (386 tests) passed. Graphify graph updated (4242 nodes, 9848 edges).
