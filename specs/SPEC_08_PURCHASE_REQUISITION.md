# SPEC_08_PURCHASE_REQUISITION.md

## Title
Enterprise S2P Procurement Portal — Purchase Requisition

## Purpose
Define the complete PR lifecycle including creation channels, Pydantic schemas, budget check, ERP import pipeline, sourcing path decision, merge/split logic, aging alerts, amendment flow, state machine, and RequisitionService class.

## Scope
Covers all 6 creation channels, complete Pydantic v2 schemas, budget check with race condition handling, ERP import with unmapped detection, sourcing path routing, PR merge and split logic, aging Celery task, complete state machine, RequisitionService interface, and amendment flow.

## Dependencies
- SPEC_03_DATABASE.md (requisitions, requisition_lines, unmapped_pr_exceptions tables)
- SPEC_05_WORKFLOW_ENGINE.md (PR_APPROVAL template)
- SPEC_06_APPROVAL_RULES_ENGINE.md (rule resolution for PR)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. Creation Channels

| Channel | Source | Validation Level | Resulting Status | Buyer Assignment |
|---|---|---|---|---|
| Manual Portal | Buyer/Requestor fills form in buyer portal | Full Pydantic validation + budget check | DRAFT → SUBMITTED on submit | Manual selection or auto-assign by category |
| ERP REST API | ERP pushes PR via `POST /api/v1/requisitions/erp-import` | Schema validation + field mapping + budget check | SUBMITTED (if all fields map) or UNMAPPED | Auto-assign by category + BU |
| ERP Batch File | ERP drops JSON/IDoc file; Celery processes | Same as REST API | Same as REST API | Same as REST API |
| Mobile App | Requestor creates via mobile (Phase 3) | Same as Manual Portal (reduced field set) | DRAFT → SUBMITTED | Same as Manual Portal |
| Catalog Checkout | Requestor selects items from hosted catalog | Pre-validated catalog items; quantity + delivery only | SUBMITTED (auto) | Auto-assign by catalog category |
| Email-to-PR | Requestor sends structured email (Phase 3) | NLP extraction + manual confirmation | DRAFT (requires review) | Manual |

---

## 2. Pydantic v2 Schemas

```python
# app/modules/requisition/schemas.py

from pydantic import BaseModel, Field, field_validator, computed_field
from uuid import UUID
from datetime import date
from decimal import Decimal
from typing import Optional

class PRLineItemRequest(BaseModel):
    line_number: int = Field(ge=1)
    item_description: str = Field(min_length=5, max_length=500)
    item_code: Optional[str] = Field(None, max_length=50)
    category_id: UUID
    uom_id: UUID
    quantity: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    estimated_unit_price: Decimal = Field(ge=0, max_digits=18, decimal_places=4)
    hsn_code: Optional[str] = Field(None, max_length=10)
    specifications: Optional[str] = None
    required_by_date: Optional[date] = None
    delivery_location_id: Optional[UUID] = None

    @field_validator("required_by_date")
    @classmethod
    def validate_future_date(cls, v):
        if v and v < date.today():
            raise ValueError("Required-by date must be in the future")
        return v

    @computed_field
    @property
    def estimated_total(self) -> Decimal:
        return self.quantity * self.estimated_unit_price


class PRCreateRequest(BaseModel):
    title: str = Field(min_length=5, max_length=300)
    description: Optional[str] = None
    procurement_type: str = Field(pattern="^(CAPEX|OPEX|PROJECT|MRO|SERVICES)$")
    business_unit_id: UUID
    plant_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    cost_center_id: UUID
    category_id: UUID
    currency: str = Field(default="INR", pattern="^[A-Z]{3}$")
    is_emergency: bool = False
    is_capex: bool = False
    required_by_date: Optional[date] = None
    delivery_location_id: Optional[UUID] = None
    lines: list[PRLineItemRequest] = Field(min_length=1, max_length=100)

    @field_validator("lines")
    @classmethod
    def validate_unique_line_numbers(cls, v):
        numbers = [line.line_number for line in v]
        if len(numbers) != len(set(numbers)):
            raise ValueError("Line numbers must be unique")
        return v

    @computed_field
    @property
    def estimated_value(self) -> Decimal:
        return sum(line.estimated_total for line in self.lines)


class PRUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=5, max_length=300)
    description: Optional[str] = None
    required_by_date: Optional[date] = None
    delivery_location_id: Optional[UUID] = None
    lines: Optional[list[PRLineItemRequest]] = None


class PRApprovalAction(BaseModel):
    action: str = Field(pattern="^(APPROVE|REJECT|RETURN)$")
    comment: Optional[str] = Field(None, max_length=1000)

    @field_validator("comment")
    @classmethod
    def require_comment_on_reject(cls, v, info):
        if info.data.get("action") in ("REJECT", "RETURN") and not v:
            raise ValueError("Comment is required for REJECT or RETURN actions")
        return v


class PRMergeRequest(BaseModel):
    pr_ids: list[UUID] = Field(min_length=2, max_length=20)
    merged_title: Optional[str] = Field(None, min_length=5, max_length=300)


class PRSplitRequest(BaseModel):
    splits: list[PRSplitItem] = Field(min_length=2)

class PRSplitItem(BaseModel):
    category_id: UUID
    line_numbers: list[int] = Field(min_length=1)
    title: Optional[str] = None
```

