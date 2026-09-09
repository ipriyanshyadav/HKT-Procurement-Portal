from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.core.responses import success_response
from app.db.session import get_db
from app.modules.einvoicing.repository import e_invoice_repository, e_way_bill_repository
from app.modules.einvoicing.schemas import (
    CancelEInvoiceRequest,
    GenerateEInvoiceRequest,
    GenerateEWayBillRequest,
)
from app.modules.einvoicing.service import einvoicing_service
from app.modules.user.models import User

router = APIRouter(tags=["E-Invoicing & E-Way Bill"])


@router.get("/health")
async def health():
    return {"status": "ok", "module": "einvoicing"}


@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_e_invoice(
    payload: GenerateEInvoiceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await einvoicing_service.generate_e_invoice(db, current_user.org_id, payload)
    return success_response(data=result)


@router.get("/list")
async def list_e_invoices(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    records = await e_invoice_repository.list_by_org(db, current_user.org_id)
    return success_response(data=records)


@router.get("/irn/{irn}")
async def get_e_invoice_by_irn(
    irn: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = await e_invoice_repository.get_by_irn(db, irn)
    if not record or record.org_id != current_user.org_id:
        raise NotFoundError("EInvoice", irn)
    return success_response(data=record)


@router.post("/cancel")
async def cancel_e_invoice(
    payload: CancelEInvoiceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await einvoicing_service.cancel_e_invoice(db, current_user.org_id, payload)
    return success_response(data=result)


@router.post("/eway-bill", status_code=status.HTTP_201_CREATED)
async def generate_e_way_bill(
    payload: GenerateEWayBillRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await einvoicing_service.generate_e_way_bill(db, current_user.org_id, payload)
    return success_response(data=result)


@router.get("/eway-bill/list")
async def list_e_way_bills(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    records = await e_way_bill_repository.list_by_org(db, current_user.org_id)
    return success_response(data=records)


@router.post("/asn/{asn_id}/dispatch-compliance")
async def generate_dispatch_compliance_pack(
    asn_id: UUID,
    vehicle_number: str = Query(..., description="Transport vehicle registration number"),
    distance_km: float = Query(..., ge=1.0, description="Transit distance in KM"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await einvoicing_service.generate_compliance_pack_for_asn(
        db,
        org_id=current_user.org_id,
        asn_id=asn_id,
        vehicle_number=vehicle_number,
        distance_km=distance_km,
    )
    return success_response(data=result)
