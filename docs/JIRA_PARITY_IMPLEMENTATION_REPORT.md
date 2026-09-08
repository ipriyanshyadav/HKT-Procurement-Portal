# 📋 Jira Parity & Automation Engine Implementation Report

**Date:** 2026-09-08  
**Module:** Module 26 — Ticket System & Jira Parity Engine  
**Author:** Antigravity AI Engineering  
**Status:** Complete (Phase 1)  

---

## 1. Executive Summary

This report documents the architectural design, backend engine, database migrations, and frontend integration that bring **Jira Software & Jira Service Management parity** to the Enterprise S2P Procurement Portal's ticket and query system.

Prior to this implementation, the ticket system supported basic ticket creation, status transitions, comments, attachments, SLA computation, and manual assignment. With this release, the ticket system delivers Jira-grade enterprise capabilities:
1. **Due Dates & SLA Warnings:** Calendar due date tracking with automated 24-hour approaching alerts and overdue visual indicators.
2. **Bidirectional Issue Linking:** Native Jira-style linking (`BLOCKS`, `IS_BLOCKED_BY`, `RELATES_TO`, `DUPLICATES`, `IS_DUPLICATED_BY`, `CLONES`, `IS_CLONED_BY`) with bidirectional relationship inversion.
3. **Custom Fields (EAV Schema):** Configurable metadata schema supporting `TEXT`, `NUMBER`, `DATE`, `SELECT`, `MULTI_SELECT`, and `BOOLEAN` types.
4. **Event-Driven Automation Engine:** Trigger-Condition-Action automation engine executing on ticket creation, status transitions, field modifications, and SLA breaches.
5. **Intelligent Auto-Assignment:**
   - **Atomic Round-Robin:** Distributed, thread-safe assignee rotation powered by Redis atomic `INCR` operations.
   - **Balanced Workload Assignment:** Live query-driven assignment selecting the team member with the fewest open tickets.
6. **Dedicated Admin Consoles:** Full-featured UI studios in the Admin Portal for managing Automation Rules and Custom Fields definitions, plus embedded panels in Buyer and Admin ticket details.

---

## 2. Feature Parity Matrix

| Feature | Jira Software / JSM | Procurement Portal (Before) | Procurement Portal (Now) | Implementation Component |
| :--- | :--- | :--- | :--- | :--- |
| **Due Date** | Native issue due date with countdown | ❌ Missing | ✅ **Fully Supported** | `tickets.due_date`, `check_ticket_due_dates`, `TicketCard.tsx` |
| **Issue Linking** | Bidirectional blocks, relates, duplicates | ❌ Missing | ✅ **Fully Supported** | `ticket_links`, `TicketLinkedIssues.tsx`, `TicketService.create_link` |
| **Custom Fields** | Dynamic custom field schemas & screens | ❌ Missing | ✅ **Fully Supported** | `ticket_custom_field_defs`, `TicketCustomFieldsPanel.tsx` |
| **Automation Rules** | Jira Automation (When / If / Then) | ❌ Missing | ✅ **Fully Supported** | `ticket_automation_rules`, `TicketAutomationEngine` |
| **Round-Robin Assignment**| Jira Service Management auto-assign | ❌ Manual only | ✅ **Atomic Redis INCR** | `automation_engine.py:assign_round_robin` |
| **Balanced Assignment** | Workload-balanced queue distribution | ❌ Manual only | ✅ **DB Workload Query** | `repository.py:count_open_tickets_by_users` |
| **RBAC Controls** | Jira project permissions | Basic roles | ✅ **Granular Permissions** | `ticket.link`, `ticket.config_custom_fields`, `ticket.config_automation` |

---

## 3. Architecture & Technical Design

### 3.1 Architecture Overview

