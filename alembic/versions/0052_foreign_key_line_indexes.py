"""Add standalone foreign key indexes on high-volume line tables concurrently.

Revision ID: 0052_foreign_key_line_indexes
Revises: 0051_carbon_esg_and_delegation
Create Date: 2026-09-11 11:40:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0052_foreign_key_line_indexes"
down_revision: str | None = "0051_carbon_esg_and_delegation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INDEXES = [
    ("ix_po_lines_po_id", "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_po_lines_po_id ON po_lines (po_id)"),
    (
        "ix_requisition_lines_requisition_id",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_requisition_lines_requisition_id ON requisition_lines (requisition_id)",
    ),
    ("ix_grn_lines_grn_id", "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_grn_lines_grn_id ON grn_lines (grn_id)"),
    ("ix_rfq_lines_rfq_id", "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_rfq_lines_rfq_id ON rfq_lines (rfq_id)"),
    (
        "ix_contract_lines_contract_id",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_contract_lines_contract_id ON contract_lines (contract_id)",
    ),
]


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for _, sql in INDEXES:
            op.execute(sql)


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, _ in reversed(INDEXES):
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
