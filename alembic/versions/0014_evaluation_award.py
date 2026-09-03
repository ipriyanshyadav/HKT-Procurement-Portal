"""Create evaluation, comparative statement, negotiation, and award tables

Revision ID: 0014_evaluation_award
Revises: 0013_bid
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0014_evaluation_award'
down_revision: Union[str, None] = '0013_bid'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    CREATE TABLE evaluations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        rfq_id UUID NOT NULL REFERENCES rfqs(id),
        evaluation_type evaluation_type NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
        evaluated_by UUID NOT NULL REFERENCES users(id),
        completed_at TIMESTAMP WITH TIME ZONE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE evaluation_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        evaluation_id UUID NOT NULL REFERENCES evaluations(id),
        bid_id UUID NOT NULL REFERENCES bid_responses(id),
        criterion VARCHAR(200) NOT NULL,
        max_score NUMERIC(5,2) NOT NULL,
        awarded_score NUMERIC(5,2) NOT NULL,
        remarks TEXT,
        scored_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE comparative_statements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        rfq_id UUID NOT NULL REFERENCES rfqs(id),
        cs_number VARCHAR(30) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        cost_of_capital_rate NUMERIC(5,4) NOT NULL,
        evaluation_methodology TEXT NOT NULL,
        total_estimated_value NUMERIC(18,2) NOT NULL,
        l1_total_value NUMERIC(18,2),
        savings_percentage NUMERIC(5,2),
        recommendations TEXT,
        generated_by UUID NOT NULL REFERENCES users(id),
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMP WITH TIME ZONE,
        pdf_document_id UUID,
        cs_version INTEGER NOT NULL DEFAULT 1,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (org_id, cs_number)
    );
    """)

    op.execute("""
    CREATE TABLE cs_line_rankings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        cs_id UUID NOT NULL REFERENCES comparative_statements(id),
        rfq_line_id UUID NOT NULL REFERENCES rfq_lines(id),
        bid_id UUID NOT NULL REFERENCES bid_responses(id),
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        raw_unit_price NUMERIC(18,4) NOT NULL,
        freight_per_unit NUMERIC(18,4) NOT NULL DEFAULT 0,
        tax_per_unit NUMERIC(18,4) NOT NULL DEFAULT 0,
        landed_cost NUMERIC(18,4) NOT NULL,
        npv_adjusted_cost NUMERIC(18,4) NOT NULL,
        rank INTEGER NOT NULL,
        tax_discrepancy BOOLEAN NOT NULL DEFAULT FALSE,
        supplier_declared_rate NUMERIC(5,2),
        hsn_master_rate NUMERIC(5,2),
        tie_breaking_applied BOOLEAN NOT NULL DEFAULT FALSE,
        tie_breaking_reason VARCHAR(200),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE negotiations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        rfq_id UUID NOT NULL REFERENCES rfqs(id),
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        round_number INTEGER NOT NULL DEFAULT 1,
        proposed_price NUMERIC(18,4),
        counter_price NUMERIC(18,4),
        status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        notes TEXT,
        negotiated_by UUID NOT NULL REFERENCES users(id),
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE award_recommendations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        rfq_id UUID NOT NULL REFERENCES rfqs(id),
        cs_id UUID NOT NULL REFERENCES comparative_statements(id),
        arn_number VARCHAR(30) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        justification TEXT NOT NULL,
        recommended_by UUID NOT NULL REFERENCES users(id),
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMP WITH TIME ZONE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (org_id, arn_number)
    );
    """)

    op.execute("""
    CREATE TABLE award_details (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        arn_id UUID NOT NULL REFERENCES award_recommendations(id),
        rfq_line_id UUID REFERENCES rfq_lines(id),
        lot_id UUID REFERENCES rfq_lots(id),
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        bid_id UUID NOT NULL REFERENCES bid_responses(id),
        awarded_unit_price NUMERIC(18,4) NOT NULL,
        awarded_quantity NUMERIC(18,4) NOT NULL,
        awarded_total NUMERIC(18,2) NOT NULL,
        award_type VARCHAR(20) NOT NULL DEFAULT 'FULL',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS award_details CASCADE")
    op.execute("DROP TABLE IF EXISTS award_recommendations CASCADE")
    op.execute("DROP TABLE IF EXISTS negotiations CASCADE")
    op.execute("DROP TABLE IF EXISTS cs_line_rankings CASCADE")
    op.execute("DROP TABLE IF EXISTS comparative_statements CASCADE")
    op.execute("DROP TABLE IF EXISTS evaluation_scores CASCADE")
    op.execute("DROP TABLE IF EXISTS evaluations CASCADE")
