from __future__ import annotations
import json
import time
from typing import Optional, Dict, Any
from starlette.responses import JSONResponse, Response
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

    # Evict expired entries if cache is growing large
    if len(_memory_cache) > settings.IDEMPOTENCY_MEMORY_CACHE_MAX_ENTRIES:
        now = time.time()
        expired = [k for k, v in list(_memory_cache.items()) if now >= v.get("expires_at", 0)]
        for k in expired:
            _memory_cache.pop(k, None)

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


class IdempotencyMiddleware:
    """Pure ASGI idempotency middleware (no BaseHTTPMiddleware generator overhead).
    Inspects X-Idempotency-Key or Idempotency-Key header on POST/PUT/PATCH.
    Returns cached response on duplicate key; caches 200/201 JSON responses.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "")
        if method not in ("POST", "PUT", "PATCH"):
            await self.app(scope, receive, send)
            return

        from starlette.datastructures import Headers
        headers = Headers(scope=scope)
        idempotency_key = headers.get("X-Idempotency-Key") or headers.get("Idempotency-Key")
        if not idempotency_key:
            await self.app(scope, receive, send)
            return

        # Check existing cached response
        cached = await check_idempotency(key=idempotency_key)
        if cached:
            status_code = cached.get("status_code", 200)
            content = cached.get("content", {})
            extra_headers = cached.get("headers", {})
            extra_headers["X-Cache"] = "HIT-IDEMPOTENCY"
            extra_headers["X-Idempotency-Key"] = idempotency_key
            # Build raw ASGI response
            from starlette.responses import JSONResponse
            resp = JSONResponse(status_code=status_code, content=content, headers=extra_headers)
            await resp(scope, receive, send)
            return

        # Capture response for caching
        response_started = False
        response_headers = {}
        status_code = 200
        body_chunks: list[bytes] = []

        async def send_wrapper(message):
            nonlocal response_started, response_headers, status_code
            if message["type"] == "http.response.start":
                response_started = True
                status_code = message.get("status", 200)
                from starlette.datastructures import MutableHeaders
                mh = MutableHeaders(scope=message)
                mh["X-Idempotency-Key"] = idempotency_key
                response_headers = dict(mh)
                await send(message)
            elif message["type"] == "http.response.body":
                body_chunks.append(message.get("body", b""))
                await send(message)
            else:
                await send(message)

        await self.app(scope, receive, send_wrapper)

        # Cache successful JSON responses
        if status_code in (200, 201) and body_chunks:
            raw_body = b"".join(body_chunks)
            content_type = response_headers.get("content-type", "")
            if "application/json" in content_type:
                try:
                    content_json = json.loads(raw_body.decode("utf-8"))
                    await store_idempotency(
                        key=idempotency_key,
                        response={
                            "status_code": status_code,
                            "content": content_json,
                            "headers": {"Content-Type": content_type},
                        },
                    )
                except Exception as e:
                    logger.debug(f"Could not parse response body for idempotency caching: {e}")
