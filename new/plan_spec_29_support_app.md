# IMPLEMENTATION PLAN — SPEC_29: Support App (Standalone Helpdesk)
**Module:** 29 | **Phase:** Enhancement | **Squad:** E
**Plan Date:** 2026-08-04 | **App Port:** 3004

---
## SESSION BOOTSTRAP
- [x] GEMINI.md; all ABSOLUTE RULES apply
- [x] Graphify; SPEC_01–28 implemented
- [x] SPEC_29 analyzed: 3 modules, separate schema, separate Next.js app

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-29-1 | Support app tables live in a `support` PostgreSQL schema within the SAME database (not separate DB); RLS enforced at app level | Simpler ops; separate DB adds operational complexity | MEDIUM | Squad E |
| A-29-2 | Support app authenticates existing procurement users via the SAME JWT RS256 keys; no second login needed | UX: single sign-on experience | LOW | Squad E |
| A-29-3 | Support agents are separate accounts (support_agents table); agent can optionally link to a procurement user via `procurement_user_id` | Support agents may be contractors without procurement system access | LOW | Squad E |
| A-29-4 | KB articles authored in MDX stored as plain text in DB; rendered client-side via next-mdx-remote; no server-side MDX compilation in API layer | API layer returns raw MDX string; rendering in Next.js | LOW | FE Lead |
| A-29-5 | Email-to-ticket (inbound email) deferred to Phase 2; Phase 1 web form only | Inbound email requires Mailgun/SendGrid Inbound Parse webhook setup | LOW | Squad E |
| A-29-6 | Inbound webhook from procurement portal (ticket raised from procurement entity page) uses the existing webhook_endpoints table from SPEC_27-D registered as a `support.ticket.created` event consumer | Reuse existing webhook infra | LOW | Squad E |
| A-29-7 | CSAT survey sent via existing notification service (SPEC_16) using template SUPPORT_CSAT_REQUEST | Reuses email channel | LOW | Squad E |
| A-29-8 | Business-hours SLA calculation uses org's timezone from `tenant_settings.timezone`; IANA timezone string (e.g. "Asia/Kolkata") | Standard timezone library (pytz/ZoneInfo) | LOW | Squad E |
| A-29-9 | Article `search_vector` tsvector column updated via PostgreSQL trigger on INSERT/UPDATE of knowledge_base_articles; no application-layer update needed | Keeps search index always current | LOW | Squad E |
| A-29-10 | Auto-assignment rules evaluated in sort_order ASC; first matching rule wins; if no rule matches → ticket stays OPEN, unassigned, alert fires to support team Slack/email | SPEC_29 Section 3.3 | MEDIUM | Squad E |

---
## STEP 2 — IMPLEMENT

### 2.1 Settings Additions (`app/config.py`)
```python
# Support App
SUPPORT_APP_PORT: int = 3004
SUPPORT_TICKET_AUTO_CLOSE_DAYS: int = 3      # RESOLVED → CLOSED
SUPPORT_TICKET_AUTO_CLOSE_PENDING_DAYS: int = 7  # PENDING → CLOSED
SUPPORT_CSAT_FOLLOW_UP_HOURS: int = 24
SUPPORT_MAX_AGENTS: int = 50
SUPPORT_EMAIL_ADDRESS: str = "support@procureos.com"
```

### 2.2 Migrations (Support Schema)
```
0051_support_schema.py          → CREATE SCHEMA support
0052_support_enums.py           → support_priority_enum, support_status_enum
0053_support_agents.py          → support.support_agents table
0054_support_kb.py              → support.kb_categories, support.knowledge_base_articles
0055_support_tickets.py         → support.support_tickets, support.support_ticket_messages
0056_support_config.py          → support.canned_responses, support.support_sla_policies, support.support_auto_rules
0057_support_indexes.py         → all CONCURRENTLY indexes
0058_support_triggers.py        → tsvector update trigger on knowledge_base_articles
0059_support_seed.py            → seed default SLA policies, 5 KB categories, 10 starter articles
```

