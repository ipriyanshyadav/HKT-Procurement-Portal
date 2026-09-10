"""
Purchase Order Service (SPEC_14).

Core domain service managing the entire PO lifecycle:
- Creation from RFQ award or direct from contract
- Price validation against award (0.1% tolerance)
- Approval routing and threshold checks
- ERP outbox event publishing
- Vendor release, PDF generation, and acknowledgment/rejection
- Formal versioned amendments
- GRN receipt tracking and open quantity decrements
- Auto-closure when fully received and matched
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AppException, NotFoundError, ValidationError
from app.core.metrics import po_value_total
from app.db.enums import POStatus
from app.events.publisher import OutboxPublisher
from app.modules.approval_rules.service import rules_engine
from app.modules.audit.service import audit_service
from app.modules.contract.service import contract_service
from app.modules.evaluation.repository import award_repository
from app.modules.purchase_order.fsm import can_transition, validate_po_transition
from app.modules.purchase_order.models import PoAmendment, PoLine, PurchaseOrder
from app.modules.purchase_order.pdf_generator import po_pdf_generator
from app.modules.purchase_order.repository import purchase_order_repository
from app.modules.purchase_order.schemas import (
    POAmendRequest,
    POCreateRequest,
    POFilterParams,
    POFromAwardRequest,
    POLineCreate,
)
from app.modules.sourcing.repository import rfq_repository
from app.modules.workflow.service import workflow_engine


class PurchaseOrderService:
    """Domain service for Purchase Order operations."""

    def __init__(self) -> None:
        self.repo = purchase_order_repository
        self.rfq_repo = rfq_repository
        self.award_repo = award_repository
        self.contract_service = contract_service
        self.audit = audit_service
        self.rules_engine = rules_engine
        self.workflow_engine = workflow_engine
        self.pdf_generator = po_pdf_generator
        self.publisher = OutboxPublisher

    async def get(
        self,
        db: AsyncSession,
        po_id: UUID,
        org_id: UUID,
    ) -> PurchaseOrder:
        po = await self.repo.get(db, po_id, org_id)
        if not po:
            raise NotFoundError(f"Purchase order {po_id} not found")
        return po

    async def list(
        self,
        db: AsyncSession,
        org_id: UUID,
        filters: POFilterParams,
    ) -> Tuple[List[PurchaseOrder], int]:
        return await self.repo.list(db, org_id, filters)

    async def create(
        self,
        db: AsyncSession,
        data: POCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> PurchaseOrder:
        # Validate direct PO justification
        if not data.rfq_id and not data.contract_id and not data.deviation_justification:
            raise ValidationError(
                "Direct PO without RFQ or Contract requires justification."
            )

        # Validate RFQ if specified
        if data.rfq_id:
            rfq = await self.rfq_repo.get(db, data.rfq_id, org_id)
            if not rfq:
                raise NotFoundError(f"RFQ {data.rfq_id} not found")

        # Validate price deviation across lines
        total_val = Decimal("0.0")
        for idx, line in enumerate(data.lines, 1):
            if line.awarded_unit_price and line.awarded_unit_price > 0:
                deviation = abs(line.unit_price - line.awarded_unit_price) / line.awarded_unit_price
                if deviation > Decimal(str(settings.PO_PRICE_DEVIATION_TOLERANCE)) and not data.deviation_justification:
                    raise AppException(
                        "PRICE_DEVIATION",
                        f"Line {idx}: price deviation {float(deviation):.2%} exceeds tolerance. Justification required.",
                    )
            total_val += line.ordered_quantity * line.unit_price

        # Update contract utilization if rate contract linked
        if data.contract_id:
            await self.contract_service.update_utilization(
                db, data.contract_id, float(total_val), org_id
            )

        po_number = await self.repo.generate_po_number(db, data.business_unit_id, org_id)

        # Auto-approve if <= threshold from settings
        auto_approve_threshold = Decimal(str(settings.PO_AUTO_APPROVE_THRESHOLD))
        initial_status = POStatus.APPROVED if total_val <= auto_approve_threshold else POStatus.PENDING_APPROVAL

        lines_to_add = []
        for idx, line_data in enumerate(data.lines, 1):
            po_line = PoLine(
                org_id=org_id,
                line_number=idx,
                item_description=line_data.item_description,
                item_code=line_data.item_code,
                uom_id=line_data.uom_id,
                ordered_quantity=line_data.ordered_quantity,
                unit_price=line_data.unit_price,
                awarded_unit_price=line_data.awarded_unit_price,
                hsn_code=line_data.hsn_code,
                tax_rate=line_data.tax_rate,
                open_quantity=line_data.ordered_quantity,
                received_quantity=Decimal("0.0"),
                invoiced_quantity=Decimal("0.0"),
                delivery_date=line_data.delivery_date,
            )
            lines_to_add.append(po_line)

        po = PurchaseOrder(
            org_id=org_id,
            po_number=po_number,
            title=data.title,
            vendor_id=data.vendor_id,
            rfq_id=data.rfq_id,
            arn_id=data.arn_id,
            source_pr_id=data.source_pr_id,
            contract_id=data.contract_id,
            status=initial_status,
            business_unit_id=data.business_unit_id,
            plant_id=data.plant_id,
            category_id=data.category_id,
            currency=data.currency,
            total_value=total_val,
            payment_term_id=data.payment_term_id,
            incoterm_id=data.incoterm_id,
            delivery_location_id=data.delivery_location_id,
            expected_delivery_date=data.expected_delivery_date,
            buyer_id=actor_id,
            deviation_justification=data.deviation_justification,
            created_by=actor_id,
            updated_by=actor_id,
            lines=lines_to_add,
        )
        await self.repo.create(db, po)
        if data.source_pr_id:
            from app.modules.requisition.repository import requisition_repository
            from app.db.enums import PRStatus
            source_pr = await requisition_repository.get(db, data.source_pr_id, org_id)
            if source_pr and source_pr.status in (PRStatus.APPROVED, PRStatus.IN_SOURCING):
                source_pr.status = PRStatus.CONVERTED
        await db.flush()

        # Approval Workflow
        entity_context = {
            "amount": float(po.total_value),
            "bu_id": str(po.business_unit_id),
            "vendor_id": str(po.vendor_id),
            "has_contract": po.contract_id is not None,
            "has_rfq": po.rfq_id is not None,
        }

        if initial_status == POStatus.PENDING_APPROVAL:
            rule = await self.rules_engine.find_matching_rule(db, "PO", entity_context, org_id)
            if rule:
                await self.workflow_engine.instantiate(
                    db,
                    rule.workflow_template_code,
                    "PURCHASE_ORDER",
                    po.id,
                    entity_context,
                    org_id,
                    actor_id,
                )

        # Publish outbox event
        await self.publisher.publish(
            db,
            "procurement.po",
            routing_key="po.created",
            payload={
                "po_id": str(po.id),
                "po_number": po.po_number,
                "vendor_id": str(po.vendor_id),
                "total_value": float(po.total_value),
                "currency": po.currency,
            },
            org_id=org_id,
        )

        await self.audit.log(
            db,
            "PURCHASE_ORDER",
            po.id,
            "PO_CREATED",
            actor_id,
            org_id,
            new_values={"po_number": po.po_number, "total_value": str(po.total_value)},
        )

        po_value_total.labels(org_id=str(org_id), currency=str(po.currency)).inc(float(po.total_value))

        return po

    async def create_from_award(
        self,
        db: AsyncSession,
        data: POFromAwardRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> List[PurchaseOrder]:
        arn = await self.award_repo.get(db, data.arn_id, org_id)
        if not arn:
            raise NotFoundError(f"Award recommendation {data.arn_id} not found")
        if getattr(arn, "status", None) != "APPROVED":
            raise AppException(
                "AWARD_NOT_APPROVED",
                "Award recommendation must be approved before generating purchase order",
            )

        rfq = await self.rfq_repo.get(db, arn.rfq_id, org_id)
        if not rfq:
            raise NotFoundError(f"RFQ {arn.rfq_id} not found")

        award_details = arn.details
        if not award_details:
            raise ValidationError(f"No award lines found for ARN {arn.id}")

        rfq_line_map = {l.id: l for l in getattr(rfq, "lines", [])}

        # Group by vendor to handle single and split awards
        by_vendor: Dict[UUID, List[Any]] = {}
        for d in award_details:
            by_vendor.setdefault(d.vendor_id, []).append(d)

        created_pos: List[PurchaseOrder] = []

        for vendor_id, details in by_vendor.items():
            lines_create: List[POLineCreate] = []
            for d in details:
                line_obj = rfq_line_map.get(d.rfq_line_id)
                item_desc = line_obj.item_description if line_obj else f"Item {d.rfq_line_id}"
                uom_id = (line_obj.uom_id if line_obj else None) or (rfq.lines[0].uom_id if rfq.lines else None)
                lines_create.append(
                    POLineCreate(
                        item_description=item_desc,
                        uom_id=uom_id,
                        ordered_quantity=d.awarded_quantity,
                        unit_price=d.awarded_unit_price,
                        awarded_unit_price=d.awarded_unit_price,
                        tax_rate=getattr(d, "tax_rate", Decimal("0.0")),
                    )
                )

            po_create_req = POCreateRequest(
                title=f"PO from Award {getattr(arn, 'arn_number', None) or arn.id}",
                vendor_id=vendor_id,
                business_unit_id=rfq.business_unit_id,
                category_id=rfq.category_id,
                currency=rfq.currency,
                lines=lines_create,
                rfq_id=rfq.id,
                arn_id=arn.id,
                source_pr_id=getattr(rfq, "source_pr_id", None),
                plant_id=getattr(rfq, "plant_id", None),
                payment_term_id=getattr(rfq, "payment_term_id", None),
                incoterm_id=getattr(rfq, "incoterm_id", None),
                delivery_location_id=getattr(rfq, "delivery_location_id", None),
                deviation_justification=data.deviation_justification,
            )

            po = await self.create(db, po_create_req, actor_id, org_id)
            created_pos.append(po)

        return created_pos

    async def approve(
        self,
        db: AsyncSession,
        po_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> PurchaseOrder:
        po = await self.get(db, po_id, org_id)
        validate_po_transition(po.status, POStatus.APPROVED)

        po.status = POStatus.APPROVED
        po.updated_by = actor_id

        await self.publisher.publish(
            db,
            "procurement.po",
            routing_key="po.approved",
            payload={"po_id": str(po.id), "po_number": po.po_number},
            org_id=org_id,
        )

        await self.audit.log(
            db,
            "PURCHASE_ORDER",
            po.id,
            "PO_APPROVED",
            actor_id,
            org_id,
        )

        return po

    async def reject(
        self,
        db: AsyncSession,
        po_id: UUID,
        rejection_reason: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> PurchaseOrder:
        po = await self.get(db, po_id, org_id)
        validate_po_transition(po.status, POStatus.REJECTED)

        po.status = POStatus.REJECTED
        po.rejected_reason = rejection_reason
        po.updated_by = actor_id

        await self.publisher.publish(
            db,
            "procurement.po",
            routing_key="po.rejected",
            payload={"po_id": str(po.id), "reason": rejection_reason},
            org_id=org_id,
        )

        await self.audit.log(
            db,
            "PURCHASE_ORDER",
            po.id,
            "PO_REJECTED",
            actor_id,
            org_id,
            new_values={"rejected_reason": rejection_reason},
        )

        return po

    async def send_to_vendor(
        self,
        db: AsyncSession,
        po_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> PurchaseOrder:
        po = await self.get(db, po_id, org_id)
        validate_po_transition(po.status, POStatus.RELEASED)

        # Generate official PO PDF and store in MinIO
        try:
            pdf_path = await self.pdf_generator.generate(po, org_id, lines=po.lines)
            po.po_document_path = pdf_path
        except Exception as e:
            logger.warning("PO PDF generation failed for {}: {}", po.id, e)

        po.status = POStatus.RELEASED
        po.sent_at = datetime.now(timezone.utc)
        po.updated_by = actor_id

        # Write to outbox for ERP Sync & Vendor Notification
        await self.publisher.publish(
            db,
            "procurement.notification",
            routing_key="notification.po.released",
            payload={
                "vendor_id": str(po.vendor_id),
                "po_id": str(po.id),
                "po_number": po.po_number,
                "total_value": float(po.total_value),
                "currency": po.currency,
                "document_path": po.po_document_path,
            },
            org_id=org_id,
        )

        await self.publisher.publish(
            db,
            "procurement.po",
            routing_key="po.sent_to_vendor",
            payload={"po_id": str(po.id), "erp_sync_required": True},
            org_id=org_id,
        )

        await self.audit.log(
            db,
            "PURCHASE_ORDER",
            po.id,
            "PO_RELEASED",
            actor_id,
            org_id,
        )

        return po

    async def record_vendor_acknowledgement(
        self,
        db: AsyncSession,
        po_id: UUID,
        accepted: bool,
        rejection_reason: Optional[str],
        actor_id: UUID,
        org_id: UUID,
    ) -> PurchaseOrder:
        po = await self.get(db, po_id, org_id)
        target = POStatus.ACKNOWLEDGED if accepted else POStatus.REJECTED_BY_SUPPLIER
        validate_po_transition(po.status, target)

        now = datetime.now(timezone.utc)
        po.status = target
        po.updated_by = actor_id

        if accepted:
            po.acknowledged_at = now
            po.vendor_acknowledged_at = now
        else:
            po.rejected_reason = rejection_reason
            po.vendor_rejection_reason = rejection_reason
            await self.publisher.publish(
                db,
                "procurement.po",
                routing_key="po.vendor_rejected",
                payload={"po_id": str(po.id), "reason": rejection_reason},
                org_id=org_id,
            )

        await self.audit.log(
            db,
            "PURCHASE_ORDER",
            po.id,
            f"PO_{target.value}",
            actor_id,
            org_id,
            new_values={"accepted": accepted, "rejection_reason": rejection_reason},
        )

        return po

    async def amend_po(
        self,
        db: AsyncSession,
        po_id: UUID,
        data: POAmendRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> PurchaseOrder:
        po = await self.get(db, po_id, org_id)

        val_change = data.value_change or Decimal("0.0")
        val_change_pct = (val_change / po.total_value) if po.total_value > 0 else Decimal("0.0")
        re_approval = val_change_pct > Decimal(str(settings.PO_AMENDMENT_REAPPROVAL_THRESHOLD_PCT))

        next_amendment_num = await self.repo.next_amendment_number(db, po.id, org_id)

        amendment = PoAmendment(
            org_id=org_id,
            po_id=po.id,
            amendment_number=next_amendment_num,
            reason=data.reason,
            field_changes=data.field_changes,
            value_change=val_change,
            re_approval_required=re_approval,
            amended_by=actor_id,
        )
        await self.repo.create_amendment(db, amendment)

        po.amendment_count += 1
        po.total_value += val_change
        po.updated_by = actor_id

        # Check rate contract utilization change
        if po.contract_id and val_change > 0:
            await self.contract_service.update_utilization(
                db, po.contract_id, float(val_change), org_id
            )

        if re_approval:
            po.status = POStatus.PENDING_APPROVAL
        else:
            po.status = POStatus.AMENDED

        await self.publisher.publish(
            db,
            "procurement.po",
            routing_key="po.amended",
            payload={
                "po_id": str(po.id),
                "amendment_number": next_amendment_num,
                "re_approval_required": re_approval,
            },
            org_id=org_id,
        )

        await self.audit.log(
            db,
            "PURCHASE_ORDER",
            po.id,
            "PO_AMENDED",
            actor_id,
            org_id,
            new_values={"amendment_number": next_amendment_num, "value_change": str(val_change)},
        )

        return po

    async def record_grn_receipt(
        self,
        db: AsyncSession,
        po_id: UUID,
        received_lines: List[Dict[str, Any]],
        org_id: UUID,
    ) -> PurchaseOrder:
        """
        Invoked when a Goods Receipt Note (GRN) is confirmed.
        Updates line received & open quantities, and transitions PO status.
        """
        po = await self.get(db, po_id, org_id)

        for item in received_lines:
            line_id = item["po_line_id"]
            qty = Decimal(str(item["quantity"]))
            line = await self.repo.get_line(db, line_id, org_id)
            if line:
                line.received_quantity = (line.received_quantity or Decimal("0")) + qty
                line.open_quantity = max(Decimal("0"), line.ordered_quantity - line.received_quantity)

        # Check if all lines are fully received
        all_received = all(
            (line.received_quantity or Decimal("0")) >= line.ordered_quantity
            for line in po.lines
        )

        target_status = POStatus.FULLY_RECEIVED if all_received else POStatus.PARTIALLY_RECEIVED
        if can_transition(po.status, target_status):
            po.status = target_status

        await self.publisher.publish(
            db,
            "procurement.po",
            routing_key="po.receipt_recorded",
            payload={
                "po_id": str(po.id),
                "status": po.status.value if hasattr(po.status, "value") else str(po.status),
                "all_received": all_received,
            },
            org_id=org_id,
        )

        await self.audit.log(
            db,
            "PURCHASE_ORDER",
            po.id,
            f"PO_{po.status.value if hasattr(po.status, 'value') else str(po.status)}",
            None,
            org_id,
        )

        return po

    async def close_po(
        self,
        db: AsyncSession,
        po_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> PurchaseOrder:
        po = await self.get(db, po_id, org_id)
        validate_po_transition(po.status, POStatus.CLOSED)

        # Validate that all lines are received
        for line in po.lines:
            if line.open_quantity > Decimal("0"):
                raise ValidationError(
                    f"Cannot close PO: Line {line.line_number} has {line.open_quantity} unreceived items."
                )

        po.status = POStatus.CLOSED
        po.updated_by = actor_id

        await self.publisher.publish(
            db,
            "procurement.po",
            routing_key="po.closed",
            payload={"po_id": str(po.id)},
            org_id=org_id,
        )

        await self.audit.log(
            db,
            "PURCHASE_ORDER",
            po.id,
            "PO_CLOSED",
            actor_id,
            org_id,
        )

        return po

    async def cancel_po(
        self,
        db: AsyncSession,
        po_id: UUID,
        cancellation_reason: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> PurchaseOrder:
        po = await self.get(db, po_id, org_id)
        validate_po_transition(po.status, POStatus.CANCELLED)

        # Release contract value utilization if linked
        if po.contract_id and po.total_value > 0:
            await self.contract_service.update_utilization(
                db, po.contract_id, -float(po.total_value), org_id
            )

        po.status = POStatus.CANCELLED
        po.cancellation_reason = cancellation_reason
        po.updated_by = actor_id

        await self.publisher.publish(
            db,
            "procurement.po",
            routing_key="po.cancelled",
            payload={"po_id": str(po.id), "reason": cancellation_reason},
            org_id=org_id,
        )

        await self.audit.log(
            db,
            "PURCHASE_ORDER",
            po.id,
            "PO_CANCELLED",
            actor_id,
            org_id,
            new_values={"cancellation_reason": cancellation_reason},
        )

        return po


purchase_order_service = PurchaseOrderService()
