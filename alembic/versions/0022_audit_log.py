"""Create partitioned audit_logs table, immutability trigger, and audit writer role

Revision ID: 0022_audit_log
Revises: 0021_infra_tables
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0022_audit_log'
down_revision: Union[str, None] = '0021_infra_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    CREATE TABLE audit_logs (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        entity_type audit_entity_type NOT NULL,
        entity_id UUID NOT NULL,
        action VARCHAR(50) NOT NULL,
        actor_id UUID,
        actor_email VARCHAR(255),
        actor_ip INET,
        field_changes JSONB,
        old_values JSONB,
        new_values JSONB,
        metadata JSONB DEFAULT '{}',
        trace_id VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, created_at)
    ) PARTITION BY RANGE (created_at);
    """)

    op.execute("""
    CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
    RETURNS TRIGGER AS $$
    BEGIN
        RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are prohibited.'
            USING ERRCODE = 'restrict_violation';
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    """)

    op.execute("""
    CREATE TRIGGER trg_audit_log_immutable
        BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION prevent_audit_log_modification();
    """)

    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_audit_writer') THEN
            CREATE ROLE app_audit_writer;
        END IF;
    END $$;
    """)

    op.execute("""
    GRANT INSERT ON audit_logs TO app_audit_writer;
    """)

    op.execute("""
    REVOKE UPDATE, DELETE ON audit_logs FROM app_audit_writer;
    """)

def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_logs")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_log_modification()")
    op.execute("DROP TABLE IF EXISTS audit_logs CASCADE")
    op.execute("DROP ROLE IF EXISTS app_audit_writer")