**`alembic/versions/0051_support_schema.py`:**
```python
def upgrade():
    op.execute("CREATE SCHEMA IF NOT EXISTS support")

def downgrade():
    op.execute("DROP SCHEMA IF EXISTS support CASCADE")
```

**`alembic/versions/0052_support_enums.py`:**
```python
def upgrade():
    op.execute("""
        CREATE TYPE support.support_priority_enum AS ENUM ('CRITICAL','HIGH','MEDIUM','LOW')
    """)
    op.execute("""
        CREATE TYPE support.support_status_enum AS ENUM (
          'OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER','WAITING_ON_THIRD_PARTY',
          'RESOLVED','CLOSED','SPAM','MERGED'
        )
    """)

def downgrade():
    op.execute("DROP TYPE IF EXISTS support.support_priority_enum CASCADE")
    op.execute("DROP TYPE IF EXISTS support.support_status_enum CASCADE")
```

**`alembic/versions/0055_support_tickets.py`:**
```python
def upgrade():
    # support.support_tickets — all columns from SPEC_29 Section 2.1
    op.execute("""
        CREATE TABLE support.support_tickets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ticket_number VARCHAR(30) NOT NULL UNIQUE,
            org_id UUID NOT NULL,
            raised_by_user_id UUID NOT NULL,
            raised_by_email VARCHAR(255) NOT NULL,
            raised_by_name VARCHAR(255) NOT NULL,
            raised_by_portal VARCHAR(20) NOT NULL,
            title VARCHAR(500) NOT NULL,
            description TEXT NOT NULL,
            category VARCHAR(100) NOT NULL,
            sub_category VARCHAR(100),
            priority support.support_priority_enum NOT NULL DEFAULT 'MEDIUM',
            status support.support_status_enum NOT NULL DEFAULT 'OPEN',
            channel VARCHAR(20) DEFAULT 'WEB',
            assigned_agent_id UUID REFERENCES support.support_agents(id),
            assigned_team VARCHAR(100),
            first_response_at TIMESTAMP WITH TIME ZONE,
            resolved_at TIMESTAMP WITH TIME ZONE,
            closed_at TIMESTAMP WITH TIME ZONE,
            sla_first_response_deadline TIMESTAMP WITH TIME ZONE,
            sla_resolution_deadline TIMESTAMP WITH TIME ZONE,
            sla_status VARCHAR(20) DEFAULT 'WITHIN_SLA',
            csat_score INT,
            csat_comment TEXT,
            reopen_count INT DEFAULT 0,
            tags TEXT[],
            related_procurement_entity_type VARCHAR(50),
            related_procurement_entity_id UUID,
            is_spam BOOL DEFAULT FALSE,
            version INT DEFAULT 1,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMP WITH TIME ZONE
        )
    """)
    # support.support_ticket_messages
    op.execute("""
        CREATE TABLE support.support_ticket_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ticket_id UUID NOT NULL REFERENCES support.support_tickets(id) ON DELETE CASCADE,
            author_type VARCHAR(10) NOT NULL,
            author_id UUID,
            author_name VARCHAR(255) NOT NULL,
            author_email VARCHAR(255),
            content TEXT NOT NULL,
            is_internal BOOL DEFAULT FALSE,
            attachments JSONB DEFAULT '[]',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMP WITH TIME ZONE
        )
    """)

def downgrade():
    op.execute("DROP TABLE IF EXISTS support.support_ticket_messages CASCADE")
    op.execute("DROP TABLE IF EXISTS support.support_tickets CASCADE")
```

