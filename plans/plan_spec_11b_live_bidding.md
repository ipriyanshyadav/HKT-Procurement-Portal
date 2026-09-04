# IMPLEMENTATION PLAN — SPEC_11B: Live / Reverse Auction Bidding
**Module:** 11B | **Phase:** Core Extension | **Squad:** C
**Spec File:** SPEC_11B_LIVE_BIDDING.md | **Plan Date:** 2026-08-04
**Depends On:** SPEC_11 (bid management complete), SPEC_16 (WebSocket/notification infra up)

---

## SPEC COVERAGE MAP

| Req# | Section | Target | Status |
|---|---|---|---|
| S11B-01 | Auction lifecycle FSM (7 states) | bid/auction_fsm.py | PLANNED |
| S11B-02 | Auction config schema + RFQ bidding_mode field | bid/schemas.py + sourcing/models.py | PLANNED |
| S11B-03 | DB migration — 4 new tables + indexes | alembic/versions/0028_live_auction.py | PLANNED |
| S11B-04 | LiveBidService — create_auction | bid/live_bid_service.py | PLANNED |
| S11B-05 | LiveBidService — submit_live_bid (decrement + reserve + auto-extend) | bid/live_bid_service.py | PLANNED |
| S11B-06 | LiveBidService — close_auction + persist winning bids to bid_line_responses | bid/live_bid_service.py | PLANNED |
| S11B-07 | LiveBidService — release_results + vendor notifications | bid/live_bid_service.py | PLANNED |
| S11B-08 | Proxy bidding — set_proxy_floor + execute_proxy_bids | bid/live_bid_service.py | PLANNED |
| S11B-09 | WebSocket endpoint + Redis pub/sub fan-out | bid/auction_ws.py | PLANNED |
| S11B-10 | Rank computation (best bid per vendor per lot) | bid/live_bid_repository.py | PLANNED |
| S11B-11 | Auto-extension logic (anti-sniping) | bid/live_bid_service.py | PLANNED |
| S11B-12 | Celery tasks — open/close/warn/notify | tasks/auction.py | PLANNED |
| S11B-13 | HTTP router — 10 endpoints | bid/auction_router.py | PLANNED |
| S11B-14 | 12 audit events | bid/live_bid_service.py | PLANNED |
| S11B-15 | RedisKeys — auction channel patterns | core/redis_client.py | PLANNED |
| S11B-16 | SPEC_12 bridge — normalized_price_inr pre-set on close | bid/live_bid_service.py | PLANNED |
| S11B-17 | Frontend — AuctionRoom page (supplier portal) | supplier-portal/auction/[id]/page.tsx | PLANNED |
| S11B-18 | Frontend — AuctionMonitor page (buyer portal) | buyer-portal/auctions/[id]/monitor/page.tsx | PLANNED |
| S11B-19 | Frontend — useAuctionSocket hook | packages/hooks/useAuctionSocket.ts | PLANNED |
| S11B-20 | Frontend — BidEntryPanel component | packages/components/BidEntryPanel.tsx | PLANNED |
| S11B-21 | Frontend — PriceLeaderboard component | packages/components/PriceLeaderboard.tsx | PLANNED |
| S11B-22 | Frontend — AuctionCountdownTimer component | packages/components/AuctionCountdownTimer.tsx | PLANNED |

---

## ASSUMPTIONS LOG

| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-11B-1 | `rfq.bidding_mode` added as new TEXT column (ENUM: SEALED, LIVE_AUCTION, HYBRID) with default 'SEALED'; existing RFQs unaffected | SPEC_11B Section 1; must not break SPEC_11 sealed flow | LOW — default preserves existing behaviour | Squad C |
| A-11B-2 | Redis pub/sub used for WebSocket fan-out; channel key = `auction:{auction_id}:broadcast`; vendor-specific = `auction:{auction_id}:vendor:{vendor_id}`; TTL not set (cleaned up on CLOSED event) | SPEC_11B Section 5; reuses existing Redis infra from SPEC_16 notification WebSocket | LOW | Squad C |
| A-11B-3 | `live_bids` table is append-only — no UPDATEs; best bid per vendor computed via `SELECT DISTINCT ON (vendor_id) ORDER BY bid_amount_inr ASC` at query time; no materialized rank column | SPEC_11B Section 10; ranks are always live-computed to avoid staleness | MEDIUM — index on `(auction_id, vendor_id, bid_amount_inr)` required for performance | Squad C |
| A-11B-4 | Celery beat `close_due_auctions` runs every 10 seconds; race condition guard: `UPDATE live_auctions SET status='CLOSED' WHERE id=? AND status IN ('OPEN','EXTENDED','CLOSING') AND current_close_at <= now()` — atomic; if 0 rows updated, task is a no-op | SPEC_11B Section 9; prevents double-close | LOW | Squad C |
| A-11B-5 | Winning bids persisted via `_persist_winning_bids_to_sealed_table()` create new `bid_responses` + `bid_line_responses` rows with `source='LIVE_AUCTION'`; a `bid_response` header row is created per vendor even if they won only some lots; SPEC_12 CS generation reads these rows unchanged | SPEC_11B Section 12 bridge | MEDIUM — must test CS generation with LIVE_AUCTION source rows | Squad C |
| A-11B-6 | Reserve price stored encrypted using `encrypt_field()` in `live_auctions.config` JSONB; decrypted only in service layer; never sent to client in any WebSocket message | SPEC_11B Section 6; reserve price is hidden from suppliers | HIGH — price leakage risk same as SPEC_11 sealed bids | Squad C |
| A-11B-7 | Proxy bid execution is synchronous within `submit_live_bid()` transaction; if proxy chain would cause > 5 sequential auto-bids in one call, cap at 5 and schedule remainder as a Celery task `tasks.execute_proxy_bids` to avoid transaction timeout | Proxy cascades can be deep | MEDIUM | Squad C |
| A-11B-8 | `rank_visibility = RANK_ONLY` → suppliers see rank number and L1 price only (not other vendor names/prices); `PRICE_AND_RANK` → suppliers see full leaderboard minus vendor names; `NO_RANK` → suppliers see only their own bid confirmation; buyer monitor always sees full leaderboard regardless of setting | SPEC_11B Section 5.2 | LOW | Squad C |
| A-11B-9 | Auction WebSocket auth: JWT passed as `?token=` query param (same pattern as SPEC_16 notification WS); standard `get_current_user` dependency applied; vendor users validated against `auction_participants` table | SPEC_11B Section 5.1 | LOW | Squad C |
| A-11B-10 | `notify_auction_start_reminders` Celery task sends notification via outbox → notification module using template_code `AUCTION_START_REMINDER_60M` and `AUCTION_START_REMINDER_15M`; not a new channel, reuses SPEC_16 email channel | SPEC_11B Section 9 | LOW | Squad C |
| A-11B-11 | Live auction responses (`GET /auctions`, `GET /auctions/{id}`, `POST /auctions`) join RFQ details to expose `rfq_number` and `rfq_title`; frontend Buyer and Supplier portals render these fields prominently in list cards and auction terminal rooms instead of raw UUID slices | UX consistency between RFQ/Tender lists and Live Auctions | LOW — non-breaking additive fields | Squad C |

