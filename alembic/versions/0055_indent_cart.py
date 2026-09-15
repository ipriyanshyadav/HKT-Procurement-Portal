"""Indent cart — server-side cart persistence for Indentor role (Phase 2)

Revision ID: 0055_indent_cart
Revises: 0054_indentor_role
Create Date: 2026-09-14 15:22:00.000000

Tables created:
    indent_carts       — one active cart per indentor, lifecycle-tracked
    indent_cart_items  — line items within a cart (max 50 per business rule)

Downgrade: fully reverses upgrade (DROP TABLE in reverse dependency order).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '0055_indent_cart'
down_revision = '0054_indentor_role'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── indent_carts ──────────────────────────────────────────────────────────
    op.create_table(
        'indent_carts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('indentor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('cart_name', sa.String(200), nullable=False, server_default='My Cart'),
        # status: ACTIVE | TRANSFERRED | ABANDONED | EXPIRED
        sa.Column('status', sa.String(20), nullable=False, server_default='ACTIVE'),
        sa.Column('assigned_buyer_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('transfer_note', sa.Text(), nullable=True),
        sa.Column('transferred_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('business_unit_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('cost_center_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('delivery_location_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('required_by_date', sa.Date(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], name='fk_indent_carts_org_id'),
        sa.ForeignKeyConstraint(['indentor_id'], ['users.id'], name='fk_indent_carts_indentor_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_buyer_id'], ['users.id'], name='fk_indent_carts_assigned_buyer_id', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['business_unit_id'], ['business_units.id'], name='fk_indent_carts_business_unit_id', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['cost_center_id'], ['cost_centers.id'], name='fk_indent_carts_cost_center_id', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['delivery_location_id'], ['delivery_locations.id'], name='fk_indent_carts_delivery_location_id', ondelete='SET NULL'),
    )

    # ── indent_cart_items ─────────────────────────────────────────────────────
    op.create_table(
        'indent_cart_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('cart_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('catalog_item_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('line_number', sa.Integer(), nullable=False),
        sa.Column('item_description', sa.String(500), nullable=False),
        sa.Column('item_code', sa.String(50), nullable=True),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('uom_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('quantity', sa.Numeric(18, 4), nullable=False),
        sa.Column('estimated_unit_price', sa.Numeric(18, 4), nullable=False, server_default='0'),
        sa.Column('hsn_code', sa.String(10), nullable=True),
        sa.Column('specifications', sa.Text(), nullable=True),
        sa.Column('required_by_date', sa.Date(), nullable=True),
        sa.Column('delivery_location_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_from_catalog', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['cart_id'], ['indent_carts.id'], name='fk_indent_cart_items_cart_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], name='fk_indent_cart_items_category_id'),
        sa.ForeignKeyConstraint(['uom_id'], ['uom_master.id'], name='fk_indent_cart_items_uom_id'),
        sa.ForeignKeyConstraint(['delivery_location_id'], ['delivery_locations.id'], name='fk_indent_cart_items_delivery_location_id', ondelete='SET NULL'),
        sa.UniqueConstraint('cart_id', 'line_number', name='uq_indent_cart_items_cart_line'),
        sa.CheckConstraint('quantity > 0', name='ck_indent_cart_items_quantity_positive'),
    )

    # ── indexes ───────────────────────────────────────────────────────────────
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_indent_carts_org_indentor "
        "ON indent_carts (org_id, indentor_id) WHERE deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_indent_carts_org_status "
        "ON indent_carts (org_id, status) WHERE deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_indent_carts_org_buyer "
        "ON indent_carts (org_id, assigned_buyer_id) WHERE deleted_at IS NULL AND assigned_buyer_id IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_indent_cart_items_cart "
        "ON indent_cart_items (cart_id) WHERE deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_indent_cart_items_org "
        "ON indent_cart_items (org_id) WHERE deleted_at IS NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_indent_cart_items_org")
    op.execute("DROP INDEX IF EXISTS idx_indent_cart_items_cart")
    op.execute("DROP INDEX IF EXISTS idx_indent_carts_org_buyer")
    op.execute("DROP INDEX IF EXISTS idx_indent_carts_org_status")
    op.execute("DROP INDEX IF EXISTS idx_indent_carts_org_indentor")
    op.drop_table('indent_cart_items')
    op.drop_table('indent_carts')
