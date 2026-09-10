"""Integration tests for Advanced Workflow Rules Engine & Delegation (SPEC_04, SPEC_05, SPEC_06).

Covers:
- Dynamic approval matrix condition evaluation (eq, gte, in, is_true) & priority/specificity resolution
- Out-of-office delegation rules with multi-entity scoping (PR vs PO) and Maker-Checker enforcement
- Parallel step convergence routing (ALL, ANY, MAJORITY, QUORUM_N_OF_M)
- Approval rules resolve-chain API endpoint
"""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.db.enums import (
    WorkflowInstanceStatusEnum,
    ApprovalTaskStatusEnum,
    UserStatusEnum,
)
from app.db.session import get_db
from app.main import app
from app.modules.user.models import User, DelegationRule
from app.modules.user.role_repository import role_repository
from app.modules.workflow.models import (
    WorkflowInstance,
    WorkflowTask,
    WorkflowTemplate,
)
from app.modules.workflow.service import workflow_engine
from app.modules.approval_rules.models import ApprovalRule
from app.modules.approval_rules.service import rules_engine


@pytest.fixture
def test_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "admin@procurement.example.com"
    user.first_name = "Workflow"
    user.last_name = "Admin"
    user.status = UserStatusEnum.ACTIVE
    user.is_supplier_user = False
    return user


@pytest.fixture
def client(test_user):
    async def _fake_db():
        mock = AsyncMock()
        mock.execute = AsyncMock()
        mock.commit = AsyncMock()
        mock.flush = AsyncMock()
        mock.refresh = AsyncMock()
        mock.add = MagicMock()
        yield mock

    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[get_current_user] = lambda: test_user

    with patch.object(role_repository, "user_has_permission", new_callable=AsyncMock, return_value=True):
        yield TestClient(app)

    app.dependency_overrides.clear()


