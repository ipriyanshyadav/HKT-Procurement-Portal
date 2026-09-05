"""Workflow Regression Suite for all 10 Workflow Templates (SPEC_23 S23-03).
Parametrized testing across all 10 workflow templates verifying happy path,
task assignment, state transitions, and terminal completion:
  1. PR_APPROVAL
  2. PR_APPROVAL_CAPEX
  3. RFQ_APPROVAL
  4. VENDOR_QUAL
  5. VENDOR_BLACKLIST
  6. CONTRACT_APPROVAL
  7. PO_APPROVAL
  8. INVOICE_APPROVAL
  9. AWARD_APPROVAL
  10. MASTER_DATA_CHANGE
"""
from __future__ import annotations

from typing import Dict, Any, List
from uuid import UUID, uuid4
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import (
    WorkflowInstanceStatusEnum,
    ApprovalTaskStatusEnum,
)
from app.modules.workflow.models import WorkflowInstance, WorkflowTask, WorkflowTemplate
from app.modules.workflow.service import workflow_service


ALL_WORKFLOW_TEMPLATES = [
    ("PR_APPROVAL", "REQUISITION", {"amount": 50000, "is_capex": False}),
    ("PR_APPROVAL_CAPEX", "REQUISITION", {"amount": 2500000, "is_capex": True}),
    ("RFQ_APPROVAL", "RFQ", {"amount": 5000000, "rfq_type": "LIMITED_TENDER"}),
    ("VENDOR_QUAL", "VENDOR", {"vendor_type": "DOMESTIC"}),
    ("VENDOR_BLACKLIST", "VENDOR", {"risk_class": "HIGH"}),
    ("CONTRACT_APPROVAL", "CONTRACT", {"amount": 10000000}),
    ("PO_APPROVAL", "PURCHASE_ORDER", {"amount": 1000000}),
    ("INVOICE_APPROVAL", "INVOICE", {"amount": 500000}),
    ("AWARD_APPROVAL", "AWARD", {"awarded_total": 3000000}),
    ("MASTER_DATA_CHANGE", "MASTER_DATA", {"change_type": "CATEGORY_TREE_UPDATE"}),
]