**`alembic/versions/0057_support_indexes.py`:**
```python
def upgrade():
    stmts = [
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sup_tickets_org_status ON support.support_tickets (org_id, status) WHERE deleted_at IS NULL",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sup_tickets_agent ON support.support_tickets (assigned_agent_id, status) WHERE deleted_at IS NULL",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sup_tickets_raised_by ON support.support_tickets (raised_by_user_id) WHERE deleted_at IS NULL",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sup_tickets_sla ON support.support_tickets (sla_resolution_deadline) WHERE status IN ('OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER')",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sup_messages_ticket ON support.support_ticket_messages (ticket_id, created_at) WHERE deleted_at IS NULL",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kb_articles_search ON support.knowledge_base_articles USING GIN (search_vector)",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kb_articles_category ON support.knowledge_base_articles (category_id, status) WHERE deleted_at IS NULL",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kb_articles_slug ON support.knowledge_base_articles (slug)",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_agents_active ON support.support_agents (is_active, is_available) WHERE deleted_at IS NULL",
    ]
    for stmt in stmts:
        op.execute(stmt)

def downgrade():
    for idx in ["idx_sup_tickets_org_status","idx_sup_tickets_agent","idx_sup_tickets_raised_by",
                "idx_sup_tickets_sla","idx_sup_messages_ticket","idx_kb_articles_search",
                "idx_kb_articles_category","idx_kb_articles_slug","idx_support_agents_active"]:
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS support.{idx}")
```

**`alembic/versions/0058_support_triggers.py`:**
```python
def upgrade():
    op.execute("""
        CREATE OR REPLACE FUNCTION support.update_kb_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.search_vector := to_tsvector('english',
                coalesce(NEW.title, '') || ' ' ||
                coalesce(NEW.content, '') || ' ' ||
                coalesce(array_to_string(NEW.tags, ' '), '')
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)
    op.execute("""
        CREATE TRIGGER trg_kb_search_vector
        BEFORE INSERT OR UPDATE ON support.knowledge_base_articles
        FOR EACH ROW EXECUTE FUNCTION support.update_kb_search_vector()
    """)

def downgrade():
    op.execute("DROP TRIGGER IF EXISTS trg_kb_search_vector ON support.knowledge_base_articles")
    op.execute("DROP FUNCTION IF EXISTS support.update_kb_search_vector()")
```

**`alembic/versions/0059_support_seed.py`:**
```python
DEFAULT_SLA = [
    {"priority": "CRITICAL", "first_response_hours": 1,  "resolution_hours": 4,   "business_hours_only": False},
    {"priority": "HIGH",     "first_response_hours": 4,  "resolution_hours": 24,  "business_hours_only": False},
    {"priority": "MEDIUM",   "first_response_hours": 8,  "resolution_hours": 72,  "business_hours_only": True},
    {"priority": "LOW",      "first_response_hours": 24, "resolution_hours": 168, "business_hours_only": True},
]
KB_CATEGORIES = [
    {"name": "Getting Started", "slug": "getting-started", "icon": "ti-rocket"},
    {"name": "Purchase Requisitions", "slug": "purchase-requisitions", "icon": "ti-file-plus"},
    {"name": "Vendor Management", "slug": "vendor-management", "icon": "ti-building-store"},
    {"name": "Invoices & Payments", "slug": "invoices-payments", "icon": "ti-receipt"},
    {"name": "Integrations & Admin", "slug": "integrations-admin", "icon": "ti-settings"},
    {"name": "Troubleshooting", "slug": "troubleshooting", "icon": "ti-bug"},
]

def upgrade():
    conn = op.get_bind()
    for sla in DEFAULT_SLA:
        conn.execute(text("""
            INSERT INTO support.support_sla_policies
              (id, org_id, name, priority, first_response_hours, resolution_hours,
               business_hours_only, version, created_at)
            VALUES (gen_random_uuid(), NULL, :name, :priority, :first_response_hours,
                    :resolution_hours, :business_hours_only, 1, NOW())
            ON CONFLICT DO NOTHING
        """), {"name": f"Default {sla['priority']}", **sla})
    for cat in KB_CATEGORIES:
        conn.execute(text("""
            INSERT INTO support.kb_categories (id, name, slug, icon, version, created_at)
            VALUES (gen_random_uuid(), :name, :slug, :icon, 1, NOW())
            ON CONFLICT (slug) DO NOTHING
        """), cat)

def downgrade():
    op.execute("DELETE FROM support.support_sla_policies WHERE org_id IS NULL")
    op.execute("DELETE FROM support.kb_categories")
```

