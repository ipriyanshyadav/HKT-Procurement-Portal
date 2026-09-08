"""Create ticket indexes concurrently

Revision ID: 0031_ticket_indexes
Revises: 0030_ticket_sequences
Create Date: 2026-09-08 04:33:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "0031_ticket_indexes"
down_revision: Union[str, None] = "0030_ticket_sequences"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDEXES = [
    (
        "idx_tickets_org_status",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_org_status ON tickets (org_id, status) WHERE deleted_at IS NULL",
    ),
    (
        "idx_tickets_org_raised_by",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_org_raised_by ON tickets (org_id, raised_by) WHERE deleted_at IS NULL",
    ),
    (
        "idx_tickets_assigned_to",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_assigned_to ON tickets (org_id, assigned_to, status) WHERE deleted_at IS NULL AND assigned_to IS NOT NULL",
    ),
    (
        "idx_tickets_entity",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_entity ON tickets (org_id, entity_type, entity_id) WHERE entity_id IS NOT NULL AND deleted_at IS NULL",
    ),
    (
        "idx_tickets_sla",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_sla ON tickets (sla_breach_at) WHERE status IN ('OPEN','IN_PROGRESS','PENDING_RESPONSE') AND deleted_at IS NULL",
    ),
    (
        "idx_tickets_number",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_number ON tickets (ticket_number)",
    ),
    (
        "idx_tickets_private",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_private ON tickets (org_id, is_private, raised_by, assigned_to) WHERE deleted_at IS NULL",
    ),
    (
        "idx_ticket_comments_ticket",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments (ticket_id, created_at) WHERE deleted_at IS NULL",
    ),
    (
        "idx_ticket_comments_internal",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_comments_internal ON ticket_comments (ticket_id, is_internal) WHERE deleted_at IS NULL",
    ),
    (
        "idx_ticket_watchers_user",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_watchers_user ON ticket_watchers (user_id, org_id)",
    ),
    (
        "idx_ticket_watchers_ticket",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_watchers_ticket ON ticket_watchers (ticket_id)",
    ),
    (
        "idx_ticket_activity_ticket",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_activity_ticket ON ticket_activity_log (ticket_id, created_at)",
    ),
    (
        "idx_ticket_sla_config_org",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_sla_config_org ON ticket_sla_config (org_id, priority)",
    ),
]


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for _, sql in INDEXES:
            op.execute(sql)


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, _ in reversed(INDEXES):
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
