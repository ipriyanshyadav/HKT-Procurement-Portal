# IMPLEMENTATION PLAN — SPEC_05: Workflow Engine
**Module:** 05 | **Phase:** Foundation | **Squad:** A
**Spec File:** SPEC_05_WORKFLOW_ENGINE.md | **Plan Date:** 2026-08-04

---

## SESSION BOOTSTRAP
- [x] 0-A–0-E complete. Auth module done. Migration head at 0027.

---

## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S05-01 | Engine architecture (pure Python async, JSONB templates) | workflow/service.py | PLANNED |
| S05-02 | JSONB template schema (all fields) | workflow/schemas.py | PLANNED |
| S05-03 | 10 workflow templates (PR, RFQ, VENDOR, CONTRACT, PO, INVOICE, UNMAPPED, MASTER_DATA, VENDOR_QUAL, AWARD) | scripts/seed_workflows.py | PLANNED |
| S05-04 | WorkflowEngine.instantiate() | workflow/service.py | PLANNED |
| S05-05 | WorkflowEngine.advance() | workflow/service.py | PLANNED |
| S05-06 | WorkflowEngine.evaluate_conditions() | workflow/evaluator.py | PLANNED |
| S05-07 | WorkflowEngine.resolve_approvers() — ROLE/NAMED_USER/APPROVAL_GROUP | workflow/resolver.py | PLANNED |
| S05-08 | WorkflowEngine.create_tasks_for_step() + maker-checker | workflow/service.py | PLANNED |
| S05-09 | _handle_step_completion() — SEQUENTIAL + PARALLEL | workflow/service.py | PLANNED |
| S05-10 | Parallel convergence: ALL/ANY/MAJORITY/QUORUM | workflow/service.py | PLANNED |
| S05-11 | _advance_to_next_step() — conditional skip | workflow/service.py | PLANNED |
| S05-12 | cancel(), pause(), resume() | workflow/service.py | PLANNED |
| S05-13 | force_advance() — admin with compliance log | workflow/service.py | PLANNED |
| S05-14 | simulate() — dry run, no DB writes | workflow/service.py | PLANNED |
| S05-15 | SLA timer Celery task (15min, 4 thresholds) | tasks/sla_timers.py | PLANNED |
| S05-16 | Escalation resolution (delegation → Proc Admin) | workflow/service.py | PLANNED |
| S05-17 | Delegation logic at task creation | workflow/service.py | PLANNED |
| S05-18 | safe_eval using simpleeval | workflow/evaluator.py | PLANNED |
| S05-19 | Admin intervention audit trail | workflow/service.py + audit | PLANNED |
| S05-20 | 10 RabbitMQ events published | workflow/events.py | PLANNED |

---

## ASSUMPTIONS LOG

| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-05-1 | `simpleeval` library used for safe expression evaluation (no `eval()`); only arithmetic + comparison + boolean operators allowed | SPEC_05 Section 8 specifies "no function calls" | HIGH — eval() is injection vulnerability | Squad A |
| A-05-2 | QUORUM_N_OF_M convergence uses string format `"QUORUM_2_OF_3"` parsed at runtime; not a separate field | SPEC lists this as example but doesn't define schema field for N and M | MEDIUM | Squad A |
| A-05-3 | `_apply_delegation()` runs at task creation time, not at SLA breach time — ensures delegate is set from start | SPEC Section 7 implies delegation at task creation | MEDIUM | Squad A |
| A-05-4 | `force_advance` permission is `workflow.force_advance` — only granted to `PROCUREMENT_ADMIN` role | SPEC Section 9 states admin only | LOW | Squad A |
| A-05-5 | Workflow simulation (`simulate()`) runs async DB reads but wraps in explicit read-only transaction — no writes even on error | Ensures simulation never modifies state | LOW | Squad A |
| A-05-6 | `workflow_instances.entity_context` JSONB stores frozen snapshot of entity at workflow creation time; updates to entity do NOT update this context | In-flight protection requires consistent context | LOW | Squad A |
| A-05-7 | `PENDING_RULE_RESOLUTION` workflow status triggers notification to all `rules.create` permission holders; uses `procurement.alert` exchange | SPEC_06 defines this fallback path | MEDIUM | Squad A + E |

