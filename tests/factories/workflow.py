from __future__ import annotations
from typing import Optional, Any, List, Dict
from uuid import UUID, uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.enums import WorkflowInstanceStatusEnum, ApprovalTaskStatusEnum
from app.modules.workflow.models import (
    WorkflowTemplate,
    WorkflowInstance,
    WorkflowTask,
    ApprovalGroup,
    ApprovalGroupMember,
)
from tests.factories.organization import OrganizationFactory
from tests.factories.user import UserFactory


class ApprovalGroupFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        **overrides: Any,
    ) -> ApprovalGroup:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id

        grp = ApprovalGroup(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            code=code or f"GRP-{suffix}",
            name=name or f"Approval Group {suffix}",
            is_active=overrides.pop("is_active", True),
            **overrides,
        )
        db.add(grp)
        await db.flush()
        return grp


class WorkflowTemplateFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        entity_type: str = "REQUISITION",
        steps: Optional[List[Dict[str, Any]]] = None,
        **overrides: Any,
    ) -> WorkflowTemplate:
        suffix = uuid4().hex[:6].upper()
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id

        default_steps = [
            {
                "step_number": 1,
                "name": "Manager Approval",
                "approver_type": "ROLE",
                "approver_role": "FINANCE_APPROVER",
                "action_type": "SINGLE",
                "sla_hours": 24,
            }
        ]

        template = WorkflowTemplate(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            code=code or f"WT-{suffix}",
            name=name or f"Template {suffix}",
            entity_type=entity_type,
            steps=steps if steps is not None else default_steps,
            is_active=overrides.pop("is_active", True),
            **overrides,
        )
        db.add(template)
        await db.flush()
        return template


class WorkflowInstanceFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        template_id: Optional[UUID] = None,
        entity_id: Optional[UUID] = None,
        org_id: Optional[UUID] = None,
        entity_type: str = "REQUISITION",
        status: WorkflowInstanceStatusEnum = WorkflowInstanceStatusEnum.ACTIVE,
        current_step_number: int = 1,
        entity_context: Optional[Dict[str, Any]] = None,
        **overrides: Any,
    ) -> WorkflowInstance:
        if not org_id:
            org = await OrganizationFactory.create(db)
            org_id = org.id
        if not template_id:
            tmpl = await WorkflowTemplateFactory.create(db, org_id=org_id, entity_type=entity_type)
            template_id = tmpl.id

        instance = WorkflowInstance(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            template_id=template_id,
            entity_type=entity_type,
            entity_id=entity_id or uuid4(),
            status=status,
            current_step_number=current_step_number,
            entity_context=entity_context or {},
            **overrides,
        )
        db.add(instance)
        await db.flush()
        return instance


class WorkflowTaskFactory:
    @staticmethod
    async def create(
        db: AsyncSession,
        workflow_instance_id: UUID,
        assigned_to: Optional[UUID] = None,
        org_id: Optional[UUID] = None,
        step_number: int = 1,
        status: ApprovalTaskStatusEnum = ApprovalTaskStatusEnum.PENDING,
        **overrides: Any,
    ) -> WorkflowTask:
        if not org_id:
            org_id = uuid4()
        if not assigned_to:
            u = await UserFactory.create(db, org_id=org_id, role="FINANCE_APPROVER")
            assigned_to = u.id

        task = WorkflowTask(
            id=overrides.pop("id", uuid4()),
            org_id=org_id,
            workflow_instance_id=workflow_instance_id,
            step_number=step_number,
            assigned_to=assigned_to,
            assigned_role=overrides.pop("assigned_role", "FINANCE_APPROVER"),
            status=status,
            **overrides,
        )
        db.add(task)
        await db.flush()
        return task
