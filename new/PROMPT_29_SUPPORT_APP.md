# IMPLEMENTATION PROMPT 26 — Support App (SPEC_29)

Execute the complete implementation for `plans/plan_spec_29_support_app.md`.
Follow ALL GEMINI.md ABSOLUTE RULES. Do not stop until Steps 2–6 are fully verified.

---
## MANDATORY PRE-FLIGHT
```bash
graphify check --before-change
alembic current  # Must show 0050 (SPEC_28 head)
pytest tests/ -v --tb=no -q  # Full suite green
# Verify notification service working (support app sends notifications via it)
pytest tests/integration/test_notifications.py -v --tb=no -q
```

---
## STEP 2 — IMPLEMENT (exact order)

### Part A: Migrations (run and verify after each)
1. `0051_support_schema.py` — `CREATE SCHEMA support`
2. `0052_support_enums.py` — `support.support_priority_enum` + `support.support_status_enum`
3. `0053_support_agents.py` — `support.support_agents` table
4. `0054_support_kb.py` — `support.kb_categories` + `support.knowledge_base_articles` tables
5. `0055_support_tickets.py` — `support.support_tickets` + `support.support_ticket_messages`
6. `0056_support_config.py` — `support.canned_responses` + `support.support_sla_policies` + `support.support_auto_rules`
7. `0057_support_indexes.py` — ALL 9 indexes using `CONCURRENTLY` inside `op.execute()`
8. `0058_support_triggers.py` — tsvector trigger on `knowledge_base_articles` for full-text search
9. `0059_support_seed.py` — 4 default SLA policies + 6 KB categories + 3 sample canned responses
```bash
alembic upgrade head && alembic current  # Must show 0059
# Verify schema exists
psql -U postgres -d procurement -c "\dn support"
# Verify tsvector trigger
psql -U postgres -d procurement -c "\df support.*"  # Must show update_kb_search_vector
```

### Part B: Support App FastAPI Structure
10. Create directory structure:
```bash
mkdir -p support_app/{auth,tickets,kb,agents,admin,tasks}
touch support_app/__init__.py support_app/main.py support_app/config.py
touch support_app/models.py support_app/repository.py
touch support_app/auth/{__init__.py,dependencies.py}
touch support_app/tickets/{__init__.py,service.py,router.py,schemas.py}
touch support_app/kb/{__init__.py,service.py,router.py,schemas.py}
touch support_app/agents/{__init__.py,service.py,router.py,schemas.py}
touch support_app/admin/{__init__.py,service.py,router.py,schemas.py}
touch support_app/tasks/{__init__.py,sla_tasks.py}
```

11. **`support_app/config.py`** — Pydantic BaseSettings:
    - SUPPORT_TICKET_AUTO_CLOSE_DAYS: int = 3
    - SUPPORT_TICKET_AUTO_CLOSE_PENDING_DAYS: int = 7
    - SUPPORT_CSAT_FOLLOW_UP_HOURS: int = 24
    - SUPPORT_EMAIL_ADDRESS: str = "support@procureos.com"
    - All values from environment — ZERO hardcoded

12. **`support_app/models.py`** — all SQLAlchemy models with `__table_args__ = {"schema": "support"}`:
    - SupportTicket, SupportTicketMessage, SupportAgent, KBCategory, KBArticle,
      CannedResponse, SupportSLAPolicy, SupportAutoRule
    - `SupportBase` as separate `DeclarativeBase` (not same as main `Base`)
    - KBArticle has `search_vector: Mapped[Optional[str]] = mapped_column(TSVECTOR)` — do NOT update in Python; trigger handles it

13. **`support_app/auth/dependencies.py`** — authentication dependencies:
    - `get_support_customer()` — validates main procurement JWT (same RS256 keys), returns user context
    - `get_support_agent()` — validates agent JWT (agents have separate simple email+password login)
    - `get_support_admin()` — requires agent with `is_admin=True` in support_agents table
    - RULE: Procurement JWT works for customer access; agents use separate auth
    - RULE: Suppliers CAN raise support tickets (they have valid procurement JWT)

