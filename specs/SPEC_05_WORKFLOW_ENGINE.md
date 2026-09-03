# SPEC_05_WORKFLOW_ENGINE.md

## Title
Enterprise S2P Procurement Portal — Workflow Engine

## Purpose
Define the complete BPM workflow engine architecture, implementation, all workflow template definitions, SLA management, escalation, delegation, maker-checker enforcement, parallel step handling, conditional branching, simulation, and admin intervention controls.

## Scope
Covers engine architecture, JSONB workflow template schema, all 10 workflow template definitions, WorkflowEngine class interface, SLA timer logic, escalation resolution, delegation, maker-checker enforcement, parallel step convergence, conditional evaluation, simulation (dry run), admin intervention audit, and all RabbitMQ events.

## Dependencies
- SPEC_03_DATABASE.md (workflow_templates, workflow_instances, workflow_tasks, workflow_events, delegation_rules tables)
- SPEC_04_AUTH_SECURITY.md (permission model, SoD enforcement)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. Engine Architecture

The workflow engine is a **pure Python async engine** embedded within the modular monolith. It does not depend on any external BPM system.

**Key design decisions:**
- Workflow templates stored as JSONB in `workflow_templates` table — no code changes needed to modify approval flows
- Workflow instances track runtime state in `workflow_instances` + `workflow_tasks`
- SLA timers managed by Celery Beat task (no in-memory timer state)
- All state transitions are transactional (DB + outbox event in same transaction)
- Engine is stateless between calls — all state persisted in DB

**Component interactions:**
```
Entity Submit → ApprovalRulesEngine.resolve_chain() → returns approval steps
    → WorkflowEngine.instantiate() → creates workflow_instance + first task(s)
    → Notification published via outbox
    → User acts on task → WorkflowEngine.advance()
    → Engine evaluates next step → creates new tasks or completes instance
    → Celery Beat checks SLA every 15 min → escalation if needed
```

---

## 2. Workflow Template JSON Schema

Each template's `steps` field is a JSONB array with the following structure:

```json
{
  "steps": [
    {
      "step_number": 1,
      "step_name": "Department Head Approval",
      "step_type": "SEQUENTIAL",
      "resolver": "ROLE",
      "resolver_config": {
        "role_code": "CATEGORY_MANAGER",
        "scope_filter": "same_bu",
        "fallback_role": "PROCUREMENT_HEAD"
      },
      "sla_hours": 24,
      "escalation_config": {
        "sla_50pct_action": "REMINDER",
        "sla_100pct_action": "ESCALATE",
        "sla_100pct_target": "PROCUREMENT_HEAD",
        "sla_150pct_action": "REASSIGN",
        "sla_150pct_target": "DELEGATION_BACKUP",
        "sla_200pct_action": "CRITICAL_ALERT",
        "sla_200pct_target": "PROCUREMENT_ADMIN"
      },
      "convergence": null,
      "condition_expression": null
    },
    {
      "step_number": 2,
      "step_name": "Finance Review",
      "step_type": "CONDITIONAL",
      "condition_expression": "amount > 500000 and is_capex == True",
      "resolver": "ROLE",
      "resolver_config": {
        "role_code": "FINANCE_CONTROLLER",
        "scope_filter": "same_bu"
      },
      "sla_hours": 48,
      "escalation_config": { "..." : "..." },
      "convergence": null
    },
    {
      "step_number": 3,
      "step_name": "Dual Approval Committee",
      "step_type": "PARALLEL",
      "resolver": "APPROVAL_GROUP",
      "resolver_config": {
        "group_code": "HIGH_VALUE_COMMITTEE"
      },
      "sla_hours": 72,
      "escalation_config": { "..." : "..." },
      "convergence": "ALL"
    }
  ]
}
```

**Field definitions:**

