"""Indentor role

Revision ID: 0054_indentor_role
Revises: 0053_early_payment_discounting
Create Date: 2026-09-13 19:56:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0054_indentor_role'
down_revision = '0053_early_payment_discounting'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add INDENT_CART to pr_source enum
    # We must use autocommit block or directly execute since altering enum type cannot run in a transaction block in some versions, but standard execute usually works.
    op.execute("ALTER TYPE pr_source ADD VALUE IF NOT EXISTS 'INDENT_CART'")

    op.add_column('requisitions', sa.Column('is_indent', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('requisitions', sa.Column('indentor_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('requisitions', sa.Column('assigned_buyer_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('requisitions', sa.Column('indent_notes', sa.Text(), nullable=True))
    
    op.create_foreign_key('fk_requisitions_indentor_id', 'requisitions', 'users', ['indentor_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_requisitions_assigned_buyer_id', 'requisitions', 'users', ['assigned_buyer_id'], ['id'], ondelete='SET NULL')

    op.create_index('ix_requisitions_is_indent', 'requisitions', ['is_indent'], unique=False)
    op.create_index('ix_requisitions_indentor_id', 'requisitions', ['indentor_id'], unique=False)
    op.create_index('ix_requisitions_assigned_buyer_id', 'requisitions', ['assigned_buyer_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_requisitions_assigned_buyer_id', table_name='requisitions')
    op.drop_index('ix_requisitions_indentor_id', table_name='requisitions')
    op.drop_index('ix_requisitions_is_indent', table_name='requisitions')

    op.drop_constraint('fk_requisitions_assigned_buyer_id', 'requisitions', type_='foreignkey')
    op.drop_constraint('fk_requisitions_indentor_id', 'requisitions', type_='foreignkey')

    op.drop_column('requisitions', 'indent_notes')
    op.drop_column('requisitions', 'assigned_buyer_id')
    op.drop_column('requisitions', 'indentor_id')
    op.drop_column('requisitions', 'is_indent')
