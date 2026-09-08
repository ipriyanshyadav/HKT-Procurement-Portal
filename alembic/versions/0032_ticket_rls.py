"""Enable RLS on tickets and ticket_comments

Revision ID: 0032_ticket_rls
Revises: 0031_ticket_indexes
Create Date: 2026-09-08 04:34:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "0032_ticket_rls"
down_revision: Union[str, None] = "0031_ticket_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;")
    op.execute("""
    CREATE POLICY ticket_org_isolation ON tickets
        USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID);
    """)

    op.execute("ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;")
    op.execute("""
    CREATE POLICY ticket_comment_org_isolation ON ticket_comments
        USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID);
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS ticket_org_isolation ON tickets;")
    op.execute("ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS ticket_comment_org_isolation ON ticket_comments;")
    op.execute("ALTER TABLE ticket_comments DISABLE ROW LEVEL SECURITY;")
