"""
Purchase Order API Router (SPEC_14).

Provides endpoints for:
- PO creation (direct or from RFQ award recommendation)
- PO detail retrieval and filtered listing
- PO approval and rejection
- PO release to vendor (with ReportLab PDF generation)
- Supplier acknowledgment and rejection
- Formal versioned amendments
- PO closure and cancellation
"""
from __future__ import annotations

import math
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_any_permission, require_permission
from app.core.constants import PermissionCode
from app.core.responses import APIResponse, PaginationMeta, created_response, success_response
from app.db.session import get_db
from app.modules.purchase_order.schemas import (
    POAcknowledgeRequest,
    POAmendRequest,
    POAmendmentResponse,
    POCancelRequest,
    POCreateRequest,
    POFilterParams,
    POFromAwardRequest,
    POLineResponse,
    POResponse,
)
from app.modules.purchase_order.service import purchase_order_service
from app.modules.user.models import User

router = APIRouter(tags=["Purchase Orders"])


def _to_po_response(po: Any) -> POResponse:
    lines_resp = [
        POLineResponse(
            id=line.id,
            org_id=line.org_id,
            po_id=line.po_id,
            line_number=line.line_number,
            item_description=line.item_description,
            item_code=line.item_code,
            uom_id=line.uom_id,
            ordered_quantity=line.ordered_quantity,
            unit_price=line.unit_price,
            total_price=line.total_price or (line.ordered_quantity * line.unit_price),
            awarded_unit_price=line.awarded_unit_price,
            hsn_code=line.hsn_code,
            tax_rate=line.tax_rate,
            open_quantity=line.open_quantity,
            received_quantity=line.received_quantity or 0,
            invoiced_quantity=line.invoiced_quantity or 0,
            delivery_date=line.delivery_date,
            created_at=line.created_at,
        )
        for line in getattr(po, "lines", [])
    ]

    amendments_resp = [
        POAmendmentResponse(
            id=amend.id,
            po_id=amend.po_id,
            amendment_number=amend.amendment_number,
            reason=amend.reason,
            field_changes=amend.field_changes,
            value_change=amend.value_change,
            re_approval_required=amend.re_approval_required,
            amended_by=amend.amended_by,
            approved_by=amend.approved_by,
            approved_at=amend.approved_at,
            created_at=amend.created_at,
        )
        for amend in getattr(po, "amendments", [])
    ]

    status_str = po.status.value if hasattr(po.status, "value") else str(po.status)

    return POResponse(
        id=po.id,
        org_id=po.org_id,
        po_number=po.po_number,
        title=po.title,
        vendor_id=po.vendor_id,
        vendor_name=getattr(po, "vendor_name", None),
        rfq_id=po.rfq_id,
        arn_id=po.arn_id,
        contract_id=po.contract_id,
        status=status_str,
        business_unit_id=po.business_unit_id,
        plant_id=po.plant_id,
        category_id=po.category_id,
        currency=po.currency,
        total_value=po.total_value,
        payment_term_id=po.payment_term_id,
        incoterm_id=po.incoterm_id,
        delivery_location_id=po.delivery_location_id,
        expected_delivery_date=po.expected_delivery_date,
        buyer_id=po.buyer_id,
        erp_po_number=po.erp_po_number,
        erp_sync_status=po.erp_sync_status,
        po_document_path=po.po_document_path,
        sent_at=po.sent_at,
        acknowledged_at=po.acknowledged_at,
        vendor_acknowledged_at=po.vendor_acknowledged_at,
        rejected_reason=po.rejected_reason,
        vendor_rejection_reason=po.vendor_rejection_reason,
        deviation_justification=po.deviation_justification,
        cancellation_reason=po.cancellation_reason,
        amendment_count=po.amendment_count,
        created_at=po.created_at,
        updated_at=po.updated_at,
        lines=lines_resp,
        amendments=amendments_resp,
    )


@router.get("/health")
async def health():
    return {"status": "ok", "module": "purchase_order"}


