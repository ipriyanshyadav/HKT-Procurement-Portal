"""Enterprise Capability: Carbon ESG Footprint Calculator and Approval Delegation Matrix

Revision ID: 0051_carbon_esg_and_delegation
Revises: 0050_enterprise_expansion
Create Date: 2026-09-10 04:45:00.000000

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0051_carbon_esg_and_delegation"
down_revision = "0050_enterprise_expansion"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. carbon_emission_factors
    op.create_table(
        "carbon_emission_factors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("categories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("category_name", sa.String(length=100), nullable=False),
        sa.Column("scope1_factor", sa.Numeric(precision=10, scale=4), nullable=False, server_default="0.0500"),  # kg CO2e / currency unit
        sa.Column("scope2_factor", sa.Numeric(precision=10, scale=4), nullable=False, server_default="0.1200"),
        sa.Column("scope3_factor", sa.Numeric(precision=10, scale=4), nullable=False, server_default="0.6500"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="INR"),
        sa.Column("data_source", sa.String(length=100), nullable=False, server_default="GHG_PROTOCOL_DEFRA_2026"),
        sa.Column("effective_year", sa.Integer(), nullable=False, server_default="2026"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_carbon_factors_org_cat", "carbon_emission_factors", ["org_id", "category_id"])
    op.create_index("ix_carbon_factors_name", "carbon_emission_factors", ["org_id", "category_name"])

    # 2. supplier_esg_metrics
    op.create_table(
        "supplier_esg_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("environmental_score", sa.Numeric(precision=5, scale=2), nullable=False, server_default="70.00"),
        sa.Column("social_score", sa.Numeric(precision=5, scale=2), nullable=False, server_default="75.00"),
        sa.Column("governance_score", sa.Numeric(precision=5, scale=2), nullable=False, server_default="80.00"),
        sa.Column("composite_esg_score", sa.Numeric(precision=5, scale=2), nullable=False, server_default="75.00"),
        sa.Column("esg_rating", sa.String(length=10), nullable=False, server_default="A"),  # AAA, AA, A, BBB, BB, B, CCC
        sa.Column("carbon_intensity_kg_per_spend", sa.Numeric(precision=10, scale=4), nullable=False, server_default="0.4500"),
        sa.Column("sbti_committed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("net_zero_target_year", sa.Integer(), nullable=True),
        sa.Column("iso_14001_certified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("renewable_energy_pct", sa.Numeric(precision=5, scale=2), nullable=False, server_default="0.00"),
        sa.Column("last_audit_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("audit_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_esg_metrics_org_vendor", "supplier_esg_metrics", ["org_id", "vendor_id"])
    op.create_index("ix_esg_metrics_rating", "supplier_esg_metrics", ["org_id", "esg_rating"])

    # 3. Enhance delegation_rules
    op.add_column("delegation_rules", sa.Column("max_amount_threshold", sa.Numeric(precision=18, scale=2), nullable=True))
    op.add_column("delegation_rules", sa.Column("bu_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("delegation_rules", "bu_ids")
    op.drop_column("delegation_rules", "max_amount_threshold")
    op.drop_table("supplier_esg_metrics")
    op.drop_table("carbon_emission_factors")
