# SPEC_26: Procurement Ticket & Query Management System
**Version:** 1.0 | **Phase:** Core | **Squad:** E | **Depends on:** SPEC_04, SPEC_05, SPEC_16, SPEC_17

---

## 1. OVERVIEW

A Jira-style internal ticketing platform embedded inside all 3 portals. Users raise tickets to report issues, ask queries, or request support — all linked to procurement entities (PR, RFQ, PO, Invoice, Contract, Vendor). Real-time comments, @mentions, file attachments, SLA tracking, Kanban board, and cross-portal visibility.

### 1.1 Problem Statement
- Buyers raise vendor issues over email — no audit trail
- Suppliers query invoice/PO discrepancies with no structured channel
- Support queries about system behavior get lost in chat
- No linkage between issues and the procurement entities they concern

### 1.2 Who Uses It
| Portal | Role | Can Do |
|---|---|---|
| Buyer | All buyer roles | Raise tickets, comment, assign, close |
| Supplier | Supplier User | Raise tickets on their own POs/Invoices/RFQs, view and comment |
| Admin | SUPERADMIN, PROCUREMENT_ADMIN | Full access: all tickets, SLA config, category management, reports |

---

## 2. DATA MODEL

### 2.1 `tickets` table
```sql
id                UUID PK DEFAULT gen_random_uuid()
org_id            UUID NOT NULL REFERENCES organizations(id)
ticket_number     VARCHAR(30) NOT NULL UNIQUE  -- TKT-{ORG_CODE}-{YYYY}-{NNNNNN}
title             VARCHAR(500) NOT NULL
description       TEXT NOT NULL
ticket_type       ticket_type_enum NOT NULL
priority          ticket_priority_enum NOT NULL DEFAULT 'MEDIUM'
status            ticket_status_enum NOT NULL DEFAULT 'OPEN'
category          VARCHAR(100)                 -- Procurement, Finance, Technical, Vendor, General
raised_by         UUID NOT NULL REFERENCES users(id)
raised_by_portal  VARCHAR(20) NOT NULL         -- 'buyer', 'supplier', 'admin'
assigned_to       UUID REFERENCES users(id)
assigned_team     VARCHAR(100)                 -- 'Procurement Team', 'Finance Team', 'IT Support'
entity_type       VARCHAR(50)                  -- REQUISITION, RFQ, PO, INVOICE, CONTRACT, VENDOR, GENERAL
entity_id         UUID                         -- FK to linked entity
entity_number     VARCHAR(100)                 -- Human-readable: PR-MUM-2026-000124
resolution_note   TEXT
resolved_at       TIMESTAMP WITH TIME ZONE
sla_breach_at     TIMESTAMP WITH TIME ZONE     -- Computed: created_at + SLA hours per priority
sla_status        VARCHAR(20) DEFAULT 'WITHIN_SLA'  -- WITHIN_SLA, AT_RISK, BREACHED
first_response_at TIMESTAMP WITH TIME ZONE     -- When first comment added by assignee
reopen_count      INT DEFAULT 0
tags              TEXT[]                       -- Array of tag strings
is_private        BOOL DEFAULT FALSE           -- Private: only raised_by + assignee + admins see it
-- Base columns: version, created_at, updated_at, deleted_at
```

### 2.2 `ticket_comments` table
```sql
id              UUID PK
org_id          UUID NOT NULL
ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE
author_id       UUID NOT NULL REFERENCES users(id)
content         TEXT NOT NULL                  -- Markdown supported
is_internal     BOOL DEFAULT FALSE             -- Internal note: NOT visible to supplier who raised ticket
mentioned_users UUID[]                         -- Parsed @mention user IDs
edited_at       TIMESTAMP WITH TIME ZONE
edited_by       UUID REFERENCES users(id)
parent_id       UUID REFERENCES ticket_comments(id)  -- Thread reply support
-- Base columns: version, created_at, updated_at, deleted_at
```

### 2.3 `ticket_attachments` table
```sql
id              UUID PK
org_id          UUID NOT NULL
ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE
comment_id      UUID REFERENCES ticket_comments(id)  -- NULL = attached to ticket itself
document_id     UUID NOT NULL REFERENCES documents(id)
uploaded_by     UUID NOT NULL REFERENCES users(id)
file_name       VARCHAR(255) NOT NULL
-- Base columns
```

