"""Create purchase order and PO line tables with generated total_price column

Revision ID: 0016_purchase_order
Revises: 0015_contract
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0016_purchase_order'
down_revision: Union[str, None] = '0015_contract'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    CREATE TABLE purchase_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        po_number VARCHAR(30) NOT NULL,
        title VARCHAR(300) NOT NULL,
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        rfq_id UUID REFERENCES rfqs(id),
        arn_id UUID REFERENCES award_recommendations(id),
        contract_id UUID REFERENCES contracts(id),
        status po_status NOT NULL DEFAULT 'DRAFT',
        business_unit_id UUID NOT NULL REFERENCES business_units(id),
        plant_id UUID REFERENCES plants(id),
        category_id UUID NOT NULL REFERENCES categories(id),
        currency CHAR(3) NOT NULL DEFAULT 'INR',
        total_value NUMERIC(18,2) NOT NULL DEFAULT 0,
        payment_term_id UUID REFERENCES payment_terms(id),
        incoterm_id UUID REFERENCES incoterms(id),
        delivery_location_id UUID REFERENCES delivery_locations(id),
        expected_delivery_date DATE,
        buyer_id UUID NOT NULL REFERENCES users(id),
        erp_po_number VARCHAR(30),
        erp_sync_status VARCHAR(20) DEFAULT 'NOT_SYNCED',
        po_pdf_document_id UUID,
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        rejected_reason TEXT,
        amendment_count INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID REFERENCES users(id),
        updated_by UUID REFERENCES users(id),
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, po_number)
    );
    """)

    op.execute("""
    CREATE TABLE po_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        po_id UUID NOT NULL REFERENCES purchase_orders(id),
        line_number INTEGER NOT NULL,
        item_description VARCHAR(500) NOT NULL,
        item_code VARCHAR(50),
        uom_id UUID NOT NULL REFERENCES uom_master(id),
        ordered_quantity NUMERIC(18,4) NOT NULL,
        unit_price NUMERIC(18,4) NOT NULL,
        total_price NUMERIC(18,2) GENERATED ALWAYS AS (ordered_quantity * unit_price) STORED,
        awarded_unit_price NUMERIC(18,4),
        hsn_code VARCHAR(10),
        tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
        open_quantity NUMERIC(18,4) NOT NULL,
        invoiced_quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
        delivery_date DATE,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, po_id, line_number)
    );
    """)

    op.execute("""
    CREATE TABLE po_amendments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        po_id UUID NOT NULL REFERENCES purchase_orders(id),
        amendment_number INTEGER NOT NULL,
        reason TEXT NOT NULL,
        field_changes JSONB NOT NULL,
        value_change NUMERIC(18,2) DEFAULT 0,
        re_approval_required BOOLEAN NOT NULL DEFAULT FALSE,
        amended_by UUID NOT NULL REFERENCES users(id),
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (org_id, po_id, amendment_number)
    );
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS po_amendments CASCADE")
    op.execute("DROP TABLE IF EXISTS po_lines CASCADE")
    op.execute("DROP TABLE IF EXISTS purchase_orders CASCADE")
