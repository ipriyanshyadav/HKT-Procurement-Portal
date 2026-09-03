# SPEC_01_PROJECT_OVERVIEW.md

## Title
Enterprise Source-to-Pay (S2P) Procurement Portal — Project Overview

## Purpose
Define the full project scope, business objectives, non-functional requirements, deployment model, phased delivery plan, squad decomposition, sprint breakdown, and dependency build sequence for the S2P procurement portal.

## Scope
This specification covers system classification, operating models, module inventory, NFRs, deployment architecture, MVP and enterprise feature sets across three delivery phases, team structure, and sprint-level planning.

## Dependencies
None — this is the root specification. All other spec files depend on this document for scope boundaries and phasing context.

## Version
1.0

## Last Updated
2026-06-27

---

## 1. System Classification

This system is a **full Source-to-Pay (S2P)** procurement portal. It spans the entire procurement lifecycle from upstream sourcing through downstream payment:

| Lifecycle Stage | Coverage |
|---|---|
| **Source-to-Contract (S2C)** | Supplier discovery, onboarding, qualification, RFQ/eTender, bid management, evaluation, comparative statement, award recommendation, contract creation and execution |
| **Procure-to-Pay (P2P)** | Purchase requisition, purchase order, goods receipt / service entry, invoice processing, 3-way match, dispute management, payment tracking |
| **Supplier Relationship Management** | Vendor scorecard, compliance monitoring, blacklisting, performance analytics |
| **Analytics & Compliance** | Spend analytics, compliance reporting, audit trail, KPI dashboards |

The system is **not** limited to eSourcing-only or P2P-only — it unifies both under a single multi-tenant platform with shared master data, unified approval engine, and cross-module audit trail.

---

## 2. Operating Models Supported

The portal supports seven distinct procurement operating models. Tenant configuration determines which model is active; the platform enforces model-specific routing, approval chains, and visibility rules.

| # | Operating Model | Description | Key Configuration Levers |
|---|---|---|---|
| 1 | **Centralized** | Single procurement team handles all sourcing and purchasing across all BUs. | All PRs route to central buyer pool; single approval hierarchy; unified category management. |
| 2 | **Decentralized** | Each BU operates its own procurement function independently. | BU-scoped buyer assignment; BU-specific approval rules; BU-level budget controls; cross-BU visibility restricted to Procurement Head and above. |
| 3 | **Hybrid** | Central team manages strategic/high-value procurement; BUs handle operational/low-value purchases. | Value threshold and category-based routing; central team sees all; BU teams see own scope; dual approval paths. |
| 4 | **Shared Services** | Shared Services Center (SSC) processes transactional procurement (PO, GRN, invoice) while BUs own sourcing. | Handoff point at PO creation; SSC buyer pool for post-award; BU sourcing managers for pre-award; SSC-specific SLAs. |
| 5 | **Project-Based** | Procurement organized around projects with dedicated budgets, timelines, and project-specific approval chains. | Project entity linked to PRs and POs; project budget pool; project manager as additional approver; project-level spend tracking. |
| 6 | **Framework Agreement** | Long-term rate contracts established via sourcing; individual call-off POs raised against framework without re-tendering. | Contract-linked PO creation; price validation against framework rates; quantity tracking against framework limits; auto-renewal alerts. |
| 7 | **Direct Tendering** | Public or semi-public tender publication; open bidding with formal evaluation and award. | Public tender portal (supplier self-registration for specific tender); mandatory pre-qualification; formal bid opening with co-authorization; gazette-style publication. |

---

## 3. Module Inventory

The system comprises 22 primary modules, each with defined sub-modules:

### Module 1: Dashboard
- Buyer Dashboard (PR aging, RFQ status, pending approvals, KPI widgets)
- Supplier Dashboard (open invitations, active bids, PO status, payment status)
- Admin Dashboard (system health, unmapped PR queue, compliance alerts, user activity)
- Executive Dashboard (spend summary, savings, cycle time, compliance exceptions)

### Module 2: Organization Management
- Organization profile and configuration
- Legal entity management
- Business unit hierarchy
- Plant/location management
- Cost center management
- Department structure

### Module 3: User Management
- User CRUD with HRMS sync
- Role assignment with BU/category/plant scoping
- MFA enrollment and management
- Delegation rules (out-of-office, temporary authority)
- Conflict of Interest (COI) declarations
- Session management and forced logout

### Module 4: Master Data Management
- Category hierarchy (3-level, versioned)
- UOM master with conversion factors
- Currency master with exchange rates
- Payment terms with NPV factors
- Incoterms (2020)
- Tax codes with HSN mapping
- Delivery locations
- Document types and requirements
- Supplier categories with qualification checklists

### Module 5: Vendor Management
- Vendor invitation and self-registration
- Onboarding wizard (multi-step)
- Document collection and verification
- GST/PAN/CIN external API verification
- Bank account validation (penny test)
- Vendor qualification workflow
- Vendor activation and ERP sync
- Compliance document tracking and expiry
- Vendor scorecard (quarterly)
- Suspension, reinstatement, and blacklisting

### Module 6: Purchase Requisition
- Manual PR creation (portal)
- ERP import (REST API and batch file)
- Catalog-based PR
- Budget check (hard/soft)
- PR approval workflow
- PR merge and split
- PR aging alerts
- PR amendment

### Module 7: Unmapped PR Exception Management
- Unmapped field detection
- Exception queue with SLA tracking
- Auto-suggestion engine (rule-based, Phase 1; ML-based, Phase 3)
- Manual mapping with maker-checker
- Reprocessing pipeline
- Root cause analytics

