"""Automated Disaster Recovery Orchestrator & PITR Backup Drills (SPEC_21/SPEC_22)

Revision ID: 0049_dr_orchestrator
Revises: 0048_contract_clauses_redlines
Create Date: 2026-09-10 02:30:00.000000

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0049_dr_orchestrator"
down_revision = "0048_contract_clauses_redlines"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. dr_backup_checkpoints
    op.create_table(
        "dr_backup_checkpoints",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("checkpoint_type", sa.String(length=50), nullable=False),  # POSTGRES_PITR_WAL, MINIO_WORM_SNAPSHOT, REDIS_RDB, ELASTICSEARCH_SNAPSHOT
        sa.Column("status", sa.String(length=30), nullable=False, server_default="COMPLETED"),  # COMPLETED, IN_PROGRESS, FAILED, VERIFIED
        sa.Column("storage_tier", sa.String(length=30), nullable=False, server_default="HOT_STANDBY"),  # HOT_STANDBY, COLD_S3_GLACIER, CROSS_REGION_REPLICA
        sa.Column("storage_location", sa.String(length=500), nullable=False),
        sa.Column("wal_start_lsn", sa.String(length=64), nullable=True),
        sa.Column("wal_end_lsn", sa.String(length=64), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=False),
        sa.Column("worm_locked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("worm_retention_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_dr_checkpoints_org_status", "dr_backup_checkpoints", ["org_id", "status"])
    op.create_index("ix_dr_checkpoints_type", "dr_backup_checkpoints", ["checkpoint_type"])
    op.create_index("ix_dr_checkpoints_created", "dr_backup_checkpoints", ["created_at"])

    # 2. dr_failover_drills
    op.create_table(
        "dr_failover_drills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("drill_code", sa.String(length=50), nullable=False, unique=True),
        sa.Column("drill_name", sa.String(length=255), nullable=False),
        sa.Column("target_environment", sa.String(length=50), nullable=False, server_default="SECONDARY_K3S_COLD_STANDBY"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="SCHEDULED"),  # SCHEDULED, RUNNING, PASSED, FAILED, ABORTED
        sa.Column("simulated_disaster_scenario", sa.String(length=100), nullable=False),  # PRIMARY_REGION_OUTAGE, DATABASE_CORRUPTION, RANSOMWARE_EVENT
        sa.Column("target_rpo_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("target_rto_minutes", sa.Integer(), nullable=False, server_default="240"),
        sa.Column("actual_rpo_minutes", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("actual_rto_minutes", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("rpo_compliant", sa.Boolean(), nullable=True),
        sa.Column("rto_compliant", sa.Boolean(), nullable=True),
        sa.Column("initiated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("drill_phases", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("audit_report", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_dr_drills_org_status", "dr_failover_drills", ["org_id", "status"])
    op.create_index("ix_dr_drills_code", "dr_failover_drills", ["drill_code"])
    op.create_index("ix_dr_drills_started", "dr_failover_drills", ["started_at"])


def downgrade() -> None:
    op.drop_index("ix_dr_drills_started", table_name="dr_failover_drills")
    op.drop_index("ix_dr_drills_code", table_name="dr_failover_drills")
    op.drop_index("ix_dr_drills_org_status", table_name="dr_failover_drills")
    op.drop_table("dr_failover_drills")

    op.drop_index("ix_dr_checkpoints_created", table_name="dr_backup_checkpoints")
    op.drop_index("ix_dr_checkpoints_type", table_name="dr_backup_checkpoints")
    op.drop_index("ix_dr_checkpoints_org_status", table_name="dr_backup_checkpoints")
    op.drop_table("dr_backup_checkpoints")