---

## STEP 2 — IMPLEMENT

### 2.1 `app/modules/workflow/evaluator.py`
```python
from simpleeval import EvalWithCompoundTypes, InvalidExpression

ALLOWED_NAMES = {
    "amount", "estimated_value", "total_value", "awarded_total", "total_amount",
    "category_level1", "bu_id", "rfq_type", "bidder_count", "is_capex",
    "is_emergency", "is_single_vendor", "is_strategic", "risk_class",
    "procurement_type", "vendor_type", "sourcing_type", "category_id", "plant_id",
}

def safe_eval(expression: str, context: dict) -> bool:
    """Evaluate boolean expression against entity context using simpleeval."""
    if not expression:
        return True
    # Filter context to allowed names only — prevent injection
    safe_context = {k: v for k, v in context.items() if k in ALLOWED_NAMES}
    try:
        evaluator = EvalWithCompoundTypes(names=safe_context)
        evaluator.functions = {}  # NO function calls allowed
        result = evaluator.eval(expression)
        return bool(result)
    except InvalidExpression as e:
        from loguru import logger
        logger.error(f"Workflow condition evaluation error: {expression=} {e=}")
        return False  # Fail safe: skip step on error (not fail)
    except Exception:
        return False
```

### 2.2 `app/modules/workflow/resolver.py`
```python
class ApproverResolver:

    async def resolve(
        self, db: AsyncSession, resolver: str, resolver_config: dict,
        entity_context: dict, org_id: UUID
    ) -> list[User]:
        if resolver == "ROLE":
            return await self._by_role(db, resolver_config, entity_context, org_id)
        elif resolver == "NAMED_USER":
            user = await self.user_repo.get_by_id(db, UUID(resolver_config["user_id"]), org_id)
            return [user] if user else []
        elif resolver == "APPROVAL_GROUP":
            return await self._by_group(db, resolver_config["group_code"], org_id)
        else:
            raise AppException("INVALID_RESOLVER", f"Unknown resolver type: {resolver}")

    async def _by_role(self, db, config: dict, ctx: dict, org_id: UUID) -> list[User]:
        role_code = config["role_code"]
        scope_filter = config.get("scope_filter")
        users = await self.user_repo.get_active_users_with_role(db, role_code, org_id)

        if scope_filter == "same_bu":
            bu_id = ctx.get("business_unit_id") or ctx.get("bu_id")
            users = [u for u in users if await self._user_has_bu_scope(db, u.id, UUID(bu_id), org_id)]
        elif scope_filter == "same_category":
            cat_id = ctx.get("category_id")
            users = [u for u in users if await self._user_has_cat_scope(db, u.id, UUID(cat_id), org_id)]
        elif scope_filter == "same_bu_and_category":
            bu_id = ctx.get("business_unit_id") or ctx.get("bu_id")
            cat_id = ctx.get("category_id")
            users = [
                u for u in users
                if (await self._user_has_bu_scope(db, u.id, UUID(bu_id), org_id)
                    and await self._user_has_cat_scope(db, u.id, UUID(cat_id), org_id))
            ]
        elif scope_filter == "vendor_category":
            vendor_cats = ctx.get("vendor_category_ids", [])
            users = [u for u in users if any(await self._user_has_cat_scope(db, u.id, UUID(c), org_id) for c in vendor_cats)]

        # Fallback role
        if not users and "fallback_role" in config:
            users = await self.user_repo.get_active_users_with_role(db, config["fallback_role"], org_id)

        return users

    async def _by_group(self, db, group_code: str, org_id: UUID) -> list[User]:
        group = await self.group_repo.get_by_code(db, group_code, org_id)
        return await self.group_repo.get_members(db, group.id, org_id)
```

