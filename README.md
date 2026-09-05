# Procurement Portal — Enterprise S2C & P2P Platform

## Current Session State
**Status:** SPEC_23 Testing Strategy Complete — 80.14% Coverage Gate Achieved
**Completed:**
- **Global Fixtures & Test Isolation (`tests/conftest.py`):** Configured db rollback, seeded org/user fixtures, and factories with zero hardcoded UUIDs.
- **Factory Infrastructure (`tests/factories/`):** Complete factory suite using `uuid4()` across all modules.
- **OWASP Top 10 Security (`tests/security/test_owasp.py`):** 20/20 tests passing (0 failures), covering IDOR, injection, auth, CSRF/headers, rate-limiting, and mass assignment.
- **Performance Testing (`tests/performance/k6_baselines.js`):** 7 scenarios with p95<500ms and p99<1000ms SLO thresholds.
- **Workflow Templates (`tests/workflow/test_all_templates.py`):** 20/20 parametrized tests passing across all 10 workflow templates.
- **Playwright E2E (`tests/e2e/playwright/`):** Complete coverage for buyer, supplier, and full procurement cycle flows.
- **Backend Coverage Target Reached:** Full pytest test suite passes (748 passed, 0 failures, 80.14% coverage meeting the >=80.0% gate).
**Verification:** `pytest tests/ -q --cov=app --cov-report=html --cov-fail-under=80` (748 passed, 80.14% cov); `pnpm test` (3 turbo tasks passing); OWASP security tests (20/20 passing).
**Migration Head:** 0035_analytics_spec25
**Test Commands:** `.venv/bin/pytest tests/ --cov=app --cov-fail-under=80` & `cd procurement-portal-frontend && pnpm test`
**Next:** Production readiness and performance baseline (Part 17)
**Graphify:** 7115 nodes, 18340 edges, 441 communities

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
| 03 | Database Architecture & Schema | SPEC_03 | ✅ Complete | 0035_analytics_spec25 | ✅ 17 Passing (100% cov) |
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
| 14 | Purchase Order (PO) | SPEC_14 | ✅ Complete | 0035_analytics_spec25 | ✅ 9 Passing (100% cov) |
| 15 | Invoice & Payment | SPEC_15 | ✅ Complete | 0033_invoice_payment_spec15 | ✅ 10 Passing (100% cov) |
| 16 | Notification Service | SPEC_16 | ✅ Complete | 0020_notification | ✅ 12 Passing (100% cov) |
| 17 | Document Management | SPEC_17 | ✅ Complete | 0027_data_seed | ✅ 39 Passing (100% cov) |
| 18 | API Standards & Resilience | SPEC_18 | ✅ Complete | 0035_analytics_spec25 | ✅ 10 Passing (100% cov) |
| 19 | Frontend Applications | SPEC_19 | ✅ Complete | Apple & Glass active | ✅ Playwright E2E passing |
| 20 | Integration Hub | SPEC_20 | ✅ Complete | 0034_fix_tax_codes_tax_type | ✅ Passing (100% cov) |
| 21 | Infrastructure & Deployment | SPEC_21 | ✅ Complete | 0035_analytics_spec25 | ✅ 9 Passing (100% cov) |
| 22 | Observability & Telemetry | SPEC_22 | ✅ Complete | 0035_analytics_spec25 | ✅ 9 Passing (100% cov) |
| 23 | Testing Strategy | SPEC_23 | ✅ Complete | 0035_analytics_spec25 | ✅ 748 Passing (80.14% cov, 0 sec fails) |
| 24 | Master Data Management | SPEC_24 | ✅ Complete | 0034_fix_tax_codes_tax_type | ✅ 43 Passing (100% cov) |
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

