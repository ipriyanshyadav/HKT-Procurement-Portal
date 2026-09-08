from __future__ import annotations
import asyncio
import os
import sys
from uuid import UUID
from loguru import logger
from sqlalchemy import select

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import async_session, engine
from app.db.enums import NotificationChannelEnum
from app.modules.organization.models import Organization
from app.modules.notification.models import NotificationTemplate

DEFAULT_ORG_ID = UUID("00000000-0000-0000-0000-000000000001")

TEMPLATES_DATA = [
    # 1. Vendor invited
    {
        "code": "vendor_invited",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Invitation to Register on HKT Procurement Portal",
        "body": "Dear {{vendor_name}},\n\nYou have been invited to register as an authorized vendor for {{org_name}}.\nPlease complete your registration at: {{registration_url}}",
        "variables": ["vendor_name", "org_name", "registration_url"],
    },
    {
        "code": "vendor_invited",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Vendor Invitation Sent",
        "body": "Vendor {{vendor_name}} was invited to register.",
        "variables": ["vendor_name"],
    },
    # 2. Vendor submitted
    {
        "code": "vendor_submitted",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Vendor Onboarding Submitted: {{vendor_name}}",
        "body": "Vendor {{vendor_name}} has submitted their qualification profile for review.\nPlease review the profile at: {{portal_url}}/vendors/{{vendor_id}}",
        "variables": ["vendor_name", "portal_url", "vendor_id"],
    },
    {
        "code": "vendor_submitted",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Vendor Profile Submitted",
        "body": "Vendor {{vendor_name}} submitted qualification documents for review.",
        "variables": ["vendor_name", "vendor_id"],
    },
    # 3. Vendor qualified
    {
        "code": "vendor_qualified",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Qualification Approved — Welcome to {{org_name}}",
        "body": "Dear {{vendor_name}},\n\nYour vendor registration has been approved. You are now qualified to participate in RFQs and sourcing events.",
        "variables": ["vendor_name", "org_name"],
    },
    {
        "code": "vendor_qualified",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Vendor Qualified",
        "body": "Vendor {{vendor_name}} qualification status is now APPROVED.",
        "variables": ["vendor_name", "vendor_id"],
    },
    # 4. Vendor rejected
    {
        "code": "vendor_rejected",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Vendor Qualification Status Update",
        "body": "Dear {{vendor_name}},\n\nWe regret to inform you that your registration application was not approved.\nReason: {{rejection_reason}}",
        "variables": ["vendor_name", "rejection_reason"],
    },
    # 5. Vendor resubmission
    {
        "code": "vendor_resubmission",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Action Required: Additional Information for Onboarding",
        "body": "Dear {{vendor_name}},\n\nAdditional information or documentation is required for your qualification review.\nNotes: {{review_notes}}\nUpdate profile: {{portal_url}}/profile",
        "variables": ["vendor_name", "review_notes", "portal_url"],
    },
    # 6. Vendor activated
    {
        "code": "vendor_activated",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Vendor Account Activated",
        "body": "Dear {{vendor_name}},\n\nYour account has been fully activated on {{org_name}} Procurement Portal.",
        "variables": ["vendor_name", "org_name"],
    },
    # 7. Vendor compliance warning
    {
        "code": "vendor_compliance_warning",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Compliance Warning: Certificate Expiry in {{days_remaining}} Days",
        "body": "Dear {{vendor_name}},\n\nYour document {{document_type}} will expire on {{expiry_date}}. Please upload renewed documents to avoid compliance hold.",
        "variables": ["vendor_name", "document_type", "expiry_date", "days_remaining"],
    },
    # 8. Vendor compliance hold
    {
        "code": "vendor_compliance_hold",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "URGENT: Vendor Account Placed on Compliance Hold",
        "body": "Vendor {{vendor_name}} has been placed on COMPLIANCE HOLD due to: {{hold_reason}}.\nParticipation in auctions and PO release is suspended.",
        "variables": ["vendor_name", "hold_reason"],
    },
    {
        "code": "vendor_compliance_hold",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Vendor Compliance Hold Active",
        "body": "Vendor {{vendor_name}} is placed on compliance hold.",
        "variables": ["vendor_name", "vendor_id"],
    },
    # 9. Vendor blacklisted
    {
        "code": "vendor_blacklisted",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Vendor Blacklist Notification",
        "body": "Vendor {{vendor_name}} has been blacklisted. Reason: {{blacklist_reason}}",
        "variables": ["vendor_name", "blacklist_reason"],
    },
    # 10. PR submitted
    {
        "code": "pr_submitted",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Action Required: Approve PR {{pr_number}}",
        "body": "Dear {{approver_name}},\n\nPR {{pr_number}} ({{pr_title}}) worth {{currency}} {{amount}} requires your approval.\nSubmitted by: {{requestor_name}}\nReview at: {{portal_url}}/approvals/{{task_id}}",
        "variables": ["approver_name", "pr_number", "pr_title", "currency", "amount", "requestor_name", "portal_url", "task_id"],
    },
    {
        "code": "pr_submitted",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "New PR Approval Request",
        "body": "PR {{pr_number}} submitted by {{requestor_name}} requires your approval.",
        "variables": ["pr_number", "requestor_name", "pr_id"],
    },
    # 11. PR approved
    {
        "code": "pr_approved",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Purchase Requisition Approved: {{pr_number}}",
        "body": "PR {{pr_number}} ({{pr_title}}) has been approved by {{approver_name}}.",
        "variables": ["pr_number", "pr_title", "approver_name"],
    },
    {
        "code": "pr_approved",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "PR Approved",
        "body": "PR {{pr_number}} was approved.",
        "variables": ["pr_number", "pr_id"],
    },
    # 12. PR rejected
    {
        "code": "pr_rejected",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Purchase Requisition Rejected: {{pr_number}}",
        "body": "Your PR {{pr_number}} was rejected by {{approver_name}}.\nReason: {{rejection_reason}}",
        "variables": ["pr_number", "approver_name", "rejection_reason"],
    },
    {
        "code": "pr_rejected",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "PR Rejected",
        "body": "PR {{pr_number}} was rejected: {{rejection_reason}}",
        "variables": ["pr_number", "pr_id", "rejection_reason"],
    },
    # 13. PR aging
    {
        "code": "pr_aging",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "PR Aging Alert",
        "body": "PR {{pr_number}} has been pending approval for {{days_pending}} days.",
        "variables": ["pr_number", "days_pending", "pr_id"],
    },
    # 14. PR merged
    {
        "code": "pr_merged",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "PR Consolidated",
        "body": "PR {{pr_number}} lines have been consolidated into RFQ {{rfq_number}}.",
        "variables": ["pr_number", "rfq_number"],
    },
    # 15. RFQ published
    {
        "code": "rfq_published",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Invitation to Bid: RFQ {{rfq_number}} - {{rfq_title}}",
        "body": "Dear {{vendor_name}},\n\nYou are invited to participate in RFQ {{rfq_number}} ({{rfq_title}}).\nBid Submission Deadline: {{bid_deadline}}\nSubmit your bid: {{portal_url}}/rfqs/{{rfq_id}}",
        "variables": ["vendor_name", "rfq_number", "rfq_title", "bid_deadline", "portal_url", "rfq_id"],
    },
    {
        "code": "rfq_published",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "New Tender Available",
        "body": "You are invited to bid on RFQ {{rfq_number}}.",
        "variables": ["rfq_number", "rfq_id"],
    },
    # 16. RFQ amended
    {
        "code": "rfq_amended",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Amendment Notice: RFQ {{rfq_number}}",
        "body": "RFQ {{rfq_number}} has been amended.\nSummary: {{amendment_summary}}\nRevised Deadline: {{bid_deadline}}",
        "variables": ["rfq_number", "amendment_summary", "bid_deadline"],
    },
    # 17. RFQ cancelled
    {
        "code": "rfq_cancelled",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Cancellation Notice: RFQ {{rfq_number}}",
        "body": "RFQ {{rfq_number}} has been cancelled. Reason: {{cancellation_reason}}",
        "variables": ["rfq_number", "cancellation_reason"],
    },
    # 18. RFQ bid deadline 4h reminder
    {
        "code": "rfq_bid_deadline_4h",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "URGENT: 4 Hours Left to Submit Bid on RFQ {{rfq_number}}",
        "body": "Dear {{vendor_name}},\n\nOnly 4 hours remain before the bid submission window closes for RFQ {{rfq_number}}.\nPlease finalize and seal your bid at: {{portal_url}}/rfqs/{{rfq_id}}",
        "variables": ["vendor_name", "rfq_number", "portal_url", "rfq_id"],
    },
    {
        "code": "rfq_bid_deadline_4h",
        "channel": NotificationChannelEnum.SMS,
        "subject": "Deadline Reminder",
        "body": "Urgent: 4 hours left to submit bid for RFQ {{rfq_number}}. Please submit via HKT Procurement Portal.",
        "variables": ["rfq_number"],
    },
    # 19. Bid submitted
    {
        "code": "bid_submitted",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Bid Submission Confirmation: {{bid_number}}",
        "body": "Your bid {{bid_number}} for RFQ {{rfq_number}} has been sealed and submitted successfully.",
        "variables": ["bid_number", "rfq_number"],
    },
    {
        "code": "bid_submitted",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Bid Submitted",
        "body": "Bid {{bid_number}} for RFQ {{rfq_number}} successfully received.",
        "variables": ["bid_number", "rfq_number"],
    },
    # 20. Bid opened
    {
        "code": "bid_opened",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Bids Unsealed",
        "body": "Bids for RFQ {{rfq_number}} have been unsealed. Commercial evaluation ready.",
        "variables": ["rfq_number", "rfq_id"],
    },
    # 21. Award winner
    {
        "code": "award_winner",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Letter of Intent / Award Notification: RFQ {{rfq_number}}",
        "body": "Congratulations {{vendor_name}},\n\nYour bid for RFQ {{rfq_number}} has been awarded for {{awarded_amount}} {{currency}}.\nOur procurement team will initiate contract finalization shortly.",
        "variables": ["vendor_name", "rfq_number", "awarded_amount", "currency"],
    },
    # 22. Award non-winner
    {
        "code": "award_non_winner",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Regret Letter: RFQ {{rfq_number}}",
        "body": "Dear {{vendor_name}},\n\nThank you for participating in RFQ {{rfq_number}}. We regret to inform you that your bid was not selected on this occasion.",
        "variables": ["vendor_name", "rfq_number"],
    },
    # 23. Approval task created
    {
        "code": "approval_task_created",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "New Task Assigned",
        "body": "Task: {{task_title}} assigned to you. Due by {{due_date}}.",
        "variables": ["task_title", "due_date", "task_id"],
    },
    # 24. Approval SLA escalation
    {
        "code": "approval_sla_escalation",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "CRITICAL SLA ESCALATION: Task {{task_title}}",
        "body": "Task {{task_title}} is overdue by {{overdue_hours}} hours. Escalated to {{escalation_target}}.",
        "variables": ["task_title", "overdue_hours", "escalation_target"],
    },
    {
        "code": "approval_sla_escalation",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "SLA Escalation Alert",
        "body": "Task {{task_title}} breached SLA threshold.",
        "variables": ["task_title", "task_id"],
    },
    # 25. PO released
    {
        "code": "po_released",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Purchase Order Released: {{po_number}}",
        "body": "Dear {{vendor_name}},\n\nPurchase Order {{po_number}} worth {{currency}} {{amount}} has been officially issued.\nPlease acknowledge receipt at: {{portal_url}}/purchase-orders/{{po_id}}",
        "variables": ["vendor_name", "po_number", "currency", "amount", "portal_url", "po_id"],
    },
    {
        "code": "po_released",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "New Purchase Order",
        "body": "PO {{po_number}} released for fulfillment.",
        "variables": ["po_number", "po_id"],
    },
    # 26. PO rejected supplier
    {
        "code": "po_rejected_supplier",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "URGENT: Purchase Order {{po_number}} Rejected by Supplier",
        "body": "Supplier {{vendor_name}} rejected PO {{po_number}}.\nReason: {{rejection_reason}}",
        "variables": ["vendor_name", "po_number", "rejection_reason"],
    },
    # 27. Invoice matched
    {
        "code": "invoice_matched",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Invoice 3-Way Match Passed",
        "body": "Invoice {{invoice_number}} successfully matched against PO {{po_number}} and GRN.",
        "variables": ["invoice_number", "po_number", "invoice_id"],
    },
    # 28. Invoice disputed
    {
        "code": "invoice_disputed",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Dispute Notice: Invoice {{invoice_number}}",
        "body": "Invoice {{invoice_number}} has discrepancies exceeding tolerance: {{dispute_reason}}.\nPlease review at: {{portal_url}}/invoices/{{invoice_id}}",
        "variables": ["invoice_number", "dispute_reason", "portal_url", "invoice_id"],
    },
    {
        "code": "invoice_disputed",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Invoice Disputed",
        "body": "Invoice {{invoice_number}} flagged with dispute: {{dispute_reason}}",
        "variables": ["invoice_number", "invoice_id", "dispute_reason"],
    },
    # 29. Payment completed
    {
        "code": "payment_completed",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Payment Advice: {{payment_reference}}",
        "body": "Payment of {{currency}} {{amount}} for Invoice {{invoice_number}} has been processed.\nUTR: {{utr_number}}",
        "variables": ["payment_reference", "currency", "amount", "invoice_number", "utr_number"],
    },
    {
        "code": "payment_completed",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Payment Processed",
        "body": "Payment {{payment_reference}} ({{currency}} {{amount}}) completed.",
        "variables": ["payment_reference", "amount", "currency"],
    },
    # 30. Contract expiry
    {
        "code": "contract_expiry",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Contract Expiry Notice",
        "body": "Contract {{contract_number}} with {{vendor_name}} expires in {{days_remaining}} days.",
        "variables": ["contract_number", "vendor_name", "days_remaining", "contract_id"],
    },
    # 31. Security alert
    {
        "code": "security_alert",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Security Alert: Account Lockout / Suspicious Activity",
        "body": "Account security notice for {{user_email}}.\nEvent: {{security_event}}\nTime: {{timestamp}}",
        "variables": ["user_email", "security_event", "timestamp"],
    },
    # 32. Unmapped PR SLA
    {
        "code": "unmapped_pr_sla",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Unmapped PR SLA Threshold Reached",
        "body": "Unmapped PR exception {{exception_id}} requires catalog mapping immediately.",
        "variables": ["exception_id"],
    },
    # 33. ERP sync failure
    {
        "code": "erp_sync_failure",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "ERP Sync Failure",
        "body": "Job {{job_id}} failed to sync with SAP/ERP: {{error_details}}",
        "variables": ["job_id", "error_details"],
    },
    # 34. Clarification published
    {
        "code": "clarification_published",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Clarification Published for RFQ {{rfq_number}}",
        "body": "Buyer answered question: '{{question_summary}}'",
        "variables": ["rfq_number", "question_summary", "rfq_id"],
    },
    # 35. Ticket Created
    {
        "code": "TICKET_CREATED_NOTIFICATION",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "New Ticket Created: {{ticket_number}} - {{title}}",
        "body": "Ticket {{ticket_number}} has been created with priority {{priority}}.\nTitle: {{title}}\nView ticket: {{portal_url}}/tickets/{{ticket_id}}",
        "variables": ["ticket_number", "title", "priority", "portal_url", "ticket_id"],
    },
    {
        "code": "TICKET_CREATED_NOTIFICATION",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "New Ticket Created",
        "body": "Ticket {{ticket_number}} ({{title}}) has been created.",
        "variables": ["ticket_number", "title", "ticket_id"],
    },
    # 36. Ticket Comment
    {
        "code": "TICKET_COMMENT_NOTIFICATION",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "New Comment on Ticket {{ticket_number}}",
        "body": "A new comment was added to ticket {{ticket_number}} by {{author_name}}:\n\n{{comment_preview}}\n\nView discussion: {{portal_url}}/tickets/{{ticket_id}}",
        "variables": ["ticket_number", "author_name", "comment_preview", "portal_url", "ticket_id"],
    },
    {
        "code": "TICKET_COMMENT_NOTIFICATION",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "New Comment on Ticket",
        "body": "New comment on ticket {{ticket_number}} by {{author_name}}.",
        "variables": ["ticket_number", "author_name", "ticket_id"],
    },
    # 37. Ticket Assigned
    {
        "code": "TICKET_ASSIGNED_NOTIFICATION",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Ticket Assigned: {{ticket_number}} - {{title}}",
        "body": "You have been assigned to ticket {{ticket_number}} ({{title}}).\nPriority: {{priority}}\nView ticket: {{portal_url}}/tickets/{{ticket_id}}",
        "variables": ["ticket_number", "title", "priority", "portal_url", "ticket_id"],
    },
    {
        "code": "TICKET_ASSIGNED_NOTIFICATION",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Ticket Assigned to You",
        "body": "Ticket {{ticket_number}} ({{title}}) assigned to you.",
        "variables": ["ticket_number", "title", "ticket_id"],
    },
    # 38. Ticket Resolved
    {
        "code": "TICKET_RESOLVED_NOTIFICATION",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Ticket Resolved: {{ticket_number}}",
        "body": "Ticket {{ticket_number}} has been marked as resolved.\nResolution note: {{resolution_notes}}\nIf unsatisfied, you may reopen it within 72 hours.",
        "variables": ["ticket_number", "resolution_notes", "ticket_id"],
    },
    {
        "code": "TICKET_RESOLVED_NOTIFICATION",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Ticket Resolved",
        "body": "Ticket {{ticket_number}} has been resolved.",
        "variables": ["ticket_number", "ticket_id"],
    },
    # 39. Ticket Reopened
    {
        "code": "TICKET_REOPENED_NOTIFICATION",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Ticket Reopened: {{ticket_number}}",
        "body": "Ticket {{ticket_number}} has been reopened.\nReason: {{reopen_reason}}\nView ticket: {{portal_url}}/tickets/{{ticket_id}}",
        "variables": ["ticket_number", "reopen_reason", "portal_url", "ticket_id"],
    },
    {
        "code": "TICKET_REOPENED_NOTIFICATION",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Ticket Reopened",
        "body": "Ticket {{ticket_number}} was reopened: {{reopen_reason}}.",
        "variables": ["ticket_number", "reopen_reason", "ticket_id"],
    },
    # 40. Ticket SLA Breach Alert
    {
        "code": "TICKET_SLA_BREACH_ALERT",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "URGENT: SLA Breach Warning for Ticket {{ticket_number}}",
        "body": "Ticket {{ticket_number}} has reached or is approaching its {{breach_type}} SLA threshold.\nCurrent status: {{status}}\nPlease respond immediately: {{portal_url}}/tickets/{{ticket_id}}",
        "variables": ["ticket_number", "breach_type", "status", "portal_url", "ticket_id"],
    },
    {
        "code": "TICKET_SLA_BREACH_ALERT",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Ticket SLA Alert",
        "body": "Ticket {{ticket_number}} has an SLA warning/breach ({{breach_type}}).",
        "variables": ["ticket_number", "breach_type", "ticket_id"],
    },
    # 41. Ticket Escalated
    {
        "code": "TICKET_ESCALATED_NOTIFICATION",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Ticket Escalated: {{ticket_number}}",
        "body": "Ticket {{ticket_number}} has been escalated.\nReason: {{escalation_reason}}\nView ticket: {{portal_url}}/tickets/{{ticket_id}}",
        "variables": ["ticket_number", "escalation_reason", "portal_url", "ticket_id"],
    },
    {
        "code": "TICKET_ESCALATED_NOTIFICATION",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Ticket Escalated",
        "body": "Ticket {{ticket_number}} was escalated: {{escalation_reason}}.",
        "variables": ["ticket_number", "escalation_reason", "ticket_id"],
    },
    # 42. Ticket Mention
    {
        "code": "TICKET_MENTION_NOTIFICATION",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "You were mentioned in Ticket {{ticket_number}}",
        "body": "You were mentioned in ticket {{ticket_number}} by {{author_name}}:\n\n{{comment_preview}}\n\nView comment: {{portal_url}}/tickets/{{ticket_id}}",
        "variables": ["ticket_number", "author_name", "comment_preview", "portal_url", "ticket_id"],
    },
    {
        "code": "TICKET_MENTION_NOTIFICATION",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Mentioned in Ticket",
        "body": "{{author_name}} mentioned you in ticket {{ticket_number}}.",
        "variables": ["ticket_number", "author_name", "ticket_id"],
    },
    # 43. Ticket Daily Digest
    {
        "code": "TICKET_DAILY_DIGEST",
        "channel": NotificationChannelEnum.EMAIL,
        "subject": "Ticket Daily Digest - {{digest_date}}",
        "body": "Here is your daily ticket summary:\n- Open Tickets: {{open_count}}\n- Pending Response: {{pending_count}}\n- SLA Breached: {{breached_count}}\n\nView all: {{portal_url}}/tickets",
        "variables": ["digest_date", "open_count", "pending_count", "breached_count", "portal_url"],
    },
    {
        "code": "TICKET_DAILY_DIGEST",
        "channel": NotificationChannelEnum.IN_APP,
        "subject": "Daily Ticket Summary",
        "body": "Open: {{open_count}}, Pending: {{pending_count}}, SLA Breached: {{breached_count}}.",
        "variables": ["open_count", "pending_count", "breached_count"],
    },
]

