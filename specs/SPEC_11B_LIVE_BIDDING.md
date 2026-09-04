# SPEC_11B_LIVE_BIDDING.md

## Title
Enterprise S2P Procurement Portal — Live / Reverse Auction Bidding

## Purpose
Define the live bidding engine (reverse auction), including real-time price discovery via WebSocket, auction lifecycle FSM, rank-reveal logic, auto-extension rules, bid validation, sealed-to-live transition, and the LiveBidService class. This spec extends SPEC_11_BID_MANAGEMENT.md for RFQs where `rfq.bidding_mode = LIVE_AUCTION`.

## Scope
Covers auction room creation, supplier join/leave, real-time bid broadcast, rank visibility rules, auto-extension (anti-sniping), reserve price, bid decrement rules, auction close, winner determination, transition to CS generation (SPEC_12), and all frontend components (AuctionRoom, PriceLeaderboard, CountdownTimer, BidEntry).

## Dependencies
- SPEC_03_DATABASE.md (live_auctions, live_bids, auction_rank_snapshots tables — new tables added by this spec)
- SPEC_10_RFQ_LIFECYCLE.md (RFQ states, `rfq.bidding_mode` field)
- SPEC_11_BID_MANAGEMENT.md (sealed bid baseline; live auction replaces commercial bid submission step)
- SPEC_12_COMPARATIVE_STATEMENT.md (CS generation uses winning live bids as `normalized_price_inr` source)
- SPEC_16_NOTIFICATION.md (auction start/end/extension alerts via WebSocket and email)

## Version
1.0

## Last Updated
2026-08-04

---

## 1. RFQ Bidding Modes

`rfq.bidding_mode` (new ENUM column) controls which submission path is active:

| Mode | Value | Description |
|---|---|---|
| Sealed (default) | `SEALED` | Existing SPEC_11 flow. Bids submitted before deadline, opened by buyer. |
| Live Auction | `LIVE_AUCTION` | Suppliers bid in real-time auction room. Price updates broadcast instantly. |
| Hybrid | `HYBRID` | Sealed bid first (technical + initial commercial); then live auction for shortlisted vendors. |

For `LIVE_AUCTION` and `HYBRID`, the buyer configures auction parameters at RFQ creation. The sealed bid submission step (SPEC_11 Section 4) is **skipped** or used only for the technical envelope; commercial prices are collected in the auction.

---

## 2. Auction Parameters Schema

```python
# app/modules/bid/schemas.py — extend existing file

class AuctionConfig(BaseModel):
    """Stored in rfq.auction_config JSONB column."""
    auction_start_at: datetime            # Scheduled start time (UTC)
    auction_duration_minutes: int = Field(ge=5, le=480, default=60)
    lot_ids: list[UUID]                   # Which lots are in auction (all lots if empty)
    reserve_price_inr: Optional[Decimal] = None   # Hidden from suppliers; bid rejected if above
    min_decrement_type: Literal["PERCENTAGE", "ABSOLUTE"] = "PERCENTAGE"
    min_decrement_value: Decimal = Field(gt=0, default=Decimal("0.5"))  # 0.5% or INR amount
    rank_visibility: Literal["RANK_ONLY", "PRICE_AND_RANK", "NO_RANK"] = "RANK_ONLY"
    auto_extend: bool = True
    auto_extend_trigger_minutes: int = Field(ge=1, le=15, default=5)   # Bid in last N mins triggers extension
    auto_extend_duration_minutes: int = Field(ge=1, le=30, default=10) # Extend by M mins
    max_extensions: int = Field(ge=0, le=10, default=3)
    allow_proxy_bid: bool = False         # Supplier sets floor; system auto-bids to maintain rank
    require_all_lots: bool = True         # Supplier must bid on ALL lots to be ranked

class AuctionCreateRequest(BaseModel):
    rfq_id: UUID
    config: AuctionConfig
```

---

## 3. Auction Lifecycle FSM

States stored in `live_auctions.status`:

