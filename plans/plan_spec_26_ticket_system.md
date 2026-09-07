# IMPLEMENTATION PLAN — SPEC_26: Ticket & Query Management System
**Module:** 26 | **Phase:** Core | **Squad:** E
**Spec File:** SPEC_26_TICKET_SYSTEM.md | **Plan Date:** 2026-08-04

---
## SESSION BOOTSTRAP CHECKLIST
- [x] 0-A: GEMINI.md read top-to-bottom
- [x] 0-B: Graphify loaded — confirm SPEC_16 notification nodes, SPEC_17 document nodes exist
- [x] 0-C: README — auth module, WebSocket, document service, notification consumer all complete
- [x] 0-D: SPEC_26 fully analyzed (20 sections, 7 tables, 12 permissions, 30+ endpoint groups)
- [x] 0-E: Check README Current Session State before resuming

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S26-01 | 7 DB tables (tickets, comments, attachments, watchers, activity_log, sla_config) | migrations 0028-0034 + models.py | PLANNED |
| S26-02 | 3 ENUMs (ticket_type 8 values, ticket_priority 4, ticket_status 7) | Migration 0028 | PLANNED |
| S26-03 | Ticket number TKT-{ORG}-{YYYY}-{NNNNNN} per-org per-year sequence | ticket/service.py | PLANNED |
| S26-04 | 7-state FSM with 10 legal transitions | ticket/fsm.py | PLANNED |
| S26-05 | SLA config per priority (first_response/resolution/escalation hours) | ticket/sla_service.py | PLANNED |
| S26-06 | Entity linking (8 entity types — advisory soft FK) | ticket/service.py | PLANNED |
| S26-07 | 12 permission codes + role assignments seed | ticket/permissions.py + migration 0034 | PLANNED |
| S26-08 | Visibility rules (buyer/supplier/admin + is_private + is_internal) | ticket/service.py SQL-level | PLANNED |
| S26-09 | @mention parse/resolve + auto-watcher add | ticket/mention_parser.py | PLANNED |
| S26-10 | Internal notes hidden from suppliers at query level | ticket/service.py | PLANNED |
| S26-11 | Markdown in comments (react-markdown client-side) | Frontend components | PLANNED |
| S26-12 | 15-minute comment edit window | ticket/service.py | PLANNED |
| S26-13 | 30+ API endpoints (CRUD + 8 transitions + search + config) | ticket/router.py | PLANNED |
| S26-14 | procurement.ticket RabbitMQ exchange + q.ticket.events queue | rabbitmq_setup.py update | PLANNED |
| S26-15 | 3 Celery tasks (SLA timer 15min, auto-close daily, digest daily) | tasks/ticket_sla.py | PLANNED |
| S26-16 | 20 audit event types (TICKET_CREATED through TICKET_SLA_CONFIG_UPDATED) | ticket/service.py | PLANNED |
| S26-17 | Elasticsearch indexing tickets + comments | ticket/search_service.py | PLANNED |
| S26-18 | JWT portal claim (buyer/supplier/admin) added to access token | auth/jwt.py update | PLANNED |
| S26-19 | Buyer portal: List + Board (Kanban) + Detail + Create + entity Tickets tab | 8 frontend pages | PLANNED |
| S26-20 | Supplier portal: My Tickets + Raise + Detail (restricted view) | 3 frontend pages | PLANNED |
| S26-21 | Admin portal: All Tickets + Dashboard + SLA Config + Reports | 4 frontend pages | PLANNED |
| S26-22 | Real-time comment delivery via existing WebSocket infra | ticket/router.py WS push | PLANNED |
| S26-23 | 7 notification templates for ticket events | seed_notification_templates.py update | PLANNED |
| S26-24 | Drag-and-drop Kanban (@dnd-kit/core + @dnd-kit/sortable) | Frontend kanban component | PLANNED |

---
## ASSUMPTIONS LOG

| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-26-1 | @mention autocomplete fetches GET /api/v1/users?search={q}&active=true; results cached client-side 60s; only same-org users returned | Spec 8.1 — no dedicated mention API defined | LOW | Squad E |
| A-26-2 | Markdown rendered client-side via react-markdown + remark-gfm; NOT server-side — avoids latency on every comment fetch | Spec says "markdown supported"; rendering location unspecified | LOW | FE Lead |
| A-26-3 | ES search uses multi_match on title(x3), ticket_number(x5), description(x2), comments_text, entity_number(x4), tags with operator=or, min_score=0.3 | Spec 14 ES-backed; query parameters unspecified | LOW | Squad E |
| A-26-4 | Kanban drag uses @dnd-kit/core + @dnd-kit/sortable (react-beautiful-dnd unmaintained since 2022) | Spec says drag-and-drop; library not specified | LOW | FE Lead |
| A-26-5 | Ticket sequence seq_tkt_{org_code}_{year} created with CREATE SEQUENCE IF NOT EXISTS inside transaction; race condition on first ticket per org handled by unique constraint retry (max 3 retries) | Spec 3 per-org per-year; creation mechanism unspecified | MEDIUM — concurrent first tickets | Squad E |
| A-26-6 | is_private enforced at SQL WHERE clause level: (is_private = FALSE OR raised_by = :actor OR assigned_to = :actor OR :is_admin = TRUE) — NOT application layer filter | Spec 7 private visibility | HIGH — miss = data leak | Squad E |
| A-26-7 | Comment 15-min edit: (datetime.utcnow() - comment.created_at.replace(tzinfo=None)).total_seconds() > 900 raises EDIT_WINDOW_CLOSED | Spec 8.4 | LOW | Squad E |
| A-26-8 | Supplier internal note filter: GET comments endpoint checks is_supplier flag from JWT; filters out is_internal=True rows at DB query level (WHERE is_internal = FALSE OR :is_supplier = FALSE) | Spec 8.2 | MEDIUM — wrong filter = leak | Squad E |
| A-26-9 | RESOLVED auto-close after 3 days; PENDING_RESPONSE auto-close after 7 days — both checked daily at 01:00 org timezone | Spec 15; exact timing unspecified | LOW | Squad E |
| A-26-10 | SLA computed on calendar hours (not business hours) in Phase 1; business-hours-aware SLA explicitly deferred to Phase 2 per Spec 20 | Spec 20 scope | MEDIUM — overnight tickets breach faster | Squad E |
| A-26-11 | Entity link stored as advisory soft FK (entity_type VARCHAR + entity_id UUID + entity_number VARCHAR); no hard FK constraint since entities can be soft-deleted independently | Hard FK across 8 entity tables is complex and fragile | LOW | Squad E |
| A-26-12 | portal claim added to JWT access token (values: buyer/supplier/admin); set at login based on which login endpoint path called (/api/v1/auth/login vs /api/v1/supplier/auth/login); extracted by middleware into request.state.portal | JWT currently lacks portal field; auth module needs minor update | MEDIUM — coordination with SPEC_04 | Squad A + E |

---
## STEP 2 — IMPLEMENT

### 2.1 Auth Module Update — JWT Portal Claim
**File:** `app/auth/jwt.py` — add `portal: str = "buyer"` parameter to `create_access_token()`:
```python
payload = {
    "sub": str(user_id),
    "org_id": str(org_id),
    ...existing fields...,
    "portal": portal,  # "buyer" | "supplier" | "admin" — NEW
}
```

**File:** `app/auth/router.py` — supplier login endpoint sets portal="supplier", admin portal login sets portal="admin".

**File:** `app/core/middleware.py` — extract portal from JWT and set request.state.portal:
```python
# In LoggingContextMiddleware or RequestIDMiddleware:
if hasattr(request.state, "user"):
    payload = decode_jwt(credentials.credentials)
    request.state.portal = payload.get("portal", "buyer")
```

### 2.2 Migration: `alembic/versions/0028_ticket_enums.py`
```python
def upgrade():
    op.execute("CREATE TYPE ticket_type_enum AS ENUM ('QUERY','BUG','DISCREPANCY','COMPLAINT','CHANGE_REQUEST','SUPPORT','AUDIT_QUERY','VENDOR_ISSUE')")
    op.execute("CREATE TYPE ticket_priority_enum AS ENUM ('CRITICAL','HIGH','MEDIUM','LOW')")
    op.execute("CREATE TYPE ticket_status_enum AS ENUM ('OPEN','IN_PROGRESS','PENDING_RESPONSE','ESCALATED','RESOLVED','CLOSED','REOPENED')")

def downgrade():
    op.execute("DROP TYPE IF EXISTS ticket_type_enum CASCADE")
    op.execute("DROP TYPE IF EXISTS ticket_priority_enum CASCADE")
    op.execute("DROP TYPE IF EXISTS ticket_status_enum CASCADE")
```

### 2.3 Migration: `alembic/versions/0029_ticket_tables.py`
Create all 6 tables in this order (dependency order):
1. `tickets` (references organizations, users)
2. `ticket_comments` (references tickets, users)
3. `ticket_attachments` (references tickets, ticket_comments, documents, users)
4. `ticket_watchers` (references tickets, users) + UNIQUE(ticket_id, user_id)
5. `ticket_activity_log` (references tickets, users) — NO deleted_at column (immutable log)
6. `ticket_sla_config` (references organizations) + UNIQUE(org_id, priority)

Full downgrade: drop in reverse order.

### 2.4 Migration: `alembic/versions/0030_ticket_sequences.py`
```python
def upgrade():
    # Seed sequences for existing orgs (dynamic sequences created per-org per-year at runtime)
    # This migration just documents the naming convention and ensures org codes are available
    pass  # Sequences created dynamically via CREATE SEQUENCE IF NOT EXISTS in service layer

def downgrade():
    pass
```

