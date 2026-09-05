# Procurement Portal — Enterprise S2C & P2P Platform

## Current Session State
**Status:** SPEC_21 Infrastructure & Deployment Implementation Complete
**Completed:**
- **K3s Base Manifests:** 
  - Namespaces: `procurement`, `monitoring`, `logging`, `infra` (`namespaces.yaml`).
  - Core API & Workers: `api-deployment.yaml` (FastAPI 3 replicas, probes, preStop hook, resource limits), `celery-deployment.yaml` (worker 2 replicas + 6 queues, beat 1 replica).
  - Autoscaling & Resiliency: `hpa.yaml` (API 3-15 replicas on CPU 70% + RPS 100, Celery 2-10 replicas on CPU 75%), `pdbs.yaml` (API minAvailable: 2, Celery minAvailable: 1).
  - Zero-Trust Security: `netpolicies.yaml` (default-deny-all + explicit least-privilege allow rules for DNS, Kong→API/Frontends, Frontends→API, API/Worker→PgBouncer/DB/Redis/RMQ/MinIO/ES, and Prometheus metrics scraping).
- **Stateful HA Infrastructure:**
  - PostgreSQL 16 HA: 3 nodes (primary, read replica, headless service, WAL archiving config).
  - PgBouncer: Connection pooler (port 6432, transaction mode, pool size 50).
  - Redis Sentinel: 3 nodes (port 6379 & 26379, automatic failover, sentinel config).
  - RabbitMQ: 3 nodes (port 5672, 15672 management, 15692 prometheus, k8s peer discovery).
  - MinIO Distributed: 4 nodes erasure coding (port 9000 S3 API, 9001 console).
  - Elasticsearch 8: 3 nodes cluster (port 9200 HTTP, 9300 transport).
- **Frontend Portal Deployments:**
  - `buyer-portal-deployment.yaml` (Next.js standalone, port 3000, 2 replicas).
  - `supplier-portal-deployment.yaml` (Next.js standalone, port 3001, 2 replicas).
  - `admin-portal-deployment.yaml` (Next.js standalone, port 3002, 2 replicas).
  - `frontend-services.yaml` (ClusterIP services for buyer, supplier, and admin portals).
- **Ingress, TLS & Operational Tools:**
  - Kong Gateway: Declarative DB-less gateway routing for `apps.procurement.com`, `supplier.procurement.com`, `admin.procurement.com`, and `/api/v1`, `/ws`.
  - cert-manager: Let's Encrypt Staging and Production `ClusterIssuer` resources.
  - Velero: Daily snapshot schedule at 02:00 UTC with 30-day retention (`ttl: 720h0m0s`).
  - Sealed Secrets: GitOps encrypted `SealedSecret` manifests for all application and stateful secrets.
- **Kustomize Overlays:**
  - `k8s/overlays/dev/`: 1 replica per service, scaled-down resources, `.dev` domain routing.
  - `k8s/overlays/staging/`: Mirrors production topology, staging domains and cert-manager issuer.
  - `k8s/overlays/production/`: Full HA replicas (API 5-30, Celery 4-15, Postgres 3, Redis 3, RMQ 3, MinIO 4), SealedSecrets active.
  - `k8s/overlays/dr/`: Warm standby configuration, WAL shipping restore command, worker paused until promotion.
- **Verification:** 9/9 tests pass in `tests/unit/test_k8s_manifests.py`; 11/11 tests pass across integration suite; 7/7 Turbo packages pass `pnpm typecheck`.
**Migration Head:** 0035_analytics_spec25
**Test Commands:** `.venv/bin/pytest tests/unit/test_k8s_manifests.py -v` & `cd procurement-portal-frontend && pnpm typecheck`
**Next:** SPEC_18 API Standards & Resilience
**Graphify:** 6385 nodes, 16095 edges, 393 communities

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
| 18 | API Standards & Resilience | SPEC_18 | ⏳ Planned | Pending | Pending |
| 19 | Frontend Applications | SPEC_19 | ✅ Complete | Apple & Glass active | ✅ Turborepo passing |
| 20 | Integration Hub | SPEC_20 | ✅ Complete | 0034_fix_tax_codes_tax_type | ✅ Passing (100% cov) |
| 21 | Infrastructure & Deployment | SPEC_21 | ✅ Complete | 0035_analytics_spec25 | ✅ 9 Passing (100% cov) |
| 22 | Observability & Telemetry | SPEC_22 | 🔄 Scaffolded | OTel/Jaeger ready | Passing |
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

