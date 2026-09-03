"""Create all 24 enum types matching SPEC_03

Revision ID: 0002_create_enums
Revises: 0001_initial_empty
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0002_create_enums'
down_revision: Union[str, None] = '0001_initial_empty'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ENUMS = [
    ("user_status", "('ACTIVE', 'INACTIVE', 'LOCKED', 'TERMINATED', 'PENDING_ACTIVATION')"),
    ("vendor_status", "('INVITED', 'REGISTRATION_IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'RESUBMISSION_REQUESTED', 'QUALIFIED', 'ACTIVE', 'SUSPENDED', 'COMPLIANCE_HOLD', 'BLACKLISTED', 'DEACTIVATED')"),
    ("pr_status", "('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'IN_SOURCING', 'CONVERTED', 'CANCELLED', 'UNMAPPED', 'AMENDMENT_PENDING', 'SPLIT')"),
    ("pr_source", "('MANUAL', 'ERP_API', 'ERP_BATCH', 'MOBILE', 'CATALOG', 'EMAIL')"),
    ("rfq_status", "('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'BID_OPEN', 'BID_CLOSED', 'BIDS_OPENED', 'UNDER_EVALUATION', 'CS_GENERATED', 'CS_APPROVED', 'AWARDED', 'CANCELLED', 'NO_BIDS', 'COMPLIANCE_HOLD', 'AMENDMENT_PENDING')"),
    ("rfq_type", "('OPEN_TENDER', 'LIMITED_TENDER', 'SINGLE_VENDOR', 'RATE_CONTRACT', 'FRAMEWORK_AGREEMENT', 'EMERGENCY')"),
    ("sourcing_type", "('GOODS', 'SERVICES', 'WORKS', 'GOODS_AND_SERVICES', 'TURNKEY', 'AMC')"),
    ("evaluation_type", "('L1_PRICE_ONLY', 'QCBS_QUALITY_COST', 'TECHNICAL_MERIT', 'REVERSE_AUCTION')"),
    ("bid_status", "('INVITED', 'ACCEPTED', 'REGRETTED', 'DRAFT', 'SUBMITTED', 'REOPENED', 'OPENED', 'TECHNICALLY_QUALIFIED', 'TECHNICALLY_DISQUALIFIED', 'EVALUATED', 'AWARDED', 'NOT_AWARDED', 'WITHDRAWN', 'INTEGRITY_FAIL')"),
    ("approval_task_status", "('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'DELEGATED', 'FORCE_APPROVED', 'CANCELLED', 'TIMED_OUT')"),
    ("contract_status", "('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PENDING_SIGNATURE', 'PARTIALLY_SIGNED', 'EXECUTED', 'ACTIVE', 'AMENDMENT_PENDING', 'SUSPENDED', 'EXPIRED', 'TERMINATED', 'RENEWED')"),
    ("po_status", "('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'RELEASED', 'SYNC_PENDING', 'ACKNOWLEDGED', 'REJECTED_BY_SUPPLIER', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'AMENDMENT_PENDING', 'CANCELLED', 'CLOSED')"),
    ("invoice_status", "('DRAFT', 'SUBMITTED', 'MATCHING', 'MATCHED', 'PARTIALLY_MATCHED', 'DISPUTED', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'CREDIT_NOTE_ISSUED')"),
    ("payment_status", "('PENDING', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED', 'DISPUTED')"),
    ("notification_channel", "('EMAIL', 'SMS', 'IN_APP', 'WHATSAPP', 'DIGEST')"),
    ("notification_status", "('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED')"),
    ("integration_job_status", "('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'RETRY_SCHEDULED', 'MAX_RETRIES_EXCEEDED', 'MANUALLY_RESOLVED')"),
    ("document_category", "('TENDER', 'BID', 'COMPLIANCE', 'CONTRACT', 'PURCHASE_ORDER', 'GRN_SES', 'INVOICE', 'AUDIT')"),
    ("procurement_type", "('CAPEX', 'OPEX', 'PROJECT', 'MRO', 'SERVICES')"),
    ("tax_type", "('CGST', 'SGST', 'IGST', 'UTGST', 'CESS', 'VAT', 'CUSTOMS_DUTY', 'EXEMPT')"),
    ("unmapped_pr_status", "('PENDING', 'ASSIGNED', 'MAPPED', 'CHECKER_PENDING', 'APPROVED', 'REPROCESSING', 'REPROCESSING_FAILED', 'RESOLVED', 'MANUAL_INTERVENTION_REQUIRED')"),
    ("workflow_instance_status", "('ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED', 'PENDING_RULE_RESOLUTION')"),
    ("task_action", "('APPROVE', 'REJECT', 'RETURN', 'ESCALATE', 'DELEGATE', 'FORCE_APPROVE', 'CANCEL', 'REASSIGN')"),
    ("audit_entity_type", "('ORGANIZATION', 'USER', 'ROLE', 'VENDOR', 'REQUISITION', 'RFQ', 'BID', 'EVALUATION', 'COMPARATIVE_STATEMENT', 'AWARD', 'CONTRACT', 'PURCHASE_ORDER', 'GRN', 'SES', 'INVOICE', 'PAYMENT', 'DOCUMENT', 'WORKFLOW', 'APPROVAL_RULE', 'MASTER_DATA', 'NOTIFICATION', 'INTEGRATION', 'FEATURE_FLAG', 'TENANT_SETTING', 'SESSION')"),
]

def upgrade() -> None:
    for name, values in ENUMS:
        op.execute(f"CREATE TYPE {name} AS ENUM {values}")

def downgrade() -> None:
    for name, _ in reversed(ENUMS):
        op.execute(f"DROP TYPE IF EXISTS {name} CASCADE")