| Field | Type | Description |
|---|---|---|
| `step_number` | integer | Sequence order; 1-indexed |
| `step_name` | string | Human-readable step label |
| `step_type` | enum | `SEQUENTIAL` (one approver), `PARALLEL` (multiple approvers simultaneously), `CONDITIONAL` (evaluated; skipped if false) |
| `resolver` | enum | `ROLE` (resolve by role code + scope), `NAMED_USER` (specific user ID), `APPROVAL_GROUP` (group code) |
| `resolver_config` | object | Configuration for the resolver (role_code, user_id, group_code, scope_filter, fallback_role) |
| `sla_hours` | integer | Hours until SLA breach |
| `escalation_config` | object | Actions at 50%, 100%, 150%, 200% of SLA |
| `convergence` | enum or null | For PARALLEL steps: `ALL` (everyone must approve), `ANY` (first approval advances), `MAJORITY` (>50%), `QUORUM_N_OF_M` (e.g., 2 of 3) |
| `condition_expression` | string or null | Python-safe boolean expression evaluated against entity context; step skipped if evaluates to false |

---

## 3. Complete Workflow Template Definitions

### 3.1 `PR_APPROVAL`

```json
{
  "code": "PR_APPROVAL",
  "entity_type": "REQUISITION",
  "steps": [
    {
      "step_number": 1, "step_name": "Budget Holder Approval", "step_type": "SEQUENTIAL",
      "resolver": "ROLE", "resolver_config": {"role_code": "BUYER", "scope_filter": "same_bu_and_category"},
      "sla_hours": 24, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "CATEGORY_MANAGER", "sla_150pct_action": "REASSIGN", "sla_200pct_action": "CRITICAL_ALERT"}
    },
    {
      "step_number": 2, "step_name": "Category Manager Approval", "step_type": "CONDITIONAL",
      "condition_expression": "amount > 100000",
      "resolver": "ROLE", "resolver_config": {"role_code": "CATEGORY_MANAGER", "scope_filter": "same_category"},
      "sla_hours": 24, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "PROCUREMENT_HEAD"}
    },
    {
      "step_number": 3, "step_name": "Procurement Head Approval", "step_type": "CONDITIONAL",
      "condition_expression": "amount > 500000",
      "resolver": "ROLE", "resolver_config": {"role_code": "PROCUREMENT_HEAD"},
      "sla_hours": 48, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "PROCUREMENT_ADMIN"}
    },
    {
      "step_number": 4, "step_name": "CFO Approval", "step_type": "CONDITIONAL",
      "condition_expression": "amount > 2500000 and is_capex == True",
      "resolver": "ROLE", "resolver_config": {"role_code": "FINANCE_CONTROLLER"},
      "sla_hours": 72, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "PROCUREMENT_ADMIN"}
    }
  ]
}
```

### 3.2 `RFQ_APPROVAL`

```json
{
  "code": "RFQ_APPROVAL",
  "entity_type": "RFQ",
  "steps": [
    {
      "step_number": 1, "step_name": "Sourcing Manager Approval", "step_type": "SEQUENTIAL",
      "resolver": "ROLE", "resolver_config": {"role_code": "SOURCING_MANAGER", "scope_filter": "same_bu_and_category"},
      "sla_hours": 24, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "CATEGORY_MANAGER"}
    },
    {
      "step_number": 2, "step_name": "Category Manager Approval", "step_type": "CONDITIONAL",
      "condition_expression": "estimated_value > 500000",
      "resolver": "ROLE", "resolver_config": {"role_code": "CATEGORY_MANAGER", "scope_filter": "same_category"},
      "sla_hours": 24, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "PROCUREMENT_HEAD"}
    },
    {
      "step_number": 3, "step_name": "Procurement Head Approval", "step_type": "CONDITIONAL",
      "condition_expression": "estimated_value > 2500000 or is_single_vendor == True",
      "resolver": "ROLE", "resolver_config": {"role_code": "PROCUREMENT_HEAD"},
      "sla_hours": 48, "escalation_config": {"sla_100pct_action": "CRITICAL_ALERT", "sla_100pct_target": "PROCUREMENT_ADMIN"}
    },
    {
      "step_number": 4, "step_name": "Single Vendor Extra Level", "step_type": "CONDITIONAL",
      "condition_expression": "is_single_vendor == True",
      "resolver": "ROLE", "resolver_config": {"role_code": "COMPLIANCE_OFFICER"},
      "sla_hours": 48, "escalation_config": {"sla_100pct_action": "CRITICAL_ALERT"}
    }
  ]
}
```