---

## STEP 2 — IMPLEMENT

### 2.1 `alembic/versions/0028_live_auction.py`

```python
"""live_auction tables

Revision ID: 0028
Revises: 0027
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET

def upgrade():
    # bidding_mode on rfqs
    op.execute("CREATE TYPE biddingmode AS ENUM ('SEALED', 'LIVE_AUCTION', 'HYBRID')")
    op.add_column('rfqs', sa.Column('bidding_mode', sa.Text(), nullable=False,
        server_default='SEALED'))
    op.add_column('rfqs', sa.Column('auction_config', JSONB(), nullable=True))

    op.create_table('live_auctions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', UUID(as_uuid=True), nullable=False),
        sa.Column('rfq_id', UUID(as_uuid=True), sa.ForeignKey('rfqs.id'), nullable=False),
        sa.Column('status', sa.Text(), nullable=False, server_default='SCHEDULED'),
        sa.Column('config', JSONB(), nullable=False),
        sa.Column('scheduled_start_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('actual_start_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('current_close_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('extension_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('winner_vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendors.id'), nullable=True),
        sa.Column('winning_bid_id', UUID(as_uuid=True), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
    )

    op.create_table('live_bids',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', UUID(as_uuid=True), nullable=False),
        sa.Column('auction_id', UUID(as_uuid=True), sa.ForeignKey('live_auctions.id'), nullable=False),
        sa.Column('rfq_id', UUID(as_uuid=True), sa.ForeignKey('rfqs.id'), nullable=False),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendors.id'), nullable=False),
        sa.Column('lot_id', UUID(as_uuid=True), sa.ForeignKey('rfq_lots.id'), nullable=True),
        sa.Column('bid_amount_inr', sa.Numeric(20, 4), nullable=False),
        sa.Column('bid_sequence', sa.Integer(), nullable=False),
        sa.Column('is_valid', sa.Boolean(), nullable=False, server_default='TRUE'),
        sa.Column('invalidation_reason', sa.Text(), nullable=True),
        sa.Column('submitted_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('client_ip', INET(), nullable=True),
        sa.Column('session_id', sa.Text(), nullable=True),
    )

    op.create_table('auction_rank_snapshots',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', UUID(as_uuid=True), nullable=False),
        sa.Column('auction_id', UUID(as_uuid=True), sa.ForeignKey('live_auctions.id'), nullable=False),
        sa.Column('snapshot_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('trigger_bid_id', UUID(as_uuid=True), sa.ForeignKey('live_bids.id'), nullable=True),
        sa.Column('ranks', JSONB(), nullable=False),
    )

    op.create_table('auction_participants',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', UUID(as_uuid=True), nullable=False),
        sa.Column('auction_id', UUID(as_uuid=True), sa.ForeignKey('live_auctions.id'), nullable=False),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendors.id'), nullable=False),
        sa.Column('joined_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('left_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('is_connected', sa.Boolean(), nullable=False, server_default='FALSE'),
        sa.Column('proxy_floor_inr', sa.Numeric(20, 4), nullable=True),
    )

    # Indexes
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_bids_auction_vendor ON live_bids(auction_id, vendor_id, bid_amount_inr ASC) WHERE is_valid = TRUE")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_bids_auction_sequence ON live_bids(auction_id, bid_sequence DESC)")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_auctions_status_close ON live_auctions(status, current_close_at) WHERE deleted_at IS NULL")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_auctions_start ON live_auctions(status, scheduled_start_at) WHERE deleted_at IS NULL")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auction_participants_lookup ON auction_participants(auction_id, vendor_id)")

def downgrade():
    op.drop_table('auction_participants')
    op.drop_table('auction_rank_snapshots')
    op.drop_table('live_bids')
    op.drop_table('live_auctions')
    op.drop_column('rfqs', 'auction_config')
    op.drop_column('rfqs', 'bidding_mode')
    op.execute("DROP TYPE IF EXISTS biddingmode")
```