```
                      ┌───────────────────────────────────────────┐
                      │            Next.js 14 Frontends           │
                      │  - Buyer Portal Ticket Details            │
                      │  - Admin Portal Details & Config Studios  │
                      └─────────────────────┬─────────────────────┘
                                            │ HTTP / JSON
                                            ▼
                      ┌───────────────────────────────────────────┐
                      │              FastAPI Router               │
                      │     app/modules/ticket/router.py          │
                      └─────────────────────┬─────────────────────┘
                                            │
                                            ▼
                      ┌───────────────────────────────────────────┐
                      │            TicketService Layer            │
                      │     app/modules/ticket/service.py         │
                      └──────────────┬──────────────────┬─────────┘
                                     │                  │
                ┌────────────────────┴──────┐   ┌───────┴─────────────────┐
                ▼                           ▼   ▼                         ▼
  ┌───────────────────────────┐ ┌──────────────────────┐   ┌──────────────────────────┐
  │   TicketAutomationEngine  │ │   TicketRepository   │   │  Celery Background Tasks │
  │   - Condition Evaluator   │ │   - Open Workload DB │   │  - Approaching Due Dates │
  │   - Redis INCR Round-Robin│ │   - Inverted Links   │   │  - SLA Escalation Checks │
  └─────────────┬─────────────┘ └───────────┬──────────┘   └─────────────┬────────────┘
                │                           │                            │
                ▼                           ▼                            ▼
  ┌───────────────────────────┐ ┌──────────────────────┐   ┌──────────────────────────┐
  │   Redis 7 (Cache & RR)    │ │ PostgreSQL 16 (DB)   │   │    RabbitMQ (Events)     │
  └───────────────────────────┘ └──────────────────────┘   └──────────────────────────┘
```

### 3.2 Bidirectional Issue Linking Inversion Mechanics

To eliminate redundant database records and maintain referential integrity:
- A single record in `ticket_links` stores `(source_ticket_id, target_ticket_id, link_type)`.
- When retrieving links for a ticket `T`, the repository queries:
  1. **Outgoing links:** `source_ticket_id = T` (preserves stored `link_type`, e.g. `BLOCKS`).
  2. **Incoming links:** `target_ticket_id = T` (automatically inverts the relationship using reciprocal pairing).
- **Inverse Mapping Table:**
  - `BLOCKS` $\longleftrightarrow$ `IS_BLOCKED_BY`
  - `DUPLICATES` $\longleftrightarrow$ `IS_DUPLICATED_BY`
  - `CLONES` $\longleftrightarrow$ `IS_CLONED_BY`
  - `RELATES_TO` $\longleftrightarrow$ `RELATES_TO` (symmetric)

### 3.3 Atomic Round-Robin Assignment Rotation

To guarantee strictly fair and deterministic round-robin assignment across distributed Celery workers and API worker processes without table locking:
1. Each automation rule maintains a Redis key: `automation:rr:{rule_id}`.
2. An atomic `INCR` is executed on Redis: `counter = await redis.incr(key)`.
3. The assigned user index is calculated via modulo: `assigned_idx = (counter - 1) % len(candidate_user_ids)`.
4. The ticket is immediately updated and assigned to `candidate_user_ids[assigned_idx]`.

### 3.4 Balanced Workload Auto-Assignment

When `ASSIGN_BALANCED` is selected:
1. The engine queries the database via `TicketRepository.count_open_tickets_by_users(db, org_id, candidate_user_ids)`.
2. The query aggregates tickets where `status IN ('OPEN', 'IN_PROGRESS', 'PENDING_RESPONSE')` grouped by `assigned_to`.
3. Users with zero open tickets default to count `0`.
4. The user with the minimum open count is chosen. Ties are deterministically broken using user ID sorting.

---

## 4. Database Migrations

### Migration `0038_ticket_jira_schema.py`
- **`tickets.due_date`**: Nullable `DATE` column with B-tree index.
- **`ticket_links`**: Table with foreign keys to `tickets(id)` with `ONDELETE CASCADE` and unique constraint `uq_ticket_link_pair (source_ticket_id, target_ticket_id, link_type)`.
- **`ticket_custom_field_defs`**: Table storing field definitions (`name`, `field_key`, `field_type`, `options`, `is_required`, `default_value`, `applies_to_ticket_types`).
- **`ticket_custom_field_values`**: EAV storage table with columns `value_text`, `value_number`, `value_json` and compound index on `(ticket_id, field_def_id)`.
- **`ticket_automation_rules`**: Table storing automation rules (`trigger_type`, `trigger_config`, `conditions`, `actions`, `execution_count`, `last_executed_at`, `is_enabled`).
- **Reversibility:** Fully verified `downgrade()` dropping all tables, columns, and enums cleanly.

