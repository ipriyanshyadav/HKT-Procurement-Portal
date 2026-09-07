from __future__ import annotations
import time
from uuid import uuid4
from starlette.datastructures import MutableHeaders, Headers
from loguru import logger
from app.config import settings
from app.core.telemetry import get_current_trace_id
from app.core.metrics import http_requests_total, http_request_duration_seconds


class RequestIDMiddleware:
    """Pure ASGI middleware to attach X-Request-ID to request state and response headers."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        request_id = headers.get("X-Request-ID") or str(uuid4())
        scope.setdefault("state", {})["request_id"] = request_id

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                res_headers = MutableHeaders(scope=message)
                res_headers["X-Request-ID"] = request_id
            await send(message)

        await self.app(scope, receive, send_wrapper)


class LoggingContextMiddleware:
    """Pure ASGI middleware to inject request_id, trace_id, user_id, org_id into loguru context."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        state = scope.get("state", {})
        request_id = state.get("request_id", "")
        trace_id = get_current_trace_id()
        user_id = getattr(state, "user_id", "") if not isinstance(state, dict) else state.get("user_id", "")
        org_id = getattr(state, "org_id", "") if not isinstance(state, dict) else state.get("org_id", "")

        with logger.contextualize(request_id=request_id, trace_id=trace_id, user_id=str(user_id or ""), org_id=str(org_id or "")):
            await self.app(scope, receive, send)


class TimingMiddleware:
    """Pure ASGI middleware for high-resolution request timing and Prometheus metrics collection."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start_time = time.time()

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                process_time = time.time() - start_time
                res_headers = MutableHeaders(scope=message)
                res_headers["X-Process-Time"] = str(process_time)

                # Use route template path (low-cardinality) instead of raw path (high-cardinality)
                route = scope.get("route")
                endpoint = route.path if route and hasattr(route, "path") else scope.get("path", "")
                method = scope.get("method", "GET")
                status_code = str(message.get("status", 200))
                state = scope.get("state", {})
                org_id = state.get("org_id") if isinstance(state, dict) else getattr(state, "org_id", None)
                org_id_str = str(org_id or "unknown")

                http_requests_total.labels(
                    method=method,
                    endpoint=endpoint,
                    status_code=status_code,
                    org_id=org_id_str,
                ).inc()

                if not endpoint.startswith("/health"):
                    http_request_duration_seconds.labels(
                        method=method,
                        endpoint=endpoint,
                    ).observe(process_time)
                    logger.info(f"{method} {endpoint} completed in {process_time:.4f}s")

            await send(message)

        await self.app(scope, receive, send_wrapper)


class SecurityHeadersMiddleware:
    """Pure ASGI middleware to inject security headers without BaseHTTPMiddleware streaming overhead."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                res_headers = MutableHeaders(scope=message)
                res_headers["Content-Security-Policy"] = "default-src 'self'"
                res_headers["Strict-Transport-Security"] = f"max-age={settings.HSTS_MAX_AGE_SECONDS}; includeSubDomains"
                res_headers["X-Frame-Options"] = "DENY"
                res_headers["X-Content-Type-Options"] = "nosniff"
                res_headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
                res_headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
            await send(message)

        await self.app(scope, receive, send_wrapper)
