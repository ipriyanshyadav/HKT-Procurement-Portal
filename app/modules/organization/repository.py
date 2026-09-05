from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repository_base import BaseRepository
from app.modules.organization.models import BusinessUnit, CostCenter


class BusinessUnitRepository(BaseRepository[BusinessUnit]):
    def __init__(self) -> None:
        super().__init__(BusinessUnit)

    async def list_by_org(
        self,
        db: AsyncSession,
        org_id: UUID,
        active_only: bool = True,
    ) -> List[BusinessUnit]:
        stmt = (
            select(BusinessUnit)
            .where(
                BusinessUnit.org_id == org_id,
                BusinessUnit.deleted_at.is_(None),
            )
        )
        if active_only:
            stmt = stmt.where(BusinessUnit.is_active.is_(True))
        stmt = stmt.order_by(BusinessUnit.name.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())


class CostCenterRepository(BaseRepository[CostCenter]):
    def __init__(self) -> None:
        super().__init__(CostCenter)

    async def list_by_org(
        self,
        db: AsyncSession,
        org_id: UUID,
        business_unit_id: Optional[UUID] = None,
        active_only: bool = True,
    ) -> List[CostCenter]:
        stmt = (
            select(CostCenter)
            .where(
                CostCenter.org_id == org_id,
                CostCenter.deleted_at.is_(None),
            )
        )
        if business_unit_id is not None:
            stmt = stmt.where(CostCenter.business_unit_id == business_unit_id)
        if active_only:
            stmt = stmt.where(CostCenter.is_active.is_(True))
        stmt = stmt.order_by(CostCenter.name.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())


from app.modules.organization.models import BusinessUnit, CostCenter, Organization


class OrganizationRepository(BaseRepository[Organization]):
    def __init__(self) -> None:
        super().__init__(Organization)

    async def get_all_active(self, db: AsyncSession) -> List[Organization]:
        stmt = select(Organization).where(Organization.deleted_at.is_(None))
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get(self, db: AsyncSession, org_id: UUID) -> Optional[Organization]:
        stmt = select(Organization).where(Organization.id == org_id, Organization.deleted_at.is_(None))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


business_unit_repository = BusinessUnitRepository()
cost_center_repository = CostCenterRepository()
organization_repository = OrganizationRepository()
