# 📘 Comprehensive Cross-Portal Feature & Workflow Manual

> **Platform:** HKT Enterprise Source-to-Pay (S2P) Procurement Platform  
> **Target Audience:** Procurement Specialists, Suppliers, System Administrators, and Deployment Engineers  
> **Environment:** Multi-Tenant Docker Microservices (FastAPI + Next.js App Router + Kong Gateway + PostgreSQL + Redis + RabbitMQ + MinIO + Celery)

---

## 1. Executive Platform Architecture & Portals

The platform delivers a unified, synchronized Source-to-Pay experience partitioned into **3 specialized web portals** communicating via an asynchronous event bus and unified REST API Gateway:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        KONG API GATEWAY (:8000)                        │
└──────────────────┬─────────────────┬───────────────────┬───────────────┘
                   │                 │                   │
    ┌──────────────▼──────┐   ┌──────▼─────────────┐   ┌─▼──────────────┐
    │ BUYER PORTAL (:3000)│   │SUPPLIER PORT (3001)│   │ADMIN PORT (3002│
    │  Requisitions (PR)  │   │  Tenders & Bidding │   │ Org Hierarchy  │
    │  Sourcing & RFQs    │   │  Live Auctions     │   │ Users & Roles  │
    │  Reverse Auctions   │   │  PO Acknowledgment │   │ Master Data Hub│
    │  Contracts & Awards │   │  ASN Dispatch      │   │ Approval Matrix│
    │  Purchase Orders    │   │  Tax Invoicing     │   │ Workflow Engine│
    │  Warehouse GRN/Dock │   │  Payment Tracking  │   │ ERP Sync / SAP │
    │  3-Way/4-Way Match  │   │  Document Vault    │   │ SLA & Tickets  │
    │  Payment Scheduling │   │  Support Tickets   │   │ Audit Trail    │
    │  Analytics Cube     │   │  Profile & ESG     │   │ System Health  │
    └──────────────┬──────┘   └──────┬─────────────┘   └─┬──────────────┘
                   │                 │                   │
                   └─────────────────┼───────────────────┘
                                     ▼
                   ┌───────────────────────────────────┐
                   │     FASTAPI BACKEND CORE (:8080)   │
                   │  PostgreSQL (Transactional Data)  │
                   │  Redis (Cache & Session Store)    │
                   │  RabbitMQ (Transactional Outbox)  │
                   │  Celery (Background Asynchronous) │
                   │  MinIO (S3 Document Storage)      │
                   │  Elasticsearch (Audit & Search)   │
                   └───────────────────────────────────┘
```

---

## 2. Complete Portal Feature & Tab Inventory

### A. Buyer Portal (http://localhost:3000)
Designed for Requestors, Buyers, Category Managers, Finance Officers, and Approvers:

| Category | Tab / Navigation Route | Primary Functionality & Features |
|---|---|---|
| **Purchasing** | **Purchase Requisitions (`/requisitions`)** | Create, view, split, merge, and filter PRs. Supports OPEX/CAPEX classification, multi-line items, budget validations, and CSV bulk import (`/requisitions/import`). |
| | **Marketplace & Catalogs (`/marketplace`)** | Search pre-approved contracted catalogs with punchout session support. |
| | **Purchase Orders (`/purchase-orders`)** | View and issue purchase orders. Supports direct PO creation, PDF generation, order release, and PO amendments. |
| | **Goods Receipts (`/grn`)** | View warehouse receipts, inspect received vs accepted quantities, and trigger quality inspection gates. |
| | **Barcode Dock Intake (`/grn/scan`)** | High-throughput barcode scanner interface for rapid dock receiving directly against ASNs. |
| | **Invoices (`/invoices`)** | Complete ledger of supplier invoices with status tags (`SUBMITTED`, `MATCHED`, `APPROVED`, `PAID`). |
| | **3-Way / 4-Way Match (`/invoices/reconciliation`)** | Automated reconciliation engine comparing PO, GRN receipts, Inspection slips, and Invoices with configurable tolerance thresholds. |
| | **E-Invoicing & E-Way Bills (`/invoices/einvoice`)** | GSTN integration for automated IRN and QR code validation. |
| | **Dispute Inbox (`/invoices/disputes`)** | Dedicated queue for managing and resolving vendor invoice price/quantity discrepancies. |
| | **Payments (`/payments`)** | Payment batch processing, bank UTR recording, TDS deduction calculation, and remittance generation. |
| | **Unmapped PRs (`/unmapped-prs`)** | Staging inbox for PRs imported from legacy ERPs requiring catalog mapping. |
| **Sourcing** | **AI Sourcing Copilot (`/rfqs/copilot`)** | GenAI assistant for generating RFQ line scopes, market intelligence, and supplier negotiation tactics. |
| | **RFQs & Tenders (`/rfqs`)** | Manage end-to-end tender lifecycle: draft, invite vendors, publish, open sealed bids, and comparative statements. |
| | **Live Auctions (`/auctions`)** | Real-time Dutch and English reverse auctions with live dynamic leaderboards. |
| | **Contracts (`/contracts`)** | Central contract repository, milestone management, rate contract utilization tracking, and digital e-signature ceremonies. |
| | **Vendors (`/vendors`)** | Comprehensive vendor directory, onboarding verification, and ESG risk profiling (`/vendors/risk`). |
| **Workflow** | **Approvals & Tasks (`/tasks`)** | Actionable approval inbox for pending PRs, POs, Invoices, and Contracts. |
| | **Delegation Matrix (`/tasks/delegation`)** | Out-of-office delegation matrix configured by users or administrators. |
| **Analytics** | **KPI Dashboard (`/analytics`)** | Real-time spend KPIs, cycle times, and operational performance metrics. |
| | **Spend Breakdown (`/analytics/spend`)** | Multi-dimensional spend cube categorized by BU, Category, Vendor, and GL Account. |
| | **Vendor Scorecards (`/analytics/vendors`)** | OTIF (On-Time In-Full) ratings, quality acceptance rates, and vendor risk grades. |
| | **Group Spend Rollup (`/analytics/rollup`)** | Consolidated cross-entity rollup across multi-subsidiary organizations. |
| | **Compliance (`/compliance`)** | Statutory compliance posture, tax audit logs, and segregation of duties (SoD) alerts. |
| **Support** | **Support Tickets (`/tickets`)** | Ticketing service desk with Kanban board (`/tickets/board`), assigned queues, and audit logs. |

---

### B. Supplier Portal (http://localhost:3001)
Designed specifically for invited and registered external suppliers:

| Category | Tab / Navigation Route | Primary Functionality & Features |
|---|---|---|
| **Orders** | **Purchase Orders (`/purchase-orders`)** | View released purchase orders, inspect line items, download official PDF orders, and click **Acknowledge Order**. |
| | **Advance Shipping Notice (`/asns`)** | Create and dispatch ASNs (`/asns/new`) with tracking numbers, package barcodes, carrier details, and estimated delivery dates. |
| | **Contracts & Agreements (`/contracts`)** | Review contract terms, milestones, rate sheets, and execute digital signature ceremonies (`/contracts/[id]/review`). |
| **Finance** | **Invoices (`/invoices`)** | View invoice submission history, match status, and approval progress. |
| | **Submit Tax Invoice (`/invoices/new`)** | Auto-populated invoice form linking directly to accepted GRN receipts, with automatic tax computation and line item selection. |
| | **Dispute Inbox (`/invoices/disputes`)** | Respond to buyer invoice disputes, submit credit notes, or upload revised invoices. |
| | **Payments (`/payments`)** | View settled payments, transaction UTR numbers, deduction breakdowns (TDS/retention), and download payment advice slips. |
| **Bidding** | **Tenders & Bids (`/rfqs`)** | Browse invited RFQs, view tender deadlines, and submit encrypted bids (`/rfqs/[id]/bid`). |
| | **Live Auctions (`/auctions`)** | Dynamic WebSocket-driven reverse auction bidding room (`/auctions/[id]/live`) with rank indicators and tick timers. |
| **Account** | **My Profile (`/profile`)** | Manage company profile, tax GSTIN/PAN details, bank accounts, and contact representatives. |
| | **Documents (`/documents`)** | Upload compliance certificates, ISO documents, MSME certifications, and NDA agreements. |
| | **Support Tickets (`/tickets`)** | Raise support and discrepancy tickets directly to the buyer procurement service desk (`/tickets/new`). |

---

### C. Admin Portal (http://localhost:3002)
Designed for Superadmins, Organization Administrators, and Governance Teams:

| Category | Tab / Navigation Route | Primary Functionality & Features |
|---|---|---|
| **Governance** | **Organization Hierarchy (`/organization`)** | Multi-level organizational structure modeling: Legal Entities, Business Units, Departments, Cost Centers, Facilities, and Plants. |
| | **Users & Access (`/users`, `/roles`)** | Multi-tenant RBAC management, granular permissions matrix (`/roles/matrix`), and active session revocation (`/sessions`). |
| **Master Data**| **Master Data Hub (`/master-data`)** | Centralized master records: Material & Service Categories (`/master-data/categories`), Items, Units of Measure (UOM), Currencies & Exchange Rates, Payment Terms, Tax Codes, Incoterms, and Holidays. |
| | **Bulk CSV Import (`/master-data/import`)** | High-speed batch ingestion of master items and category hierarchies. |
| **Automation** | **Approval Rules Engine (`/approval-rules`)** | Declarative Business Rules Engine (BRE) configuring multi-condition approval logic based on amount, category, BU, and threshold. |
| | **Workflow Templates (`/workflows`)** | Visual multi-step workflow orchestrator (`/workflows/new`, `/workflows/[id]`) with parallel approvals, SLA timeouts, and auto-escalations. |
| | **Integrations & ERP Gateway (`/integrations`)** | Multi-ERP connector hub supporting SAP RFC, Oracle ERP Cloud, and Tally with automated sync schedules and job monitoring. |
| **Service Desk**| **Tickets Administration (`/tickets`)** | Central incident control center with SLA configuration (`/tickets/sla-config`), custom fields (`/tickets/custom-fields`), automation rules, and performance reports. |
| **Observability**| **Audit Trail (`/audit-trail`)** | Immutable cryptographic audit log tracking who did what, when, and from which IP/portal across all entities. |
| | **System Health & Recovery (`/system/health`, `/system/recovery`)** | Live container heartbeat monitoring, database connection pool stats, RabbitMQ queue metrics, and disaster recovery orchestrator. |

---

## 3. End-to-End Synchronous Workflow & Why It Is Better

### The Traditional Procurement Problem
Traditional procurement platforms suffer from:
1. **Disconnected Silos**: Admin updates master data or approval rules, but buyers continue using outdated cached hierarchies or approved limits.
2. **Batch Delay Latency**: PO acknowledgments, ASN shipments, and GRN receipts sit in batch queues, delaying supplier invoicing.
3. **Manual Reconciliation Bottlenecks**: Accounts Payable teams spend hours manually cross-checking PDF invoices against POs and warehouse paper receipts.
4. **Data Race Conditions**: Forms submit empty payloads or reload prematurely due to uncontrolled client-side state resets.

### The HKT Synchronous Advantage
Our platform architecture solves these issues fundamentally through 4 architectural pillars:

1. **Transactional Outbox & Event-Driven Sync**: Every lifecycle change (e.g. PO release, GRN confirmation, invoice approval) is recorded in PostgreSQL in the same database transaction. The background worker dispatches events via RabbitMQ and pushes live WebSocket updates across active browser sessions in real-time.
2. **Automated 3-Way & 4-Way Matching**: When the supplier submits an invoice, the system automatically checks:
   - Line Item Quantities: `Invoice Qty <= Accepted GRN Qty <= PO Qty`
   - Line Item Prices: `Invoice Unit Price == PO Contracted Price`
   - Tax Computations: Applied tax codes match statutory master data.
   - If variances fall within organization tolerances (e.g. +-0.5%), the invoice **auto-approves** instantly without requiring human manual intervention.
3. **Automated Downstream Actions**: An approved invoice automatically creates a scheduled payment record, factoring in statutory holiday calendars and vendor payment terms (e.g. Net 30), preventing cash flow delays.
4. **Collision-Proof Sequence Engineering**: Unique entity numbers (PR, PO, GRN, INV, TKT) use clustered database sequences synchronized with table maximums, preventing duplicate constraint violations during high-concurrency operations.

---

## 4. Cross-Portal Synchronicity Verification Matrix

| Event Origin | Action Taken | Target Portal 1 Impact | Target Portal 2 Impact | Synchronicity Mechanism |
|---|---|---|---|---|
| **Admin Portal** | Admin updates Category Tree or adds Delivery Location | **Buyer Portal**: New categories and locations appear immediately in PR dropdowns without server restarts. | **Supplier Portal**: Newly registered categories are available for vendor capability profiling. | Redis Cache invalidation via RabbitMQ event + HTTP `staleTime: 10s`. |
| **Admin Portal** | Admin updates Approval Rule Matrix (e.g. threshold > $10,000 requires CFO) | **Buyer Portal**: Next submitted PR dynamically evaluates the new rule and routes to the CFO task inbox. | **Supplier Portal**: N/A (Internal governance). | Rule Engine re-evaluates rules on every workflow instantiation. |
| **Buyer Portal** | Buyer releases Purchase Order to Supplier | **Admin Portal**: Audit log captures `PO_RELEASED` with actor ID and cryptographic timestamp. | **Supplier Portal**: Order appears instantly under Orders tab with unread notification badge. | Transactional outbox event `procurement.po.released` + WebSocket push. |
| **Supplier Portal**| Supplier clicks **Acknowledge Order** | **Buyer Portal**: PO status flips in real-time to `ACKNOWLEDGED`. Buyer can now receive goods. | **Admin Portal**: SLA timer records vendor turnaround time in supplier analytics scorecard. | Database status transition + WebSocket push to buyer channel. |
| **Supplier Portal**| Supplier dispatches ASN with courier tracking | **Buyer Portal**: ASN appears in warehouse dock intake (`/grn/scan`) ready for barcode receipt. | **Admin Portal**: Logistics tracking logs updated in system activity. | Direct entity relationship + event broadcast. |
| **Buyer Portal** | Buyer confirms Goods Receipt Note (GRN) | **Admin Portal**: Inventory intake and PO fulfillment percentages update in spend cube. | **Supplier Portal**: Delivered lines immediately unlock in `/invoices/new` for invoice creation. | `useEligibleInvoiceLines` SQL view join on accepted GRN quantities. |
| **Supplier Portal**| Supplier submits Official Tax Invoice | **Buyer Portal**: Invoice enters 3-Way Match engine. Matched invoices auto-approve immediately. | **Admin Portal**: Financial ledger records liability accrual. | PostgreSQL foreign key linkage + auto-reconciliation service. |
| **Supplier Portal**| Supplier raises Support Ticket regarding payment TDS | **Admin Portal**: Ticket appears in Service Desk with high priority and SLA countdown timer. | **Buyer Portal**: Linked finance officer sees ticket in assigned queue. | `TicketService` event broadcast across org channels. |

---

## 5. Verification & Testing Evidence

### Automated Test Suite Execution Summary
- **Playwright Live Browser E2E Suite**: **6/6 tests passing (100%)**
  1. `approver_and_admin_flows.spec.ts` (Approver PR inspections)
  2. `approver_and_admin_flows.spec.ts` (Admin master data & audit logs)
  3. `approver_and_admin_flows.spec.ts` (Live cross-portal Admin-to-Buyer ticket sync)
  4. `buyer_flows.spec.ts` (Buyer authentication and PR management)
  5. `full_procurement_cycle.spec.ts` (Complete multi-browser PR -> PO -> GRN -> Invoice -> Match -> Payment cycle in 5.9s)
  6. `supplier_flows.spec.ts` (Supplier portal dashboard and active POs)
- **Unit Test Suite**: **439/439 tests passing (100%)** in 10.34s
- **Integration Test Suite**: **83+ tests passing (100%)** including:
  - `test_cross_portal_synchronous_flow.py` (Full 5-stage synchronous cycle)
  - `test_end_to_end_connected_flow.py` (Maker-checker SoD, delegation, over-shipping guards)
  - `test_purchase_order_grn.py` (9/9 PO & GRN tests)
  - `test_invoice_payment.py` (10/10 3-way match, payment settlement, dispute tests)
  - `test_ticket_api.py` (12/12 support ticket lifecycle & SLA tests)
  - `test_master_data_router.py` (18/18 categories, locations, UOM, tax codes tests)
  - `test_requisition.py`, `test_rfq.py`, `test_contract.py` (34/34 tests)

---

## 6. Production Deployment Readiness Checklist

- [x] **Container Health**: All 17 Docker containers healthy with restart policies enabled.
- [x] **Zero Dead Code**: Pre-commit verified; no debug `console.log` or orphaned TODOs.
- [x] **Security & RBAC**: JWT RS256 token verification, httpOnly refresh cookie rotation, and granular permissions enforcement on every endpoint.
- [x] **Multi-Tenancy**: Organization ID scoping enforced across all database queries and Redis cache keys.
- [x] **Audit Integrity**: Cryptographic audit logging with Elasticsearch indexing active for compliance.
- [x] **Knowledge Graph**: AST graph verified and refreshed with `graphify update .` (10,521 nodes, 28,380 edges, 584 communities).
