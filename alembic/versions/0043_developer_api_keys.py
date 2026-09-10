"""0043_developer_api_keys

Revision ID: 0043_developer_api_keys
Revises: 0042_multi_tenant_company
Create Date: 2026-09-10 00:15:00.000000

Developer Platform, API Key Management & Webhook Subscriptions schema:
- api_keys: Hashed, scoped, rate-limited programmatic credentials
- webhook_subscriptions: Webhook endpoints with HMAC signing
- webhook_deliveries: Audit log of delivery attempts and response payloads
"""
from typing import Sequence, Union
from alembic import op
from sqlalchemy import text

revision: str = "0043_developer_api_keys"
down_revision: Union[str, None] = "0042_multi_tenant_company"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. API Keys table
    conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS api_keys (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(150) NOT NULL,
            key_prefix VARCHAR(25) NOT NULL,
            key_hash VARCHAR(64) NOT NULL UNIQUE,
            scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
            ip_allowlist JSONB NOT NULL DEFAULT '[]'::jsonb,
            rate_limit_rpm INTEGER NOT NULL DEFAULT 120,
            status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
            expires_at TIMESTAMPTZ,
            last_used_at TIMESTAMPTZ,
            last_used_ip VARCHAR(45),
            total_requests BIGINT NOT NULL DEFAULT 0,
            revoked_at TIMESTAMPTZ,
            revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
            revoke_reason VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """)
    )

    # 2. Webhook Subscriptions table
    conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS webhook_subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            endpoint_url VARCHAR(500) NOT NULL,
            secret_token VARCHAR(100) NOT NULL,
            description VARCHAR(255),
            subscribed_events JSONB NOT NULL DEFAULT '[]'::jsonb,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            failure_count INTEGER NOT NULL DEFAULT 0,
            last_delivery_at TIMESTAMPTZ,
            last_delivery_status INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """)
    )

    # 3. Webhook Deliveries table
    conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS webhook_deliveries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
            event_type VARCHAR(100) NOT NULL,
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            response_status_code INTEGER,
            response_body TEXT,
            execution_time_ms INTEGER,
            is_success BOOLEAN NOT NULL DEFAULT FALSE,
            attempt_number INTEGER NOT NULL DEFAULT 1,
            error_message TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """)
    )

    # 4. Indexes (split single execution per asyncpg)
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_api_keys_org_status ON api_keys(org_id, status);"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_api_keys_key_hash ON api_keys(key_hash);"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_webhook_subs_org ON webhook_subscriptions(org_id, is_active);"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_webhook_deliv_sub ON webhook_deliveries(subscription_id, created_at DESC);"))


def downgrade() -> None:
    conn = op.get_bind()

    conn.execute(text("DROP TABLE IF EXISTS webhook_deliveries CASCADE;"))
    conn.execute(text("DROP TABLE IF EXISTS webhook_subscriptions CASCADE;"))
    conn.execute(text("DROP TABLE IF EXISTS api_keys CASCADE;"))