### 3.3 `VENDOR_ONBOARDING_APPROVAL`

```json
{
  "code": "VENDOR_ONBOARDING_APPROVAL",
  "entity_type": "VENDOR",
  "steps": [
    {
      "step_number": 1, "step_name": "Vendor Admin Review", "step_type": "SEQUENTIAL",
      "resolver": "ROLE", "resolver_config": {"role_code": "VENDOR_ADMIN"},
      "sla_hours": 48, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "CATEGORY_MANAGER"}
    },
    {
      "step_number": 2, "step_name": "Category Manager Qualification", "step_type": "SEQUENTIAL",
      "resolver": "ROLE", "resolver_config": {"role_code": "CATEGORY_MANAGER", "scope_filter": "vendor_category"},
      "sla_hours": 72, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "PROCUREMENT_HEAD"}
    }
  ]
}
```

### 3.4 `CONTRACT_APPROVAL`

```json
{
  "code": "CONTRACT_APPROVAL",
  "entity_type": "CONTRACT",
  "steps": [
    {
      "step_number": 1, "step_name": "Buyer Review", "step_type": "SEQUENTIAL",
      "resolver": "ROLE", "resolver_config": {"role_code": "BUYER", "scope_filter": "same_bu_and_category"},
      "sla_hours": 24, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "SOURCING_MANAGER"}
    },
    {
      "step_number": 2, "step_name": "Legal Review", "step_type": "SEQUENTIAL",
      "resolver": "ROLE", "resolver_config": {"role_code": "LEGAL"},
      "sla_hours": 72, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "PROCUREMENT_HEAD"}
    },
    {
      "step_number": 3, "step_name": "Sourcing Manager Approval", "step_type": "SEQUENTIAL",
      "resolver": "ROLE", "resolver_config": {"role_code": "SOURCING_MANAGER", "scope_filter": "same_bu_and_category"},
      "sla_hours": 24, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "PROCUREMENT_HEAD"}
    },
    {
      "step_number": 4, "step_name": "Procurement Head Approval", "step_type": "CONDITIONAL",
      "condition_expression": "total_value > 1000000",
      "resolver": "ROLE", "resolver_config": {"role_code": "PROCUREMENT_HEAD"},
      "sla_hours": 48, "escalation_config": {"sla_100pct_action": "CRITICAL_ALERT"}
    },
    {
      "step_number": 5, "step_name": "CFO Approval", "step_type": "CONDITIONAL",
      "condition_expression": "total_value > 5000000",
      "resolver": "ROLE", "resolver_config": {"role_code": "FINANCE_CONTROLLER"},
      "sla_hours": 72, "escalation_config": {"sla_100pct_action": "CRITICAL_ALERT"}
    },
    {
      "step_number": 6, "step_name": "Legal Final Sign-Off", "step_type": "SEQUENTIAL",
      "resolver": "ROLE", "resolver_config": {"role_code": "LEGAL"},
      "sla_hours": 24, "escalation_config": {"sla_100pct_action": "ESCALATE"}
    }
  ]
}
```

### 3.5 `PO_APPROVAL`

```json
{
  "code": "PO_APPROVAL",
  "entity_type": "PURCHASE_ORDER",
  "steps": [
    {
      "step_number": 1, "step_name": "Buyer Verification", "step_type": "SEQUENTIAL",
      "resolver": "ROLE", "resolver_config": {"role_code": "BUYER", "scope_filter": "same_bu_and_category"},
      "sla_hours": 8, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "SOURCING_MANAGER"}
    },
    {
      "step_number": 2, "step_name": "Sourcing Manager Approval", "step_type": "CONDITIONAL",
      "condition_expression": "total_value > 200000",
      "resolver": "ROLE", "resolver_config": {"role_code": "SOURCING_MANAGER", "scope_filter": "same_bu"},
      "sla_hours": 24, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "PROCUREMENT_HEAD"}
    },
    {
      "step_number": 3, "step_name": "Procurement Head Approval", "step_type": "CONDITIONAL",
      "condition_expression": "total_value > 1000000",
      "resolver": "ROLE", "resolver_config": {"role_code": "PROCUREMENT_HEAD"},
      "sla_hours": 48, "escalation_config": {"sla_100pct_action": "CRITICAL_ALERT"}
    }
  ]
}
```