---

## 3. Budget Check Implementation

```python
# app/modules/requisition/service.py — budget check

async def _check_budget(
    self, db: AsyncSession, cost_center_id: UUID,
    amount: Decimal, org_id: UUID, mode: str
) -> BudgetCheckResult:
    """
    Synchronous budget check with SELECT FOR UPDATE to prevent race conditions.
    mode: 'hard' (block if insufficient) or 'soft' (warn only)
    """
    # Lock the cost center row to prevent concurrent budget modifications
    result = await db.execute(
        select(CostCenter)
        .where(CostCenter.id == cost_center_id, CostCenter.org_id == org_id)
        .with_for_update()
    )
    cost_center = result.scalar_one()

    if cost_center.available_budget >= amount:
        return BudgetCheckResult(status="SUFFICIENT", available=cost_center.available_budget, requested=amount)

    if mode == "hard":
        raise AppException(
            "BUDGET_INSUFFICIENT",
            f"Insufficient budget. Available: {cost_center.available_budget}, Requested: {amount}",
            400,
            {"available_budget": str(cost_center.available_budget), "requested": str(amount)}
        )

    # Soft check — return warning but allow submission
    return BudgetCheckResult(
        status="WARNING",
        available=cost_center.available_budget,
        requested=amount,
        message="Budget warning: requested amount exceeds available budget"
    )


async def _reserve_budget(
    self, db: AsyncSession, cost_center_id: UUID,
    amount: Decimal, org_id: UUID
) -> None:
    """Reserve budget on PR submission. Released on rejection/withdrawal/PO creation."""
    result = await db.execute(
        select(CostCenter)
        .where(CostCenter.id == cost_center_id, CostCenter.org_id == org_id)
        .with_for_update()
    )
    cost_center = result.scalar_one()
    cost_center.available_budget -= amount


async def _release_budget(
    self, db: AsyncSession, cost_center_id: UUID,
    amount: Decimal, org_id: UUID
) -> None:
    """Release reserved budget on rejection, withdrawal, or PO creation."""
    result = await db.execute(
        select(CostCenter)
        .where(CostCenter.id == cost_center_id, CostCenter.org_id == org_id)
        .with_for_update()
    )
    cost_center = result.scalar_one()
    cost_center.available_budget += amount
```