---

### 2.2 `app/modules/bid/auction_fsm.py`

```python
AUCTION_FSM: dict[str, list[str]] = {
    "SCHEDULED":        ["OPEN", "CANCELLED"],
    "OPEN":             ["EXTENDED", "CLOSING", "CANCELLED"],
    "EXTENDED":         ["OPEN", "CLOSING", "CANCELLED"],
    "CLOSING":          ["CLOSED"],
    "CLOSED":           ["RESULTS_RELEASED"],
    "RESULTS_RELEASED": [],
    "CANCELLED":        [],
}

def validate_auction_transition(current: str, target: str) -> None:
    allowed = AUCTION_FSM.get(current, [])
    if target not in allowed:
        from app.core.exceptions import AppException
        raise AppException(
            "INVALID_AUCTION_STATE_TRANSITION",
            f"Cannot transition auction from {current} to {target}. Allowed: {allowed}",
            409,
        )
```

---

### 2.3 `app/modules/bid/models.py` — additions

```python
# Append to existing bid/models.py

class LiveAuction(BaseModel):
    __tablename__ = "live_auctions"

    rfq_id: Mapped[UUID] = mapped_column(ForeignKey("rfqs.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="SCHEDULED")
    config: Mapped[dict] = mapped_column(JSONB, nullable=False)
    scheduled_start_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    actual_start_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    current_close_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    extension_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    winner_vendor_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("vendors.id"))
    winning_bid_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True))
    created_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    bids: Mapped[list["LiveBid"]] = relationship("LiveBid", back_populates="auction", lazy="selectin")
    participants: Mapped[list["AuctionParticipant"]] = relationship("AuctionParticipant", back_populates="auction", lazy="selectin")


class LiveBid(Base):
    """Append-only. No updates after insert."""
    __tablename__ = "live_bids"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    auction_id: Mapped[UUID] = mapped_column(ForeignKey("live_auctions.id"), nullable=False)
    rfq_id: Mapped[UUID] = mapped_column(ForeignKey("rfqs.id"), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    lot_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("rfq_lots.id"))
    bid_amount_inr: Mapped[Decimal] = mapped_column(Numeric(20, 4), nullable=False)
    bid_sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    is_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    invalidation_reason: Mapped[Optional[str]] = mapped_column(Text)
    submitted_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)
    client_ip: Mapped[Optional[str]] = mapped_column(INET)
    session_id: Mapped[Optional[str]] = mapped_column(String(128))

    auction: Mapped["LiveAuction"] = relationship("LiveAuction", back_populates="bids")


class AuctionParticipant(Base):
    __tablename__ = "auction_participants"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    auction_id: Mapped[UUID] = mapped_column(ForeignKey("live_auctions.id"), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    joined_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    left_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    is_connected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    proxy_floor_inr: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 4))

    auction: Mapped["LiveAuction"] = relationship("LiveAuction", back_populates="participants")


class AuctionRankSnapshot(Base):
    __tablename__ = "auction_rank_snapshots"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    auction_id: Mapped[UUID] = mapped_column(ForeignKey("live_auctions.id"), nullable=False)
    snapshot_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)
    trigger_bid_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("live_bids.id"))
    ranks: Mapped[dict] = mapped_column(JSONB, nullable=False)
```

---

### 2.4 `app/core/redis_client.py` — RedisKeys additions

```python
# Add to existing RedisKeys class:

@staticmethod
def auction_channel(auction_id: UUID) -> str:
    return f"auction:{auction_id}:broadcast"

@staticmethod
def auction_vendor_channel(auction_id: UUID, vendor_id: UUID) -> str:
    return f"auction:{auction_id}:vendor:{vendor_id}"

@staticmethod
def auction_sequence(auction_id: UUID) -> str:
    """Redis counter for monotonic bid_sequence."""
    return f"auction:{auction_id}:seq"

@staticmethod
def auction_best_bid(auction_id: UUID, lot_id: Optional[UUID]) -> str:
    """Cached current best (L1) bid amount per lot."""
    lot_part = str(lot_id) if lot_id else "all"
    return f"auction:{auction_id}:best:{lot_part}"
```

---

### 2.5 `app/modules/bid/live_bid_repository.py`

