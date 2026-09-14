"""Portal Enhancements Phase 1 — SPEC_27 (27-B, 27-C, 27-I)

Revision ID: 0057_portal_enhancements_spec27
Revises: 0056_grn_consignee
Create Date: 2026-09-14 15:58:00.000000

Changes:
    1. New table: onboarding_sessions (Module 27-B: Guided Buyer Onboarding Wizard)
    2. Alter table users: add is_platform_admin column (Module 27-C: Cross-Company SuperAdmin Reports)
    3. Alter tables requisitions, purchase_orders, invoices: add is_test_record column (Module 27-I: QA Tester Overlay)

Downgrade: drops table, drops columns, drops partial indexes.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0057_portal_enhancements_spec27'
down_revision = '0056_grn_consignee'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. onboarding_sessions ────────────────────────────────────────────────
    op.create_table(
        'onboarding_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('initiated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('current_step', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('completed_steps', postgresql.ARRAY(sa.Integer()), nullable=False, server_default='{}'),
        sa.Column('step_data', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('status', sa.String(20), nullable=False, server_default='IN_PROGRESS'),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onboarding_sessions_org "
        "ON onboarding_sessions (org_id, status) WHERE deleted_at IS NULL"
    )

    # ── 2. Add is_platform_admin to users ─────────────────────────────────────
    op.add_column(
        'users',
        sa.Column('is_platform_admin', sa.Boolean(), nullable=False, server_default='false'),
    )

    # ── 3. Add is_test_record for QA tester isolation ─────────────────────────
    op.add_column(
        'requisitions',
        sa.Column('is_test_record', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'purchase_orders',
        sa.Column('is_test_record', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'invoices',
        sa.Column('is_test_record', sa.Boolean(), nullable=False, server_default='false'),
    )

    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_req_test_record "
        "ON requisitions (org_id, is_test_record) WHERE is_test_record = TRUE"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_po_test_record "
        "ON purchase_orders (org_id, is_test_record) WHERE is_test_record = TRUE"
    )
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inv_test_record "
        "ON invoices (org_id, is_test_record) WHERE is_test_record = TRUE"
    )


def downgrade() -> None:
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_inv_test_record")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_po_test_record")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_req_test_record")
    op.drop_column('invoices', 'is_test_record')
    op.drop_column('purchase_orders', 'is_test_record')
    op.drop_column('requisitions', 'is_test_record')
    op.drop_column('users', 'is_platform_admin')
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_onboarding_sessions_org")
    op.drop_table('onboarding_sessions')