### Module 8: Sourcing / RFQ Management
- RFQ creation wizard (9-step)
- Multi-lot RFQ support
- Bidder eligibility enforcement
- Timeline management with business day calculation
- RFQ publication and notification
- Clarification management (Q&A board)
- RFQ amendment with bid reset
- Emergency RFQ fast path
- Single-vendor controls
- RFQ cancellation

### Module 9: Bid Management
- Supplier bid portal (accept/regret invitation)
- Technical bid form (2-envelope process)
- Commercial bid form (line-by-line)
- Draft autosave (server-side, 30s interval)
- Bid submission with SHA-256 hashing
- Bid versioning (reopen/resubmit before deadline)
- Server-side deadline enforcement
- Bid sealing and encryption (Phase 2)
- Bid opening console with co-authorization
- Bid hash verification at opening

### Module 10: Evaluation & Comparative Statement
- Technical evaluation matrix
- Commercial evaluation with normalization
- Comparative statement generation engine
- Freight normalization
- Tax normalization with HSN-based rate validation
- Payment term NPV adjustment
- Bidder ranking (L1/L2/L3)
- Tie-breaking rules
- CS approval workflow
- CS PDF generation

### Module 11: Award Recommendation
- ARN generation from approved CS
- Award recommendation approval workflow
- Award notification to winner and non-winners
- Regret letter generation
- Award-to-contract trigger
- Award-to-PO trigger

### Module 12: Contract Management
- Contract creation from award
- Contract template system
- Contract workspace (obligations, documents, milestones)
- Contract approval workflow (multi-level with Legal)
- eSignature integration (Digio, DocuSign fallback)
- Contract amendment with versioning
- Compliance and milestone tracking
- Renewal and expiry alerts
- Contract repository with Elasticsearch
- PDF watermarking on download

### Module 13: Purchase Order
- PO generation from award/contract
- PO number generation (BU-scoped sequential)
- Price validation against awarded rates
- PO approval workflow
- ERP sync (push PO, receive ERP PO number)
- PO release to supplier (PDF + notification)
- Supplier PO acceptance/rejection
- PO amendment with re-approval
- Multi-delivery tracking (open quantity)

### Module 14: Goods Receipt / Service Entry
- GRN creation against PO lines
- Partial receipt support
- Quantity validation (GRN qty <= open PO qty)
- Over-receipt alerting
- Quality inspection gate (configurable per category)
- Service Entry Sheet (SES) for service POs
- GRN/SES approval workflow
- ERP sync

### Module 15: Invoice Management
- Supplier invoice submission (against GRN-posted lines)
- Duplicate detection (vendor_id + invoice_number)
- 3-way match engine (price, quantity, PO reference)
- Tax validation
- Match outcome handling (auto-approve matched, auto-dispute mismatched)
- Invoice approval workflow
- Dispute management with messaging thread
- Debit/credit note processing
- ERP posting

### Module 16: Payment Tracking
- Payment confirmation from ERP (webhook/batch)
- Payment record creation with UTR
- Supplier payment tracking screen
- Payment dispute (overdue + grace period)
- Payment analytics

### Module 17: Notification System
- RabbitMQ-based event-driven notifications
- Email (SendGrid), SMS (MSG91/Twilio), In-app (WebSocket/SSE)
- Notification template system (Jinja2, multi-language)
- User preference management
- Digest mode for non-critical notifications
- Critical notification override (cannot be muted)
- Notification logging and audit

### Module 18: Document Management
- MinIO-based object storage (8 buckets)
- Upload with magic-bytes validation
- ClamAV virus scanning
- SHA-256 document hashing
- Pre-signed URL generation with access control
- Document versioning
- Bid document sealing/encryption
- PDF watermarking (contracts)
- OCR extraction (Phase 2)
- Retention policy enforcement

### Module 19: Workflow Engine
- Pure Python async workflow engine
- JSONB-based workflow templates
- Sequential, parallel, and conditional steps
- SLA timer management (Celery)
- Escalation and delegation
- Maker-checker enforcement
- Workflow simulation (dry run)
- Admin intervention with compliance logging

### Module 20: Approval Rules Engine
- Rule builder with JSONB conditions
- Priority and specificity resolution
- Approval chain generation
- Rule versioning with effective dates
- In-flight transaction protection
- Simulation API
- Fallback path (PENDING_RULE_RESOLUTION)
- Rule change maker-checker

### Module 21: Integration Hub
- ERP adapter framework (SAP, Oracle, Generic REST)
- HRMS integration (user lifecycle sync)
- SSO (SAML 2.0, OIDC)
- Email provider (SendGrid)
- SMS provider (MSG91, Twilio)
- eSignature (Digio, DocuSign)
- Tax API (GST portal, NSDL)
- Bank validation (Razorpay penny test)
- Integration job tracking and retry
- Nightly reconciliation

### Module 22: System Administration
- Tenant settings management
- Feature flag management
- Audit log viewer (immutable, 7–10 year retention)
- System health monitoring
- Scheduled job management
- User activity reporting
- Data export and archival

---

## 4. Non-Functional Requirements

### 4.1 Availability
- **SLA Target:** 99.9% uptime (measured monthly, excluding planned maintenance windows)
- **Planned Maintenance Window:** Sunday 02:00–06:00 UTC (communicated 72h in advance)

### 4.2 Disaster Recovery
- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 1 hour
- **DR Strategy:** Cold standby K3s cluster with PostgreSQL WAL shipping; DNS failover via health-check-based TTL
- **DR Drills:** Monthly restore test, quarterly full DR exercise

