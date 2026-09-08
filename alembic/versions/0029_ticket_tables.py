"""Create ticket tables

Revision ID: 0029_ticket_tables
Revises: 0028_ticket_enums
Create Date: 2026-09-08 04:31:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "0029_ticket_tables"
down_revision: Union[str, None] = "0028_ticket_enums"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. tickets
    op.execute("""
    CREATE TABLE tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        ticket_number VARCHAR(30) NOT NULL UNIQUE,
        title VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        ticket_type ticket_type_enum NOT NULL,
        priority ticket_priority_enum NOT NULL DEFAULT 'MEDIUM',
        status ticket_status_enum NOT NULL DEFAULT 'OPEN',
        category VARCHAR(100),
        raised_by UUID NOT NULL REFERENCES users(id),
        raised_by_portal VARCHAR(20) NOT NULL DEFAULT 'buyer',
        assigned_to UUID REFERENCES users(id),
        assigned_team VARCHAR(100),
        entity_type VARCHAR(50),
        entity_id UUID,
        entity_number VARCHAR(100),
        resolution_note TEXT,
        resolved_at TIMESTAMP WITH TIME ZONE,
        sla_breach_at TIMESTAMP WITH TIME ZONE,
        sla_status VARCHAR(20) NOT NULL DEFAULT 'WITHIN_SLA',
        first_response_at TIMESTAMP WITH TIME ZONE,
        reopen_count INTEGER NOT NULL DEFAULT 0,
        tags VARCHAR[] NOT NULL DEFAULT '{}',
        is_private BOOLEAN NOT NULL DEFAULT FALSE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    )
    """)

    # 2. ticket_comments
    op.execute("""
    CREATE TABLE ticket_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        is_internal BOOLEAN NOT NULL DEFAULT FALSE,
        mentioned_users UUID[] NOT NULL DEFAULT '{}',
        edited_at TIMESTAMP WITH TIME ZONE,
        edited_by UUID REFERENCES users(id),
        parent_id UUID REFERENCES ticket_comments(id),
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    )
    """)

    # 3. ticket_attachments
    op.execute("""
    CREATE TABLE ticket_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        comment_id UUID REFERENCES ticket_comments(id),
        document_id UUID NOT NULL REFERENCES documents(id),
        uploaded_by UUID NOT NULL REFERENCES users(id),
        file_name VARCHAR(255) NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    )
    """)

    # 4. ticket_watchers
    op.execute("""
    CREATE TABLE ticket_watchers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        added_by UUID NOT NULL REFERENCES users(id),
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT uq_ticket_watchers_ticket_user UNIQUE (ticket_id, user_id)
    )
    """)

    # 5. ticket_activity_log (NO deleted_at column — immutable log)
    op.execute("""
    CREATE TABLE ticket_activity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        actor_id UUID NOT NULL REFERENCES users(id),
        activity_type VARCHAR(50) NOT NULL,
        old_value VARCHAR(500),
        new_value VARCHAR(500),
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
    """)

    # 6. ticket_sla_config
    op.execute("""
    CREATE TABLE ticket_sla_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        priority ticket_priority_enum NOT NULL,
        first_response_hours INTEGER NOT NULL,
        resolution_hours INTEGER NOT NULL,
        escalation_hours INTEGER NOT NULL,
        escalate_to_role VARCHAR(100),
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT uq_ticket_sla_config_org_priority UNIQUE (org_id, priority)
    )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ticket_sla_config CASCADE")
    op.execute("DROP TABLE IF EXISTS ticket_activity_log CASCADE")
    op.execute("DROP TABLE IF EXISTS ticket_watchers CASCADE")
    op.execute("DROP TABLE IF EXISTS ticket_attachments CASCADE")
    op.execute("DROP TABLE IF EXISTS ticket_comments CASCADE")
    op.execute("DROP TABLE IF EXISTS tickets CASCADE")
