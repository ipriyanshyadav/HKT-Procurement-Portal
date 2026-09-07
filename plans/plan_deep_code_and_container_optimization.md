# Implementation Plan: Deep Code Analysis, Bug Fixes, Performance & Container Optimizations

## 1. Context & Scope
This plan guides the execution of system-wide container optimizations, performance enhancements, bug fixes, and strict alignment with `GEMINI.md` project rules across the S2P Procurement Portal.

### Scope:
1. **Container Hardening & Reliability**:
   - `docker/docker-compose.yml`: Eliminate command/volume conflicts, declare persistent volumes, establish proper healthcheck dependencies.
   - `docker/Dockerfile.api`: Configure unprivileged non-root execution and healthcheck utilities.
   - `docker/entrypoint.sh`: Ensure deterministic database migration, topology setup, and conditional complete seed data initialization.
   - Frontend container builds: Ensure `.dockerignore` prevents build context explosion, and Next.js standalone runner executes securely as non-root `nextjs:nodejs`.
2. **Absolute Rule Compliance (GEMINI.md: No Hardcoded Data & Layer Discipline)**:
   - Eliminate hardcoded role strings across models, schemas, and scheduled tasks using `RoleCode` constant enum.
   - Configurable settings via Pydantic `Settings` for all business limits, thresholds, tolerances, and Celery beat schedules.
   - Verify strict layer discipline (`router → service → repository → model`).
3. **High-Impact Performance Optimizations**:
   - Eliminate N+1 query loops in batch operations and PDF generation.
   - Celery worker async loop reuse (`app.tasks.async_runner.run_async`) to prevent loop and connection pool thrashing.
   - Cache external client singletons (e.g. MinIO health check).
   - Prometheus label cardinality defense against raw dynamic path parameters.
4. **Security & Data Integrity**:
   - Enforce authenticated JWT verification on reverse auction WebSockets and attribute bids to verified caller identities.
   - Memory leak prevention in connection managers.

---

## 2. Assumptions Log
| ID | Module / Area | Assumption | Rationale | Risk | Owner |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A-OPT-1** | Celery Tasks | Celery workers execute sync task entrypoints that invoke async database and publisher operations; reusing a process-level event loop is safe and significantly reduces loop setup overhead. | Avoids recreating asyncio event loops on 10s/30s/60s intervals. | Low | Backend Team |
| **A-OPT-2** | Docker Containers | Frontend Next.js applications run with `output: "standalone"` and can be executed with Node runtime without full root system privileges. | Standard production security practice (Least Privilege). | Low | DevOps Team |
| **A-OPT-3** | Evaluation Service | Comparative statement generation requires vendor legal business names for all ranked lines; batch querying `select(Vendor).where(Vendor.id.in_(...))` preserves identical output without N queries. | N+1 query elimination reduces DB roundtrips from O(N) to O(1). | Low | Sourcing Team |
| **A-OPT-4** | Live Auction WS | Reverse auction ticker counter-bids must originate from the authenticated user token provided on connection. | Prevents anonymous or spoofed counter-bids in competitive live reverse auctions. | Medium | Security Team |
| **A-OPT-5** | Observability | Unmatched or dynamic route paths should normalize UUIDs to `{id}` in Prometheus labels. | Prevents high cardinality in time-series database. | Low | Platform Team |

---

## 3. Implementation Steps
1. **Step 1 — Role Constants & Settings Enforcement**:
   - Replace remaining `"BUYER"` in `app/modules/contract/schemas.py` with `RoleCode.BUYER.value`.
   - Replace `"PROCUREMENT_HEAD"` in `app/tasks/unmapped_pr_sla.py` and `app/tasks/scheduled_reports.py` with `RoleCode.PROCUREMENT_HEAD.value`.
   - Add non-root `appuser` configuration to `docker/Dockerfile.api`.
2. **Step 2 — SPEC Audit**:
   - Audit requirements across Container Stack, Security, GEMINI.md Absolute Rules, and Performance.
3. **Step 3 — Three Personas Testing**:
   - *User Persona*: Test reverse auction room creation, counter-bid validation, and report generation.
   - *Developer Persona*: Automated unit and task test suites (`pytest tests/unit/`).
   - *QA Persona*: Validate container configs, boundary tolerances, and concurrency.
4. **Step 4 — Regression Verification**:
   - Run full unit tests and frontend typechecks.
5. **Step 5 — Graphify & Documentation Update**:
   - Run `graphify update .` and update `README.md` Session State.
6. **Step 6 — Git Commit**:
   - Commit changes with `[NON-BREAKING]` tag.