### 4.3 Performance Targets

| Scenario | Target | Conditions |
|---|---|---|
| Buyer portal page load | < 2 seconds | 500 concurrent buyer sessions |
| Supplier bid submission | < 3 seconds | 1,000 concurrent bid submissions during peak close window |
| CS generation | < 5 seconds | 20-line RFQ, 10 bidders, full normalization |
| Bulk PR import | < 5 minutes | 1,000 PRs in single batch from ERP |
| Search results (Elasticsearch) | < 1 second | Full-text search across vendor/contract/document repositories |
| Approval action (approve/reject) | < 1 second | Single task action with workflow advancement |
| Report generation (Superset) | < 10 seconds | Standard KPI dashboard with 12-month data range |

### 4.4 Security
- OWASP Top 10 compliance — validated via annual penetration test and continuous SAST/DAST in CI
- AES-256 encryption at rest (PostgreSQL TDE via disk-level, MinIO server-side encryption)
- TLS 1.3 for all data in transit (internal service communication and external endpoints)
- Field-level encryption for PII (bank accounts, PAN, GSTIN) using Fernet symmetric encryption
- JWT RS256 with short-lived access tokens (15 min) and httpOnly refresh tokens (8 hours)
- Brute-force protection with progressive lockout
- File upload validation via magic bytes (not extension-only)
- ClamAV virus scanning on all uploads

### 4.5 Audit Retention

| Document Category | Retention Period |
|---|---|
| Financial transactions (invoices, payments, POs) | 10 years |
| Sourcing records (RFQs, bids, CS, awards) | 7 years |
| Contracts | 10 years post-expiry |
| Vendor records | 7 years post-deactivation |
| Audit logs | 10 years |
| User activity logs | 3 years |
| System logs (application/infrastructure) | 1 year |

### 4.6 Scalability
- Horizontal scaling of FastAPI instances behind Kong gateway
- Celery worker pool scales independently per queue
- PostgreSQL read replica for analytics workload isolation
- Redis Sentinel for cache HA
- RabbitMQ clustered with mirrored queues
- MinIO distributed mode with erasure coding

### 4.7 Compliance
- Segregation of Duties (SoD) enforced at API and DB constraint level
- Maker-checker on all financial and master data transactions
- Immutable audit log (DB trigger blocks UPDATE/DELETE)
- Bid integrity via cryptographic hashing and sealing
- No auto-approve under any circumstance

---

## 5. Deployment Model

### 5.1 Initial Deployment
- **Model:** Self-hosted, single-tenant deployment
- **Foundation:** `org_id` column on every table from day one, establishing multi-tenancy data isolation at the schema level even in single-tenant mode
- **Infrastructure:** K3s (lightweight Kubernetes) on bare-metal servers or cloud VMs (provider-agnostic)
- **Container Runtime:** Docker with K3s containerd

### 5.2 Multi-Tenancy Path
- Phase 1: Single tenant with `org_id` isolation (shared database, tenant-scoped queries)
- Phase 3: Full multi-tenant SaaS with tenant provisioning, per-tenant configuration, usage metering, and tenant data isolation validation

### 5.3 Environment Strategy

| Environment | Purpose | Infrastructure | Data Policy | Deploy Frequency |
|---|---|---|---|---|
| Local | Developer workstation | docker-compose (all services) | Seed data + factories | On save |
| Dev | Integration testing | Single K3s node | Anonymized production subset | On merge to `develop` |
| Staging/QA | UAT, performance testing, security scanning | 3-node K3s cluster (mirrors production topology) | Anonymized production clone | On merge to `main` |
| Production | Live system | 3+ node K3s cluster with HA | Production data | Manual trigger with approval gate |
| DR | Disaster recovery standby | 3-node K3s cluster (cold standby) | WAL-shipped replica | Automated WAL shipping; manual activation |

---

## 6. Phased Delivery Plan

### Phase 1 — MVP (Weeks 1–20)

**Objective:** Deliver a functional procurement portal covering core PR-to-PO flow with manual vendor onboarding and basic sourcing.

**Feature Set:**
- Manual organization setup (single tenant, BUs, plants, cost centers, categories)
- User management with role-based access (internal roles only)
- JWT authentication with RS256 (no SSO in Phase 1)
- Manual vendor onboarding (invite-based, portal registration form)
- Vendor qualification workflow (document upload, manual review, approval)
- Vendor activation (portal-only, no ERP sync in Phase 1)
- Purchase requisition creation (manual portal entry)
- PR approval workflow (sequential, rule-based)
- Basic RFQ creation (single-lot only)
- Bidder invitation and eligibility check
- Supplier bid submission (commercial only, no 2-envelope)
- Bid deadline enforcement (server-side)
- Bid opening (single-officer, no co-authorization)
- Basic comparative statement generation (price + freight normalization, no NPV)
- CS approval workflow
- Award recommendation (ARN) creation and approval
- PO generation from award
- PO approval workflow
- Basic GRN posting (full receipt only, no partial)
- Basic invoice submission by supplier
- 3-way match engine (price + quantity + PO reference)
- Invoice approval workflow
- Email notifications (SendGrid) for all critical events
- In-app notifications (WebSocket)
- Immutable audit log with DB trigger
- Per-role dashboard with key widgets
- Master data CRUD (all 12 entities, no ERP sync)
- Workflow engine (sequential and parallel steps, SLA timers)
- Approval rules engine (basic conditions, no versioning)
- Document upload with MinIO (no virus scan in Phase 1)
- Admin portal (user management, audit viewer, system settings)

