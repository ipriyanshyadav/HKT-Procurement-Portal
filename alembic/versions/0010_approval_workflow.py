"""Create approval rules and workflow tables

Revision ID: 0010_approval_workflow
Revises: 0009_vendor_documents
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0010_approval_workflow'
down_revision: Union[str, None] = '0009_vendor_documents'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    CREATE TABLE approval_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        name VARCHAR(200) NOT NULL,
        transaction_type VARCHAR(50) NOT NULL,
        priority INTEGER NOT NULL,
        conditions JSONB NOT NULL DEFAULT '[]',
        approval_steps JSONB NOT NULL DEFAULT '[]',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        current_version_id UUID,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMP WITH TIME ZONE
    );
    """)

    op.execute("""
    CREATE TABLE approval_rule_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        approval_rule_id UUID NOT NULL REFERENCES approval_rules(id),
        version_number INTEGER NOT NULL,
        conditions JSONB NOT NULL,
        approval_steps JSONB NOT NULL,
        effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
        effective_to TIMESTAMP WITH TIME ZONE,
        change_reason TEXT,
        impact_assessment JSONB,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID,
        UNIQUE (org_id, approval_rule_id, version_number)
    );
    """)

    op.execute("""
    CREATE TABLE approval_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        code VARCHAR(50) NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, code)
    );
    """)

    op.execute("""
    CREATE TABLE approval_group_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        approval_group_id UUID NOT NULL REFERENCES approval_groups(id),
        user_id UUID NOT NULL REFERENCES users(id),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID,
        UNIQUE (org_id, approval_group_id, user_id)
    );
    """)

    op.execute("""
    CREATE TABLE workflow_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        code VARCHAR(50) NOT NULL,
        name VARCHAR(200) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        steps JSONB NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, code)
    );
    """)

    op.execute("""
    CREATE TABLE workflow_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        template_id UUID NOT NULL REFERENCES workflow_templates(id),
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID NOT NULL,
        status workflow_instance_status NOT NULL DEFAULT 'ACTIVE',
        current_step_number INTEGER NOT NULL DEFAULT 1,
        entity_context JSONB NOT NULL DEFAULT '{}',
        rule_version_id UUID REFERENCES approval_rule_versions(id),
        started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        cancelled_at TIMESTAMP WITH TIME ZONE,
        cancel_reason TEXT,
        cancelled_by UUID REFERENCES users(id),
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE workflow_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id),
        step_number INTEGER NOT NULL,
        assigned_to UUID NOT NULL REFERENCES users(id),
        assigned_role VARCHAR(50),
        status approval_task_status NOT NULL DEFAULT 'PENDING',
        action task_action,
        comment TEXT,
        acted_at TIMESTAMP WITH TIME ZONE,
        sla_deadline TIMESTAMP WITH TIME ZONE,
        sla_status VARCHAR(20) DEFAULT 'WITHIN_SLA',
        parallel_task_group_id UUID,
        delegated_from UUID REFERENCES users(id),
        is_maker_checker_enforced BOOLEAN NOT NULL DEFAULT TRUE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE workflow_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id),
        workflow_task_id UUID REFERENCES workflow_tasks(id),
        event_type VARCHAR(50) NOT NULL,
        event_data JSONB NOT NULL DEFAULT '{}',
        actor_id UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS workflow_events CASCADE")
    op.execute("DROP TABLE IF EXISTS workflow_tasks CASCADE")
    op.execute("DROP TABLE IF EXISTS workflow_instances CASCADE")
    op.execute("DROP TABLE IF EXISTS workflow_templates CASCADE")
    op.execute("DROP TABLE IF EXISTS approval_group_members CASCADE")
    op.execute("DROP TABLE IF EXISTS approval_groups CASCADE")
    op.execute("DROP TABLE IF EXISTS approval_rule_versions CASCADE")
    op.execute("DROP TABLE IF EXISTS approval_rules CASCADE")
