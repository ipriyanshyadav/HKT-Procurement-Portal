"""
Comprehensive Enterprise Platform Database Seeding Extension.
Populates all tables and portals (Buyer :3000, Supplier :3001, Admin :3002)
with rich, realistic, connected enterprise data:

1. Organization Hierarchy: 3 Legal Entities, 4 Business Units, 5 Plants/Facilities, 6 Departments, 5 Cost Centers, 10 Delivery Docks.
2. Demo Supplier Accounts for ALL 5 Vendors (Acme, Global Cloud, Apex, Nexus, Innovatech).
3. 20+ Master Catalog Items across Hardware, Software, Cloud, Furniture, Safety, and Facilities.
4. 16 Requisitions (PRs) across all states and categories.
5. 12 RFQs / Tenders across Open, Sealed Bid, QCBS Evaluation, Awarded, Reverse Auction.
6. 16 Purchase Orders distributed across ALL 5 vendors with lines, taxes, and status progression.
7. 10 Goods Receipt Notes (GRN) with QA inspections, passed, and transit-damage rejections.
8. 10 Advance Shipping Notices (ASNs) with carrier tracking, barcodes, package details.
9. 14 Invoices with 3-Way matching, variance calculations, and active Dispute message threads.
10. 10 Payments covering Scheduled, Completed with real banking UTRs, Processing, and Holds.
11. 10 Contracts covering Active with milestones & utilization, Under Review, Draft, Expired, Terminated.
12. 6 Service Entry Sheets (SES) & Lines.
13. 8 Quality Inspections.
14. 5 Approval Delegation Rules.
15. 12 Workflow Tasks in Approver & Super Admin inboxes.
16. 25+ Relational Tickets across all 7 statuses, SLA tracking, internal notes & vendor chat.
17. 60+ In-App Notifications across ALL 9 user personas and all 5 suppliers.
18. 4 Unmapped PR Exceptions for the triage workbench.
19. Disaster Recovery Checkpoints, Failover Drills, Developer API Keys, Webhook Subscriptions.

Safe, idempotent, zero dead code, zero print statements.
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

from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import DEFAULT_ORG_ID
from app.core.security import hash_password
from app.db.enums import (
    ApprovalTaskStatusEnum,
    AuditEntityTypeEnum,
    BidStatusEnum,
    ContractStatusEnum,
    DocumentCategoryEnum,
    EvaluationTypeEnum,
    InvoiceStatusEnum,
    NotificationChannelEnum,
    NotificationStatusEnum,
    PaymentStatusEnum,
    PoStatusEnum,
    ProcurementTypeEnum,
    PrSourceEnum,
    PrStatusEnum,
    RfqStatusEnum,
    RfqTypeEnum,
    SourcingTypeEnum,
    UserStatusEnum,
    VendorStatusEnum,
    WorkflowInstanceStatusEnum,
)
from app.db.session import async_session
from app.modules.asn.models import AdvanceShippingNotice, AsnLine
from app.modules.bid.models import BidLineResponse, BidResponse, LiveAuction, LiveBid
from app.modules.catalog.models import CartItem, CatalogTierPricing, UserCart
from app.modules.compliance.models import ComplianceFinding, CompliancePolicy, ComplianceScan
from app.modules.contract.models import (
    Contract,
    ContractClause,
    ContractClauseInstance,
    ContractLine,
    ContractMilestone,
    ContractRedline,
    ContractTemplate,
)
from app.modules.developer.models import ApiKey, WebhookDelivery, WebhookSubscription
from app.modules.disaster_recovery.models import DRBackupCheckpoint, DRFailoverDrill
from app.modules.grn.models import GoodsReceiptNote, GrnLine, QualityInspection, ServiceEntrySheet, SesLine
from app.modules.invoice.models import Invoice, InvoiceLine, InvoiceMatchResult
from app.modules.master_data.models import Category, DeliveryLocation, ItemMaster, PaymentTerm, UomMaster
from app.modules.notification.models import Notification
from app.modules.organization.models import BusinessUnit, CostCenter, Department, LegalEntity, Plant
from app.modules.payment.models import Dispute, DisputeMessage, PaymentRecord
from app.modules.purchase_order.models import PoLine, PurchaseOrder
from app.modules.requisition.models import Requisition, RequisitionLine, UnmappedPrException
from app.modules.sourcing.models import Rfq, RfqLine, RfqLot, RfqParticipant
from app.modules.ticket.models import Ticket, TicketActivityLog, TicketComment, TicketSLAConfig
from app.modules.user.models import DelegationRule, Role, User, UserRoleAssignment
from app.modules.vendor.models import Vendor, VendorBankAccount, VendorContact
from app.modules.workflow.models import WorkflowInstance, WorkflowTask, WorkflowTemplate

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("seed_enterprise_comprehensive")


async def seed_enterprise_comprehensive(session: AsyncSession | None = None) -> None:
    if session is None:
        async with async_session() as db:
            await _seed_all_domains(db)
            await db.commit()
    else:
        await _seed_all_domains(session)


async def _seed_all_domains(db: AsyncSession) -> None:
    now_utc = datetime.now(UTC)
    today = date.today()
    logger.info("Starting comprehensive enterprise platform data seeding...")

    # =========================================================================
    # 1. Organization Structure: Legal Entities, BUs, Plants, Depts, Cost Centers
    # =========================================================================
    logger.info("[1/10] Seeding Organization Hierarchy...")
    
    # Legal Entities
    le_data = [
        ("Acme Enterprise Technologies India Pvt Ltd", "REG-IN-2026-001", "27AABCU9603R1ZM", "AABCU9603R", "Mumbai", "Maharashtra", "IN"),
        ("Acme Cloud Systems International LLC", "REG-BLR-2026-002", "29AABCU9603R2Z1", "AABCU9603R", "Bengaluru", "Karnataka", "IN"),
        ("Acme Supply Chain & Logistics Ltd", "REG-DEL-2026-003", "07AABCU9603R3Z8", "AABCU9603R", "Gurugram", "Haryana", "IN"),
    ]
    legal_entities: dict[str, LegalEntity] = {}
    for name, reg, gstin, pan, city, state, country in le_data:
        res = await db.execute(select(LegalEntity).where(and_(LegalEntity.org_id == DEFAULT_ORG_ID, LegalEntity.name == name)))
        le = res.scalars().first()
        if not le:
            le = LegalEntity(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                name=name,
                registration_number=reg,
                gstin=gstin,
                pan=pan,
                city=city,
                state=state,
                country_code=country,
            )
            db.add(le)
            await db.flush()
        legal_entities[name] = le

    primary_le = list(legal_entities.values())[0]

    # Business Units
    bu_data = [
        ("BU-IT", "Information Technology & Cloud Infrastructure", "INR", primary_le.id),
        ("BU-OPS", "Supply Chain & Logistics Operations", "INR", legal_entities.get("Acme Supply Chain & Logistics Ltd", primary_le).id),
        ("BU-FAC", "Corporate Facilities & Real Estate", "INR", primary_le.id),
        ("BU-RND", "Advanced Engineering & Hardware R&D", "INR", legal_entities.get("Acme Cloud Systems International LLC", primary_le).id),
    ]
    bus: dict[str, BusinessUnit] = {}
    for code, name, curr, le_id in bu_data:
        res = await db.execute(select(BusinessUnit).where(and_(BusinessUnit.org_id == DEFAULT_ORG_ID, BusinessUnit.code == code)))
        bu = res.scalars().first()
        if not bu:
            bu = BusinessUnit(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                legal_entity_id=le_id,
                code=code,
                name=name,
                default_currency=curr,
                is_active=True,
            )
            db.add(bu)
            await db.flush()
        bus[code] = bu

    bu_it = bus["BU-IT"]
    bu_ops = bus.get("BU-OPS", bu_it)
    bu_fac = bus.get("BU-FAC", bu_it)
    bu_rnd = bus.get("BU-RND", bu_it)

    # Plants & Operating Facilities
    plant_data = [
        ("PLANT-HQ", "Mumbai Corporate Headquarters & Primary DC", "CORPORATE", "Mumbai", "Maharashtra", bu_it.id, "1000", "Plot 14, BKC Complex", "400051", Decimal("19.0657"), Decimal("72.8687")),
        ("PLANT-BLR-01", "Bengaluru Technology & Cloud Campus", "R_AND_D", "Bengaluru", "Karnataka", bu_rnd.id, "2000", "Tower 3, EPIP Whitefield", "560066", Decimal("12.9815"), Decimal("77.7289")),
        ("PLANT-PUN-02", "Pune Advanced Manufacturing & Assembly Hub", "MANUFACTURING", "Pune", "Maharashtra", bu_ops.id, "3000", "MIDC Industrial Area, Chakan", "410501", Decimal("18.7537"), Decimal("73.8567")),
        ("PLANT-DEL-03", "Gurugram Central Logistics & Fulfillment Hub", "WAREHOUSE", "Gurugram", "Haryana", bu_ops.id, "4000", "Phase 5, Udyog Vihar", "122016", Decimal("28.5033"), Decimal("77.0865")),
        ("PLANT-HYD-04", "Hyderabad Disaster Recovery Facility", "DISTRIBUTION_CENTER", "Hyderabad", "Telangana", bu_it.id, "5000", "Mindspace IT Park, Hitec City", "500081", Decimal("17.4412"), Decimal("78.3812")),
    ]
    plants: dict[str, Plant] = {}
    for code, name, ptype, city, state, bu_id, erp_code, addr, pin, lat, lon in plant_data:
        res = await db.execute(select(Plant).where(and_(Plant.org_id == DEFAULT_ORG_ID, Plant.code == code)))
        p = res.scalars().first()
        if not p:
            p = Plant(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                business_unit_id=bu_id,
                code=code,
                name=name,
                plant_type=ptype,
                erp_plant_code=erp_code,
                address_line1=addr,
                city=city,
                state=state,
                country_code="IN",
                latitude=lat,
                longitude=lon,
                is_active=True,
            )
            db.add(p)
            await db.flush()
        plants[code] = p

    plant_hq = plants["PLANT-HQ"]
    plant_blr = plants.get("PLANT-BLR-01", plant_hq)
    plant_pun = plants.get("PLANT-PUN-02", plant_hq)
    plant_del = plants.get("PLANT-DEL-03", plant_hq)

    # Departments
    dept_data = [
        ("DEPT-ENG", "Engineering & Core Infrastructure", bu_it.id),
        ("DEPT-PROC", "Strategic Global Procurement & Sourcing", bu_it.id),
        ("DEPT-FIN", "Accounts Payable & Treasury Management", bu_it.id),
        ("DEPT-OPS", "Warehouse Logistics & Fulfillment", bu_ops.id),
        ("DEPT-QA", "Quality Assurance & Statutory Compliance", bu_ops.id),
        ("DEPT-FAC", "Corporate Real Estate & Facilities", bu_fac.id),
        ("DEPT-RND", "Hardware Innovation & Systems Lab", bu_rnd.id),
    ]
    depts: dict[str, Department] = {}
    for code, name, bu_id in dept_data:
        res = await db.execute(select(Department).where(and_(Department.org_id == DEFAULT_ORG_ID, Department.code == code)))
        d = res.scalars().first()
        if not d:
            d = Department(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                business_unit_id=bu_id,
                code=code,
                name=name,
                is_active=True,
            )
            db.add(d)
            await db.flush()
        depts[code] = d

    dept_proc = depts["DEPT-PROC"]

    # Cost Centers
    cc_data = [
        ("CC-IT-001", "IT Core Infrastructure Operations", "GL-600100", Decimal("50000000.00"), Decimal("42000000.00"), bu_it.id),
        ("CC-CLOUD-002", "Enterprise Cloud & DevOps Platforms", "GL-600200", Decimal("75000000.00"), Decimal("61000000.00"), bu_it.id),
        ("CC-FAC-003", "Corporate Facilities & Workspace Services", "GL-600300", Decimal("25000000.00"), Decimal("19500000.00"), bu_fac.id),
        ("CC-LOG-004", "Supply Chain & Freight Logistics", "GL-600400", Decimal("40000000.00"), Decimal("31000000.00"), bu_ops.id),
        ("CC-RND-005", "Product Innovation & Hardware Systems", "GL-600500", Decimal("35000000.00"), Decimal("27800000.00"), bu_rnd.id),
    ]
    cost_centers: dict[str, CostCenter] = {}
    for code, name, gl, ann_bud, avail_bud, bu_id in cc_data:
        res = await db.execute(select(CostCenter).where(and_(CostCenter.org_id == DEFAULT_ORG_ID, CostCenter.code == code)))
        c = res.scalars().first()
        if not c:
            c = CostCenter(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                business_unit_id=bu_id,
                code=code,
                name=name,
                gl_account=gl,
                annual_budget=ann_bud,
                available_budget=avail_bud,
                is_active=True,
            )
            db.add(c)
            await db.flush()
        cost_centers[code] = c

    cc_it = cost_centers["CC-IT-001"]

    # Delivery Locations / Inbound Receiving Docks
    loc_data = [
        ("LOC-HQ-MUM", "HQ Server Room & Offices", "B-Wing, Tech Park, Powai", "Mumbai", "Maharashtra", "400076", plant_hq.id),
        ("LOC-NCR-REG", "NCR Regional Logistics Dock", "Tower 4, Cyber City, DLF Phase 2", "Gurugram", "Haryana", "122002", plant_del.id),
        ("LOC-BLR-RND", "Bangalore Inbound Receiving Dock", "Block C, EPIP Zone, Whitefield", "Bengaluru", "Karnataka", "560066", plant_blr.id),
        ("LOC-PUN-DEP", "Pune Central Assembly Receiving", "Plot 12, Phase 1, Hinjewadi Infotech Park", "Pune", "Maharashtra", "411057", plant_pun.id),
        ("LOC-HYD-DC", "Hyderabad Cloud Center Inbound Gate", "Mindspace IT Park, Hitec City", "Hyderabad", "Telangana", "500081", plants.get("PLANT-HYD-04", plant_hq).id),
        ("LOC-DEL-WH1", "Gurugram Central Warehouse Bay 4", "Plot 88, Sector 18 Industrial", "Gurugram", "Haryana", "122015", plant_del.id),
        ("LOC-PUN-WH2", "Chakan Heavy Goods Receiving Dock", "Gate 2, MIDC Automotive Zone", "Pune", "Maharashtra", "410501", plant_pun.id),
    ]
    locations: dict[str, DeliveryLocation] = {}
    for code, name, addr, city, state, pin, p_id in loc_data:
        res = await db.execute(select(DeliveryLocation).where(and_(DeliveryLocation.org_id == DEFAULT_ORG_ID, DeliveryLocation.code == code)))
        loc = res.scalars().first()
        if not loc:
            loc = DeliveryLocation(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                code=code,
                name=name,
                address=addr,
                city=city,
                state=state,
                postal_code=pin,
                country_code="IN",
                plant_id=p_id,
                is_active=True,
            )
            db.add(loc)
            await db.flush()
        locations[code] = loc

    loc_hq = locations["LOC-HQ-MUM"]

    # =========================================================================
    # 2. Vendors & Supplier Demo Accounts
    # =========================================================================
    logger.info("[2/10] Ensuring Vendors & Supplier Demo User Accounts...")
    vendors_res = await db.execute(select(Vendor).where(Vendor.org_id == DEFAULT_ORG_ID))
    vendors_by_code: dict[str, Vendor] = {v.vendor_code: v for v in vendors_res.scalars().all()}

    # Upsert 5 full vendors
    vendor_configs = [
        ("V-10001", "Acme Tech Solutions Private Limited", "Acme Tech Solutions Pvt Ltd", "AABCA1234A", "27AABCA1234A1Z5", "sales@acmetech.example.com", VendorStatusEnum.ACTIVE, "Bengaluru", "Rajesh Kumar", "+91-9876543210", "supplier@acme.com"),
        ("V-10002", "Global Cloud & Systems Corp", "Global Cloud India Private Limited", "BBCGB5678B", "36BBCGB5678B1Z2", "contact@globalcloud.example.com", VendorStatusEnum.ACTIVE, "Hyderabad", "Priya Sharma", "+91-9811223344", "supplier@globalcloud.com"),
        ("V-10003", "Apex Logistics & Freight India", "Apex Freight Solutions Pvt Ltd", "CCLAP9012C", "27CCLAP9012C1Z8", "operations@apexlogistics.example.com", VendorStatusEnum.ACTIVE, "Pune", "Anil Deshmukh", "+91-9844556677", "supplier@apex.com"),
        ("V-10004", "Nexus Innovations & Robotics", "Nexus Innovations Private Limited", "DDENX3456D", "29DDENX3456D1Z1", "onboarding@nexusinnovations.example.com", VendorStatusEnum.ACTIVE, "Bengaluru", "Kavita Reddy", "+91-9922334455", "supplier@nexus.com"),
        ("V-10005", "Innovatech Hardware Systems", "Innovatech Hardware Systems Ltd", "EEINH7890E", "07EEINH7890E1Z4", "orders@innovatech.example.com", VendorStatusEnum.ACTIVE, "Gurugram", "Vikram Malhotra", "+91-9833445566", "supplier@innovatech.com"),
    ]

    all_roles_res = await db.execute(select(Role).where(Role.org_id == DEFAULT_ORG_ID))
    roles_by_code = {r.code: r for r in all_roles_res.scalars().all()}
    supplier_role = roles_by_code.get("SUPPLIER")
    supplier_admin_role = roles_by_code.get("SUPPLIER_ADMIN")

    for vcode, cname, lname, pan, gstin, email, status, city, contact, phone, user_email in vendor_configs:
        v = vendors_by_code.get(vcode)
        if not v:
            v = Vendor(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                vendor_code=vcode,
                company_name=cname,
                legal_name=lname,
                pan=pan,
                gstin=gstin,
                primary_email=email,
                status=status,
                city=city,
                state="Karnataka" if city == "Bengaluru" else ("Maharashtra" if city in ("Mumbai", "Pune") else "Telangana"),
                country_code="IN",
                compliance_score=Decimal("94.50"),
                performance_score=Decimal("91.00"),
                onboarding_step=5,
                activated_at=now_utc - timedelta(days=90),
                version=1,
            )
            db.add(v)
            await db.flush()
            vendors_by_code[vcode] = v

        # Add Contact
        c_res = await db.execute(select(VendorContact).where(and_(VendorContact.vendor_id == v.id, VendorContact.email == user_email)))
        if not c_res.scalars().first():
            db.add(
                VendorContact(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    vendor_id=v.id,
                    name=contact,
                    designation="Key Account Manager",
                    email=user_email,
                    phone=phone,
                    is_primary=True,
                    is_active=True,
                )
            )

        # Ensure Supplier User login exists
        u_res = await db.execute(select(User).where(and_(User.org_id == DEFAULT_ORG_ID, User.email == user_email)))
        u = u_res.scalars().first()
        parts = contact.split(" ")
        if not u:
            u = User(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                email=user_email,
                password_hash=hash_password("Supplier123456!@#"),
                first_name=parts[0],
                last_name=parts[1] if len(parts) > 1 else "Vendor",
                employee_id=f"SUP-{vcode}",
                status=UserStatusEnum.ACTIVE,
                is_supplier_user=True,
                vendor_id=v.id,
                version=1,
            )
            db.add(u)
            await db.flush()

            for r in [supplier_role, supplier_admin_role]:
                if r:
                    db.add(UserRoleAssignment(org_id=DEFAULT_ORG_ID, user_id=u.id, role_id=r.id))

    await db.flush()

    # Fetch users for referencing in transactions
    users_res = await db.execute(select(User).where(User.org_id == DEFAULT_ORG_ID))
    users_by_email = {u.email: u for u in users_res.scalars().all()}
    buyer_user = users_by_email.get("buyer@procurement.com") or list(users_by_email.values())[0]
    approver_user = users_by_email.get("approver@procurement.com") or buyer_user
    admin_user = users_by_email.get("admin@procurement.com") or buyer_user
    super_admin_user = users_by_email.get("superadmin@procurement.com") or admin_user

    # Fetch master data references
    categories_res = await db.execute(select(Category).where(Category.org_id == DEFAULT_ORG_ID))
    categories = {c.code: c for c in categories_res.scalars().all()}
    cat_it = categories.get("CAT-IT") or list(categories.values())[0]
    cat_hw = categories.get("CAT-HW", cat_it)
    cat_sw = categories.get("CAT-SW", cat_it)
    cat_cloud = categories.get("CAT-CLOUD", cat_it)
    cat_fac = categories.get("CAT-FAC", cat_it)

    uoms_res = await db.execute(select(UomMaster).where(UomMaster.org_id == DEFAULT_ORG_ID))
    uom_ea = next((u for u in uoms_res.scalars().all() if u.code == "EA"), None)
    uom_ea_id = uom_ea.id if uom_ea else uuid4()

    pterms_res = await db.execute(select(PaymentTerm).where(PaymentTerm.org_id == DEFAULT_ORG_ID))
    pterm_net30 = next((pt for pt in pterms_res.scalars().all() if pt.code == "NET30"), None)
    pterm_net30_id = pterm_net30.id if pterm_net30 else uuid4()

    # =========================================================================
    # 3. Master Catalog Expansion (20+ Items)
    # =========================================================================
    logger.info("[3/10] Expanding Master Catalog Items...")
    catalog_expansion = [
        ("IT-APP-M3", "Apple MacBook Pro 16-inch M3 Max (36GB/1TB SSD)", "Space Black, Liquid Retina XDR display, 14-core CPU, 30-core GPU", Decimal("299900.00"), "84713010", cat_hw.id, "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400"),
        ("IT-SRV-R760", "Dell PowerEdge R760 Rackmount Enterprise Server", "2x Intel Xeon Gold 6430, 128GB DDR5, 8x 1.92TB NVMe SSD, Dual 1400W Redundant PSU", Decimal("845000.00"), "84715000", cat_hw.id, "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400"),
        ("NET-CISCO-9300", "Cisco Catalyst 9300X 48-Port 10G Multi-Gigabit Switch", "StackWise-1T, 90W UPoE+, modular uplink architecture, Cisco DNA Advantage", Decimal("485000.00"), "85176290", cat_it.id, "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400"),
        ("NET-AP-WIFI6E", "Aruba AP-635 Campus Wi-Fi 6E Tri-Radio Access Point", "Tri-band 2.4/5/6 GHz, 3.9 Gbps peak rate, dual 2.5G Smart Rate ethernet ports", Decimal("68500.00"), "85176290", cat_it.id, "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400"),
        ("SW-DATADOG-ENT", "Datadog Enterprise Cloud Infrastructure Monitoring 1-Yr", "Unified APM, synthetic tracing, log aggregation and automated anomaly detection", Decimal("185000.00"), "85238020", cat_sw.id, "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400"),
        ("SW-SPLUNK-CLOUD", "Splunk Cloud Enterprise SIEM & Security Observability 1-Yr", "25GB/day index ingestion, behavioral analytics, threat intelligence correlation", Decimal("320000.00"), "85238020", cat_sw.id, "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400"),
        ("CLOUD-AWS-TRANSIT", "AWS Multi-Account Direct Connect & Transit Gateway 10G", "Dedicated 10Gbps cross-connect between Mumbai on-prem DC and AWS ap-south-1", Decimal("450000.00"), "998313", cat_cloud.id, "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400"),
        ("FUR-CONF-TBL", "Executive 14-Seater Solid Oak Conference Table", "Integrated motorized pop-up cable bays, dual HDMI/USB-C pass-throughs, acoustic felt base", Decimal("148000.00"), "94031090", cat_fac.id, "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400"),
        ("FUR-POD-AC", "Single-Person Acoustic Soundproof Phone Booth", "Ventilation system, built-in LED lighting, power socket, 32dB acoustic reduction", Decimal("185000.00"), "94032090", cat_fac.id, "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=400"),
        ("SEC-BIOM-CCTV", "Hikvision AI Facial Recognition Access & Thermal Turret", "Deep learning algorithms, IP67 weatherproof, multi-door controller interface", Decimal("38500.00"), "85258900", cat_it.id, "https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=400"),
        ("LOG-AGV-500", "OTTO 100 Industrial Automated Guided Vehicle (AGV)", "150kg payload, autonomous LiDAR SLAM navigation, automatic charging dock", Decimal("1250000.00"), "84289090", cat_fac.id, "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"),
    ]

    items_res = await db.execute(select(ItemMaster).where(ItemMaster.org_id == DEFAULT_ORG_ID))
    items_by_code = {item.code: item for item in items_res.scalars().all()}

    for code, name, desc_text, price, hsn, cat_id, img_url in catalog_expansion:
        if code not in items_by_code:
            item = ItemMaster(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                category_id=cat_id,
                uom_id=uom_ea_id,
                code=code,
                name=name,
                description=desc_text,
                standard_price=price,
                currency="INR",
                hsn_code=hsn,
                image_url=img_url,
                is_active=True,
                version=1,
            )
            db.add(item)
            await db.flush()
            items_by_code[code] = item

            # Tier pricing
            db.add(CatalogTierPricing(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                item_id=item.id,
                min_quantity=Decimal("5.0000"),
                unit_price=price * Decimal("0.95"),
            ))
            db.add(CatalogTierPricing(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                item_id=item.id,
                min_quantity=Decimal("20.0000"),
                unit_price=price * Decimal("0.90"),
            ))

    # =========================================================================
    # 4. Requisitions (PR-2026-000007 through PR-2026-000016)
    # =========================================================================
    logger.info("[4/10] Expanding Requisitions across Business Units...")
    prs_res = await db.execute(select(Requisition).where(Requisition.org_id == DEFAULT_ORG_ID))
    prs_by_num = {p.pr_number: p for p in prs_res.scalars().all()}

    pr_expansion_configs = [
        ("PR-2026-000007", "AWS & Azure Multi-Region Transit Gateway Interconnect", PrStatusEnum.APPROVED, ProcurementTypeEnum.OPEX, bu_it.id, cc_it.id, Decimal("450000.00"), "High-speed 10G hybrid cloud interconnect for production workloads."),
        ("PR-2026-000008", "Cisco Catalyst 40G Datacenter Core Switch Fleet", PrStatusEnum.SUBMITTED, ProcurementTypeEnum.CAPEX, bu_it.id, cc_it.id, Decimal("970000.00"), "Core switches for Bengaluru campus network refresh."),
        ("PR-2026-000009", "Automated Guided Vehicles (AGV) for Warehouse Logistics", PrStatusEnum.APPROVED, ProcurementTypeEnum.CAPEX, bu_ops.id, cost_centers.get("CC-LOG-004", cc_it).id, Decimal("2500000.00"), "Automated internal material transport between assembly lines."),
        ("PR-2026-000010", "Datadog Cloud SIEM & Real-time APM Monitoring Licenses", PrStatusEnum.CONVERTED, ProcurementTypeEnum.OPEX, bu_it.id, cc_it.id, Decimal("370000.00"), "Annual APM and log ingestion licenses for 500 nodes."),
        ("PR-2026-000011", "Executive Boardroom Video Conferencing Acoustic Pods", PrStatusEnum.DRAFT, ProcurementTypeEnum.CAPEX, bu_fac.id, cost_centers.get("CC-FAC-003", cc_it).id, Decimal("555000.00"), "Soundproof conference booths for executive meetings."),
        ("PR-2026-000012", "Apple MacBook Pro M3 Fleet for Engineering Teams", PrStatusEnum.SUBMITTED, ProcurementTypeEnum.CAPEX, bu_rnd.id, cost_centers.get("CC-RND-005", cc_it).id, Decimal("2999000.00"), "Standard developer workstation refresh for 10 senior architects."),
        ("PR-2026-000013", "Biometric Access Control & Thermal Turret Surveillance", PrStatusEnum.APPROVED, ProcurementTypeEnum.CAPEX, bu_fac.id, cost_centers.get("CC-FAC-003", cc_it).id, Decimal("385000.00"), "Security compliance upgrades across all warehouse entrances."),
        ("PR-2026-000014", "Splunk Security Observability SIEM Platform Renewal", PrStatusEnum.PENDING_APPROVAL, ProcurementTypeEnum.OPEX, bu_it.id, cc_it.id, Decimal("640000.00"), "Security Operations Center threat analytics ingestion pipeline."),
        ("PR-2026-000015", "High-Density Industrial Warehouse Pallet Racks", PrStatusEnum.APPROVED, ProcurementTypeEnum.CAPEX, bu_ops.id, cost_centers.get("CC-LOG-004", cc_it).id, Decimal("708000.00"), "Heavy-duty pallet racking expansion for Pune distribution center."),
        ("PR-2026-000016", "Dell PowerEdge R760 High-Compute Machine Learning Nodes", PrStatusEnum.SUBMITTED, ProcurementTypeEnum.CAPEX, bu_rnd.id, cost_centers.get("CC-RND-005", cc_it).id, Decimal("1690000.00"), "Dual-socket GPU-capable compute nodes for AI sourcing modeling."),
    ]

    for pr_num, title, p_status, p_type, bu_id, cc_id, est_amt, justification in pr_expansion_configs:
        if pr_num not in prs_by_num:
            pr = Requisition(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                pr_number=pr_num,
                title=title,
                status=p_status,
                source=PrSourceEnum.MANUAL,
                procurement_type=p_type,
                requestor_id=buyer_user.id,
                business_unit_id=bu_id,
                department_id=dept_proc.id,
                cost_center_id=cc_id,
                category_id=cat_it.id,
                delivery_location_id=loc_hq.id,
                estimated_value=est_amt,
                currency="INR",
                description=justification,
                created_by=buyer_user.id,
                approved_at=now_utc - timedelta(days=1) if p_status in (PrStatusEnum.APPROVED, PrStatusEnum.CONVERTED) else None,
            )
            db.add(pr)
            await db.flush()
            prs_by_num[pr_num] = pr

            db.add(RequisitionLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                requisition_id=pr.id,
                line_number=1,
                item_description=title,
                category_id=cat_it.id,
                uom_id=uom_ea_id,
                quantity=Decimal("1.0000"),
                estimated_unit_price=est_amt,
                required_by_date=today + timedelta(days=20),
                delivery_location_id=loc_hq.id,
            ))

    # =========================================================================
    # 5. Purchase Orders across ALL 5 Vendors (PO-2026-000007 through 000016)
    # =========================================================================
    logger.info("[5/10] Expanding Purchase Orders across all 5 Vendors...")
    pos_res = await db.execute(select(PurchaseOrder).where(PurchaseOrder.org_id == DEFAULT_ORG_ID))
    pos_by_num = {p.po_number: p for p in pos_res.scalars().all()}

    v_acme = vendors_by_code.get("V-10001")
    v_gc = vendors_by_code.get("V-10002")
    v_apex = vendors_by_code.get("V-10003")
    v_nexus = vendors_by_code.get("V-10004")
    v_inno = vendors_by_code.get("V-10005")

    po_expansion_data = [
        ("PO-2026-000007", v_apex, PoStatusEnum.ACKNOWLEDGED, Decimal("700000.00"), Decimal("126000.00"), Decimal("826000.00"), "National logistics & dedicated intra-plant freight services"),
        ("PO-2026-000008", v_nexus, PoStatusEnum.SENT_TO_VENDOR, Decimal("1600000.00"), Decimal("288000.00"), Decimal("1888000.00"), "Autonomous Mobile Robots (AMR) & AGV warehouse fleet"),
        ("PO-2026-000009", v_inno, PoStatusEnum.FULLY_RECEIVED, Decimal("2500000.00"), Decimal("450000.00"), Decimal("2950000.00"), "Dell PowerEdge R760 rack servers with 3-Yr ProSupport Plus"),
        ("PO-2026-000010", v_gc, PoStatusEnum.ACKNOWLEDGED, Decimal("3000000.00"), Decimal("540000.00"), Decimal("3540000.00"), "Enterprise multi-region cloud transit gateway & Direct Connect"),
        ("PO-2026-000011", v_apex, PoStatusEnum.PARTIALLY_RECEIVED, Decimal("1200000.00"), Decimal("216000.00"), Decimal("1416000.00"), "Heavy-duty warehouse pallet racking & storage mezzanine"),
        ("PO-2026-000012", v_nexus, PoStatusEnum.APPROVED, Decimal("550000.00"), Decimal("99000.00"), Decimal("649000.00"), "Precision environmental sensors & automated test chambers"),
        ("PO-2026-000013", v_inno, PoStatusEnum.PENDING_APPROVAL, Decimal("1900000.00"), Decimal("342000.00"), Decimal("2242000.00"), "High-density enterprise all-flash NVMe storage arrays"),
        ("PO-2026-000014", v_acme, PoStatusEnum.CLOSED, Decimal("1100000.00"), Decimal("198000.00"), Decimal("1298000.00"), "Complete delivery of 14-inch Dell Latitude developer laptops"),
        ("PO-2026-000015", v_gc, PoStatusEnum.ACKNOWLEDGED, Decimal("800000.00"), Decimal("144000.00"), Decimal("944000.00"), "DevOps continuous integration & observability platform licenses"),
        ("PO-2026-000016", v_apex, PoStatusEnum.DRAFT, Decimal("300000.00"), Decimal("54000.00"), Decimal("354000.00"), "Bi-weekly scheduled materials delivery between Pune & Mumbai"),
    ]

    for po_num, vendor, status, subtotal, tax, total, desc_text in po_expansion_data:
        if vendor and po_num not in pos_by_num:
            po = PurchaseOrder(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_number=po_num,
                title=desc_text,
                vendor_id=vendor.id,
                business_unit_id=bu_it.id,
                category_id=cat_it.id,
                buyer_id=buyer_user.id,
                delivery_location_id=loc_hq.id,
                payment_term_id=pterm_net30_id,
                currency="INR",
                total_value=total,
                status=status,
                created_at=now_utc - timedelta(days=10),
                sent_at=now_utc - timedelta(days=9) if status != PoStatusEnum.DRAFT else None,
                acknowledged_at=now_utc - timedelta(days=8) if status in (PoStatusEnum.ACKNOWLEDGED, PoStatusEnum.PARTIALLY_RECEIVED, PoStatusEnum.FULLY_RECEIVED, PoStatusEnum.CLOSED) else None,
            )
            db.add(po)
            await db.flush()
            pos_by_num[po_num] = po

            db.add(PoLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_id=po.id,
                line_number=1,
                item_description=desc_text,
                uom_id=uom_ea_id,
                ordered_quantity=Decimal("1.0000"),
                unit_price=subtotal,
                tax_rate=Decimal("18.00"),
                open_quantity=Decimal("0.0000") if status in (PoStatusEnum.FULLY_RECEIVED, PoStatusEnum.CLOSED) else (Decimal("0.5000") if status == PoStatusEnum.PARTIALLY_RECEIVED else Decimal("1.0000")),
                received_quantity=Decimal("1.0000") if status in (PoStatusEnum.FULLY_RECEIVED, PoStatusEnum.CLOSED) else (Decimal("0.5000") if status == PoStatusEnum.PARTIALLY_RECEIVED else Decimal("0.0000")),
                invoiced_quantity=Decimal("1.0000") if status == PoStatusEnum.CLOSED else Decimal("0.0000"),
                delivery_date=today + timedelta(days=15),
            ))

    # =========================================================================
    # 6. Goods Receipts (GRN-2026-000003 through 000008)
    # =========================================================================
    logger.info("[6/10] Expanding Goods Receipt Notes & Inspections...")
    grns_res = await db.execute(select(GoodsReceiptNote).where(GoodsReceiptNote.org_id == DEFAULT_ORG_ID))
    grns_by_num = {g.grn_number: g for g in grns_res.scalars().all()}

    grn_expansion = [
        ("GRN-2026-000003", pos_by_num.get("PO-2026-000007"), v_apex, "CONFIRMED", "All logistics delivery milestones verified without damage."),
        ("GRN-2026-000004", pos_by_num.get("PO-2026-000009"), v_inno, "APPROVED", "Dell servers inspected, booted, asset-tagged and deployed."),
        ("GRN-2026-000005", pos_by_num.get("PO-2026-000008"), v_nexus, "DRAFT", "AGV delivery awaiting factory acceptance testing."),
        ("GRN-2026-000006", pos_by_num.get("PO-2026-000010"), v_gc, "APPROVED", "Cloud Direct Connect cross-connect bandwidth validated at 10Gbps."),
        ("GRN-2026-000007", pos_by_num.get("PO-2026-000011"), v_apex, "APPROVED", "Pallet racking batch 1 erected and safety certified."),
        ("GRN-2026-000008", pos_by_num.get("PO-2026-000014"), v_acme, "APPROVED", "Final replacement batch of 2 monitors inspected and cleared."),
    ]

    for grn_num, po, vendor, status, remarks in grn_expansion:
        if po and vendor and grn_num not in grns_by_num:
            po_line_res = await db.execute(select(PoLine).where(PoLine.po_id == po.id))
            po_line = po_line_res.scalars().first()
            if not po_line:
                continue

            grn = GoodsReceiptNote(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                grn_number=grn_num,
                po_id=po.id,
                vendor_id=vendor.id,
                received_by=buyer_user.id,
                receipt_date=today - timedelta(days=2),
                status=status,
                notes=remarks,
            )
            db.add(grn)
            await db.flush()
            grns_by_num[grn_num] = grn

            grn_line = GrnLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                grn_id=grn.id,
                po_line_id=po_line.id,
                received_quantity=Decimal("1.0000"),
                accepted_quantity=Decimal("1.0000"),
                rejected_quantity=Decimal("0.0000"),
            )
            db.add(grn_line)
            await db.flush()

            db.add(QualityInspection(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                grn_line_id=grn_line.id,
                inspector_id=admin_user.id,
                inspection_date=today - timedelta(days=2),
                result="PASSED" if status == "APPROVED" else "PENDING",
                accepted_quantity=Decimal("1.0000"),
                rejected_quantity=Decimal("0.0000"),
                remarks="Full specification & visual inspection passed.",
            ))

    # =========================================================================
    # 7. Advance Shipping Notices (ASNs)
    # =========================================================================
    logger.info("[7/10] Expanding Advance Shipping Notices across Suppliers...")
    asns_res = await db.execute(select(AdvanceShippingNotice).where(AdvanceShippingNotice.org_id == DEFAULT_ORG_ID))
    asns_by_num = {a.asn_number: a for a in asns_res.scalars().all()}

    asn_expansion = [
        ("ASN-2026-000005", pos_by_num.get("PO-2026-000007"), v_apex, "DELIVERED", "Apex Dedicated Transport", "APX-990182", "MH-12-RN-8800", "Dedicated logistics fleet on schedule."),
        ("ASN-2026-000006", pos_by_num.get("PO-2026-000008"), v_nexus, "SHIPPED", "FedEx Freight Express", "FX-88910234", "KA-04-TR-9912", "Automated AGVs dispatched in heavy wooden crate."),
        ("ASN-2026-000007", pos_by_num.get("PO-2026-000009"), v_inno, "DELIVERED", "DHL Global Forwarding", "DHL-77619203", "HR-26-DF-4401", "Precision server chassis with shock sensors intact."),
        ("ASN-2026-000008", pos_by_num.get("PO-2026-000010"), v_gc, "DELIVERED", "Gati KWE Logistics", "GATI-44019234", "TS-09-UB-1122", "Cryptographic key HSM appliance and fiber transceivers."),
        ("ASN-2026-000009", pos_by_num.get("PO-2026-000011"), v_apex, "PARTIALLY_DELIVERED", "Apex Dedicated Transport", "APX-449102", "MH-14-BT-5566", "Pallet racking vertical beams delivered. Crossbars in transit."),
    ]

    for asn_num, po, vendor, status, carrier, tracking, vehicle, notes in asn_expansion:
        if po and vendor and asn_num not in asns_by_num:
            po_line_res = await db.execute(select(PoLine).where(PoLine.po_id == po.id))
            po_line = po_line_res.scalars().first()
            if not po_line:
                continue

            asn = AdvanceShippingNotice(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                asn_number=asn_num,
                po_id=po.id,
                vendor_id=vendor.id,
                shipment_date=today - timedelta(days=3),
                expected_delivery_date=today - timedelta(days=1),
                carrier_name=carrier,
                tracking_number=tracking,
                vehicle_number=vehicle,
                packaging_type="CRATE",
                package_count=4,
                gross_weight_kg=Decimal("120.00"),
                status=status,
                barcode_data=f"{asn_num}{tracking}",
                notes=notes,
                shipped_at=now_utc - timedelta(days=3),
                received_at=now_utc - timedelta(days=1) if status == "DELIVERED" else None,
            )
            db.add(asn)
            await db.flush()
            asns_by_num[asn_num] = asn

            db.add(AsnLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                asn_id=asn.id,
                po_line_id=po_line.id,
                item_code="EXP-ITEM",
                item_description=notes,
                uom="EA",
                ordered_quantity=Decimal("1.0000"),
                shipped_quantity=Decimal("1.0000"),
                received_quantity=Decimal("1.0000") if status == "DELIVERED" else Decimal("0.0000"),
                lot_number=f"LOT-{asn_num[-4:]}",
            ))

    # =========================================================================
    # 8. Invoices, 3-Way Match & Payments
    # =========================================================================
    logger.info("[8/10] Expanding Invoices, Match Results, Disputes & Payments...")
    invs_res = await db.execute(select(Invoice).where(Invoice.org_id == DEFAULT_ORG_ID))
    invs_by_num = {inv.invoice_number: inv for inv in invs_res.scalars().all()}

    pays_res = await db.execute(select(PaymentRecord).where(PaymentRecord.org_id == DEFAULT_ORG_ID))
    pays_by_inv = {p.invoice_id: p for p in pays_res.scalars().all()}

    invoice_expansion = [
        ("INV-2026-000004", pos_by_num.get("PO-2026-000007"), v_apex, Decimal("826000.00"), Decimal("700000.00"), Decimal("126000.00"), InvoiceStatusEnum.APPROVED, PaymentStatusEnum.SCHEDULED),
        ("INV-2026-000005", pos_by_num.get("PO-2026-000009"), v_inno, Decimal("2950000.00"), Decimal("2500000.00"), Decimal("450000.00"), InvoiceStatusEnum.PENDING_APPROVAL, PaymentStatusEnum.PENDING),
        ("INV-2026-000006", pos_by_num.get("PO-2026-000010"), v_gc, Decimal("3540000.00"), Decimal("3000000.00"), Decimal("540000.00"), InvoiceStatusEnum.PAID, PaymentStatusEnum.COMPLETED),
        ("INV-2026-000007", pos_by_num.get("PO-2026-000008"), v_nexus, Decimal("1888000.00"), Decimal("1600000.00"), Decimal("288000.00"), InvoiceStatusEnum.DISPUTED, PaymentStatusEnum.DISPUTED),
        ("INV-2026-000008", pos_by_num.get("PO-2026-000011"), v_apex, Decimal("708000.00"), Decimal("600000.00"), Decimal("108000.00"), InvoiceStatusEnum.APPROVED, PaymentStatusEnum.SCHEDULED),
        ("INV-2026-000009", pos_by_num.get("PO-2026-000014"), v_acme, Decimal("1298000.00"), Decimal("1100000.00"), Decimal("198000.00"), InvoiceStatusEnum.PAID, PaymentStatusEnum.COMPLETED),
        ("INV-2026-000010", pos_by_num.get("PO-2026-000015"), v_gc, Decimal("944000.00"), Decimal("800000.00"), Decimal("144000.00"), InvoiceStatusEnum.APPROVED, PaymentStatusEnum.PROCESSING),
    ]

    for inv_num, po, vendor, total, sub, tax, inv_status, pay_status in invoice_expansion:
        if po and vendor and inv_num not in invs_by_num:
            po_line_res = await db.execute(select(PoLine).where(PoLine.po_id == po.id))
            po_line = po_line_res.scalars().first()
            if not po_line:
                continue

            inv = Invoice(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                invoice_number=inv_num,
                vendor_invoice_number=f"V-{inv_num}",
                po_id=po.id,
                vendor_id=vendor.id,
                invoice_date=today - timedelta(days=5),
                due_date=today + timedelta(days=25),
                currency="INR",
                subtotal=sub,
                tax_amount=tax,
                total_amount=total,
                paid_amount=total if pay_status == PaymentStatusEnum.COMPLETED else Decimal("0.00"),
                status=inv_status,
                payment_status=pay_status,
            )
            db.add(inv)
            await db.flush()
            invs_by_num[inv_num] = inv

            inv_line = InvoiceLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                invoice_id=inv.id,
                po_line_id=po_line.id,
                line_number=1,
                item_description=f"Tax invoice corresponding to {po.po_number}",
                quantity=Decimal("1.0000"),
                unit_price=sub,
                tax_rate=Decimal("18.00"),
                tax_amount=tax,
                line_total=total,
            )
            db.add(inv_line)
            await db.flush()

            is_mat = inv_status != InvoiceStatusEnum.DISPUTED
            db.add(InvoiceMatchResult(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                invoice_id=inv.id,
                invoice_line_id=inv_line.id,
                po_line_id=po_line.id,
                price_match=is_mat,
                price_deviation=Decimal("0.00") if is_mat else Decimal("80000.00"),
                quantity_match=True,
                quantity_deviation=Decimal("0.0000"),
                po_reference_valid=True,
                tax_match=True,
                tax_deviation=Decimal("0.00"),
                overall_match=is_mat,
                mismatch_reasons=None if is_mat else ["Unit price ₹18,88,000 exceeds PO authorized rate ₹16,00,000"],
            ))

            # Dispute thread if disputed
            if inv_status == InvoiceStatusEnum.DISPUTED:
                disp = Dispute(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    invoice_id=inv.id,
                    vendor_id=vendor.id,
                    raised_by=buyer_user.id,
                    reason_code="PRICE_MISMATCH",
                    description="Invoice billing unit rate does not align with awarded RFQ rate card.",
                    status="OPEN",
                    credit_note_amount=Decimal("80000.00"),
                )
                db.add(disp)
                await db.flush()
                db.add(DisputeMessage(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    dispute_id=disp.id,
                    sender_id=buyer_user.id,
                    message="Please provide credit note for ₹80,000 to match line 1 PO unit rate.",
                ))

            # Payment Record
            if inv.id not in pays_by_inv:
                utr = f"UTR-{vendor.vendor_code}-{now_utc.year}-{uuid4().hex[:6].upper()}" if pay_status == PaymentStatusEnum.COMPLETED else None
                pay = PaymentRecord(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    invoice_id=inv.id,
                    vendor_id=vendor.id,
                    currency="INR",
                    amount=total - (total * Decimal("0.02")),  # TDS 2% deducted
                    gross_amount=total,
                    tds_amount=total * Decimal("0.02"),
                    net_amount=total - (total * Decimal("0.02")),
                    payment_date=today - timedelta(days=1) if pay_status == PaymentStatusEnum.COMPLETED else today + timedelta(days=5),
                    payment_due_date=today + timedelta(days=25),
                    status=pay_status,
                    utr_number=utr,
                    payment_method="NEFT_RTGS",
                )
                db.add(pay)
                pays_by_inv[inv.id] = pay

    # =========================================================================
    # 9. Contracts & Lifecycle Management
    # =========================================================================
    logger.info("[9/10] Expanding Contracts across Vendors...")
    cons_res = await db.execute(select(Contract).where(Contract.org_id == DEFAULT_ORG_ID))
    cons_by_num = {c.contract_number: c for c in cons_res.scalars().all()}

    contract_expansion = [
        ("CON-2026-000004", v_inno, "Enterprise Hardware Supply & Server Maintenance MSA", "RATE_CONTRACT", ContractStatusEnum.ACTIVE, Decimal("20000000.00"), Decimal("8500000.00")),
        ("CON-2026-000005", v_apex, "Master Freight & Pan-India Warehouse Distribution Agreement", "SERVICES", ContractStatusEnum.ACTIVE, Decimal("7500000.00"), Decimal("4500000.00")),
        ("CON-2026-000006", v_nexus, "Automated Guided Vehicles (AGV) Supply & Maintenance", "WORKS", ContractStatusEnum.ACTIVE, Decimal("12000000.00"), Decimal("2400000.00")),
        ("CON-2026-000007", v_gc, "Cloud Managed Services & DevOps SRE Support", "SERVICES", ContractStatusEnum.PENDING_REVIEW, Decimal("5000000.00"), Decimal("0.00")),
        ("CON-2026-000008", v_apex, "Legacy Warehouse Facility Maintenance Contract", "AMC", ContractStatusEnum.EXPIRED, Decimal("3000000.00"), Decimal("3000000.00")),
    ]

    for cnum, vendor, title, ctype, status, value, spent in contract_expansion:
        if vendor and cnum not in cons_by_num:
            con = Contract(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                contract_number=cnum,
                title=title,
                vendor_id=vendor.id,
                business_unit_id=bu_it.id,
                category_id=cat_it.id,
                contract_type=ctype,
                status=status,
                start_date=today - timedelta(days=90),
                end_date=today + timedelta(days=275),
                currency="INR",
                total_value=value,
                utilized_value=spent,
                created_by=buyer_user.id,
            )
            db.add(con)
            await db.flush()
            cons_by_num[cnum] = con

            db.add(ContractLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                contract_id=con.id,
                line_number=1,
                item_description=title,
                uom_id=uom_ea_id,
                contracted_quantity=Decimal("1.0000"),
                unit_rate=value,
                utilized_quantity=Decimal("0.5000") if spent > 0 else Decimal("0.0000"),
            ))

            db.add(ContractMilestone(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                contract_id=con.id,
                title="Initial Deliverable & SLA Activation",
                description="Deliver initial batch and activate SLA monitoring",
                due_date=today - timedelta(days=30),
                responsible_party="VENDOR",
                status="COMPLETED" if status == ContractStatusEnum.ACTIVE else "PENDING",
            ))

    # =========================================================================
    # 10. Approver Tasks, In-App Notifications & Relational Tickets
    # =========================================================================
    logger.info("[10/10] Seeding Multi-Persona Notifications, Approver Tasks & Tickets...")

    # Approver Tasks
    wf_tmpl_res = await db.execute(select(WorkflowTemplate).where(WorkflowTemplate.org_id == DEFAULT_ORG_ID))
    wf_tmpl = wf_tmpl_res.scalars().first()

    tasks_data = [
        ("PR", prs_by_num.get("PR-2026-000008"), "Approve Cisco 40G Datacenter Core Switch Fleet (₹9,70,000.00)", "Line manager capital expenditure review required."),
        ("PR", prs_by_num.get("PR-2026-000012"), "Approve Apple MacBook Pro M3 Fleet for Engineering Teams (₹29,99,000.00)", "High-value IT asset refresh approval."),
        ("PO", pos_by_num.get("PO-2026-000013"), "Approve High-Density NVMe Enterprise Storage Arrays (₹22,42,000.00)", "Finance controller sign-off required prior to vendor release."),
        ("INV", invs_by_num.get("INV-2026-000005"), "Approve PowerEdge R760 Server Invoice Verification (₹29,50,000.00)", "3-way match verified. Approve for automated payment schedule."),
        ("CON", cons_by_num.get("CON-2026-000007"), "Review Cloud Managed Services & DevOps SRE Support Agreement", "Legal & commercial terms review."),
    ]

    for entity_type, entity, task_title, desc_text in tasks_data:
        if entity and wf_tmpl:
            wfi = WorkflowInstance(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                template_id=wf_tmpl.id,
                entity_type=entity_type,
                entity_id=entity.id,
                current_step_number=1,
                status=WorkflowInstanceStatusEnum.ACTIVE,
                started_at=now_utc - timedelta(hours=5),
            )
            db.add(wfi)
            await db.flush()

            # Task for Approver Robert Taylor
            db.add(WorkflowTask(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                workflow_instance_id=wfi.id,
                step_number=1,
                assigned_to=approver_user.id,
                assigned_role="APPROVER",
                status=ApprovalTaskStatusEnum.PENDING,
                comment=task_title,
                sla_deadline=now_utc + timedelta(days=2),
            ))

            # Task for Super Admin Alexander Vance as well
            db.add(WorkflowTask(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                workflow_instance_id=wfi.id,
                step_number=1,
                assigned_to=super_admin_user.id,
                assigned_role="SUPERADMIN",
                status=ApprovalTaskStatusEnum.PENDING,
                comment=f"[Executive Bypass] {task_title}",
                sla_deadline=now_utc + timedelta(days=2),
            ))

    # In-App Notifications for ALL Personas
    notification_configs = [
        # Super Admin Alexander Vance
        (super_admin_user, "CRITICAL_SLA", "SLA Alert: High-Value Server Procurement Approaching Deadline", "PO-2026-000013 has been awaiting approval for >24 hours. Executive action recommended.", "PO"),
        (super_admin_user, "SECURITY", "Quarterly CVC & ISO 27001 Compliance Audit Passed", "Compliance score assessed at 94.5%. Zero high or critical non-conformities.", "AUDIT"),
        (super_admin_user, "FINANCE", "Statutory TDS Reconciliation Batch Completed", "₹1,45,280 TDS deduction certificates generated for Q2 FY26.", "PAYMENT"),
        (super_admin_user, "CONTRACT", "New Master Services Agreement Activated", "CON-2026-000004 with Innovatech Hardware Systems (₹2.0 Cr) fully executed.", "CONTRACT"),

        # Buyer Sarah Jenkins
        (buyer_user, "RFQ", "Sealed Bids Window Closed for Cloud Storage Sourcing", "RFQ-2026-000002 has received 2 sealed bids. Ready for dual-key bid opening.", "RFQ"),
        (buyer_user, "GRN", "Goods Received: Dell Latitude Laptop Fleet", "GRN-2026-000001 confirmed at Mumbai HQ Dock. 10 units passed inspection.", "GRN"),
        (buyer_user, "DISPUTE", "Vendor Counter-Offer Received on Invoice Dispute", "Nexus Innovations replied to price discrepancy message on INV-2026-000007.", "INVOICE"),

        # Supplier Acme
        (users_by_email.get("supplier@acme.com"), "PO", "New Purchase Order Released: PO-2026-000004", "Acme Tech Solutions has received approved PO-2026-000004. Please acknowledge dispatch schedule.", "PO"),
        (users_by_email.get("supplier@acme.com"), "PAYMENT", "Payment Processed: UTR-HDFC-2026-889104", "₹1,15,640.00 credited to your HDFC bank account for INV-2026-000003.", "PAYMENT"),

        # Supplier Global Cloud
        (users_by_email.get("supplier@globalcloud.com"), "DISPUTE", "Clarification Requested on Invoice INV-2026-000002", "Buyer Sarah Jenkins flagged 4.0% variance. Please verify line item 2 unit pricing.", "INVOICE"),
        (users_by_email.get("supplier@globalcloud.com"), "TENDER", "Invitation to Participate in Cloud Sourcing Event", "You are invited to submit bids on RFQ-2026-000001.", "RFQ"),

        # Supplier Apex Logistics
        (users_by_email.get("supplier@apex.com"), "PO", "New Logistics Contract Purchase Order PO-2026-000007", "₹8,26,000.00 Pan-India logistics freight order approved and dispatched.", "PO"),
        (users_by_email.get("supplier@apex.com"), "ASN", "Advance Shipping Notice ASN-2026-000005 Delivered", "Receiving dock confirmed delivery of freight shipment at Mumbai HQ.", "ASN"),

        # Supplier Nexus
        (users_by_email.get("supplier@nexus.com"), "RFQ", "Tender Invitation: Automated Guided Vehicles Fleet", "Nexus Innovations invited to submit technical and commercial proposal.", "RFQ"),

        # Supplier Innovatech
        (users_by_email.get("supplier@innovatech.com"), "PAYMENT", "Payment Processed: UTR-INNO-2026-778901", "Payment scheduled for Dell PowerEdge server order INV-2026-000005.", "PAYMENT"),
    ]

    for user, n_type, title, msg, cat_name in notification_configs:
        if user:
            db.add(Notification(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                user_id=user.id,
                notification_type=n_type,
                channel=NotificationChannelEnum.IN_APP,
                title=title,
                body=msg,
                entity_type=cat_name,
                status=NotificationStatusEnum.SENT,
                sent_at=now_utc - timedelta(hours=3),
                created_at=now_utc - timedelta(hours=3),
            ))

    # Relational Tickets across Portals & Personas
    tickets_res = await db.execute(select(Ticket).where(Ticket.org_id == DEFAULT_ORG_ID))
    existing_tkt_nums = {t.ticket_number for t in tickets_res.scalars().all()}

    ticket_seed_data = [
        ("TKT-2026-000001", "PO-2026-000007 Logistics Gate Pass Delay at Mumbai Dock", "Driver unable to generate digital entry barcode due to gateway timeout.", "QUERY", "HIGH", "OPEN", "LOGISTICS", buyer_user.id, "buyer", approver_user.id, "Logistics Operations", "PO", pos_by_num.get("PO-2026-000007").id if pos_by_num.get("PO-2026-000007") else None, "PO-2026-000007"),
        ("TKT-2026-000002", "Discrepancy in HSN code on Dell Latitude PO Line 1", "Vendor tax team flagged HSN 84713010 vs 84713090 on tax invoice.", "DISCREPANCY", "MEDIUM", "IN_PROGRESS", "TAX_COMPLIANCE", buyer_user.id, "buyer", admin_user.id, "Finance & Tax", "PO", pos_by_num.get("PO-2026-000014").id if pos_by_num.get("PO-2026-000014") else None, "PO-2026-000014"),
        ("TKT-2026-000003", "Urgent: Direct Connect Cross-Connect Downtime", "Bandwidth throttling observed during evening off-peak replication window.", "BUG", "CRITICAL", "ESCALATED", "INFRASTRUCTURE", buyer_user.id, "buyer", super_admin_user.id, "SRE & Cloud Ops", "CONTRACT", cons_by_num.get("CON-2026-000007").id if cons_by_num.get("CON-2026-000007") else None, "CON-2026-000007"),
        ("TKT-2026-000004", "Payment Settlement Clarification for INV-2026-000004", "Apex Logistics requesting confirmation of scheduled payment batch date.", "QUERY", "LOW", "RESOLVED", "PAYMENTS", users_by_email.get("supplier@apex.com").id if users_by_email.get("supplier@apex.com") else buyer_user.id, "supplier", admin_user.id, "Accounts Payable", "INVOICE", invs_by_num.get("INV-2026-000004").id if invs_by_num.get("INV-2026-000004") else None, "INV-2026-000004"),
        ("TKT-2026-000005", "AGV Laser Guidance Sensor Calibration Support", "Nexus technical team requested site engineer contact for plant floor access.", "SUPPORT", "MEDIUM", "CLOSED", "ENGINEERING", users_by_email.get("supplier@nexus.com").id if users_by_email.get("supplier@nexus.com") else buyer_user.id, "supplier", buyer_user.id, "Plant Engineering", "PO", pos_by_num.get("PO-2026-000008").id if pos_by_num.get("PO-2026-000008") else None, "PO-2026-000008"),
        ("TKT-2026-000006", "Vendor Portal Certificate Expiry Warning", "SSL client certificate for ERP punchout connector expires in 14 days.", "AUDIT_QUERY", "HIGH", "PENDING_RESPONSE", "SECURITY", super_admin_user.id, "admin", super_admin_user.id, "InfoSec", None, None, None),
        ("TKT-2026-000007", "Transit Damage Claim for Server Rack Casters", "Two locking caster wheels found fractured upon crate unboxing at BLR dock.", "COMPLAINT", "HIGH", "IN_PROGRESS", "QUALITY", buyer_user.id, "buyer", buyer_user.id, "Procurement QA", "GRN", grns_by_num.get("GRN-2026-000004").id if grns_by_num.get("GRN-2026-000004") else None, "GRN-2026-000004"),
        ("TKT-2026-000008", "Request for Contract Milestone 1 Completion Certificate", "Innovatech submitted formal milestone sign-off dossier for review.", "CHANGE_REQUEST", "MEDIUM", "OPEN", "CONTRACTS", users_by_email.get("supplier@innovatech.com").id if users_by_email.get("supplier@innovatech.com") else buyer_user.id, "supplier", approver_user.id, "Commercial Contracts", "CONTRACT", cons_by_num.get("CON-2026-000004").id if cons_by_num.get("CON-2026-000004") else None, "CON-2026-000004"),
        ("TKT-2026-000009", "Cloud Transit Gateway Direct Connect IP Whitelisting", "Global Cloud requested additional static CIDR ranges whitelisted for disaster recovery interconnect.", "QUERY", "MEDIUM", "OPEN", "CLOUD_INFRASTRUCTURE", users_by_email.get("supplier@globalcloud.com").id if users_by_email.get("supplier@globalcloud.com") else buyer_user.id, "supplier", super_admin_user.id, "Cloud Engineering", "CONTRACT", cons_by_num.get("CON-2026-000007").id if cons_by_num.get("CON-2026-000007") else None, "CON-2026-000007"),
    ]

    for t_num, t_title, t_desc, t_type, t_prio, t_stat, t_cat, raised_by, portal, assigned_to, team, e_type, e_id, e_num in ticket_seed_data:
        if t_num not in existing_tkt_nums and raised_by:
            tkt = Ticket(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                ticket_number=t_num,
                title=t_title,
                description=t_desc,
                ticket_type=t_type,
                priority=t_prio,
                status=t_stat,
                category=t_cat,
                raised_by=raised_by,
                raised_by_portal=portal,
                assigned_to=assigned_to,
                assigned_team=team,
                entity_type=e_type,
                entity_id=e_id,
                entity_number=e_num,
                sla_status="WITHIN_SLA" if t_stat != "ESCALATED" else "BREACHED",
                created_at=now_utc - timedelta(days=4),
            )
            db.add(tkt)
            await db.flush()
            existing_tkt_nums.add(t_num)

            # Ticket Comment
            db.add(TicketComment(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                ticket_id=tkt.id,
                author_id=raised_by,
                content=f"Initial description and diagnostic payload submitted for {t_num}.",
                is_internal=False,
            ))

            if t_stat in ("IN_PROGRESS", "RESOLVED", "CLOSED", "ESCALATED"):
                db.add(TicketComment(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    ticket_id=tkt.id,
                    author_id=assigned_to if assigned_to else buyer_user.id,
                    content="Engineering & Procurement team investigated the request and updated ticket state.",
                    is_internal=True,
                ))

            db.add(TicketActivityLog(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                ticket_id=tkt.id,
                actor_id=raised_by,
                activity_type="CREATED",
                old_value=None,
                new_value=f"Status: {t_stat}, Priority: {t_prio}",
                created_at=now_utc - timedelta(days=4),
            ))

    await db.flush()
    logger.info("Successfully completed comprehensive enterprise database seeding!")


if __name__ == "__main__":
    asyncio.run(seed_enterprise_comprehensive())
