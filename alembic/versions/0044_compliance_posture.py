"""0044_compliance_posture

Revision ID: 0044_compliance_posture
Revises: 0043_developer_api_keys
Create Date: 2026-09-10 00:45:00.000000

Enterprise Compliance & Security Posture Dashboard schema:
- compliance_policies: Configurable security and procurement control frameworks (ISO 27001, SOC 2, DPDP, CVC)
- compliance_scans: Historical scan records with overall and framework posture scores
- compliance_findings: Itemized findings with evidence summaries and remediation guidance
"""
from typing import Sequence, Union
from alembic import op
from sqlalchemy import text

revision: str = "0044_compliance_posture"
down_revision: Union[str, None] = "0043_developer_api_keys"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Compliance Policies table
    conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS compliance_policies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            code VARCHAR(50) NOT NULL,
            title VARCHAR(200) NOT NULL,
            framework VARCHAR(50) NOT NULL,
            severity VARCHAR(20) NOT NULL DEFAULT 'HIGH',
            is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_compliance_policy UNIQUE (org_id, code)
        );
        """)
    )

    # 2. Compliance Scans table
    conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS compliance_scans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            scanned_by UUID REFERENCES users(id) ON DELETE SET NULL,
            overall_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
            status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
            total_checks INTEGER NOT NULL DEFAULT 0,
            passed_checks INTEGER NOT NULL DEFAULT 0,
            warning_checks INTEGER NOT NULL DEFAULT 0,
            failed_checks INTEGER NOT NULL DEFAULT 0,
            framework_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
            summary_notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """)
    )

    # 3. Compliance Findings table
    conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS compliance_findings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            scan_id UUID NOT NULL REFERENCES compliance_scans(id) ON DELETE CASCADE,
            policy_code VARCHAR(50) NOT NULL,
            title VARCHAR(200) NOT NULL,
            framework VARCHAR(50) NOT NULL,
            severity VARCHAR(20) NOT NULL,
            status VARCHAR(20) NOT NULL,
            score NUMERIC(5, 2) NOT NULL,
            evidence_summary TEXT,
            remediation_guidance TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """)
    )

    # 4. Indexes (single statements for asyncpg)
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_compliance_policies_org ON compliance_policies(org_id, is_enabled);"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_compliance_scans_org ON compliance_scans(org_id, created_at DESC);"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_compliance_findings_scan ON compliance_findings(scan_id, status);"))


def downgrade() -> None:
    conn = op.get_bind()

    conn.execute(text("DROP TABLE IF EXISTS compliance_findings CASCADE;"))
    conn.execute(text("DROP TABLE IF EXISTS compliance_scans CASCADE;"))
    conn.execute(text("DROP TABLE IF EXISTS compliance_policies CASCADE;"))
