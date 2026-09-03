# SPEC_11_BID_MANAGEMENT.md

## Title
Enterprise S2P Procurement Portal — Bid Management

## Purpose
Define the bid submission portal, technical and commercial bid forms, sealing, versioning, hash integrity, opening console, co-authorization, and all bid integrity controls.

## Scope
Covers supplier bid portal flow, commercial bid schema, draft autosave, bid submission with SHA-256 hashing, bid editing and versioning, server-side deadline enforcement, bid hash verification, technical bid (2-envelope), bid opening console with co-authorization, zero-bid scenario, and BidService class.

## Dependencies
- SPEC_03_DATABASE.md (bid_responses, bid_line_responses, bid_versions, bid_documents tables)
- SPEC_10_RFQ_LIFECYCLE.md (RFQ states, bidder eligibility, bid sealing mechanism)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. Supplier Bid Portal Flow

```
1. Supplier logs in → Invitation Inbox shows open RFQ invitations
2. Supplier views RFQ details (description, lots, lines, documents, timeline, clarifications)
3. Supplier clicks "Accept" → bid_responses.status = ACCEPTED; invitation_status = ACCEPTED
   OR Supplier clicks "Regret" → status = REGRETTED; regret_reason stored
4. If 2-envelope: Supplier fills technical bid form first → uploads technical documents
5. Supplier fills commercial bid form (line-by-line pricing)
6. Supplier saves draft (auto + manual) → server-side persistence
7. Supplier previews bid summary (all lines, totals, documents)
8. Supplier clicks "Submit" → validation → SHA-256 hash → seal → status = SUBMITTED
```

---

## 2. Commercial Bid Schema

```python
# app/modules/bid/schemas.py

class BidLineRequest(BaseModel):
    rfq_line_id: UUID
    lot_id: Optional[UUID] = None
    unit_price: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    tax_rate_declared: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)
    freight_quoted: Decimal = Field(ge=0, max_digits=18, decimal_places=2)
    delivery_lead_time_days: int = Field(ge=1, le=365)
    country_of_origin: str = Field(default="IN", pattern="^[A-Z]{2}$")
    remarks: Optional[str] = Field(None, max_length=500)

class LotDiscountRequest(BaseModel):
    lot_id: UUID
    discount_percentage: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)
    discount_conditions: Optional[str] = Field(None, max_length=500)

class BidSubmitRequest(BaseModel):
    bid_validity_date: date
    covering_letter: Optional[str] = Field(None, max_length=5000)
    lines: list[BidLineRequest] = Field(min_length=1)
    lot_discounts: Optional[list[LotDiscountRequest]] = None
    payment_terms_proposed_id: Optional[UUID] = None
    commercial_deviations: Optional[str] = Field(None, max_length=3000)

    @field_validator("bid_validity_date")
    @classmethod
    def validate_validity(cls, v):
        if v < date.today() + timedelta(days=30):
            raise ValueError("Bid validity must be at least 30 days from today")
        return v
```

---

## 3. Bid Draft Autosave

**Server-side autosave** — not localStorage. The frontend sends periodic saves to the server.

```
PATCH /api/v1/bids/{bid_id}/draft
Content-Type: application/json

{
  "lines": [ ... partial line data ... ],
  "covering_letter": "Draft text...",
  "payment_terms_proposed_id": "uuid or null"
}

Response (200):
{
  "saved_at": "2026-06-27T15:30:00Z",
  "bid_id": "uuid",
  "status": "DRAFT"
}
```

**Autosave interval:** Frontend calls this endpoint every 30 seconds (debounced). Draft data survives browser close, device switch, and session timeout. On re-login, the supplier resumes from the last saved state.

**Frontend hook:** `useAutosave(bidId, data, saveFn)` — custom React hook that debounces at 30s, tracks dirty state, and shows "Draft saved at HH:MM" indicator.

---

## 4. Bid Submission with SHA-256 Hashing

