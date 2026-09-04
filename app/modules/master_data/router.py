from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_permission
from app.core.constants import PermissionCode
from app.core.responses import created_response, success_response
from app.db.session import get_db
from app.modules.master_data.category.service import (
    CategoryCreateRequest,
    CategoryResponse,
    CategoryUpdateRequest,
    category_service,
)
from app.modules.master_data.currency.service import (
    CurrencyCreateRequest,
    CurrencyResponse,
    CurrencyUpdateRequest,
    currency_service,
)
from app.modules.master_data.holiday.schemas import (
    HolidayCreateRequest,
    HolidayResponse,
)
from app.modules.master_data.holiday.service import holiday_service
from app.modules.master_data.import_service import master_data_import_service
from app.modules.master_data.location.service import (
    LocationCreateRequest,
    LocationResponse,
    LocationUpdateRequest,
    delivery_location_service,
)
from app.modules.master_data.models import Incoterm
from app.modules.master_data.payment_terms.schemas import (
    PaymentTermCreateRequest,
    PaymentTermResponse,
    PaymentTermUpdateRequest,
)
from app.modules.master_data.payment_terms.service import payment_terms_service
from app.modules.master_data.tax.service import (
    TaxCreateRequest,
    TaxResponse,
    TaxUpdateRequest,
    tax_service,
)
from app.modules.master_data.uom.service import (
    UomCreateRequest,
    UomResponse,
    UomUpdateRequest,
    uom_service,
)
from app.modules.user.models import User

router = APIRouter()


class IncotermResponse(BaseModel):
    id: UUID
    org_id: UUID
    code: str
    name: str
    edition_year: int
    risk_transfer_point: str
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# -----------------------------------------------------------------------------
# 1-5: Categories
# -----------------------------------------------------------------------------


