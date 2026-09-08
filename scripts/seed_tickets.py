"""
Seed realistic relational ticket data for Default Organization.
Creates tickets linked to existing Requisitions, RFQs, Purchase Orders, Invoices, and Vendors.
Populates:
- Tickets across all 7 statuses (OPEN, IN_PROGRESS, PENDING_RESPONSE, ESCALATED, RESOLVED, CLOSED, REOPENED)
- Priorities (LOW, MEDIUM, HIGH, CRITICAL)
- SLA statuses (WITHIN_SLA, AT_RISK, BREACHED)
- Types (QUERY, DISCREPANCY, VENDOR_ISSUE, CHANGE_REQUEST, SUPPORT, AUDIT_QUERY, BUG, COMPLAINT)
- Comment threads (public supplier discussions and confidential internal notes)
- Ticket watchers and activity logs
- Cross-portal visibility (Buyer, Supplier, Admin)
Safe and idempotent.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import delete, select, text

from app.db.session import async_session
from app.modules.invoice.models import Invoice
from app.modules.organization.models import Organization
from app.modules.purchase_order.models import PurchaseOrder
from app.modules.requisition.models import Requisition
from app.modules.sourcing.models import Rfq
from app.modules.ticket.models import (
    Ticket,
    TicketActivityLog,
    TicketComment,
    TicketWatcher,
)
from app.modules.ticket.search_service import TicketSearchService
from app.modules.user.models import User
from app.modules.vendor.models import Vendor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_ORG_ID = UUID("00000000-0000-0000-0000-000000000001")


async def seed_tickets():
    now = datetime.now(UTC)

    async with async_session() as db:
        # 1. Fetch organization
        res = await db.execute(select(Organization).where(Organization.id == DEFAULT_ORG_ID))
        org = res.scalar_one_or_none()
        if not org:
            logger.error("Default Organization not found! Run seed_demo_user.py first.")
            return

        # 2. Fetch users
        users_res = await db.execute(
            select(User).where(
                User.org_id == DEFAULT_ORG_ID,
                User.email.in_(
                    [
                        "admin@procurement.com",
                        "buyer@procurement.com",
                        "approver@procurement.com",
                        "supplier@acme.com",
                    ]
                ),
            )
        )
        users = {u.email: u for u in users_res.scalars().all()}
        admin = users.get("admin@procurement.com")
        buyer = users.get("buyer@procurement.com")
        approver = users.get("approver@procurement.com")
        supplier = users.get("supplier@acme.com")

        if not buyer or not supplier or not admin:
            logger.error("Required demo users not found! Run seed_demo_user.py first.")
            return

        # 3. Fetch entities
        # Vendors
        acme_vendor = (
            await db.execute(select(Vendor).where(Vendor.org_id == DEFAULT_ORG_ID, Vendor.vendor_code == "V-10001"))
        ).scalar_one_or_none()
        global_vendor = (
            await db.execute(select(Vendor).where(Vendor.org_id == DEFAULT_ORG_ID, Vendor.vendor_code == "V-10002"))
        ).scalar_one_or_none()

        # Requisitions
        pr2 = (
            await db.execute(
                select(Requisition).where(
                    Requisition.org_id == DEFAULT_ORG_ID, Requisition.pr_number == "PR-IT-2026-000002"
                )
            )
        ).scalar_one_or_none()
        pr_unmapped = (
            await db.execute(
                select(Requisition).where(
                    Requisition.org_id == DEFAULT_ORG_ID, Requisition.pr_number.like("%UNMAPPED%")
                )
            )
        ).scalar_one_or_none()

        # RFQs
        rfq1 = (
            await db.execute(select(Rfq).where(Rfq.org_id == DEFAULT_ORG_ID, Rfq.rfq_number == "RFQ-2026-000001"))
        ).scalar_one_or_none()
        rfq2 = (
            await db.execute(select(Rfq).where(Rfq.org_id == DEFAULT_ORG_ID, Rfq.rfq_number == "RFQ-2026-000002"))
        ).scalar_one_or_none()

        # POs
        po1 = (
            await db.execute(
                select(PurchaseOrder).where(
                    PurchaseOrder.org_id == DEFAULT_ORG_ID, PurchaseOrder.po_number == "PO-2026-000001"
                )
            )
        ).scalar_one_or_none()
        po2 = (
            await db.execute(
                select(PurchaseOrder).where(
                    PurchaseOrder.org_id == DEFAULT_ORG_ID, PurchaseOrder.po_number == "PO-2026-000002"
                )
            )
        ).scalar_one_or_none()

        # Invoices
        inv1 = (await db.execute(select(Invoice).where(Invoice.org_id == DEFAULT_ORG_ID))).scalars().first()

        logger.info(
            "Found related entities: PO1=%s, INV1=%s (%s), RFQ2=%s, PR2=%s",
            bool(po1),
            bool(inv1),
            inv1.invoice_number if inv1 else "None",
            bool(rfq2),
            bool(pr2),
        )

        # 4. Clean existing demo tickets for Default Organization for idempotent re-seed
        existing_tickets = (await db.execute(select(Ticket).where(Ticket.org_id == DEFAULT_ORG_ID))).scalars().all()

        if existing_tickets:
            logger.info(
                "Cleaning %d existing demo tickets for Default Organization for clean relational seeding...",
                len(existing_tickets),
            )
            t_ids = [t.id for t in existing_tickets]
            await db.execute(delete(TicketComment).where(TicketComment.ticket_id.in_(t_ids)))
            await db.execute(delete(TicketWatcher).where(TicketWatcher.ticket_id.in_(t_ids)))
            await db.execute(delete(TicketActivityLog).where(TicketActivityLog.ticket_id.in_(t_ids)))
            await db.execute(delete(Ticket).where(Ticket.id.in_(t_ids)))
            await db.flush()

        # Ensure ticket number sequence
        year = now.year
        seq_name = f"seq_tkt_def_{year}"
        await db.execute(text(f"CREATE SEQUENCE IF NOT EXISTS {seq_name} START 1 INCREMENT 1;"))

        # Define 10 rich relational ticket scenarios covering all portals & statuses
        ticket_definitions = [
            {
                "seq_num": 1,
                "title": f"Invoice {inv1.invoice_number if inv1 else 'INV-2026-000001'}: Query on 2% TDS deduction breakdown",
                "description": f"Hello Procurement Finance Team, Regarding invoice {inv1.invoice_number if inv1 else 'INV-2026-000001'} submitted for PO-2026-000001, we observed a 2% Section 194C TDS deduction instead of 194J. Could you please confirm if this was categorized under IT contractor work?",
                "ticket_type": "QUERY",
                "priority": "MEDIUM",
                "status": "IN_PROGRESS",
                "category": "Billing",
                "entity_type": "INVOICE",
                "entity_id": inv1.id if inv1 else None,
                "entity_number": inv1.invoice_number if inv1 else "INV-2026-000001",
                "tags": ["invoice", "tax", "tds", "finance"],
                "is_private": False,
                "raised_by": supplier.id,
                "raised_by_portal": "supplier",
                "assigned_to": buyer.id,
                "assigned_team": "Finance",
                "sla_status": "WITHIN_SLA",
                "sla_breach_at": now + timedelta(hours=18),
                "first_response_at": now - timedelta(hours=2),
                "created_at": now - timedelta(hours=4),
                "comments": [
                    {
                        "author": supplier,
                        "content": "We have attached our lower TDS certificate from IT department if needed for verification.",
                        "is_internal": False,
                        "offset_min": 230,
                    },
                    {
                        "author": buyer,
                        "content": "Finance verified: Section 194C applies to hardware delivery portion. Checking with corporate tax desk if software licenses can be separated into an addendum.",
                        "is_internal": True,
                        "offset_min": 120,
                    },
                    {
                        "author": buyer,
                        "content": f"@{supplier.first_name} We are reviewing with our accounts payable team today and will update the voucher classification.",
                        "is_internal": False,
                        "offset_min": 115,
                    },
                ],
                "watchers": [supplier.id, buyer.id],
            },
            {
                "seq_num": 2,
                "title": f"RFQ {rfq2.rfq_number if rfq2 else 'RFQ-2026-000002'}: Clarification on Object Storage IOPS benchmarks",
                "description": f"In line item 2 of {rfq2.rfq_number if rfq2 else 'RFQ-2026-000002'} (Cloud Object Storage Expansion), minimum sustained IOPS is specified as 50,000 at 4KB block size. Is NVMe tier mandatory or is hybrid flash acceptable with multi-AZ replication?",
                "ticket_type": "QUERY",
                "priority": "HIGH",
                "status": "RESOLVED",
                "category": "Technical",
                "entity_type": "RFQ",
                "entity_id": rfq2.id if rfq2 else None,
                "entity_number": rfq2.rfq_number if rfq2 else "RFQ-2026-000002",
                "tags": ["rfq", "sourcing", "technical", "storage"],
                "is_private": False,
                "raised_by": supplier.id,
                "raised_by_portal": "supplier",
                "assigned_to": buyer.id,
                "assigned_team": "Procurement",
                "sla_status": "WITHIN_SLA",
                "sla_breach_at": now + timedelta(hours=24),
                "first_response_at": now - timedelta(days=1, hours=2),
                "resolved_at": now - timedelta(hours=6),
                "resolution_note": "Technical addendum 1 published on RFQ portal allowing hybrid flash tier meeting sustained p99 < 2ms latency criteria.",
                "created_at": now - timedelta(days=1, hours=4),
                "comments": [
                    {
                        "author": supplier,
                        "content": "We need prompt guidance on this to finalize pricing matrix before the bid closing window.",
                        "is_internal": False,
                        "offset_min": 1600,
                    },
                    {
                        "author": buyer,
                        "content": "Consulted IT cloud lead. Hybrid flash is acceptable provided 99th percentile latency is strictly under 2ms.",
                        "is_internal": True,
                        "offset_min": 1500,
                    },
                    {
                        "author": buyer,
                        "content": f"@{supplier.first_name} Hybrid flash is acceptable provided 99th percentile latency is strictly under 2ms. Addendum 1 has been issued on the sourcing portal.",
                        "is_internal": False,
                        "offset_min": 360,
                    },
                ],
                "watchers": [supplier.id, buyer.id, admin.id],
            },
            {
                "seq_num": 3,
                "title": f"PO {po1.po_number if po1 else 'PO-2026-000001'}: Request for 5-day delivery window extension due to port customs delay",
                "description": f"Consignment containing MacBook Pro M3 batch ({po1.po_number if po1 else 'PO-2026-000001'}) has been held up at Mumbai Air Cargo customs for physical inspection. Requesting revised delivery date from Sept 12 to Sept 17.",
                "ticket_type": "CHANGE_REQUEST",
                "priority": "HIGH",
                "status": "PENDING_RESPONSE",
                "category": "Delivery",
                "entity_type": "PURCHASE_ORDER",
                "entity_id": po1.id if po1 else None,
                "entity_number": po1.po_number if po1 else "PO-2026-000001",
                "tags": ["po", "delivery", "customs", "logistics"],
                "is_private": False,
                "raised_by": supplier.id,
                "raised_by_portal": "supplier",
                "assigned_to": buyer.id,
                "assigned_team": "Logistics",
                "sla_status": "AT_RISK",
                "sla_breach_at": now + timedelta(hours=3, minutes=45),
                "first_response_at": now - timedelta(hours=1),
                "created_at": now - timedelta(hours=8),
                "comments": [
                    {
                        "author": supplier,
                        "content": "Bill of Entry copy and customs detention memo available upon request. We are expediting clearance through our custom house agent.",
                        "is_internal": False,
                        "offset_min": 450,
                    },
                    {
                        "author": buyer,
                        "content": f"@{approver.first_name if approver else 'approver'} Need your clearance to waive the 0.5%/week late delivery liquidated damages clause due to customs force majeure.",
                        "is_internal": True,
                        "offset_min": 60,
                    },
                ],
                "watchers": [supplier.id, buyer.id, approver.id if approver else admin.id],
            },
            {
                "seq_num": 4,
                "title": f"PR {pr2.pr_number if pr2 else 'PR-IT-2026-000002'}: Cloud budget cap exceeded by 14% for Q3 infrastructure scale",
                "description": f"Requisition {pr2.pr_number if pr2 else 'PR-IT-2026-000002'} totals INR 3,450,000 against BU-IT allocated budget of INR 3,000,000. Recommending supplemental CAPEX re-allocation from Data Center savings account.",
                "ticket_type": "AUDIT_QUERY",
                "priority": "CRITICAL",
                "status": "OPEN",
                "category": "Budget",
                "entity_type": "REQUISITION",
                "entity_id": pr2.id if pr2 else None,
                "entity_number": pr2.pr_number if pr2 else "PR-IT-2026-000002",
                "tags": ["budget", "capex", "requisition", "p1-breach"],
                "is_private": True,  # Confidential internal governance
                "raised_by": buyer.id,
                "raised_by_portal": "buyer",
                "assigned_to": approver.id if approver else admin.id,
                "assigned_team": "Finance",
                "sla_status": "BREACHED",
                "sla_breach_at": now - timedelta(hours=3),
                "first_response_at": None,
                "created_at": now - timedelta(hours=9),
                "comments": [
                    {
                        "author": buyer,
                        "content": f"@{approver.first_name if approver else 'approver'} Please review budget variance schedule. Production workload onboarding on Oct 1 depends on this Kubernetes cluster provisioning.",
                        "is_internal": True,
                        "offset_min": 500,
                    },
                ],
                "watchers": [buyer.id, approver.id if approver else admin.id],
            },
            {
                "seq_num": 5,
                "title": f"PR {pr_unmapped.pr_number if pr_unmapped else 'PR-ERP-2026-UNMAPPED01'}: Material code 400192 has no active category mapping",
                "description": f"Inbound batch job from SAP ECC failed to map line items for {pr_unmapped.pr_number if pr_unmapped else 'PR-ERP-2026-UNMAPPED01'}. Material master code 400192 is missing category association in master_data.",
                "ticket_type": "BUG",
                "priority": "MEDIUM",
                "status": "IN_PROGRESS",
                "category": "Integration",
                "entity_type": "REQUISITION",
                "entity_id": pr_unmapped.id if pr_unmapped else None,
                "entity_number": pr_unmapped.pr_number if pr_unmapped else "PR-ERP-2026-UNMAPPED01",
                "tags": ["sap", "integration", "masterdata", "pr"],
                "is_private": False,
                "raised_by": admin.id,
                "raised_by_portal": "admin",
                "assigned_to": buyer.id,
                "assigned_team": "Master Data",
                "sla_status": "WITHIN_SLA",
                "sla_breach_at": now + timedelta(hours=36),
                "first_response_at": now - timedelta(hours=5),
                "created_at": now - timedelta(hours=6),
                "comments": [
                    {
                        "author": admin,
                        "content": "Assigned material code 400192 to Hardware & Compute (CAT-HW). Line items ready for reprocessing.",
                        "is_internal": False,
                        "offset_min": 300,
                    },
                    {
                        "author": buyer,
                        "content": "Re-triggered SAP import webhook. Validated that commodity code now defaults to 84713010.",
                        "is_internal": False,
                        "offset_min": 60,
                    },
                ],
                "watchers": [admin.id, buyer.id],
            },
            {
                "seq_num": 6,
                "title": f"Vendor {global_vendor.vendor_code if global_vendor else 'V-10002'}: Annual SOC2 Type II compliance audit report pending",
                "description": f"Vendor {global_vendor.vendor_code if global_vendor else 'V-10002'} (Global Cloud & Systems Corp) compliance certification expired on August 31, 2026. Requesting updated ISO 27001 / SOC 2 Type II attestation before new enterprise PO issuance.",
                "ticket_type": "VENDOR_ISSUE",
                "priority": "HIGH",
                "status": "OPEN",
                "category": "Compliance",
                "entity_type": "VENDOR",
                "entity_id": global_vendor.id if global_vendor else None,
                "entity_number": global_vendor.vendor_code if global_vendor else "V-10002",
                "tags": ["vendor", "compliance", "soc2", "audit"],
                "is_private": False,
                "raised_by": buyer.id,
                "raised_by_portal": "buyer",
                "assigned_to": buyer.id,
                "assigned_team": "Compliance",
                "sla_status": "AT_RISK",
                "sla_breach_at": now + timedelta(hours=5, minutes=15),
                "first_response_at": None,
                "created_at": now - timedelta(hours=14),
                "comments": [
                    {
                        "author": buyer,
                        "content": "Notice dispatched to vendor contact email. Vendor portal status set to CONDITIONAL.",
                        "is_internal": False,
                        "offset_min": 800,
                    },
                ],
                "watchers": [buyer.id, admin.id],
            },
            {
                "seq_num": 7,
                "title": f"RFQ {rfq1.rfq_number if rfq1 else 'RFQ-2026-000001'}: Configuration of dynamic overtime rules for English Reverse Auction",
                "description": "Need assistance setting minimum bid decrement parameters and auto-extension settings for the upcoming English reverse auction on developer laptops.",
                "ticket_type": "SUPPORT",
                "priority": "LOW",
                "status": "RESOLVED",
                "category": "Procurement",
                "entity_type": "RFQ",
                "entity_id": rfq1.id if rfq1 else None,
                "entity_number": rfq1.rfq_number if rfq1 else "RFQ-2026-000001",
                "tags": ["rfq", "auction", "sourcing"],
                "is_private": False,
                "raised_by": buyer.id,
                "raised_by_portal": "buyer",
                "assigned_to": admin.id,
                "assigned_team": "Sourcing",
                "sla_status": "WITHIN_SLA",
                "sla_breach_at": now + timedelta(days=2),
                "first_response_at": now - timedelta(days=2, hours=1),
                "resolved_at": now - timedelta(days=1),
                "resolution_note": "Configured 1% minimum decrement and 5-minute dynamic overtime trigger when bids are placed in the final 2 minutes.",
                "created_at": now - timedelta(days=2, hours=3),
                "comments": [
                    {
                        "author": buyer,
                        "content": "We expect high bidding competition across 4 qualified suppliers. Need to prevent last-second sniping.",
                        "is_internal": False,
                        "offset_min": 3000,
                    },
                    {
                        "author": admin,
                        "content": "Auction engine parameters updated in live_auctions table: decrement_type='PERCENTAGE', decrement_val=1.0, overtime_sec=300.",
                        "is_internal": False,
                        "offset_min": 1440,
                    },
                ],
                "watchers": [buyer.id, admin.id],
            },
            {
                "seq_num": 8,
                "title": f"PO {po2.po_number if po2 else 'PO-2026-000002'}: Corporate Headquarters Delivery Gate Pass & Dock Hours",
                "description": "Please share the dock operating hours, security gate pass pre-clearance link, and driver PPE requirements for delivery to PLANT-HQ Corporate Headquarters.",
                "ticket_type": "QUERY",
                "priority": "LOW",
                "status": "CLOSED",
                "category": "Delivery",
                "entity_type": "PURCHASE_ORDER",
                "entity_id": po2.id if po2 else None,
                "entity_number": po2.po_number if po2 else "PO-2026-000002",
                "tags": ["po", "delivery", "gatepass", "plant-hq"],
                "is_private": False,
                "raised_by": supplier.id,
                "raised_by_portal": "supplier",
                "assigned_to": buyer.id,
                "assigned_team": "Logistics",
                "sla_status": "WITHIN_SLA",
                "sla_breach_at": now + timedelta(days=1),
                "first_response_at": now - timedelta(days=3, hours=2),
                "resolved_at": now - timedelta(days=2),
                "resolution_note": "Gate pass guidelines and security protocol PDF transmitted. Delivery completed successfully.",
                "created_at": now - timedelta(days=3, hours=4),
                "comments": [
                    {
                        "author": supplier,
                        "content": "Delivery vehicle is an 8-ton truck. Please confirm height clearance for Gate 3 entrance.",
                        "is_internal": False,
                        "offset_min": 4400,
                    },
                    {
                        "author": buyer,
                        "content": f"@{supplier.first_name} Gate 3 has 4.2m clearance. Unloading docks operate 08:00 to 17:00 IST Monday-Friday. Gate security pass pre-registered.",
                        "is_internal": False,
                        "offset_min": 2880,
                    },
                ],
                "watchers": [supplier.id, buyer.id],
            },
            {
                "seq_num": 9,
                "title": f"PO {po1.po_number if po1 else 'PO-2026-000001'}: Physical count discrepancy on docking inspection (2 damaged cartons)",
                "description": "Physical count at receiving dock showed 48 units received out of 50 packed on Delivery Challan DC-8921. 2 packages showed carton crush damage in transit.",
                "ticket_type": "DISCREPANCY",
                "priority": "HIGH",
                "status": "ESCALATED",
                "category": "Quality",
                "entity_type": "PURCHASE_ORDER",
                "entity_id": po1.id if po1 else None,
                "entity_number": po1.po_number if po1 else "PO-2026-00001",
                "tags": ["po", "quality", "damage", "grn", "escalated"],
                "is_private": False,
                "raised_by": buyer.id,
                "raised_by_portal": "buyer",
                "assigned_to": buyer.id,
                "assigned_team": "Receiving",
                "sla_status": "WITHIN_SLA",
                "sla_breach_at": now + timedelta(hours=14),
                "first_response_at": now - timedelta(hours=3),
                "created_at": now - timedelta(hours=5),
                "comments": [
                    {
                        "author": buyer,
                        "content": f"@{supplier.first_name} Receiving clerk has uploaded photograph of crushed outer carton. Please review and confirm replacement shipment date.",
                        "is_internal": False,
                        "offset_min": 280,
                    },
                    {
                        "author": buyer,
                        "content": "Insurance claim pre-intimation filed with transit underwriter as a precautionary measure.",
                        "is_internal": True,
                        "offset_min": 270,
                    },
                ],
                "watchers": [buyer.id, supplier.id],
            },
            {
                "seq_num": 10,
                "title": f"Vendor {acme_vendor.vendor_code if acme_vendor else 'V-10001'}: Master Service Agreement digital signature execution",
                "description": "Annual MSA contract renewal for Cloud & Infrastructure services is pending final digital signature execution from Legal & Finance leadership.",
                "ticket_type": "CHANGE_REQUEST",
                "priority": "MEDIUM",
                "status": "REOPENED",
                "category": "Legal",
                "entity_type": "VENDOR",
                "entity_id": acme_vendor.id if acme_vendor else None,
                "entity_number": acme_vendor.vendor_code if acme_vendor else "V-10001",
                "tags": ["contract", "legal", "msa", "reopened"],
                "is_private": False,
                "raised_by": buyer.id,
                "raised_by_portal": "buyer",
                "assigned_to": approver.id if approver else admin.id,
                "assigned_team": "Legal",
                "sla_status": "WITHIN_SLA",
                "sla_breach_at": now + timedelta(hours=22),
                "first_response_at": now - timedelta(days=2),
                "resolved_at": now - timedelta(days=1),
                "reopen_count": 1,
                "created_at": now - timedelta(days=3),
                "comments": [
                    {
                        "author": buyer,
                        "content": "Initial draft sent for digital signature via DocuSign.",
                        "is_internal": False,
                        "offset_min": 4000,
                    },
                    {
                        "author": approver if approver else admin,
                        "content": "Legal requested revision to Clause 14.2 regarding jurisdiction venue before final execution. Reopened ticket.",
                        "is_internal": False,
                        "offset_min": 240,
                    },
                ],
                "watchers": [buyer.id, approver.id if approver else admin.id, admin.id],
            },
        ]

        search_svc = TicketSearchService()

        # Insert tickets and relational children
        for tdef in ticket_definitions:
            ticket_num = f"TKT-DEF-{year}-{str(tdef['seq_num']).zfill(6)}"
            ticket = Ticket(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                ticket_number=ticket_num,
                title=tdef["title"],
                description=tdef["description"],
                ticket_type=tdef["ticket_type"],
                priority=tdef["priority"],
                status=tdef["status"],
                category=tdef["category"],
                entity_type=tdef["entity_type"],
                entity_id=tdef["entity_id"],
                entity_number=tdef["entity_number"],
                tags=tdef["tags"],
                is_private=tdef["is_private"],
                raised_by=tdef["raised_by"],
                raised_by_portal=tdef["raised_by_portal"],
                assigned_to=tdef["assigned_to"],
                assigned_team=tdef["assigned_team"],
                sla_status=tdef["sla_status"],
                sla_breach_at=tdef["sla_breach_at"],
                first_response_at=tdef["first_response_at"],
                resolved_at=tdef.get("resolved_at"),
                resolution_note=tdef.get("resolution_note"),
                reopen_count=tdef.get("reopen_count", 0),
                created_at=tdef["created_at"],
                updated_at=tdef["created_at"],
            )
            db.add(ticket)
            await db.flush()

            # Activity log for creation
            db.add(
                TicketActivityLog(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    ticket_id=ticket.id,
                    actor_id=tdef["raised_by"],
                    activity_type="CREATED",
                    old_value=None,
                    new_value=tdef["status"],
                    created_at=tdef["created_at"],
                )
            )

            # Add watchers
            for w_uid in tdef["watchers"]:
                db.add(
                    TicketWatcher(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        ticket_id=ticket.id,
                        user_id=w_uid,
                        added_by=tdef["raised_by"],
                        created_at=tdef["created_at"],
                        updated_at=tdef["created_at"],
                    )
                )

            # Add comments
            for cdef in tdef["comments"]:
                c_created = now - timedelta(minutes=cdef["offset_min"])
                mentioned_users = []
                if "@" in cdef["content"]:
                    for u in [admin, buyer, approver, supplier]:
                        if u and f"@{u.first_name}" in cdef["content"]:
                            mentioned_users.append(u.id)

                comment = TicketComment(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    ticket_id=ticket.id,
                    author_id=cdef["author"].id,
                    content=cdef["content"],
                    is_internal=cdef["is_internal"],
                    mentioned_users=mentioned_users,
                    created_at=c_created,
                    updated_at=c_created,
                )
                db.add(comment)

                # Activity log for comment
                act_type = "INTERNAL_NOTE_ADDED" if cdef["is_internal"] else "COMMENT_ADDED"
                db.add(
                    TicketActivityLog(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        ticket_id=ticket.id,
                        actor_id=cdef["author"].id,
                        activity_type=act_type,
                        created_at=c_created,
                    )
                )

            # If resolved, add resolution activity log
            if tdef.get("resolved_at"):
                db.add(
                    TicketActivityLog(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        ticket_id=ticket.id,
                        actor_id=tdef["assigned_to"] or tdef["raised_by"],
                        activity_type="RESOLVED",
                        old_value="IN_PROGRESS",
                        new_value="RESOLVED",
                        created_at=tdef["resolved_at"],
                    )
                )

            # If closed, add closed activity log
            if tdef.get("status") == "CLOSED":
                db.add(
                    TicketActivityLog(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        ticket_id=ticket.id,
                        actor_id=tdef["assigned_to"] or tdef["raised_by"],
                        activity_type="CLOSED",
                        old_value="RESOLVED",
                        new_value="CLOSED",
                        created_at=tdef["created_at"] + timedelta(days=1),
                    )
                )

            # Try to index in Elasticsearch
            try:
                await search_svc.index_ticket(ticket)
            except Exception as e:
                logger.debug("ES indexing skipped during seeding: %s", e)

            logger.info(
                "Seeded ticket: %s | %s [%s] (%s)", ticket_num, ticket.title[:40], ticket.status, ticket.priority
            )

        await search_svc.close()
        await db.commit()
        logger.info("Successfully seeded %d relational tickets for Default Organization!", len(ticket_definitions))


if __name__ == "__main__":
    asyncio.run(seed_tickets())
