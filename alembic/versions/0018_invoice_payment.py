"""Create invoice, payment, match results, and dispute tables

Revision ID: 0018_invoice_payment
Revises: 0017_grn_ses
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0018_invoice_payment'
down_revision: Union[str, None] = '0017_grn_ses'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    CREATE TABLE invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        invoice_number VARCHAR(50) NOT NULL,
        vendor_invoice_number VARCHAR(50) NOT NULL,
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        po_id UUID NOT NULL REFERENCES purchase_orders(id),
        status invoice_status NOT NULL DEFAULT 'DRAFT',
        invoice_date DATE NOT NULL,
        due_date DATE NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'INR',
        subtotal NUMERIC(18,2) NOT NULL,
        tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
        total_amount NUMERIC(18,2) NOT NULL,
        match_status VARCHAR(20) DEFAULT 'NOT_MATCHED',
        price_tolerance NUMERIC(5,4) NOT NULL DEFAULT 0.0050,
        erp_invoice_number VARCHAR(50),
        erp_sync_status VARCHAR(20) DEFAULT 'NOT_SYNCED',
        payment_status payment_status NOT NULL DEFAULT 'PENDING',
        paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID REFERENCES users(id),
        updated_by UUID REFERENCES users(id),
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (org_id, vendor_id, vendor_invoice_number)
    );
    """)

    op.execute("""
    CREATE TABLE invoice_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        invoice_id UUID NOT NULL REFERENCES invoices(id),
        po_line_id UUID NOT NULL REFERENCES po_lines(id),
        grn_line_id UUID REFERENCES grn_lines(id),
        line_number INTEGER NOT NULL,
        item_description VARCHAR(500) NOT NULL,
        quantity NUMERIC(18,4) NOT NULL,
        unit_price NUMERIC(18,4) NOT NULL,
        tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
        tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
        line_total NUMERIC(18,2) NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (org_id, invoice_id, line_number)
    );
    """)

    op.execute("""
    CREATE TABLE invoice_match_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        invoice_id UUID NOT NULL REFERENCES invoices(id),
        invoice_line_id UUID NOT NULL REFERENCES invoice_lines(id),
        po_line_id UUID NOT NULL REFERENCES po_lines(id),
        price_match BOOLEAN NOT NULL,
        price_deviation NUMERIC(10,4),
        quantity_match BOOLEAN NOT NULL,
        quantity_deviation NUMERIC(18,4),
        po_reference_valid BOOLEAN NOT NULL,
        tax_match BOOLEAN NOT NULL DEFAULT TRUE,
        tax_deviation NUMERIC(5,2) DEFAULT 0,
        overall_match BOOLEAN NOT NULL,
        mismatch_reasons TEXT[],
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE payment_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        invoice_id UUID NOT NULL REFERENCES invoices(id),
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        payment_date DATE NOT NULL,
        amount NUMERIC(18,2) NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'INR',
        utr_number VARCHAR(50),
        payment_method VARCHAR(30),
        erp_payment_reference VARCHAR(50),
        status payment_status NOT NULL DEFAULT 'COMPLETED',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE TABLE disputes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        invoice_id UUID NOT NULL REFERENCES invoices(id),
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        reason_code VARCHAR(30) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        raised_by UUID NOT NULL REFERENCES users(id),
        resolved_by UUID REFERENCES users(id),
        resolution_notes TEXT,
        resolution_action VARCHAR(30),
        credit_note_amount NUMERIC(18,2),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMP WITH TIME ZONE,
        version INTEGER NOT NULL DEFAULT 1,
        CONSTRAINT chk_dispute_reason CHECK (reason_code IN (
            'PRICE_MISMATCH', 'QUANTITY_MISMATCH', 'WRONG_PO', 'DUPLICATE',
            'QUALITY_ISSUE', 'PAYMENT_OVERDUE', 'OTHER'
        ))
    );
    """)

    op.execute("""
    CREATE TABLE dispute_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        dispute_id UUID NOT NULL REFERENCES disputes(id),
        sender_id UUID NOT NULL REFERENCES users(id),
        message TEXT NOT NULL,
        attachments UUID[],
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS dispute_messages CASCADE")
    op.execute("DROP TABLE IF EXISTS disputes CASCADE")
    op.execute("DROP TABLE IF EXISTS payment_records CASCADE")
    op.execute("DROP TABLE IF EXISTS invoice_match_results CASCADE")
    op.execute("DROP TABLE IF EXISTS invoice_lines CASCADE")
    op.execute("DROP TABLE IF EXISTS invoices CASCADE")
