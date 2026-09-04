from __future__ import annotations
import math
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_permission, require_any_permission
from app.core.constants import PermissionCode, AuditAction
from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.responses import APIResponse, PaginationMeta, created_response, success_response
from app.db.enums import AuditEntityTypeEnum
from app.db.session import get_db
from app.modules.audit.models import AuditLog
from app.modules.sourcing.schemas import (
    RfqCreateRequest,
    RfqUpdateRequest,
    AddParticipantsRequest,
    AmendRequest,
    CancelRequest,
    ExtendDeadlineRequest,
    ClarificationCreateRequest,
    ClarificationRespondRequest,
    RfqDetailResponse,
    RfqListResponse,
    RfqParticipantResponse,
    RfqClarificationResponse,
    BidCountResponse,
    RfqDashboardResponse,
)
from app.modules.sourcing.service import rfq_service
from app.modules.user.models import User

router = APIRouter(tags=["RFQs"])

# ─── CRITICAL: rfq.view_bids_before_opening is PERMANENTLY DENIED ──────────────
# This permission code MUST never be granted to any role.
# Any attempt to access bid content before opening uses direct bids_opened_at check
# in service layer — not role-based permission bypass.
PERMANENTLY_DENIED_PERMISSIONS = frozenset({
    PermissionCode.RFQ_VIEW_BIDS_BEFORE_OPENING,
})


# ─── CREATE ────────────────────────────────────────────────────────────────────