```python
class LiveBidRepository:

    async def get_best_per_vendor(
        self, db: AsyncSession, auction_id: UUID, lot_id: Optional[UUID], org_id: UUID
    ) -> list[LiveBid]:
        """
        Returns the lowest valid bid per vendor for this auction+lot,
        ordered by bid_amount_inr ASC (L1 first).
        Uses DISTINCT ON for efficiency.
        """
        stmt = (
            select(LiveBid)
            .distinct(LiveBid.vendor_id)
            .where(
                LiveBid.auction_id == auction_id,
                LiveBid.org_id == org_id,
                LiveBid.is_valid == True,
                (LiveBid.lot_id == lot_id) if lot_id else True,
            )
            .order_by(LiveBid.vendor_id, LiveBid.bid_amount_inr.asc())
        )
        result = await db.execute(stmt)
        rows = result.scalars().all()
        # Re-sort by bid_amount_inr for ranking
        return sorted(rows, key=lambda b: b.bid_amount_inr)

    async def get_best_for_vendor_lot(
        self, db: AsyncSession, auction_id: UUID, vendor_id: UUID,
        lot_id: Optional[UUID], org_id: UUID
    ) -> Optional[LiveBid]:
        stmt = (
            select(LiveBid)
            .where(
                LiveBid.auction_id == auction_id,
                LiveBid.vendor_id == vendor_id,
                LiveBid.org_id == org_id,
                LiveBid.is_valid == True,
                (LiveBid.lot_id == lot_id) if lot_id else True,
            )
            .order_by(LiveBid.bid_amount_inr.asc())
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_auction_best_bid(
        self, db: AsyncSession, auction_id: UUID, lot_id: Optional[UUID], org_id: UUID
    ) -> Optional[Decimal]:
        """Returns current L1 price across all vendors for this lot."""
        stmt = (
            select(func.min(LiveBid.bid_amount_inr))
            .where(
                LiveBid.auction_id == auction_id,
                LiveBid.org_id == org_id,
                LiveBid.is_valid == True,
                (LiveBid.lot_id == lot_id) if lot_id else True,
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def next_sequence(self, redis, auction_id: UUID) -> int:
        """Atomic Redis INCR for monotonic bid_sequence. Falls back to DB count."""
        key = RedisKeys.auction_sequence(auction_id)
        seq = await redis.incr(key)
        return int(seq)

    async def count_submitted(self, db: AsyncSession, auction_id: UUID, org_id: UUID) -> int:
        stmt = select(func.count()).where(
            LiveBid.auction_id == auction_id,
            LiveBid.org_id == org_id,
            LiveBid.is_valid == True,
        )
        result = await db.execute(stmt)
        return result.scalar_one()

    async def get_proxy_eligible(
        self, db: AsyncSession, auction_id: UUID, org_id: UUID
    ) -> list[AuctionParticipant]:
        stmt = select(AuctionParticipant).where(
            AuctionParticipant.auction_id == auction_id,
            AuctionParticipant.org_id == org_id,
            AuctionParticipant.proxy_floor_inr.is_not(None),
        )
        result = await db.execute(stmt)
        return result.scalars().all()
```

---

### 2.6 `app/modules/bid/auction_ws.py`

```python
# app/modules/bid/auction_ws.py

import asyncio, json
from uuid import UUID
from fastapi import WebSocket, WebSocketDisconnect, Depends
from app.auth.dependencies import get_current_user_ws
from app.core.redis_client import RedisKeys, get_redis

class AuctionConnectionManager:
    """Manages per-auction WebSocket connections + Redis pub/sub subscription."""

    async def handle(self, websocket: WebSocket, auction_id: UUID, current_user, redis):
        await websocket.accept()
        channel = RedisKeys.auction_channel(auction_id)
        vendor_channel = RedisKeys.auction_vendor_channel(auction_id, current_user.vendor_id) \
            if current_user.vendor_id else None

        pubsub = redis.pubsub()
        channels_to_sub = [channel]
        if vendor_channel:
            channels_to_sub.append(vendor_channel)
        await pubsub.subscribe(*channels_to_sub)

        async def redis_listener():
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await websocket.send_text(message["data"])

        async def ws_receiver():
            async for raw in websocket.iter_text():
                try:
                    msg = json.loads(raw)
                    await self._handle_client_message(msg, auction_id, current_user, websocket)
                except Exception:
                    pass  # Malformed client message — silently drop

        listener_task = asyncio.create_task(redis_listener())
        try:
            await ws_receiver()
        except WebSocketDisconnect:
            pass
        finally:
            listener_task.cancel()
            await pubsub.unsubscribe(*channels_to_sub)

    async def _handle_client_message(self, msg: dict, auction_id: UUID, current_user, ws: WebSocket):
        from app.modules.bid.live_bid_service import LiveBidService
        from app.db.session import get_db_ctx
        msg_type = msg.get("type")
        if msg_type == "SUBMIT_BID":
            async with get_db_ctx() as db:
                svc = LiveBidService()
                try:
                    await svc.submit_live_bid(
                        db, auction_id,
                        lot_id=UUID(msg["lot_id"]) if msg.get("lot_id") else None,
                        bid_amount_inr=Decimal(str(msg["bid_amount_inr"])),
                        actor=current_user, org_id=current_user.org_id,
                    )
                    await db.commit()
                except Exception as e:
                    await ws.send_text(json.dumps({
                        "type": "BID_REJECTED", "auction_id": str(auction_id),
                        "ts": datetime.utcnow().isoformat(),
                        "payload": {"reason": str(e)},
                    }))
        elif msg_type == "PING":
            await ws.send_text(json.dumps({"type": "HEARTBEAT", "ts": datetime.utcnow().isoformat()}))


manager = AuctionConnectionManager()

# Route registered in main.py:
# app.add_api_websocket_route("/ws/auction/{auction_id}", auction_ws_endpoint)
async def auction_ws_endpoint(
    websocket: WebSocket,
    auction_id: UUID,
    current_user=Depends(get_current_user_ws),
    redis=Depends(get_redis),
):
    await manager.handle(websocket, auction_id, current_user, redis)
```

---

### 2.7 `app/modules/bid/auction_router.py`

