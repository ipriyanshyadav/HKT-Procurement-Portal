from __future__ import annotations
from uuid import UUID

DEFAULT_ORG_ID: UUID = UUID("00000000-0000-0000-0000-000000000001")

class RoleCode:
    # Internal Roles (12)
    REQUESTOR = "REQUESTOR"
    APPROVER = "APPROVER"
    BUYER = "BUYER"
    PROCUREMENT_OFFICER = "PROCUREMENT_OFFICER"
    PROCUREMENT_MANAGER = "PROCUREMENT_MANAGER"
    PROCUREMENT_HEAD = "PROCUREMENT_HEAD"
    FINANCE_CONTROLLER = "FINANCE_CONTROLLER"
    COMPLIANCE_OFFICER = "COMPLIANCE_OFFICER"
    VENDOR_ADMIN = "VENDOR_ADMIN"
    PROCUREMENT_ADMIN = "PROCUREMENT_ADMIN"
    SOURCING_MANAGER = "SOURCING_MANAGER"
    CFO = "CFO"
    # Supplier Roles (3)
    SUPPLIER = "SUPPLIER"
    SUPPLIER_ADMIN = "SUPPLIER_ADMIN"
    SUPPLIER_USER = "SUPPLIER_USER"
    # Admin Roles (2)
    SUPERADMIN = "SUPERADMIN"
    ORG_ADMIN = "ORG_ADMIN"

