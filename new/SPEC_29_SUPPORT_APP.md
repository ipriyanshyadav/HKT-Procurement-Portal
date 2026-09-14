# SPEC_29: Support App — Standalone Helpdesk
**Version:** 1.0 | **Phase:** Enhancement | **Squad:** E
**App:** support.procureos.com (Next.js 14, port 3004)
**Note:** This is SEPARATE from the in-portal ticket system (SPEC_26). SPEC_26 handles
procurement-domain tickets inside the portals. This is a dedicated helpdesk for platform
support — bugs, onboarding help, billing, account issues.

---
## 1. OVERVIEW

A standalone lightweight support platform with three user-facing surfaces:
1. **Customer portal** — buyers/suppliers raise support tickets, browse knowledge base
2. **Agent dashboard** — internal support team manages and resolves tickets
3. **Admin panel** — configure SLAs, categories, canned responses, assign agents

### 1.1 Integration with Existing Systems
- Authenticates via ProcureOS SSO (same JWT RS256 keys) — buyers/suppliers don't need a new account
- Sends notifications via existing notification service (SPEC_16)
- Attaches files via existing document service (SPEC_17)
- Webhook integration: support tickets can trigger procurement portal webhooks (SPEC_27-D)
- Embeds in all 3 portal navbars as "Help & Support" link → opens support portal in new tab

---
## 2. DATABASE MODEL (separate schema: `support`)

### 2.1 `support.support_tickets`
```sql
id                  UUID PK DEFAULT gen_random_uuid()
ticket_number       VARCHAR(30) NOT NULL UNIQUE  -- SUP-{YYYY}-{NNNNNN}
org_id              UUID NOT NULL                -- which org the raiser belongs to
raised_by_user_id   UUID NOT NULL                -- FK to procurement users.id (cross-DB soft ref)
raised_by_email     VARCHAR(255) NOT NULL        -- denormalized for standalone queries
raised_by_name      VARCHAR(255) NOT NULL
raised_by_portal    VARCHAR(20) NOT NULL          -- buyer, supplier, admin
title               VARCHAR(500) NOT NULL
description         TEXT NOT NULL
category            VARCHAR(100) NOT NULL         -- BILLING, BUG, ONBOARDING, INTEGRATION, ACCOUNT, GENERAL
sub_category        VARCHAR(100)
priority            support_priority_enum NOT NULL DEFAULT 'MEDIUM'
status              support_status_enum NOT NULL DEFAULT 'OPEN'
channel             VARCHAR(20) DEFAULT 'WEB'     -- WEB, EMAIL, CHAT
assigned_agent_id   UUID REFERENCES support.support_agents(id)
assigned_team       VARCHAR(100)
first_response_at   TIMESTAMP WITH TIME ZONE
resolved_at         TIMESTAMP WITH TIME ZONE
closed_at           TIMESTAMP WITH TIME ZONE
sla_first_response_deadline  TIMESTAMP WITH TIME ZONE
sla_resolution_deadline      TIMESTAMP WITH TIME ZONE
sla_status          VARCHAR(20) DEFAULT 'WITHIN_SLA'
csat_score          INT                          -- 1-5, set after close
csat_comment        TEXT
reopen_count        INT DEFAULT 0
tags                TEXT[]
related_procurement_entity_type VARCHAR(50)      -- Links to PR/PO/Invoice if relevant
related_procurement_entity_id   UUID
is_spam             BOOL DEFAULT FALSE
spam_score          FLOAT
version             INT DEFAULT 1
created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
deleted_at          TIMESTAMP WITH TIME ZONE
```

### 2.2 `support.support_ticket_messages`
```sql
id              UUID PK
ticket_id       UUID NOT NULL REFERENCES support.support_tickets(id) ON DELETE CASCADE
author_type     VARCHAR(10) NOT NULL     -- CUSTOMER, AGENT, SYSTEM
author_id       UUID                     -- user_id or agent_id
author_name     VARCHAR(255) NOT NULL
author_email    VARCHAR(255)
content         TEXT NOT NULL            -- Markdown
is_internal     BOOL DEFAULT FALSE       -- Internal agent note
attachments     JSONB DEFAULT '[]'       -- [{doc_id, filename, url}]
email_message_id VARCHAR(500)            -- For email threading
created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
deleted_at      TIMESTAMP WITH TIME ZONE
```

