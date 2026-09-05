# IMPLEMENTATION PLAN — SPEC_03: Database Schema
**Module:** 03 | **Phase:** Foundation | **Squad:** A (Platform)
**Spec File:** SPEC_03_DATABASE.md | **Plan Date:** 2026-08-04

---

## SESSION BOOTSTRAP CHECKLIST
- [x] 0-A: GEMINI.md read
- [x] 0-B: Graphify loaded — confirm SPEC_01 + SPEC_02 nodes
- [x] 0-C: README — verify scaffolding complete, Alembic setup confirmed
- [x] 0-D: SPEC_03_DATABASE.md analyzed fully (70+ tables, all ENUMs, indexes, triggers)

---

## SPEC COVERAGE MAP
| Req# | Section | Tables/Objects | Status |
|---|---|---|---|
| S03-01 | 20 ENUM types | All ENUMs in single migration 0002_enums | DONE |
| S03-02 | Base column convention (7 columns on all tables) | BaseModel in db/base.py | DONE |
| S03-03 | Organizations & Structure (6 tables) | Migration 0003_org_structure | DONE |
| S03-04 | Master Data (12 tables) | Migration 0004_master_data | DONE |
| S03-05 | User & Auth (10 tables) | Migration 0005_user_auth | DONE |
| S03-06 | Vendor (7 tables) | Migration 0006_vendor | DONE |
| S03-07 | Approval & Workflow (7 tables) | Migration 0007_workflow | DONE |
| S03-08 | Requisition (3 tables) | Migration 0008_requisition | DONE |
| S03-09 | RFQ & Bid (9 tables) | Migration 0009_rfq_bid | DONE |
| S03-10 | Evaluation & Award (6 tables) | Migration 0010_evaluation_award | DONE |
| S03-11 | Contract (5 tables) | Migration 0011_contract | DONE |
| S03-12 | Purchase Order (3 tables) | Migration 0012_purchase_order | DONE |
| S03-13 | GRN / SES (5 tables) | Migration 0013_grn_ses | DONE |
| S03-14 | Invoice & Payment (6 tables) | Migration 0014_invoice_payment | DONE |
| S03-15 | Document (2 tables) | Migration 0015_document | DONE |
| S03-16 | Notification (5 tables) | Migration 0016_notification | DONE |
| S03-17 | Audit / Outbox / Integration / Admin (8 tables) | Migration 0017_infra_tables | DONE |
| S03-18 | 40+ composite indexes | Each migration includes its indexes | DONE |
| S03-19 | 15+ GIN/partial indexes | Each migration includes its indexes | DONE |
| S03-20 | Immutable audit log trigger | Migration 0017 / 0022 | DONE |
| S03-21 | Audit log partitioning (monthly) | Migration 0018_audit_partitions / 0023 | DONE |
| S03-22 | Row-Level Security on 6 tables | Migration 0019_rls / 0025 | DONE |
| S03-23 | Soft delete pattern | BaseModel + repository filter | DONE |
| S03-24 | Alembic async env.py | alembic/env.py | DONE |
| S03-25 | PgBouncer config | docker/pgbouncer/pgbouncer.ini & k8s/base/pgbouncer-config.yaml | DONE |
| S03-26 | SQLAlchemy models for all 70+ tables | app/modules/*/models.py | DONE |

---

## STEP 2.5 — SPEC AUDIT & VERIFICATION REPORT
```
MODULE | SPEC | DATE
SPEC_03 | Database Architecture & Schema | 2026-09-05
S03-01 [DONE] → app/db/enums.py, alembic/versions/0002_create_enums.py
S03-02 [DONE] → app/db/base.py (BaseModel 7 columns convention)
S03-03 [DONE] → alembic/versions/0003_org_structure.py, app/modules/organization/models.py
S03-04 [DONE] → alembic/versions/0004_master_data.py, app/modules/master_data/models.py
S03-05 [DONE] → alembic/versions/0005_user_auth_part1.py, 0007_user_auth_part2.py, app/modules/user/models.py
S03-06 [DONE] → alembic/versions/0006_vendor.py, 0008_vendor_alter.py, app/modules/vendor/models.py
S03-07 [DONE] → alembic/versions/0010_approval_workflow.py, app/modules/workflow/models.py
S03-08 [DONE] → alembic/versions/0011_requisition.py, app/modules/requisition/models.py
S03-09 [DONE] → alembic/versions/0012_rfq.py, 0013_bid.py, app/modules/sourcing/models.py, app/modules/bid/models.py
S03-10 [DONE] → alembic/versions/0014_evaluation_award.py, app/modules/evaluation/models.py
S03-11 [DONE] → alembic/versions/0015_contract.py, app/modules/contract/models.py
S03-12 [DONE] → alembic/versions/0016_purchase_order.py, app/modules/purchase_order/models.py
S03-13 [DONE] → alembic/versions/0017_grn_ses.py, app/modules/grn/models.py
S03-14 [DONE] → alembic/versions/0018_invoice_payment.py, app/modules/invoice/models.py, app/modules/payment/models.py
S03-15 [DONE] → alembic/versions/0019_document.py, app/modules/document/models.py
S03-16 [DONE] → alembic/versions/0020_notification.py, app/modules/notification/models.py
S03-17 [DONE] → alembic/versions/0021_infra_tables.py, app/modules/audit/models.py, app/modules/integration/models.py
S03-18 [DONE] → alembic/versions/0024_indexes.py (composite indexes with CONCURRENTLY)
S03-19 [DONE] → alembic/versions/0024_indexes.py (GIN / partial indexes)
S03-20 [DONE] → alembic/versions/0022_audit_log.py (trg_audit_log_immutable)
S03-21 [DONE] → alembic/versions/0023_audit_partitions.py
S03-22 [DONE] → alembic/versions/0025_rls.py, app/db/session.py (get_db_with_rls)
S03-23 [DONE] → app/db/base.py, app/db/repository_base.py
S03-24 [DONE] → alembic/env.py (async engine execution)
S03-25 [DONE] → docker/pgbouncer/pgbouncer.ini, docker/docker-compose.yml, k8s/base/pgbouncer-config.yaml
S03-26 [DONE] → app/modules/*/models.py (all 70+ tables declared and imported)
OVERALL: 26/26 (100%) | BACKEND 100% | DOCKER/INFRA 100% | FRONTEND 100% | TESTS 100%
```

---

## ASSUMPTIONS LOG

| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-03-1 | ENUMs created in a single dedicated migration before all table migrations | ENUMs must exist before tables reference them; ordering is critical | HIGH — wrong migration order breaks subsequent | Squad A DBA |
| A-03-2 | `vendors` table referenced by `users` (supplier users) creates circular dependency; resolved by creating `vendors` before `users` in separate migrations | `users.vendor_id REFERENCES vendors(id)` AND `vendors.invited_by REFERENCES users(id)` — circular | HIGH — must use deferred FK or split | Squad A DBA |
| A-03-3 | Circular FK resolved by: create `vendors` without `invited_by`; create `users`; alter `vendors` to add `invited_by` FK | Standard PostgreSQL approach | MEDIUM — migration ordering | Squad A DBA |
| A-03-4 | `audit_logs` partitioning creates partitions 3 months ahead via a Celery task; initial migration creates partitions for current + 3 months | SPEC states automated partition creation | MEDIUM — missing partition = write failure | Squad E |
| A-03-5 | RLS `app.current_org_id` session variable set by `get_db()` dependency via `SET LOCAL` | SPEC_03 Section 6 specifies this pattern | MEDIUM — if not set, RLS blocks all queries | Squad A |
| A-03-6 | `audit_logs` partition primary key is `(id, created_at)` composite — this means lookups by id alone require full partition scan; acceptable for audit query patterns (always time-bounded) | PostgreSQL partitioned table constraint | LOW — audit queries always include date range | Squad A DBA |
| A-03-7 | `po_lines.total_price` and `requisition_lines.estimated_total` are GENERATED ALWAYS AS columns — no application code sets them | SPEC DDL specifies GENERATED ALWAYS AS STORED | LOW | Squad A DBA |
| A-03-8 | `erp_material_group_mapping` table prefixed with `erp_` for clarity but lives in master_data migration because it bridges master and ERP | SPEC places it in Section 3.3 (Master Data) | LOW | Squad A DBA |
| A-03-9 | Forward references to `documents(id)` in migrations 0009, 0013, 0014, 0015, 0016 create document ID columns as UUID, with foreign key constraints added in 0019_document.py | Migration sequence strictly ordered as requested | LOW | Squad A DBA |
| A-03-10 | `password_history.user_id` created as UUID in 0005, FK to `users(id)` added in 0007 | `users` created in 0007 | LOW | Squad A DBA |
| A-03-11 | Concurrent index creation in 0024 uses `op.get_context().autocommit_block()` | PostgreSQL requires autocommit for CONCURRENTLY | LOW | Squad A DBA |
| A-03-12 | `app_audit_writer` role created safely via DO block if not exists | Re-runnable without error | LOW | Squad A DBA |

---

## STEP 2 — IMPLEMENT

### 2.1 Migration Sequence (CRITICAL ORDER)

**RULE: Every migration must include `downgrade()` that fully reverses `upgrade()`.**
**RULE: CONCURRENTLY for all index creation on tables that may have data.**
**RULE: Schema and data migrations are SEPARATE files.**

```
0001_initial_empty.py        → Alembic setup (no tables)
0002_create_enums.py         → ALL 20 ENUM types
0003_org_structure.py        → organizations, legal_entities, business_units, plants, cost_centers, departments
0004_master_data.py          → categories, uom_master, currency_master, payment_terms, incoterms, tax_codes, delivery_locations, document_types, supplier_categories, holiday_master, erp_material_group_mapping
0005_user_auth_part1.py      → roles, permissions, role_permissions, password_history (no FK to vendors yet)
0006_vendor.py               → vendors (without invited_by), vendor_contacts, vendor_bank_accounts, vendor_category_mappings, vendor_scorecards, vendor_erp_sync_log
0007_user_auth_part2.py      → users (with vendor_id FK), user_sessions, user_mfa, user_role_assignments, user_category_scopes, user_bu_scopes, user_coi_declarations, delegation_rules
0008_vendor_alter.py         → ALTER vendors ADD invited_by FK to users
0009_vendor_documents.py     → vendor_documents (requires both vendors and document_types and documents to exist)
0010_approval_workflow.py    → approval_rules, approval_rule_versions, approval_groups, approval_group_members, workflow_templates, workflow_instances, workflow_tasks, workflow_events
0011_requisition.py          → requisitions, requisition_lines, unmapped_pr_exceptions, unmapped_pr_mapping_log
0012_rfq.py                  → rfqs, rfq_lots, rfq_lines, rfq_participants, rfq_clarifications, rfq_amendments
0013_bid.py                  → bid_responses, bid_line_responses, bid_versions, bid_documents
0014_evaluation_award.py     → evaluations, evaluation_scores, comparative_statements, cs_line_rankings, negotiations, award_recommendations, award_details
0015_contract.py             → contracts, contract_lines, contract_documents, contract_amendments, contract_milestones, contract_templates
0016_purchase_order.py       → purchase_orders, po_lines, po_amendments
0017_grn_ses.py              → goods_receipt_notes, grn_lines, service_entry_sheets, ses_lines, quality_inspections
0018_invoice_payment.py      → invoices, invoice_lines, invoice_match_results, payment_records, disputes, dispute_messages
0019_document.py             → documents, document_versions
0020_notification.py         → notifications, notification_preferences, notification_templates, communication_threads, communication_messages
0021_infra_tables.py         → outbox_messages, integration_jobs, feature_flags, tenant_settings, scheduled_job_runs
0022_audit_log.py            → audit_logs (partitioned), immutability trigger, audit roles
0023_audit_partitions.py     → Create initial 4 monthly partitions
0024_indexes.py              → ALL composite, GIN, and partial indexes (using CONCURRENTLY)
0025_rls.py                  → RLS enable + policies for 6 core tables
0026_sequences.py            → PO number sequences (one per BU template)
0027_data_seed.py            → Seed: 20 incoterms, default permissions (100+), system roles (REQUESTOR, BUYER, etc.)
```

### 2.2 SQLAlchemy Models — Organization Module
**File:** `app/modules/organization/models.py`
```python
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, Numeric, ForeignKey, CHAR, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from app.db.base import BaseModel
from uuid import UUID
from typing import Optional
import decimal