### 2.5 Migration: `alembic/versions/0031_ticket_indexes.py`
```python
def upgrade():
    # ALL indexes use CONCURRENTLY
    stmts = [
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_org_status ON tickets (org_id, status) WHERE deleted_at IS NULL",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_org_raised_by ON tickets (org_id, raised_by) WHERE deleted_at IS NULL",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_assigned_to ON tickets (org_id, assigned_to, status) WHERE deleted_at IS NULL AND assigned_to IS NOT NULL",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_entity ON tickets (org_id, entity_type, entity_id) WHERE entity_id IS NOT NULL AND deleted_at IS NULL",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_sla ON tickets (sla_breach_at) WHERE status IN ('OPEN','IN_PROGRESS','PENDING_RESPONSE') AND deleted_at IS NULL",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_number ON tickets (ticket_number)",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_private ON tickets (org_id, is_private, raised_by, assigned_to) WHERE deleted_at IS NULL",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments (ticket_id, created_at) WHERE deleted_at IS NULL",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_comments_internal ON ticket_comments (ticket_id, is_internal) WHERE deleted_at IS NULL",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_watchers_user ON ticket_watchers (user_id, org_id)",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_watchers_ticket ON ticket_watchers (ticket_id)",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_activity_ticket ON ticket_activity_log (ticket_id, created_at)",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_sla_config_org ON ticket_sla_config (org_id, priority)",
    ]
    for stmt in stmts:
        op.execute(stmt)

def downgrade():
    # Drop all indexes
    for idx in ["idx_tickets_org_status","idx_tickets_org_raised_by","idx_tickets_assigned_to",
                "idx_tickets_entity","idx_tickets_sla","idx_tickets_number","idx_tickets_private",
                "idx_ticket_comments_ticket","idx_ticket_comments_internal","idx_ticket_watchers_user",
                "idx_ticket_watchers_ticket","idx_ticket_activity_ticket","idx_ticket_sla_config_org"]:
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {idx}")
```

### 2.6 Migration: `alembic/versions/0032_ticket_rls.py`
```python
def upgrade():
    op.execute("ALTER TABLE tickets ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY ticket_org_isolation ON tickets
        FOR ALL TO app_user
        USING (org_id = current_setting('app.current_org_id')::uuid)
    """)
    op.execute("ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY ticket_comment_org_isolation ON ticket_comments
        FOR ALL TO app_user
        USING (org_id = current_setting('app.current_org_id')::uuid)
    """)

def downgrade():
    op.execute("DROP POLICY IF EXISTS ticket_org_isolation ON tickets")
    op.execute("ALTER TABLE tickets DISABLE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS ticket_comment_org_isolation ON ticket_comments")
    op.execute("ALTER TABLE ticket_comments DISABLE ROW LEVEL SECURITY")
```

### 2.7 Migration: `alembic/versions/0033_ticket_sla_seed.py`
```python
DEFAULT_SLA = [
    {"priority": "CRITICAL", "first_response_hours": 1,  "resolution_hours": 4,   "escalation_hours": 2,  "escalate_to_role": "PROCUREMENT_ADMIN"},
    {"priority": "HIGH",     "first_response_hours": 4,  "resolution_hours": 24,  "escalation_hours": 12, "escalate_to_role": "VENDOR_ADMIN"},
    {"priority": "MEDIUM",   "first_response_hours": 8,  "resolution_hours": 72,  "escalation_hours": 48, "escalate_to_role": "BUYER"},
    {"priority": "LOW",      "first_response_hours": 24, "resolution_hours": 168, "escalation_hours": 96, "escalate_to_role": "BUYER"},
]
def upgrade():
    # Insert default SLA config for all existing orgs
    conn = op.get_bind()
    orgs = conn.execute(text("SELECT id FROM organizations WHERE deleted_at IS NULL"))
    for org in orgs:
        for sla in DEFAULT_SLA:
            conn.execute(text("""
                INSERT INTO ticket_sla_config (id, org_id, priority, first_response_hours,
                    resolution_hours, escalation_hours, escalate_to_role, version, created_at, updated_at)
                VALUES (gen_random_uuid(), :org_id, :priority, :first_response_hours,
                    :resolution_hours, :escalation_hours, :escalate_to_role, 1, NOW(), NOW())
                ON CONFLICT (org_id, priority) DO NOTHING
            """), {"org_id": org.id, **sla})

def downgrade():
    op.execute("DELETE FROM ticket_sla_config")
```

### 2.8 Migration: `alembic/versions/0034_ticket_permissions.py`
```python
TICKET_PERMISSIONS = [
    ("ticket.create",           "Create Tickets",                  "ticket"),
    ("ticket.view_own",         "View Own Tickets",                "ticket"),
    ("ticket.view_team",        "View Team Tickets",               "ticket"),
    ("ticket.view_all",         "View All Tickets",                "ticket"),
    ("ticket.assign",           "Assign Tickets",                  "ticket"),
    ("ticket.resolve",          "Resolve Tickets",                 "ticket"),
    ("ticket.close",            "Close Tickets",                   "ticket"),
    ("ticket.reopen",           "Reopen Tickets",                  "ticket"),
    ("ticket.add_internal_note","Add Internal Notes",              "ticket"),
    ("ticket.escalate",         "Escalate Tickets",                "ticket"),
    ("ticket.config_sla",       "Configure SLA Settings",          "ticket"),
    ("ticket.export",           "Export Ticket Data",              "ticket"),
]

ROLE_PERMISSIONS = {
    "REQUESTOR":          ["ticket.create", "ticket.view_own"],
    "BUYER":              ["ticket.create", "ticket.view_team", "ticket.assign", "ticket.reopen"],
    "SOURCING_MANAGER":   ["ticket.create", "ticket.view_team", "ticket.assign", "ticket.add_internal_note"],
    "APPROVER":           ["ticket.create", "ticket.view_team", "ticket.assign", "ticket.resolve", "ticket.reopen"],
    "FINANCE_CONTROLLER": ["ticket.create", "ticket.view_team", "ticket.assign", "ticket.resolve"],
    "PROCUREMENT_HEAD":   ["ticket.create", "ticket.view_all", "ticket.assign", "ticket.resolve",
                           "ticket.close", "ticket.reopen", "ticket.escalate", "ticket.add_internal_note", "ticket.export"],
    "VENDOR_ADMIN":       ["ticket.create", "ticket.view_all", "ticket.assign", "ticket.resolve",
                           "ticket.close", "ticket.reopen", "ticket.escalate", "ticket.add_internal_note", "ticket.export"],
    "PROCUREMENT_ADMIN":  ["ticket.create", "ticket.view_all", "ticket.assign", "ticket.resolve",
                           "ticket.close", "ticket.reopen", "ticket.escalate", "ticket.add_internal_note",
                           "ticket.config_sla", "ticket.export"],
    "SUPERADMIN":         ["ticket.create", "ticket.view_all", "ticket.assign", "ticket.resolve",
                           "ticket.close", "ticket.reopen", "ticket.escalate", "ticket.add_internal_note",
                           "ticket.config_sla", "ticket.export"],
    "SUPPLIER_USER":      ["ticket.create", "ticket.view_own"],
}

def upgrade():
    conn = op.get_bind()
    for code, desc, module in TICKET_PERMISSIONS:
        conn.execute(text("""
            INSERT INTO permissions (id, org_id, code, description, module, version, created_at, updated_at)
            SELECT gen_random_uuid(), o.id, :code, :description, :module, 1, NOW(), NOW()
            FROM organizations o WHERE o.deleted_at IS NULL
            ON CONFLICT DO NOTHING
        """), {"code": code, "description": desc, "module": module})
    # Assign to roles
    for role_code, perms in ROLE_PERMISSIONS.items():
        for perm_code in perms:
            conn.execute(text("""
                INSERT INTO role_permissions (id, org_id, role_id, permission_id, version, created_at, updated_at)
                SELECT gen_random_uuid(), r.org_id, r.id, p.id, 1, NOW(), NOW()
                FROM roles r JOIN permissions p ON p.code = :perm_code AND p.org_id = r.org_id
                WHERE r.code = :role_code AND r.deleted_at IS NULL
                ON CONFLICT DO NOTHING
            """), {"role_code": role_code, "perm_code": perm_code})

def downgrade():
    conn = op.get_bind()
    codes = [p[0] for p in TICKET_PERMISSIONS]
    conn.execute(text("DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code = ANY(:codes))"), {"codes": codes})
    conn.execute(text("DELETE FROM permissions WHERE code = ANY(:codes)"), {"codes": codes})
```

### 2.9 `app/modules/ticket/models.py` — All Models
```python
from app.db.base import BaseModel
from sqlalchemy import String, Boolean, Text, Integer, DateTime, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional

class Ticket(BaseModel):
    __tablename__ = "tickets"

    ticket_number: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    ticket_type: Mapped[str] = mapped_column(SAEnum(
        'QUERY','BUG','DISCREPANCY','COMPLAINT','CHANGE_REQUEST','SUPPORT','AUDIT_QUERY','VENDOR_ISSUE',
        name='ticket_type_enum', create_type=False), nullable=False)
    priority: Mapped[str] = mapped_column(SAEnum(
        'CRITICAL','HIGH','MEDIUM','LOW', name='ticket_priority_enum', create_type=False),
        nullable=False, default='MEDIUM')
    status: Mapped[str] = mapped_column(SAEnum(
        'OPEN','IN_PROGRESS','PENDING_RESPONSE','ESCALATED','RESOLVED','CLOSED','REOPENED',
        name='ticket_status_enum', create_type=False), nullable=False, default='OPEN')
    category: Mapped[Optional[str]] = mapped_column(String(100))
    raised_by: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    raised_by_portal: Mapped[str] = mapped_column(String(20), nullable=False, default="buyer")
    assigned_to: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    assigned_team: Mapped[Optional[str]] = mapped_column(String(100))
    entity_type: Mapped[Optional[str]] = mapped_column(String(50))
    entity_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True))
    entity_number: Mapped[Optional[str]] = mapped_column(String(100))
    resolution_note: Mapped[Optional[str]] = mapped_column(Text)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    sla_breach_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    sla_status: Mapped[str] = mapped_column(String(20), default='WITHIN_SLA', nullable=False)
    first_response_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    reopen_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tags: Mapped[list] = mapped_column(ARRAY(String), default=list, nullable=False)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    comments: Mapped[list["TicketComment"]] = relationship(back_populates="ticket", lazy="dynamic")
    watchers: Mapped[list["TicketWatcher"]] = relationship(back_populates="ticket", lazy="select")

class TicketComment(BaseModel):
    __tablename__ = "ticket_comments"
    ticket_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mentioned_users: Mapped[list] = mapped_column(ARRAY(PGUUID(as_uuid=True)), default=list, nullable=False)
    edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    edited_by: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    parent_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("ticket_comments.id"))
    ticket: Mapped["Ticket"] = relationship(back_populates="comments")

class TicketAttachment(BaseModel):
    __tablename__ = "ticket_attachments"
    ticket_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    comment_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("ticket_comments.id"))
    document_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    uploaded_by: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)

class TicketWatcher(BaseModel):
    __tablename__ = "ticket_watchers"
    ticket_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    added_by: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    __table_args__ = (UniqueConstraint("ticket_id", "user_id", name="uq_ticket_watchers_ticket_user"),)
    ticket: Mapped["Ticket"] = relationship(back_populates="watchers")

class TicketActivityLog(Base):
    """Immutable — NO deleted_at. Never update or delete."""
    __tablename__ = "ticket_activity_log"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    ticket_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    actor_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    old_value: Mapped[Optional[str]] = mapped_column(String(500))
    new_value: Mapped[Optional[str]] = mapped_column(String(500))
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class TicketSLAConfig(BaseModel):
    __tablename__ = "ticket_sla_config"
    priority: Mapped[str] = mapped_column(SAEnum('CRITICAL','HIGH','MEDIUM','LOW',
        name='ticket_priority_enum', create_type=False), nullable=False)
    first_response_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    resolution_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    escalation_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    escalate_to_role: Mapped[Optional[str]] = mapped_column(String(100))
    __table_args__ = (UniqueConstraint("org_id", "priority", name="uq_ticket_sla_config_org_priority"),)
```