```python
router = APIRouter(prefix="/auctions", tags=["live-auction"])

@router.post("", status_code=201)
async def create_auction(
    data: AuctionCreateRequest,
    current_user=Depends(require_permission(PermissionCode.LIVE_AUCTION_CREATE)),
    db=Depends(get_db),
):
    auction = await live_bid_service.create_auction(db, data, current_user, current_user.org_id)
    await db.commit()
    return created_response(auction)

@router.get("/{auction_id}")
async def get_auction(auction_id: UUID, current_user=Depends(get_current_user), db=Depends(get_db)):
    auction = await live_bid_service.repo.get(db, auction_id, current_user.org_id)
    return success_response(auction)

@router.post("/{auction_id}/cancel")
async def cancel_auction(
    auction_id: UUID, reason: str = Body(...),
    current_user=Depends(require_permission(PermissionCode.LIVE_AUCTION_CANCEL)),
    db=Depends(get_db),
):
    auction = await live_bid_service.cancel_auction(db, auction_id, reason, current_user, current_user.org_id)
    await db.commit()
    return success_response(auction)

@router.post("/{auction_id}/release-results")
async def release_results(
    auction_id: UUID,
    current_user=Depends(require_permission(PermissionCode.LIVE_AUCTION_RELEASE_RESULTS)),
    db=Depends(get_db),
):
    auction = await live_bid_service.release_results(db, auction_id, current_user, current_user.org_id)
    await db.commit()
    return success_response(auction)

@router.get("/{auction_id}/leaderboard")
async def get_leaderboard(
    auction_id: UUID,
    current_user=Depends(require_permission(PermissionCode.LIVE_AUCTION_MONITOR)),
    db=Depends(get_db),
):
    """Buyer-only: full leaderboard with prices and vendor names."""
    ranks = await live_bid_service.get_leaderboard(db, auction_id, current_user, current_user.org_id)
    return success_response(ranks)

@router.get("/{auction_id}/my-rank")
async def get_my_rank(auction_id: UUID, current_user=Depends(get_current_user), db=Depends(get_db)):
    """Vendor-only: own rank + L1 price (subject to rank_visibility config)."""
    rank_info = await live_bid_service.get_my_rank(db, auction_id, current_user, current_user.org_id)
    return success_response(rank_info)

@router.get("/{auction_id}/bids")
async def get_bid_history(
    auction_id: UUID,
    current_user=Depends(require_permission(PermissionCode.LIVE_AUCTION_MONITOR)),
    db=Depends(get_db),
):
    bids = await live_bid_service.get_bid_history(db, auction_id, current_user, current_user.org_id)
    return success_response(bids)

@router.post("/{auction_id}/proxy-floor")
async def set_proxy_floor(
    auction_id: UUID,
    lot_id: Optional[UUID] = Body(None),
    floor_amount_inr: Decimal = Body(...),
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    participant = await live_bid_service.set_proxy_floor(
        db, auction_id, lot_id, floor_amount_inr, current_user, current_user.org_id)
    await db.commit()
    return success_response(participant)
```

---

### 2.8 `app/tasks/auction.py`

```python
from app.tasks.celery_app import celery_app
from app.db.session import get_db_ctx
from app.modules.bid.live_bid_service import LiveBidService

@celery_app.task(name="tasks.open_scheduled_auctions", bind=True, max_retries=3)
def open_scheduled_auctions(self):
    """Runs every 30 seconds via Celery beat. Opens SCHEDULED auctions past start time."""
    import asyncio
    async def _run():
        async with get_db_ctx() as db:
            svc = LiveBidService()
            auctions = await svc.repo.get_due_to_open(db)
            for auction in auctions:
                try:
                    await svc.open_auction(db, auction.id, auction.org_id)
                    await db.commit()
                except Exception as exc:
                    await db.rollback()
    asyncio.run(_run())

@celery_app.task(name="tasks.close_due_auctions", bind=True, max_retries=3)
def close_due_auctions(self):
    """Runs every 10 seconds. Closes OPEN/EXTENDED/CLOSING auctions past current_close_at."""
    import asyncio
    async def _run():
        async with get_db_ctx() as db:
            svc = LiveBidService()
            # Atomic: UPDATE … WHERE status IN (…) AND current_close_at <= now()
            auctions = await svc.repo.get_due_to_close(db)
            for auction in auctions:
                try:
                    await svc.close_auction(db, auction.id, auction.org_id)
                    await db.commit()
                except Exception:
                    await db.rollback()
    asyncio.run(_run())

@celery_app.task(name="tasks.send_auction_closing_warning")
def send_auction_closing_warning():
    """Runs every 10 seconds. Broadcasts AUCTION_CLOSING for auctions within 30s of close."""
    import asyncio
    async def _run():
        async with get_db_ctx() as db:
            svc = LiveBidService()
            auctions = await svc.repo.get_closing_soon(db, seconds=30)
            for auction in auctions:
                await svc._broadcast(auction.id, auction.org_id, {
                    "type": "AUCTION_CLOSING",
                    "auction_id": str(auction.id),
                    "ts": datetime.utcnow().isoformat(),
                    "payload": {"closes_at": auction.current_close_at.isoformat()},
                })
    asyncio.run(_run())

@celery_app.task(name="tasks.notify_auction_start_reminders")
def notify_auction_start_reminders():
    """Runs every minute. Sends email+in-app alerts 60min and 15min before start."""
    import asyncio
    async def _run():
        from app.events.publisher import OutboxPublisher
        async with get_db_ctx() as db:
            svc = LiveBidService()
            publisher = OutboxPublisher()
            for minutes, template in [(60, "AUCTION_START_REMINDER_60M"), (15, "AUCTION_START_REMINDER_15M")]:
                auctions = await svc.repo.get_starting_in(db, minutes=minutes)
                for auction in auctions:
                    participants = await svc.participant_repo.get_active(db, auction.id, auction.org_id)
                    for p in participants:
                        await publisher.publish(
                            "procurement.notification", "notification.email.auction_reminder",
                            {"vendor_id": str(p.vendor_id), "auction_id": str(auction.id),
                             "template_code": template, "org_id": str(auction.org_id)}, auction.org_id)
            await db.commit()
    asyncio.run(_run())
```