### 2.3 `app/modules/workflow/service.py` — WorkflowEngine (Core)
```python
class WorkflowEngine:

    async def instantiate(
        self, db: AsyncSession, template_code: str, entity_type: str,
        entity_id: UUID, entity_context: dict, org_id: UUID, actor_id: UUID
    ) -> WorkflowInstance:
        template = await self.repo.get_template_by_code(db, template_code, org_id)
        instance = WorkflowInstance(
            org_id=org_id, template_id=template.id, entity_type=entity_type,
            entity_id=entity_id, entity_context=entity_context,
            status="ACTIVE", current_step_number=1,
        )
        db.add(instance)
        await db.flush()

        first_step = min(template.steps, key=lambda s: s["step_number"])
        await self._process_step(db, instance, first_step, entity_context)

        await self.publisher.publish(
            "procurement.workflow", "workflow.instance.created",
            {"instance_id": str(instance.id), "entity_type": entity_type, "entity_id": str(entity_id), "template_code": template_code},
            org_id
        )
        return instance

    async def advance(
        self, db: AsyncSession, instance_id: UUID, task_id: UUID,
        action: str, actor_id: UUID, comment: str, org_id: UUID
    ) -> WorkflowInstance:
        instance = await self.repo.get_instance(db, instance_id, org_id)
        task = await self.repo.get_task(db, task_id, org_id)

        # Validate task belongs to this instance and is pending
        if task.workflow_instance_id != instance_id:
            raise AppException("TASK_INSTANCE_MISMATCH", "Task does not belong to this workflow instance")
        if task.status != "PENDING":
            raise AppException("TASK_NOT_PENDING", f"Task status is {task.status}, cannot act on it")
        if task.assigned_to != actor_id:
            raise ForbiddenError("NOT_ASSIGNED", "This task is not assigned to you")

        task.status = action  # "APPROVED" or "REJECTED"
        task.action = action
        task.comment = comment
        task.acted_at = datetime.utcnow()

        await self.publisher.publish(
            "procurement.workflow", "workflow.task.completed",
            {"task_id": str(task_id), "instance_id": str(instance_id), "action": action, "actor_id": str(actor_id), "comment": comment},
            org_id
        )
        await self._handle_step_completion(db, instance, task, action)
        return instance

    async def _process_step(self, db, instance, step, entity_context):
        """Create tasks for a step after evaluating conditions."""
        should_run = safe_eval(step.get("condition_expression", ""), entity_context)
        if not should_run:
            instance.current_step_number = step["step_number"]
            await self._advance_to_next_step(db, instance)
            return

        approvers = await self.resolver.resolve(db, step["resolver"], step["resolver_config"], entity_context, instance.org_id)
        approvers = await self._apply_delegation(db, approvers, instance.org_id)
        await self.create_tasks_for_step(db, instance, step, approvers)

    async def create_tasks_for_step(self, db, instance, step, approvers):
        entity_creator = instance.entity_context.get("created_by")
        entity_submitter = instance.entity_context.get("submitted_by")
        eligible = [a for a in approvers if str(a.id) != entity_creator and str(a.id) != entity_submitter]

        if not eligible:
            escalation_users = await self._get_escalation_approvers(db, instance, step)
            eligible = [a for a in escalation_users if str(a.id) != entity_creator and str(a.id) != entity_submitter]

        if not eligible:
            raise AppException("NO_ELIGIBLE_APPROVER", "Maker-checker: no eligible approver found")

        from uuid import uuid4 as _uuid4
        group_id = _uuid4() if step["step_type"] == "PARALLEL" else None
        sla_deadline = datetime.utcnow() + timedelta(hours=step["sla_hours"])

        for approver in eligible:
            task = WorkflowTask(
                org_id=instance.org_id,
                workflow_instance_id=instance.id,
                step_number=step["step_number"],
                assigned_to=approver.id,
                assigned_role=step.get("resolver_config", {}).get("role_code"),
                status="PENDING",
                parallel_task_group_id=group_id,
                sla_deadline=sla_deadline,
                is_maker_checker_enforced=True,
            )
            if hasattr(approver, "_delegated_from"):
                task.delegated_from = approver._delegated_from
            db.add(task)

            await self.publisher.publish(
                "procurement.workflow", "workflow.task.created",
                {"task_id": str(task.id), "instance_id": str(instance.id), "assigned_to": str(approver.id),
                 "step_name": step.get("step_name"), "sla_deadline": sla_deadline.isoformat()},
                instance.org_id
            )

    async def _handle_step_completion(self, db, instance, task, action):
        if action in ("REJECT", "RETURN"):
            instance.status = "FAILED"
            instance.completed_at = datetime.utcnow()
            await self.publisher.publish(
                "procurement.workflow", "workflow.instance.failed",
                {"instance_id": str(instance.id), "entity_type": instance.entity_type,
                 "entity_id": str(instance.entity_id), "failed_at_step": task.step_number,
                 "rejection_comment": task.comment},
                instance.org_id
            )
            return

        template = await self.repo.get_template(db, instance.template_id, instance.org_id)
        step = next((s for s in template.steps if s["step_number"] == task.step_number), None)

        if step["step_type"] == "PARALLEL":
            await self._check_parallel_convergence(db, instance, step, task)
        else:
            await self._advance_to_next_step(db, instance)

    async def _check_parallel_convergence(self, db, instance, step, task):
        group_tasks = await self.repo.get_tasks_by_group(db, task.parallel_task_group_id, instance.org_id)
        convergence = step.get("convergence", "ALL")
        total = len(group_tasks)
        approved = [t for t in group_tasks if t.status == "APPROVED"]
        rejected = [t for t in group_tasks if t.status == "REJECTED"]

        if convergence == "ALL":
            if rejected:
                instance.status = "FAILED"
                instance.completed_at = datetime.utcnow()
                for t in group_tasks:
                    if t.status == "PENDING": t.status = "CANCELLED"
            elif len(approved) == total:
                await self._advance_to_next_step(db, instance)

        elif convergence == "ANY":
            if approved:
                for t in group_tasks:
                    if t.status == "PENDING": t.status = "CANCELLED"
                await self._advance_to_next_step(db, instance)

        elif convergence == "MAJORITY":
            if len(approved) > total / 2:
                for t in group_tasks:
                    if t.status == "PENDING": t.status = "CANCELLED"
                await self._advance_to_next_step(db, instance)
            elif len(rejected) >= total / 2:
                instance.status = "FAILED"
                instance.completed_at = datetime.utcnow()

        elif convergence.startswith("QUORUM_"):
            # e.g. QUORUM_2_OF_3
            parts = convergence.split("_")
            required = int(parts[1])
            if len(approved) >= required:
                for t in group_tasks:
                    if t.status == "PENDING": t.status = "CANCELLED"
                await self._advance_to_next_step(db, instance)
            elif len(rejected) > total - required:
                instance.status = "FAILED"
                instance.completed_at = datetime.utcnow()

    async def _advance_to_next_step(self, db, instance):
        template = await self.repo.get_template(db, instance.template_id, instance.org_id)
        next_steps = sorted(
            [s for s in template.steps if s["step_number"] > instance.current_step_number],
            key=lambda s: s["step_number"]
        )
        for step in next_steps:
            if safe_eval(step.get("condition_expression", ""), instance.entity_context):
                instance.current_step_number = step["step_number"]
                await self._process_step(db, instance, step, instance.entity_context)
                return

        instance.status = "COMPLETED"
        instance.completed_at = datetime.utcnow()
        await self.publisher.publish(
            "procurement.workflow", "workflow.instance.completed",
            {"instance_id": str(instance.id), "entity_type": instance.entity_type, "entity_id": str(instance.entity_id)},
            instance.org_id
        )

    async def simulate(self, db, template_code, entity_context, org_id):
        """DRY_RUN — read-only. Returns chain with approver names. NEVER writes."""
        template = await self.repo.get_template_by_code(db, template_code, org_id)
        chain = []
        for step in sorted(template.steps, key=lambda s: s["step_number"]):
            condition_met = safe_eval(step.get("condition_expression", ""), entity_context)
            if condition_met:
                approvers = await self.resolver.resolve(db, step["resolver"], step["resolver_config"], entity_context, org_id)
                chain.append({
                    "step_number": step["step_number"],
                    "step_name": step.get("step_name"),
                    "step_type": step["step_type"],
                    "approvers": [{"id": str(a.id), "name": f"{a.first_name} {a.last_name}", "role": step.get("resolver_config", {}).get("role_code")} for a in approvers],
                    "sla_hours": step["sla_hours"],
                    "convergence": step.get("convergence"),
                    "condition_met": True,
                })
            else:
                chain.append({"step_number": step["step_number"], "step_name": step.get("step_name"), "condition_met": False, "condition_expression": step.get("condition_expression")})
        return chain
```

