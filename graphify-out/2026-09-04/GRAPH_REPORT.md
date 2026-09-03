# Graph Report - procurement-portal  (2026-09-04)

## Corpus Check
- 56 files · ~103,535 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 366 nodes · 385 edges · 44 communities (27 shown, 17 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Frontend-Backend Integration & Networking
- RFQ Lifecycle & Sealed Bidding
- RFQ Wizard & Lot Management
- PO ERP Sync & Invoicing
- Cluster Topology & Disaster Recovery
- Architecture Principles & Project Governance
- Infrastructure Deployment & Zero Trust
- API Standards & Idempotency
- Notification Channels & Digest Pipeline
- Frontend Architecture & Workflow Inbox
- Testing Strategy & Pytest Fixtures
- Contract Lifecycle & Elasticsearch Repository
- Document Security & ClamAV Quarantine
- Purchase Requisition & Budget Reservation
- Procurement Analytics & Streaming Export
- Master Data & Vendor Deduplication
- Approval Rules & Maker-Checker Engine
- Document Storage & OCR Processing
- Database Architecture & Multi-Tenancy
- Workflow State Machine & SLAs
- Purchase Orders & Goods Receipt
- API Testing & Testcontainers
- Graphify Knowledge Graph Configuration
- API Response Envelope & Filtering
- ERP Adapters & PR Ingestion
- CI/CD Pipeline & Blue-Green Deploy
- Observability Metrics & Alert Runbooks
- API Deprecation & Sunset Headers
- React Error Handling Boundary
- Celery Worker Deployments
- OpenTelemetry Distributed Tracing
- k6 Performance Testing Baselines
- OWASP Security Test Suite
- Exchange Rates Sync Task
- Soft Delete Data Pattern
- Security Headers Middleware
- Debit & Credit Notes Management
- Web Vitals Performance Targets
- WCAG Accessibility Compliance
- HRMS Integration & Employee Sync
- SSO SAML & OIDC Authentication
- Uptime Kuma Synthetic Monitoring
- Audit Trail Immutability Verification
- Security Compliance Checklist

## God Nodes (most connected - your core abstractions)
1. `Implementation Prompts All Modules` - 18 edges
2. `Purchase Requisition Service` - 13 edges
3. `Bid Service` - 12 edges
4. `GEMINI Project Rules and Onboarding` - 10 edges
5. `Async Workflow State Machine Engine` - 10 edges
6. `Vendor Management Service` - 10 edges
7. `Generic Finite State Machine Orchestrator` - 9 edges
8. `Modular Monolith Architecture` - 9 edges
9. `PostgreSQL Shared-Database Multi-Tenancy` - 9 edges
10. `Notification Architecture` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Generic Finite State Machine Orchestrator` --conceptually_related_to--> `FSM State Synchronization Pattern`  [INFERRED]
  plans/plan_spec_05_workflow_engine.md → FRONTEND_BACKEND_WIRING_GUIDE.md
- `Supplier Registration Wizard` --calls--> `Vendor Management Service`  [EXTRACTED]
  plans/plan_spec_19_frontend.md → specs/SPEC_07_VENDOR_MANAGEMENT.md
- `Dynamic Data Factories` --conceptually_related_to--> `Purchase Requisition Service`  [INFERRED]
  plans/plan_spec_23_testing.md → specs/SPEC_08_PURCHASE_REQUISITION.md
- `API Contract Protocol` --conceptually_related_to--> `Types-First Contract Principle`  [INFERRED]
  GEMINI.md → FRONTEND_BACKEND_WIRING_GUIDE.md
- `Implementation Prompts All Modules` --cites--> `GEMINI Project Rules and Onboarding`  [EXTRACTED]
  IMPLEMENTATION_PROMPTS.md → GEMINI.md

## Hyperedges (group relationships)
- **Upstream Requisition to Comparative Evaluation Flow** — plans_plan_spec_08_purchase_requisition_pr_lifecycle_fsm, plans_plan_spec_10_rfq_lifecycle_rfq_state_machine, plans_plan_spec_11_bid_management_sealed_bid_cryptographic_vault, plans_plan_spec_12_comparative_statement_multi_factor_scoring_engine [EXTRACTED 1.00]
- **Downstream Award Contract Fulfillment and Settlement Flow** — plans_plan_spec_12_comparative_statement_multi_factor_scoring_engine, plans_plan_spec_13_contract_management_contract_lifecycle_fsm, plans_plan_spec_14_purchase_order_po_lifecycle_fsm, plans_plan_spec_15_invoice_payment_three_way_matching_engine [EXTRACTED 1.00]
- **Core Platform Governance and Architectural Discipline** — gemini_layer_discipline_architecture, gemini_no_hardcoded_data_rule, frontend_backend_wiring_guide_types_first_contract_principle, plans_plan_spec_02_architecture_clean_layered_architecture [EXTRACTED 1.00]
- **End-to-End Requisition Approval & Notification Pipeline** — specs_spec_08_purchase_requisition_requisitionservice, specs_spec_06_approval_rules_engine_approvalrulesengine, specs_spec_05_workflow_engine_workflowengine, plans_plan_spec_16_notification_notificationservice [EXTRACTED 1.00]
- **Vendor Onboarding Compliance Verification Flow** — specs_spec_07_vendor_management_vendorservice, specs_spec_07_vendor_management_pan_gst_verification, specs_spec_07_vendor_management_bank_penny_test, specs_spec_07_vendor_management_duplicate_detection [EXTRACTED 1.00]
- **Defense-in-Depth & Zero-Trust Security Architecture** — specs_spec_04_auth_security_auth_pipeline, specs_spec_04_auth_security_sod_enforcement, plans_plan_spec_20_integration_safehttpclient, plans_plan_spec_21_infrastructure_networkpolicies, plans_plan_spec_17_document_management_documentscanner [INFERRED 0.95]
- **Source-to-Pay Transaction Execution Pipeline** — specs_spec_10_rfq_lifecycle_sourcing_service, specs_spec_11_bid_management_bid_service, specs_spec_12_comparative_statement_evaluation_service, specs_spec_14_purchase_order_prefill_from_award, specs_spec_15_invoice_payment_three_way_match_engine [EXTRACTED 1.00]
- **Cryptographic Sealing and Data Integrity Architecture** — specs_spec_10_rfq_lifecycle_bid_sealing_service, specs_spec_11_bid_management_bid_sha256_hash_integrity, specs_spec_17_document_management_clamav_virus_scanner, specs_spec_17_document_management_bid_document_sealing, specs_spec_23_testing_audit_validation_tests [INFERRED 0.95]
- **Observability, Alerting and Analytics Pipeline** — specs_spec_21_infrastructure_k3s_cluster_topology, specs_spec_22_observability_prometheus_custom_metrics, specs_spec_22_observability_grafana_alert_rules, specs_spec_22_observability_uptime_kuma_monitors, specs_spec_25_analytics_materialized_views_suite [INFERRED 0.85]

## Communities (44 total, 17 thin omitted)

### Community 0 - "Frontend-Backend Integration & Networking"
Cohesion: 0.05
Nodes (52): Frontend Backend Wiring Guide, Docker Unified Networking Pattern, FSM State Synchronization Pattern, Unified Response Envelope Standard, Implementation Prompts All Modules, Prompt Execution Protocol, Tenant & Audit Metadata Mixin, Plan Spec 04: Auth & Security (+44 more)

### Community 1 - "RFQ Lifecycle & Sealed Bidding"
Cohesion: 0.06
Nodes (38): Bid Sealing Service, Emergency RFQ Fast Path, RFQ Amendment Flow, RFQ Cancellation Flow, RFQ RabbitMQ Events, Single Vendor Controls, Sourcing Service, SPEC 10 RFQ Lifecycle Specification (+30 more)

### Community 2 - "RFQ Wizard & Lot Management"
Cohesion: 0.08
Nodes (25): Bidder Eligibility Enforcement, RFQ Lot Management, RFQ Creation Wizard, RFQ Header Schema, RFQ Timeline Validation, Bid Draft Autosave, Critical Notifications Policy, Notification Digest Mode (+17 more)

### Community 3 - "PO ERP Sync & Invoicing"
Cohesion: 0.08
Nodes (25): PO ERP Sync, PO Release to Supplier, Supplier PO Acceptance Flow, Dispute Management Service, Duplicate Invoice Detection, ERP Invoice Posting, Invoice Approval Workflow, Match Outcome Handling (+17 more)

### Community 4 - "Cluster Topology & Disaster Recovery"
Cohesion: 0.09
Nodes (23): Disaster Recovery Strategy, K3s Kubernetes Cluster Topology, K3s Helm and Manifest Structure, Kong API Gateway Deployment, MinIO Distributed 4-Node Cluster, Patroni PostgreSQL HA Cluster, RabbitMQ Mirrored Cluster HA, Redis Sentinel HA (+15 more)

### Community 5 - "Architecture Principles & Project Governance"
Cohesion: 0.10
Nodes (22): Types-First Contract Principle, GEMINI Project Rules and Onboarding, API Contract Protocol, Layer Discipline Architecture, Migration Safety Protocol, Zero Hardcoded Data Rule, Six-Step Implementation Loop, Plan Apple Design System and Liquid Glass (+14 more)

### Community 6 - "Infrastructure Deployment & Zero Trust"
Cohesion: 0.10
Nodes (21): Procurement API Deployment, Plan SPEC 21: Infrastructure & Deployment, Horizontal Pod Autoscaler, K3s Kubernetes Cluster, Zero-Trust Network Policies, Pod Disruption Budgets, Prometheus Alert Rules, Plan SPEC 22: Observability & Monitoring (+13 more)

### Community 7 - "API Standards & Idempotency"
Cohesion: 0.18
Nodes (11): API Versioning Policy, Complete API Endpoint Index, Standard Error Response Schema, Health and Operational Endpoints, Idempotency Key Mechanism, Offset and Cursor Pagination Conventions, API Rate Limiting Tiers, Request ID Distributed Tracing (+3 more)

### Community 8 - "Notification Channels & Digest Pipeline"
Cohesion: 0.20
Nodes (10): Notification Batch Digest Task, Plan SPEC 16: Notification Module, Email Notification Channel, In-App Notification Channel, Notification Celery Consumer, Notification Service, Notification WebSocket Manager, WebSocket Notification Hook (+2 more)

### Community 9 - "Frontend Architecture & Workflow Inbox"
Cohesion: 0.20
Nodes (10): Axios API Client with Auto-Refresh, Plan SPEC 19: Frontend Architecture, Frontend Permission Guard, Supplier Registration Wizard, Workflow Task Inbox, HRMS Employee Lifecycle Consumer, FastAPI Auth Middleware & JWT Pipeline, SPEC 04: Authentication & Security Specification (+2 more)

### Community 10 - "Testing Strategy & Pytest Fixtures"
Cohesion: 0.22
Nodes (10): Global Pytest Fixtures, Plan SPEC 23: Testing Strategy, Dynamic Data Factories, Workflow E2E Test Matrix, Vendors Database Schema, 10 Canonical S2P Workflow Templates, SPEC 07: Vendor Management Specification, GST & PAN External Verification Service (+2 more)

### Community 11 - "Contract Lifecycle & Elasticsearch Repository"
Cohesion: 0.20
Nodes (10): Contract Compliance and Renewal Tracking, Contract Amendment Flow, Contract Approval Flow, Contract Repository Elasticsearch, Contract Template System, Contract Workspace, eSignature Integration, PDF Watermarking Service (+2 more)

### Community 12 - "Document Security & ClamAV Quarantine"
Cohesion: 0.22
Nodes (9): Plan SPEC 17: Document Management, ClamAV Document Scanner, Document Management Service, Document Quarantine Mechanism, Celery Document Scan Task, SSRF-Safe HTTP Client, HMAC Signed Webhook Delivery Service, Field-Level Encryption (PII & Banking) (+1 more)

### Community 13 - "Purchase Requisition & Budget Reservation"
Cohesion: 0.25
Nodes (9): Atomic Budget Reservation Engine, SPEC 08: Purchase Requisition Specification, PR Split & Merge Engine, PR 12-State Finite State Machine, Purchase Requisition Service, PR Sourcing Path Decision Logic, Unmapped PR Exception Queue, Unmapped PR Reprocessing Service (+1 more)

### Community 14 - "Procurement Analytics & Streaming Export"
Cohesion: 0.25
Nodes (8): Chunked CSV Export Streaming, Analytics Export Service, Analytics Cache Refresh Task, Analytics REST Router, Procurement Analytics Service, Plan SPEC 25: Analytics & Reporting, Scheduled Reports Celery Task, Vendor Scorecard Calculation Engine

### Community 15 - "Master Data & Vendor Deduplication"
Cohesion: 0.29
Nodes (7): Category Hierarchy Service, Plan SPEC 24: Master Data Management, Bulk Master Data Import Service, Master Data Routers, Vendor Duplicate Detection Algorithm, SPEC 09: Unmapped PR Exception Management, Auto-Suggestion Heuristic Engine

### Community 16 - "Approval Rules & Maker-Checker Engine"
Cohesion: 0.29
Nodes (7): Approval Rules Database Tables, Approval Rules Engine Service, SPEC 06: Approval Rules Engine Specification, Maker-Checker Rule Change Governance, Rule Condition Evaluator, Rule Versioning & In-Flight Protection, Approval Rule Simulation API

### Community 17 - "Document Storage & OCR Processing"
Cohesion: 0.29
Nodes (7): ClamAV Virus Scanner, Document Upload Pipeline, Document Versioning, MinIO Bucket Structure, OCR Metadata Extraction, Document Retention Enforcement, SPEC 17 Document Management Specification

### Community 18 - "Database Architecture & Multi-Tenancy"
Cohesion: 0.33
Nodes (6): Elasticsearch Audit Search Service, Audit Logs Monthly Partitioning & Immutability, SPEC 03: Complete Database Specification, PostgreSQL Shared-Database Multi-Tenancy, Requisitions Database Schema, Workflow Database Tables

### Community 19 - "Workflow State Machine & SLAs"
Cohesion: 0.33
Nodes (6): Audited Admin Workflow Intervention, Approval Delegation Rules, SPEC 05: Workflow Engine Specification, Workflow SLA Timers & Escalations, Async Workflow State Machine Engine, Unmapped PR SLA Escalation Task

### Community 20 - "Purchase Orders & Goods Receipt"
Cohesion: 0.33
Nodes (6): GRN Linkage and Invoice Eligibility, Multi-Delivery PO Tracking, Quality Inspection Gate, SPEC 14 Purchase Order Specification, Invoice Submission Eligibility, SPEC 15 Invoice and Payment Specification

### Community 21 - "API Testing & Testcontainers"
Cohesion: 0.33
Nodes (6): API Contract Tests Matrix, Testcontainers Integration Setup, K6 Performance Test Plan, SPEC 23 Testing Strategy Specification, Testing Framework and Tooling, Workflow Engine Regression Suite

### Community 22 - "Graphify Knowledge Graph Configuration"
Cohesion: 0.40
Nodes (5): Graphify Agent Rules, Graph Maintenance Rule, Knowledge Graph Query Protocol, Graphify Workflow, Knowledge Graph Generation Workflow

### Community 23 - "API Response Envelope & Filtering"
Cohesion: 0.50
Nodes (4): Standard API Response Envelope, Plan SPEC 18: API Design Standards, Dynamic SQL Filter Builder, Cursor & Offset Pagination Handler

### Community 24 - "ERP Adapters & PR Ingestion"
Cohesion: 0.50
Nodes (4): Plan SPEC 20: Integration Layer, ERP Adapter Base Interface, Integration Job Processor, Six PR Creation Channels

### Community 25 - "CI/CD Pipeline & Blue-Green Deploy"
Cohesion: 0.50
Nodes (4): Blue-Green Deployment Strategy, Docker Multi-Stage Container Setup, GitHub Actions CI/CD Pipeline, CI Test Execution and Regression Gates

### Community 26 - "Observability Metrics & Alert Runbooks"
Cohesion: 0.50
Nodes (4): Grafana Alert Rules Suite, Grafana Procurement Dashboards, On-Call Runbooks, Prometheus Custom Procurement Metrics

## Knowledge Gaps
- **168 isolated node(s):** `Knowledge Graph Query Protocol`, `Knowledge Graph Generation Workflow`, `Docker Unified Networking Pattern`, `Six-Step Implementation Loop`, `Prompt Execution Protocol` (+163 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 201 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PostgreSQL Shared-Database Multi-Tenancy` connect `Database Architecture & Multi-Tenancy` to `Infrastructure Deployment & Zero Trust`, `Frontend Architecture & Workflow Inbox`, `Testing Strategy & Pytest Fixtures`, `Master Data & Vendor Deduplication`, `Approval Rules & Maker-Checker Engine`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `Bid Service` connect `RFQ Lifecycle & Sealed Bidding` to `RFQ Wizard & Lot Management`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `Modular Monolith Architecture` connect `Infrastructure Deployment & Zero Trust` to `Notification Channels & Digest Pipeline`, `Database Architecture & Multi-Tenancy`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `Knowledge Graph Query Protocol`, `Knowledge Graph Generation Workflow`, `Docker Unified Networking Pattern` to the rest of the system?**
  _168 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend-Backend Integration & Networking` be split into smaller, more focused modules?**
  _Cohesion score 0.053544494720965306 - nodes in this community are weakly interconnected._
- **Should `RFQ Lifecycle & Sealed Bidding` be split into smaller, more focused modules?**
  _Cohesion score 0.05689900426742532 - nodes in this community are weakly interconnected._
- **Should `RFQ Wizard & Lot Management` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._