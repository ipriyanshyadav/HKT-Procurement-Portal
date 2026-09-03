# SPEC_10_RFQ_LIFECYCLE.md

## Title
Enterprise S2P Procurement Portal — RFQ Lifecycle

## Purpose
Define the complete RFQ lifecycle including creation wizard, business rules, timeline enforcement, bid sealing, amendments, cancellation, emergency path, single-vendor controls, edge cases, SourcingService class, and all RabbitMQ events.

## Scope
Covers 9-step wizard API, RFQ header schema, lot management, bidder eligibility, timeline validation, bid sealing mechanism, amendment flow, cancellation, emergency fast path, single-vendor controls, 15 edge cases, SourcingService interface, and all RFQ events.

## Dependencies
- SPEC_03_DATABASE.md (rfqs, rfq_lots, rfq_lines, rfq_participants, rfq_clarifications, rfq_amendments tables)
- SPEC_05_WORKFLOW_ENGINE.md (RFQ_APPROVAL template)
- SPEC_08_PURCHASE_REQUISITION.md (sourcing path from PR)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. RFQ Creation Wizard API

The RFQ is created through a 9-step transactional wizard. Each step saves progress server-side.

```
POST /api/v1/rfqs                          → Create draft (returns rfq_id)
PATCH /api/v1/rfqs/{rfq_id}/wizard/1       → Step 1: Basic Info
PATCH /api/v1/rfqs/{rfq_id}/wizard/2       → Step 2: Category & Procurement Type
PATCH /api/v1/rfqs/{rfq_id}/wizard/3       → Step 3: Lot Structure
PATCH /api/v1/rfqs/{rfq_id}/wizard/4       → Step 4: Line Items
PATCH /api/v1/rfqs/{rfq_id}/wizard/5       → Step 5: Commercial Terms
PATCH /api/v1/rfqs/{rfq_id}/wizard/6       → Step 6: Timeline & Deadlines
PATCH /api/v1/rfqs/{rfq_id}/wizard/7       → Step 7: Evaluation Criteria
PATCH /api/v1/rfqs/{rfq_id}/wizard/8       → Step 8: Bidder Selection
PATCH /api/v1/rfqs/{rfq_id}/wizard/9       → Step 9: Documents & Terms
POST /api/v1/rfqs/{rfq_id}/submit          → Submit for approval
```

Each step PATCH validates only that step's fields and updates `rfqs.wizard_step`. The final submit validates all steps are complete (`wizard_completed = true`) before transitioning to `PENDING_APPROVAL`.

---

## 2. RFQ Header Schema (All 22 Fields)

| Field | Type | Required | Validation | Step |
|---|---|---|---|---|
| `title` | VARCHAR(300) | Yes | min 10 chars | 1 |
| `description` | TEXT | Yes | min 50 chars | 1 |
| `rfq_type` | ENUM | Yes | One of 6 rfq_type values | 1 |
| `sourcing_type` | ENUM | Yes | One of 6 sourcing_type values | 2 |
| `evaluation_type` | ENUM | Yes | One of 4 evaluation_type values | 7 |
| `procurement_type` | ENUM | Yes | One of 5 procurement_type values | 2 |
| `buyer_id` | UUID | Yes (auto) | Must be current user or delegated | Auto |
| `business_unit_id` | UUID | Yes | User must have BU scope | 1 |
| `category_id` | UUID | Yes | Must be leaf category | 2 |
| `currency` | CHAR(3) | Yes | Must exist in currency_master | 5 |
| `estimated_value` | DECIMAL | Yes | > 0; computed from lines | 4 |
| `payment_term_id` | UUID | Yes | Must be active | 5 |
| `incoterm_id` | UUID | Yes | Must be active | 5 |
| `delivery_location_id` | UUID | Yes | Must be active | 5 |
| `bid_open_at` | TIMESTAMP | Yes | Must be future; after approval | 6 |
| `bid_close_at` | TIMESTAMP | Yes | Must be after bid_open_at; min bid window enforced | 6 |
| `technical_close_at` | TIMESTAMP | Conditional | Required if 2-envelope; must be before bid_close_at | 6 |
| `bid_validity_days` | INTEGER | Yes | Range 30–180 | 6 |
| `is_multi_lot` | BOOLEAN | No | Default false | 3 |
| `lot_participation_mode` | VARCHAR | Conditional | Required if multi-lot; MANDATORY_ALL or PARTIAL | 3 |
| `is_emergency` | BOOLEAN | No | Default false; requires emergency form fields | 1 |
| `is_single_vendor` | BOOLEAN | No | Default false; requires justification if true | 8 |

---

## 3. Lot Management

**Single-lot:** Default mode. All line items belong to one implicit lot. Bidders bid on all lines.

