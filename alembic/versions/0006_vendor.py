"""Create vendor tables without invited_by FK

Revision ID: 0006_vendor
Revises: 0005_user_auth_part1
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0006_vendor'
down_revision: Union[str, None] = '0005_user_auth_part1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    CREATE TABLE vendors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        vendor_code VARCHAR(20),
        company_name VARCHAR(300) NOT NULL,
        legal_name VARCHAR(300),
        registration_type VARCHAR(50) NOT NULL DEFAULT 'DOMESTIC',
        pan VARCHAR(10),
        pan_encrypted VARCHAR(500),
        gstin VARCHAR(15),
        gstin_encrypted VARCHAR(500),
        cin VARCHAR(21),
        duns_number VARCHAR(13),
        website VARCHAR(500),
        primary_email VARCHAR(255) NOT NULL,
        primary_phone VARCHAR(20),
        address_line1 VARCHAR(300),
        address_line2 VARCHAR(300),
        city VARCHAR(100),
        state VARCHAR(100),
        postal_code VARCHAR(10),
        country_code CHAR(2) NOT NULL DEFAULT 'IN',
        status vendor_status NOT NULL DEFAULT 'INVITED',
        erp_vendor_code VARCHAR(20),
        erp_sync_status VARCHAR(20) DEFAULT 'NOT_SYNCED',
        erp_last_synced_at TIMESTAMP WITH TIME ZONE,
        onboarding_step INTEGER NOT NULL DEFAULT 0,
        invitation_token VARCHAR(200),
        invitation_expires_at TIMESTAMP WITH TIME ZONE,
        submitted_at TIMESTAMP WITH TIME ZONE,
        qualified_at TIMESTAMP WITH TIME ZONE,
        activated_at TIMESTAMP WITH TIME ZONE,
        blacklisted_at TIMESTAMP WITH TIME ZONE,
        blacklist_reason TEXT,
        blacklist_initiated_by UUID,
        blacklist_confirmed_by UUID,
        suspension_reason TEXT,
        compliance_score NUMERIC(5,2),
        performance_score NUMERIC(5,2),
        last_scorecard_at TIMESTAMP WITH TIME ZONE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, vendor_code),
        UNIQUE (org_id, primary_email)
    );
    """)

    op.execute("""
    CREATE TABLE vendor_contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        name VARCHAR(200) NOT NULL,
        designation VARCHAR(100),
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    );
    """)

    op.execute("""
    CREATE TABLE vendor_bank_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        account_holder_name VARCHAR(200) NOT NULL,
        bank_name VARCHAR(200) NOT NULL,
        branch_name VARCHAR(200),
        account_number_encrypted VARCHAR(500) NOT NULL,
        ifsc_code VARCHAR(11) NOT NULL,
        swift_code VARCHAR(11),
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        penny_test_status VARCHAR(20) NOT NULL DEFAULT 'NOT_INITIATED',
        penny_test_reference VARCHAR(100),
        penny_test_initiated_at TIMESTAMP WITH TIME ZONE,
        penny_test_validated_at TIMESTAMP WITH TIME ZONE,
        validated_by UUID,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    );
    """)

    op.execute("""
    CREATE TABLE vendor_category_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        category_id UUID NOT NULL REFERENCES categories(id),
        is_qualified BOOLEAN NOT NULL DEFAULT FALSE,
        qualified_at TIMESTAMP WITH TIME ZONE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, vendor_id, category_id)
    );
    """)

    op.execute("""
    CREATE TABLE vendor_scorecards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        on_time_delivery_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
        quality_acceptance_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
        commercial_compliance_score NUMERIC(5,2) NOT NULL DEFAULT 0,
        responsiveness_score NUMERIC(5,2) NOT NULL DEFAULT 0,
        overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,
        calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE vendor_erp_sync_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        sync_direction VARCHAR(20) NOT NULL,
        sync_status VARCHAR(20) NOT NULL,
        erp_vendor_code VARCHAR(20),
        request_payload JSONB,
        response_payload JSONB,
        error_message TEXT,
        synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS vendor_erp_sync_log CASCADE")
    op.execute("DROP TABLE IF EXISTS vendor_scorecards CASCADE")
    op.execute("DROP TABLE IF EXISTS vendor_category_mappings CASCADE")
    op.execute("DROP TABLE IF EXISTS vendor_bank_accounts CASCADE")
    op.execute("DROP TABLE IF EXISTS vendor_contacts CASCADE")
    op.execute("DROP TABLE IF EXISTS vendors CASCADE")
