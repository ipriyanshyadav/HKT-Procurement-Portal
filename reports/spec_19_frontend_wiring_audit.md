# SPEC AUDIT REPORT — SPEC_19: Frontend Applications & Wiring Master Audit
**MODULE:** 19 | **SPECS:** SPEC_19_FRONTEND.md & FRONTEND_BACKEND_WIRING_GUIDE.md | **DATE:** 2026-09-05
**Squad:** Squad E (Engine & Frontend) | **Status:** COMPLETE (100%)

---

## 1. FRONTEND_BACKEND_WIRING_GUIDE.md Rule-by-Rule Compliance

| Rule # | Requirement | Status | Evidence |
|---|---|---|---|
| Rule 1 | Types First — Generated from OpenAPI | DONE | `packages/types/generate.ts` generates schema types directly from FastAPI OpenAPI JSON into `@procurement/types` |
| Rule 2 | Response Envelope Matching | DONE | All hooks in `packages/hooks/` destructure `response.data.data` (e.g. `useRequisitions`, `useRfqs`, `useInvoices`, `usePurchaseOrders`) |
| Rule 3 | Docker Network Service Naming | DONE | All frontend apps configure `INTERNAL_API_URL: http://api:8000` for SSR and `NEXT_PUBLIC_API_URL` for browser |
| Rule 4 | Environment Variable Contract | DONE | Prefix `NEXT_PUBLIC_` strictly followed for browser-accessible vars; `.env.example` present in all apps |
| Rule 5 | Auth Flow: HttpOnly Cookie + In-Memory Token | DONE | `packages/stores/src/authStore.ts` keeps access token in Zustand memory. Zero JWT in localStorage/sessionStorage. `packages/utils/src/api.ts` implements 401 refresh queue |
| Rule 6 | WebSocket Wiring | DONE | `/ws/auction/{auction_id}` implemented in `useAuctionSocket.ts` with heartbeat, auto-reconnect, and token authentication |
| Rule 7 | snake_case Naming Consistency | DONE | DB columns, FastAPI response schemas, and TypeScript interfaces remain strictly in `snake_case` |
| Rule 8 | Form Submission Shape Matches Pydantic | DONE | React Hook Form & Zod schemas match Pydantic schemas across PR, RFQ, Bid, PO, Contract, and Invoice submissions |
| Rule 9 | Standard Pagination Query Params | DONE | `page`, `page_size`, `sort_by`, `sort_dir`, `status` handled uniformly across TanStack queries |
| Rule 10 | Docker-Compose Startup Order | DONE | `docker/docker-compose.yml` ensures backing services become healthy before backend and frontends start |
| Rule 11 | Presigned MinIO Document URLs | DONE | Presigned 15-minute URLs fetched via `GET /documents/{id}/presigned-url`; no direct MinIO URLs exposed to client |
| Rule 12 | Permission Guard on Protected UI Elements | DONE | `<PermissionGuard permission="...">` wraps all privileged action buttons (Approve, Submit, Convert, Publish, Blacklist, etc.) |

---

## 2. Portal-by-Portal Feature & Button Availability Audit

### 2.1 Buyer Portal (`apps/buyer-portal`) — Port 3000
- **Requisitions (`/requisitions`)**:
  - List view with status/scope filtering and bulk selection.
  - "+ New Requisition" button (`/requisitions/new`) with line items, CategoryTreeSelect, UOMSelect, budget indicator, and submit/draft actions.
  - Detail view (`/requisitions/[id]`) with "Submit for Approval", "Withdraw", "Convert to RFQ", "Convert to PO", "Split PR", and WorkflowTimeline.
  - "Merge PRs" button active when multiple PRs selected.
  - CSV Import (`/requisitions/import`) with batch upload.
- **Unmapped PRs (`/unmapped-prs`)**:
  - SLA tier indicators (Tier 1-4).
  - "Manual Mapping" modal with CategoryTreeSelect and resolution notes.
  - "Auto-Map" button enforcing confidence threshold >= 0.85.
- **Vendors (`/vendors`)**:
  - "+ Invite Vendor" button leading to email invite form.
  - Detail view (`/vendors/[id]`) with action buttons: Qualify, Activate, Reject, Resubmit, Suspend, Reinstate, Initiate Blacklist, Confirm Blacklist, Penny Test modal, Scorecard, and Document vault.