### 2.3 `support.support_agents`
```sql
id              UUID PK
procurement_user_id UUID               -- Cross-ref to procurement users (optional)
email           VARCHAR(255) NOT NULL UNIQUE
full_name       VARCHAR(255) NOT NULL
display_name    VARCHAR(100)
avatar_url      VARCHAR(500)
teams           TEXT[] DEFAULT '{}'    -- ['tier1','billing','technical']
is_active       BOOL DEFAULT TRUE
is_available    BOOL DEFAULT TRUE      -- Online/offline toggle
max_tickets     INT DEFAULT 20         -- Max simultaneous open assignments
current_open_count INT DEFAULT 0
specializations TEXT[] DEFAULT '{}'   -- ['ERP_INTEGRATION','VENDOR_ONBOARDING']
version         INT DEFAULT 1
created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
deleted_at      TIMESTAMP WITH TIME ZONE
```

### 2.4 `support.knowledge_base_articles`
```sql
id              UUID PK
slug            VARCHAR(300) NOT NULL UNIQUE
title           VARCHAR(500) NOT NULL
content         TEXT NOT NULL          -- MDX (Markdown + React components)
category_id     UUID REFERENCES support.kb_categories(id)
author_agent_id UUID REFERENCES support.support_agents(id)
status          VARCHAR(20) DEFAULT 'DRAFT'   -- DRAFT, PUBLISHED, ARCHIVED
view_count      INT DEFAULT 0
helpful_votes   INT DEFAULT 0
not_helpful_votes INT DEFAULT 0
related_articles UUID[]
tags            TEXT[]
search_vector   TSVECTOR                -- PostgreSQL full-text search vector
last_reviewed_at TIMESTAMP WITH TIME ZONE
last_reviewed_by UUID REFERENCES support.support_agents(id)
version         INT DEFAULT 1
created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
deleted_at      TIMESTAMP WITH TIME ZONE
```

### 2.5 `support.kb_categories`
```sql
id          UUID PK
name        VARCHAR(200) NOT NULL
slug        VARCHAR(200) NOT NULL UNIQUE
description TEXT
icon        VARCHAR(50)          -- Tabler icon name
parent_id   UUID REFERENCES support.kb_categories(id)
sort_order  INT DEFAULT 0
article_count INT DEFAULT 0
version     INT DEFAULT 1
created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### 2.6 `support.canned_responses`
```sql
id              UUID PK
title           VARCHAR(300) NOT NULL
content         TEXT NOT NULL          -- Template with {{variables}}
category        VARCHAR(100)
shortcut        VARCHAR(50)            -- e.g. '/thanks' → expands in message box
usage_count     INT DEFAULT 0
created_by      UUID REFERENCES support.support_agents(id)
is_global       BOOL DEFAULT TRUE
version         INT DEFAULT 1
created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
deleted_at      TIMESTAMP WITH TIME ZONE
```

### 2.7 `support.support_sla_policies`
```sql
id                      UUID PK
org_id                  UUID           -- NULL = default policy
name                    VARCHAR(200) NOT NULL
priority                support_priority_enum NOT NULL
first_response_hours    INT NOT NULL
resolution_hours        INT NOT NULL
business_hours_only     BOOL DEFAULT FALSE
escalation_hours        INT
escalate_to_team        VARCHAR(100)
version                 INT DEFAULT 1
created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
UNIQUE (org_id, priority)
```

### 2.8 `support.support_auto_rules` (auto-assignment + auto-tagging)
```sql
id              UUID PK
name            VARCHAR(200) NOT NULL
conditions      JSONB NOT NULL   -- [{field: 'category', op: 'eq', value: 'BILLING'}]
actions         JSONB NOT NULL   -- [{action: 'assign_team', value: 'billing'}, {action: 'set_priority', value: 'HIGH'}]
is_active       BOOL DEFAULT TRUE
sort_order      INT DEFAULT 0
version         INT DEFAULT 1
created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### 2.9 ENUMs (support schema)
```sql
CREATE TYPE support.support_priority_enum AS ENUM ('CRITICAL','HIGH','MEDIUM','LOW');
CREATE TYPE support.support_status_enum AS ENUM (
  'OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER','WAITING_ON_THIRD_PARTY',
  'RESOLVED','CLOSED','SPAM','MERGED'
);
```

---
## 3. MODULE 29-A: SUPPORT TICKET SYSTEM

### 3.1 Ticket Number Format
`SUP-{YYYY}-{NNNNNN}` — global sequence (not per-org).
Examples: `SUP-2026-000001`, `SUP-2026-001247`

