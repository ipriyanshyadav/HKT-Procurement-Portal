"""Shared test fixtures for the procurement portal test suite."""
from __future__ import annotations

import os
import pytest
from httpx import AsyncClient, ASGITransport
from uuid import uuid4

def pytest_configure(config):
    """Set required env vars before any imports."""
    os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/procurement")
    os.environ.setdefault("ANALYTICS_DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/procurement")
    os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
    os.environ.setdefault("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/test")
    os.environ.setdefault("MINIO_ENDPOINT", "localhost:9000")
    os.environ.setdefault("MINIO_ACCESS_KEY", "testkey")
    os.environ.setdefault("MINIO_SECRET_KEY", "testsecret")
    os.environ.setdefault("JWT_PRIVATE_KEY_PATH", "keys/private.pem")
    os.environ.setdefault("JWT_PUBLIC_KEY_PATH", "keys/public.pem")
    os.environ.setdefault("FIELD_ENCRYPTION_KEY", "U5RAQQjKHzcBauoi8R7GrRrj7bBSf-eQPhPtfGg370A=")

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.fixture
def org_id():
    """Generate a unique org_id for test isolation."""
    return uuid4()

@pytest.fixture
def user_id():
    """Generate a unique user_id for test isolation."""
    return uuid4()
