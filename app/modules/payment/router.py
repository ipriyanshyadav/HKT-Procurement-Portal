"""
Payment API Router (SPEC_15).

Provides endpoints for:
- Payment listing and retrieval
- Payment scheduling with TDS calculation
- Payment execution and UTR confirmation
- ERP payment settlement webhooks
- Dispute communication thread and resolution
"""
from __future__ import annotations

import math
from decimal import Decimal
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_any_permission, require_permission
from app.core.constants import PermissionCode
from app.core.exceptions import ValidationError
from app.core.responses import APIResponse, PaginationMeta, created_response, success_response
from app.db.session import get_db
from app.modules.invoice.repository import invoice_repository
from app.modules.payment.schemas import (
    DisputeCreateRequest,
    DisputeMessageCreateRequest,
    DisputeMessageResponse,
    DisputeResolveRequest,
    DisputeResponse,
    ErpPaymentWebhookRequest,
    PaymentFilterParams,
    PaymentProcessRequest,
    PaymentRecordResponse,
    PaymentScheduleRequest,
)
from app.modules.payment.service import payment_service
from app.modules.user.models import User
from app.modules.vendor.repository import vendor_repository

router = APIRouter(tags=["Payment"])


def _to_payment_response(
    p: Any,
    invoice_number: Optional[str] = None,
    vendor_name: Optional[str] = None,
) -> PaymentRecordResponse:
    status_str = p.status.value if hasattr(p.status, "value") else str(p.status)
    return PaymentRecordResponse(
        id=p.id,
        org_id=p.org_id,
        invoice_id=p.invoice_id,
        invoice_number=invoice_number,
        vendor_id=p.vendor_id,
        vendor_name=vendor_name,
        payment_date=p.payment_date,
        amount=p.amount,
        gross_amount=getattr(p, "gross_amount", p.amount),
        tds_amount=getattr(p, "tds_amount", Decimal("0.0")),
        net_amount=getattr(p, "net_amount", p.amount),
        payment_due_date=getattr(p, "payment_due_date", p.payment_date),
        currency=p.currency,
        utr_number=p.utr_number,
        payment_method=p.payment_method,
        erp_payment_reference=p.erp_payment_reference,
        status=status_str,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


def _to_dispute_response(d: Any) -> DisputeResponse:
    messages_resp = [
        DisputeMessageResponse(
            id=m.id,
            org_id=m.org_id,
            dispute_id=m.dispute_id,
            sender_id=m.sender_id,
            message=m.message,
            attachments=m.attachments,
            created_at=m.created_at,
        )
        for m in getattr(d, "messages", [])
    ]
    return DisputeResponse(
        id=d.id,
        org_id=d.org_id,
        invoice_id=d.invoice_id,
        vendor_id=d.vendor_id,
        reason_code=d.reason_code,
        description=d.description,
        status=d.status,
        raised_by=d.raised_by,
        resolved_by=d.resolved_by,
        resolution_notes=d.resolution_notes,
        resolution_action=d.resolution_action,
        credit_note_amount=d.credit_note_amount,
        resolved_at=d.resolved_at,
        created_at=d.created_at,
        updated_at=d.updated_at,
        messages=messages_resp,
    )


@router.get("/health")
async def health():
    return {"status": "ok", "module": "payment"}


@router.get("", response_model=APIResponse[List[PaymentRecordResponse]])
async def list_payments(
    invoice_id: Optional[UUID] = Query(None),
    vendor_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.PAYMENT_VIEW_OWN, PermissionCode.PAYMENT_VIEW_ALL])),
):
    effective_vendor_id = vendor_id
    if current_user.vendor_id:
        effective_vendor_id = current_user.vendor_id

    filters = PaymentFilterParams(
        invoice_id=invoice_id,
        vendor_id=effective_vendor_id,
        status=status,
        page=page,
        page_size=page_size,
    )
    payments, total_count = await payment_service.list_payments(db, current_user.org_id, filters)

    data = []
    for p in payments:
        inv = await invoice_repository.get_with_relations(db, p.invoice_id, current_user.org_id)
        v = await vendor_repository.find_by_id(db, p.vendor_id, current_user.org_id)
        data.append(
            _to_payment_response(
                p,
                invoice_number=inv.invoice_number if inv else None,
                vendor_name=v.company_name if v else None,
            )
        )

    total_pages = math.ceil(total_count / page_size) if page_size else 1
    meta = PaginationMeta(
        total=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
    return success_response(data=data, meta=meta)


@router.post("/schedule", response_model=APIResponse[PaymentRecordResponse], status_code=status.HTTP_201_CREATED)
async def schedule_payment(
    request: PaymentScheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.PAYMENT_INITIATE)),
):
    payment = await payment_service.create_scheduled_payment(
        db, request.invoice_id, current_user.id, current_user.org_id
    )
    inv = await invoice_repository.get_with_relations(db, payment.invoice_id, current_user.org_id)
    v = await vendor_repository.find_by_id(db, payment.vendor_id, current_user.org_id)
    return created_response(
        data=_to_payment_response(
            payment,
            invoice_number=inv.invoice_number if inv else None,
            vendor_name=v.company_name if v else None,
        )
    )


