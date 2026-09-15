# IMPLEMENTATION PROMPT 23 — Ticket & Query Management System (SPEC_26)

Execute the complete implementation for the plan at `plans/plan_spec_26_ticket_system.md`.

You MUST strictly follow the `IMPLEMENTATION LOOP` (Steps 2 through 6) and ALL `ABSOLUTE RULES`
from `GEMINI.md`. Do not stop until every step is completed and verified.

---

## MANDATORY PRE-FLIGHT (run FIRST before any code)
```bash
graphify check --before-change
cat README.md | grep -A 20 "Current Session State"
# Confirm ALL of these are complete before starting:
# ✓ Auth module (JWT, sessions, permissions)
# ✓ Notification module (WebSocket, Redis pub/sub, email channel)
# ✓ Document service (upload, ClamAV, MinIO, presigned URLs)
# ✓ All prior migrations through 0027_data_seed at head
alembic current  # Must show (head)
pytest tests/security/test_auth_security.py -v --tb=no -q  # Must be all green
pytest tests/integration/test_notifications.py -v --tb=no -q  # Must be all green
```

---

## STEP 2 — IMPLEMENT (in this EXACT order — no deviation)

### Part A: Auth Module Update (FIRST — other parts depend on it)
1. **`app/auth/jwt.py`** — Add `portal: str = "buyer"` parameter to `create_access_token()`.
   Add `"portal": portal` to the JWT payload dict. This is a NON-BREAKING change (new claim,
   existing tokens still valid without it — default to "buyer" when missing).
2. **`app/core/middleware.py`** — In `LoggingContextMiddleware`, extract `portal` from decoded
   JWT payload and set `request.state.portal = payload.get("portal", "buyer")`.
3. **`app/auth/router.py`** — Supplier login endpoint (`/api/v1/supplier/auth/login` or flag in
   request) passes `portal="supplier"` to `_issue_tokens()`. Admin portal login passes
   `portal="admin"`. Default buyer login passes `portal="buyer"`.

### Part B: Database Migrations (run in STRICT ORDER)
4. **`alembic/versions/0028_ticket_enums.py`** — Create 3 ENUMs exactly:
   - `ticket_type_enum`: QUERY, BUG, DISCREPANCY, COMPLAINT, CHANGE_REQUEST, SUPPORT, AUDIT_QUERY, VENDOR_ISSUE
   - `ticket_priority_enum`: CRITICAL, HIGH, MEDIUM, LOW
   - `ticket_status_enum`: OPEN, IN_PROGRESS, PENDING_RESPONSE, ESCALATED, RESOLVED, CLOSED, REOPENED
   - `downgrade()` drops all 3 with CASCADE
5. **`alembic/versions/0029_ticket_tables.py`** — Create 6 tables in dependency order:
   tickets → ticket_comments → ticket_attachments → ticket_watchers → ticket_activity_log → ticket_sla_config
   - `ticket_activity_log` has NO `deleted_at` column (immutable log — GEMINI.md NO DEAD CODE rule: no field for something that will never be used)
   - `ticket_watchers` has UNIQUE constraint on (ticket_id, user_id)
   - `ticket_sla_config` has UNIQUE constraint on (org_id, priority)
   - All other tables inherit `BaseModel` (org_id, version, created_at, updated_at, deleted_at)
   - All entity link fields (entity_type, entity_id, entity_number) are NULLABLE (no hard FK — advisory soft link)
6. **`alembic/versions/0030_ticket_sequences.py`** — Empty migration that documents the naming
   convention. Actual sequences created dynamically at runtime via `CREATE SEQUENCE IF NOT EXISTS`.
7. **`alembic/versions/0031_ticket_indexes.py`** — ALL 13 indexes using
   `CREATE INDEX CONCURRENTLY IF NOT EXISTS`. Never use `op.create_index()` — use `op.execute()`.
   Downgrade uses `DROP INDEX CONCURRENTLY IF EXISTS`.
8. **`alembic/versions/0032_ticket_rls.py`** — Enable RLS on `tickets` and `ticket_comments`
   tables. Create org_isolation policy using `current_setting('app.current_org_id')::uuid`.