### 2.4 `ticket_watchers` table
```sql
id          UUID PK
org_id      UUID NOT NULL
ticket_id   UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE
user_id     UUID NOT NULL REFERENCES users(id)
added_by    UUID NOT NULL REFERENCES users(id)
UNIQUE (ticket_id, user_id)
```

### 2.5 `ticket_activity_log` table
```sql
id              UUID PK
org_id          UUID NOT NULL
ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE
actor_id        UUID NOT NULL REFERENCES users(id)
activity_type   VARCHAR(50) NOT NULL   -- STATUS_CHANGE, ASSIGNMENT_CHANGE, PRIORITY_CHANGE,
                                       -- COMMENT_ADDED, WATCHER_ADDED, ATTACHMENT_ADDED,
                                       -- TAG_ADDED, ENTITY_LINKED, REOPENED, RESOLVED, CLOSED
old_value       VARCHAR(500)
new_value       VARCHAR(500)
-- Base columns (no deleted_at — immutable log)
```

### 2.6 `ticket_sla_config` table (per org, per priority)
```sql
id              UUID PK
org_id          UUID NOT NULL
priority        ticket_priority_enum NOT NULL
first_response_hours   INT NOT NULL DEFAULT 4
resolution_hours       INT NOT NULL DEFAULT 48
escalation_hours       INT NOT NULL DEFAULT 72
escalate_to_role       VARCHAR(100)
UNIQUE (org_id, priority)
```

### 2.7 ENUMs
```sql
CREATE TYPE ticket_type_enum AS ENUM (
  'QUERY',            -- General question or clarification needed
  'BUG',              -- System error or incorrect behavior
  'DISCREPANCY',      -- Data mismatch (e.g. invoice vs PO)
  'COMPLAINT',        -- Formal complaint against vendor or process
  'CHANGE_REQUEST',   -- Request to change an approved entity
  'SUPPORT',          -- Help needed with platform usage
  'AUDIT_QUERY',      -- Auditor or compliance question
  'VENDOR_ISSUE'      -- Issue raised about a specific vendor
);

CREATE TYPE ticket_priority_enum AS ENUM (
  'CRITICAL',   -- Business blocked; immediate action needed
  'HIGH',       -- Significant impact; respond within 4h
  'MEDIUM',     -- Moderate impact; respond within 24h
  'LOW'         -- Informational; respond within 72h
);

CREATE TYPE ticket_status_enum AS ENUM (
  'OPEN',             -- Raised, not yet picked up
  'IN_PROGRESS',      -- Assignee is working on it
  'PENDING_RESPONSE', -- Waiting for response from ticket raiser
  'ESCALATED',        -- Escalated to senior / different team
  'RESOLVED',         -- Solution provided; waiting for raiser to confirm
  'CLOSED',           -- Confirmed resolved or auto-closed after 7 days
  'REOPENED'          -- Raiser rejected resolution; ticket active again
);
```

---

## 3. TICKET NUMBER FORMAT
`TKT-{ORG_CODE}-{YYYY}-{NNNNNN}`
Examples: `TKT-TCI-2026-000001`, `TKT-TCI-2026-001247`
Sequence: PostgreSQL sequence per org per year (same mechanism as PR/PO numbers).

---

## 4. TICKET LIFECYCLE (FSM)

```
OPEN → IN_PROGRESS (when assigned_to set or assignee picks it up)
IN_PROGRESS → PENDING_RESPONSE (assignee asks raiser for more info)
IN_PROGRESS → ESCALATED (SLA breached or manual escalation)
IN_PROGRESS → RESOLVED (assignee marks resolved with resolution_note)
PENDING_RESPONSE → IN_PROGRESS (raiser replies with more info)
PENDING_RESPONSE → CLOSED (no response in 7 days — auto-closed by Celery)
RESOLVED → CLOSED (raiser accepts resolution or 3 days auto-close)
RESOLVED → REOPENED (raiser rejects resolution — increments reopen_count)
REOPENED → IN_PROGRESS
ESCALATED → IN_PROGRESS (after escalation acknowledged)
CLOSED → REOPENED (only by raiser within 30 days; admin anytime)
```

