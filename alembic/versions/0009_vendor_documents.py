"""Create vendor_documents table

Revision ID: 0009_vendor_documents
Revises: 0008_vendor_alter
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0009_vendor_documents'
down_revision: Union[str, None] = '0008_vendor_alter'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    CREATE TABLE vendor_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        vendor_id UUID NOT NULL REFERENCES vendors(id),
        document_type_id UUID NOT NULL REFERENCES document_types(id),
        document_id UUID NOT NULL,
        expiry_date DATE,
        verified_by UUID REFERENCES users(id),
        verified_at TIMESTAMP WITH TIME ZONE,
        verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        verification_notes TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    );
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS vendor_documents CASCADE")
