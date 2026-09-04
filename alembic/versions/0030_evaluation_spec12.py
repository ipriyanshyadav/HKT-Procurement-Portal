"""Add SPEC_12 evaluation columns: CS document path, ranking scores, negotiation prices, award details

Revision ID: 0030_evaluation_spec12
Revises: 0028_live_auction
Create Date: 2026-09-05 04:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0030_evaluation_spec12"
down_revision: Union[str, None] = "0028_live_auction"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. comparative_statements
    op.execute(
        "ALTER TABLE comparative_statements ADD COLUMN IF NOT EXISTS document_path VARCHAR(500)"
    )
    op.execute(
        "ALTER TABLE comparative_statements ALTER COLUMN cs_number TYPE VARCHAR(64)"
    )

    # 2. cs_line_rankings
    op.execute(
        "ALTER TABLE cs_line_rankings ALTER COLUMN rfq_line_id DROP NOT NULL"
    )
    op.execute(
        "ALTER TABLE cs_line_rankings ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES rfq_lots(id)"
    )
    op.execute(
        "ALTER TABLE cs_line_rankings ADD COLUMN IF NOT EXISTS lot_total_inr NUMERIC(18,4)"
    )
    op.execute(
        "ALTER TABLE cs_line_rankings ADD COLUMN IF NOT EXISTS technical_score NUMERIC(5,2)"
    )
    op.execute(
        "ALTER TABLE cs_line_rankings ADD COLUMN IF NOT EXISTS commercial_score NUMERIC(5,2)"
    )
    op.execute(
        "ALTER TABLE cs_line_rankings ADD COLUMN IF NOT EXISTS composite_score NUMERIC(5,2)"
    )
    op.execute(
        "ALTER TABLE cs_line_rankings ADD COLUMN IF NOT EXISTS is_l1 BOOLEAN NOT NULL DEFAULT FALSE"
    )

    # 3. negotiations
    op.execute(
        "ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS cs_id UUID REFERENCES comparative_statements(id)"
    )
    op.execute(
        "ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS original_price NUMERIC(18,4)"
    )
    op.execute(
        "ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS negotiated_price NUMERIC(18,4)"
    )
    op.execute(
        "ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS price_change_pct NUMERIC(7,4)"
    )
    op.execute(
        "ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS initiated_by UUID REFERENCES users(id)"
    )

    # 4. award_recommendations
    op.execute(
        "ALTER TABLE award_recommendations ADD COLUMN IF NOT EXISTS total_awarded_value NUMERIC(18,2)"
    )
    op.execute(
        "ALTER TABLE award_recommendations ALTER COLUMN arn_number TYPE VARCHAR(64)"
    )

    # 5. award_details
    op.execute(
        "ALTER TABLE award_details ADD COLUMN IF NOT EXISTS justification TEXT"
    )

    # 6. rfqs
    op.execute(
        "ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS evaluation_weights JSONB"
    )

    # Indexes
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_cs_line_rankings_cs_id ON cs_line_rankings(cs_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_negotiations_cs_id ON negotiations(cs_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_award_recommendations_cs_id ON award_recommendations(cs_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_award_details_arn_id ON award_details(arn_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_award_details_arn_id")
    op.execute("DROP INDEX IF EXISTS ix_award_recommendations_cs_id")
    op.execute("DROP INDEX IF EXISTS ix_negotiations_cs_id")
    op.execute("DROP INDEX IF EXISTS ix_cs_line_rankings_cs_id")

    op.execute("ALTER TABLE rfqs DROP COLUMN IF EXISTS evaluation_weights")
    op.execute("ALTER TABLE award_details DROP COLUMN IF EXISTS justification")
    op.execute("ALTER TABLE award_recommendations DROP COLUMN IF EXISTS total_awarded_value")
    op.execute("ALTER TABLE award_recommendations ALTER COLUMN arn_number TYPE VARCHAR(30)")

    op.execute("ALTER TABLE negotiations DROP COLUMN IF EXISTS initiated_by")
    op.execute("ALTER TABLE negotiations DROP COLUMN IF EXISTS price_change_pct")
    op.execute("ALTER TABLE negotiations DROP COLUMN IF EXISTS negotiated_price")
    op.execute("ALTER TABLE negotiations DROP COLUMN IF EXISTS original_price")
    op.execute("ALTER TABLE negotiations DROP COLUMN IF EXISTS cs_id")

    op.execute("ALTER TABLE cs_line_rankings DROP COLUMN IF EXISTS is_l1")
    op.execute("ALTER TABLE cs_line_rankings DROP COLUMN IF EXISTS composite_score")
    op.execute("ALTER TABLE cs_line_rankings DROP COLUMN IF EXISTS commercial_score")
    op.execute("ALTER TABLE cs_line_rankings DROP COLUMN IF EXISTS technical_score")
    op.execute("ALTER TABLE cs_line_rankings DROP COLUMN IF EXISTS lot_total_inr")
    op.execute("ALTER TABLE cs_line_rankings DROP COLUMN IF EXISTS lot_id")
    op.execute("ALTER TABLE cs_line_rankings ALTER COLUMN rfq_line_id SET NOT NULL")

    op.execute("ALTER TABLE comparative_statements ALTER COLUMN cs_number TYPE VARCHAR(30)")
    op.execute("ALTER TABLE comparative_statements DROP COLUMN IF EXISTS document_path")
