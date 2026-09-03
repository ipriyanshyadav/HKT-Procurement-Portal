# Graph Report - procurement-portal  (2026-09-04)

## Corpus Check
- 244 files · ~138,926 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1520 nodes · 1989 edges · 206 communities (85 shown, 83 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 73 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9f4377ba`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Generic Finite State Machine Orchestrator
- Bid Service
- Notification Architecture
- Master Data Twelve Entities Registry
- K3s Kubernetes Cluster Topology
- GEMINI Project Rules and Onboarding
- Modular Monolith Architecture
- Complete API Endpoint Index
- schemas.py
- Async Workflow State Machine Engine
- Vendor Management Service
- Contract Workspace
- Document Management Service
- Purchase Requisition Service
- Procurement Analytics Service
- Category Hierarchy Service
- Approval Rules Engine Service
- Document Upload Pipeline
- PostgreSQL Shared-Database Multi-Tenancy
- PermissionCode
- GRN Linkage and Invoice Eligibility
- Testing Framework and Tooling
- Graphify Agent Rules
- Standard API Response Envelope
- ERP Adapter Base Interface
- GitHub Actions CI/CD Pipeline
- Grafana Alert Rules Suite
- RFC 8594 Sunset & Deprecation Headers
- React Error Boundary
- Partitioned Celery Worker Deployments
- OpenTelemetry Distributed Tracing
- k6 Performance & Load Baselines
- OWASP Top 10 Automated Security Suite
- Exchange Rates Sync Celery Task
- Soft Delete Pattern via deleted_at
- Security Headers Middleware
- Debit and Credit Notes
- Core Web Vitals Performance Targets
- WCAG 2.1 AA Accessibility Standards
- HRMS Employee Lifecycle Integration
- SSO SAML and OIDC Integration
- Uptime Kuma Synthetic Monitors
- Audit Immutability Validation Tests
- Security Test Checklist
- test_responses.py
- dependencies
- dependencies
- dependencies
- RedisKeys
- ui/package.json
- pipeline
- AppException
- compilerOptions
- hooks/package.json
- scripts
- compilerOptions
- stores/package.json
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- main.py
- types/package.json
- admin-portal/tsconfig.json
- buyer-portal/tsconfig.json
- supplier-portal/tsconfig.json
- utils/package.json
- .dispatch
- Plan Spec 04: Auth & Security
- Plan Spec 08: Purchase Requisition
- Sourcing Service
- Evaluation Service
- Implementation Prompts All Modules
- config/package.json
- RFQ Creation Wizard
- Turborepo Monorepo Architecture
- utils/src/api.ts
- Comparative Statement Engine
- .publish
- Frontend Backend Wiring Guide
- SPEC AUDIT REPORT — SPEC_01 + SPEC_02
- Plan Spec 07: Vendor Management
- authStore.ts
- Request
- Plan Spec 01: Project Overview & Governance
- types/src/api.ts
- admin/router.py
- analytics/router.py
- approval_rules/router.py
- award/router.py
- bid/router.py
- contract/router.py
- document/router.py
- evaluation/router.py
- grn/router.py
- health
- invoice/router.py
- master_data/router.py
- health
- organization/router.py
- payment/router.py
- purchase_order/router.py
- requisition/router.py
- sourcing/router.py
- unmapped_pr/router.py
- user/router.py
- vendor/router.py
- workflow/router.py
- generate.ts
- ui/src/index.ts
- minio_setup.py
- auth/router.py
- core/__init__.py
- events/__init__.py
- app/__init__.py
- admin/__init__.py
- analytics/__init__.py
- approval_rules/__init__.py
- audit/__init__.py
- award/__init__.py
- bid/__init__.py
- contract/__init__.py
- document/__init__.py
- evaluation/__init__.py
- grn/__init__.py
- adapters/__init__.py
- integration/router.py
- invoice/__init__.py
- master_data/__init__.py
- channels/__init__.py
- notification/router.py
- organization/__init__.py
- payment/__init__.py
- purchase_order/__init__.py
- requisition/__init__.py
- sourcing/__init__.py
- unmapped_pr/__init__.py
- user/__init__.py
- vendor/__init__.py
- modules/workflow/__init__.py
- entrypoint.sh
- admin-portal/next.config.js
- buyer-portal/next.config.js
- supplier-portal/next.config.js
- tailwind.config.ts
- procurement-portal
- Base
- enums.py
- BaseModel
- test_all_models.py
- config.py
- user/models.py
- test_migrations.py
- asyncio
- test_grn_and_invoice_models
- workflow/models.py
- Procurement Portal — Enterprise S2C & P2P Platform
- 2. Requirement-by-Requirement Traceability
- evaluation/models.py
- vendor/models.py
- contract/models.py
- sourcing/models.py
- env.py
- organization/models.py
- session.py
- 0002_create_enums.py
- 0024_indexes.py
- 0027_data_seed.py

## God Nodes (most connected - your core abstractions)
1. `BaseModel` - 109 edges
2. `BaseEvent` - 49 edges
3. `Base` - 38 edges
4. `RedisKeys` - 33 edges
5. `AppException` - 21 edges
6. `Implementation Prompts All Modules` - 18 edges
7. `compilerOptions` - 16 edges
8. `test_user_models()` - 13 edges
9. `Purchase Requisition Service` - 13 edges
10. `test_master_data_models()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `test_permanently_denied_permissions()` --uses--> `PermissionCode`  [INFERRED]
  tests/unit/test_config.py → app/core/constants.py
- `Generic Finite State Machine Orchestrator` --conceptually_related_to--> `FSM State Synchronization Pattern`  [INFERRED]
  plans/plan_spec_05_workflow_engine.md → FRONTEND_BACKEND_WIRING_GUIDE.md
- `seed_data()` --uses--> `PermissionCode`  [INFERRED]
  scripts/seed_master_data.py → app/core/constants.py
- `test_permission_code_attributes()` --uses--> `PermissionCode`  [INFERRED]
  tests/unit/test_constants.py → app/core/constants.py
- `SampleModel` --inherits--> `BaseModel`  [EXTRACTED]
  tests/unit/test_base_model.py → app/db/base.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Core Platform Governance and Architectural Discipline** — gemini_layer_discipline_architecture, gemini_no_hardcoded_data_rule, frontend_backend_wiring_guide_types_first_contract_principle, plans_plan_spec_02_architecture_clean_layered_architecture [EXTRACTED 1.00]
- **End-to-End Requisition Approval & Notification Pipeline** — specs_spec_08_purchase_requisition_requisitionservice, specs_spec_06_approval_rules_engine_approvalrulesengine, specs_spec_05_workflow_engine_workflowengine, plans_plan_spec_16_notification_notificationservice [EXTRACTED 1.00]
- **Source-to-Pay Transaction Execution Pipeline** — specs_spec_10_rfq_lifecycle_sourcing_service, specs_spec_11_bid_management_bid_service, specs_spec_12_comparative_statement_evaluation_service, specs_spec_14_purchase_order_prefill_from_award, specs_spec_15_invoice_payment_three_way_match_engine [EXTRACTED 1.00]
- **Vendor Onboarding Compliance Verification Flow** — specs_spec_07_vendor_management_vendorservice, specs_spec_07_vendor_management_pan_gst_verification, specs_spec_07_vendor_management_bank_penny_test, specs_spec_07_vendor_management_duplicate_detection [EXTRACTED 1.00]
- **Downstream Award Contract Fulfillment and Settlement Flow** — plans_plan_spec_12_comparative_statement_multi_factor_scoring_engine, plans_plan_spec_13_contract_management_contract_lifecycle_fsm, plans_plan_spec_14_purchase_order_po_lifecycle_fsm, plans_plan_spec_15_invoice_payment_three_way_matching_engine [EXTRACTED 1.00]
- **Upstream Requisition to Comparative Evaluation Flow** — plans_plan_spec_08_purchase_requisition_pr_lifecycle_fsm, plans_plan_spec_10_rfq_lifecycle_rfq_state_machine, plans_plan_spec_11_bid_management_sealed_bid_cryptographic_vault, plans_plan_spec_12_comparative_statement_multi_factor_scoring_engine [EXTRACTED 1.00]
- **Observability, Alerting and Analytics Pipeline** — specs_spec_21_infrastructure_k3s_cluster_topology, specs_spec_22_observability_prometheus_custom_metrics, specs_spec_22_observability_grafana_alert_rules, specs_spec_22_observability_uptime_kuma_monitors, specs_spec_25_analytics_materialized_views_suite [INFERRED 0.85]
- **Cryptographic Sealing and Data Integrity Architecture** — specs_spec_10_rfq_lifecycle_bid_sealing_service, specs_spec_11_bid_management_bid_sha256_hash_integrity, specs_spec_17_document_management_clamav_virus_scanner, specs_spec_17_document_management_bid_document_sealing, specs_spec_23_testing_audit_validation_tests [INFERRED 0.95]
- **Defense-in-Depth & Zero-Trust Security Architecture** — specs_spec_04_auth_security_auth_pipeline, specs_spec_04_auth_security_sod_enforcement, plans_plan_spec_20_integration_safehttpclient, plans_plan_spec_21_infrastructure_networkpolicies, plans_plan_spec_17_document_management_documentscanner [INFERRED 0.95]

## Communities (206 total, 83 thin omitted)

### Community 0 - "Generic Finite State Machine Orchestrator"
Cohesion: 0.20
Nodes (12): Plan Spec 05: Workflow Engine, Generic Finite State Machine Orchestrator, Quorum Approval Convergence, Safe Expression Evaluation via simpleeval, Plan Spec 13: Contract Management, Contract Lifecycle FSM, Contract Milestone & SLA Monitoring, Purchase Order Lifecycle FSM (+4 more)

### Community 1 - "Bid Service"
Cohesion: 0.18
Nodes (11): Bid Sealing Service, Bid Opening Co-Authorization, Bid Opening Console, Bid Reopen and Versioning, Bid Service, Commercial Bid Schema, Server-Side Deadline Enforcement, Supplier Bid Portal Flow (+3 more)

### Community 2 - "Notification Architecture"
Cohesion: 0.18
Nodes (11): Critical Notifications Policy, Notification Digest Mode, Email Channel SendGrid, Notification Architecture, Notification Events Registry, Notification Preference Management, SMS Channel MSG91 and Twilio, SPEC 16 Notification System Specification (+3 more)

### Community 3 - "Master Data Twelve Entities Registry"
Cohesion: 0.08
Nodes (25): PO ERP Sync, PO Release to Supplier, Supplier PO Acceptance Flow, Dispute Management Service, Duplicate Invoice Detection, ERP Invoice Posting, Invoice Approval Workflow, Match Outcome Handling (+17 more)

### Community 4 - "K3s Kubernetes Cluster Topology"
Cohesion: 0.09
Nodes (23): Disaster Recovery Strategy, K3s Kubernetes Cluster Topology, K3s Helm and Manifest Structure, Kong API Gateway Deployment, MinIO Distributed 4-Node Cluster, Patroni PostgreSQL HA Cluster, RabbitMQ Mirrored Cluster HA, Redis Sentinel HA (+15 more)

### Community 5 - "GEMINI Project Rules and Onboarding"
Cohesion: 0.14
Nodes (16): GEMINI Project Rules and Onboarding, Layer Discipline Architecture, Migration Safety Protocol, Zero Hardcoded Data Rule, Six-Step Implementation Loop, Plan Apple Design System and Liquid Glass, Apple Design System Philosophy, Fluid Spring Motion and Transitions (+8 more)

### Community 6 - "Modular Monolith Architecture"
Cohesion: 0.07
Nodes (31): Notification Batch Digest Task, Plan SPEC 16: Notification Module, Email Notification Channel, In-App Notification Channel, Notification Celery Consumer, Notification Service, Notification WebSocket Manager, WebSocket Notification Hook (+23 more)

### Community 7 - "Complete API Endpoint Index"
Cohesion: 0.22
Nodes (9): API Versioning Policy, Complete API Endpoint Index, Standard Error Response Schema, Health and Operational Endpoints, Idempotency Key Mechanism, Offset and Cursor Pagination Conventions, API Rate Limiting Tiers, Request ID Distributed Tracing (+1 more)

### Community 8 - "schemas.py"
Cohesion: 0.07
Nodes (53): AwardApprovedEvent, AwardRecommendedEvent, BaseEvent, BidEvaluatedEvent, BidOpenedEvent, BidSubmittedEvent, ContractActivatedEvent, ContractCreatedEvent (+45 more)

### Community 9 - "Async Workflow State Machine Engine"
Cohesion: 0.20
Nodes (11): Axios API Client with Auto-Refresh, Plan SPEC 19: Frontend Architecture, Frontend Permission Guard, Supplier Registration Wizard, Workflow Task Inbox, RBAC and ABAC Permission Engine, Segregation of Duties (SoD) Enforcement, Audited Admin Workflow Intervention (+3 more)

### Community 10 - "Vendor Management Service"
Cohesion: 0.25
Nodes (9): Global Pytest Fixtures, Plan SPEC 23: Testing Strategy, Dynamic Data Factories, Workflow E2E Test Matrix, 10 Canonical S2P Workflow Templates, SPEC 07: Vendor Management Specification, GST & PAN External Verification Service, Vendor 11-State Finite State Machine (+1 more)

### Community 11 - "Contract Workspace"
Cohesion: 0.20
Nodes (10): Contract Compliance and Renewal Tracking, Contract Amendment Flow, Contract Approval Flow, Contract Repository Elasticsearch, Contract Template System, Contract Workspace, eSignature Integration, PDF Watermarking Service (+2 more)

### Community 12 - "Document Management Service"
Cohesion: 0.22
Nodes (9): Plan SPEC 17: Document Management, ClamAV Document Scanner, Document Management Service, Document Quarantine Mechanism, Celery Document Scan Task, SSRF-Safe HTTP Client, HMAC Signed Webhook Delivery Service, Field-Level Encryption (PII & Banking) (+1 more)

### Community 13 - "Purchase Requisition Service"
Cohesion: 0.20
Nodes (11): Workflow SLA Timers & Escalations, Atomic Budget Reservation Engine, SPEC 08: Purchase Requisition Specification, PR Split & Merge Engine, PR 12-State Finite State Machine, Purchase Requisition Service, PR Sourcing Path Decision Logic, Unmapped PR Exception Queue (+3 more)

### Community 14 - "Procurement Analytics Service"
Cohesion: 0.25
Nodes (8): Chunked CSV Export Streaming, Analytics Export Service, Analytics Cache Refresh Task, Analytics REST Router, Procurement Analytics Service, Plan SPEC 25: Analytics & Reporting, Scheduled Reports Celery Task, Vendor Scorecard Calculation Engine

### Community 15 - "Category Hierarchy Service"
Cohesion: 0.29
Nodes (7): Category Hierarchy Service, Plan SPEC 24: Master Data Management, Bulk Master Data Import Service, Master Data Routers, Vendor Duplicate Detection Algorithm, SPEC 09: Unmapped PR Exception Management, Auto-Suggestion Heuristic Engine

### Community 16 - "Approval Rules Engine Service"
Cohesion: 0.29
Nodes (7): Approval Rules Database Tables, Approval Rules Engine Service, SPEC 06: Approval Rules Engine Specification, Maker-Checker Rule Change Governance, Rule Condition Evaluator, Rule Versioning & In-Flight Protection, Approval Rule Simulation API

### Community 17 - "Document Upload Pipeline"
Cohesion: 0.29
Nodes (7): ClamAV Virus Scanner, Document Upload Pipeline, Document Versioning, MinIO Bucket Structure, OCR Metadata Extraction, Document Retention Enforcement, SPEC 17 Document Management Specification

### Community 18 - "PostgreSQL Shared-Database Multi-Tenancy"
Cohesion: 0.20
Nodes (10): HRMS Employee Lifecycle Consumer, Elasticsearch Audit Search Service, Audit Logs Monthly Partitioning & Immutability, SPEC 03: Complete Database Specification, PostgreSQL Shared-Database Multi-Tenancy, Requisitions Database Schema, Vendors Database Schema, Workflow Database Tables (+2 more)

### Community 19 - "PermissionCode"
Cohesion: 0.21
Nodes (9): AuditAction, PermissionCode, AsyncSession, UUID, user_has_permission(), Master data seed script. Seeds default roles, all 100+ permissions from…, seed_data(), test_audit_action_login_success() (+1 more)

### Community 20 - "GRN Linkage and Invoice Eligibility"
Cohesion: 0.33
Nodes (6): GRN Linkage and Invoice Eligibility, Multi-Delivery PO Tracking, Quality Inspection Gate, SPEC 14 Purchase Order Specification, Invoice Submission Eligibility, SPEC 15 Invoice and Payment Specification

### Community 21 - "Testing Framework and Tooling"
Cohesion: 0.33
Nodes (6): API Contract Tests Matrix, Testcontainers Integration Setup, K6 Performance Test Plan, SPEC 23 Testing Strategy Specification, Testing Framework and Tooling, Workflow Engine Regression Suite

### Community 22 - "Graphify Agent Rules"
Cohesion: 0.40
Nodes (5): Graphify Agent Rules, Graph Maintenance Rule, Knowledge Graph Query Protocol, Graphify Workflow, Knowledge Graph Generation Workflow

### Community 23 - "Standard API Response Envelope"
Cohesion: 0.50
Nodes (4): Standard API Response Envelope, Plan SPEC 18: API Design Standards, Dynamic SQL Filter Builder, Cursor & Offset Pagination Handler

### Community 24 - "ERP Adapter Base Interface"
Cohesion: 0.50
Nodes (4): Plan SPEC 20: Integration Layer, ERP Adapter Base Interface, Integration Job Processor, Six PR Creation Channels

### Community 25 - "GitHub Actions CI/CD Pipeline"
Cohesion: 0.50
Nodes (4): Blue-Green Deployment Strategy, Docker Multi-Stage Container Setup, GitHub Actions CI/CD Pipeline, CI Test Execution and Regression Gates

### Community 26 - "Grafana Alert Rules Suite"
Cohesion: 0.50
Nodes (4): Grafana Alert Rules Suite, Grafana Procurement Dashboards, On-Call Runbooks, Prometheus Custom Procurement Metrics

### Community 44 - "test_responses.py"
Cohesion: 0.18
Nodes (18): decode_cursor(), encode_cursor(), paginate_query(), PaginationParams, Any, APIResponse, created_response(), Links (+10 more)

### Community 45 - "dependencies"
Cohesion: 0.05
Nodes (39): dependencies, next, @procurement/hooks, @procurement/stores, @procurement/types, @procurement/ui, @procurement/utils, react (+31 more)

### Community 46 - "dependencies"
Cohesion: 0.05
Nodes (39): dependencies, next, @procurement/hooks, @procurement/stores, @procurement/types, @procurement/ui, @procurement/utils, react (+31 more)

### Community 47 - "dependencies"
Cohesion: 0.05
Nodes (39): dependencies, next, @procurement/hooks, @procurement/stores, @procurement/types, @procurement/ui, @procurement/utils, react (+31 more)

### Community 48 - "RedisKeys"
Cohesion: 0.11
Nodes (22): check_idempotency(), Any, Redis, store_idempotency(), get_redis_client(), Redis, UUID, RedisKeys (+14 more)

### Community 49 - "ui/package.json"
Cohesion: 0.06
Nodes (32): class-variance-authority, clsx, dependencies, class-variance-authority, clsx, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-select (+24 more)

### Community 50 - "pipeline"
Cohesion: 0.06
Nodes (26): metadata, metadata, metadata, dependsOn, outputs, cache, cache, persistent (+18 more)

### Community 51 - "AppException"
Cohesion: 0.10
Nodes (31): AppException, AuthenticationError, BusinessRuleError, ConflictError, ForbiddenError, NotFoundError, OptimisticLockError, Any (+23 more)

### Community 52 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowJs, declaration, declarationMap, esModuleInterop, incremental, isolatedModules, jsx (+13 more)

### Community 53 - "hooks/package.json"
Cohesion: 0.10
Nodes (20): dependencies, @procurement/types, @procurement/utils, @tanstack/react-query, devDependencies, @types/react, typescript, @procurement/types (+12 more)

### Community 54 - "scripts"
Cohesion: 0.11
Nodes (18): devDependencies, turbo, typescript, engines, node, typescript, name, packageManager (+10 more)

### Community 55 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, declarationMap, jsx, module, moduleResolution, outDir, rootDir (+8 more)

### Community 56 - "stores/package.json"
Cohesion: 0.12
Nodes (16): dependencies, zustand, devDependencies, @types/react, typescript, react, @types/react, typescript (+8 more)

### Community 57 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, declarationMap, jsx, module, moduleResolution, outDir, rootDir (+8 more)

### Community 58 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, declarationMap, jsx, module, moduleResolution, outDir, rootDir (+8 more)

### Community 59 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, declarationMap, module, moduleResolution, outDir, rootDir, sourceMap (+7 more)

### Community 60 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, declarationMap, module, moduleResolution, outDir, rootDir, sourceMap (+7 more)

### Community 61 - "main.py"
Cohesion: 0.32
Nodes (12): FastAPI, register_exception_handlers(), LoggingContextMiddleware, RequestIDMiddleware, SecurityHeadersMiddleware, TimingMiddleware, get_current_trace_id(), setup_telemetry() (+4 more)

### Community 62 - "types/package.json"
Cohesion: 0.13
Nodes (14): openapi-typescript, devDependencies, openapi-typescript, tsx, typescript, typescript, main, name (+6 more)

### Community 63 - "admin-portal/tsconfig.json"
Cohesion: 0.14
Nodes (13): compilerOptions, baseUrl, paths, plugins, exclude, extends, include, next-env.d.ts (+5 more)

### Community 64 - "buyer-portal/tsconfig.json"
Cohesion: 0.14
Nodes (13): compilerOptions, baseUrl, paths, plugins, exclude, extends, include, next-env.d.ts (+5 more)

### Community 65 - "supplier-portal/tsconfig.json"
Cohesion: 0.14
Nodes (13): compilerOptions, baseUrl, paths, plugins, exclude, extends, include, next-env.d.ts (+5 more)

### Community 66 - "utils/package.json"
Cohesion: 0.17
Nodes (11): axios, dependencies, axios, devDependencies, typescript, typescript, main, name (+3 more)

### Community 67 - ".dispatch"
Cohesion: 0.24
Nodes (9): anyio_backend(), org_id(), fixture, pytest_configure(), Shared test fixtures for the procurement portal test suite., Set required env vars before any imports., Generate a unique org_id for test isolation., Generate a unique user_id for test isolation. (+1 more)

### Community 68 - "Plan Spec 04: Auth & Security"
Cohesion: 0.18
Nodes (11): Tenant & Audit Metadata Mixin, Plan Spec 04: Auth & Security, RS256 Asymmetric JWT Authentication, Role-Based Access Control & Permission Matrix, Multi-Tenant Isolation Middleware, Plan Spec 10: RFQ Lifecycle, Dual-Authorization Bid Opening Protocol, Time-Bounded Bid Submission Window (+3 more)

### Community 69 - "Plan Spec 08: Purchase Requisition"
Cohesion: 0.20
Nodes (11): Plan Spec 06: Approval Rules Engine, Declarative Approval Rules Engine, Unmatched Rule Lock and Escalation Protocol, Plan Spec 08: Purchase Requisition, Business Unit Sequenced PR Identification, PR Consolidation & Sourcing Assignment, Purchase Requisition FSM, Plan Spec 09: Unmapped PR Exception Handling (+3 more)

### Community 70 - "Sourcing Service"
Cohesion: 0.20
Nodes (10): Emergency RFQ Fast Path, RFQ Amendment Flow, RFQ Cancellation Flow, RFQ RabbitMQ Events, Single Vendor Controls, Sourcing Service, SPEC 10 RFQ Lifecycle Specification, SPEC 11 Bid Management Specification (+2 more)

### Community 71 - "Evaluation Service"
Cohesion: 0.20
Nodes (10): CS Approval Workflow, CS PDF Output Generation, CS Versioning, Evaluation Service, Contract Creation Triggers, SPEC 13 Contract Management Specification, PO Approval Flow, PO Number Generation (+2 more)

### Community 72 - "Implementation Prompts All Modules"
Cohesion: 0.25
Nodes (9): Implementation Prompts All Modules, Prompt Execution Protocol, Plan Spec 12: Comparative Statement & Evaluation, Auditable CS Matrix PDF Generation, Normalized Currency L1 Calculation, Multi-Factor Scoring & Evaluation Engine, Plan Spec 14: Purchase Order, Automated PO Generation from Award (+1 more)

### Community 73 - "config/package.json"
Cohesion: 0.22
Nodes (8): devDependencies, typescript, typescript, main, name, private, types, version

### Community 74 - "RFQ Creation Wizard"
Cohesion: 0.25
Nodes (8): Bidder Eligibility Enforcement, RFQ Lot Management, RFQ Creation Wizard, RFQ Header Schema, RFQ Timeline Validation, Bid Draft Autosave, Next.js Supplier Portal App, useAutosave React Hook

### Community 75 - "Turborepo Monorepo Architecture"
Cohesion: 0.25
Nodes (8): SPEC 18 API Design Specification, Next.js Admin Portal App, Next.js Buyer Portal App, RFQ Wizard State Management, Shared TanStack Query Hooks, Shared UI Component Library, SPEC 19 Frontend Architecture Specification, Turborepo Monorepo Architecture

### Community 77 - "Comparative Statement Engine"
Cohesion: 0.29
Nodes (7): Bid SHA-256 Hash Integrity, Comparative Statement Engine, CS Normalization Algorithm, Tax Discrepancy Detection, CS Tie-Breaking Rules, Critical Function Test Cases, Unit Test Coverage Targets

### Community 78 - ".publish"
Cohesion: 0.40
Nodes (4): OutboxPublisher, AsyncSession, UUID, CRITICAL: always called WITHIN caller's transaction (never standalone commit)

### Community 79 - "Frontend Backend Wiring Guide"
Cohesion: 0.33
Nodes (6): Frontend Backend Wiring Guide, Docker Unified Networking Pattern, FSM State Synchronization Pattern, Types-First Contract Principle, Unified Response Envelope Standard, API Contract Protocol

### Community 80 - "SPEC AUDIT REPORT — SPEC_01 + SPEC_02"
Cohesion: 0.33
Nodes (5): OVERALL, PARTIAL items (non-blocking for SPEC_01+02 scaffold), SPEC_01: Project Overview & Governance, SPEC_02: System Architecture, SPEC AUDIT REPORT — SPEC_01 + SPEC_02

### Community 81 - "Plan Spec 07: Vendor Management"
Cohesion: 0.40
Nodes (5): Plan Spec 07: Vendor Management, Automated Compliance & KYC Verification, Bcrypt-Hashed Invitation Token Protocol, Vendor Lifecycle FSM, Dual-Provider E-Signature Adapter

### Community 82 - "authStore.ts"
Cohesion: 0.70
Nodes (3): AuthState, CurrentUser, useAuthStore

### Community 84 - "Plan Spec 01: Project Overview & Governance"
Cohesion: 0.50
Nodes (4): Plan Spec 01: Project Overview & Governance, Multi-Squad Governance Model, Procurement Portal Enterprise Scope, Superadmin Initialization Protocol

### Community 161 - "Base"
Cohesion: 0.13
Nodes (22): Base, Database definitions., AuditLog, BidDocument, BidLineResponse, BidResponse, BidVersion, FeatureFlag (+14 more)

### Community 162 - "enums.py"
Cohesion: 0.15
Nodes (25): ApprovalTaskStatus, AuditEntityType, BidStatus, ContractStatus, DocumentCategory, EvaluationType, IntegrationJobStatus, InvoiceStatus (+17 more)

### Community 163 - "BaseModel"
Cohesion: 0.25
Nodes (18): BaseModel, Category, CurrencyMaster, DeliveryLocation, DocumentType, ErpMaterialGroupMapping, HolidayMaster, Incoterm (+10 more)

### Community 164 - "test_all_models.py"
Cohesion: 0.21
Nodes (11): Document, DocumentVersion, Dispute, DisputeMessage, PaymentRecord, PoAmendment, PoLine, PurchaseOrder (+3 more)

### Community 165 - "config.py"
Cohesion: 0.22
Nodes (11): get_settings(), Settings, BaseSettings, env_setup(), fixture, test_all_celery_intervals_accessible(), test_cors_origins(), test_environment_is_literal() (+3 more)

### Community 166 - "user/models.py"
Cohesion: 0.26
Nodes (13): DelegationRule, PasswordHistory, Permission, Role, RolePermission, User, UserBuScope, UserCategoryScope (+5 more)

### Community 167 - "test_migrations.py"
Cohesion: 0.14
Nodes (13): Integration tests for database migrations, immutability, indexes, and RLS., Verify document numbering sequences exist and generate consecutive values., Verify that migration created at least 70 tables in public schema., Verify that at least 20 ENUM types are defined., Verify that at least 40 indexes exist in public schema., Verify that audit_logs is append-only: UPDATE and DELETE are prohibited by…, Verify Row Level Security tenant isolation on vendors table., test_audit_log_immutable() (+5 more)

### Community 168 - "asyncio"
Cohesion: 0.18
Nodes (7): asyncio, Idempotent RabbitMQ topology setup. Run once per environment. Safe to re-run.…, Create all exchanges, queues, DLQs, and bindings idempotently., setup_rabbitmq(), test_health_endpoint(), test_health_live_endpoint(), test_health_ready_endpoint()

### Community 169 - "test_grn_and_invoice_models"
Cohesion: 0.29
Nodes (9): GoodsReceiptNote, GrnLine, QualityInspection, ServiceEntrySheet, SesLine, Invoice, InvoiceLine, InvoiceMatchResult (+1 more)

### Community 170 - "workflow/models.py"
Cohesion: 0.36
Nodes (9): ApprovalGroup, ApprovalGroupMember, ApprovalRule, ApprovalRuleVersion, WorkflowEvent, WorkflowInstance, WorkflowTask, WorkflowTemplate (+1 more)

### Community 171 - "Procurement Portal — Enterprise S2C & P2P Platform"
Cohesion: 0.20
Nodes (9): Current Session State, Module Status, Procurement Portal — Enterprise S2C & P2P Platform, Quickstart & Verification, Run Backend Tests, Seed Master Data, Squad Decomposition, Start Docker Stack (+1 more)

### Community 172 - "2. Requirement-by-Requirement Traceability"
Cohesion: 0.20
Nodes (9): 1. Executive Summary, 2.1 Enums (SPEC_03 Section 2), 2.2 Migrations Traceability (SPEC_03 Section 3), 2.3 Indexes (SPEC_03 Section 4), 2.4 Row Level Security (SPEC_03 Section 6), 2.5 Audit Log Partitioning & Immutability (SPEC_03 Section 5 & 7), 2. Requirement-by-Requirement Traceability, 3. Overall Spec Audit Score (+1 more)

### Community 173 - "evaluation/models.py"
Cohesion: 0.39
Nodes (8): AwardDetail, AwardRecommendation, ComparativeStatement, CsLineRanking, Evaluation, EvaluationScore, Negotiation, test_evaluation_models()

### Community 174 - "vendor/models.py"
Cohesion: 0.39
Nodes (8): Vendor, VendorBankAccount, VendorCategoryMapping, VendorContact, VendorDocument, VendorErpSyncLog, VendorScorecard, test_vendor_models()

### Community 175 - "contract/models.py"
Cohesion: 0.43
Nodes (7): Contract, ContractAmendment, ContractDocument, ContractLine, ContractMilestone, ContractTemplate, test_contract_models()

### Community 176 - "sourcing/models.py"
Cohesion: 0.43
Nodes (7): Rfq, RfqAmendment, RfqClarification, RfqLine, RfqLot, RfqParticipant, test_sourcing_models()

### Community 177 - "env.py"
Cohesion: 0.43
Nodes (6): do_run_migrations(), get_url(), Run migrations in 'offline' mode., Run migrations in 'online' mode., run_migrations_offline(), run_migrations_online()

### Community 178 - "organization/models.py"
Cohesion: 0.48
Nodes (6): BusinessUnit, CostCenter, Department, Organization, Plant, test_organization_models()

### Community 179 - "session.py"
Cohesion: 0.60
Nodes (4): get_db(), get_db_with_rls(), AsyncSession, UUID

## Knowledge Gaps
- **460 isolated node(s):** `entrypoint.sh script`, `metadata`, `nextConfig`, `name`, `version` (+455 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 704 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **83 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `BaseModel` connect `BaseModel` to `Base`, `test_all_models.py`, `user/models.py`, `schemas.py`, `test_grn_and_invoice_models`, `workflow/models.py`, `test_responses.py`, `evaluation/models.py`, `vendor/models.py`, `contract/models.py`, `sourcing/models.py`, `organization/models.py`, `AppException`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `BaseEvent` connect `schemas.py` to `BaseModel`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `RedisKeys` connect `RedisKeys` to `AppException`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `RedisKeys` (e.g. with `check_idempotency()` and `store_idempotency()`) actually correct?**
  _`RedisKeys` has 16 INFERRED edges - model-reasoned connections that need verification._
- **What connects `entrypoint.sh script`, `metadata`, `nextConfig` to the rest of the system?**
  _460 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Master Data Twelve Entities Registry` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `K3s Kubernetes Cluster Topology` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._