class AuditAction:
    # Auth (14)
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILURE = "LOGIN_FAILURE"
    TOKEN_REFRESH = "TOKEN_REFRESH"
    LOGOUT = "LOGOUT"
    MFA_ENABLED = "MFA_ENABLED"
    MFA_DISABLED = "MFA_DISABLED"
    PASSWORD_CHANGE = "PASSWORD_CHANGE"
    ACCOUNT_LOCKED = "ACCOUNT_LOCKED"
    ACCOUNT_UNLOCKED = "ACCOUNT_UNLOCKED"
    ROLE_ASSIGNED = "ROLE_ASSIGNED"
    ROLE_REMOVED = "ROLE_REMOVED"
    SESSION_REVOKED = "SESSION_REVOKED"
    SSO_LOGIN = "SSO_LOGIN"
    SCOPE_CHANGED = "SCOPE_CHANGED"

    # Vendor (8)
    INVITED = "INVITED"
    SUBMITTED = "SUBMITTED"
    QUALIFIED = "QUALIFIED"
    REJECTED = "REJECTED"
    ACTIVATED = "ACTIVATED"
    SUSPENDED = "SUSPENDED"
    REINSTATED = "REINSTATED"
    BLACKLISTED = "BLACKLISTED"

    # PR (6)
    CREATED = "CREATED"
    PR_SUBMITTED = "PR_SUBMITTED"
    APPROVED = "APPROVED"
    PR_REJECTED = "PR_REJECTED"
    CANCELLED = "CANCELLED"
    REVISED = "REVISED"

    # Unmapped PR (4)
    RECEIVED = "RECEIVED"
    MAPPED = "MAPPED"
    UNMAPPED_REJECTED = "UNMAPPED_REJECTED"
    ESCALATED = "ESCALATED"

    # RFQ (6)
    RFQ_CREATED = "RFQ_CREATED"
    PUBLISHED = "PUBLISHED"
    AMENDED = "AMENDED"
    CLOSED = "CLOSED"
    RFQ_CANCELLED = "RFQ_CANCELLED"
    EXTENDED = "EXTENDED"

    # Bid (6)
    BID_SUBMITTED = "BID_SUBMITTED"
    BID_REVISED = "BID_REVISED"
    WITHDRAWN = "WITHDRAWN"
    OPENED = "OPENED"
    EVALUATED = "EVALUATED"
    BID_REJECTED = "BID_REJECTED"

    # Evaluation (4)
    STARTED = "STARTED"
    COMPLETED = "COMPLETED"
    OVERRIDDEN = "OVERRIDDEN"
    COMMITTEE_ASSIGNED = "COMMITTEE_ASSIGNED"

    # Award (4)
    RECOMMENDED = "RECOMMENDED"
    AWARD_APPROVED = "AWARD_APPROVED"
    AWARD_REJECTED = "AWARD_REJECTED"
    SPLIT = "SPLIT"

    # Contract (6)
    CONTRACT_CREATED = "CONTRACT_CREATED"
    CONTRACT_ACTIVATED = "CONTRACT_ACTIVATED"
    CONTRACT_AMENDED = "CONTRACT_AMENDED"
    RENEWED = "RENEWED"
    EXPIRED = "EXPIRED"
    TERMINATED = "TERMINATED"

    # PO (6)
    PO_CREATED = "PO_CREATED"
    PO_APPROVED = "PO_APPROVED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    PO_AMENDED = "PO_AMENDED"
    PO_CANCELLED = "PO_CANCELLED"
    PO_CLOSED = "PO_CLOSED"

    # GRN (3)
    GRN_CREATED = "GRN_CREATED"
    GRN_APPROVED = "GRN_APPROVED"
    GRN_REJECTED = "GRN_REJECTED"

    # Invoice (5)
    INVOICE_SUBMITTED = "INVOICE_SUBMITTED"
    MATCHED = "MATCHED"
    INVOICE_APPROVED = "INVOICE_APPROVED"
    INVOICE_REJECTED = "INVOICE_REJECTED"
    PAID = "PAID"

    # Payment (4)
    INITIATED = "INITIATED"
    PAYMENT_APPROVED = "PAYMENT_APPROVED"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"

    # Notification (3)
    SENT = "SENT"
    READ = "READ"
    NOTIF_FAILED = "NOTIF_FAILED"

    # Document (4)
    UPLOADED = "UPLOADED"
    SCANNED = "SCANNED"
    DOC_APPROVED = "DOC_APPROVED"
    DELETED = "DELETED"

    # Workflow (4)
    WF_STARTED = "WF_STARTED"
    STEP_COMPLETED = "STEP_COMPLETED"
    STEP_REJECTED = "STEP_REJECTED"
    WF_COMPLETED = "WF_COMPLETED"

    # Integration (4)
    JOB_STARTED = "JOB_STARTED"
    JOB_COMPLETED = "JOB_COMPLETED"
    JOB_FAILED = "JOB_FAILED"
    WEBHOOK_RECEIVED = "WEBHOOK_RECEIVED"

    # Admin (4)
    SETTING_CHANGED = "SETTING_CHANGED"
    ROLE_MODIFIED = "ROLE_MODIFIED"
    PERMISSION_UPDATED = "PERMISSION_UPDATED"
    MAINTENANCE_TOGGLED = "MAINTENANCE_TOGGLED"

    # Organization (4)
    ORG_CREATED = "ORG_CREATED"
    ORG_UPDATED = "ORG_UPDATED"
    SETTINGS_CHANGED = "SETTINGS_CHANGED"
    LICENSE_UPDATED = "LICENSE_UPDATED"

    # Master Data (4)
    MD_CREATED = "MD_CREATED"
    MD_UPDATED = "MD_UPDATED"
    DEACTIVATED = "DEACTIVATED"
    IMPORTED = "IMPORTED"