### 2.10 `app/modules/ticket/fsm.py`
```python
from app.core.exceptions import AppException

TICKET_FSM: dict[str, list[str]] = {
    "OPEN":              ["IN_PROGRESS", "CLOSED"],
    "IN_PROGRESS":       ["PENDING_RESPONSE", "ESCALATED", "RESOLVED"],
    "PENDING_RESPONSE":  ["IN_PROGRESS", "CLOSED"],
    "ESCALATED":         ["IN_PROGRESS", "RESOLVED"],
    "RESOLVED":          ["CLOSED", "REOPENED"],
    "CLOSED":            ["REOPENED"],
    "REOPENED":          ["IN_PROGRESS"],
}

# Suppliers may ONLY perform these transitions on their own tickets
SUPPLIER_ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    "RESOLVED": ["CLOSED", "REOPENED"],
}

def validate_ticket_transition(current: str, target: str, is_supplier: bool = False) -> None:
    allowed = (SUPPLIER_ALLOWED_TRANSITIONS if is_supplier else TICKET_FSM).get(current, [])
    if target not in allowed:
        raise AppException(
            "INVALID_TICKET_TRANSITION",
            f"Cannot transition ticket from {current} to {target}",
            409, {"current": current, "target": target, "allowed": allowed}
        )
```

### 2.11 `app/modules/ticket/sla_service.py`
```python
from datetime import datetime, timedelta
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

# Fallback defaults — used when org has no SLA config row
_DEFAULT_SLA: dict[str, dict[str, int]] = {
    "CRITICAL": {"first_response": 1,  "resolution": 4,   "escalation": 2},
    "HIGH":     {"first_response": 4,  "resolution": 24,  "escalation": 12},
    "MEDIUM":   {"first_response": 8,  "resolution": 72,  "escalation": 48},
    "LOW":      {"first_response": 24, "resolution": 168, "escalation": 96},
}

class TicketSLAService:

    async def get_config(self, db: AsyncSession, org_id: UUID, priority: str) -> dict:
        row = await self.repo.get_sla_config(db, org_id, priority)
        if row:
            return {"first_response": row.first_response_hours,
                    "resolution": row.resolution_hours,
                    "escalation": row.escalation_hours,
                    "escalate_to_role": row.escalate_to_role}
        return _DEFAULT_SLA[priority]

    async def compute_breach_at(self, db: AsyncSession, org_id: UUID,
                                 priority: str, created_at: datetime) -> datetime:
        cfg = await self.get_config(db, org_id, priority)
        return created_at + timedelta(hours=cfg["resolution"])

    def compute_status(self, sla_breach_at: datetime, created_at: datetime) -> str:
        now = datetime.utcnow()
        total_secs = (sla_breach_at - created_at).total_seconds()
        elapsed_secs = (now - created_at).total_seconds()
        if total_secs <= 0:
            return "BREACHED"
        pct = (elapsed_secs / total_secs) * 100
        if pct >= 100:
            return "BREACHED"
        if pct >= 50:
            return "AT_RISK"
        return "WITHIN_SLA"
```

### 2.12 `app/modules/ticket/mention_parser.py`
```python
import re
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

_MENTION_RE = re.compile(r'@([a-zA-Z0-9._-]{2,})')

class MentionParser:

    async def parse(self, db: AsyncSession, content: str, org_id: UUID) -> list[UUID]:
        """Returns list of resolved user IDs from @mentions in content."""
        usernames = list(set(_MENTION_RE.findall(content)))
        if not usernames:
            return []
        resolved: list[UUID] = []
        for uname in usernames:
            user = await self.user_repo.find_by_username_or_email_prefix(db, uname, org_id)
            if user:
                resolved.append(user.id)
        return resolved
```

