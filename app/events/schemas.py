from __future__ import annotations
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from uuid import UUID
from pydantic import BaseModel, Field

class BaseEvent(BaseModel):
    entity_id: Optional[UUID] = None
    org_id: UUID
    event_type: str = Field(...)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    actor_id: Optional[UUID] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

# Org
class OrgCreatedEvent(BaseEvent): event_type: str = "org.created"
class OrgUpdatedEvent(BaseEvent): event_type: str = "org.updated"

# User
class UserCreatedEvent(BaseEvent): event_type: str = "user.created"
class UserDeactivatedEvent(BaseEvent): event_type: str = "user.deactivated"
class UserRoleChangedEvent(BaseEvent): event_type: str = "user.role_changed"

# Vendor
class VendorInvitedEvent(BaseEvent):
    event_type: str = "vendor.invited"
    vendor_id: Optional[UUID] = None
    email: Optional[str] = None

    def model_post_init(self, __context: Any) -> None:
        if self.entity_id is None and self.vendor_id is not None:
            self.entity_id = self.vendor_id
        elif self.vendor_id is None and self.entity_id is not None:
            self.vendor_id = self.entity_id

class VendorSubmittedEvent(BaseEvent): event_type: str = "vendor.submitted"
class VendorQualifiedEvent(BaseEvent): event_type: str = "vendor.qualified"
class VendorRejectedEvent(BaseEvent): event_type: str = "vendor.rejected"
class VendorActivatedEvent(BaseEvent): event_type: str = "vendor.activated"
class VendorSuspendedEvent(BaseEvent): event_type: str = "vendor.suspended"
class VendorBlacklistedEvent(BaseEvent): event_type: str = "vendor.blacklisted"

# PR
class PRCreatedEvent(BaseEvent): event_type: str = "pr.created"
class PRSubmittedEvent(BaseEvent): event_type: str = "pr.submitted"
class PRApprovedEvent(BaseEvent): event_type: str = "pr.approved"
class PRRejectedEvent(BaseEvent): event_type: str = "pr.rejected"

# Unmapped PR
class UnmappedPRReceivedEvent(BaseEvent): event_type: str = "unmapped_pr.received"
class UnmappedPRMappedEvent(BaseEvent): event_type: str = "unmapped_pr.mapped"

# RFQ
class RFQCreatedEvent(BaseEvent): event_type: str = "rfq.created"
class RFQPublishedEvent(BaseEvent):
    event_type: str = "rfq.published"
    rfq_id: Optional[UUID] = None
    rfq_number: Optional[str] = None
    invited_vendor_count: int = 0

    def model_post_init(self, __context: Any) -> None:
        if self.entity_id is None and self.rfq_id is not None:
            self.entity_id = self.rfq_id
        elif self.rfq_id is None and self.entity_id is not None:
            self.rfq_id = self.entity_id

class RFQClosedEvent(BaseEvent): event_type: str = "rfq.closed"
class RFQCancelledEvent(BaseEvent): event_type: str = "rfq.cancelled"

# Bid
class BidSubmittedEvent(BaseEvent): event_type: str = "bid.submitted"
class BidOpenedEvent(BaseEvent): event_type: str = "bid.opened"
class BidEvaluatedEvent(BaseEvent): event_type: str = "bid.evaluated"

# Evaluation
class EvaluationCompletedEvent(BaseEvent): event_type: str = "evaluation.completed"

# Award
class AwardRecommendedEvent(BaseEvent): event_type: str = "award.recommended"
class AwardApprovedEvent(BaseEvent): event_type: str = "award.approved"

# Contract
class ContractCreatedEvent(BaseEvent): event_type: str = "contract.created"
class ContractActivatedEvent(BaseEvent): event_type: str = "contract.activated"
class ContractExpiredEvent(BaseEvent): event_type: str = "contract.expired"

# PO
class POCreatedEvent(BaseEvent): event_type: str = "po.created"
class POApprovedEvent(BaseEvent): event_type: str = "po.approved"
class POAcknowledgedEvent(BaseEvent): event_type: str = "po.acknowledged"

# GRN
class GRNCreatedEvent(BaseEvent): event_type: str = "grn.created"
class GRNApprovedEvent(BaseEvent): event_type: str = "grn.approved"

# Invoice
class InvoiceSubmittedEvent(BaseEvent): event_type: str = "invoice.submitted"
class InvoiceMatchedEvent(BaseEvent): event_type: str = "invoice.matched"
class InvoiceApprovedEvent(BaseEvent): event_type: str = "invoice.approved"

# Payment
class PaymentInitiatedEvent(BaseEvent): event_type: str = "payment.initiated"
class PaymentProcessedEvent(BaseEvent): event_type: str = "payment.processed"
class PaymentFailedEvent(BaseEvent): event_type: str = "payment.failed"

# Workflow
class WorkflowStartedEvent(BaseEvent): event_type: str = "workflow.started"
class WorkflowStepCompletedEvent(BaseEvent): event_type: str = "workflow.step_completed"
class WorkflowCompletedEvent(BaseEvent): event_type: str = "workflow.completed"

# Integration
class IntegrationJobCompletedEvent(BaseEvent): event_type: str = "integration.job_completed"
class IntegrationJobFailedEvent(BaseEvent): event_type: str = "integration.job_failed"
