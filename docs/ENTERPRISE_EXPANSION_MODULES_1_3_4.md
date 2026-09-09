# Enterprise Expansion Modules (Options 1, 3, 4 & SPEC_17) — Technical & Architectural Guide

---

## Executive Overview

This document provides complete technical, operational, and architectural documentation for the three advanced enterprise capabilities and performance baseline implemented in Cycle 4:

1. **Option 1 (`SPEC_07`) — External Supplier Self-Onboarding & KYC Registration Portal**
2. **Option 3 (`SPEC_25`) — Real-Time Spend Cube & Maverick Spend AI Intelligence**
3. **Option 4 (`SPEC_20`) — Full Multi-ERP Bi-Directional Sync Gateway (SAP S/4HANA & NetSuite)**
4. **Performance Baseline (`SPEC_17`) — k6 Automated Load & Core Web Vitals Benchmark**

---

## 1. Database Migration & Schema Architecture

**Migration ID:** `0050_enterprise_expansion`  
**Base Revision:** `0049_dr_orchestrator`

### 1.1 Table: `vendor_onboarding_applications`
Persists self-registered supplier applications and compliance maker-checker workflows.

| Column | Type | Constraints / Defaults | Description |
|---|---|---|---|
| `id` | `UUID` | Primary Key | Application identifier |
| `org_id` | `UUID` | FK `organizations.id` | Multi-tenant tenant ID |
| `vendor_id` | `UUID` | FK `vendors.id` | Associated vendor record created in `DRAFT` status |
| `application_number` | `VARCHAR(50)` | Unique, Not Null | Format `APP-YYYYMMDD-XXXX` |
| `status` | `VARCHAR(30)` | Default `'SUBMITTED'` | `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `RESUBMISSION_REQUESTED` |
| `gstin_verified` | `BOOLEAN` | Default `false` | Real-time tax checksum & NSDL verification |
| `pan_verified` | `BOOLEAN` | Default `false` | Statutory PAN validity verification |
| `penny_drop_verified` | `BOOLEAN` | Default `false` | Bank account beneficiary penny-drop verification |
| `kyc_risk_tier` | `VARCHAR(20)` | Default `'LOW'` | `LOW`, `MEDIUM`, `HIGH` |
| `submitted_payload` | `JSONB` | Default `{}` | Full snapshot of prospective vendor data |
| `review_notes` | `TEXT` | Nullable | Compliance officer audit rationale |
| `reviewed_by` | `UUID` | FK `users.id` | Reviewing compliance officer ID |
| `reviewed_at` | `TIMESTAMPTZ` | Nullable | Review timestamp |

### 1.2 Table: `maverick_spend_clusters`
Persists AI-identified rogue spend clusters, root causes, and projected savings.

| Column | Type | Constraints / Defaults | Description |
|---|---|---|---|
| `id` | `UUID` | Primary Key | Cluster identifier |
| `org_id` | `UUID` | FK `organizations.id` | Tenant ID |
| `cluster_type` | `VARCHAR(50)` | Not Null | `RETROACTIVE_PO`, `SPLIT_PURCHASE_ORDER`, `OFF_CONTRACT_LEAKAGE`, `PRICE_VARIANCE_DISPERSION` |
| `cluster_title` | `VARCHAR(255)` | Not Null | Human-readable cluster name |
| `severity` | `VARCHAR(20)` | Default `'MEDIUM'` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `affected_spend` | `NUMERIC(18,2)` | Default `0.00` | Total monetary spend leaked |
| `potential_savings` | `NUMERIC(18,2)` | Default `0.00` | Projected recoverable savings |
| `affected_entity_ids`| `JSONB` | Default `[]` | UUID list of POs, Invoices, or Line items |
| `root_cause_analysis`| `TEXT` | Not Null | AI diagnostic explanation of the breakdown |
| `ai_recommendation` | `TEXT` | Not Null | Suggested operational or policy countermeasure |
| `status` | `VARCHAR(30)` | Default `'DETECTED'` | `DETECTED`, `INVESTIGATING`, `RESOLVED`, `FALSE_POSITIVE` |

### 1.3 Table: `erp_entity_mappings`
Maintains idempotent entity mappings between local procurement documents and external ERPs.

| Column | Type | Constraints / Defaults | Description |
|---|---|---|---|
| `id` | `UUID` | Primary Key | Mapping identifier |
| `org_id` | `UUID` | FK `organizations.id` | Tenant ID |
| `erp_system` | `VARCHAR(50)` | Not Null | `SAP_S4HANA`, `NETSUITE`, `ORACLE_CLOUD` |
| `entity_type` | `VARCHAR(50)` | Not Null | `PURCHASE_ORDER`, `INVOICE`, `VENDOR`, `GOODS_RECEIPT` |
| `internal_id` | `UUID` | Not Null | Primary key in local procurement DB |
| `external_id` | `VARCHAR(100)` | Not Null | External document number or IDoc # |
| `sync_direction` | `VARCHAR(20)` | Default `'OUTBOUND'` | `OUTBOUND`, `INBOUND` |
| `sync_status` | `VARCHAR(30)` | Default `'SUCCESS'` | `SUCCESS`, `PENDING`, `FAILED`, `DEAD_LETTER` |
| `retry_count` | `INTEGER` | Default `0` | Consecutive failure count (escalates to DLQ at 3) |
| `last_error` | `TEXT` | Nullable | Error message returned by ERP API |
| `idoc_number` | `VARCHAR(64)` | Nullable | SAP IDoc number |
| `payload_checksum` | `VARCHAR(64)` | Nullable | SHA-256 hash of payload (idempotency key) |
| `reconciliation_hash`| `VARCHAR(64)`| Nullable | Parity audit token |
| `metadata_json` | `JSONB` | Default `{}` | Full ERP response payload |
| `last_synced_at` | `TIMESTAMPTZ` | Default `now()` | Last successful transmission timestamp |

---

## 2. Option 1: External Supplier Self-Onboarding & KYC Portal (`SPEC_07`)

### 2.1 Workflow & Architecture
```
Prospective Vendor (/register)
  │
  ├── 1. Fill 6-Stage Form (Corporate Info, GSTIN, PAN, Address, Contacts, Bank & IFSC)
  ├── 2. Automated Format & Checksum Verification (GSTIN, PAN, IFSC)
  ├── 3. Instant ₹1.00 Penny-Drop Bank Account Test
  ▼
