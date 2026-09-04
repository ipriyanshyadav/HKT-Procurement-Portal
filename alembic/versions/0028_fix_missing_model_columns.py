"""Add missing model columns to ensure BaseModel schema consistency

Revision ID: 0028_fix_missing_model_columns
Revises: 0027_data_seed
Create Date: 2026-09-04 15:15:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0028_fix_missing_model_columns'
down_revision: Union[str, None] = '0027_data_seed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ADD_COLUMNS = [
    # Workflow & Approvals
    ("workflow_tasks", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("workflow_instances", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("workflow_events", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("workflow_events", "version", "INTEGER NOT NULL DEFAULT 1"),
    ("workflow_events", "updated_at", "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()"),
    ("approval_group_members", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("approval_group_members", "version", "INTEGER NOT NULL DEFAULT 1"),
    ("approval_group_members", "updated_at", "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()"),
    ("approval_rule_versions", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("approval_rule_versions", "version", "INTEGER NOT NULL DEFAULT 1"),
    ("approval_rule_versions", "updated_at", "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()"),

    # Users, Roles, Security
    ("role_permissions", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("role_permissions", "version", "INTEGER NOT NULL DEFAULT 1"),
    ("role_permissions", "updated_at", "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()"),
    ("role_permissions", "granted_by", "UUID"),
    ("role_permissions", "granted_at", "TIMESTAMP WITH TIME ZONE DEFAULT NOW()"),
    ("password_history", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("password_history", "version", "INTEGER NOT NULL DEFAULT 1"),
    ("password_history", "updated_at", "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()"),
    ("user_mfa", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("user_mfa", "version", "INTEGER NOT NULL DEFAULT 1"),
    ("user_category_scopes", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("user_category_scopes", "version", "INTEGER NOT NULL DEFAULT 1"),
    ("user_category_scopes", "updated_at", "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()"),
    ("user_bu_scopes", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("user_bu_scopes", "version", "INTEGER NOT NULL DEFAULT 1"),
    ("user_bu_scopes", "updated_at", "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()"),
    ("user_coi_declarations", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("delegation_rules", "deleted_at", "TIMESTAMP WITH TIME ZONE"),

    # Master Data
    ("uom_master", "iso_code", "VARCHAR(10)"),
    ("currency_master", "is_base_currency", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("payment_terms", "net_days", "INTEGER NOT NULL DEFAULT 0"),
    ("tax_codes", "hsn_chapter", "VARCHAR(10)"),
    ("document_types", "has_expiry_date", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("document_types", "is_mandatory_for_vendor", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("document_types", "validity_alert_days", "INTEGER NOT NULL DEFAULT 30"),
    ("supplier_categories", "description", "TEXT"),
    ("holiday_master", "plant_id", "UUID"),
    ("erp_material_group_mapping", "is_verified", "BOOLEAN NOT NULL DEFAULT FALSE"),

    # Platform & Settings
    ("integration_jobs", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("integration_jobs", "version", "INTEGER NOT NULL DEFAULT 1"),
    ("feature_flags", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("tenant_settings", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("notification_templates", "deleted_at", "TIMESTAMP WITH TIME ZONE"),

    # Sourcing & Bids
    ("rfq_participants", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("rfq_clarifications", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("rfq_amendments", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("rfq_amendments", "version", "INTEGER NOT NULL DEFAULT 1"),
    ("rfq_amendments", "updated_at", "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()"),
    ("bid_line_responses", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("evaluations", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("evaluation_scores", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("evaluation_scores", "version", "INTEGER NOT NULL DEFAULT 1"),
    ("comparative_statements", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("negotiations", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("award_recommendations", "deleted_at", "TIMESTAMP WITH TIME ZONE"),

    # Contracts, POs, Invoices, Payments
    ("contract_milestones", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("grn_lines", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("ses_lines", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("quality_inspections", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("invoice_lines", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("payment_records", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
    ("disputes", "deleted_at", "TIMESTAMP WITH TIME ZONE"),
]


def upgrade() -> None:
    for table, column, col_type in ADD_COLUMNS:
        op.execute(f"ALTER TABLE IF EXISTS {table} ADD COLUMN IF NOT EXISTS {column} {col_type}")


def downgrade() -> None:
    for table, column, _ in reversed(ADD_COLUMNS):
        op.execute(f"ALTER TABLE IF EXISTS {table} DROP COLUMN IF EXISTS {column}")
