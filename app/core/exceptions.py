from __future__ import annotations
from typing import Any, Optional
from datetime import datetime
from loguru import logger
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

class AppException(Exception):
    def __init__(
        self,
        message: str,
        code: Optional[str] = None,
        details: Optional[Any] = None,
        status_code: Optional[int] = None,
    ):
        if isinstance(details, int) and status_code is None:
            status_code = details
            details = {}
        # Support calling as AppException(code, message) when first arg is an ERROR_CODE
        if code is not None and message.isupper() and " " not in message and (" " in code or not code.isupper()):
            self.code = message
            self.message = code
        else:
            self.message = message
            self.code = code or "APP_ERROR"
        self.details = details if isinstance(details, dict) else {}
        self.status_code = status_code
        super().__init__(self.message)

def _resolve_exc_args(default_msg: str, default_code: str, message_or_code: str, details_or_message: Optional[Any], code: Optional[str]):
    if code is not None:
        c = code
        m = message_or_code
        d = details_or_message if isinstance(details_or_message, dict) else {}
    elif isinstance(details_or_message, str):
        c = message_or_code
        m = details_or_message
        d = {}
    else:
        c = default_code
        m = message_or_code or default_msg
        d = details_or_message if isinstance(details_or_message, dict) else {}
    return m, c, d

class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found", details: Optional[Any] = None, code: Optional[str] = None):
        m, c, d = _resolve_exc_args("Resource not found", "NOT_FOUND", message, details, code)
        super().__init__(m, c, d)

class ConflictError(AppException):
    def __init__(self, message: str = "Resource conflict", details: Optional[Any] = None, code: Optional[str] = None):
        m, c, d = _resolve_exc_args("Resource conflict", "CONFLICT", message, details, code)
        super().__init__(m, c, d)

class ForbiddenError(AppException):
    def __init__(self, message: str = "Access forbidden", details: Optional[Any] = None, code: Optional[str] = None):
        m, c, d = _resolve_exc_args("Access forbidden", "FORBIDDEN", message, details, code)
        super().__init__(m, c, d)

class OptimisticLockError(AppException):
    def __init__(self, message: str = "Resource was updated by another request", details: Optional[Any] = None, code: Optional[str] = None):
        m, c, d = _resolve_exc_args("Resource was updated by another request", "OPTIMISTIC_LOCK_ERROR", message, details, code)
        super().__init__(m, c, d)

class ValidationError(AppException):
    def __init__(self, message: str = "Validation failed", details: Optional[Any] = None, code: Optional[str] = None):
        m, c, d = _resolve_exc_args("Validation failed", "VALIDATION_ERROR", message, details, code)
        super().__init__(m, c, d)

class RateLimitError(AppException):
    def __init__(self, message: str = "Rate limit exceeded", details: Optional[Any] = None, code: Optional[str] = None):
        m, c, d = _resolve_exc_args("Rate limit exceeded", "RATE_LIMIT_EXCEEDED", message, details, code)
        super().__init__(m, c, d)

class AuthenticationError(AppException):
    def __init__(self, message: str = "Authentication failed", details: Optional[Any] = None, code: Optional[str] = None):
        m, c, d = _resolve_exc_args("Authentication failed", "AUTHENTICATION_ERROR", message, details, code)
        super().__init__(m, c, d)

class BusinessRuleError(AppException):
    def __init__(self, message: str = "Business rule violation", details: Optional[Any] = None, code: Optional[str] = None):
        m, c, d = _resolve_exc_args("Business rule violation", "BUSINESS_RULE_ERROR", message, details, code)
        super().__init__(m, c, d)

def register_exception_handlers(app: FastAPI) -> None:
    from app.core.telemetry import get_current_trace_id

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        status_code = exc.status_code or 400
        if isinstance(exc, NotFoundError):
            status_code = 404
        elif isinstance(exc, ConflictError) or isinstance(exc, OptimisticLockError):
            status_code = 409
        elif isinstance(exc, ForbiddenError):
            status_code = 403
        elif isinstance(exc, AuthenticationError):
            status_code = 401
        elif isinstance(exc, RateLimitError):
            status_code = 429
            
        trace_id = get_current_trace_id()
        
        return JSONResponse(
            status_code=status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                    "trace_id": trace_id,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        trace_id = get_current_trace_id()
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "details": {"errors": exc.errors()},
                    "trace_id": trace_id,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception")
        trace_id = get_current_trace_id()
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred",
                    "details": {},
                    "trace_id": trace_id,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
        )
