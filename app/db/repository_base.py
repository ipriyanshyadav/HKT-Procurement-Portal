from __future__ import annotations
from typing import TypeVar, Generic, Type, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from uuid import UUID
from datetime import datetime, timezone
from app.db.base import BaseModel
from app.core.exceptions import NotFoundError

ModelType = TypeVar("ModelType", bound=BaseModel)

class BaseRepository(Generic[ModelType]):
    """Generic repository providing base CRUD and soft delete abstractions."""

    def __init__(self, model: Type[ModelType]) -> None:
        self.model = model

    async def get(
        self,
        db: AsyncSession,
        id: UUID,
        org_id: UUID,
        include_deleted: bool = False
    ) -> ModelType:
        stmt = select(self.model).where(self.model.id == id, self.model.org_id == org_id)
        if not include_deleted and hasattr(self.model, "deleted_at"):
            stmt = stmt.where(self.model.deleted_at.is_(None))
        result = await db.execute(stmt)
        obj = result.scalar_one_or_none()
        if not obj:
            raise NotFoundError(getattr(self.model, "__tablename__", str(self.model)), str(id))
        return obj

    async def get_multi(
        self,
        db: AsyncSession,
        org_id: UUID,
        skip: int = 0,
        limit: int = 25,
        include_deleted: bool = False
    ) -> List[ModelType]:
        stmt = select(self.model).where(self.model.org_id == org_id)
        if not include_deleted and hasattr(self.model, "deleted_at"):
            stmt = stmt.where(self.model.deleted_at.is_(None))
        stmt = stmt.offset(skip).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_ids(
        self,
        db: AsyncSession,
        ids: list[UUID],
        org_id: UUID,
        include_deleted: bool = False,
    ) -> List[ModelType]:
        if not ids:
            return []
        stmt = select(self.model).where(self.model.id.in_(ids), self.model.org_id == org_id)
        if not include_deleted and hasattr(self.model, "deleted_at"):
            stmt = stmt.where(self.model.deleted_at.is_(None))
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def soft_delete(self, db: AsyncSession, id: UUID, org_id: UUID) -> None:
        now = datetime.now(timezone.utc)
        stmt = (
            update(self.model)
            .where(self.model.id == id, self.model.org_id == org_id)
            .values(deleted_at=now)
        )
        await db.execute(stmt)

    async def increment_version(self, db: AsyncSession, obj: ModelType) -> None:
        obj.version += 1
