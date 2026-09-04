from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import success_response
from app.db.session import get_db
from app.modules.user.models import User
from app.modules.sourcing.repository import rfq_repository


class AuctionBidRequest(BaseModel):
    amount: float
    remarks: Optional[str] = None


class AuctionRoomManager:
    """Manages active live WebSocket connections and auction states per RFQ."""

    def __init__(self) -> None:
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.auction_states: Dict[str, Dict[str, Any]] = {}

    def get_or_create_state(self, rfq_id: str, initial_price: float = 100000.0) -> Dict[str, Any]:
        if rfq_id not in self.auction_states:
            self.auction_states[rfq_id] = {
                "rfq_id": rfq_id,
                "current_lowest_bid": initial_price,
                "currency": "INR",
                "min_decrement": 1000.0,
                "total_bids": 0,
                "leading_bidder_id": None,
                "leading_bidder_name": "Reserve Ceiling Price",
                "status": "LIVE",
                "bids": [],
                "ends_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
            }
        return self.auction_states[rfq_id]

    async def connect(self, rfq_id: str, websocket: WebSocket):
        await websocket.accept()
        if rfq_id not in self.active_connections:
            self.active_connections[rfq_id] = []
        self.active_connections[rfq_id].append(websocket)
        state = self.get_or_create_state(rfq_id)
        await websocket.send_json({"type": "AUCTION_STATE", "data": state})

    def disconnect(self, rfq_id: str, websocket: WebSocket):
        if rfq_id in self.active_connections:
            if websocket in self.active_connections[rfq_id]:
                self.active_connections[rfq_id].remove(websocket)

    async def broadcast(self, rfq_id: str, message: Dict[str, Any]):
        if rfq_id in self.active_connections:
            for conn in list(self.active_connections[rfq_id]):
                try:
                    await conn.send_json(message)
                except Exception:
                    self.disconnect(rfq_id, conn)

    async def place_bid(
        self,
        rfq_id: str,
        bidder_id: str,
        bidder_name: str,
        amount: float,
        remarks: Optional[str] = None,
    ) -> Dict[str, Any]:
        state = self.get_or_create_state(rfq_id)
        current_lowest = state["current_lowest_bid"]
        min_dec = state["min_decrement"]

        if amount >= current_lowest:
            raise HTTPException(
                status_code=400,
                detail=f"Bid ({amount}) must be lower than the current leading bid ({current_lowest})",
            )

        state["current_lowest_bid"] = amount
        state["leading_bidder_id"] = bidder_id
        state["leading_bidder_name"] = bidder_name
        state["total_bids"] += 1

        bid_entry = {
            "id": f"bid_{state['total_bids']}",
            "bidder_id": bidder_id,
            "bidder_name": bidder_name,
            "amount": amount,
            "remarks": remarks,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        state["bids"].insert(0, bid_entry)

        # Broadcast update to all room participants
        await self.broadcast(
            rfq_id,
            {
                "type": "NEW_BID",
                "data": {
                    "bid": bid_entry,
                    "current_lowest_bid": amount,
                    "total_bids": state["total_bids"],
                    "leading_bidder_name": bidder_name,
                },
            },
        )
        return bid_entry


auction_manager = AuctionRoomManager()

auction_router = APIRouter(prefix="/rfqs/{rfq_id}/auction", tags=["Reverse Auction"])


@auction_router.get("/state")
async def get_auction_state(
    rfq_id: UUID,
    current_user: User = Depends(get_current_user),
):
    """GET /api/v1/rfqs/{rfq_id}/auction/state — get live reverse auction room state."""
    state = auction_manager.get_or_create_state(str(rfq_id))
    return success_response(state)


@auction_router.post("/bid")
async def place_auction_bid(
    rfq_id: UUID,
    data: AuctionBidRequest,
    current_user: User = Depends(get_current_user),
):
    """POST /api/v1/rfqs/{rfq_id}/auction/bid — place counter-bid in reverse auction."""
    bidder_name = f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email
    bid = await auction_manager.place_bid(
        rfq_id=str(rfq_id),
        bidder_id=str(current_user.id),
        bidder_name=bidder_name,
        amount=data.amount,
        remarks=data.remarks,
    )
    return success_response(bid)


@auction_router.websocket("/ws")
async def auction_websocket(
    websocket: WebSocket,
    rfq_id: UUID,
):
    """WebSocket /api/v1/rfqs/{rfq_id}/auction/ws — bi-directional real-time auction ticker."""
    s_rfq_id = str(rfq_id)
    await auction_manager.connect(s_rfq_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            if msg_type == "PING":
                await websocket.send_json({"type": "PONG"})
            elif msg_type == "BID":
                payload = data.get("payload", {})
                amount = float(payload.get("amount", 0))
                bidder_id = payload.get("bidder_id", "anon")
                bidder_name = payload.get("bidder_name", "Supplier")
                remarks = payload.get("remarks")
                try:
                    await auction_manager.place_bid(s_rfq_id, bidder_id, bidder_name, amount, remarks)
                except Exception as exc:
                    await websocket.send_json({"type": "ERROR", "message": str(exc)})
    except WebSocketDisconnect:
        auction_manager.disconnect(s_rfq_id, websocket)
