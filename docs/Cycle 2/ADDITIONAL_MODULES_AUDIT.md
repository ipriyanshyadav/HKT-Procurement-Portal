# 🏗️ Procurement Portal – Additional Modules Gap Analysis & Audit Report (Cycle 2)

**Project:** Enterprise Source-to-Contract (S2C) & Procure-to-Pay (P2P) Platform  
**Target Directory:** [`docs/Cycle 2/`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/docs/Cycle%202)  
**Date:** 2026-09-07  
**Governance Framework:** [`GEMINI.md`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/GEMINI.md) & [`README.md`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/README.md)  
**System Baseline:**
- **Alembic Migration Head:** `0036_item_master` (37 reversible schema migrations)
- **Backend Test Suite:** 748 passed, 80.14% test coverage gate
- **Security Baseline:** 20/20 OWASP Top 10 automated test suites passing
- **Frontend State:** 3 Next.js 14 Turborepo applications (`buyer-portal`, `supplier-portal`, `admin-portal`) compiling cleanly with strict TypeScript checks (`pnpm typecheck`)

---

## 1. Executive Summary

A comprehensive workspace audit was conducted to evaluate the current implementation state of the **48 proposed modules/capabilities** across 9 functional categories.

| Status Category | Count | Percentage | Definition |
| :--- | :---: | :---: | :--- |
| ✅ **Fully Implemented (DONE)** | **23** | **47.9%** | Production-ready schema, service layer, router, UI components, and automated tests are present and active. |
| 🟡 **Partially Implemented (PARTIAL)** | **14** | **29.2%** | Underlying data models, background tasks, or engine logic exist, but specific UI dashboards, external SDKs, or phase-deferred stubs remain. |
| ❌ **Not Implemented (MISSING)** | **11** | **22.9%** | Not present in the current codebase; candidate for Cycle 2 roadmap. |
| **TOTAL** | **48** | **100.0%** | **37 of 48 items (77.1%)** have substantial implementation already in place. |

---

## 2. Category Summary Matrix

| # | Category | Total Items | ✅ Done | 🟡 Partial | ❌ Missing | Readiness Score |
| :-: | :--- | :-: | :-: | :-: | :-: | :-: |
| **1** | 🧪 **QA & Testing Support Layer** | 6 | 2 | 1 | 3 | **41.7%** |
| **2** | 👨💻 **Developer Platform** | 7 | 1 | 3 | 3 | **35.7%** |
| **3** | 🔐 **Security & Compliance** | 6 | 5 | 0 | 1 | **83.3%** |
| **4** | 📊 **Reporting & Analytics** | 5 | 3 | 2 | 0 | **80.0%** |
| **5** | 🔔 **Notifications & Communication** | 4 | 3 | 1 | 0 | **87.5%** |
| **6** | 🔗 **Integrations Layer** | 5 | 2 | 2 | 1 | **60.0%** |
| **7** | 🛠️ **DevOps & Infrastructure** | 6 | 5 | 1 | 0 | **91.7%** |
| **8** | 📋 **Onboarding & Support** | 5 | 1 | 2 | 2 | **40.0%** |
| **9** | 🏢 **Multi-Company / Multi-Tenant Support** | 4 | 1 | 2 | 1 | **50.0%** |
| | **TOTALS** | **48** | **23** | **14** | **11** | **62.5% Weighted** |

---

## 3. Granular Module Breakdown

---

### Category 1: 🧪 QA & Testing Support Layer