### 2.3 SQLAlchemy Models
**File:** `support_app/models.py`
```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Boolean, Text, Integer, DateTime, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB, TSVECTOR

class SupportBase(DeclarativeBase):
    pass

class SupportTicket(SupportBase):
    __tablename__ = "support_tickets"
    __table_args__ = {"schema": "support"}
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    ticket_number: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    org_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    raised_by_user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    raised_by_email: Mapped[str] = mapped_column(String(255), nullable=False)
    raised_by_name: Mapped[str] = mapped_column(String(255), nullable=False)
    raised_by_portal: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    sub_category: Mapped[Optional[str]] = mapped_column(String(100))
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="MEDIUM")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="OPEN")
    assigned_agent_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True))
    assigned_team: Mapped[Optional[str]] = mapped_column(String(100))
    first_response_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    sla_first_response_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    sla_resolution_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    sla_status: Mapped[str] = mapped_column(String(20), default="WITHIN_SLA")
    csat_score: Mapped[Optional[int]] = mapped_column(Integer)
    csat_comment: Mapped[Optional[str]] = mapped_column(Text)
    reopen_count: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[list] = mapped_column(ARRAY(String), default=list)
    related_procurement_entity_type: Mapped[Optional[str]] = mapped_column(String(50))
    related_procurement_entity_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True))
    is_spam: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    messages: Mapped[list["SupportTicketMessage"]] = relationship(lazy="select")

class KBArticle(SupportBase):
    __tablename__ = "knowledge_base_articles"
    __table_args__ = {"schema": "support"}
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    slug: Mapped[str] = mapped_column(String(300), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True))
    author_agent_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True))
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    helpful_votes: Mapped[int] = mapped_column(Integer, default=0)
    not_helpful_votes: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[list] = mapped_column(ARRAY(String), default=list)
    search_vector: Mapped[Optional[str]] = mapped_column(TSVECTOR)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
```

### 2.4 Support App FastAPI Service
**File:** `support_app/main.py`:
```python
from fastapi import FastAPI
from support_app.routers import (
    customer_router, agent_router, admin_router, kb_router, status_router
)

def create_support_app() -> FastAPI:
    app = FastAPI(title="ProcureOS Support Center", version="1.0.0")
    app.include_router(customer_router, prefix="/support/api/v1")
    app.include_router(agent_router, prefix="/support/api/v1/agent")
    app.include_router(admin_router, prefix="/support/api/v1/admin")
    app.include_router(kb_router, prefix="/support/api/v1/kb")
    app.include_router(status_router, prefix="/support/api/v1/status")
    return app

app = create_support_app()
```

