# IMPLEMENTATION PROMPT — SPEC_11B: Live / Reverse Auction Bidding

Execute the complete implementation for `plans/plan_spec_11b_live_bidding.md`.

Follow the `IMPLEMENTATION LOOP` (Steps 2 through 6) and ALL `ABSOLUTE RULES` from `GEMINI.md`. Do not stop until every step is fully completed and verified.

---

## MANDATORY PRE-FLIGHT (run first, before writing any code)

```bash
graphify check --before-change
cat README.md | grep -A 20 "Current Session State"

# Confirm hard dependencies are green before starting:
alembic current                                         # must show (head) at 0027_data_seed
pytest tests/integration/test_bid_management.py -v --tb=no -q   # SPEC_11 must be all green
pytest tests/integration/test_evaluation.py    -v --tb=no -q   # SPEC_12 must be all green
pytest tests/integration/test_notifications.py -v --tb=no -q   # SPEC_16 WebSocket infra must be green

# Confirm Redis is up and pub/sub works:
redis-cli ping   # must return PONG

# Confirm existing WebSocket route pattern works (SPEC_16):
wscat -c "ws://localhost:8000/ws/notifications?token=${ACCESS_TOKEN}" --no-check
# Exit immediately after PING response; this confirms WS infra is live
```

**STOP if any of the above pre-flight checks fail. Fix before proceeding.**

---

## Step 2 — IMPLEMENT (strict order — do not reorder)

### 2A — Database & Models

1. **`app/db/enums.py`** — add `BiddingMode = Enum('SEALED', 'LIVE_AUCTION', 'HYBRID')` to existing enums file. Do NOT create a new file; append to existing.

2. **`alembic/versions/0028_live_auction.py`** — exact migration from plan Section 2.1:
   - ADD COLUMN `rfqs.bidding_mode TEXT NOT NULL DEFAULT 'SEALED'`
   - ADD COLUMN `rfqs.auction_config JSONB NULL`
   - CREATE TABLE `live_auctions` (all columns per plan)
   - CREATE TABLE `live_bids` (append-only; no updated_at column — intentional)
   - CREATE TABLE `auction_rank_snapshots`
   - CREATE TABLE `auction_participants`
   - All 5 `CREATE INDEX CONCURRENTLY IF NOT EXISTS` statements (copy verbatim from plan)
   - `downgrade()` must drop all tables and columns in exact reverse order

3. **`app/modules/bid/models.py`** — append 4 new SQLAlchemy model classes from plan Section 2.3:
   `LiveAuction`, `LiveBid`, `AuctionParticipant`, `AuctionRankSnapshot`.
   - `LiveBid` has NO `updated_at` or `deleted_at` columns (append-only by design)
   - `LiveAuction` imports from `app.db.base import BaseModel`; `LiveBid`, `AuctionParticipant`, `AuctionRankSnapshot` import from `sqlalchemy.orm import DeclarativeBase` (they have their own simpler bases without soft-delete) — OR use BaseModel and simply never call `.delete()`; choose whichever is consistent with your codebase pattern

### 2B — Core Infrastructure

4. **`app/modules/bid/auction_fsm.py`** — exact FSM dict + `validate_auction_transition()` from plan Section 2.2. Import and use this in all status-changing service methods.

5. **`app/core/redis_client.py`** — ADD 4 new static methods to existing `RedisKeys` class (plan Section 2.4):
   `auction_channel`, `auction_vendor_channel`, `auction_sequence`, `auction_best_bid`.
   Do NOT modify any existing methods.

6. **`app/core/constants.py`** — ADD 4 new `PermissionCode` class attributes (plan Section 2.10):
   `LIVE_AUCTION_CREATE`, `LIVE_AUCTION_CANCEL`, `LIVE_AUCTION_MONITOR`, `LIVE_AUCTION_RELEASE_RESULTS`.

### 2C — Schemas

7. **`app/modules/bid/schemas.py`** — APPEND (do not replace) `AuctionConfig` and `AuctionCreateRequest` Pydantic schemas from SPEC_11B Section 2. Preserve all existing SPEC_11 schemas unchanged.

### 2D — Repository