```python
AUCTION_FSM = {
    "SCHEDULED":  ["OPEN", "CANCELLED"],
    "OPEN":       ["EXTENDED", "CLOSING", "CANCELLED"],
    "EXTENDED":   ["OPEN", "CLOSING", "CANCELLED"],    # re-opens after extension countdown
    "CLOSING":    ["CLOSED"],                           # 30-second final warning window
    "CLOSED":     ["RESULTS_RELEASED"],
    "RESULTS_RELEASED": [],
    "CANCELLED":  [],
}
```

**Transition triggers:**

| From → To | Trigger |
|---|---|
| SCHEDULED → OPEN | Celery beat task `open_scheduled_auctions` fires at `auction_start_at` |
| OPEN → EXTENDED | Bid received within `auto_extend_trigger_minutes` of close; extension count < `max_extensions` |
| EXTENDED → OPEN | Extension window begins; new close time = old close + `auto_extend_duration_minutes` |
| OPEN/EXTENDED → CLOSING | 30 seconds before final close time |
| CLOSING → CLOSED | Final close time reached; Celery task |
| CLOSED → RESULTS_RELEASED | Buyer clicks "Release Results" or auto if `auto_release_results=True` |

---

## 4. Database Tables (new — migration 0028)

```sql
-- live_auctions
CREATE TABLE live_auctions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    rfq_id          UUID NOT NULL REFERENCES rfqs(id),
    status          TEXT NOT NULL DEFAULT 'SCHEDULED',
    config          JSONB NOT NULL,
    scheduled_start_at  TIMESTAMPTZ NOT NULL,
    actual_start_at     TIMESTAMPTZ,
    current_close_at    TIMESTAMPTZ NOT NULL,   -- updated on each extension
    extension_count INT NOT NULL DEFAULT 0,
    winner_vendor_id    UUID REFERENCES vendors(id),
    winning_bid_id      UUID,                   -- FK set after CLOSED
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    version         INT NOT NULL DEFAULT 1
);

-- live_bids  (append-only; no UPDATE; superseded by newer bid from same vendor)
CREATE TABLE live_bids (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    auction_id      UUID NOT NULL REFERENCES live_auctions(id),
    rfq_id          UUID NOT NULL REFERENCES rfqs(id),
    vendor_id       UUID NOT NULL REFERENCES vendors(id),
    lot_id          UUID REFERENCES rfq_lots(id),
    bid_amount_inr  NUMERIC(20,4) NOT NULL,
    bid_sequence    INT NOT NULL,               -- monotonically increasing per auction
    is_valid        BOOLEAN NOT NULL DEFAULT TRUE,
    invalidation_reason TEXT,                  -- NULL if valid
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    client_ip       INET,
    session_id      TEXT
);
CREATE INDEX idx_live_bids_auction_vendor ON live_bids(auction_id, vendor_id, submitted_at DESC);
CREATE INDEX idx_live_bids_auction_sequence ON live_bids(auction_id, bid_sequence DESC);

-- auction_rank_snapshots  (point-in-time rank for audit trail)
CREATE TABLE auction_rank_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL,
    auction_id      UUID NOT NULL REFERENCES live_auctions(id),
    snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    trigger_bid_id  UUID REFERENCES live_bids(id),
    ranks           JSONB NOT NULL  -- [{vendor_id, rank, bid_amount_inr, lot_id}]
);

-- auction_participants  (which vendors are admitted to the room)
CREATE TABLE auction_participants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL,
    auction_id  UUID NOT NULL REFERENCES live_auctions(id),
    vendor_id   UUID NOT NULL REFERENCES vendors(id),
    joined_at   TIMESTAMPTZ,
    left_at     TIMESTAMPTZ,
    is_connected BOOLEAN NOT NULL DEFAULT FALSE,
    proxy_floor_inr NUMERIC(20,4)   -- set if allow_proxy_bid=True
);
```

---

## 5. WebSocket Protocol

### 5.1 Connection

```
wss://{host}/ws/auction/{auction_id}?token={jwt_access_token}
```

Auth validated server-side on connect. Vendor must be in `auction_participants`. Buyer connects with permission `live_auction.monitor`.

