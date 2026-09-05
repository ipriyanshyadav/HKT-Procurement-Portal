"""Add SPEC_15 invoice and payment columns, TDS fields, and indexes

Revision ID: 0033_invoice_payment_spec15
Revises: 0032_purchase_order_grn_spec14
Create Date: 2026-09-05 10:30:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "0033_invoice_payment_spec15"
down_revision: Union[str, None] = "0032_purchase_order_grn_spec14"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add columns to invoices table
    op.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS financial_year VARCHAR(10)")
    op.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(18,2) DEFAULT 0")
    op.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_terms_code VARCHAR(50)")
    op.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT")

    # 2. Add columns to payment_records table
    op.execute("ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(18,2) DEFAULT 0")
    op.execute("ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(18,2) DEFAULT 0")
    op.execute("ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS net_amount NUMERIC(18,2) DEFAULT 0")
    op.execute("ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS payment_due_date DATE")

    # 3. Add TDS columns to vendors table
    op.execute("ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tds_applicable BOOLEAN DEFAULT FALSE")
    op.execute("ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tds_percentage NUMERIC(5,2) DEFAULT 0.0")

    # 4. Performance indexes
    op.execute("CREATE INDEX IF NOT EXISTS ix_invoices_vendor_id ON invoices(vendor_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_invoices_po_id ON invoices(po_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_invoices_status ON invoices(status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_invoices_match_status ON invoices(match_status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_invoices_payment_status ON invoices(payment_status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_invoice_lines_invoice_id ON invoice_lines(invoice_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_invoice_lines_po_line_id ON invoice_lines(po_line_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_invoice_match_results_invoice_id ON invoice_match_results(invoice_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_payment_records_invoice_id ON payment_records(invoice_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_payment_records_vendor_id ON payment_records(vendor_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_payment_records_status ON payment_records(status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_disputes_invoice_id ON disputes(invoice_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_disputes_vendor_id ON disputes(vendor_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_disputes_status ON disputes(status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_dispute_messages_dispute_id ON dispute_messages(dispute_id)")


def downgrade() -> None:
    # Drop indexes
    op.execute("DROP INDEX IF EXISTS ix_dispute_messages_dispute_id")
    op.execute("DROP INDEX IF EXISTS ix_disputes_status")
    op.execute("DROP INDEX IF EXISTS ix_disputes_vendor_id")
    op.execute("DROP INDEX IF EXISTS ix_disputes_invoice_id")
    op.execute("DROP INDEX IF EXISTS ix_payment_records_status")
    op.execute("DROP INDEX IF EXISTS ix_payment_records_vendor_id")
    op.execute("DROP INDEX IF EXISTS ix_payment_records_invoice_id")
    op.execute("DROP INDEX IF EXISTS ix_invoice_match_results_invoice_id")
    op.execute("DROP INDEX IF EXISTS ix_invoice_lines_po_line_id")
    op.execute("DROP INDEX IF EXISTS ix_invoice_lines_invoice_id")
    op.execute("DROP INDEX IF EXISTS ix_invoices_payment_status")
    op.execute("DROP INDEX IF EXISTS ix_invoices_match_status")
    op.execute("DROP INDEX IF EXISTS ix_invoices_status")
    op.execute("DROP INDEX IF EXISTS ix_invoices_po_id")
    op.execute("DROP INDEX IF EXISTS ix_invoices_vendor_id")

    # Drop columns from vendors
    op.execute("ALTER TABLE vendors DROP COLUMN IF EXISTS tds_percentage")
    op.execute("ALTER TABLE vendors DROP COLUMN IF EXISTS tds_applicable")

    # Drop columns from payment_records
    op.execute("ALTER TABLE payment_records DROP COLUMN IF EXISTS payment_due_date")
    op.execute("ALTER TABLE payment_records DROP COLUMN IF EXISTS net_amount")
    op.execute("ALTER TABLE payment_records DROP COLUMN IF EXISTS tds_amount")
    op.execute("ALTER TABLE payment_records DROP COLUMN IF EXISTS gross_amount")

    # Drop columns from invoices
    op.execute("ALTER TABLE invoices DROP COLUMN IF EXISTS notes")
    op.execute("ALTER TABLE invoices DROP COLUMN IF EXISTS payment_terms_code")
    op.execute("ALTER TABLE invoices DROP COLUMN IF EXISTS tds_amount")
    op.execute("ALTER TABLE invoices DROP COLUMN IF EXISTS financial_year")
