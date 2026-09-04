import pytest
from uuid import uuid4
from fastapi import HTTPException

from app.modules.sourcing.auction import AuctionRoomManager


@pytest.mark.asyncio
async def test_auction_room_initial_state():
    manager = AuctionRoomManager()
    rfq_id = str(uuid4())
    state = manager.get_or_create_state(rfq_id, initial_price=50000.0)

    assert state["rfq_id"] == rfq_id
    assert state["current_lowest_bid"] == 50000.0
    assert state["total_bids"] == 0
    assert state["status"] == "LIVE"
    assert len(state["bids"]) == 0


@pytest.mark.asyncio
async def test_auction_room_place_valid_bid():
    manager = AuctionRoomManager()
    rfq_id = str(uuid4())
    manager.get_or_create_state(rfq_id, initial_price=50000.0)

    bidder_id = str(uuid4())
    bid = await manager.place_bid(
        rfq_id=rfq_id,
        bidder_id=bidder_id,
        bidder_name="Acme Supplies Ltd",
        amount=45000.0,
        remarks="Aggressive opening counter-bid",
    )

    assert bid["amount"] == 45000.0
    assert bid["bidder_name"] == "Acme Supplies Ltd"

    updated_state = manager.get_or_create_state(rfq_id)
    assert updated_state["current_lowest_bid"] == 45000.0
    assert updated_state["total_bids"] == 1
    assert updated_state["leading_bidder_id"] == bidder_id
    assert len(updated_state["bids"]) == 1


@pytest.mark.asyncio
async def test_auction_room_reject_higher_or_equal_bid():
    manager = AuctionRoomManager()
    rfq_id = str(uuid4())
    manager.get_or_create_state(rfq_id, initial_price=50000.0)

    bidder_id = str(uuid4())
    # Try placing bid equal to or higher than current lowest
    with pytest.raises(HTTPException) as exc_info:
        await manager.place_bid(
            rfq_id=rfq_id,
            bidder_id=bidder_id,
            bidder_name="Overbid Corp",
            amount=50000.0,
        )
    assert exc_info.value.status_code == 400
    assert "must be lower than" in exc_info.value.detail