### 5.2 Server → Client Message Types

```typescript
// All messages follow envelope:
type AuctionMessage<T> = {
  type: AuctionMessageType;
  auction_id: string;
  ts: string;   // ISO UTC
  payload: T;
};

type AuctionMessageType =
  | "AUCTION_OPENED"
  | "AUCTION_EXTENDED"
  | "AUCTION_CLOSING"         // 30-second warning
  | "AUCTION_CLOSED"
  | "RESULTS_RELEASED"
  | "NEW_BID"                 // new valid bid landed
  | "RANK_UPDATE"             // your rank changed (sent only to affected vendor)
  | "LEADERBOARD_UPDATE"      // sent to buyer monitor only (all prices visible)
  | "BID_REJECTED"            // sent to submitting vendor only
  | "PARTICIPANT_JOINED"
  | "PARTICIPANT_LEFT"
  | "HEARTBEAT";              // every 30s to keep connection alive

// NEW_BID payload (sent to ALL participants)
type NewBidPayload = {
  bid_sequence: number;
  lot_id: string | null;
  // Suppliers see only their own price + L1 price (if rank_visibility != NO_RANK)
  your_bid_inr?: number;       // only for the submitting vendor
  l1_price_inr?: number;       // omitted if rank_visibility == NO_RANK
  your_rank?: number;          // omitted if rank_visibility == NO_RANK
  total_bids: number;
};

// RANK_UPDATE payload (sent to individual vendor)
type RankUpdatePayload = {
  lot_id: string | null;
  your_rank: number;
  l1_price_inr: number;        // omitted if rank_visibility == NO_RANK
};

// LEADERBOARD_UPDATE payload (buyer monitor only)
type LeaderboardPayload = {
  lot_id: string | null;
  rankings: Array<{
    rank: number;
    vendor_id: string;
    vendor_name: string;        // masked to "Vendor A / B / C" if buyer chose anonymized view
    bid_amount_inr: number;
    submitted_at: string;
  }>;
};
```

### 5.3 Client → Server Message Types

```typescript
type ClientMessage =
  | { type: "SUBMIT_BID"; lot_id: string | null; bid_amount_inr: number }
  | { type: "SET_PROXY_FLOOR"; lot_id: string | null; floor_amount_inr: number }
  | { type: "PING" };
```

---

## 6. LiveBidService — Core Logic