### Phase 2 — Enterprise Integration (Weeks 20–36)

**Objective:** Add ERP integration, advanced sourcing features, contract management, and compliance hardening.

**Feature Set:**
- ERP integration adapter framework (SAP, Oracle, Generic REST)
- ERP PR import pipeline (REST API and batch)
- Unmapped PR exception management (detection, queue, manual mapping, reprocessing)
- ERP vendor sync (bidirectional)
- ERP PO sync (push PO, receive ERP PO number)
- ERP invoice posting
- Cryptographic bid sealing (AES-256-GCM per RFQ)
- Bid opening with co-authorization for high-value RFQs
- Bid hash verification at opening
- 2-envelope bidding (technical + commercial separation)
- Technical evaluation matrix
- Multi-lot RFQ support
- Payment term NPV normalization in CS
- Tax discrepancy detection (supplier-declared vs HSN master rate)
- Tie-breaking rules in CS ranking
- Contract workspace (creation, template system, obligations, milestones)
- Contract approval workflow with Legal review
- eSignature integration (Digio primary, DocuSign fallback)
- Contract amendment and versioning
- Contract compliance and renewal tracking
- Partial GRN and partial invoice support
- Quality inspection gate
- Service Entry Sheets (SES)
- Dispute management with messaging thread
- Debit/credit note processing
- HRMS integration (user lifecycle sync, termination-triggered session revocation)
- SSO (SAML 2.0 and OIDC)
- MFA enforcement for privileged roles
- Vendor compliance document expiry monitoring
- Vendor scorecard calculation (quarterly)
- Approval rule versioning with effective dates
- Rule change maker-checker with impact assessment
- ClamAV virus scanning on document upload
- PDF watermarking on contract download
- Elasticsearch integration (vendor search, contract repository)
- Spend analytics (Superset embedded dashboards)
- Compliance reports (emergency RFQ, single-vendor, force-approve logs)
- Notification digest mode
- SMS notifications (MSG91)
- Grafana dashboards and alerts
- Prometheus metrics
- Jaeger distributed tracing

### Phase 3 — Advanced (Weeks 36–52+)

**Objective:** Introduce advanced automation, AI-powered features, public tendering, mobile access, and multi-tenant SaaS.

**Feature Set:**
- eAuction module (reverse auction, Dutch auction, Japanese auction)
- ML-powered unmapped PR auto-suggestion (embedding-based semantic similarity)
- OCR document extraction (AWS Textract / Google Document AI)
- WhatsApp Business API integration for notifications
- Mobile application (React Native — buyer approval inbox, supplier bid submission)
- Multi-tenant SaaS provisioning (tenant onboarding, per-tenant configuration, usage metering)
- Tenant data isolation validation suite
- Advanced spend analytics (predictive spend, category intelligence)
- Supplier risk scoring (external data integration — D&B, credit agencies)
- Catalog management (punchout, hosted catalog)
- Budget management module (annual budget allocation, commitment tracking)
- Public tender portal (open registration per tender, gazette publication)
- Multi-currency PO and invoice with real-time conversion
- Advanced contract analytics (utilization rate, obligation compliance scoring)
- Microservices extraction for high-throughput modules (notification, analytics, integration)

---

## 7. Squad Decomposition

| Squad | Name | Ownership | Key Modules |
|---|---|---|---|
| **A** | Platform & Auth | Core platform, authentication, authorization, user management, master data, workflow engine, approval rules engine, audit logging | Modules 2, 3, 4, 19, 20, 22 |
| **B** | Sourcing & RFQ | RFQ lifecycle, bid management, evaluation, CS generation, award recommendation | Modules 8, 9, 10, 11 |
| **C** | Supplier Portal | Vendor management, supplier-facing portal, onboarding, compliance, scorecard | Module 5 (+ supplier views of Modules 9, 13, 15, 16) |
| **D** | Post-Award | Contract management, purchase orders, GRN/SES, invoices, payments, disputes | Modules 12, 13, 14, 15, 16 |
| **E** | Integration & Analytics | ERP adapters, HRMS sync, SSO, external APIs, notification system, document management, analytics, observability | Modules 6, 7, 17, 18, 20, 21, 25 (+ Module 1 dashboards) |

### Squad Staffing (Recommended per Squad)
- 1 Tech Lead / Senior Backend Engineer
- 2 Backend Engineers (Python/FastAPI)
- 1 Frontend Engineer (Next.js/TypeScript)
- 1 QA Engineer
- Shared: 1 DevOps Engineer across all squads, 1 DBA (part-time), 1 UI/UX Designer (part-time)

---

## 8. Sprint Breakdown (2-Week Sprints)

### Sprints 1–2 (Weeks 1–4): Foundation

**Squad A:**
- Project scaffolding: FastAPI application factory, directory structure, base models
- PostgreSQL schema: organizations, business_units, plants, cost_centers, departments, legal_entities
- Alembic setup with async env.py and naming convention
- JWT authentication (RS256 key pair, access + refresh token flow)
- User CRUD API with role assignment
- Permission model: roles, permissions, role_permissions tables and API
- RBAC middleware (FastAPI dependency chain)
- Audit log table with immutable trigger
- Redis session management
- Kong gateway setup (JWT plugin, rate limiting, CORS)

**Squad B:**
- RFQ data model: rfqs, rfq_lots, rfq_lines, rfq_participants
- Bid data model: bid_responses, bid_line_responses, bid_versions
- Evaluation data model: evaluations, evaluation_scores, comparative_statements, cs_line_rankings

