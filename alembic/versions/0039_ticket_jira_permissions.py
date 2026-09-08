"""Seed ticket Jira enhancement permissions

Revision ID: 0039_ticket_jira_permissions
Revises: 0038_ticket_jira_schema
Create Date: 2026-09-08 12:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
from sqlalchemy import text

revision: str = "0039_ticket_jira_permissions"
down_revision: Union[str, None] = "0038_ticket_jira_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_PERMISSIONS = [
    ("ticket.link", "Link Tickets", "ticket"),
    ("ticket.config_custom_fields", "Configure Custom Fields", "ticket"),
    ("ticket.config_automation", "Configure Automation Rules", "ticket"),
]

ROLE_ASSIGNMENTS = {
    "SUPERADMIN": ["ticket.link", "ticket.config_custom_fields", "ticket.config_automation"],
    "ORG_ADMIN": ["ticket.link", "ticket.config_custom_fields", "ticket.config_automation"],
    "PROCUREMENT_ADMIN": ["ticket.link", "ticket.config_custom_fields", "ticket.config_automation"],
    "PROCUREMENT_HEAD": ["ticket.link", "ticket.config_automation"],
    "BUYER": ["ticket.link"],
    "REQUESTOR": ["ticket.link"],
    "SOURCING_MANAGER": ["ticket.link"],
    "APPROVER": ["ticket.link"],
    "VENDOR_ADMIN": ["ticket.link"],
}


def upgrade() -> None:
    conn = op.get_bind()
    for code, name, module in NEW_PERMISSIONS:
        conn.execute(
            text("""
            INSERT INTO permissions (id, code, name, module, description, created_at)
            VALUES (gen_random_uuid(), :code, :name, :module, :description, NOW())
            ON CONFLICT (code) DO NOTHING;
            """),
            {
                "code": code,
                "name": name,
                "module": module,
                "description": f"Permission for {name}",
            },
        )

    for role_code, perm_codes in ROLE_ASSIGNMENTS.items():
        for perm_code in perm_codes:
            conn.execute(
                text("""
                INSERT INTO role_permissions (
                    id, org_id, role_id, permission_id, version,
                    created_at, updated_at, granted_at
                )
                SELECT gen_random_uuid(), r.org_id, r.id, p.id, 1, NOW(), NOW(), NOW()
                FROM roles r
                JOIN permissions p ON p.code = :perm_code
                WHERE r.code = :role_code AND r.deleted_at IS NULL
                ON CONFLICT (org_id, role_id, permission_id) DO NOTHING;
                """),
                {"role_code": role_code, "perm_code": perm_code},
            )


def downgrade() -> None:
    conn = op.get_bind()
    perm_codes = [p[0] for p in NEW_PERMISSIONS]
    conn.execute(
        text("DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code = ANY(:perm_codes))"),
        {"perm_codes": perm_codes},
    )
    conn.execute(
        text("DELETE FROM permissions WHERE code = ANY(:perm_codes)"),
        {"perm_codes": perm_codes},
    )
