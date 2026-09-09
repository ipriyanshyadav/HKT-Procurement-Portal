"""Create vendor_risk_assessments table for SPEC_21 / SPEC_07

Revision ID: 0040_vendor_risk_assessment
Revises: 0039_ticket_jira_permissions
Create Date: 2026-09-09 20:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
from sqlalchemy import text

revision: str = "0040_vendor_risk_assessment"
down_revision: Union[str, None] = "0039_ticket_jira_permissions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS vendor_risk_assessments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id),
            vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
            financial_risk_score NUMERIC(5,2) NOT NULL DEFAULT 0.0,
            credit_rating VARCHAR(20) NOT NULL DEFAULT 'UNRATED',
            financial_stability_score NUMERIC(5,2) NOT NULL DEFAULT 0.0,
            liquidity_risk VARCHAR(20) NOT NULL DEFAULT 'LOW',
            bankruptcy_risk VARCHAR(20) NOT NULL DEFAULT 'LOW',
            debt_to_equity_ratio NUMERIC(6,2),
            esg_risk_score NUMERIC(5,2) NOT NULL DEFAULT 0.0,
            environmental_score NUMERIC(5,2) NOT NULL DEFAULT 0.0,
            social_score NUMERIC(5,2) NOT NULL DEFAULT 0.0,
            governance_score NUMERIC(5,2) NOT NULL DEFAULT 0.0,
            esg_rating VARCHAR(20) NOT NULL DEFAULT 'NOT_ASSESSED',
            overall_risk_score NUMERIC(5,2) NOT NULL DEFAULT 0.0,
            risk_tier VARCHAR(20) NOT NULL DEFAULT 'LOW',
            risk_factors JSONB NOT NULL DEFAULT '[]',
            mitigation_actions JSONB NOT NULL DEFAULT '[]',
            last_assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            assessed_by UUID REFERENCES users(id),
            version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT uq_vendor_risk_org_vendor UNIQUE (org_id, vendor_id)
        )
        """)
    )
    conn.execute(
        text("""
        CREATE INDEX IF NOT EXISTS idx_vendor_risk_org_tier
            ON vendor_risk_assessments (org_id, risk_tier)
        """)
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        text("DROP TABLE IF EXISTS vendor_risk_assessments CASCADE")
    )
