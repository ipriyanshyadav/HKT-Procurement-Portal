import enum
from sqlalchemy.dialects.postgresql import ENUM as PGENUM

class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    LOCKED = "LOCKED"
    TERMINATED = "TERMINATED"
    PENDING_ACTIVATION = "PENDING_ACTIVATION"

class VendorStatus(str, enum.Enum):
    INVITED = "INVITED"
    REGISTRATION_IN_PROGRESS = "REGISTRATION_IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESUBMISSION_REQUESTED = "RESUBMISSION_REQUESTED"
    QUALIFIED = "QUALIFIED"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    COMPLIANCE_HOLD = "COMPLIANCE_HOLD"
    BLACKLISTED = "BLACKLISTED"
    DEACTIVATED = "DEACTIVATED"

class PRStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"
    IN_SOURCING = "IN_SOURCING"
    CONVERTED = "CONVERTED"
    CANCELLED = "CANCELLED"
    UNMAPPED = "UNMAPPED"
    AMENDMENT_PENDING = "AMENDMENT_PENDING"
    SPLIT = "SPLIT"

class PRSource(str, enum.Enum):
    MANUAL = "MANUAL"
    ERP_API = "ERP_API"
    ERP_BATCH = "ERP_BATCH"
    MOBILE = "MOBILE"
    CATALOG = "CATALOG"
    EMAIL = "EMAIL"

class RFQStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    PUBLISHED = "PUBLISHED"
    BID_OPEN = "BID_OPEN"
    BID_CLOSED = "BID_CLOSED"
    BIDS_OPENED = "BIDS_OPENED"
    UNDER_EVALUATION = "UNDER_EVALUATION"
    CS_GENERATED = "CS_GENERATED"
    CS_APPROVED = "CS_APPROVED"
    AWARDED = "AWARDED"
    CANCELLED = "CANCELLED"
    NO_BIDS = "NO_BIDS"
    COMPLIANCE_HOLD = "COMPLIANCE_HOLD"
    AMENDMENT_PENDING = "AMENDMENT_PENDING"

class RFQType(str, enum.Enum):
    OPEN_TENDER = "OPEN_TENDER"
    LIMITED_TENDER = "LIMITED_TENDER"
    SINGLE_VENDOR = "SINGLE_VENDOR"
    RATE_CONTRACT = "RATE_CONTRACT"
    FRAMEWORK_AGREEMENT = "FRAMEWORK_AGREEMENT"
    EMERGENCY = "EMERGENCY"

class SourcingType(str, enum.Enum):
    GOODS = "GOODS"
    SERVICES = "SERVICES"
    WORKS = "WORKS"
    GOODS_AND_SERVICES = "GOODS_AND_SERVICES"
    TURNKEY = "TURNKEY"
    AMC = "AMC"

class EvaluationType(str, enum.Enum):
    L1_PRICE_ONLY = "L1_PRICE_ONLY"
    QCBS_QUALITY_COST = "QCBS_QUALITY_COST"
    TECHNICAL_MERIT = "TECHNICAL_MERIT"
    REVERSE_AUCTION = "REVERSE_AUCTION"

class BidStatus(str, enum.Enum):
    INVITED = "INVITED"
    ACCEPTED = "ACCEPTED"
    REGRETTED = "REGRETTED"
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    REOPENED = "REOPENED"
    OPENED = "OPENED"
    TECHNICALLY_QUALIFIED = "TECHNICALLY_QUALIFIED"
    TECHNICALLY_DISQUALIFIED = "TECHNICALLY_DISQUALIFIED"
    EVALUATED = "EVALUATED"
    AWARDED = "AWARDED"
    NOT_AWARDED = "NOT_AWARDED"
    WITHDRAWN = "WITHDRAWN"
    INTEGRITY_FAIL = "INTEGRITY_FAIL"

class ApprovalTaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ESCALATED = "ESCALATED"
    DELEGATED = "DELEGATED"
    FORCE_APPROVED = "FORCE_APPROVED"
    CANCELLED = "CANCELLED"
    TIMED_OUT = "TIMED_OUT"

class ContractStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    PENDING_SIGNATURE = "PENDING_SIGNATURE"
    PARTIALLY_SIGNED = "PARTIALLY_SIGNED"
    EXECUTED = "EXECUTED"
    ACTIVE = "ACTIVE"
    AMENDMENT_PENDING = "AMENDMENT_PENDING"
    SUSPENDED = "SUSPENDED"
    EXPIRED = "EXPIRED"
    TERMINATED = "TERMINATED"
    RENEWED = "RENEWED"

class POStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    RELEASED = "RELEASED"
    SYNC_PENDING = "SYNC_PENDING"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    REJECTED_BY_SUPPLIER = "REJECTED_BY_SUPPLIER"
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED"
    FULLY_RECEIVED = "FULLY_RECEIVED"
    AMENDMENT_PENDING = "AMENDMENT_PENDING"
    CANCELLED = "CANCELLED"
    CLOSED = "CLOSED"

