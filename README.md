# Procurement Portal — Enterprise S2C & P2P Platform

## Current Session State
**Status:** SPEC_18 API Design Standards Retrofit completed across all 24 modules
**Completed:**
- **Core API Modules:** Fully implemented and tested `responses.py` (envelopes, metadata, links, field filtering), `pagination.py` (cursor & offset pagination), `filters.py` (filter builder), `streaming.py` (CSV/PDF generators), and `deprecation.py` (standard headers).
- **Module Routers Audit:** Standardized all 24 routers to return APIResponse envelope and PaginationMeta on all collection/list endpoints.
- **Error Envelopes:** Verified uniform error envelope `{error: {code, message, details, trace_id, timestamp}}` across `app/core/exceptions.py`.
- **Idempotency Support:** Implemented `IdempotencyMiddleware` supporting `X-Idempotency-Key` and `Idempotency-Key` across all state-changing endpoints with Redis & in-memory cache fallback.
- **Streaming Exports:** Implemented streaming CSV and PDF export endpoints across 5 modules: `requisitions`, `rfqs`, `vendors`, `invoices`, and `analytics`.
- **OpenAPI & TypeScript:** Cleaned router tags to exactly one canonical tag per module (24 tags total), regenerated `openapi.json` and TypeScript types in `@procurement/types`, with Turborepo `pnpm typecheck --force` passing (0 errors).
**Verification:** 311/311 unit tests pass; 163/163 integration tests pass (total 474/474 passing); Turborepo `pnpm typecheck` passing (0 errors).
**Migration Head:** 0035_analytics_spec25
**Test Commands:** `.venv/bin/pytest tests/unit/test_spec18_api_standards.py -v` & `cd procurement-portal-frontend && pnpm typecheck`
**Next:** Production readiness and performance baseline (Part 17)
**Graphify:** 6529 nodes, 16525 edges, 409 communities

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
| 19 | Frontend Applications | SPEC_19 | ✅ Complete | Apple & Glass active | ✅ Turborepo passing |
| 20 | Integration Hub | SPEC_20 | ✅ Complete | 0034_fix_tax_codes_tax_type | ✅ Passing (100% cov) |
| 21 | Infrastructure & Deployment | SPEC_21 | ✅ Complete | 0035_analytics_spec25 | ✅ 9 Passing (100% cov) |
| 22 | Observability & Telemetry | SPEC_22 | ✅ Complete | 0035_analytics_spec25 | ✅ 9 Passing (100% cov) |
| 23 | Testing Strategy | SPEC_23 | 🔄 Active | Pytest suite active | 50 Passing |
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