### 2.13 `app/modules/ticket/service.py` — TicketService
```python
from datetime import datetime, timedelta
from uuid import UUID, uuid4
import json

class TicketService:

    async def create(self, db, data: TicketCreateRequest, actor_id: UUID,
                     org_id: UUID, portal: str) -> Ticket:
        ticket_number = await self._generate_number(db, org_id)
        sla_breach_at = await self.sla.compute_breach_at(db, org_id, data.priority, datetime.utcnow())

        ticket = Ticket(
            org_id=org_id, ticket_number=ticket_number, title=data.title,
            description=data.description, ticket_type=data.ticket_type,
            priority=data.priority, category=data.category, status="OPEN",
            raised_by=actor_id, raised_by_portal=portal,
            entity_type=data.entity_type, entity_id=data.entity_id,
            entity_number=data.entity_number, tags=data.tags or [],
            is_private=data.is_private or False, sla_breach_at=sla_breach_at,
            sla_status="WITHIN_SLA",
        )
        db.add(ticket)
        await db.flush()
        # Auto-watch: add raiser as watcher
        db.add(TicketWatcher(org_id=org_id, ticket_id=ticket.id,
                              user_id=actor_id, added_by=actor_id))
        await self._log(db, ticket.id, actor_id, org_id, "TICKET_CREATED",
                        new_value=f"status=OPEN priority={data.priority} type={data.ticket_type}")
        await self.publisher.publish("procurement.ticket", "ticket.created", {
            "ticket_id": str(ticket.id), "ticket_number": ticket_number,
            "priority": data.priority, "raised_by": str(actor_id), "org_id": str(org_id),
            "entity_type": data.entity_type, "entity_number": data.entity_number,
        }, org_id)
        await self.audit.log(db, "TICKET", ticket.id, "TICKET_CREATED", actor_id, org_id,
            new_values={"number": ticket_number, "priority": data.priority, "type": data.ticket_type})
        return ticket

    async def add_comment(self, db, ticket_id: UUID, content: str, is_internal: bool,
                           actor_id: UUID, org_id: UUID, is_supplier: bool = False) -> TicketComment:
        if is_internal and is_supplier:
            raise ForbiddenError("SUPPLIER_CANNOT_ADD_INTERNAL",
                "Suppliers cannot add internal notes to tickets")

        ticket = await self.repo.get(db, ticket_id, org_id)
        mentioned_ids = await self.mentions.parse(db, content, org_id)

        comment = TicketComment(
            org_id=org_id, ticket_id=ticket_id, author_id=actor_id,
            content=content, is_internal=is_internal, mentioned_users=mentioned_ids,
        )
        db.add(comment)
        await db.flush()

        # Auto-add mentions as watchers
        for uid in mentioned_ids:
            existing = await self.repo.get_watcher(db, ticket_id, uid, org_id)
            if not existing:
                db.add(TicketWatcher(org_id=org_id, ticket_id=ticket_id,
                                      user_id=uid, added_by=actor_id))

        # Track first response
        if ticket.assigned_to == actor_id and not ticket.first_response_at:
            ticket.first_response_at = datetime.utcnow()

        # PENDING_RESPONSE → IN_PROGRESS when raiser replies
        if ticket.status == "PENDING_RESPONSE" and actor_id == ticket.raised_by:
            ticket.status = "IN_PROGRESS"
            await self._log(db, ticket_id, actor_id, org_id, "STATUS_CHANGE",
                            old_value="PENDING_RESPONSE", new_value="IN_PROGRESS")

        activity = "INTERNAL_NOTE_ADDED" if is_internal else "COMMENT_ADDED"
        await self._log(db, ticket_id, actor_id, org_id, activity)

        await self.publisher.publish("procurement.ticket", "ticket.comment.added", {
            "ticket_id": str(ticket_id), "comment_id": str(comment.id),
            "is_internal": is_internal, "author_id": str(actor_id),
            "mentioned_users": [str(u) for u in mentioned_ids], "org_id": str(org_id),
        }, org_id)

        # Real-time push via existing WebSocket Redis pub/sub
        watchers = await self.repo.get_watchers(db, ticket_id, org_id)
        supplier_ids = await self._get_supplier_user_ids(db, org_id)
        for w in watchers:
            if w.user_id == actor_id:
                continue
            if is_internal and str(w.user_id) in supplier_ids:
                continue  # Never push internal notes to suppliers
            await self.redis.publish(
                RedisKeys.notification_channel(w.user_id),
                json.dumps({"notification_type": "TICKET_UPDATE",
                            "ticket_id": str(ticket_id),
                            "ticket_number": ticket.ticket_number,
                            "event": "NEW_COMMENT",
                            "is_internal": is_internal,
                            "author_id": str(actor_id)})
            )
        return comment

    async def edit_comment(self, db, comment_id: UUID, content: str,
                            actor_id: UUID, org_id: UUID) -> TicketComment:
        comment = await self.repo.get_comment(db, comment_id, org_id)
        if comment.author_id != actor_id:
            raise ForbiddenError("NOT_COMMENT_AUTHOR", "Only the comment author can edit")
        elapsed = (datetime.utcnow() - comment.created_at.replace(tzinfo=None)).total_seconds()
        if elapsed > 900:  # 15 minutes — NOT from settings (structural constraint per spec)
            raise AppException("EDIT_WINDOW_CLOSED",
                "Comments can only be edited within 15 minutes of posting", 409,
                {"elapsed_seconds": int(elapsed), "max_seconds": 900})
        comment.content = content
        comment.edited_at = datetime.utcnow()
        comment.edited_by = actor_id
        return comment

    async def get_comments(self, db, ticket_id: UUID, org_id: UUID,
                            is_supplier: bool, cursor: Optional[str], limit: int = 20) -> list[TicketComment]:
        query = (select(TicketComment)
                 .where(TicketComment.ticket_id == ticket_id)
                 .where(TicketComment.org_id == org_id)
                 .where(TicketComment.deleted_at.is_(None)))
        # Suppliers NEVER see internal notes — enforced at DB query level
        if is_supplier:
            query = query.where(TicketComment.is_internal == False)
        if cursor:
            last_id = decode_cursor(cursor)
            query = query.where(TicketComment.id > last_id)
        result = await db.execute(query.order_by(TicketComment.created_at.asc()).limit(limit + 1))
        rows = list(result.scalars().all())
        has_more = len(rows) > limit
        return rows[:limit], has_more

    async def assign(self, db, ticket_id: UUID, user_id: UUID, team: Optional[str],
                     actor_id: UUID, org_id: UUID) -> Ticket:
        ticket = await self.repo.get(db, ticket_id, org_id)
        old_assignee = ticket.assigned_to
        ticket.assigned_to = user_id
        ticket.assigned_team = team
        if ticket.status == "OPEN":
            ticket.status = "IN_PROGRESS"
        # Add new assignee as watcher
        existing = await self.repo.get_watcher(db, ticket_id, user_id, org_id)
        if not existing:
            db.add(TicketWatcher(org_id=org_id, ticket_id=ticket_id,
                                  user_id=user_id, added_by=actor_id))
        await self._log(db, ticket_id, actor_id, org_id, "ASSIGNMENT_CHANGE",
                        old_value=str(old_assignee), new_value=str(user_id))
        await self.publisher.publish("procurement.ticket", "ticket.assigned", {
            "ticket_id": str(ticket_id), "ticket_number": ticket.ticket_number,
            "new_assignee_id": str(user_id), "org_id": str(org_id),
        }, org_id)
        return ticket

    async def resolve(self, db, ticket_id: UUID, resolution_note: str,
                       actor_id: UUID, org_id: UUID) -> Ticket:
        ticket = await self.repo.get(db, ticket_id, org_id)
        validate_ticket_transition(ticket.status, "RESOLVED")
        if not resolution_note or len(resolution_note.strip()) < 10:
            raise ValidationError("RESOLUTION_NOTE_REQUIRED",
                "Resolution note must be at least 10 characters", {"min_length": 10})
        old_status = ticket.status
        ticket.status = "RESOLVED"
        ticket.resolution_note = resolution_note.strip()
        ticket.resolved_at = datetime.utcnow()
        await self._log(db, ticket_id, actor_id, org_id, "TICKET_RESOLVED",
                        old_value=old_status, new_value="RESOLVED")
        await self.publisher.publish("procurement.ticket", "ticket.resolved", {
            "ticket_id": str(ticket_id), "ticket_number": ticket.ticket_number,
            "resolved_by": str(actor_id), "resolution_note": resolution_note[:200],
            "raised_by": str(ticket.raised_by), "org_id": str(org_id),
        }, org_id)
        await self.audit.log(db, "TICKET", ticket_id, "TICKET_RESOLVED", actor_id, org_id,
            old_values={"status": old_status}, new_values={"status": "RESOLVED"})
        return ticket

    async def reopen(self, db, ticket_id: UUID, reason: str,
                      actor_id: UUID, org_id: UUID, is_supplier: bool = False) -> Ticket:
        ticket = await self.repo.get(db, ticket_id, org_id)
        if is_supplier and ticket.raised_by != actor_id:
            raise ForbiddenError("NOT_TICKET_OWNER", "Suppliers can only reopen their own tickets")
        validate_ticket_transition(ticket.status, "REOPENED", is_supplier=is_supplier)
        if ticket.status == "CLOSED" and not await self._is_admin(db, actor_id, org_id):
            days_closed = (datetime.utcnow() - ticket.updated_at.replace(tzinfo=None)).days
            if days_closed > 30:
                raise AppException("REOPEN_WINDOW_EXPIRED",
                    "Tickets can only be reopened within 30 days of closing", 409)
        old_status = ticket.status
        ticket.status = "REOPENED"
        ticket.reopen_count += 1
        ticket.resolved_at = None
        ticket.resolution_note = None
        # Reset SLA breach time from now
        ticket.sla_breach_at = await self.sla.compute_breach_at(
            db, org_id, ticket.priority, datetime.utcnow())
        ticket.sla_status = "WITHIN_SLA"
        await self._log(db, ticket_id, actor_id, org_id, "TICKET_REOPENED",
                        old_value=old_status, new_value=f"REOPENED (count={ticket.reopen_count}) reason={reason}")
        await self.publisher.publish("procurement.ticket", "ticket.reopened",
            {"ticket_id": str(ticket_id), "reason": reason, "reopen_count": ticket.reopen_count}, org_id)
        return ticket

    async def get_list(self, db, filters: TicketFilters, actor_id: UUID,
                        org_id: UUID, is_supplier: bool) -> tuple[list[Ticket], int]:
        query = (select(Ticket)
                 .where(Ticket.org_id == org_id)
                 .where(Ticket.deleted_at.is_(None)))
        if is_supplier:
            query = query.where(Ticket.raised_by == actor_id)
        else:
            is_admin = await self._is_admin(db, actor_id, org_id)
            if not is_admin:
                query = query.where(or_(
                    Ticket.is_private == False,
                    Ticket.raised_by == actor_id,
                    Ticket.assigned_to == actor_id,
                ))
            if filters.view_scope == "my_tickets":
                query = query.where(Ticket.raised_by == actor_id)
            elif filters.view_scope == "assigned_to_me":
                query = query.where(Ticket.assigned_to == actor_id)

        if filters.status:
            query = query.where(Ticket.status == filters.status)
        if filters.priority:
            query = query.where(Ticket.priority == filters.priority)
        if filters.ticket_type:
            query = query.where(Ticket.ticket_type == filters.ticket_type)
        if filters.entity_type:
            query = query.where(Ticket.entity_type == filters.entity_type)
        if filters.entity_id:
            query = query.where(Ticket.entity_id == filters.entity_id)
        if filters.tags:
            query = query.where(Ticket.tags.overlap(filters.tags))
        if filters.date_from:
            query = query.where(Ticket.created_at >= filters.date_from)
        if filters.date_to:
            query = query.where(Ticket.created_at <= filters.date_to)

        count = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
        result = await db.execute(
            query.order_by(Ticket.created_at.desc()).limit(filters.limit).offset(filters.offset))
        return list(result.scalars().all()), count

    async def get_dashboard(self, db, actor_id: UUID, org_id: UUID) -> dict:
        base = select(Ticket).where(Ticket.org_id == org_id).where(Ticket.deleted_at.is_(None))
        by_status = {}
        for s in ["OPEN","IN_PROGRESS","PENDING_RESPONSE","ESCALATED","RESOLVED","CLOSED","REOPENED"]:
            r = await db.execute(select(func.count()).select_from(
                base.where(Ticket.status == s).subquery()))
            by_status[s] = r.scalar()
        by_priority = {}
        for p in ["CRITICAL","HIGH","MEDIUM","LOW"]:
            r = await db.execute(select(func.count()).select_from(
                base.where(Ticket.priority == p).where(
                    Ticket.status.not_in(["CLOSED","RESOLVED"])).subquery()))
            by_priority[p] = r.scalar()
        my_open = (await db.execute(select(func.count()).select_from(
            base.where(Ticket.raised_by == actor_id)
                .where(Ticket.status.not_in(["CLOSED","RESOLVED"])).subquery()))).scalar()
        assigned_to_me = (await db.execute(select(func.count()).select_from(
            base.where(Ticket.assigned_to == actor_id)
                .where(Ticket.status.not_in(["CLOSED"])).subquery()))).scalar()
        breached = (await db.execute(select(func.count()).select_from(
            base.where(Ticket.sla_status == "BREACHED")
                .where(Ticket.status.not_in(["CLOSED","RESOLVED"])).subquery()))).scalar()
        return {
            "by_status": by_status, "by_priority": by_priority,
            "my_open_tickets": my_open, "assigned_to_me": assigned_to_me,
            "sla_breached": breached,
        }

    async def _generate_number(self, db, org_id: UUID) -> str:
        org = await self.org_repo.get(db, org_id)
        code = (org.name[:3]).upper().replace(" ", "").replace("-", "")
        year = datetime.utcnow().year
        seq = f"seq_tkt_{code.lower()}_{year}"
        for attempt in range(3):
            try:
                await db.execute(text(
                    f"CREATE SEQUENCE IF NOT EXISTS {seq} START 1 INCREMENT 1"))
                result = await db.execute(text(f"SELECT nextval('{seq}')"))
                n = result.scalar()
                return f"TKT-{code}-{year}-{str(n).zfill(6)}"
            except Exception:
                if attempt == 2:
                    raise

    async def _log(self, db, ticket_id, actor_id, org_id, activity_type,
                    old_value=None, new_value=None):
        db.add(TicketActivityLog(
            org_id=org_id, ticket_id=ticket_id, actor_id=actor_id,
            activity_type=activity_type, old_value=old_value, new_value=new_value,
        ))

    async def _is_admin(self, db, user_id: UUID, org_id: UUID) -> bool:
        return await self.perm_repo.user_has_any_role(
            db, user_id, org_id, ["PROCUREMENT_ADMIN", "SUPERADMIN"])
```

