from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.db.repository_base import BaseRepository
from app.modules.audit.service import audit_service
from app.modules.master_data.models import Category

_ENTITY_TYPE = "MASTER_DATA"


class CategoryCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    parent_id: Optional[UUID] = None
    unspsc_code: Optional[str] = Field(default=None, max_length=20)


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    unspsc_code: Optional[str] = Field(default=None, max_length=20)
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    id: UUID
    org_id: UUID
    code: str
    name: str
    parent_id: Optional[UUID]
    level: int
    path: str
    unspsc_code: Optional[str]
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CategoryRepository(BaseRepository[Category]):
    def __init__(self) -> None:
        super().__init__(Category)

    async def get_by_code(
        self,
        db: AsyncSession,
        code: str,
        org_id: UUID,
    ) -> Optional[Category]:
        stmt = select(Category).where(
            Category.code == code,
            Category.org_id == org_id,
            Category.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_children_count(
        self,
        db: AsyncSession,
        category_id: UUID,
        org_id: UUID,
    ) -> int:
        stmt = select(func.count(Category.id)).where(
            Category.parent_id == category_id,
            Category.org_id == org_id,
            Category.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one() or 0


class CategoryService:
    MAX_HIERARCHY_DEPTH = 5  # Structural limit per specification

    def __init__(self, repo: CategoryRepository) -> None:
        self._repo = repo

    async def _get_depth(self, db: AsyncSession, category_id: UUID, org_id: UUID) -> int:
        """Calculate the level/depth of a category using recursive CTE upwards."""
        sql = text("""
            WITH RECURSIVE ancestors AS (
                SELECT id, parent_id, 1 as depth
                FROM categories
                WHERE id = :cat_id AND org_id = :org_id AND deleted_at IS NULL
                UNION ALL
                SELECT c.id, c.parent_id, a.depth + 1
                FROM categories c
                INNER JOIN ancestors a ON c.id = a.parent_id
                WHERE c.org_id = :org_id AND c.deleted_at IS NULL
            )
            SELECT MAX(depth) FROM ancestors
        """)
        result = await db.execute(sql, {"cat_id": category_id, "org_id": org_id})
        depth = result.scalar()
        return depth if depth is not None else 1

    async def create(
        self,
        db: AsyncSession,
        data: CategoryCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Category:
        # Check code uniqueness
        existing = await self._repo.get_by_code(db, data.code, org_id)
        if existing:
            raise ConflictError(
                f"Category with code '{data.code}' already exists",
                {"code": data.code},
            )

        level = 1
        path = f"/{data.code}"

        if data.parent_id:
            parent = await self._repo.get(db, data.parent_id, org_id)
            depth = await self._get_depth(db, parent.id, org_id)
            if depth >= self.MAX_HIERARCHY_DEPTH:
                raise ValidationError(
                    "MAX_DEPTH_EXCEEDED",
                    {"error": f"Category hierarchy cannot exceed {self.MAX_HIERARCHY_DEPTH} levels"},
                )
            level = depth + 1
            path = f"{parent.path}/{data.code}"

        category = Category(
            id=uuid4(),
            org_id=org_id,
            code=data.code,
            name=data.name,
            parent_id=data.parent_id,
            level=level,
            path=path,
            unspsc_code=data.unspsc_code,
            is_active=True,
        )
        db.add(category)
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=category.id,
            action=AuditAction.MD_CREATED,
            actor_id=actor_id,
            org_id=org_id,
            new_values={
                "code": category.code,
                "name": category.name,
                "parent_id": str(category.parent_id) if category.parent_id else None,
                "level": category.level,
                "path": category.path,
            },
        )
        logger.info("Category created", id=str(category.id), code=category.code, org_id=str(org_id))
        return category

    async def get_by_id(self, db: AsyncSession, id: UUID, org_id: UUID) -> Category:
        return await self._repo.get(db, id, org_id)

    async def get_by_code(self, db: AsyncSession, code: str, org_id: UUID) -> Optional[Category]:
        return await self._repo.get_by_code(db, code, org_id)

    async def list_all(
        self,
        db: AsyncSession,
        org_id: UUID,
        active_only: bool = True,
    ) -> list[Category]:
        stmt = select(Category).where(
            Category.org_id == org_id,
            Category.deleted_at.is_(None),
        )
        if active_only:
            stmt = stmt.where(Category.is_active.is_(True))
        stmt = stmt.order_by(Category.level.asc(), Category.name.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_tree(
        self,
        db: AsyncSession,
        org_id: UUID,
        root_id: Optional[UUID] = None,
    ) -> list[dict[str, Any]]:
        """Returns full category tree or subtree using recursive CTE."""
        if root_id:
            cte_sql = text("""
                WITH RECURSIVE cat_tree AS (
                    SELECT id, name, code, parent_id, level, path, is_active, unspsc_code, 0 as depth
                    FROM categories
                    WHERE id = :root_id AND org_id = :org_id AND deleted_at IS NULL
                    UNION ALL
                    SELECT c.id, c.name, c.code, c.parent_id, c.level, c.path, c.is_active, c.unspsc_code, ct.depth + 1
                    FROM categories c
                    INNER JOIN cat_tree ct ON c.parent_id = ct.id
                    WHERE c.org_id = :org_id AND c.deleted_at IS NULL
                )
                SELECT id, name, code, parent_id, level, path, is_active, unspsc_code, depth
                FROM cat_tree
                ORDER BY level, name
            """)
            result = await db.execute(cte_sql, {"root_id": root_id, "org_id": org_id})
        else:
            cte_sql = text("""
                WITH RECURSIVE cat_tree AS (
                    SELECT id, name, code, parent_id, level, path, is_active, unspsc_code, 0 as depth
                    FROM categories
                    WHERE parent_id IS NULL AND org_id = :org_id AND deleted_at IS NULL
                    UNION ALL
                    SELECT c.id, c.name, c.code, c.parent_id, c.level, c.path, c.is_active, c.unspsc_code, ct.depth + 1
                    FROM categories c
                    INNER JOIN cat_tree ct ON c.parent_id = ct.id
                    WHERE c.org_id = :org_id AND c.deleted_at IS NULL
                )
                SELECT id, name, code, parent_id, level, path, is_active, unspsc_code, depth
                FROM cat_tree
                ORDER BY level, name
            """)
            result = await db.execute(cte_sql, {"org_id": org_id})

        rows = result.fetchall()
        return self._build_tree(rows)

    def _build_tree(self, rows: list[Any]) -> list[dict[str, Any]]:
        """Converts flat CTE rows into a hierarchical tree with nested children."""
        node_map: dict[str, dict[str, Any]] = {}
        tree: list[dict[str, Any]] = []

        for row in rows:
            node_id = str(row.id)
            node_data = {
                "id": node_id,
                "name": row.name,
                "code": row.code,
                "parent_id": str(row.parent_id) if row.parent_id else None,
                "level": row.level,
                "path": row.path,
                "is_active": row.is_active,
                "unspsc_code": row.unspsc_code,
                "children": [],
            }
            node_map[node_id] = node_data

        for node_id, node in node_map.items():
            parent_id = node["parent_id"]
            if parent_id and parent_id in node_map:
                node_map[parent_id]["children"].append(node)
            else:
                tree.append(node)

        return tree

    async def get_ancestors(
        self,
        db: AsyncSession,
        category_id: UUID,
        org_id: UUID,
    ) -> list[dict[str, Any]]:
        """Traverse upwards to get the breadcrumb trail of ancestors."""
        sql = text("""
            WITH RECURSIVE ancestors AS (
                SELECT id, name, code, parent_id, level, path
                FROM categories
                WHERE id = :cat_id AND org_id = :org_id AND deleted_at IS NULL
                UNION ALL
                SELECT c.id, c.name, c.code, c.parent_id, c.level, c.path
                FROM categories c
                INNER JOIN ancestors a ON c.id = a.parent_id
                WHERE c.org_id = :org_id AND c.deleted_at IS NULL
            )
            SELECT id, name, code, parent_id, level, path
            FROM ancestors
            ORDER BY level ASC
        """)
        result = await db.execute(sql, {"cat_id": category_id, "org_id": org_id})
        rows = result.fetchall()
        return [
            {
                "id": str(row.id),
                "name": row.name,
                "code": row.code,
                "parent_id": str(row.parent_id) if row.parent_id else None,
                "level": row.level,
                "path": row.path,
            }
            for row in rows
        ]

    async def update(
        self,
        db: AsyncSession,
        id: UUID,
        data: CategoryUpdateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Category:
        category = await self._repo.get(db, id, org_id)
        old_values = {
            "name": category.name,
            "unspsc_code": category.unspsc_code,
            "is_active": category.is_active,
        }

        if data.name is not None:
            category.name = data.name
        if data.unspsc_code is not None:
            category.unspsc_code = data.unspsc_code
        if data.is_active is not None:
            category.is_active = data.is_active

        category.version += 1
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=category.id,
            action=AuditAction.MD_UPDATED,
            actor_id=actor_id,
            org_id=org_id,
            old_values=old_values,
            new_values={
                "name": category.name,
                "unspsc_code": category.unspsc_code,
                "is_active": category.is_active,
            },
        )
        logger.info("Category updated", id=str(category.id), org_id=str(org_id))
        return category

    async def soft_delete(
        self,
        db: AsyncSession,
        id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        category = await self._repo.get(db, id, org_id)
        children_count = await self._repo.get_active_children_count(db, id, org_id)
        if children_count > 0:
            raise ConflictError(
                "Cannot delete category with active sub-categories",
                {"category_id": str(id), "children_count": children_count},
            )

        now = datetime.now(timezone.utc)
        category.deleted_at = now
        category.is_active = False
        category.version += 1
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=category.id,
            action=AuditAction.DEACTIVATED,
            actor_id=actor_id,
            org_id=org_id,
            old_values={"deleted_at": None, "is_active": True},
            new_values={"deleted_at": now.isoformat(), "is_active": False},
        )
        logger.info("Category soft-deleted", id=str(category.id), org_id=str(org_id))


category_repository = CategoryRepository()
category_service = CategoryService(repo=category_repository)
