from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import APIResponse, PaginationMeta, created_response, success_response
from app.db.session import get_db
from app.modules.organization.schemas import (
    BusinessUnitCreateRequest,
    BusinessUnitResponse,
    BusinessUnitUpdateRequest,
    CostCenterCreateRequest,
    CostCenterResponse,
    CostCenterUpdateRequest,
    DepartmentCreateRequest,
    DepartmentResponse,
    DepartmentUpdateRequest,
    LegalEntityCreateRequest,
    LegalEntityResponse,
    LegalEntityUpdateRequest,
    OrganizationResponse,
    OrganizationUpdateRequest,
    PlantCreateRequest,
    PlantResponse,
    PlantUpdateRequest,
)
from app.modules.organization.service import organization_service
from app.modules.user.models import User

router = APIRouter(tags=["Organization"])


@router.get("/health")
@router.get("/organizations/health")
async def health():
    return {"status": "ok", "module": "organization"}


# ============================================================================
# Organization Profile
# ============================================================================

@router.get("/organization", response_model=APIResponse[OrganizationResponse])
@router.get("/organizations/current", response_model=APIResponse[OrganizationResponse])
@router.get("/organizations/me", response_model=APIResponse[OrganizationResponse])
async def get_current_organization(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve profile and settings of the current user's organization."""
    org = await organization_service.get_organization(db, current_user.org_id)
    return success_response(OrganizationResponse.model_validate(org))


@router.patch("/organization", response_model=APIResponse[OrganizationResponse])
@router.patch("/organizations/current", response_model=APIResponse[OrganizationResponse])
@router.patch("/organizations/me", response_model=APIResponse[OrganizationResponse])
async def update_current_organization(
    payload: OrganizationUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update profile and settings of the current user's organization."""
    org = await organization_service.update_organization(db, current_user.org_id, payload)
    return success_response(OrganizationResponse.model_validate(org))


# ============================================================================
# Legal Entities
# ============================================================================

@router.get("/legal-entities", response_model=APIResponse[List[LegalEntityResponse]])
@router.get("/organizations/legal-entities", response_model=APIResponse[List[LegalEntityResponse]])
async def list_legal_entities(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List legal entities for current organization."""
    entities = await organization_service.list_legal_entities(db, current_user.org_id)
    data = [LegalEntityResponse.model_validate(e) for e in entities]
    meta = PaginationMeta(total=len(data), page=1, page_size=len(data) or 20)
    return success_response(data, meta=meta)


@router.post(
    "/legal-entities",
    response_model=APIResponse[LegalEntityResponse],
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/organizations/legal-entities",
    response_model=APIResponse[LegalEntityResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_legal_entity(
    payload: LegalEntityCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new legal entity."""
    entity = await organization_service.create_legal_entity(db, current_user.org_id, payload)
    return created_response(LegalEntityResponse.model_validate(entity))


@router.get("/legal-entities/{id}", response_model=APIResponse[LegalEntityResponse])
async def get_legal_entity(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get legal entity by ID."""
    entity = await organization_service.get_legal_entity(db, id, current_user.org_id)
    return success_response(LegalEntityResponse.model_validate(entity))


@router.put("/legal-entities/{id}", response_model=APIResponse[LegalEntityResponse])
async def update_legal_entity(
    id: UUID,
    payload: LegalEntityUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update legal entity details."""
    entity = await organization_service.update_legal_entity(db, id, current_user.org_id, payload)
    return success_response(LegalEntityResponse.model_validate(entity))


@router.delete("/legal-entities/{id}", response_model=APIResponse[dict])
async def delete_legal_entity(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a legal entity."""
    await organization_service.delete_legal_entity(db, id, current_user.org_id)
    return success_response({"deleted": True, "id": str(id)})


# ============================================================================
# Business Units
# ============================================================================

@router.get("/business-units", response_model=APIResponse[List[BusinessUnitResponse]])
@router.get("/organizations/business-units", response_model=APIResponse[List[BusinessUnitResponse]])
async def list_business_units(
    active_only: bool = Query(default=True),
    legal_entity_id: Optional[UUID] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List business units for the current user's organization."""
    if legal_entity_id is not None:
        bus = await organization_service.list_business_units(
            db, current_user.org_id, active_only=active_only, legal_entity_id=legal_entity_id
        )
    else:
        bus = await organization_service.list_business_units(
            db, current_user.org_id, active_only=active_only
        )
    data = [BusinessUnitResponse.model_validate(b) for b in bus]
    meta = PaginationMeta(total=len(data), page=1, page_size=len(data) or 20)
    return success_response(data, meta=meta)


@router.post(
    "/business-units",
    response_model=APIResponse[BusinessUnitResponse],
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/organizations/business-units",
    response_model=APIResponse[BusinessUnitResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_business_unit(
    payload: BusinessUnitCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new business unit."""
    bu = await organization_service.create_business_unit(db, current_user.org_id, payload)
    return created_response(BusinessUnitResponse.model_validate(bu))


@router.get("/business-units/{id}", response_model=APIResponse[BusinessUnitResponse])
async def get_business_unit(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get business unit by ID."""
    bu = await organization_service.get_business_unit(db, id, current_user.org_id)
    return success_response(BusinessUnitResponse.model_validate(bu))


@router.put("/business-units/{id}", response_model=APIResponse[BusinessUnitResponse])
async def update_business_unit(
    id: UUID,
    payload: BusinessUnitUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update business unit details."""
    bu = await organization_service.update_business_unit(db, id, current_user.org_id, payload)
    return success_response(BusinessUnitResponse.model_validate(bu))


@router.delete("/business-units/{id}", response_model=APIResponse[dict])
async def delete_business_unit(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a business unit."""
    await organization_service.delete_business_unit(db, id, current_user.org_id)
    return success_response({"deleted": True, "id": str(id)})


# ============================================================================
# Plants
# ============================================================================

@router.get("/plants", response_model=APIResponse[List[PlantResponse]])
@router.get("/organizations/plants", response_model=APIResponse[List[PlantResponse]])
async def list_plants(
    business_unit_id: Optional[UUID] = Query(default=None),
    active_only: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List manufacturing plants and facilities."""
    plants = await organization_service.list_plants(
        db, current_user.org_id, business_unit_id=business_unit_id, active_only=active_only
    )
    data = [PlantResponse.model_validate(p) for p in plants]
    meta = PaginationMeta(total=len(data), page=1, page_size=len(data) or 20)
    return success_response(data, meta=meta)


@router.post(
    "/plants",
    response_model=APIResponse[PlantResponse],
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/organizations/plants",
    response_model=APIResponse[PlantResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_plant(
    payload: PlantCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new manufacturing plant or facility."""
    plant = await organization_service.create_plant(db, current_user.org_id, payload)
    return created_response(PlantResponse.model_validate(plant))


@router.get("/plants/{id}", response_model=APIResponse[PlantResponse])
async def get_plant(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get plant by ID."""
    plant = await organization_service.get_plant(db, id, current_user.org_id)
    return success_response(PlantResponse.model_validate(plant))


@router.put("/plants/{id}", response_model=APIResponse[PlantResponse])
async def update_plant(
    id: UUID,
    payload: PlantUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update plant details."""
    plant = await organization_service.update_plant(db, id, current_user.org_id, payload)
    return success_response(PlantResponse.model_validate(plant))


@router.delete("/plants/{id}", response_model=APIResponse[dict])
async def delete_plant(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a plant."""
    await organization_service.delete_plant(db, id, current_user.org_id)
    return success_response({"deleted": True, "id": str(id)})


# ============================================================================
# Departments
# ============================================================================

@router.get("/departments", response_model=APIResponse[List[DepartmentResponse]])
@router.get("/organizations/departments", response_model=APIResponse[List[DepartmentResponse]])
async def list_departments(
    business_unit_id: Optional[UUID] = Query(default=None),
    active_only: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List operational departments."""
    departments = await organization_service.list_departments(
        db, current_user.org_id, business_unit_id=business_unit_id, active_only=active_only
    )
    data = [DepartmentResponse.model_validate(d) for d in departments]
    meta = PaginationMeta(total=len(data), page=1, page_size=len(data) or 20)
    return success_response(data, meta=meta)


@router.post(
    "/departments",
    response_model=APIResponse[DepartmentResponse],
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/organizations/departments",
    response_model=APIResponse[DepartmentResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_department(
    payload: DepartmentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new department."""
    dept = await organization_service.create_department(db, current_user.org_id, payload)
    return created_response(DepartmentResponse.model_validate(dept))


@router.get("/departments/{id}", response_model=APIResponse[DepartmentResponse])
async def get_department(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get department by ID."""
    dept = await organization_service.get_department(db, id, current_user.org_id)
    return success_response(DepartmentResponse.model_validate(dept))


@router.put("/departments/{id}", response_model=APIResponse[DepartmentResponse])
async def update_department(
    id: UUID,
    payload: DepartmentUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update department details."""
    dept = await organization_service.update_department(db, id, current_user.org_id, payload)
    return success_response(DepartmentResponse.model_validate(dept))


@router.delete("/departments/{id}", response_model=APIResponse[dict])
async def delete_department(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a department."""
    await organization_service.delete_department(db, id, current_user.org_id)
    return success_response({"deleted": True, "id": str(id)})


# ============================================================================
# Cost Centers
# ============================================================================

@router.get("/cost-centers", response_model=APIResponse[List[CostCenterResponse]])
@router.get("/organizations/cost-centers", response_model=APIResponse[List[CostCenterResponse]])
async def list_cost_centers(
    business_unit_id: Optional[UUID] = Query(default=None),
    active_only: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List cost centers for the current user's organization, optionally filtered by business unit."""
    ccs = await organization_service.list_cost_centers(
        db, current_user.org_id, business_unit_id=business_unit_id, active_only=active_only
    )
    data = [CostCenterResponse.model_validate(c) for c in ccs]
    meta = PaginationMeta(total=len(data), page=1, page_size=len(data) or 20)
    return success_response(data, meta=meta)


@router.post(
    "/cost-centers",
    response_model=APIResponse[CostCenterResponse],
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/organizations/cost-centers",
    response_model=APIResponse[CostCenterResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_cost_center(
    payload: CostCenterCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new cost center."""
    cc = await organization_service.create_cost_center(db, current_user.org_id, payload)
    return created_response(CostCenterResponse.model_validate(cc))


@router.get("/cost-centers/{id}", response_model=APIResponse[CostCenterResponse])
async def get_cost_center(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get cost center by ID."""
    cc = await organization_service.get_cost_center(db, id, current_user.org_id)
    return success_response(CostCenterResponse.model_validate(cc))


@router.put("/cost-centers/{id}", response_model=APIResponse[CostCenterResponse])
async def update_cost_center(
    id: UUID,
    payload: CostCenterUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update cost center details."""
    cc = await organization_service.update_cost_center(db, id, current_user.org_id, payload)
    return success_response(CostCenterResponse.model_validate(cc))


@router.delete("/cost-centers/{id}", response_model=APIResponse[dict])
async def delete_cost_center(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a cost center."""
    await organization_service.delete_cost_center(db, id, current_user.org_id)
    return success_response({"deleted": True, "id": str(id)})

