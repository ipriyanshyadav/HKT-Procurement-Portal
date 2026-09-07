# IMPLEMENTATION PROMPTS — ALL 26 MODULES
# Paste one prompt per Gemini session. Complete all 6 steps before starting the next.
# CRITICAL: Read FRONTEND_BACKEND_WIRING_GUIDE.md before any session involving frontend work.

---

## PROMPT 01 — Project Scaffolding & Architecture

Execute the complete implementation for the plan at `plans/plan_spec_01_project_overview.md` AND `plans/plan_spec_02_architecture.md` in a SINGLE session (they are tightly coupled scaffolding tasks).

You MUST strictly follow the `IMPLEMENTATION LOOP` (Steps 2 through 6) and ALL `ABSOLUTE RULES` from `GEMINI.md`. Do not stop until every step is fully completed and verified.

### MANDATORY PRE-FLIGHT (run first, before any code):
```bash
graphify check --before-change 2>/dev/null || echo "No graph yet — clean start"
cat README.md 2>/dev/null | grep "Current Session State" || echo "No session state — first run"
cat GEMINI.md  # Confirm rules loaded
```

### Step 2 — IMPLEMENT (in this exact order):
1. Create ALL directories: `app/`, `app/modules/` (all 22 submodules), `tests/`, `k8s/`, `scripts/`, `docker/`, `kong/`, `plans/`, `alembic/versions/`
2. `pyproject.toml` — all dependencies from plan, NO version ranges without lower bound
3. `app/config.py` — ALL settings as Pydantic BaseSettings; ZERO magic numbers in any other file
4. `app/db/base.py` — BaseModel with org_id, version, created_at, updated_at, deleted_at
5. `app/db/session.py` — async engine + get_db() + get_db_with_rls()
6. `app/core/exceptions.py` — all 9 exception classes + register_exception_handlers()
7. `app/core/constants.py` — AuditAction + PermissionCode (ALL 100+ codes as class attributes)
8. `app/core/middleware.py` — RequestID, LoggingContext, Timing, SecurityHeaders
9. `app/core/telemetry.py` — OpenTelemetry + Jaeger + get_current_trace_id()
10. `app/core/redis_client.py` — RedisKeys class (all 14 key patterns)
11. `app/core/idempotency.py` — check + store functions
12. `app/core/permissions.py` — PERMANENTLY_DENIED_PERMISSIONS + user_has_permission()
13. `app/core/responses.py` — APIResponse, PaginationMeta, Links, success_response(), created_response()
14. `app/core/pagination.py` — PaginationParams, encode_cursor(), decode_cursor(), paginate_query()
15. `app/events/publisher.py` — OutboxPublisher (publish within caller's transaction)
16. `app/events/outbox_worker.py` — FOR UPDATE SKIP LOCKED batch worker
17. `app/events/schemas.py` — all RabbitMQ event Pydantic models
18. `app/tasks/celery_app.py` — ALL 16 Beat tasks; ALL intervals from settings.*
19. `app/main.py` — create_app() factory; all 24 module routers registered; lifespan
20. `scripts/rabbitmq_setup.py` — idempotent; all 25 exchanges, 12 queues, DLQs
21. `scripts/minio_setup.py` — idempotent; all 10 buckets, versioning, SSE-S3, lifecycle
22. `scripts/generate_rsa_keys.py` — RS256 key pair generation
23. `scripts/seed_master_data.py` — roles, permissions (ALL 100+), incoterms (20), default workflows
24. `scripts/create_superadmin.py` — reads from env vars ONLY
25. `docker/docker-compose.yml` — ALL services; NO 'latest' tags; all env from .env
26. `docker/Dockerfile.api` — multi-stage; entrypoint runs migrations then uvicorn
27. `docker/entrypoint.sh` — alembic upgrade head → seed → uvicorn
28. `kong/kong.yml` — all 24 routes, JWT plugin, rate limiting (5 tiers), CORS, request-size
29. `alembic/env.py` — async setup; target_metadata = Base.metadata
30. `.env.example` — ALL settings, all marked with <REPLACE_ME>
31. `.pre-commit-config.yaml` — black, ruff, no-print, no-console-log, no-todo-without-ticket
32. `.github/workflows/ci.yml` — test, lint, type-check, security scan; NO secrets in yaml

### FRONTEND WIRING (Step 2, Part B — do NOT skip):
33. `procurement-portal-frontend/turbo.json` — pipeline config
34. `procurement-portal-frontend/package.json` — workspaces
35. `packages/utils/api.ts` — Axios instance with JWT auto-refresh interceptors
36. `packages/stores/authStore.ts` — Zustand auth store (memory token only)
37. `apps/buyer-portal/Dockerfile`, `apps/supplier-portal/Dockerfile`, `apps/admin-portal/Dockerfile`
38. Update `docker/docker-compose.yml` to include all 3 frontend services with correct networking
39. `packages/types/generate.ts` — openapi-typescript generation script pointing to localhost:8000

### Step 2.5 — SPEC AUDIT:
Re-read SPEC_01 and SPEC_02 fully. Produce `reports/spec_01_02_audit.md`:
```
MODULE 01+02 | SPEC | DATE: {today}
[list each requirement as DONE / PARTIAL / MISSING]
OVERALL: X/Y (Z%) | BACKEND: A% | FRONTEND: B% | INFRA: C% | TESTS: D%
```
STOP if any item is MISSING or PARTIAL. Fix before Step 3.

### Step 3 — TEST (three personas):
- User: `docker-compose up -d` → all services healthy → health endpoints return 200
- Developer: `pytest tests/unit/test_config.py tests/unit/test_base_model.py tests/integration/test_health.py -v`
- QA: Verify all 25 RabbitMQ exchanges, all 10 MinIO buckets, all 24 Kong routes; pre-commit rejects print()

### Step 4 — INTEGRATE:
```bash
docker-compose up -d
alembic upgrade head  # Must show: (head)
python scripts/seed_master_data.py
curl http://localhost:8000/health/ready  # Must return {"status":"ok"}
curl http://localhost:3000  # buyer portal reachable
```

### Step 5 — GRAPHIFY:
```bash
graphify update
graphify check --integrity
graphify diff > graphify_diff_$(date +%Y%m%d_%H%M%S).txt
```

### Step 6 — README + COMMIT:
Write ≤10-line state summary to `## Current Session State` in README.md. Commit ALL files:
```bash
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_01+02 — complete project scaffold, arch wiring, docker, kong, frontend skeleton"
```

---

## PROMPT 02 — Database Schema (70+ tables, all migrations)

Execute the complete implementation for the plan at `plans/plan_spec_03_database.md`.

Follow `IMPLEMENTATION LOOP` Steps 2–6 and ALL `ABSOLUTE RULES` from `GEMINI.md`. Do not stop until all steps are complete and verified.

### MANDATORY PRE-FLIGHT:
```bash
graphify check --before-change
cat README.md | grep -A 20 "Current Session State"
# Confirm: scaffolding complete, Alembic initialized, docker-compose up
```

### Step 2 — IMPLEMENT (strict order — migrations MUST be in this sequence):
1. `app/db/enums.py` — ALL 20 SQLAlchemy Enum types matching SPEC_03 Section 2 exactly
2. `alembic/versions/0002_create_enums.py` — CREATE TYPE for all 20 ENUMs; downgrade drops all
3. `alembic/versions/0003_org_structure.py` — organizations, legal_entities, business_units, plants, cost_centers, departments
4. `alembic/versions/0004_master_data.py` — all 12 master data tables
5. `alembic/versions/0005_user_auth_part1.py` — roles, permissions, role_permissions, password_history
6. `alembic/versions/0006_vendor.py` — vendors (WITHOUT invited_by FK), vendor_contacts, vendor_bank_accounts, vendor_category_mappings, vendor_scorecards, vendor_erp_sync_log
7. `alembic/versions/0007_user_auth_part2.py` — users (WITH vendor_id FK), user_sessions, user_mfa, user_role_assignments, user_category_scopes, user_bu_scopes, user_coi_declarations, delegation_rules
8. `alembic/versions/0008_vendor_alter.py` — ALTER vendors ADD COLUMN invited_by FK to users
9. `alembic/versions/0009_vendor_documents.py` — vendor_documents table
10. `alembic/versions/0010_approval_workflow.py` — approval_rules, approval_rule_versions, approval_groups, approval_group_members, workflow_templates, workflow_instances, workflow_tasks, workflow_events
11. `alembic/versions/0011_requisition.py` — requisitions, requisition_lines, unmapped_pr_exceptions, unmapped_pr_mapping_log
12. `alembic/versions/0012_rfq.py` — rfqs, rfq_lots, rfq_lines, rfq_participants, rfq_clarifications, rfq_amendments
13. `alembic/versions/0013_bid.py` — bid_responses, bid_line_responses, bid_versions, bid_documents
14. `alembic/versions/0014_evaluation_award.py` — all 6 evaluation/award tables
15. `alembic/versions/0015_contract.py` — all 5 contract tables
16. `alembic/versions/0016_purchase_order.py` — purchase_orders, po_lines (with GENERATED ALWAYS AS total_price), po_amendments
17. `alembic/versions/0017_grn_ses.py` — goods_receipt_notes, grn_lines, service_entry_sheets, ses_lines, quality_inspections
18. `alembic/versions/0018_invoice_payment.py` — invoices, invoice_lines, invoice_match_results, payment_records, disputes, dispute_messages
19. `alembic/versions/0019_document.py` — documents, document_versions
20. `alembic/versions/0020_notification.py` — notifications, notification_preferences, notification_templates, communication_threads, communication_messages
21. `alembic/versions/0021_infra_tables.py` — outbox_messages, integration_jobs, feature_flags, tenant_settings, scheduled_job_runs
22. `alembic/versions/0022_audit_log.py` — audit_logs (partitioned by month) + immutability trigger + audit_writer role
23. `alembic/versions/0023_audit_partitions.py` — create 4 initial monthly partitions
24. `alembic/versions/0024_indexes.py` — ALL 40+ indexes using CREATE INDEX CONCURRENTLY IF NOT EXISTS
25. `alembic/versions/0025_rls.py` — enable RLS + create policies for 6 tables; SET LOCAL app.current_org_id
26. `alembic/versions/0026_sequences.py` — PR/PO number sequences per BU template
27. `alembic/versions/0027_data_seed.py` — seed incoterms, default org, default roles, ALL 100+ permissions
28. `app/db/repository_base.py` — BaseRepository with get(), get_multi(), soft_delete(), increment_version()
29. SQLAlchemy models for ALL 70+ tables in their respective module model files:
    - `app/modules/organization/models.py`
    - `app/modules/master_data/models.py`
    - `app/modules/user/models.py`
    - `app/modules/vendor/models.py`
    - `app/modules/workflow/models.py`
    - `app/modules/requisition/models.py`
    - `app/modules/sourcing/models.py`
    - `app/modules/bid/models.py`
    - `app/modules/evaluation/models.py`
    - `app/modules/contract/models.py`
    - `app/modules/purchase_order/models.py`
    - `app/modules/grn/models.py`
    - `app/modules/invoice/models.py`
    - `app/modules/payment/models.py`
    - `app/modules/document/models.py`
    - `app/modules/notification/models.py`
    - `app/modules/audit/models.py`
    - `app/modules/integration/models.py`
30. `k8s/base/pgbouncer-config.yaml` — transaction mode, pool_size=50, max_client=200

### CRITICAL CHECKS during implementation:
- Every model file: imports from `app.db.base import BaseModel` (not SQLAlchemy directly)
- Every model: `org_id` column present and non-nullable (except organizations table itself)
- Migration 0022: downgrade() drops trigger, function, table, role — ALL reversed
- Migration 0024: use `CREATE INDEX CONCURRENTLY` — NOT `op.create_index()`

### Step 2.5 — SPEC AUDIT:
Produce `reports/spec_03_audit.md`. Count all 70+ tables. Count all 20 ENUMs. Count all 40+ indexes.
BLOCK on PARTIAL or MISSING.

### Step 3 — TEST:
```bash
# Full roundtrip
alembic downgrade base && alembic upgrade head
# Verify
psql -U postgres -d procurement -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'"  # >= 70
psql -U postgres -d procurement -c "SELECT typname FROM pg_type WHERE typtype='e'" | wc -l  # >= 20
# Immutability
pytest tests/integration/test_migrations.py -v  # test_audit_log_immutable must pass
# Soft delete
pytest tests/integration/test_soft_delete.py -v
```

### Step 4 — INTEGRATE:
```bash
alembic upgrade head
python -c "from app.modules.organization.models import Organization; print('Models OK:', Organization.__tablename__)"
pytest tests/ -v --cov=app/db --cov=app/modules --cov-fail-under=80
```

### Step 5 — GRAPHIFY + Step 6 — COMMIT:
```bash
graphify update  # All 70+ model nodes added
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_03 — 70+ table schema, all migrations, RLS, partitioned audit log"
```

---

## PROMPT 03 — Auth, Security & Permissions

Execute the complete implementation for `plans/plan_spec_04_auth_security.md`.

Follow ALL GEMINI.md rules. Do not proceed to Step 3 until Step 2.5 SPEC AUDIT shows 100% DONE.

### MANDATORY PRE-FLIGHT:
```bash
graphify check --before-change
# Verify: migrations at head, seed data present, RSA keys generated
alembic current  # must show (head)
ls -la $JWT_PRIVATE_KEY_PATH 2>/dev/null || python scripts/generate_rsa_keys.py
```

### Step 2 — IMPLEMENT:
1. `app/core/security.py` — hash_password, verify_password, validate_password_strength, load_common_passwords, mask_pii
2. `app/core/encryption.py` — encrypt_field, decrypt_field (Fernet + settings.FIELD_ENCRYPTION_KEY)
3. `app/auth/jwt.py` — create_access_token, create_refresh_token, create_mfa_token, decode_jwt
4. `app/auth/dependencies.py` — get_current_user (7-step pipeline), require_permission(), require_mfa_enabled()
5. `app/auth/service.py` — AuthService: login(), refresh_token(), logout(), verify_mfa(), enroll_mfa(), confirm_mfa(), _issue_tokens(), _increment_fail_count(), _clear_fail_count()
6. `app/auth/router.py` — ALL endpoints: /login, /refresh, /logout, /mfa/verify, /mfa/enroll, /mfa/confirm, /sso/initiate, /sso/callback, /sso/oidc/callback
7. `app/auth/mfa.py` — TOTP generation (pyotp), QR URI, backup codes (10 codes, bcrypt-hashed)
8. `app/auth/sso.py` — SAML SP-initiated + OIDC (authlib) + JIT provisioning with REQUESTOR default role
9. `app/modules/user/repository.py` — find_by_email, get_by_id, get_active_users_with_role, find_by_employee_id
10. `app/modules/user/session_repository.py` — get_by_jti, count_active, get_oldest_active, revoke, revoke_all, update_activity
11. `app/modules/audit/service.py` — AuditService.log() — INSERT ONLY; never UPDATE or DELETE
12. `app/modules/user/router.py` — GET /users/me, GET /users/me/permissions, PUT /users/me/password, GET /users, POST /users, GET /users/{id}, PUT /users/{id}, POST /users/{id}/activate, POST /users/{id}/deactivate
13. Update `scripts/seed_master_data.py` — insert ALL 100+ permissions, ALL 15 roles (REQUESTOR through SUPPLIER_USER) with correct permission mappings

### FRONTEND WIRING (must happen in same session):
14. `apps/buyer-portal/app/(auth)/login/page.tsx` — login form using React Hook Form + Zod
15. `apps/buyer-portal/app/(auth)/mfa/page.tsx` — TOTP entry form
16. `packages/hooks/useAuth.ts` — login mutation, logout, refresh, user query
17. `packages/stores/authStore.ts` — access token in memory ONLY (verify: no localStorage.setItem calls)
18. `packages/utils/api.ts` — confirm 401 interceptor → /auth/refresh → retry is working
19. `apps/buyer-portal/middleware.ts` — protect all routes except /login, /register
20. `apps/supplier-portal/middleware.ts` — same pattern
21. Verify: login → access_token in Zustand → API calls work → logout clears state

### CRITICAL SECURITY CHECKS (must pass before Step 3):
```bash
# These are ABSOLUTE security requirements
grep -r "localStorage.setItem" packages/ apps/ && echo "FAIL: token in localStorage" || echo "PASS: no localStorage"
grep -r "rfq.view_bids_before_opening" app/core/constants.py || echo "FAIL: missing permanent deny"
grep -r "PERMANENTLY_DENIED" app/core/permissions.py || echo "FAIL: missing permanent deny check"
grep -r "auto_approve" app/ && echo "FAIL: auto approve found" || echo "PASS: no auto-approve"
```

### Step 2.5 — SPEC AUDIT → `reports/spec_04_audit.md`

### Step 3 — TEST (security persona is mandatory):
```bash
pytest tests/unit/test_security.py tests/unit/test_jwt.py tests/security/test_auth_security.py -v
# Must pass: brute force lockout, maker-checker, bid visibility denial, MFA token rejection, token reuse detection
```

### Step 4 — INTEGRATE + Step 5 — GRAPHIFY + Step 6 — COMMIT:
```bash
python scripts/seed_master_data.py  # Inserts all permissions and roles
pytest tests/ -v --cov=app/auth --cov=app/modules/user --cov-fail-under=85
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_04 — JWT RS256 auth, MFA, SAML/OIDC SSO, RBAC, field encryption, login UI"
```

---

## PROMPT 04 — Workflow Engine & Approval Rules

Execute the complete implementation for `plans/plan_spec_05_workflow_engine.md` AND `plans/plan_spec_06_approval_rules.md` in a SINGLE session (Rules Engine depends on Workflow Engine).

### MANDATORY PRE-FLIGHT:
```bash
graphify check --before-change
# Confirm: auth module complete and passing tests
pytest tests/security/test_auth_security.py -v --tb=no -q  # Must be all green
```

### Step 2 — IMPLEMENT:
1. `app/modules/workflow/evaluator.py` — safe_eval using simpleeval; ALLOWED_NAMES whitelist; no function calls
2. `app/modules/workflow/resolver.py` — ApproverResolver: ROLE, NAMED_USER, APPROVAL_GROUP; all scope filters
3. `app/modules/workflow/repository.py` — get_template_by_code, get_instance, get_task, get_tasks_by_group, get_all_pending_tasks_with_sla, get_pending_tasks_by_user
4. `app/modules/workflow/service.py` — WorkflowEngine: instantiate(), advance(), _process_step(), create_tasks_for_step(), _handle_step_completion(), _check_parallel_convergence(), _advance_to_next_step(), cancel(), pause(), resume(), force_advance(), simulate()
5. `app/modules/workflow/events.py` — all 10 RabbitMQ events published
6. `app/modules/workflow/router.py` — 7 endpoints including simulate (no auth bypass)
7. `app/tasks/sla_timers.py` — SLA check task; 4 thresholds from settings.UNMAPPED_PR_SLA_HOURS and business workflow SLAs; escalation chain
8. `scripts/seed_workflows.py` — ALL 10 workflow template JSON definitions inserted to DB
9. `app/modules/approval_rules/models.py` — ApprovalRule + ApprovalRuleVersion
10. `app/modules/approval_rules/repository.py` — get_active_rules, get_by_priority
11. `app/modules/approval_rules/service.py` — RulesEngine: find_matching_rule(), detect_conflicts(), activate_rule()
12. `app/modules/approval_rules/router.py` — 7 endpoints; simulate endpoint makes ZERO DB writes

### FRONTEND WIRING:
13. `apps/buyer-portal/app/(main)/tasks/page.tsx` — Workflow Task Inbox (pending tasks assigned to me)
14. `apps/buyer-portal/app/(main)/tasks/[taskId]/page.tsx` — Task detail: approve/reject/return with comment modal
15. `packages/hooks/useWorkflowTasks.ts` — TanStack Query hooks for task list + actions
16. `packages/ui/SLAIndicator.tsx` — color-coded SLA bar (green/yellow/red based on elapsed%)
17. `packages/hooks/useApprovalSimulate.ts` — calls POST /workflow/simulate; renders chain preview
18. `packages/components/WorkflowChainPreview.tsx` — shows step-by-step approval chain with estimated SLAs

### Step 2.5 → Step 3 → Step 4:
```bash
python scripts/seed_workflows.py
pytest tests/unit/test_workflow_evaluator.py tests/workflow/test_workflow_engine.py -v
# MUST PASS: maker-checker, all parallel convergence types, simulate no-write, force-advance audit
```

### Step 5 → Step 6 — COMMIT:
```bash
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_05+06 — workflow engine, SLA timers, approval rules, task inbox UI"
```

---

## PROMPT 05 — Master Data Management

Execute the complete implementation for `plans/plan_spec_24_master_data.md`.
(Implemented early because all business modules depend on it.)

### Step 2 — IMPLEMENT:
1. `app/modules/master_data/category/service.py` — CategoryService with 5-level CTE tree
2. `app/modules/master_data/uom/service.py`
3. `app/modules/master_data/currency/service.py` — exchange rate Redis cache
4. `app/modules/master_data/payment_terms/service.py`
5. `app/modules/master_data/tax/service.py`
6. `app/modules/master_data/location/service.py`
7. `app/modules/master_data/holiday/service.py`
8. `app/modules/master_data/erp_mapping/service.py`
9. `app/modules/master_data/import_service.py` — async CSV import via Celery; max 5000 rows
10. `app/modules/master_data/router.py` — ALL 15 endpoints
11. `app/tasks/exchange_rates.py` — daily fetch → Redis cache → DB persist
12. `app/tasks/master_data_import.py` — Celery task for CSV import

### FRONTEND WIRING:
13. `apps/admin-portal/app/(main)/master-data/categories/page.tsx` — category tree with expand/collapse
14. `apps/admin-portal/app/(main)/master-data/categories/[id]/page.tsx` — category detail + sub-categories
15. `packages/ui/CategoryTreeSelect.tsx` — reusable tree select for PR/RFQ forms (shared with buyer portal)
16. `packages/ui/UOMSelect.tsx`, `packages/ui/CurrencySelect.tsx`, `packages/ui/PaymentTermsSelect.tsx` — shared selects used in ALL downstream forms
17. `packages/hooks/useMasterData.ts` — hooks for all master data lookups; staleTime=30min (rarely changes)
18. `apps/admin-portal/app/(main)/master-data/import/page.tsx` — CSV drag-and-drop import with progress tracking

### Step 2.5 → Step 3 → Step 4 → Step 5 → Step 6:
```bash
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_24 — master data CRUD, category tree CTE, exchange rates, CSV import, admin portal UI"
```

---

## PROMPT 06 — Vendor Management

Execute the complete implementation for `plans/plan_spec_07_vendor_management.md`.

### MANDATORY PRE-FLIGHT:
```bash
pytest tests/workflow/test_workflow_engine.py -v --tb=no -q  # Workflow must be green
python scripts/seed_workflows.py  # VENDOR_QUAL and VENDOR_BLACKLIST templates must exist
```

### Step 2 — IMPLEMENT (backend):
1. `app/modules/vendor/fsm.py` — 11-status FSM + validate_transition()
2. `app/modules/vendor/repository.py`
3. `app/modules/vendor/service.py` — VendorService: invite_vendor, submit_registration, qualify, reject, request_resubmission, suspend, reinstate, initiate_blacklist, confirm_blacklist, update_scorecard, _validate_gstin(), _validate_pan()
4. `app/modules/vendor/router.py` — ALL 15 endpoints; supplier-side vs buyer-side separation
5. `app/modules/vendor/schemas.py` — ALL Pydantic schemas
6. `integration/adapters/gst.py` — GSTAdapter with Redis 90-day cache
7. `integration/adapters/pan.py` — PANAdapter with Redis 90-day cache
8. `integration/adapters/bank.py` — BankVerificationAdapter
9. `app/tasks/vendor_compliance.py` — daily check for compliance expiry (3 thresholds from settings.COMPLIANCE_EXPIRY_WARNING_DAYS); auto COMPLIANCE_HOLD at 0 days

### FRONTEND WIRING (buyer portal + supplier portal both):
10. Buyer Portal — `apps/buyer-portal/app/(main)/vendors/page.tsx` — vendor list with filters (status, category, compliance)
11. Buyer Portal — `apps/buyer-portal/app/(main)/vendors/[id]/page.tsx` — vendor detail: status, docs, scorecard, audit trail; action buttons guarded by permissions
12. Buyer Portal — `apps/buyer-portal/app/(main)/vendors/invite/page.tsx` — invite form with category multi-select using `CategoryTreeSelect`
13. Supplier Portal — `apps/supplier-portal/app/register/[token]/page.tsx` — 8-step wizard; token validated on mount
14. Supplier Portal — `apps/supplier-portal/app/(main)/profile/page.tsx` — vendor profile management
15. Supplier Portal — `apps/supplier-portal/app/(main)/documents/page.tsx` — document upload with ClamAV status indicator
16. `packages/hooks/useVendors.ts` — all vendor query + mutation hooks
17. `packages/components/VendorStatusBadge.tsx` — color-coded status badge
18. `packages/components/ComplianceExpiryAlert.tsx` — shows days remaining with color coding

### CRITICAL WIRING CHECKS:
```bash
# Supplier portal CANNOT access buyer portal routes
# Token-based registration must work end-to-end
# Verify: invite → email notification → token link → supplier registration wizard → submit → workflow task in buyer inbox
```

### Step 2.5 → Step 3 → Step 4 → Step 5 → Step 6:
```bash
pytest tests/integration/test_vendor.py tests/workflow/test_vendor_workflows.py -v
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_07 — vendor lifecycle FSM, GST/PAN validation, registration wizard, compliance monitoring"
```

---

## PROMPT 07 — Purchase Requisition & Unmapped PR

Execute the complete implementation for `plans/plan_spec_08_purchase_requisition.md` AND `plans/plan_spec_09_unmapped_pr.md`.

### Step 2 — IMPLEMENT:
1. `app/modules/requisition/fsm.py` — 12-status PR FSM
2. `app/modules/requisition/repository.py`
3. `app/modules/requisition/service.py` — RequisitionService: create, submit, withdraw, amend, merge_prs, split_pr, convert_to_rfq, convert_to_po, _generate_pr_number(), _check_budget(), _invalidate_pr_cache()
4. `app/modules/requisition/router.py` — ALL 12 endpoints
5. `app/modules/requisition/schemas.py`
6. `app/tasks/pr_aging.py` — aging alerts for thresholds from settings.PR_AGING_ALERT_DAYS
7. `app/modules/unmapped_pr/service.py` — flag_as_unmapped, map_pr, suggest_mapping, auto_map
8. `app/modules/unmapped_pr/router.py` — 5 endpoints
9. `app/tasks/unmapped_pr_sla.py` — 4-tier SLA from settings.UNMAPPED_PR_SLA_HOURS

### FRONTEND WIRING:
10. Buyer Portal — `apps/buyer-portal/app/(main)/requisitions/page.tsx` — PR list with status filters, scope toggle (mine/BU/all)
11. Buyer Portal — `apps/buyer-portal/app/(main)/requisitions/new/page.tsx` — PR creation form with line items (dynamic add/remove), budget estimate, CategoryTreeSelect
12. Buyer Portal — `apps/buyer-portal/app/(main)/requisitions/[id]/page.tsx` — PR detail with workflow status timeline, line items table, action buttons
13. Buyer Portal — `apps/buyer-portal/app/(main)/unmapped-prs/page.tsx` — exception dashboard with SLA tier badges
14. `packages/ui/PRLineItemTable.tsx` — reusable TanStack Table for PR lines (used in PR creation and PO creation)
15. `packages/hooks/useRequisitions.ts` — all PR hooks including merge/split mutations
16. `packages/components/WorkflowTimeline.tsx` — visual step-by-step workflow status (reused across PR, RFQ, PO, etc.)
17. `packages/components/BudgetIndicator.tsx` — estimated total vs budget (from backend budget check response)

### Step 2.5 → Step 3 → Step 4:
```bash
pytest tests/integration/test_requisition.py tests/workflow/test_pr_workflows.py -v
# MUST PASS: pr_creator_cannot_approve, merge_requires_same_bu, budget_hard_block, pr_cache_invalidated
```

### Step 5 → Step 6 — COMMIT:
```bash
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_08+09 — PR lifecycle, merge/split, unmapped PR SLA, PR list/form UI"
```

---

## PROMPT 08 — RFQ Lifecycle & Bid Management

Execute the complete implementation for `plans/plan_spec_10_rfq_lifecycle.md` AND `plans/plan_spec_11_bid_management.md`.

### MANDATORY PRE-FLIGHT:
```bash
# Verify: PRs can be converted to RFQ (source_pr_id linkage)
pytest tests/integration/test_requisition.py::test_convert_to_rfq -v
```

### Step 2 — IMPLEMENT:
1. `app/modules/sourcing/fsm.py` — 14-status RFQ FSM
2. `app/modules/sourcing/repository.py`
3. `app/modules/sourcing/service.py` — RFQService: create, submit, publish, amend, cancel, add_participants, remove_participant, initiate_bid_opening, co_authorize_bid_opening, add_clarification, respond_to_clarification, extend_deadline
4. `app/modules/sourcing/router.py` — ALL 18 endpoints
5. `app/modules/sourcing/schemas.py`
6. `app/tasks/rfq_lifecycle.py` — auto-close on deadline; runs every settings.CELERY_BID_WINDOW_CHECK_MINUTES
7. `app/modules/bid/fsm.py` — 11-status Bid FSM
8. `app/modules/bid/repository.py`
9. `app/modules/bid/service.py` — BidService: submit_bid (with price encryption), revise_bid, withdraw_bid, get_bid_details (decrypt only after opening), normalize_prices_on_opening, check_single_vendor_situation
10. `app/modules/bid/router.py` — endpoints including bid_count (sealed, no content)
11. `app/modules/bid/schemas.py`

### CRITICAL SECURITY IMPLEMENTATION:
```python
# In bid/service.py submit_bid:
# MUST encrypt price fields before storage using encrypt_field()
# In bid/service.py get_bid_details:
# MUST check rfq.bids_opened_at is NOT None before decrypting
# In sourcing/router.py:
# rfq.view_bids_before_opening MUST be in PERMANENTLY_DENIED_PERMISSIONS — verify this check
```

### FRONTEND WIRING:
12. Buyer Portal — `apps/buyer-portal/app/(main)/rfqs/page.tsx` — RFQ list
13. Buyer Portal — `apps/buyer-portal/app/(main)/rfqs/new/page.tsx` — RFQ creation with lots/lines, participant selection
14. Buyer Portal — `apps/buyer-portal/app/(main)/rfqs/[id]/page.tsx` — RFQ detail with bid count (sealed), clarification thread, dual-auth opening UI
15. Buyer Portal — `apps/buyer-portal/app/(main)/rfqs/[id]/open-bids/page.tsx` — Step 1 (initiate) + Step 2 (co-authorize) forms; shows which step is pending
16. Supplier Portal — `apps/supplier-portal/app/(main)/rfqs/page.tsx` — RFQs I'm invited to
17. Supplier Portal — `apps/supplier-portal/app/(main)/rfqs/[id]/bid/page.tsx` — Bid submission form with lot/line pricing, document upload, deviation declaration
18. `packages/components/BidSealedIndicator.tsx` — shows "X bids received" without prices until opened
19. `packages/components/ClarificationThread.tsx` — Q&A thread UI; buyer sees vendor name, vendor sees "Anonymous"

### Step 2.5 → Step 3:
```bash
pytest tests/security/test_bid_security.py -v  # bid_visibility_sealed_before_opening MUST pass
pytest tests/integration/test_rfq.py tests/integration/test_bid.py -v
```

### Step 5 → Step 6 — COMMIT:
```bash
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_10+11 — RFQ lifecycle, dual-auth bid opening, sealed bids, supplier bid form"
```

---

## PROMPT 09 — Comparative Statement, Evaluation & Award

Execute the complete implementation for `plans/plan_spec_12_comparative_statement.md`.

### Step 2 — IMPLEMENT:
1. `app/modules/evaluation/models.py`
2. `app/modules/evaluation/repository.py`
3. `app/modules/evaluation/service.py` — EvaluationService: generate_comparative_statement (validates normalized prices), shortlist_vendors, start_negotiation, submit_negotiated_price (tolerance check from settings), recommend_award (triggers approval workflow), approve_award, send_regret_letters
4. `app/modules/evaluation/pdf_generator.py` — CSPDFGenerator using reportlab; uploads to MinIO comparative-statement bucket
5. `app/modules/evaluation/router.py`
6. `app/modules/evaluation/schemas.py`

### FRONTEND WIRING:
7. Buyer Portal — `apps/buyer-portal/app/(main)/rfqs/[id]/evaluation/page.tsx` — CS table (L1 highlighted in green, all bids columns)
8. Buyer Portal — `apps/buyer-portal/app/(main)/rfqs/[id]/evaluation/negotiate/page.tsx` — negotiation form per shortlisted vendor; shows original vs negotiated price, tolerance indicator
9. Buyer Portal — `apps/buyer-portal/app/(main)/rfqs/[id]/award/page.tsx` — award recommendation form per lot/line; justification field
10. `packages/components/ComparativeStatementTable.tsx` — responsive table with L1 badge, score columns, vendor columns
11. `packages/components/NegotiationPriceInput.tsx` — input with real-time tolerance validation against backend threshold

### Step 2.5 → Step 3 → Step 4 → Step 5 → Step 6:
```bash
pytest tests/integration/test_evaluation.py -v
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_12 — CS generation, L1 discovery, negotiation, award, PDF upload, evaluation UI"
```

---

## PROMPT 10 — Contract Management

Execute the complete implementation for `plans/plan_spec_13_contract_management.md`.

### Step 2 — IMPLEMENT:
1. `app/modules/contract/fsm.py`; `app/modules/contract/repository.py`; `app/modules/contract/service.py`; `app/modules/contract/router.py`; `app/modules/contract/schemas.py`
2. `app/modules/integration/adapters/digio.py` — Digio eSign adapter
3. `app/modules/integration/adapters/docusign.py` — DocuSign eSign adapter
4. `app/tasks/contract_expiry.py` — expiry check at 90/60/30/0 days; auto-renewal at 0

### FRONTEND WIRING:
5. Buyer Portal — `apps/buyer-portal/app/(main)/contracts/page.tsx` — contract list with expiry countdown
6. Buyer Portal — `apps/buyer-portal/app/(main)/contracts/[id]/page.tsx` — detail with milestones, amendments history, eSign status
7. `packages/components/ContractExpiryCountdown.tsx` — color-coded days remaining (red < 30, yellow < 60)
8. `packages/components/MilestoneTracker.tsx` — visual milestone timeline with completion status

### Step 5 → Step 6:
```bash
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_13 — contract lifecycle, eSign integration, auto-renewal, contract UI"
```

---

## PROMPT 11 — Purchase Order & GRN

Execute the complete implementation for `plans/plan_spec_14_purchase_order.md` and the GRN/SES module (SPEC_14 references GRN).

### Step 2 — IMPLEMENT (both PO and GRN):
1. PO: fsm, repository, service, router, schemas, pdf_generator
2. GRN: `app/modules/grn/models.py`, `app/modules/grn/service.py` — create_grn, confirm_grn (triggers po.record_grn_receipt, triggers invoice eligibility, updates vendor scorecard), quality_inspection
3. `app/modules/grn/router.py`

### FRONTEND WIRING:
4. Buyer Portal — `apps/buyer-portal/app/(main)/purchase-orders/page.tsx`
5. Buyer Portal — `apps/buyer-portal/app/(main)/purchase-orders/[id]/page.tsx` — PO detail with delivery schedule, GRN history
6. Buyer Portal — `apps/buyer-portal/app/(main)/grn/new/page.tsx` — GRN creation against PO; line-level received quantity entry
7. Supplier Portal — `apps/supplier-portal/app/(main)/purchase-orders/page.tsx` — POs assigned to this vendor; acknowledge/reject actions
8. `packages/components/DeliveryScheduleTable.tsx` — line-level delivery tracking

### Step 5 → Step 6:
```bash
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_14 — PO lifecycle, GRN, 3-way match setup, PO/GRN UI"
```

---

## PROMPT 12 — Invoice, Payment & Disputes

Execute the complete implementation for `plans/plan_spec_15_invoice_payment.md`.

### Step 2 — IMPLEMENT:
1. `app/modules/invoice/service.py` — InvoiceService with 3-way match (QUANTITY_TOLERANCE hardcoded at module level, price tolerance from settings)
2. `app/modules/payment/service.py` — PaymentService with TDS deduction, business-day due date, holiday calendar
3. Routers + schemas for both
4. `app/tasks/invoice_aging.py`

### FRONTEND WIRING:
5. Buyer Portal — `apps/buyer-portal/app/(main)/invoices/page.tsx` — invoice list with match status indicators
6. Buyer Portal — `apps/buyer-portal/app/(main)/invoices/[id]/page.tsx` — 3-way match result display; discrepancy details; approve/dispute actions
7. Supplier Portal — `apps/supplier-portal/app/(main)/invoices/page.tsx` — submit invoice, track payment status
8. Supplier Portal — `apps/supplier-portal/app/(main)/invoices/new/page.tsx` — invoice submission form linked to PO
9. `packages/components/ThreeWayMatchResult.tsx` — visual match/mismatch display per line
10. `packages/components/PaymentSchedule.tsx` — payment due date with business day indicator

### Step 5 → Step 6:
```bash
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_15 — 3-way match, TDS, business-day payment scheduling, invoice/payment UI"
```

---

## PROMPT 13 — Document Management

Execute the complete implementation for `plans/plan_spec_17_document_management.md`.

### Step 2 — IMPLEMENT:
1. `app/modules/document/scanner.py` — ALLOWED_MIME_TYPES, BUCKET_MAPPING, validate_mime_type(), sanitize_filename(), scan_with_clamav()
2. `app/modules/document/service.py` — DocumentService: upload (scan async), get_presigned_url, get_version_history, soft_delete
3. `app/modules/document/router.py`
4. `app/tasks/document_scan.py` — Celery task: download → ClamAV → update status OR quarantine

### FRONTEND WIRING (shared component used by ALL modules):
5. `packages/components/DocumentUpload.tsx` — drag-and-drop upload; shows scan status (pending spinner, clean checkmark, infected alert); calls presigned URL for download; version history accordion
6. `packages/components/DocumentList.tsx` — list of documents with type badge, scan status, download button, compliance expiry date
7. Used in: VendorDocuments, BidDocuments, ContractDocuments, PODocuments, InvoiceDocuments

### Step 5 → Step 6:
```bash
pytest tests/unit/test_document_scanner.py -v  # magic bytes, path traversal, file size MUST pass
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_17 — document upload, ClamAV scan, MinIO versioning, quarantine, shared upload component"
```

---

## PROMPT 14 — Notifications

Execute the complete implementation for `plans/plan_spec_16_notification.md`.

### Step 2 — IMPLEMENT:
1. `app/modules/notification/channels/email.py` — SendGrid; settings.SENDGRID_API_KEY
2. `app/modules/notification/channels/sms.py` — MSG91; settings.MSG91_AUTH_KEY
3. `app/modules/notification/channels/inapp.py` — Redis pub/sub publish
4. `app/modules/notification/channels/whatsapp.py` — STUB only; log WARNING + return 202
5. `app/modules/notification/consumer.py` — aio-pika consumer for 4 queues
6. `app/modules/notification/websocket.py` — WebSocket endpoint + Redis subscription
7. `app/modules/notification/service.py`
8. `app/modules/notification/router.py` — 5 HTTP endpoints + WebSocket route
9. `app/tasks/notification_digest.py` — digest aggregator; NEVER digests SLA_BREACH or COMPLIANCE type
10. `scripts/seed_notification_templates.py` — ALL 20+ template types inserted to DB
11. Register WebSocket route in `app/main.py`
12. Configure Kong to pass WebSocket upgrades on `/ws/*` routes

### FRONTEND WIRING:
13. `packages/hooks/useNotifications.ts` — WebSocket hook (called ONCE in root layout)
14. `packages/stores/notificationStore.ts` — Zustand store for notifications list
15. `packages/components/NotificationBell.tsx` — badge count + dropdown; mark-as-read actions
16. `packages/components/NotificationCenter.tsx` — full notification center page
17. Add `<NotificationBell />` to `apps/buyer-portal/app/(main)/layout.tsx` header
18. Add to `apps/supplier-portal/app/(main)/layout.tsx` header

### Step 2.5 → CRITICAL CHECK:
```bash
# WebSocket must be reachable from browser
wscat -c "ws://localhost:8000/ws/notifications?token=${ACCESS_TOKEN}"
# Must receive real-time notifications when workflow tasks are created
```

### Step 5 → Step 6:
```bash
pytest tests/integration/test_notifications.py -v
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_16 — email/SMS/in-app channels, WebSocket real-time, digest, notification bell UI"
```

---

## PROMPT 15 — Integration Layer

Execute the complete implementation for `plans/plan_spec_20_integration.md`.

### Step 2 — IMPLEMENT:
1. `app/modules/integration/adapters/erp_base.py` — ERPAdapterBase ABC + ERPAdapterFactory
2. `app/modules/integration/adapters/erp_sap.py`, `erp_oracle.py`, `erp_custom.py`
3. `app/modules/integration/adapters/erp_vendor.py`, `erp_po.py`, `erp_invoice.py`, `erp_payment.py`, `erp_material.py`
4. `app/modules/integration/adapters/hrms.py` — termination handler: revoke sessions + reassign tasks
5. `app/modules/integration/adapters/gst.py` (already in SPEC_07 but finalize here)
6. `app/modules/integration/adapters/gem.py` — GEM portal async sync
7. `app/modules/integration/http_client.py` — SafeHTTPClient with SSRF allowlist from tenant_settings
8. `app/modules/integration/job_processor.py` — retry with settings.INTEGRATION_RETRY_DELAYS_SECONDS (7 steps)
9. `app/modules/integration/webhook.py` — HMAC-SHA256 signed delivery
10. `app/tasks/integration_jobs.py` — Celery task: process due jobs every 60s

### FRONTEND WIRING (Admin Portal):
11. Admin Portal — `apps/admin-portal/app/(main)/integrations/page.tsx` — integration job list with status, retry count, last error
12. Admin Portal — `apps/admin-portal/app/(main)/integrations/[id]/page.tsx` — job detail; manual retry button
13. Admin Portal — `apps/admin-portal/app/(main)/integrations/settings/page.tsx` — ERP config form; allowed domains list

### Step 5 → Step 6:
```bash
pytest tests/unit/test_ssrf_prevention.py tests/integration/test_integration_jobs.py -v
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_20 — ERP adapters, HRMS sync, SSRF prevention, webhook delivery, integration admin UI"
```

---

## PROMPT 16 — Analytics & Reporting

Execute the complete implementation for `plans/plan_spec_25_analytics.md`.

### MANDATORY PRE-FLIGHT:
```bash
# Verify analytics DB read replica configured
grep "ANALYTICS_DATABASE_URL" .env.example  # Must exist
# If not, add ANALYTICS_DATABASE_URL=postgresql+asyncpg://... to config.py and .env.example first
```

### Step 2 — IMPLEMENT:
1. `app/modules/analytics/service.py` — get_spend_summary, get_procurement_kpis, get_vendor_performance, get_unmapped_pr_analytics, get_savings_analysis, get_cycle_time_analysis
2. `app/modules/analytics/export_service.py` — CSV streaming + Excel (openpyxl, max 100k rows)
3. `app/modules/analytics/router.py` — 12 endpoints; all scoped by user BU claims
4. `app/tasks/analytics_refresh.py` — 15-min cache warm-up for all active orgs
5. `app/tasks/scheduled_reports.py` — daily/weekly/monthly scheduled reports

### FRONTEND WIRING:
6. Buyer Portal — `apps/buyer-portal/app/(main)/analytics/page.tsx` — KPI dashboard cards (cycle time, savings %, compliance rate, on-time delivery)
7. Buyer Portal — `apps/buyer-portal/app/(main)/analytics/spend/page.tsx` — spend by category bar chart (recharts), by vendor treemap, by BU pie
8. Buyer Portal — `apps/buyer-portal/app/(main)/analytics/vendors/page.tsx` — vendor scorecard comparison table
9. Admin Portal — `apps/admin-portal/app/(main)/analytics/page.tsx` — org-wide analytics (unscoped)
10. `packages/components/KPICard.tsx` — number + trend arrow + sparkline
11. `packages/components/SpendChart.tsx` — recharts BarChart with drill-down
12. Export buttons on ALL analytics pages: CSV (streaming) and Excel

### Step 2.5 → Step 3 → Step 4:
```bash
pytest tests/integration/test_analytics.py -v
# MUST PASS: bu_scoped_user_cannot_see_other_bu_data, cost_of_capital_uses_org_rate
```

### Step 5 → Step 6:
```bash
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_25 — spend analytics, KPI dashboard, savings analysis, vendor scorecard, export"
```

---

## PROMPT 17 — Infrastructure & Kubernetes

Execute the complete implementation for `plans/plan_spec_21_infrastructure.md`.

### Step 2 — IMPLEMENT:
1. `k8s/base/namespaces.yaml`, `k8s/base/api-deployment.yaml`, `k8s/base/celery-deployment.yaml`
2. `k8s/base/hpa.yaml` (API: 3-15 replicas; Celery: 2-10)
3. `k8s/base/pdbs.yaml` — minAvailable: 2 for API, 1 for Celery
4. `k8s/base/netpolicies.yaml` — deny-all + selective allow (Kong→API, API→DB/Redis/RMQ/MinIO)
5. `k8s/base/postgresql/`, `k8s/base/redis/`, `k8s/base/rabbitmq/`, `k8s/base/minio/`, `k8s/base/elasticsearch/`
6. `k8s/base/pgbouncer/`
7. `k8s/base/kong/` — Kong Ingress + configmap for kong.yml
8. `k8s/base/cert-manager/` — Let's Encrypt ClusterIssuer
9. `k8s/overlays/dev/`, `k8s/overlays/staging/`, `k8s/overlays/production/`, `k8s/overlays/dr/`
10. `k8s/base/velero/` — backup schedule (daily, 30-day retention)
11. `k8s/base/sealed-secrets/` — SealedSecret objects for all secrets

### FRONTEND DEPLOYMENT (add to K3s):
12. `k8s/base/buyer-portal-deployment.yaml` — Next.js standalone deployment
13. `k8s/base/supplier-portal-deployment.yaml`
14. `k8s/base/admin-portal-deployment.yaml`
15. `k8s/base/frontend-services.yaml` — ClusterIP services for all 3 portals
16. Add Kong routes for `apps.procurement.com`, `supplier.procurement.com`, `admin.procurement.com`

### Step 3 — Validate:
```bash
kubectl --dry-run=client apply -k k8s/overlays/dev/
kubeval k8s/base/*.yaml
kubectl apply -k k8s/overlays/dev/
kubectl rollout status deployment/procurement-api -n procurement
curl https://api.procurement.dev/health/ready
```

### Step 6 — COMMIT:
```bash
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_21 — K3s manifests, HPA, PDB, network policies, frontend K8s deployment"
```

---

## PROMPT 18 — Observability, Monitoring & Logging

Execute the complete implementation for `plans/plan_spec_22_observability.md`.

### Step 2 — IMPLEMENT:
1. `app/core/metrics.py` — ALL 12 custom Prometheus metrics
2. Update `app/core/middleware.py` TimingMiddleware to increment metrics
3. Update all service files to increment business metrics (pr_created_total, rfq_published_total, etc.)
4. `k8s/monitoring/prometheus/rules.yaml` — ALL 15 alert rules
5. `k8s/monitoring/alertmanager/config.yaml` — CRITICAL→PagerDuty, WARNING→OpsGenie routing
6. `k8s/monitoring/grafana/dashboards/` — 7 dashboard JSON files (provisioned via ConfigMap)
7. `k8s/logging/promtail-config.yaml` — JSON parse + drop health logs
8. `app/modules/audit/search_service.py` — Elasticsearch audit search
9. `k8s/base/elasticsearch/` — K8s manifests + ILM policy for monthly index rotation
10. Update `app/modules/audit/service.py` to also call search_service.index_audit_log()

### FRONTEND WIRING (Admin Portal):
11. Admin Portal — `apps/admin-portal/app/(main)/audit-trail/page.tsx` — Elasticsearch-backed audit search with date range, entity type, action, actor filters
12. Admin Portal — `apps/admin-portal/app/(main)/system/health/page.tsx` — live system health dashboard (polls /health/ready)

### Step 5 → Step 6:
```bash
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_22 — Prometheus metrics, Grafana dashboards, Loki/Promtail, Elasticsearch audit search, alert rules"
```

---

## PROMPT 19 — Testing Strategy (Comprehensive Test Suite)

Execute the complete implementation for `plans/plan_spec_23_testing.md`.

### Step 2 — IMPLEMENT:
1. `tests/conftest.py` — all global fixtures (db, org, buyer_user, supplier_user, auth_headers)
2. `tests/factories/` — all factory classes (NO hardcoded UUIDs anywhere)
3. `tests/security/test_owasp.py` — ALL OWASP Top 10 tests
4. `tests/performance/k6_baselines.js` — 7 scenarios with p95<500ms, p99<1000ms thresholds
5. `tests/workflow/test_all_templates.py` — parametrized test for all 10 workflow templates
6. `tests/e2e/playwright/` — Playwright tests for critical buyer/supplier flows
7. Fill in ALL test stubs from plans 01-25 that are not yet implemented

### Step 3 — RUN FULL SUITE:
```bash
pytest tests/ -v --cov=app --cov-report=html --cov-fail-under=80
# MUST achieve >= 80% coverage
# MUST have 0 failures in security tests
pnpm test --all-projects  # Frontend unit tests
# Run k6 performance tests on staging
ENABLE_PERF_TESTS=1 k6 run tests/performance/k6_baselines.js
```

### Step 6 — COMMIT:
```bash
git add -A && git commit -m "[NON-BREAKING] test: SPEC_23 — complete test suite, 80%+ coverage, OWASP security, k6 performance, E2E Playwright"
```

---

## PROMPT 20 — API Standards Retrofit (Apply Across All Modules)

Execute `plans/plan_spec_18_api_design.md`. This retrofits API standards to all existing modules.

### Step 2 — IMPLEMENT:
1. Verify `app/core/responses.py`, `app/core/pagination.py`, `app/core/filters.py`, `app/core/streaming.py`, `app/core/deprecation.py` are fully implemented
2. Audit ALL 24 module routers — every list endpoint must use APIResponse envelope + PaginationMeta
3. Audit ALL error responses — must use error envelope with trace_id
4. Add `X-Idempotency-Key` support to ALL POST endpoints that create resources
5. Add streaming CSV/PDF export endpoints to: requisitions, rfqs, vendors, invoices, analytics modules
6. Verify OpenAPI tags applied to all routers (one tag per module)
7. Run `pnpm generate:types` — fix any TypeScript type errors in frontend caused by API changes

### CRITICAL: If any router does not return the envelope format:
```bash
# Fix the router; update the frontend hook for that module; regenerate types; fix type errors
# This is a BREAKING change if external consumers exist → version the endpoint
```

### Step 6 — COMMIT:
```bash
git add -A && git commit -m "[NON-BREAKING] refactor: SPEC_18 — API standards retrofit, envelope consistency, idempotency keys, CSV exports, TypeScript types regenerated"
```

---

## PROMPT 21 — Final Frontend Polish & Cross-Portal Integration

Execute final frontend integration pass from `plans/plan_spec_19_frontend.md`.

### Step 2 — IMPLEMENT (final integration items):
1. Run `pnpm generate:types` — ensure types are current with ALL backend APIs
2. Audit every form in all 3 portals — Zod schema must match backend Pydantic schema field names exactly
3. Audit every list component — must use `response.data.data` (not `response.data`)
4. Add missing `<PermissionGuard>` wrappers on ALL action buttons
5. Implement missing supplier portal pages: invoice submission, PO acknowledgement
6. PWA manifest for buyer portal
7. Error boundaries on all pages
8. `packages/ui/` — complete Radix UI component library: Button, Input, Select, Dialog, Table, Badge, Toast, Tabs, Card, Skeleton
9. i18n stub with `next-intl`; all string literals extracted to `en.json`
10. Mobile responsiveness audit — all pages usable on 768px+ viewport

### FULL INTEGRATION TEST:
```bash
# E2E: Complete procurement cycle (PR → RFQ → Bid → CS → PO → Invoice → Payment)
npx playwright test tests/e2e/full_procurement_cycle.spec.ts --headed
# Must complete without errors across buyer + supplier portals
```

### Step 6 — COMMIT:
```bash
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_19 — frontend polish, permission guards, mobile responsive, complete supplier portal, E2E verified"
```

---

## PROMPT 22 — FINAL: System Integration & Regression

This is the final session. Run complete system verification across all 25 modules.

### Full Regression Suite:
```bash
# 1. Fresh environment
docker-compose down -v
docker-compose up -d
sleep 30  # Wait for all services

# 2. Full setup
alembic upgrade head
python scripts/rabbitmq_setup.py
python scripts/minio_setup.py
python scripts/generate_rsa_keys.py
python scripts/seed_master_data.py
python scripts/seed_workflows.py
python scripts/seed_notification_templates.py
python scripts/create_superadmin.py

# 3. Full test suite
pytest tests/ -v --cov=app --cov-report=xml --cov-fail-under=80
pnpm test --all-projects

# 4. Security scan
bandit -r app/ -f json -o reports/bandit_report.json
safety check --full-report
trivy image procurement-api:latest

# 5. Performance baseline
k6 run tests/performance/k6_baselines.js --out json=reports/k6_results.json
# All thresholds must pass: p95<500ms, p99<1000ms, errors<1%

# 6. E2E complete cycle
npx playwright test --reporter=html

# 7. Graphify final check
graphify check --integrity
graphify check --no-broken-links
```

### Final README Update:
```markdown
## Current Session State
**Status:** ALL 25 MODULES COMPLETE AND VERIFIED
**Migration Head:** 0027_data_seed
**Test Coverage:** XX% (>= 80%)
**Performance:** p95=XXXms, p99=XXXms (all SLOs met)
**Security:** 0 high/critical findings
**Frontend:** All 3 portals deployed, E2E verified
**Next:** Production deployment → k8s/overlays/production/
```

### Final Commit:
```bash
git add -A && git commit -m "[NON-BREAKING] chore: ALL 25 SPECS IMPLEMENTED — full regression green, coverage >80%, perf SLOs met, E2E verified"
git tag v1.0.0-mvp
git push origin main --tags
```

---

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
