from __future__ import annotations
import json
from datetime import datetime, timezone
from typing import Any, Union
from uuid import UUID
from loguru import logger
from app.core.redis_client import get_redis, RedisKeys
from app.modules.notification.models import Notification

class InAppChannel:
    """Redis pub/sub in-app delivery channel for real-time WebSocket distribution."""

    async def send(self, user_id: Union[str, UUID], notification: Union[Notification, dict[str, Any]]) -> bool:
        redis = get_redis()
        if isinstance(notification, dict):
            payload = {
                "id": str(notification.get("id", "")),
                "notification_id": str(notification.get("id", "")),
                "user_id": str(user_id),
                "title": notification.get("title", ""),
                "message": notification.get("body") or notification.get("message", ""),
                "body": notification.get("body") or notification.get("message", ""),
                "notification_type": notification.get("notification_type", "GENERAL"),
                "entity_type": notification.get("entity_type"),
                "entity_id": str(notification["entity_id"]) if notification.get("entity_id") else None,
                "created_at": notification.get("created_at") or datetime.now(timezone.utc).isoformat(),
                "is_read": bool(notification.get("is_read", False)),
            }
        else:
            payload = {
                "id": str(notification.id),
                "notification_id": str(notification.id),
                "user_id": str(notification.user_id),
                "title": notification.title,
                "message": notification.body,
                "body": notification.body,
                "notification_type": notification.notification_type,
                "entity_type": notification.entity_type,
                "entity_id": str(notification.entity_id) if notification.entity_id else None,
                "created_at": notification.created_at.isoformat() if hasattr(notification.created_at, "isoformat") else str(notification.created_at),
                "is_read": False,
            }

        channel_key = RedisKeys.notification_channel(user_id)
        try:
            await redis.publish(channel_key, json.dumps(payload))
            logger.info(f"[InAppChannel] Published notification to Redis channel={channel_key}")
            return True
        except Exception as e:
            logger.error(f"[InAppChannel] Failed to publish to Redis channel {channel_key}: {e}")
            raise

inapp_channel = InAppChannel()