### 3.2 Ticket FSM
```
OPEN → IN_PROGRESS (agent picks up)
IN_PROGRESS → WAITING_ON_CUSTOMER (agent asks for more info)
IN_PROGRESS → WAITING_ON_THIRD_PARTY (escalated to ERP vendor etc.)
WAITING_ON_CUSTOMER → IN_PROGRESS (customer replies)
IN_PROGRESS → RESOLVED (agent marks resolved)
RESOLVED → CLOSED (customer confirms or 3-day auto-close)
RESOLVED → OPEN (customer reopens)
OPEN → SPAM (agent marks spam)
OPEN → MERGED (merged into another ticket)
CLOSED → OPEN (reopen within 30 days)
```

### 3.3 Auto-Assignment Engine
```python
# When new ticket created:
# 1. Check auto_rules in priority order (sort_order ASC)
# 2. First matching rule's actions applied
# 3. If no rule matches → round-robin assignment among available agents in default team
# 4. Assignment respects agent.max_tickets and agent.is_available
# 5. If no agents available → ticket stays OPEN unassigned + alert fires
```

### 3.4 Email-to-Ticket Integration (Inbound)
- Support email: support@procureos.com
- Inbound email parser (Mailgun/SendGrid Inbound Parse webhook)
- New email → create ticket; reply to ticket thread → add message
- Email threading via `email_message_id` and `In-Reply-To` headers
- Spam detection: SpamAssassin integration or basic heuristic scoring

### 3.5 API Endpoints (Support Ticket CRUD)
```
# Customer endpoints (auth via procurement JWT)
GET    /support/api/v1/tickets              → my tickets
POST   /support/api/v1/tickets              → create ticket
GET    /support/api/v1/tickets/{id}         → ticket detail
POST   /support/api/v1/tickets/{id}/messages → add reply
POST   /support/api/v1/tickets/{id}/close   → close after RESOLVED
POST   /support/api/v1/tickets/{id}/reopen
POST   /support/api/v1/tickets/{id}/csat    → submit satisfaction rating

# Agent endpoints (auth via agent JWT)
GET    /support/api/v1/agent/tickets        → all tickets with filters
PUT    /support/api/v1/agent/tickets/{id}   → update ticket (status, priority, assign)
POST   /support/api/v1/agent/tickets/{id}/messages → add reply or internal note
POST   /support/api/v1/agent/tickets/{id}/assign
POST   /support/api/v1/agent/tickets/{id}/merge → merge into another ticket
POST   /support/api/v1/agent/tickets/{id}/spam
GET    /support/api/v1/agent/dashboard      → agent stats + queue
GET    /support/api/v1/agent/canned-responses → searchable canned responses
POST   /support/api/v1/agent/tickets/{id}/resolve

# Admin endpoints
GET    /support/api/v1/admin/tickets        → all tickets + bulk actions
GET    /support/api/v1/admin/agents         → agent management
POST   /support/api/v1/admin/agents         → add agent
PUT    /support/api/v1/admin/sla-policies   → update SLA config
GET    /support/api/v1/admin/reports        → support KPI reports
GET    /support/api/v1/admin/auto-rules     → auto-assignment rules
POST   /support/api/v1/admin/auto-rules     → create rule
```

---
## 4. MODULE 29-B: HELP CENTER / KNOWLEDGE BASE

### 4.1 Overview
Searchable knowledge base with categories, articles, and video guides. Integrated into all
three procurement portals via embedded search widget. Reduces ticket volume by enabling
self-service.

### 4.2 Knowledge Base Structure
```
Help Center (support.procureos.com/help)
├── Getting Started
│   ├── How to raise a Purchase Requisition
│   ├── How to submit a bid on an RFQ
│   └── How to onboard as a vendor
├── Purchase Requisitions
│   ├── Creating a PR from scratch
│   ├── Understanding approval workflows
│   ├── Merging and splitting PRs
│   └── Converting a PR to an RFQ
├── Vendor Management
│   ├── How to complete vendor registration
│   ├── Uploading compliance documents
│   ├── Understanding compliance holds
│   └── Responding to RFQ invitations
├── Invoices & Payments
│   ├── Submitting an invoice
│   ├── Understanding 3-way matching
│   ├── Raising a payment dispute
│   └── Tracking payment status
├── Integrations
│   ├── SAP integration guide
│   ├── Oracle ERP setup
│   └── Webhook configuration guide
├── Admin & Configuration
│   ├── Setting up approval rules
│   ├── Configuring notification templates
│   └── User role management
└── Troubleshooting
    ├── Login issues
    ├── File upload errors
    └── Notification not received
```

