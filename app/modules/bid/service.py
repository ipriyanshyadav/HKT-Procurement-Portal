from __future__ import annotations
import hashlib
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.constants import AuditAction
from app.core.encryption import encrypt_field, decrypt_field
from app.core.metrics import bid_submitted_total
from app.core.exceptions import AppException, ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.core.redis_client import get_redis_client
from app.db.enums import BidStatus, AuditEntityType
from app.events.publisher import OutboxPublisher
from app.modules.audit.service import audit_service
from app.modules.bid.fsm import validate_bid_transition
from app.modules.bid.models import BidResponse, BidLineResponse, BidVersion
from app.modules.bid.repository import bid_repository
from app.modules.bid.schemas import (
    BidSubmitRequest,
    BidReviseRequest,
    BidWithdrawRequest,
    BidDetailResponse,
    BidLineDetailResponse,
)
from app.modules.sourcing.models import Rfq
from app.modules.sourcing.repository import rfq_repository, rfq_participant_repository


class BidService:

    # ─── Submit Bid ─────────────────────────────────────────────────────────────

    async def submit_bid(
        self,
        db: AsyncSession,
        rfq_id: UUID,
        data: BidSubmitRequest,
        actor_id: UUID,
        vendor_id: UUID,
        org_id: UUID,
    ) -> BidResponse:
        rfq = await rfq_repository.get(db, rfq_id, org_id)
        if not rfq:
            raise NotFoundError(f"RFQ {rfq_id} not found")

        # Late bid rejection (SPEC_11 S11-13 / A-11-3)
        now = datetime.now(timezone.utc)
        if rfq.bid_close_at:
            close_at = rfq.bid_close_at
            if close_at.tzinfo is None:
                close_at = close_at.replace(tzinfo=timezone.utc)
            if now > close_at:
                await audit_service.log(
                    db, AuditEntityType.BID, rfq_id, "BID_LATE_REJECTED", actor_id, org_id,
                    new_values={
                        "vendor_id": str(vendor_id),
                        "submitted_at": now.isoformat(),
                        "deadline": close_at.isoformat(),
                    }
                )
                raise ConflictError(
                    "LATE_BID_REJECTED",
                    f"Bid deadline passed at {close_at.isoformat()}",
                )

        # Participant check (SPEC_11 S11-04)
        participant = await rfq_participant_repository.get_by_vendor(db, rfq_id, vendor_id, org_id)
        if not participant:
            raise ForbiddenError("NOT_INVITED", "Vendor is not invited to this RFQ")

        # Check for existing bid (revision flow)
        existing_bid = await bid_repository.get_by_vendor_and_rfq(db, rfq_id, vendor_id, org_id)
        if existing_bid:
            raise ConflictError(
                "BID_ALREADY_SUBMITTED",
                "Bid already submitted. Use revise_bid to submit a revision",
            )

        # Encrypt price fields before storage (SPEC_11 A-11-1 CRITICAL)
        encrypted_lines = []
        for line_data in data.lines:
            encrypted_lines.append(
                BidLineResponse(
                    org_id=org_id,
                    rfq_line_id=line_data.rfq_line_id,
                    lot_id=line_data.lot_id,
                    unit_price_encrypted=encrypt_field(str(line_data.unit_price)),
                    total_price_encrypted=encrypt_field(str(line_data.total_price)),
                    currency=line_data.currency,
                    quantity=line_data.quantity,
                    delivery_days=line_data.delivery_days,
                    tax_rate_declared=line_data.tax_rate_declared,
                    freight_quoted=line_data.freight_quoted,
                    country_of_origin=line_data.country_of_origin,
                    remarks=line_data.remarks,
                )
            )

        bid = BidResponse(
            org_id=org_id,
            rfq_id=rfq_id,
            vendor_id=vendor_id,
            status=BidStatus.SUBMITTED,
            current_version=1,
            has_deviations=data.has_deviations,
            deviation_details=data.deviation_details,
            technical_offer_compliant=data.technical_offer_compliant,
            payment_terms_code=data.payment_terms_code,
            delivery_terms_incoterm=data.delivery_terms_incoterm,
            bid_validity_days=data.bid_validity_days,
            covering_letter=data.covering_letter,
            submitted_at=now,
        )
        db.add(bid)
        await db.flush()

        for el in encrypted_lines:
            el.bid_id = bid.id
            db.add(el)

        # Create encrypted version snapshot (SPEC_11 A-11-2)
        snapshot_raw = data.model_dump_json()
        snapshot_hash = hashlib.sha256(snapshot_raw.encode()).hexdigest()
        version = BidVersion(
            org_id=org_id,
            bid_id=bid.id,
            version_number=1,
            snapshot_encrypted=encrypt_field(snapshot_raw),
            bid_hash=snapshot_hash,
        )
        db.add(version)

        # Update participant status
        participant.invitation_status = "BID_SUBMITTED"

        await OutboxPublisher.publish(
            db,
            "procurement.bid",
            "bid.submitted",
            {
                "bid_id": str(bid.id),
                "rfq_id": str(rfq_id),
                "org_id": str(org_id),
                "vendor_id": str(vendor_id),
            },
            org_id,
        )
        await audit_service.log(
            db, AuditEntityType.BID, bid.id, AuditAction.BID_SUBMITTED, actor_id, org_id
        )
        await db.flush()
        bid_submitted_total.labels(org_id=str(org_id)).inc()
        return bid

    # ─── Revise Bid ─────────────────────────────────────────────────────────────

    async def revise_bid(
        self,
        db: AsyncSession,
        rfq_id: UUID,
        data: BidReviseRequest,
        actor_id: UUID,
        vendor_id: UUID,
        org_id: UUID,
    ) -> BidResponse:
        rfq = await rfq_repository.get(db, rfq_id, org_id)
        if not rfq:
            raise NotFoundError(f"RFQ {rfq_id} not found")

        now = datetime.now(timezone.utc)
        if rfq.bid_close_at:
            close_at = rfq.bid_close_at
            if close_at.tzinfo is None:
                close_at = close_at.replace(tzinfo=timezone.utc)
            if now > close_at:
                raise ConflictError("LATE_BID_REJECTED", "Cannot revise bid after deadline")

        bid = await bid_repository.get_by_vendor_and_rfq(db, rfq_id, vendor_id, org_id)
        if not bid:
            raise NotFoundError("No existing bid found to revise")

        validate_bid_transition(bid.status, BidStatus.REOPENED)

        # Increment version and save new version snapshot
        bid.current_version += 1
        new_snapshot = data.model_dump_json()
        new_hash = hashlib.sha256(new_snapshot.encode()).hexdigest()
        version = BidVersion(
            org_id=org_id,
            bid_id=bid.id,
            version_number=bid.current_version,
            snapshot_encrypted=encrypt_field(new_snapshot),
            bid_hash=new_hash,
        )
        db.add(version)

        # Encrypt new line prices
        for line_data in data.lines:
            existing_line = next(
                (l for l in bid.lines if l.rfq_line_id == line_data.rfq_line_id), None
            )
            if existing_line:
                existing_line.unit_price_encrypted = encrypt_field(str(line_data.unit_price))
                existing_line.total_price_encrypted = encrypt_field(str(line_data.total_price))
                existing_line.currency = line_data.currency
                existing_line.quantity = line_data.quantity
                existing_line.delivery_days = line_data.delivery_days
                existing_line.remarks = line_data.remarks

        # Update bid metadata
        if data.has_deviations is not None:
            bid.has_deviations = data.has_deviations
        if data.deviation_details is not None:
            bid.deviation_details = data.deviation_details
        if data.technical_offer_compliant is not None:
            bid.technical_offer_compliant = data.technical_offer_compliant
        if data.payment_terms_code is not None:
            bid.payment_terms_code = data.payment_terms_code
        if data.delivery_terms_incoterm is not None:
            bid.delivery_terms_incoterm = data.delivery_terms_incoterm
        if data.bid_validity_days is not None:
            bid.bid_validity_days = data.bid_validity_days
        if data.covering_letter is not None:
            bid.covering_letter = data.covering_letter

        bid.status = BidStatus.SUBMITTED
        bid.submitted_at = now

        await db.flush()
        await audit_service.log(
            db, AuditEntityType.BID, bid.id, AuditAction.BID_REVISED, actor_id, org_id,
            new_values={"version": bid.current_version}
        )
        bid_submitted_total.labels(org_id=str(org_id)).inc()
        return bid

    # ─── Withdraw Bid ───────────────────────────────────────────────────────────

    async def withdraw_bid(
        self,
        db: AsyncSession,
        rfq_id: UUID,
        vendor_id: UUID,
        actor_id: UUID,
        org_id: UUID,
        data: Optional[BidWithdrawRequest] = None,
    ) -> BidResponse:
        rfq = await rfq_repository.get(db, rfq_id, org_id)
        if not rfq:
            raise NotFoundError(f"RFQ {rfq_id} not found")

        now = datetime.now(timezone.utc)
        if rfq.bid_close_at:
            close_at = rfq.bid_close_at
            if close_at.tzinfo is None:
                close_at = close_at.replace(tzinfo=timezone.utc)
            if now > close_at:
                raise ConflictError("DEADLINE_PASSED", "Cannot withdraw bid after submission deadline")

        bid = await bid_repository.get_by_vendor_and_rfq(db, rfq_id, vendor_id, org_id)
        if not bid:
            raise NotFoundError("No bid found to withdraw")

        validate_bid_transition(bid.status, BidStatus.WITHDRAWN)
        bid.status = BidStatus.WITHDRAWN

        participant = await rfq_participant_repository.get_by_vendor(db, rfq_id, vendor_id, org_id)
        if participant:
            participant.invitation_status = "REGRETTED"

        await db.flush()
        await audit_service.log(
            db, AuditEntityType.BID, bid.id, AuditAction.WITHDRAWN, actor_id, org_id
        )
        return bid

    # ─── Get Bid Details (with sealed enforcement) ───────────────────────────────

    async def get_bid_details(
        self,
        db: AsyncSession,
        bid_id: UUID,
        actor_id: UUID,
        org_id: UUID,
        actor_vendor_id: Optional[UUID] = None,
    ) -> BidDetailResponse:
        bid = await bid_repository.get(db, bid_id, org_id)
        if not bid:
            raise NotFoundError(f"Bid {bid_id} not found")

        rfq = await rfq_repository.get(db, bid.rfq_id, org_id)
        if not rfq:
            raise NotFoundError(f"Parent RFQ {bid.rfq_id} not found")

        # CRITICAL: sealed bid access control (SPEC_11 S11-12 / A-11-1)
        bids_are_open = rfq.bids_opened_at is not None

        # Non-owning actors cannot view bid content before opening
        if not bids_are_open:
            is_own_bid = actor_vendor_id is not None and bid.vendor_id == actor_vendor_id
            if not is_own_bid:
                raise ForbiddenError(
                    "BID_SEALED",
                    "Bid content is not accessible before bids are officially opened",
                )

        # Build line responses (decrypt only after opening)
        line_responses = []
        for line in bid.lines:
            unit_price = None
            total_price = None
            if bids_are_open and line.unit_price_encrypted:
                unit_price = Decimal(decrypt_field(line.unit_price_encrypted))
                total_price = Decimal(decrypt_field(line.total_price_encrypted)) if line.total_price_encrypted else None

            line_responses.append(
                BidLineDetailResponse(
                    id=line.id,
                    bid_id=line.bid_id,
                    rfq_line_id=line.rfq_line_id,
                    lot_id=line.lot_id,
                    currency=line.currency,
                    quantity=line.quantity,
                    delivery_days=line.delivery_days,
                    unit_price=unit_price,
                    total_price=total_price,
                    normalized_price_inr=line.normalized_price_inr,
                    exchange_rate_used=line.exchange_rate_used,
                    tax_rate_declared=line.tax_rate_declared,
                    freight_quoted=line.freight_quoted,
                    country_of_origin=line.country_of_origin,
                    remarks=line.remarks,
                )
            )

        return BidDetailResponse(
            id=bid.id,
            org_id=bid.org_id,
            rfq_id=bid.rfq_id,
            vendor_id=bid.vendor_id,
            status=bid.status.value if hasattr(bid.status, "value") else bid.status,
            current_version=bid.current_version,
            submitted_at=bid.submitted_at,
            has_deviations=bid.has_deviations,
            deviation_details=bid.deviation_details,
            technical_offer_compliant=bid.technical_offer_compliant,
            payment_terms_code=bid.payment_terms_code,
            delivery_terms_incoterm=bid.delivery_terms_incoterm,
            bid_validity_days=bid.bid_validity_days,
            covering_letter=bid.covering_letter,
            is_single_vendor_situation=bid.is_single_vendor_situation,
            bid_opened_at=bid.bid_opened_at,
            is_technically_qualified=bid.is_technically_qualified,
            technical_score=bid.technical_score,
            created_at=bid.created_at,
            updated_at=bid.updated_at,
            lines=line_responses,
        )

    # ─── Price Normalization ─────────────────────────────────────────────────────

    async def normalize_prices_on_opening(
        self, db: AsyncSession, rfq_id: UUID, org_id: UUID
    ) -> None:
        """
        Called when bids are opened. Converts all bid prices to INR. (SPEC_11 S11-16 / A-11-5)
        """
        redis = get_redis_client()
        bids = await bid_repository.get_all_for_rfq(db, rfq_id, org_id)

        for bid in bids:
            for line in bid.lines:
                if not line.unit_price_encrypted:
                    continue
                if line.currency == "INR":
                    unit_price = Decimal(decrypt_field(line.unit_price_encrypted))
                    line.normalized_price_inr = unit_price
                    line.exchange_rate_used = Decimal("1.0")
                else:
                    rate_key = f"exchange_rate:{line.currency}:INR"
                    rate_str = await redis.get(rate_key)
                    if not rate_str:
                        raise AppException(
                            "EXCHANGE_RATE_UNAVAILABLE",
                            f"Exchange rate {line.currency}→INR not cached in Redis",
                            status_code=503,
                        )
                    rate = Decimal(rate_str)
                    unit_price = Decimal(decrypt_field(line.unit_price_encrypted))
                    line.normalized_price_inr = unit_price * rate
                    line.exchange_rate_used = rate

            bid.bid_opened_at = datetime.now(timezone.utc)

        await db.flush()

    # ─── Single Vendor Check ─────────────────────────────────────────────────────

    async def check_single_vendor_situation(
        self, db: AsyncSession, rfq_id: UUID, org_id: UUID
    ) -> dict:
        """Check if only a single vendor has submitted (SPEC_11 S11-14 / A-11-4)."""
        bid_count = await bid_repository.count_submitted(db, rfq_id, org_id)
        is_single = bid_count == 1

        if is_single:
            bids = await bid_repository.get_all_for_rfq(db, rfq_id, org_id)
            for bid in bids:
                bid.is_single_vendor_situation = True
            await db.flush()

        return {
            "rfq_id": rfq_id,
            "is_single_vendor": is_single,
            "bid_count": bid_count,
            "requires_override": is_single,
        }

    # ─── Bid Count (sealed, no content) ─────────────────────────────────────────

    async def get_bid_count(
        self, db: AsyncSession, rfq_id: UUID, org_id: UUID
    ) -> dict:
        """Returns only bid count — NEVER content — before bids are opened. (SPEC_11 S11-11)"""
        rfq = await rfq_repository.get(db, rfq_id, org_id)
        if not rfq:
            raise NotFoundError(f"RFQ {rfq_id} not found")
        count = await bid_repository.count_submitted(db, rfq_id, org_id)
        return {
            "rfq_id": rfq_id,
            "bid_count": count,
            "bids_opened": rfq.bids_opened_at is not None,
            "bids_opened_at": rfq.bids_opened_at,
        }


bid_service = BidService()