### 3.6 `INVOICE_APPROVAL`

```json
{
  "code": "INVOICE_APPROVAL",
  "entity_type": "INVOICE",
  "steps": [
    {
      "step_number": 1, "step_name": "Finance Controller Approval", "step_type": "SEQUENTIAL",
      "resolver": "ROLE", "resolver_config": {"role_code": "FINANCE_CONTROLLER"},
      "sla_hours": 48, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "PROCUREMENT_HEAD"}
    },
    {
      "step_number": 2, "step_name": "Finance Head Approval", "step_type": "CONDITIONAL",
      "condition_expression": "total_amount > 1000000",
      "resolver": "ROLE", "resolver_config": {"role_code": "PROCUREMENT_HEAD"},
      "sla_hours": 48, "escalation_config": {"sla_100pct_action": "CRITICAL_ALERT"}
    }
  ]
}
```

### 3.7 `UNMAPPED_PR_MAPPING_APPROVAL`

```json
{
  "code": "UNMAPPED_PR_MAPPING_APPROVAL",
  "entity_type": "UNMAPPED_PR",
  "steps": [
    {
      "step_number": 1, "step_name": "Checker Verification", "step_type": "SEQUENTIAL",
      "resolver": "ROLE", "resolver_config": {"role_code": "CATEGORY_MANAGER", "scope_filter": "proposed_category"},
      "sla_hours": 8, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "PROCUREMENT_HEAD"}
    }
  ]
}
```

### 3.8 `MASTER_DATA_CHANGE`

```json
{
  "code": "MASTER_DATA_CHANGE",
  "entity_type": "MASTER_DATA",
  "steps": [
    {
      "step_number": 1, "step_name": "Master Data Admin Approval", "step_type": "SEQUENTIAL",
      "resolver": "ROLE", "resolver_config": {"role_code": "PROCUREMENT_ADMIN"},
      "sla_hours": 24, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "PROCUREMENT_HEAD"}
    }
  ]
}
```

### 3.9 `VENDOR_QUALIFICATION`

```json
{
  "code": "VENDOR_QUALIFICATION",
  "entity_type": "VENDOR",
  "steps": [
    {
      "step_number": 1, "step_name": "Document Verification", "step_type": "SEQUENTIAL",
      "resolver": "ROLE", "resolver_config": {"role_code": "VENDOR_ADMIN"},
      "sla_hours": 48, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "CATEGORY_MANAGER"}
    },
    {
      "step_number": 2, "step_name": "Category Qualification", "step_type": "SEQUENTIAL",
      "resolver": "ROLE", "resolver_config": {"role_code": "CATEGORY_MANAGER", "scope_filter": "vendor_category"},
      "sla_hours": 72, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "PROCUREMENT_HEAD"}
    },
    {
      "step_number": 3, "step_name": "Compliance Check", "step_type": "CONDITIONAL",
      "condition_expression": "risk_class == 'HIGH' or is_strategic == True",
      "resolver": "ROLE", "resolver_config": {"role_code": "COMPLIANCE_OFFICER"},
      "sla_hours": 72, "escalation_config": {"sla_100pct_action": "CRITICAL_ALERT"}
    }
  ]
}
```

### 3.10 `AWARD_RECOMMENDATION_APPROVAL`