### 4.3 Search Implementation
- PostgreSQL `tsvector` full-text search on `knowledge_base_articles`
- Search endpoint: `GET /support/api/v1/kb/search?q={query}&category={slug}`
- Returns: articles ranked by relevance + highlight snippets
- Also searches via Elasticsearch if configured (same ES cluster as main app)
- "Did you find this helpful?" thumbs up/down on every article

### 4.4 Embedded Search Widget (All 3 Portals)
```tsx
// Small "? Help" button in every portal header
// Clicking opens a slide-over panel:
// - Search input: "Search help articles..."
// - Results appear inline as user types (debounce 300ms)
// - Each result: article title + category + 120-char snippet
// - "View full article" → opens support portal in new tab
// - "Still can't find what you need?" → "Raise a support ticket" button
// - Recent viewed articles
```

### 4.5 Article Analytics
```python
# Tracked per article view:
# article_id, viewer_org_id, search_query_that_led_here, helpful_vote, session_duration
# Used to identify:
# - Most-viewed articles → keep updated
# - Articles with low helpfulness → rewrite
# - Search terms with no results → create new articles
```

### 4.6 API Endpoints
```
GET  /support/api/v1/kb/categories           → category tree
GET  /support/api/v1/kb/categories/{slug}    → category with articles
GET  /support/api/v1/kb/articles/{slug}      → article detail (renders MDX)
GET  /support/api/v1/kb/search               → full-text search
POST /support/api/v1/kb/articles/{id}/vote   → helpful / not helpful vote
GET  /support/api/v1/kb/popular              → top 10 most viewed articles

# Agent/admin authoring
POST /support/api/v1/admin/kb/articles       → create article (MDX editor)
PUT  /support/api/v1/admin/kb/articles/{id}  → update
POST /support/api/v1/admin/kb/articles/{id}/publish
GET  /support/api/v1/admin/kb/analytics      → article performance stats
```

---
## 5. MODULE 29-C: SLA TRACKER (SUPPORT)

### 5.1 Overview
Support SLAs are separate from procurement workflow SLAs (SPEC_05). These track
first-response and resolution times for support tickets, with business-hours awareness
and org-specific policy overrides.

### 5.2 Default Support SLA Policy
| Priority | First Response | Resolution | Business Hours |
|---|---|---|---|
| CRITICAL | 1 hour | 4 hours | No (24/7) |
| HIGH | 4 hours | 24 hours | No |
| MEDIUM | 8 hours | 72 hours | Yes (9am-6pm IST) |
| LOW | 24 hours | 168 hours | Yes |

### 5.3 Business Hours Calculation
```python
BUSINESS_HOURS = {
    "IST": {"start": 9, "end": 18, "timezone": "Asia/Kolkata"},
    "UTC": {"start": 9, "end": 18, "timezone": "UTC"},
}
WORK_DAYS = {0, 1, 2, 3, 4}  # Mon-Fri

def compute_sla_deadline(created_at: datetime, sla_hours: int,
                          business_hours_only: bool, tz: str) -> datetime:
    if not business_hours_only:
        return created_at + timedelta(hours=sla_hours)
    # Walk forward counting only business hours
    remaining = sla_hours
    current = created_at.astimezone(ZoneInfo(BUSINESS_HOURS[tz]["timezone"]))
    while remaining > 0:
        if current.weekday() in WORK_DAYS:
            if BUSINESS_HOURS[tz]["start"] <= current.hour < BUSINESS_HOURS[tz]["end"]:
                current += timedelta(hours=1)
                remaining -= 1
            else:
                # Skip to next business hour start
                if current.hour >= BUSINESS_HOURS[tz]["end"]:
                    current = current.replace(hour=BUSINESS_HOURS[tz]["start"]) + timedelta(days=1)
                else:
                    current = current.replace(hour=BUSINESS_HOURS[tz]["start"])
        else:
            current += timedelta(days=1)
            current = current.replace(hour=BUSINESS_HOURS[tz]["start"])
    return current
```

### 5.4 SLA Monitoring Tasks (Support Celery App)
```python
# Separate Celery app for support (or shared celery with new queues)

@task check_support_ticket_sla():
    # Every 15 minutes
    # Finds OPEN/IN_PROGRESS tickets past sla_first_response_deadline or sla_resolution_deadline
    # Updates sla_status, notifies assigned agent, escalates if needed

@task auto_close_resolved_support_tickets():
    # Daily: RESOLVED tickets with no customer activity for 3 days → CLOSED
    # Sends CSAT survey email on close

@task send_support_digest_to_agents():
    # Daily 08:00: each agent gets summary of their open tickets + SLA status

@task check_csat_follow_up():
    # Daily: tickets CLOSED 24h ago with no CSAT score → send reminder email
```

