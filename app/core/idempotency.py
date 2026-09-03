from __future__ import annotations
import json
from typing import Optional, Dict, Any
from app.core.redis_client import RedisKeys
from app.config import settings
import redis.asyncio as redis

async def check_idempotency(redis_client: redis.Redis, key: str) -> Optional[Dict[str, Any]]:
    cached = await redis_client.get(RedisKeys.idempotency(key))
    if cached:
        return json.loads(cached)
    return None

async def store_idempotency(redis_client: redis.Redis, key: str, response: Dict[str, Any], ttl_seconds: int = settings.IDEMPOTENCY_KEY_TTL_SECONDS) -> None:
    await redis_client.setex(RedisKeys.idempotency(key), ttl_seconds, json.dumps(response))