```json
{
  "code": "AWARD_RECOMMENDATION_APPROVAL",
  "entity_type": "AWARD",
  "steps": [
    {
      "step_number": 1, "step_name": "Sourcing Manager Approval", "step_type": "SEQUENTIAL",
      "resolver": "ROLE", "resolver_config": {"role_code": "SOURCING_MANAGER", "scope_filter": "same_bu_and_category"},
      "sla_hours": 24, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "CATEGORY_MANAGER"}
    },
    {
      "step_number": 2, "step_name": "Category Manager Approval", "step_type": "SEQUENTIAL",
      "resolver": "ROLE", "resolver_config": {"role_code": "CATEGORY_MANAGER", "scope_filter": "same_category"},
      "sla_hours": 24, "escalation_config": {"sla_100pct_action": "ESCALATE", "sla_100pct_target": "PROCUREMENT_HEAD"}
    },
    {
      "step_number": 3, "step_name": "Procurement Head Approval", "step_type": "CONDITIONAL",
      "condition_expression": "awarded_total > 1000000",
      "resolver": "ROLE", "resolver_config": {"role_code": "PROCUREMENT_HEAD"},
      "sla_hours": 48, "escalation_config": {"sla_100pct_action": "CRITICAL_ALERT"}
    },
    {
      "step_number": 4, "step_name": "Finance Approval", "step_type": "CONDITIONAL",
      "condition_expression": "awarded_total > 5000000",
      "resolver": "ROLE", "resolver_config": {"role_code": "FINANCE_CONTROLLER"},
      "sla_hours": 72, "escalation_config": {"sla_100pct_action": "CRITICAL_ALERT"}
    }
  ]
}
```

---

## 4. WorkflowEngine Class

