"""Create documents and document_versions tables, and wire FK constraints

Revision ID: 0019_document
Revises: 0018_invoice_payment
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0019_document'
down_revision: Union[str, None] = '0018_invoice_payment'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
    CREATE TABLE documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID NOT NULL,
        category document_category NOT NULL,
        original_filename VARCHAR(500) NOT NULL,
        stored_filename VARCHAR(500) NOT NULL,
        minio_bucket VARCHAR(50) NOT NULL,
        minio_key VARCHAR(1000) NOT NULL,
        content_type VARCHAR(100) NOT NULL,
        file_size_bytes BIGINT NOT NULL,
        sha256_hash VARCHAR(64) NOT NULL,
        scan_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        scan_result VARCHAR(20),
        is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
        encryption_key_ref VARCHAR(200),
        ocr_extracted_data JSONB,
        current_version INTEGER NOT NULL DEFAULT 1,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID REFERENCES users(id),
        deleted_at TIMESTAMP WITH TIME ZONE
    );
    """)

    op.execute("""
    CREATE TABLE document_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        document_id UUID NOT NULL REFERENCES documents(id),
        version_number INTEGER NOT NULL,
        minio_key VARCHAR(1000) NOT NULL,
        file_size_bytes BIGINT NOT NULL,
        sha256_hash VARCHAR(64) NOT NULL,
        uploaded_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (org_id, document_id, version_number)
    );
    """)

    op.execute("""
    ALTER TABLE vendor_documents
        ADD CONSTRAINT fk_vendor_docs_document_id FOREIGN KEY (document_id) REFERENCES documents(id);
    """)

    op.execute("""
    ALTER TABLE bid_documents
        ADD CONSTRAINT fk_bid_docs_document_id FOREIGN KEY (document_id) REFERENCES documents(id);
    """)

    op.execute("""
    ALTER TABLE comparative_statements
        ADD CONSTRAINT fk_cs_pdf_document_id FOREIGN KEY (pdf_document_id) REFERENCES documents(id);
    """)

    op.execute("""
    ALTER TABLE contracts
        ADD CONSTRAINT fk_contracts_signed_document_id FOREIGN KEY (signed_document_id) REFERENCES documents(id);
    """)

    op.execute("""
    ALTER TABLE contract_documents
        ADD CONSTRAINT fk_contract_docs_document_id FOREIGN KEY (document_id) REFERENCES documents(id);
    """)

    op.execute("""
    ALTER TABLE contract_amendments
        ADD CONSTRAINT fk_contract_amendments_doc_id FOREIGN KEY (new_document_id) REFERENCES documents(id);
    """)

    op.execute("""
    ALTER TABLE purchase_orders
        ADD CONSTRAINT fk_po_pdf_document_id FOREIGN KEY (po_pdf_document_id) REFERENCES documents(id);
    """)

def downgrade() -> None:
    op.execute("ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS fk_po_pdf_document_id")
    op.execute("ALTER TABLE contract_amendments DROP CONSTRAINT IF EXISTS fk_contract_amendments_doc_id")
    op.execute("ALTER TABLE contract_documents DROP CONSTRAINT IF EXISTS fk_contract_docs_document_id")
    op.execute("ALTER TABLE contracts DROP CONSTRAINT IF EXISTS fk_contracts_signed_document_id")
    op.execute("ALTER TABLE comparative_statements DROP CONSTRAINT IF EXISTS fk_cs_pdf_document_id")
    op.execute("ALTER TABLE bid_documents DROP CONSTRAINT IF EXISTS fk_bid_docs_document_id")
    op.execute("ALTER TABLE vendor_documents DROP CONSTRAINT IF EXISTS fk_vendor_docs_document_id")
    op.execute("DROP TABLE IF EXISTS document_versions CASCADE")
    op.execute("DROP TABLE IF EXISTS documents CASCADE")