class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    MATCHING = "MATCHING"
    MATCHED = "MATCHED"
    PARTIALLY_MATCHED = "PARTIALLY_MATCHED"
    DISPUTED = "DISPUTED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    POSTED = "POSTED"
    PAID = "PAID"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    CANCELLED = "CANCELLED"
    CREDIT_NOTE_ISSUED = "CREDIT_NOTE_ISSUED"

class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    SCHEDULED = "SCHEDULED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REVERSED = "REVERSED"
    DISPUTED = "DISPUTED"

class NotificationChannel(str, enum.Enum):
    EMAIL = "EMAIL"
    SMS = "SMS"
    IN_APP = "IN_APP"
    WHATSAPP = "WHATSAPP"
    DIGEST = "DIGEST"

class NotificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"
    BOUNCED = "BOUNCED"

class IntegrationJobStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    RETRY_SCHEDULED = "RETRY_SCHEDULED"
    MAX_RETRIES_EXCEEDED = "MAX_RETRIES_EXCEEDED"
    MANUALLY_RESOLVED = "MANUALLY_RESOLVED"

class DocumentCategory(str, enum.Enum):
    TENDER = "TENDER"
    BID = "BID"
    COMPLIANCE = "COMPLIANCE"
    CONTRACT = "CONTRACT"
    PURCHASE_ORDER = "PURCHASE_ORDER"
    GRN_SES = "GRN_SES"
    INVOICE = "INVOICE"
    AUDIT = "AUDIT"

class ProcurementType(str, enum.Enum):
    CAPEX = "CAPEX"
    OPEX = "OPEX"
    PROJECT = "PROJECT"
    MRO = "MRO"
    SERVICES = "SERVICES"

class TaxType(str, enum.Enum):
    CGST = "CGST"
    SGST = "SGST"
    IGST = "IGST"
    UTGST = "UTGST"
    CESS = "CESS"
    VAT = "VAT"
    CUSTOMS_DUTY = "CUSTOMS_DUTY"
    EXEMPT = "EXEMPT"

class UnmappedPRStatus(str, enum.Enum):
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    MAPPED = "MAPPED"
    CHECKER_PENDING = "CHECKER_PENDING"
    APPROVED = "APPROVED"
    REPROCESSING = "REPROCESSING"
    REPROCESSING_FAILED = "REPROCESSING_FAILED"
    RESOLVED = "RESOLVED"
    MANUAL_INTERVENTION_REQUIRED = "MANUAL_INTERVENTION_REQUIRED"

class WorkflowInstanceStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    PAUSED = "PAUSED"
    PENDING_RULE_RESOLUTION = "PENDING_RULE_RESOLUTION"

