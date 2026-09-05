"""
Invoice API Router (SPEC_15).

Provides endpoints for:
- Invoice submission with automatic 3-way match
- Invoice listing with filters and search
- Eligible PO lines for invoicing
- Invoice detail retrieval with match discrepancies
- Manual 3-way match execution
- Invoice approval, rejection, and dispute actions
"""
from __future__ import annotations

import math
from decimal import Decimal
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_any_permission, require_permission
from app.core.constants import PermissionCode
from app.core.exceptions import ValidationError
from app.core.responses import APIResponse, PaginationMeta, created_response, success_response
from app.db.session import get_db
from app.modules.invoice.schemas import (
    EligibleLineResponse,
    InvoiceDisputeRequest,
    InvoiceFilterParams,
    InvoiceLineResponse,
    InvoiceMatchLineResultResponse,
    InvoiceRejectRequest,
    InvoiceResponse,
    InvoiceSubmitRequest,
)
from app.core.streaming import stream_csv, stream_pdf, generate_table_pdf
from app.modules.invoice.service import invoice_service
from app.modules.purchase_order.repository import purchase_order_repository
from app.modules.user.models import User
from app.modules.vendor.repository import vendor_repository

router = APIRouter(tags=["Invoice"])


def _to_invoice_response(inv: Any, vendor_name: Optional[str] = None, po_number: Optional[str] = None) -> InvoiceResponse:
    lines_resp = [
        InvoiceLineResponse(
            id=line.id,
            invoice_id=line.invoice_id,
            po_line_id=line.po_line_id,
            grn_line_id=line.grn_line_id,
            line_number=line.line_number,
            item_description=line.item_description,
            quantity=line.quantity,
            unit_price=line.unit_price,
            tax_rate=line.tax_rate,
            tax_amount=line.tax_amount,
            line_total=line.line_total,
        )
        for line in getattr(inv, "lines", [])
    ]

    matches_resp = [
        InvoiceMatchLineResultResponse(
            id=m.id,
            invoice_line_id=m.invoice_line_id,
            po_line_id=m.po_line_id,
            price_match=m.price_match,
            price_deviation=m.price_deviation,
            quantity_match=m.quantity_match,
            quantity_deviation=m.quantity_deviation,
            po_reference_valid=m.po_reference_valid,
            tax_match=m.tax_match,
            tax_deviation=m.tax_deviation,
            overall_match=m.overall_match,
            mismatch_reasons=m.mismatch_reasons,
            created_at=m.created_at,
        )
        for m in getattr(inv, "match_results", [])
    ]

    status_str = inv.status.value if hasattr(inv.status, "value") else str(inv.status)
    payment_status_str = inv.payment_status.value if hasattr(inv.payment_status, "value") else str(inv.payment_status)

    return InvoiceResponse(
        id=inv.id,
        org_id=inv.org_id,
        invoice_number=inv.invoice_number,
        vendor_invoice_number=inv.vendor_invoice_number,
        vendor_id=inv.vendor_id,
        vendor_name=vendor_name,
        po_id=inv.po_id,
        po_number=po_number,
        status=status_str,
        invoice_date=inv.invoice_date,
        due_date=inv.due_date,
        currency=inv.currency,
        subtotal=inv.subtotal,
        tax_amount=inv.tax_amount,
        total_amount=inv.total_amount,
        tds_amount=getattr(inv, "tds_amount", Decimal("0.0")),
        financial_year=getattr(inv, "financial_year", None),
        payment_terms_code=getattr(inv, "payment_terms_code", None),
        match_status=inv.match_status,
        price_tolerance=inv.price_tolerance,
        erp_invoice_number=inv.erp_invoice_number,
        erp_sync_status=inv.erp_sync_status,
        payment_status=payment_status_str,
        paid_amount=inv.paid_amount,
        notes=getattr(inv, "notes", None),
        created_at=inv.created_at,
        updated_at=inv.updated_at,
        lines=lines_resp,
        match_results=matches_resp,
    )


@router.get("/health")
async def health():
    return {"status": "ok", "module": "invoice"}