8. **`app/modules/bid/live_bid_repository.py`** — new file; implement `LiveBidRepository` class with all 6 methods from plan Section 2.5:
   - `get_best_per_vendor` — uses `DISTINCT ON (vendor_id)` + re-sorted in Python
   - `get_best_for_vendor_lot`
   - `get_auction_best_bid` — uses `func.min()`
   - `next_sequence` — Redis INCR via `RedisKeys.auction_sequence()`
   - `count_submitted`
   - `get_proxy_eligible`

   Also add these repo methods needed by Celery tasks (not in plan but required):
   - `get_due_to_open(db)` — `SELECT * FROM live_auctions WHERE status='SCHEDULED' AND scheduled_start_at <= now() AND deleted_at IS NULL`
   - `get_due_to_close(db)` — `UPDATE live_auctions SET status='CLOSED' WHERE status IN ('OPEN','EXTENDED','CLOSING') AND current_close_at <= now() AND deleted_at IS NULL RETURNING *` (atomic; use `RETURNING` to avoid race)
   - `get_closing_soon(db, seconds: int)` — auctions in OPEN/EXTENDED with `current_close_at BETWEEN now() AND now() + interval '{seconds} seconds'`
   - `get_starting_in(db, minutes: int)` — auctions in SCHEDULED with `scheduled_start_at BETWEEN now() AND now() + interval '{minutes} minutes'`

### 2E — Service

9. **`app/modules/bid/live_bid_service.py`** — new file; implement `LiveBidService` with ALL methods from SPEC_11B Section 11 and plan Section 2.6. Pay special attention to:

   **`submit_live_bid` must check guards in this EXACT order:**
   1. Auction status in (`OPEN`, `EXTENDED`, `CLOSING`) — else `AUCTION_NOT_OPEN`
   2. Server time ≤ `auction.current_close_at` — else `AUCTION_CLOSED`
   3. Vendor in `auction_participants` — else `NOT_PARTICIPANT`
   4. Min decrement satisfied — else `DECREMENT_TOO_SMALL`
   5. Reserve price check (if configured) — `is_valid=False`, reason masked

   **`_persist_winning_bids_to_sealed_table` must:**
   - Create one `BidResponse` header row per winning vendor (status=`OPENED`, source=`LIVE_AUCTION`)
   - Create `BidLineResponse` rows with `normalized_price_inr = bid_amount_inr` and `exchange_rate_used = 1.0`
   - This is the SPEC_12 bridge — CS generation must work unchanged after this

   **`execute_proxy_bids` must:**
   - Cap proxy cascade at 5 sequential auto-bids per call
   - If cascade > 5, schedule `tasks.execute_proxy_bids` Celery task for remainder
   - Each proxy bid goes through the full `submit_live_bid` validation chain

   **Audit events:** Every state-changing method must call `self.audit.log(...)`. All 12 event codes from SPEC_11B Section 8 must be present.

### 2F — WebSocket

10. **`app/modules/bid/auction_ws.py`** — new file; implement `AuctionConnectionManager` and `auction_ws_endpoint` from plan Section 2.6. Critical requirements:
    - Auth validated via `get_current_user_ws` (same dependency as SPEC_16 notifications WS)
    - Vendor must be in `auction_participants` — reject with 403 close code if not
    - Buyer with `LIVE_AUCTION_MONITOR` perm gets connected to broadcast channel only (no vendor channel)
    - `WebSocketDisconnect` must update `auction_participants.is_connected = False` and set `left_at`
    - Reconnect on connect must update `joined_at` and `is_connected = True`

### 2G — Router

11. **`app/modules/bid/auction_router.py`** — new file; all 8 HTTP endpoints from plan Section 2.7.
    - Use `require_permission()` for protected routes
    - Use `success_response()` and `created_response()` from `app.core.responses`
    - All list endpoints return `APIResponse` envelope with `PaginationMeta`

12. **`app/main.py`** — register two new routes (do NOT touch any existing registrations):
    ```python
    app.include_router(auction_router, prefix="/api/v1")
    app.add_api_websocket_route("/ws/auction/{auction_id}", auction_ws_endpoint)
    ```

