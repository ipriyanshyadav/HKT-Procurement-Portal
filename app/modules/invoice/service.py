"""
Invoice Service (SPEC_15).

Implements:
- 3-Way Match Engine (PO + GRN + Invoice)
- Quantity tolerance (2% hardcoded module-level physical tolerance)
- Price tolerance (configured in Settings, default 0.5%)
- Tax tolerance (1% per SPEC_15)
- Duplicate invoice detection (org_id, vendor_id, vendor_invoice_number, financial_year)
- Financial Year computation (April 1 - March 31 Indian standard)
- Business-day due date calculation with Holiday Calendar
- Invoice Approval & Workflow integration
- Dispute management on mismatches
"""

from __future__ import annotations

import builtins
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from loguru import logger
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.db.enums import InvoiceStatusEnum, POStatus
from app.events.publisher import OutboxPublisher
from app.modules.approval_rules.service import rules_engine
from app.modules.audit.service import audit_service
from app.modules.grn.repository import grn_repository
from app.modules.invoice.models import Invoice, InvoiceLine, InvoiceMatchResult
from app.modules.invoice.repository import InvoiceRepository, invoice_repository
from app.modules.invoice.schemas import (
    AdvancedReconciliationRequest,
    AdvancedReconciliationResponse,
    EarlyDiscountActionResponse,
    EarlyDiscountOption,
    EarlyDiscountOptionsResponse,
    EarlyDiscountRequest,
    EligibleLineResponse,
    InvoiceFilterParams,
    InvoiceSubmitRequest,
    PoFlipDraftResponse,
    PoFlipLineDraft,
    ReconciliationDiscrepancyItem,
)
from app.modules.master_data.models import HolidayMaster
from app.modules.master_data.payment_terms.repository import (
    PaymentTermsRepository,
    payment_terms_repository,
)
from app.modules.purchase_order.models import PurchaseOrder
from app.modules.purchase_order.repository import (
    PurchaseOrderRepository,
    purchase_order_repository,
)
from app.modules.workflow.service import workflow_engine

# SPEC_15 Section 2 / Plan A-15-1: Physical quantity tolerance hardcoded at module level
QUANTITY_TOLERANCE: float = settings.INVOICE_QUANTITY_TOLERANCE_PCT


