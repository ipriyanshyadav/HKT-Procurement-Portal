"""Add pg_trgm GIN search indexes and composite sort-filter indexes

Revision ID: 0037_trgm_search_indexes
Revises: 0036_item_master
Create Date: 2026-09-08 02:20:00.000000

"""
from alembic import op

revision: str = "0037_trgm_search_indexes"
down_revision: str | None = "0036_item_master"
branch_labels = None
depends_on = None

INDEXES = [
    # 1. Requisitions text search
    (
        "idx_trgm_requisitions_pr_number",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trgm_requisitions_pr_number "
        "ON requisitions USING GIN (pr_number gin_trgm_ops) WHERE deleted_at IS NULL",
    ),
    (
        "idx_trgm_requisitions_title",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trgm_requisitions_title "
        "ON requisitions USING GIN (title gin_trgm_ops) WHERE deleted_at IS NULL",
    ),
    (
        "idx_trgm_requisitions_desc",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trgm_requisitions_desc "
        "ON requisitions USING GIN (description gin_trgm_ops) WHERE deleted_at IS NULL",
    ),

    # 2. Sourcing RFQ text search
    (
        "idx_trgm_rfqs_rfq_number",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trgm_rfqs_rfq_number "
        "ON rfqs USING GIN (rfq_number gin_trgm_ops) WHERE deleted_at IS NULL",
    ),
    (
        "idx_trgm_rfqs_title",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trgm_rfqs_title "
        "ON rfqs USING GIN (title gin_trgm_ops) WHERE deleted_at IS NULL",
    ),

    # 3. Purchase orders text search
    (
        "idx_trgm_pos_po_number",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trgm_pos_po_number "
        "ON purchase_orders USING GIN (po_number gin_trgm_ops) WHERE deleted_at IS NULL",
    ),
    (
        "idx_trgm_pos_title",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trgm_pos_title "
        "ON purchase_orders USING GIN (title gin_trgm_ops) WHERE deleted_at IS NULL",
    ),

    # 4. Contracts text search
    (
        "idx_trgm_contracts_contract_number",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trgm_contracts_contract_number "
        "ON contracts USING GIN (contract_number gin_trgm_ops) WHERE deleted_at IS NULL",
    ),
    (
        "idx_trgm_contracts_title",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trgm_contracts_title "
        "ON contracts USING GIN (title gin_trgm_ops) WHERE deleted_at IS NULL",
    ),

    # 5. Vendors text search
    (
        "idx_trgm_vendors_company_name",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trgm_vendors_company_name "
        "ON vendors USING GIN (company_name gin_trgm_ops) WHERE deleted_at IS NULL",
    ),
    (
        "idx_trgm_vendors_legal_name",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trgm_vendors_legal_name "
        "ON vendors USING GIN (legal_name gin_trgm_ops) WHERE deleted_at IS NULL",
    ),
    (
        "idx_trgm_vendors_vendor_code",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trgm_vendors_vendor_code "
        "ON vendors USING GIN (vendor_code gin_trgm_ops) WHERE deleted_at IS NULL",
    ),

    # 6. Goods receipt notes text search
    (
        "idx_trgm_grn_number",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trgm_grn_number "
        "ON goods_receipt_notes USING GIN (grn_number gin_trgm_ops) WHERE deleted_at IS NULL",
    ),

    # 7. Item master text search
    (
        "idx_trgm_items_name",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trgm_items_name "
        "ON item_master USING GIN (name gin_trgm_ops) WHERE deleted_at IS NULL",
    ),
    (
        "idx_trgm_items_code",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trgm_items_code "
        "ON item_master USING GIN (code gin_trgm_ops) WHERE deleted_at IS NULL",
    ),

    # 8. Composite (org_id, status, created_at DESC) sort-filter indexes
    (
        "idx_requisitions_org_status_created",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_requisitions_org_status_created "
        "ON requisitions (org_id, status, created_at DESC) WHERE deleted_at IS NULL",
    ),
    (
        "idx_rfqs_org_status_created",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rfqs_org_status_created "
        "ON rfqs (org_id, status, created_at DESC) WHERE deleted_at IS NULL",
    ),
    (
        "idx_pos_org_status_created",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_org_status_created "
        "ON purchase_orders (org_id, status, created_at DESC) WHERE deleted_at IS NULL",
    ),
    (
        "idx_contracts_org_status_created",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_org_status_created "
        "ON contracts (org_id, status, created_at DESC) WHERE deleted_at IS NULL",
    ),
    (
        "idx_invoices_org_status_created",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_org_status_created "
        "ON invoices (org_id, status, created_at DESC) WHERE deleted_at IS NULL",
    ),
]


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
    with op.get_context().autocommit_block():
        for _, sql in INDEXES:
            op.execute(sql)


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, _ in reversed(INDEXES):
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name};")