**Squad C:**
- Vendor data model: vendors, vendor_contacts, vendor_documents, vendor_bank_accounts, vendor_category_mappings
- Vendor invitation API (tokenized link generation)
- Supplier portal authentication (separate JWT consumer in Kong)

**Squad D:**
- Contract data model: contracts, contract_lines, contract_documents, contract_amendments, contract_milestones
- PO data model: purchase_orders, po_lines, po_amendments
- Invoice data model: invoices, invoice_lines, invoice_match_results

**Squad E:**
- Docker and docker-compose setup for local development (all services)
- MinIO bucket creation and policy setup
- RabbitMQ vhost, exchange, and queue topology setup
- Celery worker scaffold with queue routing
- Loguru configuration and structured logging
- Notification data model: notifications, notification_preferences, notification_templates

### Sprints 3–4 (Weeks 5–8): Core Procurement

**Squad A:**
- Workflow engine core: `WorkflowEngine` class with `instantiate`, `advance`, `cancel`
- Workflow template JSONB schema and validation
- SLA timer Celery task (`check_workflow_sla_timers`)
- Approval rules engine: `ApprovalRulesEngine.resolve_chain()` with condition evaluation
- Master data CRUD APIs (category, UOM, currency, payment terms, incoterms, tax codes, delivery locations)
- Maker-checker enforcement for master data changes
- Delegation rules API

**Squad B:**
- RFQ creation wizard API (9-step draft flow)
- RFQ submission and approval workflow integration
- Bidder invitation and eligibility check API
- Timeline validation with business day calculation

**Squad C:**
- Vendor registration form API (multi-step)
- Vendor document upload and linking
- Vendor qualification workflow integration
- Vendor state machine implementation (all 11 states, transitions, validations)

**Squad D:**
- PR data model: requisitions, requisition_lines
- PR creation API (manual portal)
- PR approval workflow integration
- Budget check implementation (SELECT FOR UPDATE)

**Squad E:**
- Email notification service (SendGrid integration)
- Notification event handlers (first 10 critical events)
- Document upload API with MinIO storage
- Pre-signed URL generation with access control
- Health check endpoints (`/health`, `/health/ready`, `/health/live`)

### Sprints 5–8 (Weeks 9–16): Sourcing & Post-Award

**Squad A:**
- Parallel and conditional workflow steps
- Escalation resolution logic
- Maker-checker enforcement in workflow engine
- Approval rule priority and specificity resolution
- Workflow simulation (DRY_RUN mode)
- User BU/category/plant scope enforcement in all queries

**Squad B:**
- Supplier bid submission API (commercial bid form)
- Bid draft autosave (server-side, 30s)
- Bid submission with SHA-256 hashing
- Bid versioning (reopen/resubmit)
- Server-side deadline enforcement
- Bid opening console API (single-officer)
- Technical evaluation matrix API
- CS generation engine (price + freight normalization)
- CS ranking with L1/L2/L3
- CS approval workflow
- ARN generation and approval

**Squad C:**
- Supplier bid portal (invitation inbox, accept/regret, bid form)
- Supplier dashboard (open invitations, active bids, deadlines)
- Vendor activation workflow completion
- Vendor compliance document tracking

**Squad D:**
- PO generation from award
- PO number generation (BU-scoped sequential)
- PO approval workflow
- PO release to supplier (PDF generation + notification)
- Basic GRN posting API
- Invoice submission API (supplier-facing)
- 3-way match engine
- Invoice approval workflow
- Contract creation from award (basic)

**Squad E:**
- WebSocket notification endpoint
- Redis pub/sub for cross-instance notification delivery
- Notification preference management API
- Document versioning
- PR aging Celery task
- Celery Beat schedule for all Phase 1 recurring jobs
- OpenTelemetry instrumentation (FastAPI, SQLAlchemy, Redis)
- Prometheus metrics endpoint

### Sprints 9–10 (Weeks 17–20): QA, UAT, Go-Live

**All Squads:**
- Integration testing across all module boundaries
- Workflow regression suite (all 10 workflow types)
- API contract tests for every endpoint
- Security testing (IDOR, permission boundary, JWT manipulation, SQL injection, file upload bypass)
- Audit validation test suite
- Performance testing (K6 scripts for 5 critical scenarios)
- Bug triage and fix sprints
- UAT with pilot users
- Production K3s cluster setup
- Kong production configuration
- Monitoring stack deployment (Prometheus, Grafana, Loki, Jaeger, Uptime Kuma)
- Production data migration scripts (if migrating from legacy)
- Go-live checklist execution
- Post-go-live monitoring (48h war room)

---

## 9. Dependency Build Sequence (DAG)

