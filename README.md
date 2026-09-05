# Procurement Portal — Enterprise S2C & P2P Platform

## Current Session State
**Status:** SPEC_17 — Document Management & ClamAV Integration (100% Complete)
**Completed:**
- **Backend Implementation:**
  - `DocumentScanner`: MIME type validation against 11 allowed formats via libmagic/extensions, `sanitize_filename` (path traversal prevention, length limit 255), ClamAV daemon scan with `scan_with_clamav()`, bucket mapping router.
  - `DocumentService` & `DocumentRepository`: Upload with size limit validation (`MINIO_MAX_FILE_SIZE_MB`), MinIO storage, SHA-256 checksumming, version history incrementing with `DocumentVersion`, asynchronous Celery scan dispatching, presigned URL retrieval (blocking `INFECTED` with 403 Forbidden and `PENDING` with 202 Accepted), soft deletion with audit logging.
  - Celery task `app/tasks/document_scan.py`: background virus scan (`scan_document_task`), quarantine relocation (`quarantine/infected/{id}/{filename}`) upon infection detection, deletion from original bucket, and `alert.document.infected` event publishing to the transactional outbox.
  - REST endpoints at `/api/v1/documents/*`: `/health`, `/upload`, `/{id}/presigned-url`, `/{id}/versions`, `DELETE /{id}`, and `/entity/{entity_type}/{entity_id}`.
- **Frontend Applications & Wiring:**
  - Shared `DocumentUpload` component in `@procurement/ui` and `@procurement/components` with drag-and-drop, scan status badges (pending spinner, clean checkmark, infected alert), presigned URL download, and collapsible version history accordion.
  - Shared `DocumentList` component with document category badge, scan status, compliance expiry alert, presigned URL download, soft delete, and inline upload modal.
  - Specialized wrappers for all modules: `VendorDocuments`, `BidDocuments`, `ContractDocuments`, `PODocuments`, `InvoiceDocuments`.
  - TanStack Query hooks: `useEntityDocuments`, `useDocumentPresignedUrl`, `useDocumentVersions`, `useUploadDocument`, `useDeleteDocument` in `@procurement/hooks`.
- **Verification:**
  - `tests/unit/test_document_scanner.py` (25/25 passing, 100%).
  - `tests/unit/test_document_service.py` (10/10 passing, 100%).
  - `tests/unit/test_document_scan_task.py` (2/2 passing, 100%).
  - `tests/integration/test_document.py` (2/2 passing, 100%).
  - Full regression suite: 394/394 passing across all modules.
  - Frontend Typecheck: 0 TypeScript errors across all 7 Turbo packages (`pnpm turbo run typecheck`).
  - Step 2.5 SPEC Audit report committed at `docs/audits/SPEC_17_AUDIT.md`.
  - Knowledge graph updated via `graphify update .`.
**Migration Head:** 0033_invoice_payment_spec15
**Test Commands:** `.venv/bin/pytest tests/unit/test_document_scanner.py tests/unit/test_document_service.py tests/unit/test_document_scan_task.py tests/integration/test_document.py -v` & `cd procurement-portal-frontend && pnpm turbo run typecheck`
**Next:** SPEC_16 Notification Service or SPEC_18 API Standards & Resilience
**Graphify:** 5440 nodes, 13668 edges, 366 communities

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
| 17 | Document Management | SPEC_17 | ✅ Complete | 0027_data_seed | ✅ 39 Passing (100% cov) |
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
- **Session Focus:** Module 15 (Invoices, 3-Way Match & Payments) Implementation & Dedicated Portals Frontend Wiring.
- **Completed Modules & Features:**
  1. Backend (SPEC_15): Complete `InvoiceService` with 3-way line item match (quantity & price tolerance), `PaymentService` with automatic 2% TDS deduction and business-day holiday calendar adjustment, invoice aging Celery task (`app/tasks/invoice_aging.py`), routers, and repositories.
  2. Database & Seed Data: Fixed permission unhashable list check in `app/auth/dependencies.py`; seeded PO, GRN, Invoice, and Payment master permissions for all procurement and supplier roles; seeded demo POs, GRN, and 3-way matched invoice with scheduled payment.
  3. Buyer Portal:
     - `/invoices` and `/invoices/[id]` for 3-way match audit, discrepancy review, and approval/dispute actions.
     - `/payments` master disbursement ledger with KPIs, search, status/method filters, and UTR recording modal.
     - Sidebar updated with dedicated "Invoices" and "Payments" links.
  4. Supplier Portal:
     - `/invoices` and `/invoices/new` for PO-linked invoice submission and tracking.
     - `/payments` inward remittance ledger with UTR tracking and Form 16A / 26AS TDS tax credit visibility.
     - Sidebar updated with dedicated "Invoices" and "Payments" links.
- **Verification:** 372 pytest unit and integration tests passing (`.venv/bin/pytest tests/unit/ tests/integration/`); 9-package Turborepo typecheck passing (`pnpm turbo run typecheck`); Graphify graph synchronized (5330 nodes, 13383 edges).

