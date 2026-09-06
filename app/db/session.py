from __future__ import annotations
from typing import AsyncGenerator
from uuid import UUID
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text
from app.config import settings

# Import all module models so SQLAlchemy Base.metadata is fully populated for FK resolution
import app.modules.organization.models  # noqa: F401
import app.modules.user.models  # noqa: F401
import app.modules.master_data.models  # noqa: F401
import app.modules.vendor.models  # noqa: F401
import app.modules.requisition.models  # noqa: F401
import app.modules.sourcing.models  # noqa: F401
import app.modules.bid.models  # noqa: F401
import app.modules.evaluation.models  # noqa: F401
import app.modules.contract.models  # noqa: F401
import app.modules.purchase_order.models  # noqa: F401
import app.modules.grn.models  # noqa: F401
import app.modules.invoice.models  # noqa: F401
import app.modules.payment.models  # noqa: F401
import app.modules.workflow.models  # noqa: F401
import app.modules.approval_rules.models  # noqa: F401
import app.modules.document.models  # noqa: F401
import app.modules.notification.models  # noqa: F401
import app.modules.audit.models  # noqa: F401
import app.modules.integration.models  # noqa: F401

import os
import sys
from sqlalchemy.pool import NullPool

_is_celery = (
    os.getenv("IS_CELERY_WORKER", "").lower() in ("true", "1", "yes")
    or any("celery" in arg.lower() for arg in sys.argv)
)
_pool_class = (getattr(settings, "DATABASE_POOL_CLASS", "") or "").lower()
use_null_pool = _pool_class == "nullpool" or (_pool_class != "queuepool" and _is_celery)

if use_null_pool:
    engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        echo=settings.SQL_ECHO,
    )
    analytics_engine = create_async_engine(
        settings.ANALYTICS_DATABASE_URL or settings.DATABASE_URL,
        poolclass=NullPool,
        echo=settings.SQL_ECHO,
    )
else:
    engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_recycle=settings.DATABASE_POOL_RECYCLE,
        echo=settings.SQL_ECHO,
    )
    analytics_engine = create_async_engine(
        settings.ANALYTICS_DATABASE_URL or settings.DATABASE_URL,
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_recycle=settings.DATABASE_POOL_RECYCLE,
        echo=settings.SQL_ECHO,
    )

from contextlib import asynccontextmanager

async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
async_session_factory = async_session

analytics_session = async_sessionmaker(analytics_engine, expire_on_commit=False, class_=AsyncSession)
analytics_session_factory = analytics_session

@asynccontextmanager
async def get_db_ctx() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

async def get_db_with_rls(org_id: UUID) -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            await session.execute(text(f"SET app.current_org_id = '{org_id}'"))
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
