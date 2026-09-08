"""Create ticket enums

Revision ID: 0028_ticket_enums
Revises: 0037_trgm_search_indexes
Create Date: 2026-09-08 04:30:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "0028_ticket_enums"
down_revision: Union[str, None] = "0037_trgm_search_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE ticket_type_enum AS ENUM ("
        "'QUERY', 'BUG', 'DISCREPANCY', 'COMPLAINT', "
        "'CHANGE_REQUEST', 'SUPPORT', 'AUDIT_QUERY', 'VENDOR_ISSUE')"
    )
    op.execute(
        "CREATE TYPE ticket_priority_enum AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')"
    )
    op.execute(
        "CREATE TYPE ticket_status_enum AS ENUM ("
        "'OPEN', 'IN_PROGRESS', 'PENDING_RESPONSE', 'ESCALATED', "
        "'RESOLVED', 'CLOSED', 'REOPENED')"
    )


def downgrade() -> None:
    op.execute("DROP TYPE IF EXISTS ticket_status_enum CASCADE")
    op.execute("DROP TYPE IF EXISTS ticket_priority_enum CASCADE")
    op.execute("DROP TYPE IF EXISTS ticket_type_enum CASCADE")