```
Level 0 (No Dependencies):
  ├── PostgreSQL Schema + Alembic Setup
  ├── Redis Setup
  ├── RabbitMQ Topology Setup
  ├── MinIO Bucket Setup
  ├── Kong Gateway Setup
  └── Docker / K3s Infrastructure

Level 1 (Depends on Level 0):
  ├── Organization + Master Data Models
  ├── User + Auth Models
  ├── Audit Log (table + trigger)
  └── Outbox Pattern (table + publisher worker)

Level 2 (Depends on Level 1):
  ├── JWT Auth + RBAC Middleware
  ├── Master Data CRUD APIs
  ├── Notification Templates + Preferences
  └── Document Management (upload, storage, access control)

Level 3 (Depends on Level 2):
  ├── Workflow Engine Core
  ├── Approval Rules Engine Core
  ├── Vendor Management (invitation, registration, state machine)
  └── Notification Service (email, in-app)

Level 4 (Depends on Level 3):
  ├── Purchase Requisition (creation, approval workflow)
  ├── Vendor Qualification Workflow
  └── Delegation + Escalation Logic

Level 5 (Depends on Level 4):
  ├── RFQ Creation + Approval
  ├── Bidder Invitation + Eligibility
  ├── PR Merge/Split
  └── Budget Check Integration

Level 6 (Depends on Level 5):
  ├── Bid Submission + Hashing
  ├── Bid Deadline Enforcement
  ├── Clarification Management
  └── RFQ Amendment Flow

Level 7 (Depends on Level 6):
  ├── Bid Opening Console
  ├── Technical Evaluation
  └── Bid Versioning

Level 8 (Depends on Level 7):
  ├── CS Generation Engine
  ├── CS Ranking + Tie-Breaking
  └── CS Approval Workflow

Level 9 (Depends on Level 8):
  ├── Award Recommendation (ARN)
  ├── Award Notification
  └── Contract Creation (from award)

Level 10 (Depends on Level 9):
  ├── PO Generation (from award/contract)
  ├── PO Approval + Release
  └── Contract Workspace

Level 11 (Depends on Level 10):
  ├── GRN / SES Posting
  ├── PO Amendment
  ├── Contract Amendment
  └── Quality Inspection Gate

Level 12 (Depends on Level 11):
  ├── Invoice Submission
  ├── 3-Way Match Engine
  ├── Invoice Approval
  └── Dispute Management

Level 13 (Depends on Level 12):
  ├── Payment Tracking
  ├── Debit/Credit Notes
  └── ERP Integration (all entities)

Level 14 (Depends on Level 13):
  ├── Analytics Materialized Views
  ├── Superset Dashboards
  ├── Compliance Reports
  └── Spend Analytics

Level 15 (Cross-Cutting — Parallel with Levels 3–14):
  ├── Observability Stack (Prometheus, Grafana, Loki, Jaeger)
  ├── CI/CD Pipeline (GitHub Actions)
  ├── Security Hardening (CSP headers, rate limiting, brute-force protection)
  ├── ClamAV Integration
  └── Elasticsearch Integration
```

---

## 10. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| ERP integration delays (API access, documentation gaps) | Phase 2 timeline slip | High | Start ERP adapter development with mock APIs in Phase 1; parallel track for ERP API access negotiation |
| Bid sealing complexity (key management, co-authorization UX) | Phase 2 sourcing delivery | Medium | Phase 1 uses hash-only integrity; sealing deferred to Phase 2 with dedicated spike in Sprint 7 |
| Approval rule complexity (edge cases in rule priority resolution) | Incorrect approval routing | Medium | Comprehensive simulation test suite; mandatory rule testing matrix before activation |
| Performance under load (1000 concurrent bids at deadline) | Supplier experience degradation | Medium | K6 load testing from Sprint 9; Redis-backed rate smoothing; horizontal FastAPI scaling |
| Vendor adoption (suppliers unwilling to use portal) | Low bid participation rates | High | Supplier portal UX prioritized; email fallback for document submission; WhatsApp notifications in Phase 3 |
| Regulatory changes (GST rate changes, compliance requirements) | Tax calculation accuracy | Medium | Tax codes with effective dates; HSN master maintained as reference data; quarterly compliance review |

---

## 11. Success Criteria

### Phase 1 Go-Live
- All 500 active buyers can create PRs and process through PO
- Minimum 50 vendors onboarded and active
- At least 10 RFQs completed end-to-end (PR → RFQ → Bid → CS → Award → PO)
- Approval workflows functioning for all Phase 1 entity types
- Audit log capturing all state-changing operations
- 99.9% uptime over first 30 days post-launch
- All critical notifications delivered within 60 seconds

### Phase 2 Completion
- ERP integration operational for PR import, vendor sync, PO sync, invoice posting
- Bid sealing and co-authorized opening functional for high-value RFQs
- Contract workspace in use for all awards above contract threshold
- Unmapped PR resolution SLA met (< 8h average)
- Spend analytics dashboards available to executive stakeholders

## Project Governance

### PART 0 – Session Bootstrap (Mandatory)

> **⚠️ PERMANENT RULE — READ BEFORE ANYTHING ELSE**
> Every Antigravity CLI session must start by:
>
> 1. Reading the entire `GEMINI.md` file top‑to‑bottom.
> 2. Loading and studying the current `project_graph.json` (or using the manual fallback protocol).
> 3. Cross‑referencing the Graphify graph against the relevant SPEC files.
> 4. Only after these steps can you begin the Implementation Loop (STEP 1 – PLAN).

### PART 1 – Immutable Tech Stack

*(see the table in the next section for the exact stack)*

### PART 2 – Five Immutable Foundational Rules

| # | Rule |
|---|------|
| 1 | **org_id EVERYWHERE** – every table must contain `org_id UUID NOT NULL REFERENCES organizations(id)` and every query must filter on `org_id`.
| 2 | **NO AUTO‑APPROVE** – SLA breaches must be escalated to a human; never auto‑approve.
| 3 | **IMMUTABLE AUDIT LOG** – `audit_logs` is INSERT‑only; updates/deletes are blocked by a trigger.
| 4 | **MAKER‑CHECKER ENFORCEMENT** – the creator/submitter cannot approve the same entity.
| 5 | **BID DATA SEALED PRE‑OPENING** – bid content inaccessible via API before the `BID_OPENED` state.

### PART 3 – Implementation Loop (7‑Step Cycle)