### 2H — Celery Tasks

13. **`app/tasks/auction.py`** — new file; all 4 Celery tasks from plan Section 2.8.
    - Use `get_db_ctx()` async context manager (same pattern as other task files)
    - Each task: try/except per auction, rollback on error, continue to next auction

14. **`app/tasks/celery_app.py`** — ADD 4 new entries to existing `beat_schedule` dict (plan Section 2.9). Do NOT modify any existing schedule entries.

### 2I — Frontend

15. **`packages/hooks/useAuctionSocket.ts`** — new file; exact implementation from plan Section 2.11.
    - Exponential back-off reconnect (track `reconnectCount` in a `useRef`)
    - Heartbeat PING sent every 25 seconds via `setInterval` to prevent proxy timeout
    - `sendBid` and `ping` wrapped in `useCallback`

16. **`packages/components/AuctionCountdownTimer.tsx`** — new file; exact implementation from plan Section 2.12.
    - Tick every 500ms (not 1000ms — avoids visible 1-second jump)
    - `isUrgent` triggers red + pulse animation when < 60 seconds remain
    - Calls `onExpired()` exactly once when remaining hits 0

17. **`packages/components/BidEntryPanel.tsx`** — new file; exact implementation from plan Section 2.13.
    - Client-side max allowed computed from `currentL1Inr` + decrement config
    - Validation error shown inline — does NOT call onSubmit if invalid
    - Input cleared after successful submit
    - `disabled` when `auctionClosed`

18. **`packages/components/PriceLeaderboard.tsx`** — new file; exact implementation from plan Section 2.14.
    - L1 row highlighted green
    - `isBuyer=false` hides vendor name column entirely (not just masked)
    - Uses `en-IN` locale for INR formatting throughout

19. **`apps/supplier-portal/app/(main)/auctions/[id]/page.tsx`** — new page; exact implementation from plan Section 2.15. Add route to supplier portal navigation sidebar under "My Auctions".

20. **`apps/buyer-portal/app/(main)/auctions/[id]/monitor/page.tsx`** — new page; exact implementation from plan Section 2.16. Add route to buyer portal navigation sidebar under "Live Auctions".

21. **`apps/buyer-portal/app/(main)/auctions/page.tsx`** — new list page (not in plan — add it):
    - Lists all auctions for the org (GET `/api/v1/auctions?rfq_id=...`)
    - Status badge (SCHEDULED / OPEN / CLOSED / etc.)
    - "Monitor" button links to monitor page
    - "Create Auction" button (permission-guarded: `LIVE_AUCTION_CREATE`)

22. **`scripts/seed_master_data.py`** — ADD 4 new permissions to the existing permissions seed list:
    ```python
    {"code": "live_auction.create",          "description": "Create live auction for an RFQ"},
    {"code": "live_auction.cancel",          "description": "Cancel a live auction"},
    {"code": "live_auction.monitor",         "description": "Monitor live auction leaderboard (buyer)"},
    {"code": "live_auction.release_results", "description": "Release auction results to vendors"},
    ```
    Assign `live_auction.create` and `live_auction.monitor` and `live_auction.release_results` to `SOURCING_MANAGER` role.
    Assign all 4 to `PROCUREMENT_HEAD` role.

---

## Step 2.5 — SPEC AUDIT

Re-read `SPEC_11B_LIVE_BIDDING.md` in full. Produce `reports/spec_11b_audit.md`:

```
MODULE 11B | SPEC_11B_LIVE_BIDDING | DATE: {today}

S11B-01  Auction FSM (7 states)                    [DONE/PARTIAL/MISSING]
S11B-02  AuctionConfig schema + rfq.bidding_mode   [DONE/PARTIAL/MISSING]
S11B-03  Migration 0028 (4 tables + indexes)       [DONE/PARTIAL/MISSING]
S11B-04  create_auction                            [DONE/PARTIAL/MISSING]
S11B-05  submit_live_bid (all guards + auto-extend)[DONE/PARTIAL/MISSING]
S11B-06  close_auction + SPEC_12 bridge            [DONE/PARTIAL/MISSING]
S11B-07  release_results + notifications           [DONE/PARTIAL/MISSING]
S11B-08  Proxy bidding (floor + cascade cap)       [DONE/PARTIAL/MISSING]
S11B-09  WebSocket endpoint + Redis pub/sub        [DONE/PARTIAL/MISSING]
S11B-10  Rank computation (DISTINCT ON query)      [DONE/PARTIAL/MISSING]
S11B-11  Auto-extension (anti-sniping)             [DONE/PARTIAL/MISSING]
S11B-12  Celery tasks (all 4 beat tasks)           [DONE/PARTIAL/MISSING]
S11B-13  HTTP router (all 8 endpoints)             [DONE/PARTIAL/MISSING]
S11B-14  12 audit event codes                      [DONE/PARTIAL/MISSING]
S11B-15  RedisKeys (4 new patterns)               [DONE/PARTIAL/MISSING]
S11B-16  SPEC_12 bridge verified                   [DONE/PARTIAL/MISSING]
S11B-17  Supplier AuctionRoom page                 [DONE/PARTIAL/MISSING]
S11B-18  Buyer AuctionMonitor page                 [DONE/PARTIAL/MISSING]
S11B-19  useAuctionSocket hook                     [DONE/PARTIAL/MISSING]
S11B-20  BidEntryPanel component                   [DONE/PARTIAL/MISSING]
S11B-21  PriceLeaderboard component                [DONE/PARTIAL/MISSING]
S11B-22  AuctionCountdownTimer component           [DONE/PARTIAL/MISSING]

OVERALL: X/22 (Z%) | BACKEND: A% | FRONTEND: B% | INFRA: C% | TESTS: D%
```

**STOP if any item is MISSING or PARTIAL. Fix before Step 3.**

---

## Step 3 — TEST (three personas)

### Security Persona (run first — non-negotiable)
```bash
# Reserve price MUST never appear in any WebSocket message payload
grep -r "reserve_price" app/modules/bid/auction_ws.py && echo "FAIL: reserve price in WS" || echo "PASS"

# Vendor must not receive other vendors' prices when rank_visibility=NO_RANK
pytest tests/security/test_auction_visibility.py -v
# Must include: test_no_rank_hides_l1_price, test_vendor_cannot_see_other_vendor_prices

# Supplier portal route must not be accessible by buyer role
pytest tests/security/test_auction_permissions.py -v
```

### Developer Persona
```bash
# Run all 14 integration tests from plan Section 3:
pytest tests/integration/test_live_bidding.py -v

# SPEC_12 regression — CS generation must still work with LIVE_AUCTION bids:
pytest tests/integration/test_evaluation.py -v --tb=short
# MUST PASS: test_l1_identified_per_lot, test_cs_fails_without_normalized_prices

# Full bid module regression:
pytest tests/integration/test_bid_management.py tests/integration/test_live_bidding.py -v
```

### QA Persona
```bash
# WebSocket end-to-end: open auction → two vendor connections → submit competing bids → verify broadcast
python tests/e2e/auction_ws_e2e.py  # script that connects 2 mock vendors + 1 buyer monitor

# Celery beat tasks registered and callable:
celery -A app.tasks.celery_app inspect registered | grep "tasks.open_scheduled\|tasks.close_due\|tasks.send_auction_closing\|tasks.notify_auction_start"
# All 4 must appear

# Migration round-trip:
alembic downgrade 0027 && alembic upgrade head
# Must complete without errors; all 4 tables present after upgrade
psql -U postgres -d procurement -c "\dt live_*"
# Must show: live_auctions, live_bids

# Auction sequence is monotonic under concurrent load:
pytest tests/unit/test_auction_sequence.py -v   # uses asyncio.gather to submit 20 concurrent bids
```

---

## Step 4 — INTEGRATE