**Budget check mode:** Configurable per BU and category combination in `tenant_settings`:
```json
{
  "budget_check_config": {
    "default_mode": "soft",
    "overrides": [
      {"bu_id": "uuid", "category_id": "uuid", "mode": "hard"}
    ]
  }
}
```

---

## 4. ERP Import Pipeline

```python
# app/tasks/erp_pr_import.py

@celery_app.task(queue="celery.integration")
async def process_erp_pr_import(payload: dict, org_id: str):
    """Process PR import from ERP (IDoc or JSON format)."""
    async with async_session_factory() as db:
        org_id = UUID(org_id)
        
        for pr_data in payload.get("requisitions", []):
            mapping_result = await _attempt_field_mapping(db, pr_data, org_id)

            if mapping_result.all_resolved:
                # All mandatory fields mapped successfully
                pr = Requisition(
                    org_id=org_id,
                    pr_number=await _generate_pr_number(db, org_id),
                    title=pr_data["description"][:300],
                    source=PRSource.ERP_API,
                    status=PRStatus.SUBMITTED,
                    procurement_type=mapping_result.procurement_type,
                    requestor_id=mapping_result.requestor_id,
                    business_unit_id=mapping_result.bu_id,
                    plant_id=mapping_result.plant_id,
                    cost_center_id=mapping_result.cost_center_id,
                    category_id=mapping_result.category_id,
                    estimated_value=pr_data.get("estimated_value", 0),
                    erp_pr_number=pr_data["erp_pr_number"],
                )
                db.add(pr)
                await db.flush()
                # Create line items
                for line_data in pr_data.get("lines", []):
                    line = RequisitionLine(org_id=org_id, requisition_id=pr.id, ...)
                    db.add(line)
                # Trigger approval workflow
                await workflow_engine.instantiate(...)

            else:
                # One or more mandatory fields failed mapping → UNMAPPED
                pr = Requisition(
                    org_id=org_id,
                    pr_number=await _generate_pr_number(db, org_id),
                    title=pr_data["description"][:300],
                    source=PRSource.ERP_API,
                    status=PRStatus.UNMAPPED,
                    erp_pr_number=pr_data["erp_pr_number"],
                    estimated_value=pr_data.get("estimated_value", 0),
                )
                db.add(pr)
                await db.flush()

                exception = UnmappedPRException(
                    org_id=org_id,
                    requisition_id=pr.id,
                    failed_fields=mapping_result.failed_fields_json,
                    status=UnmappedPRStatus.PENDING,
                    sla_deadline=datetime.utcnow() + timedelta(hours=4),
                )
                db.add(exception)
                await publisher.publish("procurement.unmapped", "unmapped_pr.created",
                    {"exception_id": str(exception.id), "pr_number": pr.pr_number}, org_id)

        await db.commit()


async def _attempt_field_mapping(db: AsyncSession, pr_data: dict, org_id: UUID) -> MappingResult:
    """Attempt to map all 5 mandatory fields from ERP data to portal entities."""
    result = MappingResult()

    # 1. Category mapping
    erp_material_group = pr_data.get("material_group")
    mapping = await erp_mapping_repo.find_mapping(db, org_id, erp_material_group)
    if mapping:
        result.category_id = mapping.category_id
    else:
        result.add_failure("category_id", erp_material_group, await _get_suggestions(db, org_id, "category", erp_material_group))

    # 2. Business Unit mapping (by ERP company code)
    erp_company_code = pr_data.get("company_code")
    bu = await bu_repo.find_by_erp_code(db, org_id, erp_company_code)
    if bu:
        result.bu_id = bu.id
    else:
        result.add_failure("business_unit_id", erp_company_code, [])

    # 3. Plant mapping (by ERP plant code)
    erp_plant_code = pr_data.get("plant_code")
    plant = await plant_repo.find_by_erp_code(db, org_id, erp_plant_code)
    if plant:
        result.plant_id = plant.id
    else:
        result.add_failure("plant_id", erp_plant_code, [])

    # 4. Cost Center mapping (by ERP cost center code)
    erp_cc_code = pr_data.get("cost_center")
    cc = await cc_repo.find_by_erp_code(db, org_id, erp_cc_code)
    if cc:
        result.cost_center_id = cc.id
    else:
        result.add_failure("cost_center_id", erp_cc_code, [])

    # 5. Buyer assignment (by category + BU)
    if result.category_id and result.bu_id:
        buyer = await user_repo.find_buyer_for_category_bu(db, org_id, result.category_id, result.bu_id)
        if buyer:
            result.requestor_id = buyer.id
        else:
            result.add_failure("requestor_id", f"category:{result.category_id},bu:{result.bu_id}", [])

    return result
```