**Rule:** Supplier users can ONLY reopen or close tickets THEY raised.
**Rule:** Admins can transition any ticket to any status.
**Rule:** A ticket cannot be CLOSED by the assignee directly — only RESOLVED. Raiser or auto-close confirms CLOSED.

---

## 5. SLA POLICY (DEFAULT — configurable per org via ticket_sla_config)
| Priority | First Response | Resolution | Escalation |
|---|---|---|---|
| CRITICAL | 1 hour | 4 hours | 2 hours |
| HIGH | 4 hours | 24 hours | 12 hours |
| MEDIUM | 8 hours | 72 hours | 48 hours |
| LOW | 24 hours | 168 hours (7d) | 96 hours |

`sla_breach_at` computed at creation: `created_at + resolution_hours`
Auto-escalation triggered at `escalation_hours` by Celery task.

---

## 6. ENTITY LINKING
When a ticket is raised from within a PR/RFQ/PO/Invoice etc. page, it auto-links to that entity.
Linking stores `entity_type`, `entity_id`, and `entity_number` on the ticket.
The linked entity detail page shows a "Tickets" tab with all linked open tickets.

**Allowed link types:**
| entity_type | Human Readable |
|---|---|
| REQUISITION | PR-MUM-2026-000124 |
| RFQ | RFQ-MUM-2026-000045 |
| PURCHASE_ORDER | PO-MUM-2026-000078 |
| INVOICE | INV-2026-000089 |
| CONTRACT | CON-2026-000012 |
| VENDOR | VND-0001 |
| GRN | GRN-2026-000089 |
| GENERAL | (no entity) |

---

## 7. VISIBILITY & ACCESS CONTROL

| Ticket | Buyer can see | Supplier can see | Admin can see |
|---|---|---|---|
| Raised by buyer | All within same org | NO | YES |
| Raised by supplier | YES (if linked to entity they manage) | Own tickets only | YES |
| is_private=True | Raised_by + assigned_to + ADMIN only | NO | YES |
| Internal comment | Buyer + Admin only | NOT VISIBLE | YES |

**Permission codes to add to PermissionCode class:**
```python
TICKET_CREATE         = "ticket.create"
TICKET_VIEW_OWN       = "ticket.view_own"
TICKET_VIEW_TEAM      = "ticket.view_team"
TICKET_VIEW_ALL       = "ticket.view_all"
TICKET_ASSIGN         = "ticket.assign"
TICKET_RESOLVE        = "ticket.resolve"
TICKET_CLOSE          = "ticket.close"
TICKET_REOPEN         = "ticket.reopen"
TICKET_ADD_INTERNAL   = "ticket.add_internal_note"
TICKET_ESCALATE       = "ticket.escalate"
TICKET_CONFIG_SLA     = "ticket.config_sla"
TICKET_EXPORT         = "ticket.export"
```

**Default role → permission mappings:**
| Role | Permissions |
|---|---|
| REQUESTOR | create, view_own |
| BUYER | create, view_team, assign (to self) |
| SOURCING_MANAGER | create, view_team, assign |
| APPROVER | create, view_team, assign, resolve |
| PROCUREMENT_HEAD | all except config_sla |
| FINANCE_CONTROLLER | create, view_team, assign, resolve |
| VENDOR_ADMIN | create, view_all, assign, resolve, escalate |
| PROCUREMENT_ADMIN | all |
| SUPERADMIN | all |
| SUPPLIER_USER | create (own only), view_own |

---

## 8. COMMENT SYSTEM

### 8.1 @mentions
- Parse `@username` in comment content
- Resolve to user IDs at save time
- Add mentioned users to ticket watchers automatically
- Send in-app notification to mentioned users
- Render as `<span class="mention">@Arjun Sharma</span>` in frontend

### 8.2 Internal Notes
- `is_internal=True` comments NOT shown to supplier users
- Visually differentiated: yellow background, 🔒 INTERNAL badge
- Only users with `ticket.add_internal_note` permission can add

### 8.3 Markdown Support
- Full CommonMark markdown in comment content
- Code blocks, bold, italic, bullet lists, tables
- Rendered server-side via `mistune` Python library OR client-side via `react-markdown`

### 8.4 Edit & Delete
- Author can edit own comment within 15 minutes of posting
- Edit records: `edited_at`, `edited_by` stored; "Edited" label shown in UI
- Soft-delete: deleted comments show "[Comment deleted]" placeholder

