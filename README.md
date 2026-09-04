# Procurement Portal — Enterprise S2C & P2P Platform

## Current Session State
**Status:** SPEC_07 (Vendor Management) COMPLETED (100%)
**Completed:** 11-status lifecycle FSM (INVITED→BLACKLISTED) + validate_transition(); VendorRepository (CRUD, duplicate check, full-text search, scorecards, ERP sync logs); VendorService (invite with SHA-256 token hashing, register_with_token, qualify, reject, request_resubmission, suspend, reinstate, initiate_blacklist, confirm_blacklist with Segregation of Duties, scorecard 40/30/20/10 calculation, GSTIN validation with 90-day Redis cache, PAN validation with entity-type decoding and 90-day Redis cache, Bank account validation + penny drop simulation); Vendor router with buyer-side endpoints & supplier self-service `/me` endpoints; Celery beat daily compliance monitoring task (30/15/7 day alerts, immediate COMPLIANCE_HOLD at 0 days); Buyer Portal `/vendors`, `/vendors/[id]`, `/vendors/invite`; Supplier Portal `/register/[token]` (8-step wizard), `/profile`, `/documents`; Shared UI components (`VendorStatusBadge`, `ComplianceExpiryAlert`); Shared hooks `useVendors.ts`; 21 vendor integration & workflow tests passing (253 passed across suite).
**Migration Head:** 0027_data_seed
**Test Commands:** OTEL_SDK_DISABLED=true .venv/bin/pytest tests/integration/test_vendor.py tests/workflow/test_vendor_workflows.py -v
**Next:** SPEC_08 Purchase Requisition (PR)
**Graphify:** 3130 nodes, 6469 edges, 270 communities

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
| 08 | Purchase Requisition (PR) | SPEC_08 | ⏳ Planned | Pending | Pending |
| 09 | Unmapped PR | SPEC_09 | ⏳ Planned | Pending | Pending |
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