---

## 5. Sourcing Path Decision Logic

After PR approval, the system determines the sourcing path:

```python
async def _determine_sourcing_path(
    self, db: AsyncSession, pr: Requisition, org_id: UUID
) -> SourcingPathResult:
    """Determine whether PR routes to contract call-off, spot buy, or RFQ."""

    # 1. Contract match check
    active_contract = await contract_repo.find_matching_contract(
        db, org_id,
        vendor_category_id=pr.category_id,
        date=date.today(),
    )
    if active_contract:
        # Check if contract has remaining quantity/value
        remaining = await contract_repo.get_remaining_value(db, active_contract.id, org_id)
        if remaining >= pr.estimated_value:
            return SourcingPathResult(
                path="CONTRACT_CALLOFF",
                contract_id=active_contract.id,
                contract_number=active_contract.contract_number,
                vendor_id=active_contract.vendor_id,
            )

    # 2. Spot buy eligibility (low-value, standard items)
    spot_buy_threshold = await self._get_spot_buy_threshold(db, org_id, pr.category_id)
    if pr.estimated_value <= spot_buy_threshold:
        return SourcingPathResult(path="SPOT_BUY")

    # 3. Default: RFQ path
    return SourcingPathResult(path="RFQ")
```

**Buyer assignment fallback chain:**
1. User with BUYER role + matching category scope + matching BU scope
2. User with SOURCING_MANAGER role + matching category scope
3. User with CATEGORY_MANAGER role + matching category scope
4. Procurement Admin (catch-all)

---

## 6. PR Merge Logic

```python
async def merge_prs(
    self, db: AsyncSession, data: PRMergeRequest,
    actor: User, org_id: UUID
) -> Requisition:
    """Merge multiple approved PRs into a single PR for sourcing."""
    source_prs = []
    for pr_id in data.pr_ids:
        pr = await self.repo.get(db, pr_id, org_id)
        if pr.status != PRStatus.APPROVED:
            raise AppException("INVALID_STATE", f"PR {pr.pr_number} is not in APPROVED state")
        source_prs.append(pr)

    # Validate all PRs have same category and BU
    categories = set(pr.category_id for pr in source_prs)
    bus = set(pr.business_unit_id for pr in source_prs)
    if len(categories) > 1:
        raise AppException("MERGE_CATEGORY_MISMATCH", "All PRs must belong to the same category")
    if len(bus) > 1:
        raise AppException("MERGE_BU_MISMATCH", "All PRs must belong to the same business unit")

    # Create merged PR
    merged_pr = Requisition(
        org_id=org_id,
        pr_number=await self._generate_pr_number(db, org_id),
        title=data.merged_title or f"Merged PR: {', '.join(pr.pr_number for pr in source_prs)}",
        source=PRSource.MANUAL,
        status=PRStatus.APPROVED,
        procurement_type=source_prs[0].procurement_type,
        requestor_id=actor.id,
        business_unit_id=source_prs[0].business_unit_id,
        cost_center_id=source_prs[0].cost_center_id,
        category_id=source_prs[0].category_id,
        merged_from=[pr.id for pr in source_prs],
        approved_at=datetime.utcnow(),
    )
    db.add(merged_pr)
    await db.flush()

    # Aggregate line items (sum quantities for matching items)
    line_number = 1
    merged_lines = {}
    for pr in source_prs:
        lines = await self.line_repo.get_lines(db, pr.id, org_id)
        for line in lines:
            key = (line.item_code or line.item_description, line.uom_id)
            if key in merged_lines:
                merged_lines[key].quantity += line.quantity
            else:
                new_line = RequisitionLine(
                    org_id=org_id, requisition_id=merged_pr.id,
                    line_number=line_number, item_description=line.item_description,
                    item_code=line.item_code, category_id=line.category_id,
                    uom_id=line.uom_id, quantity=line.quantity,
                    estimated_unit_price=line.estimated_unit_price,
                    hsn_code=line.hsn_code,
                )
                merged_lines[key] = new_line
                line_number += 1

    for line in merged_lines.values():
        db.add(line)

    merged_pr.estimated_value = sum(l.quantity * l.estimated_unit_price for l in merged_lines.values())

    # Update source PRs
    for pr in source_prs:
        pr.status = PRStatus.IN_SOURCING

    # Notify all requestors
    for pr in source_prs:
        await self.publisher.publish("procurement.notification", "notification.pr_merged",
            {"pr_number": pr.pr_number, "merged_into": merged_pr.pr_number, "requestor_id": str(pr.requestor_id)}, org_id)

    await self._audit(db, merged_pr, "PR_MERGED", actor, org_id)
    return merged_pr
```