**Multi-lot:** `is_multi_lot = true`. Lines grouped into named lots via `rfq_lots`.

| Mode | `lot_participation_mode` | Bidder Behavior |
|---|---|---|
| Mandatory All | `MANDATORY_ALL` | Bidder must bid on every lot; partial submission rejected |
| Partial | `PARTIAL` | Bidder can choose which lots to bid on; each lot evaluated independently |

**Lot-level overrides:** Each lot can override the RFQ-level `payment_term_id` and `incoterm_id` via `rfq_lots.payment_term_override_id` and `rfq_lots.incoterm_override_id`.

**Multi-lot evaluation independence:** Each lot generates a separate ranking in the comparative statement. Award can differ by lot (vendor A wins lot 1, vendor B wins lot 2).

---

## 4. Bidder Eligibility Enforcement

Five eligibility checks run at `POST /api/v1/rfqs/{rfq_id}/bidders` (add bidder) and again at publication time:

| # | Check | Failure Response |
|---|---|---|
| 1 | Vendor status == ACTIVE | `VENDOR_NOT_ACTIVE`: Vendor must be in ACTIVE status |
| 2 | Vendor has category mapping for RFQ category AND `is_qualified = true` | `VENDOR_NOT_QUALIFIED`: Vendor not qualified for this category |
| 3 | Vendor not BLACKLISTED | `VENDOR_BLACKLISTED`: Vendor is blacklisted |
| 4 | No active COI declaration between buyer and vendor | `COI_CONFLICT`: Conflict of interest declared for this vendor |
| 5 | Vendor has at least one active contact with email | `VENDOR_NO_CONTACT`: Vendor has no active contact for bid notifications |

All checks are async DB queries. Failure returns the specific eligibility failure reason to the UI.

---

## 5. Timeline Validation

```python
async def _validate_timeline(self, rfq: RFQ, org_id: UUID):
    now = datetime.utcnow()
    holidays = await self.holiday_repo.get_holidays(db, org_id, rfq.business_unit_id)

    # bid_open_at must be in the future
    if rfq.bid_open_at <= now:
        raise AppException("INVALID_TIMELINE", "Bid open date must be in the future")

    # bid_close_at must be after bid_open_at
    if rfq.bid_close_at <= rfq.bid_open_at:
        raise AppException("INVALID_TIMELINE", "Bid close date must be after bid open date")

    # Minimum bid window: 5 business days for standard, 1 business day for emergency
    min_days = 1 if rfq.is_emergency else 5
    business_days = self._count_business_days(rfq.bid_open_at, rfq.bid_close_at, holidays)
    if business_days < min_days:
        raise AppException("INSUFFICIENT_BID_WINDOW", f"Minimum {min_days} business days required; got {business_days}")

    # 2-envelope: technical_close_at must be before commercial close
    if rfq.technical_close_at:
        if rfq.technical_close_at >= rfq.bid_close_at:
            raise AppException("INVALID_TIMELINE", "Technical close must be before commercial close")

    # Post-publication: only extension allowed (no shortening)
    if rfq.published_at and rfq.bid_close_at < rfq._original_bid_close_at:
        raise AppException("TIMELINE_SHORTENING", "Bid deadline can only be extended after publication")
```

---

## 6. Bid Sealing Mechanism (Phase 2)

```python
# app/modules/bid/sealing.py

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

class BidSealingService:
    async def generate_rfq_key(self, rfq_id: UUID) -> bytes:
        """Generate unique AES-256-GCM key for this RFQ. Store in MinIO key-vault."""
        key = AESGCM.generate_key(bit_length=256)
        await self.minio_client.put_object(
            bucket="key-vault",
            key=f"rfq-keys/{rfq_id}/sealing_key",
            data=key,
        )
        await self._audit("BID_SEALING_KEY_GENERATED", rfq_id)
        return key

    async def seal_bid(self, rfq_id: UUID, bid_data: bytes) -> bytes:
        """Encrypt bid payload using RFQ-specific key."""
        key = await self._get_key(rfq_id)
        aesgcm = AESGCM(key)
        nonce = os.urandom(12)
        encrypted = aesgcm.encrypt(nonce, bid_data, None)
        return nonce + encrypted

    async def unseal_bid(self, rfq_id: UUID, sealed_data: bytes) -> bytes:
        """Decrypt bid. Only callable via BidService.open_bids()."""
        key = await self._get_key(rfq_id)
        aesgcm = AESGCM(key)
        nonce = sealed_data[:12]
        ciphertext = sealed_data[12:]
        return aesgcm.decrypt(nonce, ciphertext, None)

    async def _get_key(self, rfq_id: UUID) -> bytes:
        """Retrieve key from MinIO key-vault. Audit logged."""
        key = await self.minio_client.get_object("key-vault", f"rfq-keys/{rfq_id}/sealing_key")
        await self._audit("BID_SEALING_KEY_RETRIEVED", rfq_id)
        return key
```

