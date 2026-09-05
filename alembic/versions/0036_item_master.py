"""Create item_master table for catalog search and pre-approved S2C purchasing

Revision ID: 0036_item_master
Revises: 0035_analytics_spec25
Create Date: 2026-09-06 01:30:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "0036_item_master"
down_revision: Union[str, None] = "0035_analytics_spec25"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS item_master (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id),
            code VARCHAR(50) NOT NULL,
            name VARCHAR(200) NOT NULL,
            description VARCHAR(500),
            category_id UUID NOT NULL REFERENCES categories(id),
            uom_id UUID NOT NULL REFERENCES uom_master(id),
            standard_price NUMERIC(18, 4) NOT NULL DEFAULT 0.0,
            currency VARCHAR(3) NOT NULL DEFAULT 'INR',
            hsn_code VARCHAR(20),
            image_url VARCHAR(500),
            is_punchout BOOLEAN NOT NULL DEFAULT FALSE,
            punchout_vendor_id UUID,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        );
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_item_master_org_code
        ON item_master (org_id, code)
        WHERE deleted_at IS NULL;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_item_master_category_id
        ON item_master (category_id)
        WHERE deleted_at IS NULL;
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_item_master_category_id;")
    op.execute("DROP INDEX IF EXISTS uq_item_master_org_code;")
    op.execute("DROP TABLE IF EXISTS item_master;")
