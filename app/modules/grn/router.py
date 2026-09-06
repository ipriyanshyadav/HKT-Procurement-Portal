"""
Goods Receipt Note (GRN) & Quality Inspection API Router (SPEC_14 / SPEC_17).

Provides endpoints for:
- Creating GRN against Purchase Orders
- Listing and filtering GRNs
- Detailed GRN view with lines and inspections
- Recording quality inspection results (pass/reject/partial)
- Confirming GRN (updating PO receipt, invoice eligibility, and vendor scorecards)
- Cancelling GRN
"""
from __future__ import annotations

import math
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_any_permission, require_permission
from app.core.constants import PermissionCode
from app.core.responses import APIResponse, PaginationMeta, created_response, success_response
from app.db.session import get_db
from app.modules.grn.schemas import (
    GrnCreateRequest,
    GrnFilterParams,
    GrnLineResponse,
    GrnResponse,
    QualityInspectionCreate,
    QualityInspectionResponse,
)
from app.modules.grn.service import grn_service
from app.modules.grn.models import GoodsReceiptNote
from app.modules.user.models import User

router = APIRouter(tags=["GRN"])


def _to_grn_response(grn: GoodsReceiptNote) -> GrnResponse:
    lines_resp = []
    lines_list = grn.__dict__.get("lines", []) or []
    for line in lines_list:
        inspections_list = line.__dict__.get("inspections", []) or []
        inspections_resp = [
            QualityInspectionResponse(
                id=insp.id,
                grn_line_id=insp.grn_line_id,
                inspector_id=insp.inspector_id,
                inspection_date=insp.inspection_date,
                result=insp.result,
                accepted_quantity=insp.accepted_quantity,
                rejected_quantity=insp.rejected_quantity,
                remarks=insp.remarks,
                created_at=insp.created_at,
            )
            for insp in inspections_list
        ]

        lines_resp.append(
            GrnLineResponse(
                id=line.id,
                grn_id=line.grn_id,
                po_line_id=line.po_line_id,
                received_quantity=line.received_quantity,
                accepted_quantity=line.accepted_quantity,
                rejected_quantity=line.rejected_quantity,
                rejection_reason=line.rejection_reason,
                qc_required=line.qc_required,
                qc_status=line.qc_status,
                inspections=inspections_resp,
            )
        )

    return GrnResponse(
        id=grn.id,
        org_id=grn.org_id,
        grn_number=grn.grn_number,
        po_id=grn.po_id,
        vendor_id=grn.vendor_id,
        receipt_date=grn.receipt_date,
        received_by=grn.received_by,
        challan_number=grn.challan_number,
        challan_date=grn.challan_date,
        transporter_name=grn.transporter_name,
        lr_number=grn.lr_number,
        status=grn.status,
        erp_grn_number=grn.erp_grn_number,
        notes=grn.notes,
        grn_document_path=grn.grn_document_path,
        confirmed_at=grn.confirmed_at,
        confirmed_by=grn.confirmed_by,
        created_at=grn.created_at,
        updated_at=grn.updated_at,
        lines=lines_resp,
    )


@router.get("/health")
async def health():
    return {"status": "ok", "module": "grn"}


@router.get("", response_model=APIResponse[List[GrnResponse]])
async def list_grns(
    po_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.GRN_VIEW_OWN, PermissionCode.GRN_VIEW_ALL])),
):
    filters = GrnFilterParams(
        po_id=po_id,
        status=status,
        page=page,
        page_size=page_size,
    )
    grns, total = await grn_service.list(db, current_user.org_id, filters)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    data = [_to_grn_response(g) for g in grns]
    meta = PaginationMeta(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
    return success_response(data=data, meta=meta)


@router.post("", response_model=APIResponse[GrnResponse], status_code=status.HTTP_201_CREATED)
async def create_grn(
    request: GrnCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.GRN_CREATE)),
):
    org_id = current_user.org_id
    user_id = current_user.id
    grn = await grn_service.create_grn(db, request, user_id, org_id)
    await db.commit()
    updated = await grn_service.get(db, grn.id, org_id)
    return created_response(data=_to_grn_response(updated))


@router.get("/{grn_id}", response_model=APIResponse[GrnResponse])
async def get_grn(
    grn_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.GRN_VIEW_OWN, PermissionCode.GRN_VIEW_ALL])),
):
    grn = await grn_service.get(db, grn_id, current_user.org_id)
    return success_response(data=_to_grn_response(grn))


@router.post("/inspections", response_model=APIResponse[QualityInspectionResponse], status_code=status.HTTP_201_CREATED)
async def record_quality_inspection(
    request: QualityInspectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.GRN_APPROVE)),
):
    org_id = current_user.org_id
    user_id = current_user.id
    qi = await grn_service.quality_inspection(db, request, user_id, org_id)
    await db.commit()
    resp = QualityInspectionResponse(
        id=qi.id,
        grn_line_id=qi.grn_line_id,
        inspector_id=qi.inspector_id,
        inspection_date=qi.inspection_date,
        result=qi.result,
        accepted_quantity=qi.accepted_quantity,
        rejected_quantity=qi.rejected_quantity,
        remarks=qi.remarks,
        created_at=qi.created_at,
    )
    return created_response(data=resp)


@router.post("/{grn_id}/confirm", response_model=APIResponse[GrnResponse])
async def confirm_grn(
    grn_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.GRN_APPROVE)),
):
    org_id = current_user.org_id
    user_id = current_user.id
    await grn_service.confirm_grn(db, grn_id, user_id, org_id)
    await db.commit()
    updated = await grn_service.get(db, grn_id, org_id)
    return success_response(data=_to_grn_response(updated))


@router.post("/{grn_id}/cancel", response_model=APIResponse[GrnResponse])
async def cancel_grn(
    grn_id: UUID,
    reason: str = Query(..., min_length=3),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.GRN_REJECT)),
):
    org_id = current_user.org_id
    user_id = current_user.id
    await grn_service.cancel_grn(db, grn_id, reason, user_id, org_id)
    await db.commit()
    updated = await grn_service.get(db, grn_id, org_id)
    return success_response(data=_to_grn_response(updated))
