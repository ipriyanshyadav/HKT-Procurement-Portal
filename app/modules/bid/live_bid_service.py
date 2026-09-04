from __future__ import annotations
import json
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, List, Any
from uuid import UUID
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import encrypt_field
from app.core.exceptions import AppException, ForbiddenError, NotFoundError, ValidationError
from app.core.redis_client import RedisKeys, get_redis_client
from app.db.enums import AuditEntityType, BiddingMode, RFQStatus, BidStatus
from app.events.publisher import OutboxPublisher
from app.modules.audit.service import audit_service
from app.modules.bid.auction_fsm import validate_auction_transition
from app.modules.bid.models import (
    LiveAuction,
    LiveBid,
    AuctionParticipant,
    AuctionRankSnapshot,
    BidResponse,
    BidLineResponse,
)
from app.modules.bid.live_bid_repository import LiveBidRepository
from app.modules.bid.schemas import AuctionConfig, AuctionCreateRequest
from app.modules.sourcing.models import Rfq, RfqLine
from app.modules.sourcing.repository import rfq_repository, rfq_participant_repository
from app.modules.vendor.repository import vendor_repository


class LiveBidService:
    def __init__(
        self,
        live_bid_repo: Optional[LiveBidRepository] = None,
        rfq_repo=None,
        participant_repo=None,
        vendor_repo=None,
        audit=None,
        publisher: Optional[OutboxPublisher] = None,
        redis_client=None,
    ):
        self.live_bid_repo = live_bid_repo or LiveBidRepository()
        self.repo = self.live_bid_repo
        self.rfq_repo = rfq_repo or rfq_repository
        self.participant_repo = participant_repo or rfq_participant_repository
        self.vendor_repo = vendor_repo or vendor_repository
        self.audit = audit or audit_service
        self.publisher = publisher or OutboxPublisher()
        self._redis = redis_client

    @property
    def redis(self):
        if self._redis is None:
            try:
                self._redis = get_redis_client()
            except Exception:
                self._redis = None
        return self._redis

    async def _fsm_validate(self, current: str, target: str) -> None:
        validate_auction_transition(current, target)

    async def create_auction(
        self, db: AsyncSession, data: AuctionCreateRequest, actor: Any, org_id: UUID
    ) -> LiveAuction:
        rfq = await self.rfq_repo.get(db, data.rfq_id, org_id)
        if not rfq:
            raise NotFoundError(f"RFQ {data.rfq_id} not found")

        mode_val = getattr(rfq, "bidding_mode", "SEALED")
        bidding_mode_str = mode_val.value if hasattr(mode_val, "value") else str(mode_val)
        if bidding_mode_str not in (BiddingMode.LIVE_AUCTION.value, BiddingMode.HYBRID.value, "LIVE_AUCTION", "HYBRID"):
            raise AppException("INVALID_BIDDING_MODE", "RFQ must be set to LIVE_AUCTION or HYBRID", 400)

        rfq_status_val = rfq.status.value if hasattr(rfq.status, "value") else str(rfq.status)
        valid_rfq_states = (RFQStatus.PUBLISHED.value, RFQStatus.BIDS_OPENED.value, RFQStatus.BID_OPEN.value, "PUBLISHED", "BIDS_OPENED", "BID_OPEN")
        if rfq_status_val not in valid_rfq_states:
            raise AppException("INVALID_RFQ_STATE", "RFQ must be PUBLISHED or BIDS_OPENED for HYBRID mode", 400)

        start_at = data.config.auction_start_at
        if start_at.tzinfo is None:
            start_at = start_at.replace(tzinfo=timezone.utc)
        close_at = start_at + timedelta(minutes=data.config.auction_duration_minutes)

        auction = LiveAuction(
            org_id=org_id,
            rfq_id=rfq.id,
            status="SCHEDULED",
            config=data.config.model_dump(mode="json"),
            scheduled_start_at=start_at,
            current_close_at=close_at,
            created_by=actor.id,
        )
        db.add(auction)
        await db.flush()

        # Update RFQ with auction config
        rfq.auction_config = data.config.model_dump(mode="json")

        # Admit all active RFQ participants into auction room
        participants = await self.participant_repo.get_all(db, rfq.id, org_id)
        for p in participants:
            db.add(
                AuctionParticipant(
                    org_id=org_id,
                    auction_id=auction.id,
                    vendor_id=p.vendor_id,
                )
            )

        await self.audit.log(db, AuditEntityType.AUCTION, auction.id, "AUCTION_CREATED", actor.id, org_id)
        await self.publisher.publish(
            db,
            "procurement.auction",
            "auction.created",
            {
                "auction_id": str(auction.id),
                "rfq_id": str(rfq.id),
                "start_at": start_at.isoformat(),
            },
            org_id,
        )
        return auction

    async def open_auction(self, db: AsyncSession, auction_id: UUID, org_id: UUID) -> LiveAuction:
        """Called by Celery beat task at scheduled_start_at or manually."""
        auction = await self.live_bid_repo.get(db, auction_id, org_id)
        if not auction:
            raise NotFoundError(f"Auction {auction_id} not found")

        await self._fsm_validate(auction.status, "OPEN")
        now = datetime.now(timezone.utc)
        auction.status = "OPEN"
        auction.actual_start_at = now
        await self.audit.log(db, AuditEntityType.AUCTION, auction_id, "AUCTION_OPENED", None, org_id)
        await self._broadcast(
            auction_id,
            org_id,
            {
                "type": "AUCTION_OPENED",
                "auction_id": str(auction_id),
                "ts": now.isoformat(),
                "payload": {"close_at": auction.current_close_at.isoformat()},
            },
        )
        return auction

    async def submit_live_bid(
        self,
        db: AsyncSession,
        auction_id: UUID,
        lot_id: Optional[UUID],
        bid_amount_inr: Decimal,
        actor: Any,
        org_id: UUID,
        is_proxy: bool = False,
        cascade_count: int = 0,
        client_ip: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> LiveBid:
        auction = await self.live_bid_repo.get(db, auction_id, org_id)
        if not auction:
            raise NotFoundError(f"Auction {auction_id} not found")

        # --- Guard 1: auction must be open ---
        if auction.status not in ("OPEN", "EXTENDED", "CLOSING"):
            raise AppException("AUCTION_NOT_OPEN", f"Auction status is {auction.status}", 400)

        # --- Guard 2: deadline (authoritative server time) ---
        now = datetime.now(timezone.utc)
        close_at = auction.current_close_at
        if close_at.tzinfo is None:
            close_at = close_at.replace(tzinfo=timezone.utc)
        if now > close_at:
            raise AppException("AUCTION_CLOSED", "Auction has already closed", 400)

        # --- Guard 3: participant eligibility ---
        vendor_id = getattr(actor, "vendor_id", None)
        if not vendor_id:
            raise ForbiddenError("NOT_PARTICIPANT", "User has no associated vendor")

        participant = await self.live_bid_repo.get_participant(db, auction_id, vendor_id, org_id)
        if not participant:
            raise ForbiddenError("NOT_PARTICIPANT", "Vendor not admitted to this auction")

        # --- Guard 4: minimum decrement ---
        current_best = await self.live_bid_repo.get_auction_best_bid(db, auction_id, lot_id, org_id)
        config = AuctionConfig(**auction.config)
        if current_best is not None:
            if config.min_decrement_type == "PERCENTAGE":
                min_allowed = current_best * (1 - Decimal(str(config.min_decrement_value)) / 100)
            else:
                min_allowed = current_best - Decimal(str(config.min_decrement_value))

            if bid_amount_inr > min_allowed:
                await self.audit.log(
                    db,
                    AuditEntityType.AUCTION,
                    auction_id,
                    "BID_REJECTED_DECREMENT",
                    actor.id,
                    org_id,
                    new_values={"bid": str(bid_amount_inr), "min_allowed": str(min_allowed)},
                )
                raise ValidationError(
                    "DECREMENT_TOO_SMALL",
                    f"Bid must be ≤ {min_allowed:.2f} INR (min decrement not met)",
                )

        # --- Guard 5: reserve price (hidden from supplier) ---
        if config.reserve_price_inr is not None and bid_amount_inr > config.reserve_price_inr:
            seq = await self._next_sequence(db, auction_id)
            live_bid = LiveBid(
                org_id=org_id,
                auction_id=auction_id,
                rfq_id=auction.rfq_id,
                vendor_id=vendor_id,
                lot_id=lot_id,
                bid_amount_inr=bid_amount_inr,
                bid_sequence=seq,
                is_valid=False,
                invalidation_reason="ABOVE_RESERVE_PRICE",
                submitted_at=now,
                client_ip=client_ip,
                session_id=session_id,
            )
            db.add(live_bid)
            await self.audit.log(
                db,
                AuditEntityType.AUCTION,
                auction_id,
                "BID_REJECTED_ABOVE_RESERVE",
                actor.id,
                org_id,
                new_values={"bid": str(bid_amount_inr)},
            )
            # Send rejection only to this vendor; do NOT reveal reserve price
            await self._send_to_vendor(
                auction_id,
                vendor_id,
                {
                    "type": "BID_REJECTED",
                    "auction_id": str(auction_id),
                    "ts": now.isoformat(),
                    "payload": {"reason": "BID_NOT_COMPETITIVE"},
                },
            )
            return live_bid

        # --- Accept bid ---
        seq = await self._next_sequence(db, auction_id)
        live_bid = LiveBid(
            org_id=org_id,
            auction_id=auction_id,
            rfq_id=auction.rfq_id,
            vendor_id=vendor_id,
            lot_id=lot_id,
            bid_amount_inr=bid_amount_inr,
            bid_sequence=seq,
            is_valid=True,
            submitted_at=now,
            client_ip=client_ip,
            session_id=session_id,
        )
        db.add(live_bid)
        await db.flush()

        # --- Compute new ranks ---
        new_ranks = await self._compute_ranks(db, auction_id, lot_id, org_id)
        snapshot = AuctionRankSnapshot(
            org_id=org_id,
            auction_id=auction_id,
            snapshot_at=now,
            trigger_bid_id=live_bid.id,
            ranks=new_ranks,
        )
        db.add(snapshot)

        # --- Auto-extension check (anti-sniping) ---
        time_remaining = (close_at - now).total_seconds() / 60
        if (
            config.auto_extend
            and time_remaining <= config.auto_extend_trigger_minutes
            and auction.extension_count < config.max_extensions
        ):
            auction.current_close_at = close_at + timedelta(minutes=config.auto_extend_duration_minutes)
            auction.extension_count += 1
            auction.status = "EXTENDED"
            await self.audit.log(
                db,
                AuditEntityType.AUCTION,
                auction_id,
                "AUCTION_EXTENDED",
                None,
                org_id,
                new_values={
                    "new_close_at": auction.current_close_at.isoformat(),
                    "extension_count": auction.extension_count,
                },
            )
            await self._broadcast(
                auction_id,
                org_id,
                {
                    "type": "AUCTION_EXTENDED",
                    "auction_id": str(auction_id),
                    "ts": now.isoformat(),
                    "payload": {
                        "new_close_at": auction.current_close_at.isoformat(),
                        "extension_count": auction.extension_count,
                        "max_extensions": config.max_extensions,
                    },
                },
            )

        # --- Broadcast new bid event ---
        await self._broadcast_new_bid(auction, live_bid, new_ranks, config, now, org_id)
        await self.audit.log(
            db,
            AuditEntityType.AUCTION,
            auction_id,
            "BID_SUBMITTED",
            actor.id,
            org_id,
            new_values={"bid_id": str(live_bid.id), "amount_inr": str(bid_amount_inr), "sequence": seq},
        )

        # --- Proxy bidding trigger ---
        if config.allow_proxy_bid and not is_proxy:
            await self.execute_proxy_bids(
                db, auction_id, lot_id, live_bid, org_id, cascade_count=cascade_count
            )

        return live_bid

    async def close_auction(
        self,
        db: AsyncSession,
        auction_id: UUID,
        *args: Any,
        org_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> LiveAuction:
        """Called by Celery task when current_close_at is reached or admin closes."""
        actual_org_id = org_id
        if args and actual_org_id is None:
            if len(args) == 1:
                actual_org_id = args[0]
            elif len(args) >= 2:
                actual_org_id = args[1]
        auction = await self.live_bid_repo.get(db, auction_id, actual_org_id)
        if not auction:
            raise NotFoundError(f"Auction {auction_id} not found")

        await self._fsm_validate(auction.status, "CLOSED")
        auction.status = "CLOSED"

        final_ranks = await self._compute_final_ranks(db, auction_id, actual_org_id)
        if final_ranks:
            l1_vendor_id = UUID(final_ranks[0]["vendor_id"])
            auction.winner_vendor_id = l1_vendor_id
            best_bid = await self.live_bid_repo.get_best_for_vendor_lot(
                db, auction.id, l1_vendor_id, None, actual_org_id
            )
            if best_bid:
                auction.winning_bid_id = best_bid.id

        # Persist winning bids as bid_line_responses for downstream CS generation (SPEC_12 bridge)
        await self._persist_winning_bids_to_sealed_table(db, auction, final_ranks, actual_org_id)

        now = datetime.now(timezone.utc)
        await self._broadcast(
            auction_id,
            actual_org_id,
            {
                "type": "AUCTION_CLOSED",
                "auction_id": str(auction_id),
                "ts": now.isoformat(),
                "payload": {"winner_vendor_id": str(auction.winner_vendor_id) if auction.winner_vendor_id else None},
            },
        )
        await self.audit.log(
            db,
            AuditEntityType.AUCTION,
            auction_id,
            "AUCTION_CLOSED",
            None,
            actual_org_id,
            new_values={"winner_vendor_id": str(auction.winner_vendor_id) if auction.winner_vendor_id else None},
        )
        await self.publisher.publish(
            db,
            "procurement.auction",
            "auction.closed",
            {"auction_id": str(auction_id), "rfq_id": str(auction.rfq_id)},
            actual_org_id,
        )
        return auction

    async def release_results(
        self, db: AsyncSession, auction_id: UUID, actor: Any, org_id: UUID
    ) -> LiveAuction:
        auction = await self.live_bid_repo.get(db, auction_id, org_id)
        if not auction:
            raise NotFoundError(f"Auction {auction_id} not found")

        await self._fsm_validate(auction.status, "RESULTS_RELEASED")
        auction.status = "RESULTS_RELEASED"
        final_ranks = await self._compute_final_ranks(db, auction_id, org_id)

        for rank_entry in final_ranks:
            await self.publisher.publish(
                db,
                "procurement.notification",
                "notification.email.auction_result",
                {
                    "vendor_id": str(rank_entry["vendor_id"]),
                    "rank": rank_entry["rank"],
                    "rfq_id": str(auction.rfq_id),
                    "template_code": "AUCTION_RESULT_VENDOR",
                    "org_id": str(org_id),
                },
                org_id,
            )

        now = datetime.now(timezone.utc)
        await self._broadcast(
            auction_id,
            org_id,
            {
                "type": "RESULTS_RELEASED",
                "auction_id": str(auction_id),
                "ts": now.isoformat(),
                "payload": {"status": "RESULTS_RELEASED"},
            },
        )
        await self.audit.log(db, AuditEntityType.AUCTION, auction_id, "RESULTS_RELEASED", actor.id, org_id)
        return auction

    async def cancel_auction(
        self, db: AsyncSession, auction_id: UUID, reason: str, actor: Any, org_id: UUID
    ) -> LiveAuction:
        auction = await self.live_bid_repo.get(db, auction_id, org_id)
        if not auction:
            raise NotFoundError(f"Auction {auction_id} not found")

        await self._fsm_validate(auction.status, "CANCELLED")
        auction.status = "CANCELLED"
        now = datetime.now(timezone.utc)
        await self.audit.log(
            db,
            AuditEntityType.AUCTION,
            auction_id,
            "AUCTION_CANCELLED",
            actor.id,
            org_id,
            new_values={"reason": reason},
        )
        await self._broadcast(
            auction_id,
            org_id,
            {
                "type": "AUCTION_CANCELLED",
                "auction_id": str(auction_id),
                "ts": now.isoformat(),
                "payload": {"reason": reason},
            },
        )
        return auction

    async def send_closing_warning(self, db: AsyncSession, auction: LiveAuction, org_id: UUID):
        now = datetime.now(timezone.utc)
        await self.audit.log(
            db,
            AuditEntityType.AUCTION,
            auction.id,
            "AUCTION_CLOSING_WARNING",
            None,
            org_id,
            new_values={"closes_at": auction.current_close_at.isoformat()},
        )
        await self._broadcast(
            auction.id,
            org_id,
            {
                "type": "AUCTION_CLOSING",
                "auction_id": str(auction.id),
                "ts": now.isoformat(),
                "payload": {"closes_at": auction.current_close_at.isoformat()},
            },
        )

    async def set_proxy_floor(
        self,
        db: AsyncSession,
        auction_id: UUID,
        lot_id: Optional[UUID],
        floor_amount_inr: Decimal,
        actor: Any,
        org_id: UUID,
    ) -> AuctionParticipant:
        auction = await self.live_bid_repo.get(db, auction_id, org_id)
        if not auction:
            raise NotFoundError(f"Auction {auction_id} not found")

        vendor_id = getattr(actor, "vendor_id", None)
        if not vendor_id:
            raise ForbiddenError("NOT_A_VENDOR", "Only vendors can set proxy floor")

        participant = await self.live_bid_repo.get_participant(db, auction_id, vendor_id, org_id)
        if not participant:
            raise ForbiddenError("NOT_PARTICIPANT", "Vendor is not a participant in this auction")

        participant.proxy_floor_inr = floor_amount_inr
        await self.audit.log(
            db,
            AuditEntityType.AUCTION,
            auction_id,
            "PROXY_FLOOR_SET",
            actor.id,
            org_id,
            new_values={"floor_inr": str(floor_amount_inr)},
        )
        return participant

    async def execute_proxy_bids(
        self,
        db: AsyncSession,
        auction_id: UUID,
        lot_id: Optional[UUID],
        triggering_bid: LiveBid,
        org_id: UUID,
        cascade_count: int = 0,
    ):
        """
        Called after every new valid bid. Auto-bids on behalf of proxy participants who are no longer L1.
        Capped at 5 sequential auto-bids. If > 5, schedules Celery task.
        """
        if cascade_count >= 5:
            try:
                from app.tasks.celery_app import celery_app
                celery_app.send_task(
                    "tasks.execute_proxy_bids",
                    args=[str(auction_id), str(lot_id) if lot_id else None, str(triggering_bid.id), str(org_id), 0],
                )
            except Exception as e:
                logger.warning(f"Could not dispatch proxy celery task: {e}")
            return

        auction = await self.live_bid_repo.get(db, auction_id, org_id)
        if not auction:
            return
        config = AuctionConfig(**auction.config)
        if not config.allow_proxy_bid:
            return

        proxy_participants = await self.live_bid_repo.get_proxy_eligible(db, auction_id, org_id)
        for p in proxy_participants:
            if p.vendor_id == triggering_bid.vendor_id:
                continue
            if p.proxy_floor_inr is None:
                continue

            current_best = await self.live_bid_repo.get_auction_best_bid(db, auction_id, lot_id, org_id)
            if current_best is None:
                continue

            if config.min_decrement_type == "PERCENTAGE":
                auto_bid = current_best * (1 - Decimal(str(config.min_decrement_value)) / 100)
            else:
                auto_bid = current_best - Decimal(str(config.min_decrement_value))

            if auto_bid < p.proxy_floor_inr:
                # Floor breached; do not auto-bid
                continue

            class ProxyActor:
                def __init__(self, v_id: UUID, o_id: UUID):
                    self.id = v_id
                    self.vendor_id = v_id
                    self.org_id = o_id

            proxy_actor = ProxyActor(p.vendor_id, org_id)
            try:
                await self.submit_live_bid(
                    db,
                    auction_id,
                    lot_id,
                    auto_bid,
                    actor=proxy_actor,
                    org_id=org_id,
                    is_proxy=True,
                    cascade_count=cascade_count + 1,
                )
                await self.audit.log(
                    db,
                    AuditEntityType.AUCTION,
                    auction_id,
                    "PROXY_BID_EXECUTED",
                    p.vendor_id,
                    org_id,
                    new_values={"vendor_id": str(p.vendor_id), "amount_inr": str(auto_bid)},
                )
            except Exception as exc:
                logger.info(f"Proxy bid stopped: {exc}")

    async def get_leaderboard(
        self, db: AsyncSession, auction_id: UUID, actor: Any, org_id: UUID
    ) -> List[dict]:
        auction = await self.live_bid_repo.get(db, auction_id, org_id)
        if not auction:
            raise NotFoundError(f"Auction {auction_id} not found")
        if getattr(actor, "vendor_id", None):
            raise ForbiddenError("VENDOR_NOT_PERMITTED", "Vendors cannot view the full auction leaderboard")
        return await self._compute_ranks(db, auction_id, None, org_id)

    async def get_my_rank(
        self, db: AsyncSession, auction_id: UUID, actor: Any, org_id: UUID
    ) -> dict:
        auction = await self.live_bid_repo.get(db, auction_id, org_id)
        if not auction:
            raise NotFoundError(f"Auction {auction_id} not found")
        vendor_id = getattr(actor, "vendor_id", None)
        if not vendor_id:
            raise ForbiddenError("NOT_A_VENDOR", "User is not associated with a vendor")

        config = AuctionConfig(**auction.config)
        ranks = await self._compute_ranks(db, auction_id, None, org_id)
        vendor_entry = next((r for r in ranks if UUID(r["vendor_id"]) == vendor_id), None)
        l1_price = ranks[0]["bid_amount_inr"] if ranks else None

        res = {
            "auction_id": str(auction_id),
            "status": auction.status,
            "current_close_at": auction.current_close_at.isoformat(),
        }
        if config.rank_visibility == "NO_RANK":
            res["your_rank"] = None
            res["l1_price_inr"] = None
        else:
            res["your_rank"] = vendor_entry["rank"] if vendor_entry else None
            res["l1_price_inr"] = l1_price

        if vendor_entry:
            res["your_bid_inr"] = vendor_entry["bid_amount_inr"]
        return res

    async def get_bid_history(
        self, db: AsyncSession, auction_id: UUID, actor: Any, org_id: UUID
    ) -> List[LiveBid]:
        auction = await self.live_bid_repo.get(db, auction_id, org_id)
        if not auction:
            raise NotFoundError(f"Auction {auction_id} not found")
        return await self.live_bid_repo.get_bid_history(db, auction_id, org_id)

    async def _compute_ranks(
        self, db: AsyncSession, auction_id: UUID, lot_id: Optional[UUID], org_id: UUID
    ) -> List[dict]:
        """Get best (lowest) valid bid per vendor for this lot, sorted ascending."""
        best_bids = await self.live_bid_repo.get_best_per_vendor(db, auction_id, lot_id, org_id)
        ranks = []
        for idx, b in enumerate(best_bids):
            vendor = await self.vendor_repo.find_by_id(db, b.vendor_id, org_id)
            vendor_name = vendor.company_name if vendor else f"Vendor {idx + 1}"
            ranks.append({
                "rank": idx + 1,
                "vendor_id": str(b.vendor_id),
                "vendor_name": vendor_name,
                "bid_amount_inr": float(b.bid_amount_inr),
                "lot_id": str(b.lot_id) if b.lot_id else (str(lot_id) if lot_id else None),
                "submitted_at": b.submitted_at.isoformat() if b.submitted_at else datetime.now(timezone.utc).isoformat(),
            })
        return ranks

    async def _compute_final_ranks(self, db: AsyncSession, auction_id: UUID, org_id: UUID) -> List[dict]:
        return await self._compute_ranks(db, auction_id, None, org_id)

    async def _get_current_best_bid(
        self, db: AsyncSession, auction_id: UUID, lot_id: Optional[UUID], org_id: UUID
    ) -> Optional[Decimal]:
        return await self.live_bid_repo.get_auction_best_bid(db, auction_id, lot_id, org_id)

    async def _persist_winning_bids_to_sealed_table(
        self, db: AsyncSession, auction: LiveAuction, final_ranks: List[dict], org_id: UUID
    ):
        """
        Write winning live bids into bid_responses + bid_line_responses so SPEC_12 CS generation works unchanged.
        Sets normalized_price_inr = winning bid_amount_inr and exchange_rate_used = 1.0.
        """
        now = datetime.now(timezone.utc)
        for entry in final_ranks:
            v_id = UUID(entry["vendor_id"])
            best_bid = await self.live_bid_repo.get_best_for_vendor_lot(
                db, auction.id, v_id, None, org_id
            )
            if not best_bid:
                continue

            # Ensure BidResponse header exists
            stmt = select(BidResponse).where(
                BidResponse.rfq_id == auction.rfq_id,
                BidResponse.vendor_id == v_id,
                BidResponse.org_id == org_id,
                BidResponse.deleted_at.is_(None),
            )
            bid_resp = (await db.execute(stmt)).scalar_one_or_none()
            if not bid_resp:
                bid_resp = BidResponse(
                    org_id=org_id,
                    rfq_id=auction.rfq_id,
                    vendor_id=v_id,
                    status=BidStatus.OPENED.value,
                    bid_opened_at=now,
                    submitted_at=now,
                    total_amount=Decimal(str(best_bid.bid_amount_inr)),
                    is_single_vendor_situation=False,
                )
                db.add(bid_resp)
                await db.flush()
            else:
                bid_resp.status = BidStatus.OPENED.value
                bid_resp.bid_opened_at = now
                bid_resp.total_amount = Decimal(str(best_bid.bid_amount_inr))

            # Fetch lines for RFQ
            line_stmt = select(RfqLine).where(
                RfqLine.rfq_id == auction.rfq_id,
                RfqLine.deleted_at.is_(None),
            )
            rfq_lines = list((await db.execute(line_stmt)).scalars().all())

            if rfq_lines:
                for line in rfq_lines:
                    # Check if line response already exists
                    blr_stmt = select(BidLineResponse).where(
                        BidLineResponse.bid_id == bid_resp.id,
                        BidLineResponse.rfq_line_id == line.id,
                    )
                    existing_blr = (await db.execute(blr_stmt)).scalar_one_or_none()
                    if existing_blr:
                        existing_blr.normalized_price_inr = best_bid.bid_amount_inr
                        existing_blr.unit_price_encrypted = encrypt_field(str(best_bid.bid_amount_inr))
                        existing_blr.total_price_encrypted = encrypt_field(str(best_bid.bid_amount_inr * (line.quantity or Decimal("1.0"))))
                        existing_blr.exchange_rate_used = Decimal("1.0")
                        existing_blr.remarks = "source=LIVE_AUCTION"
                    else:
                        db.add(
                            BidLineResponse(
                                org_id=org_id,
                                bid_id=bid_resp.id,
                                rfq_line_id=line.id,
                                lot_id=best_bid.lot_id or line.lot_id,
                                unit_price_encrypted=encrypt_field(str(best_bid.bid_amount_inr)),
                                total_price_encrypted=encrypt_field(str(best_bid.bid_amount_inr * (line.quantity or Decimal("1.0")))),
                                normalized_price_inr=best_bid.bid_amount_inr,
                                exchange_rate_used=Decimal("1.0"),
                                currency="INR",
                                quantity=line.quantity or Decimal("1.0"),
                                delivery_days=0,
                                tax_rate_declared=Decimal("0.0"),
                                freight_quoted=Decimal("0.0"),
                                country_of_origin="IN",
                                remarks="source=LIVE_AUCTION",
                            )
                        )

    async def _broadcast(self, auction_id: UUID, org_id: UUID, message: dict):
        """Publish to Redis channel; WebSocket consumers fan out to connected clients."""
        channel = RedisKeys.auction_channel(auction_id)
        if self.redis is not None:
            try:
                await self.redis.publish(channel, json.dumps(message))
            except Exception as e:
                logger.warning(f"Failed to publish to redis {channel}: {e}")

    async def _send_to_vendor(self, auction_id: UUID, vendor_id: UUID, message: dict):
        """Publish to vendor-specific Redis channel."""
        channel = RedisKeys.auction_vendor_channel(auction_id, vendor_id)
        if self.redis is not None:
            try:
                await self.redis.publish(channel, json.dumps(message))
            except Exception as e:
                logger.warning(f"Failed to publish to redis {channel}: {e}")

    async def _broadcast_new_bid(
        self,
        auction: LiveAuction,
        live_bid: LiveBid,
        new_ranks: List[dict],
        config: AuctionConfig,
        now: datetime,
        org_id: UUID,
    ):
        l1_price = new_ranks[0]["bid_amount_inr"] if new_ranks else None
        vendor_rank = next(
            (r["rank"] for r in new_ranks if UUID(r["vendor_id"]) == live_bid.vendor_id),
            None,
        )

        # Buyer monitor gets full leaderboard
        await self._broadcast(
            auction.id,
            org_id,
            {
                "type": "LEADERBOARD_UPDATE",
                "auction_id": str(auction.id),
                "ts": now.isoformat(),
                "payload": {
                    "lot_id": str(live_bid.lot_id) if live_bid.lot_id else None,
                    "rankings": new_ranks,
                },
            },
        )

        # All participants get bid count + limited info (L1 omitted if rank_visibility == NO_RANK)
        public_payload = {
            "bid_sequence": live_bid.bid_sequence,
            "lot_id": str(live_bid.lot_id) if live_bid.lot_id else None,
            "total_bids": live_bid.bid_sequence,
        }
        if config.rank_visibility != "NO_RANK" and l1_price is not None:
            public_payload["l1_price_inr"] = float(l1_price)

        await self._broadcast(
            auction.id,
            org_id,
            {
                "type": "NEW_BID",
                "auction_id": str(auction.id),
                "ts": now.isoformat(),
                "payload": public_payload,
            },
        )

        # Submitting vendor gets their own price and rank
        vendor_payload = {
            "lot_id": str(live_bid.lot_id) if live_bid.lot_id else None,
            "your_bid_inr": float(live_bid.bid_amount_inr),
        }
        if config.rank_visibility != "NO_RANK":
            if vendor_rank is not None:
                vendor_payload["your_rank"] = vendor_rank
            if l1_price is not None:
                vendor_payload["l1_price_inr"] = float(l1_price)

        await self._send_to_vendor(
            auction.id,
            live_bid.vendor_id,
            {
                "type": "RANK_UPDATE",
                "auction_id": str(auction.id),
                "ts": now.isoformat(),
                "payload": vendor_payload,
            },
        )

    async def _next_sequence(self, db: AsyncSession, auction_id: UUID) -> int:
        return await self.live_bid_repo.next_sequence(self.redis, auction_id, db=db)


live_bid_service = LiveBidService()
