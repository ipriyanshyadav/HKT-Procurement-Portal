from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from pydantic import BaseModel as PydanticBaseModel
from pydantic import Field
from sqlalchemy import and_, func, or_, select
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
    description: str | None = Field(default=None, max_length=500)
    category_id: UUID
    uom_id: UUID
    standard_price: Decimal = Field(default=Decimal("0.0"), ge=0)
    currency: str = Field(default="INR", max_length=3)
    hsn_code: str | None = Field(default=None, max_length=20)
    image_url: str | None = Field(default=None, max_length=500)
    is_punchout: bool = False
    punchout_vendor_id: UUID | None = None


class ItemUpdateRequest(PydanticBaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    category_id: UUID | None = None
    uom_id: UUID | None = None
    standard_price: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, max_length=3)
    hsn_code: str | None = Field(default=None, max_length=20)
    image_url: str | None = Field(default=None, max_length=500)
    is_punchout: bool | None = None
    punchout_vendor_id: UUID | None = None
    is_active: bool | None = None


class ItemResponse(PydanticBaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    org_id: UUID
    code: str
    name: str
    description: str | None = None
    category_id: UUID
    uom_id: UUID
    standard_price: Decimal
    currency: str
    hsn_code: str | None = None
    image_url: str | None = None
    is_punchout: bool
    punchout_vendor_id: UUID | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PunchOutSessionResponse(PydanticBaseModel):
    session_id: str
    vendor_id: str | None = None
    punchout_url: str
    return_url: str
    status: str


class PunchOutCartItem(PydanticBaseModel):
    item_code: str
    item_description: str
    category_id: str | None = None
    uom_id: str | None = None
    quantity: int = 1
    unit_price: Decimal
    currency: str = "INR"
    hsn_code: str | None = None


class ItemService:
    def __init__(self) -> None:
        self.repo = BaseRepository[ItemMaster](ItemMaster)

    async def list_items(
        self,
        db: AsyncSession,
        org_id: UUID,
        search: str | None = None,
        category_id: UUID | None = None,
        active_only: bool = True,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[ItemMaster], int]:
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
        except NotFoundError as exc:
            raise NotFoundError("Item not found", {"item_id": str(item_id)}) from exc


    async def get_by_code(self, db: AsyncSession, code: str, org_id: UUID) -> ItemMaster | None:
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
        item.updated_at = datetime.now(UTC)
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
        item.deleted_at = datetime.now(UTC)
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
