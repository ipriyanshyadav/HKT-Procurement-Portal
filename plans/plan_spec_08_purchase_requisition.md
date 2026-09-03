# IMPLEMENTATION PLAN — SPEC_08: Purchase Requisition
**Module:** 08 | **Phase:** Core | **Squad:** B
**Spec File:** SPEC_08_PURCHASE_REQUISITION.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S08-01 | PR number auto-generation (BU-scoped, year-reset) | requisition/service.py + DB sequence | PLANNED |
| S08-02 | Draft → Submitted → Approved/Rejected FSM (10 states) | requisition/fsm.py | PLANNED |
| S08-03 | PR line items (UOM, HSN, category, multi-delivery) | requisition/models.py | PLANNED |
| S08-04 | Budget check integration (soft/hard blocks) | requisition/service.py | PLANNED |
| S08-05 | ERP material master lookup & catalog fallback | requisition/service.py | PLANNED |
| S08-06 | Merge PRs (same BU + category, BUYER perm) | requisition/service.py | PLANNED |
| S08-07 | Split PR (line-level, BUYER perm) | requisition/service.py | PLANNED |
| S08-08 | PR amendment (post-approval, resets to DRAFT) | requisition/service.py | PLANNED |
| S08-09 | PR aging alerts (7/14/30 day Celery task) | tasks/pr_aging.py | PLANNED |
| S08-10 | Withdrawal (only by creator, DRAFT/SUBMITTED) | requisition/service.py | PLANNED |
| S08-11 | Conversion to RFQ / PO (direct award) | requisition/service.py | PLANNED |
| S08-12 | PR visibility scoping (own/BU/all) | requisition/router.py | PLANNED |
| S08-13 | Redis cache for PR count by org+status | requisition/service.py | PLANNED |
| S08-14 | 11 audit events | requisition/service.py | PLANNED |
| S08-15 | Approval workflow trigger on submit | requisition/service.py + workflow | PLANNED |
| S08-16 | Pydantic schemas (Create, Update, Response, LineItem) | requisition/schemas.py | PLANNED |

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-08-1 | PR number format: `{BU_CODE}-PR-{YYYY}-{NNNNNN}` using PostgreSQL sequence `seq_pr_{bu_code}_{year}` | SPEC references BU-scoped, year-reset numbering | MEDIUM — sequence creation per new BU/year | Squad B |
| A-08-2 | Merge restricted to BUYER role with pr.merge permission; maximum 10 PRs per merge | SPEC_08 Section 5; no merge limit stated | LOW | Squad B |
| A-08-3 | Budget check is advisory (SOFT) by default; HARD block enabled per org setting in tenant_settings | SPEC_08 Section 4 mentions configurable; no default stated | MEDIUM | Squad B |
| A-08-4 | PR aging Celery task runs at 7:00 AM org timezone; timezone stored in tenant_settings.timezone | SPEC references business-hours alert; no time specified | LOW | Squad B |
| A-08-5 | PR cache (Redis) TTL is 5 minutes; invalidated on any PR status change in that org | SPEC_08 Section 13 mentions Redis cache | LOW | Squad B |
| A-08-6 | `requisition_lines.estimated_unit_price` nullable — free-text items need no price | SPEC allows non-catalog items | LOW | Squad B |

---
## STEP 2 — IMPLEMENT

### 2.1 `app/modules/requisition/fsm.py`
```python
PR_FSM: dict[str, list[str]] = {
    "DRAFT":           ["SUBMITTED", "WITHDRAWN"],
    "SUBMITTED":       ["PENDING_APPROVAL", "WITHDRAWN"],
    "PENDING_APPROVAL":["APPROVED", "REJECTED", "RETURNED"],
    "RETURNED":        ["SUBMITTED", "WITHDRAWN"],
    "APPROVED":        ["CONVERTED_TO_RFQ", "CONVERTED_TO_PO", "PARTIALLY_CONVERTED", "AMENDED", "CANCELLED"],
    "REJECTED":        [],
    "WITHDRAWN":       [],
    "CONVERTED_TO_RFQ":[],
    "CONVERTED_TO_PO": [],
    "PARTIALLY_CONVERTED": ["CONVERTED_TO_RFQ", "CONVERTED_TO_PO"],
    "AMENDED":         ["SUBMITTED"],
    "CANCELLED":       [],
}
def validate_pr_transition(current: str, target: str) -> None:
    allowed = PR_FSM.get(current, [])
    if target not in allowed:
        raise AppException("INVALID_PR_TRANSITION", f"Cannot transition PR from {current} to {target}", 409, {"allowed": allowed})
```