class PermissionCode:
    # Organization (6)
    ORG_VIEW = "org.view"
    ORG_UPDATE = "org.update"
    ORG_MANAGE_SETTINGS = "org.manage_settings"
    ORG_MANAGE_LICENSE = "org.manage_license"
    ORG_VIEW_AUDIT = "org.view_audit"
    ORG_MANAGE_USERS = "org.manage_users"

    # User (8)
    USER_CREATE = "user.create"
    USER_VIEW_OWN = "user.view_own"
    USER_VIEW_ALL = "user.view_all"
    USER_UPDATE_OWN = "user.update_own"
    USER_UPDATE_ALL = "user.update_all"
    USER_DEACTIVATE = "user.deactivate"
    USER_ASSIGN_ROLE = "user.assign_role"
    USER_MANAGE_PERMISSIONS = "user.manage_permissions"

    # Master Data (6)
    MASTER_VIEW = "master.view"
    MASTER_CREATE = "master.create"
    MASTER_UPDATE = "master.update"
    MASTER_DELETE = "master.delete"
    MASTER_IMPORT = "master.import"
    MASTER_EXPORT = "master.export"

    # Vendor (12)
    VENDOR_INVITE = "vendor.invite"
    VENDOR_VIEW_OWN = "vendor.view_own"
    VENDOR_VIEW_ALL = "vendor.view_all"
    VENDOR_QUALIFY = "vendor.qualify"
    VENDOR_REJECT = "vendor.reject"
    VENDOR_ACTIVATE = "vendor.activate"
    VENDOR_SUSPEND = "vendor.suspend"
    VENDOR_REINSTATE = "vendor.reinstate"
    VENDOR_BLACKLIST_INITIATE = "vendor.blacklist_initiate"
    VENDOR_BLACKLIST_APPROVE = "vendor.blacklist_approve"
    VENDOR_UPDATE_COMPLIANCE = "vendor.update_compliance"
    VENDOR_MANAGE_CATEGORIES = "vendor.manage_categories"

    # PR (8)
    PR_CREATE = "pr.create"
    PR_VIEW_OWN = "pr.view_own"
    PR_VIEW_BU = "pr.view_bu"
    PR_VIEW_ALL = "pr.view_all"
    PR_SUBMIT = "pr.submit"
    PR_APPROVE = "pr.approve"
    PR_REJECT = "pr.reject"
    PR_CANCEL = "pr.cancel"

    # Unmapped PR (5)
    UNMAPPED_PR_VIEW = "unmapped_pr.view"
    UNMAPPED_PR_ASSIGN = "unmapped_pr.assign"
    UNMAPPED_PR_MAP = "unmapped_pr.map"
    UNMAPPED_PR_REJECT = "unmapped_pr.reject"
    UNMAPPED_PR_ESCALATE = "unmapped_pr.escalate"

    # RFQ (10)
    RFQ_CREATE = "rfq.create"
    RFQ_VIEW_OWN = "rfq.view_own"
    RFQ_VIEW_ALL = "rfq.view_all"
    RFQ_PUBLISH = "rfq.publish"
    RFQ_AMEND = "rfq.amend"
    RFQ_CANCEL = "rfq.cancel"
    RFQ_EXTEND = "rfq.extend"
    RFQ_CLOSE = "rfq.close"
    RFQ_MANAGE_COMMITTEE = "rfq.manage_committee"
    RFQ_VIEW_BIDS_BEFORE_OPENING = "rfq.view_bids_before_opening"

    # Bid (8)
    BID_SUBMIT = "bid.submit"
    BID_VIEW_OWN = "bid.view_own"
    BID_VIEW_ALL = "bid.view_all"
    BID_REVISE = "bid.revise"
    BID_WITHDRAW = "bid.withdraw"
    BID_OPEN = "bid.open"
    BID_CO_AUTHORIZE_OPENING = "bid.co_authorize_opening"
    BID_EVALUATE = "bid.evaluate"

    # Live Auction (4)
    LIVE_AUCTION_CREATE = "live_auction.create"
    LIVE_AUCTION_CANCEL = "live_auction.cancel"
    LIVE_AUCTION_MONITOR = "live_auction.monitor"
    LIVE_AUCTION_RELEASE_RESULTS = "live_auction.release_results"

    # Evaluation (5)
    EVAL_VIEW = "eval.view"
    EVAL_SCORE = "eval.score"
    EVAL_OVERRIDE = "eval.override"
    EVAL_SUBMIT_RECOMMENDATION = "eval.submit_recommendation"
    EVAL_VIEW_COMPARATIVE = "eval.view_comparative"

    # Award (4)
    AWARD_RECOMMEND = "award.recommend"
    AWARD_APPROVE = "award.approve"
    AWARD_REJECT = "award.reject"
    AWARD_SPLIT = "award.split"

    # Contract (8)
    CONTRACT_CREATE = "contract.create"
    CONTRACT_VIEW_OWN = "contract.view_own"
    CONTRACT_VIEW_ALL = "contract.view_all"
    CONTRACT_ACTIVATE = "contract.activate"
    CONTRACT_AMEND = "contract.amend"
    CONTRACT_RENEW = "contract.renew"
    CONTRACT_TERMINATE = "contract.terminate"
    CONTRACT_MANAGE_MILESTONES = "contract.manage_milestones"

    # PO (8)
    PO_CREATE = "po.create"
    PO_VIEW_OWN = "po.view_own"
    PO_VIEW_ALL = "po.view_all"
    PO_APPROVE = "po.approve"
    PO_ACKNOWLEDGE = "po.acknowledge"
    PO_AMEND = "po.amend"
    PO_CANCEL = "po.cancel"
    PO_CLOSE = "po.close"

    # GRN (5)
    GRN_CREATE = "grn.create"
    GRN_VIEW_OWN = "grn.view_own"
    GRN_VIEW_ALL = "grn.view_all"
    GRN_APPROVE = "grn.approve"
    GRN_REJECT = "grn.reject"

    # Invoice (6)
    INVOICE_SUBMIT = "invoice.submit"
    INVOICE_VIEW_OWN = "invoice.view_own"
    INVOICE_VIEW_ALL = "invoice.view_all"
    INVOICE_MATCH = "invoice.match"
    INVOICE_APPROVE = "invoice.approve"
    INVOICE_REJECT = "invoice.reject"

    # Payment (5)
    PAYMENT_INITIATE = "payment.initiate"
    PAYMENT_VIEW_OWN = "payment.view_own"
    PAYMENT_VIEW_ALL = "payment.view_all"
    PAYMENT_APPROVE = "payment.approve"
    PAYMENT_PROCESS = "payment.process"

    # Notification (4)
    NOTIFICATION_VIEW_OWN = "notification.view_own"
    NOTIFICATION_MANAGE_TEMPLATES = "notification.manage_templates"
    NOTIFICATION_MANAGE_CHANNELS = "notification.manage_channels"
    NOTIFICATION_SEND_MANUAL = "notification.send_manual"

    # Document (5)
    DOCUMENT_UPLOAD = "document.upload"
    DOCUMENT_VIEW_OWN = "document.view_own"
    DOCUMENT_VIEW_ALL = "document.view_all"
    DOCUMENT_DELETE = "document.delete"
    DOCUMENT_MANAGE_TEMPLATES = "document.manage_templates"

    # Workflow (5)
    WORKFLOW_VIEW = "workflow.view"
    WORKFLOW_CREATE = "workflow.create"
    WORKFLOW_UPDATE = "workflow.update"
    WORKFLOW_ACTIVATE = "workflow.activate"
    WORKFLOW_DEACTIVATE = "workflow.deactivate"

    # Approval Rules (5)
    RULES_VIEW = "rules.view"
    RULES_CREATE = "rules.create"
    RULES_UPDATE = "rules.update"
    RULES_DELETE = "rules.delete"
    RULES_TEST = "rules.test"

    # Integration (5)
    INTEGRATION_VIEW = "integration.view"
    INTEGRATION_CONFIGURE = "integration.configure"
    INTEGRATION_TRIGGER = "integration.trigger"
    INTEGRATION_VIEW_LOGS = "integration.view_logs"
    INTEGRATION_MANAGE_MAPPINGS = "integration.manage_mappings"

    # Analytics (4)
    ANALYTICS_VIEW_DASHBOARD = "analytics.view_dashboard"
    ANALYTICS_VIEW_REPORTS = "analytics.view_reports"
    ANALYTICS_EXPORT = "analytics.export"
    ANALYTICS_MANAGE_CUSTOM = "analytics.manage_custom"

    # Admin (6)
    ADMIN_VIEW_SETTINGS = "admin.view_settings"
    ADMIN_MANAGE_SETTINGS = "admin.manage_settings"
    ADMIN_VIEW_AUDIT_LOG = "admin.view_audit_log"
    ADMIN_MANAGE_ROLES = "admin.manage_roles"
    ADMIN_MANAGE_SYSTEM = "admin.manage_system"
    ADMIN_VIEW_HEALTH = "admin.view_health"

    # Ticket (12)
    TICKET_CREATE = "ticket.create"
    TICKET_VIEW_OWN = "ticket.view_own"
    TICKET_VIEW_TEAM = "ticket.view_team"
    TICKET_VIEW_ALL = "ticket.view_all"
    TICKET_ASSIGN = "ticket.assign"
    TICKET_RESOLVE = "ticket.resolve"
    TICKET_CLOSE = "ticket.close"
    TICKET_REOPEN = "ticket.reopen"
    TICKET_ADD_INTERNAL = "ticket.add_internal_note"
    TICKET_ESCALATE = "ticket.escalate"
    TICKET_CONFIG_SLA = "ticket.config_sla"
    TICKET_EXPORT = "ticket.export"

AUDIT_INSERT_ONLY = True
MAKER_CHECKER_ENFORCED = True