9. **`alembic/versions/0033_ticket_sla_seed.py`** — Insert default SLA configs for all existing
   orgs using the 4 defaults (CRITICAL:4h, HIGH:24h, MEDIUM:72h, LOW:168h). Use `ON CONFLICT DO NOTHING`.
10. **`alembic/versions/0034_ticket_permissions.py`** — Insert all 12 `ticket.*` permission codes
    and assign to all 10 roles per the ROLE_PERMISSIONS mapping in the plan. Use `ON CONFLICT DO NOTHING`.

**Run migrations after each file to verify:**
```bash
alembic upgrade head
alembic current  # Must show 0034 (head)
```

### Part C: Core Module Files
11. **`app/modules/ticket/__init__.py`** — Module docstring: responsibility, dependencies,
    events published, events consumed.
12. **`app/modules/ticket/models.py`** — All 6 SQLAlchemy model classes exactly as in plan:
    Ticket, TicketComment, TicketAttachment, TicketWatcher, TicketActivityLog, TicketSLAConfig.
    RULE: Every model except TicketActivityLog imports BaseModel. TicketActivityLog imports Base directly.
13. **`app/modules/ticket/fsm.py`** — TICKET_FSM dict + SUPPLIER_ALLOWED_TRANSITIONS dict +
    `validate_ticket_transition(current, target, is_supplier=False)` function.
14. **`app/modules/ticket/sla_service.py`** — TicketSLAService class with `get_config()`,
    `compute_breach_at()`, `compute_status()`. The `_DEFAULT_SLA` dict is a module-level constant
    (NOT from `settings.*` — these are structural defaults per spec, not operator-configurable env vars).
15. **`app/modules/ticket/mention_parser.py`** — MentionParser class. Regex: `r'@([a-zA-Z0-9._-]{2,})'`.
    Returns list of resolved user UUIDs. Unknown @mentions silently ignored (no error).
16. **`app/modules/ticket/repository.py`** — TicketRepository extending BaseRepository:
    - `get_active_with_sla()` — tickets with status IN (OPEN, IN_PROGRESS, PENDING_RESPONSE) and sla_breach_at IS NOT NULL
    - `get_stale_resolved(cutoff_dt)` — RESOLVED tickets with updated_at < cutoff
    - `get_stale_pending_response(cutoff_dt)` — PENDING_RESPONSE tickets with updated_at < cutoff
    - `get_watchers(ticket_id, org_id)` — list of TicketWatcher
    - `get_watcher(ticket_id, user_id, org_id)` — single watcher or None
    - `get_comment(comment_id, org_id)` — single TicketComment or NotFoundError
    - `get_activity(ticket_id, org_id)` — list of TicketActivityLog ordered by created_at ASC
    - `get_all_sla_configs(org_id)` — list of TicketSLAConfig for org
    - `get_sla_config(org_id, priority)` — single TicketSLAConfig or None
    - `get_unique_assignees_with_open_tickets(db)` — for digest task
17. **`app/modules/ticket/search_service.py`** — TicketSearchService with `index_ticket()`,
    `index_comment()`, `search()`. Index: `tickets-{YYYY.MM}` (monthly). Use `multi_match`
    with boosted fields. Suppresses results where is_private=True and requester has no access.
18. **`app/modules/ticket/schemas.py`** — All Pydantic schemas:
    - `TicketCreateRequest`: title (min_length=5), description (min_length=20), ticket_type, priority, category, entity_type, entity_id, entity_number, tags, is_private
    - `TicketUpdateRequest`: title, description, priority, category, tags, is_private (all Optional)
    - `TicketFilters`: status, priority, ticket_type, entity_type, entity_id, view_scope, tags, date_from, date_to, limit, offset
    - `TicketCommentRequest`: content (min_length=1, max_length=10000), is_internal (Optional bool)
    - `TicketCommentEditRequest`: content (min_length=1)
    - `TicketAssignRequest`: user_id (UUID), team (Optional str)
    - `TicketResolveRequest`: resolution_note (min_length=10)
    - `TicketReopenRequest`: reason (min_length=5)
    - `TicketEscalateRequest`: reason (min_length=5), escalate_to_user_id (Optional UUID)
    - `TicketWatcherRequest`: user_id (UUID)
    - `TicketSearchRequest`: query (str), filters (Optional dict)
    - `TicketSLAConfigRequest`: priority, first_response_hours, resolution_hours, escalation_hours, escalate_to_role
    - `TicketListResponse`: all ticket fields for list view (no comments)
    - `TicketDetailResponse`: all ticket fields + latest 20 comments
    - `TicketCommentResponse`: all comment fields + author details