---

## 9. NOTIFICATIONS (integrated with SPEC_16)

All ticket events publish to `procurement.notification` exchange:

| Event | Notified Parties | Channel |
|---|---|---|
| Ticket created | assigned_to (if set), all watchers | Email + In-App |
| Comment added | All watchers (except comment author) | In-App |
| @mention in comment | Mentioned user | In-App + Email |
| Status changed | raised_by + all watchers | In-App |
| Assigned to user | New assignee | Email + In-App |
| SLA at 50% | assigned_to | In-App |
| SLA breached | assigned_to + assigned_to's manager | Email + In-App |
| Escalated | Escalation target | Email + In-App |
| Resolved | raised_by | Email + In-App |
| Auto-closed | raised_by | Email |

Real-time: ticket comment additions pushed via WebSocket (same `ws:user:{id}` channel, `notification_type: TICKET_UPDATE`).

---

## 10. API ENDPOINTS

```
# Tickets CRUD
GET    /api/v1/tickets                         → list (filters: status, type, priority, assigned_to, entity_type, entity_id, my_tickets, team_tickets, tags, date_range)
POST   /api/v1/tickets                         → create ticket
GET    /api/v1/tickets/{id}                    → ticket detail with latest 20 comments
PUT    /api/v1/tickets/{id}                    → update (title, description, priority, category, tags, is_private)
DELETE /api/v1/tickets/{id}                    → soft delete (ADMIN only)

# Status transitions
POST   /api/v1/tickets/{id}/assign             → body: {user_id, team}
POST   /api/v1/tickets/{id}/start-progress     → → IN_PROGRESS
POST   /api/v1/tickets/{id}/resolve            → body: {resolution_note} → RESOLVED
POST   /api/v1/tickets/{id}/close              → → CLOSED (raiser/admin)
POST   /api/v1/tickets/{id}/reopen             → body: {reason} → REOPENED
POST   /api/v1/tickets/{id}/escalate           → body: {reason, escalate_to_user_id}
POST   /api/v1/tickets/{id}/pending-response   → → PENDING_RESPONSE

# Comments
GET    /api/v1/tickets/{id}/comments           → paginated comment list (cursor-based)
POST   /api/v1/tickets/{id}/comments           → add comment (supports is_internal flag)
PUT    /api/v1/tickets/{id}/comments/{cid}     → edit comment (within 15 min only)
DELETE /api/v1/tickets/{id}/comments/{cid}     → soft delete comment

# Attachments
POST   /api/v1/tickets/{id}/attachments        → upload attachment (via document service)
DELETE /api/v1/tickets/{id}/attachments/{aid}  → remove attachment

# Watchers
GET    /api/v1/tickets/{id}/watchers           → list watchers
POST   /api/v1/tickets/{id}/watchers           → add watcher
DELETE /api/v1/tickets/{id}/watchers/{uid}     → remove watcher (self or admin)

# Activity
GET    /api/v1/tickets/{id}/activity           → full activity log

# Dashboard & Search
GET    /api/v1/tickets/dashboard               → counts by status/priority/type; SLA compliance %
GET    /api/v1/tickets/my-open                 → tickets raised by me that are still open
GET    /api/v1/tickets/assigned-to-me          → tickets assigned to me
POST   /api/v1/tickets/search                  → full-text search (Elasticsearch)
GET    /api/v1/tickets/export                  → CSV export of filtered list

# Config (Admin only)
GET    /api/v1/tickets/sla-config              → current SLA config per priority
PUT    /api/v1/tickets/sla-config              → update SLA thresholds

# Linked entity tickets (used in entity detail pages)
GET    /api/v1/tickets?entity_type=REQUISITION&entity_id={id}  → tickets linked to a PR
```

---

## 11. FRONTEND — BUYER PORTAL (localhost:3000)

### 11.1 Navigation (add to sidebar)
```
Support & Tickets ── My Tickets
                  ── All Tickets        (ticket.view_team or ticket.view_all)
                  ── Assigned to Me
                  ── Ticket Board (Kanban)
```

### 11.2 Pages

