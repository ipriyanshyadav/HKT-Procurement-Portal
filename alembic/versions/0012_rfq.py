"""Create RFQ and related tables

Revision ID: 0012_rfq
Revises: 0011_requisition
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0012_rfq'
down_revision: Union[str, None] = '0011_requisition'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    CREATE TABLE rfqs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        rfq_number VARCHAR(30) NOT NULL,
        title VARCHAR(300) NOT NULL,
        description TEXT,
        rfq_type rfq_type NOT NULL DEFAULT 'LIMITED_TENDER',
        sourcing_type sourcing_type NOT NULL DEFAULT 'GOODS',
        evaluation_type evaluation_type NOT NULL DEFAULT 'L1_PRICE_ONLY',
        procurement_type procurement_type NOT NULL DEFAULT 'OPEX',
        status rfq_status NOT NULL DEFAULT 'DRAFT',
        buyer_id UUID NOT NULL REFERENCES users(id),
        business_unit_id UUID NOT NULL REFERENCES business_units(id),
        category_id UUID NOT NULL REFERENCES categories(id),
        currency CHAR(3) NOT NULL DEFAULT 'INR',
        estimated_value NUMERIC(18,2) NOT NULL DEFAULT 0,
        payment_term_id UUID REFERENCES payment_terms(id),
        incoterm_id UUID REFERENCES incoterms(id),
        delivery_location_id UUID REFERENCES delivery_locations(id),
        bid_open_at TIMESTAMP WITH TIME ZONE,
        bid_close_at TIMESTAMP WITH TIME ZONE,
        technical_close_at TIMESTAMP WITH TIME ZONE,
        bid_validity_days INTEGER NOT NULL DEFAULT 90,
        is_multi_lot BOOLEAN NOT NULL DEFAULT FALSE,
        lot_participation_mode VARCHAR(20) DEFAULT 'MANDATORY_ALL',
        is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
        is_single_vendor BOOLEAN NOT NULL DEFAULT FALSE,
        single_vendor_justification TEXT,
        requires_co_authorization BOOLEAN NOT NULL DEFAULT FALSE,
        amendment_count INTEGER NOT NULL DEFAULT 0,
        wizard_step INTEGER NOT NULL DEFAULT 1,
        wizard_completed BOOLEAN NOT NULL DEFAULT FALSE,
        linked_pr_ids UUID[] DEFAULT '{}',
        published_at TIMESTAMP WITH TIME ZONE,
        bids_opened_at TIMESTAMP WITH TIME ZONE,
        bids_opened_by UUID REFERENCES users(id),
        co_authorized_by UUID REFERENCES users(id),
        cancelled_at TIMESTAMP WITH TIME ZONE,
        cancel_reason TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID REFERENCES users(id),
        updated_by UUID REFERENCES users(id),
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, rfq_number)
    );
    """)

    op.execute("""
    CREATE TABLE rfq_lots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        rfq_id UUID NOT NULL REFERENCES rfqs(id),
        lot_number INTEGER NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        estimated_value NUMERIC(18,2) DEFAULT 0,
        payment_term_override_id UUID REFERENCES payment_terms(id),
        incoterm_override_id UUID REFERENCES incoterms(id),
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, rfq_id, lot_number)
    );
    """)

    op.execute("""
    CREATE TABLE rfq_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        rfq_id UUID NOT NULL REFERENCES rfqs(id),
        lot_id UUID REFERENCES rfq_lots(id),
        line_number INTEGER NOT NULL,
        item_description VARCHAR(500) NOT NULL,
        item_code VARCHAR(50),
        category_id UUID NOT NULL REFERENCES categories(id),
        uom_id UUID NOT NULL REFERENCES uom_master(id),
        quantity NUMERIC(18,4) NOT NULL,
        estimated_unit_price NUMERIC(18,4) DEFAULT 0,
        hsn_code VARCHAR(10),
        specifications TEXT,
        delivery_location_id UUID REFERENCES delivery_locations(id),
        required_by_date DATE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, rfq_id, line_number)
    );
    """)

    op.execute("""
    CREATE TABLE rfq_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        rfq_id UUID NOT NULL REFERENCES rfqs(id),
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        invitation_status VARCHAR(20) NOT NULL DEFAULT 'INVITED',
        accepted_at TIMESTAMP WITH TIME ZONE,
        regretted_at TIMESTAMP WITH TIME ZONE,
        regret_reason TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (org_id, rfq_id, vendor_id)
    );
    """)

    op.execute("""
    CREATE TABLE rfq_clarifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        rfq_id UUID NOT NULL REFERENCES rfqs(id),
        question TEXT NOT NULL,
        answer TEXT,
        asked_by UUID NOT NULL REFERENCES users(id),
        asked_by_vendor_id UUID REFERENCES vendors(id),
        answered_by UUID REFERENCES users(id),
        answered_at TIMESTAMP WITH TIME ZONE,
        is_published BOOLEAN NOT NULL DEFAULT FALSE,
        published_at TIMESTAMP WITH TIME ZONE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE rfq_amendments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        rfq_id UUID NOT NULL REFERENCES rfqs(id),
        amendment_number INTEGER NOT NULL,
        changes_summary TEXT NOT NULL,
        field_changes JSONB NOT NULL,
        previous_bid_close_at TIMESTAMP WITH TIME ZONE,
        new_bid_close_at TIMESTAMP WITH TIME ZONE,
        bids_reset BOOLEAN NOT NULL DEFAULT TRUE,
        admin_waiver BOOLEAN NOT NULL DEFAULT FALSE,
        amended_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (org_id, rfq_id, amendment_number)
    );
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS rfq_amendments CASCADE")
    op.execute("DROP TABLE IF EXISTS rfq_clarifications CASCADE")
    op.execute("DROP TABLE IF EXISTS rfq_participants CASCADE")
    op.execute("DROP TABLE IF EXISTS rfq_lines CASCADE")
    op.execute("DROP TABLE IF EXISTS rfq_lots CASCADE")
    op.execute("DROP TABLE IF EXISTS rfqs CASCADE")