```python
# app/modules/bid/live_bid_service.py

class LiveBidService:

    async def create_auction(
        self, db: AsyncSession, data: AuctionCreateRequest, actor: User, org_id: UUID
    ) -> LiveAuction:
        rfq = await self.rfq_repo.get(db, data.rfq_id, org_id)
        if rfq.bidding_mode != BiddingMode.LIVE_AUCTION and rfq.bidding_mode != BiddingMode.HYBRID:
            raise AppException("INVALID_BIDDING_MODE", "RFQ must be set to LIVE_AUCTION or HYBRID")
        if rfq.status not in (RFQStatus.PUBLISHED, RFQStatus.BIDS_OPENED):
            raise AppException("INVALID_RFQ_STATE", "RFQ must be PUBLISHED or BIDS_OPENED for HYBRID mode")

        auction = LiveAuction(
            org_id=org_id, rfq_id=rfq.id,
            status="SCHEDULED",
            config=data.config.model_dump(),
            scheduled_start_at=data.config.auction_start_at,
            current_close_at=data.config.auction_start_at + timedelta(minutes=data.config.auction_duration_minutes),
            created_by=actor.id,
        )
        db.add(auction)
        await db.flush()

        # Admit all active RFQ participants into auction room
        participants = await self.participant_repo.get_active(db, rfq.id, org_id)
        for p in participants:
            db.add(AuctionParticipant(
                org_id=org_id, auction_id=auction.id, vendor_id=p.vendor_id
            ))

        await self.audit.log(db, "AUCTION", auction.id, "AUCTION_CREATED", actor.id, org_id)
        await self.publisher.publish("procurement.auction", "auction.created",
            {"auction_id": str(auction.id), "rfq_id": str(rfq.id), "start_at": data.config.auction_start_at.isoformat()}, org_id)
        return auction

    async def open_auction(self, db: AsyncSession, auction_id: UUID, org_id: UUID) -> LiveAuction:
        """Called by Celery beat task at scheduled_start_at."""
        auction = await self.repo.get(db, auction_id, org_id)
        self._fsm_validate(auction.status, "OPEN")
        auction.status = "OPEN"
        auction.actual_start_at = datetime.utcnow()
        await self.audit.log(db, "AUCTION", auction_id, "AUCTION_OPENED", None, org_id)
        await self._broadcast(auction_id, org_id, {
            "type": "AUCTION_OPENED",
            "auction_id": str(auction_id),
            "ts": datetime.utcnow().isoformat(),
            "payload": {"close_at": auction.current_close_at.isoformat()},
        })
        return auction

    async def submit_live_bid(
        self, db: AsyncSession, auction_id: UUID, lot_id: Optional[UUID],
        bid_amount_inr: Decimal, actor: User, org_id: UUID
    ) -> LiveBid:
        auction = await self.repo.get(db, auction_id, org_id)

        # --- Guard: auction must be open ---
        if auction.status not in ("OPEN", "EXTENDED", "CLOSING"):
            raise AppException("AUCTION_NOT_OPEN", f"Auction status is {auction.status}")

        # --- Guard: deadline (authoritative server time) ---
        now = datetime.utcnow()
        if now > auction.current_close_at:
            raise AppException("AUCTION_CLOSED", "Auction has already closed")

        # --- Guard: participant eligibility ---
        participant = await self.participant_repo.get_by_vendor(db, auction_id, actor.vendor_id, org_id)
        if not participant:
            raise ForbiddenError("NOT_PARTICIPANT", "Vendor not admitted to this auction")

        # --- Guard: minimum decrement ---
        current_best = await self._get_current_best_bid(db, auction_id, lot_id, org_id)
        config = AuctionConfig(**auction.config)
        if current_best is not None:
            if config.min_decrement_type == "PERCENTAGE":
                min_allowed = current_best * (1 - config.min_decrement_value / 100)
            else:
                min_allowed = current_best - config.min_decrement_value
            if bid_amount_inr > min_allowed:
                await self.audit.log(db, "AUCTION", auction_id, "BID_REJECTED_DECREMENT",
                    actor.id, org_id, new_values={"bid": str(bid_amount_inr), "min_allowed": str(min_allowed)})
                raise ValidationError("DECREMENT_TOO_SMALL",
                    f"Bid must be ≤ {min_allowed:.2f} INR (min decrement not met)")

        # --- Guard: reserve price (hidden from supplier) ---
        if config.reserve_price_inr and bid_amount_inr > config.reserve_price_inr:
            live_bid = LiveBid(
                org_id=org_id, auction_id=auction_id, rfq_id=auction.rfq_id,
                vendor_id=actor.vendor_id, lot_id=lot_id,
                bid_amount_inr=bid_amount_inr,
                bid_sequence=await self._next_sequence(db, auction_id),
                is_valid=False,
                invalidation_reason="ABOVE_RESERVE_PRICE",
                submitted_at=now,
            )
            db.add(live_bid)
            # Send rejection only to this vendor; do NOT reveal reserve price
            await self._send_to_vendor(auction_id, actor.vendor_id, {
                "type": "BID_REJECTED",
                "auction_id": str(auction_id),
                "ts": now.isoformat(),
                "payload": {"reason": "BID_NOT_COMPETITIVE"},
            })
            return live_bid

        # --- Accept bid ---
        sequence = await self._next_sequence(db, auction_id)
        live_bid = LiveBid(
            org_id=org_id, auction_id=auction_id, rfq_id=auction.rfq_id,
            vendor_id=actor.vendor_id, lot_id=lot_id,
            bid_amount_inr=bid_amount_inr,
            bid_sequence=sequence, is_valid=True,
            submitted_at=now,
        )
        db.add(live_bid)
        await db.flush()

        # --- Compute new ranks ---
        new_ranks = await self._compute_ranks(db, auction_id, lot_id, org_id)
        snapshot = AuctionRankSnapshot(
            org_id=org_id, auction_id=auction_id,
            trigger_bid_id=live_bid.id,
            ranks=new_ranks,
        )
        db.add(snapshot)

        # --- Auto-extension check ---
        time_remaining = (auction.current_close_at - now).total_seconds() / 60
        if (config.auto_extend and
                time_remaining <= config.auto_extend_trigger_minutes and
                auction.extension_count < config.max_extensions):
            auction.current_close_at = auction.current_close_at + timedelta(minutes=config.auto_extend_duration_minutes)
            auction.extension_count += 1
            auction.status = "EXTENDED"
            await self.audit.log(db, "AUCTION", auction_id, "AUCTION_EXTENDED", None, org_id,
                new_values={"new_close_at": auction.current_close_at.isoformat(), "extension_count": auction.extension_count})
            await self._broadcast(auction_id, org_id, {
                "type": "AUCTION_EXTENDED",
                "auction_id": str(auction_id),
                "ts": now.isoformat(),
                "payload": {
                    "new_close_at": auction.current_close_at.isoformat(),
                    "extension_count": auction.extension_count,
                    "max_extensions": config.max_extensions,
                },
            })

        # --- Broadcast new bid event ---
        await self._broadcast_new_bid(auction, live_bid, new_ranks, config, now, org_id)
        await self.audit.log(db, "AUCTION", auction_id, "BID_SUBMITTED", actor.id, org_id,
            new_values={"bid_id": str(live_bid.id), "amount_inr": str(bid_amount_inr), "sequence": sequence})
        return live_bid

    async def close_auction(self, db: AsyncSession, auction_id: UUID, org_id: UUID) -> LiveAuction:
        """Called by Celery task when current_close_at is reached."""
        auction = await self.repo.get(db, auction_id, org_id)
        self._fsm_validate(auction.status, "CLOSED")
        auction.status = "CLOSED"

        # Determine winner (L1 across all lots)
        final_ranks = await self._compute_final_ranks(db, auction_id, org_id)
        config = AuctionConfig(**auction.config)

        if final_ranks:
            l1_vendor_id = final_ranks[0]["vendor_id"]  # rank=1 across all lots combined
            auction.winner_vendor_id = l1_vendor_id

        # Persist winning bids as bid_line_responses for downstream CS generation
        await self._persist_winning_bids_to_sealed_table(db, auction, final_ranks, org_id)

        await self._broadcast(auction_id, org_id, {
            "type": "AUCTION_CLOSED",
            "auction_id": str(auction_id),
            "ts": datetime.utcnow().isoformat(),
            "payload": {"final_bid_count": len(final_ranks)},
        })
        await self.audit.log(db, "AUCTION", auction_id, "AUCTION_CLOSED", None, org_id,
            new_values={"winner_vendor_id": str(auction.winner_vendor_id) if auction.winner_vendor_id else None})
        await self.publisher.publish("procurement.auction", "auction.closed",
            {"auction_id": str(auction_id), "rfq_id": str(auction.rfq_id)}, org_id)
        return auction

    async def release_results(
        self, db: AsyncSession, auction_id: UUID, actor: User, org_id: UUID
    ) -> LiveAuction:
        auction = await self.repo.get(db, auction_id, org_id)
        self._fsm_validate(auction.status, "RESULTS_RELEASED")
        auction.status = "RESULTS_RELEASED"
        final_ranks = await self._compute_final_ranks(db, auction_id, org_id)
        # Notify each vendor of their final rank
        for rank_entry in final_ranks:
            await self.publisher.publish("procurement.notification", "notification.email.auction_result",
                {"vendor_id": str(rank_entry["vendor_id"]), "rank": rank_entry["rank"],
                 "rfq_id": str(auction.rfq_id), "template_code": "AUCTION_RESULT_VENDOR", "org_id": str(org_id)}, org_id)
        await self.audit.log(db, "AUCTION", auction_id, "RESULTS_RELEASED", actor.id, org_id)
        return auction

    async def _compute_ranks(
        self, db: AsyncSession, auction_id: UUID, lot_id: Optional[UUID], org_id: UUID
    ) -> list[dict]:
        """Get best (lowest) valid bid per vendor for this lot, sorted ascending."""
        best_bids = await self.live_bid_repo.get_best_per_vendor(db, auction_id, lot_id, org_id)
        return [
            {"rank": idx + 1, "vendor_id": str(b.vendor_id),
             "bid_amount_inr": float(b.bid_amount_inr), "lot_id": str(lot_id) if lot_id else None}
            for idx, b in enumerate(best_bids)
        ]

    async def _persist_winning_bids_to_sealed_table(
        self, db: AsyncSession, auction: LiveAuction, final_ranks: list[dict], org_id: UUID
    ):
        """
        Write winning live bids into bid_line_responses so SPEC_12 CS generation
        works unchanged. Sets normalized_price_inr = winning bid_amount_inr (already INR).
        """
        for entry in final_ranks:
            best_bid = await self.live_bid_repo.get_best_for_vendor_lot(
                db, auction.id, UUID(entry["vendor_id"]), entry.get("lot_id"), org_id)
            if not best_bid:
                continue
            bid_line = await self.bid_line_repo.get_or_create_for_live_auction(
                db, bid_response_id=None,  # created fresh
                org_id=org_id, rfq_id=auction.rfq_id,
                vendor_id=best_bid.vendor_id,
                lot_id=best_bid.lot_id,
                unit_price=best_bid.bid_amount_inr,
                normalized_price_inr=best_bid.bid_amount_inr,
                source="LIVE_AUCTION",
            )

    async def _broadcast(self, auction_id: UUID, org_id: UUID, message: dict):
        """Publish to Redis channel; WebSocket consumers fan out to connected clients."""
        channel = RedisKeys.auction_channel(auction_id)
        await self.redis.publish(channel, json.dumps(message))

    async def _send_to_vendor(self, auction_id: UUID, vendor_id: UUID, message: dict):
        """Publish to vendor-specific Redis channel."""
        channel = RedisKeys.auction_vendor_channel(auction_id, vendor_id)
        await self.redis.publish(channel, json.dumps(message))

    async def _broadcast_new_bid(
        self, auction, live_bid, new_ranks, config: AuctionConfig, now: datetime, org_id: UUID
    ):
        l1_price = new_ranks[0]["bid_amount_inr"] if new_ranks else None
        vendor_rank = next((r["rank"] for r in new_ranks if UUID(r["vendor_id"]) == live_bid.vendor_id), None)

        # Buyer monitor gets full leaderboard
        await self._broadcast(auction.id, org_id, {
            "type": "LEADERBOARD_UPDATE",
            "auction_id": str(auction.id), "ts": now.isoformat(),
            "payload": {"lot_id": str(live_bid.lot_id) if live_bid.lot_id else None, "rankings": new_ranks},
        })

        # All participants get bid count + limited info
        public_payload = {
            "bid_sequence": live_bid.bid_sequence,
            "lot_id": str(live_bid.lot_id) if live_bid.lot_id else None,
            "total_bids": live_bid.bid_sequence,
            **({"l1_price_inr": l1_price} if config.rank_visibility != "NO_RANK" else {}),
        }
        await self._broadcast(auction.id, org_id, {
            "type": "NEW_BID", "auction_id": str(auction.id),
            "ts": now.isoformat(), "payload": public_payload,
        })

        # Submitting vendor gets their own price and rank
        await self._send_to_vendor(auction.id, live_bid.vendor_id, {
            "type": "RANK_UPDATE", "auction_id": str(auction.id), "ts": now.isoformat(),
            "payload": {
                "lot_id": str(live_bid.lot_id) if live_bid.lot_id else None,
                "your_bid_inr": float(live_bid.bid_amount_inr),
                **({"your_rank": vendor_rank, "l1_price_inr": l1_price}
                   if config.rank_visibility != "NO_RANK" else {}),
            },
        })
```

