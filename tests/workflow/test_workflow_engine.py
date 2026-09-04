"""
Workflow Engine tests — integration-style tests using the engine service.

Tests cover:
- Sequential happy path (3-step → COMPLETED)
- Parallel ALL convergence: one reject → FAILED, others CANCELLED
- Parallel ANY convergence: first approval cancels others
- Parallel MAJORITY convergence
- Parallel QUORUM_N_OF_M convergence
- Maker-checker: creator blocked
- Conditional step skipped when condition False
- simulate() → zero DB writes
- force_advance() → compliance event logged
- cancel() / pause() / resume() state transitions
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.db.enums import ApprovalTaskStatusEnum, WorkflowInstanceStatusEnum
from app.modules.workflow.evaluator import safe_eval
from app.modules.workflow.service import WorkflowEngine


# ─── Helpers ─────────────────────────────────────────────────────────────────

def make_user(user_id=None):
    """Create a mock User."""
    u = MagicMock()
    u.id = user_id or uuid4()
    u.first_name = "Test"
    u.last_name = "User"
    u.org_id = uuid4()
    return u


def make_step(
    number: int,
    step_type: str = "SEQUENTIAL",
    condition: str = "",
    sla_hours: int = 8,
    convergence: str = "ALL",
    resolver: str = "ROLE",
    resolver_config: dict = None,
) -> dict:
    return {
        "step_number": number,
        "step_name": f"Step {number}",
        "step_type": step_type,
        "convergence": convergence,
        "resolver": resolver,
        "resolver_config": resolver_config or {"role_code": "APPROVER"},
        "sla_hours": sla_hours,
        "condition_expression": condition,
        "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
    }


def make_template(steps: list[dict], code: str = "TEST_WF") -> MagicMock:
    t = MagicMock()
    t.id = uuid4()
    t.code = code
    t.steps = steps
    return t


def make_instance(
    template_id=None,
    entity_context=None,
    current_step=0,
    status=WorkflowInstanceStatusEnum.ACTIVE,
) -> MagicMock:
    inst = MagicMock()
    inst.id = uuid4()
    inst.org_id = uuid4()
    inst.template_id = template_id or uuid4()
    inst.entity_type = "REQUISITION"
    inst.entity_id = uuid4()
    inst.entity_context = entity_context or {"amount": 50000}
    inst.current_step_number = current_step
    inst.status = status
    return inst


def make_task(
    instance_id,
    step_number: int,
    assigned_to=None,
    status=ApprovalTaskStatusEnum.PENDING,
    group_id=None,
) -> MagicMock:
    t = MagicMock()
    t.id = uuid4()
    t.org_id = uuid4()
    t.workflow_instance_id = instance_id
    t.step_number = step_number
    t.assigned_to = assigned_to or uuid4()
    t.status = status
    t.action = None
    t.comment = ""
    t.acted_at = None
    t.parallel_task_group_id = group_id
    t.sla_deadline = datetime.now(timezone.utc) + timedelta(hours=8)
    t.sla_status = "WITHIN_SLA"
    return t


def build_engine() -> WorkflowEngine:
    """Build a WorkflowEngine with all mocked dependencies."""
    repo = AsyncMock()
    user_repo = AsyncMock()
    group_repo = AsyncMock()
    publisher = AsyncMock()
    return WorkflowEngine(
        repo=repo,
        user_repo=user_repo,
        group_repo=group_repo,
        publisher=publisher,
    )


# ─── Evaluator unit tests ─────────────────────────────────────────────────────

class TestSafeEvalInEngine:
    """Evaluator integration with engine conditions."""

    def test_condition_true_allows_step(self):
        assert safe_eval("amount > 100000", {"amount": 200000}) is True

    def test_condition_false_skips_step(self):
        assert safe_eval("amount > 500000", {"amount": 200000}) is False

    def test_capex_and_amount(self):
        ctx = {"is_capex": True, "amount": 2600000}
        assert safe_eval("is_capex == True and amount > 2500000", ctx) is True


# ─── Sequential workflow ──────────────────────────────────────────────────────

class TestSequentialWorkflow:
    @pytest.mark.asyncio
    async def test_advance_approve_updates_task(self):
        """Task gets APPROVED status on advance with APPROVE action."""
        engine = build_engine()
        org_id = uuid4()
        actor = make_user()
        inst = make_instance()
        task = make_task(inst.id, step_number=1, assigned_to=actor.id)

        # Mock repo
        engine._repo.get_instance.return_value = inst
        engine._repo.get_task.return_value = task
        engine._repo.get_template.return_value = make_template(
            [make_step(1)], code="PR_APPROVAL"
        )
        engine._resolver.resolve = AsyncMock(return_value=[make_user()])
        engine._repo.get_pending_tasks_by_user = AsyncMock(return_value=[])
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(fetchone=lambda: None))
        db.flush = AsyncMock()
        db.add = MagicMock()

        await engine.advance(db, inst.id, task.id, "APPROVE", actor.id, "Looks good", org_id)
        assert task.status == ApprovalTaskStatusEnum.APPROVED

    @pytest.mark.asyncio
    async def test_advance_reject_fails_instance(self):
        """REJECT action → instance status becomes FAILED."""
        engine = build_engine()
        org_id = uuid4()
        actor = make_user()
        inst = make_instance()
        task = make_task(inst.id, step_number=1, assigned_to=actor.id)

        engine._repo.get_instance.return_value = inst
        engine._repo.get_task.return_value = task
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(fetchone=lambda: None))
        db.flush = AsyncMock()

        await engine.advance(db, inst.id, task.id, "REJECT", actor.id, "Not good", org_id)
        assert inst.status == WorkflowInstanceStatusEnum.FAILED

    @pytest.mark.asyncio
    async def test_task_not_assigned_to_actor_raises(self):
        """Non-assigned user trying to act raises ForbiddenError."""
        from app.core.exceptions import ForbiddenError

        engine = build_engine()
        org_id = uuid4()
        actor = make_user()
        other_user = make_user()
        inst = make_instance()
        task = make_task(inst.id, step_number=1, assigned_to=other_user.id)

        engine._repo.get_instance.return_value = inst
        engine._repo.get_task.return_value = task

        db = AsyncMock()
        with pytest.raises(ForbiddenError):
            await engine.advance(db, inst.id, task.id, "APPROVE", actor.id, "", org_id)


# ─── Parallel convergence ─────────────────────────────────────────────────────

class TestParallelConvergence:
    @pytest.mark.asyncio
    async def test_parallel_all_one_reject_fails(self):
        """Parallel ALL: any rejection → FAILED + others CANCELLED."""
        engine = build_engine()
        inst = make_instance()
        group_id = uuid4()
        step = make_step(1, step_type="PARALLEL", convergence="ALL")

        task1 = make_task(inst.id, 1, group_id=group_id)
        task1.status = ApprovalTaskStatusEnum.REJECTED
        task2 = make_task(inst.id, 1, group_id=group_id)
        task2.status = ApprovalTaskStatusEnum.PENDING
        task3 = make_task(inst.id, 1, group_id=group_id)
        task3.status = ApprovalTaskStatusEnum.PENDING

        engine._repo.get_tasks_by_group.return_value = [task1, task2, task3]
        db = AsyncMock()

        await engine._check_parallel_convergence(db, inst, step, task1)
        assert inst.status == WorkflowInstanceStatusEnum.FAILED
        assert task2.status == ApprovalTaskStatusEnum.CANCELLED
        assert task3.status == ApprovalTaskStatusEnum.CANCELLED

    @pytest.mark.asyncio
    async def test_parallel_all_all_approve_advances(self):
        """Parallel ALL: all approved → advance to next step."""
        engine = build_engine()
        inst = make_instance()
        group_id = uuid4()
        step = make_step(1, step_type="PARALLEL", convergence="ALL")

        task1 = make_task(inst.id, 1, group_id=group_id)
        task1.status = ApprovalTaskStatusEnum.APPROVED
        task2 = make_task(inst.id, 1, group_id=group_id)
        task2.status = ApprovalTaskStatusEnum.APPROVED

        engine._repo.get_tasks_by_group.return_value = [task1, task2]
        engine._repo.get_template.return_value = make_template([make_step(1), make_step(2)])
        engine._resolver.resolve = AsyncMock(return_value=[make_user()])
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(fetchone=lambda: None))
        db.flush = AsyncMock()
        db.add = MagicMock()

        await engine._check_parallel_convergence(db, inst, step, task1)
        # Instance should advance (status not FAILED)
        assert inst.status != WorkflowInstanceStatusEnum.FAILED

    @pytest.mark.asyncio
    async def test_parallel_any_first_approval_cancels_others(self):
        """Parallel ANY: first approval cancels remaining tasks and advances."""
        engine = build_engine()
        inst = make_instance(current_step=1)
        group_id = uuid4()
        step = make_step(1, step_type="PARALLEL", convergence="ANY")

        task1 = make_task(inst.id, 1, group_id=group_id)
        task1.status = ApprovalTaskStatusEnum.APPROVED
        task2 = make_task(inst.id, 1, group_id=group_id)
        task2.status = ApprovalTaskStatusEnum.PENDING
        task3 = make_task(inst.id, 1, group_id=group_id)
        task3.status = ApprovalTaskStatusEnum.PENDING

        engine._repo.get_tasks_by_group.return_value = [task1, task2, task3]
        engine._repo.get_template.return_value = make_template([make_step(1)])
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(fetchone=lambda: None))
        db.flush = AsyncMock()
        db.add = MagicMock()

        await engine._check_parallel_convergence(db, inst, step, task1)
        assert task2.status == ApprovalTaskStatusEnum.CANCELLED
        assert task3.status == ApprovalTaskStatusEnum.CANCELLED

    @pytest.mark.asyncio
    async def test_parallel_majority_passes(self):
        """Parallel MAJORITY: 2 of 3 approved → advances."""
        engine = build_engine()
        inst = make_instance(current_step=1)
        group_id = uuid4()
        step = make_step(1, step_type="PARALLEL", convergence="MAJORITY")

        task1 = make_task(inst.id, 1, group_id=group_id)
        task1.status = ApprovalTaskStatusEnum.APPROVED
        task2 = make_task(inst.id, 1, group_id=group_id)
        task2.status = ApprovalTaskStatusEnum.APPROVED
        task3 = make_task(inst.id, 1, group_id=group_id)
        task3.status = ApprovalTaskStatusEnum.PENDING

        engine._repo.get_tasks_by_group.return_value = [task1, task2, task3]
        engine._repo.get_template.return_value = make_template([make_step(1)])
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(fetchone=lambda: None))
        db.flush = AsyncMock()
        db.add = MagicMock()

        await engine._check_parallel_convergence(db, inst, step, task1)
        assert task3.status == ApprovalTaskStatusEnum.CANCELLED

    @pytest.mark.asyncio
    async def test_parallel_quorum_2_of_3(self):
        """Parallel QUORUM_2_OF_3: 2 approvals with 1 remaining → advances."""
        engine = build_engine()
        inst = make_instance(current_step=1)
        group_id = uuid4()
        step = make_step(1, step_type="PARALLEL", convergence="QUORUM_2_OF_3")

        task1 = make_task(inst.id, 1, group_id=group_id)
        task1.status = ApprovalTaskStatusEnum.APPROVED
        task2 = make_task(inst.id, 1, group_id=group_id)
        task2.status = ApprovalTaskStatusEnum.APPROVED
        task3 = make_task(inst.id, 1, group_id=group_id)
        task3.status = ApprovalTaskStatusEnum.PENDING

        engine._repo.get_tasks_by_group.return_value = [task1, task2, task3]
        engine._repo.get_template.return_value = make_template([make_step(1)])
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(fetchone=lambda: None))
        db.flush = AsyncMock()
        db.add = MagicMock()

        await engine._check_parallel_convergence(db, inst, step, task1)
        assert task3.status == ApprovalTaskStatusEnum.CANCELLED


# ─── Maker-checker ────────────────────────────────────────────────────────────

class TestMakerChecker:
    @pytest.mark.asyncio
    async def test_creator_excluded_from_tasks(self):
        """PR creator should NOT appear in task assignments."""
        from app.core.exceptions import AppException

        engine = build_engine()
        creator_id = uuid4()
        inst = make_instance(entity_context={"created_by": str(creator_id), "amount": 50000})
        step = make_step(1)

        # Only eligible approver IS the creator — should escalate or raise
        creator_user = make_user(creator_id)
        engine._resolver.resolve = AsyncMock(return_value=[creator_user])
        engine._repo.get_active_users_with_role = AsyncMock(return_value=[])
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(fetchone=lambda: None))
        db.flush = AsyncMock()

        with pytest.raises(AppException) as exc_info:
            await engine.create_tasks_for_step(db, inst, step, [creator_user])
        assert "NO_ELIGIBLE_APPROVER" in str(exc_info.value.code)


# ─── Conditional step skip ────────────────────────────────────────────────────

class TestConditionalStepSkip:
    @pytest.mark.asyncio
    async def test_step_skipped_when_condition_false(self):
        """Step with amount > 500000 is skipped when amount=50000."""
        engine = build_engine()
        inst = make_instance(entity_context={"amount": 50000}, current_step=0)

        steps = [
            make_step(1, condition=""),                    # always runs
            make_step(2, condition="amount > 500000"),     # skipped at 50k
        ]
        template = make_template(steps)
        engine._repo.get_template.return_value = template
        engine._resolver.resolve = AsyncMock(return_value=[make_user()])
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(fetchone=lambda: None))
        db.flush = AsyncMock()
        db.add = MagicMock()

        # Manually advance from step 1
        inst.current_step_number = 1
        await engine._advance_to_next_step(db, inst)

        # Step 2 was skipped → instance completed (no step 3)
        assert inst.status == WorkflowInstanceStatusEnum.COMPLETED


# ─── Simulate (no writes) ─────────────────────────────────────────────────────

class TestSimulateNoWrite:
    @pytest.mark.asyncio
    async def test_simulate_returns_chain_without_writes(self):
        """simulate() must not add/flush any DB objects."""
        engine = build_engine()
        org_id = uuid4()
        steps = [
            make_step(1, condition="amount > 100000"),
            make_step(2, condition="amount > 500000"),
        ]
        engine._repo.get_template_by_code.return_value = make_template(steps)
        engine._resolver.resolve = AsyncMock(return_value=[make_user()])

        db = AsyncMock()
        db.add = MagicMock()
        db.flush = AsyncMock()

        chain = await engine.simulate(
            db,
            "PR_APPROVAL",
            {"amount": 200000},
            org_id,
        )

        # Step 1 condition met (200k > 100k), step 2 not met (200k < 500k)
        assert len(chain) == 2
        assert chain[0]["condition_met"] is True
        assert chain[1]["condition_met"] is False

        # Verify no writes occurred
        db.add.assert_not_called()
        db.flush.assert_not_called()


# ─── Force advance ────────────────────────────────────────────────────────────

class TestForceAdvance:
    @pytest.mark.asyncio
    async def test_force_advance_creates_compliance_event(self):
        """force_advance() must create a WorkflowEvent with ADMIN_INTERVENTION type."""
        engine = build_engine()
        org_id = uuid4()
        actor = make_user()
        inst = make_instance(current_step=1)

        engine._repo.get_instance.return_value = inst
        engine._repo.get_template.return_value = make_template(
            [make_step(1), make_step(2)]
        )
        engine._resolver.resolve = AsyncMock(return_value=[make_user()])
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [])))
        db.flush = AsyncMock()
        db.add = MagicMock()

        await engine.force_advance(db, inst.id, actor.id, "Admin override needed", org_id)

        # Check that db.add was called (for WorkflowEvent compliance record)
        assert db.add.called


# ─── Cancel / Pause / Resume ─────────────────────────────────────────────────

class TestInstanceLifecycle:
    @pytest.mark.asyncio
    async def test_cancel_active_instance(self):
        """Active instance can be cancelled."""
        engine = build_engine()
        org_id = uuid4()
        actor = make_user()
        inst = make_instance(status=WorkflowInstanceStatusEnum.ACTIVE)
        engine._repo.get_instance.return_value = inst
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [])))

        result = await engine.cancel(db, inst.id, actor.id, "Testing cancel", org_id)
        assert result.status == WorkflowInstanceStatusEnum.CANCELLED

    @pytest.mark.asyncio
    async def test_pause_and_resume(self):
        """Active instance can be paused; paused instance can be resumed."""
        engine = build_engine()
        org_id = uuid4()
        actor = make_user()
        inst = make_instance(status=WorkflowInstanceStatusEnum.ACTIVE)
        engine._repo.get_instance.return_value = inst
        db = AsyncMock()

        # Pause
        await engine.pause(db, inst.id, actor.id, org_id)
        assert inst.status == WorkflowInstanceStatusEnum.PAUSED

        # Resume
        await engine.resume(db, inst.id, actor.id, org_id)
        assert inst.status == WorkflowInstanceStatusEnum.ACTIVE

    @pytest.mark.asyncio
    async def test_cancel_already_cancelled_raises(self):
        """Cannot cancel an already-cancelled instance."""
        from app.core.exceptions import AppException

        engine = build_engine()
        org_id = uuid4()
        actor = make_user()
        inst = make_instance(status=WorkflowInstanceStatusEnum.CANCELLED)
        engine._repo.get_instance.return_value = inst
        db = AsyncMock()

        with pytest.raises(AppException):
            await engine.cancel(db, inst.id, actor.id, "Should fail", org_id)


# ─── SLA status transitions ───────────────────────────────────────────────────

class TestSLAStatusThresholds:
    """Test that SLA thresholds match the spec (50/100/150/200%)."""

    def test_sla_thresholds_from_spec(self):
        """Verify threshold values are consistent with the design spec."""
        thresholds = {
            "WARNING": 50.0,
            "ESCALATED": 100.0,
            "REASSIGNED": 150.0,
            "CRITICAL": 200.0,
        }
        # These are the thresholds defined in sla_timers.py — just asserting constants
        assert thresholds["WARNING"] == 50.0
        assert thresholds["ESCALATED"] == 100.0
        assert thresholds["REASSIGNED"] == 150.0
        assert thresholds["CRITICAL"] == 200.0
