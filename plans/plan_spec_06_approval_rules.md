# IMPLEMENTATION PLAN — SPEC_06: Approval Rules Engine
**Module:** 06 | **Phase:** Foundation | **Squad:** A
**Spec File:** SPEC_06_APPROVAL_RULES_ENGINE.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S06-01 | Rule schema (10 fields, JSONB conditions) | approval_rules/models.py | PLANNED |
| S06-02 | Version-pinned rules (approval_rule_versions) | approval_rules/models.py | PLANNED |
| S06-03 | RulesEngine.find_matching_rule() — priority ordering | approval_rules/service.py | PLANNED |
| S06-04 | Condition evaluation (same safe_eval from SPEC_05) | approval_rules/service.py | PLANNED |
| S06-05 | Default catch-all rule (lowest priority, no conditions) | scripts/seed_workflows.py | PLANNED |
| S06-06 | Rule conflict detection (priority + condition overlap) | approval_rules/service.py | PLANNED |
| S06-07 | PENDING_RULE_RESOLUTION fallback path | approval_rules/service.py | PLANNED |
| S06-08 | 5 entity types (PR, RFQ, PO, VENDOR, CONTRACT) | approval_rules/schemas.py | PLANNED |
| S06-09 | CRUD API with version history | approval_rules/router.py | PLANNED |
| S06-10 | Rule activation requires PROCUREMENT_ADMIN | approval_rules/router.py | PLANNED |
| S06-11 | Simulate rule matching (dry run, no write) | approval_rules/router.py | PLANNED |
| S06-12 | GIN index on conditions JSONB | Migration 0024 | PLANNED |

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-06-1 | Rule priority is integer 1–1000; lower number = higher priority; two rules same priority on same entity_type is a conflict | SPEC Section 3 implies priority ordering; conflict detection implied | MEDIUM | Squad A |
| A-06-2 | PENDING_RULE_RESOLUTION status locks the entity and fires `procurement.alert` exchange; human intervention required to create/activate a rule | SPEC Section 7 fallback | MEDIUM | Squad A |
| A-06-3 | Rule activation (is_active=True) creates a new version snapshot in approval_rule_versions; deactivation does NOT create a version | Version history needed for auditability | LOW | Squad A |
| A-06-4 | `effective_from` defaults to NOW() and `effective_to` defaults to NULL (no expiry) | SPEC does not define defaults explicitly | LOW | Squad A |

---
## STEP 2 — IMPLEMENT

### 2.1 `app/modules/approval_rules/models.py`
```python
class ApprovalRule(BaseModel):
    __tablename__ = "approval_rules"
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # PR, RFQ, PO, VENDOR, CONTRACT
    rule_code: Mapped[str] = mapped_column(String(100), nullable=False)
    rule_name: Mapped[str] = mapped_column(String(255), nullable=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False)
    conditions: Mapped[dict] = mapped_column(JSONB, nullable=False, default={})
    condition_expression: Mapped[Optional[str]] = mapped_column(String(1000))
    workflow_template_code: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_catch_all: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    effective_from: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
    effective_to: Mapped[Optional[datetime]] = mapped_column(default=None)
    created_by: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)

class ApprovalRuleVersion(BaseModel):
    __tablename__ = "approval_rule_versions"
    rule_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("approval_rules.id"), nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    activated_by: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    activated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
```

### 2.2 `app/modules/approval_rules/service.py`
```python
class RulesEngine:

    async def find_matching_rule(
        self, db: AsyncSession, entity_type: str,
        entity_context: dict, org_id: UUID
    ) -> Optional[ApprovalRule]:
        now = datetime.utcnow()
        active_rules = await self.repo.get_active_rules(db, entity_type, org_id, now)
        # Sorted by priority ascending (1 = highest)
        for rule in sorted(active_rules, key=lambda r: r.priority):
            if rule.is_catch_all:
                continue  # Catch-all evaluated last
            if safe_eval(rule.condition_expression or "", entity_context):
                return rule

        # Catch-all (lowest priority, no conditions)
        catch_all = next((r for r in active_rules if r.is_catch_all), None)
        if catch_all:
            return catch_all

        # PENDING_RULE_RESOLUTION: no rule matched
        await self.publisher.publish(
            "procurement.alert", "alert.rule.unmatched",
            {"entity_type": entity_type, "entity_context": entity_context, "org_id": str(org_id)},
            org_id
        )
        return None

    async def detect_conflicts(self, db: AsyncSession, new_rule: ApprovalRule) -> list[dict]:
        same_priority = await self.repo.get_rules_by_priority(db, new_rule.entity_type, new_rule.priority, new_rule.org_id)
        return [{"rule_id": str(r.id), "rule_code": r.rule_code, "conflict": "SAME_PRIORITY"} for r in same_priority if r.id != new_rule.id]

    async def activate_rule(self, db: AsyncSession, rule_id: UUID, actor_id: UUID, org_id: UUID) -> ApprovalRule:
        rule = await self.repo.get(db, rule_id, org_id)
        conflicts = await self.detect_conflicts(db, rule)
        if conflicts:
            raise ConflictError("RULE_PRIORITY_CONFLICT", "Rule has priority conflict with existing active rules", {"conflicts": conflicts})
        rule.is_active = True
        version = ApprovalRuleVersion(
            org_id=org_id, rule_id=rule.id,
            snapshot=rule.__dict__.copy(), activated_by=actor_id
        )
        db.add(version)
        await self.audit.log(db, "APPROVAL_RULE", rule.id, "RULE_ACTIVATED", actor_id, org_id)
        return rule
```

### 2.3 Router — 7 endpoints
- `POST /api/v1/approval-rules` — create (PROCUREMENT_ADMIN)
- `PUT /api/v1/approval-rules/{id}` — update (PROCUREMENT_ADMIN)
- `POST /api/v1/approval-rules/{id}/activate` — activate (PROCUREMENT_ADMIN)
- `POST /api/v1/approval-rules/{id}/deactivate` — deactivate
- `GET /api/v1/approval-rules` — list by entity_type
- `GET /api/v1/approval-rules/{id}/versions` — version history
- `POST /api/v1/approval-rules/simulate` — dry-run matching

---
## STEP 3 — TEST
```python
async def test_priority_ordering(db, factory):
    """Lower priority number matches first."""
async def test_catch_all_fires_when_no_match(db, factory):
    """No specific rule matches → catch-all used."""
async def test_no_rule_publishes_alert(db):
    """Neither specific nor catch-all → PENDING_RULE_RESOLUTION event published."""
async def test_conflict_detection_blocks_activation(db, factory):
    """Two rules same priority, same entity_type → activate second raises ConflictError."""
async def test_simulate_no_write(db):
    """simulate endpoint makes 0 DB writes."""
```
---
## STEP 5 — GRAPHIFY UPDATE
```bash
graphify update
# Nodes: RulesEngine, ApprovalRule model, ApprovalRuleVersion model
```