@router.get("/{payment_id}", response_model=APIResponse[PaymentRecordResponse])
async def get_payment(
    payment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.PAYMENT_VIEW_OWN, PermissionCode.PAYMENT_VIEW_ALL])),
):
    payment = await payment_service.get_payment(db, payment_id, current_user.org_id)
    if current_user.vendor_id and payment.vendor_id != current_user.vendor_id:
        raise ValidationError("Access denied to another vendor's payment record")

    inv = await invoice_repository.get_with_relations(db, payment.invoice_id, current_user.org_id)
    v = await vendor_repository.find_by_id(db, payment.vendor_id, current_user.org_id)
    return success_response(
        data=_to_payment_response(
            payment,
            invoice_number=inv.invoice_number if inv else None,
            vendor_name=v.company_name if v else None,
        )
    )


@router.get("/{payment_id}/remittance-pdf")
async def download_remittance_pdf(
    payment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.PAYMENT_VIEW_OWN, PermissionCode.PAYMENT_VIEW_ALL])),
):
    """Download official payment remittance advice as a generated PDF."""
    payment = await payment_service.get_payment(db, payment_id, current_user.org_id)
    if current_user.vendor_id and payment.vendor_id != current_user.vendor_id:
        raise ValidationError("Access denied to another vendor's payment record")

    inv = await invoice_repository.get_with_relations(db, payment.invoice_id, current_user.org_id)
    v = await vendor_repository.find_by_id(db, payment.vendor_id, current_user.org_id)
    pdf_bytes = payment_service.generate_remittance_pdf(payment, inv, v)

    from fastapi import Response
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=remittance_advice_{payment_id}.pdf"
        },
    )



@router.post("/{payment_id}/process", response_model=APIResponse[PaymentRecordResponse])
async def process_payment(
    payment_id: UUID,
    request: PaymentProcessRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.PAYMENT_PROCESS)),
):
    payment = await payment_service.process_payment(
        db, payment_id, request, current_user.id, current_user.org_id
    )
    inv = await invoice_repository.get_with_relations(db, payment.invoice_id, current_user.org_id)
    v = await vendor_repository.find_by_id(db, payment.vendor_id, current_user.org_id)
    return success_response(
        data=_to_payment_response(
            payment,
            invoice_number=inv.invoice_number if inv else None,
            vendor_name=v.company_name if v else None,
        )
    )


@router.post("/webhook")
async def erp_payment_webhook(
    request: ErpPaymentWebhookRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Inbound webhook from external ERP system recording payment settlement.
    """
    result = await payment_service.process_erp_webhook(db, request)
    return success_response(data=result)


# ─────────────────────────────────────────────────────────────────────────────
# Disputes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/disputes/all", response_model=APIResponse[List[DisputeResponse]])
async def list_disputes(
    invoice_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.INVOICE_VIEW_OWN, PermissionCode.INVOICE_VIEW_ALL])),
):
    vendor_id = current_user.vendor_id
    disputes = await payment_service.list_disputes(
        db, current_user.org_id, invoice_id=invoice_id, vendor_id=vendor_id, status=status
    )
    resp_list = [_to_dispute_response(d) for d in disputes]
    return success_response(
        data=resp_list,
        meta=PaginationMeta(total=len(resp_list), page=1, page_size=len(resp_list) or 20),
    )


@router.post("/disputes", response_model=APIResponse[DisputeResponse], status_code=status.HTTP_201_CREATED)
async def create_dispute(
    request: DisputeCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.INVOICE_VIEW_OWN, PermissionCode.INVOICE_VIEW_ALL])),
):
    dispute = await payment_service.create_dispute(
        db,
        invoice_id=request.invoice_id,
        reason_code=request.reason_code,
        description=request.description,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    return created_response(data=_to_dispute_response(dispute))


@router.post("/disputes/{dispute_id}/messages", response_model=APIResponse[DisputeMessageResponse])
async def add_dispute_message(
    dispute_id: UUID,
    request: DisputeMessageCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.INVOICE_VIEW_OWN, PermissionCode.INVOICE_VIEW_ALL])),
):
    msg = await payment_service.add_dispute_message(
        db, dispute_id, request, current_user.id, current_user.org_id
    )
    return success_response(
        data=DisputeMessageResponse(
            id=msg.id,
            org_id=msg.org_id,
            dispute_id=msg.dispute_id,
            sender_id=msg.sender_id,
            sender_name=current_user.full_name or current_user.email,
            message=msg.message,
            attachments=msg.attachments,
            created_at=msg.created_at,
        )
    )


@router.post("/disputes/{dispute_id}/resolve", response_model=APIResponse[DisputeResponse])
async def resolve_dispute(
    dispute_id: UUID,
    request: DisputeResolveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.INVOICE_APPROVE)),
):
    dispute = await payment_service.resolve_dispute(
        db, dispute_id, request, current_user.id, current_user.org_id
    )
    return success_response(data=_to_dispute_response(dispute))
