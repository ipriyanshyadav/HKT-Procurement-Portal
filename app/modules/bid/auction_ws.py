from __future__ import annotations
import asyncio
import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect, Depends, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_ws
from app.core.constants import PermissionCode
from app.core.redis_client import RedisKeys, get_redis
from app.db.session import get_db, get_db_ctx
from app.modules.bid.live_bid_repository import LiveBidRepository
from app.modules.bid.live_bid_service import LiveBidService
from app.modules.user.models import User
from app.modules.user.role_repository import role_repository


class AuctionConnectionManager:
    """Manages per-auction WebSocket connections + Redis pub/sub subscription."""

    def __init__(self):
        self.live_bid_repo = LiveBidRepository()
        self.live_bid_service = LiveBidService()

    async def handle(
        self,
        websocket: WebSocket,
        auction_id: UUID,
        current_user: User,
        redis,
        db: AsyncSession,
    ):
        org_id = current_user.org_id
        vendor_id = getattr(current_user, "vendor_id", None)

        participant = None
        if vendor_id:
            participant = await self.live_bid_repo.get_participant(db, auction_id, vendor_id, org_id)
            if not participant:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            participant.is_connected = True
            participant.joined_at = datetime.now(timezone.utc)
            await db.commit()
        else:
            # Buyer role: must have monitor or bid view permission
            has_perm = (
                await role_repository.user_has_permission(
                    db, current_user.id, org_id, PermissionCode.LIVE_AUCTION_MONITOR
                )
                or await role_repository.user_has_permission(
                    db, current_user.id, org_id, PermissionCode.BID_VIEW_ALL
                )
            )
            if not has_perm:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return

        await websocket.accept()

        channel = RedisKeys.auction_channel(auction_id)
        vendor_channel = (
            RedisKeys.auction_vendor_channel(auction_id, vendor_id) if vendor_id else None
        )

        channels_to_sub = [channel]
        if vendor_channel:
            channels_to_sub.append(vendor_channel)

        pubsub = redis.pubsub() if redis is not None else None
        if pubsub is not None:
            await pubsub.subscribe(*channels_to_sub)

        async def redis_listener():
            if pubsub is None:
                return
            try:
                async for message in pubsub.listen():
                    if message["type"] == "message":
                        data = message["data"]
                        if isinstance(data, bytes):
                            data = data.decode("utf-8")
                        await websocket.send_text(data)
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.debug(f"Redis listener closed for auction {auction_id}: {e}")

        async def ws_receiver():
            async for raw in websocket.iter_text():
                try:
                    msg = json.loads(raw)
                    await self._handle_client_message(msg, auction_id, current_user, websocket)
                except Exception as e:
                    logger.debug(f"Error handling auction WS message: {e}")

        listener_task = asyncio.create_task(redis_listener())
        try:
            await ws_receiver()
        except WebSocketDisconnect:
            pass
        finally:
            listener_task.cancel()
            if pubsub is not None:
                try:
                    await pubsub.unsubscribe(*channels_to_sub)
                    await pubsub.close()
                except Exception:
                    pass

            # Mark vendor disconnected
            if vendor_id:
                try:
                    async with get_db_ctx() as disc_db:
                        p = await self.live_bid_repo.get_participant(disc_db, auction_id, vendor_id, org_id)
                        if p:
                            p.is_connected = False
                            p.left_at = datetime.now(timezone.utc)
                            await disc_db.commit()
                except Exception as ex:
                    logger.debug(f"Error updating participant disconnect status: {ex}")

    async def _handle_client_message(
        self, msg: dict, auction_id: UUID, current_user: User, ws: WebSocket
    ):
        msg_type = msg.get("type")
        if msg_type == "SUBMIT_BID":
            async with get_db_ctx() as db:
                svc = LiveBidService()
                try:
                    raw_lot = msg.get("lot_id")
                    lot_id = UUID(raw_lot) if raw_lot else None
                    amount = Decimal(str(msg.get("bid_amount_inr", 0)))
                    await svc.submit_live_bid(
                        db,
                        auction_id,
                        lot_id=lot_id,
                        bid_amount_inr=amount,
                        actor=current_user,
                        org_id=current_user.org_id,
                    )
                    await db.commit()
                except Exception as e:
                    err_msg = getattr(e, "detail", str(e))
                    if "RESERVE" in str(err_msg).upper():
                        err_msg = "BID_NOT_COMPETITIVE"
                    await ws.send_text(
                        json.dumps({
                            "type": "BID_REJECTED",
                            "auction_id": str(auction_id),
                            "ts": datetime.now(timezone.utc).isoformat(),
                            "payload": {"reason": str(err_msg)},
                        })
                    )
        elif msg_type == "SET_PROXY_FLOOR":
            async with get_db_ctx() as db:
                svc = LiveBidService()
                try:
                    raw_lot = msg.get("lot_id")
                    lot_id = UUID(raw_lot) if raw_lot else None
                    floor = Decimal(str(msg.get("floor_amount_inr", 0)))
                    await svc.set_proxy_floor(
                        db,
                        auction_id,
                        lot_id=lot_id,
                        floor_amount_inr=floor,
                        actor=current_user,
                        org_id=current_user.org_id,
                    )
                    await db.commit()
                except Exception as e:
                    await ws.send_text(
                        json.dumps({
                            "type": "ERROR",
                            "auction_id": str(auction_id),
                            "ts": datetime.now(timezone.utc).isoformat(),
                            "payload": {"message": str(e)},
                        })
                    )
        elif msg_type == "PING":
            await ws.send_text(
                json.dumps({
                    "type": "HEARTBEAT",
                    "ts": datetime.now(timezone.utc).isoformat(),
                })
            )


manager = AuctionConnectionManager()


async def auction_ws_endpoint(
    websocket: WebSocket,
    auction_id: UUID,
    current_user: User = Depends(get_current_user_ws),
    redis=Depends(get_redis),
    db: AsyncSession = Depends(get_db),
):
    await manager.handle(websocket, auction_id, current_user, redis, db)
