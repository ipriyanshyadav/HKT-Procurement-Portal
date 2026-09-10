from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.organization.models import (
    BusinessUnit,
    CostCenter,
    Department,
    LegalEntity,
    Organization,
    Plant,
)
from app.modules.organization.repository import (
    BusinessUnitRepository,
    CostCenterRepository,
    DepartmentRepository,
    LegalEntityRepository,
    OrganizationRepository,
    PlantRepository,
    business_unit_repository,
    cost_center_repository,
    department_repository,
    legal_entity_repository,
    organization_repository,
    plant_repository,
)
from app.modules.organization.schemas import (
    BusinessUnitCreateRequest,
    BusinessUnitUpdateRequest,
    CostCenterCreateRequest,
    CostCenterUpdateRequest,
    DepartmentCreateRequest,
    DepartmentUpdateRequest,
    LegalEntityCreateRequest,
    LegalEntityUpdateRequest,
    OrganizationUpdateRequest,
    PlantCreateRequest,
    PlantUpdateRequest,
)


class OrganizationService:
    def __init__(
        self,
        org_repo: OrganizationRepository = organization_repository,
        le_repo: LegalEntityRepository = legal_entity_repository,
        bu_repo: BusinessUnitRepository = business_unit_repository,
        plant_repo: PlantRepository = plant_repository,
        dept_repo: DepartmentRepository = department_repository,
        cc_repo: CostCenterRepository = cost_center_repository,
    ) -> None:
        self.org_repo = org_repo
        self.le_repo = le_repo
        self.bu_repo = bu_repo
        self.plant_repo = plant_repo
        self.dept_repo = dept_repo
        self.cc_repo = cc_repo

    # ========================================================================
    # Organization
    # ========================================================================

    async def get_organization(self, db: AsyncSession, org_id: UUID) -> Organization:
        org = await self.org_repo.get(db, org_id)
        if not org:
            raise NotFoundError("organizations", str(org_id))
        return org

    async def update_organization(
        self, db: AsyncSession, org_id: UUID, payload: OrganizationUpdateRequest
    ) -> Organization:
        org = await self.get_organization(db, org_id)
        update_data = payload.model_dump(exclude_unset=True)
        for key, val in update_data.items():
            setattr(org, key, val)
        org.version += 1
        await db.commit()
        await db.refresh(org)
        return org

    # ========================================================================
    # Legal Entities
    # ========================================================================

    async def list_legal_entities(self, db: AsyncSession, org_id: UUID) -> List[LegalEntity]:
        return await self.le_repo.list_by_org(db, org_id)

    async def get_legal_entity(self, db: AsyncSession, id: UUID, org_id: UUID) -> LegalEntity:
        return await self.le_repo.get(db, id, org_id)

    async def create_legal_entity(
        self, db: AsyncSession, org_id: UUID, payload: LegalEntityCreateRequest
    ) -> LegalEntity:
        existing = await self.le_repo.get_by_reg_number(db, org_id, payload.registration_number)
        if existing:
            raise ConflictError(
                f"Legal entity with registration number '{payload.registration_number}' already exists"
            )

        entity = LegalEntity(
            org_id=org_id,
            **payload.model_dump(),
        )
        db.add(entity)
        await db.commit()
        await db.refresh(entity)
        return entity

    async def update_legal_entity(
        self, db: AsyncSession, id: UUID, org_id: UUID, payload: LegalEntityUpdateRequest
    ) -> LegalEntity:
        entity = await self.get_legal_entity(db, id, org_id)
        update_data = payload.model_dump(exclude_unset=True)

        if "registration_number" in update_data and update_data["registration_number"] != entity.registration_number:
            existing = await self.le_repo.get_by_reg_number(db, org_id, update_data["registration_number"])
            if existing and existing.id != entity.id:
                raise ConflictError(
                    f"Legal entity with registration number '{update_data['registration_number']}' already exists"
                )

        for key, val in update_data.items():
            setattr(entity, key, val)

        await self.le_repo.increment_version(db, entity)
        await db.commit()
        await db.refresh(entity)
        return entity

    async def delete_legal_entity(self, db: AsyncSession, id: UUID, org_id: UUID) -> None:
        await self.get_legal_entity(db, id, org_id)
        # Check if active business units depend on this legal entity
        bus = await self.bu_repo.list_by_org(db, org_id, active_only=True, legal_entity_id=id)
        if bus:
            raise ValidationError(
                f"Cannot delete legal entity: {len(bus)} active business unit(s) are associated with it"
            )
        await self.le_repo.soft_delete(db, id, org_id)
        await db.commit()

    # ========================================================================
    # Business Units
    # ========================================================================

    async def list_business_units(
        self,
        db: AsyncSession,
        org_id: UUID,
        active_only: bool = True,
        legal_entity_id: Optional[UUID] = None,
    ) -> List[BusinessUnit]:
        if legal_entity_id is not None:
            return await self.bu_repo.list_by_org(
                db, org_id, active_only=active_only, legal_entity_id=legal_entity_id
            )
        return await self.bu_repo.list_by_org(db, org_id, active_only=active_only)

    async def get_business_unit(self, db: AsyncSession, id: UUID, org_id: UUID) -> BusinessUnit:
        return await self.bu_repo.get(db, id, org_id)

    async def create_business_unit(
        self, db: AsyncSession, org_id: UUID, payload: BusinessUnitCreateRequest
    ) -> BusinessUnit:
        existing = await self.bu_repo.get_by_code(db, org_id, payload.code)
        if existing:
            raise ConflictError(f"Business unit with code '{payload.code}' already exists")

        # Verify legal entity belongs to org
        await self.get_legal_entity(db, payload.legal_entity_id, org_id)

        bu = BusinessUnit(
            org_id=org_id,
            **payload.model_dump(),
        )
        db.add(bu)
        await db.commit()
        await db.refresh(bu)
        return bu

    async def update_business_unit(
        self, db: AsyncSession, id: UUID, org_id: UUID, payload: BusinessUnitUpdateRequest
    ) -> BusinessUnit:
        bu = await self.get_business_unit(db, id, org_id)
        update_data = payload.model_dump(exclude_unset=True)

        if "legal_entity_id" in update_data and update_data["legal_entity_id"]:
            await self.get_legal_entity(db, update_data["legal_entity_id"], org_id)

        for key, val in update_data.items():
            setattr(bu, key, val)

        await self.bu_repo.increment_version(db, bu)
        await db.commit()
        await db.refresh(bu)
        return bu

    async def delete_business_unit(self, db: AsyncSession, id: UUID, org_id: UUID) -> None:
        await self.get_business_unit(db, id, org_id)
        # Check dependent plants or cost centers
        plants = await self.plant_repo.list_by_org(db, org_id, business_unit_id=id, active_only=True)
        if plants:
            raise ValidationError(
                f"Cannot delete business unit: {len(plants)} active plant(s) are associated with it"
            )
        ccs = await self.cc_repo.list_by_org(db, org_id, business_unit_id=id, active_only=True)
        if ccs:
            raise ValidationError(
                f"Cannot delete business unit: {len(ccs)} active cost center(s) are associated with it"
            )
        await self.bu_repo.soft_delete(db, id, org_id)
        await db.commit()

    # ========================================================================
    # Plants
    # ========================================================================

    async def list_plants(
        self,
        db: AsyncSession,
        org_id: UUID,
        business_unit_id: Optional[UUID] = None,
        active_only: bool = True,
    ) -> List[Plant]:
        return await self.plant_repo.list_by_org(
            db, org_id, business_unit_id=business_unit_id, active_only=active_only
        )

    async def get_plant(self, db: AsyncSession, id: UUID, org_id: UUID) -> Plant:
        return await self.plant_repo.get(db, id, org_id)

    async def create_plant(
        self, db: AsyncSession, org_id: UUID, payload: PlantCreateRequest
    ) -> Plant:
        existing = await self.plant_repo.get_by_code(db, org_id, payload.code)
        if existing:
            raise ConflictError(f"Plant with code '{payload.code}' already exists")

        # Verify business unit belongs to org
        await self.get_business_unit(db, payload.business_unit_id, org_id)

        plant = Plant(
            org_id=org_id,
            **payload.model_dump(),
        )
        db.add(plant)
        await db.commit()
        await db.refresh(plant)
        return plant

    async def update_plant(
        self, db: AsyncSession, id: UUID, org_id: UUID, payload: PlantUpdateRequest
    ) -> Plant:
        plant = await self.get_plant(db, id, org_id)
        update_data = payload.model_dump(exclude_unset=True)

        if "business_unit_id" in update_data and update_data["business_unit_id"]:
            await self.get_business_unit(db, update_data["business_unit_id"], org_id)

        for key, val in update_data.items():
            setattr(plant, key, val)

        await self.plant_repo.increment_version(db, plant)
        await db.commit()
        await db.refresh(plant)
        return plant

    async def delete_plant(self, db: AsyncSession, id: UUID, org_id: UUID) -> None:
        await self.get_plant(db, id, org_id)
        await self.plant_repo.soft_delete(db, id, org_id)
        await db.commit()

    # ========================================================================
    # Departments
    # ========================================================================

    async def list_departments(
        self,
        db: AsyncSession,
        org_id: UUID,
        business_unit_id: Optional[UUID] = None,
        active_only: bool = True,
    ) -> List[Department]:
        return await self.dept_repo.list_by_org(
            db, org_id, business_unit_id=business_unit_id, active_only=active_only
        )

    async def get_department(self, db: AsyncSession, id: UUID, org_id: UUID) -> Department:
        return await self.dept_repo.get(db, id, org_id)

    async def create_department(
        self, db: AsyncSession, org_id: UUID, payload: DepartmentCreateRequest
    ) -> Department:
        existing = await self.dept_repo.get_by_code(db, org_id, payload.code)
        if existing:
            raise ConflictError(f"Department with code '{payload.code}' already exists")

        # Verify business unit belongs to org
        await self.get_business_unit(db, payload.business_unit_id, org_id)

        dept = Department(
            org_id=org_id,
            **payload.model_dump(),
        )
        db.add(dept)
        await db.commit()
        await db.refresh(dept)
        return dept

    async def update_department(
        self, db: AsyncSession, id: UUID, org_id: UUID, payload: DepartmentUpdateRequest
    ) -> Department:
        dept = await self.get_department(db, id, org_id)
        update_data = payload.model_dump(exclude_unset=True)

        if "business_unit_id" in update_data and update_data["business_unit_id"]:
            await self.get_business_unit(db, update_data["business_unit_id"], org_id)

        for key, val in update_data.items():
            setattr(dept, key, val)

        await self.dept_repo.increment_version(db, dept)
        await db.commit()
        await db.refresh(dept)
        return dept

    async def delete_department(self, db: AsyncSession, id: UUID, org_id: UUID) -> None:
        await self.get_department(db, id, org_id)
        await self.dept_repo.soft_delete(db, id, org_id)
        await db.commit()

    # ========================================================================
    # Cost Centers
    # ========================================================================

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

    async def get_cost_center(self, db: AsyncSession, id: UUID, org_id: UUID) -> CostCenter:
        return await self.cc_repo.get(db, id, org_id)

    async def create_cost_center(
        self, db: AsyncSession, org_id: UUID, payload: CostCenterCreateRequest
    ) -> CostCenter:
        existing = await self.cc_repo.get_by_code(db, org_id, payload.code)
        if existing:
            raise ConflictError(f"Cost center with code '{payload.code}' already exists")

        # Verify business unit belongs to org
        await self.get_business_unit(db, payload.business_unit_id, org_id)

        cc = CostCenter(
            org_id=org_id,
            **payload.model_dump(),
        )
        db.add(cc)
        await db.commit()
        await db.refresh(cc)
        return cc

    async def update_cost_center(
        self, db: AsyncSession, id: UUID, org_id: UUID, payload: CostCenterUpdateRequest
    ) -> CostCenter:
        cc = await self.get_cost_center(db, id, org_id)
        update_data = payload.model_dump(exclude_unset=True)

        if "business_unit_id" in update_data and update_data["business_unit_id"]:
            await self.get_business_unit(db, update_data["business_unit_id"], org_id)

        for key, val in update_data.items():
            setattr(cc, key, val)

        await self.cc_repo.increment_version(db, cc)
        await db.commit()
        await db.refresh(cc)
        return cc

    async def delete_cost_center(self, db: AsyncSession, id: UUID, org_id: UUID) -> None:
        await self.get_cost_center(db, id, org_id)
        await self.cc_repo.soft_delete(db, id, org_id)
        await db.commit()


organization_service = OrganizationService()