### 2.5 Core Support Ticket Service
```python
# support_app/services/ticket_service.py

class SupportTicketService:

    async def create(self, db, data: SupportTicketCreateRequest,
                     raiser_id: UUID, raiser_email: str, raiser_name: str,
                     org_id: UUID, portal: str) -> SupportTicket:
        ticket_number = await self._generate_number(db)
        # Get SLA policy for priority
        sla = await self.sla_repo.get_policy(db, org_id, data.priority)
        tz = await self.org_repo.get_timezone(db, org_id)
        now = datetime.utcnow()
        first_response_deadline = self._compute_sla(now, sla.first_response_hours,
            sla.business_hours_only, tz)
        resolution_deadline = self._compute_sla(now, sla.resolution_hours,
            sla.business_hours_only, tz)
        ticket = SupportTicket(
            ticket_number=ticket_number, org_id=org_id,
            raised_by_user_id=raiser_id, raised_by_email=raiser_email,
            raised_by_name=raiser_name, raised_by_portal=portal,
            title=data.title, description=data.description,
            category=data.category, priority=data.priority,
            related_procurement_entity_type=data.entity_type,
            related_procurement_entity_id=data.entity_id,
            sla_first_response_deadline=first_response_deadline,
            sla_resolution_deadline=resolution_deadline,
        )
        db.add(ticket)
        await db.flush()
        # Apply auto-assignment rules
        await self._apply_auto_rules(db, ticket)
        # Initial message
        msg = SupportTicketMessage(
            ticket_id=ticket.id, author_type="CUSTOMER",
            author_id=raiser_id, author_name=raiser_name,
            author_email=raiser_email, content=data.description,
        )
        db.add(msg)
        # Notify assigned agent
        if ticket.assigned_agent_id:
            await self._notify_agent_assigned(ticket)
        # Notify support team if unassigned
        else:
            await self._notify_team_unassigned(ticket)
        return ticket

    async def add_message(self, db, ticket_id: UUID, content: str,
                           author_type: str, author_id: UUID, author_name: str,
                           author_email: str, is_internal: bool,
                           attachments: list = None) -> SupportTicketMessage:
        ticket = await self.repo.get(db, ticket_id)
        if is_internal and author_type == "CUSTOMER":
            raise ForbiddenError("CUSTOMER_CANNOT_ADD_INTERNAL", "Customers cannot add internal notes")
        msg = SupportTicketMessage(
            ticket_id=ticket_id, author_type=author_type,
            author_id=author_id, author_name=author_name,
            author_email=author_email, content=content,
            is_internal=is_internal, attachments=attachments or [],
        )
        db.add(msg)
        # Track first response time
        if author_type == "AGENT" and not ticket.first_response_at:
            ticket.first_response_at = datetime.utcnow()
        # WAITING_ON_CUSTOMER → IN_PROGRESS when customer replies
        if (author_type == "CUSTOMER" and
                ticket.status == "WAITING_ON_CUSTOMER"):
            ticket.status = "IN_PROGRESS"
        # Notify appropriate parties
        if author_type == "CUSTOMER":
            await self._notify_agent_customer_replied(ticket)
        elif not is_internal:
            await self._notify_customer_agent_replied(ticket)
        return msg

    async def resolve(self, db, ticket_id: UUID, agent_id: UUID) -> SupportTicket:
        ticket = await self.repo.get(db, ticket_id)
        if ticket.assigned_agent_id != agent_id:
            raise ForbiddenError("NOT_ASSIGNED_AGENT", "Only the assigned agent can resolve")
        ticket.status = "RESOLVED"
        ticket.resolved_at = datetime.utcnow()
        # Add system message
        db.add(SupportTicketMessage(
            ticket_id=ticket_id, author_type="SYSTEM", author_name="System",
            content="This ticket has been marked as resolved.",
        ))
        # Schedule CSAT survey
        await self._schedule_csat_survey(ticket)
        return ticket

    async def submit_csat(self, db, ticket_id: UUID, score: int,
                           comment: str, raiser_id: UUID) -> SupportTicket:
        if score < 1 or score > 5:
            raise ValidationError("INVALID_CSAT_SCORE", "CSAT score must be 1-5")
        ticket = await self.repo.get(db, ticket_id)
        if ticket.raised_by_user_id != raiser_id:
            raise ForbiddenError("NOT_TICKET_OWNER", "Only ticket owner can submit CSAT")
        ticket.csat_score = score
        ticket.csat_comment = comment
        return ticket

    async def _apply_auto_rules(self, db, ticket: SupportTicket) -> None:
        rules = await self.rules_repo.get_active(db)
        for rule in sorted(rules, key=lambda r: r.sort_order):
            if await self._rule_matches(ticket, rule.conditions):
                for action in rule.actions:
                    await self._apply_action(db, ticket, action)
                return  # First matching rule wins
        # No rule matched → round-robin assignment
        agent = await self.agent_repo.get_next_available(db)
        if agent:
            ticket.assigned_agent_id = agent.id
            agent.current_open_count += 1

    async def _rule_matches(self, ticket: SupportTicket, conditions: list) -> bool:
        for condition in conditions:
            field_val = getattr(ticket, condition["field"], None)
            op, val = condition["op"], condition["value"]
            if op == "eq" and str(field_val) != str(val):
                return False
            elif op == "contains" and val.lower() not in str(field_val or "").lower():
                return False
            elif op == "in" and str(field_val) not in val:
                return False
        return True

    def _compute_sla(self, start: datetime, hours: int,
                      business_hours_only: bool, tz: str) -> datetime:
        if not business_hours_only:
            return start + timedelta(hours=hours)
        from zoneinfo import ZoneInfo
        BH_START, BH_END = 9, 18
        WORK_DAYS = {0, 1, 2, 3, 4}
        current = start.astimezone(ZoneInfo(tz))
        remaining = hours
        while remaining > 0:
            if current.weekday() in WORK_DAYS and BH_START <= current.hour < BH_END:
                current += timedelta(hours=1)
                remaining -= 1
            elif current.weekday() not in WORK_DAYS or current.hour >= BH_END:
                next_day = (current + timedelta(days=1)).replace(hour=BH_START, minute=0, second=0)
                while next_day.weekday() not in WORK_DAYS:
                    next_day += timedelta(days=1)
                current = next_day
            else:
                current = current.replace(hour=BH_START, minute=0, second=0)
        return current.astimezone(ZoneInfo("UTC"))

    async def _generate_number(self, db) -> str:
        year = datetime.utcnow().year
        seq = f"seq_sup_{year}"
        await db.execute(text(f"CREATE SEQUENCE IF NOT EXISTS support.{seq} START 1"))
        result = await db.execute(text(f"SELECT nextval('support.{seq}')"))
        n = result.scalar()
        return f"SUP-{year}-{str(n).zfill(6)}"
```