**Ticket List Page (`/tickets`)**
- Filter bar: status, type, priority, assigned_to, date_range, entity_type, tags, search
- View toggle: List / Board / My Tickets
- Table columns: Number, Title, Type, Priority badge, Status, Linked Entity, Assigned To, SLA status bar, Created At
- SLA countdown chip: "Due in 2h 15m" (amber < 50% remaining, red = breached)
- Quick action: click row → ticket detail drawer (not full page navigation)
- "+ New Ticket" button (always visible)
- Export CSV button

**Kanban Board (`/tickets/board`)**
- 5 columns: OPEN | IN_PROGRESS | PENDING_RESPONSE | RESOLVED | CLOSED
- Ticket cards: title (truncated 60 chars), priority dot (colored), type badge, assignee avatar, SLA chip
- Drag-and-drop card between columns triggers status transition API call
- Count badge on each column header
- Filter bar persists across list/board toggle

**Ticket Detail Page (`/tickets/{id}`)**
Left panel (65%): Title, description (markdown rendered), linked entity chip, tags
Right panel (35%): Status, priority, type, assigned to, reporter, created at, SLA deadline, watchers

Comment feed (below details):
- Newest at bottom, paginated with "Load more" at top
- Each comment: avatar, author name, timestamp, content (markdown), edit/delete if own within 15min
- Internal notes: yellow background, "🔒 Internal Note" badge — only shown to authorized users
- "Add Comment" box: markdown textarea, @mention autocomplete, "Internal Note" toggle (if permitted), attachment upload, Submit button
- Activity timeline: interleaved with comments (status changes, assignments in gray text)

**Create Ticket Modal (`/tickets/new`)**
- Title (required, min 5 chars)
- Description: markdown editor with preview tab, min 20 chars
- Type: dropdown with icons per type
- Priority: radio with description of impact per level
- Category: dropdown (Procurement, Finance, Technical, Vendor, General)
- Link to entity: select entity type → search/select entity by number
- Tags: multi-input tag field
- Is Private: toggle (only for buyer users with permission)
- Attach files: drag-and-drop (uses document service)
- Submit button

**Tickets tab on entity detail pages:**
- Each PR, RFQ, PO, Invoice, Contract, Vendor detail page has a "Tickets" tab
- Shows count badge: "Tickets (3)"
- Lists open tickets for that entity, with "+ Raise Ticket" pre-filling entity link

### 11.3 Notification bell integration
- `notification_type: TICKET_UPDATE` shown in notification bell
- Click notification → navigates to ticket detail page

---

## 12. FRONTEND — SUPPLIER PORTAL (localhost:3001)

### 12.1 Navigation (add to sidebar)
```
Support ── My Tickets
        ── Raise New Ticket
```

### 12.2 Pages

**My Tickets (`/tickets`)**
- Shows ONLY tickets raised by this supplier user
- Cannot see tickets raised by other suppliers or buyer-internal tickets
- Cannot see internal notes (is_internal=True comments hidden)
- Same table format but simpler (no assignee column, no team info)
- Status shown as customer-friendly labels: "We're working on it" instead of IN_PROGRESS

**Raise Ticket Page (`/tickets/new`)**
- Simpler form: Title, Description, Type (limited: QUERY, DISCREPANCY, COMPLAINT, SUPPORT), Priority
- Entity link: dropdown limited to supplier's own POs, Invoices, RFQs
- Cannot set is_private (always false for suppliers)
- Cannot add internal notes (no toggle shown)
- Attachment upload: invoice screenshots, supporting docs

**Ticket Detail (Supplier view)**
- Same layout BUT:
  - Internal notes NOT visible
  - Cannot change assignee, priority, or status
  - CAN add comments (to provide requested info)
  - CAN close ticket after RESOLVED status (confirm resolution)
  - CAN reopen within 30 days if issue persists

---

## 13. FRONTEND — ADMIN PORTAL (localhost:3002)

### 13.1 Navigation (add to sidebar)
```
Ticket System ── All Tickets
             ── Dashboard
             ── SLA Configuration
             ── Reports
```

### 13.2 Admin-specific capabilities
- See ALL tickets across org (all portals)
- Full Kanban board with all tickets
- Bulk actions: assign multiple, change status, export
- SLA config page: edit resolution hours per priority
- Reports: ticket volume by type/category, avg resolution time, SLA compliance %, top ticket raisers, agent performance
- Override any ticket: force-close, change priority, reassign
- Hard delete (SUPERADMIN only, with audit log)
- See all internal notes on all tickets