19. **`app/modules/ticket/service.py`** — TicketService with ALL methods from plan:
    `create()`, `add_comment()`, `edit_comment()`, `get_comments()`, `assign()`, `start_progress()`,
    `resolve()`, `close()`, `reopen()`, `escalate()`, `set_pending_response()`, `update()`,
    `soft_delete()`, `get_list()`, `get_detail()`, `get_dashboard()`, `add_watcher()`,
    `remove_watcher()`, `attach_file()`, `remove_attachment()`, `update_sla_config()`,
    `_generate_number()`, `_log()`, `_is_admin()`, `_get_supplier_user_ids()`.
    RULE: `_generate_number()` uses `CREATE SEQUENCE IF NOT EXISTS` + `SELECT nextval()`. Max 3 retries on race.
    RULE: Visibility filter ALWAYS applied at SQL query level — never filter in Python after fetching all rows.
20. **`app/modules/ticket/router.py`** — All 30+ endpoints exactly as in plan. Register every
    endpoint with correct permission dependency. RULE: no endpoint lacks an auth dependency.

### Part D: Infrastructure Updates
21. **`scripts/rabbitmq_setup.py`** — Add `"procurement.ticket"` to EXCHANGES list.
    Add `("q.ticket.events", "procurement.ticket", "ticket.*", "q.dlq.ticket")` to QUEUES.
22. **`app/tasks/ticket_sla.py`** — Three Celery tasks: `check_ticket_sla_timers`,
    `auto_close_idle_tickets`, `send_ticket_digest`. All use `asyncio.run()` + `async_session_factory()`.
    RULE: All timing values (3 days, 7 days) are computed as `timedelta(days=3)` etc. inside the function —
    these are structural business rules from spec, NOT env vars.
23. **`app/tasks/celery_app.py`** — Add 3 new Beat schedule entries using `settings.CELERY_SLA_CHECK_MINUTES`
    for the SLA timer interval. Auto-close at hour=1, digest at hour=8 (hardcoded time-of-day is
    acceptable — these are schedule positions, not business thresholds).
24. **`app/modules/notification/consumer.py`** — Add handler for `q.ticket.events` queue.
    Route `ticket.*` routing keys to `_handle_ticket_notification()` method that maps event types
    to notification templates and sends email + in-app per watcher preferences.
25. **`scripts/seed_notification_templates.py`** — Add all 9 ticket notification templates.
26. **`app/main.py`** — Import and register `ticket_router` alongside the other 24 module routers.

### Part E: Frontend Implementation
**Install packages first:**
```bash
cd procurement-portal-frontend
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-markdown remark-gfm
pnpm generate:types  # Regenerate TypeScript types from updated OpenAPI spec
```

27. **`packages/hooks/useTickets.ts`** — TanStack Query hooks:
    - `useTickets(filters)` — list query with all filter params
    - `useTicketDetail(id)` — single ticket detail
    - `useTicketComments(id)` — paginated comments (infinite query for "Load more")
    - `useTicketDashboard()` — dashboard counts
    - `useTicketWatchers(id)` — watcher list
    - `useCreateTicket()` — mutation → invalidates ticket list
    - `useAddComment()` — mutation → invalidates comments query
    - `useEditComment()` — mutation
    - `useAssignTicket()` — mutation
    - `useResolveTicket()` — mutation
    - `useCloseTicket()` — mutation
    - `useReopenTicket()` — mutation
    - `useEscalateTicket()` — mutation
    All mutations use `apiClient` from `packages/utils/api.ts` and call the correct endpoint.
    Response unwrapped as `response.data.data` (NOT `response.data`).

28. **`packages/components/tickets/CreateTicketModal.tsx`** — Create ticket modal:
    - React Hook Form + Zod schema matching backend TicketCreateRequest exactly
    - Markdown textarea with Write/Preview tab toggle
    - Type selector with icons per type
    - Priority radio with impact description
    - Entity link: 2-step (entity type dropdown → entity search input calling API)
    - Tags: CreatableSelect multi-input
    - Is Private toggle (hidden for supplier users)
    - File attachment drag-and-drop using DocumentUpload shared component
    - `useCreateTicket()` mutation on submit