```
STEP 1: PLAN – verify bootstrap, read SPEC, load Graphify, list impacted nodes, run `graphify check --before-change`.
STEP 2: IMPLEMENT – DB model → migration → repo → service → router → Celery tasks (backend) and Types → hooks → component → page (frontend).
STEP 3: TEST – backend unit & integration tests; all must pass.
STEP 4: TEST – frontend unit & E2E tests; all must pass.
STEP 5: INTEGRATE – spin up all services, run contract tests, verify traces & logs.
STEP 6: REGRESSION – full test suite, coverage must not drop.
STEP 7: GRAPHIFY – `graphify update`, `graphify check --integrity`, commit graph diff.
```

### PART 4 – Graphify Protocol

- **Before any change**: `graphify check --before-change`.
- **After implementing** a function/endpoint: `graphify update`.
- **After a feature**: `graphify update && graphify check --integrity && graphify diff > graphify_diff_$(date +%Y%m%d_%H%M%S).txt`.
- **Node schema** must include id, type, name, module, file_path, line_number, status, spec_reference, test_file, test_status, last_verified, calls, called_by, publishes_events, consumes_events, db_tables_read, db_tables_written, frontend_components, last_modified_commit.

---

## Technical Stack

| Layer | Technology | Exact Package |
|---|---|---|
| Language | Python 3.14+ | — |
| Framework | FastAPI 0.115+ | `fastapi`, `uvicorn[standard]` |
| ORM | SQLAlchemy 2.0+ (async) | `sqlalchemy[asyncio]`, `asyncpg` |
| Migrations | Alembic | `alembic` |
| Task Queue | Celery 5+ | `celery[rabbitmq]` |
| Message Broker | RabbitMQ 3.13+ | `aio-pika` |
| Database | PostgreSQL 16+ | `asyncpg` |
| Cache | Redis 7+ | `redis[hiredis]` |
| Object Storage | MinIO | `minio`, `boto3` |
| Search (default) | PostgreSQL full‑text + `pg_trgm` | built‑in, `pg_trgm` |
| Search (deferred) | Elasticsearch 8+ | `elasticsearch[async]` |
| API Gateway | Kong OSS 3.6+ | Declarative config |
| Logs | Loguru | `loguru` |
| Log Aggregation | Grafana Loki via Promtail | — |
| Metrics | Prometheus + Grafana | `prometheus-fastapi-instrumentator` |
| Tracing | Jaeger via OpenTelemetry | `opentelemetry-sdk`, `opentelemetry-exporter-otlp` |
| Containers | Docker + K3s | — |
| Frontend | Next.js 14+ (App Router), TypeScript | `next`, `typescript` |
| State | TanStack Query + Zustand | `@tanstack/react-query`, `zustand` |
| UI | Radix UI + Tailwind CSS | `@radix-ui/*`, `tailwindcss` |
| FE Validation | React Hook Form + Zod | `react-hook-form`, `zod` |
| BE Validation | Pydantic v2 | `pydantic[email]` |

---

## Compliance Rules

The following five immutable rules **must be enforced in every line of code**:

1. **`org_id` EVERYWHERE** – every table includes `org_id` and every query scopes by it.
2. **NO AUTO‑APPROVE** – SLA breaches trigger escalation, never auto‑approval.
3. **IMMUTABLE AUDIT LOG** – only INSERTs via the `audit_writer` role; triggers block UPDATE/DELETE.
4. **MAKER‑CHECKER ENFORCEMENT** – creator cannot approve their own entity; enforced in API dependencies and workflow engine.
5. **BID DATA SEALED PRE‑OPENING** – bid tables inaccessible before `BID_OPENED`; permission is permanently `False`.

---

## Development Process (Appendix)

### 1. Implementation Loop
*(see the **Project Governance** section for the full 7‑step cycle)*

### 2. Regression Protection (Part 7)
- Run full backend suite: `pytest tests/ -v --cov=app`.
- Run full frontend suite: `pnpm test --all-projects`.
- Coverage must be ≥ 80 % overall and ≥ 95 % for the rules engine.
- No test failures or skips are permitted.

### 3. Error Loop (Part 10)
```
ERROR DETECTED → LOG → ISOLATE → TRACE → IDENTIFY ROOT CAUSE → FIX → VERIFY FIX → REGRESSION CHECK → GRAPHIFY UPDATE → CONTINUE LOOP
```
All steps must be completed before the feature is considered done.

### 4. Commit Standards (Part 12)
```
{type}({scope}): {description}

{body – what changed and why}

Tests: {test files added/modified}
Graphify: {nodes added/modified/deprecated}
Spec: {SPEC_XX — Section Y.Z}
Breaking: {YES/NO – if YES, list what breaks}
```
Use conventional prefixes (`feat`, `fix`, `test`, `migration`, `config`, `docs`, `security`).

---

## Expanded Security NFR

| Requirement | Description |
|---|---|
| **PII Masking** | Never log raw PII; log masked values (e.g., `email[:3]***@***`). |
| **Secret Handling** | Secrets live only in Kubernetes Secrets (sealed) or environment variables; never committed to repo. |
| **Logging Restrictions** | Do not log passwords, JWTs, tokens, or any credential. |
| **Upload Validation** | All file uploads must pass magic‑byte validation **and** ClamAV scan before processing. |
| **JWT Validation** | Validate JWT at Kong gateway **and** in FastAPI middleware (defense‑in‑depth). |
| **Transport Security** | All communication uses TLS 1.3; internal service‑to‑service calls use mTLS where possible. |
| **OWASP Top 10** | Full compliance verified via annual penetration testing and CI SAST/DAST. |

---

## Observability Verification Checklist