@router.post("", response_model=APIResponse[RfqDetailResponse], status_code=status.HTTP_201_CREATED)
async def create_rfq(
    data: RfqCreateRequest,
    current_user: User = Depends(require_permission(PermissionCode.RFQ_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    rfq = await rfq_service.create(
        db, data=data, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    await db.refresh(rfq)
    return created_response(RfqDetailResponse.model_validate(rfq))


# ─── LIST ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=APIResponse[List[RfqListResponse]])
async def list_rfqs(
    status_filter: Optional[str] = Query(None, alias="status"),
    rfq_type: Optional[str] = Query(None),
    business_unit_id: Optional[UUID] = Query(None),
    category_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_any_permission(PermissionCode.RFQ_VIEW_ALL, PermissionCode.RFQ_VIEW_OWN)),
    db: AsyncSession = Depends(get_db),
):
    skip = (page - 1) * page_size
    if current_user.is_supplier_user or current_user.vendor_id:
        if not current_user.vendor_id:
            raise ForbiddenError("Supplier user is not linked to any vendor")
        items, total = await rfq_service.list_for_supplier(
            db,
            org_id=current_user.org_id,
            vendor_id=current_user.vendor_id,
            status=status_filter,
            search=search,
            skip=skip,
            limit=page_size,
        )
    else:
        items, total = await rfq_service.list_rfqs(
            db,
            org_id=current_user.org_id,
            status=status_filter,
            rfq_type=rfq_type,
            business_unit_id=business_unit_id,
            category_id=category_id,
            search=search,
            skip=skip,
            limit=page_size,
        )
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    meta = PaginationMeta(
        page=page,
        page_size=page_size,
        total_count=total,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
        total_records=total,
        page_number=page,
        has_next_page=page < total_pages,
        has_prev_page=page > 1,
    )
    return success_response(
        data=[RfqListResponse.model_validate(r) for r in items],
        meta=meta,
    )


# ─── GET ───────────────────────────────────────────────────────────────────────

@router.get("/{id}", response_model=APIResponse[RfqDetailResponse])
async def get_rfq(
    id: UUID,
    current_user: User = Depends(require_any_permission(PermissionCode.RFQ_VIEW_ALL, PermissionCode.RFQ_VIEW_OWN)),
    db: AsyncSession = Depends(get_db),
):
    if current_user.is_supplier_user or current_user.vendor_id:
        if not current_user.vendor_id:
            raise ForbiddenError("Supplier user is not linked to any vendor")
        rfq = await rfq_service.get_for_supplier(db, id, current_user.org_id, current_user.vendor_id)
        res = RfqDetailResponse.model_validate(rfq)
        if res.participants:
            res.participants = [p for p in res.participants if p.vendor_id == current_user.vendor_id]
        if res.clarifications:
            published_clarifs = []
            for c in res.clarifications:
                if c.is_published:
                    c.asked_by_vendor_id = None
                    published_clarifs.append(c)
            res.clarifications = published_clarifs
        return success_response(res)

    rfq = await rfq_service.get_by_id(db, id, current_user.org_id)
    return success_response(RfqDetailResponse.model_validate(rfq))


# ─── UPDATE ────────────────────────────────────────────────────────────────────

@router.put("/{id}", response_model=APIResponse[RfqDetailResponse])
async def update_rfq(
    id: UUID,
    data: RfqUpdateRequest,
    current_user: User = Depends(require_permission(PermissionCode.RFQ_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    rfq = await rfq_service.update(
        db, rfq_id=id, data=data, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(RfqDetailResponse.model_validate(rfq))


# ─── SUBMIT FOR APPROVAL ───────────────────────────────────────────────────────

@router.post("/{id}/submit", response_model=APIResponse[RfqDetailResponse])
async def submit_rfq(
    id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.RFQ_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    rfq = await rfq_service.submit(
        db, rfq_id=id, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(RfqDetailResponse.model_validate(rfq))


# ─── PUBLISH ───────────────────────────────────────────────────────────────────

@router.post("/{id}/publish", response_model=APIResponse[RfqDetailResponse])
async def publish_rfq(
    id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.RFQ_PUBLISH)),
    db: AsyncSession = Depends(get_db),
):
    rfq = await rfq_service.publish(
        db, rfq_id=id, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(RfqDetailResponse.model_validate(rfq))


# ─── AMEND ─────────────────────────────────────────────────────────────────────

@router.post("/{id}/amend", response_model=APIResponse[RfqDetailResponse])
async def amend_rfq(
    id: UUID,
    data: AmendRequest,
    current_user: User = Depends(require_permission(PermissionCode.RFQ_AMEND)),
    db: AsyncSession = Depends(get_db),
):
    rfq = await rfq_service.amend(
        db, rfq_id=id, data=data, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(RfqDetailResponse.model_validate(rfq))


# ─── CANCEL ────────────────────────────────────────────────────────────────────

@router.post("/{id}/cancel", response_model=APIResponse[RfqDetailResponse])
async def cancel_rfq(
    id: UUID,
    data: CancelRequest,
    current_user: User = Depends(require_permission(PermissionCode.RFQ_CANCEL)),
    db: AsyncSession = Depends(get_db),
):
    rfq = await rfq_service.cancel(
        db, rfq_id=id, data=data, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(RfqDetailResponse.model_validate(rfq))


# ─── EXTEND DEADLINE ───────────────────────────────────────────────────────────

@router.post("/{id}/extend-deadline", response_model=APIResponse[RfqDetailResponse])
async def extend_deadline(
    id: UUID,
    data: ExtendDeadlineRequest,
    current_user: User = Depends(require_permission(PermissionCode.RFQ_EXTEND)),
    db: AsyncSession = Depends(get_db),
):
    rfq = await rfq_service.extend_deadline(
        db, rfq_id=id, data=data, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(RfqDetailResponse.model_validate(rfq))


# ─── PARTICIPANTS ──────────────────────────────────────────────────────────────

@router.post("/{id}/add-participants", response_model=APIResponse[List[RfqParticipantResponse]])
async def add_participants(
    id: UUID,
    data: AddParticipantsRequest,
    current_user: User = Depends(require_permission(PermissionCode.RFQ_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    participants = await rfq_service.add_participants(
        db, rfq_id=id, data=data, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response([RfqParticipantResponse.model_validate(p) for p in participants])


@router.delete("/{id}/participants/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_participant(
    id: UUID,
    vendor_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.RFQ_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    await rfq_service.remove_participant(
        db, rfq_id=id, vendor_id=vendor_id, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()


# ─── DUAL-AUTH BID OPENING ─────────────────────────────────────────────────────

@router.post("/{id}/initiate-bid-opening")
async def initiate_bid_opening(
    id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.BID_OPEN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Step 1 of dual-authorization bid opening.
    Initiator must NOT be the RFQ creator.
    """
    result = await rfq_service.initiate_bid_opening(
        db, rfq_id=id, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(result)


@router.post("/{id}/co-authorize-opening", response_model=APIResponse[RfqDetailResponse])
async def co_authorize_bid_opening(
    id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.BID_OPEN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Step 2 of dual-authorization bid opening.
    Co-authorizer must be a different user than the initiator.
    """
    rfq = await rfq_service.co_authorize_bid_opening(
        db, rfq_id=id, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(RfqDetailResponse.model_validate(rfq))


# ─── CLARIFICATIONS ────────────────────────────────────────────────────────────

@router.get("/{id}/clarifications", response_model=APIResponse[List[RfqClarificationResponse]])
async def get_clarifications(
    id: UUID,
    current_user: User = Depends(require_any_permission(PermissionCode.RFQ_VIEW_ALL, PermissionCode.RFQ_VIEW_OWN)),
    db: AsyncSession = Depends(get_db),
):
    if current_user.is_supplier_user or current_user.vendor_id:
        if not current_user.vendor_id:
            raise ForbiddenError("Supplier user is not linked to any vendor")
        await rfq_service.get_for_supplier(db, id, current_user.org_id, current_user.vendor_id)
        clarifications = await rfq_service.get_clarifications(
            db, rfq_id=id, org_id=current_user.org_id, actor_vendor_id=current_user.vendor_id
        )
    else:
        await rfq_service.get_by_id(db, id, current_user.org_id)
        clarifications = await rfq_service.get_clarifications(
            db, rfq_id=id, org_id=current_user.org_id
        )
    return success_response([RfqClarificationResponse.model_validate(c) for c in clarifications])


@router.post("/{id}/clarifications", response_model=APIResponse[RfqClarificationResponse], status_code=status.HTTP_201_CREATED)
async def add_clarification(
    id: UUID,
    data: ClarificationCreateRequest,
    current_user: User = Depends(require_any_permission(PermissionCode.RFQ_VIEW_ALL, PermissionCode.RFQ_VIEW_OWN)),
    db: AsyncSession = Depends(get_db),
):
    if current_user.is_supplier_user or current_user.vendor_id:
        if not current_user.vendor_id:
            raise ForbiddenError("Supplier user is not linked to any vendor")
        await rfq_service.get_for_supplier(db, id, current_user.org_id, current_user.vendor_id)
        clarification = await rfq_service.add_clarification(
            db,
            rfq_id=id,
            data=data,
            actor_id=current_user.id,
            org_id=current_user.org_id,
            vendor_id=current_user.vendor_id,
        )
    else:
        await rfq_service.get_by_id(db, id, current_user.org_id)
        clarification = await rfq_service.add_clarification(
            db,
            rfq_id=id,
            data=data,
            actor_id=current_user.id,
            org_id=current_user.org_id,
        )
    await db.commit()
    return created_response(RfqClarificationResponse.model_validate(clarification))


@router.put("/{id}/clarifications/{cid}/respond", response_model=APIResponse[RfqClarificationResponse])
async def respond_to_clarification(
    id: UUID,
    cid: UUID,
    data: ClarificationRespondRequest,
    current_user: User = Depends(require_permission(PermissionCode.RFQ_PUBLISH)),
    db: AsyncSession = Depends(get_db),
):
    clarification = await rfq_service.respond_to_clarification(
        db,
        clarification_id=cid,
        data=data,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(RfqClarificationResponse.model_validate(clarification))


# ─── AUDIT TRAIL ───────────────────────────────────────────────────────────────

@router.get("/{id}/audit-trail", response_model=APIResponse[List[dict]])
async def get_rfq_audit_trail(
    id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.RFQ_VIEW_ALL)),
    db: AsyncSession = Depends(get_db),
):
    await rfq_service.get_by_id(db, id, current_user.org_id)
    stmt = (
        select(AuditLog)
        .where(
            and_(
                AuditLog.org_id == current_user.org_id,
                AuditLog.entity_id == id,
                AuditLog.entity_type == AuditEntityTypeEnum.RFQ,
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


# ─── DASHBOARD ─────────────────────────────────────────────────────────────────

@router.get("/{id}/dashboard", response_model=APIResponse[RfqDashboardResponse])
async def get_rfq_dashboard(
    id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.RFQ_VIEW_ALL)),
    db: AsyncSession = Depends(get_db),
):
    dashboard = await rfq_service.get_dashboard(db, rfq_id=id, org_id=current_user.org_id)
    return success_response(RfqDashboardResponse(**dashboard))
