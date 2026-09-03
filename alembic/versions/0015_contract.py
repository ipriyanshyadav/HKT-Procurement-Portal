"""Create contract templates, contracts, and related contract tables

Revision ID: 0015_contract
Revises: 0014_evaluation_award
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0015_contract'
down_revision: Union[str, None] = '0014_evaluation_award'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    CREATE TABLE contract_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        name VARCHAR(200) NOT NULL,
        contract_type VARCHAR(50) NOT NULL,
        template_content JSONB NOT NULL,
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
    CREATE TABLE contracts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        contract_number VARCHAR(30) NOT NULL,
        title VARCHAR(300) NOT NULL,
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        rfq_id UUID REFERENCES rfqs(id),
        arn_id UUID REFERENCES award_recommendations(id),
        status contract_status NOT NULL DEFAULT 'DRAFT',
        contract_type VARCHAR(50) NOT NULL DEFAULT 'RATE_CONTRACT',
        currency CHAR(3) NOT NULL DEFAULT 'INR',
        total_value NUMERIC(18,2) NOT NULL DEFAULT 0,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        payment_term_id UUID REFERENCES payment_terms(id),
        incoterm_id UUID REFERENCES incoterms(id),
        business_unit_id UUID NOT NULL REFERENCES business_units(id),
        category_id UUID NOT NULL REFERENCES categories(id),
        template_id UUID REFERENCES contract_templates(id),
        signing_log JSONB DEFAULT '[]',
        signed_document_id UUID,
        esign_request_id VARCHAR(200),
        esign_provider VARCHAR(50),
        amendment_count INTEGER NOT NULL DEFAULT 0,
        renewal_alert_sent BOOLEAN NOT NULL DEFAULT FALSE,
        auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
        erp_contract_number VARCHAR(30),
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID REFERENCES users(id),
        updated_by UUID REFERENCES users(id),
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, contract_number),
        CONSTRAINT chk_contract_dates CHECK (end_date > start_date)
    );
    """)

    op.execute("""
    CREATE TABLE contract_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        contract_id UUID NOT NULL REFERENCES contracts(id),
        line_number INTEGER NOT NULL,
        item_description VARCHAR(500) NOT NULL,
        uom_id UUID NOT NULL REFERENCES uom_master(id),
        contracted_quantity NUMERIC(18,4),
        unit_rate NUMERIC(18,4) NOT NULL,
        utilized_quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
        hsn_code VARCHAR(10),
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, contract_id, line_number)
    );
    """)

    op.execute("""
    CREATE TABLE contract_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        contract_id UUID NOT NULL REFERENCES contracts(id),
        document_id UUID NOT NULL,
        document_purpose VARCHAR(50) NOT NULL,
        version_number INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE contract_amendments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        contract_id UUID NOT NULL REFERENCES contracts(id),
        amendment_number INTEGER NOT NULL,
        changes_summary TEXT NOT NULL,
        field_changes JSONB NOT NULL,
        new_document_id UUID,
        amended_by UUID NOT NULL REFERENCES users(id),
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (org_id, contract_id, amendment_number)
    );
    """)

    op.execute("""
    CREATE TABLE contract_milestones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        contract_id UUID NOT NULL REFERENCES contracts(id),
        title VARCHAR(200) NOT NULL,
        description TEXT,
        due_date DATE NOT NULL,
        responsible_party VARCHAR(20) NOT NULL,
        responsible_user_id UUID REFERENCES users(id),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        completed_at TIMESTAMP WITH TIME ZONE,
        completion_notes TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS contract_milestones CASCADE")
    op.execute("DROP TABLE IF EXISTS contract_amendments CASCADE")
    op.execute("DROP TABLE IF EXISTS contract_documents CASCADE")
    op.execute("DROP TABLE IF EXISTS contract_lines CASCADE")
    op.execute("DROP TABLE IF EXISTS contracts CASCADE")
    op.execute("DROP TABLE IF EXISTS contract_templates CASCADE")
