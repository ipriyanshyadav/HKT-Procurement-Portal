from __future__ import annotations
import json
import time
from typing import Optional, Dict, Any
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response
from fastapi import Request
from loguru import logger

from app.core.redis_client import RedisKeys, get_redis
from app.config import settings
import redis.asyncio as redis

# In-memory fallback dictionary for when Redis is unavailable or during tests
_memory_cache: Dict[str, Dict[str, Any]] = {}


async def check_idempotency(
    redis_client: Optional[redis.Redis] = None,
    key: str = "",
) -> Optional[Dict[str, Any]]:
    """Check if an idempotency key exists in Redis (or in-memory fallback)."""
    if not key:
        return None

    # Try Redis
    client = redis_client
    if client is None:
        try:
            client = get_redis()
        except Exception:
            client = None

    if client is not None:
        try:
            cached = await client.get(RedisKeys.idempotency(key))
            if cached:
                if isinstance(cached, bytes):
                    cached = cached.decode("utf-8")
                return json.loads(cached)
        except Exception as e:
            logger.debug(f"Redis idempotency lookup failed, falling back to memory: {e}")

    # Fallback to in-memory cache
    entry = _memory_cache.get(key)
    if entry:
        if time.time() < entry.get("expires_at", 0):
            return entry.get("data")
        else:
            _memory_cache.pop(key, None)

    return None


async def store_idempotency(
    redis_client: Optional[redis.Redis] = None,
    key: str = "",
    response: Dict[str, Any] = None,
    ttl_seconds: int = settings.IDEMPOTENCY_KEY_TTL_SECONDS,
) -> None:
    """Store idempotency key result in Redis (and in-memory fallback)."""
    if not key or response is None:
        return

    # In-memory store
    _memory_cache[key] = {
        "expires_at": time.time() + ttl_seconds,
        "data": response,
    }

    # Try Redis
    client = redis_client
    if client is None:
        try:
            client = get_redis()
        except Exception:
            client = None

    if client is not None:
        try:
            await client.set(RedisKeys.idempotency(key), json.dumps(response), ex=ttl_seconds)
        except Exception as e:
            logger.debug(f"Redis idempotency store failed: {e}")


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """
    SPEC_18 Idempotency Middleware.
    Inspects X-Idempotency-Key or Idempotency-Key header on state-changing requests (POST, PUT, PATCH).
    If duplicate key exists, returns cached response directly without re-executing handler.
    If new key, captures successful response (200/201) and caches it.
    """

    async def dispatch(self, request: Request, call_next):
        if request.method not in ("POST", "PUT", "PATCH"):
            return await call_next(request)

        idempotency_key = request.headers.get("X-Idempotency-Key") or request.headers.get("Idempotency-Key")
        if not idempotency_key:
            return await call_next(request)

        # Check existing cached response
        cached = await check_idempotency(key=idempotency_key)
        if cached:
            status_code = cached.get("status_code", 200)
            content = cached.get("content", {})
            headers = cached.get("headers", {})
            headers["X-Cache"] = "HIT-IDEMPOTENCY"
            headers["X-Idempotency-Key"] = idempotency_key
            return JSONResponse(status_code=status_code, content=content, headers=headers)

        # Execute request
        response = await call_next(request)

        # Only cache successful 200 / 201 responses
        if response.status_code in (200, 201):
            response_body = [chunk async for chunk in response.body_iterator]
            raw_body = b"".join(response_body)
            content_type = response.headers.get("content-type", "")

            if "application/json" in content_type:
                try:
                    content_json = json.loads(raw_body.decode("utf-8"))
                    await store_idempotency(
                        key=idempotency_key,
                        response={
                            "status_code": response.status_code,
                            "content": content_json,
                            "headers": {
                                "Content-Type": content_type,
                            },
                        },
                    )
                except Exception as e:
                    logger.debug(f"Could not parse response body for idempotency caching: {e}")

            headers = dict(response.headers)
            headers["X-Idempotency-Key"] = idempotency_key
            return Response(
                content=raw_body,
                status_code=response.status_code,
                headers=headers,
                media_type=response.media_type,
            )

        return response