```bash
# 1. Apply migration
alembic upgrade head
# Verify: must be at head; all 4 new tables exist
psql -U postgres -d procurement -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'live_%' OR table_name LIKE 'auction_%'"

# 2. Seed new permissions
python scripts/seed_master_data.py
# Verify: 4 new live_auction.* permissions in DB
psql -U postgres -d procurement -c "SELECT code FROM permissions WHERE code LIKE 'live_auction.%'"

# 3. Verify Celery beat picks up new tasks
celery -A app.tasks.celery_app beat --loglevel=info &
sleep 35   # wait for first open_scheduled_auctions tick
celery -A app.tasks.celery_app inspect active  # should show tasks running

# 4. Kong: no new routes needed (WebSocket /ws/* already allowed from SPEC_16)
# Verify existing kong.yml has: strip_path: false on /ws/* route
grep -A 5 "ws" kong/kong.yml | grep "strip_path"   # must show false

# 5. Full smoke test: create auction, open it, submit bid, verify rank
pytest tests/integration/test_live_bidding.py::test_rank_computation_l1_is_lowest -v -s
```

---

## Step 5 — GRAPHIFY

```bash
graphify update
# Must add 4 new nodes: LiveAuction, LiveBid, AuctionParticipant, AuctionRankSnapshot
# Must add edges: LiveAuction→RFQ, LiveBid→LiveAuction, LiveBid→Vendor, AuctionParticipant→LiveAuction

graphify check --integrity
# Must show 0 broken links

graphify diff > graphify_diff_spec_11b_$(date +%Y%m%d_%H%M%S).txt
```

---

## Step 6 — README + COMMIT

Write the following to `## Current Session State` in `README.md` (replace existing content):

```markdown
## Current Session State
**Last Session:** SPEC_11B — Live / Reverse Auction Bidding
**Migration Head:** 0028_live_auction
**New Tables:** live_auctions, live_bids, auction_participants, auction_rank_snapshots
**New Permissions (seeded):** live_auction.create, live_auction.cancel, live_auction.monitor, live_auction.release_results
**WebSocket:** /ws/auction/{auction_id} — Redis pub/sub fan-out; WS infra shared with SPEC_16
**Celery Beat:** 4 new tasks — open(30s), close(10s), closing_warn(10s), start_reminder(60s)
**SPEC_12 Bridge:** Winning live bids persisted as bid_line_responses source=LIVE_AUCTION, normalized_price_inr pre-set. CS generation regression green.
**Frontend:** AuctionRoom (supplier), AuctionMonitor (buyer), useAuctionSocket, BidEntryPanel, PriceLeaderboard, AuctionCountdownTimer
**Test Coverage:** run pytest --cov=app/modules/bid --cov-fail-under=80
**Next:** SPEC_12 (Comparative Statement) or SPEC_13 (Contract Management)
```

```bash
git add -A && git commit -m "[NON-BREAKING] feat: SPEC_11B — live reverse auction, WebSocket bid stream, auto-extension, proxy bidding, SPEC_12 bridge, AuctionRoom UI"
```

---

## ABSOLUTE RULES FOR THIS SESSION

1. **SEALED bid flow (SPEC_11) MUST remain 100% unchanged.** `rfq.bidding_mode` defaults to `SEALED`. No existing SPEC_11 code paths may be modified, only new files added and existing files appended to.

2. **Reserve price MUST NEVER appear in any outbound WebSocket message**, regardless of field name. The client-side rejection message MUST use the opaque reason string `"BID_NOT_COMPETITIVE"`.

3. **`live_bids` is append-only.** No `UPDATE` or `DELETE` statements are ever issued on this table. Bid invalidation is done by inserting a record with `is_valid=False`.

4. **All bid_sequence values are generated via Redis INCR**, not DB sequences. This ensures monotonic ordering under concurrent load without locking.

5. **The SPEC_12 bridge (`_persist_winning_bids_to_sealed_table`) is not optional.** EvaluationService must be able to generate a ComparativeStatement from a live-auction RFQ with zero code changes to SPEC_12.

6. **Do NOT auto-approve or skip any approval step.** `release_results` requires the buyer to explicitly call the endpoint; there is no `auto_release_results` shortcut even if the config field exists.

7. **Proxy bid cascade is capped at 5.** Exceeding this cap schedules a Celery task; it does NOT raise an error to the triggering vendor.

8. **Frontend: no localStorage.** Token accessed via Zustand store only. Verify: `grep -r "localStorage" packages/hooks/useAuctionSocket.ts` must return empty.