async def seed_templates():
    async with async_session() as db:
        org_ids = [DEFAULT_ORG_ID]
        total_inserted = 0
        total_updated = 0

        for org_id in org_ids:
            for tmpl in TEMPLATES_DATA:
                stmt = select(NotificationTemplate).where(
                    NotificationTemplate.org_id == org_id,
                    NotificationTemplate.template_code == tmpl["code"],
                    NotificationTemplate.channel == tmpl["channel"],
                    NotificationTemplate.language == "en",
                )
                res = await db.execute(stmt)
                existing = res.scalar_one_or_none()

                if existing:
                    existing.subject_template = tmpl.get("subject")
                    existing.body_template = tmpl["body"]
                    existing.variables = tmpl["variables"]
                    existing.is_active = True
                    total_updated += 1
                else:
                    record = NotificationTemplate(
                        org_id=org_id,
                        template_code=tmpl["code"],
                        channel=tmpl["channel"],
                        language="en",
                        subject_template=tmpl.get("subject"),
                        body_template=tmpl["body"],
                        variables=tmpl["variables"],
                        is_active=True,
                    )
                    db.add(record)
                    total_inserted += 1

        await db.commit()
        logger.info(
            f"Notification Templates Seed Complete: {total_inserted} inserted, {total_updated} updated across {len(org_ids)} org(s)."
        )
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed_templates())