```python
# app/modules/workflow/service.py

class WorkflowEngine:

    async def instantiate(
        self, db: AsyncSession, template_id: UUID, entity_type: str,
        entity_id: UUID, entity_context: dict, org_id: UUID, actor_id: UUID
    ) -> WorkflowInstance:
        """Create workflow instance and first set of tasks."""
        template = await self.repo.get_template(db, template_id, org_id)
        instance = WorkflowInstance(
            org_id=org_id, template_id=template_id, entity_type=entity_type,
            entity_id=entity_id, entity_context=entity_context, status="ACTIVE",
            current_step_number=1,
        )
        db.add(instance)
        await db.flush()
        await self._process_step(db, instance, template.steps[0], entity_context)
        await self._publish_event(db, "workflow.instance.created", instance, org_id)
        return instance

    async def advance(
        self, db: AsyncSession, instance_id: UUID, task_id: UUID,
        action: str, actor_id: UUID, comment: str, org_id: UUID
    ) -> WorkflowInstance:
        """Process an approval action on a task."""
        instance = await self.repo.get_instance(db, instance_id, org_id)
        task = await self.repo.get_task(db, task_id, org_id)
        self._validate_task_action(task, action, actor_id)
        task.status = "APPROVED" if action == "APPROVE" else "REJECTED"
        task.action = action
        task.comment = comment
        task.acted_at = datetime.utcnow()
        await self._publish_event(db, "workflow.task.completed", instance, org_id, task_id=task_id)
        await self._handle_step_completion(db, instance, task, action)
        return instance

    async def evaluate_conditions(self, step: dict, entity_context: dict) -> bool:
        """Evaluate step condition expression safely."""
        expr = step.get("condition_expression")
        if not expr:
            return True
        return safe_eval(expr, entity_context)

    async def resolve_approvers(
        self, db: AsyncSession, resolver: str, resolver_config: dict,
        entity_context: dict, org_id: UUID
    ) -> list[User]:
        """Resolve list of approver users based on resolver type and config."""
        if resolver == "ROLE":
            users = await self._resolve_by_role(db, resolver_config, entity_context, org_id)
        elif resolver == "NAMED_USER":
            users = [await self.user_repo.get_by_id(db, resolver_config["user_id"], org_id)]
        elif resolver == "APPROVAL_GROUP":
            users = await self._resolve_by_group(db, resolver_config["group_code"], org_id)
        else:
            raise AppException("INVALID_RESOLVER", f"Unknown resolver: {resolver}")
        return await self._apply_delegation(db, users, org_id)

    async def create_tasks_for_step(
        self, db: AsyncSession, instance: WorkflowInstance,
        step: dict, approvers: list[User]
    ) -> list[WorkflowTask]:
        """Create workflow tasks, enforcing maker-checker."""
        entity_creator = instance.entity_context.get("created_by")
        entity_submitter = instance.entity_context.get("submitted_by")
        eligible = [a for a in approvers if a.id != entity_creator and a.id != entity_submitter]
        if not eligible:
            eligible = await self._get_escalation_approvers(db, instance, step)
        if not eligible:
            raise AppException("NO_ELIGIBLE_APPROVER", "No eligible approver after maker-checker filter")
        tasks = []
        group_id = uuid4() if step["step_type"] == "PARALLEL" else None
        for approver in eligible:
            task = WorkflowTask(
                org_id=instance.org_id, workflow_instance_id=instance.id,
                step_number=step["step_number"], assigned_to=approver.id,
                assigned_role=step.get("resolver_config", {}).get("role_code"),
                status="PENDING", parallel_task_group_id=group_id,
                sla_deadline=datetime.utcnow() + timedelta(hours=step["sla_hours"]),
                is_maker_checker_enforced=True,
            )
            db.add(task)
            tasks.append(task)
            await self._publish_event(db, "workflow.task.created", instance, instance.org_id, task_id=task.id)
        return tasks

    async def _handle_step_completion(
        self, db: AsyncSession, instance: WorkflowInstance,
        task: WorkflowTask, action: str
    ):
        """Check if current step is complete; advance or fail instance."""
        step = self._get_step(instance, task.step_number)
        if action in ("REJECT", "RETURN"):
            instance.status = "FAILED"
            instance.completed_at = datetime.utcnow()
            await self._publish_event(db, "workflow.instance.failed", instance, instance.org_id)
            return
        if step["step_type"] == "PARALLEL":
            await self._check_parallel_convergence(db, instance, step, task)
        else:
            await self._advance_to_next_step(db, instance)

    async def _check_parallel_convergence(
        self, db: AsyncSession, instance: WorkflowInstance, step: dict, task: WorkflowTask
    ):
        """Handle parallel step convergence logic."""
        group_tasks = await self.repo.get_tasks_by_group(db, task.parallel_task_group_id, instance.org_id)
        convergence = step.get("convergence", "ALL")
        completed = [t for t in group_tasks if t.status in ("APPROVED", "REJECTED")]
        approved = [t for t in completed if t.status == "APPROVED"]
        rejected = [t for t in completed if t.status == "REJECTED"]
        total = len(group_tasks)

        if convergence == "ALL":
            if rejected:
                instance.status = "FAILED"
                instance.completed_at = datetime.utcnow()
                for t in group_tasks:
                    if t.status == "PENDING":
                        t.status = "CANCELLED"
                return
            if len(approved) == total:
                await self._advance_to_next_step(db, instance)
        elif convergence == "ANY":
            if approved:
                await self._advance_to_next_step(db, instance)
                for t in group_tasks:
                    if t.status == "PENDING":
                        t.status = "CANCELLED"
        elif convergence == "MAJORITY":
            if len(approved) > total / 2:
                await self._advance_to_next_step(db, instance)
                for t in group_tasks:
                    if t.status == "PENDING":
                        t.status = "CANCELLED"
            elif len(rejected) >= total / 2:
                instance.status = "FAILED"
                instance.completed_at = datetime.utcnow()

    async def _advance_to_next_step(self, db: AsyncSession, instance: WorkflowInstance):
        """Move to next step or complete the instance."""
        template = await self.repo.get_template(db, instance.template_id, instance.org_id)
        next_step_number = instance.current_step_number + 1
        remaining_steps = [s for s in template.steps if s["step_number"] >= next_step_number]
        for step in remaining_steps:
            if await self.evaluate_conditions(step, instance.entity_context):
                instance.current_step_number = step["step_number"]
                await self._process_step(db, instance, step, instance.entity_context)
                return
        instance.status = "COMPLETED"
        instance.completed_at = datetime.utcnow()
        await self._publish_event(db, "workflow.instance.completed", instance, instance.org_id)

    async def cancel(self, db: AsyncSession, instance_id: UUID, reason: str, actor_id: UUID, org_id: UUID):
        """Cancel a workflow instance and all pending tasks."""
        instance = await self.repo.get_instance(db, instance_id, org_id)
        instance.status = "CANCELLED"
        instance.cancelled_at = datetime.utcnow()
        instance.cancel_reason = reason
        instance.cancelled_by = actor_id
        pending_tasks = await self.repo.get_pending_tasks(db, instance_id, org_id)
        for task in pending_tasks:
            task.status = "CANCELLED"
        await self._publish_event(db, "workflow.instance.cancelled", instance, org_id)

    async def pause(self, db: AsyncSession, instance_id: UUID, reason: str, actor_id: UUID, org_id: UUID):
        """Pause a workflow instance."""
        instance = await self.repo.get_instance(db, instance_id, org_id)
        instance.status = "PAUSED"
        await self._create_admin_exception(db, instance, "PAUSE", reason, actor_id, org_id)

    async def resume(self, db: AsyncSession, instance_id: UUID, actor_id: UUID, org_id: UUID):
        """Resume a paused workflow instance."""
        instance = await self.repo.get_instance(db, instance_id, org_id)
        instance.status = "ACTIVE"
        await self._create_admin_exception(db, instance, "RESUME", "Resumed by admin", actor_id, org_id)

    async def force_advance(
        self, db: AsyncSession, instance_id: UUID, task_id: UUID,
        actor_id: UUID, reason: str, org_id: UUID
    ):
        """Admin force-approve a task. Creates compliance exception."""
        task = await self.repo.get_task(db, task_id, org_id)
        task.status = "FORCE_APPROVED"
        task.action = "FORCE_APPROVE"
        task.comment = reason
        task.acted_at = datetime.utcnow()
        await self._create_admin_exception(db, await self.repo.get_instance(db, instance_id, org_id),
                                           "FORCE_ADVANCE", reason, actor_id, org_id)
        instance = await self.repo.get_instance(db, instance_id, org_id)
        await self._advance_to_next_step(db, instance)

    async def simulate(
        self, db: AsyncSession, template_id: UUID, entity_context: dict, org_id: UUID
    ) -> list[dict]:
        """Dry-run simulation. Returns expected chain with approver names. No DB writes."""
        template = await self.repo.get_template(db, template_id, org_id)
        chain = []
        for step in template.steps:
            if await self.evaluate_conditions(step, entity_context):
                approvers = await self.resolve_approvers(db, step["resolver"], step["resolver_config"], entity_context, org_id)
                chain.append({
                    "step_number": step["step_number"],
                    "step_name": step["step_name"],
                    "step_type": step["step_type"],
                    "approvers": [{"id": str(a.id), "name": f"{a.first_name} {a.last_name}", "role": step["resolver_config"].get("role_code")} for a in approvers],
                    "sla_hours": step["sla_hours"],
                    "convergence": step.get("convergence"),
                    "condition_met": True,
                })
            else:
                chain.append({
                    "step_number": step["step_number"],
                    "step_name": step["step_name"],
                    "condition_met": False,
                    "condition_expression": step["condition_expression"],
                })
        return chain
```

