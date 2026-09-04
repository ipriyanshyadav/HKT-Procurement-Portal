from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.db.repository_base import BaseRepository
from app.modules.audit.service import audit_service
from app.modules.master_data.models import Category, ErpMaterialGroupMapping

_ENTITY_TYPE = "MASTER_DATA"


class ErpMappingCreateRequest(BaseModel):
    erp_material_group: str = Field(..., min_length=1, max_length=50)
    category_id: UUID
    confidence: Decimal = Field(default=Decimal("1.0"), ge=Decimal("0.0"), le=Decimal("1.0"))


class ErpMappingUpdateRequest(BaseModel):
    category_id: Optional[UUID] = None
    confidence: Optional[Decimal] = Field(default=None, ge=Decimal("0.0"), le=Decimal("1.0"))
    is_verified: Optional[bool] = None


class ErpMappingResponse(BaseModel):
    id: UUID
    org_id: UUID
    erp_material_group: str
    category_id: UUID
    confidence: Decimal
    is_verified: bool
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ErpMappingRepository(BaseRepository[ErpMaterialGroupMapping]):
    def __init__(self) -> None:
        super().__init__(ErpMaterialGroupMapping)

    async def get_by_group(
        self,
        db: AsyncSession,
        erp_material_group: str,
        org_id: UUID,
    ) -> Optional[ErpMaterialGroupMapping]:
        stmt = select(ErpMaterialGroupMapping).where(
            ErpMaterialGroupMapping.erp_material_group == erp_material_group,
            ErpMaterialGroupMapping.org_id == org_id,
            ErpMaterialGroupMapping.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


class ErpMappingService:
    def __init__(self, repo: ErpMappingRepository) -> None:
        self._repo = repo

    async def list_all(
        self,
        db: AsyncSession,
        org_id: UUID,
        verified_only: bool = False,
    ) -> list[ErpMaterialGroupMapping]:
        stmt = select(ErpMaterialGroupMapping).where(
            ErpMaterialGroupMapping.org_id == org_id,
            ErpMaterialGroupMapping.deleted_at.is_(None),
        )
        if verified_only:
            stmt = stmt.where(ErpMaterialGroupMapping.is_verified.is_(True))
        stmt = stmt.order_by(ErpMaterialGroupMapping.erp_material_group.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, db: AsyncSession, id: UUID, org_id: UUID) -> ErpMaterialGroupMapping:
        return await self._repo.get(db, id, org_id)

    async def get_by_erp_group(
        self,
        db: AsyncSession,
        org_id: UUID,
        erp_material_group: str,
    ) -> Optional[ErpMaterialGroupMapping]:
        return await self._repo.get_by_group(db, erp_material_group, org_id)

    async def create(
        self,
        db: AsyncSession,
        data: ErpMappingCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> ErpMaterialGroupMapping:
        # Check category exists
        cat_stmt = select(Category).where(
            Category.id == data.category_id,
            Category.org_id == org_id,
            Category.deleted_at.is_(None),
        )
        cat_res = await db.execute(cat_stmt)
        if not cat_res.scalar_one_or_none():
            raise NotFoundError(f"Category {data.category_id} not found in this organisation")

        # Check duplicate
        existing = await self._repo.get_by_group(db, data.erp_material_group, org_id)
        if existing:
            raise ConflictError(
                f"Mapping for ERP material group '{data.erp_material_group}' already exists",
                {"erp_material_group": data.erp_material_group},
            )

        mapping = ErpMaterialGroupMapping(
            id=uuid4(),
            org_id=org_id,
            erp_material_group=data.erp_material_group,
            category_id=data.category_id,
            confidence=data.confidence,
            is_verified=False,
        )
        db.add(mapping)
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=mapping.id,
            action=AuditAction.MD_CREATED,
            actor_id=actor_id,
            org_id=org_id,
            new_values={
                "erp_material_group": mapping.erp_material_group,
                "category_id": str(mapping.category_id),
                "confidence": str(mapping.confidence),
            },
        )
        logger.info("ERP material group mapping created", id=str(mapping.id), group=mapping.erp_material_group)
        return mapping

    async def update(
        self,
        db: AsyncSession,
        id: UUID,
        data: ErpMappingUpdateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> ErpMaterialGroupMapping:
        mapping = await self._repo.get(db, id, org_id)
        old_values = {
            "category_id": str(mapping.category_id),
            "confidence": str(mapping.confidence),
            "is_verified": mapping.is_verified,
        }

        if data.category_id is not None:
            cat_stmt = select(Category).where(
                Category.id == data.category_id,
                Category.org_id == org_id,
                Category.deleted_at.is_(None),
            )
            cat_res = await db.execute(cat_stmt)
            if not cat_res.scalar_one_or_none():
                raise NotFoundError(f"Category {data.category_id} not found")
            mapping.category_id = data.category_id

        if data.confidence is not None:
            mapping.confidence = data.confidence
        if data.is_verified is not None:
            mapping.is_verified = data.is_verified

        mapping.version += 1
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=mapping.id,
            action=AuditAction.MD_UPDATED,
            actor_id=actor_id,
            org_id=org_id,
            old_values=old_values,
            new_values={
                "category_id": str(mapping.category_id),
                "confidence": str(mapping.confidence),
                "is_verified": mapping.is_verified,
            },
        )
        return mapping

    async def verify(
        self,
        db: AsyncSession,
        id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> ErpMaterialGroupMapping:
        mapping = await self._repo.get(db, id, org_id)
        mapping.is_verified = True
        mapping.version += 1
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=mapping.id,
            action=AuditAction.MD_UPDATED,
            actor_id=actor_id,
            org_id=org_id,
            old_values={"is_verified": False},
            new_values={"is_verified": True},
        )
        return mapping

    async def delete(
        self,
        db: AsyncSession,
        id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        await self._repo.soft_delete(db, id, org_id)
        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=id,
            action=AuditAction.DEACTIVATED,
            actor_id=actor_id,
            org_id=org_id,
        )


erp_mapping_repository = ErpMappingRepository()
erp_mapping_service = ErpMappingService(repo=erp_mapping_repository)