@pytest.mark.workflow
@pytest.mark.parametrize("template_code,entity_type,context", ALL_WORKFLOW_TEMPLATES)
async def test_workflow_template_happy_path(
    db: AsyncSession,
    factory,
    template_code: str,
    entity_type: str,
    context: Dict[str, Any],
):
    """Happy path: all 10 workflow templates reach COMPLETED status when approved."""
    org = await factory.organization.create(db)
    creator = await factory.user.create(db, org_id=org.id, role="REQUESTOR")
    approver1 = await factory.user.create(db, org_id=org.id, role="APPROVER")
    approver2 = await factory.user.create(db, org_id=org.id, role="FINANCE_CONTROLLER")

    # Define 2-step approval chain for testing complete lifecycle
    steps: List[Dict[str, Any]] = [
        {
            "step_number": 1,
            "step_name": "Initial Technical Review",
            "step_type": "SEQUENTIAL",
            "resolver": "NAMED_USER",
            "resolver_config": {"user_id": str(approver1.id)},
            "sla_hours": 24,
            "condition_expression": "",
        },
        {
            "step_number": 2,
            "step_name": "Commercial Final Approval",
            "step_type": "SEQUENTIAL",
            "resolver": "NAMED_USER",
            "resolver_config": {"user_id": str(approver2.id)},
            "sla_hours": 48,
            "condition_expression": "",
        },
    ]

    # Create template
    tmpl = await factory.workflow_template.create(
        db,
        org_id=org.id,
        code=template_code,
        name=f"Template {template_code}",
        entity_type=entity_type,
        steps=steps,
    )

    entity_id = uuid4()
    merged_context = {**context, "created_by": str(creator.id)}

    # Step 1: Instantiate workflow
    instance = await workflow_service.instantiate(
        db=db,
        template_code=template_code,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_context=merged_context,
        org_id=org.id,
        actor_id=creator.id,
    )

    assert instance.id is not None
    assert instance.status == WorkflowInstanceStatusEnum.ACTIVE
    assert instance.current_step_number == 1

    # Fetch tasks for step 1
    task_stmt1 = (
        select(WorkflowTask)
        .where(
            WorkflowTask.workflow_instance_id == instance.id,
            WorkflowTask.step_number == 1,
            WorkflowTask.status == ApprovalTaskStatusEnum.PENDING,
        )
    )
    res1 = await db.execute(task_stmt1)
    task1 = res1.scalars().first()
    assert task1 is not None, f"Expected step 1 task for {template_code}"
    assert task1.assigned_to == approver1.id

    # Step 2: Approver 1 approves
    inst_after_step1 = await workflow_service.advance(
        db=db,
        instance_id=instance.id,
        task_id=task1.id,
        action="APPROVE",
        actor_id=approver1.id,
        comment="Approved step 1 by primary approver",
        org_id=org.id,
    )

    assert inst_after_step1.status == WorkflowInstanceStatusEnum.ACTIVE
    assert inst_after_step1.current_step_number == 2

    # Fetch tasks for step 2
    task_stmt2 = (
        select(WorkflowTask)
        .where(
            WorkflowTask.workflow_instance_id == instance.id,
            WorkflowTask.step_number == 2,
            WorkflowTask.status == ApprovalTaskStatusEnum.PENDING,
        )
    )
    res2 = await db.execute(task_stmt2)
    task2 = res2.scalars().first()
    assert task2 is not None, f"Expected step 2 task for {template_code}"
    assert task2.assigned_to == approver2.id

    # Step 3: Approver 2 approves
    inst_completed = await workflow_service.advance(
        db=db,
        instance_id=instance.id,
        task_id=task2.id,
        action="APPROVE",
        actor_id=approver2.id,
        comment="Approved final step",
        org_id=org.id,
    )

    # Verification: instance reaches COMPLETED status
    assert inst_completed.status == WorkflowInstanceStatusEnum.COMPLETED
    assert inst_completed.completed_at is not None


@pytest.mark.workflow
@pytest.mark.parametrize("template_code,entity_type,context", ALL_WORKFLOW_TEMPLATES)
async def test_workflow_template_rejection_path(
    db: AsyncSession,
    factory,
    template_code: str,
    entity_type: str,
    context: Dict[str, Any],
):
    """Rejection path: workflow instance reaches REJECTED/FAILED status immediately upon rejection."""
    org = await factory.organization.create(db)
    creator = await factory.user.create(db, org_id=org.id, role="REQUESTOR")
    approver = await factory.user.create(db, org_id=org.id, role="APPROVER")

    steps: List[Dict[str, Any]] = [
        {
            "step_number": 1,
            "step_name": "Approver Check",
            "step_type": "SEQUENTIAL",
            "resolver": "NAMED_USER",
            "resolver_config": {"user_id": str(approver.id)},
            "sla_hours": 24,
            "condition_expression": "",
        }
    ]

    await factory.workflow_template.create(
        db,
        org_id=org.id,
        code=template_code,
        name=f"Template {template_code}",
        entity_type=entity_type,
        steps=steps,
    )

    entity_id = uuid4()
    merged_context = {**context, "created_by": str(creator.id)}

    instance = await workflow_service.instantiate(
        db=db,
        template_code=template_code,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_context=merged_context,
        org_id=org.id,
        actor_id=creator.id,
    )

    task_stmt = select(WorkflowTask).where(
        WorkflowTask.workflow_instance_id == instance.id,
        WorkflowTask.status == ApprovalTaskStatusEnum.PENDING,
    )
    res = await db.execute(task_stmt)
    task = res.scalars().first()
    assert task is not None

    inst_rejected = await workflow_service.advance(
        db=db,
        instance_id=instance.id,
        task_id=task.id,
        action="REJECT",
        actor_id=approver.id,
        comment="Budget exceeded, rejected",
        org_id=org.id,
    )

    assert inst_rejected.status == WorkflowInstanceStatusEnum.FAILED