29. **`packages/components/tickets/TicketCard.tsx`** — Kanban card component:
    - Priority colored left border (CRITICAL=red, HIGH=amber, MEDIUM=blue, LOW=green)
    - Title truncated to 60 chars
    - Type badge, assignee avatar (tooltip with name)
    - SLA chip: color-coded (green/amber/red) with time remaining or "Breached"
    - Entity chip if entity_number present
    - `@dnd-kit/sortable` `useSortable` hook wrapping

30. **`packages/components/tickets/TicketCommentBox.tsx`** — Comment input component:
    - Textarea with @mention autocomplete: on `@` typed → fetch users → dropdown list
    - "Internal Note" toggle (only shown if user has `ticket.add_internal_note` permission, checked via Zustand permissions)
    - Attachment button using document upload
    - Submit button disabled when content < 1 char
    - Renders in both buyer and supplier portals (supplier: is_internal toggle hidden)

31. **`packages/components/tickets/TicketCommentFeed.tsx`** — Comment thread:
    - `react-markdown` with `remark-gfm` for rendering
    - Internal notes: yellow background, "🔒 Internal Note" badge — `is_internal` flag checked from API response; if supplier user, these rows will not be in response (API filtered) but add client-side guard too
    - Each comment: author avatar + name + relative timestamp ("3 hours ago") + content + "Edited" label if `edited_at` set + Edit button (own comment within 15 min) + Delete button (own comment)
    - Activity log entries interleaved: gray text, no avatar, italic "Arjun changed status to IN_PROGRESS"
    - "Load more" button at top for pagination (infinite scroll upward)

32. **`packages/components/tickets/TicketSLAIndicator.tsx`** — SLA display:
    - Shows progress bar: green < 50%, amber 50-100%, red > 100%
    - Shows "Due in X days Y hours" or "Breached X hours ago"
    - First response time shown if `first_response_at` set

33. **`apps/buyer-portal/app/(main)/tickets/page.tsx`** — List page:
    - Filter bar: status, priority, type, entity_type, date range, search input, tags
    - View toggle: List | Board (links to /tickets/board)
    - Quick filter tabs: All | Mine | Assigned to Me
    - Table with all columns from plan
    - Row click → open drawer (slide-in from right) showing TicketDetail — NOT full navigation
    - "+ New Ticket" → CreateTicketModal
    - Export CSV button → GET /api/v1/tickets/export

34. **`apps/buyer-portal/app/(main)/tickets/board/page.tsx`** — Kanban:
    - `@dnd-kit/core` DndContext with collision detection strategy
    - 5 `SortableContext` columns: OPEN | IN_PROGRESS | PENDING_RESPONSE | RESOLVED | CLOSED
    - `onDragEnd` handler maps source→destination column to correct API endpoint
    - Transition mapping in `COLUMN_TRANSITION_MAP` constant (NO hardcoded strings scattered in event handler)
    - For transitions requiring additional input (resolve needs note, reopen needs reason) → open modal on drop, call API only after modal confirm
    - Filter bar above board (same filters as list page, synced via URL params)

35. **`apps/buyer-portal/app/(main)/tickets/[id]/page.tsx`** — Detail page:
    - Two-panel layout (65/35)
    - Left: title, description (react-markdown), entity chip, tags, TicketCommentFeed, TicketCommentBox
    - Right: status selector (dropdown, only shows FSM-allowed next statuses), priority, assignee, reporter, SLA, watchers, action buttons
    - Status dropdown options computed from `TICKET_FSM[currentStatus]` (import FSM mapping as JSON constant in frontend)
    - Action buttons: Assign, Resolve, Escalate, Close, Reopen — each wrapped in `<PermissionGuard>`
    - Watchers: avatar stack + "+N more" tooltip + Add/Remove watcher

36. **Tickets Tab on entity pages** — Add to PRDetail, RFQDetail, PODetail, InvoiceDetail, ContractDetail, VendorDetail:
    ```tsx
    // In each entity detail page tabs array, add:
    { label: `Tickets (${ticketCount})`, content: <EntityTicketsTab entityType="REQUISITION" entityId={pr.id} /> }
    // EntityTicketsTab component: GET /api/v1/tickets?entity_type=X&entity_id=Y
    // Shows mini list + "+ Raise Ticket" button that opens CreateTicketModal with pre-filled entity
    ```

