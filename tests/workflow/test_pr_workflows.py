"""
Workflow tests for Purchase Requisition (SPEC_08) and Unmapped PR (SPEC_09).

Tests cover:
1. PR_APPROVAL Template & Steps:
   - 4-step conditional workflow structure (HOD -> Finance Controller -> Procurement Head -> CFO)
   - Step conditions evaluation (>500k, >2.5M, Capex >2.5M)
2. PR Workflow Triggers & Execution:
   - test_submit_triggers_workflow: rule match triggers workflow engine and PENDING_APPROVAL
   - test_pr_creator_cannot_approve_workflow: maker-checker rule in workflow context
   - test_pr_rule_unmatched_status: unmatched rule fallback and alert event
3. Background Tasks & SLAs:
   - test_pr_aging_alert_task: PR aging alert escalation based on settings.PR_AGING_ALERT_DAYS
   - test_unmapped_pr_sla_task: Unmapped PR SLA 4-tier escalation based on settings.UNMAPPED_PR_SLA_HOURS
"""
from __future__ import annotations

import json
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text, select
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.config import settings
from app.core.exceptions import AppException, ForbiddenError, NotFoundError
from app.db.enums import (
    PRStatus,
    PrSourceEnum,
    ProcurementTypeEnum,
    UnmappedPrStatusEnum,
)
from app.modules.requisition.models import Requisition, RequisitionLine, UnmappedPrException
from app.modules.requisition.service import requisition_service
from app.modules.requisition.schemas import PRCreateRequest, PRLineItemRequest
from app.modules.unmapped_pr.service import unmapped_pr_service
from app.modules.workflow.evaluator import safe_eval
from app.tasks.pr_aging import async_check_pr_aging, check_pr_aging
from app.tasks.unmapped_pr_sla import async_check_unmapped_sla, check_unmapped_pr_sla
from scripts.seed_workflows import WORKFLOW_TEMPLATES


test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


from tests.integration.test_requisition import create_pr_fixtures


async def create_pr_workflow_fixtures(db: AsyncSession, org_id: UUID) -> dict[str, UUID]:
    """Helper to set up organization structure for workflow testing."""
    fx = await create_pr_fixtures(db, org_id)
    return {
        "actor_id": fx["actor_id"],
        "checker_id": fx["checker_id"],
        "bu_id": fx["bu1_id"],
        "cc_id": fx["cc1_id"],
        "cat_id": fx["cat1_id"],
        "uom_id": fx["uom_id"],
    }


# ─── 1. Template Structure and Condition Tests ──────────────────────────────

