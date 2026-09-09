"""0046_ai_sourcing_copilot

Revision ID: 0046_ai_sourcing_copilot
Revises: 0045_punchout_and_catalog
Create Date: 2026-09-10 01:05:00.000000

AI-Powered Autonomous Sourcing & Negotiation Copilot:
- ai_rfq_drafts: Smart RFQ generated from unmapped PR items with anomaly flags
- negotiation_sessions: Autonomous tail-spend negotiation sessions
- negotiation_rounds: Counter-bidding round tracking and rationales
- supplier_radar_scores: Supplier recommendation radar with multi-factor scoring
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0046_ai_sourcing_copilot"
down_revision: str | None = "0045_punchout_and_catalog"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_rfq_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "pr_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("requisitions.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("rfq_title", sa.String(length=255), nullable=False),
        sa.Column(
            "target_category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "lots", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")
        ),
        sa.Column(
            "anomaly_flags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("estimated_total_value", sa.Numeric(precision=18, scale=2), nullable=False, server_default="0.00"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="DRAFT"),
        sa.Column("converted_rfq_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "negotiation_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("rfq_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("item_description", sa.String(length=255), nullable=False),
        sa.Column("initial_quote_price", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("target_price", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("max_acceptable_price", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("current_bid_price", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("bot_status", sa.String(length=30), nullable=False, server_default="ACTIVE"),
        sa.Column("current_round", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("max_rounds", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("savings_achieved", sa.Numeric(precision=18, scale=2), nullable=False, server_default="0.00"),
        sa.Column("concession_strategy", sa.String(length=50), nullable=False, server_default="BALANCED"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "negotiation_rounds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("negotiation_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("bidder_type", sa.String(length=20), nullable=False),
        sa.Column("offer_price", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("counter_offer_price", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("concession_amount", sa.Numeric(precision=18, scale=2), nullable=False, server_default="0.00"),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column(
            "response_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "supplier_radar_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vendors.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("overall_fit_score", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("quality_score", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("esg_score", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("lead_time_score", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("price_competitiveness_score", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("recommendation_tier", sa.String(length=30), nullable=False, server_default="RECOMMENDED"),
        sa.Column(
            "insights", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")
        ),
        sa.Column("calculated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("supplier_radar_scores")
    op.drop_table("negotiation_rounds")
    op.drop_table("negotiation_sessions")
    op.drop_table("ai_rfq_drafts")