### 2.2 `app/modules/requisition/service.py` — Key Methods
```python
class RequisitionService:

    async def create(self, db, data: PRCreateRequest, actor_id: UUID, org_id: UUID) -> Requisition:
        pr_number = await self._generate_pr_number(db, data.business_unit_id, org_id)
        pr = Requisition(
            org_id=org_id, pr_number=pr_number, title=data.title,
            business_unit_id=data.business_unit_id, requested_by=actor_id,
            requested_for=data.requested_for_user_id or actor_id,
            requirement_type=data.requirement_type, is_capex=data.is_capex,
            category_id=data.category_id, status="DRAFT",
        )
        db.add(pr)
        await db.flush()
        for line_data in data.lines:
            line = RequisitionLine(
                org_id=org_id, requisition_id=pr.id,
                line_number=line_data.line_number, description=line_data.description,
                quantity=line_data.quantity, uom_id=line_data.uom_id,
                category_id=line_data.category_id or data.category_id,
                estimated_unit_price=line_data.estimated_unit_price,
                hsn_sac_code=line_data.hsn_sac_code,
                required_by=line_data.required_by,
                delivery_location_id=line_data.delivery_location_id,
            )
            db.add(line)
        await self._invalidate_pr_cache(org_id)
        await self.audit.log(db, "REQUISITION", pr.id, "PR_CREATED", actor_id, org_id,
            new_values={"pr_number": pr_number, "status": "DRAFT"})
        return pr

    async def submit(self, db, pr_id: UUID, actor_id: UUID, org_id: UUID) -> Requisition:
        pr = await self.repo.get(db, pr_id, org_id)
        if pr.requested_by != actor_id:
            raise ForbiddenError("NOT_PR_OWNER", "Only PR creator can submit")
        validate_pr_transition(pr.status, "SUBMITTED")
        # Budget check
        await self._check_budget(db, pr, org_id)
        pr.status = "PENDING_APPROVAL"
        pr.submitted_at = datetime.utcnow()
        # Find matching approval rule
        entity_context = {
            "amount": float(pr.estimated_total), "bu_id": str(pr.business_unit_id),
            "category_id": str(pr.category_id), "is_capex": pr.is_capex,
            "requirement_type": pr.requirement_type,
        }
        rule = await self.rules_engine.find_matching_rule(db, "PR", entity_context, org_id)
        if not rule:
            pr.status = "PENDING_RULE_RESOLUTION"
            await self.audit.log(db, "REQUISITION", pr.id, "PR_RULE_UNMATCHED", actor_id, org_id)
            return pr
        await self.workflow_engine.instantiate(db, rule.workflow_template_code,
            "REQUISITION", pr.id, entity_context, org_id, actor_id)
        await self.audit.log(db, "REQUISITION", pr.id, "PR_SUBMITTED", actor_id, org_id)
        await self._invalidate_pr_cache(org_id)
        return pr

    async def merge_prs(self, db, pr_ids: list[UUID], actor_id: UUID, org_id: UUID) -> Requisition:
        if len(pr_ids) < 2:
            raise ValidationError("MERGE_REQUIRES_TWO", "At least 2 PRs required for merge")
        prs = [await self.repo.get(db, pid, org_id) for pid in pr_ids]
        # Validate all DRAFT, same BU, same category
        bu_ids = {str(p.business_unit_id) for p in prs}
        cat_ids = {str(p.category_id) for p in prs}
        if len(bu_ids) > 1:
            raise ValidationError("MERGE_DIFFERENT_BU", "All PRs must belong to same business unit")
        if len(cat_ids) > 1:
            raise ValidationError("MERGE_DIFFERENT_CATEGORY", "All PRs must belong to same category")
        # Create merged PR; move all lines; soft delete originals
        merged = await self.create(db, PRCreateRequest(
            title=f"Merged PR - {datetime.utcnow().strftime('%Y%m%d')}",
            business_unit_id=prs[0].business_unit_id, category_id=prs[0].category_id,
            lines=[], is_capex=any(p.is_capex for p in prs),
        ), actor_id, org_id)
        for pr in prs:
            for line in pr.lines:
                line.requisition_id = merged.id
                line.line_number = None  # Renumber after merge
            validate_pr_transition(pr.status, "WITHDRAWN")
            pr.status = "WITHDRAWN"; pr.deleted_at = datetime.utcnow()
        # Renumber lines
        for i, line in enumerate(sorted(merged.lines, key=lambda l: l.created_at), 1):
            line.line_number = i
        await self.audit.log(db, "REQUISITION", merged.id, "PR_MERGED", actor_id, org_id,
            new_values={"source_pr_ids": [str(p.id) for p in prs]})
        return merged

    async def _generate_pr_number(self, db, bu_id: UUID, org_id: UUID) -> str:
        bu = await self.bu_repo.get(db, bu_id, org_id)
        year = datetime.utcnow().year
        seq_name = f"seq_pr_{bu.code.lower()}_{year}"
        result = await db.execute(text(f"SELECT nextval(:seq)", {"seq": seq_name}))
        n = result.scalar()
        return f"{bu.code}-PR-{year}-{str(n).zfill(6)}"

    async def _invalidate_pr_cache(self, org_id: UUID):
        for status in ["DRAFT", "SUBMITTED", "PENDING_APPROVAL", "APPROVED"]:
            await self.redis.delete(RedisKeys.pr_count_cache(org_id, status))
```