---

## 7. PR Split Logic

```python
async def split_pr(
    self, db: AsyncSession, pr_id: UUID,
    data: PRSplitRequest, actor: User, org_id: UUID
) -> list[Requisition]:
    """Split an approved PR into multiple child PRs by category."""
    source_pr = await self.repo.get(db, pr_id, org_id)
    if source_pr.status != PRStatus.APPROVED:
        raise AppException("INVALID_STATE", "PR must be in APPROVED state to split")

    source_lines = await self.line_repo.get_lines(db, pr_id, org_id)
    child_prs = []

    for split in data.splits:
        selected_lines = [l for l in source_lines if l.line_number in split.line_numbers]
        if not selected_lines:
            raise AppException("INVALID_SPLIT", f"No lines found for line numbers {split.line_numbers}")

        child_pr = Requisition(
            org_id=org_id,
            pr_number=await self._generate_pr_number(db, org_id),
            title=split.title or f"Split from {source_pr.pr_number}",
            source=source_pr.source,
            status=PRStatus.APPROVED,
            procurement_type=source_pr.procurement_type,
            requestor_id=source_pr.requestor_id,
            business_unit_id=source_pr.business_unit_id,
            cost_center_id=source_pr.cost_center_id,
            category_id=split.category_id,
            split_from=source_pr.id,
            approved_at=datetime.utcnow(),
        )
        db.add(child_pr)
        await db.flush()

        for idx, line in enumerate(selected_lines, 1):
            child_line = RequisitionLine(
                org_id=org_id, requisition_id=child_pr.id,
                line_number=idx, item_description=line.item_description,
                item_code=line.item_code, category_id=split.category_id,
                uom_id=line.uom_id, quantity=line.quantity,
                estimated_unit_price=line.estimated_unit_price,
            )
            db.add(child_line)

        child_pr.estimated_value = sum(l.quantity * l.estimated_unit_price for l in selected_lines)
        child_prs.append(child_pr)

    # Cancel original PR with split reference
    source_pr.status = PRStatus.SPLIT
    source_pr.split_into = [cp.id for cp in child_prs]

    # Route each child PR to correct buyer
    for child_pr in child_prs:
        buyer = await self._assign_buyer(db, org_id, child_pr.category_id, child_pr.business_unit_id)
        child_pr.requestor_id = buyer.id if buyer else source_pr.requestor_id

    await self._audit(db, source_pr, "PR_SPLIT", actor, org_id)
    return child_prs
```