### 2.14 `app/modules/ticket/router.py` — Full Router
```python
from fastapi import APIRouter, Depends, Query, Request
from typing import Optional
from uuid import UUID
from app.core.responses import success_response, created_response, APIResponse
from app.core.pagination import PaginationParams
from app.auth.dependencies import get_current_user, require_permission
from app.db.session import get_db
from app.core.constants import PermissionCode
from .service import TicketService
from .schemas import *

router = APIRouter(prefix="/api/v1/tickets", tags=["tickets"])
ticket_svc = TicketService()

def _is_supplier(current_user) -> bool:
    return getattr(current_user, "is_supplier_user", False)

@router.get("", response_model=APIResponse[list[TicketListResponse]])
async def list_tickets(
    status: Optional[str] = None, priority: Optional[str] = None,
    ticket_type: Optional[str] = None, entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None, view_scope: Optional[str] = None,
    tags: Optional[list[str]] = Query(None), search: Optional[str] = None,
    params: PaginationParams = Depends(),
    current_user = Depends(require_permission(PermissionCode.TICKET_VIEW_OWN)),
    db = Depends(get_db),
):
    if search:
        results = await ticket_svc.search_service.search(current_user.org_id, search, {})
        return success_response(results)
    filters = TicketFilters(status=status, priority=priority, ticket_type=ticket_type,
        entity_type=entity_type, entity_id=entity_id, view_scope=view_scope, tags=tags,
        limit=params.limit, offset=params.offset)
    tickets, total = await ticket_svc.get_list(db, filters, current_user.id, current_user.org_id, _is_supplier(current_user))
    from app.core.pagination import PaginationMeta
    meta = PaginationMeta(total=total, page=params.page, page_size=params.limit)
    return success_response([TicketListResponse.model_validate(t) for t in tickets], meta=meta)

@router.get("/dashboard")
async def get_dashboard(current_user = Depends(get_current_user), db = Depends(get_db)):
    return success_response(await ticket_svc.get_dashboard(db, current_user.id, current_user.org_id))

@router.post("", response_model=APIResponse[TicketDetailResponse], status_code=201)
async def create_ticket(
    data: TicketCreateRequest, request: Request,
    current_user = Depends(require_permission(PermissionCode.TICKET_CREATE)),
    db = Depends(get_db),
):
    portal = getattr(request.state, "portal", "buyer")
    ticket = await ticket_svc.create(db, data, current_user.id, current_user.org_id, portal)
    return created_response(TicketDetailResponse.model_validate(ticket))

@router.get("/{ticket_id}", response_model=APIResponse[TicketDetailResponse])
async def get_ticket(
    ticket_id: UUID, current_user = Depends(require_permission(PermissionCode.TICKET_VIEW_OWN)),
    db = Depends(get_db),
):
    ticket = await ticket_svc.get_detail(db, ticket_id, current_user.id, current_user.org_id, _is_supplier(current_user))
    return success_response(TicketDetailResponse.model_validate(ticket))

@router.put("/{ticket_id}", response_model=APIResponse[TicketDetailResponse])
async def update_ticket(
    ticket_id: UUID, data: TicketUpdateRequest,
    current_user = Depends(require_permission(PermissionCode.TICKET_VIEW_OWN)),
    db = Depends(get_db),
):
    ticket = await ticket_svc.update(db, ticket_id, data, current_user.id, current_user.org_id)
    return success_response(TicketDetailResponse.model_validate(ticket))

@router.delete("/{ticket_id}", status_code=204)
async def delete_ticket(
    ticket_id: UUID,
    current_user = Depends(require_permission(PermissionCode.TICKET_VIEW_ALL)),
    db = Depends(get_db),
):
    await ticket_svc.soft_delete(db, ticket_id, current_user.id, current_user.org_id)

# --- Transitions ---
@router.post("/{ticket_id}/assign")
async def assign_ticket(ticket_id: UUID, data: TicketAssignRequest,
    current_user = Depends(require_permission(PermissionCode.TICKET_ASSIGN)), db = Depends(get_db)):
    t = await ticket_svc.assign(db, ticket_id, data.user_id, data.team, current_user.id, current_user.org_id)
    return success_response(TicketDetailResponse.model_validate(t))

@router.post("/{ticket_id}/start-progress")
async def start_progress(ticket_id: UUID, current_user = Depends(get_current_user), db = Depends(get_db)):
    from .fsm import validate_ticket_transition
    ticket = await ticket_svc.repo.get(db, ticket_id, current_user.org_id)
    validate_ticket_transition(ticket.status, "IN_PROGRESS")
    ticket.status = "IN_PROGRESS"
    if not ticket.assigned_to:
        ticket.assigned_to = current_user.id
    return success_response(TicketDetailResponse.model_validate(ticket))

@router.post("/{ticket_id}/resolve")
async def resolve_ticket(ticket_id: UUID, data: TicketResolveRequest,
    current_user = Depends(require_permission(PermissionCode.TICKET_RESOLVE)), db = Depends(get_db)):
    t = await ticket_svc.resolve(db, ticket_id, data.resolution_note, current_user.id, current_user.org_id)
    return success_response(TicketDetailResponse.model_validate(t))

@router.post("/{ticket_id}/close")
async def close_ticket(ticket_id: UUID,
    current_user = Depends(require_permission(PermissionCode.TICKET_CLOSE)), db = Depends(get_db)):
    t = await ticket_svc.close(db, ticket_id, current_user.id, current_user.org_id, _is_supplier(current_user))
    return success_response(TicketDetailResponse.model_validate(t))

@router.post("/{ticket_id}/reopen")
async def reopen_ticket(ticket_id: UUID, data: TicketReopenRequest,
    current_user = Depends(require_permission(PermissionCode.TICKET_REOPEN)), db = Depends(get_db)):
    t = await ticket_svc.reopen(db, ticket_id, data.reason, current_user.id, current_user.org_id, _is_supplier(current_user))
    return success_response(TicketDetailResponse.model_validate(t))

@router.post("/{ticket_id}/escalate")
async def escalate_ticket(ticket_id: UUID, data: TicketEscalateRequest,
    current_user = Depends(require_permission(PermissionCode.TICKET_ESCALATE)), db = Depends(get_db)):
    t = await ticket_svc.escalate(db, ticket_id, data.reason, data.escalate_to_user_id, current_user.id, current_user.org_id)
    return success_response(TicketDetailResponse.model_validate(t))

@router.post("/{ticket_id}/pending-response")
async def pending_response(ticket_id: UUID, current_user = Depends(get_current_user), db = Depends(get_db)):
    t = await ticket_svc.set_pending_response(db, ticket_id, current_user.id, current_user.org_id)
    return success_response(TicketDetailResponse.model_validate(t))

# --- Comments ---
@router.get("/{ticket_id}/comments")
async def get_comments(ticket_id: UUID, cursor: Optional[str] = None, limit: int = 20,
    current_user = Depends(require_permission(PermissionCode.TICKET_VIEW_OWN)), db = Depends(get_db)):
    comments, has_more = await ticket_svc.get_comments(db, ticket_id, current_user.org_id,
        _is_supplier(current_user), cursor, limit)
    return success_response([TicketCommentResponse.model_validate(c) for c in comments],
        meta={"has_more": has_more, "count": len(comments)})

@router.post("/{ticket_id}/comments", status_code=201)
async def add_comment(ticket_id: UUID, data: TicketCommentRequest,
    current_user = Depends(require_permission(PermissionCode.TICKET_VIEW_OWN)), db = Depends(get_db)):
    if data.is_internal:
        # Inline permission check for internal notes
        from app.core.permissions import user_has_permission
        if not await user_has_permission(db, current_user.id, current_user.org_id, PermissionCode.TICKET_ADD_INTERNAL):
            raise ForbiddenError("MISSING_INTERNAL_NOTE_PERMISSION")
    comment = await ticket_svc.add_comment(db, ticket_id, data.content, data.is_internal or False,
        current_user.id, current_user.org_id, _is_supplier(current_user))
    return created_response(TicketCommentResponse.model_validate(comment))

@router.put("/{ticket_id}/comments/{comment_id}")
async def edit_comment(ticket_id: UUID, comment_id: UUID, data: TicketCommentEditRequest,
    current_user = Depends(get_current_user), db = Depends(get_db)):
    comment = await ticket_svc.edit_comment(db, comment_id, data.content, current_user.id, current_user.org_id)
    return success_response(TicketCommentResponse.model_validate(comment))

@router.delete("/{ticket_id}/comments/{comment_id}", status_code=204)
async def delete_comment(ticket_id: UUID, comment_id: UUID,
    current_user = Depends(get_current_user), db = Depends(get_db)):
    await ticket_svc.delete_comment(db, comment_id, current_user.id, current_user.org_id)

# --- Watchers ---
@router.get("/{ticket_id}/watchers")
async def get_watchers(ticket_id: UUID, current_user = Depends(get_current_user), db = Depends(get_db)):
    watchers = await ticket_svc.repo.get_watchers(db, ticket_id, current_user.org_id)
    return success_response(watchers)

@router.post("/{ticket_id}/watchers", status_code=201)
async def add_watcher(ticket_id: UUID, data: TicketWatcherRequest,
    current_user = Depends(get_current_user), db = Depends(get_db)):
    await ticket_svc.add_watcher(db, ticket_id, data.user_id, current_user.id, current_user.org_id)
    return success_response({"message": "Watcher added"})

@router.delete("/{ticket_id}/watchers/{user_id}", status_code=204)
async def remove_watcher(ticket_id: UUID, user_id: UUID,
    current_user = Depends(get_current_user), db = Depends(get_db)):
    await ticket_svc.remove_watcher(db, ticket_id, user_id, current_user.id, current_user.org_id)

# --- Activity ---
@router.get("/{ticket_id}/activity")
async def get_activity(ticket_id: UUID, current_user = Depends(get_current_user), db = Depends(get_db)):
    activity = await ticket_svc.repo.get_activity(db, ticket_id, current_user.org_id)
    return success_response(activity)

# --- Attachments ---
@router.post("/{ticket_id}/attachments", status_code=201)
async def upload_attachment(ticket_id: UUID, file: UploadFile,
    current_user = Depends(get_current_user), db = Depends(get_db)):
    attachment = await ticket_svc.attach_file(db, ticket_id, file, current_user.id, current_user.org_id)
    return created_response(attachment)

@router.delete("/{ticket_id}/attachments/{attachment_id}", status_code=204)
async def remove_attachment(ticket_id: UUID, attachment_id: UUID,
    current_user = Depends(get_current_user), db = Depends(get_db)):
    await ticket_svc.remove_attachment(db, ticket_id, attachment_id, current_user.id, current_user.org_id)

# --- Search ---
@router.post("/search")
async def search_tickets(data: TicketSearchRequest,
    current_user = Depends(require_permission(PermissionCode.TICKET_VIEW_OWN)), db = Depends(get_db)):
    results = await ticket_svc.search_service.search(current_user.org_id, data.query, data.filters or {})
    return success_response(results)

# --- SLA Config (Admin) ---
@router.get("/sla-config")
async def get_sla_config(current_user = Depends(require_permission(PermissionCode.TICKET_CONFIG_SLA)), db = Depends(get_db)):
    configs = await ticket_svc.repo.get_all_sla_configs(db, current_user.org_id)
    return success_response(configs)

@router.put("/sla-config")
async def update_sla_config(data: list[TicketSLAConfigRequest],
    current_user = Depends(require_permission(PermissionCode.TICKET_CONFIG_SLA)), db = Depends(get_db)):
    result = await ticket_svc.update_sla_config(db, data, current_user.id, current_user.org_id)
    return success_response(result)

# --- Export ---
@router.get("/export")
async def export_tickets(
    status: Optional[str] = None, priority: Optional[str] = None,
    current_user = Depends(require_permission(PermissionCode.TICKET_EXPORT)), db = Depends(get_db),
):
    from app.core.streaming import stream_csv
    filters = TicketFilters(status=status, priority=priority, limit=100000, offset=0)
    tickets, _ = await ticket_svc.get_list(db, filters, current_user.id, current_user.org_id, False)
    rows = [{"number": t.ticket_number, "title": t.title, "type": t.ticket_type,
             "priority": t.priority, "status": t.status, "created": t.created_at.isoformat()}
            for t in tickets]
    headers = ["number","title","type","priority","status","created"]
    return stream_csv(headers, rows, f"tickets_export_{datetime.utcnow().strftime('%Y%m%d')}.csv")
```

