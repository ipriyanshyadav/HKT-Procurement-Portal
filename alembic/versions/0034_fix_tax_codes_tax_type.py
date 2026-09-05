"""Widen tax_codes tax_type column to VARCHAR(50) and default effective_from

Revision ID: 0034_fix_tax_codes_tax_type
Revises: 0033_invoice_payment_spec15
Create Date: 2026-09-05 16:10:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "0034_fix_tax_codes_tax_type"
down_revision: Union[str, None] = "0033_invoice_payment_spec15"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE tax_codes ALTER COLUMN tax_type TYPE VARCHAR(50) USING tax_type::text")
    op.execute("ALTER TABLE tax_codes ALTER COLUMN effective_from DROP NOT NULL")
    op.execute("ALTER TABLE tax_codes ALTER COLUMN effective_from SET DEFAULT CURRENT_DATE")


def downgrade() -> None:
    op.execute("ALTER TABLE tax_codes ALTER COLUMN tax_type TYPE tax_type USING tax_type::tax_type")
    op.execute("ALTER TABLE tax_codes ALTER COLUMN effective_from SET NOT NULL")
