"""
Workflow Router — 7 endpoints.

Auth: every endpoint requires authentication.
Permissions are checked via require_permission() dependency.
simulate() enforces auth; zero DB writes guaranteed by service layer.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_permission
from app.core.constants import PermissionCode
from app.core.responses import PaginationMeta, success_response
from app.db.session import get_db
from app.modules.user.models import User
from app.modules.workflow.schemas import (
    CancelRequest,
    ForceAdvanceRequest,
    SimulateRequest,
    TaskActionRequest,
    WorkflowInstanceResponse,
    WorkflowSimulateResponse,
    WorkflowTaskResponse,
)
from app.modules.workflow.service import workflow_engine

router = APIRouter()


@router.get("/instances/{instance_id}")
async def get_instance(
    instance_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.WORKFLOW_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """Get a workflow instance by ID."""
    instance = await workflow_engine._repo.get_instance(db, instance_id, current_user.org_id)
    return success_response(WorkflowInstanceResponse.model_validate(instance))


@router.get("/tasks/my")
async def get_my_tasks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    page_size: int = 25,
):
    """Get pending workflow tasks assigned to the current user."""
    skip = (page - 1) * page_size
    tasks = await workflow_engine._repo.get_pending_tasks_by_user(
        db, current_user.id, current_user.org_id, skip=skip, limit=page_size
    )
    total = await workflow_engine._repo.count_pending_tasks_by_user(
        db, current_user.id, current_user.org_id
    )
    total_pages = max(1, (total + page_size - 1) // page_size) if page_size else 1
    return success_response(
        [WorkflowTaskResponse.model_validate(t) for t in tasks],
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total_count=total,
            total_pages=total_pages,
        ),
    )


@router.post("/instances/{instance_id}/tasks/{task_id}/approve")
async def approve_task(
    instance_id: UUID,
    task_id: UUID,
    data: TaskActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a workflow task."""
    instance = await workflow_engine.advance(
        db, instance_id, task_id, "APPROVE", current_user.id, data.comment, current_user.org_id
    )
    await db.commit()
    return success_response(WorkflowInstanceResponse.model_validate(instance))


@router.post("/instances/{instance_id}/tasks/{task_id}/reject")
async def reject_task(
    instance_id: UUID,
    task_id: UUID,
    data: TaskActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a workflow task (fails the workflow instance)."""
    instance = await workflow_engine.advance(
        db, instance_id, task_id, "REJECT", current_user.id, data.comment, current_user.org_id
    )
    await db.commit()
    return success_response(WorkflowInstanceResponse.model_validate(instance))


@router.post("/instances/{instance_id}/tasks/{task_id}/return")
async def return_task(
    instance_id: UUID,
    task_id: UUID,
    data: TaskActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return a workflow task for revision."""
    instance = await workflow_engine.advance(
        db, instance_id, task_id, "RETURN", current_user.id, data.comment, current_user.org_id
    )
    await db.commit()
    return success_response(WorkflowInstanceResponse.model_validate(instance))


@router.post("/instances/{instance_id}/cancel")
async def cancel_instance(
    instance_id: UUID,
    data: CancelRequest,
    current_user: User = Depends(require_permission(PermissionCode.WORKFLOW_DEACTIVATE)),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a workflow instance."""
    instance = await workflow_engine.cancel(
        db, instance_id, current_user.id, data.reason, current_user.org_id
    )
    await db.commit()
    return success_response(WorkflowInstanceResponse.model_validate(instance))


@router.post("/instances/{instance_id}/pause")
async def pause_instance(
    instance_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.WORKFLOW_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    """Pause a workflow instance (admin action)."""
    instance = await workflow_engine.pause(
        db, instance_id, current_user.id, current_user.org_id
    )
    await db.commit()
    return success_response(WorkflowInstanceResponse.model_validate(instance))


@router.post("/instances/{instance_id}/resume")
async def resume_instance(
    instance_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.WORKFLOW_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    """Resume a paused workflow instance (admin action)."""
    instance = await workflow_engine.resume(
        db, instance_id, current_user.id, current_user.org_id
    )
    await db.commit()
    return success_response(WorkflowInstanceResponse.model_validate(instance))


@router.post("/instances/{instance_id}/force-advance")
async def force_advance(
    instance_id: UUID,
    data: ForceAdvanceRequest,
    current_user: User = Depends(require_permission(PermissionCode.WORKFLOW_ACTIVATE)),
    db: AsyncSession = Depends(get_db),
):
    """Force-advance a workflow to the next step (admin only, creates compliance log)."""
    instance = await workflow_engine.force_advance(
        db, instance_id, current_user.id, data.reason, current_user.org_id
    )
    await db.commit()
    return success_response(WorkflowInstanceResponse.model_validate(instance))


@router.post("/simulate", response_model=WorkflowSimulateResponse)
async def simulate(
    data: SimulateRequest,
    current_user: User = Depends(require_permission(PermissionCode.WORKFLOW_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """
    Simulate the approval chain for a template + context.
    Read-only — zero DB writes guaranteed.
    """
    chain = await workflow_engine.simulate(
        db, data.template_code, data.entity_context, current_user.org_id
    )
    return WorkflowSimulateResponse(chain=chain)
