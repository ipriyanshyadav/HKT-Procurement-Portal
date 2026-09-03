import pytest
from app.core.exceptions import (
    AppException,
    NotFoundError,
    ConflictError,
    ForbiddenError,
    OptimisticLockError,
    ValidationError,
    RateLimitError,
    AuthenticationError,
    BusinessRuleError
)

def test_app_exception():
    exc = AppException(message="App error", code="APP_ERROR", details={"info": "test"})
    assert exc.message == "App error"
    assert exc.code == "APP_ERROR"
    assert exc.details == {"info": "test"}
    assert isinstance(exc, Exception)

def test_not_found_error():
    exc = NotFoundError(message="Not found")
    assert exc.code == "NOT_FOUND"
    assert isinstance(exc, AppException)

def test_conflict_error():
    exc = ConflictError(message="Conflict")
    assert exc.code == "CONFLICT"
    assert isinstance(exc, AppException)

def test_forbidden_error():
    exc = ForbiddenError()
    assert exc.code == "FORBIDDEN"
    assert exc.message == "Access forbidden"
    assert isinstance(exc, AppException)

def test_optimistic_lock_error():
    exc = OptimisticLockError(message="Lock error")
    assert exc.code == "OPTIMISTIC_LOCK_ERROR"
    assert isinstance(exc, AppException)

def test_validation_error():
    exc = ValidationError(message="Invalid")
    assert exc.code == "VALIDATION_ERROR"
    assert isinstance(exc, AppException)

def test_rate_limit_error():
    exc = RateLimitError(message="Limit")
    assert exc.code == "RATE_LIMIT_EXCEEDED"
    assert isinstance(exc, AppException)

def test_authentication_error():
    exc = AuthenticationError(message="Auth")
    assert exc.code == "AUTHENTICATION_ERROR"
    assert isinstance(exc, AppException)

def test_business_rule_error():
    exc = BusinessRuleError(message="Rule")
    assert exc.code == "BUSINESS_RULE_ERROR"
    assert isinstance(exc, AppException)