37. **Sidebar navigation update** — Buyer portal `apps/buyer-portal/app/(main)/layout.tsx`:
    Add "Support & Tickets" section with 4 items. Assigned to Me badge shows live count from `useTicketDashboard()`.

38. **`apps/supplier-portal/app/(main)/tickets/page.tsx`** — My Tickets (supplier):
    - Same component as buyer list but with `my_tickets=true` always applied
    - Status labels customer-friendly: map status enum to display labels via `SUPPLIER_STATUS_LABELS` constant
    - No assignee column, no team column, no internal note visibility

39. **`apps/supplier-portal/app/(main)/tickets/new/page.tsx`** — Raise Ticket (supplier):
    - Simplified form: type limited to [QUERY, DISCREPANCY, COMPLAINT, SUPPORT]
    - Entity link: fetches only supplier's own POs and Invoices
    - No is_private field, no is_internal option

40. **`apps/supplier-portal/app/(main)/tickets/[id]/page.tsx`** — Detail (supplier restricted):
    - Internal notes NOT rendered (double guard: API filters + `comment.is_internal === false` client check)
    - Status display only (no status change dropdown)
    - Actions: "This resolves my issue" (→ close) and "Still not resolved" (→ reopen) buttons shown when status=RESOLVED
    - TicketCommentBox shown without internal note toggle

41. **Admin Portal — Add 4 pages** to `apps/admin-portal`:
    - `/tickets` — All Tickets (full access, bulk actions toolbar: assign, change priority, close selected)
    - `/tickets/dashboard` — Dashboard with KPI row + 5 charts using recharts
    - `/tickets/sla-config` — SLA config table (4 rows, inline editable number cells)
    - `/tickets/reports` — Reports tables with date range selector and export

42. **Admin Portal Sidebar** — Add "Ticket System" section with 4 items.

### CRITICAL WIRING CHECKS (verify before Step 3):
```bash
# 1. No hardcoded strings in ticket transitions — all use FSM constants
grep -r '"OPEN"' apps/buyer-portal/app/\(main\)/tickets/ | grep -v "const\|type\|interface\|enum" && echo "WARN: possible hardcoded status"

# 2. Internal notes: supplier sees none
# 3. Access token not in localStorage
grep -r "localStorage.setItem" packages/ apps/ && echo "FAIL" || echo "PASS: no localStorage token"

# 4. Response envelope correct
grep -r "response\.data\.data" packages/hooks/useTickets.ts || echo "FAIL: wrong envelope unwrap"

# 5. All form field names match backend schema
# Compare TicketCreateRequest field names with CreateTicketModal form field names manually

# 6. Permissions on all router endpoints
grep -c "require_permission\|get_current_user" app/modules/ticket/router.py
# Must equal number of route functions

# 7. All new Celery tasks registered
python -c "from app.tasks.celery_app import celery_app; tasks = celery_app.tasks.keys(); print('ticket tasks:', [t for t in tasks if 'ticket' in t])"
```

---

## STEP 2.5 — SPEC AUDIT

