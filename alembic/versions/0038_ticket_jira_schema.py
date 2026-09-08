"""Create Jira enhancement tables: due_date, ticket_links, custom fields, and automation rules

Revision ID: 0038_ticket_jira_schema
Revises: 0034_ticket_permissions
Create Date: 2026-09-08 12:40:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "0038_ticket_jira_schema"
down_revision: Union[str, None] = "0034_ticket_permissions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. due_date column on tickets
    op.execute("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS due_date DATE;")
    op.execute("CREATE INDEX IF NOT EXISTS idx_tickets_due_date ON tickets(due_date) WHERE deleted_at IS NULL;")

    # 2. ticket_link_type_enum & ticket_links table
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_link_type_enum') THEN
            CREATE TYPE ticket_link_type_enum AS ENUM (
                'BLOCKS', 'IS_BLOCKED_BY', 'RELATES_TO',
                'DUPLICATES', 'IS_DUPLICATED_BY', 'CLONES', 'IS_CLONED_BY'
            );
        END IF;
    END$$;
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS ticket_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        source_ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        target_ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        link_type ticket_link_type_enum NOT NULL,
        created_by UUID NOT NULL REFERENCES users(id),
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT uq_ticket_links_source_target_type UNIQUE (source_ticket_id, target_ticket_id, link_type)
    );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_ticket_links_source ON ticket_links(source_ticket_id) WHERE deleted_at IS NULL;")
    op.execute("CREATE INDEX IF NOT EXISTS idx_ticket_links_target ON ticket_links(target_ticket_id) WHERE deleted_at IS NULL;")

    # 3. custom_field_type_enum & ticket_custom_field_defs table
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'custom_field_type_enum') THEN
            CREATE TYPE custom_field_type_enum AS ENUM (
                'TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT', 'BOOLEAN'
            );
        END IF;
    END$$;
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS ticket_custom_field_defs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        name VARCHAR(100) NOT NULL,
        field_key VARCHAR(100) NOT NULL,
        field_type custom_field_type_enum NOT NULL,
        description VARCHAR(255),
        is_required BOOLEAN NOT NULL DEFAULT FALSE,
        default_value TEXT,
        options JSONB NOT NULL DEFAULT '[]'::jsonb,
        applies_to_ticket_types VARCHAR[] NOT NULL DEFAULT '{}',
        created_by UUID NOT NULL REFERENCES users(id),
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT uq_ticket_custom_field_defs_org_key UNIQUE (org_id, field_key)
    );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_ticket_cf_defs_org ON ticket_custom_field_defs(org_id) WHERE deleted_at IS NULL;")

    # 4. ticket_custom_field_values table
    op.execute("""
    CREATE TABLE IF NOT EXISTS ticket_custom_field_values (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        field_def_id UUID NOT NULL REFERENCES ticket_custom_field_defs(id) ON DELETE CASCADE,
        value_text TEXT,
        value_number NUMERIC(15, 4),
        value_json JSONB,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT uq_ticket_custom_field_values_ticket_field UNIQUE (ticket_id, field_def_id)
    );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_ticket_cf_values_ticket ON ticket_custom_field_values(ticket_id) WHERE deleted_at IS NULL;")

    # 5. automation_trigger_enum & ticket_automation_rules table
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'automation_trigger_enum') THEN
            CREATE TYPE automation_trigger_enum AS ENUM (
                'TICKET_CREATED', 'STATUS_CHANGED', 'FIELD_CHANGED', 'SLA_BREACHED', 'SCHEDULE'
            );
        END IF;
    END$$;
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS ticket_automation_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        name VARCHAR(150) NOT NULL,
        description TEXT,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        trigger_type automation_trigger_enum NOT NULL,
        trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
        conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
        actions JSONB NOT NULL DEFAULT '[]'::jsonb,
        execution_count INTEGER NOT NULL DEFAULT 0,
        last_executed_at TIMESTAMP WITH TIME ZONE,
        created_by UUID NOT NULL REFERENCES users(id),
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_ticket_automation_org_trigger ON ticket_automation_rules(org_id, trigger_type) WHERE deleted_at IS NULL;")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ticket_automation_rules CASCADE;")
    op.execute("DROP TYPE IF EXISTS automation_trigger_enum CASCADE;")

    op.execute("DROP TABLE IF EXISTS ticket_custom_field_values CASCADE;")
    op.execute("DROP TABLE IF EXISTS ticket_custom_field_defs CASCADE;")
    op.execute("DROP TYPE IF EXISTS custom_field_type_enum CASCADE;")

    op.execute("DROP TABLE IF EXISTS ticket_links CASCADE;")
    op.execute("DROP TYPE IF EXISTS ticket_link_type_enum CASCADE;")

    op.execute("DROP INDEX IF EXISTS idx_tickets_due_date;")
    op.execute("ALTER TABLE tickets DROP COLUMN IF EXISTS due_date;")