```python
# app/modules/bid/service.py

async def submit_bid(
    self, db: AsyncSession, bid_id: UUID, data: BidSubmitRequest,
    actor: User, org_id: UUID
) -> BidResponse:
    bid = await self.repo.get(db, bid_id, org_id)
    rfq = await self.rfq_repo.get(db, bid.rfq_id, org_id)

    # 1. Server-side deadline enforcement
    now = datetime.utcnow()
    if now > rfq.bid_close_at:
        raise AppException("BID_WINDOW_CLOSED", "Bid submission deadline has passed", 400)

    # 2. Validate all lines match RFQ lines
    rfq_line_ids = {line.id for line in await self.rfq_line_repo.get_lines(db, rfq.id, org_id)}
    submitted_line_ids = {line.rfq_line_id for line in data.lines}
    if submitted_line_ids != rfq_line_ids:
        missing = rfq_line_ids - submitted_line_ids
        raise AppException("INCOMPLETE_BID", f"Missing lines: {missing}")

    # 3. Save line responses
    for line_data in data.lines:
        bid_line = BidLineResponse(
            org_id=org_id, bid_id=bid.id,
            rfq_line_id=line_data.rfq_line_id,
            lot_id=line_data.lot_id,
            unit_price=line_data.unit_price,
            tax_rate_declared=line_data.tax_rate_declared,
            freight_quoted=line_data.freight_quoted,
            delivery_lead_time_days=line_data.delivery_lead_time_days,
            country_of_origin=line_data.country_of_origin,
        )
        db.add(bid_line)

    # 4. Compute SHA-256 hash of entire bid payload
    bid_payload = data.model_dump_json(sort_keys=True)
    bid_hash = hashlib.sha256(bid_payload.encode()).hexdigest()

    # 5. Update bid record
    bid.status = BidStatus.SUBMITTED
    bid.bid_validity_date = data.bid_validity_date
    bid.covering_letter = data.covering_letter
    bid.payment_terms_proposed_id = data.payment_terms_proposed_id
    bid.commercial_deviations = data.commercial_deviations
    bid.total_amount = sum(l.unit_price * rfq_line_qty[l.rfq_line_id] for l in data.lines)
    bid.bid_hash = bid_hash
    bid.bid_sealed_at = now
    bid.submitted_at = now

    # 6. Audit log with hash
    await self._audit(db, bid, "BID_SUBMITTED", actor, org_id, extra={"bid_hash": bid_hash})

    # 7. Publish event
    await self.publisher.publish("procurement.bid", "bid.submitted",
        {"bid_id": str(bid.id), "rfq_id": str(rfq.id), "vendor_id": str(bid.vendor_id), "bid_hash": bid_hash}, org_id)

    return bid
```

---

## 5. Bid Editing Before Deadline

```python
async def reopen_bid(
    self, db: AsyncSession, bid_id: UUID, actor: User, org_id: UUID
) -> BidResponse:
    """Reopen a submitted bid for editing. Archives current version."""
    bid = await self.repo.get(db, bid_id, org_id)
    rfq = await self.rfq_repo.get(db, bid.rfq_id, org_id)

    # Deadline check
    if datetime.utcnow() > rfq.bid_close_at:
        raise AppException("BID_WINDOW_CLOSED", "Cannot reopen bid after deadline")

    if bid.status != BidStatus.SUBMITTED:
        raise AppException("INVALID_STATE", "Only SUBMITTED bids can be reopened")

    # Archive current version
    version_data = await self._snapshot_bid(db, bid)
    bid_version = BidVersion(
        org_id=org_id, bid_id=bid.id,
        version_number=bid.current_version,
        version_data=version_data,
        bid_hash=bid.bid_hash,
    )
    db.add(bid_version)

    # Reset bid to DRAFT
    bid.status = BidStatus.DRAFT
    bid.current_version += 1
    bid.bid_hash = None
    bid.bid_sealed_at = None

    await self._audit(db, bid, "BID_REOPENED", actor, org_id)
    await self.publisher.publish("procurement.bid", "bid.reopened",
        {"bid_id": str(bid.id), "version": bid.current_version}, org_id)

    return bid
```

---

## 6. Server-Side Deadline Enforcement

The bid submission endpoint uses `datetime.utcnow()` at the API layer. No client-supplied timestamps are accepted for deadline comparison.

**Race condition handling:** If multiple concurrent submissions arrive near the deadline, each request independently checks `rfq.bid_close_at` against the server clock. The DB `bid_close_at` is the single source of truth. No client-side countdown is trusted.

