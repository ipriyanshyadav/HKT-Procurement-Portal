# 🔄 S2P Platform Workflow Document

> **Platform:** HKT Procurement Portal  
> **Version:** 2026-09-08  
> **Portals:** Buyer (3000) · Supplier (3001) · Admin (3002)  
> **Scope:** All 29 modules, all workflows, all role interactions

---

## Table of Contents
1. [Platform Overview](#1-platform-overview)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Workflow 1: Purchase Requisition (PR) Lifecycle](#3-workflow-1-purchase-requisition-pr-lifecycle)
4. [Workflow 2: RFQ / Sourcing Lifecycle](#4-workflow-2-rfq--sourcing-lifecycle)
5. [Workflow 3: Bid Submission & Evaluation](#5-workflow-3-bid-submission--evaluation)
6. [Workflow 4: Award & Purchase Order](#6-workflow-4-award--purchase-order)
7. [Workflow 5: GRN → Invoice → 3-Way Match → Payment](#7-workflow-5-grn--invoice--3-way-match--payment)
8. [Workflow 6: Reverse Auction](#8-workflow-6-reverse-auction)
9. [Workflow 7: Contract Lifecycle](#9-workflow-7-contract-lifecycle)
10. [Workflow 8: Vendor Onboarding](#10-workflow-8-vendor-onboarding)
11. [Workflow 9: Support Ticket](#11-workflow-9-support-ticket)
12. [Cross-Portal Real-Time Features](#12-cross-portal-real-time-features)
13. [Admin Configuration Workflows](#13-admin-configuration-workflows)

---

## 1. Platform Overview

The platform is a **Source-to-Pay (S2P)** procurement system organized into 3 web portals sharing a single FastAPI backend.

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUYER PORTAL (Port 3000)                      │
│  Roles: REQUESTOR · BUYER · PROCUREMENT_OFFICER · APPROVER      │
│         PROCUREMENT_HEAD · FINANCE_MANAGER · COST_CENTER_OWNER  │
│  Features: PR · RFQ · Evaluation · Award · PO · GRN             │
│            Contract · Invoice · Payment · Vendor Mgmt · Analytics│
│            Tickets · Tasks · Unmapped PRs · Notifications        │
├─────────────────────────────────────────────────────────────────┤
│                   SUPPLIER PORTAL (Port 3001)                    │
│  Roles: SUPPLIER                                                 │
│  Features: Tenders · Bid Submission · Live Auction               │
│            PO Acknowledgement · Invoice · Payment Track          │
│            Documents · Tickets · Profile                         │
├─────────────────────────────────────────────────────────────────┤
│                    ADMIN PORTAL (Port 3002)                      │
│  Roles: SUPERADMIN · ORG_ADMIN · PROCUREMENT_MANAGER            │
│  Features: User Mgmt · Master Data · Approval Rules             │
│            Workflows · Integrations · Audit Trail                │
│            System Health · Ticket Admin · Analytics              │
└─────────────────────────────────────────────────────────────────┘
                              │
                    FastAPI Backend :8080
                    PostgreSQL · Redis
                    RabbitMQ/Celery
                    MinIO · Elasticsearch
```

---

## 2. User Roles & Permissions

### Role Matrix

| Role | Create PR | Approve PR | Create RFQ | Publish RFQ | Open Bids | Award | Admin |
|------|-----------|------------|------------|-------------|-----------|-------|-------|
| REQUESTOR | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| BUYER | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| PROCUREMENT_OFFICER | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| APPROVER | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| PROCUREMENT_HEAD | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| FINANCE_MANAGER | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SUPPLIER | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| SUPERADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Portal Login Flow
```
User Opens Portal
    ↓
/login page renders (Next.js, App Router)
    ↓
Credentials OR SSO (OIDC/SAML)
    ├── POST /auth/login  (credentials)
    ├── GET  /auth/sso/initiate?provider=oidc  (Okta)
    └── GET  /auth/sso/initiate?provider=saml  (Azure AD)
    ↓
Backend returns:
  • access_token (JWT, 15 min, in memory)
  • refresh_token (httpOnly cookie, 7 days)
    ↓
MFA Challenge? (if MFA enrolled)
  → POST /auth/mfa/verify
    ↓
Zustand store: setAccessToken(jwt)
TanStack Query: GET /users/me + /users/me/permissions
    ↓
Middleware reads refresh_token cookie → allows access
Route renders with PermissionGuards active
```

---

## 3. Workflow 1: Purchase Requisition (PR) Lifecycle

**Portal:** Buyer  
**Participants:** Requestor, Approver, Procurement Head

```
REQUESTOR                    BACKEND                        APPROVER
    │                           │                              │
    ├─ Create PR (/new) ────────►│ POST /requisitions           │
    │  (line items, BU, category)│ status = DRAFT               │
    │                           │                              │
    ├─ Save Draft ──────────────►│ PUT /requisitions/:id        │
    │                           │                              │
    ├─ Submit ──────────────────►│ POST /:id/submit             │
    │                           │ status = PENDING_APPROVAL    │
    │                           │                              │
    │                           │ Approval Rules Engine:       │
    │                           │ - Evaluate IF-THEN rules     │
    │                           │ - Match by amount/BU/category│
    │                           │ - Create workflow instance   │
    │                           │ - Assign tasks to approvers  │
    │                           │                              │
    │                           ├──────────────────────────────►│ Notification sent
    │                           │ POST /notifications          │ (in-app + email)
    │                           │                              │
    │                           │                    ┌─────────┤
    │                           │           /tasks   │Approver reviews PR
    │                           │           inbox    │/tasks/[taskId]
    │                           │                    └─────────┤
    │                           │                              │
    │                           │◄─────────────────────────────┤ APPROVE
    │                           │ POST /requisitions/:id/approve│
    │                           │ status = APPROVED            │
    │◄──────────────────────────┤                              │
    │ Notification: PR Approved │                              │
    │                           │                              │
    ├─ Convert to RFQ ──────────►│ POST /:id/convert-to-rfq     │
    │  OR                       │ PR linked to new RFQ         │
    ├─ Convert to PO (direct) ──►│ POST /:id/convert-to-po      │
    │  (low-value items)        │ PR linked to new PO          │
```

### PR Status States
```
DRAFT → PENDING_APPROVAL → APPROVED → CONVERTED_TO_RFQ / CONVERTED_TO_PO
                        ↘ REJECTED
              ↘ WITHDRAWN (requestor cancels before approval)
APPROVED → AMENDING (edits after approval, re-triggers workflow)
```

### Advanced PR Operations
| Operation | Who | When | What Happens |
|-----------|-----|------|-------------|
| **Merge** | Procurement Officer | Multiple similar PRs | `/requisitions/merge` — combines lines into one PR |
| **Split** | Procurement Officer | One PR needs separate vendors | `/requisitions/:id/split` — creates child PRs |
| **Bulk Import** | Requestor/Buyer | ERP integration or CSV | `/requisitions/bulk` — multiple PRs in one call |
| **Amend** | Requestor | After rejection | `/requisitions/:id/amend` — new version, re-approves |
| **Audit Trail** | Anyone | Compliance | `/requisitions/:id/audit-trail` — full event history |

---

## 4. Workflow 2: RFQ / Sourcing Lifecycle

**Portal:** Buyer (create), Supplier (respond)  
**Participants:** Buyer, Procurement Officer, Vendors

```
BUYER PORTAL                 BACKEND                      SUPPLIER PORTAL
    │                           │                              │
    ├─ Create RFQ (/rfqs/new) ──►│ POST /rfqs                   │
    │  (linked to PR optional)   │ status = DRAFT               │
    │  (lots, line items, terms) │                              │
    │                           │                              │
    ├─ Add Vendors ─────────────►│ POST /rfqs/:id/add-participants
    │  (from vendor directory)   │                              │
    │                           │                              │
    ├─ Publish ─────────────────►│ POST /rfqs/:id/publish       │
    │                           │ status = PUBLISHED           │
    │                           │                              │
    │                           │ Notification dispatched ─────►│ New RFQ alert
    │                           │                              │
    │                           │                              ├─ View /rfqs
    │                           │                              │ (supplier-filtered)
    │                           │                              │
    │                           │        CLARIFICATION CYCLE   │
    │                           │◄─────────────────────────────┤ Ask Clarification
    │                           │ POST /rfqs/:id/clarifications│ (pre-bid query)
    │                           │                              │
    │◄──────────────────────────┤ Notification                 │
    │ New clarification asked   │                              │
    │                           │                              │
    ├─ Respond to clarification ►│ PUT /:id/clarifications/:cid/respond
    │                           │ is_published = true          │
    │                           ├──────────────────────────────►│ Clarification answered
    │                           │                              │
    ├─ Extend Deadline ─────────►│ POST /:id/extend-deadline    │
    │  (if insufficient bids)   │ New deadline set             │
    │                           │                              │
    │  AFTER BID_CLOSE_AT:      │                              │
    │                           │                              │
    ├─ Initiate Bid Opening ────►│ POST /:id/initiate-bid-opening
    │  (User A — not RFQ creator)│ Opening session started     │
    │                           │                              │
    ├─ Co-Authorize Opening ────►│ POST /:id/co-authorize-opening
    │  (User B — different user) │ Bids unsealed               │
    │                           │ status = EVALUATION          │
```

### RFQ Status States
```
DRAFT → PENDING_APPROVAL → APPROVED → PUBLISHED → EVALUATION → AWARDED / CANCELLED
                                              ↘ BID_CLOSING (deadline passed, pre-opening)
```

### RFQ Types Supported
| Type | Description |
|------|-------------|
| **OPEN** | Any approved vendor can bid |
| **LIMITED** | Only invited vendors |
| **SINGLE_VENDOR** | Direct PO scenario (special justification required) |
| **AUCTION** | Sealed bids followed by live reverse auction |

---

## 5. Workflow 3: Bid Submission & Evaluation

**Portal:** Supplier (bid), Buyer (evaluate)

```
SUPPLIER PORTAL              BACKEND                        BUYER PORTAL
    │                           │                              │
    ├─ View /rfqs/[id]/bid ─────►│ GET /rfqs/:id               │
    │  (after PUBLISHED status)  │ (supplier-scoped data)      │
    │                           │                              │
    ├─ Submit Sealed Bid ────────►│ POST /rfqs/:id/bids          │
    │  (line pricing, terms,     │ status = SUBMITTED           │
    │   deviations, validity)    │ bid_count++                  │
    │                           │                              │
    ├─ Revise Bid (before close) ►│ PUT /rfqs/:id/bids           │
    │                           │ new version stored           │
    │                           │                              │
    │  After Bid Opening:        │                              │
    │                           │                              │
    │                           │◄─────────────────────────────┤ POST /:id/generate-cs
    │                           │ /evaluations/rfq/:id/cs     │
    │                           │                              │
    │                           │ CS ENGINE:                   │
    │                           │ • Landed cost calculation    │
    │                           │ • NPV-adjusted cost          │
    │                           │ • Tax discrepancy flags      │
    │                           │ • L1/L2/L3 ranking per lot   │
    │                           │ • Savings % vs budget        │
    │                           │                              │
    │                           │►────────────────────────────►│
    │                           │ CS ready                     ├─ View Evaluation
    │                           │                              │  /rfqs/[id]/evaluation
    │                           │                              │
    │                           │◄─────────────────────────────┤ Shortlist vendors
    │                           │ POST /evaluations/:csId/shortlist
    │                           │                              │
    │                           │◄─────────────────────────────┤ Request Negotiation
    │                           │ POST /evaluations/:csId/negotiations
    │                           │                              │
    │◄──────────────────────────┤ Notification                 │
    │ Price revision requested  │                              │
    │                           │                              │
    ├─ Submit revised price ─────►│ POST /evaluations/negotiations/:id/submit-price
    │                           │                              │
    │                           │◄─────────────────────────────┤ Recommend Award
    │                           │ POST /evaluations/:csId/recommend-award
    │                           │ status = PENDING_APPROVAL    │
    │                           │                              │
    │                           │◄─────────────────────────────┤ Approve ARN
    │                           │ POST /evaluations/awards/:arnId/approve
    │                           │ status = APPROVED            │
    │                           │                              │
    ├─ Regret letter received ◄──┤ POST /send-regret-letters    │
    │  (if not awarded)         │ Email to non-winners         │
```

### Evaluation Scoring Model
```
Landed Cost = Unit Price + (Freight Per Unit) + (Tax Per Unit)
NPV-Adjusted = Landed Cost × payment_terms_discount_factor
Composite Score = (Commercial Score × w₁) + (Technical Score × w₂)
L1 Vendor = Lowest NPV-Adjusted composite score per lot
```

---

## 6. Workflow 4: Award & Purchase Order

**Portal:** Buyer (create), Supplier (acknowledge)

```
BUYER PORTAL                 BACKEND                      SUPPLIER PORTAL
    │                           │                              │
    ├─ PO from Award ───────────►│ POST /purchase-orders/from-award
    │  (ARN ID passed)          │ PO created (one per vendor) │
    │                           │ linked to rfq_id, award_id  │
    │                           │                              │
    ├─ PO Draft review ─────────►│ GET /purchase-orders/:id    │
    │                           │                              │
    ├─ Approve PO ──────────────►│ POST /purchase-orders/:id/approve
    │  (workflow if configured) │ status = APPROVED           │
    │                           │                              │
    ├─ Send to Vendor ──────────►│ POST /purchase-orders/:id/send-to-vendor
    │                           │ status = SENT_TO_VENDOR     │
    │                           │ Email sent via Celery        │
    │                           ├──────────────────────────────►│ PO appears in /purchase-orders
    │                           │ Notification pushed          │
    │                           │                              │
    │                           │                              ├─ View PO detail
    │                           │                              │  /purchase-orders/[id]
    │                           │                              │
    │                           │◄─────────────────────────────┤ Acknowledge PO
    │                           │ POST /purchase-orders/:id/acknowledge
    │                           │ {accepted: true}             │
    │                           │ status = ACKNOWLEDGED        │
    │                           │                              │
    │◄──────────────────────────┤ Notification                 │
    │ PO Acknowledged           │                              │
    │                           │                              │
    ├─ Amend PO ────────────────►│ POST /purchase-orders/:id/amend
    │  (if needed)              │ Amendment version created   │
```

### PO Status States
```
DRAFT → APPROVED → SENT_TO_VENDOR → ACKNOWLEDGED → PARTIALLY_RECEIVED → FULLY_RECEIVED → CLOSED
                               ↘ REJECTED (by vendor)
                 ↘ CANCELLED
```

### PO PDF Generation
```
GET /purchase-orders/:id/pdf
    ↓
Backend generates PDF (reportlab)
Returns {download_url: presigned_url, status}
Frontend opens presigned URL (15-min TTL)
```

---

## 7. Workflow 5: GRN → Invoice → 3-Way Match → Payment

**Portal:** Buyer (GRN + approval), Supplier (invoice submission)

```
BUYER PORTAL                 BACKEND                      SUPPLIER PORTAL
    │                           │                              │
    │  Goods arrive physically   │                              │
    │                           │                              │
    ├─ Create GRN ──────────────►│ POST /grn                    │
    │  (/grn/new)               │ GRN linked to PO             │
    │  (qty received, condition) │                              │
    │                           │                              │
    ├─ Inspection ──────────────►│ POST /grn/:id/inspection     │
    │  (QA results)             │ Accept/Reject by line        │
    │                           │                              │
    ├─ Confirm GRN ─────────────►│ POST /grn/:id/confirm        │
    │                           │ status = CONFIRMED           │
    │                           │ Invoiceable lines updated    │
    │                           │                              │
    │  SUPPLIER SUBMITS INVOICE: │                              │
    │                           │                              │
    │                           │◄─────────────────────────────┤ GET eligible lines
    │                           │ GET /invoices/eligible-lines │ (vendor's PO lines)
    │                           │                              │
    │                           │◄─────────────────────────────┤ Submit Invoice
    │                           │ POST /invoices               │
    │                           │ 3-way match triggered AUTO   │
    │                           │                              │
    │                           │ 3-WAY MATCH ENGINE:          │
    │                           │ For each line:               │
    │                           │ • price_match (vs PO)        │
    │                           │ • quantity_match (vs GRN)    │
    │                           │ • tax_match (vs Tax Master)  │
    │                           │ • overall_match (pass/fail)  │
    │                           │ Tolerance checks applied     │
    │                           │                              │
    │◄──────────────────────────┤ Notification: New Invoice    │
    │                           │                              │
    ├─ Review Invoice ──────────►│ GET /invoices/:id            │
    │  (/invoices/[id])         │ match_results visible        │
    │                           │                              │
    │  IF MATCH PASS:            │                              │
    │                           │                              │
    ├─ Approve Invoice ─────────►│ POST /invoices/:id/approve   │
    │                           │ status = APPROVED            │
    │                           │ Payment entry auto-created   │
    │                           │                              │
    │  IF MATCH FAIL:            │                              │
    │                           │                              │
    ├─ Dispute Invoice ─────────►│ POST /invoices/:id/dispute   │
    │                           │ status = DISPUTED            │
    │                           ├──────────────────────────────►│ Dispute notification
    │                           │                              │
    │                           │                              ├─ View /invoices/disputes
    │                           │                              │ Reply to dispute
    │                           │                              │
    │                           │ PAYMENT SCHEDULING:          │
    │                           │                              │
    ├─ Schedule Payment ────────►│ POST /payments/schedule      │
    │                           │ Payment date per terms       │
    │                           │                              │
    │  ERP processes payment:    │                              │
    │                           │                              │
    │  ERP webhook ─────────────►│ POST /payments/webhook/erp   │
    │                           │ status = PROCESSED           │
    │                           │ remittance PDF generated     │
    │                           ├──────────────────────────────►│ Payment notification
    │                           │                              │
    │                           │                              ├─ /payments
    │                           │                              │ Download remittance PDF
```

### 3-Way Match Tolerance Configuration
```
Price tolerance: ±2% deviation (configurable via Settings)
Quantity tolerance: Accepted ≥ Ordered (no overbilling)
Tax tolerance: Declared rate vs Master rate ± threshold
Result: MATCH / PARTIAL_MATCH / MISMATCH (with discrepancy detail)
```

---

## 8. Workflow 6: Reverse Auction

**Portal:** Both Buyer and Supplier simultaneously  
**Technology:** WebSocket `WS /ws/auction/{auction_id}`

```
BUYER                        BACKEND                        SUPPLIERS
    │                           │                              │
    │  (RFQ must be AUCTION type)│                              │
    │                           │                              │
    ├─ Start Auction ───────────►│ POST /auction/rfqs/:id/start │
    │  /rfqs/[id]/auction       │ auction_id created           │
    │                           │ countdown_seconds set        │
    │                           │                              │
    │                           │ WS broadcast: AUCTION_STARTED│
    │                           ├──────────────────────────────►│ WS connected
    │                           │                              │ /rfqs/[id]/auction
    │                           │                              │
    │  Real-time leaderboard    │                              │
    │  ┌────────────────┐       │                  ┌──────────┐│
    │  │ Rank │ Vendor  │       │  CURRENT PRICE   │BidEntry  ││
    │  │  L1  │ A: ₹90 │       │      ₹90.00       │Panel     ││
    │  │  L2  │ B: ₹95 │       │  Time: 02:30      └──────────┘│
    │  │  L3  │ C:₹100 │       │                              │
    │  └────────────────┘       │                              │
    │                           │◄─────────────────────────────┤ Counter-bid: ₹88
    │                           │ POST /auction/:id/bid        │
    │                           │ Validate > current floor     │
    │                           │ WS broadcast: PRICE_UPDATE   │
    │                           │                              │
    │  Live leaderboard updates │                              │ My rank: L1
    │                           │                              │
    │                           │◄─────────────────────────────┤ Set Proxy Floor: ₹85
    │                           │ POST /auction/:id/proxy-floor │
    │                           │ Auto-bid if outbid           │
    │                           │                              │
    │  Countdown expires ───────►│ Auction closes               │
    │                           │ Final L1 vendor determined   │
    │                           │ WS broadcast: AUCTION_ENDED  │
    │                           │                              │
    ├─ Close Auction ───────────►│ POST /auction/:id/close      │
    │                           │ Auction bids → CS evaluation │
```

### Auction Features
| Feature | Description |
|---------|-------------|
| **Countdown Timer** | Shared `AuctionCountdownTimer` component (buyer + supplier) |
| **Leaderboard** | Real-time ranking visible to buyer; supplier sees only own rank |
| **Proxy Floor** | Auto-bidder kicks in when outbid, stops at floor price |
| **Extension Logic** | Timer extends if bid placed in last 2 minutes |
| **Anti-Sniping** | Configurable extension window prevents last-second bids |

---

## 9. Workflow 7: Contract Lifecycle

**Portal:** Buyer

```
Contract Creation
    ↓
Option A: From RFQ Award
    └── POST /contracts/from-award (uses ARN)
    
Option B: From Template
    └── GET /contracts/templates → POST /contracts
    
Option C: Standalone
    └── POST /contracts (manual entry)
    ↓
                        DRAFT
                          ↓
        POST /:id/submit-review
                          ↓
                    UNDER_REVIEW
                          ↓
        POST /:id/approve (L1) + POST /:id/approve (L2 if configured)
                          ↓
                      APPROVED
                          ↓
        POST /:id/initiate-esign (Digio/DocuSign)
        → External: Signatories receive email
        → Webhook: POST /contracts/esign/webhook
        → POST /:id/confirm-esign
                          ↓
                      ACTIVE ← signed document stored in MinIO
                          ↓
             Contract runs → Milestone tracking
             POST /contracts/milestones/:id/complete
                          ↓
              Expiry alerts (Celery Beat runs daily)
              → 90 days, 60 days, 30 days alerts
                          ↓
              Renew (new contract) or EXPIRED
```

### Contract Amendment Workflow
```
ACTIVE contract
    ↓
POST /contracts/:id/amend  {amendment_reason, terms_changes}
    ↓
Original contract: status = AMENDING
New amendment record created
    ↓
Amendment approved → ACTIVE (with version++)
```

### Contract Utilization Tracking
```
POST /contracts/:id/utilization {amount_utilized}
    → contract.utilization_to_date += amount
    → contract.remaining_value = total_value - utilization
    → Alert if > 80% utilized
```

---

## 10. Workflow 8: Vendor Onboarding

**Portal:** Admin (invite), Supplier (register), Buyer (qualify/activate)

```
ADMIN/BUYER PORTAL          BACKEND                      SUPPLIER PORTAL
    │                           │                              │
    ├─ Invite Vendor ───────────►│ POST /vendors/invite         │
    │  /vendors/invite          │ {email, categories}          │
    │                           │ Token generated (UUID)       │
    │                           │ Invitation email sent ───────►│
    │                           │                              │
    │                           │                              ├─ Click email link
    │                           │                              │ /register/{token}
    │                           │                              │
    │                           │◄─────────────────────────────┤ Step 1: Company Info
    │                           │ GET /vendors/invitation/:token│ (validate token)
    │                           │                              │
    │                           │◄─────────────────────────────┤ 8-Step Wizard
    │                           │ POST /vendors/register/:token│ Company, Tax, Contacts,
    │                           │ (initial create)             │ Banking, Categories,
    │                           │                              │ Compliance docs
    │                           │                              │
    │                           │◄─────────────────────────────┤ Submit Registration
    │                           │ POST /vendors/:id/submit     │
    │                           │ status = SUBMITTED           │
    │                           │                              │
    │◄──────────────────────────┤ Notification                 │
    │ New vendor submitted      │                              │
    │                           │                              │
    ├─ Review Vendor ───────────►│ GET /vendors/:id             │
    │  /vendors/[id]            │                              │
    │                           │                              │
    ├─ Qualify Vendor ──────────►│ POST /vendors/:id/qualify    │
    │  (L1 qualification)       │ status = QUALIFIED           │
    │                           │                              │
    ├─ Penny Test (optional) ────►│ POST /vendors/:id/bank-accounts
    │  Bank verification        │ POST /:id/initiate-penny-test│
    │                           │ POST /:id/confirm-penny-test │
    │                           │                              │
    ├─ Activate Vendor ─────────►│ POST /vendors/:id/activate   │
    │                           │ status = ACTIVE              │
    │                           ├──────────────────────────────►│ Vendor can now bid
    │                           │ Welcome email                │
```

### Vendor Status States
```
INVITED → REGISTERED → SUBMITTED → QUALIFIED → ACTIVE
                               ↘ REJECTED
                                         ↘ SUSPENDED → REINSTATED → ACTIVE
                                                   ↘ BLACKLISTED (2-step: initiate + confirm)
```

### Vendor Scorecard (Performance Monitoring)
```
GET/POST /vendors/:id/scorecard
Metrics tracked:
  • On-time delivery rate
  • Quality acceptance rate (from GRN inspections)
  • Invoice accuracy rate
  • Response time on RFQs
Score: 0-100, auto-calculated from historical data
```

---

## 11. Workflow 9: Support Ticket

**Portal:** All three portals (create, manage, resolve)  
**Cross-portal:** Tickets linked to any entity (PR, RFQ, PO, Invoice, Contract)

```
ANY PORTAL                   BACKEND                      ANY PORTAL
    │                           │                              │
    ├─ Create Ticket ───────────►│ POST /tickets                │
    │  (or from entity context) │ {type, priority, entity_id}  │
    │                           │                              │
    │                           │ Automation Rules Engine:     │
    │                           │ • IF priority=HIGH AND       │
    │                           │   type=INVOICE_DISPUTE       │
    │                           │   THEN assign to finance     │
    │                           │ Rules run async via Celery   │
    │                           │                              │
    │                           │ SLA Timer starts:            │
    │                           │ • URGENT: respond in 4h     │
    │                           │ • HIGH: respond in 8h       │
    │                           │ • MEDIUM: respond in 24h    │
    │                           │ • LOW: respond in 48h       │
    │                           │                              │
    │                           ├──────────────────────────────►│ ASSIGNED agent notified
    │                           │                              │
    │                           │                    ┌─────────┤ Agent assigns
    │                           │                    │         │ POST /tickets/:id/assign
    │                           │                    └─────────┤
    │                           │                              │
    │                           │ Status Machine:              │
    │                           │ OPEN → IN_PROGRESS → PENDING_RESPONSE
    │                           │      → RESOLVED → CLOSED
    │                           │                              │
    │  Add comments (public) ───►│ POST /tickets/:id/comments   │
    │  Add notes (internal) ────►│ POST (is_internal=true)      │
    │  (supplier can't see)     │                              │
    │                           │                              │
    │                           │                              ├─ CLOSE Ticket
    │                           │                              │ POST /:id/close
    │                           │                              │ CSAT rating captured
    │                           │                              │
    ├─ Jira-style links ────────►│ POST /tickets/:id/links      │
    │  (blocks/is-blocked-by)   │                              │
    │                           │                              │
    ├─ Escalate ────────────────►│ POST /tickets/:id/escalate   │
    │  (SLA breach)             │ New assignee notified        │
```

### Ticket Types
| Type | Portal Available | Description |
|------|-----------------|-------------|
| GENERAL | All | General query |
| INVOICE_DISPUTE | Buyer + Supplier | Payment/invoice issue |
| VENDOR_QUERY | Buyer + Supplier | Vendor onboarding query |
| TECHNICAL_SUPPORT | Admin | System technical issue |
| CONTRACT_QUERY | Buyer | Contract clarification |
| DELIVERY_ISSUE | Buyer + Supplier | GRN/logistics issue |

### Ticket Custom Fields (EAV)
```
Admin Portal /tickets/custom-fields defines schema:
  • field_name: "ERP PO Number"
  • field_type: TEXT | NUMBER | DATE | SELECT | MULTISELECT
  • ticket_types: [INVOICE_DISPUTE]
  • is_required: true

When ticket of type INVOICE_DISPUTE is created/viewed:
  GET /tickets/custom-fields/definitions?ticket_type=INVOICE_DISPUTE
  Custom fields rendered dynamically
  Values stored: POST /tickets/:id/custom-fields
```

---

## 12. Cross-Portal Real-Time Features

### WebSocket Notification System
```
All Portals → Root Layout → useNotifications hook
    ↓
WS /ws/notifications?token={jwt}
    ↓
Backend checks JWT, subscribes to user-channel in Redis Pub/Sub
    ↓
Events published by backend services:
  • PR approved/rejected
  • RFQ published / deadline extended
  • New bid received (count only)
  • Bids opened
  • PO sent / acknowledged
  • Invoice submitted / approved / disputed
  • Ticket assigned / commented
  • Payment processed
    ↓
NotificationBell component updates badge count
    ↓
/notifications page shows full inbox
POST /notifications/:id/read → marks as read
POST /notifications/mark-all-read → clears badge
```

### Live Auction WebSocket
```
Both portals simultaneously:
  WS /ws/auction/{auction_id}?token={jwt}

Events:
  AUCTION_STARTED  → render auction UI
  PRICE_UPDATE     → update leaderboard
  TIMER_UPDATE     → countdown sync
  PROXY_BID_PLACED → automated bid notification
  AUCTION_EXTENDED → timer reset
  AUCTION_ENDED    → show final results
```

### Cache Invalidation Pattern
```
TanStack Query manages client-side cache:
  1. Mutation succeeds (e.g., POST /purchase-orders/:id/approve)
  2. onSuccess callback: queryClient.invalidateQueries(['purchase-orders', id])
  3. Next render: data re-fetched from backend
  4. UI shows updated state instantly

Stale time: 30s for lists, 60s for details
Background refetch: enabled on window focus
```

---

## 13. Admin Configuration Workflows

### Master Data Setup (One-Time)
```
Admin Portal → Master Data Hub

1. /master-data/categories
   POST /master-data/categories
   → Available in: PR category picker, Vendor category mapping, Analytics

2. /master-data/uom
   POST /master-data/uom
   → Available in: PR line items, PO lines

3. /master-data/currencies  
   POST /master-data/currencies
   → Available in: PR currency, Bid currency, Contract currency

4. /master-data/tax-codes
   POST /master-data/tax-codes
   → Available in: Invoice tax validation, 3-way match tolerance

5. /master-data/payment-terms
   POST /master-data/payment-terms
   → Available in: Vendor terms, PO terms, NPV calculation

6. /master-data/locations
   POST /master-data/delivery-locations
   → Available in: PR delivery, PO delivery

7. /master-data/holidays
   POST /master-data/holidays/:year
   → Used in: SLA calculation (business days), auction scheduling

Bulk Import: POST /master-data/import/:entity (CSV)
Import Status: GET /master-data/import/jobs/:jobId (polling)
```

### Approval Rules Configuration
```
Admin Portal → /approval-rules

Create Rule (BRE Engine):
  IF:
    estimated_amount > 100000 AND
    category_code IN ['IT', 'HARDWARE']
  THEN:
    workflow_template = 'it-procurement-workflow'
    priority = 1

Rule evaluation (highest priority wins):
  POST /approval-rules/simulate {context: {amount, category, bu_id}}
  → Returns which rule matches, which workflow triggers

Activate/Deactivate:
  POST /approval-rules/:id/activate
  POST /approval-rules/:id/deactivate
```

### Workflow Template Design
```
Admin Portal → /workflows

Create Template:
  Steps:
    1. HOD Approval (role: DEPT_HEAD, timeout: 2 days)
    2. Finance Review (role: FINANCE_MANAGER, timeout: 1 day)
    3. Procurement Head (role: PROCUREMENT_HEAD, timeout: 2 days)

Each step:
  • Approver: specific user OR role (any member)
  • Timeout: auto-escalate after N days
  • Can Return: yes/no (send back to previous step)
  • Can Delegate: yes/no (user OOO delegation)

Simulate: POST /workflows/simulate
  → Preview approval chain without running it
```

### ERP Integration Configuration
```
Admin Portal → /integrations/settings

Configure:
  • ERP type: SAP / Oracle / Custom
  • API endpoint: https://erp.company.com/api
  • Auth: API Key / OAuth2
  • Sync schedule: cron expression

Monitor:
  /integrations → Scheduled run history
  /integrations/[id] → Job details, error logs
  POST /integrations/jobs/:id/retry → Manual retry
  POST /integrations/sync/trigger → Force immediate sync
```

---

## Summary: Platform Interconnection Map

```
                    ┌──── ADMIN PORTAL ────┐
                    │ Master Data Setup     │
                    │ User/Role Management  │
                    │ Approval Rules BRE    │
                    │ Workflow Templates    │
                    │ Integrations Config   │
                    │ Audit Trail           │
                    │ Ticket Administration │
                    └──────────┬───────────┘
                               │ Configures
                               ▼
┌─────── BUYER PORTAL ────────────────────────── SUPPLIER PORTAL ──┐
│                               │                                   │
│ PR → RFQ → Evaluation → Award │◄────── Bids ──────────────────────│
│  ↓         ↓           ↓     │                                   │
│  GRN ← PO ← Contract        │────── PO Acknowledge ─────────────►│
│  ↓                           │                                   │
│  Invoice Match ──────────────│◄───── Invoice Submit ─────────────│
│  ↓                           │                                   │
│  Payment Approve ────────────│────── Remittance PDF ─────────────►│
│  ↓                           │                                   │
│  Tickets ────────────────────│◄────── Support Queries ───────────│
│                               │                                   │
│  Analytics + Audit Trail      │        Notifications (WebSocket)  │
└───────────────────────────────────────────────────────────────────┘
```

**The platform achieves full S2P digitization** with real-time synchronization between portals, automated workflow routing, and compliance-grade audit trails on every action.

---

*Document generated by Antigravity AI Platform Analysis | 2026-09-08*
