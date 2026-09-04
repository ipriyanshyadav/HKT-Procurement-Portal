from __future__ import annotations
import math
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_permission
from app.core.constants import PermissionCode
from app.core.exceptions import NotFoundError
from app.core.responses import APIResponse, PaginationMeta, created_response, success_response
from app.db.session import get_db
from app.modules.bid.schemas import (
    BidSubmitRequest,
    BidReviseRequest,
    BidWithdrawRequest,
    BidDetailResponse,
    BidListResponse,
    BidCountResponse,
    SingleVendorCheckResponse,
)
from app.modules.bid.service import bid_service
from app.modules.user.models import User

router = APIRouter(tags=["Bids"])


# ─── BID COUNT (sealed — only count, no content) ───────────────────────────────

@router.get("/rfqs/{rfq_id}/bid-count", response_model=APIResponse[BidCountResponse])
async def get_bid_count(
    rfq_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.RFQ_VIEW_ALL)),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns only the count of submitted bids.
    NEVER returns bid content before bids are officially opened.
    """
    result = await bid_service.get_bid_count(db, rfq_id=rfq_id, org_id=current_user.org_id)
    return success_response(BidCountResponse(**result))


# ─── SUBMIT BID ────────────────────────────────────────────────────────────────

@router.post("/rfqs/{rfq_id}/bids", response_model=APIResponse[BidDetailResponse], status_code=status.HTTP_201_CREATED)
async def submit_bid(
    rfq_id: UUID,
    data: BidSubmitRequest,
    current_user: User = Depends(require_permission(PermissionCode.BID_SUBMIT)),
    db: AsyncSession = Depends(get_db),
):
    bid = await bid_service.submit_bid(
        db,
        rfq_id=rfq_id,
        data=data,
        actor_id=current_user.id,
        vendor_id=current_user.vendor_id,
        org_id=current_user.org_id,
    )
    await db.commit()
    # Return own bid — vendor can always see their own bid
    result = await bid_service.get_bid_details(
        db,
        bid_id=bid.id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        actor_vendor_id=current_user.vendor_id,
    )
    return created_response(result)


# ─── REVISE BID ────────────────────────────────────────────────────────────────

@router.put("/rfqs/{rfq_id}/bids", response_model=APIResponse[BidDetailResponse])
async def revise_bid(
    rfq_id: UUID,
    data: BidReviseRequest,
    current_user: User = Depends(require_permission(PermissionCode.BID_REVISE)),
    db: AsyncSession = Depends(get_db),
):
    bid = await bid_service.revise_bid(
        db,
        rfq_id=rfq_id,
        data=data,
        actor_id=current_user.id,
        vendor_id=current_user.vendor_id,
        org_id=current_user.org_id,
    )
    await db.commit()
    result = await bid_service.get_bid_details(
        db,
        bid_id=bid.id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        actor_vendor_id=current_user.vendor_id,
    )
    return success_response(result)


# ─── WITHDRAW BID ──────────────────────────────────────────────────────────────

@router.delete("/rfqs/{rfq_id}/bids", response_model=APIResponse[BidDetailResponse])
async def withdraw_bid(
    rfq_id: UUID,
    data: BidWithdrawRequest,
    current_user: User = Depends(require_permission(PermissionCode.BID_WITHDRAW)),
    db: AsyncSession = Depends(get_db),
):
    bid = await bid_service.withdraw_bid(
        db,
        rfq_id=rfq_id,
        vendor_id=current_user.vendor_id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        data=data,
    )
    await db.commit()
    result = await bid_service.get_bid_details(
        db,
        bid_id=bid.id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        actor_vendor_id=current_user.vendor_id,
    )
    return success_response(result)


# ─── GET BID DETAILS ───────────────────────────────────────────────────────────

@router.get("/bids/{bid_id}", response_model=APIResponse[BidDetailResponse])
async def get_bid_details(
    bid_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.BID_VIEW_ALL)),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns bid details. Prices are masked until RFQ.bids_opened_at IS NOT NULL.
    Vendors can only see their own bids before opening.
    """
    result = await bid_service.get_bid_details(
        db,
        bid_id=bid_id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        actor_vendor_id=getattr(current_user, "vendor_id", None),
    )
    return success_response(result)


# ─── SINGLE VENDOR CHECK ───────────────────────────────────────────────────────

@router.get("/rfqs/{rfq_id}/single-vendor-check", response_model=APIResponse[SingleVendorCheckResponse])
async def single_vendor_check(
    rfq_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.BID_VIEW_ALL)),
    db: AsyncSession = Depends(get_db),
):
    result = await bid_service.check_single_vendor_situation(
        db, rfq_id=rfq_id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(SingleVendorCheckResponse(**result))