---

## 7. Bid Hash Verification at Opening

```python
async def verify_bid_integrity(self, db: AsyncSession, bid: BidResponse, org_id: UUID) -> bool:
    """Recompute bid hash from stored data and compare with stored hash."""
    # Reconstruct the exact payload that was hashed at submission
    lines = await self.line_repo.get_lines(db, bid.id, org_id)
    payload = {
        "bid_validity_date": bid.bid_validity_date.isoformat(),
        "covering_letter": bid.covering_letter,
        "lines": sorted([{
            "rfq_line_id": str(l.rfq_line_id),
            "unit_price": str(l.unit_price),
            "tax_rate_declared": str(l.tax_rate_declared),
            "freight_quoted": str(l.freight_quoted),
            "delivery_lead_time_days": l.delivery_lead_time_days,
            "country_of_origin": l.country_of_origin,
        } for l in lines], key=lambda x: x["rfq_line_id"]),
        "payment_terms_proposed_id": str(bid.payment_terms_proposed_id) if bid.payment_terms_proposed_id else None,
        "commercial_deviations": bid.commercial_deviations,
    }
    recomputed_hash = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()

    if recomputed_hash != bid.bid_hash:
        bid.status = BidStatus.INTEGRITY_FAIL
        await self._audit(db, bid, "BID_INTEGRITY_FAIL", None, org_id,
            extra={"stored_hash": bid.bid_hash, "recomputed_hash": recomputed_hash})
        await self.publisher.publish("procurement.alert", "alert.bid_integrity_fail",
            {"bid_id": str(bid.id), "rfq_id": str(bid.rfq_id)}, org_id)
        return False

    return True
```

---

## 8. Technical Bid (2-Envelope)

For RFQs with `evaluation_type` in (`QCBS_QUALITY_COST`, `TECHNICAL_MERIT`):

1. **Separate form:** Technical bid submitted via `POST /api/v1/bids/{bid_id}/technical`
2. **Separate submission endpoint:** Technical documents uploaded; technical form fields saved
3. **Commercial bid locked:** The commercial bid form is inaccessible until technical bid is submitted
4. **Technical evaluators assigned** by the buyer before commercial unsealing (via `EvaluationService.assign_technical_evaluators`)
5. **Commercial NOT revealed** until:
   a. Technical evaluation completed for all bids
   b. Technically-qualified list finalized and approved
   c. Only then is `POST /api/v1/rfqs/{rfq_id}/open-commercial-bids` available
6. **Sequence enforcement:** API blocks `open-commercial-bids` if technical evaluation is not in `COMPLETED` status

---

## 9. Bid Opening Console