### 5.5 SLA Reports (Admin Dashboard)
```
- First Response Compliance: % tickets responded within SLA (this month)
- Resolution Compliance: % tickets resolved within SLA
- Avg First Response Time: actual vs target
- Avg Resolution Time: actual vs target
- SLA Breach Reasons: manual categorization by agents
- Per-Agent SLA Performance: individual compliance rates
- Per-Category SLA: which ticket categories breach most
- CSAT Scores: avg per agent, per category, per month trend
```

### 5.6 API Endpoints
```
GET /support/api/v1/admin/sla/dashboard     → current SLA compliance KPIs
GET /support/api/v1/admin/sla/breaches      → list of SLA-breached tickets
GET /support/api/v1/admin/sla/agent-performance → per-agent SLA metrics
GET /support/api/v1/admin/sla/policies      → current SLA policies
PUT /support/api/v1/admin/sla/policies      → update SLA policies
GET /support/api/v1/admin/csat/report       → CSAT score report
```

---
## 6. INTEGRATION BETWEEN SUPPORT APP & PROCUREMENT PORTAL

### 6.1 "Raise Support Ticket" from Portal
Each procurement portal has a "Help & Support" button that:
1. Opens support portal in new tab
2. Pre-fills: org_id, user email/name, raised_by_portal
3. Optionally pre-fills entity link (if raised from a PR/PO/Invoice page)

### 6.2 Support Ticket → Procurement Portal Link
If a support ticket relates to a procurement entity (e.g. "PO-MUM-2026-000078 not syncing to ERP"):
- Support agent can link: `related_procurement_entity_type=PURCHASE_ORDER`, `related_procurement_entity_id=UUID`
- Procurement portal Buyer shows a small "Support Ticket Open" badge on PO detail page

### 6.3 Webhook Bridge
Support ticket events can optionally trigger procurement portal webhooks:
- `support.ticket.created` event forwarded to any webhook endpoints subscribed to it
- Use case: create a JIRA issue automatically when a CRITICAL support ticket is raised

### 6.4 Authentication
- Buyers and suppliers log into support portal using their procurement credentials
  (`Authorization: Bearer {procurement_access_token}`)
- Support portal backend validates JWT against same RS256 public key
- No separate password needed
- Agents have separate agent accounts (email + password) OR can be linked to procurement user accounts

---
## 7. FRONTEND ARCHITECTURE (Support App)

### 7.1 App Structure
```
support.procureos.com (Next.js 14, port 3004)
├── /                   → Help Center home (KB search + category grid)
├── /help               → Browse all KB categories
├── /help/{category}    → Category article list
├── /help/article/{slug}→ Article detail with feedback widget
├── /help/search        → Search results page
├── /tickets            → Customer: my support tickets
├── /tickets/new        → Raise new support ticket
├── /tickets/{id}       → Ticket conversation thread
├── /status             → Platform status (public)
│
└── /agent              → Agent dashboard (separate auth)
    ├── /agent/queue    → All assigned tickets
    ├── /agent/tickets/{id} → Ticket management view
    ├── /agent/kb       → KB authoring
    └── /agent/reports  → SLA + CSAT reports

└── /admin              → Admin panel
    ├── /admin/agents   → Agent management
    ├── /admin/sla      → SLA policy config
    ├── /admin/rules    → Auto-assignment rules
    └── /admin/reports  → Management reports
```

### 7.2 Customer Ticket View
```tsx
// Timeline layout: messages alternate left (customer) / right (agent)
// Internal notes: yellow bg, "Internal" badge — only visible in agent view
// "Add Reply" box: rich text (not markdown — simpler for customers)
// File attachment: upload documents
// Status timeline: horizontal steps (Open → In Progress → Resolved → Closed)
// SLA countdown: "First response due in 2h 15m" (amber when < 30% remaining)
// CSAT widget: appears after CLOSED — 5-star rating + optional comment
```

### 7.3 Agent Dashboard
```tsx
// Left panel: ticket queue with filters (status, priority, team, assigned_to_me)
// Center: ticket conversation
// Right panel: customer info, org info, linked procurement entity, ticket history
// Quick actions: assign, change priority, add tag, merge, spam
// Canned responses: type '/' to search and insert template
// Internal notes: toggle visible to agent team only
// SLA timer widget: red countdown if near breach
```