---

## 5. SLA Timer Implementation

```python
# app/tasks/sla_timers.py

@celery_app.task(queue="celery.sla_timers")
async def check_workflow_sla_timers():
    """Runs every 15 minutes. Scans pending tasks for SLA breaches."""
    async with async_session_factory() as db:
        now = datetime.utcnow()
        pending_tasks = await workflow_repo.get_tasks_with_sla(db)
        for task in pending_tasks:
            elapsed_hours = (now - task.created_at).total_seconds() / 3600
            sla_hours = task.sla_deadline_hours  # from step config

            pct = (elapsed_hours / sla_hours) * 100 if sla_hours > 0 else 0

            if pct >= 200 and task.sla_status != "CRITICAL":
                task.sla_status = "CRITICAL"
                await publish_sla_event(db, task, "workflow.sla.critical", task.org_id)
            elif pct >= 150 and task.sla_status not in ("REASSIGNED", "CRITICAL"):
                task.sla_status = "REASSIGNED"
                await reassign_to_backup(db, task)
                await publish_sla_event(db, task, "workflow.sla.escalation", task.org_id)
            elif pct >= 100 and task.sla_status not in ("ESCALATED", "REASSIGNED", "CRITICAL"):
                task.sla_status = "ESCALATED"
                await publish_sla_event(db, task, "workflow.sla.escalation", task.org_id)
            elif pct >= 50 and task.sla_status == "WITHIN_SLA":
                task.sla_status = "WARNING"
                await publish_sla_event(db, task, "workflow.sla.reminder", task.org_id)
        await db.commit()
```

