"""Support Portal Schema — SPEC_29.

Revision ID: 0058_support_portal
Revises: 0057_portal_enhancements_spec27
Create Date: 2026-09-14 16:08:00.000000

Changes:
    1. Table: support_tickets
    2. Table: support_ticket_messages
    3. Table: support_agents
    4. Table: knowledge_base_articles
    5. Concurrent partial indexes for customer lookups and ticket lifecycle.

Downgrade: drops tables and indexes cleanly.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0058_support_portal'
down_revision = '0057_portal_enhancements_spec27'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. support_tickets ──────────────────────────────────────────────────
    op.create_table(
        'support_tickets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ticket_number', sa.String(50), nullable=False, unique=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('customer_email', sa.String(255), nullable=False),
        sa.Column('subject', sa.String(500), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('priority', sa.String(20), nullable=False, server_default='MEDIUM'),
        sa.Column('status', sa.String(30), nullable=False, server_default='OPEN'),
        sa.Column('category', sa.String(100), nullable=False, server_default='GENERAL'),
        sa.Column('assigned_agent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('csat_rating', sa.Integer(), nullable=True),
        sa.Column('csat_comment', sa.Text(), nullable=True),
        sa.Column('first_response_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_tickets_org_status "
        "ON support_tickets (org_id, status) WHERE deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_tickets_customer "
        "ON support_tickets (customer_id, created_at) WHERE deleted_at IS NULL"
    )

    # ── 2. support_ticket_messages ──────────────────────────────────────────
    op.create_table(
        'support_ticket_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('ticket_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('support_tickets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sender_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('sender_type', sa.String(20), nullable=False, server_default='CUSTOMER'),
        sa.Column('message_text', sa.Text(), nullable=False),
        sa.Column('is_internal_note', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('attachments', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_messages_ticket "
        "ON support_ticket_messages (ticket_id, created_at)"
    )

    # ── 3. support_agents ───────────────────────────────────────────────────
    op.create_table(
        'support_agents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('max_assigned_tickets', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('active_tickets_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('routing_skills', postgresql.ARRAY(sa.String(50)), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    # ── 4. knowledge_base_articles ──────────────────────────────────────────
    op.create_table(
        'knowledge_base_articles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('slug', sa.String(300), nullable=False, unique=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('category', sa.String(100), nullable=False, server_default='GENERAL'),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_published', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('helpful_votes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('unhelpful_votes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kb_category_published "
        "ON knowledge_base_articles (category, is_published)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_kb_category_published")
    op.drop_table('knowledge_base_articles')
    op.drop_table('support_agents')
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_support_messages_ticket")
    op.drop_table('support_ticket_messages')
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_support_tickets_customer")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_support_tickets_org_status")
    op.drop_table('support_tickets')
