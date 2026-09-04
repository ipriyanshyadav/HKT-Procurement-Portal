"""
Goods Receipt Note (GRN) Service (SPEC_14 / SPEC_17).

Handles:
- Receipt of goods against Purchase Orders (with quantity validation)
- Quality inspection workflow (QC Gate)
- GRN confirmation triggering:
  1. PO receipt recording (po.record_grn_receipt)
  2. 3-Way match invoice eligibility triggering
  3. Vendor scorecard performance metric update
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException, NotFoundError, ValidationError
from app.events.publisher import OutboxPublisher
from app.modules.audit.service import audit_service
from app.modules.grn.models import GoodsReceiptNote, GrnLine, QualityInspection
from app.modules.grn.repository import grn_repository
from app.modules.grn.schemas import (
    GrnCreateRequest,
    GrnFilterParams,
    QualityInspectionCreate,
)
from app.modules.purchase_order.service import purchase_order_service
from app.modules.vendor.schemas import VendorScorecardUpdateRequest
from app.modules.vendor.service import vendor_service


class GrnService:
    """Core domain service for Goods Receipt Note and Quality Inspection."""

    def __init__(self) -> None:
        self.repo = grn_repository
        self.po_service = purchase_order_service
        self.vendor_service = vendor_service
        self.audit = audit_service
        self.publisher = OutboxPublisher

    async def get(
        self,
        db: AsyncSession,
        grn_id: UUID,
        org_id: UUID,
    ) -> GoodsReceiptNote:
        grn = await self.repo.get(db, grn_id, org_id)
        if not grn:
            raise NotFoundError(f"GRN {grn_id} not found")
        return grn

    async def list(
        self,
        db: AsyncSession,
        org_id: UUID,
        filters: GrnFilterParams,
    ) -> Tuple[List[GoodsReceiptNote], int]:
        return await self.repo.list(db, org_id, filters)

    async def create_grn(
        self,
        db: AsyncSession,
        data: GrnCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> GoodsReceiptNote:
        po = await self.po_service.get(db, data.po_id, org_id)

        # Validate PO status: Vendor must have acknowledged PO or PO is released/active
        valid_po_statuses = {
            "RELEASED",
            "SENT_TO_VENDOR",
            "ACKNOWLEDGED",
            "VENDOR_ACKNOWLEDGED",
            "PARTIALLY_RECEIVED",
        }
        po_status_str = po.status.value if hasattr(po.status, "value") else str(po.status)
        if po_status_str not in valid_po_statuses:
            raise AppException(
                "PO_NOT_RELEASED_OR_ACKNOWLEDGED",
                f"Cannot create GRN for PO in {po_status_str} status. Vendor acknowledgment required.",
            )

        receipt_date = data.receipt_date or date.today()
        grn_number = await self.repo.generate_grn_number(db, org_id)

        has_qc_required = False
        lines_to_add: List[GrnLine] = []

        for line_data in data.lines:
            po_line = await self.po_service.repo.get_line(db, line_data.po_line_id, org_id)
            if not po_line:
                raise NotFoundError(f"PO Line {line_data.po_line_id} not found")

            # Validate open quantity: prevent unauthorized over-receipt
            if line_data.received_quantity > po_line.open_quantity:
                raise AppException(
                    "OVER_RECEIPT_EXCEEDED",
                    f"Received quantity {line_data.received_quantity} exceeds open quantity {po_line.open_quantity} for line {po_line.line_number}",
                )

            qc_needed = line_data.qc_required
            if qc_needed:
                has_qc_required = True
                accepted_qty = Decimal("0.0")
                qc_status = "PENDING"
            else:
                accepted_qty = line_data.received_quantity
                qc_status = "NOT_REQUIRED"

            grn_line = GrnLine(
                org_id=org_id,
                po_line_id=line_data.po_line_id,
                received_quantity=line_data.received_quantity,
                accepted_quantity=accepted_qty,
                rejected_quantity=Decimal("0.0"),
                rejection_reason=line_data.rejection_reason,
                qc_required=qc_needed,
                qc_status=qc_status,
            )
            lines_to_add.append(grn_line)

        grn_status = "PENDING_QC" if has_qc_required else "DRAFT"

        grn = GoodsReceiptNote(
            org_id=org_id,
            grn_number=grn_number,
            po_id=po.id,
            vendor_id=po.vendor_id,
            receipt_date=receipt_date,
            received_by=actor_id,
            challan_number=data.challan_number,
            challan_date=data.challan_date,
            transporter_name=data.transporter_name,
            lr_number=data.lr_number,
            status=grn_status,
            notes=data.notes,
            created_by=actor_id,
            updated_by=actor_id,
            lines=lines_to_add,
        )
        await self.repo.create(db, grn)

        await self.publisher.publish(
            db,
            "procurement.grn",
            routing_key="grn.created",
            payload={
                "grn_id": str(grn.id),
                "grn_number": grn.grn_number,
                "po_id": str(po.id),
                "vendor_id": str(po.vendor_id),
                "status": grn.status,
            },
            org_id=org_id,
        )

        await self.audit.log(
            db,
            "GRN",
            grn.id,
            "GRN_CREATED",
            actor_id,
            org_id,
            new_values={"grn_number": grn.grn_number, "status": grn.status},
        )

        return await self.get(db, grn.id, org_id)

    async def quality_inspection(
        self,
        db: AsyncSession,
        data: QualityInspectionCreate,
        inspector_id: UUID,
        org_id: UUID,
    ) -> QualityInspection:
        grn_line = await self.repo.get_line(db, data.grn_line_id, org_id)
        if not grn_line:
            raise NotFoundError(f"GRN Line {data.grn_line_id} not found")

        total_inspected = data.accepted_quantity + data.rejected_quantity
        if total_inspected > grn_line.received_quantity:
            raise ValidationError(
                f"Accepted ({data.accepted_quantity}) + Rejected ({data.rejected_quantity}) "
                f"cannot exceed total received quantity ({grn_line.received_quantity})"
            )

        insp_date = data.inspection_date or date.today()

        qi = QualityInspection(
            org_id=org_id,
            grn_line_id=grn_line.id,
            inspector_id=inspector_id,
            inspection_date=insp_date,
            result=data.result,
            accepted_quantity=data.accepted_quantity,
            rejected_quantity=data.rejected_quantity,
            remarks=data.remarks,
        )
        await self.repo.create_inspection(db, qi)

        grn_line.accepted_quantity = data.accepted_quantity
        grn_line.rejected_quantity = data.rejected_quantity
        grn_line.qc_status = data.result
        grn_line.inspected_at = datetime.now(timezone.utc)
        grn_line.inspected_by = inspector_id

        await db.flush()

        # Check if all lines for the GRN have completed QC
        grn = await self.get(db, grn_line.grn_id, org_id)
        all_qc_done = all(
            line.qc_status in ("PASSED", "REJECTED", "PARTIAL", "NOT_REQUIRED")
            for line in grn.lines
        )
        if all_qc_done and grn.status == "PENDING_QC":
            grn.status = "APPROVED"
            await db.flush()

        await self.publisher.publish(
            db,
            "procurement.grn",
            routing_key="grn.qc_inspected",
            payload={
                "grn_id": str(grn.id),
                "grn_line_id": str(grn_line.id),
                "result": data.result,
                "accepted_quantity": float(data.accepted_quantity),
                "rejected_quantity": float(data.rejected_quantity),
            },
            org_id=org_id,
        )

        await self.audit.log(
            db,
            "GRN",
            grn.id,
            "GRN_QC_INSPECTED",
            inspector_id,
            org_id,
            new_values={
                "line_id": str(grn_line.id),
                "result": data.result,
                "accepted": str(data.accepted_quantity),
                "rejected": str(data.rejected_quantity),
            },
        )

        return qi

    async def confirm_grn(
        self,
        db: AsyncSession,
        grn_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> GoodsReceiptNote:
        grn = await self.get(db, grn_id, org_id)

        # Check for any pending quality inspection
        for line in grn.lines:
            if line.qc_required and line.qc_status == "PENDING":
                raise AppException(
                    "QC_PENDING",
                    f"Cannot confirm GRN: Quality inspection is pending on line {line.id}",
                )

        now = datetime.now(timezone.utc)
        grn.status = "CONFIRMED"
        grn.confirmed_at = now
        grn.confirmed_by = actor_id
        grn.updated_by = actor_id

        # 1. Trigger PO Receipt update
        received_lines = [
            {"po_line_id": line.po_line_id, "quantity": line.accepted_quantity}
            for line in grn.lines
            if line.accepted_quantity > Decimal("0")
        ]
        if received_lines:
            await self.po_service.record_grn_receipt(
                db, grn.po_id, received_lines, org_id
            )

        # 2. Trigger 3-Way Match Invoice Eligibility
        po = await self.po_service.get(db, grn.po_id, org_id)
        invoiceable_lines = []
        for line in grn.lines:
            if line.accepted_quantity > Decimal("0"):
                invoiceable_lines.append(
                    {
                        "po_line_id": str(line.po_line_id),
                        "accepted_quantity": float(line.accepted_quantity),
                    }
                )

        await self.publisher.publish(
            db,
            "procurement.grn",
            routing_key="grn.invoice_eligible",
            payload={
                "grn_id": str(grn.id),
                "grn_number": grn.grn_number,
                "po_id": str(grn.po_id),
                "vendor_id": str(grn.vendor_id),
                "invoiceable_lines": invoiceable_lines,
            },
            org_id=org_id,
        )

        # 3. Update Vendor Scorecard Performance Metrics
        total_received = sum(l.received_quantity for l in grn.lines)
        total_accepted = sum(l.accepted_quantity for l in grn.lines)

        quality_rate = (
            (total_accepted / total_received) * Decimal("100.0")
            if total_received > Decimal("0")
            else Decimal("100.0")
        )

        # Check delivery timeliness
        on_time_rate = Decimal("100.0")
        if po.expected_delivery_date and grn.receipt_date > po.expected_delivery_date:
            days_late = (grn.receipt_date - po.expected_delivery_date).days
            on_time_rate = max(Decimal("0.0"), Decimal("100.0") - Decimal(str(days_late * 5)))

        try:
            await self.vendor_service.update_scorecard(
                db,
                grn.vendor_id,
                org_id,
                VendorScorecardUpdateRequest(
                    on_time_delivery_rate=round(on_time_rate, 2),
                    quality_acceptance_rate=round(quality_rate, 2),
                ),
            )
        except Exception:
            # Scorecard update gracefully handled if vendor sub-module state differs
            pass

        await self.publisher.publish(
            db,
            "procurement.grn",
            routing_key="grn.confirmed",
            payload={
                "grn_id": str(grn.id),
                "grn_number": grn.grn_number,
                "po_id": str(grn.po_id),
            },
            org_id=org_id,
        )

        await self.audit.log(
            db,
            "GRN",
            grn.id,
            "GRN_CONFIRMED",
            actor_id,
            org_id,
            new_values={"status": "CONFIRMED", "confirmed_at": now.isoformat()},
        )

        return grn

    async def cancel_grn(
        self,
        db: AsyncSession,
        grn_id: UUID,
        reason: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> GoodsReceiptNote:
        grn = await self.get(db, grn_id, org_id)
        if grn.status == "CONFIRMED":
            raise AppException("GRN_ALREADY_CONFIRMED", "Cannot cancel an already confirmed GRN")

        grn.status = "CANCELLED"
        grn.notes = f"{grn.notes or ''} [Cancelled: {reason}]"
        grn.updated_by = actor_id

        await self.audit.log(
            db,
            "GRN",
            grn.id,
            "GRN_CANCELLED",
            actor_id,
            org_id,
            new_values={"status": "CANCELLED", "reason": reason},
        )

        return grn


grn_service = GrnService()
