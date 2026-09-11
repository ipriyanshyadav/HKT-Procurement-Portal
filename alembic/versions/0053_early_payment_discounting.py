"""Add Early Payment Discounting columns to invoices and payment_records.

Revision ID: 0053_early_payment_discounting
Revises: 0052_foreign_key_line_indexes
Create Date: 2026-09-11 12:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0053_early_payment_discounting"
down_revision: str | None = "0052_foreign_key_line_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column("early_discount_amount", sa.Numeric(18, 2), server_default="0.0", nullable=False),
    )
    op.add_column(
        "invoices",
        sa.Column("early_discount_status", sa.String(30), server_default="NONE", nullable=False),
    )
    op.add_column(
        "invoices",
        sa.Column("early_discount_payout_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "invoices",
        sa.Column("early_discount_apr", sa.Numeric(5, 4), nullable=True),
    )
    op.add_column(
        "payment_records",
        sa.Column("discount_amount", sa.Numeric(18, 2), server_default="0.0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("payment_records", "discount_amount")
    op.drop_column("invoices", "early_discount_apr")
    op.drop_column("invoices", "early_discount_payout_date")
    op.drop_column("invoices", "early_discount_status")
    op.drop_column("invoices", "early_discount_amount")
