from __future__ import annotations
import time
from uuid import uuid4
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from loguru import logger
from app.core.telemetry import get_current_trace_id

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

class LoggingContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = getattr(request.state, "request_id", "")
        trace_id = get_current_trace_id()
        user_id = getattr(request.state, "user_id", "")
        org_id = getattr(request.state, "org_id", "")
        
        with logger.contextualize(request_id=request_id, trace_id=trace_id, user_id=user_id, org_id=org_id):
            response = await call_next(request)
            return response

class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        if not request.url.path.startswith("/health"):
            logger.info(f"{request.method} {request.url.path} completed in {process_time:.4f}s")
        return response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response