### Migration `0039_ticket_jira_permissions.py`
- Seeds permission codes:
  - `ticket.link`: Allows linking tickets and managing relationships.
  - `ticket.config_custom_fields`: Allows defining tenant-wide custom fields.
  - `ticket.config_automation`: Allows creating, toggling, and running automation rules.
- Automatically assigns permissions to standard roles (`SUPERADMIN`, `ORG_ADMIN`, `PROCUREMENT_ADMIN`, `BUYER`, etc.).

---

## 5. API Endpoints

| Method | Path | Description | Required Permission |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/tickets/{id}/links` | List all linked issues (bidirectionally resolved) | `ticket.read` |
| `POST` | `/api/v1/tickets/{id}/links` | Create a new ticket link | `ticket.link` |
| `DELETE` | `/api/v1/tickets/{id}/links/{link_id}` | Remove a ticket link | `ticket.link` |
| `GET` | `/api/v1/tickets/custom-fields/definitions` | List custom field definitions | `ticket.read` |
| `POST` | `/api/v1/tickets/custom-fields/definitions` | Create a custom field definition | `ticket.config_custom_fields` |
| `PUT` | `/api/v1/tickets/custom-fields/definitions/{id}` | Update custom field definition | `ticket.config_custom_fields` |
| `DELETE` | `/api/v1/tickets/custom-fields/definitions/{id}` | Delete custom field definition | `ticket.config_custom_fields` |
| `GET` | `/api/v1/tickets/{id}/custom-fields` | Get custom field values for ticket | `ticket.read` |
| `GET` | `/api/v1/tickets/automation/rules` | List tenant automation rules | `ticket.config_automation` |
| `POST` | `/api/v1/tickets/automation/rules` | Create an automation rule | `ticket.config_automation` |
| `PUT` | `/api/v1/tickets/automation/rules/{id}` | Update or toggle automation rule | `ticket.config_automation` |
| `DELETE` | `/api/v1/tickets/automation/rules/{id}` | Delete automation rule | `ticket.config_automation` |
| `POST` | `/api/v1/tickets/automation/rules/{id}/run/{ticket_id}` | Simulate/execute rule on ticket | `ticket.config_automation` |

---

## 6. Frontend Components & User Interface

### 6.1 Shared UI Components (`packages/ui`)
- **`TicketCard.tsx`**: Updated to display calendar icon with formatted due date and red `OVERDUE` badge for overdue tickets.
- **`TicketLinkedIssues.tsx`**: Jira-style issue linking panel displaying related tickets, status pills, reciprocal link badges, link creation modal, and unlink action.
- **`TicketCustomFieldsPanel.tsx`**: Clean key-value grid presenting custom field values (text, numbers, date badges, tags for multi-select, booleans).

### 6.2 Portal Detail Pages
- **Buyer Portal** (`apps/buyer-portal/app/(main)/tickets/[id]/page.tsx`):
  - Embedded `TicketLinkedIssues` and `TicketCustomFieldsPanel` in the primary activity pane.
  - Due Date property rendered in the metadata sidebar.
- **Admin Portal** (`apps/admin-portal/app/(main)/tickets/[id]/page.tsx`):
  - Embedded `TicketLinkedIssues` and `TicketCustomFieldsPanel`.
  - Due Date property with real-time overdue detection in metadata sidebar.

### 6.3 Dedicated Admin Configuration Consoles
- **Automation Rules Studio** (`apps/admin-portal/app/(main)/tickets/automation/page.tsx`):
  - Rule listing with trigger badges, condition summaries, and action summaries.
  - Active/Disabled quick toggle.
  - Execution counter and last-executed timestamp display.
  - Interactive "Test Run" modal to execute rules against any ticket ID with full JSON execution logs.
  - Rule creation modal with trigger dropdown, condition filters, and action selectors (Round-Robin, Balanced Workload, Status Transitions, Due Date Offsets).
- **Custom Fields Studio** (`apps/admin-portal/app/(main)/tickets/custom-fields/page.tsx`):
  - Definition table displaying field name, key slug, type badge, option pills, and required flags.
  - Field creation modal supporting all 6 data types and comma-separated option parsing.

---

## 7. Verification & Quality Assurance

### 7.1 Automated Unit Tests
- Test file: `tests/unit/test_ticket_jira_features.py`
- Test suite execution:
  ```bash
  .venv/bin/pytest tests/unit/ -v
  # Result: 431 passed, 0 failed
  ```
- **Coverage Highlights:**
  - `test_ticket_creation_with_due_date`: Verifies due date persistence and formatting.
  - `test_ticket_update_due_date`: Verifies due date updates via PATCH/PUT.
  - `test_create_ticket_link_success`: Verifies link creation and relationship persistence.
  - `test_create_ticket_link_self_fails`: Verifies self-linking prevention (`ValidationError`).
  - `test_get_ticket_links_bidirectional`: Verifies relationship inversion from both source and target perspectives.
  - `test_create_custom_field_def`: Verifies definition validation and unique slug creation.
  - `test_create_ticket_with_custom_fields`: Verifies EAV value persistence.
  - `test_automation_engine_round_robin_assignment`: Verifies atomic Redis round-robin assignment rotation.
  - `test_automation_engine_balanced_workload_assignment`: Verifies assignment to candidate with fewest open tickets.
  - `test_automation_engine_condition_mismatch_skips`: Verifies rule conditions guard action execution.

### 7.2 Frontend Type Checking
- Turborepo workspace typecheck:
  ```bash
  cd procurement-portal-frontend && pnpm run typecheck
  # Result: 7/7 workspaces successful (0 errors)
  ```

### 7.3 Knowledge Graph Sync
- Knowledge graph updated via AST analysis:
  ```bash
  graphify update .
  # Result: 8,216 nodes, 21,010 edges across 514 communities
  ```

---

## 8. SPEC Audit Coverage Summary

```
MODULE | REQUIREMENT | STATUS | ARTIFACT / CODE
26.1 | Due Date field & Approaching Alerts | [DONE] | app/modules/ticket/models.py, app/tasks/ticket_sla.py, TicketCard.tsx
26.2 | Bidirectional Issue Linking | [DONE] | TicketLink, TicketLinkedIssues.tsx, router.py
26.3 | Custom Fields (EAV) | [DONE] | TicketCustomFieldDef/Value, TicketCustomFieldsPanel.tsx, admin-portal/custom-fields
26.4 | Automation Rules Engine | [DONE] | TicketAutomationEngine, automation_engine.py, admin-portal/automation
26.5 | Round-Robin Auto-Assignment (Redis INCR) | [DONE] | automation_engine.py, test_ticket_jira_features.py
26.6 | Balanced Workload Auto-Assignment | [DONE] | repository.py, automation_engine.py
26.7 | RBAC Permissions (link, config_fields, config_automation) | [DONE] | 0039_ticket_jira_permissions.py, router.py
OVERALL: 7/7 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```

---

## 9. Next Steps (Optional Phase 2 Enhancements)

While Phase 1 satisfies complete feature parity with Jira Software and Jira Service Management core features, optional Phase 2 enhancements may include:
1. **Kanban Swimlanes:** Grouping Kanban board tickets by Assignee, Priority, or Epic Custom Field.
2. **JQL Query Parser:** Text-based search syntax (e.g. `status = OPEN AND priority in (HIGH, CRITICAL) AND due <= 3d`).
3. **Sprint & Release Planning:** Organizing procurement tickets and RFQ inquiries into time-boxed sprints.