@router.get("", response_model=APIResponse[List[InvoiceResponse]])
async def list_invoices(
    po_id: Optional[UUID] = Query(None),
    vendor_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    match_status: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    financial_year: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.INVOICE_VIEW_OWN, PermissionCode.INVOICE_VIEW_ALL])),
):
    effective_vendor_id = vendor_id
    if current_user.vendor_id:
        effective_vendor_id = current_user.vendor_id

    filters = InvoiceFilterParams(
        po_id=po_id,
        vendor_id=effective_vendor_id,
        status=status,
        match_status=match_status,
        payment_status=payment_status,
        financial_year=financial_year,
        search=search,
        page=page,
        page_size=page_size,
    )
    invoices, total_count = await invoice_service.list(db, current_user.org_id, filters)

    data = []
    for inv in invoices:
        v = await vendor_repository.find_by_id(db, inv.vendor_id, current_user.org_id)
        po = await purchase_order_repository.get(db, inv.po_id, current_user.org_id)
        data.append(
            _to_invoice_response(
                inv,
                vendor_name=v.company_name if v else None,
                po_number=po.po_number if po else None,
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


@router.get("/export/csv")
async def export_invoices_csv(
    po_id: Optional[UUID] = Query(None),
    vendor_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    match_status: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    financial_year: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.INVOICE_VIEW_OWN, PermissionCode.INVOICE_VIEW_ALL])),
):
    """Stream CSV export of invoices."""
    effective_vendor_id = vendor_id
    if current_user.vendor_id:
        effective_vendor_id = current_user.vendor_id

    filters = InvoiceFilterParams(
        po_id=po_id,
        vendor_id=effective_vendor_id,
        status=status,
        match_status=match_status,
        payment_status=payment_status,
        financial_year=financial_year,
        search=search,
        page=1,
        page_size=1000,
    )
    invoices, _ = await invoice_service.list(db, current_user.org_id, filters)
    headers = ["invoice_number", "vendor_invoice_number", "total_amount", "currency", "status", "payment_status", "invoice_date"]
    rows = [
        {
            "invoice_number": getattr(inv, "invoice_number", ""),
            "vendor_invoice_number": getattr(inv, "vendor_invoice_number", ""),
            "total_amount": getattr(inv, "total_amount", 0),
            "currency": getattr(inv, "currency", "INR"),
            "status": getattr(inv, "status", ""),
            "payment_status": getattr(inv, "payment_status", ""),
            "invoice_date": getattr(inv, "invoice_date", ""),
        }
        for inv in invoices
    ]
    return stream_csv(headers=headers, rows=rows, filename=f"invoices_{current_user.org_id.hex[:6]}")


@router.get("/export/pdf")
async def export_invoices_pdf(
    po_id: Optional[UUID] = Query(None),
    vendor_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    match_status: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    financial_year: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.INVOICE_VIEW_OWN, PermissionCode.INVOICE_VIEW_ALL])),
):
    """Stream PDF export of invoices."""
    effective_vendor_id = vendor_id
    if current_user.vendor_id:
        effective_vendor_id = current_user.vendor_id

    filters = InvoiceFilterParams(
        po_id=po_id,
        vendor_id=effective_vendor_id,
        status=status,
        match_status=match_status,
        payment_status=payment_status,
        financial_year=financial_year,
        search=search,
        page=1,
        page_size=500,
    )
    invoices, _ = await invoice_service.list(db, current_user.org_id, filters)
    headers = ["invoice_number", "total_amount", "currency", "status", "payment_status"]
    rows = [
        {
            "invoice_number": getattr(inv, "invoice_number", ""),
            "total_amount": getattr(inv, "total_amount", 0),
            "currency": getattr(inv, "currency", "INR"),
            "status": getattr(inv, "status", ""),
            "payment_status": getattr(inv, "payment_status", ""),
        }
        for inv in invoices
    ]
    pdf_bytes = generate_table_pdf("Invoices Ledger Report", headers, rows)
    return stream_pdf(pdf_bytes, f"invoices_{current_user.org_id.hex[:6]}")


@router.get("/eligible-lines", response_model=APIResponse[List[EligibleLineResponse]])
async def get_eligible_lines(
    vendor_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.INVOICE_SUBMIT, PermissionCode.INVOICE_VIEW_OWN, PermissionCode.INVOICE_VIEW_ALL])),
):
    effective_vendor_id = current_user.vendor_id or vendor_id
    if not effective_vendor_id:
        raise ValidationError("vendor_id is required to fetch eligible invoice lines")

    lines = await invoice_service.get_eligible_lines(db, effective_vendor_id, current_user.org_id)
    meta = PaginationMeta(total=len(lines), page=1, page_size=len(lines) or 20)
    return success_response(data=lines, meta=meta)