class TestPRApprovalWorkflowDefinition:
    """Tests covering PR_APPROVAL template definition and condition expressions."""

    def test_pr_approval_template_structure(self):
        """Verify PR_APPROVAL template defines 4 sequential approval steps with correct roles."""
        template_def = next(t for t in WORKFLOW_TEMPLATES if t["code"] == "PR_APPROVAL")
        assert template_def["entity_type"] == "REQUISITION"
        steps = template_def["steps"]
        assert len(steps) == 4

        # Step 1: HOD Approval (mandatory)
        assert steps[0]["step_number"] == 1
        assert steps[0]["step_name"] == "HOD Approval"
        assert steps[0]["resolver_config"]["role_code"] == "APPROVER"
        assert steps[0]["condition_expression"] == ""

        # Step 2: Finance Controller (amount > 500k)
        assert steps[1]["step_number"] == 2
        assert steps[1]["step_name"] == "Finance Controller Approval"
        assert steps[1]["resolver_config"]["role_code"] == "FINANCE_CONTROLLER"
        assert steps[1]["condition_expression"] == "amount > 500000"

        # Step 3: Procurement Head (amount > 2.5M)
        assert steps[2]["step_number"] == 3
        assert steps[2]["step_name"] == "Procurement Head Approval"
        assert steps[2]["resolver_config"]["role_code"] == "PROCUREMENT_HEAD"
        assert steps[2]["condition_expression"] == "amount > 2500000"

        # Step 4: CFO Approval (is_capex == True and amount > 2.5M)
        assert steps[3]["step_number"] == 4
        assert steps[3]["step_name"] == "CFO Approval"
        assert steps[3]["resolver_config"]["role_code"] == "CFO"
        assert steps[3]["condition_expression"] == "is_capex == True and amount > 2500000"

    def test_pr_approval_conditions_evaluation(self):
        """Test step condition evaluations for low-value, mid-value, and high-value capex PRs."""
        # Low-value OPEX PR: <= 500k -> Only step 1
        ctx_low = {"amount": 300000, "is_capex": False}
        assert safe_eval("", ctx_low) is True
        assert safe_eval("amount > 500000", ctx_low) is False
        assert safe_eval("amount > 2500000", ctx_low) is False
        assert safe_eval("is_capex == True and amount > 2500000", ctx_low) is False

        # Mid-value OPEX PR: 1.2M -> Steps 1 & 2
        ctx_mid = {"amount": 1200000, "is_capex": False}
        assert safe_eval("amount > 500000", ctx_mid) is True
        assert safe_eval("amount > 2500000", ctx_mid) is False
        assert safe_eval("is_capex == True and amount > 2500000", ctx_mid) is False

        # High-value OPEX PR: 3.0M -> Steps 1, 2, 3
        ctx_high_opex = {"amount": 3000000, "is_capex": False}
        assert safe_eval("amount > 500000", ctx_high_opex) is True
        assert safe_eval("amount > 2500000", ctx_high_opex) is True
        assert safe_eval("is_capex == True and amount > 2500000", ctx_high_opex) is False

        # High-value CAPEX PR: 3.0M -> Steps 1, 2, 3, 4
        ctx_high_capex = {"amount": 3000000, "is_capex": True}
        assert safe_eval("amount > 500000", ctx_high_capex) is True
        assert safe_eval("amount > 2500000", ctx_high_capex) is True
        assert safe_eval("is_capex == True and amount > 2500000", ctx_high_capex) is True


from app.modules.approval_rules.models import ApprovalRule
# ─── 2. PR Workflow Triggers & Execution Tests ──────────────────────────────

@pytest.mark.asyncio
async def test_submit_triggers_workflow():
    """PR submit evaluates approval rules and initiates workflow engine."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_pr_workflow_fixtures(db, org_id)

        # Create active approval rule matching any PR
        rule = ApprovalRule(
            org_id=org_id,
            name="PR_DEFAULT_RULE",
            transaction_type="PR",
            priority=1,
            conditions=[{"expression": "amount >= 0"}],
            approval_steps=[{"template_code": "PR_APPROVAL"}],
            is_active=True,
            version=1,
        )
        db.add(rule)
        await db.commit()

        pr = await requisition_service.create(
            db,
            PRCreateRequest(
                title="Office Supplies PR",
                business_unit_id=fx["bu_id"],
                cost_center_id=fx["cc_id"],
                category_id=fx["cat_id"],
                lines=[
                    PRLineItemRequest(
                        line_number=1,
                        item_description="Desks",
                        category_id=fx["cat_id"],
                        uom_id=fx["uom_id"],
                        quantity=Decimal("5"),
                        estimated_unit_price=Decimal("10000"),
                    )
                ],
            ),
            fx["actor_id"],
            org_id,
        )
        await db.commit()
        assert pr.status == PRStatus.DRAFT

        # Mock workflow engine instantiate
        with patch("app.modules.requisition.service.workflow_engine.instantiate", new_callable=AsyncMock) as mock_instantiate:
            mock_instantiate.return_value = MagicMock(id=uuid4())

            submitted_pr = await requisition_service.submit(db, pr.id, fx["actor_id"], org_id)
            await db.commit()

            assert submitted_pr.status == PRStatus.PENDING_APPROVAL
            assert submitted_pr.budget_check_status in ("PASSED", "SUFFICIENT")
            assert mock_instantiate.called
            call_kwargs = mock_instantiate.call_args[1]
            assert call_kwargs["template_code"] == "PR_APPROVAL"
            assert call_kwargs["entity_type"] == "REQUISITION"
            assert call_kwargs["entity_id"] == pr.id


@pytest.mark.asyncio
async def test_pr_creator_cannot_approve_workflow():
    """Maker-checker rule strictly prevents creator from approving their own PR."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_pr_workflow_fixtures(db, org_id)

        pr = await requisition_service.create(
            db,
            PRCreateRequest(
                title="Laptops PR",
                business_unit_id=fx["bu_id"],
                cost_center_id=fx["cc_id"],
                category_id=fx["cat_id"],
                lines=[
                    PRLineItemRequest(
                        line_number=1,
                        item_description="MacBook Pro",
                        category_id=fx["cat_id"],
                        uom_id=fx["uom_id"],
                        quantity=Decimal("2"),
                        estimated_unit_price=Decimal("150000"),
                    )
                ],
            ),
            fx["actor_id"],
            org_id,
        )
        pr.status = PRStatus.PENDING_APPROVAL
        await db.commit()

        # 1. Creator attempts approval -> ForbiddenError
        with pytest.raises(ForbiddenError) as exc_info:
            await requisition_service.approve(
                db,
                pr_id=pr.id,
                task_id=None,
                comment="Self approval attempt",
                actor_id=fx["actor_id"],
                org_id=org_id,
            )
        assert "creator cannot approve" in str(exc_info.value).lower()

        # 2. Independent approver approves -> Success
        approved = await requisition_service.approve(
            db,
            pr_id=pr.id,
            task_id=None,
            comment="Approved by HOD",
            actor_id=fx["checker_id"],
            org_id=org_id,
        )
        await db.commit()
        assert approved.status == PRStatus.APPROVED
        assert approved.approved_at is not None


