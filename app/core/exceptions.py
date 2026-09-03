from __future__ import annotations
from typing import Any, Optional
from datetime import datetime
from loguru import logger
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

class AppException(Exception):
    def __init__(self, message: str, code: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.code = code
        self.details = details or {}
        super().__init__(self.message)

class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "NOT_FOUND", details)

class ConflictError(AppException):
    def __init__(self, message: str = "Resource conflict", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "CONFLICT", details)

class ForbiddenError(AppException):
    def __init__(self, message: str = "Access forbidden", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "FORBIDDEN", details)

class OptimisticLockError(AppException):
    def __init__(self, message: str = "Resource was updated by another request", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "OPTIMISTIC_LOCK_ERROR", details)

class ValidationError(AppException):
    def __init__(self, message: str = "Validation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "VALIDATION_ERROR", details)

class RateLimitError(AppException):
    def __init__(self, message: str = "Rate limit exceeded", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "RATE_LIMIT_EXCEEDED", details)

class AuthenticationError(AppException):
    def __init__(self, message: str = "Authentication failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "AUTHENTICATION_ERROR", details)

class BusinessRuleError(AppException):
    def __init__(self, message: str = "Business rule violation", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "BUSINESS_RULE_ERROR", details)

def register_exception_handlers(app: FastAPI) -> None:
    from app.core.telemetry import get_current_trace_id

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        status_code = 400
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
