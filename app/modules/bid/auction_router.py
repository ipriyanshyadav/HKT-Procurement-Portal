from __future__ import annotations
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_permission
from app.core.constants import PermissionCode
from app.core.exceptions import NotFoundError
from app.core.responses import success_response, created_response, PaginationMeta
from app.db.session import get_db
from app.modules.bid.live_bid_service import live_bid_service
from app.modules.bid.schemas import AuctionCreateRequest

router = APIRouter(prefix="/auctions", tags=["live-auction"])


class CancelAuctionRequest(BaseModel):
    reason: str = Field(min_length=1)


class SetProxyFloorRequest(BaseModel):
    lot_id: Optional[UUID] = None
    floor_amount_inr: Decimal = Field(gt=0)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_auction(
    data: AuctionCreateRequest,
    current_user=Depends(require_permission(PermissionCode.LIVE_AUCTION_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    auction = await live_bid_service.create_auction(db, data, current_user, current_user.org_id)
    await db.commit()
    return created_response(auction)


@router.get("")
async def list_auctions(
    rfq_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    skip = (page - 1) * page_size
    auctions, total = await live_bid_service.live_bid_repo.list_auctions(
        db, current_user.org_id, rfq_id=rfq_id, status=status, skip=skip, limit=page_size
    )
    meta = PaginationMeta(
        page=page,
        page_size=page_size,
        total_count=total,
        total_pages=(total + page_size - 1) // page_size if page_size else 1,
        has_next=(page * page_size) < total,
        has_prev=page > 1,
    )
    return success_response(auctions, meta=meta)


@router.get("/{auction_id}")
async def get_auction(
    auction_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    auction = await live_bid_service.live_bid_repo.get(db, auction_id, current_user.org_id)
    if not auction:
        raise NotFoundError(f"Auction {auction_id} not found")
    return success_response(auction)


@router.post("/{auction_id}/open")
async def open_auction(
    auction_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    auction = await live_bid_service.open_auction(db, auction_id, current_user.org_id)
    await db.commit()
    return success_response(auction)


@router.post("/{auction_id}/cancel")
async def cancel_auction(
    auction_id: UUID,
    body: CancelAuctionRequest,
    current_user=Depends(require_permission(PermissionCode.LIVE_AUCTION_CANCEL)),
    db: AsyncSession = Depends(get_db),
):
    auction = await live_bid_service.cancel_auction(
        db, auction_id, body.reason, current_user, current_user.org_id
    )
    await db.commit()
    return success_response(auction)


@router.post("/{auction_id}/release-results")
async def release_results(
    auction_id: UUID,
    current_user=Depends(require_permission(PermissionCode.LIVE_AUCTION_RELEASE_RESULTS)),
    db: AsyncSession = Depends(get_db),
):
    auction = await live_bid_service.release_results(db, auction_id, current_user, current_user.org_id)
    await db.commit()
    return success_response(auction)


@router.get("/{auction_id}/leaderboard")
async def get_leaderboard(
    auction_id: UUID,
    current_user=Depends(require_permission(PermissionCode.LIVE_AUCTION_MONITOR)),
    db: AsyncSession = Depends(get_db),
):
    """Buyer-only: full leaderboard with prices and vendor names."""
    ranks = await live_bid_service.get_leaderboard(db, auction_id, current_user, current_user.org_id)
    return success_response(ranks)


@router.get("/{auction_id}/my-rank")
async def get_my_rank(
    auction_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Vendor-only: own rank + L1 price (subject to rank_visibility config)."""
    rank_info = await live_bid_service.get_my_rank(db, auction_id, current_user, current_user.org_id)
    return success_response(rank_info)


@router.get("/{auction_id}/bids")
async def get_bid_history(
    auction_id: UUID,
    current_user=Depends(require_permission(PermissionCode.LIVE_AUCTION_MONITOR)),
    db: AsyncSession = Depends(get_db),
):
    bids = await live_bid_service.get_bid_history(db, auction_id, current_user, current_user.org_id)
    return success_response(bids)


@router.post("/{auction_id}/proxy-floor")
async def set_proxy_floor(
    auction_id: UUID,
    body: SetProxyFloorRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    participant = await live_bid_service.set_proxy_floor(
        db, auction_id, body.lot_id, body.floor_amount_inr, current_user, current_user.org_id
    )
    await db.commit()
    return success_response(participant)
