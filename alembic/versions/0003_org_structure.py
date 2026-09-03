"""Create organization and organizational structure tables

Revision ID: 0003_org_structure
Revises: 0002_create_enums
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0003_org_structure'
down_revision: Union[str, None] = '0002_create_enums'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    CREATE TABLE organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        legal_name VARCHAR(300) NOT NULL,
        registration_number VARCHAR(50),
        tax_id VARCHAR(50),
        country_code CHAR(2) NOT NULL DEFAULT 'IN',
        base_currency CHAR(3) NOT NULL DEFAULT 'INR',
        cost_of_capital_rate NUMERIC(5,4) NOT NULL DEFAULT 0.1200,
        logo_url TEXT,
        settings JSONB NOT NULL DEFAULT '{}',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    );
    """)

    op.execute("""
    CREATE TABLE legal_entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        name VARCHAR(200) NOT NULL,
        registration_number VARCHAR(50) NOT NULL,
        gstin VARCHAR(15),
        pan VARCHAR(10),
        cin VARCHAR(21),
        address_line1 VARCHAR(300),
        address_line2 VARCHAR(300),
        city VARCHAR(100),
        state VARCHAR(100),
        postal_code VARCHAR(10),
        country_code CHAR(2) NOT NULL DEFAULT 'IN',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, registration_number)
    );
    """)

    op.execute("""
    CREATE TABLE business_units (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        legal_entity_id UUID NOT NULL REFERENCES legal_entities(id),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(200) NOT NULL,
        erp_company_code VARCHAR(20),
        default_currency CHAR(3) NOT NULL DEFAULT 'INR',
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
    CREATE TABLE plants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        business_unit_id UUID NOT NULL REFERENCES business_units(id),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(200) NOT NULL,
        plant_type VARCHAR(50) NOT NULL DEFAULT 'MANUFACTURING',
        erp_plant_code VARCHAR(20),
        address_line1 VARCHAR(300),
        city VARCHAR(100),
        state VARCHAR(100),
        postal_code VARCHAR(10),
        country_code CHAR(2) NOT NULL DEFAULT 'IN',
        latitude NUMERIC(9,6),
        longitude NUMERIC(9,6),
        default_delivery_location_id UUID,
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
    CREATE TABLE cost_centers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        business_unit_id UUID NOT NULL REFERENCES business_units(id),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(200) NOT NULL,
        gl_account VARCHAR(20),
        erp_cost_center_code VARCHAR(20),
        annual_budget NUMERIC(18,2) NOT NULL DEFAULT 0,
        available_budget NUMERIC(18,2) NOT NULL DEFAULT 0,
        budget_period_start DATE,
        budget_period_end DATE,
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
    CREATE TABLE departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        business_unit_id UUID NOT NULL REFERENCES business_units(id),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(200) NOT NULL,
        head_user_id UUID,
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

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS departments CASCADE")
    op.execute("DROP TABLE IF EXISTS cost_centers CASCADE")
    op.execute("DROP TABLE IF EXISTS plants CASCADE")
    op.execute("DROP TABLE IF EXISTS business_units CASCADE")
    op.execute("DROP TABLE IF EXISTS legal_entities CASCADE")
    op.execute("DROP TABLE IF EXISTS organizations CASCADE")
