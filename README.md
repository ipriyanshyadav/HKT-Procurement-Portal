# Procurement Portal — Enterprise S2C & P2P Platform

## Current Session State
**Status:** Real-World Enterprise Nuances (Section 3.2) & Full Specs Complete — 100% End-to-End Wired
**Completed:**
- **5 Enterprise Nuances (Section 3.2):** (1) Item Master & OCI/cXML PunchOut Catalog integration in PR creation, (2) Master Data CSV Bulk Import for Categories, UOMs, Tax Codes, Payment Terms, and Delivery Locations with Celery progress tracking, (3) WhatsApp Business dispatch (Meta Cloud + Twilio live HTTP integrations with mock simulation fallback), (4) Cloud Anti-Bot protection via Cloudflare Turnstile token verification across all portal logins, (5) Split-Screen Document Viewer for 3-way invoice matching with MinIO presigned URL viewing.
- **Backend Quality Gate:** 754 passing tests, 80.04% coverage (`--cov-fail-under=80`), zero regressions across all 25 modules.
- **Frontend Quality Gate:** Turborepo typecheck 100% clean across all 9 packages with zero errors.
**Verification:** `reports/enterprise_nuances_implementation_audit.md` & `reports/comprehensive_portal_audit_and_sufficiency_report.md`
**Migration Head:** 0036_item_master
**Test Commands:** `.venv/bin/pytest tests/ --cov=app --cov-fail-under=80` & `cd procurement-portal-frontend && pnpm typecheck`
**Next:** Performance Baseline (Part 17) & Production Deployment
**Graphify:** 7365 nodes, 18840 edges, 441 communities

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
| 03 | Database Architecture & Schema | SPEC_03 | ✅ Complete | 0036_item_master | ✅ 17 Passing (100% cov) |
| 04 | Auth & RBAC Security | SPEC_04 | ✅ Complete | 0027_data_seed | ✅ 205 Passing (Turnstile Anti-Bot) |
| 05 | Workflow Engine | SPEC_05 | ✅ Complete | 0027_data_seed | ✅ 38 Passing (100% cov) |
| 06 | Approval Rules Engine | SPEC_06 | ✅ Complete | 0027_data_seed | ✅ 9 Passing (100% cov) |
| 07 | Vendor Management | SPEC_07 | ✅ Complete | 0027_data_seed | ✅ 21 Passing (100% cov) |
| 08 | Purchase Requisition (PR) | SPEC_08 | ✅ Complete | 0036_item_master | ✅ 10 Passing (Catalog & PunchOut) |
| 09 | Unmapped PR | SPEC_09 | ✅ Complete | 0027_data_seed | ✅ 7 Passing (100% cov) |
| 10 | RFQ Lifecycle | SPEC_10 | ✅ Complete | 0029_rfq_bid_spec10_11 | ✅ 12 Passing (100% cov) |
| 11 | Bid Management | SPEC_11 | ✅ Complete | 0029_rfq_bid_spec10_11 | ✅ 11 Passing (100% cov) |
| 11B | Live Reverse Auction | SPEC_11B | ✅ Complete | 0028_live_auction | ✅ 32 Passing (100% cov) |
| 12 | Comparative Statement (CS) | SPEC_12 | ✅ Complete | 0030_evaluation_spec12 | ✅ 7 Passing (100% cov) |
| 13 | Contract Management | SPEC_13 | ✅ Complete | 0031_contract_spec13 | ✅ 9 Passing (100% cov) |
| 14 | Purchase Order (PO) | SPEC_14 | ✅ Complete | 0035_analytics_spec25 | ✅ 9 Passing (100% cov) |
| 15 | Invoice & Payment | SPEC_15 | ✅ Complete | 0033_invoice_payment_spec15 | ✅ 10 Passing (Split-Screen Viewer) |
| 16 | Notification Service | SPEC_16 | ✅ Complete | 0020_notification | ✅ 12 Passing (WhatsApp Live Dispatch) |
| 17 | Document Management | SPEC_17 | ✅ Complete | 0027_data_seed | ✅ 39 Passing (100% cov) |
| 18 | API Standards & Resilience | SPEC_18 | ✅ Complete | 0035_analytics_spec25 | ✅ 10 Passing (100% cov) |
| 19 | Frontend Applications | SPEC_19 | ✅ Complete | Apple & Glass active | ✅ Playwright E2E passing |
| 20 | Integration Hub | SPEC_20 | ✅ Complete | 0034_fix_tax_codes_tax_type | ✅ Passing (100% cov) |
| 21 | Infrastructure & Deployment | SPEC_21 | ✅ Complete | 0035_analytics_spec25 | ✅ 9 Passing (100% cov) |
| 22 | Observability & Telemetry | SPEC_22 | ✅ Complete | 0035_analytics_spec25 | ✅ 9 Passing (100% cov) |
| 23 | Testing Strategy | SPEC_23 | ✅ Complete | 0036_item_master | ✅ 754 Passing (80.04% cov, 0 sec fails) |
| 24 | Master Data Management | SPEC_24 | ✅ Complete | 0036_item_master | ✅ 48 Passing (Multi-Entity Bulk Import) |
| 25 | Analytics & Reporting | SPEC_25 | ✅ Complete | 0035_analytics_spec25 | ✅ 8 Passing (100% cov) |

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