### 2.4 `app/tasks/sla_timers.py` — SLA Check Task
```python
@celery_app.task(queue="celery.sla_timers", name="check_workflow_sla_timers")
def check_workflow_sla_timers():
    """Runs every {settings.CELERY_SLA_CHECK_MINUTES} minutes."""
    import asyncio
    asyncio.run(_async_check_sla())

async def _async_check_sla():
    async with async_session_factory() as db:
        now = datetime.utcnow()
        pending_tasks = await workflow_repo.get_all_pending_tasks_with_sla(db)

        for task in pending_tasks:
            if not task.sla_deadline:
                continue

            sla_total_hours = (task.sla_deadline - task.created_at).total_seconds() / 3600
            elapsed_hours = (now - task.created_at).total_seconds() / 3600
            pct = (elapsed_hours / sla_total_hours * 100) if sla_total_hours > 0 else 0

            if pct >= 200 and task.sla_status != "CRITICAL":
                task.sla_status = "CRITICAL"
                await publisher.publish("procurement.workflow", "workflow.sla.critical",
                    {"task_id": str(task.id), "instance_id": str(task.workflow_instance_id),
                     "assigned_to": str(task.assigned_to), "hours_overdue": elapsed_hours - sla_total_hours},
                    task.org_id)

            elif pct >= 150 and task.sla_status not in ("REASSIGNED", "CRITICAL"):
                task.sla_status = "REASSIGNED"
                await _reassign_task(db, task)
                await publisher.publish("procurement.workflow", "workflow.sla.escalation",
                    {"task_id": str(task.id), "instance_id": str(task.workflow_instance_id), "sla_pct": pct},
                    task.org_id)

            elif pct >= 100 and task.sla_status not in ("ESCALATED", "REASSIGNED", "CRITICAL"):
                task.sla_status = "ESCALATED"
                await publisher.publish("procurement.workflow", "workflow.sla.escalation",
                    {"task_id": str(task.id), "sla_pct": pct}, task.org_id)

            elif pct >= 50 and task.sla_status == "WITHIN_SLA":
                task.sla_status = "WARNING"
                await publisher.publish("procurement.workflow", "workflow.sla.reminder",
                    {"task_id": str(task.id), "assigned_to": str(task.assigned_to), "sla_pct": pct},
                    task.org_id)

        await db.commit()
```

