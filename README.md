# Procurement Portal — Enterprise S2C & P2P Platform

## Current Session State
**Status:** SPEC_08 (Purchase Requisition) & SPEC_09 (Unmapped PR) COMPLETED (100%)
**Completed:**
- **SPEC_08 (Purchase Requisition):** 12-status FSM with `validate_pr_transition()`; `RequisitionRepository` & `RequisitionService` (CRUD, submit with synchronous budget check, withdraw, amend with 10% tolerance, merge PRs with same BU/category, split PR into child PRs, convert to RFQ / PO, PR sequence generation `PR-{BU}-{YYYY}-{NNNNNN}`, Redis cache invalidation); 12 REST endpoints in `app/modules/requisition/router.py`; PR aging Celery task `app/tasks/pr_aging.py` using `settings.PR_AGING_ALERT_DAYS`.
- **SPEC_09 (Unmapped PR):** `UnmappedPrRepository` & `UnmappedPrService` (`flag_as_unmapped`, `map_pr` with mapping log audit trail, `suggest_mapping` with category heuristic suggestions, `auto_map` enforcing >= 0.85 confidence threshold); 5 REST endpoints in `app/modules/unmapped_pr/router.py`; 4-tier SLA escalation Celery task in `app/tasks/unmapped_pr_sla.py` using `settings.UNMAPPED_PR_SLA_HOURS` ([4, 8, 24, 48]).
- **Frontend Wiring:** Buyer Portal pages `/requisitions` (filterable list), `/requisitions/new` (PR creation wizard with budget indicator), `/requisitions/[id]` (PR detail, approval timeline, actions), `/unmapped-prs` (exception dashboard with mapping modal); Shared UI components `PRLineItemTable`, `WorkflowTimeline`, `BudgetIndicator`; Shared hook `useRequisitions.ts`.
- **Testing:** 17 PR integration & workflow tests passing (`test_requisition.py` & `test_pr_workflows.py`), full repository suite 328 passed.
**Migration Head:** 0027_data_seed
**Test Commands:** `OTEL_SDK_DISABLED=true .venv/bin/pytest tests/integration/test_requisition.py tests/workflow/test_pr_workflows.py -v`
**Next:** SPEC_10 RFQ Lifecycle
**Graphify:** 3382 nodes, 7401 edges, 274 communities

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