### 2.6 Knowledge Base Service
```python
# support_app/services/kb_service.py

class KBService:

    async def search(self, db, query: str, category_slug: str = None,
                     limit: int = 10) -> list[dict]:
        sql = text("""
            SELECT id, slug, title, category_id,
                   ts_rank(search_vector, plainto_tsquery('english', :query)) AS rank,
                   ts_headline('english', content, plainto_tsquery('english', :query),
                       'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20') AS snippet
            FROM support.knowledge_base_articles
            WHERE search_vector @@ plainto_tsquery('english', :query)
              AND status = 'PUBLISHED'
              AND deleted_at IS NULL
              """ + ("AND category_id = (SELECT id FROM support.kb_categories WHERE slug = :cat)" if category_slug else "") + """
            ORDER BY rank DESC
            LIMIT :limit
        """)
        params = {"query": query, "limit": limit}
        if category_slug:
            params["cat"] = category_slug
        result = await db.execute(sql, params)
        return [dict(row) for row in result.fetchall()]

    async def record_view(self, db, article_id: UUID) -> None:
        await db.execute(
            text("UPDATE support.knowledge_base_articles SET view_count = view_count + 1 WHERE id = :id"),
            {"id": article_id}
        )

    async def vote(self, db, article_id: UUID, helpful: bool) -> None:
        col = "helpful_votes" if helpful else "not_helpful_votes"
        await db.execute(
            text(f"UPDATE support.knowledge_base_articles SET {col} = {col} + 1 WHERE id = :id"),
            {"id": article_id}
        )
```

