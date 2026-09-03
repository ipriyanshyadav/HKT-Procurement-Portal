"""Create initial monthly partitions for audit_logs

Revision ID: 0023_audit_partitions
Revises: 0022_audit_log
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0023_audit_partitions'
down_revision: Union[str, None] = '0022_audit_log'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PARTITIONS = [
    ("audit_logs_2026_07", "2026-07-01", "2026-08-01"),
    ("audit_logs_2026_08", "2026-08-01", "2026-09-01"),
    ("audit_logs_2026_09", "2026-09-01", "2026-10-01"),
    ("audit_logs_2026_10", "2026-10-01", "2026-11-01"),
    ("audit_logs_2026_11", "2026-11-01", "2026-12-01"),
]

def upgrade() -> None:
    for name, start, end in PARTITIONS:
        op.execute(f"""
        CREATE TABLE {name} PARTITION OF audit_logs
            FOR VALUES FROM ('{start}') TO ('{end}');
        """)

def downgrade() -> None:
    for name, _, _ in reversed(PARTITIONS):
        op.execute(f"DROP TABLE IF EXISTS {name} CASCADE")