---

## 7. Proxy Bidding

When `allow_proxy_bid = True` in auction config:

```python
async def set_proxy_floor(
    self, db: AsyncSession, auction_id: UUID, lot_id: Optional[UUID],
    floor_amount_inr: Decimal, actor: User, org_id: UUID
) -> AuctionParticipant:
    """Supplier sets a floor; system auto-submits minimum decrement bids to keep them at L1."""
    participant = await self.participant_repo.get_by_vendor(db, auction_id, actor.vendor_id, org_id)
    participant.proxy_floor_inr = floor_amount_inr
    await self.audit.log(db, "AUCTION", auction_id, "PROXY_FLOOR_SET", actor.id, org_id,
        new_values={"floor_inr": str(floor_amount_inr)})
    return participant

async def execute_proxy_bids(self, db: AsyncSession, auction_id: UUID, lot_id: Optional[UUID],
                              triggering_bid: LiveBid, org_id: UUID):
    """Called after every new valid bid. Auto-bids on behalf of proxy participants who are no longer L1."""
    config = AuctionConfig(**(await self.repo.get(db, auction_id, org_id)).config)
    proxy_participants = await self.participant_repo.get_proxy_eligible(db, auction_id, org_id)
    for p in proxy_participants:
        if p.vendor_id == triggering_bid.vendor_id:
            continue
        current_best = await self._get_current_best_bid(db, auction_id, lot_id, org_id)
        if config.min_decrement_type == "PERCENTAGE":
            auto_bid = current_best * (1 - config.min_decrement_value / 100)
        else:
            auto_bid = current_best - config.min_decrement_value
        if auto_bid >= p.proxy_floor_inr:
            # Floor would be breached; do NOT auto-bid
            continue
        # Synthesize a bid on behalf of this vendor
        await self.submit_live_bid(db, auction_id, lot_id, auto_bid,
            actor=await self._get_vendor_actor(p.vendor_id, org_id), org_id=org_id)
```