### 2.7 Support SLA Celery Tasks
```python
# support_app/tasks/sla_tasks.py

@celery_app.task(queue="celery.sla_timers", name="check_support_ticket_sla")
def check_support_ticket_sla():
    asyncio.run(_check_support_sla())

async def _check_support_sla():
    async with support_session_factory() as db:
        now = datetime.utcnow()
        active = await support_ticket_repo.get_active_with_sla(db)
        for ticket in active:
            if ticket.sla_first_response_deadline and not ticket.first_response_at:
                if now > ticket.sla_first_response_deadline.replace(tzinfo=None):
                    ticket.sla_status = "FIRST_RESPONSE_BREACHED"
                    await publisher.publish("procurement.notification",
                        "notification.email.support_sla_breach",
                        {"ticket_id": str(ticket.id), "ticket_number": ticket.ticket_number,
                         "breach_type": "FIRST_RESPONSE", "agent_id": str(ticket.assigned_agent_id)},
                        ticket.org_id)
            if ticket.sla_resolution_deadline:
                if now > ticket.sla_resolution_deadline.replace(tzinfo=None):
                    if ticket.sla_status != "RESOLUTION_BREACHED":
                        ticket.sla_status = "RESOLUTION_BREACHED"
                        await publisher.publish("procurement.notification",
                            "notification.email.support_sla_breach",
                            {"ticket_id": str(ticket.id), "ticket_number": ticket.ticket_number,
                             "breach_type": "RESOLUTION"}, ticket.org_id)
        await db.commit()

@celery_app.task(queue="celery.maintenance", name="auto_close_support_tickets")
def auto_close_support_tickets():
    asyncio.run(_auto_close_support())

async def _auto_close_support():
    async with support_session_factory() as db:
        now = datetime.utcnow()
        resolved_cutoff = now - timedelta(days=settings.SUPPORT_TICKET_AUTO_CLOSE_DAYS)
        pending_cutoff = now - timedelta(days=settings.SUPPORT_TICKET_AUTO_CLOSE_PENDING_DAYS)
        resolved = await support_ticket_repo.get_stale_resolved(db, resolved_cutoff)
        for t in resolved:
            t.status = "CLOSED"
            t.closed_at = now
            # Send CSAT survey
            await publisher.publish("procurement.notification",
                "notification.email.support_csat_request",
                {"ticket_id": str(t.id), "ticket_number": t.ticket_number,
                 "raised_by_email": t.raised_by_email,
                 "template_code": "SUPPORT_CSAT_REQUEST"}, t.org_id)
        pending = await support_ticket_repo.get_stale_waiting(db, pending_cutoff)
        for t in pending:
            t.status = "CLOSED"
            t.closed_at = now
        await db.commit()

@celery_app.task(queue="celery.maintenance", name="send_support_agent_digest")
def send_support_agent_digest():
    asyncio.run(_support_digest())
```

### 2.8 Frontend — Support App (apps/support-portal/)
```
procurement-portal-frontend/
└── apps/
    └── support-portal/           ← New Next.js 14 app (port 3004)
        ├── app/
        │   ├── (public)/
        │   │   ├── page.tsx                ← Help center home (search + categories)
        │   │   ├── help/[category]/page.tsx ← Category article list
        │   │   ├── help/article/[slug]/     ← Article detail (next-mdx-remote render)
        │   │   ├── help/search/page.tsx     ← Search results
        │   │   └── status/page.tsx          ← Platform status
        │   ├── (customer)/                  ← Auth: procurement JWT
        │   │   ├── tickets/page.tsx         ← My tickets list
        │   │   ├── tickets/new/page.tsx     ← Raise ticket form
        │   │   └── tickets/[id]/page.tsx    ← Conversation thread
        │   └── (agent)/                     ← Auth: agent JWT
        │       ├── queue/page.tsx           ← Agent ticket queue
        │       ├── tickets/[id]/page.tsx    ← Agent ticket view
        │       ├── kb/page.tsx             ← KB article management
        │       └── reports/page.tsx         ← SLA + CSAT reports
        ├── components/
        │   ├── HelpSearchWidget.tsx         ← Embeddable search for 3 portals
        │   ├── ArticleRenderer.tsx          ← next-mdx-remote MDX render
        │   ├── TicketConversation.tsx       ← Message thread UI
        │   ├── CannedResponsePicker.tsx     ← Agent '/' shortcut picker
        │   ├── SLACountdown.tsx             ← Deadline countdown widget
        │   ├── CSATWidget.tsx               ← 5-star + comment form
        │   └── AgentDashboard.tsx           ← Queue overview + stats
        └── Dockerfile
```

**`HelpSearchWidget.tsx`** — embedded in all 3 procurement portals:
```tsx
// Small "? Help" floating button fixed bottom-right in all portals
// Click → slide-over panel (Radix UI Sheet)
// Search input with 300ms debounce → calls GET /support/api/v1/kb/search
// Results: title + snippet + category breadcrumb
// "Still need help?" → "Raise a Support Ticket" button → opens /tickets/new in new tab
// Pre-fills entity context if opened from entity page (PR/PO/Invoice)
```