1. **Loguru** – search logs for `"action": "<feature_action>"` and confirm structured JSON with `trace_id`, `org_id`, `user_id`.
2. **Jaeger** – open Jaeger UI, locate the trace for the feature request, verify spans for FastAPI, DB queries, Redis calls, RabbitMQ publishes, and no broken spans.
3. **Prometheus** – `curl http://localhost:8000/metrics | grep <feature_metric>` – ensure counters increment and histograms record latency.
4. **Grafana Alerts** – trigger the alert condition (e.g., SLA breach) and confirm alert fires within the configured `for` duration and notification is received.
5. **Loki** – query logs via Grafana Loki to ensure audit entries are present and contain required fields.

---

## Refined Module Build Order

*(mirrors GEMINI Part 14 – exact sequence)*

**Phase 1 – Foundation (Sprints 1‑4)**
1. DB schema + Alembic setup + `org_id` framework
2. Auth module (JWT, password, refresh, MFA)
3. Organization master (BU, Plant, Cost Center) + CRUD
4. Master data (Category, UOM, Currency, Payment Terms, Incoterms, Tax Codes)
5. User management (CRUD, roles, permissions, RBAC)
6. Approval Rules Engine (builder, evaluator, simulation)
7. Workflow Engine (templates, instances, tasks, SLA timers)

**Phase 2 – Core Procurement (Sprints 5‑8)**
8. Vendor management (invite, onboard, qualify, activate, state machine)
9. Purchase Requisition (create, approve, buyer assignment)
10. Unmapped PR queue (detection, manual mapping, reprocessing)
11. Supplier portal – registration and invitation

**Phase 3 – Sourcing (Sprints 9‑12)**
12. RFQ lifecycle (wizard, approval, publication)
13. Bid management (submission, draft save, hash)
14. Bid opening console
15. Technical evaluation
16. Comparative statement + CS approval
17. Award Recommendation Note

**Phase 4 – Post‑Award (Sprints 13‑16)**
18. Purchase Order (generation, approval, release)
19. GRN / SES (goods receipt, service entry)
20. Invoice submission + 3‑way match
21. Notifications (all channels, templates, retry)
22. Analytics dashboard (materialized views, Superset)

---

## Quick Reference Card

```
# Graphify commands
graphify check --before-change
graphify update
graphify check --integrity
graphify diff > graphify_diff_$(date +%Y%m%d_%H%M%S).txt

# Test commands
pytest tests/ -v --cov=app
pnpm test --all-projects
pnpm test:integration   # FE ↔ BE contract tests

# Compliance checks
# 1. Verify five foundational rules are enforced in code reviews.
# 2. Run `grep -R "org_id" app/` to ensure every table/query includes org_id.
# 3. Ensure audit inserts are present before state changes.
# 4. Validate no auto‑approve logic exists (`git grep "auto_approve"`).
# 5. Confirm bid tables are protected (`git grep "view_bids_before_opening"`).
# 6. Run `graphify check --integrity` after each change to verify graph integrity.
# 7. Ensure backend directory structure matches GEMINI Part 5 (core, db, events, tasks, modules).
# 8. Verify frontend follows guidelines: Next.js 14, TanStack Query, Radix UI, Tailwind CSS.
# 9. Confirm observability: Loguru logs, Jaeger traces, Prometheus metrics, Grafana alerts.
```

---

*End of added governance and compliance sections.*

## Backend Implementation Guidelines

- **Directory Structure** – Follow the mandatory layout under `app/` (see GEMINI Part 5). Key sub‑directories: `core/`, `db/`, `events/`, `tasks/`, `modules/{module_name}/`.
- **Async FastAPI Endpoints** – All routes must be declared with `async def` and use `AsyncSession` for database access.
- **Service Layer** – Business logic lives in `service.py`; it must accept `org_id: UUID` and `current_user: User`. No direct DB queries here.
- **Repository Layer** – `repository.py` contains only SQLAlchemy async queries. Every query includes `WHERE org_id = :org_id`.
- **Outbox Pattern** – State‑changing actions write an audit entry, update the entity, and insert an event into the `outbox` table within a single transaction. Celery workers read the outbox and publish to RabbitMQ.
- **Logging** – Use Loguru with the standard extra fields (`action`, `org_id`, `user_id`, `trace_id`, …) as described in the Project Governance section.
- **Testing** – Unit tests for services/repositories (`tests/unit/<module>/`), integration tests for routers (`tests/integration/<module>/`), and workflow/security tests where applicable. All must pass before proceeding.

## Frontend Implementation Guidelines

- **Framework** – Next.js 14 with the App Router, TypeScript for type safety.
- **State Management** – TanStack Query for data fetching / caching; Zustand for global UI state.
- **UI Library** – Radix UI components styled with Tailwind CSS, following the design system (colors, typography, micro‑animations).
- **API Types** – Generate TypeScript types from the OpenAPI schema (`pnpm run generate-types`). Keep them in `packages/types/src/api.ts`.
- **Hooks** – For each backend endpoint create a TanStack Query hook (e.g., `useCreateRFQ`, `useGetRFQs`) in `packages/hooks/src/`.
- **Components** – Every data‑fetching component must implement loading skeletons, error boundaries, and empty states. Forms use React Hook Form with Zod schemas.
- **Testing** – Component unit tests with React Testing Library, E2E tests with Playwright (`pnpm test:e2e`). Contract tests (`pnpm test:integration`) ensure FE ↔ BE compatibility.
- **Observability** – Frontend errors report to a centralized logging endpoint with a `trace_id` to correlate with backend logs.

---

*End of specification.*
