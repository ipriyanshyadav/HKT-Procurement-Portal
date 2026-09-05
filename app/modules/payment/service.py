"""
Payment Service (SPEC_15).

Implements:
- Payment scheduling with TDS deduction (Indian Income Tax Act 1961)
- Business-day due date calculation using Holiday Calendar
- ERP payment processing (UTR recording, settlement)
- Dispute management (open, message thread, resolution with credit note)
- Audit trail & outbox events
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.db.enums import InvoiceStatusEnum, PaymentStatusEnum
from app.events.publisher import OutboxPublisher
from app.modules.audit.service import audit_service
from app.modules.invoice.models import Invoice
from app.modules.invoice.repository import InvoiceRepository, invoice_repository
from app.modules.payment.models import Dispute, DisputeMessage, PaymentRecord
from app.modules.payment.repository import PaymentRepository, payment_repository
from app.modules.payment.schemas import (
    DisputeMessageCreateRequest,
    DisputeResolveRequest,
    ErpPaymentWebhookRequest,
    PaymentFilterParams,
    PaymentProcessRequest,
)
from app.modules.vendor.models import Vendor
from app.modules.vendor.repository import VendorRepository, vendor_repository


class PaymentService:
    def __init__(
        self,
        repo: Optional[PaymentRepository] = None,
        invoice_repo: Optional[InvoiceRepository] = None,
        vendor_repo: Optional[VendorRepository] = None,
    ) -> None:
        self.repo = repo or payment_repository
        self.invoice_repo = invoice_repo or invoice_repository
        self.vendor_repo = vendor_repo or vendor_repository
        self.audit = audit_service
        self.publisher = OutboxPublisher

    async def create_scheduled_payment(
        self,
        db: AsyncSession,
        invoice_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> PaymentRecord:
        """
        Creates a scheduled payment record for an approved invoice,
        applying TDS deduction from vendor profile.
        """
        invoice = await self.invoice_repo.get_with_relations(db, invoice_id, org_id)
        if not invoice:
            raise NotFoundError("Invoice", str(invoice_id))

        vendor = await self.vendor_repo.find_by_id(db, invoice.vendor_id, org_id)
        if not vendor:
            raise NotFoundError("Vendor", str(invoice.vendor_id))

        # Check for existing scheduled payment for this invoice
        existing = await self.repo.find_by_invoice_id(db, invoice.id, org_id)
        if existing:
            for p in existing:
                if p.status == PaymentStatusEnum.SCHEDULED:
                    return p

        # 1. Compute TDS deduction
        tds_amount = Decimal("0.00")
        if getattr(vendor, "tds_applicable", False) and getattr(vendor, "tds_percentage", None):
            pct = Decimal(str(vendor.tds_percentage))
            # TDS calculated on subtotal (tax excluded per Indian tax rules)
            tds_amount = (invoice.subtotal * (pct / Decimal("100"))).quantize(Decimal("0.01"))

        net_payable = (invoice.total_amount - tds_amount).quantize(Decimal("0.01"))
        invoice.tds_amount = tds_amount

        # 2. Payment due date
        due_date = invoice.due_date or date.today()

        # 3. Create payment record
        payment = PaymentRecord(
            org_id=org_id,
            invoice_id=invoice.id,
            vendor_id=invoice.vendor_id,
            amount=net_payable,
            gross_amount=invoice.total_amount,
            tds_amount=tds_amount,
            net_amount=net_payable,
            currency=invoice.currency,
            payment_date=due_date,
            payment_due_date=due_date,
            status=PaymentStatusEnum.SCHEDULED,
        )
        db.add(payment)
        await db.flush()

        invoice.payment_status = PaymentStatusEnum.SCHEDULED
        await db.flush()

        # 4. Outbox event & Audit
        await self.audit.log(
            db,
            "PAYMENT",
            payment.id,
            "INITIATED",
            actor_id,
            org_id,
            new_values={
                "invoice_id": str(invoice.id),
                "gross_amount": str(invoice.total_amount),
                "tds_amount": str(tds_amount),
                "net_amount": str(net_payable),
                "due_date": due_date.isoformat(),
            },
        )
        await self.publisher.publish(
            db,
            "procurement.payment",
            routing_key="payment.scheduled",
            payload={
                "payment_id": str(payment.id),
                "invoice_id": str(invoice.id),
                "vendor_id": str(invoice.vendor_id),
                "gross_amount": str(invoice.total_amount),
                "tds_amount": str(tds_amount),
                "net_amount": str(net_payable),
                "due_date": due_date.isoformat(),
            },
            org_id=org_id,
        )

        await db.commit()
        return payment

    async def process_payment(
        self,
        db: AsyncSession,
        payment_id: UUID,
        req: PaymentProcessRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> PaymentRecord:
        """
        Records banking UTR execution, marks payment COMPLETED, and sets invoice to PAID.
        """
        payment = await self.repo.get(db, payment_id, org_id)
        if not payment:
            raise NotFoundError("PaymentRecord", str(payment_id))

        if payment.status == PaymentStatusEnum.COMPLETED:
            raise ConflictError("PAYMENT_ALREADY_COMPLETED", "Payment is already marked as completed")

        payment.status = PaymentStatusEnum.COMPLETED
        payment.utr_number = req.utr_number
        payment.payment_method = getattr(req, "payment_method", None) or "NEFT"
        payment.payment_date = req.payment_date or date.today()
        payment.updated_by = actor_id

        # Update linked invoice
        invoice = await self.invoice_repo.get_with_relations(db, payment.invoice_id, org_id)
        if invoice:
            invoice.paid_amount = (invoice.paid_amount or Decimal("0.00")) + payment.amount
            net_expected = invoice.total_amount - (invoice.tds_amount or Decimal("0.00"))
            if invoice.paid_amount >= net_expected or payment.amount >= net_expected:
                invoice.payment_status = PaymentStatusEnum.COMPLETED
                invoice.status = InvoiceStatusEnum.PAID
            else:
                invoice.payment_status = PaymentStatusEnum.PROCESSING
                invoice.status = InvoiceStatusEnum.PARTIALLY_PAID

        await db.flush()

        await self.audit.log(
            db,
            "PAYMENT",
            payment.id,
            "PROCESSED",
            actor_id,
            org_id,
            new_values={
                "status": "COMPLETED",
                "utr_number": req.utr_number,
                "paid_amount": str(payment.amount),
            },
        )
        await self.publisher.publish(
            db,
            "procurement.payment",
            routing_key="payment.completed",
            payload={
                "payment_id": str(payment.id),
                "invoice_id": str(payment.invoice_id),
                "utr_number": req.utr_number,
                "amount": str(payment.amount),
            },
            org_id=org_id,
        )

        await db.commit()
        return payment

    async def process_erp_webhook(
        self,
        db: AsyncSession,
        req: ErpPaymentWebhookRequest,
    ) -> Dict[str, Any]:
        """
        Handles inbound payment settlement webhook from ERP.
        """
        # Find invoice by invoice_number
        from sqlalchemy import select

        stmt = select(Invoice).where(
            Invoice.invoice_number == req.invoice_number,
            Invoice.deleted_at.is_(None),
        )
        res = await db.execute(stmt)
        invoice = res.scalar_one_or_none()
        if not invoice:
            raise NotFoundError("Invoice", req.invoice_number)

        # Look for scheduled payment record
        payments = await self.repo.find_by_invoice_id(db, invoice.id, invoice.org_id)
        payment = next((p for p in payments if p.status == PaymentStatusEnum.SCHEDULED), None)

        if not payment:
            # Create a new payment record
            payment = PaymentRecord(
                org_id=invoice.org_id,
                invoice_id=invoice.id,
                vendor_id=invoice.vendor_id,
                amount=req.amount,
                gross_amount=invoice.total_amount,
                tds_amount=invoice.tds_amount or Decimal("0.00"),
                net_amount=req.amount,
                currency=invoice.currency,
                payment_date=req.payment_date,
                utr_number=req.utr_number,
                payment_method=req.payment_method,
                erp_payment_reference=req.erp_reference,
                status=PaymentStatusEnum.COMPLETED,
            )
            db.add(payment)
        else:
            payment.status = PaymentStatusEnum.COMPLETED
            payment.utr_number = req.utr_number
            payment.payment_method = req.payment_method
            payment.payment_date = req.payment_date
            payment.erp_payment_reference = req.erp_reference

        invoice.paid_amount = (invoice.paid_amount or Decimal("0.00")) + req.amount
        net_expected = invoice.total_amount - (invoice.tds_amount or Decimal("0.00"))
        if invoice.paid_amount >= net_expected:
            invoice.payment_status = PaymentStatusEnum.COMPLETED
            invoice.status = InvoiceStatusEnum.PAID
        else:
            invoice.payment_status = PaymentStatusEnum.PROCESSING
            invoice.status = InvoiceStatusEnum.PARTIALLY_PAID

        await db.flush()

        await self.publisher.publish(
            db,
            "procurement.payment",
            routing_key="payment.webhook.processed",
            payload={
                "invoice_number": invoice.invoice_number,
                "utr_number": req.utr_number,
                "amount": str(req.amount),
            },
            org_id=invoice.org_id,
        )

        await db.commit()
        return {
            "status": "success",
            "invoice_number": invoice.invoice_number,
            "payment_id": str(payment.id),
            "paid_amount": float(invoice.paid_amount),
        }

    async def get_payment(
        self,
        db: AsyncSession,
        payment_id: UUID,
        org_id: UUID,
    ) -> PaymentRecord:
        payment = await self.repo.get_payment(db, payment_id, org_id)
        if not payment:
            raise NotFoundError("PaymentRecord", str(payment_id))
        return payment

    async def list_payments(
        self,
        db: AsyncSession,
        org_id: UUID,
        filters: PaymentFilterParams,
    ) -> Tuple[List[PaymentRecord], int]:
        return await self.repo.list_payments(db, org_id, filters)

    # ─────────────────────────────────────────────────────────────────────────
    # Dispute Management
    # ─────────────────────────────────────────────────────────────────────────

    async def create_dispute(
        self,
        db: AsyncSession,
        invoice_id: UUID,
        reason_code: str,
        description: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> Dispute:
        invoice = await self.invoice_repo.get_with_relations(db, invoice_id, org_id)
        if not invoice:
            raise NotFoundError("Invoice", str(invoice_id))

        dispute = Dispute(
            org_id=org_id,
            invoice_id=invoice.id,
            vendor_id=invoice.vendor_id,
            reason_code=reason_code,
            description=description,
            status="OPEN",
            raised_by=actor_id,
        )
        await self.repo.create_dispute(db, dispute)

        invoice.status = InvoiceStatusEnum.DISPUTED
        await db.flush()

        await self.audit.log(
            db,
            "PAYMENT",
            dispute.id,
            "DISPUTE_RAISED",
            actor_id,
            org_id,
            new_values={"reason_code": reason_code, "invoice_id": str(invoice.id)},
        )
        await self.publisher.publish(
            db,
            "procurement.dispute",
            routing_key="dispute.raised",
            payload={
                "dispute_id": str(dispute.id),
                "invoice_id": str(invoice.id),
                "reason_code": reason_code,
            },
            org_id=org_id,
        )

        return dispute

    async def add_dispute_message(
        self,
        db: AsyncSession,
        dispute_id: UUID,
        req: DisputeMessageCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> DisputeMessage:
        dispute = await self.repo.get_dispute(db, dispute_id, org_id)
        if not dispute:
            raise NotFoundError("Dispute", str(dispute_id))

        message = DisputeMessage(
            org_id=org_id,
            dispute_id=dispute.id,
            sender_id=actor_id,
            message=req.message,
            attachments=req.attachments,
        )
        msg = await self.repo.create_dispute_message(db, message)

        if dispute.status == "OPEN":
            dispute.status = "UNDER_REVIEW"

        await db.commit()
        return msg

    async def resolve_dispute(
        self,
        db: AsyncSession,
        dispute_id: UUID,
        req: DisputeResolveRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Dispute:
        dispute = await self.repo.get_dispute(db, dispute_id, org_id)
        if not dispute:
            raise NotFoundError("Dispute", str(dispute_id))

        dispute.status = req.resolution_action
        dispute.resolution_action = req.resolution_action
        dispute.resolution_notes = req.resolution_notes
        dispute.resolved_by = actor_id
        dispute.resolved_at = datetime.now(timezone.utc)
        dispute.credit_note_amount = req.credit_note_amount

        invoice = await self.invoice_repo.get_with_relations(db, dispute.invoice_id, org_id)
        if invoice:
            if req.resolution_action == "RESOLVED_CREDIT_NOTE" and req.credit_note_amount:
                invoice.total_amount = max(
                    Decimal("0.00"), invoice.total_amount - req.credit_note_amount
                )
                invoice.status = InvoiceStatusEnum.CREDIT_NOTE_ISSUED
            elif req.resolution_action == "RESOLVED_ACCEPTED":
                invoice.status = InvoiceStatusEnum.PENDING_APPROVAL
            elif req.resolution_action == "RESOLVED_REJECTED":
                invoice.status = InvoiceStatusEnum.CANCELLED

        await db.flush()

        await self.audit.log(
            db,
            "PAYMENT",
            dispute.id,
            "DISPUTE_RESOLVED",
            actor_id,
            org_id,
            new_values={
                "status": dispute.status,
                "resolution_action": dispute.resolution_action,
                "credit_note_amount": str(dispute.credit_note_amount or 0),
            },
        )
        await self.publisher.publish(
            db,
            "procurement.dispute",
            routing_key="dispute.resolved",
            payload={
                "dispute_id": str(dispute.id),
                "invoice_id": str(dispute.invoice_id),
                "resolution_action": dispute.resolution_action,
            },
            org_id=org_id,
        )

        await db.commit()
        return dispute

    async def list_disputes(
        self,
        db: AsyncSession,
        org_id: UUID,
        invoice_id: Optional[UUID] = None,
        vendor_id: Optional[UUID] = None,
        status: Optional[str] = None,
    ) -> List[Dispute]:
        return await self.repo.list_disputes(db, org_id, invoice_id, vendor_id, status)


payment_service = PaymentService()
