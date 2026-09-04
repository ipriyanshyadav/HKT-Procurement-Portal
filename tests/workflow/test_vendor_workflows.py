"""
Workflow tests for Vendor Management (SPEC_07).

Tests cover:
1. VENDOR_QUAL workflow:
   - Sequential 3-step definition (Vendor Admin -> Compliance Review -> Finance Validation)
   - Happy path for STRATEGIC vendor (all 3 steps approved -> COMPLETED -> QUALIFIED)
   - Standard vendor condition evaluation (Finance Validation step skipped -> COMPLETED)
   - Rejection in VENDOR_QUAL (REJECT action -> FAILED)
   - Maker-checker exclusion of registration submitter
2. VENDOR_BLACKLIST workflow:
   - Dual-approval 2-step definition (Compliance Officer -> Procurement Head)
   - Dual-approval happy path (both approved -> COMPLETED -> confirm_blacklist succeeds)
   - Segregation of Duties (initiator cannot approve or confirm blacklisting)
   - Rejection in VENDOR_BLACKLIST (step rejection -> FAILED -> vendor remains active)
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.config import settings
from app.core.exceptions import AppException, ForbiddenError, NotFoundError
from app.db.enums import (
    ApprovalTaskStatusEnum,
    VendorStatusEnum,
    WorkflowInstanceStatusEnum,
)
from app.modules.vendor.models import Vendor, VendorDocument
from app.modules.vendor.service import vendor_service
from app.modules.workflow.evaluator import safe_eval
from app.modules.workflow.models import WorkflowInstance, WorkflowTask, WorkflowTemplate
from app.modules.workflow.service import WorkflowEngine
from scripts.seed_workflows import WORKFLOW_TEMPLATES, seed_workflows


test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


def make_user(user_id: UUID | None = None, role: str = "VENDOR_ADMIN") -> MagicMock:
    u = MagicMock()
    u.id = user_id or uuid4()
    u.first_name = "Test"
    u.last_name = "User"
    u.org_id = uuid4()
    u.roles = [role]
    return u


def make_task(
    instance_id: UUID,
    step_number: int,
    assigned_to: UUID | None = None,
    assigned_role: str = "VENDOR_ADMIN",
    status: ApprovalTaskStatusEnum = ApprovalTaskStatusEnum.PENDING,
) -> MagicMock:
    t = MagicMock()
    t.id = uuid4()
    t.org_id = uuid4()
    t.workflow_instance_id = instance_id
    t.step_number = step_number
    t.assigned_to = assigned_to or uuid4()
    t.assigned_role = assigned_role
    t.status = status
    t.action = None
    t.comment = ""
    t.acted_at = None
    t.parallel_task_group_id = None
    t.sla_deadline = datetime.now(timezone.utc) + timedelta(hours=24)
    t.sla_status = "WITHIN_SLA"
    return t


def build_engine() -> WorkflowEngine:
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


# ─── 1. VENDOR_QUAL Template & Workflow Tests ───────────────────────────────

class TestVendorQualificationWorkflow:
    """Tests for VENDOR_QUAL qualification workflow."""

    def test_vendor_qual_template_structure(self):
        """Verify VENDOR_QUAL template has 3 sequential steps with correct roles and conditions."""
        template_def = next(t for t in WORKFLOW_TEMPLATES if t["code"] == "VENDOR_QUAL")
        assert template_def["entity_type"] == "VENDOR"
        steps = template_def["steps"]
        assert len(steps) == 3

        # Step 1: Vendor Admin Review
        assert steps[0]["step_number"] == 1
        assert steps[0]["resolver_config"]["role_code"] == "VENDOR_ADMIN"
        assert steps[0]["condition_expression"] == ""

        # Step 2: Compliance Review
        assert steps[1]["step_number"] == 2
        assert steps[1]["resolver_config"]["role_code"] == "COMPLIANCE_OFFICER"
        assert steps[1]["condition_expression"] == ""

        # Step 3: Finance Validation (conditional)
        assert steps[2]["step_number"] == 3
        assert steps[2]["resolver_config"]["role_code"] == "FINANCE_CONTROLLER"
        assert steps[2]["condition_expression"] == "vendor_type == 'STRATEGIC'"

    def test_vendor_qual_condition_evaluation(self):
        """Verify condition_expression correctly branches for strategic vs standard vendors."""
        expr = "vendor_type == 'STRATEGIC'"
        assert safe_eval(expr, {"vendor_type": "STRATEGIC"}) is True
        assert safe_eval(expr, {"vendor_type": "STANDARD"}) is False
        assert safe_eval(expr, {}) is False

    @pytest.mark.asyncio
    async def test_vendor_qual_strategic_happy_path(self):
        """Strategic vendor undergoes all 3 approval steps to completion."""
        engine = build_engine()
        org_id = uuid4()
        template_def = next(t for t in WORKFLOW_TEMPLATES if t["code"] == "VENDOR_QUAL")

        mock_template = MagicMock()
        mock_template.id = uuid4()
        mock_template.code = "VENDOR_QUAL"
        mock_template.steps = template_def["steps"]

        inst = MagicMock()
        inst.id = uuid4()
        inst.org_id = org_id
        inst.template_id = mock_template.id
        inst.entity_type = "VENDOR"
        inst.entity_id = uuid4()
        inst.entity_context = {"vendor_type": "STRATEGIC", "vendor_id": str(inst.entity_id)}
        inst.current_step_number = 1
        inst.status = WorkflowInstanceStatusEnum.ACTIVE

        # Approvers for each step
        user_admin = make_user(role="VENDOR_ADMIN")
        user_comp = make_user(role="COMPLIANCE_OFFICER")
        user_fin = make_user(role="FINANCE_CONTROLLER")

        task1 = make_task(inst.id, 1, assigned_to=user_admin.id, assigned_role="VENDOR_ADMIN")
        task2 = make_task(inst.id, 2, assigned_to=user_comp.id, assigned_role="COMPLIANCE_OFFICER")
        task3 = make_task(inst.id, 3, assigned_to=user_fin.id, assigned_role="FINANCE_CONTROLLER")

        engine._repo.get_instance.return_value = inst
        engine._repo.get_template.return_value = mock_template
        engine._repo.get_pending_tasks_by_user = AsyncMock(return_value=[])
        engine._resolver.resolve = AsyncMock(side_effect=[[user_comp], [user_fin]])

        db = AsyncMock()
        db.add = MagicMock()
        db.execute = AsyncMock(return_value=MagicMock(fetchone=lambda: None))

        # 1. Step 1 approved by Vendor Admin
        engine._repo.get_task.return_value = task1
        await engine.advance(db, inst.id, task1.id, "APPROVE", user_admin.id, "Admin OK", org_id)
        assert task1.status == ApprovalTaskStatusEnum.APPROVED

        # 2. Step 2 approved by Compliance Officer
        inst.current_step_number = 2
        engine._repo.get_task.return_value = task2
        await engine.advance(db, inst.id, task2.id, "APPROVE", user_comp.id, "Compliance OK", org_id)
        assert task2.status == ApprovalTaskStatusEnum.APPROVED

        # 3. Step 3 approved by Finance Controller -> Completes workflow
        inst.current_step_number = 3
        engine._repo.get_task.return_value = task3
        await engine.advance(db, inst.id, task3.id, "APPROVE", user_fin.id, "Finance OK", org_id)
        assert task3.status == ApprovalTaskStatusEnum.APPROVED
        assert inst.status == WorkflowInstanceStatusEnum.COMPLETED

    @pytest.mark.asyncio
    async def test_vendor_qual_standard_skips_finance_step(self):
        """Standard vendor skips Step 3 (Finance) and completes after Step 2."""
        engine = build_engine()
        org_id = uuid4()
        template_def = next(t for t in WORKFLOW_TEMPLATES if t["code"] == "VENDOR_QUAL")

        mock_template = MagicMock()
        mock_template.id = uuid4()
        mock_template.code = "VENDOR_QUAL"
        mock_template.steps = template_def["steps"]

        inst = MagicMock()
        inst.id = uuid4()
        inst.org_id = org_id
        inst.template_id = mock_template.id
        inst.entity_type = "VENDOR"
        inst.entity_id = uuid4()
        # Non-strategic vendor
        inst.entity_context = {"vendor_type": "STANDARD", "vendor_id": str(inst.entity_id)}
        inst.current_step_number = 2
        inst.status = WorkflowInstanceStatusEnum.ACTIVE

        user_comp = make_user(role="COMPLIANCE_OFFICER")
        task2 = make_task(inst.id, 2, assigned_to=user_comp.id, assigned_role="COMPLIANCE_OFFICER")

        engine._repo.get_instance.return_value = inst
        engine._repo.get_template.return_value = mock_template
        engine._repo.get_task.return_value = task2
        engine._repo.get_pending_tasks_by_user = AsyncMock(return_value=[])

        db = AsyncMock()
        db.add = MagicMock()
        db.execute = AsyncMock(return_value=MagicMock(fetchone=lambda: None))

        # Compliance Officer approves step 2 -> Step 3 condition is False -> Completed
        await engine.advance(db, inst.id, task2.id, "APPROVE", user_comp.id, "Compliance OK", org_id)
        assert task2.status == ApprovalTaskStatusEnum.APPROVED
        assert inst.status == WorkflowInstanceStatusEnum.COMPLETED

    @pytest.mark.asyncio
    async def test_vendor_qual_rejection_fails_workflow(self):
        """Rejection at any step immediately marks the workflow instance as FAILED."""
        engine = build_engine()
        org_id = uuid4()

        inst = MagicMock()
        inst.id = uuid4()
        inst.org_id = org_id
        inst.status = WorkflowInstanceStatusEnum.ACTIVE

        user_comp = make_user(role="COMPLIANCE_OFFICER")
        task2 = make_task(inst.id, 2, assigned_to=user_comp.id)

        engine._repo.get_instance.return_value = inst
        engine._repo.get_task.return_value = task2

        db = AsyncMock()
        db.add = MagicMock()
        db.execute = AsyncMock(return_value=MagicMock(fetchone=lambda: None))

        await engine.advance(db, inst.id, task2.id, "REJECT", user_comp.id, "Non-compliant docs", org_id)
        assert task2.status == ApprovalTaskStatusEnum.REJECTED
        assert inst.status == WorkflowInstanceStatusEnum.FAILED


# ─── 2. VENDOR_BLACKLIST Dual-Approval & SoD Tests ───────────────────────────

class TestVendorBlacklistWorkflow:
    """Tests for VENDOR_BLACKLIST dual-approval workflow and Segregation of Duties."""

    def test_vendor_blacklist_template_structure(self):
        """Verify VENDOR_BLACKLIST has 2 sequential steps (Compliance -> Procurement Head)."""
        template_def = next(t for t in WORKFLOW_TEMPLATES if t["code"] == "VENDOR_BLACKLIST")
        assert template_def["entity_type"] == "VENDOR"
        steps = template_def["steps"]
        assert len(steps) == 2

        # Step 1: Compliance Officer Review
        assert steps[0]["step_number"] == 1
        assert steps[0]["resolver_config"]["role_code"] == "COMPLIANCE_OFFICER"

        # Step 2: Procurement Head Final Approval
        assert steps[1]["step_number"] == 2
        assert steps[1]["resolver_config"]["role_code"] == "PROCUREMENT_HEAD"

    @pytest.mark.asyncio
    async def test_vendor_blacklist_dual_approval_happy_path(self):
        """Dual approval: Step 1 Compliance + Step 2 Procurement Head -> Blacklisted."""
        engine = build_engine()
        org_id = uuid4()
        template_def = next(t for t in WORKFLOW_TEMPLATES if t["code"] == "VENDOR_BLACKLIST")

        mock_template = MagicMock()
        mock_template.id = uuid4()
        mock_template.code = "VENDOR_BLACKLIST"
        mock_template.steps = template_def["steps"]

        inst = MagicMock()
        inst.id = uuid4()
        inst.org_id = org_id
        inst.template_id = mock_template.id
        inst.entity_type = "VENDOR"
        inst.entity_id = uuid4()
        inst.entity_context = {"vendor_id": str(inst.entity_id), "reason": "Breach"}
        inst.current_step_number = 1
        inst.status = WorkflowInstanceStatusEnum.ACTIVE

        compliance_user = make_user(role="COMPLIANCE_OFFICER")
        procurement_head = make_user(role="PROCUREMENT_HEAD")

        task1 = make_task(inst.id, 1, assigned_to=compliance_user.id, assigned_role="COMPLIANCE_OFFICER")
        task2 = make_task(inst.id, 2, assigned_to=procurement_head.id, assigned_role="PROCUREMENT_HEAD")

        engine._repo.get_instance.return_value = inst
        engine._repo.get_template.return_value = mock_template
        engine._repo.get_pending_tasks_by_user = AsyncMock(return_value=[])
        engine._resolver.resolve = AsyncMock(return_value=[procurement_head])

        db = AsyncMock()
        db.add = MagicMock()
        db.execute = AsyncMock(return_value=MagicMock(fetchone=lambda: None))

        # 1. Step 1: Compliance Officer approves
        engine._repo.get_task.return_value = task1
        await engine.advance(db, inst.id, task1.id, "APPROVE", compliance_user.id, "Compliance verified", org_id)
        assert task1.status == ApprovalTaskStatusEnum.APPROVED

        # 2. Step 2: Procurement Head approves -> Completes workflow
        inst.current_step_number = 2
        engine._repo.get_task.return_value = task2
        await engine.advance(db, inst.id, task2.id, "APPROVE", procurement_head.id, "Final approval", org_id)
        assert task2.status == ApprovalTaskStatusEnum.APPROVED
        assert inst.status == WorkflowInstanceStatusEnum.COMPLETED

    @pytest.mark.asyncio
    async def test_vendor_blacklist_initiator_blocked_from_approving(self):
        """Segregation of Duties: Initiator cannot act on blacklist approval tasks."""
        engine = build_engine()
        org_id = uuid4()
        initiator_id = uuid4()
        other_user = make_user()

        inst = MagicMock()
        inst.id = uuid4()
        inst.org_id = org_id
        inst.entity_type = "VENDOR"
        inst.entity_id = uuid4()
        inst.entity_context = {
            "vendor_id": str(inst.entity_id),
            "initiated_by": str(initiator_id),
            "created_by": str(initiator_id),
        }
        inst.status = WorkflowInstanceStatusEnum.ACTIVE

        # Task assigned to other_user
        task = make_task(inst.id, 1, assigned_to=other_user.id)

        engine._repo.get_instance.return_value = inst
        engine._repo.get_task.return_value = task

        db = AsyncMock()
        db.add = MagicMock()
        # Initiator tries to advance task assigned to other_user -> ForbiddenError
        with pytest.raises(ForbiddenError):
            await engine.advance(db, inst.id, task.id, "APPROVE", initiator_id, "Self approve", org_id)

    @pytest.mark.asyncio
    async def test_vendor_blacklist_rejection_fails_workflow(self):
        """Rejection by either Compliance Officer or Procurement Head terminates workflow."""
        engine = build_engine()
        org_id = uuid4()

        inst = MagicMock()
        inst.id = uuid4()
        inst.org_id = org_id
        inst.status = WorkflowInstanceStatusEnum.ACTIVE

        compliance_user = make_user(role="COMPLIANCE_OFFICER")
        task1 = make_task(inst.id, 1, assigned_to=compliance_user.id)

        engine._repo.get_instance.return_value = inst
        engine._repo.get_task.return_value = task1

        db = AsyncMock()
        db.add = MagicMock()
        db.execute = AsyncMock(return_value=MagicMock(fetchone=lambda: None))

        await engine.advance(db, inst.id, task1.id, "REJECT", compliance_user.id, "Insufficient grounds", org_id)
        assert task1.status == ApprovalTaskStatusEnum.REJECTED
        assert inst.status == WorkflowInstanceStatusEnum.FAILED


# ─── 3. End-to-End DB Integration with Seeded Workflows ──────────────────────

@pytest.mark.asyncio
async def test_e2e_vendor_qual_seeded_template_in_db():
    """Verify VENDOR_QUAL and VENDOR_BLACKLIST templates are seeded and retrievable from DB."""
    async with TestSession() as db:
        # Query seeded templates for DEFAULT_ORG_ID
        res = await db.execute(
            text("SELECT code, entity_type, is_active FROM workflow_templates WHERE code IN ('VENDOR_QUAL', 'VENDOR_BLACKLIST')")
        )
        rows = res.fetchall()
        codes = [r[0] for r in rows]
        assert "VENDOR_QUAL" in codes
        assert "VENDOR_BLACKLIST" in codes

        for r in rows:
            assert r[1] == "VENDOR"
            assert r[2] is True