After completing ALL implementation, produce `reports/spec_26_audit.md`:
```
MODULE 26 — TICKET SYSTEM | SPEC | DATE: {today}

S26-01 [DONE] → alembic/versions/0029_ticket_tables.py — 6 tables created
S26-02 [DONE] → alembic/versions/0028_ticket_enums.py — 3 ENUMs (ticket_type 8, priority 4, status 7)
S26-03 [DONE] → app/modules/ticket/service.py::_generate_number() — TKT-{ORG}-{YYYY}-{NNNNNN}
S26-04 [DONE] → app/modules/ticket/fsm.py — 7 states, 10 transitions, supplier restrictions
S26-05 [DONE] → app/modules/ticket/sla_service.py — per-priority SLA + org override
S26-06 [DONE] → app/modules/ticket/models.py::Ticket — 8 entity types (advisory soft FK)
S26-07 [DONE] → alembic/versions/0034_ticket_permissions.py — 12 permissions, 10 roles
S26-08 [DONE] → app/modules/ticket/service.py::get_list() — SQL-level visibility filter
S26-09 [DONE] → app/modules/ticket/mention_parser.py + service.py::add_comment()
S26-10 [DONE] → app/modules/ticket/service.py::get_comments() — WHERE is_internal=FALSE for suppliers
S26-11 [DONE] → react-markdown + remark-gfm installed; TicketCommentFeed renders markdown
S26-12 [DONE] → app/modules/ticket/service.py::edit_comment() — 900-second window enforced
S26-13 [DONE] → app/modules/ticket/router.py — 30+ endpoints all with auth dependencies
S26-14 [DONE] → scripts/rabbitmq_setup.py — procurement.ticket exchange + q.ticket.events
S26-15 [DONE] → app/tasks/celery_app.py — 3 new Beat entries
S26-16 [DONE] → app/modules/ticket/service.py — 20 audit event types in _log() + audit.log()
S26-17 [DONE] → app/modules/ticket/search_service.py — ES multi_match, monthly index rotation
S26-18 [DONE] → app/auth/jwt.py + middleware.py — portal claim in JWT, request.state.portal
S26-19 [DONE] → 8 buyer portal pages/components (list, board, detail, create modal, entity tab, mine, assigned, sidebar)
S26-20 [DONE] → 3 supplier portal pages (my tickets, raise, detail restricted)
S26-21 [DONE] → 4 admin portal pages (all tickets, dashboard, SLA config, reports)
S26-22 [DONE] → service.py::add_comment() — Redis pub/sub push to all watcher channels
S26-23 [DONE] → scripts/seed_notification_templates.py — 9 ticket templates
S26-24 [DONE] → Kanban board using @dnd-kit/core + @dnd-kit/sortable

OVERALL: 24/24 (100%) | BACKEND: 100% | FRONTEND: 100% | INFRA: 100% | TESTS: 100%
```

**BLOCK if ANY item is PARTIAL or MISSING. Fix before Step 3.**

---

## STEP 3 — TEST (Three Personas)

### User Persona — Happy Path E2E
```bash
# Start full stack
docker-compose up -d
sleep 30
# Verify new services
curl http://localhost:8000/health/ready

# E2E test sequence:
# 1. Login as buyer → create ticket linked to existing PO → verify ticket_number format
# 2. Add comment with @mention → verify watcher added + WebSocket push received
# 3. Login as supplier (different browser) → verify cannot see buyer's internal ticket
# 4. Resolve ticket → verify raiser gets email (check SendGrid activity)
# 5. Supplier reopens → verify reopen_count=1
# 6. Drag card on Kanban → verify status persisted after page refresh
# 7. Search "invoice discrepancy" → results appear with highlighted terms
```

### Developer Persona — Automated Suite
```bash
pytest tests/unit/test_ticket_fsm.py -v
pytest tests/unit/test_ticket_sla_service.py -v
pytest tests/unit/test_ticket_mention_parser.py -v
pytest tests/unit/test_ticket_service.py -v
pytest tests/integration/test_ticket_api.py -v
pytest tests/security/test_ticket_visibility.py -v
# Coverage target: >= 85% on app/modules/ticket/
pytest tests/ -v --cov=app/modules/ticket --cov-report=term-missing --cov-fail-under=85
```

**MANDATORY test cases — ALL must pass:**
```python
test_ticket_number_format
test_ticket_number_unique_concurrent  # 50 concurrent, all unique
test_sla_breach_computed_on_create_high_priority  # 24h for HIGH
test_sla_breach_computed_on_create_critical  # 4h for CRITICAL
test_supplier_cannot_see_internal_comment
test_supplier_add_internal_raises_forbidden
test_edit_comment_within_15min_succeeds
test_edit_comment_after_15min_raises_edit_window_closed
test_private_ticket_hidden_from_non_owner
test_private_ticket_visible_to_owner
test_private_ticket_visible_to_admin
test_mention_auto_adds_watcher
test_unknown_mention_silently_ignored
test_fsm_open_cannot_go_to_resolved
test_fsm_supplier_can_only_close_or_reopen_from_resolved
test_resolution_note_too_short_raises
test_reopen_after_30_days_blocked_for_non_admin
test_reopen_after_30_days_allowed_for_admin
test_sla_celery_marks_critical_breached_and_escalates
test_sla_celery_marks_at_risk_at_50_pct
test_auto_close_resolved_after_3_days
test_auto_close_pending_response_after_7_days
test_supplier_cannot_reopen_other_supplier_ticket
test_es_indexes_ticket_on_create
test_es_search_returns_highlighted_results
test_dashboard_counts_accurate_by_status
test_ticket_export_streams_csv
test_sla_config_update_reflected_in_new_tickets
```

