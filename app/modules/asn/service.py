from __future__ import annotations

import builtins
from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException, ForbiddenError, NotFoundError, ValidationError
from app.events.publisher import OutboxPublisher
from app.modules.asn.models import AdvanceShippingNotice, AsnLine
from app.modules.asn.repository import asn_repository
from app.modules.asn.schemas import (
    AsnCreateRequest,
    AsnDispatchPayload,
    AsnFastGrnRequest,
    AsnFilterParams,
)
from app.modules.audit.service import audit_service
from app.modules.grn.models import GoodsReceiptNote
from app.modules.grn.schemas import GrnCreateRequest, GrnLineCreate
from app.modules.grn.service import grn_service
from app.modules.purchase_order.service import purchase_order_service

VALID_PO_STATUSES_FOR_ASN = {
    "RELEASED",
    "SENT_TO_VENDOR",
    "ACKNOWLEDGED",
    "VENDOR_ACKNOWLEDGED",
    "PARTIALLY_RECEIVED",
}


class AsnService:
    """Domain service for Advance Shipping Notices and Warehouse Fast-Track Intake."""

    def __init__(self) -> None:
        self.repo = asn_repository
        self.po_service = purchase_order_service
        self.grn_service = grn_service
        self.audit = audit_service
        self.publisher = OutboxPublisher

    async def get(
        self,
        db: AsyncSession,
        asn_id: UUID,
        org_id: UUID,
    ) -> AdvanceShippingNotice:
        asn = await self.repo.get(db, asn_id, org_id)
        if not asn:
            raise NotFoundError(f"Advance Shipping Notice {asn_id} not found")
        return asn

    async def get_by_number(
        self,
        db: AsyncSession,
        asn_number: str,
        org_id: UUID,
    ) -> AdvanceShippingNotice:
        asn = await self.repo.get_by_number(db, asn_number, org_id)
        if not asn:
            raise NotFoundError(f"Advance Shipping Notice {asn_number} not found")
        return asn

    async def list(
        self,
        db: AsyncSession,
        org_id: UUID,
        filters: AsnFilterParams,
        vendor_id: UUID | None = None,
    ) -> tuple[builtins.list[AdvanceShippingNotice], int]:
        return await self.repo.list(db, org_id, filters, vendor_id=vendor_id)

    async def create_asn(
        self,
        db: AsyncSession,
        data: AsnCreateRequest,
        actor_id: UUID,
        org_id: UUID,
        vendor_id: UUID | None = None,
    ) -> AdvanceShippingNotice:
        po = await self.po_service.get(db, data.po_id, org_id)

        # Ensure vendor isolation if caller is a vendor user
        if vendor_id and po.vendor_id != vendor_id:
            raise ForbiddenError("Supplier can only generate ASNs against their own Purchase Orders")

        po_status_str = po.status.value if hasattr(po.status, "value") else str(po.status)
        if po_status_str not in VALID_PO_STATUSES_FOR_ASN:
            raise AppException(
                "PO_NOT_READY_FOR_SHIPMENT",
                f"Cannot create ASN for PO in status {po_status_str}. Order must be released and acknowledged.",
            )

        shipment_date = data.shipment_date or date.today()
        if data.expected_delivery_date < shipment_date:
            raise ValidationError("Expected delivery date cannot precede shipment date")

        asn_number = await self.repo.generate_asn_number(db, org_id)
        barcode_data = f"ASN|{asn_number}|PO:{po.po_number}|VN:{po.vendor_id}|PKGS:{data.package_count}"

        lines_to_add: list[AsnLine] = []
        for line_data in data.lines:
            po_line = await self.po_service.repo.get_line(db, line_data.po_line_id, org_id)
            if not po_line or po_line.po_id != po.id:
                raise NotFoundError(f"PO Line {line_data.po_line_id} not found on PO {po.po_number}")

            if line_data.shipped_quantity <= Decimal("0"):
                raise ValidationError("Shipped quantity must be greater than zero")

            if line_data.shipped_quantity > po_line.open_quantity:
                raise AppException(
                    "OVER_SHIPPING_EXCEEDED",
                    f"Shipped quantity {line_data.shipped_quantity} exceeds remaining open quantity {po_line.open_quantity} for line item {po_line.item_description}",
                )

            asn_line = AsnLine(
                org_id=org_id,
                po_line_id=po_line.id,
                item_code=po_line.item_code,
                item_description=po_line.item_description,
                uom=getattr(po_line, "uom", "UNIT") or "UNIT",
                ordered_quantity=po_line.ordered_quantity,
                shipped_quantity=line_data.shipped_quantity,
                received_quantity=Decimal("0.0"),
                lot_number=line_data.lot_number,
                serial_numbers=line_data.serial_numbers or [],
                expiry_date=line_data.expiry_date,
                manufacturing_date=line_data.manufacturing_date,
            )
            lines_to_add.append(asn_line)

        now = datetime.now(UTC)
        asn = AdvanceShippingNotice(
            org_id=org_id,
            asn_number=asn_number,
            po_id=po.id,
            vendor_id=po.vendor_id,
            shipment_date=shipment_date,
            expected_delivery_date=data.expected_delivery_date,
            carrier_name=data.carrier_name,
            tracking_number=data.tracking_number,
            vehicle_number=data.vehicle_number,
            driver_name=data.driver_name,
            driver_phone=data.driver_phone,
            packaging_type=data.packaging_type,
            package_count=data.package_count,
            gross_weight_kg=data.gross_weight_kg,
            status="SHIPPED",
            barcode_data=barcode_data,
            notes=data.notes,
            shipped_at=now,
            created_by=actor_id,
            updated_by=actor_id,
            lines=lines_to_add,
        )

        await self.repo.create(db, asn)

        await self.publisher.publish(
            db,
            "procurement.asn",
            routing_key="asn.created",
            payload={
                "asn_id": str(asn.id),
                "asn_number": asn.asn_number,
                "po_id": str(po.id),
                "vendor_id": str(po.vendor_id),
                "tracking_number": asn.tracking_number,
                "carrier_name": asn.carrier_name,
                "barcode_data": asn.barcode_data,
            },
            org_id=org_id,
        )

        await self.audit.log(
            db,
            "ASN",
            asn.id,
            "ASN_CREATED",
            actor_id,
            org_id,
            new_values={
                "asn_number": asn.asn_number,
                "po_id": str(po.id),
                "carrier": asn.carrier_name,
                "tracking_number": asn.tracking_number,
            },
        )

        return await self.get(db, asn.id, org_id)

    async def dispatch_asn(
        self,
        db: AsyncSession,
        asn_id: UUID,
        data: AsnDispatchPayload,
        actor_id: UUID,
        org_id: UUID,
    ) -> AdvanceShippingNotice:
        asn = await self.get(db, asn_id, org_id)
        if asn.status == "RECEIVED":
            raise AppException(
                "ASN_ALREADY_RECEIVED", "Cannot dispatch an ASN that has already been received at the warehouse"
            )

        now = datetime.now(UTC)
        if data.carrier_name:
            asn.carrier_name = data.carrier_name
        if data.tracking_number:
            asn.tracking_number = data.tracking_number
        if data.vehicle_number:
            asn.vehicle_number = data.vehicle_number
        if data.notes:
            asn.notes = f"{asn.notes or ''}\n{data.notes}".strip()

        asn.status = "SHIPPED"
        asn.shipped_at = now
        asn.updated_by = actor_id

        await db.flush()

        await self.publisher.publish(
            db,
            "procurement.asn",
            routing_key="asn.dispatched",
            payload={"asn_id": str(asn.id), "asn_number": asn.asn_number, "status": asn.status},
            org_id=org_id,
        )

        await self.audit.log(
            db,
            "ASN",
            asn.id,
            "ASN_DISPATCHED",
            actor_id,
            org_id,
            new_values={"status": asn.status, "shipped_at": now.isoformat()},
        )

        return asn

    async def scan_lookup(
        self,
        db: AsyncSession,
        code: str,
        org_id: UUID,
    ) -> AdvanceShippingNotice:
        asn = await self.repo.lookup_by_code(db, code, org_id)
        if not asn:
            raise NotFoundError(f"No Advance Shipping Notice found matching scan code: {code}")
        return asn

    async def fast_grn_intake(
        self,
        db: AsyncSession,
        asn_id: UUID,
        data: AsnFastGrnRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> tuple[AdvanceShippingNotice, GoodsReceiptNote]:
        asn = await self.get(db, asn_id, org_id)

        if asn.status == "RECEIVED":
            raise AppException(
                "ASN_ALREADY_RECEIVED",
                f"ASN {asn.asn_number} has already been received into warehouse under GRN #{asn.grn_id}",
            )

        if not asn.lines:
            raise ValidationError("ASN has no line items to receive")

        # 1. Prepare GRN creation request from ASN details
        grn_lines: list[GrnLineCreate] = []
        for line in asn.lines:
            if line.shipped_quantity > Decimal("0"):
                grn_lines.append(
                    GrnLineCreate(
                        po_line_id=line.po_line_id,
                        received_quantity=line.shipped_quantity,
                        qc_required=False,
                    )
                )

        challan_no = data.challan_number or asn.asn_number
        grn_req = GrnCreateRequest(
            po_id=asn.po_id,
            receipt_date=date.today(),
            challan_number=challan_no,
            challan_date=asn.shipment_date,
            transporter_name=asn.carrier_name,
            lr_number=asn.tracking_number,
            notes=data.notes or f"Fast-track barcode intake from ASN {asn.asn_number}",
            lines=grn_lines,
        )

        # 2. Atomically create GRN and confirm receipt
        grn = await self.grn_service.create_grn(db, grn_req, actor_id, org_id)
        confirmed_grn = await self.grn_service.confirm_grn(db, grn.id, actor_id, org_id)

        # 3. Update ASN status to RECEIVED and link GRN
        now = datetime.now(UTC)
        asn.status = "RECEIVED"
        asn.received_at = now
        asn.grn_id = confirmed_grn.id
        asn.updated_by = actor_id

        for line in asn.lines:
            line.received_quantity = line.shipped_quantity

        await db.flush()

        await self.publisher.publish(
            db,
            "procurement.asn",
            routing_key="asn.received",
            payload={
                "asn_id": str(asn.id),
                "asn_number": asn.asn_number,
                "grn_id": str(confirmed_grn.id),
                "grn_number": confirmed_grn.grn_number,
            },
            org_id=org_id,
        )

        await self.audit.log(
            db,
            "ASN",
            asn.id,
            "ASN_RECEIVED",
            actor_id,
            org_id,
            new_values={
                "asn_number": asn.asn_number,
                "grn_number": confirmed_grn.grn_number,
                "status": asn.status,
            },
        )

        return asn, confirmed_grn


asn_service = AsnService()