class InvoiceService:
    def __init__(
        self,
        repo: InvoiceRepository | None = None,
        po_repo: PurchaseOrderRepository | None = None,
        terms_repo: PaymentTermsRepository | None = None,
    ) -> None:
        self.repo = repo or invoice_repository
        self.po_repo = po_repo or purchase_order_repository
        self.terms_repo = terms_repo or payment_terms_repository
        self.grn_repo = grn_repository
        self.audit = audit_service
        self.publisher = OutboxPublisher
        self.rules_engine = rules_engine
        self.workflow_engine = workflow_engine

    def _compute_financial_year(self, invoice_date: date) -> str:
        """
        Computes Indian financial year string (April 1 to March 31).
        E.g., 2026-04-15 -> 'FY2026-27', 2026-02-10 -> 'FY2025-26'.
        """
        if invoice_date.month >= 4:
            next_yr_short = str(invoice_date.year + 1)[2:]
            return f"FY{invoice_date.year}-{next_yr_short}"
        curr_yr_short = str(invoice_date.year)[2:]
        return f"FY{invoice_date.year - 1}-{curr_yr_short}"

    async def calculate_payment_due_date(
        self,
        db: AsyncSession,
        po: PurchaseOrder | None,
        invoice_date: date,
        org_id: UUID,
        payment_terms_code: str | None = None,
    ) -> date:
        """
        Calculates payment due date based on payment terms and advances across
        weekends and active holidays in holiday_master.
        """
        net_days = settings.DEFAULT_PAYMENT_TERMS_NET_DAYS  # Default fallback
        if payment_terms_code:
            term = await self.terms_repo.get_by_code(db, payment_terms_code, org_id)
            if term and term.net_days:
                net_days = term.net_days
        elif po and po.payment_term_id:
            try:
                term = await self.terms_repo.get(db, po.payment_term_id, org_id)
                if term and term.net_days:
                    net_days = term.net_days
            except Exception:
                pass

        raw_due = invoice_date + timedelta(days=net_days)

        # Query active holidays from holiday_master
        holiday_stmt = select(HolidayMaster.holiday_date).where(
            HolidayMaster.org_id == org_id,
            HolidayMaster.is_active.is_(True),
            HolidayMaster.deleted_at.is_(None),
        )
        holiday_res = await db.execute(holiday_stmt)
        holiday_dates = set(holiday_res.scalars().all())

        # Advance if date lands on weekend (Saturday=5, Sunday=6) or holiday
        while raw_due in holiday_dates or raw_due.weekday() >= 5:
            raw_due += timedelta(days=1)

        return raw_due

    async def submit_invoice(
        self,
        db: AsyncSession,
        data: InvoiceSubmitRequest,
        actor_id: UUID,
        vendor_id: UUID,
        org_id: UUID,
    ) -> Invoice:
        # 1. Uniqueness check per vendor per financial year
        fy = self._compute_financial_year(data.invoice_date)
        existing = await self.repo.find_by_vendor_invoice_number(db, org_id, vendor_id, data.vendor_invoice_number, fy)
        if existing:
            raise ConflictError(
                "DUPLICATE_INVOICE",
                f"Invoice {data.vendor_invoice_number} already exists for FY {fy}",
            )

        # 2. Validate PO reference
        po = await self.po_repo.get(db, data.po_id, org_id)
        if not po:
            raise NotFoundError("PurchaseOrder", str(data.po_id))

        if po.vendor_id != vendor_id:
            raise ValidationError("PO does not belong to the submitting vendor")

        valid_statuses = [
            POStatus.RELEASED.value if hasattr(POStatus.RELEASED, "value") else "RELEASED",
            POStatus.ACKNOWLEDGED.value if hasattr(POStatus.ACKNOWLEDGED, "value") else "ACKNOWLEDGED",
            "VENDOR_ACKNOWLEDGED",
            (
                POStatus.PARTIALLY_RECEIVED.value
                if hasattr(POStatus.PARTIALLY_RECEIVED, "value")
                else "PARTIALLY_RECEIVED"
            ),
            POStatus.FULLY_RECEIVED.value if hasattr(POStatus.FULLY_RECEIVED, "value") else "FULLY_RECEIVED",
        ]
        po_status_str = po.status.value if hasattr(po.status, "value") else str(po.status)
        if po_status_str not in valid_statuses:
            raise ValidationError(
                f"Cannot invoice PO in status '{po_status_str}'. PO must be acknowledged or received."
            )

        # 3. Compute due date if not provided
        due_date = data.due_date
        if not due_date:
            due_date = await self.calculate_payment_due_date(db, po, data.invoice_date, org_id, data.payment_terms_code)

        # 4. Generate system invoice number
        invoice_number = await self.repo.generate_invoice_number(db, org_id)

        price_tolerance_dec = Decimal(str(settings.PRICE_TOLERANCE_DEFAULT))

        # 5. Create Invoice record
        invoice = Invoice(
            org_id=org_id,
            invoice_number=invoice_number,
            vendor_invoice_number=data.vendor_invoice_number,
            vendor_id=vendor_id,
            po_id=data.po_id,
            status=InvoiceStatusEnum.SUBMITTED,
            invoice_date=data.invoice_date,
            due_date=due_date,
            currency=data.currency,
            subtotal=data.subtotal,
            tax_amount=data.tax_amount,
            total_amount=data.total_amount,
            tds_amount=Decimal("0.00"),
            financial_year=fy,
            payment_terms_code=data.payment_terms_code,
            price_tolerance=price_tolerance_dec,
            notes=data.notes,
            created_by=actor_id,
        )
        db.add(invoice)
        await db.flush()

        # 6. Add lines
        for line_data in data.lines:
            computed_total = line_data.line_total or (
                (line_data.quantity * line_data.unit_price) + line_data.tax_amount
            )
            line = InvoiceLine(
                org_id=org_id,
                invoice_id=invoice.id,
                po_line_id=line_data.po_line_id,
                grn_line_id=line_data.grn_line_id,
                line_number=line_data.line_number,
                item_description=line_data.item_description,
                quantity=line_data.quantity,
                unit_price=line_data.unit_price,
                tax_rate=line_data.tax_rate,
                tax_amount=line_data.tax_amount,
                line_total=computed_total,
            )
            db.add(line)
        await db.flush()

        # Reload invoice with lines
        invoice = await self.repo.get_with_relations(db, invoice.id, org_id)

        # 7. Execute 3-Way Match
        match_result = await self.perform_three_way_match(db, invoice, po, org_id)

        # 8. Set status and trigger workflow based on match result
        is_all_match = match_result.get("all_match") if "all_match" in match_result else match_result.get("overall_match", False)
        if is_all_match:
            invoice.match_status = "MATCHED"
            invoice.status = InvoiceStatusEnum.PENDING_APPROVAL
            await self._trigger_approval_workflow(db, invoice, org_id, actor_id)
        else:
            discrepancy_types = set()
            for disc in match_result.get("discrepancies", []):
                discrepancy_types.update(disc.get("reasons", []))

            if "PRICE_MISMATCH" in discrepancy_types:
                invoice.match_status = "DISCREPANCY"
                invoice.status = InvoiceStatusEnum.DISPUTED
                # Auto-create dispute for price mismatch per SPEC_15 Section 4
                from app.modules.payment.service import payment_service

                await payment_service.create_dispute(
                    db,
                    invoice_id=invoice.id,
                    reason_code="PRICE_MISMATCH",
                    description=f"Auto-generated dispute: 3-way match price mismatch exceeding {settings.PRICE_TOLERANCE_DEFAULT * 100}% tolerance.",
                    actor_id=actor_id,
                    org_id=org_id,
                )
            elif "QUANTITY_MISMATCH" in discrepancy_types:
                invoice.match_status = "PARTIAL_MATCH"
                invoice.status = InvoiceStatusEnum.PARTIALLY_MATCHED
            else:
                invoice.match_status = "DISCREPANCY"
                invoice.status = InvoiceStatusEnum.DISPUTED

        await db.flush()

        # 9. Audit log & Outbox event
        await self.audit.log(
            db,
            "INVOICE",
            invoice.id,
            "INVOICE_SUBMITTED",
            actor_id,
            org_id,
            new_values={
                "invoice_number": invoice.invoice_number,
                "total_amount": str(invoice.total_amount),
                "match_status": invoice.match_status,
                "status": invoice.status.value if hasattr(invoice.status, "value") else str(invoice.status),
            },
        )
        await self.publisher.publish(
            db,
            "procurement.invoice",
            routing_key="invoice.submitted",
            payload={
                "invoice_id": str(invoice.id),
                "invoice_number": invoice.invoice_number,
                "vendor_id": str(invoice.vendor_id),
                "po_id": str(invoice.po_id),
                "total_amount": str(invoice.total_amount),
                "match_status": invoice.match_status,
            },
            org_id=org_id,
        )

        inv_id = invoice.id
        await db.commit()
        db.expire_all()
        return await self.repo.get_with_relations(db, inv_id, org_id)

    async def perform_three_way_match(
        self,
        db: AsyncSession,
        invoice: Invoice,
        po: PurchaseOrder,
        org_id: UUID,
    ) -> dict[str, Any]:
        """
        Executes 3-way match across PO lines, GRN receipts, and Invoice lines.
        Tolerances:
          - Quantity: 2% (QUANTITY_TOLERANCE)
          - Price: from invoice.price_tolerance (default 0.5% settings.PRICE_TOLERANCE_DEFAULT)
          - Tax: 1% (settings.INVOICE_TAX_TOLERANCE_PCT)
        """
        all_match = True
        line_results = []
        discrepancies = []

        po_lines_map = {line.id: line for line in getattr(po, "lines", [])}
        price_tol = invoice.price_tolerance or Decimal(str(settings.PRICE_TOLERANCE_DEFAULT))
        qty_tol = Decimal(str(QUANTITY_TOLERANCE))
        tax_tol_pct = Decimal(str(settings.INVOICE_TAX_TOLERANCE_PCT))

        for inv_line in invoice.lines:
            po_line = po_lines_map.get(inv_line.po_line_id)
            reasons = []

            if not po_line:
                reasons.append("LINE_NOT_IN_PO")
                match_row = InvoiceMatchResult(
                    org_id=org_id,
                    invoice_id=invoice.id,
                    invoice_line_id=inv_line.id,
                    po_line_id=inv_line.po_line_id,
                    price_match=False,
                    price_deviation=None,
                    quantity_match=False,
                    quantity_deviation=None,
                    po_reference_valid=False,
                    tax_match=False,
                    tax_deviation=Decimal("0.0"),
                    overall_match=False,
                    mismatch_reasons=reasons,
                    invoice=invoice,
                )
                db.add(match_row)
                if (
                    hasattr(invoice, "match_results")
                    and invoice.match_results is not None
                    and match_row not in invoice.match_results
                ):
                    invoice.match_results.append(match_row)
                line_results.append(match_row)
                discrepancies.append(
                    {
                        "line_id": str(inv_line.id),
                        "po_line_id": str(inv_line.po_line_id),
                        "reasons": reasons,
                    }
                )
                all_match = False
                continue

            # 1. Price match check
            price_dev = Decimal("0.0")
            if po_line.unit_price > 0:
                price_dev = abs(inv_line.unit_price - po_line.unit_price) / po_line.unit_price
            price_match = price_dev <= price_tol
            if not price_match:
                reasons.append("PRICE_MISMATCH")

            # 2. Quantity match check against GRN accepted quantities
            grn_accepted = Decimal("0.0")
            try:
                # Sum accepted quantity from GRN lines for this PO line
                from app.modules.grn.models import GoodsReceiptNote, GrnLine

                stmt = (
                    select(func.coalesce(func.sum(GrnLine.accepted_quantity), 0))
                    .join(GoodsReceiptNote, GrnLine.grn_id == GoodsReceiptNote.id)
                    .where(
                        and_(
                            GrnLine.po_line_id == po_line.id,
                            GoodsReceiptNote.org_id == org_id,
                            GoodsReceiptNote.deleted_at.is_(None),
                        )
                    )
                )
                r = await db.execute(stmt)
                grn_accepted = Decimal(str(r.scalar() or 0))
            except Exception as e:
                logger.warning(f"Error querying GRN quantities for line {po_line.id}: {e}")

            if grn_accepted <= 0 and (po_line.received_quantity or 0) > 0:
                grn_accepted = Decimal(str(po_line.received_quantity))

            previously_invoiced = await self.repo.get_total_invoiced_quantity(
                db, po_line.id, org_id, exclude_invoice_id=invoice.id
            )
            max_invoiceable = max(Decimal("0.0"), grn_accepted - previously_invoiced)

            # Check quantity tolerance
            allowed_qty = max_invoiceable * (Decimal("1.0") + qty_tol)
            quantity_match = inv_line.quantity <= allowed_qty
            qty_deviation = (
                max(Decimal("0.0"), inv_line.quantity - max_invoiceable) if not quantity_match else Decimal("0.0")
            )
            if not quantity_match:
                reasons.append("QUANTITY_MISMATCH")

            # 3. PO reference validity check
            valid_statuses = [
                POStatus.RELEASED.value if hasattr(POStatus.RELEASED, "value") else "RELEASED",
                POStatus.ACKNOWLEDGED.value if hasattr(POStatus.ACKNOWLEDGED, "value") else "ACKNOWLEDGED",
                "VENDOR_ACKNOWLEDGED",
                (
                    POStatus.PARTIALLY_RECEIVED.value
                    if hasattr(POStatus.PARTIALLY_RECEIVED, "value")
                    else "PARTIALLY_RECEIVED"
                ),
                POStatus.FULLY_RECEIVED.value if hasattr(POStatus.FULLY_RECEIVED, "value") else "FULLY_RECEIVED",
            ]
            po_status_str = po.status.value if hasattr(po.status, "value") else str(po.status)
            po_ref_valid = po_status_str in valid_statuses
            if not po_ref_valid:
                reasons.append("WRONG_PO")

            # 4. Tax match check
            expected_tax = ((inv_line.quantity * inv_line.unit_price) * (po_line.tax_rate / Decimal("100"))).quantize(
                Decimal("0.01")
            )
            tax_deviation = abs(inv_line.tax_amount - expected_tax)
            tax_tolerance = max(expected_tax * tax_tol_pct, Decimal("0.05"))
            tax_match = tax_deviation <= tax_tolerance
            if not tax_match:
                reasons.append("TAX_MISMATCH")

            overall_match = price_match and quantity_match and po_ref_valid and tax_match
            if not overall_match:
                all_match = False
                discrepancies.append(
                    {
                        "line_id": str(inv_line.id),
                        "po_line_id": str(po_line.id),
                        "reasons": reasons,
                        "price_deviation_pct": float(price_dev * 100),
                        "invoiced_qty": float(inv_line.quantity),
                        "received_qty": float(grn_accepted),
                        "max_invoiceable": float(max_invoiceable),
                    }
                )

            if expected_tax > Decimal("0.0"):
                tax_dev_val = min(
                    ((tax_deviation / expected_tax) * Decimal("100")).quantize(Decimal("0.01")),
                    Decimal("999.99"),
                )
            elif tax_deviation > Decimal("0.0"):
                tax_dev_val = Decimal("100.00")
            else:
                tax_dev_val = Decimal("0.00")

            match_row = InvoiceMatchResult(
                org_id=org_id,
                invoice_id=invoice.id,
                invoice_line_id=inv_line.id,
                po_line_id=po_line.id,
                price_match=price_match,
                price_deviation=price_dev,
                quantity_match=quantity_match,
                quantity_deviation=qty_deviation,
                po_reference_valid=po_ref_valid,
                tax_match=tax_match,
                tax_deviation=tax_dev_val,
                overall_match=overall_match,
                mismatch_reasons=reasons if reasons else None,
                invoice=invoice,
            )
            db.add(match_row)
            if (
                hasattr(invoice, "match_results")
                and invoice.match_results is not None
                and match_row not in invoice.match_results
            ):
                invoice.match_results.append(match_row)
            line_results.append(match_row)

        overall_match = all_match
        mismatch_count = len(discrepancies)
        await db.flush()
        return {
            "invoice_id": invoice.id,
            "overall_match": overall_match,
            "all_match": overall_match,
            "mismatch_count": mismatch_count,
            "line_results": line_results,
            "discrepancies": discrepancies,
            "status": invoice.status,
            "vendor_id": invoice.vendor_id,
            "po_id": invoice.po_id,
            "total_amount": invoice.total_amount,
            "currency": invoice.currency,
        }

    async def _trigger_approval_workflow(
        self,
        db: AsyncSession,
        invoice: Invoice,
        org_id: UUID,
        actor_id: UUID,
    ) -> None:
        entity_context = {
            "entity_type": "INVOICE",
            "entity_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "total_amount": float(invoice.total_amount),
            "currency": invoice.currency,
            "vendor_id": str(invoice.vendor_id),
            "match_status": invoice.match_status,
        }
        try:
            rule = await self.rules_engine.find_matching_rule(db, "INVOICE", entity_context, org_id)
            if rule:
                await self.workflow_engine.instantiate(
                    db,
                    rule.workflow_template_code,
                    "INVOICE",
                    invoice.id,
                    entity_context,
                    org_id,
                    actor_id,
                )
        except Exception as e:
            logger.warning(f"Failed to instantiate invoice approval workflow: {e}")

    async def get(
        self,
        db: AsyncSession,
        invoice_id: UUID,
        org_id: UUID,
    ) -> Invoice:
        invoice = await self.repo.get_with_relations(db, invoice_id, org_id)
        if not invoice:
            raise NotFoundError("Invoice", str(invoice_id))
        return invoice

    async def list(
        self,
        db: AsyncSession,
        org_id: UUID,
        filters: InvoiceFilterParams,
    ) -> tuple[builtins.list[Invoice], int]:
        return await self.repo.list_invoices(db, org_id, filters)

    async def get_eligible_lines(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        org_id: UUID,
    ) -> builtins.list[EligibleLineResponse]:
        raw_lines = await self.repo.get_eligible_lines(db, vendor_id, org_id)
        return [EligibleLineResponse(**line_item) for line_item in raw_lines]

    async def generate_po_flip_draft(
        self,
        db: AsyncSession,
        po_id: UUID,
        org_id: UUID,
        vendor_id: UUID | None = None,
    ) -> PoFlipDraftResponse:
        """
        Generates an automated PO Flip draft invoice (SAP Ariba / Coupa enterprise standard).
        Pre-populates lines from confirmed GRN receipts & open quantities.
        """
        from app.db.enums import POStatus
        from app.modules.grn.models import GoodsReceiptNote, GrnLine
        from app.modules.invoice.schemas import PoFlipDraftResponse, PoFlipLineDraft

        po = await self.po_repo.get(db, po_id, org_id)
        if not po:
            raise NotFoundError(f"Purchase Order {po_id} not found")

        if vendor_id and po.vendor_id != vendor_id:
            raise ForbiddenError("You are not authorized to flip this Purchase Order")

        vendor = None
        if hasattr(self.repo, "get_vendor_by_id"):
            vendor = await self.repo.get_vendor_by_id(db, po.vendor_id, org_id)
        vendor_name = getattr(vendor, "company_name", None)

        valid_statuses = [
            POStatus.RELEASED.value if hasattr(POStatus.RELEASED, "value") else "RELEASED",
            POStatus.ACKNOWLEDGED.value if hasattr(POStatus.ACKNOWLEDGED, "value") else "ACKNOWLEDGED",
            "VENDOR_ACKNOWLEDGED",
            (
                POStatus.PARTIALLY_RECEIVED.value
                if hasattr(POStatus.PARTIALLY_RECEIVED, "value")
                else "PARTIALLY_RECEIVED"
            ),
            POStatus.FULLY_RECEIVED.value if hasattr(POStatus.FULLY_RECEIVED, "value") else "FULLY_RECEIVED",
        ]
        po_status_str = po.status.value if hasattr(po.status, "value") else str(po.status)
        can_invoice = po_status_str in valid_statuses
        blocking_reason = None
        if not can_invoice:
            blocking_reason = f"PO status is '{po_status_str}'. Invoicing requires an acknowledged or received PO."

        draft_lines: list[PoFlipLineDraft] = []
        subtotal = Decimal("0.0")
        tax_total = Decimal("0.0")

        today = date.today()
        due_date = await self.calculate_payment_due_date(
            db, po, today, org_id, getattr(getattr(po, "payment_term", None), "code", None)
        )

        for line in getattr(po, "lines", []) or []:
            # 1. Accepted GRN quantity
            grn_stmt = (
                select(func.coalesce(func.sum(GrnLine.accepted_quantity), 0))
                .join(GoodsReceiptNote, GrnLine.grn_id == GoodsReceiptNote.id)
                .where(
                    and_(
                        GrnLine.po_line_id == line.id,
                        GoodsReceiptNote.org_id == org_id,
                        GoodsReceiptNote.deleted_at.is_(None),
                    )
                )
            )
            grn_res = await db.execute(grn_stmt)
            accepted_qty = Decimal(str(grn_res.scalar() or 0))
            if accepted_qty <= 0 and (line.received_quantity or 0) > 0:
                accepted_qty = Decimal(str(line.received_quantity))

            # 2. Invoiced quantity
            invoiced_qty = await self.repo.get_total_invoiced_quantity(db, line.id, org_id)

            ordered_qty = Decimal(str(getattr(line, "ordered_quantity", getattr(line, "quantity", 0))))

            # 3. Open invoiceable quantity
            invoiceable = max(Decimal("0.0"), accepted_qty - invoiced_qty)
            if invoiceable <= 0 and accepted_qty == 0 and can_invoice:
                invoiceable = max(Decimal("0.0"), ordered_qty - invoiced_qty)

            unit_price = Decimal(str(line.unit_price))
            tax_rate = Decimal(str(line.tax_rate or Decimal("0.0")))
            line_subtotal = (invoiceable * unit_price).quantize(Decimal("0.01"))
            line_tax = (line_subtotal * (tax_rate / Decimal("100.0"))).quantize(Decimal("0.01"))
            line_total = line_subtotal + line_tax

            subtotal += line_subtotal
            tax_total += line_tax

            draft_lines.append(
                PoFlipLineDraft(
                    po_line_id=line.id,
                    line_number=line.line_number,
                    item_description=line.item_description,
                    po_quantity=ordered_qty,
                    received_quantity=accepted_qty,
                    invoiced_quantity=invoiced_qty,
                    invoiceable_quantity=invoiceable,
                    unit_price=unit_price,
                    tax_rate=tax_rate,
                    tax_amount=line_tax,
                    line_total=line_total,
                )
            )

        total_amount = subtotal + tax_total

        return PoFlipDraftResponse(
            po_id=po.id,
            po_number=po.po_number,
            vendor_id=po.vendor_id,
            vendor_name=vendor_name,
            currency=po.currency or "INR",
            payment_terms_code=getattr(getattr(po, "payment_term", None), "code", None),
            suggested_invoice_date=today,
            suggested_due_date=due_date,
            suggested_vendor_invoice_number=f"INV-{po.po_number}-{today.strftime('%m%d')}",
            lines=draft_lines,
            subtotal=subtotal,
            tax_amount=tax_total,
            total_amount=total_amount,
            can_invoice=can_invoice and len(draft_lines) > 0 and subtotal > 0,
            blocking_reason=blocking_reason or ("All quantities already fully invoiced" if subtotal == 0 else None),
        )

    async def approve(
        self,
        db: AsyncSession,
        invoice_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> Invoice:
        invoice = await self.get(db, invoice_id, org_id)
        curr_status = invoice.status.value if hasattr(invoice.status, "value") else str(invoice.status)

        allowed_approval_statuses = [
            InvoiceStatusEnum.SUBMITTED.value if hasattr(InvoiceStatusEnum.SUBMITTED, "value") else "SUBMITTED",
            InvoiceStatusEnum.MATCHED.value if hasattr(InvoiceStatusEnum.MATCHED, "value") else "MATCHED",
            (
                InvoiceStatusEnum.PARTIALLY_MATCHED.value
                if hasattr(InvoiceStatusEnum.PARTIALLY_MATCHED, "value")
                else "PARTIALLY_MATCHED"
            ),
            (
                InvoiceStatusEnum.PENDING_APPROVAL.value
                if hasattr(InvoiceStatusEnum.PENDING_APPROVAL, "value")
                else "PENDING_APPROVAL"
            ),
        ]
        if curr_status not in allowed_approval_statuses:
            raise ValidationError(f"Cannot approve invoice in status '{curr_status}'")

        invoice.status = InvoiceStatusEnum.APPROVED
        invoice.updated_by = actor_id
        await db.flush()

        # Automatically schedule payment record
        from app.modules.payment.service import payment_service

        await payment_service.create_scheduled_payment(db, invoice.id, actor_id, org_id)

        await self.audit.log(
            db,
            "INVOICE",
            invoice.id,
            "INVOICE_APPROVED",
            actor_id,
            org_id,
            new_values={"status": "APPROVED"},
        )
        await self.publisher.publish(
            db,
            "procurement.invoice",
            routing_key="invoice.approved",
            payload={
                "invoice_id": str(invoice.id),
                "invoice_number": invoice.invoice_number,
                "total_amount": str(invoice.total_amount),
            },
            org_id=org_id,
        )

        await db.commit()
        return await self.get(db, invoice.id, org_id)

    async def reject(
        self,
        db: AsyncSession,
        invoice_id: UUID,
        rejection_reason: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> Invoice:
        invoice = await self.get(db, invoice_id, org_id)
        invoice.status = InvoiceStatusEnum.CANCELLED
        invoice.notes = f"Rejected: {rejection_reason}"
        invoice.updated_by = actor_id
        await db.flush()

        await self.audit.log(
            db,
            "INVOICE",
            invoice.id,
            "INVOICE_REJECTED",
            actor_id,
            org_id,
            new_values={"status": "CANCELLED", "rejection_reason": rejection_reason},
        )
        await self.publisher.publish(
            db,
            "procurement.invoice",
            routing_key="invoice.rejected",
            payload={
                "invoice_id": str(invoice.id),
                "invoice_number": invoice.invoice_number,
                "rejection_reason": rejection_reason,
            },
            org_id=org_id,
        )

        await db.commit()
        return await self.get(db, invoice.id, org_id)

    async def dispute(
        self,
        db: AsyncSession,
        invoice_id: UUID,
        reason_code: str,
        description: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> Invoice:
        invoice = await self.get(db, invoice_id, org_id)
        invoice.status = InvoiceStatusEnum.DISPUTED
        invoice.updated_by = actor_id
        await db.flush()

        from app.modules.payment.service import payment_service

        await payment_service.create_dispute(
            db,
            invoice_id=invoice.id,
            reason_code=reason_code,
            description=description,
            actor_id=actor_id,
            org_id=org_id,
        )

        await self.audit.log(
            db,
            "INVOICE",
            invoice.id,
            "DISPUTED",
            actor_id,
            org_id,
            new_values={"status": "DISPUTED", "reason_code": reason_code},
        )
        await self.publisher.publish(
            db,
            "procurement.invoice",
            routing_key="invoice.disputed",
            payload={
                "invoice_id": str(invoice.id),
                "invoice_number": invoice.invoice_number,
                "reason_code": reason_code,
            },
            org_id=org_id,
        )

        await db.commit()
        return await self.get(db, invoice.id, org_id)

    async def perform_advanced_reconciliation(
        self,
        db: AsyncSession,
        invoice_id: UUID,
        payload: AdvancedReconciliationRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> AdvancedReconciliationResponse:
        invoice = await self.get(db, invoice_id, org_id)
        from app.modules.purchase_order.repository import purchase_order_repository

        po = await purchase_order_repository.get(db, invoice.po_id, org_id)
        if not po:
            raise NotFoundError("PurchaseOrder", str(invoice.po_id))

        po_lines_map = {line.id: line for line in getattr(po, "lines", [])}

        line_details: list[ReconciliationDiscrepancyItem] = []
        matched_count = 0
        discrepancy_count = 0
        total_credit_memo = Decimal("0.00")

        from app.modules.grn.models import GrnLine

        for inv_line in invoice.lines:
            po_line = po_lines_map.get(inv_line.po_line_id)
            reasons: list[str] = []
            suggested_credit = Decimal("0.00")

            po_price = float(po_line.unit_price) if po_line else 0.0
            po_qty = float(getattr(po_line, "ordered_quantity", getattr(po_line, "quantity", 0.0))) if po_line else 0.0
            inv_price = float(inv_line.unit_price)
            inv_qty = float(inv_line.quantity)

            # GRN receipts
            grn_stmt = select(
                func.coalesce(func.sum(GrnLine.received_quantity), 0),
                func.coalesce(func.sum(GrnLine.accepted_quantity), 0),
                func.coalesce(func.sum(GrnLine.rejected_quantity), 0),
            ).where(GrnLine.po_line_id == inv_line.po_line_id)
            grn_row = (await db.execute(grn_stmt)).first()
            grn_received = float(grn_row[0]) if grn_row else 0.0
            grn_accepted = float(grn_row[1]) if grn_row else 0.0
            grn_rejected = float(grn_row[2]) if grn_row else 0.0

            # Price check
            price_variance_pct = 0.0
            if po_price > 0:
                price_variance_pct = round(((inv_price - po_price) / po_price) * 100.0, 2)
                if abs(price_variance_pct) > payload.price_tolerance_pct:
                    reasons.append(
                        f"Price exceeds PO rate by {price_variance_pct}% (tolerance: ±{payload.price_tolerance_pct}%)"
                    )
                    if inv_price > po_price:
                        suggested_credit += Decimal(str(round((inv_price - po_price) * inv_qty, 2)))

            # Quantity check
            qty_variance_pct = 0.0
            benchmark_qty = (
                grn_accepted if payload.match_mode == "FOUR_WAY" else (grn_received if grn_received > 0 else po_qty)
            )
            if benchmark_qty > 0:
                qty_variance_pct = round(((inv_qty - benchmark_qty) / benchmark_qty) * 100.0, 2)
                if abs(qty_variance_pct) > payload.quantity_tolerance_pct:
                    reasons.append(
                        f"Invoiced quantity exceeds received count by {qty_variance_pct}% (tolerance: ±{payload.quantity_tolerance_pct}%)"
                    )
                    if inv_qty > benchmark_qty:
                        suggested_credit += Decimal(str(round((inv_qty - benchmark_qty) * inv_price, 2)))

            # 4-Way Quality Check
            if payload.match_mode == "FOUR_WAY" and grn_rejected > 0:
                reasons.append(f"Quality rejection detected: {grn_rejected} units rejected at dock")
                suggested_credit += Decimal(str(round(grn_rejected * inv_price, 2)))

            is_matched = len(reasons) == 0
            if is_matched:
                matched_count += 1
                status = "MATCHED"
            else:
                discrepancy_count += 1
                status = "VARIANCE_DETECTED"
                total_credit_memo += suggested_credit

            line_details.append(
                ReconciliationDiscrepancyItem(
                    line_number=inv_line.line_number,
                    item_description=inv_line.item_description,
                    po_unit_price=po_price,
                    invoice_unit_price=inv_price,
                    price_variance_pct=price_variance_pct,
                    po_quantity=po_qty,
                    grn_received_quantity=grn_received,
                    quality_inspected_quantity=grn_accepted,
                    invoice_quantity=inv_qty,
                    quantity_variance_pct=qty_variance_pct,
                    status=status,
                    reasons=reasons,
                    suggested_credit_note_amount=float(suggested_credit),
                )
            )

        overall_status = "FULLY_MATCHED" if discrepancy_count == 0 else "VARIANCE_DETECTED"
        auto_approved = False
        if overall_status == "FULLY_MATCHED" and payload.auto_approve_if_matched:
            invoice.match_status = "MATCHED"
            await self.approve(db, invoice.id, actor_id, org_id)
            auto_approved = True
        elif overall_status == "VARIANCE_DETECTED":
            invoice.match_status = "DISCREPANCY"
            await db.commit()
        else:
            await db.commit()

        await db.refresh(invoice)

        return AdvancedReconciliationResponse(
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            match_mode=payload.match_mode,
            price_tolerance_pct=payload.price_tolerance_pct,
            quantity_tolerance_pct=payload.quantity_tolerance_pct,
            overall_status=overall_status,
            matched_lines_count=matched_count,
            discrepancy_lines_count=discrepancy_count,
            total_invoice_amount=float(invoice.total_amount),
            suggested_credit_note_total=float(total_credit_memo),
            auto_approved=auto_approved,
            line_details=line_details,
            reconciliation_timestamp=datetime.now(UTC),
        )

    async def get_reconciliation_dashboard(self, db: AsyncSession, org_id: UUID) -> dict[str, Any]:
        stmt = select(Invoice).where(Invoice.org_id == org_id)
        invoices = list((await db.execute(stmt)).scalars().all())

        matched = [i for i in invoices if i.match_status == "MATCHED"]
        discrepant = [i for i in invoices if i.match_status == "DISCREPANCY"]
        unmatched = [i for i in invoices if i.match_status not in ("MATCHED", "DISCREPANCY")]

        return {
            "total_invoices": len(invoices),
            "fully_matched_count": len(matched),
            "discrepancy_count": len(discrepant),
            "unprocessed_count": len(unmatched),
            "match_rate_pct": round((len(matched) / len(invoices) * 100.0) if invoices else 100.0, 1),
            "total_matched_value": float(sum(i.total_amount for i in matched)),
            "total_at_risk_value": float(sum(i.total_amount for i in discrepant)),
        }

    async def calculate_early_discount_options(
        self,
        db: AsyncSession,
        invoice_id: UUID,
        org_id: UUID,
        custom_apr: float | None = None,
    ) -> EarlyDiscountOptionsResponse:
        invoice = await self.get(db, invoice_id, org_id)
        today = date.today()
        remaining_days = (invoice.due_date - today).days

        min_days_early = settings.EARLY_DISCOUNT_MIN_DAYS_EARLY
        max_discount_cap = Decimal(str(settings.EARLY_DISCOUNT_MAX_DISCOUNT_PCT))

        invalid_statuses = (InvoiceStatusEnum.CANCELLED, InvoiceStatusEnum.PAID, InvoiceStatusEnum.DISPUTED)
        if invoice.status in invalid_statuses:
            status_val = invoice.status.value if hasattr(invoice.status, "value") else str(invoice.status)
            return EarlyDiscountOptionsResponse(
                invoice_id=invoice.id,
                invoice_number=invoice.invoice_number,
                original_due_date=invoice.due_date,
                currency=invoice.currency,
                total_amount=invoice.total_amount,
                eligible=False,
                blocking_reason=f"Invoices in status '{status_val}' cannot receive early discount payment acceleration.",
                options=[],
            )

        if remaining_days < min_days_early:
            return EarlyDiscountOptionsResponse(
                invoice_id=invoice.id,
                invoice_number=invoice.invoice_number,
                original_due_date=invoice.due_date,
                currency=invoice.currency,
                total_amount=invoice.total_amount,
                eligible=False,
                blocking_reason=f"Invoice is due in {remaining_days} days (minimum required for acceleration: {min_days_early} days).",
                options=[],
            )

        aprs = [custom_apr] if custom_apr else [0.12, settings.EARLY_DISCOUNT_DEFAULT_APR, 0.24]
        candidate_days = [5, 10, 15, 20, 25]
        valid_days = [d for d in candidate_days if d < remaining_days]
        if not valid_days:
            valid_days = [max(min_days_early, remaining_days - 2)]

        options: list[EarlyDiscountOption] = []
        for days in valid_days:
            for apr in aprs:
                raw_pct = (Decimal(str(days)) / Decimal("365.0")) * Decimal(str(apr))
                discount_pct = min(max_discount_cap, raw_pct)
                discount_amt = (invoice.total_amount * discount_pct).quantize(Decimal("0.01"))
                tds = invoice.tds_amount or Decimal("0.0")
                net_amt = (invoice.total_amount - discount_amt - tds).quantize(Decimal("0.01"))
                payout_date = invoice.due_date - timedelta(days=days)

                options.append(
                    EarlyDiscountOption(
                        days_early=days,
                        accelerated_payout_date=payout_date,
                        annual_percentage_rate=float(apr),
                        discount_percentage=round(float(discount_pct * 100), 2),
                        discount_amount=discount_amt,
                        gross_amount=invoice.total_amount,
                        net_payout_amount=net_amt,
                        cash_yield_annualized_pct=round(float(apr * 100), 1),
                    )
                )

        return EarlyDiscountOptionsResponse(
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            original_due_date=invoice.due_date,
            currency=invoice.currency,
            total_amount=invoice.total_amount,
            eligible=True,
            blocking_reason=None,
            options=options,
        )

    async def request_early_payment(
        self,
        db: AsyncSession,
        invoice_id: UUID,
        payload: EarlyDiscountRequest,
        actor_id: UUID,
        org_id: UUID,
        vendor_id: UUID | None = None,
    ) -> EarlyDiscountActionResponse:
        invoice = await self.get(db, invoice_id, org_id)
        if vendor_id and invoice.vendor_id != vendor_id:
            raise ForbiddenError("You are not authorized to request early discount on another vendor's invoice")

        if payload.accelerated_payout_date >= invoice.due_date:
            raise ValidationError(
                f"Accelerated payout date ({payload.accelerated_payout_date}) must precede due date ({invoice.due_date})"
            )

        days_early = (invoice.due_date - payload.accelerated_payout_date).days
        if days_early < settings.EARLY_DISCOUNT_MIN_DAYS_EARLY:
            raise ValidationError(
                f"Accelerated payment requires at least {settings.EARLY_DISCOUNT_MIN_DAYS_EARLY} days acceleration"
            )

        if payload.discount_amount <= Decimal("0.0") or payload.discount_amount >= invoice.total_amount:
            raise ValidationError("Invalid discount amount")

        invoice.early_discount_status = "REQUESTED"
        invoice.early_discount_amount = payload.discount_amount
        invoice.early_discount_payout_date = payload.accelerated_payout_date
        invoice.early_discount_apr = Decimal(str(payload.annual_percentage_rate))
        invoice.updated_by = actor_id

        await self.audit.log(
            db,
            "INVOICE",
            invoice.id,
            "EARLY_DISCOUNT_REQUESTED",
            actor_id,
            org_id,
            new_values={
                "discount_amount": str(payload.discount_amount),
                "accelerated_date": str(payload.accelerated_payout_date),
                "apr": str(payload.annual_percentage_rate),
            },
        )
        await self.publisher.publish(
            db,
            "procurement.invoice",
            routing_key="invoice.early_discount.requested",
            payload={
                "invoice_id": str(invoice.id),
                "invoice_number": invoice.invoice_number,
                "discount_amount": float(payload.discount_amount),
                "payout_date": str(payload.accelerated_payout_date),
            },
            org_id=org_id,
        )

        await db.commit()
        net_payable = invoice.total_amount - payload.discount_amount - (invoice.tds_amount or Decimal("0.0"))
        return EarlyDiscountActionResponse(
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            early_discount_status=invoice.early_discount_status,
            original_due_date=invoice.due_date,
            accelerated_payout_date=invoice.early_discount_payout_date,
            discount_amount=payload.discount_amount,
            net_payable_amount=net_payable,
            currency=invoice.currency,
            message=f"Early payment request of {invoice.currency} {payload.discount_amount} submitted successfully.",
        )

    async def accept_early_payment(
        self,
        db: AsyncSession,
        invoice_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> EarlyDiscountActionResponse:
        invoice = await self.get(db, invoice_id, org_id)
        if invoice.early_discount_status != "REQUESTED":
            raise ValidationError(
                f"Cannot accept early payment for invoice with early_discount_status '{invoice.early_discount_status}'. Must be 'REQUESTED'."
            )

        invoice.early_discount_status = "ACCEPTED"
        invoice.updated_by = actor_id

        from app.modules.payment.models import PaymentRecord
        stmt = select(PaymentRecord).where(
            PaymentRecord.invoice_id == invoice.id,
            PaymentRecord.org_id == org_id,
            PaymentRecord.status == "PENDING",
        )
        res = await db.execute(stmt)
        record = None
        if hasattr(res, "scalars"):
            sc = res.scalars()
            if hasattr(sc, "first"):
                record = sc.first()
        tds = invoice.tds_amount or Decimal("0.0")
        net_amount = invoice.total_amount - (invoice.early_discount_amount or Decimal("0.0")) - tds

        if record:
            record.amount = net_amount
            record.net_amount = net_amount
            record.discount_amount = invoice.early_discount_amount or Decimal("0.0")
            if invoice.early_discount_payout_date:
                record.payment_due_date = invoice.early_discount_payout_date
                record.payment_date = invoice.early_discount_payout_date

        await self.audit.log(
            db,
            "INVOICE",
            invoice.id,
            "EARLY_DISCOUNT_ACCEPTED",
            actor_id,
            org_id,
            new_values={
                "discount_amount": str(invoice.early_discount_amount),
                "net_amount": str(net_amount),
                "payout_date": str(invoice.early_discount_payout_date),
            },
        )
        await self.publisher.publish(
            db,
            "procurement.invoice",
            routing_key="invoice.early_discount.accepted",
            payload={
                "invoice_id": str(invoice.id),
                "invoice_number": invoice.invoice_number,
                "discount_amount": float(invoice.early_discount_amount or 0),
                "net_amount": float(net_amount),
                "payout_date": str(invoice.early_discount_payout_date),
            },
            org_id=org_id,
        )

        await db.commit()
        return EarlyDiscountActionResponse(
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            early_discount_status=invoice.early_discount_status,
            original_due_date=invoice.due_date,
            accelerated_payout_date=invoice.early_discount_payout_date,
            discount_amount=invoice.early_discount_amount or Decimal("0.0"),
            net_payable_amount=net_amount,
            currency=invoice.currency,
            message=f"Early payment discount accepted. Accelerated payout scheduled for {invoice.early_discount_payout_date}.",
        )

    async def reject_early_payment(
        self,
        db: AsyncSession,
        invoice_id: UUID,
        rejection_reason: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> EarlyDiscountActionResponse:
        invoice = await self.get(db, invoice_id, org_id)
        if invoice.early_discount_status != "REQUESTED":
            raise ValidationError(
                f"Cannot reject early payment for invoice with early_discount_status '{invoice.early_discount_status}'"
            )

        invoice.early_discount_status = "REJECTED"
        invoice.updated_by = actor_id

        await self.audit.log(
            db,
            "INVOICE",
            invoice.id,
            "EARLY_DISCOUNT_REJECTED",
            actor_id,
            org_id,
            new_values={"reason": rejection_reason},
        )
        await self.publisher.publish(
            db,
            "procurement.invoice",
            routing_key="invoice.early_discount.rejected",
            payload={
                "invoice_id": str(invoice.id),
                "invoice_number": invoice.invoice_number,
                "reason": rejection_reason,
            },
            org_id=org_id,
        )

        await db.commit()
        tds = invoice.tds_amount or Decimal("0.0")
        net_amount = invoice.total_amount - tds
        return EarlyDiscountActionResponse(
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            early_discount_status=invoice.early_discount_status,
            original_due_date=invoice.due_date,
            accelerated_payout_date=None,
            discount_amount=Decimal("0.0"),
            net_payable_amount=net_amount,
            currency=invoice.currency,
            message=f"Early payment discount request rejected: {rejection_reason}",
        )


invoice_service = InvoiceService()
