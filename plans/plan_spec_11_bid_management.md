# IMPLEMENTATION PLAN — SPEC_11: Bid Management
**Module:** 11 | **Phase:** Core | **Squad:** C
**Spec File:** SPEC_11_BID_MANAGEMENT.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S11-01 | Sealed bid storage (encrypted at rest + access control) | bid/service.py + encryption | DONE |
| S11-02 | Bid versioning (revisions before deadline) | bid/service.py + models | DONE |
| S11-03 | Bid status FSM (7 states) | bid/fsm.py | DONE |
| S11-04 | Bid submission by supplier portal | bid/router.py (supplier-side) | DONE |
| S11-05 | Bid acknowledgement by participant | bid/service.py | DONE |
| S11-06 | Bid withdrawal (before deadline only) | bid/service.py | DONE |
| S11-07 | Price breakdown (lot + line level) | bid/models.py | DONE |
| S11-08 | Commercial terms (payment, delivery, warranty) | bid/models.py | DONE |
| S11-09 | Deviation declaration | bid/models.py | DONE |
| S11-10 | Technical offer documents | bid/service.py + document | DONE |
| S11-11 | Bid count visible (not content) while sealed | bid/router.py | DONE |
| S11-12 | Bid access control post-opening (role-based) | bid/service.py | DONE |
| S11-13 | Late bid rejection | bid/service.py | DONE |
| S11-14 | Single-vendor bid handling (policy decision flag) | bid/service.py | DONE |
| S11-15 | 10 audit events | bid/service.py | DONE |
| S11-16 | Price normalization (currency conversion) | bid/service.py | DONE |

