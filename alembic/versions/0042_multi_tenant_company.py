"""0042_multi_tenant_company_switcher

Revision ID: 0042_multi_tenant_company_switcher
Revises: 0041_advance_shipping_notices
Create Date: 2026-09-09 23:35:00.000000

Multi-Tenant Company Switcher & Cross-Tenant Rollup schema:
- Adds active_legal_entity_id to users for persisting active operating company context
- Creates user_company_access table for multi-tenant and multi-entity access mapping
"""
from typing import Sequence, Union
from alembic import op
from sqlalchemy import text

revision: str = "0042_multi_tenant_company"
down_revision: Union[str, None] = "0041_advance_shipping_notices"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Add active_legal_entity_id column to users
    conn.execute(
        text("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS active_legal_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL;
        """)
    )

    # 2. Create user_company_access table
    conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS user_company_access (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            target_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            legal_entity_id UUID REFERENCES legal_entities(id) ON DELETE CASCADE,
            role_code VARCHAR(50),
            is_default BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_user_company_access UNIQUE (user_id, target_org_id, legal_entity_id)
        );
        """)
    )

    # 3. Create indexes
    conn.execute(
        text("""
        CREATE INDEX IF NOT EXISTS ix_user_company_access_user_org
        ON user_company_access(user_id, target_org_id);
        """)
    )
    conn.execute(
        text("""
        CREATE INDEX IF NOT EXISTS ix_user_company_access_entity
        ON user_company_access(user_id, legal_entity_id);
        """)
    )


def downgrade() -> None:
    conn = op.get_bind()

    conn.execute(text("DROP TABLE IF EXISTS user_company_access CASCADE;"))
    conn.execute(
        text("""
        ALTER TABLE users
        DROP COLUMN IF EXISTS active_legal_entity_id;
        """)
    )
