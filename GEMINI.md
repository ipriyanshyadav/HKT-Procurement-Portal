# GEMINI.md — Project Rules & AI Onboarding

## SESSION BOOTSTRAP (strict order)

- **0-A** Read `GEMINI.md` top to bottom.
- **0-B** Load Graphify graph.
- **0-C** Read `README.md` — note completed modules, migration head, last verified test commands.
- **0-D** Read the SPEC for the module in scope.
- **0-E** If resuming: read `## Current Session State` in README first.

---

## ABSOLUTE RULES

**NO HARDCODED DATA.** URLs, timeouts, limits, thresholds, role names → Pydantic Settings or env vars. No magic numbers in logic. No hardcoded UUIDs/org IDs in tests — use `uuid4()` or factory functions. Each test owns its own isolated data.

**NO DEAD CODE.** No `print()`/`console.log()`, no commented-out blocks, no `TODO` without a ticket number (`# TODO #142`). Pre-commit hook enforces this.

**LAYER DISCIPLINE.** `router → service → repository → model`. No layer skipping. No upward imports. No cross-module imports below service boundary.

---

## IMPLEMENTATION LOOP

**1 — Plan.** Log every SPEC ambiguity as `ASSUMPTION [A-{module}-{N}]`: what was assumed, why, risk, owner. No coding before assumptions are logged.

**2 — Implement.**

**2.5 — SPEC AUDIT.** Re-read every requirement. Mark each `DONE / PARTIAL / MISSING`. Produce a coverage report committed with the code:
```
MODULE | SPEC | DATE
1.1 [DONE] → service.py   1.2 [PARTIAL] → role missing #N
OVERALL: 14/17 (82%) | BACKEND 95% | FRONTEND 78% | TESTS 88%
```
`MISSING` items block Step 3.

**3 — Test (three personas).**
- *User:* happy path + edge cases.
- *Developer:* automated suite.
- *QA:* new-user flow with no docs, 500+ row volume, concurrent users, all role combos, boundary values, full end-to-end workflow, audit trail, cross-user step integrity.

**4 — Integrate + regression.**

**5 — Graphify update.** For every node added/modified/deprecated: update the README section for that module before Step 6.

**6 — README update → commit.**

---

## PROTOCOL: API CONTRACT CHANGES

Grep all consumers on any schema/endpoint change. Update all in the same commit. Version endpoint if backward-incompatible. Flag commit `[BREAKING]` or `[NON-BREAKING]`. Run regression across all affected modules.

---

## PROTOCOL: MIGRATION SAFETY

`downgrade()` must fully reverse `upgrade()`. No table locks on large tables — use `CONCURRENTLY` for indexes. Schema and data migrations are separate files. No Python application code inside migrations.

---

## PROTOCOL: ROLLBACK

On integration failure: `git revert` (no reset) → `graphify diff` → restore graph + README → full regression → re-enter loop at Step 1.

---

## PROTOCOL: CONTEXT CHECKPOINT

Before each new step in a session with 2+ completed steps: write a ≤10-line state summary to `## Current Session State` in README (planned / implemented / tested / next). Written for the next AI session, not humans.

---

## BUG FIX

Loop Step 5 references UX Audit as **Part 16**, not Part 17. Part 17 = Performance Baseline.
