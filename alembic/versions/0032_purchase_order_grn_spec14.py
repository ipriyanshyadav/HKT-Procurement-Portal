"""Add SPEC_14 purchase order and GRN columns, indexes, and enum statuses

Revision ID: 0032_purchase_order_grn_spec14
Revises: 0031_contract_spec13
Create Date: 2026-09-05 04:50:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "0032_purchase_order_grn_spec14"
down_revision: Union[str, None] = "0031_contract_spec13"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add new enum values to po_status if not existing
    new_enum_values = [
        "SENT_TO_VENDOR",
        "VENDOR_ACKNOWLEDGED",
        "VENDOR_REJECTED",
        "AMENDED",
        "REJECTED",
    ]
    for val in new_enum_values:
        op.execute(f"ALTER TYPE po_status ADD VALUE IF NOT EXISTS '{val}'")

    # 2. Add columns to purchase_orders table
    op.execute("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_document_path VARCHAR(500)")
    op.execute("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vendor_acknowledged_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vendor_rejection_reason TEXT")
    op.execute("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS deviation_justification TEXT")
    op.execute("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT")

    # 3. Add received_quantity to po_lines table
    op.execute("ALTER TABLE po_lines ADD COLUMN IF NOT EXISTS received_quantity NUMERIC(18,4) NOT NULL DEFAULT 0")

    # 4. Add columns to goods_receipt_notes table
    op.execute("ALTER TABLE goods_receipt_notes ADD COLUMN IF NOT EXISTS grn_document_path VARCHAR(500)")
    op.execute("ALTER TABLE goods_receipt_notes ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE goods_receipt_notes ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES users(id)")

    # 5. Add columns to grn_lines table
    op.execute("ALTER TABLE grn_lines ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE grn_lines ADD COLUMN IF NOT EXISTS inspected_by UUID REFERENCES users(id)")

    # 6. Indexes for performance
    op.execute("CREATE INDEX IF NOT EXISTS ix_purchase_orders_vendor_id ON purchase_orders(vendor_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_purchase_orders_contract_id ON purchase_orders(contract_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_purchase_orders_rfq_id ON purchase_orders(rfq_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_purchase_orders_status ON purchase_orders(status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_goods_receipt_notes_po_id ON goods_receipt_notes(po_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_goods_receipt_notes_vendor_id ON goods_receipt_notes(vendor_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_grn_lines_po_line_id ON grn_lines(po_line_id)")


def downgrade() -> None:
    # Drop indexes
    op.execute("DROP INDEX IF EXISTS ix_grn_lines_po_line_id")
    op.execute("DROP INDEX IF EXISTS ix_goods_receipt_notes_vendor_id")
    op.execute("DROP INDEX IF EXISTS ix_goods_receipt_notes_po_id")
    op.execute("DROP INDEX IF EXISTS ix_purchase_orders_status")
    op.execute("DROP INDEX IF EXISTS ix_purchase_orders_rfq_id")
    op.execute("DROP INDEX IF EXISTS ix_purchase_orders_contract_id")
    op.execute("DROP INDEX IF EXISTS ix_purchase_orders_vendor_id")

    # Drop columns from grn_lines
    op.execute("ALTER TABLE grn_lines DROP COLUMN IF EXISTS inspected_by")
    op.execute("ALTER TABLE grn_lines DROP COLUMN IF EXISTS inspected_at")

    # Drop columns from goods_receipt_notes
    op.execute("ALTER TABLE goods_receipt_notes DROP COLUMN IF EXISTS confirmed_by")
    op.execute("ALTER TABLE goods_receipt_notes DROP COLUMN IF EXISTS confirmed_at")
    op.execute("ALTER TABLE goods_receipt_notes DROP COLUMN IF EXISTS grn_document_path")

    # Drop columns from po_lines
    op.execute("ALTER TABLE po_lines DROP COLUMN IF EXISTS received_quantity")

    # Drop columns from purchase_orders
    op.execute("ALTER TABLE purchase_orders DROP COLUMN IF EXISTS cancellation_reason")
    op.execute("ALTER TABLE purchase_orders DROP COLUMN IF EXISTS deviation_justification")
    op.execute("ALTER TABLE purchase_orders DROP COLUMN IF EXISTS vendor_rejection_reason")
    op.execute("ALTER TABLE purchase_orders DROP COLUMN IF EXISTS vendor_acknowledged_at")
    op.execute("ALTER TABLE purchase_orders DROP COLUMN IF EXISTS sent_at")
    op.execute("ALTER TABLE purchase_orders DROP COLUMN IF EXISTS po_document_path")
