from __future__ import annotations
import asyncio
import json
from typing import Optional
from uuid import UUID
from fastapi import WebSocket, WebSocketDisconnect, Query
from loguru import logger
from app.auth.jwt import decode_jwt
from app.core.redis_client import get_redis, RedisKeys

class NotificationWebSocketManager:
    """Manages per-user real-time notification WebSocket connections and Redis pub/sub."""

    def __init__(self):
        self.active_connections: dict[UUID, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, token: str) -> tuple[UUID, Optional[UUID]]:
        if not token:
            await websocket.close(code=4001)
            raise ValueError("Token is required")

        try:
            payload = decode_jwt(token)
            user_id = UUID(payload["sub"])
            org_id = UUID(payload["org_id"]) if payload.get("org_id") else None
        except Exception as e:
            logger.warning(f"[WS Notification] Authentication failed: {e}")
            await websocket.close(code=4001)
            raise

        await websocket.accept()
        self.active_connections.setdefault(user_id, []).append(websocket)
        logger.info(f"[WS Notification] User {user_id} connected (active: {len(self.active_connections[user_id])})")
        return user_id, org_id

    def disconnect(self, user_id: UUID, websocket: WebSocket) -> None:
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"[WS Notification] User {user_id} disconnected")

    async def handle_connection(
        self,
        websocket: WebSocket,
        token: Optional[str] = Query(None),
    ) -> None:
        if not token:
            token = websocket.query_params.get("token")

        if not token:
            await websocket.close(code=4001)
            return

        try:
            user_id, org_id = await self.connect(websocket, token)
        except Exception:
            return

        redis = get_redis()
        channel_key = RedisKeys.notification_channel(user_id)
        pubsub = redis.pubsub()
        await pubsub.subscribe(channel_key)

        async def redis_listener():
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
                logger.debug(f"[WS Notification] Redis listener error for user {user_id}: {e}")

        async def ws_receiver():
            try:
                while True:
                    text = await websocket.receive_text()
                    try:
                        data = json.loads(text)
                        if data.get("type") == "ping":
                            await websocket.send_text(json.dumps({"type": "pong"}))
                    except Exception:
                        pass
            except WebSocketDisconnect:
                pass

        listener_task = asyncio.create_task(redis_listener())
        receiver_task = asyncio.create_task(ws_receiver())

        try:
            done, pending = await asyncio.wait(
                [listener_task, receiver_task],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
        finally:
            try:
                await pubsub.unsubscribe(channel_key)
                await pubsub.close()
            except Exception:
                pass
            self.disconnect(user_id, websocket)

ws_manager = NotificationWebSocketManager()

async def notification_ws_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
) -> None:
    """FastAPI WebSocket endpoint for notification stream."""
    await ws_manager.handle_connection(websocket, token=token)
