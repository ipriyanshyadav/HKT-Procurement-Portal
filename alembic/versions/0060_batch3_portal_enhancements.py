"""SPEC_27 Batch 3: Export Center (27-G), Buyer Activity (27-H), and Online Payment Gateway (27-J).

Revision ID: 0060_batch3_portal_enhancements
Revises: 0059_batch2_portal_enhancements
Create Date: 2026-09-14 21:05:00.000000

Changes:
    1. Table: export_jobs (async streaming export jobs with 7-day retention)
    2. Table: payment_gateway_config (per-tenant Razorpay/Stripe configuration)
    3. Columns added to payment_records:
       - gateway_provider
       - gateway_order_id
       - gateway_payment_id
       - gateway_signature
       - gateway_fee
       - gateway_fee_currency
       - gateway_response
       - refund_id
       - refunded_at
       - refund_amount
       - refund_reason
       - payment_link_url
       - payment_link_expires_at

Downgrade: drops created tables and columns cleanly.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0060_batch3_portal_enhancements'
down_revision = '0059_batch2_portal_enhancements'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. export_jobs ───────────────────────────────────────────────────────
    op.create_table(
        'export_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('requested_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('export_type', sa.String(100), nullable=False),
        sa.Column('filters', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
        sa.Column('format', sa.String(10), server_default='CSV', nullable=False),
        sa.Column('status', sa.String(20), server_default='QUEUED', nullable=False),
        sa.Column('total_rows', sa.Integer(), nullable=True),
        sa.Column('processed_rows', sa.Integer(), server_default='0', nullable=False),
        sa.Column('file_path', sa.String(500), nullable=True),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=True),
        sa.Column('presigned_url', sa.Text(), nullable=True),
        sa.Column('presigned_url_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_export_jobs_org_status', 'export_jobs', ['org_id', 'status'])
    op.create_index('ix_export_jobs_requested_by', 'export_jobs', ['requested_by'])

    # ── 2. payment_gateway_config ────────────────────────────────────────────
    op.create_table(
        'payment_gateway_config',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('razorpay_key_id', sa.Text(), nullable=True),
        sa.Column('razorpay_secret', sa.Text(), nullable=True),
        sa.Column('stripe_pub_key', sa.Text(), nullable=True),
        sa.Column('stripe_secret', sa.Text(), nullable=True),
        sa.Column('default_provider', sa.String(20), server_default='RAZORPAY', nullable=False),
        sa.Column('auto_pay_enabled', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('webhook_secret', sa.Text(), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_payment_gateway_config_org', 'payment_gateway_config', ['org_id'])

    # ── 3. Columns added to payment_records ──────────────────────────────────
    op.add_column('payment_records', sa.Column('gateway_provider', sa.String(20), nullable=True))
    op.add_column('payment_records', sa.Column('gateway_order_id', sa.String(200), nullable=True))
    op.add_column('payment_records', sa.Column('gateway_payment_id', sa.String(200), nullable=True))
    op.add_column('payment_records', sa.Column('gateway_signature', sa.String(500), nullable=True))
    op.add_column('payment_records', sa.Column('gateway_fee', sa.Numeric(15, 2), nullable=True))
    op.add_column('payment_records', sa.Column('gateway_fee_currency', sa.String(3), server_default='INR', nullable=True))
    op.add_column('payment_records', sa.Column('gateway_response', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('payment_records', sa.Column('refund_id', sa.String(200), nullable=True))
    op.add_column('payment_records', sa.Column('refunded_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('payment_records', sa.Column('refund_amount', sa.Numeric(15, 2), nullable=True))
    op.add_column('payment_records', sa.Column('refund_reason', sa.Text(), nullable=True))
    op.add_column('payment_records', sa.Column('payment_link_url', sa.String(500), nullable=True))
    op.add_column('payment_records', sa.Column('payment_link_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_payment_records_gateway_order', 'payment_records', ['gateway_order_id'])


def downgrade() -> None:
    op.drop_index('ix_payment_records_gateway_order', table_name='payment_records')
    op.drop_column('payment_records', 'payment_link_expires_at')
    op.drop_column('payment_records', 'payment_link_url')
    op.drop_column('payment_records', 'refund_reason')
    op.drop_column('payment_records', 'refund_amount')
    op.drop_column('payment_records', 'refunded_at')
    op.drop_column('payment_records', 'refund_id')
    op.drop_column('payment_records', 'gateway_response')
    op.drop_column('payment_records', 'gateway_fee_currency')
    op.drop_column('payment_records', 'gateway_fee')
    op.drop_column('payment_records', 'gateway_signature')
    op.drop_column('payment_records', 'gateway_payment_id')
    op.drop_column('payment_records', 'gateway_order_id')
    op.drop_column('payment_records', 'gateway_provider')

    op.drop_index('ix_payment_gateway_config_org', table_name='payment_gateway_config')
    op.drop_table('payment_gateway_config')

    op.drop_index('ix_export_jobs_requested_by', table_name='export_jobs')
    op.drop_index('ix_export_jobs_org_status', table_name='export_jobs')
    op.drop_table('export_jobs')