---

## 8. Audit Events (12 required)

| Event Code | Trigger |
|---|---|
| `AUCTION_CREATED` | Buyer creates auction room |
| `AUCTION_OPENED` | Celery task opens auction at scheduled time |
| `AUCTION_EXTENDED` | Auto-extension triggered |
| `BID_SUBMITTED` | Valid live bid accepted |
| `BID_REJECTED_DECREMENT` | Bid rejected — min decrement not met |
| `BID_REJECTED_ABOVE_RESERVE` | Bid rejected — above reserve price (reason masked to vendor) |
| `AUCTION_CLOSING_WARNING` | 30-second warning broadcast |
| `AUCTION_CLOSED` | Auction closes; winning bid locked |
| `RESULTS_RELEASED` | Buyer releases results to all vendors |
| `PROXY_FLOOR_SET` | Vendor sets proxy bid floor |
| `PROXY_BID_EXECUTED` | System auto-bid fired on behalf of vendor |
| `AUCTION_CANCELLED` | Buyer or admin cancels auction |

---

## 9. Celery Tasks

```python
# app/tasks/auction.py

@celery_app.task(name="tasks.open_scheduled_auctions")
async def open_scheduled_auctions():
    """Runs every 30 seconds via Celery beat. Opens auctions past their start time."""

@celery_app.task(name="tasks.close_due_auctions")
async def close_due_auctions():
    """Runs every 10 seconds. Closes auctions past current_close_at."""

@celery_app.task(name="tasks.send_auction_closing_warning")
async def send_auction_closing_warning():
    """Runs every 10 seconds. Broadcasts AUCTION_CLOSING for auctions within 30s of close."""

@celery_app.task(name="tasks.notify_auction_start")
async def notify_auction_start_reminders():
    """Runs every minute. Sends email+in-app alerts to participants 60min and 15min before start."""
```

