from __future__ import annotations
import hashlib
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from loguru import logger
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.constants import AuditAction, PermissionCode
from app.core.exceptions import AppException, ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.core.redis_client import RedisKeys, get_redis_client
from app.db.enums import RFQStatus, RFQType, AuditEntityType
from app.events.publisher import OutboxPublisher
from app.modules.audit.service import audit_service
from app.modules.requisition.models import Requisition
from app.modules.requisition.repository import requisition_repository
from app.modules.sourcing.fsm import validate_rfq_transition
from app.modules.sourcing.models import Rfq, RfqLot, RfqLine, RfqParticipant, RfqClarification, RfqAmendment
from app.modules.sourcing.repository import (
    rfq_repository,
    rfq_participant_repository,
    rfq_clarification_repository,
)
from app.modules.sourcing.schemas import (
    RfqCreateRequest,
    RfqUpdateRequest,
    AddParticipantsRequest,
    AmendRequest,
    CancelRequest,
    ExtendDeadlineRequest,
    ClarificationCreateRequest,
    ClarificationRespondRequest,
)


class RfqService:

    # ─── CRUD ──────────────────────────────────────────────────────────────────

    async def create(
        self,
        db: AsyncSession,
        data: RfqCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Rfq:
        # Validate source PR if provided (SPEC_10 S10-14)
        if data.source_pr_id:
            pr = await requisition_repository.get(db, data.source_pr_id, org_id)
            if not pr:
                raise NotFoundError(f"Source PR {data.source_pr_id} not found")
            if pr.status.value != "APPROVED":
                raise ValidationError(
                    "PR_NOT_APPROVED",
                    "Only APPROVED PRs can be converted to RFQ",
                )

        rfq_number = await self._generate_rfq_number(db, data.business_unit_id, org_id)

        rfq = Rfq(
            org_id=org_id,
            rfq_number=rfq_number,
            title=data.title,
            description=data.description,
            rfq_type=data.rfq_type,
            sourcing_type=data.sourcing_type,
            evaluation_type=data.evaluation_type,
            procurement_type=data.procurement_type,
            status=RFQStatus.DRAFT,
            buyer_id=actor_id,
            business_unit_id=data.business_unit_id,
            category_id=data.category_id,
            currency=data.currency,
            estimated_value=data.estimated_value,
            payment_term_id=data.payment_term_id,
            incoterm_id=data.incoterm_id,
            delivery_location_id=data.delivery_location_id,
            bid_close_at=data.bid_close_at,
            bid_open_at=data.bid_open_at,
            bid_validity_days=data.bid_validity_days,
            is_multi_lot=data.is_multi_lot,
            lot_participation_mode=data.lot_participation_mode,
            is_emergency=(data.rfq_type == RFQType.EMERGENCY.value),
            source_pr_id=data.source_pr_id,
            created_by=actor_id,
            updated_by=actor_id,
            linked_pr_ids=[data.source_pr_id] if data.source_pr_id else [],
        )

        await self._validate_bid_window(rfq)

        db.add(rfq)
        await db.flush()

        for idx, lot_data in enumerate(data.lots, 1):
            lot = RfqLot(
                org_id=org_id,
                rfq_id=rfq.id,
                lot_number=idx,
                title=lot_data.title,
                description=lot_data.description,
                estimated_value=lot_data.estimated_value,
                payment_term_override_id=lot_data.payment_term_override_id,
                incoterm_override_id=lot_data.incoterm_override_id,
            )
            db.add(lot)

        for line_data in data.lines:
            line = RfqLine(
                org_id=org_id,
                rfq_id=rfq.id,
                lot_id=line_data.lot_id,
                line_number=line_data.line_number,
                item_description=line_data.item_description,
                item_code=line_data.item_code,
                category_id=line_data.category_id,
                uom_id=line_data.uom_id,
                quantity=line_data.quantity,
                estimated_unit_price=line_data.estimated_unit_price,
                hsn_code=line_data.hsn_code,
                specifications=line_data.specifications,
                required_by_date=line_data.required_by_date,
                delivery_location_id=line_data.delivery_location_id,
            )
            db.add(line)

        await audit_service.log(
            db, AuditEntityType.RFQ, rfq.id, AuditAction.RFQ_CREATED, actor_id, org_id
        )
        return rfq

    async def get_by_id(self, db: AsyncSession, rfq_id: UUID, org_id: UUID) -> Rfq:
        rfq = await rfq_repository.get(db, rfq_id, org_id)
        if not rfq:
            raise NotFoundError(f"RFQ {rfq_id} not found")
        return rfq

    async def get_for_supplier(
        self,
        db: AsyncSession,
        rfq_id: UUID,
        org_id: UUID,
        vendor_id: UUID,
    ) -> Rfq:
        rfq = await rfq_repository.get(db, rfq_id, org_id)
        if not rfq:
            raise NotFoundError(f"RFQ {rfq_id} not found")
        unapproved = {
            RFQStatus.DRAFT.value,
            RFQStatus.PENDING_APPROVAL.value,
            RFQStatus.APPROVED.value,
            RFQStatus.COMPLIANCE_HOLD.value,
        }
        if rfq.status in unapproved:
            raise ForbiddenError("RFQ is not published")
        if rfq.rfq_type != RFQType.OPEN_TENDER.value:
            participant = await rfq_participant_repository.get_by_vendor(
                db, rfq_id=rfq_id, vendor_id=vendor_id, org_id=org_id
            )
            if not participant:
                raise ForbiddenError("You are not an invited participant for this RFQ")
        return rfq

    async def list_rfqs(
        self,
        db: AsyncSession,
        org_id: UUID,
        status: Optional[str] = None,
        rfq_type: Optional[str] = None,
        business_unit_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        buyer_id: Optional[UUID] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ):
        return await rfq_repository.list(
            db,
            org_id=org_id,
            status=status,
            rfq_type=rfq_type,
            business_unit_id=business_unit_id,
            category_id=category_id,
            buyer_id=buyer_id,
            search=search,
            skip=skip,
            limit=limit,
        )

    async def list_for_supplier(
        self,
        db: AsyncSession,
        org_id: UUID,
        vendor_id: UUID,
        status: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ):
        return await rfq_repository.list_for_supplier(
            db,
            org_id=org_id,
            vendor_id=vendor_id,
            status=status,
            search=search,
            skip=skip,
            limit=limit,
        )

    async def update(
        self,
        db: AsyncSession,
        rfq_id: UUID,
        data: RfqUpdateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Rfq:
        rfq = await self.get_by_id(db, rfq_id, org_id)
        if rfq.status not in (RFQStatus.DRAFT.value, RFQStatus.AMENDMENT_PENDING.value):
            raise AppException("RFQ_NOT_EDITABLE", "RFQ can only be edited in DRAFT or AMENDMENT_PENDING status")

        update_fields = data.model_dump(exclude_unset=True, exclude={"lots", "lines"})
        for field, value in update_fields.items():
            if hasattr(rfq, field) and value is not None:
                setattr(rfq, field, value)
        rfq.updated_by = actor_id

        await db.flush()
        await audit_service.log(
            db, AuditEntityType.RFQ, rfq_id, "RFQ_UPDATED", actor_id, org_id
        )
        return rfq

    # ─── Lifecycle ─────────────────────────────────────────────────────────────

    async def submit(self, db: AsyncSession, rfq_id: UUID, actor_id: UUID, org_id: UUID) -> Rfq:
        rfq = await self.get_by_id(db, rfq_id, org_id)
        validate_rfq_transition(rfq.status, RFQStatus.PENDING_APPROVAL)
        rfq.status = RFQStatus.PENDING_APPROVAL
        rfq.updated_by = actor_id
        await db.flush()
        await audit_service.log(
            db, AuditEntityType.RFQ, rfq_id, "RFQ_SUBMITTED", actor_id, org_id
        )
        return rfq

    async def publish(self, db: AsyncSession, rfq_id: UUID, actor_id: UUID, org_id: UUID) -> Rfq:
        rfq = await self.get_by_id(db, rfq_id, org_id)
        validate_rfq_transition(rfq.status, RFQStatus.PUBLISHED)

        # Validate participants for CLOSED/LIMITED (SPEC_10 S10-06)
        if rfq.rfq_type in (RFQType.LIMITED_TENDER.value,):
            participants = await rfq_participant_repository.get_all(db, rfq_id, org_id)
            if len(participants) < settings.MIN_CLOSED_RFQ_PARTICIPANTS:
                raise ValidationError(
                    "INSUFFICIENT_PARTICIPANTS",
                    f"Closed/Limited RFQ needs at least {settings.MIN_CLOSED_RFQ_PARTICIPANTS} participants",
                )

        await self._validate_bid_window(rfq)

        rfq.status = RFQStatus.PUBLISHED
        rfq.published_at = datetime.now(timezone.utc)
        rfq.updated_by = actor_id
        await db.flush()

        # Notify all participants (SPEC_10 S10-21)
        participants = await rfq_participant_repository.get_all(db, rfq_id, org_id)
        for participant in participants:
            await OutboxPublisher.publish(
                db,
                "procurement.notification",
                "notification.email.rfq_published",
                {
                    "vendor_id": str(participant.vendor_id),
                    "rfq_id": str(rfq.id),
                    "rfq_number": rfq.rfq_number,
                    "deadline": rfq.bid_close_at.isoformat() if rfq.bid_close_at else None,
                },
                org_id,
            )

        await audit_service.log(
            db, AuditEntityType.RFQ, rfq_id, AuditAction.PUBLISHED, actor_id, org_id
        )
        return rfq

    async def amend(
        self,
        db: AsyncSession,
        rfq_id: UUID,
        data: AmendRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Rfq:
        rfq = await self.get_by_id(db, rfq_id, org_id)
        if rfq.status not in (RFQStatus.PUBLISHED.value,):
            raise AppException("RFQ_NOT_AMENDABLE", "Only PUBLISHED RFQs can be formally amended")

        amendment = RfqAmendment(
            org_id=org_id,
            rfq_id=rfq_id,
            amendment_number=rfq.amendment_count + 1,
            changes_summary=data.changes_summary,
            field_changes=data.field_changes,
            previous_bid_close_at=rfq.bid_close_at,
            new_bid_close_at=data.new_bid_close_at,
            amended_by=actor_id,
        )
        db.add(amendment)

        # Extend deadline if new date provided (SPEC_10 S10-12)
        if data.new_bid_close_at:
            rfq.bid_close_at = data.new_bid_close_at

        rfq.amendment_count += 1
        rfq.status = RFQStatus.AMENDMENT_PENDING
        rfq.updated_by = actor_id
        await db.flush()

        # Notify all participants of amendment
        participants = await rfq_participant_repository.get_all(db, rfq_id, org_id)
        for participant in participants:
            await OutboxPublisher.publish(
                db,
                "procurement.notification",
                "notification.email.rfq_amended",
                {
                    "vendor_id": str(participant.vendor_id),
                    "rfq_id": str(rfq.id),
                    "rfq_number": rfq.rfq_number,
                    "amendment_number": rfq.amendment_count,
                    "summary": data.changes_summary,
                },
                org_id,
            )

        await audit_service.log(
            db, AuditEntityType.RFQ, rfq_id, AuditAction.AMENDED, actor_id, org_id
        )
        return rfq

    async def cancel(
        self,
        db: AsyncSession,
        rfq_id: UUID,
        data: CancelRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Rfq:
        rfq = await self.get_by_id(db, rfq_id, org_id)
        validate_rfq_transition(rfq.status, RFQStatus.CANCELLED)
        rfq.status = RFQStatus.CANCELLED
        rfq.cancelled_at = datetime.now(timezone.utc)
        rfq.cancel_reason = data.reason
        rfq.updated_by = actor_id
        await db.flush()

        # Notify participants of cancellation (SPEC_10 S10-13)
        participants = await rfq_participant_repository.get_all(db, rfq_id, org_id)
        for participant in participants:
            await OutboxPublisher.publish(
                db,
                "procurement.notification",
                "notification.email.rfq_cancelled",
                {
                    "vendor_id": str(participant.vendor_id),
                    "rfq_id": str(rfq.id),
                    "rfq_number": rfq.rfq_number,
                    "reason": data.reason,
                },
                org_id,
            )

        await audit_service.log(
            db, AuditEntityType.RFQ, rfq_id, AuditAction.RFQ_CANCELLED, actor_id, org_id
        )
        return rfq

    async def extend_deadline(
        self,
        db: AsyncSession,
        rfq_id: UUID,
        data: ExtendDeadlineRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Rfq:
        rfq = await self.get_by_id(db, rfq_id, org_id)
        if rfq.status not in (RFQStatus.PUBLISHED.value, RFQStatus.BID_OPEN.value, RFQStatus.AMENDMENT_PENDING.value):
            raise AppException("RFQ_NOT_EXTENDABLE", "Only PUBLISHED, BID_OPEN, or AMENDMENT_PENDING RFQs can have deadline extended")

        if data.new_bid_close_at <= datetime.now(timezone.utc):
            raise ValidationError("INVALID_DEADLINE", "New deadline must be in the future")

        old_deadline = rfq.bid_close_at
        rfq.bid_close_at = data.new_bid_close_at
        rfq.updated_by = actor_id
        await db.flush()

        await OutboxPublisher.publish(
            db,
            "procurement.rfq",
            "rfq.deadline.extended",
            {
                "rfq_id": str(rfq_id),
                "old_deadline": old_deadline.isoformat() if old_deadline else None,
                "new_deadline": data.new_bid_close_at.isoformat(),
                "reason": data.reason,
            },
            org_id,
        )

        await audit_service.log(
            db, AuditEntityType.RFQ, rfq_id, AuditAction.EXTENDED, actor_id, org_id
        )
        return rfq

    # ─── Participants ───────────────────────────────────────────────────────────

    async def add_participants(
        self,
        db: AsyncSession,
        rfq_id: UUID,
        data: AddParticipantsRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> List[RfqParticipant]:
        rfq = await self.get_by_id(db, rfq_id, org_id)
        if rfq.status not in (RFQStatus.DRAFT.value, RFQStatus.APPROVED.value, RFQStatus.PUBLISHED.value, RFQStatus.AMENDMENT_PENDING.value):
            raise AppException("RFQ_PARTICIPANTS_LOCKED", "Cannot add participants in current status")

        added = []
        for vendor_id in data.vendor_ids:
            existing = await rfq_participant_repository.get_by_vendor(db, rfq_id, vendor_id, org_id)
            if existing:
                continue

            participant = RfqParticipant(
                org_id=org_id,
                rfq_id=rfq_id,
                vendor_id=vendor_id,
                invitation_status="INVITED",
                invited_at=datetime.now(timezone.utc),
            )
            db.add(participant)
            added.append(participant)

        await db.flush()

        # Notify newly added vendors if RFQ already published
        if rfq.status == RFQStatus.PUBLISHED.value:
            for participant in added:
                await OutboxPublisher.publish(
                    db,
                    "procurement.notification",
                    "notification.email.rfq_published",
                    {
                        "vendor_id": str(participant.vendor_id),
                        "rfq_id": str(rfq.id),
                        "rfq_number": rfq.rfq_number,
                        "deadline": rfq.bid_close_at.isoformat() if rfq.bid_close_at else None,
                    },
                    org_id,
                )

        await audit_service.log(
            db, AuditEntityType.RFQ, rfq_id, "RFQ_PARTICIPANTS_ADDED", actor_id, org_id,
            new_values={"vendor_ids": [str(v) for v in data.vendor_ids]}
        )
        return added

    async def remove_participant(
        self,
        db: AsyncSession,
        rfq_id: UUID,
        vendor_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        rfq = await self.get_by_id(db, rfq_id, org_id)
        if rfq.status not in (RFQStatus.DRAFT.value,):
            raise AppException("RFQ_PARTICIPANTS_LOCKED", "Can only remove participants from DRAFT RFQs")

        participant = await rfq_participant_repository.get_by_vendor(db, rfq_id, vendor_id, org_id)
        if not participant:
            raise NotFoundError(f"Vendor {vendor_id} is not a participant of RFQ {rfq_id}")

        participant.deleted_at = datetime.now(timezone.utc)
        await db.flush()
        await audit_service.log(
            db, AuditEntityType.RFQ, rfq_id, "RFQ_PARTICIPANT_REMOVED", actor_id, org_id,
            new_values={"vendor_id": str(vendor_id)}
        )

    # ─── Dual-Auth Bid Opening ──────────────────────────────────────────────────

    async def initiate_bid_opening(
        self, db: AsyncSession, rfq_id: UUID, actor_id: UUID, org_id: UUID
    ) -> dict:
        """Step 1 of dual-authorization bid opening (SPEC_10 S10-07)."""
        rfq = await self.get_by_id(db, rfq_id, org_id)

        if rfq.status != RFQStatus.PUBLISHED.value:
            raise AppException("RFQ_NOT_PUBLISHED", "Only PUBLISHED RFQs can have bids opened")

        now = datetime.now(timezone.utc)
        if rfq.bid_close_at and now < rfq.bid_close_at:
            raise AppException(
                "BID_WINDOW_STILL_OPEN",
                f"Cannot open bids before deadline: {rfq.bid_close_at.isoformat()}",
            )

        # SPEC_10 A-10-2: initiator must NOT be the RFQ creator
        if rfq.created_by == actor_id:
            raise ForbiddenError(
                "OPENING_SELF_CREATED",
                "RFQ creator cannot initiate bid opening; a different authorized user must initiate",
            )

        rfq.bid_opening_initiated_by = actor_id
        rfq.bid_opening_initiated_at = now
        rfq.updated_by = actor_id
        await db.flush()

        await audit_service.log(
            db, AuditEntityType.RFQ, rfq_id, "BID_OPENING_INITIATED", actor_id, org_id
        )
        return {
            "message": "Bid opening initiated. Co-authorization required from a second authorized user.",
            "initiated_by": str(actor_id),
            "initiated_at": now.isoformat(),
        }

    async def co_authorize_bid_opening(
        self, db: AsyncSession, rfq_id: UUID, actor_id: UUID, org_id: UUID
    ) -> Rfq:
        """Step 2 of dual-authorization bid opening (SPEC_10 S10-07)."""
        rfq = await self.get_by_id(db, rfq_id, org_id)

        if rfq.bid_opening_initiated_by is None:
            raise AppException("OPENING_NOT_INITIATED", "Bid opening has not been initiated yet")

        # SPEC_10 A-10-2: co-authorizer must be different from initiator
        if rfq.bid_opening_initiated_by == actor_id:
            raise ForbiddenError(
                "SAME_USER_OPENING",
                "Co-authorizer must be a different user than the initiator",
            )

        validate_rfq_transition(rfq.status, RFQStatus.BID_OPEN)
        now = datetime.now(timezone.utc)
        rfq.status = RFQStatus.BID_OPEN
        rfq.bids_opened_at = now
        rfq.bids_opened_by = actor_id
        rfq.co_authorized_by = actor_id
        rfq.updated_by = actor_id
        await db.flush()

        await OutboxPublisher.publish(
            db,
            "procurement.rfq",
            "rfq.bids.opened",
            {
                "rfq_id": str(rfq_id),
                "opened_by": str(actor_id),
                "initiated_by": str(rfq.bid_opening_initiated_by),
                "opened_at": now.isoformat(),
            },
            org_id,
        )
        await audit_service.log(
            db, AuditEntityType.RFQ, rfq_id, "BID_OPENING_COAUTHORIZED", actor_id, org_id
        )
        return rfq

    # ─── Clarifications ─────────────────────────────────────────────────────────

    async def add_clarification(
        self,
        db: AsyncSession,
        rfq_id: UUID,
        data: ClarificationCreateRequest,
        actor_id: UUID,
        org_id: UUID,
        vendor_id: Optional[UUID] = None,
    ) -> RfqClarification:
        rfq = await self.get_by_id(db, rfq_id, org_id)
        if rfq.status not in (RFQStatus.PUBLISHED.value, RFQStatus.BID_OPEN.value):
            raise AppException(
                "RFQ_NOT_ACCEPTING_CLARIFICATIONS",
                "RFQ is not accepting clarifications in its current status",
            )

        clarification = RfqClarification(
            org_id=org_id,
            rfq_id=rfq_id,
            question=data.question,
            asked_by=actor_id,
            asked_by_vendor_id=vendor_id,
        )
        db.add(clarification)
        await db.flush()

        await audit_service.log(
            db, AuditEntityType.RFQ, rfq_id, "RFQ_CLARIFICATION_RECEIVED", actor_id, org_id
        )
        return clarification

    async def respond_to_clarification(
        self,
        db: AsyncSession,
        clarification_id: UUID,
        data: ClarificationRespondRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> RfqClarification:
        clarif = await rfq_clarification_repository.get(db, clarification_id, org_id)
        if not clarif:
            raise NotFoundError(f"Clarification {clarification_id} not found")

        clarif.answer = data.answer
        clarif.answered_by = actor_id
        clarif.answered_at = datetime.now(timezone.utc)

        if data.broadcast:
            clarif.is_published = True
            clarif.published_at = datetime.now(timezone.utc)
            # CRITICAL (SPEC_10 A-10-3): broadcast WITHOUT vendor identity
            participants = await rfq_participant_repository.get_all(db, clarif.rfq_id, org_id)
            for p in participants:
                await OutboxPublisher.publish(
                    db,
                    "procurement.notification",
                    "notification.email.clarification",
                    {
                        "rfq_id": str(clarif.rfq_id),
                        # question text only — NO vendor name or vendor_id of asker
                        "question": clarif.question,
                        "answer": data.answer,
                        "vendor_id": str(p.vendor_id),
                        "org_id": str(org_id),
                    },
                    org_id,
                )

        await db.flush()
        await audit_service.log(
            db, AuditEntityType.RFQ, clarif.rfq_id, "RFQ_CLARIFICATION_ANSWERED", actor_id, org_id
        )
        return clarif

    async def get_clarifications(
        self,
        db: AsyncSession,
        rfq_id: UUID,
        org_id: UUID,
        actor_vendor_id: Optional[UUID] = None,
    ) -> List[RfqClarification]:
        """
        Buyers see all clarifications. Vendors see only published ones,
        with asker identity masked (SPEC_10 A-10-3).
        """
        clarifications = await rfq_clarification_repository.get_all_for_rfq(db, rfq_id, org_id)
        if actor_vendor_id:
            # Vendor view: only published clarifications, anonymized
            published = [c for c in clarifications if c.is_published]
            for c in published:
                c.asked_by_vendor_id = None  # anonymize
            return published
        return clarifications

    # ─── Dashboard / Stats ─────────────────────────────────────────────────────

    async def get_dashboard(
        self, db: AsyncSession, rfq_id: UUID, org_id: UUID
    ) -> dict:
        from app.modules.bid.repository import bid_repository
        rfq = await self.get_by_id(db, rfq_id, org_id)
        participants = await rfq_participant_repository.get_all(db, rfq_id, org_id)
        clarifications = await rfq_clarification_repository.get_all_for_rfq(db, rfq_id, org_id)
        bid_count = await bid_repository.count_submitted(db, rfq_id, org_id)
        unanswered = [c for c in clarifications if c.answer is None]

        now = datetime.now(timezone.utc)
        days_to_deadline = None
        if rfq.bid_close_at:
            delta = rfq.bid_close_at - now
            days_to_deadline = max(0, delta.days)

        opening_step = 0
        if rfq.bid_opening_initiated_by:
            opening_step = 1
        if rfq.bids_opened_at:
            opening_step = 2

        return {
            "rfq_id": rfq_id,
            "status": rfq.status.value if hasattr(rfq.status, "value") else rfq.status,
            "bid_count": bid_count,
            "bids_opened": rfq.bids_opened_at is not None,
            "participant_count": len(participants),
            "clarification_count": len(clarifications),
            "unanswered_clarifications": len(unanswered),
            "bid_opening_step": opening_step,
            "days_to_deadline": days_to_deadline,
        }

    # ─── Private Helpers ────────────────────────────────────────────────────────

    async def _generate_rfq_number(
        self, db: AsyncSession, business_unit_id: UUID, org_id: UUID
    ) -> str:
        """Generate RFQ number: {BU_CODE}-RFQ-{YYYY}-{NNNNNN} (SPEC_10 A-10-5)."""
        from app.modules.organization.models import BusinessUnit
        bu_result = await db.execute(
            select(BusinessUnit.code).where(BusinessUnit.id == business_unit_id)
        )
        bu_code = bu_result.scalar_one_or_none() or "GEN"

        year = datetime.now(timezone.utc).year
        seq = await rfq_repository.next_sequence(db, org_id, year)
        return f"{bu_code}-RFQ-{year}-{seq:06d}"

    async def _validate_bid_window(self, rfq: Rfq) -> None:
        """Validate bid submission window (SPEC_10 S10-05)."""
        if not rfq.bid_close_at:
            return

        now = datetime.now(timezone.utc)
        bid_close = rfq.bid_close_at
        if bid_close.tzinfo is None:
            bid_close = bid_close.replace(tzinfo=timezone.utc)

        window_hours = (bid_close - now).total_seconds() / 3600
        is_emergency = (
            rfq.is_emergency
            or (hasattr(rfq.rfq_type, "value") and rfq.rfq_type.value == RFQType.EMERGENCY.value)
            or rfq.rfq_type == RFQType.EMERGENCY.value
        )
        min_hours = settings.EMERGENCY_BID_WINDOW_MIN_HOURS if is_emergency else settings.STANDARD_BID_WINDOW_MIN_HOURS

        if window_hours < min_hours:
            raise ValidationError(
                "BID_WINDOW_TOO_SHORT",
                f"Bid window must be at least {min_hours}h for {'emergency' if is_emergency else 'standard'} RFQ. "
                f"Got {window_hours:.1f}h",
            )

        validity = rfq.bid_validity_days
        if validity < settings.BID_VALIDITY_MIN_DAYS or validity > settings.BID_VALIDITY_MAX_DAYS:
            raise ValidationError(
                "INVALID_BID_VALIDITY",
                f"Bid validity must be {settings.BID_VALIDITY_MIN_DAYS}–{settings.BID_VALIDITY_MAX_DAYS} days",
            )


rfq_service = RfqService()
