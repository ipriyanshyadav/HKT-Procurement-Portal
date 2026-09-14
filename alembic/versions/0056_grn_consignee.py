"""GRN consignee fields — supports Indentor acting as delivery consignee (Phase 2)

Revision ID: 0056_grn_consignee
Revises: 0055_indent_cart
Create Date: 2026-09-14 15:23:00.000000

Changes:
    goods_receipt_notes — ADD 4 nullable columns for consignee workflow:
        consignee_id              — FK to users (the indentor / consignee)
        consignee_confirmed_at    — timestamp of PRC/CRAC confirmation
        consignee_rejection_reason — text reason if consignee rejected delivery
        consignee_status          — PENDING | CONFIRMED | REJECTED
        source_indent_cart_id     — traceability: which cart generated this GRN's PO

Downgrade: DROP all added columns in reverse order (zero-downtime — all nullable).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0056_grn_consignee'
down_revision = '0055_indent_cart'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'goods_receipt_notes',
        sa.Column('consignee_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        'goods_receipt_notes',
        sa.Column('consignee_confirmed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        'goods_receipt_notes',
        sa.Column('consignee_rejection_reason', sa.Text(), nullable=True),
    )
    op.add_column(
        'goods_receipt_notes',
        sa.Column(
            'consignee_status',
            sa.String(20),
            nullable=False,
            server_default='PENDING',
        ),
    )
    op.add_column(
        'goods_receipt_notes',
        sa.Column('source_indent_cart_id', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_foreign_key(
        'fk_grn_consignee_id',
        'goods_receipt_notes',
        'users',
        ['consignee_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_foreign_key(
        'fk_grn_source_indent_cart_id',
        'goods_receipt_notes',
        'indent_carts',
        ['source_indent_cart_id'],
        ['id'],
        ondelete='SET NULL',
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_grn_consignee_id "
        "ON goods_receipt_notes (consignee_id) WHERE consignee_id IS NOT NULL AND deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_grn_consignee_status "
        "ON goods_receipt_notes (org_id, consignee_status) WHERE deleted_at IS NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_grn_consignee_status")
    op.execute("DROP INDEX IF EXISTS idx_grn_consignee_id")
    op.drop_constraint('fk_grn_source_indent_cart_id', 'goods_receipt_notes', type_='foreignkey')
    op.drop_constraint('fk_grn_consignee_id', 'goods_receipt_notes', type_='foreignkey')
    op.drop_column('goods_receipt_notes', 'source_indent_cart_id')
    op.drop_column('goods_receipt_notes', 'consignee_status')
    op.drop_column('goods_receipt_notes', 'consignee_rejection_reason')
    op.drop_column('goods_receipt_notes', 'consignee_confirmed_at')
    op.drop_column('goods_receipt_notes', 'consignee_id')