---

## 10. HTTP API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auctions` | `live_auction.create` | Create auction for an RFQ |
| GET | `/api/v1/auctions/{auction_id}` | Participant or buyer | Get auction config + status |
| POST | `/api/v1/auctions/{auction_id}/open` | Internal (Celery) | Manually open (admin override) |
| POST | `/api/v1/auctions/{auction_id}/cancel` | `live_auction.cancel` | Cancel before or during |
| POST | `/api/v1/auctions/{auction_id}/release-results` | `live_auction.release_results` | Release results post-close |
| GET | `/api/v1/auctions/{auction_id}/leaderboard` | `live_auction.monitor` | Current ranks (buyer only) |
| GET | `/api/v1/auctions/{auction_id}/my-rank` | Vendor participant | Own rank + L1 price |
| GET | `/api/v1/auctions/{auction_id}/bids` | `live_auction.monitor` | Full bid history (buyer) |
| POST | `/api/v1/auctions/{auction_id}/proxy-floor` | Vendor participant | Set proxy floor |
| WS | `/ws/auction/{auction_id}` | JWT in query param | Real-time bid stream |

---

## 11. LiveBidService Class

```python
class LiveBidService:
    async def create_auction(self, db, data: AuctionCreateRequest, actor: User, org_id: UUID) -> LiveAuction: ...
    async def open_auction(self, db, auction_id: UUID, org_id: UUID) -> LiveAuction: ...
    async def submit_live_bid(self, db, auction_id: UUID, lot_id: Optional[UUID], bid_amount_inr: Decimal, actor: User, org_id: UUID) -> LiveBid: ...
    async def close_auction(self, db, auction_id: UUID, org_id: UUID) -> LiveAuction: ...
    async def release_results(self, db, auction_id: UUID, actor: User, org_id: UUID) -> LiveAuction: ...
    async def cancel_auction(self, db, auction_id: UUID, reason: str, actor: User, org_id: UUID) -> LiveAuction: ...
    async def set_proxy_floor(self, db, auction_id: UUID, lot_id: Optional[UUID], floor_amount_inr: Decimal, actor: User, org_id: UUID) -> AuctionParticipant: ...
    async def execute_proxy_bids(self, db, auction_id: UUID, lot_id: Optional[UUID], triggering_bid: LiveBid, org_id: UUID): ...
    async def get_leaderboard(self, db, auction_id: UUID, actor: User, org_id: UUID) -> list[dict]: ...
    async def get_my_rank(self, db, auction_id: UUID, actor: User, org_id: UUID) -> dict: ...
    async def get_bid_history(self, db, auction_id: UUID, actor: User, org_id: UUID) -> list[LiveBid]: ...
    async def _compute_ranks(self, db, auction_id: UUID, lot_id: Optional[UUID], org_id: UUID) -> list[dict]: ...
    async def _compute_final_ranks(self, db, auction_id: UUID, org_id: UUID) -> list[dict]: ...
    async def _get_current_best_bid(self, db, auction_id: UUID, lot_id: Optional[UUID], org_id: UUID) -> Optional[Decimal]: ...
    async def _persist_winning_bids_to_sealed_table(self, db, auction: LiveAuction, final_ranks: list[dict], org_id: UUID): ...
    async def _broadcast(self, auction_id: UUID, org_id: UUID, message: dict): ...
    async def _send_to_vendor(self, auction_id: UUID, vendor_id: UUID, message: dict): ...
    async def _next_sequence(self, db, auction_id: UUID) -> int: ...
    async def _fsm_validate(self, current: str, target: str): ...
```

---

## 12. SPEC_12 Integration

After `close_auction()`, winning live bids are persisted into `bid_line_responses` with `source = "LIVE_AUCTION"` and `normalized_price_inr` pre-set (auction prices are already in INR). This means:

- `EvaluationService.generate_comparative_statement()` works **unchanged** — it reads `normalized_price_inr` per usual.
- Price normalization step (SPEC_11 S11-16 / A-11-5) is **skipped** for live auction bids; `exchange_rate_used = 1.0` recorded for auditability.
- L1 from auction leaderboard should match L1 in CS — any discrepancy triggers an alert event `alert.auction_cs_l1_mismatch`.
