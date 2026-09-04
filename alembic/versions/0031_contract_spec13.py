"""Add SPEC_13 contract columns: document paths, utilized value, sla terms, renewal, amendment details

Revision ID: 0031_contract_spec13
Revises: 0030_evaluation_spec12
Create Date: 2026-09-05 04:30:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "0031_contract_spec13"
down_revision: Union[str, None] = "0030_evaluation_spec12"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add new enum values to contract_status if not existing
    new_enum_values = [
        "PENDING_REVIEW",
        "RETURNED",
        "PENDING_ESIGN",
        "AMENDED",
        "TERMINATION_NOTICE",
        "CANCELLED",
    ]
    for val in new_enum_values:
        op.execute(f"ALTER TYPE contract_status ADD VALUE IF NOT EXISTS '{val}'")

    # 2. Add columns to contracts table
    op.execute("ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_document_path VARCHAR(500)")
    op.execute("ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_document_path VARCHAR(500)")
    op.execute("ALTER TABLE contracts ADD COLUMN IF NOT EXISTS utilized_value NUMERIC(18,2) NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sla_terms JSONB NOT NULL DEFAULT '{}'::jsonb")
    op.execute("ALTER TABLE contracts ADD COLUMN IF NOT EXISTS renewal_notice_days INTEGER NOT NULL DEFAULT 30")
    op.execute("ALTER TABLE contracts ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE contracts ADD COLUMN IF NOT EXISTS original_contract_id UUID REFERENCES contracts(id)")
    op.execute("ALTER TABLE contracts ADD COLUMN IF NOT EXISTS award_recommendation_id UUID REFERENCES award_recommendations(id)")

    # 3. Add columns to contract_amendments table
    op.execute("ALTER TABLE contract_amendments ADD COLUMN IF NOT EXISTS amendment_type VARCHAR(50) NOT NULL DEFAULT 'VALUE_CHANGE'")
    op.execute("ALTER TABLE contract_amendments ADD COLUMN IF NOT EXISTS change_description TEXT")
    op.execute("ALTER TABLE contract_amendments ADD COLUMN IF NOT EXISTS original_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb")
    op.execute("ALTER TABLE contract_amendments ALTER COLUMN changes_summary DROP NOT NULL")
    op.execute("ALTER TABLE contract_amendments ALTER COLUMN field_changes DROP NOT NULL")

    # 4. Add columns to contract_milestones table
    op.execute("ALTER TABLE contract_milestones ADD COLUMN IF NOT EXISTS milestone_weight NUMERIC(5,2)")

    # 5. Indexes
    op.execute("CREATE INDEX IF NOT EXISTS ix_contracts_award_rec_id ON contracts(award_recommendation_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_contracts_end_date ON contracts(end_date)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_contract_milestones_contract_id ON contract_milestones(contract_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_contract_amendments_contract_id ON contract_amendments(contract_id)")


def downgrade() -> None:
    # Drop indexes
    op.execute("DROP INDEX IF EXISTS ix_contract_amendments_contract_id")
    op.execute("DROP INDEX IF EXISTS ix_contract_milestones_contract_id")
    op.execute("DROP INDEX IF EXISTS ix_contracts_end_date")
    op.execute("DROP INDEX IF EXISTS ix_contracts_award_rec_id")

    # Drop columns from contract_milestones
    op.execute("ALTER TABLE contract_milestones DROP COLUMN IF EXISTS milestone_weight")

    # Revert contract_amendments changes
    op.execute("ALTER TABLE contract_amendments DROP COLUMN IF EXISTS original_snapshot")
    op.execute("ALTER TABLE contract_amendments DROP COLUMN IF EXISTS change_description")
    op.execute("ALTER TABLE contract_amendments DROP COLUMN IF EXISTS amendment_type")

    # Drop columns from contracts
    op.execute("ALTER TABLE contracts DROP COLUMN IF EXISTS award_recommendation_id")
    op.execute("ALTER TABLE contracts DROP COLUMN IF EXISTS original_contract_id")
    op.execute("ALTER TABLE contracts DROP COLUMN IF EXISTS activated_at")
    op.execute("ALTER TABLE contracts DROP COLUMN IF EXISTS renewal_notice_days")
    op.execute("ALTER TABLE contracts DROP COLUMN IF EXISTS sla_terms")
    op.execute("ALTER TABLE contracts DROP COLUMN IF EXISTS utilized_value")
    op.execute("ALTER TABLE contracts DROP COLUMN IF EXISTS signed_document_path")
    op.execute("ALTER TABLE contracts DROP COLUMN IF EXISTS contract_document_path")