**`TicketConversation.tsx`** — customer view:
```tsx
// Timeline: alternating message bubbles (customer=right/blue, agent=left/gray)
// Internal notes NOT rendered in customer view (filtered by API)
// Attachment download via presigned URL
// Add Reply box: simple textarea (no markdown — simpler for customers)
// Status timeline: linear steps (Open → In Progress → Resolved → Closed)
// SLA countdown chip (only visible if first_response_at not yet set)
// CSAT widget: appears at top when status=CLOSED and csat_score=NULL
```

**Agent Queue (`apps/support-portal/app/(agent)/queue/page.tsx`):**
```tsx
// Left: filters (status, priority, team, mine/unassigned/all)
// Sort: oldest first, SLA breach first (default), priority first
// Table: ticket number, customer name, org, category, priority badge,
//        SLA countdown (red if breached), assigned agent avatar, status, actions
// Quick assign: drag ticket to agent list OR click "Take" button
// Bulk actions: assign, change priority, close (max 25 at once)
// Refresh every 30s via TanStack Query refetchInterval
```

**Canned Response Picker:**
```tsx
// In agent reply textarea: type '/' → dropdown appears
// Search canned responses by title or shortcut
// Click → inserts template into textarea
// Variables: {{customer_name}}, {{ticket_number}}, {{org_name}} auto-filled
```

---
## STEP 3 — TEST

### Unit Tests
```python
# SLA computation
test_sla_compute_calendar_hours()
test_sla_compute_business_hours_skips_weekends()
test_sla_compute_business_hours_skips_after_hours()
test_sla_compute_critical_no_business_hours_restriction()

# Auto-assignment
test_auto_assignment_first_matching_rule_wins()
test_auto_assignment_round_robin_when_no_rule()
test_auto_assignment_skips_unavailable_agent()
test_auto_assignment_respects_max_tickets()

# Ticket FSM
test_waiting_on_customer_to_in_progress_on_customer_reply()
test_customer_cannot_add_internal_note()
test_resolve_only_by_assigned_agent()
test_csat_score_must_be_1_to_5()
test_ticket_number_format_SUP_YYYY_NNNNNN()

# KB Search
test_kb_search_returns_highlighted_snippets()
test_kb_search_filtered_by_category()
test_kb_view_count_increments()
test_kb_helpful_vote_increments()
test_kb_search_vector_updated_on_article_save()  # trigger test

# Auto-close
test_resolved_3d_auto_closed_with_csat_survey()
test_waiting_7d_auto_closed()
```

### QA Tests
```
- Customer raises ticket → auto-assigned to agent → agent notified
- Agent responds → customer receives notification (in-app + email)
- Internal note added → NOT visible in customer conversation view
- CRITICAL ticket breaches first_response SLA (1h) → agent email alert fires
- MEDIUM ticket: SLA computed business hours only (skip weekend)
- Search "invoice discrepancy" → articles with those terms returned with highlight
- KB article vote: click helpful → helpful_votes incremented in DB
- CSAT: close ticket → 24h later reminder email → customer submits 4-star → score saved
- Auto-close: RESOLVED ticket after 3 days → status=CLOSED, CSAT email sent
- Support portal SSO: login with procurement JWT → no second password needed
- Canned response: type /thanks → template inserted into reply box
- Agent dashboard: open queue shows correct unresolved count
- SLA report: correctly shows % within first_response and resolution SLA
```

---
## STEP 5 — GRAPHIFY UPDATE
```bash
graphify update
# New nodes: SupportTicketService, KBService, SLAComputationService,
#            AutoAssignmentEngine, SupportAgentService, SupportSLATask,
#            SupportAutoCloseTask, SupportPortalApp (Next.js port 3004)
# New tables: 8 tables in support schema
graphify check --integrity
```
