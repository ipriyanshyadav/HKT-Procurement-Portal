"""Add RFQ dual-auth columns, bid encryption columns, and bid metadata columns

Revision ID: 0029_rfq_bid_spec10_11
Revises: 0028_fix_missing_model_columns
Create Date: 2026-09-04 17:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0029_rfq_bid_spec10_11'
down_revision: Union[str, None] = '0028_fix_missing_model_columns'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# New columns for rfqs table (SPEC_10)
RFQ_ADD_COLUMNS = [
    ("rfqs", "bid_opening_initiated_by", "UUID REFERENCES users(id)"),
    ("rfqs", "bid_opening_initiated_at", "TIMESTAMP WITH TIME ZONE"),
    ("rfqs", "source_pr_id", "UUID REFERENCES requisitions(id)"),
]

# New columns for bid_responses table (SPEC_11)
BID_RESPONSE_ADD_COLUMNS = [
    ("bid_responses", "total_amount_encrypted", "TEXT"),
    ("bid_responses", "has_deviations", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("bid_responses", "deviation_details", "TEXT"),
    ("bid_responses", "technical_offer_compliant", "BOOLEAN NOT NULL DEFAULT TRUE"),
    ("bid_responses", "payment_terms_code", "VARCHAR(50)"),
    ("bid_responses", "delivery_terms_incoterm", "VARCHAR(20)"),
    ("bid_responses", "bid_validity_days", "INTEGER NOT NULL DEFAULT 90"),
    ("bid_responses", "is_single_vendor_situation", "BOOLEAN NOT NULL DEFAULT FALSE"),
]

# New columns for bid_line_responses table (SPEC_11 encrypted prices)
BID_LINE_ADD_COLUMNS = [
    ("bid_line_responses", "unit_price_encrypted", "TEXT"),
    ("bid_line_responses", "total_price_encrypted", "TEXT"),
    ("bid_line_responses", "normalized_price_inr", "NUMERIC(18,4)"),
    ("bid_line_responses", "exchange_rate_used", "NUMERIC(18,6)"),
    ("bid_line_responses", "currency", "CHAR(3) NOT NULL DEFAULT 'INR'"),
    ("bid_line_responses", "quantity", "NUMERIC(18,4) NOT NULL DEFAULT 0"),
    ("bid_line_responses", "delivery_days", "INTEGER NOT NULL DEFAULT 0"),
    ("bid_line_responses", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
]

# bid_versions: change version_data to snapshot_encrypted
BID_VERSION_CHANGES = [
    ("bid_versions", "snapshot_encrypted", "TEXT NOT NULL DEFAULT ''"),
]


def upgrade() -> None:
    for table, col, col_type in RFQ_ADD_COLUMNS + BID_RESPONSE_ADD_COLUMNS + BID_LINE_ADD_COLUMNS + BID_VERSION_CHANGES:
        op.execute(
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_type}"
        )

    op.execute("ALTER TABLE bid_line_responses ALTER COLUMN unit_price DROP NOT NULL")
    op.execute("ALTER TABLE bid_line_responses ALTER COLUMN delivery_lead_time_days DROP NOT NULL")
    op.execute("ALTER TABLE bid_versions ALTER COLUMN version_data DROP NOT NULL")

    # Regular indexes (CONCURRENTLY not allowed inside alembic transaction block)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_rfqs_bid_opening_initiated_by "
        "ON rfqs(bid_opening_initiated_by) WHERE deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_rfqs_source_pr_id "
        "ON rfqs(source_pr_id) WHERE deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_bid_responses_vendor_rfq "
        "ON bid_responses(rfq_id, vendor_id) WHERE deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_rfqs_status_bid_close "
        "ON rfqs(status, bid_close_at) WHERE deleted_at IS NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_rfqs_status_bid_close")
    op.execute("DROP INDEX IF EXISTS ix_bid_responses_vendor_rfq")
    op.execute("DROP INDEX IF EXISTS ix_rfqs_source_pr_id")
    op.execute("DROP INDEX IF EXISTS ix_rfqs_bid_opening_initiated_by")

    for table, col, _ in reversed(RFQ_ADD_COLUMNS + BID_RESPONSE_ADD_COLUMNS + BID_LINE_ADD_COLUMNS + BID_VERSION_CHANGES):
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS {col}")
