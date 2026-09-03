from __future__ import annotations
from typing import AsyncGenerator
from uuid import UUID
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text
from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_recycle=settings.DATABASE_POOL_RECYCLE,
    echo=settings.SQL_ECHO
)

async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

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