### 2.15 Register Router in `app/main.py`
```python
from app.modules.ticket.router import router as ticket_router
app.include_router(ticket_router)  # Add alongside the other 24 module routers
```

### 2.16 `app/tasks/ticket_sla.py` — Three Celery Tasks
```python
from app.tasks.celery_app import celery_app
from app.db.session import async_session_factory
from datetime import datetime, timedelta
import asyncio

@celery_app.task(queue="celery.sla_timers", name="check_ticket_sla_timers")
def check_ticket_sla_timers():
    asyncio.run(_check_sla())

async def _check_sla():
    async with async_session_factory() as db:
        now = datetime.utcnow()
        tickets = await ticket_repo.get_active_with_sla(db)  # OPEN|IN_PROGRESS|PENDING_RESPONSE with sla_breach_at set
        for ticket in tickets:
            if not ticket.sla_breach_at:
                continue
            new_status = sla_service.compute_status(
                ticket.sla_breach_at.replace(tzinfo=None), ticket.created_at.replace(tzinfo=None))
            if new_status == ticket.sla_status:
                continue
            old_status = ticket.sla_status
            ticket.sla_status = new_status
            if new_status == "BREACHED" and old_status != "BREACHED":
                await publisher.publish("procurement.ticket", "ticket.sla.breached", {
                    "ticket_id": str(ticket.id), "ticket_number": ticket.ticket_number,
                    "priority": ticket.priority, "assigned_to": str(ticket.assigned_to),
                    "org_id": str(ticket.org_id)
                }, ticket.org_id)
                # Auto-escalate on breach
                if ticket.status != "ESCALATED":
                    ticket.status = "ESCALATED"
                    await publisher.publish("procurement.ticket", "ticket.escalated", {
                        "ticket_id": str(ticket.id), "escalation_reason": "SLA_AUTO_ESCALATION",
                        "org_id": str(ticket.org_id)
                    }, ticket.org_id)
            elif new_status == "AT_RISK" and old_status == "WITHIN_SLA":
                await publisher.publish("procurement.ticket", "ticket.sla.warning", {
                    "ticket_id": str(ticket.id), "ticket_number": ticket.ticket_number,
                    "priority": ticket.priority, "assigned_to": str(ticket.assigned_to),
                }, ticket.org_id)
        await db.commit()

@celery_app.task(queue="celery.maintenance", name="auto_close_idle_tickets")
def auto_close_idle_tickets():
    asyncio.run(_auto_close())

async def _auto_close():
    async with async_session_factory() as db:
        now = datetime.utcnow()
        # RESOLVED 3+ days → CLOSED
        r_cutoff = now - timedelta(days=3)
        resolved = await ticket_repo.get_stale_resolved(db, r_cutoff)
        for t in resolved:
            t.status = "CLOSED"
            await publisher.publish("procurement.ticket", "ticket.closed",
                {"ticket_id": str(t.id), "closure_reason": "AUTO_CLOSE_RESOLVED_3D"}, t.org_id)
        # PENDING_RESPONSE 7+ days → CLOSED
        p_cutoff = now - timedelta(days=7)
        pending = await ticket_repo.get_stale_pending_response(db, p_cutoff)
        for t in pending:
            t.status = "CLOSED"
            await publisher.publish("procurement.ticket", "ticket.closed",
                {"ticket_id": str(t.id), "closure_reason": "AUTO_CLOSE_NO_RESPONSE_7D"}, t.org_id)
        await db.commit()

@celery_app.task(queue="celery.maintenance", name="send_ticket_digest")
def send_ticket_digest():
    asyncio.run(_send_digest())

async def _send_digest():
    async with async_session_factory() as db:
        assignees = await ticket_repo.get_unique_assignees_with_open_tickets(db)
        for assignee_id, org_id, open_count, breached_count in assignees:
            await publisher.publish("procurement.notification", "notification.email.ticket_digest", {
                "recipient_id": str(assignee_id), "org_id": str(org_id),
                "open_count": open_count, "breached_count": breached_count,
                "template_code": "TICKET_DAILY_DIGEST",
            }, org_id)
```

### 2.17 Update Beat Schedule in `app/tasks/celery_app.py`
```python
# Add to beat_schedule:
"check-ticket-sla-timers": {
    "task": "check_ticket_sla_timers",
    "schedule": crontab(minute=f"*/{settings.CELERY_SLA_CHECK_MINUTES}"),  # Every 15 min
    "options": {"queue": "celery.sla_timers"},
},
"auto-close-idle-tickets": {
    "task": "auto_close_idle_tickets",
    "schedule": crontab(hour="1", minute="0"),  # Daily at 01:00
    "options": {"queue": "celery.maintenance"},
},
"send-ticket-digest": {
    "task": "send_ticket_digest",
    "schedule": crontab(hour="8", minute="0"),  # Daily at 08:00
    "options": {"queue": "celery.maintenance"},
},
```

### 2.18 Update `scripts/rabbitmq_setup.py`
```python
# Add to EXCHANGES:
"procurement.ticket",

# Add to QUEUES:
("q.ticket.events", "procurement.ticket", "ticket.*", "q.dlq.ticket"),
```

### 2.19 Update `scripts/seed_notification_templates.py`
```python
TICKET_TEMPLATES = [
    {"code":"TICKET_CREATED_NOTIFICATION", "subject":"New Ticket {{ticket_number}}: {{title}}",    "channels":["email","inapp"]},
    {"code":"TICKET_COMMENT_NOTIFICATION",  "subject":"New comment on {{ticket_number}}",            "channels":["inapp"]},
    {"code":"TICKET_ASSIGNED_NOTIFICATION", "subject":"Ticket assigned: {{ticket_number}}",          "channels":["email","inapp"]},
    {"code":"TICKET_RESOLVED_NOTIFICATION", "subject":"Resolved: {{ticket_number}}",                 "channels":["email","inapp"]},
    {"code":"TICKET_REOPENED_NOTIFICATION", "subject":"Ticket reopened: {{ticket_number}}",          "channels":["email","inapp"]},
    {"code":"TICKET_SLA_BREACH_ALERT",      "subject":"⚠️ SLA Breached: {{ticket_number}}",          "channels":["email","inapp"]},
    {"code":"TICKET_ESCALATED_NOTIFICATION","subject":"Escalated: {{ticket_number}}",                "channels":["email","inapp"]},
    {"code":"TICKET_MENTION_NOTIFICATION",  "subject":"@mentioned in ticket {{ticket_number}}",      "channels":["inapp"]},
    {"code":"TICKET_DAILY_DIGEST",          "subject":"Your Ticket Summary — {{open_count}} open",   "channels":["email"]},
]
```

### 2.20 Frontend — Buyer Portal Pages (8 pages)

**Install packages:**
```bash
cd procurement-portal-frontend
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-markdown remark-gfm
```

**Page 1: `apps/buyer-portal/app/(main)/tickets/page.tsx`** — Ticket List
```tsx
// State: view toggle (list|board), filters bar, table with columns:
// Number, Title (truncated 80 chars), Type badge, Priority dot+label,
// Linked Entity chip (if entity_number set), Assignee avatar, SLA bar, Created At, Actions
// Row click → opens ticket detail drawer (not navigation)
// "+ New Ticket" button top-right
// Filter bar: status, priority, type, entity_type, assigned_to, tags, search, date range
// Export CSV button
// Keyboard: Ctrl+K → search modal
```

