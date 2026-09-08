"""Seed ticket permissions and assign to roles

Revision ID: 0034_ticket_permissions
Revises: 0033_ticket_sla_seed
Create Date: 2026-09-08 04:36:00.000000

"""
from typing import Sequence, Union
from alembic import op
from sqlalchemy import text

revision: str = "0034_ticket_permissions"
down_revision: Union[str, None] = "0033_ticket_sla_seed"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TICKET_PERMISSIONS = [
    ("ticket.create", "Create Tickets", "ticket"),
    ("ticket.view_own", "View Own Tickets", "ticket"),
    ("ticket.view_team", "View Team Tickets", "ticket"),
    ("ticket.view_all", "View All Tickets", "ticket"),
    ("ticket.assign", "Assign Tickets", "ticket"),
    ("ticket.resolve", "Resolve Tickets", "ticket"),
    ("ticket.close", "Close Tickets", "ticket"),
    ("ticket.reopen", "Reopen Tickets", "ticket"),
    ("ticket.add_internal_note", "Add Internal Notes", "ticket"),
    ("ticket.escalate", "Escalate Tickets", "ticket"),
    ("ticket.config_sla", "Configure SLA Settings", "ticket"),
    ("ticket.export", "Export Ticket Data", "ticket"),
]

ROLE_PERMISSIONS = {
    "REQUESTOR": ["ticket.create", "ticket.view_own"],
    "BUYER": ["ticket.create", "ticket.view_team", "ticket.assign", "ticket.reopen"],
    "SOURCING_MANAGER": ["ticket.create", "ticket.view_team", "ticket.assign", "ticket.add_internal_note"],
    "APPROVER": ["ticket.create", "ticket.view_team", "ticket.assign", "ticket.resolve", "ticket.reopen"],
    "FINANCE_CONTROLLER": ["ticket.create", "ticket.view_team", "ticket.assign", "ticket.resolve"],
    "PROCUREMENT_HEAD": [
        "ticket.create", "ticket.view_all", "ticket.assign", "ticket.resolve",
        "ticket.close", "ticket.reopen", "ticket.escalate", "ticket.add_internal_note", "ticket.export"
    ],
    "VENDOR_ADMIN": [
        "ticket.create", "ticket.view_all", "ticket.assign", "ticket.resolve",
        "ticket.close", "ticket.reopen", "ticket.escalate", "ticket.add_internal_note", "ticket.export"
    ],
    "PROCUREMENT_ADMIN": [
        "ticket.create", "ticket.view_all", "ticket.assign", "ticket.resolve",
        "ticket.close", "ticket.reopen", "ticket.escalate", "ticket.add_internal_note",
        "ticket.config_sla", "ticket.export"
    ],
    "SUPERADMIN": [
        "ticket.create", "ticket.view_all", "ticket.assign", "ticket.resolve",
        "ticket.close", "ticket.reopen", "ticket.escalate", "ticket.add_internal_note",
        "ticket.config_sla", "ticket.export"
    ],
    "SUPPLIER_USER": ["ticket.create", "ticket.view_own"],
    "SUPPLIER": ["ticket.create", "ticket.view_own"],
}


def upgrade() -> None:
    conn = op.get_bind()
    for code, name, module in TICKET_PERMISSIONS:
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

    for role_code, perms in ROLE_PERMISSIONS.items():
        for perm_code in perms:
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
    codes = [p[0] for p in TICKET_PERMISSIONS]
    conn.execute(
        text("DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code = ANY(:codes))"),
        {"codes": codes},
    )
    conn.execute(
        text("DELETE FROM permissions WHERE code = ANY(:codes)"),
        {"codes": codes},
    )
