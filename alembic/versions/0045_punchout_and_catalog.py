"""0045_punchout_and_catalog

Revision ID: 0045_punchout_and_catalog
Revises: 0044_compliance_posture
Create Date: 2026-09-10 01:00:00.000000

SPEC_14: Catalog Management & PunchOut Marketplace Engine:
- item_master additions: brand, manufacturer, lead_time_days, min_order_qty, specifications, is_contract_item
- punchout_configs: Configuration for cXML and OCI external supplier punchouts
- punchout_sessions: Active punchout sessions with return tokens and cart items
- catalog_tier_pricing: Tiered volume pricing rules for hosted items
- user_carts & cart_items: 1-click cart-to-PR purchasing
"""

from collections.abc import Sequence

from sqlalchemy import text

from alembic import op

revision: str = "0045_punchout_and_catalog"
down_revision: str | None = "0044_compliance_posture"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Alter item_master
    conn.execute(text("ALTER TABLE item_master ADD COLUMN IF NOT EXISTS brand VARCHAR(100);"))
    conn.execute(text("ALTER TABLE item_master ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(100);"))
    conn.execute(text("ALTER TABLE item_master ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 3;"))
    conn.execute(text("ALTER TABLE item_master ADD COLUMN IF NOT EXISTS min_order_qty NUMERIC(12, 2) DEFAULT 1.0;"))
    conn.execute(text("ALTER TABLE item_master ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}'::jsonb;"))
    conn.execute(text("ALTER TABLE item_master ADD COLUMN IF NOT EXISTS is_contract_item BOOLEAN DEFAULT FALSE;"))

    # 2. punchout_configs
    conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS punchout_configs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
            supplier_name VARCHAR(200) NOT NULL,
            protocol VARCHAR(20) NOT NULL DEFAULT 'CXML',
            inbound_url VARCHAR(500) NOT NULL,
            shared_secret VARCHAR(255) NOT NULL,
            sender_identity VARCHAR(100) NOT NULL,
            buyer_identity VARCHAR(100) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            logo_url VARCHAR(500),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """)
    )

    # 3. punchout_sessions
    conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS punchout_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            config_id UUID NOT NULL REFERENCES punchout_configs(id) ON DELETE CASCADE,
            session_token VARCHAR(100) NOT NULL UNIQUE,
            status VARCHAR(20) NOT NULL DEFAULT 'INITIATED',
            cart_data JSONB DEFAULT '[]'::jsonb,
            pr_id UUID REFERENCES requisitions(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """)
    )

    # 4. catalog_tier_pricing
    conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS catalog_tier_pricing (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            item_id UUID NOT NULL REFERENCES item_master(id) ON DELETE CASCADE,
            min_quantity NUMERIC(12, 2) NOT NULL DEFAULT 1.0,
            unit_price NUMERIC(18, 4) NOT NULL,
            contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """)
    )

    # 5. user_carts
    conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS user_carts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            currency VARCHAR(3) NOT NULL DEFAULT 'INR',
            status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """)
    )

    # 6. cart_items
    conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS cart_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            cart_id UUID NOT NULL REFERENCES user_carts(id) ON DELETE CASCADE,
            item_id UUID REFERENCES item_master(id) ON DELETE SET NULL,
            item_code VARCHAR(100) NOT NULL,
            item_name VARCHAR(255) NOT NULL,
            quantity NUMERIC(12, 2) NOT NULL DEFAULT 1.0,
            unit_price NUMERIC(18, 4) NOT NULL,
            total_price NUMERIC(18, 4) NOT NULL,
            currency VARCHAR(3) NOT NULL DEFAULT 'INR',
            punchout_payload JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """)
    )

    # 7. Indexes (single statement per execute)
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_punchout_configs_org ON punchout_configs(org_id, is_active);"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_punchout_sessions_token ON punchout_sessions(session_token);"))
    conn.execute(
        text("CREATE INDEX IF NOT EXISTS ix_catalog_tier_item ON catalog_tier_pricing(item_id, min_quantity);")
    )
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_carts_user ON user_carts(user_id, status);"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_cart_items_cart ON cart_items(cart_id);"))


def downgrade() -> None:
    conn = op.get_bind()

    conn.execute(text("DROP TABLE IF EXISTS cart_items CASCADE;"))
    conn.execute(text("DROP TABLE IF EXISTS user_carts CASCADE;"))
    conn.execute(text("DROP TABLE IF EXISTS catalog_tier_pricing CASCADE;"))
    conn.execute(text("DROP TABLE IF EXISTS punchout_sessions CASCADE;"))
    conn.execute(text("DROP TABLE IF EXISTS punchout_configs CASCADE;"))

    conn.execute(text("ALTER TABLE item_master DROP COLUMN IF EXISTS is_contract_item;"))
    conn.execute(text("ALTER TABLE item_master DROP COLUMN IF EXISTS specifications;"))
    conn.execute(text("ALTER TABLE item_master DROP COLUMN IF EXISTS min_order_qty;"))
    conn.execute(text("ALTER TABLE item_master DROP COLUMN IF EXISTS lead_time_days;"))
    conn.execute(text("ALTER TABLE item_master DROP COLUMN IF EXISTS manufacturer;"))
    conn.execute(text("ALTER TABLE item_master DROP COLUMN IF EXISTS brand;"))
