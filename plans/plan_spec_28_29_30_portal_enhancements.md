# 🏗️ Comprehensive Implementation Plan
## Indentor Role (SPEC_30) + New Modules (SPEC_26, 27, 28, 29)
**Project:** HKT Procurement Portal (S2P)
**Generated:** 2026-09-14 | **Status:** READY FOR IMPLEMENTATION

---

> [!IMPORTANT]
> **Current State (from README §Current Session State):** Indentor Role **partially implemented** — DB migration `0054_indentor_role.py` done, constants, schemas, service, router endpoints (`/indent`, `/indent/from-cart`, `/indent/tracking`, `/indent/buyers`), frontend pages `/indents` and `/indents/tracking`, hooks, seed script all complete. 10/10 tests passing.
>
> **This plan covers:**
> 1. **SPEC_30 — Indentor Role Phase 2** (Catalog Search, Deep Cart UX, Consignee GRN flow, Advanced Tracking, Notifications)
> 2. **SPEC_26 — Ticket & Query Management System** (in-portal Jira-style tickets)
> 3. **SPEC_27 — Portal Enhancements** (10 modules: Company Switcher, Onboarding Wizard, Cross-Company Reports, Webhooks, API Keys, Branding, Export Center, Buyer Activity, UAT Role, Payment Gateway)
> 4. **SPEC_28 — Developer Platform** (standalone developer.procureos.com)
> 5. **SPEC_29 — Support App** (standalone support.procureos.com helpdesk)

---

## 📊 SPEC COVERAGE MAP — MASTER

| SPEC | Title | Backend % | Frontend % | Tests % | Status |
|---|---|---|---|---|---|
| SPEC_30 | Indentor Role Phase 2 | 55% | 45% | 40% | PARTIAL |
| SPEC_26 | Ticket System | 0% | 0% | 0% | PLANNED |
| SPEC_27-A | Company Switcher | 0% | 0% | 0% | PLANNED |
| SPEC_27-B | Onboarding Wizard | 0% | 0% | 0% | PLANNED |
| SPEC_27-C | Cross-Company Reports | 0% | 0% | 0% | PLANNED |
| SPEC_27-D | Webhook Management | 0% | 0% | 0% | PLANNED |
| SPEC_27-E | API Key Management | 0% | 0% | 0% | PLANNED |
| SPEC_27-F | Branding per Tenant | 0% | 0% | 0% | PLANNED |
| SPEC_27-G | Export Center | 0% | 0% | 0% | PLANNED |
| SPEC_27-H | Buyer Activity Report | 0% | 0% | 0% | PLANNED |
| SPEC_27-I | UAT Overlay | 0% | 0% | 0% | PLANNED |
| SPEC_27-J | Payment Gateway | 0% | 0% | 0% | PLANNED |
| SPEC_28 | Developer Platform | 0% | 0% | 0% | PLANNED |
| SPEC_29 | Support App | 0% | 0% | 0% | PLANNED |

---

## ASSUMPTIONS LOG (SPEC_30 — Indentor Phase 2)

| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-30-1 | Catalog search reuses GET /api/v1/catalog/items with added indentor_mode=true query param | Spec: catalog search; BU scope not specified | MEDIUM | Squad B |
| A-30-2 | Indent Cart persisted server-side in indent_carts table (not browser session) — one active cart per indentor | GeM model; browser carts are fragile | MEDIUM | Squad B |
| A-30-3 | Consignee GRN confirmation: POST /api/v1/grn/{id}/consignee-confirm new endpoint; no new tables | SPEC_14 GRN module exists | LOW | Squad B |
| A-30-4 | PRC maps to GRN.status=DRAFT, CRAC maps to GRN.status=ACCEPTED | Aligns with GeM model and existing GRN statuses | LOW | Squad B |
| A-30-5 | Buyer hand-off notification uses existing procurement.notification RabbitMQ exchange; new routing key indent.transferred | Reuse existing infra | LOW | Squad E |
| A-30-6 | Indentor cannot approve own indent even if has APPROVER role (Maker-Checker SOD rule from SPEC_06) | SOD compliance | HIGH | Squad B |
| A-30-7 | Catalog items shown to Indentor filtered by category_id IN (indentor's allowed categories) | Least-privilege principle | MEDIUM | Squad B |
| A-30-8 | Max 50 line items per indent cart; enforced at service layer and frontend | Mirrors PR limit | LOW | Squad B |

---

## ASSUMPTIONS LOG (SPEC_26 — Ticket System)

| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-26-1 | @mention autocomplete fetches GET /api/v1/users?search={q}&active=true; results cached 60s; same-org only | Spec 8.1 — no dedicated mention API | LOW | Squad E |
| A-26-2 | Markdown rendered client-side via react-markdown + remark-gfm | Spec says markdown supported; location unspecified | LOW | FE Lead |
| A-26-3 | ES search uses multi_match on title(x3), ticket_number(x5), description(x2), entity_number(x4), tags(x2) min_score=0.3 | Spec 14 ES-backed; query params unspecified | LOW | Squad E |
| A-26-4 | Kanban uses @dnd-kit/core + @dnd-kit/sortable (react-beautiful-dnd unmaintained since 2022) | Spec says DnD; library unspecified | LOW | FE Lead |
| A-26-5 | Ticket sequence seq_tkt_{org_code}_{year} created via CREATE SEQUENCE IF NOT EXISTS; race on first ticket handled with retry (max 3) | Per-org per-year sequence | MEDIUM | Squad E |
| A-26-6 | is_private enforced at SQL WHERE level: (is_private=FALSE OR raised_by=:actor OR assigned_to=:actor OR :is_admin=TRUE) | Data leak risk if app-layer only | HIGH | Squad E |
| A-26-7 | Comment 15-min edit: elapsed > 900s raises EDIT_WINDOW_CLOSED | Spec 8.4 | LOW | Squad E |
| A-26-8 | Supplier internal note filter at DB level: WHERE is_internal=FALSE OR :is_supplier=FALSE | Data isolation | MEDIUM | Squad E |
| A-26-9 | RESOLVED auto-close after 3 days; PENDING_RESPONSE after 7 days — Celery beat daily | Spec 15 | LOW | Squad E |
| A-26-10 | SLA computed on calendar hours (Phase 1); business-hours SLA deferred to Phase 2 | Spec 20 scope | MEDIUM | Squad E |
| A-26-11 | Entity link as advisory soft FK (entity_type VARCHAR + entity_id UUID + entity_number VARCHAR); no hard FK | Hard FK across 8 entity tables is fragile | LOW | Squad E |
| A-26-12 | portal claim added to JWT (buyer/supplier/admin); set at login based on endpoint called | Auth module needs minor update | MEDIUM | Squad A+E |
| A-26-13 | due_date field added to tickets (nullable DATE); approaching alert 24h prior via Celery | Extended ticket usefulness | LOW | Squad E |
| A-26-14 | Ticket linking via ticket_links table (BLOCKS, IS_BLOCKED_BY, RELATES_TO, DUPLICATES, CLONES); bidirectional | Advanced workflow | LOW | Squad E |
| A-26-15 | Custom fields via EAV schema (ticket_custom_field_defs + ticket_custom_field_values) TEXT/NUMBER/DATE/SELECT/BOOLEAN | Enterprise extensibility | MEDIUM | Squad E |
| A-26-16 | Automation engine via ticket_automation_rules with event triggers, conditions JSON, actions JSON via Celery | SPEC_26 Phase 2 partial | MEDIUM | Squad E |
| A-26-17 | Round-robin assignee pointer persisted via Redis INCR per rule; balanced workload selects user with lowest active tickets | Fair assignment | LOW | Squad E |

---

## ASSUMPTIONS LOG (SPEC_27 — Portal Enhancements)

| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-27-1 | Org switch triggers window.location.reload() on frontend — mandatory, no partial cache clear | Cross-org data must never bleed | HIGH | FE Lead |
| A-27-2 | Cross-Company Reports bypass RLS via dedicated superuser DB role SET LOCAL row_security=OFF | PostgreSQL RLS bypass requires superuser | HIGH | Squad A |
| A-27-3 | is_platform_admin column added to users via migration only; no API setter | Platform admin is system-level | HIGH | Squad A |
| A-27-4 | Webhook URL must be HTTPS in production (settings.ENVIRONMENT == "production"); HTTP in dev | SSRF risk | HIGH | Squad E |
| A-27-5 | API key raw value shown ONLY at creation/rotation — never stored; DB stores SHA-256 hash only | Plaintext storage = critical vulnerability | HIGH | Squad A |
| A-27-6 | Export Center uses dedicated Celery queue celery.exports | Large exports block maintenance | MEDIUM | Squad E |
| A-27-7 | Branding colors validated for WCAG AA contrast ratio >= 4.5:1 at service layer before save | Accessibility requirement | MEDIUM | Squad B |
| A-27-8 | QA test records excluded from all reports/analytics by default; opt-in via include_test=true | Prevent test data polluting reports | MEDIUM | Squad C |
| A-27-9 | Payment gateway webhook endpoints (/webhooks/gateway/razorpay and /stripe) are PUBLIC — no JWT; verify by HMAC only | Gateway cannot send JWT | HIGH | Squad D |
| A-27-10 | Onboarding session persisted in DB (not client-side); survives browser close | Users interrupt onboarding | LOW | Squad B |
| A-27-11 | Razorpay for INR; Stripe for non-INR — auto-routing by invoice currency, not manual choice | Currency-based routing | MEDIUM | Squad D |

---

## IMPLEMENTATION SEQUENCE (Strict Dependency Order)

```
PHASE 0:  Pre-flight verification
PHASE 1:  SPEC_30 Indentor Phase 2 (Catalog Cart + Consignee GRN)
PHASE 2:  SPEC_26 Ticket System (auth update first, then migrations, then module)
PHASE 3:  SPEC_27 infrastructure migrations (0063-0074)
PHASE 4:  SPEC_27 modules A through J (parallel squads)
PHASE 5:  SPEC_28 Developer Platform standalone app (port 3005)
PHASE 6:  SPEC_29 Support App standalone app (port 3004)
PHASE 7:  Cross-spec integration, regression, Graphify update, README
```

---

## PHASE 0: PRE-FLIGHT

```bash
# Verify migration head
alembic current  # Must show: 0054_indentor_role (head)

# All tests must pass
pytest tests/ -v --tb=short -q

# TypeScript validation
cd procurement-portal-frontend && pnpm run typecheck

# Graphify graph check
graphify check --before-change

# Backend API reachable
curl -s http://localhost:8000/health | jq .status
```

---

## PHASE 1: SPEC_30 — Indentor Role Phase 2

### What is Already Done (from README)
- Migration 0054_indentor_role.py: is_indent, indentor_id, assigned_buyer_id, indent_notes columns
- RoleCode.INDENTOR, 6 permissions, 4 audit actions in app/core/constants.py
- Schemas: IndentTransferRequest, IndentCartTransferRequest, BuyerSelectionItem, etc.
- Endpoints: /indent, /indent/from-cart, /indent/tracking, /indent/buyers
- Frontend: /indents (7 status tabs) and /indents/tracking
- Seed: scripts/seed_indents.py with 7 indents, 2 POs, 2 GRNs
- Tests: 10/10 passing

### What is Missing (Phase 2)

#### 1.1 Migration: 0055_indent_cart.py

**indent_carts table:**
```sql
CREATE TABLE indent_carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    indentor_id UUID NOT NULL REFERENCES users(id),
    cart_name VARCHAR(200) NOT NULL DEFAULT 'My Cart',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    assigned_buyer_id UUID REFERENCES users(id),
    transfer_note TEXT,
    transferred_at TIMESTAMP WITH TIME ZONE,
    business_unit_id UUID REFERENCES business_units(id),
    cost_center_id UUID REFERENCES cost_centers(id),
    delivery_location_id UUID REFERENCES delivery_locations(id),
    required_by_date DATE,
    version INT DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE indent_cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    cart_id UUID NOT NULL REFERENCES indent_carts(id) ON DELETE CASCADE,
    catalog_item_id UUID REFERENCES catalog_items(id),
    line_number INT NOT NULL,
    item_description VARCHAR(500) NOT NULL,
    item_code VARCHAR(50),
    category_id UUID NOT NULL REFERENCES categories(id),
    uom_id UUID NOT NULL REFERENCES uoms(id),
    quantity NUMERIC(18,4) NOT NULL CHECK (quantity > 0),
    estimated_unit_price NUMERIC(18,4) NOT NULL DEFAULT 0,
    hsn_code VARCHAR(10),
    specifications TEXT,
    required_by_date DATE,
    delivery_location_id UUID REFERENCES delivery_locations(id),
    is_from_catalog BOOL NOT NULL DEFAULT FALSE,
    version INT DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (cart_id, line_number)
);

-- All indexes CONCURRENTLY via op.execute()
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_indent_carts_org_indentor
    ON indent_carts (org_id, indentor_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_indent_carts_org_buyer
    ON indent_carts (org_id, assigned_buyer_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_indent_cart_items_cart
    ON indent_cart_items (cart_id) WHERE deleted_at IS NULL;
```

#### 1.2 Migration: 0056_grn_consignee.py

```sql
ALTER TABLE goods_receipt_notes
    ADD COLUMN IF NOT EXISTS consignee_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS consignee_confirmed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS consignee_rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS consignee_status VARCHAR(20) DEFAULT 'PENDING';
-- consignee_status: PENDING, CONFIRMED, REJECTED
```

#### 1.3 New Backend Files

**app/modules/requisition/cart_service.py:**
```python
class IndentCartService:
    """
    Manages server-side indent carts for Indentor role.
    Layer: service (NO router imports, NO upward imports).
    Events published: indent.transferred, indent.cart_abandoned
    """
    async def get_active_cart(self, db, indentor_id, org_id) -> IndentCart | None
    async def create_cart(self, db, indentor_id, org_id, data) -> IndentCart
    async def add_item(self, db, cart_id, org_id, data) -> IndentCartItem
        # Enforces: max 50 items, category scope check
    async def update_item(self, db, cart_id, item_id, org_id, data) -> IndentCartItem
    async def remove_item(self, db, cart_id, item_id, org_id) -> None
    async def clear_cart(self, db, cart_id, org_id) -> IndentCart
    async def transfer_cart_to_buyer(self, db, cart_id, org_id, actor_id, data) -> Requisition
        # Converts cart -> Requisition (is_indent=True), assigns buyer,
        # publishes indent.transferred event, notifies buyer,
        # marks cart status=TRANSFERRED
    async def get_cart_summary(self, db, cart_id, org_id) -> CartSummary
```

**app/modules/requisition/cart_router.py:**
```
GET    /api/v1/indent/cart                   -> get active cart or 404
POST   /api/v1/indent/cart                   -> create cart
DELETE /api/v1/indent/cart/{id}              -> abandon cart
GET    /api/v1/indent/cart/{id}/items        -> list items
POST   /api/v1/indent/cart/{id}/items        -> add item (catalog or manual)
PUT    /api/v1/indent/cart/{id}/items/{item_id} -> update item qty/specs
DELETE /api/v1/indent/cart/{id}/items/{item_id} -> remove item
POST   /api/v1/indent/cart/{id}/transfer     -> transfer to buyer -> creates PR
GET    /api/v1/indent/cart/{id}/summary      -> validation summary
```

**app/modules/grn/router.py additions:**
```
POST   /api/v1/grn/{id}/consignee-confirm    -> Indentor confirms receipt (PRC + CRAC)
POST   /api/v1/grn/{id}/consignee-reject     -> Indentor rejects with reason
GET    /api/v1/grn/assigned-to-me            -> GRNs where current user is consignee
```

#### 1.4 Notification Events

Add 7 routing keys to procurement.notification RabbitMQ exchange:
- `indent.transferred` -> Buyer (Email + In-App)
- `indent.buyer_assigned` -> Indentor (In-App)
- `indent.pr_approved` -> Indentor (Email + In-App)
- `indent.po_issued` -> Indentor (Email + In-App)
- `indent.delivery_dispatched` -> Indentor/Consignee (Email + In-App)
- `indent.confirmation_required` -> Indentor (Email + In-App)
- `indent.confirmed` -> Buyer + Finance (In-App)

#### 1.5 Frontend: 3 New Pages

**apps/buyer-portal/app/(main)/indents/catalog/page.tsx**
- Amazon Business-style product search (full-text, debounced 300ms)
- Left filter sidebar: Category tree, UOM, Price range
- Results grid: Product card (name, code, price, UOM, category, vendor, stock status)
- Quick-add button: "Add to Cart" -> mini quantity drawer
- "Custom item" button: manual entry modal
- Cart summary panel (right): item count, total, "Transfer to Buyer" CTA

**apps/buyer-portal/app/(main)/indents/cart/page.tsx**
- Line items table: description, category, UOM, qty (editable), unit price, total
- Cart metadata: Name, Required By Date, Delivery Location, Cost Center (editable)
- Transfer modal: Select Buyer dropdown + Transfer note + Confirm button
- Validation summary: warnings (missing specs, past dates) + blocking errors

**apps/buyer-portal/app/(main)/indents/deliveries/page.tsx**
- Cards per pending delivery: PO number, Vendor, Items, Expected date, GRN status
- Status chips: Awaiting Delivery / Delivered-Pending Confirmation / Confirmed / Rejected
- "Confirm Receipt" button -> item-by-item quantity accepted modal
- "Report Issue" -> rejection form
- "Raise Ticket" -> pre-fills entity_type=GRN

#### 1.6 Sidebar Navigation Update

```
Indents (apps/buyer-portal sidebar)
  ├── Catalog Search        (NEW)
  ├── My Cart               (NEW)
  ├── My Indents            (EXISTING)
  ├── Tracking              (EXISTING)
  └── Deliveries            (NEW)
```

#### 1.7 Tests (12 new)

```python
# tests/unit/test_indent_cart_service.py
test_create_cart_success
test_create_cart_duplicate_raises_conflict
test_add_item_from_catalog
test_add_manual_item
test_add_item_exceeds_50_raises
test_transfer_cart_creates_pr_with_is_indent_true
test_transfer_cart_assigns_buyer
test_transfer_cart_publishes_notification_event
test_consignee_confirm_grn
test_consignee_reject_grn_requires_reason
test_indentor_cannot_approve_own_indent  # SOD
test_catalog_search_filters_by_bu_scope

# tests/integration/test_indentor_cart_flow.py
test_full_cart_to_pr_flow
test_consignee_delivery_confirmation_flow
```

---

## PHASE 2: SPEC_26 — Ticket & Query Management System

> The detailed plan exists at new/plan_spec_26_ticket_system.md (1495 lines).
> Follow that plan for exact code. This is the authoritative summary.

### 2.1 Auth Module Update (FIRST — all ticket features depend on portal claim)

**app/auth/jwt.py:**
```python
def create_access_token(user_id, org_id, ..., portal: str = "buyer") -> str:
    payload = {
        "sub": str(user_id),
        "org_id": str(org_id),
        # ... existing fields ...,
        "portal": portal,  # "buyer" | "supplier" | "admin" -- NON-BREAKING new claim
    }
```

**app/auth/router.py:**
- Buyer login endpoint: portal="buyer" (default, no change)
- Supplier login (/api/v1/supplier/auth/login): portal="supplier"
- Admin portal login: portal="admin"

**app/core/middleware.py:**
- Extract portal from JWT payload -> request.state.portal

### 2.2 Migrations (strict order, after SPEC_30 migrations)

| File | Contents |
|---|---|
| 0057_ticket_enums.py | 3 ENUMs: ticket_type(8 values), ticket_priority(4), ticket_status(7) |
| 0058_ticket_tables.py | 6 tables: tickets, ticket_comments, ticket_attachments, ticket_watchers, ticket_activity_log, ticket_sla_config |
| 0059_ticket_sequences.py | Documentation migration; sequences created dynamically at runtime |
| 0060_ticket_indexes.py | 13 CONCURRENTLY indexes via op.execute() NOT op.create_index() |
| 0061_ticket_rls.py | RLS on tickets and ticket_comments tables |
| 0062_ticket_sla_seed.py | Default SLA configs for all existing orgs (ON CONFLICT DO NOTHING) |
| 0063_ticket_permissions.py | 12 ticket.* permissions + role assignments per SPEC_26 Section 7 |
| 0064_ticket_extended.py | ticket_links, ticket_custom_field_defs, ticket_custom_field_values, ticket_automation_rules |

**downgrade() must fully reverse upgrade() for ALL migrations.**

### 2.3 Backend Module: app/modules/ticket/

```
app/modules/ticket/
├── __init__.py          -- module docstring: responsibility, dependencies, events
├── models.py            -- 6 SQLAlchemy models (Ticket, TicketComment, TicketAttachment,
│                           TicketWatcher, TicketActivityLog, TicketSLAConfig)
│                           NOTE: TicketActivityLog imports Base directly (no deleted_at)
├── fsm.py               -- TICKET_FSM dict + SUPPLIER_ALLOWED_TRANSITIONS + validate_ticket_transition()
├── sla_service.py       -- TicketSLAService: get_config(), compute_breach_at(), compute_status()
│                           _DEFAULT_SLA is module-level constant (NOT settings.*)
├── mention_parser.py    -- MentionParser class. Regex: r'@([a-zA-Z0-9._-]{2,})'
├── search_service.py    -- ElasticsearchTicketSearchService
│                           Index: tickets-{YYYY.MM} (monthly rotation)
├── permissions.py       -- ticket.* permission code constants
├── repository.py        -- TicketRepository (all SQL queries, NO business logic)
├── service.py           -- TicketService (business logic, NO SQL queries)
└── router.py            -- 30+ FastAPI endpoints
```

### 2.4 Complete API Endpoints

```
# CRUD
GET    /api/v1/tickets                      filters: status,type,priority,entity_type,entity_id,tags
POST   /api/v1/tickets
GET    /api/v1/tickets/{id}
PUT    /api/v1/tickets/{id}
DELETE /api/v1/tickets/{id}                 ADMIN only, soft delete

# Status Transitions (FSM-validated)
POST   /api/v1/tickets/{id}/assign          body: {user_id, team}
POST   /api/v1/tickets/{id}/start-progress
POST   /api/v1/tickets/{id}/resolve         body: {resolution_note}
POST   /api/v1/tickets/{id}/close
POST   /api/v1/tickets/{id}/reopen          body: {reason}
POST   /api/v1/tickets/{id}/escalate        body: {reason, escalate_to_user_id}
POST   /api/v1/tickets/{id}/pending-response

# Comments (cursor-based pagination)
GET    /api/v1/tickets/{id}/comments
POST   /api/v1/tickets/{id}/comments        supports is_internal flag
PUT    /api/v1/tickets/{id}/comments/{cid}  15-min window enforced at service layer
DELETE /api/v1/tickets/{id}/comments/{cid}  soft delete

# Attachments
POST   /api/v1/tickets/{id}/attachments
DELETE /api/v1/tickets/{id}/attachments/{aid}

# Watchers
GET    /api/v1/tickets/{id}/watchers
POST   /api/v1/tickets/{id}/watchers
DELETE /api/v1/tickets/{id}/watchers/{uid}

# Activity (immutable log)
GET    /api/v1/tickets/{id}/activity

# Ticket Links
GET    /api/v1/tickets/{id}/links
POST   /api/v1/tickets/{id}/links
DELETE /api/v1/tickets/{id}/links/{link_id}

# Dashboard & Search
GET    /api/v1/tickets/dashboard
GET    /api/v1/tickets/my-open
GET    /api/v1/tickets/assigned-to-me
POST   /api/v1/tickets/search               Elasticsearch full-text
GET    /api/v1/tickets/export               sync CSV (async via SPEC_27-G in future)

# SLA Config (Admin only)
GET    /api/v1/tickets/sla-config
PUT    /api/v1/tickets/sla-config
```

### 2.5 RabbitMQ: New Exchange + Queue

Add to scripts/rabbitmq_setup.py:
- New exchange: procurement.ticket (topic, durable)
- New queue: q.ticket.events bound to procurement.ticket, routing key: ticket.*
- Consumer: app/modules/notification/consumer.py (add handler for ticket.* events)

### 2.6 Celery Tasks: app/tasks/ticket_sla.py

```python
@celery_app.task(queue="celery.maintenance", name="check_ticket_sla_timers")
# Runs every 15 minutes. Finds OPEN/IN_PROGRESS/PENDING_RESPONSE tickets,
# compares now() vs sla_breach_at, updates sla_status, fires notifications.

@celery_app.task(queue="celery.maintenance", name="auto_close_resolved_tickets")
# Daily at 01:00. RESOLVED tickets with no activity 3 days -> CLOSED.
# PENDING_RESPONSE no raiser reply 7 days -> CLOSED.

@celery_app.task(queue="celery.maintenance", name="send_ticket_digest")
# Daily at 08:00. Summary email to assignees with open ticket counts.
```

Register all 3 in app/tasks/celery_app.py beat_schedule.

### 2.7 Frontend: Buyer Portal New Pages

**apps/buyer-portal/app/(main)/tickets/**
```
/tickets           -- List view (table + board toggle)
/tickets/board     -- Kanban board (@dnd-kit: 5 columns OPEN|IN_PROGRESS|PENDING_RESPONSE|RESOLVED|CLOSED)
/tickets/[id]      -- Detail: 65% left (content) + 35% right (metadata + comments)
/tickets/new       -- Create modal or page
```

**Sidebar addition:**
```
Support & Tickets
  ├── My Tickets
  ├── All Tickets   (requires ticket.view_team permission)
  ├── Assigned to Me
  └── Ticket Board
```

**Entity detail page "Tickets" tabs:**
Add "Tickets (N)" tab to: PR detail, RFQ detail, PO detail, Invoice detail, Contract detail, Vendor detail.
Clicking: GET /api/v1/tickets?entity_type=X&entity_id={id}

**Key UI components (packages/ui/src/ticket/):**
```typescript
TicketListTable.tsx     // sortable, filterable, SLA countdown chips
TicketKanbanBoard.tsx   // @dnd-kit/core + @dnd-kit/sortable drag-and-drop
TicketDetailPanel.tsx   // split layout
TicketCreateModal.tsx   // form with Zod validation matching Pydantic exactly
CommentFeed.tsx         // markdown rendered via react-markdown + remark-gfm
MentionInput.tsx        // @mention autocomplete (debounced GET /api/v1/users?search={q})
SLACountdownChip.tsx    // animated: green > 50%, amber < 50%, red = breached
InternalNoteBadge.tsx   // yellow background + lock icon, only for authorized roles
TicketLinkSelector.tsx  // link tickets by number/title search
```

**FRONTEND WIRING RULE: All hooks must follow response envelope:**
```typescript
// packages/hooks/src/useTickets.ts
export function useTickets(params) {
  return useQuery({
    queryKey: ['tickets', params],
    queryFn: () => apiClient.get('/tickets', { params }),
    select: (res) => ({
      data: res.data.data,    // res.data = APIResponse envelope, .data = actual list
      meta: res.data.meta,
    }),
  });
}
```

**Zod schemas (must match Pydantic exactly):**
```typescript
const ticketCreateSchema = z.object({
  title: z.string().min(5).max(500),
  description: z.string().min(20),
  ticket_type: z.enum(['QUERY','BUG','DISCREPANCY','COMPLAINT','CHANGE_REQUEST','SUPPORT','AUDIT_QUERY','VENDOR_ISSUE']),
  priority: z.enum(['CRITICAL','HIGH','MEDIUM','LOW']),
  category: z.string().optional(),
  entity_type: z.string().optional(),
  entity_id: z.string().uuid().optional(),
  entity_number: z.string().optional(),
  tags: z.array(z.string()).default([]),
  is_private: z.boolean().default(false),
});
type TicketCreateForm = z.infer<typeof ticketCreateSchema>;
// NO hand-written interfaces -- always z.infer<>
```

### 2.8 Frontend: Supplier Portal

**apps/supplier-portal/app/(main)/tickets/**
- /tickets: My tickets only (own only, no internal notes)
- /tickets/new: Simplified form (QUERY, DISCREPANCY, COMPLAINT, SUPPORT only)
- /tickets/[id]: Conversation view (NO is_internal notes rendered)

Sidebar:
```
Support
  ├── My Tickets
  └── Raise New Ticket
```

### 2.9 Frontend: Admin Portal

**apps/admin-portal/app/(main)/tickets/**
- /tickets: All tickets across org
- /tickets/board: Full Kanban
- /tickets/dashboard: SLA compliance metrics, volume charts (Recharts)
- /tickets/sla: SLA configuration editor
- /tickets/reports: Resolution time, agent performance, volume by type

### 2.10 Notification Templates Seed Update

Add to scripts/seed_notification_templates.py -- 9 new templates:
ticket_created, ticket_comment_added, ticket_mention, ticket_status_changed,
ticket_assigned, ticket_sla_warning, ticket_sla_breached, ticket_resolved, ticket_auto_closed

### 2.11 Tests

```python
# Unit tests
tests/unit/test_ticket_service.py         # minimum 15 tests
tests/unit/test_ticket_fsm.py             # all FSM transitions valid + invalid
tests/unit/test_ticket_sla_service.py     # breach computation, priority configs
tests/unit/test_mention_parser.py         # valid @mentions, edge cases

# Integration tests
tests/integration/test_ticket_flow.py         # full buyer happy path
tests/integration/test_ticket_supplier.py     # supplier restricted view
tests/integration/test_ticket_visibility.py   # is_private and is_internal isolation
```

---

## PHASE 3: SPEC_27 — Infrastructure Migrations

Run in strict order. All downgrade() must fully reverse upgrade().

| Migration | Contents |
|---|---|
| 0065_company_switcher.py | user_org_memberships, org_switch_audit tables; users.primary_org_id |
| 0066_onboarding.py | onboarding_sessions table |
| 0067_platform_admin.py | users.is_platform_admin BOOL DEFAULT FALSE |
| 0068_webhook_endpoints.py | webhook_endpoints, webhook_deliveries tables |
| 0069_api_keys.py | api_keys table; api_key_usage_log (monthly partition) |
| 0070_export_jobs.py | export_jobs table |
| 0071_payment_gateway.py | payment_gateway_config table; ALTER payment_records (12 gateway columns) |
| 0072_test_records.py | is_test_record BOOL DEFAULT FALSE on 7 tables (zero-downtime) |
| 0073_new_permissions.py | 8 new permissions: switcher.switch_org, report.cross_company, webhook.manage, api_key.manage, export.create, payment.initiate, payment.refund, qa.access_test_mode |
| 0074_new_indexes.py | All CONCURRENTLY indexes for all new tables |

> [!WARNING]
> 0072_test_records.py adds is_test_record to 7 high-traffic tables. Zero-downtime because DEFAULT FALSE.
> 0071_payment_gateway.py adds 12 columns to payment_records. All nullable. Zero-downtime.

---

## PHASE 4: SPEC_27 — Module Implementations

### 27-A: Company Switcher

**Backend:**
- app/modules/organization/models.py: add UserOrgMembership, OrgSwitchAudit models
- app/modules/organization/service.py: add switch_org() method
  - Validate membership in target org
  - Rate limit: max 10 switches/hour per user (Redis INCR, 3600s expire)
  - Revoke current JWT session by JTI in Redis
  - Log to org_switch_audit (immutable)
  - Issue new access_token + refresh_token scoped to target org_id
- app/auth/router.py: GET /api/v1/auth/my-orgs + POST /api/v1/auth/switch-org
- app/modules/admin/router.py: POST /api/v1/admin/user-org-invite + DELETE /api/v1/admin/user-org/{id}

**Frontend (Admin Portal navbar - packages/ui/src/CompanySwitcher.tsx):**
- Current org pill -> dropdown: org list with logos + roles + "Switch" button
- On API success: window.location.reload() -- MANDATORY, no exceptions
- On error: toast "Unable to switch org"

**Security:** Cross-org data NEVER accessible; RLS re-evaluated on new org context; every switch logged immutably.

### 27-B: Unified Buyer Onboarding Wizard

**Backend:**
- app/modules/admin/onboarding_service.py: 8-step session management
- app/modules/admin/onboarding_router.py: 7 endpoints
  - GET /api/v1/onboarding/session
  - PUT /api/v1/onboarding/session/step/{n}
  - POST /api/v1/onboarding/session/complete
  - GET /api/v1/onboarding/templates
  - POST /api/v1/onboarding/bulk-invite
  - POST /api/v1/onboarding/test-erp
  - GET /api/v1/onboarding/checklist

**Frontend (Admin Portal):**
- /onboarding: Entry page redirecting to current step
- /onboarding/step-[1-8]: Per-step pages
- Step 1: Org basics (legal name, PAN, GSTIN with format validation, logo upload)
- Step 2: Structure setup (Legal Entities, BUs, Plants, Departments)
- Step 3: ERP & Integration Config (SAP/Oracle/Custom, test connection)
- Step 4: Master Data Seeding (CSV import or templates)
- Step 5: User Roles & Permissions (invite admins, assign BU scopes)
- Step 6: Vendor Invite (CSV bulk upload)
- Step 7: Approval Rules Configuration (guided form + simulator)
- Step 8: Go-Live Checklist + Test Run
- Progress bar (X/8), back navigation, auto-save to DB, skip optional steps

### 27-C: Cross-Company Reports (SuperAdmin only)

**Backend:**
- app/modules/admin/superadmin_reports_router.py: 6 endpoints under /api/v1/superadmin/reports/*
- require_platform_admin() dependency: checks users.is_platform_admin = TRUE
- RLS bypassed via dedicated connection: SET LOCAL row_security = OFF
- All access logged to audit_logs (entity_type = 'PLATFORM_REPORT')

**Frontend (Admin Portal - SuperAdmin only):**
- /superadmin/reports/overview: Platform KPI tiles (total orgs, GMV, MoM growth)
- /superadmin/reports/orgs: Per-org performance table (sortable, filterable)
- /superadmin/reports/feature-adoption: Feature usage heatmap
- /superadmin/reports/platform-health: Celery, RabbitMQ DLQ, API error rates

**Permission guard on ALL elements:** PermissionGuard permission="report.cross_company"

### 27-D: Webhook Management UI

**Backend:**
- app/modules/integration/webhook_service.py: CRUD, delivery log, test delivery, rotate secret
- app/modules/integration/webhook_router.py:
  - GET/POST /api/v1/webhooks
  - GET/PUT/DELETE /api/v1/webhooks/{id}
  - POST /api/v1/webhooks/{id}/rotate-secret (returns raw secret ONCE)
  - POST /api/v1/webhooks/{id}/test
  - GET /api/v1/webhooks/{id}/deliveries
  - GET /api/v1/webhooks/{id}/deliveries/{did}/retry
  - GET /api/v1/webhooks/events

**Frontend (Admin Portal):**
- /integrations/webhooks: List + "Add Webhook" button
- /integrations/webhooks/[id]: Event subscriptions, delivery log (30-day retention), retry

**Security:**
- HTTPS only in production (settings.ENVIRONMENT check)
- HMAC-SHA256 signature on every delivery via X-ProcureOS-Signature header
- Raw secret shown ONCE at creation/rotation (dismissable modal with copy button)
- Custom headers encrypted via Fernet (same as field-level encryption)

### 27-E: API Key Management

**Backend:**
- app/modules/developer/api_key_service.py: create, list, rotate, revoke, usage stats
- app/modules/developer/api_key_router.py:
  - GET/POST /api/v1/api-keys
  - PUT/DELETE /api/v1/api-keys/{id}
  - POST /api/v1/api-keys/{id}/rotate (24h grace period for old key)
  - GET /api/v1/api-keys/{id}/usage
  - GET /api/v1/api-keys/{id}/log

**Key format:** prc_{env}_{random_32_chars} e.g. prc_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p
**DB storage:** SHA-256(raw_key) -- raw key NEVER stored, shown ONCE

**Frontend (Admin Portal):**
- /integrations/api-keys: List (prefix only, NOT full key)
- /integrations/api-keys/[id]: Scopes, usage chart, recent request log
- "Create" modal: name, type, scopes multiselect, expiry date; full key shown ONCE
- "Rotate" button: new key shown ONCE with 24h grace period warning

### 27-F: Branding per Tenant

**Backend:**
- Update app/modules/organization/service.py: branding CRUD in tenant_settings.branding JSONB
- GET /api/v1/admin/branding
- PUT /api/v1/admin/branding (validates WCAG AA contrast >= 4.5:1 before save)
- POST /api/v1/admin/branding/logo (MinIO presigned upload)
- POST /api/v1/admin/branding/favicon
- GET /api/v1/admin/branding/domain
- POST /api/v1/admin/branding/verify-domain
- GET /api/v1/public/branding/{org_slug} -- PUBLIC, no auth, Cache-Control: public max-age=3600

**Frontend (Admin Portal):**
- /settings/branding: Color picker + live preview + logo upload + domain config
- Live preview pane: shows sidebar, header, login page with current selections
- WCAG AA contrast checker built into color picker

### 27-G: Export Center (Async)

**Backend:**
- app/modules/export/export_service.py
- app/modules/export/export_router.py:
  - POST /api/v1/exports (queue job, return job_id)
  - GET /api/v1/exports (last 30 jobs)
  - GET /api/v1/exports/{id} (status + download URL when COMPLETED)
  - DELETE /api/v1/exports/{id}
  - POST /api/v1/exports/{id}/refresh-url
- app/tasks/export_tasks.py: process_export_job on celery.exports queue
  - Stream to temp file (avoid loading all into memory)
  - Upload to MinIO exports bucket
  - Set expires_at = now() + 7 days
  - Publish notification to requested_by user

**All listing pages:** Replace synchronous "Export CSV" buttons with async ExportButton component.
```typescript
// packages/ui/src/ExportButton.tsx
// Calls POST /api/v1/exports, shows "Export queued!" toast
// User notified via WebSocket when ready
```

**Frontend (all 3 portals, new "Tools" section in sidebar):**
- /export-center: List past 30 exports + status + Download button
- PROCESSING jobs: progress bar with refetchInterval: 5000
- Toast notification on completion (WebSocket NOTIFICATION_TYPE: EXPORT_COMPLETE)

### 27-H: Buyer Activity Report UI

**Backend (no new tables -- reuses audit_logs):**
- app/modules/analytics/buyer_activity_router.py:
  - GET /api/v1/analytics/buyer-activity
  - GET /api/v1/analytics/buyer-activity/heatmap (52-week data)
  - GET /api/v1/analytics/buyer-activity/users (PROCUREMENT_HEAD+ only)
  - GET /api/v1/analytics/buyer-activity/{user_id}
  - GET /api/v1/analytics/procurement-velocity
  - GET /api/v1/analytics/bottlenecks

**Frontend (Buyer Portal):**
- /analytics/buyer-activity (new tab in analytics section)
- Section 1: User Activity Timeline (per-user audit log)
- Section 2: Activity Heatmap (GitHub-style calendar via recharts or d3)
- Section 3: Buyer Performance League Table (PRs, approval times, SLA %)
- Section 4: Procurement Velocity (PR->PO cycle time histogram)
- Section 5: Login & Session Analytics (Admin only)

### 27-I: UAT Overlay / QA Role

**Backend:**
- app/core/constants.py: add RoleCode.QA_TESTER
- Middleware: if QA_TESTER role -> request.state.is_test_mode = True
- All CREATE endpoints: check request.state.is_test_mode -> set is_test_record = True
- Notification service: if is_test_record -> log notification, do NOT send real email
- app/tasks/maintenance_tasks.py: add purge_test_records() weekly task

**Frontend (all 3 portals root layouts):**
```typescript
// packages/ui/src/QATestModeBanner.tsx
// Amber 2px top bar + sticky bottom-right "UAT / Test Mode Active" badge
// All page document titles prefixed with [TEST]
// Only shown when user has QA_TESTER role
```

**Seed:** scripts/seed_demo_user.py -- add qa@procurement.com with QA_TESTER role

### 27-J: Payment Gateway (Online)

**Backend:**
- app/modules/payment/gateway_service.py: Razorpay (INR) + Stripe (non-INR)
  - Currency-based auto-routing: invoice.currency == "INR" -> Razorpay, else Stripe
- app/modules/payment/router.py additions:
  - POST /api/v1/payments/{id}/initiate-gateway-payment
  - GET /api/v1/payments/{id}/gateway-status
  - POST /api/v1/webhooks/gateway/razorpay (PUBLIC -- HMAC signature verified FIRST)
  - POST /api/v1/webhooks/gateway/stripe (PUBLIC -- Stripe-Signature header verified FIRST)
  - POST /api/v1/payments/{id}/refund (FINANCE_CONTROLLER permission + dual approval workflow)
- app/modules/admin/payment_gateway_router.py:
  - GET/PUT /api/v1/admin/payment-gateway (credentials encrypted via Fernet)
  - POST /api/v1/admin/payment-gateway/test
  - GET /api/v1/admin/payment-gateway/reconciliation

**Kong config:** Add public routes for razorpay and stripe webhooks (NO jwt or key-auth plugins).

**Frontend (Buyer Portal):**
- Invoice detail: "Pay Online" button (shown if gateway configured + invoice APPROVED)
- Payment status widget: provider logo + status + transaction ID

**Admin Portal:**
- /settings/payment-gateway: Config form + test connection + reconciliation report

**Security checklist:**
- Webhook HMAC verified BEFORE any processing
- Gateway credentials stored encrypted (Fernet)
- payment.initiate permission required (new, added to FINANCE_CONTROLLER)
- Idempotency: gateway_order_id IS NULL check before initiation
- Refund requires dual approval via workflow

---

## PHASE 5: SPEC_28 — Developer Platform (Port 3005)

### 5.1 New Next.js App

```bash
cd apps && npx create-next-app@14 developer-portal --typescript --app --tailwind
```

**docker-compose.yml addition:**
```yaml
developer-portal:
  build:
    context: ../procurement-portal-frontend
    dockerfile: apps/developer-portal/Dockerfile
  ports: ["3005:3005"]
  environment:
    INTERNAL_API_URL: http://api:8000
    PORT: "3005"
  depends_on:
    api: { condition: service_started }
  networks: [procurement_net]
```

Note: Grafana moves to 3006 (update GRAFANA_PORT in .env.example).

### 5.2 Backend: New Tables (Migration 0075_developer_platform.py)

```sql
CREATE TABLE developer_accounts (
    id UUID PK, email VARCHAR(255) UNIQUE, full_name VARCHAR(255),
    company VARCHAR(255), auth_provider VARCHAR(20) DEFAULT 'EMAIL',
    auth_provider_id VARCHAR(255), is_verified BOOL DEFAULT FALSE,
    is_internal BOOL DEFAULT FALSE, sandbox_org_id UUID,
    api_keys_count INT DEFAULT 0, last_login_at TIMESTAMP WITH TIME ZONE,
    version INT DEFAULT 1, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE sandbox_orgs (
    id UUID PK, developer_id UUID REFERENCES developer_accounts(id),
    org_name VARCHAR(200) DEFAULT 'Sandbox Org', sandbox_org_id UUID NOT NULL,
    api_key_test VARCHAR(100), reset_count INT DEFAULT 0,
    last_reset_at TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE api_changelog (
    id UUID PK, version VARCHAR(20) NOT NULL, release_date DATE NOT NULL,
    release_type VARCHAR(20), title VARCHAR(500) NOT NULL, description TEXT NOT NULL,
    breaking_changes JSONB DEFAULT '[]', deprecations JSONB DEFAULT '[]',
    new_features JSONB DEFAULT '[]', bug_fixes JSONB DEFAULT '[]',
    is_published BOOL DEFAULT FALSE, published_at TIMESTAMP WITH TIME ZONE,
    authored_by VARCHAR(200), version_num INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE doc_pages (
    id UUID PK, slug VARCHAR(300) NOT NULL UNIQUE, title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL, category VARCHAR(100), sort_order INT DEFAULT 0,
    is_published BOOL DEFAULT FALSE, last_edited_by VARCHAR(200),
    version INT DEFAULT 1, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sdk_downloads (
    id UUID PK, developer_id UUID REFERENCES developer_accounts(id),
    sdk_language VARCHAR(50), sdk_version VARCHAR(20),
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), ip_address INET
);
```

### 5.3 Backend: Developer Auth (Separate JWT Key Pair)

- Developer JWT uses DIFFERENT RS256 key pair from procurement JWT
- Developer JWT does NOT work on /api/v1/* endpoints
- Sign up with email/password OR Google/GitHub OIDC
- Email verification required before sandbox access

Generate separate keys: scripts/generate_developer_rsa_keys.py

### 5.4 Backend: New Router Groups

```
# Public (no auth)
GET /api/v1/public/changelog
GET /api/v1/public/changelog/{version}
GET /api/v1/public/changelog/rss
GET /api/v1/public/changelog/atom
GET /api/v1/public/api-versions

# Sandbox (developer JWT)
POST /sandbox/api/v1/sandbox/reset
GET  /sandbox/api/v1/sandbox/status
POST /sandbox/api/v1/sandbox/time-travel
GET  /sandbox/api/v1/sandbox/scenarios
POST /sandbox/api/v1/sandbox/scenarios/{id}/run

# Rate limit analytics (api_keys)
GET /api/v1/api-keys/{id}/rate-limit-status    (Redis real-time quota)
GET /api/v1/api-keys/{id}/usage-timeseries
GET /api/v1/api-keys/{id}/throttle-events
GET /api/v1/api-keys/{id}/top-endpoints

# Admin changelog management
POST /api/v1/admin/changelog
PUT  /api/v1/admin/changelog/{id}
POST /api/v1/admin/changelog/{id}/publish
GET  /api/v1/admin/changelog/deprecation-report
```

### 5.5 Sandbox Architecture

```sql
-- New PostgreSQL schema: sandbox
-- Same table structure as public schema
-- Seed data: 1 org, 5 BUs, 20 users, 15 vendors, 50 PRs, 10 RFQs,
--            20 bids, 5 contracts, 10 POs, 10 invoices
-- Time travel: artificial advance via time_travel_offset stored in sandbox schema
```

### 5.6 SDK Generation Pipeline

```yaml
# .github/workflows/sdk-generation.yml
# Trigger: API version bump (tag push vX.Y.Z)
# Command: openapi-generator-cli generate -i /api/v1/openapi.json -g {language}
# Targets: Python (PyPI), Node.js (npm @procureos/sdk), Go (GitHub Packages)
```

### 5.7 Developer Portal Pages

```
developer.procureos.com (port 3005)
├── /                   -- Landing + quick-start CTA
├── /docs               -- Documentation hub (MDX from DB)
│   ├── /getting-started
│   ├── /authentication
│   ├── /webhooks
│   ├── /sdks
│   ├── /guides
│   └── /errors
├── /reference          -- Interactive Redoc (auto-rendered from /api/v1/openapi.json)
├── /sandbox            -- Sandbox console (reset, scenarios, time-travel)
├── /changelog          -- API changelog timeline (RSS widget)
├── /rate-limits        -- Rate limit dashboard with charts (auth required)
├── /keys               -- API key management (auth required)
└── /status             -- Platform status (public, sourced from Prometheus)
```

---

## PHASE 6: SPEC_29 — Support App (Port 3004)

### 6.1 New Next.js App

```bash
cd apps && npx create-next-app@14 support-portal --typescript --app --tailwind
```

**docker-compose.yml addition:**
```yaml
support-portal:
  build:
    context: ../procurement-portal-frontend
    dockerfile: apps/support-portal/Dockerfile
  ports: ["3004:3004"]
  environment:
    INTERNAL_API_URL: http://api:8000
    PORT: "3004"
  depends_on:
    api: { condition: service_started }
  networks: [procurement_net]
```

### 6.2 Backend: Support Schema (Migration 0076_support_app.py)

```sql
CREATE SCHEMA IF NOT EXISTS support;

-- ENUMs in support schema
CREATE TYPE support.support_priority_enum AS ENUM ('CRITICAL','HIGH','MEDIUM','LOW');
CREATE TYPE support.support_status_enum AS ENUM (
    'OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER','WAITING_ON_THIRD_PARTY',
    'RESOLVED','CLOSED','SPAM','MERGED'
);

-- Tables: support.support_tickets, support.support_ticket_messages,
--         support.support_agents, support.knowledge_base_articles,
--         support.kb_categories, support.canned_responses,
--         support.support_sla_policies, support.support_auto_rules
-- (Full schemas per SPEC_29 Section 2)
```

### 6.3 Support App Backend Modules

**app/modules/support/**
```
__init__.py
models.py             -- 8 SQLAlchemy models (support schema)
service.py            -- Business logic for ticket lifecycle
router.py             -- All customer + agent + admin endpoints
auto_assignment_service.py -- Auto-assignment engine (rules + round-robin)
sla_service.py        -- Business hours SLA calculation (compute_sla_deadline)
kb_service.py         -- Knowledge base CRUD + tsvector search
```

**Complete API Endpoints (support/ prefix):**
```
# Customer (procurement JWT)
GET/POST /support/api/v1/tickets
GET      /support/api/v1/tickets/{id}
POST     /support/api/v1/tickets/{id}/messages
POST     /support/api/v1/tickets/{id}/close
POST     /support/api/v1/tickets/{id}/reopen
POST     /support/api/v1/tickets/{id}/csat

# Knowledge Base (public)
GET /support/api/v1/kb/categories
GET /support/api/v1/kb/categories/{slug}
GET /support/api/v1/kb/articles/{slug}
GET /support/api/v1/kb/search            tsvector PostgreSQL search
POST /support/api/v1/kb/articles/{id}/vote
GET /support/api/v1/kb/popular

# Agent (agent JWT)
GET    /support/api/v1/agent/tickets
PUT    /support/api/v1/agent/tickets/{id}
POST   /support/api/v1/agent/tickets/{id}/messages
POST   /support/api/v1/agent/tickets/{id}/assign
POST   /support/api/v1/agent/tickets/{id}/resolve
POST   /support/api/v1/agent/tickets/{id}/merge
POST   /support/api/v1/agent/tickets/{id}/spam
GET    /support/api/v1/agent/dashboard
GET    /support/api/v1/agent/canned-responses

# Admin
GET    /support/api/v1/admin/tickets
GET    /support/api/v1/admin/agents
POST   /support/api/v1/admin/agents
PUT    /support/api/v1/admin/sla-policies
GET    /support/api/v1/admin/reports
GET    /support/api/v1/admin/sla/dashboard
GET    /support/api/v1/admin/sla/breaches
GET    /support/api/v1/admin/csat/report
```

### 6.4 Business Hours SLA Calculation

```python
# app/modules/support/sla_service.py
BUSINESS_HOURS = {
    "IST": {"start": 9, "end": 18, "timezone": "Asia/Kolkata"},
    "UTC": {"start": 9, "end": 18, "timezone": "UTC"},
}
WORK_DAYS = {0, 1, 2, 3, 4}  # Mon-Fri

def compute_sla_deadline(created_at, sla_hours, business_hours_only, tz) -> datetime:
    """Walk forward counting only business hours if business_hours_only=True."""
    # CRITICAL/HIGH: 24/7 (business_hours_only=False)
    # MEDIUM/LOW: business hours only (Mon-Fri 09:00-18:00)
```

### 6.5 Auto-Assignment Engine

```python
# app/modules/support/auto_assignment_service.py
# When new ticket created:
# 1. Check auto_rules in sort_order ASC
# 2. First matching rule's actions applied (assign_team, set_priority, add_tag)
# 3. No match -> round-robin among available agents in default team
# 4. Respect agent.max_tickets and agent.is_available
# 5. No available agents -> OPEN unassigned + alert notification
```

### 6.6 Email-to-Ticket Webhook

```
POST /support/api/v1/webhooks/inbound-email  (PUBLIC, Mailgun signature verified)
# Inbound email parser:
# - New email -> create ticket
# - Reply to existing (In-Reply-To matches email_message_id) -> add message
# - Spam detection: SpamAssassin or heuristic scoring
```

### 6.7 Celery Tasks: app/tasks/support_sla_tasks.py

```python
@celery_app.task(name="check_support_ticket_sla")       # Every 15 min
@celery_app.task(name="auto_close_resolved_support_tickets")  # Daily
@celery_app.task(name="send_support_digest_to_agents")  # Daily 08:00
@celery_app.task(name="check_csat_follow_up")           # Daily (CLOSED 24h ago, no score)
```

### 6.8 Frontend: Support Portal Pages

```
support.procureos.com (port 3004)
├── /                       -- KB home: search bar + category grid
├── /help                   -- All categories
├── /help/{category}        -- Category article list
├── /help/article/{slug}    -- Article + feedback widget (helpful? thumbs up/down)
├── /help/search            -- Search results (tsvector)
├── /tickets                -- Customer: my tickets
├── /tickets/new            -- Raise support ticket
├── /tickets/{id}           -- Conversation timeline (customer left / agent right)
├── /status                 -- Platform status (public)
│
└── /agent                  -- Agent dashboard
    ├── /agent/queue        -- Ticket queue (filters: priority, team, assigned_to_me)
    ├── /agent/tickets/{id} -- 3-panel: queue | conversation | customer info
    ├── /agent/kb           -- KB authoring (MDX editor)
    └── /agent/reports      -- SLA + CSAT reports
└── /admin
    ├── /admin/agents       -- Agent management
    ├── /admin/sla          -- SLA policy config
    ├── /admin/rules        -- Auto-assignment rules builder
    └── /admin/reports      -- Management reports
```

### 6.9 Embedded Help Widget (All 3 Procurement Portals)

**packages/ui/src/HelpWidget.tsx:**
- "? Help" button in every portal header
- Click: slide-over panel
  - Search input (debounce 300ms -> GET /support/api/v1/kb/search?q={query})
  - Results: article title + category + 120-char snippet
  - "View full article" -> support portal new tab
  - "Still can't find?" -> "Raise a support ticket" button
  - Recent viewed articles (localStorage last 5)

Add HelpWidget to root layout of buyer-portal, supplier-portal, admin-portal.

### 6.10 Integration Between Support App & Procurement Portal

- Support ticket creation from portal: pre-fills org_id, user email, portal type
- Support agent can link ticket to procurement entity (PO, PR, Invoice, etc.)
- When linked: procurement portal shows "Support Ticket Open" badge on entity detail
- Webhook bridge: support.ticket.created event can trigger procurement webhooks
- Authentication: buyers/suppliers log into support portal using procurement JWT (same RS256 key)

---

## PHASE 7: Cross-Spec Integration & Regression

### 7.1 Integration Matrix

| From | To | Integration |
|---|---|---|
| SPEC_26 Tickets | SPEC_30 Indentor | "Raise Ticket" on GRN page pre-fills entity_type=GRN |
| SPEC_26 Tickets | SPEC_27-G Export | Export tickets via async Export Center |
| SPEC_27-D Webhooks | SPEC_26 Tickets | ticket.created, ticket.resolved events published |
| SPEC_27-D Webhooks | SPEC_29 Support | support.ticket.created -> procurement webhooks |
| SPEC_27-G Export | All modules | Replace all sync CSV exports with async ExportButton |
| SPEC_27-J Payment | SPEC_29 Support | Support tickets can reference payment disputes |
| SPEC_28 Developer | SPEC_27-E API Keys | Shared api_keys table (prc_test_* keys for sandbox) |
| SPEC_29 Support | All 3 portals | Embedded Help Widget + "Help & Support" nav link |

### 7.2 Kong Gateway Updates (kong/kong.yml)

```yaml
# New frontend routes
- name: support-portal-static
  paths: ["/support-ui"]
  service: support-portal:3004

- name: developer-portal-static
  paths: ["/developer"]
  service: developer-portal:3005

# New API route prefixes
- name: support-api
  paths: ["/support/api/v1"]
  service: api:8000
  plugins: [jwt]  # Accepts procurement JWT

- name: sandbox-api
  paths: ["/sandbox/api/v1"]
  service: api:8000
  plugins: [key-auth]  # Accepts developer API keys

- name: superadmin-reports
  paths: ["/api/v1/superadmin"]
  service: api:8000
  plugins: [jwt]

# PUBLIC routes -- NO auth plugins
- name: razorpay-webhook
  paths: ["/api/v1/webhooks/gateway/razorpay"]
  service: api:8000
  # No jwt, no key-auth

- name: stripe-webhook
  paths: ["/api/v1/webhooks/gateway/stripe"]
  service: api:8000
  # No jwt, no key-auth

- name: public-branding
  paths: ["/api/v1/public/branding"]
  service: api:8000
  # No auth -- publicly cached

- name: public-changelog
  paths: ["/api/v1/public/changelog"]
  service: api:8000
  # No auth
```

### 7.3 .env.example Additions

```dotenv
# Support App
SUPPORT_APP_URL=http://localhost:3004
SUPPORT_EMAIL=support@procurement.com
MAILGUN_API_KEY=
MAILGUN_WEBHOOK_SIGNING_KEY=
INBOUND_EMAIL_DOMAIN=support@procurement.com

# Developer Platform
DEVELOPER_PORTAL_URL=http://localhost:3005
DEVELOPER_JWT_PRIVATE_KEY_PATH=keys/developer_private.pem
DEVELOPER_JWT_PUBLIC_KEY_PATH=keys/developer_public.pem

# Payment Gateways
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
PAYMENT_GATEWAY_WEBHOOK_SECRET=

# Webhook Delivery
WEBHOOK_DELIVERY_TIMEOUT_SECONDS=30
WEBHOOK_MAX_RETRIES=5
WEBHOOK_RETRY_DELAY_SECONDS=60

# Export Center
EXPORT_JOB_EXPIRY_DAYS=7
EXPORT_MAX_ROWS_SYNC=0

# QA/UAT
QA_MODE_ENABLED=false
TEST_RECORD_PURGE_DAYS=30

# Grafana (moved to 3006 to free 3005 for developer portal)
GRAFANA_PORT=3006
```

---

## TEST STRATEGY

### Three-Persona Coverage (GEMINI.md §3)

**User Persona (Happy Path + Edge Cases):**
- Indentor builds cart from catalog, transfers to buyer -> PR created with is_indent=True
- Indentor confirms GRN delivery as consignee -> GRN.consignee_status=CONFIRMED
- Buyer raises ticket on PO -> ticket created, buyer receives email notification
- Supplier raises query on invoice -> supplier sees own ticket only, no internal notes
- Admin configures SLA, reviews breached tickets
- Finance controller initiates Razorpay payment -> webhook updates payment status
- Customer raises support ticket -> agent assigns, resolves, CSAT survey sent

**Developer Persona (Automated Suite):**
```bash
# Unit tests
pytest tests/unit/test_indent_cart_service.py -v
pytest tests/unit/test_ticket_service.py -v
pytest tests/unit/test_ticket_fsm.py -v
pytest tests/unit/test_mention_parser.py -v
pytest tests/unit/test_webhook_service.py -v
pytest tests/unit/test_api_key_service.py -v
pytest tests/unit/test_payment_gateway_service.py -v
pytest tests/unit/test_support_sla_service.py -v
pytest tests/unit/test_export_service.py -v

# Integration tests
pytest tests/integration/ -v

# Full suite with coverage gate
pytest tests/ --cov=app --cov-fail-under=80 -v

# TypeScript + build
cd procurement-portal-frontend && pnpm run typecheck && pnpm run build
```

**QA Persona (Comprehensive Checklist):**
- [ ] 500+ row ticket list: performance < 300ms (index verified)
- [ ] 100k+ row export: completes without timeout via async queue
- [ ] 10 concurrent ticket creates: all get unique TKT-* numbers (sequence race condition)
- [ ] All role combos: INDENTOR, BUYER, APPROVER, FINANCE, SUPPLIER, ADMIN, SUPERADMIN, QA_TESTER
- [ ] Boundary values: max 50 cart items (51st rejected), 15-min comment edit, 30-day reopen
- [ ] Full E2E workflow: Indentor -> Cart -> Transfer -> PR -> RFQ -> PO -> GRN -> Indentor confirms
- [ ] is_private ticket isolation: verify SQL-level, not application-layer
- [ ] Supplier cannot see is_internal=True ticket comments (verify at DB query level)
- [ ] SLA breach simulation: Celery time advance, verify escalation notification fires
- [ ] Webhook delivery: entity created -> webhook fires within 5s -> delivery log updated
- [ ] API key rate limiting: exceed tier -> 429 with Retry-After header returned
- [ ] Razorpay webhook HMAC: valid signature accepted, invalid signature = 401
- [ ] Stripe webhook Stripe-Signature: valid accepted, tampered = 401
- [ ] Company switcher: verify no stale cross-org data after window.location.reload()
- [ ] is_test_record: QA_TESTER creates PR -> is_test_record=TRUE -> excluded from analytics
- [ ] Consignee CRAC: GRN.consignee_status=CONFIRMED triggers payment process
- [ ] Support KB search: tsvector search returns relevant results < 200ms
- [ ] Onboarding wizard: browser close at step 4, reopen -> resumes at step 4 (DB persistence)
- [ ] Audit trail: every ticket status change logged to ticket_activity_log (immutable)
- [ ] Export Center: 7-day link expiry (verify presigned URL expires after 7 days)

---

## SPEC AUDIT — POST-IMPLEMENTATION TARGET

```
MODULE           | SPEC | DATE
SPEC_30-Phase2   [DONE] -> cart_service.py, cart_router.py, GRN consignee endpoints,
                           3 frontend pages (catalog/cart/deliveries), 12 unit tests
SPEC_26          [DONE] -> ticket/ module (9 files), 30+ endpoints, 3-portal UI,
                           3 Celery tasks, ES search, 7 RabbitMQ events
SPEC_27-A        [DONE] -> company switcher backend + frontend (full reload on switch)
SPEC_27-B        [DONE] -> onboarding wizard 8 steps (DB-persisted, back navigation)
SPEC_27-C        [DONE] -> superadmin reports (RLS bypassed, audit logged)
SPEC_27-D        [DONE] -> webhook management CRUD + delivery log + HMAC security
SPEC_27-E        [DONE] -> api key management (SHA-256 hash, raw shown once)
SPEC_27-F        [DONE] -> branding per tenant (WCAG AA validated, CDN-cached public)
SPEC_27-G        [DONE] -> export center async (celery.exports queue, 7-day TTL)
SPEC_27-H        [DONE] -> buyer activity report UI (heatmap, velocity, league table)
SPEC_27-I        [DONE] -> UAT overlay (QA_TESTER role, is_test_record, purge task)
SPEC_27-J        [DONE] -> payment gateway (Razorpay INR + Stripe, HMAC verification)
SPEC_28          [DONE] -> developer portal port 3005 (sandbox, SDK, changelog, docs)
SPEC_29          [DONE] -> support app port 3004 (KB, SLA, auto-assign, CSAT, email-to-ticket)

OVERALL TARGET: 14/14 SPECs | BACKEND 95% | FRONTEND 90% | TESTS 85%
```

---

## COMPLETE FILE MANIFEST

### New Migrations (22 files)
```
alembic/versions/0055_indent_cart.py
alembic/versions/0056_grn_consignee.py
alembic/versions/0057_ticket_enums.py
alembic/versions/0058_ticket_tables.py
alembic/versions/0059_ticket_sequences.py
alembic/versions/0060_ticket_indexes.py
alembic/versions/0061_ticket_rls.py
alembic/versions/0062_ticket_sla_seed.py
alembic/versions/0063_ticket_permissions.py
alembic/versions/0064_ticket_extended.py
alembic/versions/0065_company_switcher.py
alembic/versions/0066_onboarding.py
alembic/versions/0067_platform_admin.py
alembic/versions/0068_webhook_endpoints.py
alembic/versions/0069_api_keys.py
alembic/versions/0070_export_jobs.py
alembic/versions/0071_payment_gateway.py
alembic/versions/0072_test_records.py
alembic/versions/0073_new_permissions.py
alembic/versions/0074_new_indexes.py
alembic/versions/0075_developer_platform.py
alembic/versions/0076_support_app.py
```

### New Backend Files (37 files)
```
app/modules/requisition/cart_service.py
app/modules/requisition/cart_router.py
app/modules/requisition/cart_models.py
app/modules/ticket/__init__.py
app/modules/ticket/models.py
app/modules/ticket/fsm.py
app/modules/ticket/sla_service.py
app/modules/ticket/mention_parser.py
app/modules/ticket/search_service.py
app/modules/ticket/permissions.py
app/modules/ticket/repository.py
app/modules/ticket/service.py
app/modules/ticket/router.py
app/modules/organization/membership_models.py
app/modules/admin/onboarding_service.py
app/modules/admin/onboarding_router.py
app/modules/admin/superadmin_reports_router.py
app/modules/integration/webhook_service.py
app/modules/integration/webhook_router.py
app/modules/developer/api_key_service.py
app/modules/developer/api_key_router.py
app/modules/developer/sandbox_service.py
app/modules/developer/sandbox_router.py
app/modules/developer/changelog_router.py
app/modules/developer/developer_auth.py
app/modules/export/export_service.py
app/modules/export/export_router.py
app/modules/analytics/buyer_activity_router.py
app/modules/payment/gateway_service.py
app/modules/support/__init__.py
app/modules/support/models.py
app/modules/support/service.py
app/modules/support/router.py
app/modules/support/auto_assignment_service.py
app/modules/support/sla_service.py
app/modules/support/kb_service.py
app/tasks/ticket_sla.py
app/tasks/export_tasks.py
app/tasks/support_sla_tasks.py
```

### New Frontend Files (50+ files)
```
# Buyer Portal
apps/buyer-portal/app/(main)/indents/catalog/page.tsx
apps/buyer-portal/app/(main)/indents/cart/page.tsx
apps/buyer-portal/app/(main)/indents/deliveries/page.tsx
apps/buyer-portal/app/(main)/tickets/page.tsx
apps/buyer-portal/app/(main)/tickets/board/page.tsx
apps/buyer-portal/app/(main)/tickets/[id]/page.tsx
apps/buyer-portal/app/(main)/tickets/new/page.tsx
apps/buyer-portal/app/(main)/analytics/buyer-activity/page.tsx
apps/buyer-portal/app/(main)/export-center/page.tsx

# Supplier Portal
apps/supplier-portal/app/(main)/tickets/page.tsx
apps/supplier-portal/app/(main)/tickets/new/page.tsx
apps/supplier-portal/app/(main)/tickets/[id]/page.tsx

# Admin Portal
apps/admin-portal/app/(main)/tickets/page.tsx
apps/admin-portal/app/(main)/tickets/board/page.tsx
apps/admin-portal/app/(main)/tickets/dashboard/page.tsx
apps/admin-portal/app/(main)/tickets/sla/page.tsx
apps/admin-portal/app/(main)/tickets/reports/page.tsx
apps/admin-portal/app/(main)/onboarding/page.tsx
apps/admin-portal/app/(main)/onboarding/step-[n]/page.tsx  (8 steps)
apps/admin-portal/app/(main)/superadmin/reports/page.tsx
apps/admin-portal/app/(main)/integrations/webhooks/page.tsx
apps/admin-portal/app/(main)/integrations/webhooks/[id]/page.tsx
apps/admin-portal/app/(main)/integrations/api-keys/page.tsx
apps/admin-portal/app/(main)/integrations/api-keys/[id]/page.tsx
apps/admin-portal/app/(main)/settings/branding/page.tsx
apps/admin-portal/app/(main)/settings/payment-gateway/page.tsx
apps/admin-portal/app/(main)/export-center/page.tsx

# New Standalone Apps
apps/support-portal/  (12+ pages per Phase 6.8)
apps/developer-portal/ (8+ pages per Phase 5.7)

# Shared packages
packages/hooks/src/useIndentCart.ts
packages/hooks/src/useTickets.ts
packages/hooks/src/useSupportTickets.ts
packages/hooks/src/useExportJobs.ts
packages/hooks/src/useWebhooks.ts
packages/hooks/src/useApiKeys.ts
packages/ui/src/ticket/TicketListTable.tsx
packages/ui/src/ticket/TicketKanbanBoard.tsx
packages/ui/src/ticket/TicketDetailPanel.tsx
packages/ui/src/ticket/TicketCreateModal.tsx
packages/ui/src/ticket/CommentFeed.tsx
packages/ui/src/ticket/MentionInput.tsx
packages/ui/src/ticket/SLACountdownChip.tsx
packages/ui/src/ticket/InternalNoteBadge.tsx
packages/ui/src/ticket/TicketLinkSelector.tsx
packages/ui/src/HelpWidget.tsx
packages/ui/src/ExportButton.tsx
packages/ui/src/CompanySwitcher.tsx
packages/ui/src/QATestModeBanner.tsx
```

### New Seed Scripts (9 files)
```
scripts/seed_indent_carts.py
scripts/seed_tickets_phase2.py
scripts/seed_webhook_endpoints.py
scripts/seed_api_keys.py
scripts/seed_qa_user.py
scripts/seed_developer_accounts.py
scripts/seed_support_agents.py
scripts/seed_kb_articles.py
scripts/seed_changelog.py
```

---

## PERMISSIONS MATRIX UPDATE

| Role | New Permissions |
|---|---|
| INDENTOR | cart.create, cart.view_own, cart.transfer, grn.consignee_confirm, indent.track |
| BUYER | ticket.view_team, ticket.assign, webhook.view, export.create |
| SOURCING_MANAGER | ticket.view_team, ticket.assign, ticket.resolve, webhook.manage |
| PROCUREMENT_HEAD | ticket.view_all, report.buyer_activity, export.create |
| FINANCE_CONTROLLER | ticket.view_team, ticket.resolve, payment.initiate, payment.refund |
| PROCUREMENT_ADMIN | All ticket.*, webhook.manage, api_key.manage, export.create, branding.manage |
| SUPERADMIN | All permissions + report.cross_company, switcher.switch_org |
| QA_TESTER | All *.view_* + *.create + *.submit -- NO approve/close/pay |
| SUPPLIER_USER | ticket.create (own only), ticket.view_own |

---

## PERFORMANCE REQUIREMENTS

| Feature | Target | Enforcement |
|---|---|---|
| Ticket list (25 results) | < 300ms | Composite index on (org_id, status, created_at) |
| Comment thread (20 comments) | < 200ms | Cursor-based pagination |
| Real-time comment delivery | < 500ms | WebSocket push (existing infra) |
| Ticket search (Elasticsearch) | < 1s | ES index tickets-{YYYY.MM} monthly rotation |
| Celery SLA check (10,000 tickets) | < 60s | Batch query with chunked processing |
| Cart add item | < 100ms | Simple INSERT with UNIQUE check |
| Export job (100k rows) | < 5min | Stream to file (no full memory load) |
| Webhook delivery | < 5s first attempt | Dedicated celery.webhooks queue |
| API key validation | < 5ms | Redis cache SHA-256 hash lookups |
| Support KB search | < 200ms | PostgreSQL tsvector + GIN index |
| Sandbox reset | < 30s | TRUNCATE + seed in single transaction |

---

## INDUSTRY RESEARCH INCORPORATED

Based on research from SAP Ariba, GeM (Government eMarketplace), Coupa, Zycus, Procurify, Zendesk, Stripe, Razorpay:

**1. Indentor Role (GeM/Ariba model):** Consumer-grade shopping experience, no checkout authority, mandatory buyer hand-off, PRC (DRAFT) + CRAC (ACCEPTED) workflow for consignee acceptance. Max 30-day CRAC auto-generate if consignee inactive. Self-Service Transfer of Ownership for reassigning carts.

**2. Ticket System (Jira/ServiceNow model):** SLA countdown chips with color tiers (green/amber/red/breached), Kanban DnD with @dnd-kit, @mentions auto-watcher, internal notes isolation, entity linking, auto-escalation, round-robin assignment. Per-priority SLA (CRITICAL 1h/4h, HIGH 4h/24h, MEDIUM 8h/72h, LOW 24h/168h).

**3. API Key Management (Stripe/GitHub model):** prc_{env}_{random32} prefix format, SHA-256 hash storage only, raw key shown once at creation/rotation, scoped permissions, rate tier enforcement (100/1000/unlimited req/min), usage analytics dashboard.

**4. Export Center (Salesforce/HubSpot async model):** Never synchronous for large datasets, queue-based via dedicated Celery queue, 7-day download link (presigned URL), WebSocket notification on completion, progress polling with refetchInterval.

**5. Support Helpdesk (Zendesk/Freshdesk model):** Three-surface architecture (customer portal + agent dashboard + admin panel), CSAT surveys on close, SLA with business-hours awareness, auto-assignment rules engine, canned responses with shortcut expansion, email-to-ticket via inbound parse webhooks, knowledge base with tsvector search.

**6. Payment Gateway (Razorpay/Stripe dual model):** Currency-based auto-routing (INR -> Razorpay, other -> Stripe), HMAC-SHA256 webhook verification before any processing, Fernet-encrypted credential storage, idempotency guards (gateway_order_id IS NULL check), dual-approval workflow for refunds.

**7. Developer Platform (Stripe/Twilio model):** Separate JWT key pair for developer auth, isolated sandbox PostgreSQL schema (reset in < 30s), SDK auto-generation from OpenAPI spec on version bumps, API changelog with RSS/Atom feeds, rate limit dashboard with real-time quota visualization.