### 2.3 Router (12 endpoints)
- `POST /api/v1/requisitions` — create (pr.create)
- `GET /api/v1/requisitions` — list with scope filter
- `GET /api/v1/requisitions/{id}`
- `PUT /api/v1/requisitions/{id}` — update draft
- `POST /api/v1/requisitions/{id}/submit`
- `POST /api/v1/requisitions/{id}/withdraw`
- `POST /api/v1/requisitions/{id}/amend`
- `POST /api/v1/requisitions/merge` — body: {pr_ids: []}
- `POST /api/v1/requisitions/{id}/split` — body: {lines: {}}
- `POST /api/v1/requisitions/{id}/convert-to-rfq`
- `POST /api/v1/requisitions/{id}/convert-to-po`
- `GET /api/v1/requisitions/{id}/audit-trail`

### 2.4 `app/tasks/pr_aging.py`
```python
@celery_app.task(queue="celery.sla_timers", name="check_pr_aging_alerts")
def check_pr_aging_alerts():
    asyncio.run(_async_check_aging())

async def _async_check_aging():
    for threshold_days in settings.PR_AGING_ALERT_DAYS:
        check_date = datetime.utcnow() - timedelta(days=threshold_days)
        aging_prs = await req_repo.get_pending_prs_older_than(db, check_date)
        for pr in aging_prs:
            await publisher.publish("procurement.pr", "pr.aging.alert",
                {"pr_id": str(pr.id), "pr_number": pr.pr_number,
                 "days_pending": threshold_days, "org_id": str(pr.org_id)}, pr.org_id)
```

---
## STEP 3 — TEST
```python
async def test_pr_number_format(db, factory):
    pr = await req_service.create(db, data, actor_id, org_id)
    assert re.match(r'^[A-Z]+-PR-\d{4}-\d{6}$', pr.pr_number)

async def test_merge_requires_same_bu(db, factory):
    """PRs from different BUs cannot merge."""

async def test_merge_requires_same_category(db, factory):
    """PRs from different categories cannot merge."""

async def test_submit_triggers_workflow(db, factory):
    """Submit creates WorkflowInstance with correct template."""

async def test_pr_rule_unmatched_status(db, factory):
    """No matching rule → status becomes PENDING_RULE_RESOLUTION."""

async def test_pr_creator_cannot_approve(db, factory):
    """Maker-checker: creator not assignable as approver."""

async def test_budget_hard_block(db, factory):
    """HARD budget block raises exception on submit."""

async def test_pr_cache_invalidated_on_submit(db, factory):
    """Redis cache key deleted after status change."""
```

---
## STEP 5 — GRAPHIFY UPDATE
```bash
graphify update
# Nodes: RequisitionService, PRFsm, PRAgingTask, PR Router (12 endpoints)
```