14. **`support_app/tickets/service.py`** — SupportTicketService (core):
    ```python
    # All methods as per plan — key implementations:

    async def create(db, data, raiser_id, raiser_email, raiser_name, org_id, portal):
        # 1. Generate ticket number SUP-{YYYY}-{NNNNNN}
        # 2. Load SLA policy (org-specific, fallback to default)
        # 3. compute_sla() with business hours support (ZoneInfo)
        # 4. Create ticket record
        # 5. Create initial message record
        # 6. Apply auto-assignment rules
        # 7. Notify assigned agent OR team if unassigned
        # RULE: _generate_number() uses CREATE SEQUENCE IF NOT EXISTS in support schema

    async def add_message(db, ticket_id, content, author_type, author_id,
                          author_name, author_email, is_internal, attachments):
        # RULE: is_internal=True by CUSTOMER → ForbiddenError
        # RULE: WAITING_ON_CUSTOMER → IN_PROGRESS when customer adds message
        # RULE: Track first_response_at when AGENT adds first non-internal message

    async def resolve(db, ticket_id, agent_id):
        # RULE: Only assigned agent can resolve
        # RULE: Schedule CSAT survey on resolve

    async def submit_csat(db, ticket_id, score, comment, raiser_id):
        # RULE: score must be 1-5 (ValidationError otherwise)
        # RULE: Only ticket owner can submit CSAT

    def _compute_sla(start, hours, business_hours_only, tz):
        # Business hours: 09:00-18:00 Mon-Fri in org timezone
        # Uses ZoneInfo (not pytz) — Python 3.9+ standard library
        # Walk forward counting only business hours when business_hours_only=True
        # RULE: business hours config NOT from settings — these are standard business hours
    ```

15. **`support_app/tickets/router.py`** — split into customer + agent + admin routers:
    ```python
    customer_router = APIRouter(prefix="/support/api/v1", tags=["support-customer"])
    agent_router    = APIRouter(prefix="/support/api/v1/agent", tags=["support-agent"])
    admin_router    = APIRouter(prefix="/support/api/v1/admin", tags=["support-admin"])

    # Customer endpoints (auth: get_support_customer):
    GET  /support/api/v1/tickets
    POST /support/api/v1/tickets
    GET  /support/api/v1/tickets/{id}
    POST /support/api/v1/tickets/{id}/messages
    POST /support/api/v1/tickets/{id}/close
    POST /support/api/v1/tickets/{id}/reopen
    POST /support/api/v1/tickets/{id}/csat

    # Agent endpoints (auth: get_support_agent):
    GET  /support/api/v1/agent/tickets
    GET  /support/api/v1/agent/tickets/{id}
    PUT  /support/api/v1/agent/tickets/{id}
    POST /support/api/v1/agent/tickets/{id}/messages
    POST /support/api/v1/agent/tickets/{id}/assign
    POST /support/api/v1/agent/tickets/{id}/resolve
    POST /support/api/v1/agent/tickets/{id}/merge
    POST /support/api/v1/agent/tickets/{id}/spam
    GET  /support/api/v1/agent/dashboard
    GET  /support/api/v1/agent/canned-responses

    # Admin endpoints (auth: get_support_admin):
    GET  /support/api/v1/admin/tickets
    GET  /support/api/v1/admin/agents
    POST /support/api/v1/admin/agents
    GET  /support/api/v1/admin/sla/dashboard
    GET  /support/api/v1/admin/sla/policies
    PUT  /support/api/v1/admin/sla/policies
    GET  /support/api/v1/admin/reports
    GET  /support/api/v1/admin/auto-rules
    POST /support/api/v1/admin/auto-rules
    ```

16. **`support_app/kb/service.py`** — KBService:
    - `search(db, query, category_slug, limit)` — PostgreSQL tsvector `@@` operator with ts_rank + ts_headline
    - `get_article(db, slug)` — fetches article, increments view_count via UPDATE (not Python read+write)
    - `vote(db, article_id, helpful)` — single UPDATE statement; no read before write
    - `get_categories(db)` — category tree with article_count
    - `get_by_category(db, slug)` — published articles in category
    - RULE: search_vector updated by DB trigger — NEVER update it in Python code