| Module | Description | Status | Verification & Codebase Reality |
| :--- | :--- | :---: | :--- |
| **Test Case Management** | Create, assign & track test cases per module (Admin/Buyer/Supplier) | ❌ **MISSING** | No in-app test case management suite exists. Developers use automated code-level tests. |
| **Bug Tracker Integration** | Link to Jira/GitHub Issues for defect logging | ❌ **MISSING** | No active sync adapter for Jira or GitHub Issues defect logging. |
| **UAT (User Acceptance Testing) Portal** | Separate login for QA users to validate flows | ❌ **MISSING** | Three portals exist (`buyer-portal`, `supplier-portal`, `admin-portal`) with seeded test accounts, but no isolated QA role or standalone UAT portal. |
| **Regression Test Suite** | Automated test scripts for critical procurement flows | ✅ **DONE** | **748 automated tests** in [`tests/`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/tests) covering unit, integration, and security; full end-to-end Playwright procurement cycle in [`tests/e2e/playwright/full_procurement_cycle.spec.ts`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/tests/e2e/playwright/full_procurement_cycle.spec.ts); and k6 load tests in [`tests/performance/k6_baselines.js`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/tests/performance/k6_baselines.js). |
| **Test Environments** | Dev / Staging / UAT / Production environment configs | 🟡 **PARTIAL** | Local Docker Compose stack ([`docker/docker-compose.yml`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/docker/docker-compose.yml)) alongside Kubernetes overlays in [`k8s/overlays/dev`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/k8s/overlays/dev), [`staging`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/k8s/overlays/staging), [`production`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/k8s/overlays/production), and [`dr`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/k8s/overlays/dr). (A dedicated `uat` overlay config is not explicitly named). |
| **Mock Data Generator** | Seed data for buyers, suppliers, POs, invoices for testing | ✅ **DONE** | **1,320-line idempotent seed script** in [`scripts/seed_demo_user.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/scripts/seed_demo_user.py) seeding comprehensive business units, categories, users, vendors, PRs, RFQs, Bids, POs, GRNs, Invoices, and Payments; plus isolated factory suites in [`tests/factories/`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/tests/factories). |

---

### Category 2: 👨💻 Developer Platform

| Module | Description | Status | Verification & Codebase Reality |
| :--- | :--- | :---: | :--- |
| **API Documentation (Swagger/OpenAPI)** | Self-hosted docs for all REST APIs | ✅ **DONE** | FastAPI self-hosted Swagger UI at `http://localhost:8000/docs` and ReDoc at `http://localhost:8000/redoc` configured in [`app/main.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/main.py). |
| **Developer Sandbox** | Isolated environment to test integrations | ❌ **MISSING** | No dedicated developer self-service sandbox portal exists for external developers. |
| **Webhook Management** | Configure & test event-driven notifications | 🟡 **PARTIAL** | Core webhook delivery engine with HMAC-SHA256 signature generation & verification in [`app/modules/integration/webhook.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/integration/webhook.py) and settings in [`apps/admin-portal/.../integrations/settings/page.tsx`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/procurement-portal-frontend/apps/admin-portal/app/%28main%29/integrations/settings/page.tsx); lacks an interactive developer testing/triggering UI. |
| **API Key Management** | Generate, rotate & revoke API keys per client | ❌ **MISSING** | Authentication utilizes RS256 JWT, SAML, and OIDC; client API key generation, rotation, and revocation endpoints do not exist. |
| **SDK / Code Snippets** | Helper libraries for common integrations | ❌ **MISSING** | No downloadable SDK libraries (Python, Node, Java) or code snippet generators. |
| **Changelog & Versioning** | Track API and feature versions | 🟡 **PARTIAL** | API routes strictly versioned under `/api/v1/`, and standard RFC deprecation headers (`Deprecation`, `Sunset`, `Link`) implemented in [`app/core/deprecation.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/core/deprecation.py), but no public or in-app developer changelog view. |
| **Rate Limiting Dashboard** | Monitor API usage and throttle limits | 🟡 **PARTIAL** | Rate limiting is actively enforced by Kong Gateway ([`kong/kong.yml`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/kong/kong.yml#L294)) and Redis, monitored via Prometheus/Grafana and system health ([`apps/admin-portal/.../system/health/page.tsx`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/procurement-portal-frontend/apps/admin-portal/app/%28main%29/system/health/page.tsx)), but lacks a dedicated client rate-limit dashboard. |

---

### Category 3: 🔐 Security & Compliance

| Module | Description | Status | Verification & Codebase Reality |
| :--- | :--- | :---: | :--- |
| **Role & Permission Matrix** | Granular RBAC for Admin, Buyer, Supplier roles | ✅ **DONE** | 100+ permissions defined in [`app/core/constants.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/core/constants.py#L163), seeded roles in [`alembic/versions/0027_data_seed.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/alembic/versions/0027_data_seed.py), backend `require_permission` guards ([`app/auth/dependencies.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/auth/dependencies.py)), and UI guards ([`packages/ui/src/PermissionGuard.tsx`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/procurement-portal-frontend/packages/ui/src/PermissionGuard.tsx)). |
| **Audit Log Viewer** | Who did what and when across all portals | ✅ **DONE** | Comprehensive Admin Audit Trail UI ([`apps/admin-portal/.../audit-trail/page.tsx`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/procurement-portal-frontend/apps/admin-portal/app/%28main%29/audit-trail/page.tsx)), immutable PostgreSQL audit trigger ([`0022_audit_log.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/alembic/versions/0022_audit_log.py)), range-partitioned tables ([`0023_audit_partitions.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/alembic/versions/0023_audit_partitions.py)), and Elasticsearch 8 search backend. |
| **Data Masking / PII Controls** | Mask sensitive supplier/buyer data | ✅ **DONE** | Logging PII mask ([`app/core/security.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/core/security.py#L48)), bank account masking (`****1234`), AES-256 field encryption for PAN/GSTIN/Bank details ([`app/core/encryption.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/core/encryption.py)), sealed bid price masking until opening ([`app/modules/bid/service.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/bid/service.py)), and anonymized RFQ clarification threads. |
| **SSO / OAuth Integration** | Login via Google, Azure AD, SAML | ✅ **DONE** | Enterprise SAML 2.0 and OIDC (Azure AD, Google, standard IdPs) with Just-In-Time (JIT) provisioning in [`app/auth/sso.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/auth/sso.py). |
| **2FA / MFA Setup** | Two-factor auth per user role | ✅ **DONE** | TOTP MFA with QR codes and 10 single-use backup codes ([`app/auth/mfa.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/auth/mfa.py)), mandatory role enforcement in [`app/auth/service.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/auth/service.py), and UI verification screen ([`apps/buyer-portal/app/(auth)/mfa/page.tsx`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/procurement-portal-frontend/apps/buyer-portal/app/%28auth%29/mfa/page.tsx)). |
| **Compliance Dashboard** | GDPR, ISO 27001, SOC2 checklist tracking | ❌ **MISSING** | System security architecture meets SOC2/ISO/GDPR requirements, but there is no dedicated in-portal compliance checklist dashboard. |

---

### Category 4: 📊 Reporting & Analytics

| Module | Description | Status | Verification & Codebase Reality |
| :--- | :--- | :---: | :--- |
| **Procurement Analytics Dashboard** | Spend by category, supplier, time period | ✅ **DONE** | Live dashboard in [`apps/buyer-portal/.../analytics/spend/page.tsx`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/procurement-portal-frontend/apps/buyer-portal/app/%28main%29/analytics/spend/page.tsx) with spend by category, vendor, business unit, and fiscal year breakdowns using Recharts. |
| **Supplier Scorecards** | Performance ratings, delivery time, quality | ✅ **DONE** | `vendor_scorecards` model ([`app/modules/vendor/models.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/vendor/models.py#L131)), automatic delivery/quality updates from GRN inspection ([`app/modules/grn/service.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/grn/service.py#L333)), and scorecard display in Buyer Portal vendor details. |
| **Buyer Activity Reports** | PO frequency, approval turnaround times | 🟡 **PARTIAL** | PR-to-PO cycle time, invoice processing days, and PO count aggregations exist in [`app/modules/analytics/service.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/analytics/service.py), but no individual buyer turnaround leaderboard or activity breakdown UI. |
| **Export Center** | CSV / Excel / PDF export for all reports | 🟡 **PARTIAL** | Multi-format export engine ([`app/modules/analytics/export_service.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/analytics/export_service.py)) supports streaming CSV and Excel (.xlsx via openpyxl), plus ReportLab PDFs; exports run synchronously via action buttons rather than a centralized async export queue center. |
| **Scheduled Reports** | Auto-email reports to stakeholders | ✅ **DONE** | Daily, weekly, and monthly Celery Beat scheduled tasks ([`app/tasks/scheduled_reports.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/tasks/scheduled_reports.py)) aggregating KPIs and auto-publishing email reports to stakeholders. |

---

### Category 5: 🔔 Notifications & Communication

| Module | Description | Status | Verification & Codebase Reality |
| :--- | :--- | :---: | :--- |
| **In-App Notification Center** | Bell icon with real-time alerts | ✅ **DONE** | Bell icon with unread counts ([`packages/components/NotificationBell.tsx`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/procurement-portal-frontend/packages/components/NotificationBell.tsx)), full notification center ([`NotificationCenter.tsx`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/procurement-portal-frontend/packages/components/NotificationCenter.tsx)), and real-time WebSocket updates via Redis pub/sub ([`app/modules/notification/websocket.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/notification/websocket.py)). |
| **Email Notification Templates** | Configurable templates per event (PO raised, approved, rejected) | ✅ **DONE** | 20+ Jinja2 email templates seeded in [`scripts/seed_notification_templates.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/scripts/seed_notification_templates.py) for POs, RFQs, Bids, PRs, and Invoices, delivered via SendGrid ([`app/modules/notification/channels/email.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/notification/channels/email.py)). |
| **SMS / WhatsApp Alerts** | Optional for critical approvals | 🟡 **PARTIAL** | SMS alerts are fully implemented via MSG91 and Twilio ([`app/modules/notification/channels/sms.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/notification/channels/sms.py)); WhatsApp is an intentional Phase 3 stub returning `202 Accepted` ([`whatsapp.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/notification/channels/whatsapp.py)). |
| **Escalation Rules** | Auto-escalate if approval pending beyond X hours | ✅ **DONE** | Celery beat task ([`app/tasks/sla_timers.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/tasks/sla_timers.py)) enforces a 4-tier escalation hierarchy: 50% reminder, 100% escalation, 150% auto-reassignment, 200% critical alert; plus unmapped PR SLA escalation (4h -> 8h -> 24h -> 48h). |

---

### Category 6: 🔗 Integrations Layer

| Module | Description | Status | Verification & Codebase Reality |
| :--- | :--- | :---: | :--- |
| **ERP Connector** | SAP / Oracle / MS Dynamics sync | 🟡 **PARTIAL** | Full pluggable adapters for SAP RFC/OData ([`erp_sap.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/integration/adapters/erp_sap.py)), Oracle Fusion ([`erp_oracle.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/integration/adapters/erp_oracle.py)), GeM ([`gem.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/integration/adapters/gem.py)), and Custom REST ERP ([`erp_custom.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/integration/adapters/erp_custom.py)) with 7-step exponential retry; MS Dynamics can use the custom ERP adapter, but does not have a dedicated adapter file. |
| **Accounting Integration** | QuickBooks, Tally, Zoho Books | ❌ **MISSING** | No dedicated connectors for QuickBooks, Tally, or Zoho Books. |
| **Payment Gateway** | Razorpay / Stripe for supplier payments | 🟡 **PARTIAL** | Enterprise scheduled payments, TDS deduction, and bank settlement with UTR tracking implemented in [`app/modules/payment/service.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/payment/service.py) alongside Razorpay penny-drop bank verification; automated online checkout/auto-debit via Stripe/Razorpay is not wired. |
| **Document Storage** | AWS S3 / Google Drive for PO/invoice docs | ✅ **DONE** | MinIO (100% S3-compatible) with 10 dedicated buckets, presigned URLs with 15-min TTL, path sanitization, and ClamAV antivirus quarantine pipeline ([`app/modules/document/service.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/document/service.py)). Connecting to AWS S3 requires only updating `.env` endpoint URLs. |
| **eSignature Integration** | DocuSign / Adobe Sign for contracts | ✅ **DONE** | DocuSign REST API adapter ([`app/modules/integration/adapters/docusign.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/integration/adapters/docusign.py)) and Digio Indian Aadhaar/eSign adapter ([`digio.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/integration/adapters/digio.py)) with contract sign-off status tracking. |

---

### Category 7: 🛠️ DevOps & Infrastructure

| Module | Description | Status | Verification & Codebase Reality |
| :--- | :--- | :---: | :--- |
| **CI/CD Pipeline Config** | GitHub Actions / Jenkins setup docs | ✅ **DONE** | GitHub Actions workflow in [`.github/workflows/ci.yml`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/.github/workflows/ci.yml) (dead code scanner, ruff linting, pytest, coverage gate) + complete deployment guide in [`docs/GIT_AND_CICD_GUIDE.md`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/docs/GIT_AND_CICD_GUIDE.md). |
| **Environment Variable Vault** | Secrets management (HashiCorp Vault / AWS Secrets) | 🟡 **PARTIAL** | Centralized Pydantic Settings in [`app/config.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/config.py), `.env.example`, and K8s secret injection, but no dedicated HashiCorp Vault or AWS Secrets Manager SDK client integration. |
| **Container Configs** | Dockerfile, docker-compose, Kubernetes YAMLs | ✅ **DONE** | 17-container Docker Compose stack ([`docker/docker-compose.yml`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/docker/docker-compose.yml)), multi-stage production Dockerfiles for API, Worker, and all 3 Next.js portals, plus full Kubernetes K3s manifests with HPA and NetworkPolicies ([`k8s/base/`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/k8s/base)). |
| **Monitoring & Alerting** | Datadog / New Relic / Grafana dashboards | ✅ **DONE** | Prometheus metrics scraper, Grafana dashboards on port 3003, Jaeger distributed tracing on port 16686, and 15 Alertmanager SLO rules in [`k8s/monitoring/prometheus/rules.yaml`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/k8s/monitoring/prometheus/rules.yaml). |
| **Error Logging** | Sentry / ELK Stack integration | ✅ **DONE** | Elasticsearch 8 container on port 9200, Promtail pipeline configuration ([`k8s/logging/promtail-config.yaml`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/k8s/logging/promtail-config.yaml)), and structured JSON logging with trace/span context ([`app/core/logging.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/core/logging.py)). |
| **DB Migration Scripts** | Version-controlled schema migrations | ✅ **DONE** | Alembic versioned schema with 37 reversible migrations in [`alembic/versions/`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/alembic/versions) (migration head: `0036_item_master`). |

---

### Category 8: 📋 Onboarding & Support

| Module | Description | Status | Verification & Codebase Reality |
| :--- | :--- | :---: | :--- |
| **Supplier Onboarding Wizard** | Step-by-step registration & KYC flow | ✅ **DONE** | 8-step self-registration wizard ([`apps/supplier-portal/app/register/[token]/page.tsx`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/procurement-portal-frontend/apps/supplier-portal/app/register/%5Btoken%5D/page.tsx)) covering company information, tax verification (GST/PAN), bank details, categories, document compliance, and review. |
| **Buyer Onboarding** | Company setup, team invite, budget config | 🟡 **PARTIAL** | Organization, legal entities, business units, cost centers, team invites, and approval thresholds can be configured via the Admin Portal, but they exist across separate administration pages rather than a single guided setup wizard. |
| **Help Center / Knowledge Base** | FAQs, video tutorials per portal | ❌ **MISSING** | No in-portal FAQ, video tutorial, or knowledge base module exists. |
| **Support Ticket System** | Raise & track issues from within the portal | ❌ **MISSING** | While invoice dispute messaging threads exist ([`apps/buyer-portal/.../invoices/disputes/page.tsx`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/procurement-portal-frontend/apps/buyer-portal/app/%28main%29/invoices/disputes/page.tsx)), there is no general platform/IT support ticketing system. |
| **SLA Tracker** | Track support response & resolution times | 🟡 **PARTIAL** | Comprehensive SLA tracking and visual indicators exist for procurement workflow tasks, approvals, and unmapped PRs ([`packages/ui/src/SLAIndicator.tsx`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/procurement-portal-frontend/packages/ui/src/SLAIndicator.tsx)), but not for customer/IT support tickets. |

---

### Category 9: 🏢 Multi-Company / Multi-Tenant Support

| Module | Description | Status | Verification & Codebase Reality |
| :--- | :--- | :---: | :--- |
| **Company Switcher** | Toggle between the 2 companies seamlessly | 🟡 **PARTIAL** | Users authenticate with an `org_id` ([`packages/stores/src/authStore.ts`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/procurement-portal-frontend/packages/stores/src/authStore.ts)), but there is no fast UI dropdown/switcher to toggle between organizations in the navigation bar without re-authenticating. |
| **Tenant Isolation** | Ensure data is fully separated per company | ✅ **DONE** | Enforced at both the application layer (mandatory `org_id` on [`BaseModel`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/db/base.py)) and at the database engine level via PostgreSQL Row-Level Security policies ([`alembic/versions/0025_rls.py`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/alembic/versions/0025_rls.py)). |
| **Cross-Company Reports** | Consolidated view for a super-admin | ❌ **MISSING** | All analytics endpoints strictly scope queries to the caller's `org_id`; no consolidated super-admin cross-company roll-up report exists. |
| **Branding per Tenant** | Logo, color theme, domain per company | 🟡 **PARTIAL** | The [`Organization`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/app/modules/organization/models.py#L21) model stores JSONB `settings` for per-tenant configurations and the frontend has theme switching, but dynamic per-tenant white-label branding (custom logo, colors, and domains per tenant) is not wired to the UI. |

---

## 4. Recommended Cycle 2 Roadmap & Implementation Plan

Based on the audit, the 11 missing modules and 14 partial modules should be tackled in 4 focused sprints:

### Sprint 1: Multi-Company UX & Developer Platform Foundation
- **Company Switcher**: Add an active Organization Switcher dropdown in the top navbar allowing authorized multi-org users to swap active tenant context without re-login.
- **API Key Management**: Create `api_keys` model, migration, generation, hashing, and revocation API endpoints with permissions.
- **Webhook Management UI**: Build an interactive developer testing tab in the Admin Portal for triggering test webhook payloads and inspecting delivery history.

### Sprint 2: Support & Knowledge Layer
- **Support Ticket System**: Build a universal `tickets` module (Backend + UI) enabling users from any portal to raise, categorize, and track system or operational issues.
- **Help Center / Knowledge Base**: Add an embedded `/help` route in all portals with searchable FAQs, workflow diagrams, and onboarding guides.
- **Unified Buyer Onboarding Wizard**: Package Organization, Legal Entity, Business Unit, Cost Center, and Team Invitations into a single step-by-step wizard.

### Sprint 3: Advanced Integrations & Accounting
- **Accounting Connectors**: Add outbound sync adapters for Tally (XML/ODBC format) and Zoho Books / QuickBooks REST APIs.
- **Cross-Company Reports**: Create a Superadmin-only analytics route that rolls up spend, vendor compliance, and procurement cycle metrics across all tenant organizations.

### Sprint 4: Compliance & External Vaulting
- **Compliance Dashboard**: Build an interactive compliance tracking dashboard for GDPR, ISO 27001, and SOC2 audit requirements with evidence attachment uploads.
- **Vault Integration**: Add optional HashiCorp Vault or AWS Secrets Manager client support for dynamic credential leasing.