---

## 8. PR Aging

```python
# app/tasks/pr_aging.py

@celery_app.task(queue="celery.sla_timers")
async def check_pr_aging():
    """Runs daily at 06:00 UTC. Checks approved PRs not yet in sourcing."""
    async with async_session_factory() as db:
        orgs = await org_repo.get_all_active(db)
        for org in orgs:
            approved_prs = await pr_repo.get_approved_not_in_sourcing(db, org.id)
            for pr in approved_prs:
                days_since_approval = (date.today() - pr.approved_at.date()).days

                if days_since_approval >= 14 and pr.aging_alert_level < 3:
                    pr.aging_alert_level = 3
                    await publisher.publish("procurement.pr", "pr.aging.warning",
                        {"pr_id": str(pr.id), "pr_number": pr.pr_number, "days": 14, "level": "CRITICAL"}, org.id)
                elif days_since_approval >= 7 and pr.aging_alert_level < 2:
                    pr.aging_alert_level = 2
                    await publisher.publish("procurement.pr", "pr.aging.warning",
                        {"pr_id": str(pr.id), "pr_number": pr.pr_number, "days": 7, "level": "HIGH"}, org.id)
                elif days_since_approval >= 3 and pr.aging_alert_level < 1:
                    pr.aging_alert_level = 1
                    await publisher.publish("procurement.pr", "pr.aging.warning",
                        {"pr_id": str(pr.id), "pr_number": pr.pr_number, "days": 3, "level": "MEDIUM"}, org.id)

        await db.commit()
```

---

## 9. Complete PR State Machine

### 9.1 All 12 States

`DRAFT`, `SUBMITTED`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `WITHDRAWN`, `IN_SOURCING`, `CONVERTED`, `CANCELLED`, `UNMAPPED`, `AMENDMENT_PENDING`, `SPLIT`

### 9.2 All Transitions

| From | To | Trigger | Actor | Validations | Side Effects | Audit Event | RabbitMQ |
|---|---|---|---|---|---|---|---|
| `DRAFT` | `SUBMITTED` | Requestor submits | Requestor | All mandatory fields; budget check | Reserve budget; trigger approval rules | `PR_SUBMITTED` | `pr.submitted` |
| `SUBMITTED` | `PENDING_APPROVAL` | Workflow instantiated | System | Approval rule resolved | Create workflow tasks | `PR_PENDING_APPROVAL` | `pr.pending_approval` |
| `PENDING_APPROVAL` | `APPROVED` | All approvers approve | Approver(s) | Workflow completed | Set approved_at; determine sourcing path | `PR_APPROVED` | `pr.approved` |
| `PENDING_APPROVAL` | `REJECTED` | Any approver rejects | Approver | Comment required | Release budget; cancel workflow | `PR_REJECTED` | `pr.rejected` |
| `DRAFT` | `WITHDRAWN` | Requestor withdraws draft | Requestor | — | — | `PR_WITHDRAWN` | `pr.withdrawn` |
| `SUBMITTED` | `WITHDRAWN` | Requestor withdraws | Requestor | — | Release budget; cancel workflow | `PR_WITHDRAWN` | `pr.withdrawn` |
| `PENDING_APPROVAL` | `WITHDRAWN` | Requestor withdraws | Requestor | — | Release budget; cancel workflow tasks | `PR_WITHDRAWN` | `pr.withdrawn` |
| `APPROVED` | `IN_SOURCING` | PR linked to RFQ or merged | Buyer/System | — | — | `PR_IN_SOURCING` | `pr.in_sourcing` |
| `APPROVED` | `CONVERTED` | PO created from award | System | Award approved | Release budget (transferred to PO) | `PR_CONVERTED` | `pr.converted` |
| `APPROVED` | `CANCELLED` | Admin cancels | Proc Admin | Reason required | Release budget; notify requestor | `PR_CANCELLED` | `pr.cancelled` |
| `APPROVED` | `AMENDMENT_PENDING` | Requestor amends | Requestor | Only in APPROVED state | See amendment flow | `PR_AMENDMENT_REQUESTED` | `pr.amendment_requested` |
| `AMENDMENT_PENDING` | `APPROVED` | Amendment approved | Approver | Minor: auto-approve; Major: re-approval | Update fields; recalculate budget | `PR_AMENDMENT_APPROVED` | `pr.amendment_approved` |
| `AMENDMENT_PENDING` | `REJECTED` | Amendment rejected | Approver | — | Revert to original values | `PR_AMENDMENT_REJECTED` | `pr.amendment_rejected` |
| `APPROVED` | `SPLIT` | PR split into children | Buyer | At least 2 splits | Create child PRs; cancel parent | `PR_SPLIT` | `pr.split` |
| — | `UNMAPPED` | ERP import with unmapped fields | System (ERP import) | — | Create unmapped_pr_exception | `PR_UNMAPPED` | `unmapped_pr.created` |
| `UNMAPPED` | `SUBMITTED` | Mapping resolved + reprocessed | Proc Admin | All fields mapped | Trigger normal approval flow | `PR_REPROCESSED` | `pr.reprocessed` |