@router.post("", response_model=APIResponse[InvoiceResponse], status_code=status.HTTP_201_CREATED)
async def submit_invoice(
    request: InvoiceSubmitRequest,
    vendor_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.INVOICE_SUBMIT)),
):
    effective_vendor_id = current_user.vendor_id or vendor_id
    if not effective_vendor_id:
        raise ValidationError("vendor_id is required to submit an invoice")

    invoice = await invoice_service.submit_invoice(
        db, request, current_user.id, effective_vendor_id, current_user.org_id
    )
    v = await vendor_repository.find_by_id(db, invoice.vendor_id, current_user.org_id)
    po = await purchase_order_repository.get(db, invoice.po_id, current_user.org_id)
    return created_response(
        data=_to_invoice_response(
            invoice,
            vendor_name=v.company_name if v else None,
            po_number=po.po_number if po else None,
        )
    )


@router.get("/{invoice_id}", response_model=APIResponse[InvoiceResponse])
async def get_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.INVOICE_VIEW_OWN, PermissionCode.INVOICE_VIEW_ALL])),
):
    invoice = await invoice_service.get(db, invoice_id, current_user.org_id)
    if current_user.vendor_id and invoice.vendor_id != current_user.vendor_id:
        raise ValidationError("Access denied to another vendor's invoice")

    v = await vendor_repository.find_by_id(db, invoice.vendor_id, current_user.org_id)
    po = await purchase_order_repository.get(db, invoice.po_id, current_user.org_id)
    return success_response(
        data=_to_invoice_response(
            invoice,
            vendor_name=v.company_name if v else None,
            po_number=po.po_number if po else None,
        )
    )


@router.post("/{invoice_id}/match", response_model=APIResponse[InvoiceResponse])
async def match_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.INVOICE_MATCH)),
):
    invoice = await invoice_service.get(db, invoice_id, current_user.org_id)
    po = await purchase_order_repository.get(db, invoice.po_id, current_user.org_id)
    match_result = await invoice_service.perform_three_way_match(db, invoice, po, current_user.org_id)

    if match_result["all_match"]:
        invoice.match_status = "MATCHED"
        invoice.status = "PENDING_APPROVAL"
    else:
        invoice.match_status = "DISCREPANCY"

    await db.commit()
    updated = await invoice_service.get(db, invoice_id, current_user.org_id)
    return success_response(data=_to_invoice_response(updated))


@router.post("/{invoice_id}/approve", response_model=APIResponse[InvoiceResponse])
async def approve_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.INVOICE_APPROVE)),
):
    invoice = await invoice_service.approve(db, invoice_id, current_user.id, current_user.org_id)
    v = await vendor_repository.find_by_id(db, invoice.vendor_id, current_user.org_id)
    po = await purchase_order_repository.get(db, invoice.po_id, current_user.org_id)
    return success_response(
        data=_to_invoice_response(
            invoice,
            vendor_name=v.company_name if v else None,
            po_number=po.po_number if po else None,
        )
    )


@router.post("/{invoice_id}/reject", response_model=APIResponse[InvoiceResponse])
async def reject_invoice(
    invoice_id: UUID,
    request: InvoiceRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(PermissionCode.INVOICE_REJECT)),
):
    invoice = await invoice_service.reject(
        db, invoice_id, request.rejection_reason, current_user.id, current_user.org_id
    )
    return success_response(data=_to_invoice_response(invoice))


@router.post("/{invoice_id}/dispute", response_model=APIResponse[InvoiceResponse])
async def dispute_invoice(
    invoice_id: UUID,
    request: InvoiceDisputeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_permission([PermissionCode.INVOICE_VIEW_OWN, PermissionCode.INVOICE_VIEW_ALL])),
):
    invoice = await invoice_service.dispute(
        db, invoice_id, request.reason_code, request.description, current_user.id, current_user.org_id
    )
    return success_response(data=_to_invoice_response(invoice))
