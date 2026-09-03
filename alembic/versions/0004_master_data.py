"""Create master data tables

Revision ID: 0004_master_data
Revises: 0003_org_structure
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0004_master_data'
down_revision: Union[str, None] = '0003_org_structure'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    CREATE TABLE categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        parent_id UUID REFERENCES categories(id),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(200) NOT NULL,
        level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
        erp_material_group VARCHAR(50),
        gl_account_mapping VARCHAR(20),
        synonyms TEXT[] DEFAULT '{}',
        requires_quality_inspection BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, code),
        CONSTRAINT chk_no_circular_ref CHECK (id != parent_id)
    );
    """)

    op.execute("""
    CREATE TABLE uom_master (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        code VARCHAR(10) NOT NULL,
        name VARCHAR(50) NOT NULL,
        erp_uom_code VARCHAR(10),
        base_uom_id UUID REFERENCES uom_master(id),
        conversion_factor NUMERIC(18,8) DEFAULT 1.0,
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
    CREATE TABLE currency_master (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        code CHAR(3) NOT NULL,
        name VARCHAR(50) NOT NULL,
        symbol VARCHAR(5),
        decimal_places INTEGER NOT NULL DEFAULT 2,
        exchange_rate_to_base NUMERIC(18,8) NOT NULL DEFAULT 1.0,
        rate_last_updated TIMESTAMP WITH TIME ZONE,
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
    CREATE TABLE payment_terms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        payment_days INTEGER NOT NULL,
        advance_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
        retention_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
        discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
        discount_days INTEGER DEFAULT 0,
        npv_factor NUMERIC(10,8),
        erp_payment_term_code VARCHAR(20),
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
    CREATE TABLE incoterms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        edition_year INTEGER NOT NULL DEFAULT 2020,
        risk_transfer_point TEXT NOT NULL,
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
    CREATE TABLE tax_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        tax_type tax_type NOT NULL,
        rate NUMERIC(5,2) NOT NULL,
        hsn_code_range_start VARCHAR(10),
        hsn_code_range_end VARCHAR(10),
        effective_from DATE NOT NULL,
        effective_to DATE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, code, effective_from)
    );
    """)

    op.execute("""
    CREATE TABLE delivery_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        plant_id UUID REFERENCES plants(id),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(200) NOT NULL,
        address_line1 VARCHAR(300),
        address_line2 VARCHAR(300),
        city VARCHAR(100),
        state VARCHAR(100),
        postal_code VARCHAR(10),
        country_code CHAR(2) NOT NULL DEFAULT 'IN',
        latitude NUMERIC(9,6),
        longitude NUMERIC(9,6),
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
    CREATE TABLE document_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        code VARCHAR(30) NOT NULL,
        name VARCHAR(200) NOT NULL,
        category document_category NOT NULL,
        is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
        validity_period_days INTEGER,
        allowed_extensions TEXT[] NOT NULL DEFAULT '{pdf,jpg,jpeg,png,doc,docx,xls,xlsx}',
        max_file_size_mb INTEGER NOT NULL DEFAULT 10,
        ocr_enabled BOOLEAN NOT NULL DEFAULT FALSE,
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
    CREATE TABLE supplier_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(200) NOT NULL,
        qualification_checklist JSONB NOT NULL DEFAULT '[]',
        evaluation_frequency_months INTEGER NOT NULL DEFAULT 12,
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
    CREATE TABLE holiday_master (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        holiday_date DATE NOT NULL,
        name VARCHAR(200) NOT NULL,
        applies_to_bu UUID REFERENCES business_units(id),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMP WITH TIME ZONE
    );
    """)

    op.execute("""
    CREATE UNIQUE INDEX idx_holiday_master_unique ON holiday_master (org_id, holiday_date, COALESCE(applies_to_bu, '00000000-0000-0000-0000-000000000000'));
    """)

    op.execute("""
    CREATE TABLE erp_material_group_mapping (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        erp_material_group VARCHAR(50) NOT NULL,
        category_id UUID NOT NULL REFERENCES categories(id),
        confidence NUMERIC(3,2) NOT NULL DEFAULT 1.00,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, erp_material_group)
    );
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS erp_material_group_mapping CASCADE")
    op.execute("DROP TABLE IF EXISTS holiday_master CASCADE")
    op.execute("DROP TABLE IF EXISTS supplier_categories CASCADE")
    op.execute("DROP TABLE IF EXISTS document_types CASCADE")
    op.execute("DROP TABLE IF EXISTS delivery_locations CASCADE")
    op.execute("DROP TABLE IF EXISTS tax_codes CASCADE")
    op.execute("DROP TABLE IF EXISTS incoterms CASCADE")
    op.execute("DROP TABLE IF EXISTS payment_terms CASCADE")
    op.execute("DROP TABLE IF EXISTS currency_master CASCADE")
    op.execute("DROP TABLE IF EXISTS uom_master CASCADE")
    op.execute("DROP TABLE IF EXISTS categories CASCADE")