---

### 2.9 Celery Beat Schedule additions (`app/tasks/celery_app.py`)

```python
# Add to existing beat_schedule dict:
"open-scheduled-auctions": {
    "task": "tasks.open_scheduled_auctions",
    "schedule": 30.0,  # every 30 seconds
},
"close-due-auctions": {
    "task": "tasks.close_due_auctions",
    "schedule": 10.0,  # every 10 seconds
},
"auction-closing-warning": {
    "task": "tasks.send_auction_closing_warning",
    "schedule": 10.0,
},
"auction-start-reminders": {
    "task": "tasks.notify_auction_start_reminders",
    "schedule": 60.0,
},
```

---

### 2.10 `app/core/constants.py` — new PermissionCodes

```python
# Add to PermissionCode class:
LIVE_AUCTION_CREATE          = "live_auction.create"
LIVE_AUCTION_CANCEL          = "live_auction.cancel"
LIVE_AUCTION_MONITOR         = "live_auction.monitor"
LIVE_AUCTION_RELEASE_RESULTS = "live_auction.release_results"
```

---

### 2.11 Frontend — `packages/hooks/useAuctionSocket.ts`

```typescript
import { useEffect, useRef, useCallback, useState } from "react";
import { useAuthStore } from "@/stores/authStore";

export type AuctionMessage = {
  type: string;
  auction_id: string;
  ts: string;
  payload: Record<string, unknown>;
};

export function useAuctionSocket(auctionId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const wsRef = useRef<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<AuctionMessage | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!auctionId || !token) return;
    const url = `${process.env.NEXT_PUBLIC_WS_URL}/ws/auction/${auctionId}?token=${token}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Exponential back-off reconnect (max 30s)
      setTimeout(() => {}, Math.min(1000 * 2 ** reconnectCount.current, 30000));
    };
    ws.onmessage = (e) => {
      try {
        const msg: AuctionMessage = JSON.parse(e.data);
        setLastMessage(msg);
      } catch {}
    };

    return () => ws.close();
  }, [auctionId, token]);

  const sendBid = useCallback((lotId: string | null, bidAmountInr: number) => {
    wsRef.current?.send(JSON.stringify({
      type: "SUBMIT_BID", lot_id: lotId, bid_amount_inr: bidAmountInr,
    }));
  }, []);

  const ping = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "PING" }));
  }, []);

  return { connected, lastMessage, sendBid, ping };
}
```

---

### 2.12 Frontend — `packages/components/AuctionCountdownTimer.tsx`

```typescript
"use client";
import { useEffect, useState } from "react";

export function AuctionCountdownTimer({
  closeAt, onExpired,
}: { closeAt: string; onExpired?: () => void }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, new Date(closeAt).getTime() - Date.now());
      setRemaining(diff);
      if (diff === 0) onExpired?.();
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [closeAt, onExpired]);

  const hours   = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  const isUrgent = remaining < 60_000;

  return (
    <div className={`font-mono text-2xl font-bold tabular-nums ${isUrgent ? "text-red-600 animate-pulse" : "text-foreground"}`}>
      {hours > 0 && `${String(hours).padStart(2, "0")}:`}
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </div>
  );
}
```

---

### 2.13 Frontend — `packages/components/BidEntryPanel.tsx`

```typescript
"use client";
import { useState } from "react";
import { Decimal } from "decimal.js";

type Props = {
  lotId: string | null;
  currentL1Inr: number | null;
  minDecrementType: "PERCENTAGE" | "ABSOLUTE";
  minDecrementValue: number;
  auctionClosed: boolean;
  onSubmit: (lotId: string | null, amount: number) => void;
};

