"""SPEC_27 Batch 2: Company Switcher and Tenant Branding.

Revision ID: 0059_batch2_portal_enhancements
Revises: 0058_support_portal
Create Date: 2026-09-14 16:20:00.000000

Changes:
    1. Table: user_org_memberships (multi-org access)
    2. Table: org_switch_audit (immutable audit trail)
    3. Column: users.primary_org_id
    4. Table: tenant_brandings (white-label portal theming)

Note: api_keys, webhook_subscriptions, and webhook_deliveries are defined in 0043_developer_api_keys.

Downgrade: drops created tables and columns cleanly.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0059_batch2_portal_enhancements'
down_revision = '0058_support_portal'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. user_org_memberships ─────────────────────────────────────────────
    op.create_table(
        'user_org_memberships',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('primary_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role_in_org', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
        sa.Column('is_primary_org', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('invited_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(20), server_default='ACTIVE', nullable=False),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('primary_user_id', 'org_id', name='uq_user_org_membership'),
    )
    op.create_index('ix_user_org_memberships_user', 'user_org_memberships', ['primary_user_id'])
    op.create_index('ix_user_org_memberships_org', 'user_org_memberships', ['org_id'])

    # ── 2. org_switch_audit ─────────────────────────────────────────────────
    op.create_table(
        'org_switch_audit',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('from_org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('to_org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('switched_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('previous_jti', sa.String(100), nullable=True),
        sa.Column('new_jti', sa.String(100), nullable=True),
    )
    op.create_index('ix_org_switch_audit_user', 'org_switch_audit', ['user_id', 'switched_at'])

    # ── 3. users.primary_org_id ─────────────────────────────────────────────
    op.add_column('users', sa.Column('primary_org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='SET NULL'), nullable=True))

    # ── 4. tenant_brandings ─────────────────────────────────────────────────
    op.create_table(
        'tenant_brandings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('logo_url', sa.String(1000), nullable=True),
        sa.Column('favicon_url', sa.String(1000), nullable=True),
        sa.Column('primary_color', sa.String(20), server_default='#2563eb', nullable=False),
        sa.Column('primary_color_dark', sa.String(20), server_default='#1d4ed8', nullable=False),
        sa.Column('secondary_color', sa.String(20), server_default='#f59e0b', nullable=False),
        sa.Column('company_display_name', sa.String(200), nullable=True),
        sa.Column('portal_title_suffix', sa.String(200), nullable=True),
        sa.Column('email_sender_name', sa.String(200), nullable=True),
        sa.Column('email_sender_domain', sa.String(200), nullable=True),
        sa.Column('custom_domain', sa.String(200), nullable=True),
        sa.Column('custom_domain_verified', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('login_page_headline', sa.String(300), nullable=True),
        sa.Column('login_page_subheading', sa.String(500), nullable=True),
        sa.Column('footer_text', sa.String(500), nullable=True),
        sa.Column('support_email', sa.String(255), nullable=True),
        sa.Column('help_url', sa.String(500), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('tenant_brandings')
    op.drop_column('users', 'primary_org_id')
    op.drop_table('org_switch_audit')
    op.drop_table('user_org_memberships')
