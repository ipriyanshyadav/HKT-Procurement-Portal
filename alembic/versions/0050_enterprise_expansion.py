"""Enterprise Expansion: Supplier Self-Onboarding, Maverick Spend Clusters, and Multi-ERP Gateway

Revision ID: 0050_enterprise_expansion
Revises: 0049_dr_orchestrator
Create Date: 2026-09-10 04:30:00.000000

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0050_enterprise_expansion"
down_revision = "0049_dr_orchestrator"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. vendor_onboarding_applications
    op.create_table(
        "vendor_onboarding_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("application_number", sa.String(length=50), nullable=False, unique=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="SUBMITTED"),  # SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, RESUBMISSION_REQUESTED
        sa.Column("gstin_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("pan_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("penny_drop_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kyc_risk_tier", sa.String(length=20), nullable=False, server_default="LOW"),  # LOW, MEDIUM, HIGH
        sa.Column("submitted_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_onb_apps_org_status", "vendor_onboarding_applications", ["org_id", "status"])
    op.create_index("ix_onb_apps_vendor", "vendor_onboarding_applications", ["vendor_id"])
    op.create_index("ix_onb_apps_number", "vendor_onboarding_applications", ["application_number"])

    # 2. maverick_spend_clusters
    op.create_table(
        "maverick_spend_clusters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cluster_type", sa.String(length=50), nullable=False),  # RETROACTIVE_PO, SPLIT_PURCHASE_ORDER, OFF_CONTRACT_LEAKAGE, PRICE_VARIANCE_DISPERSION
        sa.Column("cluster_title", sa.String(length=255), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False, server_default="MEDIUM"),  # LOW, MEDIUM, HIGH, CRITICAL
        sa.Column("affected_spend", sa.Numeric(precision=18, scale=2), nullable=False, server_default="0.0"),
        sa.Column("potential_savings", sa.Numeric(precision=18, scale=2), nullable=False, server_default="0.0"),
        sa.Column("affected_entity_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("root_cause_analysis", sa.Text(), nullable=False),
        sa.Column("ai_recommendation", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="DETECTED"),  # DETECTED, INVESTIGATING, RESOLVED, FALSE_POSITIVE
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_mav_clusters_org_status", "maverick_spend_clusters", ["org_id", "status"])
    op.create_index("ix_mav_clusters_type", "maverick_spend_clusters", ["cluster_type"])
    op.create_index("ix_mav_clusters_severity", "maverick_spend_clusters", ["severity"])

    # 3. erp_entity_mappings
    op.create_table(
        "erp_entity_mappings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("erp_system", sa.String(length=50), nullable=False),  # SAP_S4HANA, NETSUITE, ORACLE_CLOUD
        sa.Column("entity_type", sa.String(length=50), nullable=False),  # PURCHASE_ORDER, INVOICE, VENDOR, GOODS_RECEIPT
        sa.Column("internal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_id", sa.String(length=100), nullable=False),
        sa.Column("sync_direction", sa.String(length=20), nullable=False, server_default="OUTBOUND"),  # OUTBOUND, INBOUND
        sa.Column("sync_status", sa.String(length=30), nullable=False, server_default="SUCCESS"),  # SUCCESS, PENDING, FAILED, DEAD_LETTER
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("idoc_number", sa.String(length=64), nullable=True),
        sa.Column("payload_checksum", sa.String(length=64), nullable=True),
        sa.Column("reconciliation_hash", sa.String(length=64), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_erp_mappings_org_sys_ent", "erp_entity_mappings", ["org_id", "erp_system", "entity_type"])
    op.create_index("ix_erp_mappings_internal", "erp_entity_mappings", ["internal_id", "erp_system"])
    op.create_index("ix_erp_mappings_external", "erp_entity_mappings", ["external_id"])
    op.create_index("ix_erp_mappings_status", "erp_entity_mappings", ["sync_status"])


def downgrade() -> None:
    op.drop_table("erp_entity_mappings")
    op.drop_table("maverick_spend_clusters")
    op.drop_table("vendor_onboarding_applications")