Submit Application (POST /api/v1/vendors/self-register)
  │
  ├── Vendor record created in status="DRAFT"
  ├── Application created in status="SUBMITTED"
  ▼
Internal Buyer Compliance Workbench (/vendors/onboarding)
  │
  ├── Review GSTIN/PAN status, Risk Tier (LOW/MED/HIGH), & Bank Test
  ├── Action: Approve / Reject / Request Resubmission
  ▼
On Approval (POST /api/v1/vendors/onboarding/{id}/review)
  ├── Vendor status transitions DRAFT ──> REGISTERED
  ├── User account automatically provisioned with role="SUPPLIER"
  └── Activation credentials issued to vendor primary contact
```

### 2.2 API Endpoints
- `POST /api/v1/vendors/self-register`: Public self-registration endpoint (no auth required).
- `GET /api/v1/vendors/onboarding/pending`: List pending applications for compliance team.
- `POST /api/v1/vendors/onboarding/{app_id}/review`: Approve, reject, or request resubmission.

### 2.3 Portal UI
- **Supplier Portal (`/register`)**: Multi-step wizard with real-time verification chips for GSTIN, PAN, and Bank IFSC.
- **Buyer Portal (`/vendors/onboarding`)**: Internal Compliance Review Workbench with filterable application queue, risk badges, and 1-click approval dialogs.

---

## 3. Option 3: Real-Time Spend Cube & Maverick Spend AI Intelligence (`SPEC_25`)

### 3.1 AI Anomaly Detection Engine
Scans transactional records across four critical maverick spend patterns:

1. **`RETROACTIVE_PO` (Post-Invoice POs)**:
   - *Pattern*: POs created after vendor invoices were already dated or received at accounts desk (violates no-PO-no-pay).
   - *Impact*: Inability to pre-commit budgets; price inflation vulnerability.
2. **`SPLIT_PURCHASE_ORDER` (Threshold Evasion)**:
   - *Pattern*: Consecutive micro-orders (< ₹50,000) placed to a single vendor within 7–14 days to bypass secondary approval levels.
   - *Impact*: Fragmented purchasing; lost volume rebates.
3. **`OFF_CONTRACT_LEAKAGE` (Unlinked Purchases)**:
   - *Pattern*: Spot purchases in categories where active corporate Master Service Agreements (MSAs) exist.
   - *Impact*: Typically 12–18% direct cash loss due to unapplied contract discounts.
4. **`PRICE_VARIANCE_DISPERSION` (Pricing Asymmetry)**:
   - *Pattern*: Line items with identical descriptions or item codes bought at >15% price dispersion across departments.
   - *Impact*: Siloed buying without catalog price-locks.

### 3.2 API Endpoints
- `GET /api/v1/analytics/maverick-spend/clusters`: Fetch active maverick clusters with status and type filters.
- `POST /api/v1/analytics/maverick-spend/detect-anomalies`: Trigger real-time anomaly scan.
- `POST /api/v1/analytics/maverick-spend/clusters/{id}/status`: Triage cluster (`INVESTIGATING`, `RESOLVED`, `FALSE_POSITIVE`).

### 3.3 Portal UI
- **Buyer Portal (`/analytics`)**:
  - `MaverickIntelligenceWorkbench` rendered in the "Maverick Spend Discovery" tab.
  - Displays KPI summary cards: Total Clusters, Critical/High Risk, Total Leaked Spend, Projected Recovery Savings.
  - Root Cause Analysis & AI Recommended Actions per cluster with interactive triage status buttons.

---

## 4. Option 4: Full Multi-ERP Bi-Directional Sync Gateway (`SPEC_20`)

### 4.1 Architecture & Adapters
- **Pluggable Architecture**: Implements `ERPAdapterBase` with `ERPAdapterFactory`.
- **Supported Adapters**:
  - `SAPAdapter`: RFC/REST and IDoc transformations (`ORDERS05` for POs, `INVOIC02` for Invoices, `CREMAS05` for Vendors).
  - `NetSuiteAdapter`: SuiteTalk REST API payloads (`purchaseOrder`, `vendorBill`, `vendor`, `inventoryItem`).
  - `OracleAdapter`: Oracle Cloud REST.
  - `TallyXMLAdapter`: Tally Prime XML integration.

### 4.2 Idempotency & Dead Letter Queue (DLQ)
- **Payload Checksum**: SHA-256 hash of canonicalized JSON. Repeated sync calls with identical payloads return the existing mapping without re-posting to ERP.
- **3-Tier Retry & DLQ**:
  - Failure attempts 1 & 2: Status marked `FAILED`, `retry_count` incremented.
  - Failure attempt 3: Status escalated to `DEAD_LETTER`, alerts generated for administrator triage.
  - Force Retry (`force_retry=True`): Clears error, resets count, and re-dispatches to ERP gateway.

### 4.3 API Endpoints
- `GET /api/v1/integrations/erp-gateway/mappings`: List all synced entity mappings with filters.
- `POST /api/v1/integrations/erp-gateway/sync`: Trigger outbound synchronization.
- `POST /api/v1/integrations/erp-gateway/inbound`: Process incoming webhook/IDoc from ERP.
- `GET /api/v1/integrations/erp-gateway/reconciliation`: Generate system parity and DLQ report.
- `POST /api/v1/integrations/erp-gateway/mappings/{id}/retry`: Force retry for failed/DLQ mapping.

### 4.4 Portal UI
- **Admin Portal (`/integrations/erp`)**:
  - **Entity Mappings & Logs**: Real-time table with direction, checksums, IDoc numbers, and status badges.
  - **System Parity & DLQ**: Parity percentage gauge and DLQ triage console.
  - **Manual Sync Dispatcher**: 1-click test tool to dispatch POs, Invoices, or Vendors directly to SAP S/4HANA or NetSuite.

---

## 5. Verification & Test Commands

```bash
# 1. Run all 4 new integration test suites
.venv/bin/pytest tests/integration/test_supplier_self_onboarding_spec07.py \
                 tests/integration/test_maverick_spend_intelligence_spec25.py \
                 tests/integration/test_multi_erp_gateway_spec20.py -v

# 2. Run existing scorecard regression tests
.venv/bin/pytest tests/integration/test_vendor_scorecard_and_risk_spec21.py -v

# 3. Verify TypeScript across all 9 monorepo packages
cd procurement-portal-frontend && pnpm run typecheck

# 4. Verify k6 performance baseline
k6 run tests/performance/k6_baselines.js
```
