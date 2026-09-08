"""Shared test fixtures for the procurement portal test suite.
Follows SPEC_23 and GEMINI.md:
- NO hardcoded UUIDs anywhere (all use uuid4() / factories)
- Per-test DB isolation
- Global fixtures for org, buyer_user, supplier_user, auth_headers, client, and factories
"""
from __future__ import annotations

import os
from typing import AsyncGenerator, Dict, Any
from uuid import UUID, uuid4
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings
from app.db.base import Base
from app.db.session import get_db, async_session_factory
from app.auth.jwt import create_access_token


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
    
    # Compatibility fix for passlib with bcrypt >= 4.1.0
    try:
        import bcrypt
        if not hasattr(bcrypt, "__about__"):
            class _About:
                __version__ = getattr(bcrypt, "__version__", "4.0.0")
            bcrypt.__about__ = _About()
        if hasattr(bcrypt, "hashpw"):
            _orig = bcrypt.hashpw
            def _safe_hashpw(password, salt):
                try:
                    return _orig(password, salt)
                except ValueError as e:
                    if "72 bytes" in str(e):
                        return _orig(password[:72], salt)
                    raise
            bcrypt.hashpw = _safe_hashpw
    except ImportError:
        pass


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def org_id() -> UUID:
    """Generate a unique org_id for test isolation."""
    return uuid4()


@pytest.fixture
def user_id() -> UUID:
    """Generate a unique user_id for test isolation."""
    return uuid4()


@pytest.fixture(scope="session")
def test_engine():
    """Engine using NullPool to prevent connection leakage across tests."""
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool, echo=False)
    yield engine


@pytest.fixture
async def db(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Per-test session providing isolated database access."""
    async_session = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


@pytest.fixture
def factory():
    """Access to all factory classes without hardcoded data."""
    from tests.factories import FactoryBundle
    return FactoryBundle


@pytest.fixture
async def org(db: AsyncSession, factory) -> Any:
    """Seeded organization for testing."""
    return await factory.organization.create(db)


@pytest.fixture
async def vendor(db: AsyncSession, org, factory) -> Any:
    """Seeded active vendor belonging to org."""
    return await factory.vendor.create(db, org_id=org.id)


@pytest.fixture
async def buyer_user(db: AsyncSession, org, factory) -> Any:
    """Seeded buyer user with BUYER role."""
    return await factory.user.create(db, org_id=org.id, role="BUYER")


@pytest.fixture
async def supplier_user(db: AsyncSession, org, vendor, factory) -> Any:
    """Seeded supplier user with SUPPLIER_USER role linked to vendor."""
    return await factory.user.create(
        db,
        org_id=org.id,
        role="SUPPLIER_USER",
        is_supplier_user=True,
        vendor_id=vendor.id,
    )


@pytest.fixture
async def admin_user(db: AsyncSession, org, factory) -> Any:
    """Seeded admin user with SYSTEM_ADMIN role."""
    return await factory.user.create(db, org_id=org.id, role="SYSTEM_ADMIN")


@pytest.fixture
async def auth_headers(db: AsyncSession, buyer_user) -> Dict[str, str]:
    """Bearer authorization headers for buyer_user with a valid DB session."""
    from app.modules.user.models import UserSession
    from datetime import datetime, timedelta, timezone

    jti = str(uuid4())
    token = create_access_token(
        user_id=buyer_user.id,
        org_id=buyer_user.org_id,
        email=buyer_user.email,
        roles=["BUYER"],
        bu_scope=[],
        category_scope=[],
        plant_scope=[],
        is_supplier_user=False,
        vendor_id=None,
        jti=jti,
    )
    user_session = UserSession(
        id=uuid4(),
        org_id=buyer_user.org_id,
        user_id=buyer_user.id,
        token_jti=jti,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=8),
        is_revoked=False,
    )
    db.add(user_session)
    await db.flush()
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def supplier_auth_headers(db: AsyncSession, supplier_user) -> Dict[str, str]:
    """Bearer authorization headers for supplier_user with a valid DB session."""
    from app.modules.user.models import UserSession
    from datetime import datetime, timedelta, timezone

    jti = str(uuid4())
    token = create_access_token(
        user_id=supplier_user.id,
        org_id=supplier_user.org_id,
        email=supplier_user.email,
        roles=["SUPPLIER_USER"],
        bu_scope=[],
        category_scope=[],
        plant_scope=[],
        is_supplier_user=True,
        vendor_id=supplier_user.vendor_id,
        jti=jti,
    )
    user_session = UserSession(
        id=uuid4(),
        org_id=supplier_user.org_id,
        user_id=supplier_user.id,
        token_jti=jti,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=8),
        is_revoked=False,
    )
    db.add(user_session)
    await db.flush()
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def admin_auth_headers(db: AsyncSession, admin_user) -> Dict[str, str]:
    """Bearer authorization headers for admin_user with a valid DB session."""
    from app.modules.user.models import UserSession
    from datetime import datetime, timedelta, timezone

    jti = str(uuid4())
    token = create_access_token(
        user_id=admin_user.id,
        org_id=admin_user.org_id,
        email=admin_user.email,
        roles=["SYSTEM_ADMIN"],
        bu_scope=[],
        category_scope=[],
        plant_scope=[],
        is_supplier_user=False,
        vendor_id=None,
        jti=jti,
    )
    user_session = UserSession(
        id=uuid4(),
        org_id=admin_user.org_id,
        user_id=admin_user.id,
        token_jti=jti,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=8),
        is_revoked=False,
    )
    db.add(user_session)
    await db.flush()
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient configured with FastAPI app and database override."""
    from app.main import app

    async def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.pop(get_db, None)
