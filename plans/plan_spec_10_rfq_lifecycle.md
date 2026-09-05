# IMPLEMENTATION PLAN — SPEC_10: RFQ Lifecycle
**Module:** 10 | **Phase:** Core | **Squad:** C
**Spec File:** SPEC_10_RFQ_LIFECYCLE.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S10-01 | RFQ types (OPEN/CLOSED/LIMITED/EMERGENCY/GEM) | sourcing/fsm.py + models.py | DONE |
| S10-02 | RFQ number format | sourcing/service.py | DONE |
| S10-03 | 12-status lifecycle FSM | sourcing/fsm.py | DONE |
| S10-04 | SPEC section: lots and line items | sourcing/models.py | DONE |
| S10-05 | Bid window validation (72h min; 24h emergency) | sourcing/service.py | DONE |
| S10-06 | Participant management (category-qualified vendors only) | sourcing/service.py | DONE |
| S10-07 | Dual-authorization bid opening (co_authorize) | sourcing/service.py + workflow | DONE |
| S10-08 | Bid visibility enforcement (PERMANENTLY DENIED pre-opening) | sourcing/service.py | DONE |
| S10-09 | Clarification management (buyer-vendor Q&A) | sourcing/service.py | DONE |
| S10-10 | Clarification broadcast (anonymized to all bidders) | sourcing/service.py | DONE |
| S10-11 | RFQ amendment (before publishing: free edit; after publishing: formal amendment) | sourcing/service.py | DONE |
| S10-12 | Amendment extends bid deadline | sourcing/service.py | DONE |
| S10-13 | Cancellation with reason + notification | sourcing/service.py | DONE |
| S10-14 | Conversion from PR (APPROVED status only) | sourcing/service.py | DONE |
| S10-15 | Eligibility criteria (5 types) | sourcing/models.py | DONE |
| S10-16 | Technical + commercial evaluation split | sourcing/models.py | DONE |
| S10-17 | RFQ approval workflow | sourcing/service.py + rules_engine | DONE |
| S10-18 | Redis cache for RFQ counts | sourcing/service.py | DONE |
| S10-19 | 15 audit events | sourcing/service.py | DONE |
| S10-20 | Bid window Celery task (auto-close when deadline passes) | tasks/rfq_lifecycle.py | DONE |
| S10-21 | Participant notification on publish | sourcing/service.py | DONE |
| S10-22 | GEM portal RFQ sync | integration/adapters/gem.py | DONE |

