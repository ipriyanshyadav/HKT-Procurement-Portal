"""Create requisition and unmapped PR tables

Revision ID: 0011_requisition
Revises: 0010_approval_workflow
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0011_requisition'
down_revision: Union[str, None] = '0010_approval_workflow'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    CREATE TABLE requisitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        pr_number VARCHAR(30) NOT NULL,
        title VARCHAR(300) NOT NULL,
        description TEXT,
        source pr_source NOT NULL DEFAULT 'MANUAL',
        status pr_status NOT NULL DEFAULT 'DRAFT',
        procurement_type procurement_type NOT NULL DEFAULT 'OPEX',
        requestor_id UUID NOT NULL REFERENCES users(id),
        business_unit_id UUID NOT NULL REFERENCES business_units(id),
        plant_id UUID REFERENCES plants(id),
        department_id UUID REFERENCES departments(id),
        cost_center_id UUID NOT NULL REFERENCES cost_centers(id),
        category_id UUID NOT NULL REFERENCES categories(id),
        currency CHAR(3) NOT NULL DEFAULT 'INR',
        estimated_value NUMERIC(18,2) NOT NULL DEFAULT 0,
        budget_check_status VARCHAR(20) DEFAULT 'NOT_CHECKED',
        budget_reserved_amount NUMERIC(18,2) DEFAULT 0,
        is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
        is_capex BOOLEAN NOT NULL DEFAULT FALSE,
        required_by_date DATE,
        delivery_location_id UUID REFERENCES delivery_locations(id),
        erp_pr_number VARCHAR(30),
        erp_sync_status VARCHAR(20) DEFAULT 'NOT_SYNCED',
        merged_from UUID[],
        split_into UUID[],
        split_from UUID,
        approved_at TIMESTAMP WITH TIME ZONE,
        aging_alert_level INTEGER DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID REFERENCES users(id),
        updated_by UUID REFERENCES users(id),
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, pr_number)
    );
    """)

    op.execute("""
    CREATE TABLE requisition_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        requisition_id UUID NOT NULL REFERENCES requisitions(id),
        line_number INTEGER NOT NULL,
        item_description VARCHAR(500) NOT NULL,
        item_code VARCHAR(50),
        category_id UUID NOT NULL REFERENCES categories(id),
        uom_id UUID NOT NULL REFERENCES uom_master(id),
        quantity NUMERIC(18,4) NOT NULL,
        estimated_unit_price NUMERIC(18,4) NOT NULL DEFAULT 0,
        estimated_total NUMERIC(18,2) GENERATED ALWAYS AS (quantity * estimated_unit_price) STORED,
        hsn_code VARCHAR(10),
        specifications TEXT,
        required_by_date DATE,
        delivery_location_id UUID REFERENCES delivery_locations(id),
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, requisition_id, line_number)
    );
    """)

    op.execute("""
    CREATE TABLE unmapped_pr_exceptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        requisition_id UUID NOT NULL REFERENCES requisitions(id),
        failed_fields JSONB NOT NULL,
        status unmapped_pr_status NOT NULL DEFAULT 'PENDING',
        assigned_to UUID REFERENCES users(id),
        sla_deadline TIMESTAMP WITH TIME ZONE,
        sla_breach_level INTEGER DEFAULT 0,
        proposed_mappings JSONB,
        resolution_notes TEXT,
        resolved_at TIMESTAMP WITH TIME ZONE,
        resolved_by UUID REFERENCES users(id),
        reprocessing_attempts INTEGER NOT NULL DEFAULT 0,
        last_reprocessing_error TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE unmapped_pr_mapping_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        exception_id UUID NOT NULL REFERENCES unmapped_pr_exceptions(id),
        field_name VARCHAR(50) NOT NULL,
        source_value VARCHAR(200) NOT NULL,
        mapped_to_id UUID NOT NULL,
        mapped_to_label VARCHAR(200) NOT NULL,
        mapping_method VARCHAR(20) NOT NULL,
        confidence NUMERIC(3,2),
        mapped_by UUID NOT NULL REFERENCES users(id),
        checked_by UUID REFERENCES users(id),
        checked_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS unmapped_pr_mapping_log CASCADE")
    op.execute("DROP TABLE IF EXISTS unmapped_pr_exceptions CASCADE")
    op.execute("DROP TABLE IF EXISTS requisition_lines CASCADE")
    op.execute("DROP TABLE IF EXISTS requisitions CASCADE")
