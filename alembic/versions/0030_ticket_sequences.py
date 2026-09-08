"""Ticket sequences documentation migration

Revision ID: 0030_ticket_sequences
Revises: 0029_ticket_tables
Create Date: 2026-09-08 04:32:00.000000

"""
from typing import Sequence, Union

revision: str = "0030_ticket_sequences"
down_revision: Union[str, None] = "0029_ticket_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Documents naming convention: seq_tkt_{org_code}_{year}
    # Actual sequences are created dynamically at runtime via CREATE SEQUENCE IF NOT EXISTS
    pass


def downgrade() -> None:
    pass