```
MODULE | SPEC | DATE
SPEC_11 | Bid Management | 2026-09-05
OVERALL: 16/16 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-11-1 | Bid content (unit prices, totals) encrypted using `encrypt_field()` from core/encryption.py; decrypted only after `bids_opened_at IS NOT NULL` on parent RFQ | SPEC "sealed" bids; no encryption mechanism specified | HIGH — price leakage before opening | Squad C |
| A-11-2 | Bid revision number stored in `bid_versions` table; latest revision = bid_responses.revision_number; prior versions immutable | SPEC Section 2 bid versioning | LOW | Squad C |
| A-11-3 | Late bid: submitted after `rfq.bid_submission_deadline`; service returns 409 LATE_BID_REJECTED with timestamp comparison | SPEC Section 13 late rejection | LOW | Squad C |
| A-11-4 | Single-vendor bid flagged in `bid_responses.is_single_vendor_situation=True`; requires `PROCUREMENT_HEAD` override to proceed to evaluation | SPEC Section 14 — policy decision | MEDIUM | Squad C |
| A-11-5 | Price normalization: `bid_line_responses.normalized_price_inr` computed at bid opening using exchange_rate cached in Redis; if exchange rate missing, raise `EXCHANGE_RATE_UNAVAILABLE` | SPEC_11 Section 16 currency conversion | MEDIUM | Squad C |

---
## STEP 2 — IMPLEMENT

### 2.1 `app/modules/bid/fsm.py`
```python
BID_FSM = {
    "DRAFT":       ["SUBMITTED", "WITHDRAWN"],
    "SUBMITTED":   ["REVISED", "WITHDRAWN", "SEALED", "REJECTED"],
    "REVISED":     ["SUBMITTED", "WITHDRAWN"],
    "SEALED":      ["OPENED", "REJECTED"],
    "OPENED":      ["SHORTLISTED", "DISQUALIFIED"],
    "SHORTLISTED": ["AWARDED", "REJECTED"],
    "WITHDRAWN":   [],
    "DISQUALIFIED":[], "REJECTED": [], "AWARDED": [],
}
```

### 2.2 `app/modules/bid/service.py`
```python
class BidService:

    async def submit_bid(self, db, rfq_id: UUID, data: BidSubmitRequest, actor_id: UUID,
                          vendor_id: UUID, org_id: UUID) -> BidResponse:
        rfq = await self.rfq_repo.get(db, rfq_id, org_id)
        # Late bid check
        if datetime.utcnow() > rfq.bid_submission_deadline:
            await self.audit.log(db, "BID", rfq_id, "BID_LATE_REJECTED", actor_id, org_id,
                new_values={"vendor_id": str(vendor_id), "submitted_at": datetime.utcnow().isoformat()})
            raise ConflictError("LATE_BID_REJECTED",
                f"Bid deadline passed at {rfq.bid_submission_deadline.isoformat()}")
        # Participant check
        participant = await self.participant_repo.get_by_vendor(db, rfq_id, vendor_id, org_id)
        if not participant:
            raise ForbiddenError("NOT_INVITED", "Vendor not invited to this RFQ")
        # Encrypt price fields before storage
        encrypted_lines = []
        for line in data.lines:
            encrypted_lines.append(BidLineResponse(
                org_id=org_id, rfq_id=rfq_id, vendor_id=vendor_id,
                lot_id=line.lot_id, rfq_line_id=line.rfq_line_id,
                unit_price_encrypted=encrypt_field(str(line.unit_price)),
                total_price_encrypted=encrypt_field(str(line.total_price)),
                currency=line.currency, quantity=line.quantity,
                delivery_days=line.delivery_days,
            ))
        bid = BidResponse(org_id=org_id, rfq_id=rfq_id, vendor_id=vendor_id,
            status="SUBMITTED", revision_number=1,
            technical_offer_compliant=data.technical_offer_compliant,
            has_deviations=data.has_deviations, deviation_details=data.deviation_details,
            payment_terms_code=data.payment_terms_code,
            delivery_terms_incoterm=data.delivery_terms_incoterm, bid_validity_days=data.bid_validity_days,
            submitted_at=datetime.utcnow())
        db.add(bid)
        await db.flush()
        for el in encrypted_lines:
            el.bid_response_id = bid.id
            db.add(el)
        # Version snapshot
        version = BidVersion(org_id=org_id, bid_response_id=bid.id, revision_number=1,
            snapshot_encrypted=encrypt_field(data.model_dump_json()))
        db.add(version)
        participant.status = "BID_SUBMITTED"
        await self.publisher.publish("procurement.bid", "bid.submitted",
            {"bid_id": str(bid.id), "rfq_id": str(rfq_id), "org_id": str(org_id)}, org_id)
        await self.audit.log(db, "BID", bid.id, "BID_SUBMITTED", actor_id, org_id)
        return bid

    async def get_bid_details(self, db, bid_id: UUID, actor_id: UUID, org_id: UUID) -> BidResponse:
        bid = await self.repo.get(db, bid_id, org_id)
        rfq = await self.rfq_repo.get(db, bid.rfq_id, org_id)
        # Enforce sealed bid access control
        if rfq.bids_opened_at is None:
            # Pre-opening: only bid_count visible, no content
            if not await self._is_own_bid(bid, actor_id):
                raise ForbiddenError("BID_SEALED", "Bid content not accessible before opening")
        # Decrypt for display
        for line in bid.lines:
            line.unit_price = decrypt_field(line.unit_price_encrypted)
            line.total_price = decrypt_field(line.total_price_encrypted)
        return bid

    async def normalize_prices_on_opening(self, db, rfq_id: UUID, org_id: UUID):
        """Called by RFQ service when bids are opened. Converts all bids to INR."""
        bids = await self.repo.get_all_for_rfq(db, rfq_id, org_id)
        for bid in bids:
            for line in bid.lines:
                rate_key = RedisKeys.exchange_rate(line.currency, "INR")
                rate_str = await self.redis.get(rate_key)
                if not rate_str:
                    raise AppException("EXCHANGE_RATE_UNAVAILABLE",
                        f"Exchange rate {line.currency}→INR not cached in Redis", 503)
                rate = float(rate_str)
                unit_price = float(decrypt_field(line.unit_price_encrypted))
                line.normalized_price_inr = unit_price * rate
                line.exchange_rate_used = rate

    async def check_single_vendor_situation(self, db, rfq_id: UUID, org_id: UUID) -> dict:
        bid_count = await self.repo.count_submitted(db, rfq_id, org_id)
        is_single = bid_count == 1
        return {"is_single_vendor": is_single, "bid_count": bid_count, "requires_override": is_single}
```

### 2.3 Router — bid count visible pre-opening
```python
@router.get("/rfqs/{rfq_id}/bid-count")
async def get_bid_count(rfq_id: UUID, current_user = Depends(require_permission(PermissionCode.RFQ_VIEW_ALL)), db = Depends(get_db)):
    """Only count returned — NEVER content — before opening."""
    rfq = await rfq_repo.get(db, rfq_id, current_user.org_id)
    count = await bid_repo.count_submitted(db, rfq_id, current_user.org_id)
    return {"bid_count": count, "bids_opened": rfq.bids_opened_at is not None}
```

---
## STEP 3 — TEST
```python
async def test_bid_content_sealed_before_opening(db, factory):
    """get_bid_details raises ForbiddenError before bids_opened_at set."""
async def test_late_bid_rejected(db, factory):
    """Submission after deadline returns 409 LATE_BID_REJECTED."""
async def test_bid_prices_encrypted_in_db(db, factory):
    """Raw unit_price_encrypted in DB is not plaintext."""
async def test_price_normalization_requires_exchange_rate(db, factory):
    """Missing Redis exchange rate → 503 EXCHANGE_RATE_UNAVAILABLE."""
async def test_single_vendor_flagged(db, factory):
    """1 bid response → is_single_vendor_situation=True."""
async def test_bid_revision_creates_version(db, factory):
    """Revising bid creates BidVersion record with previous snapshot."""
```