17. **`support_app/kb/router.py`** — 10 endpoints (6 public, 4 agent/admin):
    ```python
    GET /support/api/v1/kb/categories         (public)
    GET /support/api/v1/kb/categories/{slug}  (public)
    GET /support/api/v1/kb/articles/{slug}    (public)
    GET /support/api/v1/kb/search             (public)
    POST /support/api/v1/kb/articles/{id}/vote (customer auth)
    GET /support/api/v1/kb/popular            (public)
    POST /support/api/v1/admin/kb/articles    (agent admin auth)
    PUT  /support/api/v1/admin/kb/articles/{id}
    POST /support/api/v1/admin/kb/articles/{id}/publish
    GET  /support/api/v1/admin/kb/analytics
    ```

18. **`support_app/agents/service.py`** — SupportAgentService:
    - `get_next_available(db)` — round-robin: agents with is_active=True, is_available=True,
      current_open_count < max_tickets; ordered by current_open_count ASC
    - `assign(db, ticket_id, agent_id)` — updates ticket + increments agent counter
    - `toggle_availability(db, agent_id, is_available)` — online/offline toggle

19. **`support_app/main.py`** — assemble FastAPI app:
    ```python
    from fastapi import FastAPI
    from support_app.tickets.router import customer_router, agent_router
    from support_app.admin.router import admin_router
    from support_app.kb.router import kb_router
    from support_app.agents.router import agents_router

    def create_support_app():
        app = FastAPI(title="ProcureOS Support Center")
        app.include_router(customer_router)
        app.include_router(agent_router)
        app.include_router(admin_router)
        app.include_router(kb_router)
        app.include_router(agents_router)
        return app

    app = create_support_app()
    ```

20. **`support_app/tasks/sla_tasks.py`** — 3 Celery tasks:
    - `check_support_ticket_sla()` — every 15 min via Beat; checks first_response + resolution deadlines
    - `auto_close_support_tickets()` — daily 01:00; RESOLVED→CLOSED (3d), WAITING→CLOSED (7d)
    - `send_support_agent_digest()` — daily 08:00; per-agent open ticket summary

21. **`app/tasks/celery_app.py`** — add 3 new Beat entries:
    - `check-support-sla` every settings.CELERY_SLA_CHECK_MINUTES minutes
    - `auto-close-support-tickets` daily 01:00
    - `send-support-digest` daily 08:00

22. **Add to `docker/docker-compose.yml`**:
    ```yaml
      support-app-api:
        build:
          context: .
          dockerfile: docker/Dockerfile.support
        ports: ["8002:8002"]
        environment:
          DATABASE_URL: ${DATABASE_URL}   # Same DB, support schema
        depends_on:
          api: { condition: service_started }
        networks: [procurement_net]

      support-portal:
        build:
          context: ../procurement-portal-frontend
          dockerfile: apps/support-portal/Dockerfile
        ports: ["3004:3004"]
        environment:
          NEXT_PUBLIC_SUPPORT_API_URL: ${NEXT_PUBLIC_SUPPORT_API_URL:-http://localhost:8002}
          NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
        depends_on:
          support-app-api: { condition: service_started }
        networks: [procurement_net]
    ```

### Part C: Support Portal Frontend

23. Create Next.js support portal app:
```bash
cd procurement-portal-frontend
pnpm create next-app apps/support-portal --typescript --tailwind --app --no-src-dir
pnpm add --filter support-portal next-mdx-remote
```

24. **`apps/support-portal/app/(public)/page.tsx`** — Help Center Home:
    - Search bar (prominent, center)
    - Category cards grid (6 categories with icons from KB seed)
    - Popular articles (top 5 by view_count)
    - "Can't find your answer?" → "Raise a support ticket" CTA

