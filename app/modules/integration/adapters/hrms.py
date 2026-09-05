from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import ApprovalTaskStatusEnum, UserStatusEnum
from app.modules.audit.service import audit_service
from app.modules.user.models import User
from app.modules.user.repository import user_repository
from app.modules.user.session_repository import session_repository
from app.modules.workflow.models import WorkflowTask


class HRMSConsumer:
    """Consumer service handling inbound HRMS employee lifecycle webhooks and sync events."""

    def __init__(
        self,
        user_repo=user_repository,
        session_repo=session_repository,
        audit=audit_service,
    ) -> None:
        self.user_repo = user_repo
        self.session_repo = session_repo
        self.audit = audit

    async def handle_termination(
        self,
        db: AsyncSession,
        employee_id: str,
        org_id: UUID,
        reassign_to_user_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Handle employee termination from HRMS:
        1. Set user status to TERMINATED
        2. Revoke all active user sessions immediately
        3. Reassign or revoke pending approval workflow tasks
        4. Log immutable audit trail entry
        """
        user = await self.user_repo.find_by_employee_id(db, employee_id=employee_id, org_id=org_id)
        if not user:
            return {
                "status": "NOT_FOUND",
                "employee_id": employee_id,
                "message": f"User with employee_id '{employee_id}' not found in org '{org_id}'",
            }

        # 1. Update user status to TERMINATED
        user.status = UserStatusEnum.TERMINATED

        # 2. Revoke all active sessions
        await self.session_repo.revoke_all(
            db,
            user_id=user.id,
            org_id=org_id,
            reason="HRMS_TERMINATION",
        )

        # 3. Reassign pending workflow tasks
        tasks_count = await self._reassign_tasks(
            db,
            user_id=user.id,
            org_id=org_id,
            reassign_to_user_id=reassign_to_user_id,
        )

        # 4. Audit trail
        await self.audit.log(
            db,
            entity_type="USER",
            entity_id=user.id,
            action="USER_HRMS_TERMINATED",
            actor_id=None,
            org_id=org_id,
            metadata={
                "employee_id": employee_id,
                "reassigned_to": str(reassign_to_user_id) if reassign_to_user_id else None,
                "tasks_reassigned": tasks_count,
            },
        )

        return {
            "status": "TERMINATED",
            "user_id": str(user.id),
            "employee_id": employee_id,
            "sessions_revoked": True,
            "tasks_reassigned": tasks_count,
        }

    async def _reassign_tasks(
        self,
        db: AsyncSession,
        user_id: UUID,
        org_id: UUID,
        reassign_to_user_id: Optional[UUID] = None,
    ) -> int:
        """Find pending workflow tasks assigned to the terminated user and reassign them."""
        stmt = select(WorkflowTask).where(
            WorkflowTask.assigned_to == user_id,
            WorkflowTask.status == ApprovalTaskStatusEnum.PENDING,
            WorkflowTask.org_id == org_id,
            WorkflowTask.deleted_at.is_(None),
        )
        res = await db.execute(stmt)
        tasks = list(res.scalars().all())

        for task in tasks:
            if reassign_to_user_id:
                task.delegated_from = user_id
                task.assigned_to = reassign_to_user_id
            else:
                # If no replacement provided, tag delegation to mark orphaned approval
                task.delegated_from = user_id

        await db.flush()
        return len(tasks)

    async def handle_employee_created(
        self,
        db: AsyncSession,
        employee_data: Dict[str, Any],
        org_id: UUID,
    ) -> Dict[str, Any]:
        """Create new portal user from HRMS employee profile."""
        email = employee_data.get("email", "").lower().strip()
        employee_id = employee_data.get("employee_id")
        first_name = employee_data.get("first_name", "")
        last_name = employee_data.get("last_name", "")

        user = User(
            org_id=org_id,
            email=email,
            employee_id=employee_id,
            first_name=first_name,
            last_name=last_name,
            status=UserStatusEnum.ACTIVE,
        )
        db.add(user)
        await db.flush()

        await self.audit.log(
            db,
            entity_type="USER",
            entity_id=user.id,
            action="USER_HRMS_CREATED",
            actor_id=None,
            org_id=org_id,
            metadata={"employee_id": employee_id},
        )
        return {"status": "CREATED", "user_id": str(user.id)}


hrms_consumer = HRMSConsumer()