- **RFQs & Tenders (`/rfqs`)**:
  - "+ New RFQ" button with lots, lines, and bid deadline validation.
  - Workspace (`/rfqs/[id]`) with "Publish RFQ" button, "Invite Participants" modal, "⚡ Live Auction Room" link, "Dual-Auth Bid Opening" link, and "📊 Evaluation & CS" link.
  - Dual-Auth Bid Opening (`/rfqs/[id]/open-bids`) with Step 1 Initiate and Step 2 Co-Authorize buttons.
  - Evaluation & CS (`/rfqs/[id]/evaluation`) with "Generate CS" button, ComparativeStatementTable, "Negotiate Selected" button, and "Recommend Award" button.
  - Award Console (`/rfqs/[id]/award`) with L1 auto-prefill, custom allocations, "Recommend Award", "Approve Award", and "Send Regret Letters" buttons.
  - Live Auction Room (`/rfqs/[id]/auction`) with Start, Pause, Cancel, Release Results, and real-time leaderboard.
- **Contracts (`/contracts`)**:
  - "+ New Contract" button with rate contract lines, milestones, auto-renewal settings.
  - Contract Workspace (`/contracts/[id]`) with "Submit for Review", "Approve Contract", "Return" modal, "Initiate eSign", "Confirm eSign", "Amend Contract" modal, and "Create PO" link.
- **Purchase Orders (`/purchase-orders`)**:
  - "+ New PO" button with rate contract picker and line items.
  - PO Workspace (`/purchase-orders/[id]`) with "Approve PO", "Send to Vendor", "Cancel PO" modal, "Download PDF", and "Create Goods Receipt (GRN)" link.
- **Goods Receipts (`/grn`)**:
  - Receipt Console (`/grn/new`) with PO selector, challan, LR, transporter, per-line received quantities, and QC inspection flags.
- **Invoices (`/invoices`)**:
  - Invoice Workspace (`/invoices/[id]`) with ThreeWayMatchResult table, "Approve Invoice", "Reject" modal, "Raise Dispute" modal, and "Re-run Match" button.
  - Dispute Inbox (`/invoices/disputes`) with resolution threads.
- **Payments (`/payments`)**:
  - Scheduled payment records, gross/TDS/net breakdown, and settlement tracking.
- **Workflow Tasks (`/tasks`)**:
  - Approval Task Inbox (`/tasks/[taskId]`) with "Approve", "Reject", and "Return" buttons, comment modal, and SLAIndicator.

### 2.2 Supplier Portal (`apps/supplier-portal`) — Port 3001
- **Registration (`/register/[token]`)**:
  - 8-step self-onboarding wizard validating token, company profile, banking, categories, and documents.
- **Tenders & Bidding (`/rfqs`)**:
  - Open RFQs list, countdown timers, and tender specs.
  - Bid Submission Terminal (`/rfqs/[id]/bid`) with per-line quoting, commercial terms, deviations, file upload, submit bid, revise bid, and withdraw bid buttons.
  - Live Auction Room (`/rfqs/[id]/auction`) with BidEntryPanel, decrement quick buttons, live rank banner, and countdown timer.
- **Purchase Orders (`/purchase-orders`)**:
  - PO list with "Acknowledge PO" button and "Reject PO" modal with reason.
- **Invoices (`/invoices`)**:
  - "+ New Invoice" form (`/invoices/new`) grouping eligible received PO lines, tax calculations, and invoice PDF upload.
  - Dispute Inbox (`/invoices/disputes`) for tracking disputed invoices.
- **Payments (`/payments`)**:
  - Remittance advice, scheduled settlement dates, and TDS deductions.
- **Profile & Documents (`/profile`, `/documents`)**:
  - Vendor profile view, bank account status, and compliance document vault with upload and expiry alerts.

### 2.3 Admin Portal (`apps/admin-portal`) — Port 3002
- **Dashboard (`/dashboard`)**:
  - System health KPIs, active workflows, and integration job metrics.
- **Users & Access (`/users`)**:
  - User directory, role assignment, and MFA status.
- **Approval Rules (`/approval-rules`)**:
  - Rules list, new rule form (`/approval-rules/new`), rule version history, and dry-run rule evaluation simulation.
- **Workflow Templates (`/workflows`)**:
  - Template catalog, step sequence editor, and parallel convergence configuration.
- **Master Data Hub (`/master-data`)**:
  - Dedicated consoles for Categories (hierarchical tree), Units of Measure, Currencies & FX rates, Payment Terms, Tax Codes, Delivery Locations, Holidays Calendar, and Bulk CSV Import with sample template downloads.
- **Integrations Hub (`/integrations`)**:
  - Outbox message queue monitor, ERP sync jobs, and adapter status.

---

## 3. Summary Score

```
MODULE | SPEC | DATE
SPEC_19 | SPEC_19_FRONTEND.md & FRONTEND_BACKEND_WIRING_GUIDE.md | 2026-09-05
OVERALL: 12/12 Wiring Rules (100%) | 3/3 Portals Fully Operational (100%) | TURBOREPO BUILD: PASS
```