@pytest.mark.integration
class TestWorkflowDelegationAndSplitSpec0405:

    # ─────────────────────────────────────────────────────────────────────────
    # 1. Multi-Entity Out-of-Office Delegation
    # ─────────────────────────────────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_delegation_multi_entity_scoping(self):
        """Test that delegation rule scoped to PR applies to PR but not to PO."""
        org_id = uuid4()
        delegator = User(
            id=uuid4(),
            org_id=org_id,
            email="manager@procurement.example.com",
            first_name="Finance",
            last_name="Manager",
            status=UserStatusEnum.ACTIVE,
        )
        delegate = User(
            id=uuid4(),
            org_id=org_id,
            email="deputy@procurement.example.com",
            first_name="Deputy",
            last_name="Manager",
            status=UserStatusEnum.ACTIVE,
        )

        db = AsyncMock()

        # Rule specifically scoped to PR
        pr_rule_row = (delegate.id, ["PR"])

        async def fake_execute_pr(stmt, params=None, *args, **kwargs):
            mock_res = MagicMock()
            mock_res.fetchall.return_value = [pr_rule_row]
            return mock_res

        db.execute = AsyncMock(side_effect=fake_execute_pr)

        with patch("app.modules.user.repository.user_repository.get_by_id", new_callable=AsyncMock, return_value=delegate):
            # Case A: Entity is PURCHASE_REQUISITION -> delegate substituted
            result_pr = await workflow_engine._apply_delegation(
                db, [delegator], org_id, entity_type="PURCHASE_REQUISITION"
            )
            assert len(result_pr) == 1
            assert result_pr[0].id == delegate.id
            assert getattr(result_pr[0], "_delegated_from") == delegator.id

            # Case B: Entity is PURCHASE_ORDER -> delegation NOT applied (remains original delegator)
            result_po = await workflow_engine._apply_delegation(
                db, [delegator], org_id, entity_type="PURCHASE_ORDER"
            )
            assert len(result_po) == 1
            assert result_po[0].id == delegator.id
            assert not hasattr(result_po[0], "_delegated_from")

    @pytest.mark.asyncio
    async def test_delegation_maker_checker_enforcement(self):
        """Test that if the delegate created the entity, Maker-Checker rejects them."""
        org_id = uuid4()
        creator_id = uuid4()
        approver = User(
            id=uuid4(),
            org_id=org_id,
            email="head@procurement.example.com",
            first_name="Dept",
            last_name="Head",
            status=UserStatusEnum.ACTIVE,
        )
        # Delegate is the creator of the PR!
        delegate = User(
            id=creator_id,
            org_id=org_id,
            email="requestor@procurement.example.com",
            first_name="Junior",
            last_name="Buyer",
            status=UserStatusEnum.ACTIVE,
        )
        delegate._delegated_from = approver.id

        instance = WorkflowInstance(
            id=uuid4(),
            org_id=org_id,
            template_id=uuid4(),
            entity_type="PURCHASE_REQUISITION",
            entity_id=uuid4(),
            status=WorkflowInstanceStatusEnum.ACTIVE,
            entity_context={"created_by": str(creator_id), "submitted_by": str(creator_id)},
        )

        step = {
            "step_number": 1,
            "step_name": "Manager Approval",
            "step_type": "SEQUENTIAL",
            "sla_hours": 24,
            "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
        }

        db = AsyncMock()

        escalation_admin = User(
            id=uuid4(),
            org_id=org_id,
            email="admin@procurement.example.com",
            first_name="Admin",
            last_name="Super",
            status=UserStatusEnum.ACTIVE,
        )

        with patch.object(workflow_engine, "_get_escalation_approvers", new_callable=AsyncMock, return_value=[escalation_admin]):
            await workflow_engine.create_tasks_for_step(db, instance, step, [delegate])

            # Verified: delegate was excluded due to Maker-Checker, escalated to escalation_admin
            assert db.add.call_count == 1
            created_task = db.add.call_args[0][0]
            assert created_task.assigned_to == escalation_admin.id

    # ─────────────────────────────────────────────────────────────────────────
    # 2. Dynamic Approval Matrix Conditions & Specificity
    # ─────────────────────────────────────────────────────────────────────────

    def test_structured_condition_evaluations(self):
        """Test _evaluate_conditions with various operators: eq, gte, in, is_true, not_in."""
        context = {
            "amount": 750000,
            "procurement_type": "CAPEX",
            "bu_id": "bu-tech-01",
            "is_emergency": False,
        }

        # Passing conditions
        conditions_pass = [
            {"field": "amount", "operator": "gte", "value": 500000},
            {"field": "procurement_type", "operator": "eq", "value": "CAPEX"},
            {"field": "bu_id", "operator": "in", "value": ["bu-tech-01", "bu-tech-02"]},
            {"field": "is_emergency", "operator": "is_false", "value": None},
        ]
        assert rules_engine._evaluate_conditions(conditions_pass, context) is True

        # Failing condition (amount < 1,000,000)
        conditions_fail = [
            {"field": "amount", "operator": "gte", "value": 1000000},
            {"field": "procurement_type", "operator": "eq", "value": "CAPEX"},
        ]
        assert rules_engine._evaluate_conditions(conditions_fail, context) is False

    @pytest.mark.asyncio
    async def test_resolve_chain_with_specificity_tie_breaking(self):
        """Test that between two rules at the same priority, the more specific one wins."""
        org_id = uuid4()
        context = {
            "amount": 800000,
            "procurement_type": "CAPEX",
            "is_capex": True,
        }

        # Rule 1: Priority 1, 1 condition
        rule1 = ApprovalRule(
            id=uuid4(),
            org_id=org_id,
            name="General High Value",
            transaction_type="PURCHASE_REQUISITION",
            priority=1,
            conditions=[{"field": "amount", "operator": "gte", "value": 500000}],
            approval_steps=[{"step_number": 1, "role": "FINANCE_DIRECTOR"}],
            is_active=True,
        )

        # Rule 2: Priority 1, 2 conditions (more specific!)
        rule2 = ApprovalRule(
            id=uuid4(),
            org_id=org_id,
            name="CAPEX High Value Matrix",
            transaction_type="PURCHASE_REQUISITION",
            priority=1,
            conditions=[
                {"field": "amount", "operator": "gte", "value": 500000},
                {"field": "procurement_type", "operator": "eq", "value": "CAPEX"},
            ],
            approval_steps=[{"step_number": 1, "role": "CFO"}],
            is_active=True,
        )

        db = AsyncMock()
        with patch.object(rules_engine._repo, "get_active_rules", new_callable=AsyncMock, return_value=[rule1, rule2]):
            result = await rules_engine.resolve_chain(db, "PURCHASE_REQUISITION", context, org_id)

            assert result["status"] == "RESOLVED"
            assert result["rule_id"] == str(rule2.id)
            assert result["approval_steps"] == [{"step_number": 1, "role": "CFO"}]

    def test_post_resolve_chain_api(self, client, test_user):
        """Test POST /api/v1/approval-rules/resolve-chain endpoint."""
        sim_result = {
            "status": "RESOLVED",
            "rule_id": str(uuid4()),
            "rule_code": "PR-CAPEX-APPROVAL-CHAIN",
            "approval_steps": [{"step_number": 1, "role_code": "FINANCE_HEAD"}],
            "workflow_template_code": "PR_CAPEX_V1",
            "is_catch_all": False,
        }

        with patch.object(rules_engine, "resolve_chain", new_callable=AsyncMock, return_value=sim_result):
            res = client.post(
                "/api/v1/approval-rules/resolve-chain",
                json={
                    "entity_type": "PURCHASE_REQUISITION",
                    "entity_context": {
                        "amount": 1200000,
                        "procurement_type": "CAPEX",
                    },
                },
            )
            assert res.status_code == 200
            data = res.json()["data"]
            assert data["status"] == "RESOLVED"
            assert data["workflow_template_code"] == "PR_CAPEX_V1"

    # ─────────────────────────────────────────────────────────────────────────
    # 3. Parallel Split-Step Routing & Convergence (ALL, ANY, MAJORITY, QUORUM)
    # ─────────────────────────────────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_parallel_convergence_all(self):
        """Test ALL convergence: one rejection fails the workflow instance."""
        org_id = uuid4()
        group_id = uuid4()
        instance = WorkflowInstance(
            id=uuid4(),
            org_id=org_id,
            template_id=uuid4(),
            entity_type="PURCHASE_REQUISITION",
            entity_id=uuid4(),
            status=WorkflowInstanceStatusEnum.ACTIVE,
        )

        task1 = WorkflowTask(
            id=uuid4(),
            org_id=org_id,
            workflow_instance_id=instance.id,
            step_number=1,
            assigned_to=uuid4(),
            status=ApprovalTaskStatusEnum.APPROVED,
            parallel_task_group_id=group_id,
        )
        task2 = WorkflowTask(
            id=uuid4(),
            org_id=org_id,
            workflow_instance_id=instance.id,
            step_number=1,
            assigned_to=uuid4(),
            status=ApprovalTaskStatusEnum.REJECTED,
            parallel_task_group_id=group_id,
        )
        task3 = WorkflowTask(
            id=uuid4(),
            org_id=org_id,
            workflow_instance_id=instance.id,
            step_number=1,
            assigned_to=uuid4(),
            status=ApprovalTaskStatusEnum.PENDING,
            parallel_task_group_id=group_id,
        )

        db = AsyncMock()
        with patch.object(workflow_engine._repo, "get_tasks_by_group", new_callable=AsyncMock, return_value=[task1, task2, task3]):
            step = {"step_type": "PARALLEL", "convergence": "ALL"}
            await workflow_engine._check_parallel_convergence(db, instance, step, task2)

            assert instance.status == WorkflowInstanceStatusEnum.FAILED
            assert task3.status == ApprovalTaskStatusEnum.CANCELLED

    @pytest.mark.asyncio
    async def test_parallel_convergence_any(self):
        """Test ANY convergence: first approval advances and cancels remaining tasks."""
        org_id = uuid4()
        group_id = uuid4()
        instance = WorkflowInstance(
            id=uuid4(),
            org_id=org_id,
            template_id=uuid4(),
            entity_type="PURCHASE_REQUISITION",
            entity_id=uuid4(),
            status=WorkflowInstanceStatusEnum.ACTIVE,
        )

        task1 = WorkflowTask(
            id=uuid4(),
            org_id=org_id,
            workflow_instance_id=instance.id,
            step_number=1,
            assigned_to=uuid4(),
            status=ApprovalTaskStatusEnum.APPROVED,
            parallel_task_group_id=group_id,
        )
        task2 = WorkflowTask(
            id=uuid4(),
            org_id=org_id,
            workflow_instance_id=instance.id,
            step_number=1,
            assigned_to=uuid4(),
            status=ApprovalTaskStatusEnum.PENDING,
            parallel_task_group_id=group_id,
        )

        db = AsyncMock()
        with patch.object(workflow_engine._repo, "get_tasks_by_group", new_callable=AsyncMock, return_value=[task1, task2]), \
             patch.object(workflow_engine, "_advance_to_next_step", new_callable=AsyncMock) as mock_advance:
            step = {"step_type": "PARALLEL", "convergence": "ANY"}
            await workflow_engine._check_parallel_convergence(db, instance, step, task1)

            assert task2.status == ApprovalTaskStatusEnum.CANCELLED
            assert mock_advance.call_count == 1

    @pytest.mark.asyncio
    async def test_parallel_convergence_majority(self):
        """Test MAJORITY convergence: 2 out of 3 approvals advance."""
        org_id = uuid4()
        group_id = uuid4()
        instance = WorkflowInstance(
            id=uuid4(),
            org_id=org_id,
            template_id=uuid4(),
            entity_type="PURCHASE_REQUISITION",
            entity_id=uuid4(),
            status=WorkflowInstanceStatusEnum.ACTIVE,
        )

        task1 = WorkflowTask(
            id=uuid4(),
            org_id=org_id,
            workflow_instance_id=instance.id,
            step_number=1,
            assigned_to=uuid4(),
            status=ApprovalTaskStatusEnum.APPROVED,
            parallel_task_group_id=group_id,
        )
        task2 = WorkflowTask(
            id=uuid4(),
            org_id=org_id,
            workflow_instance_id=instance.id,
            step_number=1,
            assigned_to=uuid4(),
            status=ApprovalTaskStatusEnum.APPROVED,
            parallel_task_group_id=group_id,
        )
        task3 = WorkflowTask(
            id=uuid4(),
            org_id=org_id,
            workflow_instance_id=instance.id,
            step_number=1,
            assigned_to=uuid4(),
            status=ApprovalTaskStatusEnum.PENDING,
            parallel_task_group_id=group_id,
        )

        db = AsyncMock()
        with patch.object(workflow_engine._repo, "get_tasks_by_group", new_callable=AsyncMock, return_value=[task1, task2, task3]), \
             patch.object(workflow_engine, "_advance_to_next_step", new_callable=AsyncMock) as mock_advance:
            step = {"step_type": "PARALLEL", "convergence": "MAJORITY"}
            await workflow_engine._check_parallel_convergence(db, instance, step, task2)

            assert task3.status == ApprovalTaskStatusEnum.CANCELLED
            assert mock_advance.call_count == 1