---

## 14. SEARCH (Elasticsearch)
- Index: `tickets-{YYYY.MM}` (monthly index rotation)
- Indexed fields: title, description, comments content, entity_number, tags, ticket_number
- Full-text search with highlighting
- Filters applied server-side before ES query
- Search results show snippet with highlighted match term

---

## 15. CELERY TASKS

```python
# Every 15 minutes: check SLA timers
@task check_ticket_sla_timers()
- Find all OPEN/IN_PROGRESS/PENDING_RESPONSE tickets
- Compare now() against sla_breach_at per priority
- At 50%: update sla_status=AT_RISK, publish notification.sla.warning
- At 100%: update sla_status=BREACHED, publish notification.sla.breach
- At escalation_hours: auto-escalate, publish notification.ticket.escalated

# Daily: auto-close idle tickets
@task auto_close_resolved_tickets()
- RESOLVED tickets with no activity for 3 days → CLOSED
- PENDING_RESPONSE tickets with no raiser reply for 7 days → CLOSED
- Notify raiser on auto-close

# Daily: send digest of open tickets
@task send_ticket_digest()
- Send summary email to assignees with their open ticket counts
- Include BREACHED SLA tickets prominently
```

---

## 16. RABBITMQ EVENTS

New exchange: `procurement.ticket` (topic, durable)
```
ticket.created                → created with all metadata
ticket.status.changed         → old_status, new_status, actor
ticket.comment.added          → comment_id, is_internal
ticket.assigned               → new_assignee_id
ticket.escalated              → escalated_to, reason
ticket.sla.warning            → priority, pct_elapsed
ticket.sla.breached           → priority, hours_overdue
ticket.resolved               → resolution_note
ticket.closed                 → closure_reason (resolved/auto/admin)
ticket.reopened               → reason, reopen_count
```

New queue: `q.ticket.events` → bound to `procurement.ticket` exchange → `ticket.*`
Consumer: in `notification/consumer.py` alongside existing queues.

---

## 17. AUDIT EVENTS

All ticket operations logged to `audit_logs` with `entity_type = 'TICKET'`:
```
TICKET_CREATED | TICKET_ASSIGNED | TICKET_STATUS_CHANGED
TICKET_COMMENT_ADDED | TICKET_INTERNAL_NOTE_ADDED
TICKET_RESOLVED | TICKET_CLOSED | TICKET_REOPENED
TICKET_ESCALATED | TICKET_SLA_BREACHED | TICKET_DELETED
TICKET_WATCHER_ADDED | TICKET_WATCHER_REMOVED
TICKET_ATTACHMENT_UPLOADED | TICKET_ENTITY_LINKED
TICKET_SLA_CONFIG_UPDATED (entity_type=ORG)
```

---

## 18. MIGRATIONS REQUIRED
```
0028_ticket_enums.py         → ticket_type, ticket_priority, ticket_status ENUMs
0029_ticket_tables.py        → tickets, ticket_comments, ticket_attachments,
                               ticket_watchers, ticket_activity_log, ticket_sla_config
0030_ticket_sequences.py     → seq_tkt_{org_code}_{year} (created dynamically per org)
0031_ticket_indexes.py       → All composite indexes (CONCURRENTLY)
0032_ticket_rls.py           → RLS on tickets (org_id isolation)
0033_ticket_seed.py          → Default SLA config for all 4 priorities per org
0034_ticket_permissions.py   → Add all 12 ticket permissions to permissions table
                               + assign to roles per Section 7
```

---

## 19. PERFORMANCE REQUIREMENTS
- Ticket list load: < 300ms for first 25 results
- Comment thread load: < 200ms for 20 comments
- Real-time comment delivery: < 500ms end-to-end
- Search results: < 1s for full-text query
- Celery SLA check for 10,000 tickets: < 60 seconds

---

## 20. PHASE 2 SCOPE (NOT IN THIS SPEC)
- AI-powered ticket auto-categorization (ML model)
- Ticket templates (pre-filled forms for common issue types)
- Time tracking per ticket
- Customer satisfaction survey after CLOSED
- Public status page for system-wide incidents
- SLA pause during non-business hours
- Merge duplicate tickets