@router.get("", response_model=APIResponse[List[POResponse]])
async def list_purchase_orders(
    status: Optional[str] = Query(None),
    vendor_id: Optional[UUID] = Query(None),
    business_unit_id: Optional[UUID] = Query(None),
    rfq_id: Optional[UUID] = Query(None),
    contract_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.PO_VIEW_OWN, PermissionCode.PO_VIEW_ALL])),
):
    # If user is a vendor, restrict to their vendor_id
    effective_vendor_id = vendor_id
    if current_user.vendor_id:
        effective_vendor_id = current_user.vendor_id

    filters = POFilterParams(
        status=status,
        vendor_id=effective_vendor_id,
        business_unit_id=business_unit_id,
        rfq_id=rfq_id,
        contract_id=contract_id,
        search=search,
        page=page,
        page_size=page_size,
    )
    pos, total_count = await purchase_order_service.list(db, current_user.org_id, filters)
    data = [_to_po_response(po) for po in pos]

    total_pages = math.ceil(total_count / page_size) if page_size else 1
    meta = PaginationMeta(
        total=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
    return success_response(data=data, meta=meta)


@router.post("", response_model=APIResponse[POResponse], status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    request: POCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.PO_CREATE)),
):
    po = await purchase_order_service.create(db, request, current_user.id, current_user.org_id)
    return created_response(data=_to_po_response(po))


@router.post("/from-award", response_model=APIResponse[List[POResponse]], status_code=status.HTTP_201_CREATED)
async def create_from_award(
    request: POFromAwardRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.PO_CREATE)),
):
    pos = await purchase_order_service.create_from_award(db, request, current_user.id, current_user.org_id)
    return created_response(data=[_to_po_response(p) for p in pos])


@router.get("/{po_id}", response_model=APIResponse[POResponse])
async def get_purchase_order(
    po_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.PO_VIEW_OWN, PermissionCode.PO_VIEW_ALL])),
):
    po = await purchase_order_service.get(db, po_id, current_user.org_id)
    return success_response(data=_to_po_response(po))


@router.post("/{po_id}/approve", response_model=APIResponse[POResponse])
async def approve_purchase_order(
    po_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.PO_APPROVE)),
):
    po = await purchase_order_service.approve(db, po_id, current_user.id, current_user.org_id)
    return success_response(data=_to_po_response(po))


@router.post("/{po_id}/reject", response_model=APIResponse[POResponse])
async def reject_purchase_order(
    po_id: UUID,
    rejection_reason: str = Query(..., min_length=3),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.PO_APPROVE)),
):
    po = await purchase_order_service.reject(db, po_id, rejection_reason, current_user.id, current_user.org_id)
    return success_response(data=_to_po_response(po))


@router.post("/{po_id}/send-to-vendor", response_model=APIResponse[POResponse])
async def send_to_vendor(
    po_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.PO_CREATE)),
):
    po = await purchase_order_service.send_to_vendor(db, po_id, current_user.id, current_user.org_id)
    return success_response(data=_to_po_response(po))


@router.post("/{po_id}/acknowledge", response_model=APIResponse[POResponse])
async def acknowledge_purchase_order(
    po_id: UUID,
    request: POAcknowledgeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.PO_ACKNOWLEDGE)),
):
    po = await purchase_order_service.record_vendor_acknowledgement(
        db,
        po_id,
        accepted=request.accepted,
        rejection_reason=request.rejection_reason,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    return success_response(data=_to_po_response(po))


@router.post("/{po_id}/amend", response_model=APIResponse[POResponse])
async def amend_purchase_order(
    po_id: UUID,
    request: POAmendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.PO_AMEND)),
):
    po = await purchase_order_service.amend_po(
        db, po_id, request, current_user.id, current_user.org_id
    )
    return success_response(data=_to_po_response(po))


@router.post("/{po_id}/close", response_model=APIResponse[POResponse])
async def close_purchase_order(
    po_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.PO_CLOSE)),
):
    po = await purchase_order_service.close_po(db, po_id, current_user.id, current_user.org_id)
    return success_response(data=_to_po_response(po))


@router.post("/{po_id}/cancel", response_model=APIResponse[POResponse])
async def cancel_purchase_order(
    po_id: UUID,
    request: POCancelRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.PO_CANCEL)),
):
    po = await purchase_order_service.cancel_po(
        db, po_id, request.cancellation_reason, current_user.id, current_user.org_id
    )
    return success_response(data=_to_po_response(po))


@router.get("/{po_id}/pdf")
async def download_po_pdf(
    po_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.PO_VIEW_OWN, PermissionCode.PO_VIEW_ALL])),
):
    po = await purchase_order_service.get(db, po_id, current_user.org_id)
    pdf_bytes = purchase_order_service.pdf_generator.build_pdf_bytes(po, lines=po.lines)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{po.po_number}.pdf"'},
    )