export function BidEntryPanel({
  lotId, currentL1Inr, minDecrementType, minDecrementValue, auctionClosed, onSubmit,
}: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const maxAllowed = currentL1Inr == null ? null :
    minDecrementType === "PERCENTAGE"
      ? new Decimal(currentL1Inr).mul(1 - minDecrementValue / 100).toNumber()
      : currentL1Inr - minDecrementValue;

  const handleSubmit = () => {
    const amount = parseFloat(value);
    if (isNaN(amount) || amount <= 0) { setError("Enter a valid amount"); return; }
    if (maxAllowed !== null && amount > maxAllowed) {
      setError(`Bid must be ≤ ₹${maxAllowed.toFixed(2)} (min decrement not met)`);
      return;
    }
    setError(null);
    onSubmit(lotId, amount);
    setValue("");
  };

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-xl bg-card">
      {currentL1Inr != null && (
        <p className="text-sm text-muted-foreground">
          L1 Price: <span className="font-semibold text-green-600">₹{currentL1Inr.toLocaleString("en-IN")}</span>
          {maxAllowed != null && ` | Your max: ₹${maxAllowed.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
        </p>
      )}
      <div className="flex gap-2">
        <input
          type="number" value={value} onChange={(e) => setValue(e.target.value)}
          disabled={auctionClosed}
          placeholder="Enter bid amount (₹)"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={handleSubmit} disabled={auctionClosed || !value}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Submit Bid
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

---

### 2.14 Frontend — `packages/components/PriceLeaderboard.tsx`

```typescript
"use client";
type RankEntry = { rank: number; vendor_id: string; vendor_name: string; bid_amount_inr: number; submitted_at: string };

export function PriceLeaderboard({ rankings, isBuyer }: { rankings: RankEntry[]; isBuyer: boolean }) {
  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left">Rank</th>
            {isBuyer && <th className="px-4 py-2 text-left">Vendor</th>}
            <th className="px-4 py-2 text-right">Bid (INR)</th>
            <th className="px-4 py-2 text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((r) => (
            <tr key={r.vendor_id}
              className={r.rank === 1 ? "bg-green-50 dark:bg-green-950 font-semibold" : "hover:bg-muted/50"}>
              <td className="px-4 py-2">
                {r.rank === 1 ? <span className="text-green-600">L1</span> : `L${r.rank}`}
              </td>
              {isBuyer && <td className="px-4 py-2">{r.vendor_name}</td>}
              <td className="px-4 py-2 text-right tabular-nums">
                ₹{r.bid_amount_inr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-2 text-right text-muted-foreground">
                {new Date(r.submitted_at).toLocaleTimeString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

### 2.15 Frontend — Supplier Portal `apps/supplier-portal/app/(main)/auctions/[id]/page.tsx`

```typescript
"use client";
import { useEffect, useState } from "react";
import { useAuctionSocket, AuctionMessage } from "@/hooks/useAuctionSocket";
import { AuctionCountdownTimer } from "@/components/AuctionCountdownTimer";
import { BidEntryPanel } from "@/components/BidEntryPanel";

export default function AuctionRoomPage({ params }: { params: { id: string } }) {
  const { connected, lastMessage, sendBid } = useAuctionSocket(params.id);
  const [auction, setAuction] = useState<any>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [l1Price, setL1Price] = useState<number | null>(null);
  const [closed, setClosed] = useState(false);

  // Fetch initial auction state
  useEffect(() => {
    fetch(`/api/v1/auctions/${params.id}`)
      .then(r => r.json()).then(d => setAuction(d.data));
  }, [params.id]);

  // Handle real-time messages
  useEffect(() => {
    if (!lastMessage) return;
    const { type, payload } = lastMessage;
    if (type === "RANK_UPDATE") {
      setMyRank((payload as any).your_rank ?? null);
      setL1Price((payload as any).l1_price_inr ?? null);
    }
    if (type === "AUCTION_EXTENDED" || type === "AUCTION_OPENED") {
      setAuction((prev: any) => prev ? { ...prev, current_close_at: (payload as any).new_close_at ?? prev.current_close_at } : prev);
    }
    if (type === "AUCTION_CLOSED") setClosed(true);
  }, [lastMessage]);

  if (!auction) return <div className="p-8">Loading auction room…</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{auction.rfq_title}</h1>
          <p className="text-sm text-muted-foreground">Live Reverse Auction</p>
        </div>
        <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} title={connected ? "Connected" : "Reconnecting…"} />
      </div>

      <div className="text-center space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Time Remaining</p>
        <AuctionCountdownTimer closeAt={auction.current_close_at} onExpired={() => setClosed(true)} />
        {closed && <p className="text-sm font-semibold text-red-600">Auction Closed</p>}
      </div>

      {myRank != null && (
        <div className={`rounded-lg p-4 text-center ${myRank === 1 ? "bg-green-100 dark:bg-green-900" : "bg-muted"}`}>
          <p className="text-xs text-muted-foreground">Your Current Rank</p>
          <p className={`text-3xl font-bold ${myRank === 1 ? "text-green-600" : "text-foreground"}`}>
            {myRank === 1 ? "🏆 L1" : `L${myRank}`}
          </p>
          {l1Price != null && myRank > 1 && (
            <p className="text-xs text-muted-foreground mt-1">L1 Price: ₹{l1Price.toLocaleString("en-IN")}</p>
          )}
        </div>
      )}

      <BidEntryPanel
        lotId={null}
        currentL1Inr={l1Price}
        minDecrementType={auction.config.min_decrement_type}
        minDecrementValue={auction.config.min_decrement_value}
        auctionClosed={closed}
        onSubmit={sendBid}
      />
    </div>
  );
}
```

---

### 2.16 Frontend — Buyer Portal `apps/buyer-portal/app/(main)/auctions/[id]/monitor/page.tsx`

```typescript
"use client";
import { useEffect, useState } from "react";
import { useAuctionSocket } from "@/hooks/useAuctionSocket";
import { PriceLeaderboard } from "@/components/PriceLeaderboard";
import { AuctionCountdownTimer } from "@/components/AuctionCountdownTimer";

export default function AuctionMonitorPage({ params }: { params: { id: string } }) {
  const { connected, lastMessage } = useAuctionSocket(params.id);
  const [auction, setAuction] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [extensionCount, setExtensionCount] = useState(0);
  const [totalBids, setTotalBids] = useState(0);

  useEffect(() => {
    fetch(`/api/v1/auctions/${params.id}`).then(r => r.json()).then(d => setAuction(d.data));
    fetch(`/api/v1/auctions/${params.id}/leaderboard`).then(r => r.json()).then(d => setLeaderboard(d.data));
  }, [params.id]);

  useEffect(() => {
    if (!lastMessage) return;
    const { type, payload } = lastMessage as any;
    if (type === "LEADERBOARD_UPDATE") setLeaderboard(payload.rankings ?? []);
    if (type === "NEW_BID") setTotalBids(payload.total_bids ?? 0);
    if (type === "AUCTION_EXTENDED") {
      setExtensionCount(payload.extension_count);
      setAuction((a: any) => a ? { ...a, current_close_at: payload.new_close_at } : a);
    }
  }, [lastMessage]);

  if (!auction) return <div className="p-8">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Auction Monitor</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{totalBids} bids</span>
          {extensionCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
              Extended ×{extensionCount}
            </span>
          )}
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
        </div>
      </div>
      <div className="text-center">
        <AuctionCountdownTimer closeAt={auction.current_close_at} />
      </div>
      <PriceLeaderboard rankings={leaderboard} isBuyer={true} />
    </div>
  );
}
```

---

## STEP 3 — TEST

```python
# tests/integration/test_live_bidding.py

async def test_auction_fsm_invalid_transition(db, factory):
    """CLOSED → OPEN transition raises INVALID_AUCTION_STATE_TRANSITION."""

async def test_bid_rejected_decrement_too_small(db, factory, redis):
    """Bid above min decrement threshold returns ValidationError DECREMENT_TOO_SMALL."""

async def test_bid_above_reserve_price_rejected_silently(db, factory, redis):
    """Bid above reserve is stored is_valid=False; reason not exposed to client."""

async def test_auto_extension_triggered(db, factory, redis):
    """Bid within auto_extend_trigger_minutes extends close time and increments extension_count."""

async def test_auto_extension_capped_at_max(db, factory, redis):
    """Extension count > max_extensions: no further extension on late bid."""

async def test_rank_computation_l1_is_lowest(db, factory, redis):
    """Vendor with lowest valid bid per lot gets rank=1."""

async def test_proxy_bid_auto_fires(db, factory, redis):
    """Vendor with proxy floor auto-bids when displaced from L1."""

async def test_proxy_bid_respects_floor(db, factory, redis):
    """Proxy does not bid below proxy_floor_inr."""

async def test_close_auction_persists_winning_bids(db, factory, redis):
    """close_auction() writes bid_line_responses with source=LIVE_AUCTION and normalized_price_inr set."""

async def test_cs_generation_works_with_live_auction_bids(db, factory, redis):
    """EvaluationService.generate_comparative_statement() succeeds on LIVE_AUCTION-sourced bids."""

async def test_bid_sequence_monotonic(db, factory, redis):
    """Concurrent bid submissions yield unique, monotonically increasing bid_sequence values."""

async def test_websocket_broadcast_on_new_bid(db, factory, redis, mock_ws):
    """Valid bid triggers LEADERBOARD_UPDATE broadcast + RANK_UPDATE to submitting vendor."""

async def test_no_bid_after_auction_closed(db, factory, redis):
    """submit_live_bid after current_close_at → AppException AUCTION_CLOSED."""

async def test_audit_events_count(db, factory, redis):
    """Full auction lifecycle logs all 12 required audit event codes."""
```

---

## STEP 4 — INTEGRATE

```bash
# 1. Run migration
alembic upgrade head   # must reach 0028_live_auction

# 2. Seed new permissions
python scripts/seed_master_data.py  # picks up 4 new PermissionCode entries

# 3. Register WebSocket route in main.py
# app.add_api_websocket_route("/ws/auction/{auction_id}", auction_ws_endpoint)
# Verify Kong passes WebSocket upgrades (already configured in SPEC_16 for /ws/*)

# 4. Smoke test
pytest tests/integration/test_live_bidding.py -v   # all 14 tests green
pytest tests/integration/test_evaluation.py -v     # SPEC_12 CS tests still green (regression)

# 5. WebSocket smoke test
# Start server, then:
wscat -c "ws://localhost:8000/ws/auction/{auction_id}?token=${ACCESS_TOKEN}"
# Should receive HEARTBEAT within 30s
```

---

## STEP 5 — GRAPHIFY

```bash
graphify update    # 4 new model nodes: LiveAuction, LiveBid, AuctionParticipant, AuctionRankSnapshot
graphify check --integrity
graphify diff > graphify_diff_spec_11b_$(date +%Y%m%d_%H%M%S).txt
```

---

## STEP 6 — README + COMMIT

```bash
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_11B — live reverse auction, WebSocket bid stream, auto-extension, proxy bidding, SPEC_12 bridge, AuctionRoom UI"
```

Update `## Current Session State` in README.md:
```
Module 11B COMPLETE: live_auctions + live_bids + auction_participants + auction_rank_snapshots tables.
Migration: 0028_live_auction (head). 4 new PermissionCodes seeded.
WebSocket: /ws/auction/{id} — Redis pub/sub fan-out verified.
Celery: 4 new beat tasks (open/close/warn/remind) at 10s–60s intervals.
SPEC_12 bridge: winning bids persisted as bid_line_responses source=LIVE_AUCTION. CS generation regression green.
Frontend: AuctionRoom (supplier), AuctionMonitor (buyer), useAuctionSocket, BidEntryPanel, PriceLeaderboard, AuctionCountdownTimer.
```