@pytest.mark.asyncio
async def test_pr_rule_unmatched_status():
    """When no approval rules match, PR remains in SUBMITTED status and raises pr.rule.unmatched alert."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_pr_workflow_fixtures(db, org_id)

        pr = await requisition_service.create(
            db,
            PRCreateRequest(
                title="Unmatched Rule PR",
                business_unit_id=fx["bu_id"],
                cost_center_id=fx["cc_id"],
                category_id=fx["cat_id"],
                lines=[
                    PRLineItemRequest(
                        line_number=1,
                        item_description="Unmatched Item",
                        category_id=fx["cat_id"],
                        uom_id=fx["uom_id"],
                        quantity=Decimal("1"),
                        estimated_unit_price=Decimal("5000"),
                    )
                ],
            ),
            fx["actor_id"],
            org_id,
        )
        await db.commit()

        # Submit when no rules exist for this org
        with patch("app.modules.requisition.service.OutboxPublisher.publish", new_callable=AsyncMock) as mock_outbox:
            submitted_pr = await requisition_service.submit(db, pr.id, fx["actor_id"], org_id)
            await db.commit()

            assert submitted_pr.status == PRStatus.SUBMITTED
            # Verify pr.rule.unmatched event was published
            called_topics = [call[0][2] for call in mock_outbox.call_args_list]
            assert "pr.rule.unmatched" in called_topics


# ─── 3. Background Tasks & SLAs Tests ───────────────────────────────────────

@pytest.mark.asyncio
async def test_pr_aging_alert_task():
    """Test check_pr_aging task identifying aging PRs and escalating alert levels according to PR_AGING_ALERT_DAYS."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_pr_workflow_fixtures(db, org_id)

        thresholds = sorted(settings.PR_AGING_ALERT_DAYS)  # e.g. [7, 14, 30]
        t1_days = thresholds[0] + 1  # e.g. 8 days old -> Level 1
        t2_days = thresholds[1] + 1  # e.g. 15 days old -> Level 2

        now = datetime.now(timezone.utc)

        # 1. Fresh PR (today)
        pr_fresh = Requisition(
            org_id=org_id,
            pr_number=f"PR-FRESH-{org_id.hex[:4]}",
            title="Fresh PR",
            source=PrSourceEnum.MANUAL,
            status=PRStatus.PENDING_APPROVAL,
            procurement_type=ProcurementTypeEnum.OPEX,
            requestor_id=fx["actor_id"],
            business_unit_id=fx["bu_id"],
            cost_center_id=fx["cc_id"],
            category_id=fx["cat_id"],
            created_at=now,
            approved_at=None,
            aging_alert_level=0,
        )
        db.add(pr_fresh)

        # 2. Aging PR Level 1 (e.g. 8 days ago)
        pr_aging_1 = Requisition(
            org_id=org_id,
            pr_number=f"PR-AGING1-{org_id.hex[:4]}",
            title="Aging PR Tier 1",
            source=PrSourceEnum.MANUAL,
            status=PRStatus.PENDING_APPROVAL,
            procurement_type=ProcurementTypeEnum.OPEX,
            requestor_id=fx["actor_id"],
            business_unit_id=fx["bu_id"],
            cost_center_id=fx["cc_id"],
            category_id=fx["cat_id"],
            created_at=now - timedelta(days=t1_days),
            approved_at=None,
            aging_alert_level=0,
        )
        db.add(pr_aging_1)

        # 3. Aging PR Level 2 (e.g. 15 days ago)
        pr_aging_2 = Requisition(
            org_id=org_id,
            pr_number=f"PR-AGING2-{org_id.hex[:4]}",
            title="Aging PR Tier 2",
            source=PrSourceEnum.MANUAL,
            status=PRStatus.APPROVED,
            procurement_type=ProcurementTypeEnum.OPEX,
            requestor_id=fx["actor_id"],
            business_unit_id=fx["bu_id"],
            cost_center_id=fx["cc_id"],
            category_id=fx["cat_id"],
            created_at=now - timedelta(days=t2_days),
            approved_at=now - timedelta(days=t2_days),
            aging_alert_level=0,
        )
        db.add(pr_aging_2)
        await db.commit()

        # Run async_check_pr_aging with TestSession
        result = await async_check_pr_aging(session_factory=TestSession)
        assert result["alerts_sent"] >= 2

        # Re-fetch PRs and verify alert levels
        await db.refresh(pr_fresh)
        await db.refresh(pr_aging_1)
        await db.refresh(pr_aging_2)

        assert pr_fresh.aging_alert_level == 0
        assert pr_aging_1.aging_alert_level == 1
        assert pr_aging_2.aging_alert_level == 2