---

## 6. Escalation Resolution

When SLA reaches 150%:
1. Query `delegation_rules` for active delegation for the primary approver
2. If delegation exists and delegate is eligible (passes maker-checker) → create new task for delegate; mark old task as `ESCALATED`
3. If no delegation → assign to `PROCUREMENT_ADMIN` role
4. Old task status set to `ESCALATED`; new task linked via `delegated_from` field
5. Notification sent to original approver, delegate, and admin

---

## 7. Delegation Logic

At task creation time, the engine checks `delegation_rules`:

```python
async def _apply_delegation(self, db: AsyncSession, users: list[User], org_id: UUID) -> list[User]:
    now = datetime.utcnow()
    result = []
    for user in users:
        delegation = await self.delegation_repo.get_active_delegation(db, user.id, org_id, now)
        if delegation:
            delegate = await self.user_repo.get_by_id(db, delegation.delegate_id, org_id)
            delegate._delegated_from = user.id  # runtime attribute
            result.append(delegate)
        else:
            result.append(user)
    return result
```

---

## 8. Conditional Branch Evaluation

Uses a safe expression evaluator (no `eval()`):

```python
# app/modules/workflow/evaluator.py

from simpleeval import simple_eval, EvalWithCompoundTypes

ALLOWED_OPERATORS = {
    "==", "!=", ">", "<", ">=", "<=", "and", "or", "not", "in", "not in"
}

def safe_eval(expression: str, context: dict) -> bool:
    evaluator = EvalWithCompoundTypes(names=context)
    evaluator.functions = {}  # No function calls allowed
    return bool(evaluator.eval(expression))
```

**Supported context variables:** `amount`, `estimated_value`, `total_value`, `awarded_total`, `total_amount`, `category_level1`, `bu_id`, `rfq_type`, `bidder_count`, `is_capex`, `is_emergency`, `is_single_vendor`, `is_strategic`, `risk_class`, `procurement_type`, `vendor_type`, `sourcing_type`

---

## 9. Admin Intervention Audit

Every admin action (`force_advance`, `pause`, `cancel`, `resume`, `reassign`) creates:
1. `workflow_events` record with `event_type = "ADMIN_INTERVENTION"` and full event data
2. `audit_logs` entry with action `WORKFLOW_ADMIN_INTERVENTION`
3. Compliance exception flag on the workflow instance
4. Weekly compliance report includes all admin interventions

---

## 10. RabbitMQ Events Published

| Event | Exchange | Routing Key | Payload |
|---|---|---|---|
| Instance created | `procurement.workflow` | `workflow.instance.created` | `{instance_id, entity_type, entity_id, template_code}` |
| Task created | `procurement.workflow` | `workflow.task.created` | `{task_id, instance_id, assigned_to, step_name, sla_deadline}` |
| Task completed | `procurement.workflow` | `workflow.task.completed` | `{task_id, instance_id, action, actor_id, comment}` |
| Task escalated | `procurement.workflow` | `workflow.task.escalated` | `{task_id, instance_id, escalated_to, sla_status}` |
| Instance completed | `procurement.workflow` | `workflow.instance.completed` | `{instance_id, entity_type, entity_id, total_duration_hours}` |
| Instance failed | `procurement.workflow` | `workflow.instance.failed` | `{instance_id, entity_type, entity_id, failed_at_step, rejection_comment}` |
| SLA reminder | `procurement.workflow` | `workflow.sla.reminder` | `{task_id, instance_id, assigned_to, sla_pct}` |
| SLA escalation | `procurement.workflow` | `workflow.sla.escalation` | `{task_id, instance_id, original_assignee, escalated_to, sla_pct}` |
| SLA critical | `procurement.workflow` | `workflow.sla.critical` | `{task_id, instance_id, assigned_to, hours_overdue}` |
| Instance cancelled | `procurement.workflow` | `workflow.instance.cancelled` | `{instance_id, entity_type, entity_id, cancelled_by, reason}` |
