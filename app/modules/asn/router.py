from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import APIResponse, PaginationMeta, created_response, success_response
from app.db.session import get_db
from app.modules.asn.models import AdvanceShippingNotice
from app.modules.asn.schemas import (
    AsnCreateRequest,
    AsnDispatchPayload,
    AsnFastGrnRequest,
    AsnFilterParams,
    AsnLineResponse,
    AsnResponse,
    AsnScanLookupRequest,
)
from app.modules.asn.service import asn_service
from app.modules.grn.router import _to_grn_response
from app.modules.user.models import User

router = APIRouter(tags=["Advance Shipping Notices"])


def _to_asn_response(asn: AdvanceShippingNotice) -> AsnResponse:
    lines_resp = [
        AsnLineResponse(
            id=line.id,
            asn_id=line.asn_id,
            po_line_id=line.po_line_id,
            item_code=line.item_code,
            item_description=line.item_description,
            uom=line.uom,
            ordered_quantity=line.ordered_quantity,
            shipped_quantity=line.shipped_quantity,
            received_quantity=line.received_quantity,
            lot_number=line.lot_number,
            serial_numbers=line.serial_numbers or [],
            expiry_date=line.expiry_date,
            manufacturing_date=line.manufacturing_date,
        )
        for line in (asn.lines or [])
    ]

    po_num = None
    if getattr(asn, "po", None):
        po_num = getattr(asn.po, "po_number", None)

    vendor_nm = None
    if getattr(asn, "vendor", None):
        vendor_nm = getattr(asn.vendor, "name", None)

    return AsnResponse(
        id=asn.id,
        org_id=asn.org_id,
        asn_number=asn.asn_number,
        po_id=asn.po_id,
        vendor_id=asn.vendor_id,
        shipment_date=asn.shipment_date,
        expected_delivery_date=asn.expected_delivery_date,
        carrier_name=asn.carrier_name,
        tracking_number=asn.tracking_number,
        vehicle_number=asn.vehicle_number,
        driver_name=asn.driver_name,
        driver_phone=asn.driver_phone,
        packaging_type=asn.packaging_type,
        package_count=asn.package_count,
        gross_weight_kg=asn.gross_weight_kg,
        status=asn.status,
        barcode_data=asn.barcode_data,
        notes=asn.notes,
        shipped_at=asn.shipped_at,
        received_at=asn.received_at,
        grn_id=asn.grn_id,
        created_at=asn.created_at,
        updated_at=asn.updated_at,
        lines=lines_resp,
        po_number=po_num,
        vendor_name=vendor_nm,
    )


@router.get("/health")
async def health():
    return {"status": "ok", "module": "asn"}


@router.get("", response_model=APIResponse[list[AsnResponse]])
async def list_asns(
    po_id: UUID | None = Query(None),
    status: str | None = Query(None),
    vendor_id: UUID | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Enforce vendor isolation if supplier user
    effective_vendor_id = current_user.vendor_id if current_user.is_supplier_user else vendor_id

    filters = AsnFilterParams(
        po_id=po_id,
        vendor_id=effective_vendor_id,
        status=status,
        search=search,
        page=page,
        page_size=page_size,
    )
    asns, total = await asn_service.list(db, current_user.org_id, filters, vendor_id=effective_vendor_id)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return success_response(
        data=[_to_asn_response(a) for a in asns],
        meta=PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        ),
    )


@router.post("", response_model=APIResponse[AsnResponse], status_code=status.HTTP_201_CREATED)
async def create_asn(
    request: AsnCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor_id = current_user.vendor_id if current_user.is_supplier_user else None
    asn = await asn_service.create_asn(
        db,
        request,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        vendor_id=vendor_id,
    )
    await db.commit()
    return created_response(data=_to_asn_response(asn))


@router.post("/scan-lookup", response_model=APIResponse[AsnResponse])
async def scan_lookup(
    request: AsnScanLookupRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asn = await asn_service.scan_lookup(db, request.code, current_user.org_id)
    return success_response(data=_to_asn_response(asn))


@router.get("/{id}", response_model=APIResponse[AsnResponse])
async def get_asn(
    asn_id: UUID = Path(..., alias="id"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asn = await asn_service.get(db, asn_id, current_user.org_id)
    return success_response(data=_to_asn_response(asn))


@router.post("/{id}/dispatch", response_model=APIResponse[AsnResponse])
async def dispatch_asn(
    asn_id: UUID = Path(..., alias="id"),
    payload: AsnDispatchPayload = ...,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asn = await asn_service.dispatch_asn(db, asn_id, payload, current_user.id, current_user.org_id)
    await db.commit()
    return success_response(data=_to_asn_response(asn))


@router.post("/{id}/fast-grn", response_model=APIResponse[dict])
async def fast_grn_intake(
    asn_id: UUID = Path(..., alias="id"),
    payload: AsnFastGrnRequest = ...,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asn, grn = await asn_service.fast_grn_intake(
        db,
        asn_id=asn_id,
        data=payload,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()

    return success_response(
        data={
            "asn": _to_asn_response(asn).model_dump(mode="json"),
            "grn": _to_grn_response(grn).model_dump(mode="json"),
        }
    )
