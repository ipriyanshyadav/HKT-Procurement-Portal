"""Create infrastructure, outbox, integration, and admin tables

Revision ID: 0021_infra_tables
Revises: 0020_notification
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0021_infra_tables'
down_revision: Union[str, None] = '0020_notification'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    CREATE TABLE outbox_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        exchange VARCHAR(100) NOT NULL,
        routing_key VARCHAR(200) NOT NULL,
        payload JSONB NOT NULL,
        headers JSONB DEFAULT '{}',
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        published_at TIMESTAMP WITH TIME ZONE,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        CONSTRAINT chk_outbox_status CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED'))
    );
    """)

    op.execute("""
    CREATE TABLE integration_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        job_type VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID NOT NULL,
        direction VARCHAR(10) NOT NULL,
        adapter_type VARCHAR(30) NOT NULL,
        status integration_job_status NOT NULL DEFAULT 'PENDING',
        request_payload JSONB,
        response_payload JSONB,
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 7,
        next_retry_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE feature_flags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        flag_key VARCHAR(100) NOT NULL,
        flag_value BOOLEAN NOT NULL DEFAULT FALSE,
        description TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_by UUID,
        UNIQUE (org_id, flag_key)
    );
    """)

    op.execute("""
    CREATE TABLE tenant_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        setting_key VARCHAR(100) NOT NULL,
        setting_value JSONB NOT NULL,
        description TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_by UUID,
        UNIQUE (org_id, setting_key)
    );
    """)

    op.execute("""
    CREATE TABLE scheduled_job_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID,
        job_name VARCHAR(100) NOT NULL,
        started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
        records_processed INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS scheduled_job_runs CASCADE")
    op.execute("DROP TABLE IF EXISTS tenant_settings CASCADE")
    op.execute("DROP TABLE IF EXISTS feature_flags CASCADE")
    op.execute("DROP TABLE IF EXISTS integration_jobs CASCADE")
    op.execute("DROP TABLE IF EXISTS outbox_messages CASCADE")
