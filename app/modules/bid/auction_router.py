from __future__ import annotations
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_permission, require_any_permission
from app.core.constants import PermissionCode
from app.core.exceptions import NotFoundError, ForbiddenError
from app.core.responses import success_response, created_response, PaginationMeta, APIResponse
from app.db.session import get_db
from app.modules.bid.live_bid_service import live_bid_service
from app.modules.bid.schemas import AuctionCreateRequest, LiveAuctionDetailResponse

router = APIRouter(prefix="/auctions", tags=["live-auction"])


def _sanitize_auction_for_actor(auction, current_user) -> dict:
    d = {
        "id": auction.id if not isinstance(auction, dict) else auction.get("id"),
        "org_id": auction.org_id if not isinstance(auction, dict) else auction.get("org_id"),
        "rfq_id": auction.rfq_id if not isinstance(auction, dict) else auction.get("rfq_id"),
        "rfq_number": getattr(auction, "rfq_number", None) if not isinstance(auction, dict) else auction.get("rfq_number"),
        "rfq_title": getattr(auction, "rfq_title", None) if not isinstance(auction, dict) else auction.get("rfq_title"),
        "status": auction.status if not isinstance(auction, dict) else auction.get("status"),
        "scheduled_start_at": auction.scheduled_start_at if not isinstance(auction, dict) else auction.get("scheduled_start_at"),
        "actual_start_at": auction.actual_start_at if not isinstance(auction, dict) else auction.get("actual_start_at"),
        "current_close_at": auction.current_close_at if not isinstance(auction, dict) else auction.get("current_close_at"),
        "extension_count": auction.extension_count if not isinstance(auction, dict) else auction.get("extension_count", 0),
        "winner_vendor_id": auction.winner_vendor_id if not isinstance(auction, dict) else auction.get("winner_vendor_id"),
        "winning_bid_id": auction.winning_bid_id if not isinstance(auction, dict) else auction.get("winning_bid_id"),
        "created_by": auction.created_by if not isinstance(auction, dict) else auction.get("created_by"),
        "created_at": auction.created_at if not isinstance(auction, dict) else auction.get("created_at"),
        "updated_at": auction.updated_at if not isinstance(auction, dict) else auction.get("updated_at"),
        "config": dict(auction.config) if (not isinstance(auction, dict) and auction.config) else dict(auction.get("config", {})) if isinstance(auction, dict) else {},
    }
    is_vendor = bool(getattr(current_user, "vendor_id", None) or getattr(current_user, "is_supplier_user", False))
    if is_vendor and "reserve_price_inr" in d["config"]:
        d["config"].pop("reserve_price_inr", None)
    return d


class CancelAuctionRequest(BaseModel):
    reason: str = Field(min_length=1)


class SetProxyFloorRequest(BaseModel):
    lot_id: Optional[UUID] = None
    floor_amount_inr: Decimal = Field(gt=0)


@router.post("", response_model=APIResponse[LiveAuctionDetailResponse], status_code=status.HTTP_201_CREATED)
async def create_auction(
    data: AuctionCreateRequest,
    current_user=Depends(require_permission(PermissionCode.LIVE_AUCTION_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    auction = await live_bid_service.create_auction(db, data, current_user, current_user.org_id)
    await db.commit()
    return created_response(_sanitize_auction_for_actor(auction, current_user))


@router.get("", response_model=APIResponse[list[LiveAuctionDetailResponse]])
async def list_auctions(
    rfq_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    skip = (page - 1) * page_size
    vendor_id = getattr(current_user, "vendor_id", None)
    auctions, total = await live_bid_service.list_auctions(
        db, current_user.org_id, vendor_id=vendor_id, rfq_id=rfq_id, status=status, skip=skip, limit=page_size
    )
    sanitized = [_sanitize_auction_for_actor(a, current_user) for a in auctions]
    meta = PaginationMeta(
        page=page,
        page_size=page_size,
        total_count=total,
        total_pages=(total + page_size - 1) // page_size if page_size else 1,
        has_next=(page * page_size) < total,
        has_prev=page > 1,
    )
    return success_response(sanitized, meta=meta)


@router.get("/{auction_id}", response_model=APIResponse[LiveAuctionDetailResponse])
async def get_auction(
    auction_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    auction = await live_bid_service.get_auction(db, auction_id, current_user.org_id)
    if not auction:
        raise NotFoundError(f"Auction {auction_id} not found")
    vendor_id = getattr(current_user, "vendor_id", None)
    if vendor_id:
        participant = await live_bid_service.live_bid_repo.get_participant(
            db, auction_id, vendor_id, current_user.org_id
        )
        if not participant:
            raise ForbiddenError("NOT_PARTICIPANT", "Vendor is not a participant in this auction")
    return success_response(_sanitize_auction_for_actor(auction, current_user))


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
    current_user=Depends(require_any_permission(PermissionCode.LIVE_AUCTION_MONITOR, PermissionCode.BID_VIEW_ALL)),
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
    current_user=Depends(require_any_permission(PermissionCode.LIVE_AUCTION_MONITOR, PermissionCode.BID_VIEW_ALL)),
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
