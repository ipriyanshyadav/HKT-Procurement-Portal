from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repository_base import BaseRepository
from app.modules.organization.models import (
    BusinessUnit,
    CostCenter,
    Department,
    LegalEntity,
    Organization,
    Plant,
)


class LegalEntityRepository(BaseRepository[LegalEntity]):
    def __init__(self) -> None:
        super().__init__(LegalEntity)

    async def list_by_org(
        self,
        db: AsyncSession,
        org_id: UUID,
    ) -> List[LegalEntity]:
        stmt = (
            select(LegalEntity)
            .where(
                LegalEntity.org_id == org_id,
                LegalEntity.deleted_at.is_(None),
            )
            .order_by(LegalEntity.name.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_reg_number(
        self,
        db: AsyncSession,
        org_id: UUID,
        registration_number: str,
    ) -> Optional[LegalEntity]:
        stmt = select(LegalEntity).where(
            LegalEntity.org_id == org_id,
            LegalEntity.registration_number == registration_number,
            LegalEntity.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


class BusinessUnitRepository(BaseRepository[BusinessUnit]):
    def __init__(self) -> None:
        super().__init__(BusinessUnit)

    async def list_by_org(
        self,
        db: AsyncSession,
        org_id: UUID,
        active_only: bool = True,
        legal_entity_id: Optional[UUID] = None,
    ) -> List[BusinessUnit]:
        stmt = (
            select(BusinessUnit)
            .where(
                BusinessUnit.org_id == org_id,
                BusinessUnit.deleted_at.is_(None),
            )
        )
        if legal_entity_id is not None:
            stmt = stmt.where(BusinessUnit.legal_entity_id == legal_entity_id)
        if active_only:
            stmt = stmt.where(BusinessUnit.is_active.is_(True))
        stmt = stmt.order_by(BusinessUnit.name.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_code(
        self,
        db: AsyncSession,
        org_id: UUID,
        code: str,
    ) -> Optional[BusinessUnit]:
        stmt = select(BusinessUnit).where(
            BusinessUnit.org_id == org_id,
            BusinessUnit.code == code,
            BusinessUnit.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


class PlantRepository(BaseRepository[Plant]):
    def __init__(self) -> None:
        super().__init__(Plant)

    async def list_by_org(
        self,
        db: AsyncSession,
        org_id: UUID,
        business_unit_id: Optional[UUID] = None,
        active_only: bool = True,
    ) -> List[Plant]:
        stmt = (
            select(Plant)
            .where(
                Plant.org_id == org_id,
                Plant.deleted_at.is_(None),
            )
        )
        if business_unit_id is not None:
            stmt = stmt.where(Plant.business_unit_id == business_unit_id)
        if active_only:
            stmt = stmt.where(Plant.is_active.is_(True))
        stmt = stmt.order_by(Plant.name.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_code(
        self,
        db: AsyncSession,
        org_id: UUID,
        code: str,
    ) -> Optional[Plant]:
        stmt = select(Plant).where(
            Plant.org_id == org_id,
            Plant.code == code,
            Plant.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


class DepartmentRepository(BaseRepository[Department]):
    def __init__(self) -> None:
        super().__init__(Department)

    async def list_by_org(
        self,
        db: AsyncSession,
        org_id: UUID,
        business_unit_id: Optional[UUID] = None,
        active_only: bool = True,
    ) -> List[Department]:
        stmt = (
            select(Department)
            .where(
                Department.org_id == org_id,
                Department.deleted_at.is_(None),
            )
        )
        if business_unit_id is not None:
            stmt = stmt.where(Department.business_unit_id == business_unit_id)
        if active_only:
            stmt = stmt.where(Department.is_active.is_(True))
        stmt = stmt.order_by(Department.name.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_code(
        self,
        db: AsyncSession,
        org_id: UUID,
        code: str,
    ) -> Optional[Department]:
        stmt = select(Department).where(
            Department.org_id == org_id,
            Department.code == code,
            Department.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


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

    async def get_by_code(
        self,
        db: AsyncSession,
        org_id: UUID,
        code: str,
    ) -> Optional[CostCenter]:
        stmt = select(CostCenter).where(
            CostCenter.org_id == org_id,
            CostCenter.code == code,
            CostCenter.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


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


legal_entity_repository = LegalEntityRepository()
business_unit_repository = BusinessUnitRepository()
plant_repository = PlantRepository()
department_repository = DepartmentRepository()
cost_center_repository = CostCenterRepository()
organization_repository = OrganizationRepository()