```python
async def open_bids(
    self, db: AsyncSession, rfq_id: UUID, actor: User, org_id: UUID,
    co_authorizer_id: Optional[UUID] = None
) -> BidOpeningReport:
    rfq = await self.rfq_repo.get(db, rfq_id, org_id)

    # 1. Validate deadline passed
    if datetime.utcnow() < rfq.bid_close_at:
        raise AppException("BID_WINDOW_OPEN", "Cannot open bids before deadline")

    # 2. Validate permission
    if not await self._has_permission(actor, "rfq.open_bids"):
        raise ForbiddenError("INSUFFICIENT_PERMISSION", "rfq.open_bids required")

    # 3. Co-authorization for high-value RFQs
    if rfq.requires_co_authorization:
        if not co_authorizer_id:
            raise AppException("CO_AUTH_REQUIRED", "High-value RFQ requires co-authorization")
        co_auth = await self.co_auth_repo.get(db, rfq_id, co_authorizer_id, org_id)
        if not co_auth or not co_auth.confirmed:
            raise AppException("CO_AUTH_NOT_CONFIRMED", "Co-authorizer has not confirmed")
        if co_authorizer_id == actor.id:
            raise AppException("CO_AUTH_SAME_USER", "Opening officer and co-authorizer must be different users")

    # 4. Unseal bids (Phase 2: decrypt; Phase 1: just verify hashes)
    bids = await self.repo.get_submitted_bids(db, rfq_id, org_id)
    opening_results = []
    for bid in bids:
        hash_valid = await self.verify_bid_integrity(db, bid, org_id)
        bid.bid_opened_at = datetime.utcnow()
        bid.status = BidStatus.OPENED if hash_valid else BidStatus.INTEGRITY_FAIL
        opening_results.append({
            "vendor_id": str(bid.vendor_id),
            "bid_hash": bid.bid_hash,
            "hash_verified": hash_valid,
            "total_amount": str(bid.total_amount),
        })

    # 5. Update RFQ
    rfq.status = RFQStatus.BIDS_OPENED
    rfq.bids_opened_at = datetime.utcnow()
    rfq.bids_opened_by = actor.id
    rfq.co_authorized_by = co_authorizer_id

    # 6. Generate opening report PDF
    report_pdf = await self._generate_opening_report(rfq, opening_results, actor, co_authorizer_id)
    doc = await self.doc_service.store_document(db, report_pdf, "audit-documents", "BID_OPENING_REPORT", rfq_id, org_id)

    # 7. Audit
    await self._audit(db, rfq, "BIDS_OPENED", actor, org_id, extra={
        "bid_count": len(bids),
        "all_hashes_verified": all(r["hash_verified"] for r in opening_results),
        "co_authorizer": str(co_authorizer_id) if co_authorizer_id else None,
    })

    # 8. Publish event
    await self.publisher.publish("procurement.rfq", "rfq.bids_opened", {
        "rfq_id": str(rfq.id), "bid_count": len(bids),
        "opened_by": str(actor.id), "co_authorized_by": str(co_authorizer_id),
    }, org_id)

    return BidOpeningReport(rfq=rfq, results=opening_results, report_document_id=doc.id)
```

**Co-authorization flow:**
1. Primary officer requests opening → system checks `rfq.requires_co_authorization`
2. If required: `POST /api/v1/rfqs/{rfq_id}/co-authorize-opening` sent to second authorized user
3. Second user confirms → `co_authorization_confirmed = true`
4. Primary officer can now proceed with opening

---

## 10. Zero-Bid Scenario

```python
# Celery task: check_bid_windows (runs every 5 minutes)

async def check_bid_windows():
    rfqs = await rfq_repo.get_rfqs_past_deadline_not_opened(db)
    for rfq in rfqs:
        bid_count = await bid_repo.count_submitted_bids(db, rfq.id, rfq.org_id)
        if bid_count == 0:
            rfq.status = RFQStatus.NO_BIDS
            await publisher.publish("procurement.rfq", "rfq.bid_window_closed",
                {"rfq_id": str(rfq.id), "bid_count": 0}, rfq.org_id)
            # Escalation chain: 4h → buyer reminder, 8h → SM, 24h → PH
```

---

## 11. BidService Class

```python
class BidService:
    async def accept_invitation(self, db, rfq_id: UUID, actor: User, org_id: UUID) -> BidResponse: ...
    async def regret_invitation(self, db, rfq_id: UUID, reason: str, actor: User, org_id: UUID) -> BidResponse: ...
    async def save_draft(self, db, bid_id: UUID, data: dict, actor: User, org_id: UUID) -> BidResponse: ...
    async def submit_bid(self, db, bid_id: UUID, data: BidSubmitRequest, actor: User, org_id: UUID) -> BidResponse: ...
    async def submit_technical_bid(self, db, bid_id: UUID, data: TechnicalBidRequest, actor: User, org_id: UUID) -> BidResponse: ...
    async def reopen_bid(self, db, bid_id: UUID, actor: User, org_id: UUID) -> BidResponse: ...
    async def withdraw_bid(self, db, bid_id: UUID, actor: User, org_id: UUID) -> BidResponse: ...
    async def open_bids(self, db, rfq_id: UUID, actor: User, org_id: UUID, co_authorizer_id: UUID) -> BidOpeningReport: ...
    async def verify_bid_integrity(self, db, bid: BidResponse, org_id: UUID) -> bool: ...
    async def get_bid_detail(self, db, bid_id: UUID, actor: User, org_id: UUID) -> BidDetail: ...
    async def list_bids_for_rfq(self, db, rfq_id: UUID, actor: User, org_id: UUID) -> list[BidSummary]: ...
    async def compute_bid_hash(self, data: BidSubmitRequest) -> str: ...
```
