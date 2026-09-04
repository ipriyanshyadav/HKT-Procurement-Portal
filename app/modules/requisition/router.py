from __future__ import annotations
import math
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_permission
from app.core.constants import PermissionCode
from app.core.exceptions import NotFoundError, ForbiddenError
from app.core.responses import APIResponse, PaginationMeta, created_response, success_response
from app.db.enums import AuditEntityTypeEnum
from app.db.session import get_db
from app.modules.audit.models import AuditLog
from app.modules.requisition.models import Requisition
from app.modules.requisition.schemas import (
    PRApprovalAction,
    PRCreateRequest,
    PRDetailResponse,
    PRListResponse,
    PRMergeRequest,
    PRSplitRequest,
    PRUpdateRequest,
)
from app.modules.requisition.service import requisition_service
from app.modules.user.models import User

router = APIRouter(tags=["Requisitions"])


@router.post("", response_model=APIResponse[PRDetailResponse], status_code=status.HTTP_201_CREATED)
async def create_requisition(
    data: PRCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pr = await requisition_service.create(
        db,
        data=data,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return created_response(PRDetailResponse.model_validate(pr))


@router.get("", response_model=APIResponse[List[PRListResponse]])
async def list_requisitions(
    status: Optional[str] = Query(None),
    business_unit_id: Optional[UUID] = Query(None),
    category_id: Optional[UUID] = Query(None),
    requestor_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    scope: str = Query("all", pattern="^(all|mine|bu)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    skip = (page - 1) * page_size
    items, total = await requisition_service.list_prs(
        db,
        org_id=current_user.org_id,
        status=status,
        business_unit_id=business_unit_id,
        category_id=category_id,
        requestor_id=requestor_id,
        search=search,
        scope=scope,
        current_user=current_user,
        skip=skip,
        limit=page_size,
    )
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    meta = PaginationMeta(
        total_records=total,
        page_number=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next_page=page < total_pages,
        has_prev_page=page > 1,
    )
    return success_response(
        data=[PRListResponse.model_validate(pr) for pr in items],
        meta=meta,
    )


@router.get("/{id}", response_model=APIResponse[PRDetailResponse])
async def get_requisition(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pr = await requisition_service.get_by_id(db, id, current_user.org_id)
    return success_response(PRDetailResponse.model_validate(pr))


@router.put("/{id}", response_model=APIResponse[PRDetailResponse])
async def update_requisition(
    id: UUID,
    data: PRUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pr = await requisition_service.update(
        db,
        pr_id=id,
        data=data,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(PRDetailResponse.model_validate(pr))


@router.post("/{id}/submit", response_model=APIResponse[PRDetailResponse])
async def submit_requisition(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pr = await requisition_service.submit(
        db,
        pr_id=id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(PRDetailResponse.model_validate(pr))


@router.post("/{id}/withdraw", response_model=APIResponse[PRDetailResponse])
async def withdraw_requisition(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pr = await requisition_service.withdraw(
        db,
        pr_id=id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(PRDetailResponse.model_validate(pr))


@router.post("/{id}/amend", response_model=APIResponse[PRDetailResponse])
async def amend_requisition(
    id: UUID,
    data: PRUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pr = await requisition_service.amend(
        db,
        pr_id=id,
        data=data,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(PRDetailResponse.model_validate(pr))


@router.post("/merge", response_model=APIResponse[PRDetailResponse])
async def merge_requisitions(
    data: PRMergeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    merged = await requisition_service.merge_prs(
        db,
        pr_ids=data.pr_ids,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        merged_title=data.merged_title,
    )
    await db.commit()
    return success_response(PRDetailResponse.model_validate(merged))


@router.post("/{id}/split", response_model=APIResponse[List[PRDetailResponse]])
async def split_requisition(
    id: UUID,
    data: PRSplitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    children = await requisition_service.split_pr(
        db,
        pr_id=id,
        data=data,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response([PRDetailResponse.model_validate(c) for c in children])


@router.post("/{id}/convert-to-rfq", response_model=APIResponse[PRDetailResponse])
async def convert_to_rfq(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pr = await requisition_service.convert_to_rfq(
        db,
        pr_id=id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(PRDetailResponse.model_validate(pr))


@router.post("/{id}/convert-to-po", response_model=APIResponse[PRDetailResponse])
async def convert_to_po(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pr = await requisition_service.convert_to_po(
        db,
        pr_id=id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(PRDetailResponse.model_validate(pr))


@router.get("/{id}/audit-trail", response_model=APIResponse[List[dict]])
async def get_pr_audit_trail(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify PR exists and belongs to org
    await requisition_service.get_by_id(db, id, current_user.org_id)

    stmt = (
        select(AuditLog)
        .where(
            and_(
                AuditLog.org_id == current_user.org_id,
                AuditLog.entity_id == id,
                AuditLog.entity_type == AuditEntityTypeEnum.REQUISITION,
            )
        )
        .order_by(desc(AuditLog.created_at))
    )
    res = await db.execute(stmt)
    logs = res.scalars().all()
    data = [
        {
            "id": str(l.id),
            "action": l.action,
            "actor_id": str(l.actor_id) if l.actor_id else None,
            "actor_email": l.actor_email,
            "old_values": l.old_values,
            "new_values": l.new_values,
            "metadata": l.metadata_,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]
    return success_response(data)


@router.post("/{id}/approve", response_model=APIResponse[PRDetailResponse])
async def approve_requisition(
    id: UUID,
    action_data: Optional[PRApprovalAction] = None,
    task_id: Optional[UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comment = action_data.comment if action_data else None
    pr = await requisition_service.approve(
        db,
        pr_id=id,
        task_id=task_id,
        comment=comment,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(PRDetailResponse.model_validate(pr))


@router.post("/{id}/reject", response_model=APIResponse[PRDetailResponse])
async def reject_requisition(
    id: UUID,
    action_data: PRApprovalAction,
    task_id: Optional[UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pr = await requisition_service.reject(
        db,
        pr_id=id,
        task_id=task_id,
        comment=action_data.comment or "Rejected",
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(PRDetailResponse.model_validate(pr))
