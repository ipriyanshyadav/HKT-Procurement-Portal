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

from datetime import UTC, date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from loguru import logger
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.constants import AuditAction
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
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
    EligibleLineResponse,
    InvoiceFilterParams,
    InvoiceSubmitRequest,
    ReconciliationDiscrepancyItem,
)
from app.modules.master_data.models import HolidayMaster, PaymentTerm
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
        repo: Optional[InvoiceRepository] = None,
        po_repo: Optional[PurchaseOrderRepository] = None,
        terms_repo: Optional[PaymentTermsRepository] = None,
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
        po: Optional[PurchaseOrder],
        invoice_date: date,
        org_id: UUID,
        payment_terms_code: Optional[str] = None,
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
            HolidayMaster.is_active == True,
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
        existing = await self.repo.find_by_vendor_invoice_number(
            db, org_id, vendor_id, data.vendor_invoice_number, fy
        )
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
            POStatus.PARTIALLY_RECEIVED.value if hasattr(POStatus.PARTIALLY_RECEIVED, "value") else "PARTIALLY_RECEIVED",
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
            due_date = await self.calculate_payment_due_date(
                db, po, data.invoice_date, org_id, data.payment_terms_code
            )

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
        if match_result["all_match"]:
            invoice.match_status = "MATCHED"
            invoice.status = InvoiceStatusEnum.PENDING_APPROVAL
            await self._trigger_approval_workflow(db, invoice, org_id, actor_id)
        else:
            discrepancy_types = set()
            for disc in match_result["discrepancies"]:
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
    ) -> Dict[str, Any]:
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
                if hasattr(invoice, "match_results") and invoice.match_results is not None:
                    if match_row not in invoice.match_results:
                        invoice.match_results.append(match_row)
                line_results.append(match_row)
                discrepancies.append({
                    "line_id": str(inv_line.id),
                    "po_line_id": str(inv_line.po_line_id),
                    "reasons": reasons,
                })
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
            qty_deviation = max(Decimal("0.0"), inv_line.quantity - max_invoiceable) if not quantity_match else Decimal("0.0")
            if not quantity_match:
                reasons.append("QUANTITY_MISMATCH")

            # 3. PO reference validity check
            valid_statuses = [
                POStatus.RELEASED.value if hasattr(POStatus.RELEASED, "value") else "RELEASED",
                POStatus.ACKNOWLEDGED.value if hasattr(POStatus.ACKNOWLEDGED, "value") else "ACKNOWLEDGED",
                "VENDOR_ACKNOWLEDGED",
                POStatus.PARTIALLY_RECEIVED.value if hasattr(POStatus.PARTIALLY_RECEIVED, "value") else "PARTIALLY_RECEIVED",
                POStatus.FULLY_RECEIVED.value if hasattr(POStatus.FULLY_RECEIVED, "value") else "FULLY_RECEIVED",
            ]
            po_status_str = po.status.value if hasattr(po.status, "value") else str(po.status)
            po_ref_valid = po_status_str in valid_statuses
            if not po_ref_valid:
                reasons.append("WRONG_PO")

            # 4. Tax match check
            expected_tax = (
                (inv_line.quantity * inv_line.unit_price) * (po_line.tax_rate / Decimal("100"))
            ).quantize(Decimal("0.01"))
            tax_deviation = abs(inv_line.tax_amount - expected_tax)
            tax_tolerance = max(expected_tax * tax_tol_pct, Decimal("0.05"))
            tax_match = tax_deviation <= tax_tolerance
            if not tax_match:
                reasons.append("TAX_MISMATCH")

            overall_match = price_match and quantity_match and po_ref_valid and tax_match
            if not overall_match:
                all_match = False
                discrepancies.append({
                    "line_id": str(inv_line.id),
                    "po_line_id": str(po_line.id),
                    "reasons": reasons,
                    "price_deviation_pct": float(price_dev * 100),
                    "invoiced_qty": float(inv_line.quantity),
                    "received_qty": float(grn_accepted),
                    "max_invoiceable": float(max_invoiceable),
                })

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
                tax_deviation=tax_deviation,
                overall_match=overall_match,
                mismatch_reasons=reasons if reasons else None,
                invoice=invoice,
            )
            db.add(match_row)
            if hasattr(invoice, "match_results") and invoice.match_results is not None:
                if match_row not in invoice.match_results:
                    invoice.match_results.append(match_row)
            line_results.append(match_row)

        await db.flush()
        return {
            "all_match": all_match,
            "discrepancies": discrepancies,
            "line_results": line_results,
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
    ) -> Tuple[List[Invoice], int]:
        return await self.repo.list_invoices(db, org_id, filters)

    async def get_eligible_lines(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        org_id: UUID,
    ) -> List[EligibleLineResponse]:
        raw_lines = await self.repo.get_eligible_lines(db, vendor_id, org_id)
        return [EligibleLineResponse(**l) for l in raw_lines]

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
            InvoiceStatusEnum.PARTIALLY_MATCHED.value if hasattr(InvoiceStatusEnum.PARTIALLY_MATCHED, "value") else "PARTIALLY_MATCHED",
            InvoiceStatusEnum.PENDING_APPROVAL.value if hasattr(InvoiceStatusEnum.PENDING_APPROVAL, "value") else "PENDING_APPROVAL",
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
                    reasons.append(f"Price exceeds PO rate by {price_variance_pct}% (tolerance: ±{payload.price_tolerance_pct}%)")
                    if inv_price > po_price:
                        suggested_credit += Decimal(str(round((inv_price - po_price) * inv_qty, 2)))

            # Quantity check
            qty_variance_pct = 0.0
            benchmark_qty = grn_accepted if payload.match_mode == "FOUR_WAY" else (grn_received if grn_received > 0 else po_qty)
            if benchmark_qty > 0:
                qty_variance_pct = round(((inv_qty - benchmark_qty) / benchmark_qty) * 100.0, 2)
                if abs(qty_variance_pct) > payload.quantity_tolerance_pct:
                    reasons.append(f"Invoiced quantity exceeds received count by {qty_variance_pct}% (tolerance: ±{payload.quantity_tolerance_pct}%)")
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
            invoice.status = InvoiceStatusEnum.APPROVED
            auto_approved = True
        elif overall_status == "VARIANCE_DETECTED":
            invoice.match_status = "DISCREPANCY"

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

    async def get_reconciliation_dashboard(
        self, db: AsyncSession, org_id: UUID
    ) -> dict[str, Any]:
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


invoice_service = InvoiceService()
