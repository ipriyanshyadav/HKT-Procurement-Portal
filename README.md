# Procurement Portal — Enterprise S2C & P2P Platform

## Current Session State
**Status:** Local Development Setup & Portals Runtime COMPLETED (100%)
**Completed:**
- **Backend Auth & Session Pipeline:** Fixed `UserSession` tracking by unifying `session_jti` across access/refresh tokens and importing all module models in `app/main.py` so SQLAlchemy foreign keys to `organizations` resolve during commit. Made `org_id` optional in `LoginRequest` with automatic tenant resolution. Verified `POST /auth/login`, `GET /users/me`, and `GET /users/me/permissions` for admin, buyer, and approver.
- **Frontend Portals Wiring (3000, 3001, 3002):** Configured Tailwind CSS and PostCSS across all apps (`apps/buyer-portal`, `apps/admin-portal`, `apps/supplier-portal`); imported `globals.css` in all root layouts; created supplier login page (`apps/supplier-portal/app/(auth)/login/page.tsx`) resolving 404 on port 3001; redirected admin portal root to `/master-data/categories` on port 3002; updated buyer portal login to redirect to `/requisitions` on port 3000.
- **Verification:** All 3 Next.js applications build with 0 errors (`turbo build`); dev servers healthy on ports 3000, 3001, 3002; Pytest suite passing (220 tests, 100% pass).
**Migration Head:** 0027_data_seed
**Test Commands:** `OTEL_SDK_DISABLED=true .venv/bin/pytest tests/unit tests/integration/test_auth_router.py -v`
**Next:** SPEC_10 RFQ Lifecycle
**Graphify:** 3434 nodes, 7513 edges, 295 communities

---

## System Overview

The Procurement Portal is an enterprise-grade Source-to-Contract (S2C), Procure-to-Pay (P2P), Supplier Relationship Management (SRM), and Analytics platform built as a modular monolith in Python/FastAPI with a Turborepo Next.js 14 frontend.

### Squad Decomposition
- **Squad A (Platform & Core):** SPEC_01, SPEC_02, SPEC_03, SPEC_04, SPEC_18, SPEC_21, SPEC_22
- **Squad B (Sourcing & Bids):** SPEC_08, SPEC_09, SPEC_10, SPEC_11, SPEC_12
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
| 10 | RFQ Lifecycle | SPEC_10 | ⏳ Planned | Pending | Pending |
| 11 | Bid Management | SPEC_11 | ⏳ Planned | Pending | Pending |
| 12 | Comparative Statement (CS) | SPEC_12 | ⏳ Planned | Pending | Pending |
| 13 | Contract Management | SPEC_13 | ⏳ Planned | Pending | Pending |
| 14 | Purchase Order (PO) | SPEC_14 | ⏳ Planned | Pending | Pending |
| 15 | Invoice & Payment | SPEC_15 | ⏳ Planned | Pending | Pending |
| 16 | Notification Service | SPEC_16 | ⏳ Planned | Pending | Pending |
| 17 | Document Management | SPEC_17 | ⏳ Planned | Pending | Pending |
| 18 | API Standards & Resilience | SPEC_18 | ⏳ Planned | Pending | Pending |
| 19 | Frontend Applications | SPEC_19 | 🔄 In Progress | Scaffolding complete | Turborepo ready |
| 20 | Integration Hub | SPEC_20 | ⏳ Planned | Pending | Pending |
| 21 | Infrastructure & Deployment | SPEC_21 | 🔄 Scaffolded | Docker/Kong ready | K8s stubs |
| 22 | Observability & Telemetry | SPEC_22 | 🔄 Scaffolded | OTel/Jaeger ready | Passing |
| 23 | Testing Strategy | SPEC_23 | 🔄 Active | Pytest suite active | 50 Passing |
| 24 | Master Data Management | SPEC_24 | ✅ Complete | 0027_data_seed | ✅ 38 Passing (100% cov) |
| 25 | Analytics & Reporting | SPEC_25 | ⏳ Planned | Pending | Pending |

---

## Quickstart & Verification

### Run Backend Tests
```bash
.venv/bin/pytest tests/ -v
```

### Seed Master Data
```bash
.venv/bin/python scripts/generate_rsa_keys.py
.venv/bin/python scripts/seed_master_data.py
```

### Start Docker Stack
```bash
docker compose -f docker/docker-compose.yml up -d
```