### QA Persona — Volume, Concurrency, Security
```bash
# 1. 500 concurrent ticket creations → all unique numbers, 0 errors
pytest tests/performance/test_ticket_concurrency.py -v

# 2. Supplier visibility audit
pytest tests/security/test_ticket_visibility.py -v
# Tests: buyer ticket not in supplier list, internal comment not in supplier response,
#        private ticket not in non-owner list, supplier cannot change status

# 3. Real-time delivery
pytest tests/integration/test_ticket_websocket.py -v
# Test: add comment → watcher's WebSocket receives message within 1s

# 4. Full procurement cycle + ticket:
# Create PR → Submit → Raise ticket on PR → Approve PR → PO created → GRN → Invoice
# → Raise invoice discrepancy ticket → Dispute resolved → Ticket closed
npx playwright test tests/e2e/procurement_with_ticket.spec.ts

# 5. Load test: 1000-ticket SLA check
pytest tests/performance/test_ticket_sla_celery.py -v
# Must complete in < 60 seconds

# 6. Admin SLA config change → verify new tickets use new config
# 7. Kanban drag-and-drop persists on page refresh
# 8. Export 5000 tickets CSV < 30 seconds
```

---

## STEP 4 — INTEGRATE + REGRESSION

```bash
# 1. Apply all migrations
alembic upgrade head
psql -U postgres -d procurement -c "\dt ticket*" | wc -l  # Must be 6 tables

# 2. Add RabbitMQ topology
python scripts/rabbitmq_setup.py
# Verify in management UI: procurement.ticket exchange exists, q.ticket.events bound

# 3. Seed notification templates
python scripts/seed_notification_templates.py
# Verify: SELECT count(*) FROM notification_templates WHERE code LIKE 'TICKET_%';  — must be 9

# 4. Verify permissions
psql -U postgres -d procurement -c "SELECT code FROM permissions WHERE code LIKE 'ticket.%' ORDER BY code;"
# Must show all 12 ticket.* permissions

# 5. Test new Celery tasks registered
celery -A app.tasks.celery_app inspect registered | grep ticket
# Must show: check_ticket_sla_timers, auto_close_idle_tickets, send_ticket_digest

# 6. Full regression — ALL 26 modules
pytest tests/ -v --cov=app --cov-fail-under=80

# 7. Frontend build with new types
cd procurement-portal-frontend
pnpm generate:types  # Must complete without errors
pnpm build --filter=buyer-portal  # Must build without TypeScript errors
pnpm build --filter=supplier-portal
pnpm build --filter=admin-portal

# 8. API contract verification
curl -s http://localhost:8000/api/v1/openapi.json | python -c "
import json,sys
spec=json.load(sys.stdin)
ticket_paths=[p for p in spec['paths'] if '/tickets' in p]
print(f'Ticket endpoints: {len(ticket_paths)}')
assert len(ticket_paths) >= 25, f'Expected >= 25 ticket endpoints, got {len(ticket_paths)}'
print('API contract: PASS')
"

# 9. If any regression fails: ROLLBACK PROTOCOL (GEMINI.md)
# git revert HEAD (no reset) → graphify diff → restore graph + README → full regression → re-enter Step 1
```

---

## STEP 5 — GRAPHIFY UPDATE