25. **`apps/support-portal/app/(public)/help/article/[slug]/page.tsx`** — Article Detail:
    - `next-mdx-remote` renders article MDX content
    - Category breadcrumb
    - Related articles sidebar
    - "Was this helpful?" thumbs up/down widget (POST /support/api/v1/kb/articles/{id}/vote)
    - "Still need help?" → raise ticket button (pre-fills category from article's category)
    - View count tracked on mount via fire-and-forget API call

26. **`apps/support-portal/app/(customer)/tickets/[id]/page.tsx`** — Ticket Conversation:
    - Message bubbles: customer=right (blue), agent=left (gray)
    - Internal notes: NOT rendered (API filters them; client also checks `is_internal===false`)
    - Status progress bar: linear steps (Open → In Progress → Resolved → Closed)
    - SLA countdown chip (amber/red when near breach, only before first_response_at set)
    - Reply box: simple textarea + file attachment + Submit
    - CSAT widget: 5-star rating + comment textarea, shown when status=CLOSED and csat_score=null

27. **`apps/support-portal/components/HelpSearchWidget.tsx`** — Embeddable widget:
    - Used in ALL 3 procurement portals (import from support-portal package OR copy to packages/ui/)
    - Fixed "? Help" button bottom-right corner (z-index above all content)
    - Click → Radix UI Sheet slide-over panel
    - Search input with 300ms debounce → POST /support/api/v1/kb/search
    - Results: title + highlighted snippet + category label
    - "Raise a Support Ticket" button at bottom → opens support portal in new tab
    - Pre-fills entity context when opened from entity page

28. **Add `HelpSearchWidget` to all 3 portal root layouts**:
    ```tsx
    // apps/buyer-portal/app/(main)/layout.tsx
    import { HelpSearchWidget } from '@/packages/ui/HelpSearchWidget'
    // ... inside return:
    <HelpSearchWidget supportApiUrl={process.env.NEXT_PUBLIC_SUPPORT_API_URL} />
    // Same for supplier-portal and admin-portal layouts
    ```

29. **`apps/support-portal/app/(agent)/queue/page.tsx`** — Agent Queue:
    - Ticket table with sort: SLA breach first, then priority, then age
    - Quick filters: Mine / Unassigned / All / By Team
    - "Take" button on unassigned tickets (self-assign)
    - Bulk actions: assign to agent, change priority
    - SLA countdown shown per row (red if breached)
    - Auto-refresh every 30s via TanStack Query `refetchInterval: 30000`

30. **`apps/support-portal/app/(agent)/tickets/[id]/page.tsx`** — Agent Ticket View:
    - Three-panel layout: left=ticket info, center=conversation, right=customer/org info
    - Center: same conversation timeline as customer view BUT with internal notes visible (yellow bg)
    - Right panel: customer profile (name, email, org, portal, ticket history count)
    - Canned response: type '/' in reply box → searchable dropdown of canned_responses
    - Reply type toggle: Public Reply / Internal Note
    - Action buttons: Assign, Resolve, Set Waiting, Merge, Mark Spam

31. **`apps/support-portal/app/(agent)/reports/page.tsx`** — SLA Reports:
    - First response compliance % (gauge)
    - Resolution compliance % (gauge)
    - Avg first response vs target (bar chart comparison)
    - Avg resolution time trend (line chart, last 30d)
    - Per-agent performance table: tickets handled, avg resolution, SLA %, CSAT avg
    - Per-category breach analysis table
    - CSAT trend (area chart)
    - Date range selector: MTD / QTD / Custom

32. **Seed notification templates** for support events:
    ```python
    # Add to scripts/seed_notification_templates.py:
    SUPPORT_TEMPLATES = [
        {"code": "SUPPORT_TICKET_CREATED",      "subject": "Support ticket {{ticket_number}} received"},
        {"code": "SUPPORT_AGENT_ASSIGNED",       "subject": "You've been assigned ticket {{ticket_number}}"},
        {"code": "SUPPORT_CUSTOMER_REPLIED",     "subject": "Customer replied on {{ticket_number}}"},
        {"code": "SUPPORT_AGENT_REPLIED",        "subject": "Agent replied on your ticket {{ticket_number}}"},
        {"code": "SUPPORT_TICKET_RESOLVED",      "subject": "Your support ticket {{ticket_number}} has been resolved"},
        {"code": "SUPPORT_CSAT_REQUEST",         "subject": "How did we do? Rate your support experience"},
        {"code": "SUPPORT_SLA_BREACH",           "subject": "⚠️ SLA Breached: {{ticket_number}} ({{breach_type}})"},
        {"code": "SUPPORT_TICKET_AUTO_CLOSED",   "subject": "Your ticket {{ticket_number}} has been closed"},
        {"code": "SUPPORT_AGENT_DAILY_DIGEST",   "subject": "Your support queue: {{open_count}} open tickets"},
    ]
    ```

---
## STEP 2.5 — SPEC AUDIT
Produce `reports/spec_29_audit.md`. All 3 modules (29-A, 29-B, 29-C) must show DONE.
BLOCK on any PARTIAL or MISSING. Pay special attention to:
- Business-hours SLA calculation (ZoneInfo, Mon-Fri only when configured)
- tsvector trigger (NOT Python-side search_vector update)
- Internal notes hidden from customer view (API-level filter, not just client-side)
- CSAT survey sent only after auto-close (not after agent-close)

---
## STEP 3 — TEST

### Unit Tests (ALL must pass)
```python
# SLA computation
test_sla_critical_uses_calendar_hours()
test_sla_medium_skips_weekends()
test_sla_medium_skips_after_6pm()
test_sla_medium_starts_next_morning_if_created_after_6pm()
test_sla_deadline_stored_in_utc()

# Ticket lifecycle
test_ticket_number_format_SUP_YYYY_NNNNNN()
test_auto_assign_first_rule_wins()
test_auto_assign_round_robin_when_no_rule()
test_waiting_to_in_progress_on_customer_reply()
test_customer_cannot_add_internal_note()
test_resolve_only_by_assigned_agent()
test_csat_1_to_5_validated()
test_csat_only_by_ticket_owner()
test_auto_close_resolved_3_days()
test_auto_close_pending_7_days()
test_csat_survey_sent_on_auto_close()

# KB search
test_kb_search_returns_highlights()
test_kb_search_filtered_by_category()
test_kb_search_vector_updated_by_trigger()
test_kb_vote_helpful_increments_field()
test_kb_view_count_increments_on_get()
test_internal_notes_hidden_from_customer()

# Agent
test_agent_round_robin_skips_max_tickets()
test_agent_round_robin_skips_unavailable()
test_first_response_time_tracked()

# Auto-assignment rules
test_auto_rule_category_eq_match()
test_auto_rule_priority_in_match()
test_auto_rule_no_match_falls_to_round_robin()
```

```bash
pytest tests/unit/test_support_ticket_service.py -v
pytest tests/unit/test_kb_service.py -v
pytest tests/unit/test_support_sla_computation.py -v
pytest tests/integration/test_support_app.py -v
# Full regression
pytest tests/ -v --cov=support_app --cov-fail-under=85
```

### QA Tests
```
1. Customer raises ticket → auto-assigned to agent → agent sees in queue
2. Agent adds internal note → customer view shows NO internal notes (inspect DOM)
3. Agent resolves → CSAT widget appears in customer view
4. Customer rates 4 stars → csat_score=4 persisted in DB
5. CRITICAL ticket: no response in 1h → SLA first_response BREACHED → agent email
6. MEDIUM ticket: created at 5:30 PM Friday → first_response SLA starts Monday 9 AM
7. KB search "how to raise PR" → returns getting-started articles with highlighted terms
8. tsvector: update article title → search immediately reflects new title
9. Canned response: type /thanks in agent reply → template inserted
10. Procurement JWT used to log into support portal (no second password)
11. Supplier user can raise support ticket (procurement JWT works)
12. Auto-close: RESOLVED ticket 4 days old → daily task closes it + CSAT email
13. HelpSearchWidget: embedded in buyer portal → search from procurement page
14. Support app does not break main procurement API (run full regression)
```

---
## STEP 4 — INTEGRATE
```bash
# Run all new migrations
alembic upgrade head  # 0051–0059
# Verify support schema
psql -U postgres -d procurement -c "\dn" | grep support
psql -U postgres -d procurement -c "\dt support.*"  # Must show 8 tables
psql -U postgres -d procurement -c "SELECT COUNT(*) FROM support.support_sla_policies;"  # Must be 4
psql -U postgres -d procurement -c "SELECT COUNT(*) FROM support.kb_categories;"  # Must be 6
# Verify tsvector trigger
psql -U postgres -d procurement -c "
  INSERT INTO support.knowledge_base_articles
    (id, slug, title, content, status, version, created_at, updated_at)
  VALUES (gen_random_uuid(), 'test-article', 'Test Article About Invoices',
          'This article explains how to submit an invoice.', 'PUBLISHED', 1, NOW(), NOW());
  SELECT search_vector IS NOT NULL FROM support.knowledge_base_articles WHERE slug='test-article';
"  # Must return TRUE
# Seed notification templates
python scripts/seed_notification_templates.py
# Verify 9 new support templates
psql -U postgres -d procurement -c "SELECT code FROM notification_templates WHERE code LIKE 'SUPPORT_%';"
# Start services
docker-compose up -d support-app-api support-portal
curl http://localhost:8002/support/api/v1/kb/categories
# Must return categories list (from seed)
curl http://localhost:3004  # Support portal UI must render
# Verify HelpSearchWidget in buyer portal
curl http://localhost:3000 | grep -q "HelpSearchWidget" && echo "Widget integrated" || echo "MISSING"
# Full regression
pytest tests/ -v --cov=app --cov=support_app --cov-fail-under=80
```

---
## STEP 5 — GRAPHIFY UPDATE
```bash
graphify update
# Verify all new nodes added:
graphify query --node-type service --name SupportTicketService
graphify query --node-type service --name KBService
graphify query --node-type service --name SupportAgentService
graphify query --node-type task --name check_support_ticket_sla
graphify query --node-type task --name auto_close_support_tickets
graphify query --node-type app --name SupportPortalApp
# Check 8 new tables in support schema
graphify query --node-type table --schema support | wc -l  # Must be 8
graphify check --integrity  # 0 broken links
graphify diff > graphify_diff_spec29_$(date +%Y%m%d_%H%M%S).txt
```

---
## STEP 6 — README + COMMIT
```markdown
## Current Session State
**Status:** SPEC_29 Support App COMPLETED — All 3 modules done
**New Schema:** support (8 tables: support_tickets, support_ticket_messages, support_agents,
  knowledge_base_articles, kb_categories, canned_responses, support_sla_policies, support_auto_rules)
**Migrations:** 0051–0059 (9 migrations including tsvector trigger)
**New App:** support-portal (Next.js, port 3004); support-app-api (FastAPI, port 8002)
**SLA:** Business-hours-aware computation with ZoneInfo; 4 priority tiers seeded
**KB Search:** PostgreSQL tsvector GIN index; ts_rank + ts_headline highlights
**HelpSearchWidget:** Embedded in all 3 procurement portals
**Celery:** 3 new tasks (sla check, auto-close, agent digest)
**Notifications:** 9 new SUPPORT_* templates seeded
**Migration Head:** 0059_support_seed
**Test Coverage:** support_app ≥85%, overall ≥80%
**Graphify:** All support nodes added; 0 broken links
**Full Stack:** 6 apps running (ports 3000-3004 + 8000-8002)
**Next:** Production deployment → k8s/overlays/production/
```
```bash
git add -A
git commit -m "[NON-BREAKING] feat: SPEC_29 — Support App; Helpdesk tickets; KB with tsvector search; SLA business-hours; CSAT; HelpSearchWidget in all portals; auto-assignment rules; agent dashboard"
git tag v1.1.0-with-support
git push origin main --tags
```

---
## FINAL SYSTEM VERIFICATION (run after SPEC_27+28+29)
```bash
echo "=== ALL 6 APPS RUNNING ==="
curl -s http://localhost:3000 | head -1 && echo "✓ Buyer Portal :3000"
curl -s http://localhost:3001 | head -1 && echo "✓ Supplier Portal :3001"
curl -s http://localhost:3002 | head -1 && echo "✓ Admin Portal :3002"
curl -s http://localhost:3003 | head -1 && echo "✓ Developer Portal :3003"
curl -s http://localhost:3004 | head -1 && echo "✓ Support Portal :3004"
curl -s http://localhost:8000/health/ready | python -c "import sys,json; d=json.load(sys.stdin); print('✓ Main API :8000 —', d['status'])"
curl -s http://localhost:8001/dev/changelog | python -c "import sys,json; print('✓ Dev Platform API :8001 — OK')"
curl -s http://localhost:8002/support/api/v1/kb/categories | python -c "import sys,json; print('✓ Support API :8002 — OK')"

echo "=== MIGRATIONS ==="
alembic current  # Must show 0059 (head)

echo "=== TESTS ==="
pytest tests/ -v --cov=app --cov=support_app --cov=developer_platform --cov-fail-under=80
pnpm test --all-projects

echo "=== GRAPHIFY ==="
graphify check --integrity  # 0 broken links
echo "All checks complete ✓"
```