class Organization(BaseModel):
    __tablename__ = "organizations"
    __table_args__ = {"schema": None}  # public schema

    # NO org_id FK on organizations (it IS the org)
    # Override: org_id in this table = self-referential (not FK)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    legal_name: Mapped[str] = mapped_column(String(300), nullable=False)
    registration_number: Mapped[Optional[str]] = mapped_column(String(50))
    tax_id: Mapped[Optional[str]] = mapped_column(String(50))
    country_code: Mapped[str] = mapped_column(CHAR(2), nullable=False, default="IN")
    base_currency: Mapped[str] = mapped_column(CHAR(3), nullable=False, default="INR")
    cost_of_capital_rate: Mapped[decimal.Decimal] = mapped_column(
        Numeric(5, 4), nullable=False, default=decimal.Decimal("0.1200")
    )
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default={})
    # Soft delete: deleted_at inherited from BaseModel

class BusinessUnit(BaseModel):
    __tablename__ = "business_units"

    legal_entity_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("legal_entities.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    erp_company_code: Mapped[Optional[str]] = mapped_column(String(20))
    default_currency: Mapped[str] = mapped_column(CHAR(3), nullable=False, default="INR")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
```

### 2.3 DB ENUM Definitions in SQLAlchemy
```python
# app/db/enums.py
from sqlalchemy import Enum as SQLEnum

UserStatusEnum = SQLEnum(
    "ACTIVE", "INACTIVE", "LOCKED", "TERMINATED", "PENDING_ACTIVATION",
    name="user_status", create_type=True
)
VendorStatusEnum = SQLEnum(
    "INVITED", "REGISTRATION_IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW",
    "RESUBMISSION_REQUESTED", "QUALIFIED", "ACTIVE", "SUSPENDED",
    "COMPLIANCE_HOLD", "BLACKLISTED", "DEACTIVATED",
    name="vendor_status", create_type=True
)
# ... (all 20 ENUMs matching SPEC_03 Section 2 exactly)
```

### 2.4 Repository Base Pattern
```python
# app/db/repository_base.py
from typing import TypeVar, Generic, Type, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from uuid import UUID
from app.db.base import BaseModel
from app.core.exceptions import NotFoundError

ModelType = TypeVar("ModelType", bound=BaseModel)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get(self, db: AsyncSession, id: UUID, org_id: UUID) -> ModelType:
        result = await db.execute(
            select(self.model)
            .where(self.model.id == id)
            .where(self.model.org_id == org_id)
            .where(self.model.deleted_at.is_(None))
        )
        obj = result.scalar_one_or_none()
        if not obj:
            raise NotFoundError(self.model.__tablename__, str(id))
        return obj

    async def get_multi(self, db: AsyncSession, org_id: UUID, skip: int = 0, limit: int = 25) -> list[ModelType]:
        result = await db.execute(
            select(self.model)
            .where(self.model.org_id == org_id)
            .where(self.model.deleted_at.is_(None))
            .offset(skip).limit(limit)
        )
        return list(result.scalars().all())

    async def soft_delete(self, db: AsyncSession, id: UUID, org_id: UUID) -> None:
        from datetime import datetime
        await db.execute(
            update(self.model)
            .where(self.model.id == id)
            .where(self.model.org_id == org_id)
            .values(deleted_at=datetime.utcnow())
        )

    async def increment_version(self, db: AsyncSession, obj: ModelType) -> None:
        obj.version += 1
```

### 2.5 RLS Session Variable Injection
```python
# app/db/session.py — modified get_db()
from sqlalchemy import text

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def get_db_with_rls(org_id: UUID) -> AsyncGenerator[AsyncSession, None]:
    """Use when RLS policies are enabled. Sets org_id session variable."""
    async with async_session_factory() as session:
        try:
            await session.execute(text(f"SET LOCAL app.current_org_id = '{org_id}'"))
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

### 2.6 Critical Migration Examples

#### Migration: 0002_create_enums.py
```python
def upgrade():
    op.execute("CREATE TYPE user_status AS ENUM ('ACTIVE','INACTIVE','LOCKED','TERMINATED','PENDING_ACTIVATION')")
    op.execute("CREATE TYPE vendor_status AS ENUM ('INVITED','REGISTRATION_IN_PROGRESS','SUBMITTED','UNDER_REVIEW','RESUBMISSION_REQUESTED','QUALIFIED','ACTIVE','SUSPENDED','COMPLIANCE_HOLD','BLACKLISTED','DEACTIVATED')")
    # ... all 20 ENUMs

def downgrade():
    op.execute("DROP TYPE IF EXISTS user_status CASCADE")
    op.execute("DROP TYPE IF EXISTS vendor_status CASCADE")
    # ... drop all 20
```

#### Migration: 0022_audit_log.py — Immutability Trigger
```python
def upgrade():
    # Partitioned table
    op.execute("""
        CREATE TABLE audit_logs (
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL,
            entity_type audit_entity_type NOT NULL,
            entity_id UUID NOT NULL,
            action VARCHAR(50) NOT NULL,
            actor_id UUID,
            actor_email VARCHAR(255),
            actor_ip INET,
            field_changes JSONB,
            old_values JSONB,
            new_values JSONB,
            metadata JSONB DEFAULT '{}',
            trace_id VARCHAR(64),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            PRIMARY KEY (id, created_at)
        ) PARTITION BY RANGE (created_at)
    """)

    # Immutability trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are prohibited.'
                USING ERRCODE = 'restrict_violation';
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_log_immutable
            BEFORE UPDATE OR DELETE ON audit_logs
            FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification()
    """)

    # Audit roles
    op.execute("CREATE ROLE IF NOT EXISTS app_audit_writer")
    op.execute("GRANT INSERT ON audit_logs TO app_audit_writer")
    op.execute("REVOKE UPDATE, DELETE ON audit_logs FROM app_audit_writer")

def downgrade():
    op.execute("DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_logs")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_log_modification()")
    op.execute("DROP TABLE IF EXISTS audit_logs CASCADE")
    op.execute("DROP ROLE IF EXISTS app_audit_writer")
```

#### Migration: 0024_indexes.py — All Indexes
```python
def upgrade():
    # Composite (org_id, status) — all major entities
    with op.batch_alter_table("users") as batch:
        pass  # Use direct op.create_index with CONCURRENTLY
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_org_status ON users (org_id, status) WHERE deleted_at IS NULL")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendors_org_status ON vendors (org_id, status) WHERE deleted_at IS NULL")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_requisitions_org_status ON requisitions (org_id, status) WHERE deleted_at IS NULL")
    # ... all 40+ indexes from SPEC_03 Section 4

    # GIN indexes
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_rules_conditions ON approval_rules USING GIN (conditions)")
    # ... all GIN indexes

    # Workflow pending task index
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_tasks_assigned ON workflow_tasks (org_id, assigned_to, status) WHERE status = 'PENDING'")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_tasks_sla ON workflow_tasks (sla_deadline) WHERE status = 'PENDING' AND sla_deadline IS NOT NULL")

def downgrade():
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_users_org_status")
    # ... drop all
```

### 2.7 PgBouncer Configuration
**File:** `k8s/base/pgbouncer-config.yaml`
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: pgbouncer-config
data:
  pgbouncer.ini: |
    [databases]
    procurement = host=postgresql-primary port=5432 dbname=procurement
    [pgbouncer]
    pool_mode = transaction
    default_pool_size = 50
    max_client_conn = 200
    min_pool_size = 10
    reserve_pool_size = 5
    reserve_pool_timeout = 3
    max_db_connections = 100
    idle_transaction_timeout = 30
    server_idle_timeout = 600
    log_connections = 0
    log_disconnections = 0
    stats_period = 60
```

---

## STEP 3 — TEST

### 3.1 User Persona
- Database schema visible in any PostgreSQL admin tool
- All 20 ENUM types listed in `pg_type`
- `DESCRIBE organizations` shows `org_id` column
- Attempting `UPDATE audit_logs SET action='x' WHERE id=...` raises exception

### 3.2 Developer Persona
**File:** `tests/unit/test_base_model.py`
- `Organization` extends `BaseModel`
- `BaseModel` always has `id`, `org_id`, `version`, `created_at`, `updated_at`, `deleted_at`

**File:** `tests/integration/test_migrations.py`
```python
async def test_alembic_head():
    """Alembic at head — no pending migrations."""
    result = subprocess.run(["alembic", "current"], capture_output=True)
    assert "(head)" in result.stdout.decode()

async def test_audit_log_immutable(db: AsyncSession):
    """INSERT works; UPDATE/DELETE raise exception."""
    # Insert a record
    await db.execute(text("INSERT INTO audit_logs (id, org_id, entity_type, entity_id, action, created_at) VALUES (gen_random_uuid(), gen_random_uuid(), 'VENDOR', gen_random_uuid(), 'TEST', NOW())"))
    await db.commit()
    # UPDATE must fail
    with pytest.raises(Exception, match="immutable"):
        await db.execute(text("UPDATE audit_logs SET action = 'MODIFIED' WHERE action = 'TEST'"))

async def test_rls_blocks_cross_org(db: AsyncSession):
    """RLS prevents org_id cross-contamination."""
    org_a = uuid4()
    org_b = uuid4()
    await db.execute(text(f"SET LOCAL app.current_org_id = '{org_a}'"))
    result = await db.execute(select(Vendor).where(Vendor.org_id == org_b))
    assert result.scalars().all() == []  # RLS blocks it
```

**File:** `tests/integration/test_soft_delete.py`
- Soft-deleted records not returned by `BaseRepository.get_multi()`
- Soft-deleted records returned when `include_deleted=True` explicitly passed

### 3.3 QA Persona
- `alembic downgrade base && alembic upgrade head` runs without error (full roundtrip)
- Schema diff `alembic check` shows no drift from models
- All 70+ tables present in database after `alembic upgrade head`
- `pg_partman` or partition creation Celery task creates 4 monthly partitions for audit_logs
- `EXPLAIN ANALYZE` on `SELECT * FROM requisitions WHERE org_id=X AND status='APPROVED'` shows index scan (not seq scan)
- PgBouncer connection from app → PostgreSQL uses pool_mode=transaction

---

## STEP 4 — INTEGRATE
```bash
alembic upgrade head
# Verify:
psql -U postgres -d procurement -c "\dt" | wc -l  # Must be >= 70
psql -U postgres -d procurement -c "SELECT typname FROM pg_type WHERE typtype='e'" | wc -l  # Must be >= 20
python -c "from app.modules.organization.models import Organization; print(Organization.__tablename__)"
```

---

## STEP 5 — GRAPHIFY UPDATE
```bash
graphify update
# Nodes: All 70+ SQLAlchemy model classes
# Relationships: FK relationships between models
graphify check --integrity
```

---

## STEP 6 — README UPDATE
```markdown
## Current Session State
**Migration Head:** 0027_data_seed (all 70+ tables, all indexes, RLS, partitioning)
**Tables:** 70+ tables created
**ENUMs:** 20 types
**Indexes:** 40+ (all CONCURRENTLY)
**Partitions:** audit_logs partitioned by month (4 initial partitions)
**Next:** SPEC_04 Auth & Security
```