@pytest.mark.asyncio
async def test_unmapped_pr_sla_task():
    """Test check_unmapped_pr_sla task escalating unmapped exceptions across 4 tiers."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_pr_workflow_fixtures(db, org_id)

        sla_hours = settings.UNMAPPED_PR_SLA_HOURS  # [4, 8, 24, 48]
        now = datetime.now(timezone.utc)

        pr = await requisition_service.create(
            db,
            PRCreateRequest(
                title="Unmapped Exception PR",
                business_unit_id=fx["bu_id"],
                cost_center_id=fx["cc_id"],
                category_id=fx["cat_id"],
                lines=[
                    PRLineItemRequest(
                        line_number=1,
                        item_description="Raw Chemical",
                        category_id=fx["cat_id"],
                        uom_id=fx["uom_id"],
                        quantity=Decimal("10"),
                        estimated_unit_price=Decimal("100"),
                    )
                ],
            ),
            fx["actor_id"],
            org_id,
        )
        await db.commit()

        # Create exception aged 10 hours (exceeds tier 2: 8h, but < tier 3: 24h)
        exc = UnmappedPrException(
            org_id=org_id,
            requisition_id=pr.id,
            failed_fields={"category_id": "RAW-CHEM-99"},
            status=UnmappedPrStatusEnum.PENDING,
            sla_breach_level=0,
            created_at=now - timedelta(hours=10),
        )
        db.add(exc)
        await db.commit()
        await db.refresh(exc)

        # Run unmapped PR SLA task
        result = await async_check_unmapped_sla(session_factory=TestSession)
        assert result["escalations"] >= 1

        await db.refresh(exc)
        # Should be escalated to tier 2
        assert exc.sla_breach_level == 2

        # Fast forward exception to 30 hours old -> should escalate to tier 3
        exc.created_at = now - timedelta(hours=30)
        await db.commit()

        result2 = await async_check_unmapped_sla(session_factory=TestSession)
        assert result2["escalations"] >= 1

        await db.refresh(exc)
        assert exc.sla_breach_level == 3
