"""Create 40+ composite, GIN, and partial indexes concurrently

Revision ID: 0024_indexes
Revises: 0023_audit_partitions
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0024_indexes'
down_revision: Union[str, None] = '0023_audit_partitions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDEXES = [
    # Composite (org_id, status) indexes
    ("idx_users_org_status", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_org_status ON users (org_id, status) WHERE deleted_at IS NULL"),
    ("idx_vendors_org_status", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendors_org_status ON vendors (org_id, status) WHERE deleted_at IS NULL"),
    ("idx_requisitions_org_status", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_requisitions_org_status ON requisitions (org_id, status) WHERE deleted_at IS NULL"),
    ("idx_rfqs_org_status", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rfqs_org_status ON rfqs (org_id, status) WHERE deleted_at IS NULL"),
    ("idx_bid_responses_org_status", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bid_responses_org_status ON bid_responses (org_id, status) WHERE deleted_at IS NULL"),
    ("idx_contracts_org_status", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_org_status ON contracts (org_id, status) WHERE deleted_at IS NULL"),
    ("idx_pos_org_status", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_org_status ON purchase_orders (org_id, status) WHERE deleted_at IS NULL"),
    ("idx_invoices_org_status", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_org_status ON invoices (org_id, status) WHERE deleted_at IS NULL"),
    ("idx_workflow_instances_org_status", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_instances_org_status ON workflow_instances (org_id, status)"),
    ("idx_workflow_tasks_org_status", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_tasks_org_status ON workflow_tasks (org_id, status)"),

    # Time-based indexes
    ("idx_requisitions_org_created", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_requisitions_org_created ON requisitions (org_id, created_at DESC)"),
    ("idx_rfqs_org_created", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rfqs_org_created ON rfqs (org_id, created_at DESC)"),
    ("idx_invoices_org_created", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_org_created ON invoices (org_id, created_at DESC)"),
    ("idx_notifications_user_created", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_created ON notifications (org_id, user_id, created_at DESC)"),

    # GIN indexes on JSONB columns
    ("idx_approval_rules_conditions", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_rules_conditions ON approval_rules USING GIN (conditions)"),
    ("idx_approval_rules_steps", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_rules_steps ON approval_rules USING GIN (approval_steps)"),
    ("idx_workflow_templates_steps", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_templates_steps ON workflow_templates USING GIN (steps)"),
    ("idx_audit_logs_field_changes", "CREATE INDEX IF NOT EXISTS idx_audit_logs_field_changes ON audit_logs USING GIN (field_changes)"),
    ("idx_unmapped_failed_fields", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unmapped_failed_fields ON unmapped_pr_exceptions USING GIN (failed_fields)"),

    # Partial indexes for audit queries (partitioned table)
    ("idx_audit_entity", "CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs (entity_type, entity_id, created_at DESC)"),
    ("idx_audit_actor", "CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (actor_id, created_at DESC) WHERE actor_id IS NOT NULL"),

    # Workflow task lookups
    ("idx_workflow_tasks_assigned", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_tasks_assigned ON workflow_tasks (org_id, assigned_to, status) WHERE status = 'PENDING'"),
    ("idx_workflow_tasks_sla", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_tasks_sla ON workflow_tasks (sla_deadline) WHERE status = 'PENDING' AND sla_deadline IS NOT NULL"),

    # Outbox processing
    ("idx_outbox_pending", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_outbox_pending ON outbox_messages (status, created_at) WHERE status = 'PENDING'"),

    # Integration job retry
    ("idx_integration_retry", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_retry ON integration_jobs (status, next_retry_at) WHERE status IN ('FAILED', 'RETRY_SCHEDULED')"),

    # Bid deadline queries
    ("idx_rfqs_bid_close", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rfqs_bid_close ON rfqs (org_id, bid_close_at) WHERE status IN ('PUBLISHED', 'BID_OPEN')"),

    # Vendor duplicate detection
    ("idx_vendors_pan", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendors_pan ON vendors (org_id, pan) WHERE pan IS NOT NULL AND deleted_at IS NULL"),
    ("idx_vendors_gstin", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendors_gstin ON vendors (org_id, gstin) WHERE gstin IS NOT NULL AND deleted_at IS NULL"),
    ("idx_vendor_bank_ifsc", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_bank_ifsc ON vendor_bank_accounts (org_id, ifsc_code) WHERE deleted_at IS NULL"),

    # Additional high-cardinality foreign-key and entity query indexes
    ("idx_password_history_user", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_history_user ON password_history (org_id, user_id, created_at DESC)"),
    ("idx_users_email", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users (email) WHERE deleted_at IS NULL"),
    ("idx_vendors_company_name", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendors_company_name ON vendors (org_id, company_name) WHERE deleted_at IS NULL"),
    ("idx_requisitions_requestor", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_requisitions_requestor ON requisitions (org_id, requestor_id, status) WHERE deleted_at IS NULL"),
    ("idx_rfqs_buyer", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rfqs_buyer ON rfqs (org_id, buyer_id, status) WHERE deleted_at IS NULL"),
    ("idx_pos_buyer", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_buyer ON purchase_orders (org_id, buyer_id, status) WHERE deleted_at IS NULL"),
    ("idx_pos_vendor", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_vendor ON purchase_orders (org_id, vendor_id, status) WHERE deleted_at IS NULL"),
    ("idx_grn_po", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grn_po ON goods_receipt_notes (org_id, po_id, status) WHERE deleted_at IS NULL"),
    ("idx_ses_po", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ses_po ON service_entry_sheets (org_id, po_id, status) WHERE deleted_at IS NULL"),
    ("idx_invoices_po", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_po ON invoices (org_id, po_id, status) WHERE deleted_at IS NULL"),
    ("idx_invoices_vendor", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_vendor ON invoices (org_id, vendor_id, status) WHERE deleted_at IS NULL"),
    ("idx_payments_invoice", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_invoice ON payment_records (org_id, invoice_id, status)"),
    ("idx_disputes_invoice", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disputes_invoice ON disputes (org_id, invoice_id, status)"),
    ("idx_documents_entity", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_entity ON documents (org_id, entity_type, entity_id) WHERE deleted_at IS NULL"),
    ("idx_notifications_unread", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread ON notifications (org_id, user_id, status) WHERE read_at IS NULL"),
    ("idx_contracts_vendor", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_vendor ON contracts (org_id, vendor_id, status) WHERE deleted_at IS NULL"),
    ("idx_bid_responses_vendor", "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bid_responses_vendor ON bid_responses (org_id, vendor_id, status) WHERE deleted_at IS NULL"),
]

def upgrade() -> None:
    with op.get_context().autocommit_block():
        for _, sql in INDEXES:
            op.execute(sql)

def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, _ in reversed(INDEXES):
            if name.startswith("idx_audit_"):
                op.execute(f"DROP INDEX IF EXISTS {name}")
            else:
                op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
