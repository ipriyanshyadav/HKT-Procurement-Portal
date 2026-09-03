"""Create PR and PO document numbering sequences

Revision ID: 0026_sequences
Revises: 0025_rls
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0026_sequences'
down_revision: Union[str, None] = '0025_rls'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEQUENCES = [
    ("seq_pr_number", 100001),
    ("seq_po_number", 200001),
    ("seq_rfq_number", 300001),
    ("seq_cs_number", 400001),
    ("seq_arn_number", 500001),
    ("seq_grn_number", 600001),
    ("seq_ses_number", 700001),
    ("seq_invoice_number", 800001),
    ("seq_contract_number", 900001),
]

def upgrade() -> None:
    for seq_name, start_val in SEQUENCES:
        op.execute(f"CREATE SEQUENCE IF NOT EXISTS {seq_name} START WITH {start_val} INCREMENT BY 1;")

def downgrade() -> None:
    for seq_name, _ in reversed(SEQUENCES):
        op.execute(f"DROP SEQUENCE IF EXISTS {seq_name};")