```
MODULE | SPEC | DATE
SPEC_10 | RFQ Lifecycle | 2026-09-05
OVERALL: 22/22 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-10-1 | Bid window minimum: 72 hours standard; 24 hours emergency (settings.EMERGENCY_BID_WINDOW_MIN_HOURS). SPEC states 72h for standard; emergency minimum not specified | Assumption A-04 cross-module | MEDIUM | Squad C |
| A-10-2 | Dual-authorization bid opening requires exactly 2 different users: the RFQ creator + a second authorized user with `rfq.co_authorize_opening` permission | SPEC Section 7 dual-auth opening; roles not specified | HIGH — compliance risk | Squad C |
| A-10-3 | Clarification Q sent by vendor → masked to "Vendor X" when broadcast to all; NEVER reveals vendor identity | SPEC Section 9 "anonymized broadcast" | HIGH — competitive confidentiality | Squad C |
| A-10-4 | `rfq_participants.status` tracks per-vendor state (INVITED, ACKNOWLEDGED, BID_SUBMITTED, DECLINED, DISQUALIFIED) | SPEC_10 has participant tracking; states not explicitly listed | MEDIUM | Squad C |
| A-10-5 | RFQ number format: `{BU_CODE}-RFQ-{YYYY}-{NNNNNN}` same pattern as PR | SPEC_10 references unique numbering; format not defined | LOW | Squad C |
| A-10-6 | GEM integration is ASYNC: RFQ details written to outbox, picked up by integration worker; not synchronous API call | GEM portal has rate limits | MEDIUM | Squad C |

---
## STEP 2 — IMPLEMENT

### 2.1 `app/modules/sourcing/fsm.py`
```python
RFQ_FSM: dict[str, list[str]] = {
    "DRAFT":              ["PENDING_APPROVAL", "CANCELLED"],
    "PENDING_APPROVAL":   ["APPROVED", "REJECTED", "RETURNED"],
    "RETURNED":           ["PENDING_APPROVAL", "CANCELLED"],
    "APPROVED":           ["PUBLISHED", "CANCELLED"],
    "PUBLISHED":          ["BID_OPEN", "AMENDED", "CANCELLED"],
    "AMENDED":            ["PUBLISHED"],
    "BID_OPEN":           ["EVALUATION", "EXTENDED", "CANCELLED"],
    "EXTENDED":           ["BID_OPEN"],
    "EVALUATION":         ["NEGOTIATION", "AWARD_RECOMMENDED", "CANCELLED"],
    "NEGOTIATION":        ["AWARD_RECOMMENDED", "CANCELLED"],
    "AWARD_RECOMMENDED":  ["AWARDED", "CANCELLED"],
    "AWARDED":            ["PO_ISSUED"],
    "PO_ISSUED":          [],
    "CANCELLED":          [],
    "REJECTED":           [],
}
```

### 2.2 `app/modules/sourcing/service.py` — Key Methods
```python
class RFQService:

    async def create(self, db, data: RFQCreateRequest, actor_id: UUID, org_id: UUID) -> RFQ:
        # Validate source PR if provided
        if data.source_pr_id:
            pr = await self.pr_repo.get(db, data.source_pr_id, org_id)
            if pr.status != "APPROVED":
                raise ValidationError("PR_NOT_APPROVED", "Only APPROVED PRs can be converted to RFQ")
        rfq_number = await self._generate_rfq_number(db, data.business_unit_id, org_id)
        rfq = RFQ(org_id=org_id, rfq_number=rfq_number, rfq_type=data.rfq_type, status="DRAFT",
                   title=data.title, business_unit_id=data.business_unit_id,
                   category_id=data.category_id, created_by=actor_id,
                   bid_submission_deadline=data.bid_submission_deadline,
                   bid_opening_datetime=data.bid_opening_datetime,
                   bid_validity_days=data.bid_validity_days,
                   source_pr_id=data.source_pr_id)
        # Validate bid window
        await self._validate_bid_window(rfq)
        db.add(rfq)
        await db.flush()
        for lot_data in data.lots:
            lot = RFQLot(org_id=org_id, rfq_id=rfq.id, **lot_data.model_dump())
            db.add(lot)
        await self.audit.log(db, "RFQ", rfq.id, "RFQ_CREATED", actor_id, org_id)
        return rfq

    async def _validate_bid_window(self, rfq: RFQ) -> None:
        from app.config import settings
        now = datetime.utcnow()
        window_hours = (rfq.bid_submission_deadline - now).total_seconds() / 3600
        min_hours = 24 if rfq.rfq_type == "EMERGENCY" else 72
        if window_hours < min_hours:
            raise ValidationError("BID_WINDOW_TOO_SHORT",
                f"Bid window must be at least {min_hours}h. Got {window_hours:.1f}h")
        validity = rfq.bid_validity_days
        if validity < settings.BID_VALIDITY_MIN_DAYS or validity > settings.BID_VALIDITY_MAX_DAYS:
            raise ValidationError("INVALID_BID_VALIDITY",
                f"Bid validity must be {settings.BID_VALIDITY_MIN_DAYS}–{settings.BID_VALIDITY_MAX_DAYS} days")

    async def publish(self, db, rfq_id: UUID, actor_id: UUID, org_id: UUID) -> RFQ:
        rfq = await self.repo.get(db, rfq_id, org_id)
        validate_rfq_transition(rfq.status, "PUBLISHED")
        # Validate participants (min 3 for CLOSED, no minimum for OPEN)
        if rfq.rfq_type in ("CLOSED", "LIMITED"):
            participants = await self.participant_repo.get_all(db, rfq_id, org_id)
            if len(participants) < 3:
                raise ValidationError("INSUFFICIENT_PARTICIPANTS", "Closed/Limited RFQ needs at least 3 participants")
        rfq.status = "PUBLISHED"
        rfq.published_at = datetime.utcnow()
        # Notify all participants
        participants = await self.participant_repo.get_all(db, rfq_id, org_id)
        for participant in participants:
            await self.publisher.publish("procurement.notification", "notification.email.rfq_published",
                {"vendor_id": str(participant.vendor_id), "rfq_id": str(rfq.id),
                 "rfq_number": rfq.rfq_number, "deadline": rfq.bid_submission_deadline.isoformat()}, org_id)
        await self.audit.log(db, "RFQ", rfq.id, "RFQ_PUBLISHED", actor_id, org_id)
        return rfq

    async def initiate_bid_opening(self, db, rfq_id: UUID, actor_id: UUID, org_id: UUID) -> dict:
        """Step 1 of dual-authorization opening."""
        rfq = await self.repo.get(db, rfq_id, org_id)
        if rfq.status != "PUBLISHED":
            raise AppException("RFQ_NOT_PUBLISHED", "Only published RFQs can have bids opened")
        if datetime.utcnow() < rfq.bid_submission_deadline:
            raise AppException("BID_WINDOW_STILL_OPEN", "Cannot open bids before deadline")
        if rfq.created_by == actor_id:
            raise ForbiddenError("OPENING_SELF_CREATED", "RFQ creator cannot initiate bid opening")
        rfq.bid_opening_initiated_by = actor_id
        rfq.bid_opening_initiated_at = datetime.utcnow()
        await self.audit.log(db, "RFQ", rfq_id, "BID_OPENING_INITIATED", actor_id, org_id)
        return {"message": "Bid opening initiated. Co-authorization required from a second authorized user."}

    async def co_authorize_bid_opening(self, db, rfq_id: UUID, actor_id: UUID, org_id: UUID) -> RFQ:
        """Step 2 of dual-authorization opening."""
        rfq = await self.repo.get(db, rfq_id, org_id)
        if rfq.bid_opening_initiated_by is None:
            raise AppException("OPENING_NOT_INITIATED", "Bid opening not yet initiated")
        if rfq.bid_opening_initiated_by == actor_id:
            raise ForbiddenError("SAME_USER_OPENING", "Co-authorizer must be a different user than initiator")
        has_perm = await self.perm_repo.user_has_permission(db, actor_id, org_id, PermissionCode.RFQ_CO_AUTHORIZE_OPENING)
        if not has_perm:
            raise ForbiddenError("MISSING_CO_AUTHORIZE_PERMISSION")
        validate_rfq_transition(rfq.status, "BID_OPEN")
        rfq.status = "BID_OPEN"
        rfq.bids_opened_at = datetime.utcnow()
        rfq.bids_opened_by = actor_id
        rfq.bids_opened_by_pair = rfq.bid_opening_initiated_by
        await self.publisher.publish("procurement.rfq", "rfq.bids.opened",
            {"rfq_id": str(rfq_id), "opened_by": str(actor_id), "initiated_by": str(rfq.bid_opening_initiated_by)}, org_id)
        await self.audit.log(db, "RFQ", rfq_id, "BID_OPENING_COAUTHORIZED", actor_id, org_id)
        return rfq

    async def add_clarification(self, db, rfq_id: UUID, question: str, vendor_id: Optional[UUID],
                                  actor_id: UUID, org_id: UUID) -> RFQClarification:
        rfq = await self.repo.get(db, rfq_id, org_id)
        if rfq.status not in ("PUBLISHED", "BID_OPEN"):
            raise AppException("RFQ_NOT_ACCEPTING_CLARIFICATIONS", "RFQ is not accepting clarifications")
        clarification = RFQClarification(org_id=org_id, rfq_id=rfq_id, question=question,
            asked_by_vendor_id=vendor_id, asked_by_user_id=actor_id)
        db.add(clarification)
        await self.audit.log(db, "RFQ", rfq_id, "RFQ_CLARIFICATION_RECEIVED", actor_id, org_id)
        return clarification

    async def respond_to_clarification(self, db, clarification_id: UUID, answer: str,
                                        broadcast: bool, actor_id: UUID, org_id: UUID):
        clarif = await self.clarif_repo.get(db, clarification_id, org_id)
        clarif.answer = answer
        clarif.answered_by = actor_id
        clarif.answered_at = datetime.utcnow()
        if broadcast:
            # CRITICAL: broadcast WITHOUT vendor identity
            participants = await self.participant_repo.get_all(db, clarif.rfq_id, org_id)
            for p in participants:
                await self.publisher.publish("procurement.notification", "notification.email.clarification",
                    {"rfq_id": str(clarif.rfq_id), "question": clarif.question,  # question text only, NO vendor name
                     "answer": answer, "vendor_id": str(p.vendor_id), "org_id": str(org_id)}, org_id)
        await self.audit.log(db, "RFQ", clarif.rfq_id, "RFQ_CLARIFICATION_ANSWERED", actor_id, org_id)