**Page 2: `apps/buyer-portal/app/(main)/tickets/board/page.tsx`** — Kanban Board
```tsx
// @dnd-kit DnDContext with 5 SortableContext columns (OPEN, IN_PROGRESS, PENDING_RESPONSE, RESOLVED, CLOSED)
// Ticket card: priority colored left border, title (60 char truncate), type badge,
//              assignee avatar, SLA chip (color-coded), entity link if present
// Column header: status label + count badge
// onDragEnd: call POST /api/v1/tickets/{id}/{transition-endpoint} based on source→destination
// Transition mapping:
//   OPEN → IN_PROGRESS: /start-progress
//   IN_PROGRESS → PENDING_RESPONSE: /pending-response
//   IN_PROGRESS → RESOLVED: opens resolve modal (resolution_note required)
//   RESOLVED → CLOSED: /close
//   any → REOPENED: /reopen (opens reason modal)
// Filter persists across list/board toggle (URL query params via nuqs)
```

**Page 3: `apps/buyer-portal/app/(main)/tickets/[id]/page.tsx`** — Ticket Detail
```tsx
// Two-panel layout: left 65% detail, right 35% metadata
// Left panel:
//   - Ticket number + status badge header
//   - Title (h1, editable inline if owner or admin)
//   - Description (react-markdown render with remark-gfm)
//   - Entity chip: "Linked: PO-MUM-2026-000078 →" (clickable navigates to entity)
//   - Tags: colored chips, +Add tag inline editor
//   - Comment feed: ScrollArea, oldest top newest bottom
//     - Each comment: Avatar + name + timestamp + content (react-markdown)
//     - Internal notes: yellow bg + "🔒 Internal Note" badge (hidden from supplier view)
//     - Edit button on own comment if within 15 minutes
//     - "Edited" label if edited_at set
//     - Reply button (thread support)
//   - Activity log interleaved in gray: "Arjun Sharma changed status to IN_PROGRESS • 2h ago"
//   - Comment box: Textarea (min-height 100px), @mention autocomplete dropdown,
//     "Internal Note" toggle (shown only if user has ticket.add_internal_note perm),
//     attachment paperclip button, Submit button
// Right panel:
//   - Status selector (dropdown for allowed transitions based on FSM + user role)
//   - Priority selector (with colored dots)
//   - Assignee: User avatar + name, Change button → user search modal
//   - Reporter: Avatar + name (read-only)
//   - Created: relative timestamp ("3 hours ago")
//   - SLA: deadline datetime + progress bar (color-coded) + "Breached 2h ago" if BREACHED
//   - First Response: time taken (if first_response_at set)
//   - Watchers: avatar stack, +Add watcher
//   - Related tickets: list of TKT-xxx linked to same entity
//   - Action buttons: Resolve / Escalate / Close / Reopen based on status + role
```

**Page 4: Ticket Create Modal (global)** — `packages/components/tickets/CreateTicketModal.tsx`
```tsx
// Triggered from anywhere: header button, entity detail page Tickets tab, keyboard shortcut Ctrl+N
// Form fields:
//   - Title: text input, required, min 5 chars, max 500 chars
//   - Description: Markdown textarea with "Write | Preview" tabs, min 20 chars
//   - Type: Radio/Select with icons (Query ?, Bug 🐛, Discrepancy ⚠, Complaint 😤, etc.)
//   - Priority: 4-option radio with impact description per level
//   - Category: dropdown (Procurement, Finance, Technical, Vendor, General)
//   - Link to Entity: 2-step: select entity type → search entity by number/name
//     (auto-filled when opened from entity detail page)
//   - Tags: CreatableSelect multi-input
//   - Is Private: toggle (only for non-supplier users with perm)
//   - Attachments: drag-and-drop zone, shows uploaded file chips
// Zod schema validates all fields with same constraints as backend Pydantic schema
// On submit: POST /api/v1/tickets, then navigate to /tickets/{id}
```

**Page 5: Tickets Tab on Entity Detail Pages**
```tsx
// Add "Tickets" tab to: PRDetail, RFQDetail, PODetail, InvoiceDetail, ContractDetail, VendorDetail
// Tab label shows count: "Tickets (2)" using GET /api/v1/tickets?entity_type=X&entity_id=Y
// Tab content: mini ticket list (number, title, priority, status, created)
// "+ Raise Ticket" button pre-fills entity_type and entity_id in create modal
```

**Page 6: `apps/buyer-portal/app/(main)/tickets/assigned/page.tsx`** — Assigned to Me
Simple filtered view: same list component with assigned_to_me=true filter applied.

**Page 7: `apps/buyer-portal/app/(main)/tickets/my/page.tsx`** — My Raised Tickets
Simple filtered view with my_tickets=true filter.

**Page 8: Sidebar navigation update** — add Support & Tickets section:
```tsx
{section: 'Support'},
{id:'tickets', icon:'ti-ticket', label:'All Tickets'},
{id:'tickets-mine', icon:'ti-message-circle', label:'My Tickets'},
{id:'tickets-assigned', icon:'ti-checkbox', label:'Assigned to Me', badge: assignedCount},
{id:'tickets-board', icon:'ti-layout-kanban', label:'Kanban Board'},
```

### 2.21 Frontend — Supplier Portal Pages (3 pages)

**Page 1: `apps/supplier-portal/app/(main)/tickets/page.tsx`** — My Tickets
Same list but:
- Only shows `raised_by = current_user.id` (enforced server-side too)
- Status shown with customer-friendly labels
- No internal notes visible
- No "All Tickets" or team filtering

**Page 2: `apps/supplier-portal/app/(main)/tickets/new/page.tsx`** — Raise Ticket
Simplified form:
- Type limited to: QUERY, DISCREPANCY, COMPLAINT, SUPPORT
- Entity link: dropdown limited to supplier's own POs/Invoices/RFQs
- No is_private toggle
- No internal note option

**Page 3: `apps/supplier-portal/app/(main)/tickets/[id]/page.tsx`** — Ticket Detail (Restricted)
Same layout BUT:
- Internal notes NOT rendered (filtered by API, double-checked client-side by `is_internal` flag)
- Cannot change assignee, priority, or status directly
- CAN add comments (normal, non-internal)
- Action buttons: "Close" (if RESOLVED) and "Reopen" (if RESOLVED, within 30 days)
- Status labels customer-friendly: "We're working on it" (IN_PROGRESS), "Waiting for your reply" (PENDING_RESPONSE)

### 2.22 Frontend — Admin Portal Pages (4 pages)

**Page 1: `apps/admin-portal/app/(main)/tickets/page.tsx`** — All Tickets
Full access: all org tickets, all filter options, bulk actions (assign, change priority, export).

**Page 2: `apps/admin-portal/app/(main)/tickets/dashboard/page.tsx`** — Ticket Dashboard
```tsx
// KPI row: Open, In Progress, Escalated, Breached SLA (red), Resolved Today, Avg Resolution Hours
// Charts:
//   - Tickets by Type (Bar chart: last 30 days)
//   - Tickets by Priority (Donut)
//   - SLA Compliance Rate (Gauge: % within SLA this month)
//   - Open tickets by Assignee (leaderboard table)
//   - Volume trend (Line chart: tickets created per day last 30d)
// API: GET /api/v1/tickets/dashboard + /api/v1/analytics/tickets (if added to analytics module)
```

**Page 3: `apps/admin-portal/app/(main)/tickets/sla-config/page.tsx`** — SLA Configuration
```tsx
// Table: 4 rows (CRITICAL/HIGH/MEDIUM/LOW), 3 editable columns (First Response, Resolution, Escalation hours)
// Inline edit: click cell → number input → save on blur
// PUT /api/v1/tickets/sla-config (array of all 4 configs)
// "Reset to Defaults" button with confirmation
// Shows "Last updated by X on Y" per row (from audit log)
```

**Page 4: `apps/admin-portal/app/(main)/tickets/reports/page.tsx`** — Ticket Reports
```tsx
// Date range selector (default: this month)
// Exportable tables:
//   - Ticket volume by type + category
//   - Avg resolution time by priority
//   - SLA compliance % by team
//   - Agent performance: tickets handled, avg resolution, SLA compliance per assignee
//   - Top 10 entity types by ticket volume (which PRs/POs raise most issues)
```

---
## STEP 3 — TEST (Three Personas)

### 3.1 User Persona
```
1. Buyer raises QUERY ticket linked to PO-MUM-2026-000078 → ticket appears in PO detail Tickets tab
2. Add comment "@ArjunSharma please review" → Arjun auto-added as watcher + in-app notification appears in his browser within 1s (WebSocket)
3. Assignee adds internal note "Internal: vendor fault, do not disclose" → supplier viewing same ticket does NOT see this comment
4. Assignee resolves with "Resolution: Vendor agreed to replace faulty units" → raiser gets email
5. Raiser rejects resolution (Reopen) → ticket status REOPENED, reopen_count=1, assignee notified
6. CRITICAL ticket with no action for 4h → Celery marks BREACHED, auto-escalates to ESCALATED status
7. Drag ticket card from OPEN to IN_PROGRESS on Kanban → status transition API fires + card moves
```

