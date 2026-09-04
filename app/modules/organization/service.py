from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.organization.models import BusinessUnit, CostCenter
from app.modules.organization.repository import (
    BusinessUnitRepository,
    CostCenterRepository,
    business_unit_repository,
    cost_center_repository,
)


class OrganizationService:
    def __init__(
        self,
        bu_repo: BusinessUnitRepository = business_unit_repository,
        cc_repo: CostCenterRepository = cost_center_repository,
    ) -> None:
        self.bu_repo = bu_repo
        self.cc_repo = cc_repo

    async def list_business_units(
        self,
        db: AsyncSession,
        org_id: UUID,
        active_only: bool = True,
    ) -> List[BusinessUnit]:
        return await self.bu_repo.list_by_org(db, org_id, active_only=active_only)

    async def list_cost_centers(
        self,
        db: AsyncSession,
        org_id: UUID,
        business_unit_id: Optional[UUID] = None,
        active_only: bool = True,
    ) -> List[CostCenter]:
        return await self.cc_repo.list_by_org(
            db, org_id, business_unit_id=business_unit_id, active_only=active_only
        )


organization_service = OrganizationService()