Key retrieval triggers an immutable audit event. The key is never accessible before the formal opening event — even to admins. The `BidService.open_bids()` method is the only code path that calls `unseal_bid()`, and it requires the `rfq.open_bids` permission plus co-authorization for high-value RFQs.

---

## 7. RFQ Amendment Flow

```
1. Buyer calls PATCH /api/v1/rfqs/{rfq_id}/amend
2. System validates RFQ is in PUBLISHED or BID_OPEN status
3. Amendment record created in rfq_amendments:
   - amendment_number incremented
   - field_changes JSONB stores before/after diff
   - changes_summary (human-readable)
4. RFQ.amendment_count incremented; RFQ.version incremented
5. If deadline changed: store previous and new bid_close_at
6. Bid reset policy:
   a. Default: all existing bids reset to DRAFT status (bids_reset = true)
   b. Admin waiver: if admin_waiver = true, bids retain SUBMITTED status (exceptional)
7. All bidders notified via procurement.rfq exchange (rfq.amended)
8. Deadline extended per policy (minimum 3 business days from amendment date if within 3 days of original close)
```

---

## 8. Cancellation Flow

```
1. Buyer calls POST /api/v1/rfqs/{rfq_id}/cancel
   Body: { "reason": "Budget reallocated to different project" }
2. Reason is mandatory
3. If estimated_value > cancellation_approval_threshold (tenant_settings):
   a. Create approval workflow task
   b. RFQ status → CANCELLED only after approval
4. If below threshold: immediate cancellation
5. Side effects:
   a. All invited bidders notified (rfq.cancelled event)
   b. All linked PRs released back to APPROVED status
   c. All workflow instances cancelled
   d. Audit log: RFQ_CANCELLED with reason, actor, timestamp
```

---

## 9. Emergency RFQ Fast Path

When `is_emergency = true`:

| Aspect | Standard RFQ | Emergency RFQ |
|---|---|---|
| Minimum bid window | 5 business days | 1 business day |
| Approval SLA | Standard (24–48h) | 4 hours total |
| Approval chain | Per rules engine | Parallel: HOD + Sourcing Manager simultaneously |
| Bidder minimum | 3 recommended | 1 acceptable |
| Required fields | Full wizard | Emergency declaration form + justification |
| Compliance flag | None | Weekly compliance review flag |

**Emergency declaration form fields:** `emergency_reason` (text, mandatory), `impact_if_delayed` (text, mandatory), `estimated_delay_days` (integer), `approved_by_hod` (boolean, must be true).

---

## 10. Single-Vendor Controls

When `is_single_vendor = true`:

1. **Hardcoded extra approval level:** Engine appends Compliance Officer step regardless of rules data
2. **Justification form:** `single_vendor_justification` (text, min 100 chars, mandatory), `supporting_documents` (at least 1 document upload required)
3. **Compliance reporting:** All single-vendor RFQs appear in weekly compliance report
4. **Minimum bidder override:** System allows 1 bidder (normally minimum is 3 recommended)

---

## 11. Edge Cases

| # | Scenario | System Response | Admin Override | Audit |
|---|---|---|---|---|
| 1 | Late bid submission (after deadline) | API returns 400 `BID_WINDOW_CLOSED`; bid not accepted | No override possible | `BID_LATE_ATTEMPT` logged |
| 2 | Abandoned draft RFQ (>30 days) | Celery task flags; admin notification | Admin can cancel or extend | `RFQ_ABANDONED_DRAFT` |
| 3 | Duplicate vendor in bidder list | API returns 409; vendor already invited | N/A | N/A |
| 4 | RFQ amendment after bids submitted | All bids reset to DRAFT; bidders re-submit | Admin waiver preserves bids | `RFQ_AMENDED_BIDS_RESET` |
| 5 | Missing approval rule for RFQ | RFQ enters `PENDING_RULE_RESOLUTION` | Admin creates rule or manual assignment | `RULE_RESOLUTION_REQUIRED` |
| 6 | ERP down during PO sync after award | PO created in portal with `SYNC_PENDING`; retry queue | Manual retry trigger | `ERP_SYNC_FAILED` |
| 7 | Buyer reassignment mid-RFQ | New buyer assigned; old buyer loses edit access | Admin action | `RFQ_BUYER_REASSIGNED` |
| 8 | Blacklisted vendor in active RFQ | RFQ moves to `COMPLIANCE_HOLD`; affected bids flagged | Admin reviews; excludes vendor; resumes RFQ | `RFQ_COMPLIANCE_HOLD` |
| 9 | Zero bids at deadline | RFQ status = `NO_BIDS`; buyer alerted; escalation chain | Buyer can re-tender or cancel | `RFQ_NO_BIDS` |
| 10 | Bid hash mismatch at opening | Bid flagged `INTEGRITY_FAIL`; admin alerted; opening report notes discrepancy | Admin can exclude or investigate | `BID_INTEGRITY_FAIL` |
| 11 | Clarification submitted after Q&A deadline | API returns 400 `CLARIFICATION_WINDOW_CLOSED` | Admin can reopen Q&A window | N/A |
| 12 | RFQ with 0 line items submitted | Validation error: minimum 1 line required | N/A | N/A |
| 13 | Budget exhausted between PR approval and RFQ creation | Warning displayed to buyer; RFQ creation allowed (budget was reserved at PR stage) | N/A | N/A |
| 14 | Concurrent RFQ amendments | Optimistic lock (`WHERE version = N`); second amendment gets 409 | Retry with fresh version | N/A |
| 15 | Vendor contact email bounced | Notification status = BOUNCED; buyer notified to update vendor contact | Buyer contacts vendor directly | `NOTIFICATION_BOUNCED` |

