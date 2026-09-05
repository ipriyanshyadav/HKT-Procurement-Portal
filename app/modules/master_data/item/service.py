from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from uuid import UUID, uuid4

from loguru import logger
from pydantic import BaseModel as PydanticBaseModel, Field, model_validator
from sqlalchemy import and_, select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.exceptions import ConflictError, NotFoundError
from app.db.repository_base import BaseRepository
from app.modules.audit.service import audit_service
from app.modules.master_data.models import ItemMaster

_ENTITY_TYPE = "MASTER_DATA"


class ItemCreateRequest(PydanticBaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    category_id: UUID
    uom_id: UUID
    standard_price: Decimal = Field(default=Decimal("0.0"), ge=0)
    currency: str = Field(default="INR", max_length=3)
    hsn_code: Optional[str] = Field(default=None, max_length=20)
    image_url: Optional[str] = Field(default=None, max_length=500)
    is_punchout: bool = False
    punchout_vendor_id: Optional[UUID] = None


class ItemUpdateRequest(PydanticBaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    category_id: Optional[UUID] = None
    uom_id: Optional[UUID] = None
    standard_price: Optional[Decimal] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, max_length=3)
    hsn_code: Optional[str] = Field(default=None, max_length=20)
    image_url: Optional[str] = Field(default=None, max_length=500)
    is_punchout: Optional[bool] = None
    punchout_vendor_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class ItemResponse(PydanticBaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    org_id: UUID
    code: str
    name: str
    description: Optional[str] = None
    category_id: UUID
    uom_id: UUID
    standard_price: Decimal
    currency: str
    hsn_code: Optional[str] = None
    image_url: Optional[str] = None
    is_punchout: bool
    punchout_vendor_id: Optional[UUID] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PunchOutSessionResponse(PydanticBaseModel):
    session_id: str
    vendor_id: Optional[str] = None
    punchout_url: str
    return_url: str
    status: str


class PunchOutCartItem(PydanticBaseModel):
    item_code: str
    item_description: str
    category_id: Optional[str] = None
    uom_id: Optional[str] = None
    quantity: int = 1
    unit_price: Decimal
    currency: str = "INR"
    hsn_code: Optional[str] = None


class ItemService:
    def __init__(self) -> None:
        self.repo = BaseRepository[ItemMaster](ItemMaster)

    async def list_items(
        self,
        db: AsyncSession,
        org_id: UUID,
        search: Optional[str] = None,
        category_id: Optional[UUID] = None,
        active_only: bool = True,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[List[ItemMaster], int]:
        conditions = [ItemMaster.org_id == org_id, ItemMaster.deleted_at.is_(None)]
        if active_only:
            conditions.append(ItemMaster.is_active.is_(True))
        if category_id:
            conditions.append(ItemMaster.category_id == category_id)
        if search:
            s = f"%{search.strip()}%"
            conditions.append(or_(ItemMaster.name.ilike(s), ItemMaster.code.ilike(s), ItemMaster.description.ilike(s)))

        count_stmt = select(func.count(ItemMaster.id)).where(and_(*conditions))
        total_res = await db.execute(count_stmt)
        total = total_res.scalar_one() or 0

        offset = (page - 1) * page_size
        stmt = (
            select(ItemMaster)
            .where(and_(*conditions))
            .order_by(ItemMaster.name.asc())
            .offset(offset)
            .limit(page_size)
        )
        res = await db.execute(stmt)
        items = list(res.scalars().all())
        return items, total

    async def get_by_id(self, db: AsyncSession, item_id: UUID, org_id: UUID) -> ItemMaster:
        try:
            return await self.repo.get(db, item_id, org_id)
        except NotFoundError:
            raise NotFoundError("Item not found", {"item_id": str(item_id)})

    async def get_by_code(self, db: AsyncSession, code: str, org_id: UUID) -> Optional[ItemMaster]:
        stmt = select(ItemMaster).where(
            and_(
                ItemMaster.org_id == org_id,
                ItemMaster.code == code.strip(),
                ItemMaster.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def create(
        self,
        db: AsyncSession,
        req: ItemCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> ItemMaster:
        existing = await self.get_by_code(db, req.code, org_id)
        if existing:
            raise ConflictError("Item code already exists", {"code": req.code})

        item = ItemMaster(
            id=uuid4(),
            org_id=org_id,
            code=req.code.strip(),
            name=req.name.strip(),
            description=req.description.strip() if req.description else None,
            category_id=req.category_id,
            uom_id=req.uom_id,
            standard_price=req.standard_price,
            currency=req.currency.strip().upper(),
            hsn_code=req.hsn_code.strip() if req.hsn_code else None,
            image_url=req.image_url.strip() if req.image_url else None,
            is_punchout=req.is_punchout,
            punchout_vendor_id=req.punchout_vendor_id,
            is_active=True,
        )
        db.add(item)
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=item.id,
            action=AuditAction.MD_CREATED,
            actor_id=actor_id,
            org_id=org_id,
            new_values={"code": item.code, "name": item.name, "standard_price": str(item.standard_price)},
        )
        return item

    async def update(
        self,
        db: AsyncSession,
        item_id: UUID,
        req: ItemUpdateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> ItemMaster:
        item = await self.get_by_id(db, item_id, org_id)
        data = req.model_dump(exclude_unset=True)
        for field_name, value in data.items():
            setattr(item, field_name, value)
        item.updated_at = datetime.now(timezone.utc)
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=item.id,
            action=AuditAction.MD_UPDATED,
            actor_id=actor_id,
            org_id=org_id,
            new_values=req.model_dump(mode="json", exclude_unset=True),
        )
        return item

    async def delete(self, db: AsyncSession, item_id: UUID, actor_id: UUID, org_id: UUID) -> None:
        item = await self.get_by_id(db, item_id, org_id)
        item.deleted_at = datetime.now(timezone.utc)
        item.is_active = False
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=item.id,
            action=AuditAction.DEACTIVATED,
            actor_id=actor_id,
            org_id=org_id,
            new_values={"deleted_at": str(item.deleted_at)},
        )


item_service = ItemService()
