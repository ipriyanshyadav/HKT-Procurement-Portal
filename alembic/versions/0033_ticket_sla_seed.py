"""Seed ticket SLA config for existing organizations

Revision ID: 0033_ticket_sla_seed
Revises: 0032_ticket_rls
Create Date: 2026-09-08 04:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
from sqlalchemy import text

revision: str = "0033_ticket_sla_seed"
down_revision: Union[str, None] = "0032_ticket_rls"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_SLA = [
    {
        "priority": "CRITICAL",
        "first_response_hours": 1,
        "resolution_hours": 4,
        "escalation_hours": 2,
        "escalate_to_role": "PROCUREMENT_ADMIN",
    },
    {
        "priority": "HIGH",
        "first_response_hours": 4,
        "resolution_hours": 24,
        "escalation_hours": 12,
        "escalate_to_role": "VENDOR_ADMIN",
    },
    {
        "priority": "MEDIUM",
        "first_response_hours": 8,
        "resolution_hours": 72,
        "escalation_hours": 48,
        "escalate_to_role": "BUYER",
    },
    {
        "priority": "LOW",
        "first_response_hours": 24,
        "resolution_hours": 168,
        "escalation_hours": 96,
        "escalate_to_role": "BUYER",
    },
]


def upgrade() -> None:
    conn = op.get_bind()
    orgs = conn.execute(text("SELECT id FROM organizations WHERE deleted_at IS NULL")).fetchall()
    for org in orgs:
        org_id = org[0]
        for sla in DEFAULT_SLA:
            conn.execute(
                text("""
                INSERT INTO ticket_sla_config (
                    id, org_id, priority, first_response_hours,
                    resolution_hours, escalation_hours, escalate_to_role,
                    version, created_at, updated_at
                )
                VALUES (
                    gen_random_uuid(), :org_id, :priority, :first_response_hours,
                    :resolution_hours, :escalation_hours, :escalate_to_role,
                    1, NOW(), NOW()
                )
                ON CONFLICT (org_id, priority) DO NOTHING;
                """),
                {"org_id": org_id, **sla},
            )


def downgrade() -> None:
    op.execute("DELETE FROM ticket_sla_config;")