---

## 12. SourcingService Class

```python
class SourcingService:
    async def create_draft(self, db, data: RFQCreateRequest, actor: User, org_id: UUID) -> RFQ: ...
    async def update_wizard_step(self, db, rfq_id: UUID, step: int, data: dict, actor: User, org_id: UUID) -> RFQ: ...
    async def submit_for_approval(self, db, rfq_id: UUID, actor: User, org_id: UUID) -> RFQ: ...
    async def approve(self, db, rfq_id: UUID, task_id: UUID, actor: User, org_id: UUID) -> RFQ: ...
    async def publish(self, db, rfq_id: UUID, actor: User, org_id: UUID) -> RFQ: ...
    async def add_bidder(self, db, rfq_id: UUID, vendor_id: UUID, actor: User, org_id: UUID) -> RFQParticipant: ...
    async def remove_bidder(self, db, rfq_id: UUID, vendor_id: UUID, actor: User, org_id: UUID) -> None: ...
    async def submit_clarification(self, db, rfq_id: UUID, data: ClarificationRequest, actor: User, org_id: UUID) -> RFQClarification: ...
    async def answer_clarification(self, db, clarification_id: UUID, answer: str, actor: User, org_id: UUID) -> RFQClarification: ...
    async def publish_clarifications(self, db, rfq_id: UUID, actor: User, org_id: UUID) -> list[RFQClarification]: ...
    async def amend(self, db, rfq_id: UUID, data: RFQAmendRequest, actor: User, org_id: UUID) -> RFQ: ...
    async def cancel(self, db, rfq_id: UUID, reason: str, actor: User, org_id: UUID) -> RFQ: ...
    async def reassign_buyer(self, db, rfq_id: UUID, new_buyer_id: UUID, actor: User, org_id: UUID) -> RFQ: ...
    async def get_rfq_detail(self, db, rfq_id: UUID, org_id: UUID) -> RFQDetail: ...
    async def list_rfqs(self, db, org_id: UUID, filters: RFQFilterParams, pagination: PaginationParams) -> PaginatedResult: ...
```

---

## 13. RabbitMQ Events

| Event | Exchange | Routing Key | Payload |
|---|---|---|---|
| RFQ created | `procurement.rfq` | `rfq.created` | `{rfq_id, rfq_number, buyer_id, category_id}` |
| RFQ submitted for approval | `procurement.rfq` | `rfq.submitted` | `{rfq_id, rfq_number, estimated_value}` |
| RFQ approved | `procurement.rfq` | `rfq.approved` | `{rfq_id, rfq_number, approved_by}` |
| RFQ published | `procurement.rfq` | `rfq.published` | `{rfq_id, rfq_number, bidder_count, bid_open_at, bid_close_at}` |
| RFQ amended | `procurement.rfq` | `rfq.amended` | `{rfq_id, rfq_number, amendment_number, changes_summary, bids_reset}` |
| RFQ cancelled | `procurement.rfq` | `rfq.cancelled` | `{rfq_id, rfq_number, reason, cancelled_by}` |
| Bid window opened | `procurement.rfq` | `rfq.bid_window_opened` | `{rfq_id, bid_open_at}` |
| Bid window closed | `procurement.rfq` | `rfq.bid_window_closed` | `{rfq_id, bid_close_at, bid_count}` |
| Bids opened | `procurement.rfq` | `rfq.bids_opened` | `{rfq_id, opened_by, co_authorized_by, bid_count, all_hashes_verified}` |
| RFQ compliance hold | `procurement.rfq` | `rfq.compliance_hold` | `{rfq_id, reason, vendor_id}` |