class TaskAction(str, enum.Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    RETURN = "RETURN"
    ESCALATE = "ESCALATE"
    DELEGATE = "DELEGATE"
    FORCE_APPROVE = "FORCE_APPROVE"
    CANCEL = "CANCEL"
    REASSIGN = "REASSIGN"

class AuditEntityType(str, enum.Enum):
    ORGANIZATION = "ORGANIZATION"
    USER = "USER"
    ROLE = "ROLE"
    VENDOR = "VENDOR"
    REQUISITION = "REQUISITION"
    RFQ = "RFQ"
    BID = "BID"
    EVALUATION = "EVALUATION"
    COMPARATIVE_STATEMENT = "COMPARATIVE_STATEMENT"
    AWARD = "AWARD"
    CONTRACT = "CONTRACT"
    PURCHASE_ORDER = "PURCHASE_ORDER"
    GRN = "GRN"
    SES = "SES"
    INVOICE = "INVOICE"
    PAYMENT = "PAYMENT"
    DOCUMENT = "DOCUMENT"
    WORKFLOW = "WORKFLOW"
    APPROVAL_RULE = "APPROVAL_RULE"
    MASTER_DATA = "MASTER_DATA"
    NOTIFICATION = "NOTIFICATION"
    INTEGRATION = "INTEGRATION"
    FEATURE_FLAG = "FEATURE_FLAG"
    AUCTION = "AUCTION"
    TENANT_SETTING = "TENANT_SETTING"
    SESSION = "SESSION"

# PostgreSQL SQLAlchemy Enum objects
user_status_enum = PGENUM(UserStatus, name="user_status", create_type=False)
vendor_status_enum = PGENUM(VendorStatus, name="vendor_status", create_type=False)
pr_status_enum = PGENUM(PRStatus, name="pr_status", create_type=False)
pr_source_enum = PGENUM(PRSource, name="pr_source", create_type=False)
rfq_status_enum = PGENUM(RFQStatus, name="rfq_status", create_type=False)
rfq_type_enum = PGENUM(RFQType, name="rfq_type", create_type=False)
sourcing_type_enum = PGENUM(SourcingType, name="sourcing_type", create_type=False)
evaluation_type_enum = PGENUM(EvaluationType, name="evaluation_type", create_type=False)
bid_status_enum = PGENUM(BidStatus, name="bid_status", create_type=False)
approval_task_status_enum = PGENUM(ApprovalTaskStatus, name="approval_task_status", create_type=False)
contract_status_enum = PGENUM(ContractStatus, name="contract_status", create_type=False)
po_status_enum = PGENUM(POStatus, name="po_status", create_type=False)
invoice_status_enum = PGENUM(InvoiceStatus, name="invoice_status", create_type=False)
payment_status_enum = PGENUM(PaymentStatus, name="payment_status", create_type=False)
notification_channel_enum = PGENUM(NotificationChannel, name="notification_channel", create_type=False)
notification_status_enum = PGENUM(NotificationStatus, name="notification_status", create_type=False)
integration_job_status_enum = PGENUM(IntegrationJobStatus, name="integration_job_status", create_type=False)
document_category_enum = PGENUM(DocumentCategory, name="document_category", create_type=False)
procurement_type_enum = PGENUM(ProcurementType, name="procurement_type", create_type=False)
tax_type_enum = PGENUM(TaxType, name="tax_type", create_type=False)
unmapped_pr_status_enum = PGENUM(UnmappedPRStatus, name="unmapped_pr_status", create_type=False)
workflow_instance_status_enum = PGENUM(WorkflowInstanceStatus, name="workflow_instance_status", create_type=False)
task_action_enum = PGENUM(TaskAction, name="task_action", create_type=False)
audit_entity_type_enum = PGENUM(AuditEntityType, name="audit_entity_type", create_type=False)

# Upper case aliases for PG types
USER_STATUS_PG = user_status_enum
VENDOR_STATUS_PG = vendor_status_enum
PR_STATUS_PG = pr_status_enum
PR_SOURCE_PG = pr_source_enum
RFQ_STATUS_PG = rfq_status_enum
RFQ_TYPE_PG = rfq_type_enum
SOURCING_TYPE_PG = sourcing_type_enum
EVALUATION_TYPE_PG = evaluation_type_enum
BID_STATUS_PG = bid_status_enum
APPROVAL_TASK_STATUS_PG = approval_task_status_enum
CONTRACT_STATUS_PG = contract_status_enum
PO_STATUS_PG = po_status_enum
INVOICE_STATUS_PG = invoice_status_enum
PAYMENT_STATUS_PG = payment_status_enum
NOTIFICATION_CHANNEL_PG = notification_channel_enum
NOTIFICATION_STATUS_PG = notification_status_enum
INTEGRATION_JOB_STATUS_PG = integration_job_status_enum
DOCUMENT_CATEGORY_PG = document_category_enum
PROCUREMENT_TYPE_PG = procurement_type_enum
TAX_TYPE_PG = tax_type_enum
UNMAPPED_PR_STATUS_PG = unmapped_pr_status_enum
WORKFLOW_INSTANCE_STATUS_PG = workflow_instance_status_enum
TASK_ACTION_PG = task_action_enum
AUDIT_ENTITY_TYPE_PG = audit_entity_type_enum

# Enum class aliases
UserStatusEnum = UserStatus
VendorStatusEnum = VendorStatus
PRStatusEnum = PRStatus
PrStatusEnum = PRStatus
PRSourceEnum = PRSource
PrSourceEnum = PRSource
RFQStatusEnum = RFQStatus
RfqStatusEnum = RFQStatus
RFQTypeEnum = RFQType
RfqTypeEnum = RFQType
SourcingTypeEnum = SourcingType
EvaluationTypeEnum = EvaluationType
BidStatusEnum = BidStatus
ApprovalTaskStatusEnum = ApprovalTaskStatus
ContractStatusEnum = ContractStatus
POStatusEnum = POStatus
PoStatusEnum = POStatus
InvoiceStatusEnum = InvoiceStatus
PaymentStatusEnum = PaymentStatus
NotificationChannelEnum = NotificationChannel
NotificationStatusEnum = NotificationStatus
IntegrationJobStatusEnum = IntegrationJobStatus
DocumentCategoryEnum = DocumentCategory
ProcurementTypeEnum = ProcurementType
TaxTypeEnum = TaxType
UnmappedPRStatusEnum = UnmappedPRStatus
UnmappedPrStatusEnum = UnmappedPRStatus
WorkflowInstanceStatusEnum = WorkflowInstanceStatus
TaskActionEnum = TaskAction
AuditEntityTypeEnum = AuditEntityType

class BiddingMode(str, enum.Enum):
    SEALED = "SEALED"
    LIVE_AUCTION = "LIVE_AUCTION"
    HYBRID = "HYBRID"

BiddingModeEnum = BiddingMode
