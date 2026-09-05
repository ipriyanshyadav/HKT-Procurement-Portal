"""Add source_pr_id to purchase_orders for PR-to-PO analytics tracking

Revision ID: 0035_analytics_spec25
Revises: 0034_fix_tax_codes_tax_type
Create Date: 2026-09-05 18:30:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "0035_analytics_spec25"
down_revision: Union[str, None] = "0034_fix_tax_codes_tax_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS source_pr_id UUID REFERENCES requisitions(id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_purchase_orders_source_pr_id ON purchase_orders(source_pr_id) WHERE deleted_at IS NULL")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_purchase_orders_source_pr_id")
    op.execute("ALTER TABLE purchase_orders DROP COLUMN IF EXISTS source_pr_id")