### 3.2 Developer Persona
```python
async def test_ticket_number_format(db, factory):
    ticket = await ticket_svc.create(db, TicketCreateRequest(title="Test", description="A"*20,
        ticket_type="QUERY", priority="MEDIUM"), actor_id, org_id, "buyer")
    assert re.match(r'^TKT-[A-Z]{3}-\d{4}-\d{6}$', ticket.ticket_number)

async def test_ticket_number_unique_concurrent(db, factory):
    """50 concurrent ticket creations produce 50 unique numbers."""
    results = await asyncio.gather(*[ticket_svc.create(db, ...) for _ in range(50)])
    numbers = [r.ticket_number for r in results]
    assert len(set(numbers)) == 50

async def test_sla_breach_computed_on_create(db, factory):
    ticket = await ticket_svc.create(db, TicketCreateRequest(priority="HIGH", ...), ...)
    expected = ticket.created_at + timedelta(hours=24)
    assert abs((ticket.sla_breach_at.replace(tzinfo=None) - expected).total_seconds()) < 5

async def test_supplier_cannot_see_internal_comment(db, factory):
    ticket = await factory.create_ticket(raised_by_portal="supplier")
    await ticket_svc.add_comment(db, ticket.id, "Top secret note", True, buyer_id, org_id, is_supplier=False)
    comments, _ = await ticket_svc.get_comments(db, ticket.id, org_id, is_supplier=True, cursor=None)
    assert not any(c.is_internal for c in comments)

async def test_supplier_add_internal_raises(db, factory):
    ticket = await factory.create_ticket()
    with pytest.raises(ForbiddenError, match="SUPPLIER_CANNOT_ADD_INTERNAL"):
        await ticket_svc.add_comment(db, ticket.id, "Secret", True, supplier_id, org_id, is_supplier=True)

async def test_edit_comment_15min_window(db, factory):
    comment = await ticket_svc.add_comment(db, ticket_id, "Original", False, actor_id, org_id)
    edited = await ticket_svc.edit_comment(db, comment.id, "Updated", actor_id, org_id)
    assert edited.content == "Updated"
    assert edited.edited_at is not None

async def test_edit_comment_after_15min_fails(db, factory):
    comment = await factory.create_comment(created_at=datetime.utcnow()-timedelta(minutes=16))
    with pytest.raises(AppException, match="EDIT_WINDOW_CLOSED"):
        await ticket_svc.edit_comment(db, comment.id, "Late edit", actor_id, org_id)

async def test_private_ticket_hidden_from_non_owner(db, factory):
    ticket = await ticket_svc.create(db, TicketCreateRequest(is_private=True, ...), user_a, org_id, "buyer")
    tickets, _ = await ticket_svc.get_list(db, TicketFilters(limit=100, offset=0), user_b, org_id, False)
    assert str(ticket.id) not in [str(t.id) for t in tickets]

async def test_private_ticket_visible_to_owner(db, factory):
    ticket = await ticket_svc.create(db, TicketCreateRequest(is_private=True, ...), user_a, org_id, "buyer")
    tickets, _ = await ticket_svc.get_list(db, TicketFilters(limit=100, offset=0), user_a, org_id, False)
    assert str(ticket.id) in [str(t.id) for t in tickets]

async def test_mention_auto_adds_watcher(db, factory):
    ticket = await factory.create_ticket()
    await ticket_svc.add_comment(db, ticket.id, "Hey @arjun please check", False, actor_id, org_id)
    watchers = await ticket_repo.get_watchers(db, ticket.id, org_id)
    assert arjun_user.id in [w.user_id for w in watchers]

async def test_fsm_open_cannot_go_to_resolved(db, factory):
    ticket = await factory.create_ticket(status="OPEN")
    with pytest.raises(AppException, match="INVALID_TICKET_TRANSITION"):
        await ticket_svc.resolve(db, ticket.id, "Early resolve attempt", actor_id, org_id)

async def test_resolution_note_too_short(db, factory):
    ticket = await factory.create_ticket(status="IN_PROGRESS")
    with pytest.raises(ValidationError, match="RESOLUTION_NOTE_REQUIRED"):
        await ticket_svc.resolve(db, ticket.id, "short", actor_id, org_id)

async def test_reopen_after_30_days_blocked(db, factory):
    ticket = await factory.create_ticket(status="CLOSED",
        updated_at=datetime.utcnow()-timedelta(days=31))
    with pytest.raises(AppException, match="REOPEN_WINDOW_EXPIRED"):
        await ticket_svc.reopen(db, ticket.id, "Reason", non_admin_id, org_id)

async def test_sla_celery_marks_critical_breached(db, factory, mock_celery):
    ticket = await factory.create_ticket(status="OPEN", priority="CRITICAL",
        sla_breach_at=datetime.utcnow()-timedelta(hours=1), sla_status="WITHIN_SLA")
    await _check_sla()
    await db.refresh(ticket)
    assert ticket.sla_status == "BREACHED"
    assert ticket.status == "ESCALATED"

async def test_auto_close_resolved_3_days(db, factory):
    ticket = await factory.create_ticket(status="RESOLVED",
        updated_at=datetime.utcnow()-timedelta(days=4))
    await _auto_close()
    await db.refresh(ticket)
    assert ticket.status == "CLOSED"

async def test_supplier_can_only_reopen_own_ticket(db, factory):
    ticket_other = await factory.create_ticket(raised_by=other_supplier_id, status="RESOLVED")
    with pytest.raises(ForbiddenError, match="NOT_TICKET_OWNER"):
        await ticket_svc.reopen(db, ticket_other.id, "Reopen", current_supplier_id, org_id, is_supplier=True)

async def test_es_search_indexes_ticket(db, factory):
    ticket = await factory.create_ticket(title="Invoice discrepancy in PO-MUM-000078")
    await asyncio.sleep(1)  # ES index async
    results = await ticket_svc.search_service.search(org_id, "invoice discrepancy", {})
    assert str(ticket.id) in [r["ticket_id"] for r in results]

async def test_dashboard_counts_accurate(db, factory):
    await factory.create_ticket(status="OPEN", count=3)
    await factory.create_ticket(status="IN_PROGRESS", count=2)
    dashboard = await ticket_svc.get_dashboard(db, actor_id, org_id)
    assert dashboard["by_status"]["OPEN"] == 3
    assert dashboard["by_status"]["IN_PROGRESS"] == 2
```

### 3.3 QA Persona
```
- 500 concurrent ticket creations: all get unique numbers, no 500 errors, database consistent
- Kanban drag OPEN→IN_PROGRESS: API fires, card stays in new column on refresh (not optimistic-only)
- WebSocket: user A adds comment → user B's browser receives it in < 500ms without page refresh
- Search "invoice discrepancy" → returns tickets with highlighted terms in title/description
- Supplier logs in → cannot see any buyer-only tickets, cannot see internal notes
- Admin edits SLA config (MEDIUM resolution = 48h instead of 72h) → new tickets get correct breach_at
- 1000 ticket Celery SLA check: completes in < 60 seconds, no timeout
- Full text search 10,000 tickets: returns in < 1s
- Notification: ticket assigned → assignee's email received via SendGrid within 2 minutes
- Tickets tab on PO detail: badge shows correct count, pre-fills entity on new ticket creation
- Supplier portal: internal notes not visible in DOM (inspect element confirms no hidden elements)
- Auto-close: set RESOLVED ticket updated_at to 4 days ago → daily task closes it + raiser email sent
- Reopen count: reopen 3 times → reopen_count = 3 in DB
- Priority change: re-computes sla_breach_at based on new priority SLA config
- Export 5000 tickets CSV: downloads successfully, streaming (no timeout), all rows present
```

---
## STEP 4 — INTEGRATE
```bash
# Run new migrations
alembic upgrade head  # Runs 0028 through 0034
# Verify tables
psql -U postgres -d procurement -c "\dt ticket*"  # Should show 6 tables
# Add exchange and queue
python scripts/rabbitmq_setup.py
# Verify: management UI at localhost:15672 shows procurement.ticket exchange and q.ticket.events
# Seed notification templates
python scripts/seed_notification_templates.py
# Verify ticket permissions in DB
psql -U postgres -d procurement -c "SELECT code FROM permissions WHERE code LIKE 'ticket.%'"
# Run full test suite for ticket module
pytest tests/unit/test_ticket_service.py tests/integration/test_tickets.py -v --cov=app/modules/ticket --cov-fail-under=85
# Verify Celery tasks registered
celery -A app.tasks.celery_app inspect registered | grep ticket
# Test ES indexing
curl -X POST http://localhost:9200/tickets-$(date +%Y.%m)/_search -H 'Content-Type: application/json' -d '{"query":{"match_all":{}}}'
# Full regression
pytest tests/ -v --cov=app --cov-fail-under=80
```

---
## STEP 5 — GRAPHIFY UPDATE
```bash
graphify update
# New nodes to add:
# - service: TicketService (app/modules/ticket/service.py) — 16 methods
# - service: TicketSLAService (app/modules/ticket/sla_service.py)
# - service: TicketSearchService (app/modules/ticket/search_service.py)
# - parser: MentionParser (app/modules/ticket/mention_parser.py)
# - fsm: TicketFSM (app/modules/ticket/fsm.py)
# - router: TicketRouter (app/modules/ticket/router.py) — 30+ endpoints
# - celery_task: check_ticket_sla_timers
# - celery_task: auto_close_idle_tickets
# - celery_task: send_ticket_digest
# - model: Ticket, TicketComment, TicketAttachment, TicketWatcher, TicketActivityLog, TicketSLAConfig
# Updated nodes:
# - rabbitmq_setup: added procurement.ticket exchange, q.ticket.events
# - celery_app: 3 new Beat schedule entries
# - NotificationConsumer: handles ticket.* routing keys
# - JWT: portal claim added
# - main_app: ticket router registered
graphify check --integrity
graphify diff > graphify_diff_ticket_$(date +%Y%m%d_%H%M%S).txt
```

---
## STEP 6 — README + COMMIT
```markdown
## Current Session State
**Status:** SPEC_26 Ticket System — FULLY IMPLEMENTED AND TESTED
**New DB Tables:** 6 (tickets, ticket_comments, ticket_attachments, ticket_watchers,
                    ticket_activity_log, ticket_sla_config)
**New ENUMs:** 3 (ticket_type 8-val, ticket_priority 4-val, ticket_status 7-val)
**New Migrations:** 0028 through 0034 (7 migrations)
**New Permissions:** 12 ticket.* permissions assigned to all 10 roles
**New APIs:** 30+ endpoints under /api/v1/tickets
**New Celery Tasks:** check_ticket_sla_timers (15min), auto_close_idle_tickets (daily 01:00), send_ticket_digest (daily 08:00)
**New RabbitMQ:** procurement.ticket exchange + q.ticket.events + q.dlq.ticket
**Frontend:** 15 pages (Buyer:8, Supplier:3, Admin:4); @dnd-kit Kanban; react-markdown comments
**JWT:** portal claim (buyer/supplier/admin) added to access tokens
**Notification Templates:** 9 new ticket templates seeded
**Migration Head:** 0034_ticket_permissions
**Test Coverage:** ticket module ≥ 85%
**Next:** Final regression across all 26 modules → production deployment
```
```bash
git add -A
git commit -m "[NON-BREAKING] feat: SPEC_26 — Jira-style ticket system; Kanban; @mentions; internal notes; SLA timers; ES search; real-time WebSocket comments; 3-portal UI; 7 migrations; 12 permissions"
```
