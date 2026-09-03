"""Alter vendors table to add invited_by and user FK constraints

Revision ID: 0008_vendor_alter
Revises: 0007_user_auth_part2
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0008_vendor_alter'
down_revision: Union[str, None] = '0007_user_auth_part2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    ALTER TABLE vendors
        ADD COLUMN invited_by UUID REFERENCES users(id);
    """)

    op.execute("""
    ALTER TABLE vendors
        ADD CONSTRAINT fk_vendors_blacklist_init FOREIGN KEY (blacklist_initiated_by) REFERENCES users(id);
    """)

    op.execute("""
    ALTER TABLE vendors
        ADD CONSTRAINT fk_vendors_blacklist_conf FOREIGN KEY (blacklist_confirmed_by) REFERENCES users(id);
    """)

    op.execute("""
    ALTER TABLE vendor_bank_accounts
        ADD CONSTRAINT fk_vendor_bank_validated_by FOREIGN KEY (validated_by) REFERENCES users(id);
    """)

def downgrade() -> None:
    op.execute("ALTER TABLE vendor_bank_accounts DROP CONSTRAINT IF EXISTS fk_vendor_bank_validated_by")
    op.execute("ALTER TABLE vendors DROP CONSTRAINT IF EXISTS fk_vendors_blacklist_conf")
    op.execute("ALTER TABLE vendors DROP CONSTRAINT IF EXISTS fk_vendors_blacklist_init")
    op.execute("ALTER TABLE vendors DROP COLUMN IF EXISTS invited_by")