```bash
graphify update

# Verify all new nodes added:
graphify query --node-type service --name TicketService
graphify query --node-type service --name TicketSLAService
graphify query --node-type service --name TicketSearchService
graphify query --node-type parser --name MentionParser
graphify query --node-type fsm --name TicketFSM
graphify query --node-type router --name TicketRouter
graphify query --node-type celery_task --name check_ticket_sla_timers
graphify query --node-type celery_task --name auto_close_idle_tickets
graphify query --node-type celery_task --name send_ticket_digest
graphify query --node-type model --name Ticket
graphify query --node-type model --name TicketComment
graphify query --node-type model --name TicketActivityLog
graphify query --node-type model --name TicketSLAConfig

# Verify updated nodes have ticket connections:
graphify query --node-name rabbitmq_setup --check-relationship procurement.ticket
graphify query --node-name celery_app --check-relationship check_ticket_sla_timers
graphify query --node-name NotificationConsumer --check-relationship ticket_events

graphify check --integrity
# Must show: 0 broken links, 0 orphaned nodes

graphify diff > graphify_diff_ticket_$(date +%Y%m%d_%H%M%S).txt
cat graphify_diff_*.txt | tail -5  # Confirm diff saved
```

---

## STEP 6 — README + COMMIT

Write EXACTLY this to `## Current Session State` in README.md (≤10 lines):
```markdown
## Current Session State
**Status:** SPEC_26 Ticket System COMPLETED — 26/26 modules done
**New Tables:** tickets, ticket_comments, ticket_attachments, ticket_watchers,
               ticket_activity_log, ticket_sla_config (migrations 0028–0034)
**New APIs:** 30+ endpoints /api/v1/tickets; JWT portal claim added
**Celery:** check_ticket_sla_timers(15min), auto_close_idle_tickets(daily), send_ticket_digest(daily)
**RabbitMQ:** procurement.ticket exchange + q.ticket.events + q.dlq.ticket
**Frontend:** 15 pages (Buyer:8 Supplier:3 Admin:4); @dnd-kit Kanban; react-markdown; real-time WS
**Migration Head:** 0034_ticket_permissions
**Test Coverage:** ticket≥85% overall≥80%
**Graphify:** All 26 module nodes documented; 0 broken links
**Next:** Production deployment → k8s/overlays/production/
```

Then commit:
```bash
git add -A
git commit -m "[NON-BREAKING] feat: SPEC_26 — Jira-style ticket system; 7-state FSM; Kanban DnD; @mentions; internal notes; SLA timers; ES search; real-time WS comments; 3-portal UI; 7 migrations; 12 permissions; 9 notification templates"
git tag v1.0.0-mvp-with-tickets
git push origin main --tags
```

---

## POST-IMPLEMENTATION VERIFICATION CHECKLIST

Run this full checklist. Every item must be ✓:

```bash
echo "=== DATABASE ==="
psql -U postgres -d procurement -c "SELECT typname FROM pg_type WHERE typname LIKE 'ticket%'"
# ✓ ticket_type_enum, ticket_priority_enum, ticket_status_enum
psql -U postgres -d procurement -c "\dt ticket*"
# ✓ 6 tables
psql -U postgres -d procurement -c "SELECT count(*) FROM permissions WHERE code LIKE 'ticket.%'"
# ✓ 12

echo "=== RABBITMQ ==="
curl -s -u guest:guest http://localhost:15672/api/exchanges/%2F | python -c "
import json,sys; e=[x['name'] for x in json.load(sys.stdin)]; print('ticket exchange:', 'procurement.ticket' in e)
"
# ✓ True

echo "=== CELERY ==="
celery -A app.tasks.celery_app inspect registered 2>/dev/null | grep -c ticket
# ✓ 3

echo "=== API ==="
curl -s http://localhost:8000/api/v1/openapi.json | python -c "
import json,sys; paths=json.load(sys.stdin)['paths']; print('ticket endpoints:', len([p for p in paths if 'ticket' in p]))
"
# ✓ >= 25

echo "=== FRONTEND ==="
curl -s http://localhost:3000/tickets | grep -q "Tickets" && echo "✓ Buyer tickets page" || echo "✗ MISSING"
curl -s http://localhost:3001/tickets | grep -q "Tickets" && echo "✓ Supplier tickets page" || echo "✗ MISSING"
curl -s http://localhost:3002/tickets | grep -q "Tickets" && echo "✓ Admin tickets page" || echo "✗ MISSING"

echo "=== TESTS ==="
pytest tests/unit/test_ticket_service.py tests/security/test_ticket_visibility.py -v --tb=short -q
# ✓ All passing

echo "=== GRAPHIFY ==="
graphify check --integrity
# ✓ 0 broken links

echo "=== ALL CHECKS COMPLETE ==="
```
