from __future__ import annotations

from app.config import settings
from app.core.redis_client import get_redis_client
from app.tasks.celery_app import _get_result_backend_url, celery_app


def test_get_result_backend_url_with_existing_db():
    url = "redis://localhost:6379/0"
    result = _get_result_backend_url(url, settings.REDIS_CELERY_BACKEND_DB)
    assert result == f"redis://localhost:6379/{settings.REDIS_CELERY_BACKEND_DB}"


def test_get_result_backend_url_without_db():
    url = "redis://localhost:6379"
    result = _get_result_backend_url(url, settings.REDIS_CELERY_BACKEND_DB)
    assert result == f"redis://localhost:6379/{settings.REDIS_CELERY_BACKEND_DB}"


def test_get_result_backend_url_with_auth_and_scheme():
    url = "redis://:secret@redis-server:6380/5"
    result = _get_result_backend_url(url, settings.REDIS_CELERY_BACKEND_DB)
    assert result == f"redis://:secret@redis-server:6380/{settings.REDIS_CELERY_BACKEND_DB}"


def test_get_result_backend_url_without_scheme():
    url = "localhost:6379/0"
    result = _get_result_backend_url(url, settings.REDIS_CELERY_BACKEND_DB)
    assert result == f"redis://localhost:6379/{settings.REDIS_CELERY_BACKEND_DB}"


def test_get_result_backend_url_none():
    assert _get_result_backend_url(None, settings.REDIS_CELERY_BACKEND_DB) is None


def test_celery_backend_initialization_no_error():
    assert celery_app.conf.result_backend is not None
    assert f"/{settings.REDIS_CELERY_BACKEND_DB}" in celery_app.conf.result_backend
    assert "0/3" not in celery_app.conf.result_backend
    uri = celery_app.backend.as_uri()
    assert uri.endswith(f"/{settings.REDIS_CELERY_BACKEND_DB}")


def test_get_redis_client_db_routing():
    client_default = get_redis_client(settings.REDIS_SESSION_DB)
    client_cache = get_redis_client(settings.REDIS_CACHE_DB)
    client_rate_limit = get_redis_client(settings.REDIS_RATE_LIMIT_DB)

    assert client_default.connection_pool.connection_kwargs.get("db") == settings.REDIS_SESSION_DB
    assert client_cache.connection_pool.connection_kwargs.get("db") == settings.REDIS_CACHE_DB
    assert client_rate_limit.connection_pool.connection_kwargs.get("db") == settings.REDIS_RATE_LIMIT_DB
