"""Create GRN, SES, and quality inspection tables

Revision ID: 0017_grn_ses
Revises: 0016_purchase_order
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0017_grn_ses'
down_revision: Union[str, None] = '0016_purchase_order'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    CREATE TABLE goods_receipt_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        grn_number VARCHAR(30) NOT NULL,
        po_id UUID NOT NULL REFERENCES purchase_orders(id),
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        receipt_date DATE NOT NULL,
        received_by UUID NOT NULL REFERENCES users(id),
        challan_number VARCHAR(50),
        challan_date DATE,
        transporter_name VARCHAR(200),
        lr_number VARCHAR(50),
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        erp_grn_number VARCHAR(30),
        notes TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID REFERENCES users(id),
        updated_by UUID REFERENCES users(id),
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, grn_number)
    );
    """)

    op.execute("""
    CREATE TABLE grn_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        grn_id UUID NOT NULL REFERENCES goods_receipt_notes(id),
        po_line_id UUID NOT NULL REFERENCES po_lines(id),
        received_quantity NUMERIC(18,4) NOT NULL,
        accepted_quantity NUMERIC(18,4) NOT NULL,
        rejected_quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
        rejection_reason TEXT,
        qc_required BOOLEAN NOT NULL DEFAULT FALSE,
        qc_status VARCHAR(20) DEFAULT 'NOT_REQUIRED',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE service_entry_sheets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        ses_number VARCHAR(30) NOT NULL,
        po_id UUID NOT NULL REFERENCES purchase_orders(id),
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        service_period_start DATE NOT NULL,
        service_period_end DATE NOT NULL,
        certified_by UUID NOT NULL REFERENCES users(id),
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        erp_ses_number VARCHAR(30),
        notes TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID REFERENCES users(id),
        updated_by UUID REFERENCES users(id),
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, ses_number)
    );
    """)

    op.execute("""
    CREATE TABLE ses_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        ses_id UUID NOT NULL REFERENCES service_entry_sheets(id),
        po_line_id UUID NOT NULL REFERENCES po_lines(id),
        service_description VARCHAR(500) NOT NULL,
        completed_quantity NUMERIC(18,4) NOT NULL,
        completion_percentage NUMERIC(5,2) NOT NULL DEFAULT 100.00,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE quality_inspections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        grn_line_id UUID NOT NULL REFERENCES grn_lines(id),
        inspector_id UUID NOT NULL REFERENCES users(id),
        inspection_date DATE NOT NULL,
        result VARCHAR(20) NOT NULL,
        accepted_quantity NUMERIC(18,4) NOT NULL,
        rejected_quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
        remarks TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS quality_inspections CASCADE")
    op.execute("DROP TABLE IF EXISTS ses_lines CASCADE")
    op.execute("DROP TABLE IF EXISTS service_entry_sheets CASCADE")
    op.execute("DROP TABLE IF EXISTS grn_lines CASCADE")
    op.execute("DROP TABLE IF EXISTS goods_receipt_notes CASCADE")
