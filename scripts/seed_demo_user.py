"""
Comprehensive demo user and full end-to-end continuous platform workflow seed script for Default Organization.
Synchronously seeds:
1. Organization Master Data (Legal Entity, BU, Plant, Department, Cost Center, 5 Delivery Locations)
2. Master Data (8 Document Types, Categories tree, UOMs, Payment Terms NET30/NET60/IMMEDIATE)
3. Demo Users & Roles:
    * admin@procurement.com / Admin123456!@# (SUPERADMIN, ORG_ADMIN, PROCUREMENT_MANAGER)
    * buyer@procurement.com / Buyer123456!@# (REQUESTOR, BUYER, PROCUREMENT_OFFICER)
    * approver@procurement.com / Approver123!@# (APPROVER, PROCUREMENT_HEAD, FINANCE_MANAGER)
    * supplier@acme.com / Supplier123456!@# (SUPPLIER - V-10001 Acme Tech)
    * supplier@globalcloud.com / Supplier123456!@# (SUPPLIER - V-10002 Global Cloud)
4. Vendors across all 5 lifecycle stages (Active, Qualified with pending penny test, Submitted, Invited)
5. Vendor Category Mappings & 3-Month Performance Scorecards (OTD %, Quality %, Commercial)
6. Document Storage & Compliance Documents (GST, PAN, MSME, ISO9001, SOC2, PO, INV, CON)
7. Requisitions across all states:
    * PR-1: 3 lines (MacBook Pro, 4K Monitors, Docks), Approved, Capex
    * PR-2: 2 lines (Kubernetes Nodes, S3 Storage), Submitted, Opex, pending Approver task
    * PR-3: 3 lines (Chairs, Desks, Pedestals), Draft
    * PR-4: 4 lines across CAT-HW and CAT-FURN, Approved, for Split PR modal testing
    * PR-5: 1 line (Gaming monitors), Rejected with formal reason & timestamp
    * PR-ERP: Unmapped PR exception in unmapped_pr_exceptions for triage page
8. Workflow Instances & Approver Tasks:
    * 3 Pending tasks in Approver inbox (/tasks): PR-2, PO-6, CON-2
    * 4 Completed tasks showing historical decisions: PR-1, PR-5, PO-1, CON-1
9. RFQs / Tenders across 6 states:
    * RFQ-1: Published, 2 lots, 3 lines, 3 invited vendors, 2 clarifications
    * RFQ-2: Bid Open, 2 sealed bids, deadline passed -> Dual-Key Bid Opening
    * RFQ-3: Under Evaluation, opened bids, CS statement, line rankings, negotiation round 1
    * RFQ-4: Awarded, approved CS, approved ARN, award details -> Send Regrets button
    * RFQ-5: Draft with 1 lot & 1 line -> Wizard testing
    * RFQ-6: Live Reverse Auction OPEN, 2 participants, 6 live bids with sequential decrements
10. Purchase Orders across 6 states:
    * PO-1: Acknowledged, 3 lines, 18% GST, PoAmendment #1, signed PO document, linked GRN-1, INV-1, PAY-1
    * PO-2: Sent to Vendor, linked disputed INV-2 & Dispute thread -> Supplier acknowledge/amend
    * PO-3: Partially received (20 ordered, 12 received, 8 open), linked GRN-2 -> Create GRN / Create Invoice
    * PO-4: Approved -> Send to Vendor button
    * PO-5: Draft -> Line edit & submit for approval
    * PO-6: Pending Approval -> Approver inbox task
11. Goods Receipt Notes:
    * GRN-1: Approved & Confirmed for PO-1 (3 lines, 100% accepted)
    * GRN-2: Draft / Pending Inspection for PO-3 (10 accepted, 2 rejected for transit damage)
12. Invoices & 3-Way Match:
    * INV-1: Matched & Approved (0% variance), TDS 2%, scheduled payment PAY-1, attached PDF
    * INV-2: Disputed (>2% variance), 3-way match failure, active Dispute with 2-way message thread
    * INV-3: Paid with completed payment PAY-2 and UTR
13. Payments:
    * PAY-1: Scheduled for INV-1
    * PAY-2: Completed for INV-3 with UTR
    * PAY-3: Processing for PO-4
14. Contracts across 3 states:
    * CON-1: Active, Rate Contract, 30% utilization, 2 lines, 3 milestones, ContractAmendment #1, Aadhaar eSign log, attached PDF
    * CON-2: Under Review, Services Agreement, pending Approver task
    * CON-3: Draft, AMC
15. ERP Integrations (6 IntegrationJobs + 3 ScheduledJobRuns)
16. 50+ Audit Logs covering all entities and actions in current partition
17. Relational Tickets & Advanced Features (via seed_tickets)
18. In-App Notifications for all demo users (via seed_demo_notifications)

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

from sqlalchemy import and_, delete, select, text

from app.core.encryption import encrypt_field
from app.core.security import hash_password
from app.db.enums import (
    ApprovalTaskStatusEnum,
    AuditEntityTypeEnum,
    BidStatusEnum,
    ContractStatusEnum,
    DocumentCategoryEnum,
    EvaluationTypeEnum,
    IntegrationJobStatusEnum,
    InvoiceStatusEnum,
    PaymentStatusEnum,
    PoStatusEnum,
    ProcurementTypeEnum,
    PrSourceEnum,
    PrStatusEnum,
    RfqStatusEnum,
    RfqTypeEnum,
    SourcingTypeEnum,
    TaskActionEnum,
    UnmappedPrStatusEnum,
    UserStatusEnum,
    VendorStatusEnum,
    WorkflowInstanceStatusEnum,
)
from app.db.session import async_session, engine
from app.modules.audit.models import AuditLog
from app.modules.bid.models import AuctionParticipant, BidLineResponse, BidResponse, LiveAuction, LiveBid
from app.modules.contract.models import Contract, ContractAmendment, ContractDocument, ContractLine, ContractMilestone
from app.modules.document.models import Document, DocumentVersion
from app.modules.evaluation.models import (
    AwardDetail,
    AwardRecommendation,
    ComparativeStatement,
    CsLineRanking,
    Evaluation,
    EvaluationScore,
    Negotiation,
)
from app.modules.grn.models import GoodsReceiptNote, GrnLine
from app.modules.integration.models import IntegrationJob, ScheduledJobRun
from app.modules.invoice.models import Invoice, InvoiceLine, InvoiceMatchResult
from app.modules.master_data.models import Category, DeliveryLocation, DocumentType, PaymentTerm, UomMaster
from app.modules.organization.models import BusinessUnit, CostCenter, Department, LegalEntity, Organization, Plant
from app.modules.payment.models import Dispute, DisputeMessage, PaymentRecord
from app.modules.purchase_order.models import PoAmendment, PoLine, PurchaseOrder
from app.modules.requisition.models import Requisition, RequisitionLine, UnmappedPrException
from app.modules.sourcing.models import Rfq, RfqClarification, RfqLine, RfqLot, RfqParticipant
from app.modules.user.models import Role, User, UserRoleAssignment
from app.modules.vendor.models import Vendor, VendorBankAccount, VendorCategoryMapping, VendorContact, VendorDocument, VendorScorecard
from app.modules.workflow.models import WorkflowInstance, WorkflowTask, WorkflowTemplate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_ORG_ID = UUID("00000000-0000-0000-0000-000000000001")


async def seed_demo():
    now_utc = datetime.now(UTC)
    today = date.today()

    async with async_session() as db:
        # 1. Organization
        res = await db.execute(select(Organization).where(Organization.id == DEFAULT_ORG_ID))
        org = res.scalar_one_or_none()
        if not org:
            org = Organization(
                id=DEFAULT_ORG_ID,
                name="Default Organization",
                legal_name="Default Organization Private Limited",
                country_code="IN",
                base_currency="INR",
                cost_of_capital_rate=Decimal("0.1200"),
                settings={},
                version=1,
            )
            db.add(org)
            await db.flush()
            logger.info("Created Default Organization")

        # 2. Master Data: UOMs
        uoms = [
            ("EA", "Each"),
            ("SET", "Set"),
            ("BOX", "Box"),
            ("LOT", "Lot"),
            ("MTR", "Meter"),
            ("KG", "Kilogram"),
            ("HR", "Hour"),
            ("MON", "Month"),
        ]
        uom_map = {}
        for code, name in uoms:
            res = await db.execute(
                select(UomMaster).where(and_(UomMaster.org_id == DEFAULT_ORG_ID, UomMaster.code == code))
            )
            uom = res.scalar_one_or_none()
            if not uom:
                uom = UomMaster(id=uuid4(), org_id=DEFAULT_ORG_ID, code=code, name=name, is_active=True, version=1)
                db.add(uom)
                await db.flush()
            uom_map[code] = uom
        uom_ea_id = uom_map["EA"].id
        uom_set_id = uom_map["SET"].id

        # 3. Master Data: Payment Terms
        pterms = [
            ("NET30", "Net 30 Days", 30),
            ("NET60", "Net 60 Days", 60),
            ("IMMEDIATE", "Immediate Payment", 0),
        ]
        pterm_map = {}
        for code, name, days in pterms:
            res = await db.execute(
                select(PaymentTerm).where(and_(PaymentTerm.org_id == DEFAULT_ORG_ID, PaymentTerm.code == code))
            )
            pt = res.scalar_one_or_none()
            if not pt:
                pt = PaymentTerm(id=uuid4(), org_id=DEFAULT_ORG_ID, code=code, name=name, days=days, is_active=True, version=1)
                db.add(pt)
                await db.flush()
            pterm_map[code] = pt
        pterm_net30_id = pterm_map["NET30"].id

        # 4. Organization Structure: Legal Entity, BU, Plant, Dept, Cost Center
        res = await db.execute(select(LegalEntity).where(LegalEntity.org_id == DEFAULT_ORG_ID))
        legal_entity = res.scalars().first()
        if not legal_entity:
            legal_entity = LegalEntity(
                org_id=DEFAULT_ORG_ID,
                name="Default Procurement Corp Ltd",
                registration_number="REG-2026-001",
                gstin="27AABCU9603R1ZM",
                pan="AABCU9603R",
                city="Mumbai",
                state="Maharashtra",
                country_code="IN",
            )
            db.add(legal_entity)
            await db.flush()

        res = await db.execute(select(BusinessUnit).where(BusinessUnit.org_id == DEFAULT_ORG_ID))
        bu = res.scalars().first()
        if not bu:
            bu = BusinessUnit(
                org_id=DEFAULT_ORG_ID,
                legal_entity_id=legal_entity.id,
                code="BU-IT",
                name="Information Technology",
                default_currency="INR",
                is_active=True,
            )
            db.add(bu)
            await db.flush()

        res = await db.execute(select(Plant).where(Plant.org_id == DEFAULT_ORG_ID))
        plant = res.scalars().first()
        if not plant:
            plant = Plant(
                org_id=DEFAULT_ORG_ID,
                business_unit_id=bu.id,
                code="PLANT-HQ",
                name="Corporate Headquarters",
                plant_type="CORPORATE",
                city="Mumbai",
                state="Maharashtra",
                country_code="IN",
                is_active=True,
            )
            db.add(plant)
            await db.flush()

        res = await db.execute(select(Department).where(Department.org_id == DEFAULT_ORG_ID))
        dept = res.scalars().first()
        if not dept:
            dept = Department(
                org_id=DEFAULT_ORG_ID,
                business_unit_id=bu.id,
                code="DEPT-ENG",
                name="Engineering & Infrastructure",
                is_active=True,
            )
            db.add(dept)
            await db.flush()

        res = await db.execute(select(CostCenter).where(CostCenter.org_id == DEFAULT_ORG_ID))
        cc = res.scalars().first()
        if not cc:
            cc = CostCenter(
                org_id=DEFAULT_ORG_ID,
                business_unit_id=bu.id,
                code="CC-IT-001",
                name="IT Infrastructure Operations",
                gl_account="GL-600100",
                annual_budget=Decimal("50000000.00"),
                available_budget=Decimal("45000000.00"),
                is_active=True,
            )
            db.add(cc)
            await db.flush()

        # 5. Master Data: 5 Delivery Locations
        locations_data = [
            ("LOC-HQ-MUM", "HQ Server Room & Offices", "B-Wing, Tech Park, Powai", "Mumbai", "Maharashtra", "400076"),
            ("LOC-NCR-REG", "NCR Regional Tech Center", "Tower 4, Cyber City, DLF Phase 2", "Gurugram", "Haryana", "122002"),
            ("LOC-BLR-RND", "Bangalore R&D Facility", "Block C, EPIP Zone, Whitefield", "Bengaluru", "Karnataka", "560066"),
            ("LOC-PUN-DEP", "Pune Central Logistics Depot", "Plot 12, Phase 1, Hinjewadi Infotech Park", "Pune", "Maharashtra", "411057"),
            ("LOC-HYD-DC", "Hyderabad Cloud Data Center", "Mindspace IT Park, Hitec City", "Hyderabad", "Telangana", "500081"),
        ]
        loc_map = {}
        for lcode, lname, laddr, lcity, lstate, lpin in locations_data:
            res = await db.execute(
                select(DeliveryLocation).where(
                    and_(DeliveryLocation.org_id == DEFAULT_ORG_ID, DeliveryLocation.code == lcode)
                )
            )
            dl = res.scalar_one_or_none()
            if not dl:
                dl = DeliveryLocation(
                    org_id=DEFAULT_ORG_ID,
                    code=lcode,
                    name=lname,
                    address=laddr,
                    city=lcity,
                    state=lstate,
                    postal_code=lpin,
                    country_code="IN",
                    plant_id=plant.id,
                    is_active=True,
                )
                db.add(dl)
                await db.flush()
            loc_map[lcode] = dl
        loc = loc_map["LOC-HQ-MUM"]

        # 6. Master Data: 8 Document Types
        doc_types_data = [
            ("DOC-GST", "GST Registration Certificate", DocumentCategoryEnum.COMPLIANCE, True, True, False, 30),
            ("DOC-PAN", "PAN Card Copy", DocumentCategoryEnum.COMPLIANCE, True, True, False, 30),
            ("DOC-MSME", "MSME / Udyam Registration Certificate", DocumentCategoryEnum.COMPLIANCE, False, False, True, 30),
            ("DOC-ISO9001", "ISO 9001:2015 Quality Management Certificate", DocumentCategoryEnum.COMPLIANCE, False, False, True, 60),
            ("DOC-SOC2", "SOC 2 Type II Compliance Report", DocumentCategoryEnum.COMPLIANCE, False, False, True, 60),
            ("DOC-PO", "Purchase Order PDF", DocumentCategoryEnum.PURCHASE_ORDER, False, False, False, 30),
            ("DOC-INV", "Tax Invoice PDF", DocumentCategoryEnum.INVOICE, False, False, False, 30),
            ("DOC-CON", "Executed Contract Agreement", DocumentCategoryEnum.CONTRACT, False, False, True, 90),
        ]
        doc_type_map = {}
        for dt_code, dt_name, dt_cat, is_mand, is_mand_v, has_exp, val_alert in doc_types_data:
            res = await db.execute(
                select(DocumentType).where(and_(DocumentType.org_id == DEFAULT_ORG_ID, DocumentType.code == dt_code))
            )
            dt = res.scalar_one_or_none()
            if not dt:
                dt = DocumentType(
                    org_id=DEFAULT_ORG_ID,
                    code=dt_code,
                    name=dt_name,
                    category=dt_cat,
                    is_mandatory=is_mand,
                    is_mandatory_for_vendor=is_mand_v,
                    has_expiry_date=has_exp,
                    validity_alert_days=val_alert,
                    is_active=True,
                )
                db.add(dt)
                await db.flush()
            doc_type_map[dt_code] = dt

        # 7. Master Data: Categories
        categories = {}
        cat_defs = [
            ("CAT-IT", "Information Technology", None, 1),
            ("CAT-HW", "Hardware & Compute", "CAT-IT", 2),
            ("CAT-SW", "Software & SaaS Licenses", "CAT-IT", 2),
            ("CAT-CLOUD", "Cloud & Network Services", "CAT-IT", 2),
            ("CAT-NET", "Networking Equipment", "CAT-IT", 2),
            ("CAT-FAC", "Facilities & Operations", None, 1),
            ("CAT-FURN", "Office Furniture", "CAT-FAC", 2),
        ]
        for code, name, parent_code, lvl in cat_defs:
            res = await db.execute(
                select(Category).where(and_(Category.org_id == DEFAULT_ORG_ID, Category.code == code))
            )
            cat = res.scalar_one_or_none()
            if not cat:
                parent_id = categories[parent_code].id if parent_code else None
                cat = Category(
                    org_id=DEFAULT_ORG_ID,
                    code=code,
                    name=name,
                    parent_id=parent_id,
                    level=lvl,
                    is_active=True,
                )
                db.add(cat)
                await db.flush()
            categories[code] = cat

        # 8. Demo Users (Buyer, Admin, Approver)
        users_config = [
            {
                "email": "admin@procurement.com",
                "password": "Admin123456!@#",
                "first_name": "Admin",
                "last_name": "User",
                "employee_id": "EMP-001",
                "roles": ["SUPERADMIN", "ORG_ADMIN", "PROCUREMENT_MANAGER"],
            },
            {
                "email": "buyer@procurement.com",
                "password": "Buyer123456!@#",
                "first_name": "Buyer",
                "last_name": "Specialist",
                "employee_id": "EMP-002",
                "roles": ["REQUESTOR", "BUYER", "PROCUREMENT_OFFICER"],
            },
            {
                "email": "approver@procurement.com",
                "password": "Approver123!@#",
                "first_name": "Chief",
                "last_name": "Approver",
                "employee_id": "EMP-003",
                "roles": ["APPROVER", "PROCUREMENT_HEAD", "FINANCE_MANAGER"],
            },
        ]

        created_users = {}
        for uconf in users_config:
            res = await db.execute(
                select(User).where(and_(User.org_id == DEFAULT_ORG_ID, User.email == uconf["email"]))
            )
            user = res.scalar_one_or_none()
            if not user:
                user = User(
                    org_id=DEFAULT_ORG_ID,
                    email=uconf["email"],
                    password_hash=hash_password(uconf["password"]),
                    first_name=uconf["first_name"],
                    last_name=uconf["last_name"],
                    employee_id=uconf["employee_id"],
                    business_unit_id=bu.id,
                    department_id=dept.id,
                    plant_id=plant.id,
                    status=UserStatusEnum.ACTIVE,
                    mfa_enabled=False,
                    is_supplier_user=False,
                )
                db.add(user)
                await db.flush()
            created_users[uconf["email"]] = user

            # Assign roles
            for role_code in uconf["roles"]:
                res = await db.execute(select(Role).where(and_(Role.org_id == DEFAULT_ORG_ID, Role.code == role_code)))
                role = res.scalar_one_or_none()
                if role:
                    res = await db.execute(
                        select(UserRoleAssignment).where(
                            and_(
                                UserRoleAssignment.user_id == user.id,
                                UserRoleAssignment.role_id == role.id,
                            )
                        )
                    )
                    if not res.scalar_one_or_none():
                        db.add(
                            UserRoleAssignment(
                                org_id=DEFAULT_ORG_ID,
                                user_id=user.id,
                                role_id=role.id,
                                is_active=True,
                            )
                        )
        admin_user = created_users["admin@procurement.com"]
        buyer_user = created_users["buyer@procurement.com"]
        approver_user = created_users["approver@procurement.com"]

        # 9. Vendors across all 5 Lifecycle Stages
        vendors_seed_data = [
            {
                "vendor_code": "V-10001",
                "company_name": "Acme Tech Solutions Private Limited",
                "legal_name": "Acme Tech Solutions Pvt Ltd",
                "registration_type": "DOMESTIC",
                "pan": "AABCA1234A",
                "gstin": "27AABCA1234A1Z5",
                "primary_email": "sales@acmetech.example.com",
                "status": VendorStatusEnum.ACTIVE,
                "compliance_score": Decimal("92.50"),
                "performance_score": Decimal("88.00"),
                "city": "Bengaluru",
                "state": "Karnataka",
                "onboarding_step": 5,
                "activated_at": now_utc - timedelta(days=90),
                "contact_name": "Rajesh Kumar",
                "contact_phone": "+91-9876543210",
                "bank_name": "HDFC Bank",
                "bank_branch": "Koramangala, Bengaluru",
                "account_no": "50200012345678",
                "ifsc": "HDFC0000123",
                "penny_status": "SUCCESS",
            },
            {
                "vendor_code": "V-10002",
                "company_name": "Global Cloud & Systems Corp",
                "legal_name": "Global Cloud India Private Limited",
                "registration_type": "DOMESTIC",
                "pan": "BBCGB5678B",
                "gstin": "36BBCGB5678B1Z2",
                "primary_email": "contact@globalcloud.example.com",
                "status": VendorStatusEnum.ACTIVE,
                "compliance_score": Decimal("96.00"),
                "performance_score": Decimal("94.50"),
                "city": "Hyderabad",
                "state": "Telangana",
                "onboarding_step": 5,
                "activated_at": now_utc - timedelta(days=60),
                "contact_name": "Priya Sharma",
                "contact_phone": "+91-9811223344",
                "bank_name": "ICICI Bank",
                "bank_branch": "Hitec City, Hyderabad",
                "account_no": "000405001234",
                "ifsc": "ICIC0000004",
                "penny_status": "SUCCESS",
            },
            {
                "vendor_code": "V-10003",
                "company_name": "Apex Logistics Solutions India",
                "legal_name": "Apex Freight & Logistics Pvt Ltd",
                "registration_type": "DOMESTIC",
                "pan": "CCLAP9012C",
                "gstin": "27CCLAP9012C1Z8",
                "primary_email": "operations@apexlogistics.example.com",
                "status": VendorStatusEnum.QUALIFIED,
                "compliance_score": Decimal("85.00"),
                "performance_score": Decimal("80.00"),
                "city": "Pune",
                "state": "Maharashtra",
                "onboarding_step": 4,
                "qualified_at": now_utc - timedelta(days=3),
                "contact_name": "Anil Deshmukh",
                "contact_phone": "+91-9844556677",
                "bank_name": "State Bank of India",
                "bank_branch": "Shivaji Nagar, Pune",
                "account_no": "33445566778",
                "ifsc": "SBIN0000455",
                "penny_status": "PENDING",
            },
            {
                "vendor_code": "V-10004",
                "company_name": "Nexus Innovations Pvt Ltd",
                "legal_name": "Nexus Innovations Private Limited",
                "registration_type": "DOMESTIC",
                "pan": "DDENX3456D",
                "gstin": "29DDENX3456D1Z1",
                "primary_email": "onboarding@nexusinnovations.example.com",
                "status": VendorStatusEnum.SUBMITTED,
                "compliance_score": Decimal("75.00"),
                "city": "Bengaluru",
                "state": "Karnataka",
                "onboarding_step": 3,
                "submitted_at": now_utc - timedelta(days=1),
                "contact_name": "Kavita Reddy",
                "contact_phone": "+91-9922334455",
                "bank_name": "Axis Bank",
                "bank_branch": "Indiranagar, Bengaluru",
                "account_no": "912010045678912",
                "ifsc": "UTIB0000088",
                "penny_status": "NOT_INITIATED",
            },
            {
                "vendor_code": "V-10005",
                "company_name": "Innovatech Hardware Systems",
                "legal_name": "Innovatech Hardware Systems LLC",
                "registration_type": "DOMESTIC",
                "primary_email": "procurement@innovatech.example.com",
                "status": VendorStatusEnum.INVITED,
                "city": "Chennai",
                "state": "Tamil Nadu",
                "onboarding_step": 1,
                "invitation_token": "demo-invite-token-2026",
                "invitation_expires_at": now_utc + timedelta(days=14),
                "invited_by": buyer_user.id,
                "contact_name": "Suresh Raman",
                "contact_phone": "+91-9866778899",
                "penny_status": "NOT_INITIATED",
            },
        ]

        vendors_map = {}
        for vdata in vendors_seed_data:
            cname = vdata.pop("contact_name", None)
            cphone = vdata.pop("contact_phone", None)
            bname = vdata.pop("bank_name", None)
            bbranch = vdata.pop("bank_branch", None)
            bacc = vdata.pop("account_no", None)
            bifsc = vdata.pop("ifsc", None)
            bpenny = vdata.pop("penny_status", "NOT_INITIATED")

            res = await db.execute(
                select(Vendor).where(and_(Vendor.org_id == DEFAULT_ORG_ID, Vendor.vendor_code == vdata["vendor_code"]))
            )
            v = res.scalar_one_or_none()
            if not v:
                v = Vendor(org_id=DEFAULT_ORG_ID, **vdata)
                db.add(v)
                await db.flush()

                if cname:
                    db.add(
                        VendorContact(
                            id=uuid4(),
                            org_id=DEFAULT_ORG_ID,
                            vendor_id=v.id,
                            name=cname,
                            email=v.primary_email,
                            phone=cphone,
                            is_primary=True,
                            is_active=True,
                        )
                    )

                if bname and bacc:
                    db.add(
                        VendorBankAccount(
                            id=uuid4(),
                            org_id=DEFAULT_ORG_ID,
                            vendor_id=v.id,
                            account_holder_name=v.company_name,
                            bank_name=bname,
                            branch_name=bbranch,
                            account_number_encrypted=encrypt_field(bacc),
                            ifsc_code=bifsc,
                            is_primary=True,
                            penny_test_status=bpenny,
                            penny_test_reference=f"PENNY-{v.vendor_code}-01",
                            penny_test_initiated_at=now_utc - timedelta(days=2) if bpenny != "NOT_INITIATED" else None,
                            penny_test_validated_at=now_utc - timedelta(days=1) if bpenny == "SUCCESS" else None,
                            validated_by=admin_user.id if bpenny == "SUCCESS" else None,
                        )
                    )
            vendors_map[vdata["vendor_code"]] = v

        acme_vendor = vendors_map["V-10001"]
        gc_vendor = vendors_map["V-10002"]

        # 10. Vendor Category Mappings
        cat_mappings = [
            (acme_vendor.id, categories["CAT-HW"].id, True),
            (acme_vendor.id, categories["CAT-NET"].id, True),
            (gc_vendor.id, categories["CAT-CLOUD"].id, True),
            (gc_vendor.id, categories["CAT-SW"].id, True),
            (vendors_map["V-10003"].id, categories["CAT-FAC"].id, False),
            (vendors_map["V-10004"].id, categories["CAT-HW"].id, False),
            (vendors_map["V-10005"].id, categories["CAT-HW"].id, False),
        ]
        for vid, cid, is_qual in cat_mappings:
            res = await db.execute(
                select(VendorCategoryMapping).where(
                    and_(
                        VendorCategoryMapping.org_id == DEFAULT_ORG_ID,
                        VendorCategoryMapping.vendor_id == vid,
                        VendorCategoryMapping.category_id == cid,
                    )
                )
            )
            if not res.scalar_one_or_none():
                db.add(
                    VendorCategoryMapping(
                        org_id=DEFAULT_ORG_ID,
                        vendor_id=vid,
                        category_id=cid,
                        is_qualified=is_qual,
                        qualified_at=now_utc - timedelta(days=60) if is_qual else None,
                    )
                )
        await db.flush()

        # 11. Vendor Scorecards (3 Monthly Scorecards for Acme & Global Cloud)
        scorecards_data = [
            (acme_vendor.id, date(2026, 1, 1), date(2026, 1, 31), Decimal("92.50"), Decimal("95.00"), Decimal("88.00"), Decimal("90.00"), Decimal("91.50")),
            (acme_vendor.id, date(2026, 2, 1), date(2026, 2, 28), Decimal("89.00"), Decimal("96.50"), Decimal("87.50"), Decimal("91.00"), Decimal("90.80")),
            (acme_vendor.id, date(2026, 3, 1), date(2026, 3, 31), Decimal("94.00"), Decimal("98.00"), Decimal("90.00"), Decimal("92.50"), Decimal("93.60")),
            (gc_vendor.id, date(2026, 1, 1), date(2026, 1, 31), Decimal("98.00"), Decimal("99.00"), Decimal("92.00"), Decimal("95.00"), Decimal("96.00")),
            (gc_vendor.id, date(2026, 2, 1), date(2026, 2, 28), Decimal("97.50"), Decimal("99.50"), Decimal("93.00"), Decimal("94.00"), Decimal("96.00")),
            (gc_vendor.id, date(2026, 3, 1), date(2026, 3, 31), Decimal("99.00"), Decimal("99.50"), Decimal("94.00"), Decimal("96.00"), Decimal("97.10")),
        ]
        for vid, pstart, pend, otd, qacc, ccomp, resp, ovr in scorecards_data:
            res = await db.execute(
                select(VendorScorecard).where(
                    and_(
                        VendorScorecard.org_id == DEFAULT_ORG_ID,
                        VendorScorecard.vendor_id == vid,
                        VendorScorecard.period_start == pstart,
                    )
                )
            )
            if not res.scalar_one_or_none():
                db.add(
                    VendorScorecard(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        vendor_id=vid,
                        period_start=pstart,
                        period_end=pend,
                        on_time_delivery_rate=otd,
                        quality_acceptance_rate=qacc,
                        commercial_compliance_score=ccomp,
                        responsiveness_score=resp,
                        overall_score=ovr,
                        calculated_at=now_utc - timedelta(days=5),
                    )
                )
        await db.flush()

        # 12. Demo Supplier Users (Acme & Global Cloud)
        supplier_users_conf = [
            ("supplier@acme.com", "Acme", "Supplier", acme_vendor.id, "VEND-EMP-001"),
            ("supplier@globalcloud.com", "Global", "Supplier", gc_vendor.id, "VEND-EMP-002"),
        ]
        created_suppliers = {}
        for s_email, s_fn, s_ln, s_vid, s_emp in supplier_users_conf:
            res = await db.execute(select(User).where(and_(User.org_id == DEFAULT_ORG_ID, User.email == s_email)))
            s_user = res.scalar_one_or_none()
            if not s_user:
                s_user = User(
                    org_id=DEFAULT_ORG_ID,
                    email=s_email,
                    password_hash=hash_password("Supplier123456!@#"),
                    first_name=s_fn,
                    last_name=s_ln,
                    employee_id=s_emp,
                    status=UserStatusEnum.ACTIVE,
                    mfa_enabled=False,
                    is_supplier_user=True,
                    vendor_id=s_vid,
                )
                db.add(s_user)
                await db.flush()
            created_suppliers[s_email] = s_user

            res = await db.execute(select(Role).where(and_(Role.org_id == DEFAULT_ORG_ID, Role.code == "SUPPLIER")))
            sup_role = res.scalar_one_or_none()
            if sup_role:
                res = await db.execute(
                    select(UserRoleAssignment).where(
                        and_(UserRoleAssignment.user_id == s_user.id, UserRoleAssignment.role_id == sup_role.id)
                    )
                )
                if not res.scalar_one_or_none():
                    db.add(
                        UserRoleAssignment(
                            org_id=DEFAULT_ORG_ID,
                            user_id=s_user.id,
                            role_id=sup_role.id,
                            is_active=True,
                        )
                    )

        # 13. Requisitions across 5 States + Unmapped Exception
        pr_samples = [
            {
                "pr_number": "PR-IT-2026-000001",
                "title": "Annual Developer Laptops Refresh (MacBook Pro M3)",
                "description": "Procurement of 10x 16-inch M3 Pro developer workstations and displays for the platform team.",
                "status": PrStatusEnum.APPROVED,
                "estimated_value": Decimal("2159400.00"),
                "budget_check_status": "PASSED",
                "is_capex": True,
                "cat_code": "CAT-HW",
                "lines": [
                    {
                        "line_number": 1,
                        "item_description": "Apple MacBook Pro 16-inch M3 Pro / 36GB / 1TB SSD",
                        "quantity": Decimal("5.00"),
                        "estimated_unit_price": Decimal("240000.00"),
                        "category_code": "CAT-HW",
                        "uom_id": uom_ea_id,
                    },
                    {
                        "line_number": 2,
                        "item_description": "Dell UltraSharp 27-inch 4K USB-C Hub Monitor (U2723QE)",
                        "quantity": Decimal("10.00"),
                        "estimated_unit_price": Decimal("45000.00"),
                        "category_code": "CAT-HW",
                        "uom_id": uom_ea_id,
                    },
                    {
                        "line_number": 3,
                        "item_description": "Thunderbolt 4 Multi-Port Dual-Monitor Docks",
                        "quantity": Decimal("10.00"),
                        "estimated_unit_price": Decimal("18000.00"),
                        "category_code": "CAT-HW",
                        "uom_id": uom_ea_id,
                    },
                ],
            },
            {
                "pr_number": "PR-IT-2026-000002",
                "title": "Production Kubernetes Cluster Cloud Infrastructure",
                "description": "Multi-region cloud compute nodes, persistent storage, and NAT gateways for Q3-Q4.",
                "status": PrStatusEnum.SUBMITTED,
                "estimated_value": Decimal("1950000.00"),
                "budget_check_status": "PASSED",
                "is_capex": False,
                "cat_code": "CAT-CLOUD",
                "lines": [
                    {
                        "line_number": 1,
                        "item_description": "Managed Kubernetes Worker Node Pool (c6i.4xlarge x 20 nodes)",
                        "quantity": Decimal("6.00"),
                        "estimated_unit_price": Decimal("250000.00"),
                        "category_code": "CAT-CLOUD",
                        "uom_id": uom_ea_id,
                    },
                    {
                        "line_number": 2,
                        "item_description": "Multi-Region S3 Storage Tier 100TB High-IOPS",
                        "quantity": Decimal("1.00"),
                        "estimated_unit_price": Decimal("450000.00"),
                        "category_code": "CAT-CLOUD",
                        "uom_id": uom_ea_id,
                    },
                ],
            },
            {
                "pr_number": "PR-IT-2026-000003",
                "title": "Office Facilities & Ergonomic Seating Renewal",
                "description": "Ergonomic mesh chairs, dual-motor standing desks, and under-desk storage units.",
                "status": PrStatusEnum.DRAFT,
                "estimated_value": Decimal("1050000.00"),
                "budget_check_status": "NOT_CHECKED",
                "is_capex": False,
                "cat_code": "CAT-FURN",
                "lines": [
                    {
                        "line_number": 1,
                        "item_description": "Ergonomic High-Back Mesh Task Chair",
                        "quantity": Decimal("25.00"),
                        "estimated_unit_price": Decimal("12000.00"),
                        "category_code": "CAT-FURN",
                        "uom_id": uom_ea_id,
                    },
                    {
                        "line_number": 2,
                        "item_description": "Motorized Dual-Motor Height Adjustable Standing Desk",
                        "quantity": Decimal("15.00"),
                        "estimated_unit_price": Decimal("40000.00"),
                        "category_code": "CAT-FURN",
                        "uom_id": uom_ea_id,
                    },
                    {
                        "line_number": 3,
                        "item_description": "Mobile Under-Desk 3-Drawer Steel Pedestals",
                        "quantity": Decimal("25.00"),
                        "estimated_unit_price": Decimal("6000.00"),
                        "category_code": "CAT-FURN",
                        "uom_id": uom_ea_id,
                    },
                ],
            },
            {
                "pr_number": "PR-IT-2026-000004",
                "title": "Engineering Studio & Design Center Multi-Discipline Package",
                "description": "Multi-line hardware and ergonomic furnishings package created specifically for Split PR testing.",
                "status": PrStatusEnum.APPROVED,
                "estimated_value": Decimal("2196000.00"),
                "budget_check_status": "PASSED",
                "is_capex": True,
                "cat_code": "CAT-HW",
                "lines": [
                    {
                        "line_number": 1,
                        "item_description": "Custom Liquid-Cooled RTX 4090 Rendering Workstation",
                        "quantity": Decimal("4.00"),
                        "estimated_unit_price": Decimal("350000.00"),
                        "category_code": "CAT-HW",
                        "uom_id": uom_ea_id,
                    },
                    {
                        "line_number": 2,
                        "item_description": "32-inch 6K Retinal Designer Displays with Hood",
                        "quantity": Decimal("4.00"),
                        "estimated_unit_price": Decimal("120000.00"),
                        "category_code": "CAT-HW",
                        "uom_id": uom_ea_id,
                    },
                    {
                        "line_number": 3,
                        "item_description": "Executive Ergonomic Leather Recliners",
                        "quantity": Decimal("4.00"),
                        "estimated_unit_price": Decimal("35000.00"),
                        "category_code": "CAT-FURN",
                        "uom_id": uom_ea_id,
                    },
                    {
                        "line_number": 4,
                        "item_description": "Modular Conference Acoustic Partition Panels",
                        "quantity": Decimal("8.00"),
                        "estimated_unit_price": Decimal("22000.00"),
                        "category_code": "CAT-FURN",
                        "uom_id": uom_ea_id,
                    },
                ],
            },
            {
                "pr_number": "PR-IT-2026-000005",
                "title": "Ultra-Wide Curved OLED Displays for Engineering Labs",
                "description": "Non-standard high refresh rate gaming panels for test benches.",
                "status": PrStatusEnum.REJECTED,
                "estimated_value": Decimal("950000.00"),
                "budget_check_status": "PASSED",
                "rejection_reason": "OLED gaming monitors are not approved for corporate engineering standardization. Use certified 4K IPS monitors.",
                "rejected_at": now_utc - timedelta(days=2),
                "rejected_by": approver_user.id,
                "is_capex": True,
                "cat_code": "CAT-HW",
                "lines": [
                    {
                        "line_number": 1,
                        "item_description": "Ultra-Wide Curved OLED Gaming Displays 49-inch",
                        "quantity": Decimal("10.00"),
                        "estimated_unit_price": Decimal("95000.00"),
                        "category_code": "CAT-HW",
                        "uom_id": uom_ea_id,
                    }
                ],
            },
        ]

        pr_map = {}
        for pdata in pr_samples:
            res = await db.execute(
                select(Requisition).where(
                    and_(Requisition.org_id == DEFAULT_ORG_ID, Requisition.pr_number == pdata["pr_number"])
                )
            )
            pr = res.scalar_one_or_none()
            if not pr:
                lines = pdata.pop("lines")
                cat_code = pdata.pop("cat_code")
                is_capex = pdata.pop("is_capex")
                pdata.pop("rejection_reason", None)
                pdata.pop("rejected_at", None)
                pdata.pop("rejected_by", None)
                pr = Requisition(
                    org_id=DEFAULT_ORG_ID,
                    requestor_id=buyer_user.id,
                    business_unit_id=bu.id,
                    plant_id=plant.id,
                    department_id=dept.id,
                    cost_center_id=cc.id,
                    category_id=categories[cat_code].id,
                    currency="INR",
                    source=PrSourceEnum.MANUAL,
                    procurement_type=ProcurementTypeEnum.CAPEX if is_capex else ProcurementTypeEnum.OPEX,
                    delivery_location_id=loc.id,
                    required_by_date=today + timedelta(days=30),
                    **pdata,
                )
                db.add(pr)
                await db.flush()

                for l in lines:
                    line_cat_code = l.pop("category_code")
                    db.add(
                        RequisitionLine(
                            org_id=DEFAULT_ORG_ID,
                            requisition_id=pr.id,
                            category_id=categories[line_cat_code].id,
                            delivery_location_id=loc.id,
                            required_by_date=today + timedelta(days=30),
                            **l,
                        )
                    )
            pr_map[pdata["pr_number"]] = pr

        # Unmapped PR Exception
        res = await db.execute(
            select(Requisition).where(
                and_(Requisition.org_id == DEFAULT_ORG_ID, Requisition.pr_number == "PR-ERP-2026-UNMAPPED01")
            )
        )
        unmapped_pr = res.scalar_one_or_none()
        if not unmapped_pr:
            unmapped_pr = Requisition(
                org_id=DEFAULT_ORG_ID,
                pr_number="PR-ERP-2026-UNMAPPED01",
                title="Legacy ERP Import: Fiber Optic Patch Cables & Patch Panels",
                description="Imported from SAP MM with obsolete category code and unassigned cost center.",
                status=PrStatusEnum.DRAFT,
                estimated_value=Decimal("150000.00"),
                currency="INR",
                source=PrSourceEnum.ERP_API,
                procurement_type=ProcurementTypeEnum.OPEX,
                requestor_id=buyer_user.id,
                business_unit_id=bu.id,
                plant_id=plant.id,
                department_id=dept.id,
                cost_center_id=cc.id,
                category_id=categories["CAT-NET"].id,
                delivery_location_id=loc.id,
            )
            db.add(unmapped_pr)
            await db.flush()

            db.add(
                RequisitionLine(
                    org_id=DEFAULT_ORG_ID,
                    requisition_id=unmapped_pr.id,
                    line_number=1,
                    item_description="OM4 LC-to-LC Duplex Fiber Patch Cables 5m",
                    quantity=Decimal("50.00"),
                    uom_id=uom_ea_id,
                    estimated_unit_price=Decimal("3000.00"),
                    category_id=categories["CAT-NET"].id,
                    delivery_location_id=loc.id,
                )
            )

            db.add(
                UnmappedPrException(
                    org_id=DEFAULT_ORG_ID,
                    requisition_id=unmapped_pr.id,
                    failed_fields={
                        "category": {"value": "COMM-NET-FIBER", "reason": "Category code not found in master data"},
                        "cost_center": {"value": "CC-LEGACY-00", "reason": "Cost center closed in FY25"},
                    },
                    status=UnmappedPrStatusEnum.PENDING,
                    sla_deadline=now_utc + timedelta(hours=8),
                    sla_breach_level=0,
                    proposed_mappings={
                        "suggested_category": "CAT-NET",
                        "confidence": 0.92,
                        "rationale": "High semantic match with Networking Equipment",
                    },
                )
            )

        # 14. Document Storage & Compliance Documents
        docs_to_create = [
            ("doc_gst_acme", "VENDOR", acme_vendor.id, DocumentCategoryEnum.COMPLIANCE, "Acme_GST_Registration_Cert.pdf", "compliance-documents", f"vendors/{acme_vendor.id}/gst.pdf", 245100),
            ("doc_pan_acme", "VENDOR", acme_vendor.id, DocumentCategoryEnum.COMPLIANCE, "Acme_PAN_Card_Copy.pdf", "compliance-documents", f"vendors/{acme_vendor.id}/pan.pdf", 184200),
            ("doc_msme_acme", "VENDOR", acme_vendor.id, DocumentCategoryEnum.COMPLIANCE, "Acme_MSME_Udyam_Registration.pdf", "compliance-documents", f"vendors/{acme_vendor.id}/msme.pdf", 312000),
            ("doc_iso_gc", "VENDOR", gc_vendor.id, DocumentCategoryEnum.COMPLIANCE, "GlobalCloud_ISO9001_Quality_Cert.pdf", "compliance-documents", f"vendors/{gc_vendor.id}/iso9001.pdf", 420000),
            ("doc_soc2_gc", "VENDOR", gc_vendor.id, DocumentCategoryEnum.COMPLIANCE, "GlobalCloud_SOC2_TypeII_Report.pdf", "compliance-documents", f"vendors/{gc_vendor.id}/soc2.pdf", 1048576),
            ("doc_po1", "PURCHASE_ORDER", uuid4(), DocumentCategoryEnum.PURCHASE_ORDER, "Signed_PO_PO-2026-000001.pdf", "purchase-orders", "purchase-orders/PO-2026-000001/po.pdf", 524288),
            ("doc_inv1", "INVOICE", uuid4(), DocumentCategoryEnum.INVOICE, "Original_Tax_Invoice_INV-2026-000001.pdf", "invoices", "invoices/INV-2026-000001/invoice.pdf", 380120),
            ("doc_con1", "CONTRACT", uuid4(), DocumentCategoryEnum.CONTRACT, "Executed_Rate_Contract_CON-2026-000001.pdf", "contracts", "contracts/CON-2026-000001/agreement.pdf", 2097152),
            ("doc_pr1", "REQUISITION", pr_map["PR-IT-2026-000001"].id, DocumentCategoryEnum.AUDIT, "Engineering_Refresh_Business_Case.pdf", "audit-documents", f"pr/{pr_map['PR-IT-2026-000001'].id}/business_case.pdf", 150000),
            ("doc_ticket_tds", "TICKET", uuid4(), DocumentCategoryEnum.AUDIT, "Lower_TDS_Certificate_194C_FY26.pdf", "audit-documents", "tickets/tds_certificate.pdf", 175000),
        ]
        created_docs = {}
        for dkey, ent_type, ent_id, cat_enum, fname, bucket, mkey, fsize in docs_to_create:
            res = await db.execute(
                select(Document).where(and_(Document.org_id == DEFAULT_ORG_ID, Document.original_filename == fname))
            )
            doc = res.scalar_one_or_none()
            if not doc:
                doc = Document(
                    org_id=DEFAULT_ORG_ID,
                    entity_type=ent_type,
                    entity_id=ent_id,
                    category=cat_enum,
                    original_filename=fname,
                    stored_filename=f"stored_{fname}",
                    minio_bucket=bucket,
                    minio_key=mkey,
                    content_type="application/pdf",
                    file_size_bytes=fsize,
                    sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                    scan_status="CLEAN",
                    scan_result="PASS",
                    is_encrypted=False,
                    current_version=1,
                    created_by=buyer_user.id,
                )
                db.add(doc)
                await db.flush()
            created_docs[dkey] = doc

        # Vendor Compliance Documents
        v_docs_data = [
            (acme_vendor.id, doc_type_map["DOC-GST"].id, created_docs["doc_gst_acme"].id, None, "VERIFIED", "GSTIN verified via GSTN API portal."),
            (acme_vendor.id, doc_type_map["DOC-PAN"].id, created_docs["doc_pan_acme"].id, None, "VERIFIED", "PAN active and matched with NSDL records."),
            (acme_vendor.id, doc_type_map["DOC-MSME"].id, created_docs["doc_msme_acme"].id, today + timedelta(days=365), "VERIFIED", "Udyam registration verified for small enterprise category."),
            (gc_vendor.id, doc_type_map["DOC-ISO9001"].id, created_docs["doc_iso_gc"].id, today + timedelta(days=180), "VERIFIED", "ISO 9001:2015 valid through Q3 2026."),
            (gc_vendor.id, doc_type_map["DOC-SOC2"].id, created_docs["doc_soc2_gc"].id, today + timedelta(days=90), "VERIFIED", "Annual SOC 2 Type II report with zero exception findings."),
        ]
        for vid, dtid, did, exp_dt, vstat, vnotes in v_docs_data:
            res = await db.execute(
                select(VendorDocument).where(
                    and_(
                        VendorDocument.org_id == DEFAULT_ORG_ID,
                        VendorDocument.vendor_id == vid,
                        VendorDocument.document_type_id == dtid,
                    )
                )
            )
            if not res.scalar_one_or_none():
                db.add(
                    VendorDocument(
                        org_id=DEFAULT_ORG_ID,
                        vendor_id=vid,
                        document_type_id=dtid,
                        document_id=did,
                        expiry_date=exp_dt,
                        verified_by=admin_user.id,
                        verified_at=now_utc - timedelta(days=30),
                        verification_status=vstat,
                        verification_notes=vnotes,
                    )
                )
        await db.flush()

        # 15. RFQs / Tenders across 6 States
        # RFQ-1: Published with 2 Lots, 3 Lines, 3 Invited Participants & 2 Clarifications
        res = await db.execute(
            select(Rfq).where(and_(Rfq.org_id == DEFAULT_ORG_ID, Rfq.rfq_number == "RFQ-2026-000001"))
        )
        rfq1 = res.scalar_one_or_none()
        if not rfq1:
            rfq1 = Rfq(
                org_id=DEFAULT_ORG_ID,
                rfq_number="RFQ-2026-000001",
                title="Developer Laptops & Display Peripherals Package",
                description="Procurement of high-performance MacBook Pro 16-inch laptops and color-accurate 4K USB-C monitors.",
                rfq_type=RfqTypeEnum.LIMITED_TENDER,
                sourcing_type=SourcingTypeEnum.GOODS,
                evaluation_type=EvaluationTypeEnum.QCBS_QUALITY_COST,
                procurement_type=ProcurementTypeEnum.CAPEX,
                status=RfqStatusEnum.PUBLISHED,
                buyer_id=buyer_user.id,
                business_unit_id=bu.id,
                category_id=categories["CAT-HW"].id,
                currency="INR",
                estimated_value=Decimal("3300000.00"),
                bid_open_at=now_utc + timedelta(days=7, hours=1),
                bid_close_at=now_utc + timedelta(days=7),
                bid_validity_days=60,
                is_multi_lot=True,
                published_at=now_utc - timedelta(days=1),
                created_by=buyer_user.id,
                updated_by=buyer_user.id,
            )
            db.add(rfq1)
            await db.flush()

            lot1_1 = RfqLot(
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq1.id,
                lot_number=1,
                title="Workstations & Monitors Lot",
                estimated_value=Decimal("3120000.00"),
            )
            lot1_2 = RfqLot(
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq1.id,
                lot_number=2,
                title="Docking Stations & Accessories Lot",
                estimated_value=Decimal("180000.00"),
            )
            db.add_all([lot1_1, lot1_2])
            await db.flush()

            db.add_all(
                [
                    RfqLine(
                        org_id=DEFAULT_ORG_ID,
                        rfq_id=rfq1.id,
                        lot_id=lot1_1.id,
                        line_number=1,
                        item_description="Apple MacBook Pro 16-inch M3 Pro / 36GB / 1TB SSD",
                        category_id=categories["CAT-HW"].id,
                        uom_id=uom_ea_id,
                        quantity=Decimal("10.00"),
                        estimated_unit_price=Decimal("240000.00"),
                        delivery_location_id=loc.id,
                    ),
                    RfqLine(
                        org_id=DEFAULT_ORG_ID,
                        rfq_id=rfq1.id,
                        lot_id=lot1_1.id,
                        line_number=2,
                        item_description="27-inch 4K USB-C Color-Calibrated Displays",
                        category_id=categories["CAT-HW"].id,
                        uom_id=uom_ea_id,
                        quantity=Decimal("16.00"),
                        estimated_unit_price=Decimal("45000.00"),
                        delivery_location_id=loc.id,
                    ),
                    RfqLine(
                        org_id=DEFAULT_ORG_ID,
                        rfq_id=rfq1.id,
                        lot_id=lot1_2.id,
                        line_number=3,
                        item_description="Thunderbolt 4 Dual-Display Docks",
                        category_id=categories["CAT-HW"].id,
                        uom_id=uom_ea_id,
                        quantity=Decimal("10.00"),
                        estimated_unit_price=Decimal("18000.00"),
                        delivery_location_id=loc.id,
                    ),
                    RfqParticipant(
                        org_id=DEFAULT_ORG_ID,
                        rfq_id=rfq1.id,
                        vendor_id=acme_vendor.id,
                        invited_at=now_utc - timedelta(days=1),
                        invitation_status="INVITED",
                    ),
                    RfqParticipant(
                        org_id=DEFAULT_ORG_ID,
                        rfq_id=rfq1.id,
                        vendor_id=gc_vendor.id,
                        invited_at=now_utc - timedelta(days=1),
                        invitation_status="INVITED",
                    ),
                    RfqParticipant(
                        org_id=DEFAULT_ORG_ID,
                        rfq_id=rfq1.id,
                        vendor_id=vendors_map["V-10005"].id,
                        invited_at=now_utc - timedelta(days=1),
                        invitation_status="INVITED",
                    ),
                    RfqClarification(
                        org_id=DEFAULT_ORG_ID,
                        rfq_id=rfq1.id,
                        question="Is 3-year on-site AppleCare+ enterprise warranty required to be bundled with Lot 1 workstations?",
                        answer="Yes, 3-year comprehensive on-site next-business-day warranty is mandatory.",
                        asked_by=created_suppliers["supplier@acme.com"].id,
                        asked_by_vendor_id=acme_vendor.id,
                        answered_by=buyer_user.id,
                        answered_at=now_utc - timedelta(hours=12),
                        is_published=True,
                        published_at=now_utc - timedelta(hours=12),
                    ),
                    RfqClarification(
                        org_id=DEFAULT_ORG_ID,
                        rfq_id=rfq1.id,
                        question="Can vendors submit bids for Lot 2 accessories only?",
                        answer=None,
                        asked_by=created_suppliers["supplier@globalcloud.com"].id,
                        asked_by_vendor_id=gc_vendor.id,
                        is_published=False,
                    ),
                ]
            )

        # RFQ-2: BID_OPEN with Sealed Bids (Ready for Dual-Key Opening)
        res = await db.execute(
            select(Rfq).where(and_(Rfq.org_id == DEFAULT_ORG_ID, Rfq.rfq_number == "RFQ-2026-000002"))
        )
        rfq2 = res.scalar_one_or_none()
        if not rfq2:
            rfq2 = Rfq(
                org_id=DEFAULT_ORG_ID,
                rfq_number="RFQ-2026-000002",
                title="Enterprise Cloud Object Storage & Backup Expansion",
                description="Procurement of 500TB high-throughput cloud object storage with 99.999999999% durability SLA.",
                rfq_type=RfqTypeEnum.OPEN_TENDER,
                sourcing_type=SourcingTypeEnum.SERVICES,
                evaluation_type=EvaluationTypeEnum.L1_PRICE_ONLY,
                procurement_type=ProcurementTypeEnum.OPEX,
                status=RfqStatusEnum.BID_OPEN,
                buyer_id=buyer_user.id,
                business_unit_id=bu.id,
                category_id=categories["CAT-CLOUD"].id,
                currency="INR",
                estimated_value=Decimal("1200000.00"),
                bid_open_at=now_utc - timedelta(hours=2),
                bid_close_at=now_utc - timedelta(hours=1),
                bid_validity_days=90,
                is_multi_lot=False,
                published_at=now_utc - timedelta(days=3),
                created_by=buyer_user.id,
                updated_by=buyer_user.id,
            )
            db.add(rfq2)
            await db.flush()

            lot2 = RfqLot(
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq2.id,
                lot_number=1,
                title="Cloud Storage Lot",
                estimated_value=Decimal("1200000.00"),
            )
            db.add(lot2)
            await db.flush()

            line2 = RfqLine(
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq2.id,
                lot_id=lot2.id,
                line_number=1,
                item_description="500TB Managed S3-Compatible Object Storage (Annual)",
                category_id=categories["CAT-CLOUD"].id,
                uom_id=uom_ea_id,
                quantity=Decimal("1.00"),
                estimated_unit_price=Decimal("1200000.00"),
                delivery_location_id=loc.id,
            )
            db.add(line2)
            await db.flush()

            # Bid from Acme (Sealed)
            bid_acme = BidResponse(
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq2.id,
                vendor_id=acme_vendor.id,
                status=BidStatusEnum.SUBMITTED,
                total_amount_encrypted=encrypt_field("1150000.00"),
                total_amount=Decimal("0.00"),
                current_version=1,
                submitted_at=now_utc - timedelta(hours=3),
                bid_sealed_at=now_utc - timedelta(hours=3),
                bid_validity_days=90,
                technical_offer_compliant=True,
            )
            # Bid from Global Cloud (Sealed)
            bid_gc = BidResponse(
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq2.id,
                vendor_id=gc_vendor.id,
                status=BidStatusEnum.SUBMITTED,
                total_amount_encrypted=encrypt_field("1080000.00"),
                total_amount=Decimal("0.00"),
                current_version=1,
                submitted_at=now_utc - timedelta(hours=2),
                bid_sealed_at=now_utc - timedelta(hours=2),
                bid_validity_days=90,
                technical_offer_compliant=True,
            )
            db.add_all([bid_acme, bid_gc])
            await db.flush()

            db.add_all(
                [
                    BidLineResponse(
                        org_id=DEFAULT_ORG_ID,
                        bid_id=bid_acme.id,
                        rfq_line_id=line2.id,
                        lot_id=lot2.id,
                        unit_price_encrypted=encrypt_field("1150000.00"),
                        total_price_encrypted=encrypt_field("1150000.00"),
                        quantity=Decimal("1.00"),
                        currency="INR",
                        delivery_days=14,
                        tax_rate_declared=Decimal("18.00"),
                    ),
                    BidLineResponse(
                        org_id=DEFAULT_ORG_ID,
                        bid_id=bid_gc.id,
                        rfq_line_id=line2.id,
                        lot_id=lot2.id,
                        unit_price_encrypted=encrypt_field("1080000.00"),
                        total_price_encrypted=encrypt_field("1080000.00"),
                        quantity=Decimal("1.00"),
                        currency="INR",
                        delivery_days=7,
                        tax_rate_declared=Decimal("18.00"),
                    ),
                ]
            )

        # RFQ-3: UNDER_EVALUATION with Comparative Statement & Rankings
        res = await db.execute(
            select(Rfq).where(and_(Rfq.org_id == DEFAULT_ORG_ID, Rfq.rfq_number == "RFQ-2026-000003"))
        )
        rfq3 = res.scalar_one_or_none()
        if not rfq3:
            rfq3 = Rfq(
                org_id=DEFAULT_ORG_ID,
                rfq_number="RFQ-2026-000003",
                title="High-Performance Server Blades & SAN Storage Expansion",
                description="Procurement of compute nodes and fiber channel storage switches.",
                rfq_type=RfqTypeEnum.LIMITED_TENDER,
                sourcing_type=SourcingTypeEnum.GOODS,
                evaluation_type=EvaluationTypeEnum.QCBS_QUALITY_COST,
                procurement_type=ProcurementTypeEnum.CAPEX,
                status=RfqStatusEnum.UNDER_EVALUATION,
                buyer_id=buyer_user.id,
                business_unit_id=bu.id,
                category_id=categories["CAT-HW"].id,
                currency="INR",
                estimated_value=Decimal("4500000.00"),
                bid_open_at=now_utc - timedelta(days=2),
                bid_close_at=now_utc - timedelta(days=2),
                bids_opened_at=now_utc - timedelta(days=1),
                bids_opened_by=buyer_user.id,
                co_authorized_by=admin_user.id,
                created_by=buyer_user.id,
                updated_by=buyer_user.id,
            )
            db.add(rfq3)
            await db.flush()

            lot3 = RfqLot(
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq3.id,
                lot_number=1,
                title="Server Blades Lot",
                estimated_value=Decimal("4500000.00"),
            )
            db.add(lot3)
            await db.flush()

            line3 = RfqLine(
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq3.id,
                lot_id=lot3.id,
                line_number=1,
                item_description="Dual AMD EPYC 9654 96-Core Compute Server Blade",
                category_id=categories["CAT-HW"].id,
                uom_id=uom_ea_id,
                quantity=Decimal("3.00"),
                estimated_unit_price=Decimal("1500000.00"),
                delivery_location_id=loc.id,
            )
            db.add(line3)
            await db.flush()

            bid3_gc = BidResponse(
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq3.id,
                vendor_id=gc_vendor.id,
                status=BidStatusEnum.OPENED,
                total_amount_encrypted=encrypt_field("4100000.00"),
                total_amount=Decimal("4100000.00"),
                current_version=1,
                submitted_at=now_utc - timedelta(days=3),
                technical_score=Decimal("94.00"),
            )
            bid3_acme = BidResponse(
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq3.id,
                vendor_id=acme_vendor.id,
                status=BidStatusEnum.OPENED,
                total_amount_encrypted=encrypt_field("4350000.00"),
                total_amount=Decimal("4350000.00"),
                current_version=1,
                submitted_at=now_utc - timedelta(days=3),
                technical_score=Decimal("98.00"),
            )
            db.add_all([bid3_gc, bid3_acme])
            await db.flush()

            cs3 = ComparativeStatement(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq3.id,
                cs_number="CS-2026-000001",
                status="GENERATED",
                cost_of_capital_rate=Decimal("0.1200"),
                evaluation_methodology="QCBS (80% Quality / 20% Cost)",
                total_estimated_value=Decimal("4500000.00"),
                l1_total_value=Decimal("4100000.00"),
                savings_percentage=Decimal("8.89"),
                recommendations="Global Cloud is commercial L1; Acme Tech is technical L1. Shortlist both for commercial negotiation.",
                generated_by=buyer_user.id,
            )
            db.add(cs3)
            await db.flush()

            db.add_all(
                [
                    CsLineRanking(
                        org_id=DEFAULT_ORG_ID,
                        cs_id=cs3.id,
                        rfq_line_id=line3.id,
                        lot_id=lot3.id,
                        bid_id=bid3_gc.id,
                        vendor_id=gc_vendor.id,
                        raw_unit_price=Decimal("1366666.6667"),
                        freight_per_unit=Decimal("0.0"),
                        tax_per_unit=Decimal("246000.0"),
                        landed_cost=Decimal("1612666.6667"),
                        npv_adjusted_cost=Decimal("4100000.00"),
                        rank=1,
                        is_l1=True,
                        technical_score=Decimal("94.00"),
                        commercial_score=Decimal("100.00"),
                        composite_score=Decimal("96.40"),
                    ),
                    CsLineRanking(
                        org_id=DEFAULT_ORG_ID,
                        cs_id=cs3.id,
                        rfq_line_id=line3.id,
                        lot_id=lot3.id,
                        bid_id=bid3_acme.id,
                        vendor_id=acme_vendor.id,
                        raw_unit_price=Decimal("1450000.0000"),
                        freight_per_unit=Decimal("0.0"),
                        tax_per_unit=Decimal("261000.0"),
                        landed_cost=Decimal("1711000.0000"),
                        npv_adjusted_cost=Decimal("4350000.00"),
                        rank=2,
                        is_l1=False,
                        technical_score=Decimal("98.00"),
                        commercial_score=Decimal("94.25"),
                        composite_score=Decimal("96.50"),
                    ),
                    Negotiation(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        rfq_id=rfq3.id,
                        cs_id=cs3.id,
                        vendor_id=gc_vendor.id,
                        round_number=1,
                        original_price=Decimal("4100000.00"),
                        counter_price=Decimal("3900000.00"),
                        proposed_price=Decimal("4000000.00"),
                        price_change_pct=Decimal("-2.44"),
                        status="OPEN",
                        notes="Requested Global Cloud to match volume discount benchmark.",
                        negotiated_by=buyer_user.id,
                        initiated_by=buyer_user.id,
                    ),
                ]
            )

        # RFQ-4: AWARDED with Approved Award Recommendation Note (ARN)
        res = await db.execute(
            select(Rfq).where(and_(Rfq.org_id == DEFAULT_ORG_ID, Rfq.rfq_number == "RFQ-2026-000004"))
        )
        rfq4 = res.scalar_one_or_none()
        if not rfq4:
            rfq4 = Rfq(
                org_id=DEFAULT_ORG_ID,
                rfq_number="RFQ-2026-000004",
                title="Ergonomic Furniture & Executive Office Desks",
                description="Procurement of height-adjustable motorized desks and chairs.",
                rfq_type=RfqTypeEnum.LIMITED_TENDER,
                sourcing_type=SourcingTypeEnum.GOODS,
                evaluation_type=EvaluationTypeEnum.L1_PRICE_ONLY,
                procurement_type=ProcurementTypeEnum.OPEX,
                status=RfqStatusEnum.AWARDED,
                buyer_id=buyer_user.id,
                business_unit_id=bu.id,
                category_id=categories["CAT-FURN"].id,
                currency="INR",
                estimated_value=Decimal("850000.00"),
                created_by=buyer_user.id,
                updated_by=buyer_user.id,
            )
            db.add(rfq4)
            await db.flush()

            lot4 = RfqLot(
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq4.id,
                lot_number=1,
                title="Furniture Lot",
                estimated_value=Decimal("850000.00"),
            )
            db.add(lot4)
            await db.flush()

            line4 = RfqLine(
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq4.id,
                lot_id=lot4.id,
                line_number=1,
                item_description="Dual-Motor Standing Desk 1800x800mm Oak Finish",
                category_id=categories["CAT-FURN"].id,
                uom_id=uom_ea_id,
                quantity=Decimal("15.00"),
                estimated_unit_price=Decimal("56666.67"),
                delivery_location_id=loc.id,
            )
            db.add(line4)
            await db.flush()

            bid4 = BidResponse(
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq4.id,
                vendor_id=acme_vendor.id,
                status=BidStatusEnum.AWARDED,
                total_amount_encrypted=encrypt_field("780000.00"),
                total_amount=Decimal("780000.00"),
                current_version=1,
            )
            db.add(bid4)
            await db.flush()

            cs4 = ComparativeStatement(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq4.id,
                cs_number="CS-2026-000002",
                status="APPROVED",
                cost_of_capital_rate=Decimal("0.1200"),
                evaluation_methodology="L1 Lowest Evaluated Price",
                total_estimated_value=Decimal("850000.00"),
                l1_total_value=Decimal("780000.00"),
                savings_percentage=Decimal("8.24"),
                generated_by=buyer_user.id,
                approved_by=approver_user.id,
                approved_at=now_utc - timedelta(days=5),
            )
            db.add(cs4)
            await db.flush()

            arn4 = AwardRecommendation(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq4.id,
                cs_id=cs4.id,
                arn_number="ARN-2026-000001",
                status="APPROVED",
                justification="Acme Tech Solutions quoted Lowest Evaluated Rate L1 meeting all ergonomic specs.",
                total_awarded_value=Decimal("780000.00"),
                recommended_by=buyer_user.id,
                approved_by=approver_user.id,
                approved_at=now_utc - timedelta(days=4),
            )
            db.add(arn4)
            await db.flush()

            db.add(
                AwardDetail(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    arn_id=arn4.id,
                    rfq_line_id=line4.id,
                    lot_id=lot4.id,
                    vendor_id=acme_vendor.id,
                    bid_id=bid4.id,
                    awarded_unit_price=Decimal("52000.00"),
                    awarded_quantity=Decimal("15.00"),
                    awarded_total=Decimal("780000.00"),
                    award_type="FULL",
                )
            )

        # RFQ-5: DRAFT RFQ (Wizard testing)
        res = await db.execute(
            select(Rfq).where(and_(Rfq.org_id == DEFAULT_ORG_ID, Rfq.rfq_number == "RFQ-2026-000005"))
        )
        rfq5 = res.scalar_one_or_none()
        if not rfq5:
            rfq5 = Rfq(
                org_id=DEFAULT_ORG_ID,
                rfq_number="RFQ-2026-000005",
                title="Next-Generation AI GPU Cluster Interconnects",
                description="Draft tender for 800Gbps InfiniBand cables and optical transceivers.",
                rfq_type=RfqTypeEnum.OPEN_TENDER,
                sourcing_type=SourcingTypeEnum.GOODS,
                evaluation_type=EvaluationTypeEnum.L1_PRICE_ONLY,
                procurement_type=ProcurementTypeEnum.CAPEX,
                status=RfqStatusEnum.DRAFT,
                buyer_id=buyer_user.id,
                business_unit_id=bu.id,
                category_id=categories["CAT-NET"].id,
                currency="INR",
                estimated_value=Decimal("2200000.00"),
                bid_validity_days=60,
                created_by=buyer_user.id,
                updated_by=buyer_user.id,
            )
            db.add(rfq5)
            await db.flush()

            lot5 = RfqLot(
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq5.id,
                lot_number=1,
                title="AI Cluster Cabling",
                estimated_value=Decimal("2200000.00"),
            )
            db.add(lot5)
            await db.flush()

            db.add(
                RfqLine(
                    org_id=DEFAULT_ORG_ID,
                    rfq_id=rfq5.id,
                    lot_id=lot5.id,
                    line_number=1,
                    item_description="800Gbps OSFP Active Optical Cables 3m",
                    category_id=categories["CAT-NET"].id,
                    uom_id=uom_ea_id,
                    quantity=Decimal("20.00"),
                    estimated_unit_price=Decimal("110000.00"),
                    delivery_location_id=loc.id,
                )
            )

        # RFQ-6: Live Reverse Auction with 6 bids
        res = await db.execute(
            select(Rfq).where(and_(Rfq.org_id == DEFAULT_ORG_ID, Rfq.rfq_number == "RFQ-2026-000006"))
        )
        rfq6 = res.scalar_one_or_none()
        if not rfq6:
            rfq6 = Rfq(
                org_id=DEFAULT_ORG_ID,
                rfq_number="RFQ-2026-000006",
                title="Annual Bulk Server Rack Enclosures (Live Reverse Auction)",
                description="Live multi-vendor English reverse auction for 42U server rack cabinets.",
                rfq_type=RfqTypeEnum.LIMITED_TENDER,
                sourcing_type=SourcingTypeEnum.GOODS,
                evaluation_type=EvaluationTypeEnum.REVERSE_AUCTION,
                procurement_type=ProcurementTypeEnum.CAPEX,
                status=RfqStatusEnum.PUBLISHED,
                bidding_mode="LIVE_AUCTION",
                buyer_id=buyer_user.id,
                business_unit_id=bu.id,
                category_id=categories["CAT-HW"].id,
                currency="INR",
                estimated_value=Decimal("1800000.00"),
                created_by=buyer_user.id,
                updated_by=buyer_user.id,
            )
            db.add(rfq6)
            await db.flush()

            lot6 = RfqLot(
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq6.id,
                lot_number=1,
                title="Server Racks Lot",
                estimated_value=Decimal("1800000.00"),
            )
            db.add(lot6)
            await db.flush()

            db.add(
                RfqLine(
                    org_id=DEFAULT_ORG_ID,
                    rfq_id=rfq6.id,
                    lot_id=lot6.id,
                    line_number=1,
                    item_description="42U 1070mm Server Rack Enclosure with Dual PDU",
                    category_id=categories["CAT-HW"].id,
                    uom_id=uom_ea_id,
                    quantity=Decimal("30.00"),
                    estimated_unit_price=Decimal("60000.00"),
                    delivery_location_id=loc.id,
                )
            )

            auction = LiveAuction(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq6.id,
                status="OPEN",
                config={
                    "auction_start_at": (now_utc - timedelta(minutes=25)).isoformat(),
                    "auction_duration_minutes": 120,
                    "lot_ids": [str(lot6.id)],
                    "min_decrement_type": "ABSOLUTE",
                    "min_decrement_value": 5000.00,
                    "reserve_price_inr": 1650000.00,
                    "rank_visibility": "RANK_ONLY",
                    "auto_extend": True,
                    "auto_extend_trigger_minutes": 5,
                    "auto_extend_duration_minutes": 10,
                    "max_extensions": 3,
                    "allow_proxy_bid": True,
                    "require_all_lots": True,
                },
                scheduled_start_at=now_utc - timedelta(minutes=25),
                actual_start_at=now_utc - timedelta(minutes=25),
                current_close_at=now_utc + timedelta(minutes=95),
                extension_count=0,
                created_by=buyer_user.id,
            )
            db.add(auction)
            await db.flush()

            db.add_all(
                [
                    AuctionParticipant(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        auction_id=auction.id,
                        vendor_id=acme_vendor.id,
                        is_connected=True,
                    ),
                    AuctionParticipant(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        auction_id=auction.id,
                        vendor_id=gc_vendor.id,
                        is_connected=True,
                    ),
                ]
            )

            # 6 Sequential Live Bids
            live_bids_series = [
                (acme_vendor.id, Decimal("1780000.00"), 1, now_utc - timedelta(minutes=22)),
                (gc_vendor.id, Decimal("1750000.00"), 2, now_utc - timedelta(minutes=18)),
                (acme_vendor.id, Decimal("1720000.00"), 3, now_utc - timedelta(minutes=14)),
                (gc_vendor.id, Decimal("1690000.00"), 4, now_utc - timedelta(minutes=10)),
                (acme_vendor.id, Decimal("1660000.00"), 5, now_utc - timedelta(minutes=6)),
                (gc_vendor.id, Decimal("1630000.00"), 6, now_utc - timedelta(minutes=2)),
            ]
            for v_id, b_amt, seq, sub_time in live_bids_series:
                db.add(
                    LiveBid(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        auction_id=auction.id,
                        rfq_id=rfq6.id,
                        vendor_id=v_id,
                        lot_id=lot6.id,
                        bid_amount_inr=b_amt,
                        bid_sequence=seq,
                        is_valid=True,
                        submitted_at=sub_time,
                        client_ip="127.0.0.1",
                    )
                )

        # 16. Purchase Orders across 6 States
        # PO-1: ACKNOWLEDGED (Multi-line, delivered, invoiced, paid, with PoAmendment)
        res = await db.execute(
            select(PurchaseOrder).where(
                and_(PurchaseOrder.org_id == DEFAULT_ORG_ID, PurchaseOrder.po_number == "PO-2026-000001")
            )
        )
        po1 = res.scalar_one_or_none()
        if not po1:
            po1 = PurchaseOrder(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_number="PO-2026-000001",
                title="High-Performance Developer Laptops & Workstations Refresh",
                vendor_id=acme_vendor.id,
                source_pr_id=pr_map["PR-IT-2026-000001"].id,
                status=PoStatusEnum.ACKNOWLEDGED,
                business_unit_id=bu.id,
                plant_id=plant.id,
                category_id=categories["CAT-HW"].id,
                currency="INR",
                total_value=Decimal("2159400.00"),
                payment_term_id=pterm_net30_id,
                delivery_location_id=loc.id,
                expected_delivery_date=today + timedelta(days=14),
                buyer_id=buyer_user.id,
                created_by=buyer_user.id,
                po_pdf_document_id=created_docs["doc_po1"].id,
                sent_at=now_utc - timedelta(days=5),
                acknowledged_at=now_utc - timedelta(days=4),
                vendor_acknowledged_at=now_utc - timedelta(days=4),
                amendment_count=1,
            )
            db.add(po1)
            await db.flush()

            po1_line1 = PoLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_id=po1.id,
                line_number=1,
                item_description="Apple MacBook Pro 16-inch M3 Pro / 36GB / 1TB SSD",
                item_code="HW-MBP-16",
                uom_id=uom_ea_id,
                ordered_quantity=Decimal("5.0000"),
                unit_price=Decimal("240000.0000"),
                tax_rate=Decimal("18.00"),
                open_quantity=Decimal("0.0000"),
                received_quantity=Decimal("5.0000"),
                invoiced_quantity=Decimal("5.0000"),
                delivery_date=today + timedelta(days=14),
            )
            po1_line2 = PoLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_id=po1.id,
                line_number=2,
                item_description="Dell UltraSharp 27-inch 4K USB-C Hub Monitor (U2723QE)",
                item_code="HW-MON-4K",
                uom_id=uom_ea_id,
                ordered_quantity=Decimal("10.0000"),
                unit_price=Decimal("45000.0000"),
                tax_rate=Decimal("18.00"),
                open_quantity=Decimal("0.0000"),
                received_quantity=Decimal("10.0000"),
                invoiced_quantity=Decimal("10.0000"),
                delivery_date=today + timedelta(days=14),
            )
            po1_line3 = PoLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_id=po1.id,
                line_number=3,
                item_description="Thunderbolt 4 Multi-Port Dual-Monitor Docks",
                item_code="HW-DOCK-TB4",
                uom_id=uom_ea_id,
                ordered_quantity=Decimal("10.0000"),
                unit_price=Decimal("18000.0000"),
                tax_rate=Decimal("18.00"),
                open_quantity=Decimal("0.0000"),
                received_quantity=Decimal("10.0000"),
                invoiced_quantity=Decimal("10.0000"),
                delivery_date=today + timedelta(days=14),
            )
            db.add_all([po1_line1, po1_line2, po1_line3])
            await db.flush()

            # PoAmendment #1 for PO-1
            db.add(
                PoAmendment(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    po_id=po1.id,
                    amendment_number=1,
                    reason="Upgraded RAM specification from 36GB to 48GB unified memory on developer workstations",
                    field_changes={
                        "unit_price": {"old": 240000.0, "new": 248000.0},
                        "total_value": {"old": 2159400.0, "new": 2206560.0},
                    },
                    value_change=Decimal("47160.00"),
                    re_approval_required=True,
                    amended_by=buyer_user.id,
                    approved_by=approver_user.id,
                    approved_at=now_utc - timedelta(days=3),
                )
            )

            # GRN-1: Approved & Confirmed (PO-1)
            grn1 = GoodsReceiptNote(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                grn_number="GRN-2026-000001",
                po_id=po1.id,
                vendor_id=acme_vendor.id,
                receipt_date=today - timedelta(days=2),
                received_by=buyer_user.id,
                challan_number="CH-ACME-8891",
                challan_date=today - timedelta(days=3),
                status="APPROVED",
                confirmed_at=now_utc - timedelta(days=2),
                confirmed_by=buyer_user.id,
                created_by=buyer_user.id,
            )
            db.add(grn1)
            await db.flush()

            grn1_l1 = GrnLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                grn_id=grn1.id,
                po_line_id=po1_line1.id,
                received_quantity=Decimal("5.0000"),
                accepted_quantity=Decimal("5.0000"),
                rejected_quantity=Decimal("0.0000"),
                qc_required=False,
                qc_status="NOT_REQUIRED",
            )
            grn1_l2 = GrnLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                grn_id=grn1.id,
                po_line_id=po1_line2.id,
                received_quantity=Decimal("10.0000"),
                accepted_quantity=Decimal("10.0000"),
                rejected_quantity=Decimal("0.0000"),
                qc_required=False,
                qc_status="NOT_REQUIRED",
            )
            grn1_l3 = GrnLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                grn_id=grn1.id,
                po_line_id=po1_line3.id,
                received_quantity=Decimal("10.0000"),
                accepted_quantity=Decimal("10.0000"),
                rejected_quantity=Decimal("0.0000"),
                qc_required=False,
                qc_status="NOT_REQUIRED",
            )
            db.add_all([grn1_l1, grn1_l2, grn1_l3])
            await db.flush()

            # Invoice-1: Matched with 2% TDS & Scheduled Payment
            inv1 = Invoice(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                invoice_number="INV-2026-000001",
                vendor_invoice_number="ACME/2026/0441",
                vendor_id=acme_vendor.id,
                po_id=po1.id,
                status=InvoiceStatusEnum.PENDING_APPROVAL,
                invoice_date=today - timedelta(days=1),
                due_date=today + timedelta(days=29),
                currency="INR",
                subtotal=Decimal("1830000.00"),
                tax_amount=Decimal("329400.00"),
                total_amount=Decimal("2159400.00"),
                tds_amount=Decimal("36600.00"),
                financial_year="FY2026-27",
                payment_terms_code="NET30",
                match_status="MATCHED",
                payment_status=PaymentStatusEnum.PENDING,
                paid_amount=Decimal("0.0"),
                created_by=created_suppliers["supplier@acme.com"].id,
            )
            db.add(inv1)
            await db.flush()

            inv1_l1 = InvoiceLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                invoice_id=inv1.id,
                po_line_id=po1_line1.id,
                grn_line_id=grn1_l1.id,
                line_number=1,
                item_description="Apple MacBook Pro 16-inch M3 Pro / 36GB / 1TB SSD",
                quantity=Decimal("5.0000"),
                unit_price=Decimal("240000.0000"),
                tax_rate=Decimal("18.00"),
                tax_amount=Decimal("216000.00"),
                line_total=Decimal("1416000.00"),
            )
            inv1_l2 = InvoiceLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                invoice_id=inv1.id,
                po_line_id=po1_line2.id,
                grn_line_id=grn1_l2.id,
                line_number=2,
                item_description="Dell UltraSharp 27-inch 4K USB-C Hub Monitor (U2723QE)",
                quantity=Decimal("10.0000"),
                unit_price=Decimal("45000.0000"),
                tax_rate=Decimal("18.00"),
                tax_amount=Decimal("81000.00"),
                line_total=Decimal("531000.00"),
            )
            inv1_l3 = InvoiceLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                invoice_id=inv1.id,
                po_line_id=po1_line3.id,
                grn_line_id=grn1_l3.id,
                line_number=3,
                item_description="Thunderbolt 4 Multi-Port Dual-Monitor Docks",
                quantity=Decimal("10.0000"),
                unit_price=Decimal("18000.0000"),
                tax_rate=Decimal("18.00"),
                tax_amount=Decimal("32400.00"),
                line_total=Decimal("212400.00"),
            )
            db.add_all([inv1_l1, inv1_l2, inv1_l3])
            await db.flush()

            for iline, pline in [(inv1_l1, po1_line1), (inv1_l2, po1_line2), (inv1_l3, po1_line3)]:
                db.add(
                    InvoiceMatchResult(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        invoice_id=inv1.id,
                        invoice_line_id=iline.id,
                        po_line_id=pline.id,
                        price_match=True,
                        price_deviation=Decimal("0.0"),
                        quantity_match=True,
                        quantity_deviation=Decimal("0.0"),
                        po_reference_valid=True,
                        tax_match=True,
                        tax_deviation=Decimal("0.0"),
                        overall_match=True,
                        mismatch_reasons=[],
                    )
                )

            # Scheduled Payment PAY-1
            db.add(
                PaymentRecord(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    invoice_id=inv1.id,
                    vendor_id=acme_vendor.id,
                    payment_date=today + timedelta(days=29),
                    amount=Decimal("2122800.00"),
                    gross_amount=Decimal("2159400.00"),
                    tds_amount=Decimal("36600.00"),
                    net_amount=Decimal("2122800.00"),
                    payment_due_date=today + timedelta(days=29),
                    currency="INR",
                    status=PaymentStatusEnum.SCHEDULED,
                )
            )

        # PO-2: SENT_TO_VENDOR (Awaiting Supplier Acknowledgment / Disputed Invoice)
        res = await db.execute(
            select(PurchaseOrder).where(
                and_(PurchaseOrder.org_id == DEFAULT_ORG_ID, PurchaseOrder.po_number == "PO-2026-000002")
            )
        )
        po2 = res.scalar_one_or_none()
        if not po2:
            po2 = PurchaseOrder(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_number="PO-2026-000002",
                title="Cloud Network Security Firewalls & Gateway Appliances",
                vendor_id=acme_vendor.id,
                status=PoStatusEnum.SENT_TO_VENDOR,
                business_unit_id=bu.id,
                plant_id=plant.id,
                category_id=categories["CAT-HW"].id,
                currency="INR",
                total_value=Decimal("590000.00"),
                payment_term_id=pterm_net30_id,
                delivery_location_id=loc.id,
                expected_delivery_date=today + timedelta(days=21),
                buyer_id=buyer_user.id,
                created_by=buyer_user.id,
                sent_at=now_utc - timedelta(hours=6),
            )
            db.add(po2)
            await db.flush()

            po2_line = PoLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_id=po2.id,
                line_number=1,
                item_description="Enterprise Threat Defense Gateway Rack 1U",
                item_code="HW-GW-1U",
                uom_id=uom_ea_id,
                ordered_quantity=Decimal("2.0000"),
                unit_price=Decimal("250000.0000"),
                tax_rate=Decimal("18.00"),
                open_quantity=Decimal("2.0000"),
                received_quantity=Decimal("0.0000"),
                invoiced_quantity=Decimal("0.0000"),
                delivery_date=today + timedelta(days=21),
            )
            db.add(po2_line)
            await db.flush()

            # Disputed Invoice INV-2
            inv2 = Invoice(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                invoice_number="INV-2026-000002",
                vendor_invoice_number="ACME/2026/0449",
                vendor_id=acme_vendor.id,
                po_id=po2.id,
                status=InvoiceStatusEnum.DISPUTED,
                invoice_date=today - timedelta(days=1),
                due_date=today + timedelta(days=29),
                currency="INR",
                subtotal=Decimal("520000.00"),
                tax_amount=Decimal("93600.00"),
                total_amount=Decimal("613600.00"),
                financial_year="FY2026-27",
                payment_terms_code="NET30",
                match_status="MISMATCHED",
                payment_status=PaymentStatusEnum.PENDING,
                paid_amount=Decimal("0.0"),
                created_by=created_suppliers["supplier@acme.com"].id,
            )
            db.add(inv2)
            await db.flush()

            inv2_line = InvoiceLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                invoice_id=inv2.id,
                po_line_id=po2_line.id,
                line_number=1,
                item_description="Enterprise Threat Defense Gateway Rack 1U",
                quantity=Decimal("2.0000"),
                unit_price=Decimal("260000.0000"),
                tax_rate=Decimal("18.00"),
                tax_amount=Decimal("93600.00"),
                line_total=Decimal("613600.00"),
            )
            db.add(inv2_line)

            db.add(
                InvoiceMatchResult(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    invoice_id=inv2.id,
                    invoice_line_id=inv2_line.id,
                    po_line_id=po2_line.id,
                    price_match=False,
                    price_deviation=Decimal("4.00"),
                    quantity_match=True,
                    quantity_deviation=Decimal("0.0"),
                    po_reference_valid=True,
                    tax_match=True,
                    tax_deviation=Decimal("0.0"),
                    overall_match=False,
                    mismatch_reasons=["Unit price exceeds PO agreed rate by 4.0% (>2% tolerance limit)"],
                )
            )

            # Open Dispute & Thread
            disp = Dispute(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                invoice_id=inv2.id,
                vendor_id=acme_vendor.id,
                reason_code="PRICE_MISMATCH",
                description="Unit price billed at 260,000 INR vs PO unit price of 250,000 INR (exceeds 2% auto-match tolerance).",
                status="OPEN",
                raised_by=buyer_user.id,
            )
            db.add(disp)
            await db.flush()

            db.add_all(
                [
                    DisputeMessage(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        dispute_id=disp.id,
                        sender_id=buyer_user.id,
                        message="Please reissue invoice matching the agreed PO rate of 250,000 INR or provide a credit note of 23,600 INR.",
                        created_at=now_utc - timedelta(hours=5),
                    ),
                    DisputeMessage(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        dispute_id=disp.id,
                        sender_id=created_suppliers["supplier@acme.com"].id,
                        message="We are reviewing our dispatch billing ledger. Our finance team will upload a credit note within 24 hours.",
                        created_at=now_utc - timedelta(hours=2),
                    ),
                ]
            )

        # PO-3: PARTIALLY_RECEIVED (20 ordered, 12 received, 8 open)
        res = await db.execute(
            select(PurchaseOrder).where(
                and_(PurchaseOrder.org_id == DEFAULT_ORG_ID, PurchaseOrder.po_number == "PO-2026-000003")
            )
        )
        po3 = res.scalar_one_or_none()
        if not po3:
            po3 = PurchaseOrder(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_number="PO-2026-000003",
                title="27-inch 4K Color-Accurate Engineering Displays Batch 2",
                vendor_id=acme_vendor.id,
                status=PoStatusEnum.PARTIALLY_RECEIVED,
                business_unit_id=bu.id,
                plant_id=plant.id,
                category_id=categories["CAT-HW"].id,
                currency="INR",
                total_value=Decimal("1062000.00"),
                payment_term_id=pterm_net30_id,
                delivery_location_id=loc.id,
                expected_delivery_date=today + timedelta(days=10),
                buyer_id=buyer_user.id,
                created_by=buyer_user.id,
                sent_at=now_utc - timedelta(days=10),
                acknowledged_at=now_utc - timedelta(days=9),
            )
            db.add(po3)
            await db.flush()

            po3_line = PoLine(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_id=po3.id,
                line_number=1,
                item_description="27-inch 4K USB-C Color-Calibrated Displays",
                item_code="HW-DSP-4K",
                uom_id=uom_ea_id,
                ordered_quantity=Decimal("20.0000"),
                unit_price=Decimal("45000.0000"),
                tax_rate=Decimal("18.00"),
                open_quantity=Decimal("8.0000"),
                received_quantity=Decimal("12.0000"),
                invoiced_quantity=Decimal("0.0000"),
                delivery_date=today + timedelta(days=10),
            )
            db.add(po3_line)
            await db.flush()

            # GRN-2: DRAFT / PENDING_INSPECTION (10 accepted, 2 rejected for transit damage)
            grn2 = GoodsReceiptNote(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                grn_number="GRN-2026-000002",
                po_id=po3.id,
                vendor_id=acme_vendor.id,
                receipt_date=today,
                received_by=buyer_user.id,
                challan_number="CH-ACME-9012",
                challan_date=today - timedelta(days=1),
                status="DRAFT",
                created_by=buyer_user.id,
            )
            db.add(grn2)
            await db.flush()

            db.add(
                GrnLine(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    grn_id=grn2.id,
                    po_line_id=po3_line.id,
                    received_quantity=Decimal("12.0000"),
                    accepted_quantity=Decimal("10.0000"),
                    rejected_quantity=Decimal("2.0000"),
                    rejection_reason="Cracked bezel and panel damage during freight transport.",
                    qc_required=True,
                    qc_status="PENDING_INSPECTION",
                )
            )

        # PO-4: APPROVED (Ready for "Send to Vendor")
        res = await db.execute(
            select(PurchaseOrder).where(
                and_(PurchaseOrder.org_id == DEFAULT_ORG_ID, PurchaseOrder.po_number == "PO-2026-000004")
            )
        )
        po4 = res.scalar_one_or_none()
        if not po4:
            po4 = PurchaseOrder(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_number="PO-2026-000004",
                title="Enterprise Core 100G Spine Switches",
                vendor_id=gc_vendor.id,
                status=PoStatusEnum.APPROVED,
                business_unit_id=bu.id,
                plant_id=plant.id,
                category_id=categories["CAT-NET"].id,
                currency="INR",
                total_value=Decimal("885000.00"),
                payment_term_id=pterm_net30_id,
                delivery_location_id=loc.id,
                expected_delivery_date=today + timedelta(days=25),
                buyer_id=buyer_user.id,
                created_by=buyer_user.id,
            )
            db.add(po4)
            await db.flush()

            db.add(
                PoLine(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    po_id=po4.id,
                    line_number=1,
                    item_description="100G Managed L3 Data Center Spine Switch 32-Port",
                    item_code="NET-SW-100G",
                    uom_id=uom_ea_id,
                    ordered_quantity=Decimal("1.0000"),
                    unit_price=Decimal("750000.0000"),
                    tax_rate=Decimal("18.00"),
                    open_quantity=Decimal("1.0000"),
                    received_quantity=Decimal("0.0000"),
                    invoiced_quantity=Decimal("0.0000"),
                    delivery_date=today + timedelta(days=25),
                )
            )

        # PO-5: DRAFT (Ready for editing & line changes)
        res = await db.execute(
            select(PurchaseOrder).where(
                and_(PurchaseOrder.org_id == DEFAULT_ORG_ID, PurchaseOrder.po_number == "PO-2026-000005")
            )
        )
        po5 = res.scalar_one_or_none()
        if not po5:
            po5 = PurchaseOrder(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_number="PO-2026-000005",
                title="Ergonomic Motorized Desks Initial Rollout",
                vendor_id=acme_vendor.id,
                status=PoStatusEnum.DRAFT,
                business_unit_id=bu.id,
                plant_id=plant.id,
                category_id=categories["CAT-FURN"].id,
                currency="INR",
                total_value=Decimal("920400.00"),
                payment_term_id=pterm_net30_id,
                delivery_location_id=loc.id,
                expected_delivery_date=today + timedelta(days=30),
                buyer_id=buyer_user.id,
                created_by=buyer_user.id,
            )
            db.add(po5)
            await db.flush()

            db.add(
                PoLine(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    po_id=po5.id,
                    line_number=1,
                    item_description="Dual-Motor Standing Desk 1800x800mm Oak Finish",
                    item_code="FUR-DESK-05",
                    uom_id=uom_ea_id,
                    ordered_quantity=Decimal("15.0000"),
                    unit_price=Decimal("52000.0000"),
                    tax_rate=Decimal("18.00"),
                    open_quantity=Decimal("15.0000"),
                    received_quantity=Decimal("0.0000"),
                    invoiced_quantity=Decimal("0.0000"),
                    delivery_date=today + timedelta(days=30),
                )
            )

        # PO-6: PENDING_APPROVAL (Lights up Approver Inbox /tasks)
        res = await db.execute(
            select(PurchaseOrder).where(
                and_(PurchaseOrder.org_id == DEFAULT_ORG_ID, PurchaseOrder.po_number == "PO-2026-000006")
            )
        )
        po6 = res.scalar_one_or_none()
        if not po6:
            po6 = PurchaseOrder(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                po_number="PO-2026-000006",
                title="Enterprise Cloud Object Storage Expansion 500TB",
                vendor_id=gc_vendor.id,
                status=PoStatusEnum.PENDING_APPROVAL,
                business_unit_id=bu.id,
                plant_id=plant.id,
                category_id=categories["CAT-CLOUD"].id,
                currency="INR",
                total_value=Decimal("1416000.00"),
                payment_term_id=pterm_net30_id,
                delivery_location_id=loc.id,
                expected_delivery_date=today + timedelta(days=15),
                buyer_id=buyer_user.id,
                created_by=buyer_user.id,
            )
            db.add(po6)
            await db.flush()

            db.add(
                PoLine(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    po_id=po6.id,
                    line_number=1,
                    item_description="500TB Managed S3-Compatible Object Storage (Annual)",
                    item_code="CLOUD-S3-500",
                    uom_id=uom_ea_id,
                    ordered_quantity=Decimal("1.0000"),
                    unit_price=Decimal("1200000.0000"),
                    tax_rate=Decimal("18.00"),
                    open_quantity=Decimal("1.0000"),
                    received_quantity=Decimal("0.0000"),
                    invoiced_quantity=Decimal("0.0000"),
                    delivery_date=today + timedelta(days=15),
                )
            )

        # 17. Paid Invoice INV-3 & Processed Payment PAY-2
        res = await db.execute(
            select(Invoice).where(and_(Invoice.org_id == DEFAULT_ORG_ID, Invoice.invoice_number == "INV-2026-000003"))
        )
        inv3 = res.scalar_one_or_none()
        if not inv3:
            inv3 = Invoice(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                invoice_number="INV-2026-000003",
                vendor_invoice_number="ACME/2026/0398",
                vendor_id=acme_vendor.id,
                po_id=po1.id,
                status=InvoiceStatusEnum.PAID,
                invoice_date=today - timedelta(days=35),
                due_date=today - timedelta(days=5),
                currency="INR",
                subtotal=Decimal("100000.00"),
                tax_amount=Decimal("18000.00"),
                total_amount=Decimal("118000.00"),
                financial_year="FY2026-27",
                payment_terms_code="NET30",
                match_status="MATCHED",
                payment_status=PaymentStatusEnum.COMPLETED,
                paid_amount=Decimal("118000.00"),
                created_by=created_suppliers["supplier@acme.com"].id,
            )
            db.add(inv3)
            await db.flush()

            db.add(
                PaymentRecord(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    invoice_id=inv3.id,
                    vendor_id=acme_vendor.id,
                    payment_date=today - timedelta(days=5),
                    amount=Decimal("118000.00"),
                    gross_amount=Decimal("118000.00"),
                    tds_amount=Decimal("0.00"),
                    net_amount=Decimal("118000.00"),
                    payment_due_date=today - timedelta(days=5),
                    currency="INR",
                    utr_number="UTR-HDFC-2026-889104",
                    payment_method="NEFT",
                    erp_payment_reference="SAP-PAY-4400192",
                    status=PaymentStatusEnum.COMPLETED,
                )
            )

        # Payment PAY-3 (PROCESSING status for test)
        res_pay3 = await db.execute(select(PaymentRecord).where(PaymentRecord.status == PaymentStatusEnum.PROCESSING))
        if not res_pay3.scalar_one_or_none():
            db.add(
                PaymentRecord(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    invoice_id=inv1.id,
                    vendor_id=acme_vendor.id,
                    payment_date=today,
                    amount=Decimal("150000.00"),
                    gross_amount=Decimal("150000.00"),
                    tds_amount=Decimal("0.00"),
                    net_amount=Decimal("150000.00"),
                    payment_due_date=today,
                    currency="INR",
                    payment_method="RTGS",
                    status=PaymentStatusEnum.PROCESSING,
                )
            )

        # 18. Contracts across 3 States
        res = await db.execute(
            select(Contract).where(and_(Contract.org_id == DEFAULT_ORG_ID, Contract.contract_number == "CON-2026-000001"))
        )
        con1 = res.scalar_one_or_none()
        if not con1:
            con1 = Contract(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                contract_number="CON-2026-000001",
                title="Master Rate Contract for Engineering Compute Hardware",
                vendor_id=acme_vendor.id,
                status=ContractStatusEnum.ACTIVE,
                contract_type="RATE_CONTRACT",
                currency="INR",
                total_value=Decimal("5000000.00"),
                utilized_value=Decimal("1500000.00"),
                start_date=today - timedelta(days=60),
                end_date=today + timedelta(days=305),
                payment_term_id=pterm_net30_id,
                business_unit_id=bu.id,
                category_id=categories["CAT-HW"].id,
                renewal_notice_days=30,
                auto_renew=False,
                esign_provider="AADHAAR_ESIGN",
                esign_request_id="ESIGN-REQ-2026-001",
                signed_document_id=created_docs["doc_con1"].id,
                signing_log=[
                    {
                        "signer_role": "BUYER",
                        "signer_name": f"{buyer_user.first_name} {buyer_user.last_name}",
                        "signer_email": buyer_user.email,
                        "signed_at": (now_utc - timedelta(days=60)).isoformat(),
                        "ip_address": "127.0.0.1",
                        "auth_mode": "AADHAAR_OTP",
                    },
                    {
                        "signer_role": "SUPPLIER",
                        "signer_name": "Rajesh Kumar",
                        "signer_email": "sales@acmetech.example.com",
                        "signed_at": (now_utc - timedelta(days=59)).isoformat(),
                        "ip_address": "127.0.0.1",
                        "auth_mode": "DIGITAL_SIGNATURE_DSC",
                    },
                ],
                activated_at=now_utc - timedelta(days=60),
                created_by=buyer_user.id,
                updated_by=buyer_user.id,
                amendment_count=1,
            )
            db.add(con1)
            await db.flush()

            db.add_all(
                [
                    ContractLine(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        contract_id=con1.id,
                        line_number=1,
                        item_description="Apple MacBook Pro 16-inch M3 Pro / 36GB / 1TB SSD",
                        uom_id=uom_ea_id,
                        contracted_quantity=Decimal("20.0000"),
                        unit_rate=Decimal("240000.0000"),
                        utilized_quantity=Decimal("6.0000"),
                    ),
                    ContractLine(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        contract_id=con1.id,
                        line_number=2,
                        item_description="Dell UltraSharp 27-inch 4K USB-C Hub Monitor (U2723QE)",
                        uom_id=uom_ea_id,
                        contracted_quantity=Decimal("30.0000"),
                        unit_rate=Decimal("45000.0000"),
                        utilized_quantity=Decimal("10.0000"),
                    ),
                    ContractMilestone(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        contract_id=con1.id,
                        title="Phase 1: Initial Engineering Batch Delivery",
                        description="Delivery of 10 developer workstations and peripheral docking stations.",
                        due_date=today - timedelta(days=30),
                        responsible_party="SUPPLIER",
                        status="COMPLETED",
                        completed_at=now_utc - timedelta(days=28),
                        completion_notes="Received and verified by IT logistics.",
                    ),
                    ContractMilestone(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        contract_id=con1.id,
                        title="Phase 2: Mid-Year QA & DevOps Hardware Batch",
                        description="Delivery of second batch of workstations.",
                        due_date=today + timedelta(days=90),
                        responsible_party="SUPPLIER",
                        status="PENDING",
                    ),
                    ContractMilestone(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        contract_id=con1.id,
                        title="Phase 3: Final Acceptance & Warranty Sign-Off",
                        description="Verification of enterprise support coverage and replacement asset pool.",
                        due_date=today + timedelta(days=280),
                        responsible_party="BUYER",
                        status="PENDING",
                    ),
                    ContractDocument(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        contract_id=con1.id,
                        document_id=created_docs["doc_con1"].id,
                        document_purpose="EXECUTED_AGREEMENT",
                        version_number=1,
                    ),
                    ContractAmendment(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        contract_id=con1.id,
                        amendment_number=1,
                        amendment_type="VALUE_CHANGE",
                        changes_summary="Added 10x supplementary workstation units to allocation ceiling.",
                        change_description="Ceiling increased by 500,000 INR to cover new hires.",
                        field_changes={"total_value": {"old": 5000000.0, "new": 5500000.0}},
                        original_snapshot={"total_value": 5000000.0},
                        amended_by=buyer_user.id,
                        approved_by=approver_user.id,
                        approved_at=now_utc - timedelta(days=20),
                    ),
                ]
            )

        # Contract 2: PENDING_REVIEW (Lights up Approver Inbox /tasks)
        res = await db.execute(
            select(Contract).where(and_(Contract.org_id == DEFAULT_ORG_ID, Contract.contract_number == "CON-2026-000002"))
        )
        con2 = res.scalar_one_or_none()
        if not con2:
            con2 = Contract(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                contract_number="CON-2026-000002",
                title="Master Cloud Services & Storage SLA Agreement",
                vendor_id=gc_vendor.id,
                status=ContractStatusEnum.PENDING_REVIEW,
                contract_type="SERVICES_AGREEMENT",
                currency="INR",
                total_value=Decimal("12000000.00"),
                utilized_value=Decimal("0.00"),
                start_date=today + timedelta(days=1),
                end_date=today + timedelta(days=366),
                payment_term_id=pterm_net30_id,
                business_unit_id=bu.id,
                category_id=categories["CAT-CLOUD"].id,
                renewal_notice_days=60,
                auto_renew=True,
                created_by=buyer_user.id,
                updated_by=buyer_user.id,
            )
            db.add(con2)
            await db.flush()

            db.add(
                ContractLine(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    contract_id=con2.id,
                    line_number=1,
                    item_description="Multi-Region Managed Cloud S3 Storage & High-Speed Egress",
                    uom_id=uom_ea_id,
                    contracted_quantity=Decimal("1.0000"),
                    unit_rate=Decimal("12000000.0000"),
                    utilized_quantity=Decimal("0.0000"),
                )
            )

        # Contract 3: DRAFT
        res = await db.execute(
            select(Contract).where(and_(Contract.org_id == DEFAULT_ORG_ID, Contract.contract_number == "CON-2026-000003"))
        )
        con3 = res.scalar_one_or_none()
        if not con3:
            con3 = Contract(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                contract_number="CON-2026-000003",
                title="Facilities Annual Maintenance & Office Furniture Warranty",
                vendor_id=acme_vendor.id,
                status=ContractStatusEnum.DRAFT,
                contract_type="AMC",
                currency="INR",
                total_value=Decimal("450000.00"),
                utilized_value=Decimal("0.00"),
                start_date=today + timedelta(days=15),
                end_date=today + timedelta(days=380),
                payment_term_id=pterm_net30_id,
                business_unit_id=bu.id,
                category_id=categories["CAT-FURN"].id,
                renewal_notice_days=30,
                created_by=buyer_user.id,
                updated_by=buyer_user.id,
            )
            db.add(con3)

        # 19. Workflow Instances & Approver Tasks
        res_wt_pr = await db.execute(
            select(WorkflowTemplate).where(
                and_(WorkflowTemplate.org_id == DEFAULT_ORG_ID, WorkflowTemplate.code == "PR_APPROVAL")
            )
        )
        pr_wf_template = res_wt_pr.scalar_one_or_none()

        res_wt_po = await db.execute(
            select(WorkflowTemplate).where(
                and_(WorkflowTemplate.org_id == DEFAULT_ORG_ID, WorkflowTemplate.code == "PO_APPROVAL")
            )
        )
        po_wf_template = res_wt_po.scalar_one_or_none()

        res_wt_con = await db.execute(
            select(WorkflowTemplate).where(
                and_(WorkflowTemplate.org_id == DEFAULT_ORG_ID, WorkflowTemplate.code == "CONTRACT_APPROVAL")
            )
        )
        con_wf_template = res_wt_con.scalar_one_or_none()

        # Task 1: PR-2 Pending Approver
        pr2 = pr_map["PR-IT-2026-000002"]
        if pr_wf_template and pr2:
            res_wi = await db.execute(
                select(WorkflowInstance).where(
                    and_(WorkflowInstance.org_id == DEFAULT_ORG_ID, WorkflowInstance.entity_id == pr2.id)
                )
            )
            if not res_wi.scalar_one_or_none():
                inst_pr2 = WorkflowInstance(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    template_id=pr_wf_template.id,
                    entity_type="REQUISITION",
                    entity_id=pr2.id,
                    status=WorkflowInstanceStatusEnum.ACTIVE,
                    current_step_number=1,
                    entity_context={
                        "pr_number": pr2.pr_number,
                        "title": pr2.title,
                        "estimated_value": float(pr2.estimated_value),
                        "requestor_name": f"{buyer_user.first_name} {buyer_user.last_name}",
                    },
                    started_at=now_utc - timedelta(hours=3),
                )
                db.add(inst_pr2)
                await db.flush()

                db.add(
                    WorkflowTask(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        workflow_instance_id=inst_pr2.id,
                        step_number=1,
                        assigned_to=approver_user.id,
                        assigned_role="APPROVER",
                        status=ApprovalTaskStatusEnum.PENDING,
                        sla_deadline=now_utc + timedelta(days=2),
                        sla_status="WITHIN_SLA",
                    )
                )

        # Task 2: PO-6 Pending Approver
        if po_wf_template and po6:
            res_wi_po6 = await db.execute(
                select(WorkflowInstance).where(
                    and_(WorkflowInstance.org_id == DEFAULT_ORG_ID, WorkflowInstance.entity_id == po6.id)
                )
            )
            if not res_wi_po6.scalar_one_or_none():
                inst_po6 = WorkflowInstance(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    template_id=po_wf_template.id,
                    entity_type="PURCHASE_ORDER",
                    entity_id=po6.id,
                    status=WorkflowInstanceStatusEnum.ACTIVE,
                    current_step_number=1,
                    entity_context={
                        "po_number": po6.po_number,
                        "title": po6.title,
                        "total_value": float(po6.total_value),
                        "vendor_name": gc_vendor.company_name,
                    },
                    started_at=now_utc - timedelta(hours=5),
                )
                db.add(inst_po6)
                await db.flush()

                db.add(
                    WorkflowTask(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        workflow_instance_id=inst_po6.id,
                        step_number=1,
                        assigned_to=approver_user.id,
                        assigned_role="APPROVER",
                        status=ApprovalTaskStatusEnum.PENDING,
                        sla_deadline=now_utc + timedelta(days=3),
                        sla_status="WITHIN_SLA",
                    )
                )

        # Task 3: CON-2 Pending Approver
        if con_wf_template and con2:
            res_wi_con2 = await db.execute(
                select(WorkflowInstance).where(
                    and_(WorkflowInstance.org_id == DEFAULT_ORG_ID, WorkflowInstance.entity_id == con2.id)
                )
            )
            if not res_wi_con2.scalar_one_or_none():
                inst_con2 = WorkflowInstance(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    template_id=con_wf_template.id,
                    entity_type="CONTRACT",
                    entity_id=con2.id,
                    status=WorkflowInstanceStatusEnum.ACTIVE,
                    current_step_number=1,
                    entity_context={
                        "contract_number": con2.contract_number,
                        "title": con2.title,
                        "total_value": float(con2.total_value),
                        "vendor_name": gc_vendor.company_name,
                    },
                    started_at=now_utc - timedelta(hours=8),
                )
                db.add(inst_con2)
                await db.flush()

                db.add(
                    WorkflowTask(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        workflow_instance_id=inst_con2.id,
                        step_number=1,
                        assigned_to=approver_user.id,
                        assigned_role="APPROVER",
                        status=ApprovalTaskStatusEnum.PENDING,
                        sla_deadline=now_utc + timedelta(days=4),
                        sla_status="WITHIN_SLA",
                    )
                )

        # Completed tasks history: PR-1
        pr1 = pr_map["PR-IT-2026-000001"]
        if pr_wf_template and pr1:
            res_wi1 = await db.execute(
                select(WorkflowInstance).where(
                    and_(WorkflowInstance.org_id == DEFAULT_ORG_ID, WorkflowInstance.entity_id == pr1.id)
                )
            )
            if not res_wi1.scalar_one_or_none():
                inst_pr1 = WorkflowInstance(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    template_id=pr_wf_template.id,
                    entity_type="REQUISITION",
                    entity_id=pr1.id,
                    status=WorkflowInstanceStatusEnum.COMPLETED,
                    current_step_number=1,
                    entity_context={
                        "pr_number": pr1.pr_number,
                        "title": pr1.title,
                        "estimated_value": float(pr1.estimated_value),
                    },
                    started_at=now_utc - timedelta(days=7),
                    completed_at=now_utc - timedelta(days=6),
                )
                db.add(inst_pr1)
                await db.flush()

                db.add(
                    WorkflowTask(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        workflow_instance_id=inst_pr1.id,
                        step_number=1,
                        assigned_to=approver_user.id,
                        assigned_role="APPROVER",
                        status=ApprovalTaskStatusEnum.APPROVED,
                        action=TaskActionEnum.APPROVE,
                        comment="Approved for platform engineering refresh.",
                        acted_at=now_utc - timedelta(days=6),
                        sla_status="WITHIN_SLA",
                    )
                )

        # Completed tasks history: PR-5 (Rejected)
        pr5 = pr_map.get("PR-IT-2026-000005")
        if pr_wf_template and pr5:
            res_wi5 = await db.execute(
                select(WorkflowInstance).where(
                    and_(WorkflowInstance.org_id == DEFAULT_ORG_ID, WorkflowInstance.entity_id == pr5.id)
                )
            )
            if not res_wi5.scalar_one_or_none():
                inst_pr5 = WorkflowInstance(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    template_id=pr_wf_template.id,
                    entity_type="REQUISITION",
                    entity_id=pr5.id,
                    status=WorkflowInstanceStatusEnum.COMPLETED,
                    current_step_number=1,
                    entity_context={
                        "pr_number": pr5.pr_number,
                        "title": pr5.title,
                        "estimated_value": float(pr5.estimated_value),
                    },
                    started_at=now_utc - timedelta(days=3),
                    completed_at=now_utc - timedelta(days=2),
                )
                db.add(inst_pr5)
                await db.flush()

                db.add(
                    WorkflowTask(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        workflow_instance_id=inst_pr5.id,
                        step_number=1,
                        assigned_to=approver_user.id,
                        assigned_role="APPROVER",
                        status=ApprovalTaskStatusEnum.REJECTED,
                        action=TaskActionEnum.REJECT,
                        comment="OLED gaming monitors are not approved for corporate engineering standardization. Use certified 4K IPS monitors.",
                        acted_at=now_utc - timedelta(days=2),
                        sla_status="WITHIN_SLA",
                    )
                )

        # Completed tasks history: PO-1
        if po_wf_template and po1:
            res_wi_po1 = await db.execute(
                select(WorkflowInstance).where(
                    and_(WorkflowInstance.org_id == DEFAULT_ORG_ID, WorkflowInstance.entity_id == po1.id)
                )
            )
            if not res_wi_po1.scalar_one_or_none():
                inst_po1 = WorkflowInstance(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    template_id=po_wf_template.id,
                    entity_type="PURCHASE_ORDER",
                    entity_id=po1.id,
                    status=WorkflowInstanceStatusEnum.COMPLETED,
                    current_step_number=1,
                    entity_context={
                        "po_number": po1.po_number,
                        "title": po1.title,
                        "total_value": float(po1.total_value),
                    },
                    started_at=now_utc - timedelta(days=6),
                    completed_at=now_utc - timedelta(days=5),
                )
                db.add(inst_po1)
                await db.flush()

                db.add(
                    WorkflowTask(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        workflow_instance_id=inst_po1.id,
                        step_number=1,
                        assigned_to=approver_user.id,
                        assigned_role="APPROVER",
                        status=ApprovalTaskStatusEnum.APPROVED,
                        action=TaskActionEnum.APPROVE,
                        comment="PO approved as per approved PR-1 allocation.",
                        acted_at=now_utc - timedelta(days=5),
                        sla_status="WITHIN_SLA",
                    )
                )

        # Completed tasks history: CON-1
        if con_wf_template and con1:
            res_wi_con1 = await db.execute(
                select(WorkflowInstance).where(
                    and_(WorkflowInstance.org_id == DEFAULT_ORG_ID, WorkflowInstance.entity_id == con1.id)
                )
            )
            if not res_wi_con1.scalar_one_or_none():
                inst_con1 = WorkflowInstance(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    template_id=con_wf_template.id,
                    entity_type="CONTRACT",
                    entity_id=con1.id,
                    status=WorkflowInstanceStatusEnum.COMPLETED,
                    current_step_number=1,
                    entity_context={
                        "contract_number": con1.contract_number,
                        "title": con1.title,
                        "total_value": float(con1.total_value),
                    },
                    started_at=now_utc - timedelta(days=62),
                    completed_at=now_utc - timedelta(days=60),
                )
                db.add(inst_con1)
                await db.flush()

                db.add(
                    WorkflowTask(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        workflow_instance_id=inst_con1.id,
                        step_number=1,
                        assigned_to=approver_user.id,
                        assigned_role="APPROVER",
                        status=ApprovalTaskStatusEnum.APPROVED,
                        action=TaskActionEnum.APPROVE,
                        comment="Master rate contract approved for FY26 hardware procurement.",
                        acted_at=now_utc - timedelta(days=60),
                        sla_status="WITHIN_SLA",
                    )
                )

        # 20. ERP Integrations & Cron Telemetry
        res_int = await db.execute(select(IntegrationJob).where(IntegrationJob.org_id == DEFAULT_ORG_ID))
        existing_jobs = res_int.scalars().all()
        existing_job_keys = {(j.job_type, j.adapter_type) for j in existing_jobs}

        if ("PUSH_VENDOR", "SAP") not in existing_job_keys:
            db.add(
                IntegrationJob(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    job_type="PUSH_VENDOR",
                    entity_type="VENDOR",
                    entity_id=acme_vendor.id,
                    direction="OUTBOUND",
                    adapter_type="SAP",
                    status=IntegrationJobStatusEnum.COMPLETED,
                    request_payload={
                        "vendor_code": acme_vendor.vendor_code,
                        "company_name": acme_vendor.company_name,
                        "pan": acme_vendor.pan,
                        "gstin": acme_vendor.gstin,
                    },
                    response_payload={"erp_vendor_code": "SAP-V-10001", "bapi_status": "SUCCESS"},
                    retry_count=0,
                    max_retries=7,
                    completed_at=now_utc - timedelta(days=6),
                )
            )

        if ("PUSH_PURCHASE_ORDER", "SAP") not in existing_job_keys and po1:
            db.add(
                IntegrationJob(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    job_type="PUSH_PURCHASE_ORDER",
                    entity_type="PURCHASE_ORDER",
                    entity_id=po1.id,
                    direction="OUTBOUND",
                    adapter_type="SAP",
                    status=IntegrationJobStatusEnum.COMPLETED,
                    request_payload={"po_number": po1.po_number, "total_value": str(po1.total_value)},
                    response_payload={"sap_document_number": "4500019283", "document_type": "NB", "status": "RELEASED"},
                    retry_count=0,
                    max_retries=7,
                    completed_at=now_utc - timedelta(days=4),
                )
            )

        if ("PUSH_INVOICE", "NETSUITE") not in existing_job_keys:
            db.add(
                IntegrationJob(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    job_type="PUSH_INVOICE",
                    entity_type="INVOICE",
                    entity_id=uuid4(),
                    direction="OUTBOUND",
                    adapter_type="NETSUITE",
                    status=IntegrationJobStatusEnum.COMPLETED,
                    request_payload={"invoice_number": "INV-2026-000001", "amount": "2159400.00"},
                    response_payload={"internal_id": "NS-INV-89102", "status": "PARKED_FOR_PAYMENT"},
                    retry_count=0,
                    max_retries=7,
                    completed_at=now_utc - timedelta(days=1),
                )
            )

        if ("SYNC_GL_POSTING", "TALLY") not in existing_job_keys:
            db.add(
                IntegrationJob(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    job_type="SYNC_GL_POSTING",
                    entity_type="PAYMENT",
                    entity_id=uuid4(),
                    direction="OUTBOUND",
                    adapter_type="TALLY",
                    status=IntegrationJobStatusEnum.RETRY_SCHEDULED,
                    request_payload={"voucher_type": "Payment", "amount": "2122800.00"},
                    error_message="TallyPrime XML Gateway timeout: host 192.168.1.105:9000 uncontactable during ledger sync",
                    retry_count=1,
                    max_retries=7,
                    next_retry_at=now_utc + timedelta(minutes=15),
                )
            )

        # Cron telemetry
        res_runs = await db.execute(select(ScheduledJobRun).where(ScheduledJobRun.org_id == DEFAULT_ORG_ID))
        if not res_runs.scalars().first():
            db.add_all(
                [
                    ScheduledJobRun(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        job_name="sap_vendor_master_nightly_sync",
                        started_at=now_utc - timedelta(hours=8, minutes=12),
                        completed_at=now_utc - timedelta(hours=8, minutes=8),
                        status="COMPLETED",
                        records_processed=48,
                    ),
                    ScheduledJobRun(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        job_name="netsuite_gl_reconciliation",
                        started_at=now_utc - timedelta(hours=14, minutes=30),
                        completed_at=now_utc - timedelta(hours=14, minutes=22),
                        status="COMPLETED",
                        records_processed=124,
                    ),
                    ScheduledJobRun(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        job_name="bank_penny_test_batch",
                        started_at=now_utc - timedelta(hours=3, minutes=10),
                        completed_at=now_utc - timedelta(hours=3, minutes=8),
                        status="COMPLETED",
                        records_processed=6,
                    ),
                ]
            )

        # 21. Audit Logs (50+ Rich Audit Records across partitions 2026_07, 2026_08, 2026_09)
        audit_records = [
            (AuditEntityTypeEnum.ORGANIZATION, DEFAULT_ORG_ID, "UPDATE_SETTINGS", admin_user.id, admin_user.email, "127.0.0.1", {"cost_of_capital_rate": {"old": 0.10, "new": 0.12}}, now_utc - timedelta(days=65)),
            (AuditEntityTypeEnum.USER, buyer_user.id, "ASSIGN_ROLE", admin_user.id, admin_user.email, "127.0.0.1", {"roles": ["BUYER", "PROCUREMENT_OFFICER"]}, now_utc - timedelta(days=65)),
            (AuditEntityTypeEnum.USER, approver_user.id, "ASSIGN_ROLE", admin_user.id, admin_user.email, "127.0.0.1", {"roles": ["APPROVER", "PROCUREMENT_HEAD"]}, now_utc - timedelta(days=65)),

            (AuditEntityTypeEnum.VENDOR, acme_vendor.id, "ONBOARD_INVITED", buyer_user.id, buyer_user.email, "127.0.0.1", {"status": "INVITED"}, now_utc - timedelta(days=68)),
            (AuditEntityTypeEnum.VENDOR, acme_vendor.id, "SUBMIT_APPLICATION", None, acme_vendor.primary_email, "127.0.0.1", {"onboarding_step": 3}, now_utc - timedelta(days=66)),
            (AuditEntityTypeEnum.VENDOR, acme_vendor.id, "PENNY_TEST_VALIDATED", admin_user.id, admin_user.email, "127.0.0.1", {"penny_status": "SUCCESS"}, now_utc - timedelta(days=63)),
            (AuditEntityTypeEnum.VENDOR, acme_vendor.id, "ACTIVATE_VENDOR", admin_user.id, admin_user.email, "127.0.0.1", {"status": "ACTIVE"}, now_utc - timedelta(days=62)),
            (AuditEntityTypeEnum.VENDOR, gc_vendor.id, "ACTIVATE_VENDOR", admin_user.id, admin_user.email, "127.0.0.1", {"status": "ACTIVE"}, now_utc - timedelta(days=60)),
            (AuditEntityTypeEnum.VENDOR, vendors_map["V-10003"].id, "QUALIFY_VENDOR", admin_user.id, admin_user.email, "127.0.0.1", {"status": "QUALIFIED"}, now_utc - timedelta(days=3)),

            (AuditEntityTypeEnum.REQUISITION, pr_map["PR-IT-2026-000001"].id, "CREATE_PR", buyer_user.id, buyer_user.email, "127.0.0.1", {"pr_number": "PR-IT-2026-000001"}, now_utc - timedelta(days=7)),
            (AuditEntityTypeEnum.REQUISITION, pr_map["PR-IT-2026-000001"].id, "BUDGET_CHECK_PASSED", buyer_user.id, buyer_user.email, "127.0.0.1", {"budget_status": "PASSED"}, now_utc - timedelta(days=7)),
            (AuditEntityTypeEnum.REQUISITION, pr_map["PR-IT-2026-000001"].id, "SUBMIT_FOR_APPROVAL", buyer_user.id, buyer_user.email, "127.0.0.1", {"status": "SUBMITTED"}, now_utc - timedelta(days=7)),
            (AuditEntityTypeEnum.REQUISITION, pr_map["PR-IT-2026-000001"].id, "APPROVE_PR", approver_user.id, approver_user.email, "127.0.0.1", {"status": "APPROVED"}, now_utc - timedelta(days=6)),
            (AuditEntityTypeEnum.REQUISITION, pr_map["PR-IT-2026-000002"].id, "CREATE_PR", buyer_user.id, buyer_user.email, "127.0.0.1", {"pr_number": "PR-IT-2026-000002"}, now_utc - timedelta(hours=4)),
            (AuditEntityTypeEnum.REQUISITION, pr_map["PR-IT-2026-000002"].id, "SUBMIT_FOR_APPROVAL", buyer_user.id, buyer_user.email, "127.0.0.1", {"status": "SUBMITTED"}, now_utc - timedelta(hours=3)),
            (AuditEntityTypeEnum.REQUISITION, pr_map["PR-IT-2026-000004"].id, "CREATE_PR", buyer_user.id, buyer_user.email, "127.0.0.1", {"pr_number": "PR-IT-2026-000004"}, now_utc - timedelta(days=5)),
            (AuditEntityTypeEnum.REQUISITION, pr_map["PR-IT-2026-000004"].id, "APPROVE_PR", approver_user.id, approver_user.email, "127.0.0.1", {"status": "APPROVED"}, now_utc - timedelta(days=4)),
            (AuditEntityTypeEnum.REQUISITION, pr_map["PR-IT-2026-000005"].id, "REJECT_PR", approver_user.id, approver_user.email, "127.0.0.1", {"status": "REJECTED"}, now_utc - timedelta(days=2)),

            (AuditEntityTypeEnum.RFQ, rfq1.id, "PUBLISH_RFQ", buyer_user.id, buyer_user.email, "127.0.0.1", {"status": "PUBLISHED"}, now_utc - timedelta(days=1)),
            (AuditEntityTypeEnum.RFQ, rfq1.id, "INVITE_VENDORS", buyer_user.id, buyer_user.email, "127.0.0.1", {"invited_count": 3}, now_utc - timedelta(days=1)),
            (AuditEntityTypeEnum.RFQ, rfq1.id, "POST_CLARIFICATION", buyer_user.id, buyer_user.email, "127.0.0.1", {"clarification_id": "CLAR-01"}, now_utc - timedelta(hours=12)),
            (AuditEntityTypeEnum.RFQ, rfq2.id, "PUBLISH_RFQ", buyer_user.id, buyer_user.email, "127.0.0.1", {"status": "PUBLISHED"}, now_utc - timedelta(days=3)),
            (AuditEntityTypeEnum.BID, bid_acme.id, "SUBMIT_SEALED_BID", None, "supplier@acme.com", "127.0.0.1", {"status": "SUBMITTED"}, now_utc - timedelta(hours=3)),
            (AuditEntityTypeEnum.BID, bid_gc.id, "SUBMIT_SEALED_BID", None, "supplier@globalcloud.com", "127.0.0.1", {"status": "SUBMITTED"}, now_utc - timedelta(hours=2)),
            (AuditEntityTypeEnum.RFQ, rfq3.id, "DUAL_KEY_BID_OPENING", buyer_user.id, buyer_user.email, "127.0.0.1", {"co_authorizer": admin_user.email}, now_utc - timedelta(days=1)),
            (AuditEntityTypeEnum.COMPARATIVE_STATEMENT, cs3.id, "GENERATE_CS", buyer_user.id, buyer_user.email, "127.0.0.1", {"cs_number": "CS-2026-000001"}, now_utc - timedelta(days=1)),
            (AuditEntityTypeEnum.RFQ, rfq3.id, "START_NEGOTIATION", buyer_user.id, buyer_user.email, "127.0.0.1", {"round": 1}, now_utc - timedelta(hours=20)),
            (AuditEntityTypeEnum.AWARD, arn4.id, "RECOMMEND_AWARD", buyer_user.id, buyer_user.email, "127.0.0.1", {"vendor": acme_vendor.company_name}, now_utc - timedelta(days=4)),
            (AuditEntityTypeEnum.AWARD, arn4.id, "APPROVE_ARN", approver_user.id, approver_user.email, "127.0.0.1", {"status": "APPROVED"}, now_utc - timedelta(days=4)),

            (AuditEntityTypeEnum.RFQ, rfq6.id, "START_LIVE_AUCTION", buyer_user.id, buyer_user.email, "127.0.0.1", {"status": "OPEN"}, now_utc - timedelta(minutes=25)),
            (AuditEntityTypeEnum.BID, rfq6.id, "SUBMIT_LIVE_BID", None, "supplier@acme.com", "127.0.0.1", {"amount": 1780000.0, "seq": 1}, now_utc - timedelta(minutes=22)),
            (AuditEntityTypeEnum.BID, rfq6.id, "SUBMIT_LIVE_BID", None, "supplier@globalcloud.com", "127.0.0.1", {"amount": 1750000.0, "seq": 2}, now_utc - timedelta(minutes=18)),
            (AuditEntityTypeEnum.BID, rfq6.id, "SUBMIT_LIVE_BID", None, "supplier@acme.com", "127.0.0.1", {"amount": 1720000.0, "seq": 3}, now_utc - timedelta(minutes=14)),
            (AuditEntityTypeEnum.BID, rfq6.id, "SUBMIT_LIVE_BID", None, "supplier@globalcloud.com", "127.0.0.1", {"amount": 1690000.0, "seq": 4}, now_utc - timedelta(minutes=10)),
            (AuditEntityTypeEnum.BID, rfq6.id, "SUBMIT_LIVE_BID", None, "supplier@acme.com", "127.0.0.1", {"amount": 1660000.0, "seq": 5}, now_utc - timedelta(minutes=6)),
            (AuditEntityTypeEnum.BID, rfq6.id, "SUBMIT_LIVE_BID", None, "supplier@globalcloud.com", "127.0.0.1", {"amount": 1630000.0, "seq": 6}, now_utc - timedelta(minutes=2)),

            (AuditEntityTypeEnum.PURCHASE_ORDER, po1.id, "CREATE_PO", buyer_user.id, buyer_user.email, "127.0.0.1", {"po_number": "PO-2026-000001"}, now_utc - timedelta(days=6)),
            (AuditEntityTypeEnum.PURCHASE_ORDER, po1.id, "APPROVE_PO", approver_user.id, approver_user.email, "127.0.0.1", {"status": "APPROVED"}, now_utc - timedelta(days=5)),
            (AuditEntityTypeEnum.PURCHASE_ORDER, po1.id, "DISPATCH_PO_TO_VENDOR", buyer_user.id, buyer_user.email, "127.0.0.1", {"status": "SENT_TO_VENDOR"}, now_utc - timedelta(days=5)),
            (AuditEntityTypeEnum.PURCHASE_ORDER, po1.id, "VENDOR_ACKNOWLEDGE_PO", None, "supplier@acme.com", "127.0.0.1", {"status": "ACKNOWLEDGED"}, now_utc - timedelta(days=4)),
            (AuditEntityTypeEnum.PURCHASE_ORDER, po1.id, "AMEND_PO", buyer_user.id, buyer_user.email, "127.0.0.1", {"amendment_number": 1}, now_utc - timedelta(days=3)),
            (AuditEntityTypeEnum.PURCHASE_ORDER, po2.id, "DISPATCH_PO_TO_VENDOR", buyer_user.id, buyer_user.email, "127.0.0.1", {"status": "SENT_TO_VENDOR"}, now_utc - timedelta(hours=6)),
            (AuditEntityTypeEnum.PURCHASE_ORDER, po3.id, "PARTIALLY_RECEIVED_PO", buyer_user.id, buyer_user.email, "127.0.0.1", {"received_quantity": 12.0}, now_utc - timedelta(hours=1)),

            (AuditEntityTypeEnum.GRN, grn1.id, "CREATE_GRN", buyer_user.id, buyer_user.email, "127.0.0.1", {"grn_number": "GRN-2026-000001"}, now_utc - timedelta(days=2)),
            (AuditEntityTypeEnum.GRN, grn1.id, "CONFIRM_GRN", buyer_user.id, buyer_user.email, "127.0.0.1", {"status": "APPROVED"}, now_utc - timedelta(days=2)),
            (AuditEntityTypeEnum.GRN, grn2.id, "CREATE_GRN_INSPECTION_PENDING", buyer_user.id, buyer_user.email, "127.0.0.1", {"rejected": 2.0}, now_utc - timedelta(hours=1)),

            (AuditEntityTypeEnum.INVOICE, inv1.id, "SUBMIT_INVOICE", None, "supplier@acme.com", "127.0.0.1", {"total_amount": 2159400.0}, now_utc - timedelta(days=1)),
            (AuditEntityTypeEnum.INVOICE, inv1.id, "THREE_WAY_MATCH_PASSED", None, "system@procurement.com", "127.0.0.1", {"deviation": 0.0}, now_utc - timedelta(days=1)),
            (AuditEntityTypeEnum.INVOICE, inv2.id, "THREE_WAY_MATCH_FAILED", None, "system@procurement.com", "127.0.0.1", {"deviation": 4.0}, now_utc - timedelta(days=1)),
            (AuditEntityTypeEnum.INVOICE, inv2.id, "RAISE_DISPUTE", buyer_user.id, buyer_user.email, "127.0.0.1", {"reason": "PRICE_MISMATCH"}, now_utc - timedelta(hours=5)),
            (AuditEntityTypeEnum.INVOICE, inv3.id, "SETTLE_PAYMENT", None, "finance@procurement.com", "127.0.0.1", {"utr": "UTR-HDFC-2026-889104"}, now_utc - timedelta(days=5)),

            (AuditEntityTypeEnum.CONTRACT, con1.id, "EXECUTE_CONTRACT", buyer_user.id, buyer_user.email, "127.0.0.1", {"esign_provider": "AADHAAR_ESIGN"}, now_utc - timedelta(days=60)),
            (AuditEntityTypeEnum.CONTRACT, con1.id, "AMEND_CONTRACT", buyer_user.id, buyer_user.email, "127.0.0.1", {"amendment_number": 1}, now_utc - timedelta(days=20)),
            (AuditEntityTypeEnum.CONTRACT, con1.id, "COMPLETE_MILESTONE", buyer_user.id, buyer_user.email, "127.0.0.1", {"milestone_index": 1}, now_utc - timedelta(days=28)),
            (AuditEntityTypeEnum.CONTRACT, con2.id, "SUBMIT_FOR_REVIEW", buyer_user.id, buyer_user.email, "127.0.0.1", {"status": "PENDING_REVIEW"}, now_utc - timedelta(hours=8)),
        ]
        for a_type, a_id, act, act_id, act_email, a_ip, changes, a_time in audit_records:
            db.add(
                AuditLog(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    entity_type=a_type,
                    entity_id=a_id,
                    action=act,
                    actor_id=act_id,
                    actor_email=act_email,
                    actor_ip=a_ip,
                    field_changes=changes,
                    metadata_={"module": str(a_type.value), "source": "PLATFORM_DEMO_SEED"},
                    trace_id=f"trace-{uuid4().hex[:16]}",
                    created_at=a_time,
                )
            )

        await db.commit()
        logger.info("Demo transactional entities seeded successfully!")

    # 22. Seed Relational Tickets (with SLA Configs, Custom Fields, Bidirectional Links, and Automation Rules)
    try:
        from scripts.seed_tickets import seed_tickets

        await seed_tickets()
        logger.info("Demo tickets and Jira automation seeded successfully!")
    except Exception as e:
        logger.warning("Demo tickets seeding skipped or failed: %s", e)

    # 23. Seed Demo In-App Notifications for all roles
    try:
        from scripts.seed_demo_notifications import seed_demo_notifications

        await seed_demo_notifications()
        logger.info("Demo in-app notifications seeded successfully!")
    except Exception as e:
        logger.warning("Demo notifications seeding skipped or failed: %s", e)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_demo())