### 2.5 Workflow Seed Script
**File:** `scripts/seed_workflows.py`
Insert all 10 workflow template definitions from SPEC_05 Section 3 as JSON into `workflow_templates` table. Each template must:
- Have `org_id` set to the default org (from env)
- Match exactly the JSON structures defined in SPEC_05 Sections 3.1–3.10
- Use escalation configs with specific role codes (not hardcoded user IDs)

### 2.6 Workflow Router
```python
# app/modules/workflow/router.py
router = APIRouter()

@router.get("/instances/{instance_id}")
async def get_instance(instance_id: UUID, current_user = Depends(require_permission(PermissionCode.WORKFLOW_VIEW_OWN_TASKS)), db = Depends(get_db)):

@router.post("/instances/{instance_id}/tasks/{task_id}/approve")
async def approve_task(instance_id: UUID, task_id: UUID, data: TaskActionRequest, current_user = Depends(get_current_user), db = Depends(get_db)):

@router.post("/instances/{instance_id}/tasks/{task_id}/reject")
async def reject_task(...):

@router.post("/instances/{instance_id}/cancel")
async def cancel_instance(instance_id: UUID, data: CancelRequest, current_user = Depends(require_permission(PermissionCode.WORKFLOW_CANCEL)), db = Depends(get_db)):

@router.post("/instances/{instance_id}/force-advance")
async def force_advance(instance_id: UUID, data: ForceAdvanceRequest, current_user = Depends(require_permission(PermissionCode.WORKFLOW_FORCE_ADVANCE)), db = Depends(get_db)):

@router.post("/simulate")
async def simulate(data: SimulateRequest, current_user = Depends(require_permission(PermissionCode.WORKFLOW_SIMULATE)), db = Depends(get_db)):
    """Returns expected chain without creating any DB records."""
    chain = await workflow_engine.simulate(db, data.template_code, data.entity_context, current_user.org_id)
    return {"chain": chain}
```

