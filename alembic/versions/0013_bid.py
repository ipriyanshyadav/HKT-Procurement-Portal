"""Create bid responses and related tables

Revision ID: 0013_bid
Revises: 0012_rfq
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0013_bid'
down_revision: Union[str, None] = '0012_rfq'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    CREATE TABLE bid_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        rfq_id UUID NOT NULL REFERENCES rfqs(id),
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        status bid_status NOT NULL DEFAULT 'INVITED',
        bid_validity_date DATE,
        covering_letter TEXT,
        payment_terms_proposed_id UUID REFERENCES payment_terms(id),
        commercial_deviations TEXT,
        total_amount NUMERIC(18,2) DEFAULT 0,
        bid_hash VARCHAR(64),
        bid_sealed_at TIMESTAMP WITH TIME ZONE,
        bid_opened_at TIMESTAMP WITH TIME ZONE,
        technical_score NUMERIC(5,2),
        is_technically_qualified BOOLEAN,
        current_version INTEGER NOT NULL DEFAULT 1,
        submitted_at TIMESTAMP WITH TIME ZONE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, rfq_id, vendor_id)
    );
    """)

    op.execute("""
    CREATE TABLE bid_line_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        bid_id UUID NOT NULL REFERENCES bid_responses(id),
        rfq_line_id UUID NOT NULL REFERENCES rfq_lines(id),
        lot_id UUID REFERENCES rfq_lots(id),
        unit_price NUMERIC(18,4) NOT NULL,
        tax_rate_declared NUMERIC(5,2) NOT NULL DEFAULT 0,
        freight_quoted NUMERIC(18,2) NOT NULL DEFAULT 0,
        delivery_lead_time_days INTEGER NOT NULL,
        country_of_origin CHAR(2) DEFAULT 'IN',
        remarks TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (org_id, bid_id, rfq_line_id)
    );
    """)

    op.execute("""
    CREATE TABLE bid_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        bid_id UUID NOT NULL REFERENCES bid_responses(id),
        version_number INTEGER NOT NULL,
        version_data JSONB NOT NULL,
        bid_hash VARCHAR(64) NOT NULL,
        versioned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (org_id, bid_id, version_number)
    );
    """)

    op.execute("""
    CREATE TABLE bid_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        bid_id UUID NOT NULL REFERENCES bid_responses(id),
        document_id UUID NOT NULL,
        document_type VARCHAR(20) NOT NULL,
        is_technical BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS bid_documents CASCADE")
    op.execute("DROP TABLE IF EXISTS bid_versions CASCADE")
    op.execute("DROP TABLE IF EXISTS bid_line_responses CASCADE")
    op.execute("DROP TABLE IF EXISTS bid_responses CASCADE")
