"""Enable Row Level Security and create tenant isolation policies

Revision ID: 0025_rls
Revises: 0024_indexes
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0025_rls'
down_revision: Union[str, None] = '0024_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RLS_TABLES = [
    ("vendors", "vendors_org_isolation"),
    ("requisitions", "requisitions_org_isolation"),
    ("rfqs", "rfqs_org_isolation"),
    ("purchase_orders", "pos_org_isolation"),
    ("invoices", "invoices_org_isolation"),
    ("contracts", "contracts_org_isolation"),
]

def upgrade() -> None:
    for table, policy in RLS_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"""
        CREATE POLICY {policy} ON {table}
            USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID);
        """)

def downgrade() -> None:
    for table, policy in reversed(RLS_TABLES):
        op.execute(f"DROP POLICY IF EXISTS {policy} ON {table};")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