---

## 10. RequisitionService Class

```python
class RequisitionService:
    async def create_draft(self, db, data: PRCreateRequest, actor: User, org_id: UUID) -> Requisition: ...
    async def update_draft(self, db, pr_id: UUID, data: PRUpdateRequest, actor: User, org_id: UUID) -> Requisition: ...
    async def submit(self, db, pr_id: UUID, actor: User, org_id: UUID) -> Requisition: ...
    async def withdraw(self, db, pr_id: UUID, actor: User, org_id: UUID) -> Requisition: ...
    async def approve(self, db, pr_id: UUID, task_id: UUID, comment: str, actor: User, org_id: UUID) -> Requisition: ...
    async def reject(self, db, pr_id: UUID, task_id: UUID, comment: str, actor: User, org_id: UUID) -> Requisition: ...
    async def merge_prs(self, db, data: PRMergeRequest, actor: User, org_id: UUID) -> Requisition: ...
    async def split_pr(self, db, pr_id: UUID, data: PRSplitRequest, actor: User, org_id: UUID) -> list[Requisition]: ...
    async def amend(self, db, pr_id: UUID, data: PRUpdateRequest, actor: User, org_id: UUID) -> Requisition: ...
    async def cancel(self, db, pr_id: UUID, reason: str, actor: User, org_id: UUID) -> Requisition: ...
    async def get_by_id(self, db, pr_id: UUID, org_id: UUID) -> Requisition: ...
    async def list_prs(self, db, org_id: UUID, filters: PRFilterParams, pagination: PaginationParams) -> PaginatedResult: ...
    async def get_pr_for_sourcing(self, db, pr_id: UUID, org_id: UUID) -> SourcingPathResult: ...
```

---

## 11. Amendment Flow

1. Requestor calls `PATCH /api/v1/requisitions/{pr_id}/amend` with updated fields
2. System calculates change significance: `|(new_value - old_value) / old_value| > 0.10` (10% threshold)
3. If **minor change** (≤10% value change, non-critical field): auto-approved with audit log entry
4. If **significant change** (>10% value change or critical field change): PR status → `AMENDMENT_PENDING`; triggers simplified re-approval workflow (1-level: Category Manager or Sourcing Manager)
5. If re-approved: PR returns to `APPROVED` with updated values; budget difference reserved/released
6. If re-rejected: PR reverts to original values; status → `APPROVED`

**Critical fields triggering re-approval regardless of value change:** `category_id`, `business_unit_id`, `cost_center_id`, `procurement_type`