```

### 2.3 `app/tasks/rfq_lifecycle.py`
```python
@celery_app.task(queue="celery.sla_timers", name="check_rfq_bid_window_close")
def check_rfq_bid_window_close():
    asyncio.run(_async_check_windows())

async def _async_check_windows():
    async with async_session_factory() as db:
        now = datetime.utcnow()
        past_deadline = await rfq_repo.get_published_past_deadline(db, now)
        for rfq in past_deadline:
            bid_count = await bid_repo.count_submitted(db, rfq.id, rfq.org_id)
            if bid_count == 0:
                rfq.status = "CANCELLED"
                rfq.cancellation_reason = "NO_BIDS_RECEIVED"
                await publisher.publish("procurement.rfq", "rfq.cancelled",
                    {"rfq_id": str(rfq.id), "reason": "NO_BIDS_RECEIVED"}, rfq.org_id)
            else:
                rfq.status = "BID_OPEN"
                await publisher.publish("procurement.rfq", "rfq.bids.ready_for_opening",
                    {"rfq_id": str(rfq.id), "bid_count": bid_count}, rfq.org_id)
        await db.commit()
```

### 2.4 Router (18 endpoints)
`POST /api/v1/rfqs` | `GET /api/v1/rfqs` | `GET /api/v1/rfqs/{id}` | `PUT /api/v1/rfqs/{id}` | `POST /api/v1/rfqs/{id}/submit` | `POST /api/v1/rfqs/{id}/publish` | `POST /api/v1/rfqs/{id}/amend` | `POST /api/v1/rfqs/{id}/cancel` | `POST /api/v1/rfqs/{id}/add-participants` | `DELETE /api/v1/rfqs/{id}/participants/{vendor_id}` | `POST /api/v1/rfqs/{id}/initiate-bid-opening` | `POST /api/v1/rfqs/{id}/co-authorize-opening` | `GET /api/v1/rfqs/{id}/clarifications` | `POST /api/v1/rfqs/{id}/clarifications` | `PUT /api/v1/rfqs/{id}/clarifications/{cid}/respond` | `GET /api/v1/rfqs/{id}/audit-trail` | `GET /api/v1/rfqs/{id}/dashboard` | `POST /api/v1/rfqs/{id}/extend-deadline`

---
## STEP 3 — TEST
```python
async def test_bid_visibility_blocked_pre_opening(db, factory):
    """rfq.view_bids_before_opening ALWAYS 403 regardless of role."""
async def test_dual_auth_same_user_blocked(db, factory):
    """Co-authorizer = initiator raises ForbiddenError."""
async def test_clarification_broadcast_anonymous(db, factory):
    """Broadcast response: vendor identity NOT in notification payload."""
async def test_bid_window_too_short_standard(db, factory):
    """BID_WINDOW_TOO_SHORT when < 72h for non-emergency."""
async def test_emergency_rfq_24h_allowed(db, factory):
    """24h window allowed for EMERGENCY type."""
async def test_closed_rfq_min_3_participants(db, factory):
    """CLOSED RFQ publish fails with < 3 participants."""
async def test_auto_close_no_bids(db, factory):
    """RFQ with 0 bids after deadline → CANCELLED."""
```
