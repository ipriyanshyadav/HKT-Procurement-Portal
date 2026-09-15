"""
Seed realistic Indent and Consignee Delivery data for Default Organization.
Populates:
- Indents across all lifecycle stages: SUBMITTED, PENDING_APPROVAL, APPROVED, IN_SOURCING, CONVERTED, WITHDRAWN
- Linked Purchase Orders (PO-2026-IND001, PO-2026-IND002) linked via source_pr_id
- Linked Goods Receipt Notes (GRN-2026-IND001 in-transit, GRN-2026-IND002 confirmed)
- Direct assignment to Priya Mehta (INDENTOR) and Sarah Jenkins (BUYER)
- Fully populates /indents and /indents/tracking in Buyer Portal.
Safe and idempotent.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import and_, select

from app.db.enums import (
    PoStatusEnum,
    ProcurementTypeEnum,
    PrSourceEnum,
    PrStatusEnum,
)
from app.db.session import async_session
from app.modules.grn.models import GoodsReceiptNote, GrnLine
from app.modules.master_data.models import Category, DeliveryLocation, UomMaster
from app.modules.organization.models import (
    BusinessUnit,
    CostCenter,
    Department,
    Organization,
    Plant,
)
from app.modules.purchase_order.models import PoLine, PurchaseOrder
from app.modules.requisition.models import Requisition, RequisitionLine
from app.modules.user.models import User
from app.modules.vendor.models import Vendor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_ORG_ID = UUID("00000000-0000-0000-0000-000000000001")


async def seed_indents() -> None:
    now_utc = datetime.now(UTC)
    today = date.today()

    async with async_session() as db:
        # 1. Verify Default Organization
        res = await db.execute(select(Organization).where(Organization.id == DEFAULT_ORG_ID))
        org = res.scalar_one_or_none()
        if not org:
            logger.error("Default organization not found. Please run seed_master_data.py first.")
            return

        # 2. Fetch Indentor (Priya Mehta) and Buyer (Sarah Jenkins)
        res = await db.execute(
            select(User).where(and_(User.org_id == DEFAULT_ORG_ID, User.email == "indentor@procurement.com"))
        )
        indentor_user = res.scalar_one_or_none()
        if not indentor_user:
            logger.error("Indentor user indentor@procurement.com not found. Run seed_demo_user.py first.")
            return

        res = await db.execute(
            select(User).where(and_(User.org_id == DEFAULT_ORG_ID, User.email == "buyer@procurement.com"))
        )
        buyer_user = res.scalar_one_or_none()
        if not buyer_user:
            logger.error("Buyer user buyer@procurement.com not found. Run seed_demo_user.py first.")
            return

        # 3. Master Data References
        bu = (await db.execute(select(BusinessUnit).where(BusinessUnit.org_id == DEFAULT_ORG_ID))).scalars().first()
        dept = (await db.execute(select(Department).where(Department.org_id == DEFAULT_ORG_ID))).scalars().first()
        plant = (await db.execute(select(Plant).where(Plant.org_id == DEFAULT_ORG_ID))).scalars().first()
        cc = (await db.execute(select(CostCenter).where(CostCenter.org_id == DEFAULT_ORG_ID))).scalars().first()
        loc = (await db.execute(select(DeliveryLocation).where(DeliveryLocation.org_id == DEFAULT_ORG_ID))).scalars().first()
        uom_unit = (await db.execute(select(UomMaster).where(UomMaster.org_id == DEFAULT_ORG_ID))).scalars().first()

        cats_res = await db.execute(select(Category).where(Category.org_id == DEFAULT_ORG_ID))
        categories = {c.code: c for c in cats_res.scalars().all()}
        fallback_cat = next(iter(categories.values())) if categories else None
        if not fallback_cat:
            logger.error("No categories found. Run seed_master_data.py first.")
            return

        cat_it = categories.get("CAT-IT", fallback_cat)
        cat_hw = categories.get("CAT-HW", fallback_cat)
        cat_off = categories.get("CAT-OFF", fallback_cat)
        cat_maint = categories.get("CAT-MAINT", fallback_cat)

        # Vendor Acme
        res = await db.execute(
            select(Vendor).where(and_(Vendor.org_id == DEFAULT_ORG_ID, Vendor.legal_name.ilike("%Acme%")))
        )
        acme_vendor = res.scalars().first()
        if not acme_vendor:
            acme_vendor = (await db.execute(select(Vendor).where(Vendor.org_id == DEFAULT_ORG_ID))).scalars().first()

        # 4. Helper to get or create Requisition with Lines
        async def get_or_create_indent(
            pr_number: str,
            title: str,
            description: str,
            status: str,
            procurement_type: str,
            source: str,
            estimated_value: Decimal,
            category: Category,
            indent_notes: str,
            lines_data: list[dict],
            approved_at: datetime | None = None,
            created_offset_days: int = 10,
        ) -> Requisition:
            res = await db.execute(
                select(Requisition).where(and_(Requisition.org_id == DEFAULT_ORG_ID, Requisition.pr_number == pr_number))
            )
            existing = res.scalar_one_or_none()
            if existing:
                existing.is_indent = True
                existing.indentor_id = indentor_user.id
                existing.assigned_buyer_id = buyer_user.id
                existing.status = status
                return existing

            indent_pr = Requisition(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                pr_number=pr_number,
                title=title,
                description=description,
                status=status,
                source=source,
                procurement_type=procurement_type,
                requestor_id=indentor_user.id,
                business_unit_id=bu.id,
                cost_center_id=cc.id,
                plant_id=plant.id if plant else None,
                department_id=dept.id if dept else None,
                category_id=category.id,
                currency="INR",
                estimated_value=estimated_value,
                budget_check_status="SUFFICIENT",
                budget_reserved_amount=estimated_value,
                is_emergency=False,
                is_capex=(procurement_type == ProcurementTypeEnum.CAPEX),
                erp_sync_status="NOT_SYNCED",
                aging_alert_level=0,
                delivery_location_id=loc.id if loc else None,
                required_by_date=today + timedelta(days=21),
                is_indent=True,
                indentor_id=indentor_user.id,
                assigned_buyer_id=buyer_user.id,
                indent_notes=indent_notes,
                approved_at=approved_at,
                created_at=now_utc - timedelta(days=created_offset_days),
                updated_at=now_utc - timedelta(days=created_offset_days - 1),
            )
            db.add(indent_pr)
            await db.flush()

            for idx, l in enumerate(lines_data, start=1):
                db.add(
                    RequisitionLine(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        requisition_id=indent_pr.id,
                        line_number=idx,
                        item_description=l["description"],
                        item_code=l.get("item_code"),
                        category_id=category.id,
                        uom_id=uom_unit.id if uom_unit else fallback_cat.id,
                        quantity=Decimal(str(l["qty"])),
                        estimated_unit_price=Decimal(str(l["unit_price"])),
                        hsn_code=l.get("hsn_code", "84713010"),
                        specifications=l.get("specifications"),
                        delivery_location_id=loc.id if loc else None,
                        required_by_date=today + timedelta(days=21),
                        created_at=now_utc - timedelta(days=created_offset_days),
                        updated_at=now_utc - timedelta(days=created_offset_days),
                    )
                )
            await db.flush()
            return indent_pr

        # 5. Seed 7 Indents spanning all statuses
        indents_to_seed = [
            # 1. PO Issued & In-Transit Consignment (Active Delivery)
            {
                "pr_number": "IND-2026-000001",
                "title": 'Dell UltraSharp 32" 4K Video Conferencing Monitors & Soundbars',
                "description": "Consignment for R&D UX Lab expansion workstations.",
                "status": PrStatusEnum.CONVERTED,
                "procurement_type": ProcurementTypeEnum.CAPEX,
                "source": PrSourceEnum.INDENT_CART,
                "estimated_value": Decimal("320000.00"),
                "category": cat_hw,
                "indent_notes": "Urgent display monitors for R&D UX lab workstation expansion. Assigned to Sarah Jenkins for fast-track sourcing.",
                "lines_data": [
                    {
                        "description": 'Dell UltraSharp 32" 4K HDR USB-C Hub Monitor (U3223QE)',
                        "item_code": "HW-MON-001",
                        "qty": 4,
                        "unit_price": 65000.0,
                        "specifications": "4K IPS Black Technology, USB-C 90W PD, RJ45 Ethernet",
                    },
                    {
                        "description": "Dell Pro Wireless Soundbar (SB521A)",
                        "item_code": "HW-SND-002",
                        "qty": 4,
                        "unit_price": 15000.0,
                        "specifications": "Magnetic mount, MS Teams certified, dual mic beamforming",
                    },
                ],
                "approved_at": now_utc - timedelta(days=6),
                "created_offset_days": 8,
            },
            # 2. In Sourcing (Active Delivery)
            {
                "pr_number": "IND-2026-000002",
                "title": "Cisco Catalyst 9300 48-Port PoE+ Core Network Switches",
                "description": "Core networking switches for Plant 2 server rack upgrade.",
                "status": PrStatusEnum.IN_SOURCING,
                "procurement_type": ProcurementTypeEnum.CAPEX,
                "source": PrSourceEnum.CATALOG,
                "estimated_value": Decimal("780000.00"),
                "category": cat_it,
                "indent_notes": "Plant 2 network infrastructure refresh. Sarah Jenkins conducting competitive multi-vendor RFQ.",
                "lines_data": [
                    {
                        "description": "Cisco Catalyst 9300 48-Port PoE+ Layer 3 Switch (C9300-48P)",
                        "item_code": "NET-SW-9300",
                        "qty": 2,
                        "unit_price": 390000.0,
                        "specifications": "Full PoE+, 480 Gbps stacking bandwidth, modular uplinks",
                    }
                ],
                "approved_at": now_utc - timedelta(days=5),
                "created_offset_days": 7,
            },
            # 3. Approved (Ready for Buyer PO Conversion - Active Delivery)
            {
                "pr_number": "IND-2026-000003",
                "title": "Ergonomic High-Back Task Chairs & Electric Sit-Stand Workstation Desks",
                "description": "Department expansion ergonomics demand for hardware design team.",
                "status": PrStatusEnum.APPROVED,
                "procurement_type": ProcurementTypeEnum.OPEX,
                "source": PrSourceEnum.CATALOG,
                "estimated_value": Decimal("245000.00"),
                "category": cat_off,
                "indent_notes": "Department expansion ergonomics demand approved by lead manager.",
                "lines_data": [
                    {
                        "description": "Ergonomic High-Back Task Chair with Dynamic Lumbar Support",
                        "item_code": "FURN-CHR-01",
                        "qty": 10,
                        "unit_price": 14500.0,
                        "specifications": "Adjustable armrests, breathable Korean mesh, ANSI/BIFMA certified",
                    },
                    {
                        "description": "Dual-Motor Electric Sit-Stand Workstation Desk 1400x700mm",
                        "item_code": "FURN-DSK-02",
                        "qty": 5,
                        "unit_price": 20000.0,
                        "specifications": "Dual motor, 3-stage legs, digital memory keypad, anti-collision",
                    },
                ],
                "approved_at": now_utc - timedelta(days=2),
                "created_offset_days": 4,
            },
            # 4. Pending Lead Approver Sign-off
            {
                "pr_number": "IND-2026-000004",
                "title": 'Apple MacBook Pro 16" M3 Max (36GB Unified Memory, 1TB SSD)',
                "description": "High-compute developer workstation upgrade for machine learning team.",
                "status": PrStatusEnum.PENDING_APPROVAL,
                "procurement_type": ProcurementTypeEnum.CAPEX,
                "source": PrSourceEnum.CATALOG,
                "estimated_value": Decimal("990000.00"),
                "category": cat_hw,
                "indent_notes": "Awaiting L2 leadership sign-off for engineering developer kit upgrade.",
                "lines_data": [
                    {
                        "description": 'Apple MacBook Pro 16" M3 Max Space Black / 36GB / 1TB SSD',
                        "item_code": "HW-MBP-16",
                        "qty": 3,
                        "unit_price": 330000.0,
                        "specifications": "Apple M3 Max 14-core CPU, 30-core GPU, Liquid Retina XDR display",
                    }
                ],
                "approved_at": None,
                "created_offset_days": 2,
            },
            # 5. Transferred Demand Cart - Just Submitted
            {
                "pr_number": "IND-2026-000005",
                "title": "Plant Industrial Safety Gear: ANSI Z87 Goggles & Kevlar Work Gloves",
                "description": "Plant operations Q3 safety equipment replenishment transferred from cart.",
                "status": PrStatusEnum.SUBMITTED,
                "procurement_type": ProcurementTypeEnum.OPEX,
                "source": PrSourceEnum.INDENT_CART,
                "estimated_value": Decimal("85000.00"),
                "category": cat_maint,
                "indent_notes": "Auto-transferred demand cart to Sarah Jenkins for fast spot PO placement.",
                "lines_data": [
                    {
                        "description": "ANSI Z87.1 High-Impact Anti-Fog Safety Goggles",
                        "item_code": "SAFE-GOG-01",
                        "qty": 50,
                        "unit_price": 650.0,
                        "specifications": "Polycarbonate lens, UV400 protection, indirect ventilation",
                    },
                    {
                        "description": "Level 5 Cut-Resistant Kevlar Work Gloves",
                        "item_code": "SAFE-GLV-05",
                        "qty": 50,
                        "unit_price": 1050.0,
                        "specifications": "EN388 Level 5 cut rating, nitrile foam palm coating, size Large",
                    },
                ],
                "approved_at": None,
                "created_offset_days": 1,
            },
            # 6. Delivered & Confirmed Receipt
            {
                "pr_number": "IND-2026-000006",
                "title": "HP Color LaserJet Enterprise Flow MFP M578c Multi-Function Network Printer",
                "description": "High-volume departmental network printing station.",
                "status": PrStatusEnum.CONVERTED,
                "procurement_type": ProcurementTypeEnum.CAPEX,
                "source": PrSourceEnum.CATALOG,
                "estimated_value": Decimal("185000.00"),
                "category": cat_off,
                "indent_notes": "Delivered to reception, verified and accepted by Priya Mehta as consignee.",
                "lines_data": [
                    {
                        "description": "HP Color LaserJet Enterprise Flow MFP M578c Printer",
                        "item_code": "OFF-PRN-01",
                        "qty": 1,
                        "unit_price": 185000.0,
                        "specifications": "Color laser, 40 ppm, single-pass two-sided scanning, duplex",
                    }
                ],
                "approved_at": now_utc - timedelta(days=15),
                "created_offset_days": 16,
            },
            # 7. Withdrawn Indent
            {
                "pr_number": "IND-2026-000007",
                "title": "Spare Heavy-Duty Server Rack Air Blower Fans (Duplicate Request)",
                "description": "Withdrawn duplicate request for server room ventilation.",
                "status": PrStatusEnum.WITHDRAWN,
                "procurement_type": ProcurementTypeEnum.OPEX,
                "source": PrSourceEnum.CATALOG,
                "estimated_value": Decimal("18000.00"),
                "category": cat_maint,
                "indent_notes": "Withdrawn: Facilities confirmed duplicate requisition already dispatched.",
                "lines_data": [
                    {
                        "description": "Heavy-Duty 120mm Ball Bearing Server Fan 220V",
                        "item_code": "MAINT-FAN-01",
                        "qty": 4,
                        "unit_price": 4500.0,
                        "specifications": "High airflow 150 CFM, dual ball bearing, aluminium die-cast frame",
                    }
                ],
                "approved_at": None,
                "created_offset_days": 18,
            },
        ]

        seeded_indents: dict[str, Requisition] = {}
        for item in indents_to_seed:
            indent = await get_or_create_indent(**item)
            seeded_indents[indent.pr_number] = indent
            logger.info(f"✅ Indent seeded: {indent.pr_number} - {indent.title} [{indent.status}]")

        # 6. Purchase Order 1 & GRN 1 (In-Transit Delivery for IND-2026-000001)
        ind1 = seeded_indents["IND-2026-000001"]
        res = await db.execute(
            select(PurchaseOrder).where(and_(PurchaseOrder.org_id == DEFAULT_ORG_ID, PurchaseOrder.po_number == "PO-2026-IND001"))
        )
        po_ind1 = res.scalar_one_or_none()
        if not po_ind1 and acme_vendor:
            po_ind1 = PurchaseOrder(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_number="PO-2026-IND001",
                title="Dell UltraSharp 4K Monitors & Soundbars Consignment",
                vendor_id=acme_vendor.id,
                source_pr_id=ind1.id,
                status=PoStatusEnum.ACKNOWLEDGED,
                business_unit_id=bu.id,
                plant_id=plant.id if plant else None,
                category_id=cat_hw.id,
                currency="INR",
                total_value=Decimal("320000.00"),
                delivery_location_id=loc.id if loc else None,
                expected_delivery_date=today + timedelta(days=3),
                buyer_id=buyer_user.id,
                created_by=buyer_user.id,
                sent_at=now_utc - timedelta(days=4),
                acknowledged_at=now_utc - timedelta(days=3),
                vendor_acknowledged_at=now_utc - timedelta(days=3),
                created_at=now_utc - timedelta(days=5),
                updated_at=now_utc - timedelta(days=3),
            )
            db.add(po_ind1)
            await db.flush()

            po1_line1 = PoLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_id=po_ind1.id,
                line_number=1,
                item_description='Dell UltraSharp 32" 4K HDR USB-C Hub Monitor (U3223QE)',
                ordered_quantity=Decimal("4.0000"),
                unit_price=Decimal("65000.00"),
                open_quantity=Decimal("0.0000"),
                received_quantity=Decimal("4.0000"),
                invoiced_quantity=Decimal("0.0000"),
                tax_rate=Decimal("18.00"),
                delivery_date=today + timedelta(days=3),
                uom_id=uom_unit.id if uom_unit else fallback_cat.id,
            )
            po1_line2 = PoLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_id=po_ind1.id,
                line_number=2,
                item_description="Dell Pro Wireless Soundbar (SB521A)",
                ordered_quantity=Decimal("4.0000"),
                unit_price=Decimal("15000.00"),
                open_quantity=Decimal("0.0000"),
                received_quantity=Decimal("4.0000"),
                invoiced_quantity=Decimal("0.0000"),
                tax_rate=Decimal("18.00"),
                delivery_date=today + timedelta(days=3),
                uom_id=uom_unit.id if uom_unit else fallback_cat.id,
            )
            db.add(po1_line1)
            db.add(po1_line2)
            await db.flush()
        elif po_ind1:
            po_ind1.source_pr_id = ind1.id
            await db.flush()

        if po_ind1:
            # Create Draft GRN awaiting consignee receipt confirmation
            res = await db.execute(
                select(GoodsReceiptNote).where(
                    and_(GoodsReceiptNote.org_id == DEFAULT_ORG_ID, GoodsReceiptNote.grn_number == "GRN-2026-IND001")
                )
            )
            grn1 = res.scalar_one_or_none()
            if not grn1:
                grn1 = GoodsReceiptNote(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    grn_number="GRN-2026-IND001",
                    po_id=po_ind1.id,
                    vendor_id=acme_vendor.id,
                    receipt_date=today,
                    received_by=indentor_user.id,
                    challan_number="CH-ACME-9021",
                    challan_date=today - timedelta(days=1),
                    transporter_name="Blue Dart Express Air",
                    lr_number="BD-EXP-889104",
                    status="DRAFT",
                    notes="Consignment delivered to R&D Receiving Bay. Awaiting consignee physical package integrity check.",
                    created_by=buyer_user.id,
                    created_at=now_utc - timedelta(hours=6),
                    updated_at=now_utc - timedelta(hours=6),
                )
                db.add(grn1)
                await db.flush()

                # Get po line IDs
                po_lines = (await db.execute(select(PoLine).where(PoLine.po_id == po_ind1.id))).scalars().all()
                for pl in po_lines:
                    db.add(
                        GrnLine(
                            id=uuid4(),
                            org_id=DEFAULT_ORG_ID,
                            grn_id=grn1.id,
                            po_line_id=pl.id,
                            received_quantity=Decimal("4.0000"),
                            accepted_quantity=Decimal("4.0000"),
                            rejected_quantity=Decimal("0.0000"),
                            qc_required=False,
                            qc_status="NOT_REQUIRED",
                        )
                    )
                await db.flush()

        # 7. Purchase Order 2 & Confirmed GRN for IND-2026-000006
        ind6 = seeded_indents["IND-2026-000006"]
        res = await db.execute(
            select(PurchaseOrder).where(and_(PurchaseOrder.org_id == DEFAULT_ORG_ID, PurchaseOrder.po_number == "PO-2026-IND002"))
        )
        po_ind2 = res.scalar_one_or_none()
        if not po_ind2 and acme_vendor:
            po_ind2 = PurchaseOrder(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_number="PO-2026-IND002",
                title="HP Color LaserJet Enterprise Flow MFP Printing Hub",
                vendor_id=acme_vendor.id,
                source_pr_id=ind6.id,
                status=PoStatusEnum.ACKNOWLEDGED,
                business_unit_id=bu.id,
                plant_id=plant.id if plant else None,
                category_id=cat_off.id,
                currency="INR",
                total_value=Decimal("185000.00"),
                delivery_location_id=loc.id if loc else None,
                expected_delivery_date=today - timedelta(days=2),
                buyer_id=buyer_user.id,
                created_by=buyer_user.id,
                sent_at=now_utc - timedelta(days=12),
                acknowledged_at=now_utc - timedelta(days=11),
                vendor_acknowledged_at=now_utc - timedelta(days=11),
                created_at=now_utc - timedelta(days=14),
                updated_at=now_utc - timedelta(days=2),
            )
            db.add(po_ind2)
            await db.flush()

            po2_line1 = PoLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_id=po_ind2.id,
                line_number=1,
                item_description="HP Color LaserJet Enterprise Flow MFP M578c Printer",
                ordered_quantity=Decimal("1.0000"),
                unit_price=Decimal("185000.00"),
                open_quantity=Decimal("0.0000"),
                received_quantity=Decimal("1.0000"),
                invoiced_quantity=Decimal("0.0000"),
                tax_rate=Decimal("18.00"),
                delivery_date=today - timedelta(days=2),
                uom_id=uom_unit.id if uom_unit else fallback_cat.id,
            )
            db.add(po2_line1)
            await db.flush()
        elif po_ind2:
            po_ind2.source_pr_id = ind6.id
            await db.flush()

        if po_ind2:
            res = await db.execute(
                select(GoodsReceiptNote).where(
                    and_(GoodsReceiptNote.org_id == DEFAULT_ORG_ID, GoodsReceiptNote.grn_number == "GRN-2026-IND002")
                )
            )
            grn2 = res.scalar_one_or_none()
            if not grn2:
                grn2 = GoodsReceiptNote(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    grn_number="GRN-2026-IND002",
                    po_id=po_ind2.id,
                    vendor_id=acme_vendor.id,
                    receipt_date=today - timedelta(days=2),
                    received_by=indentor_user.id,
                    challan_number="CH-ACME-8720",
                    challan_date=today - timedelta(days=3),
                    transporter_name="Gati KWE Surface",
                    lr_number="GATI-DEL-9921",
                    status="CONFIRMED",
                    confirmed_at=now_utc - timedelta(days=1),
                    confirmed_by=indentor_user.id,
                    notes="Consignee accepted by Priya Mehta. Verified 100% operational and calibrated.",
                    created_by=buyer_user.id,
                    created_at=now_utc - timedelta(days=2),
                    updated_at=now_utc - timedelta(days=1),
                )
                db.add(grn2)
                await db.flush()

                po2_lines = (await db.execute(select(PoLine).where(PoLine.po_id == po_ind2.id))).scalars().all()
                for pl in po2_lines:
                    db.add(
                        GrnLine(
                            id=uuid4(),
                            org_id=DEFAULT_ORG_ID,
                            grn_id=grn2.id,
                            po_line_id=pl.id,
                            received_quantity=Decimal("1.0000"),
                            accepted_quantity=Decimal("1.0000"),
                            rejected_quantity=Decimal("0.0000"),
                            qc_required=False,
                            qc_status="PASSED",
                        )
                    )
                await db.flush()

        await db.commit()
        logger.info(f"🎉 Successfully seeded {len(seeded_indents)} indents and consignee tracking records!")


if __name__ == "__main__":
    asyncio.run(seed_indents())