@router.get("/categories")
async def list_categories(
    flat: bool = Query(default=True, description="If false, returns nested tree structure"),
    active_only: bool = Query(default=True),
    current_user: User = Depends(require_permission(PermissionCode.MASTER_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """List categories (flat or tree view)."""
    if flat:
        categories = await category_service.list_all(db, current_user.org_id, active_only=active_only)
        return success_response([CategoryResponse.model_validate(c) for c in categories])
    tree = await category_service.get_tree(db, current_user.org_id)
    return success_response(tree)


@router.get("/categories/tree")
async def get_category_tree(
    root_id: Optional[UUID] = Query(default=None, description="Optional root category to scope tree to"),
    current_user: User = Depends(require_permission(PermissionCode.MASTER_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """Get full category hierarchy tree or subtree via recursive CTE."""
    tree = await category_service.get_tree(db, current_user.org_id, root_id=root_id)
    return success_response(tree)


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreateRequest,
    current_user: User = Depends(require_permission(PermissionCode.MASTER_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Create a new category (5-level maximum enforced)."""
    category = await category_service.create(db, data, current_user.id, current_user.org_id)
    return created_response(CategoryResponse.model_validate(category))


@router.put("/categories/{id}")
async def update_category(
    id: UUID,
    data: CategoryUpdateRequest,
    current_user: User = Depends(require_permission(PermissionCode.MASTER_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing category."""
    category = await category_service.update(db, id, data, current_user.id, current_user.org_id)
    return success_response(CategoryResponse.model_validate(category))


@router.delete("/categories/{id}")
async def delete_category(
    id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.MASTER_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a category (fails if active sub-categories exist)."""
    await category_service.soft_delete(db, id, current_user.id, current_user.org_id)
    return success_response({"message": "Category deleted successfully"})


# -----------------------------------------------------------------------------
# 6: UOM
# -----------------------------------------------------------------------------


@router.get("/uom")
async def list_uoms(
    active_only: bool = Query(default=True),
    current_user: User = Depends(require_permission(PermissionCode.MASTER_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """List units of measure."""
    uoms = await uom_service.list_all(db, current_user.org_id, active_only=active_only)
    return success_response([UomResponse.model_validate(u) for u in uoms])


# -----------------------------------------------------------------------------
# 7: Currency
# -----------------------------------------------------------------------------


@router.get("/currencies")
async def list_currencies(
    include_rates: bool = Query(default=False),
    active_only: bool = Query(default=True),
    current_user: User = Depends(require_permission(PermissionCode.MASTER_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """List currencies with optional live Redis-cached exchange rates."""
    currencies = await currency_service.list_all(
        db, current_user.org_id, active_only=active_only, include_rates=include_rates
    )
    return success_response([CurrencyResponse.model_validate(c) for c in currencies])


# -----------------------------------------------------------------------------
# 8: Payment Terms
# -----------------------------------------------------------------------------


@router.get("/payment-terms")
async def list_payment_terms(
    active_only: bool = Query(default=True),
    current_user: User = Depends(require_permission(PermissionCode.MASTER_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """List payment terms."""
    terms = await payment_terms_service.list_all(db, current_user.org_id, active_only=active_only)
    return success_response([PaymentTermResponse.model_validate(t) for t in terms])


# -----------------------------------------------------------------------------
# 9: Incoterms
# -----------------------------------------------------------------------------


@router.get("/incoterms")
async def list_incoterms(
    current_user: User = Depends(require_permission(PermissionCode.MASTER_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """List Incoterms 2020 standard codes."""
    stmt = (
        select(Incoterm)
        .where(
            Incoterm.org_id == current_user.org_id,
            Incoterm.deleted_at.is_(None),
            Incoterm.is_active.is_(True),
        )
        .order_by(Incoterm.code.asc())
    )
    result = await db.execute(stmt)
    incoterms = result.scalars().all()
    return success_response([IncotermResponse.model_validate(i) for i in incoterms])


# -----------------------------------------------------------------------------
# 10: Tax Codes
# -----------------------------------------------------------------------------


@router.get("/tax-codes")
async def list_tax_codes(
    tax_type: Optional[str] = Query(default=None, description="Optional filter by GST/TDS/CESS"),
    active_only: bool = Query(default=True),
    current_user: User = Depends(require_permission(PermissionCode.MASTER_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """List tax codes."""
    tax_codes = await tax_service.list_all(
        db, current_user.org_id, tax_type=tax_type, active_only=active_only
    )
    return success_response([TaxResponse.model_validate(t) for t in tax_codes])


# -----------------------------------------------------------------------------
# 11-12: Delivery Locations
# -----------------------------------------------------------------------------


@router.get("/delivery-locations")
async def list_delivery_locations(
    active_only: bool = Query(default=True),
    country_code: Optional[str] = Query(default=None),
    current_user: User = Depends(require_permission(PermissionCode.MASTER_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """List delivery locations."""
    locations = await delivery_location_service.list_all(
        db, current_user.org_id, active_only=active_only, country_code=country_code
    )
    return success_response([LocationResponse.model_validate(loc) for loc in locations])


@router.post("/delivery-locations", status_code=status.HTTP_201_CREATED)
async def create_delivery_location(
    data: LocationCreateRequest,
    current_user: User = Depends(require_permission(PermissionCode.MASTER_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Create a delivery location."""
    location = await delivery_location_service.create(
        db, data, current_user.id, current_user.org_id
    )
    return created_response(LocationResponse.model_validate(location))


# -----------------------------------------------------------------------------
# 13-14: Holidays
# -----------------------------------------------------------------------------


@router.get("/holidays/{year}")
async def list_holidays_by_year(
    year: int,
    current_user: User = Depends(require_permission(PermissionCode.MASTER_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """List holidays for a specific calendar year."""
    holidays = await holiday_service.list_by_year(db, current_user.org_id, year)
    return success_response([HolidayResponse.model_validate(h) for h in holidays])


@router.post("/holidays", status_code=status.HTTP_201_CREATED)
async def create_holiday(
    data: HolidayCreateRequest,
    current_user: User = Depends(require_permission(PermissionCode.MASTER_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Add a custom holiday."""
    holiday = await holiday_service.create(db, data, current_user.id, current_user.org_id)
    return created_response(HolidayResponse.model_validate(holiday))


# -----------------------------------------------------------------------------
# 15: CSV Import
# -----------------------------------------------------------------------------


@router.post("/import/categories", status_code=status.HTTP_202_ACCEPTED)
async def import_categories(
    file: UploadFile = File(...),
    current_user: User = Depends(require_permission(PermissionCode.MASTER_IMPORT)),
    db: AsyncSession = Depends(get_db),
):
    """Bulk import categories from CSV (async via Celery, max 5000 rows)."""
    file_bytes = await file.read()
    job = await master_data_import_service.import_categories_csv(
        db, file_bytes, current_user.id, current_user.org_id
    )
    return success_response(
        {
            "job_id": str(job.id),
            "status": job.status.value,
            "message": "Category import job queued",
        }
    )


@router.get("/import/categories/{job_id}")
async def get_import_status(
    job_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.MASTER_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """Check the status of a category import job."""
    job = await master_data_import_service.get_import_job(db, job_id, current_user.org_id)
    return success_response(
        {
            "job_id": str(job.id),
            "status": job.status.value,
            "response_payload": job.response_payload,
            "error_message": job.error_message,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        }
    )


# -----------------------------------------------------------------------------
# Health Check
# -----------------------------------------------------------------------------


@router.get("/health")
async def health():
    return {"status": "ok", "module": "master_data"}