---

## STEP 3 — TEST

### 3.1 Developer Persona
**File:** `tests/unit/test_workflow_evaluator.py`
```python
def test_safe_eval_simple_comparison():
    assert safe_eval("amount > 100000", {"amount": 200000}) is True

def test_safe_eval_boolean_and():
    assert safe_eval("is_capex == True and amount > 500000", {"is_capex": True, "amount": 600000}) is True

def test_safe_eval_rejects_function_call():
    result = safe_eval("__import__('os').system('rm -rf /')", {})
    assert result is False  # Fails safe

def test_safe_eval_empty_returns_true():
    assert safe_eval("", {}) is True
    assert safe_eval(None, {}) is True

def test_safe_eval_missing_field_returns_false():
    assert safe_eval("nonexistent_field > 100", {}) is False
```

**File:** `tests/workflow/test_workflow_engine.py`
```python
async def test_sequential_happy_path(db, factory):
    """3-step sequential workflow: all approve → COMPLETED."""
    pr = await factory.create_pr(amount=50000)
    instance = await engine.instantiate(db, "PR_APPROVAL", "REQUISITION", pr.id, pr.to_context(), org_id, actor_id)
    assert instance.status == "ACTIVE"

    task = await get_pending_task(db, instance.id)
    await engine.advance(db, instance.id, task.id, "APPROVE", task.assigned_to, "OK", org_id)
    # ... continue for all steps

async def test_parallel_all_one_rejects(db, factory):
    """Parallel ALL: one reject → FAILED, others CANCELLED."""

async def test_parallel_any_first_approves(db, factory):
    """Parallel ANY: first approval cancels others and advances."""

async def test_maker_checker_creator_blocked(db, factory):
    """Creator of PR cannot be assigned as approver."""
    pr = await factory.create_pr(created_by=user_a.id)
    instance = await engine.instantiate(db, "PR_APPROVAL", "REQUISITION", pr.id, pr.to_context(created_by=str(user_a.id)), org_id, user_a.id)
    tasks = await get_pending_tasks(db, instance.id)
    assert all(t.assigned_to != user_a.id for t in tasks)

async def test_sla_warning_at_50_pct(db, factory):
    """SLA check at 50%: sla_status → WARNING, reminder published."""

async def test_sla_escalation_at_100_pct(db, factory):
    """SLA 100%: sla_status → ESCALATED."""

async def test_delegation_routing(db, factory):
    """Active delegation routes task to delegate."""

async def test_simulate_no_db_writes(db, factory):
    """simulate() reads DB but makes no inserts/updates."""
    initial_count = await count_workflow_instances(db)
    await engine.simulate(db, "PR_APPROVAL", {"amount": 50000, "bu_id": str(bu.id)}, org_id)
    assert await count_workflow_instances(db) == initial_count

async def test_force_advance_logs_compliance_event(db, factory):
    """force_advance() creates ADMIN_INTERVENTION workflow_events record."""

async def test_conditional_step_skipped_when_false(db, factory):
    """Conditional step with amount > 500000 skipped when amount=50000."""
```

### 3.2 QA Persona
- Full end-to-end PR_APPROVAL with 4 steps (amount 2.6M CAPEX): all 4 steps active/resolved correctly
- Workflow regression: all 10 template happy paths
- Concurrent task approval race condition: two users approve parallel task simultaneously → exactly one convergence check runs (SELECT FOR UPDATE)
- 500+ PRs in parallel: Celery SLA task completes in < 30 seconds
- Force-advance appears in weekly compliance report
- `graphify check --integrity` passes after workflow nodes added

---

## STEP 4 — INTEGRATE
```bash
python scripts/seed_workflows.py
pytest tests/workflow/ -v --cov=app/modules/workflow
# Must be >= 95% coverage on workflow module
```

---

## STEP 5 — GRAPHIFY UPDATE
```bash
graphify update
# Nodes: WorkflowEngine (all methods), WorkflowTemplate (10 instances),
#        ApproverResolver, SLATimerTask, WorkflowRouter (7 endpoints)
graphify check --integrity
```
