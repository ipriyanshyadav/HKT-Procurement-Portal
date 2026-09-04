"""
Demo user and sample data seed script for the default organization.
Seeds:
- Organization master data: LegalEntity, BusinessUnit, Plant, Department, CostCenter, DeliveryLocation
- Categories (IT Hardware, Software, Cloud)
- Demo users:
    * admin@procurement.com / Admin123456!@# (Roles: SUPERADMIN, ORG_ADMIN)
    * buyer@procurement.com / Buyer123456!@# (Roles: REQUESTOR, BUYER, PROCUREMENT_MANAGER)
    * approver@procurement.com / Approver123!@# (Roles: APPROVER, PROCUREMENT_HEAD)
- Sample Vendors (Acme Tech Solutions, Global Cloud Systems)
- Sample Purchase Requisitions (Draft, Submitted, Approved)
- Sample Unmapped PR Exception
Safe and idempotent.
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
from decimal import Decimal
from datetime import datetime, date, timezone, timedelta
from uuid import UUID, uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select, and_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session, engine
from app.core.security import hash_password
from app.db.enums import (
    UserStatusEnum, VendorStatusEnum, PrStatusEnum, PrSourceEnum,
    ProcurementTypeEnum, UnmappedPrStatusEnum
)
from app.modules.organization.models import (
    Organization, LegalEntity, BusinessUnit, Plant, Department, CostCenter
)
from app.modules.master_data.models import Category, DeliveryLocation, UomMaster
from app.modules.user.models import User, Role, UserRoleAssignment
from app.modules.vendor.models import Vendor
from app.modules.requisition.models import Requisition, RequisitionLine, UnmappedPrException

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_ORG_ID = UUID("00000000-0000-0000-0000-000000000001")


async def seed_demo():
    async with async_session() as db:
        # 1. Ensure Default Organization exists
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
        else:
            logger.info("Found Default Organization")

        # Ensure UOM exists in default org or system org
        res = await db.execute(text("SELECT id FROM uom_master WHERE code = 'EA' LIMIT 1"))
        uom_row = res.fetchone()
        if uom_row:
            uom_ea_id = uom_row[0]
        else:
            uom_ea_id = uuid4()
            await db.execute(text("""
                INSERT INTO uom_master (id, org_id, code, name, is_active, version)
                VALUES (:id, :org_id, 'EA', 'Each', true, 1)
            """), {"id": uom_ea_id, "org_id": DEFAULT_ORG_ID})

        # 2. Legal Entity
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
            logger.info("Created Legal Entity")

        # 3. Business Unit
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
            logger.info("Created Business Unit: BU-IT")

        # 4. Plant
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
            logger.info("Created Plant: PLANT-HQ")

        # 5. Department
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
            logger.info("Created Department: DEPT-ENG")

        # 6. Cost Center
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
            logger.info("Created Cost Center: CC-IT-001")

        # 7. Delivery Location
        res = await db.execute(select(DeliveryLocation).where(DeliveryLocation.org_id == DEFAULT_ORG_ID))
        loc = res.scalars().first()
        if not loc:
            loc = DeliveryLocation(
                org_id=DEFAULT_ORG_ID,
                code="LOC-HQ-MUM",
                name="HQ Server Room & Offices",
                address="B-Wing, Tech Park, Powai",
                city="Mumbai",
                state="Maharashtra",
                postal_code="400076",
                country_code="IN",
                plant_id=plant.id,
                is_active=True,
            )
            db.add(loc)
            await db.flush()
            logger.info("Created Delivery Location: LOC-HQ-MUM")

        # 8. Categories
        categories = {}
        cat_defs = [
            ("CAT-IT", "Information Technology", None, 1),
            ("CAT-HW", "Hardware & Compute", "CAT-IT", 2),
            ("CAT-SW", "Software & SaaS Licenses", "CAT-IT", 2),
            ("CAT-CLOUD", "Cloud & Network Services", "CAT-IT", 2),
        ]
        for code, name, parent_code, lvl in cat_defs:
            res = await db.execute(select(Category).where(and_(Category.org_id == DEFAULT_ORG_ID, Category.code == code)))
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
                logger.info("Created Category: %s (%s)", code, name)
            categories[code] = cat

        # 9. Demo Users
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
            res = await db.execute(select(User).where(and_(User.org_id == DEFAULT_ORG_ID, User.email == uconf["email"])))
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
                logger.info("Created Demo User: %s", uconf["email"])
            created_users[uconf["email"]] = user

            # Assign roles
            for role_code in uconf["roles"]:
                res = await db.execute(select(Role).where(and_(Role.org_id == DEFAULT_ORG_ID, Role.code == role_code)))
                role = res.scalar_one_or_none()
                if role:
                    # check assignment
                    res = await db.execute(
                        select(UserRoleAssignment).where(
                            and_(
                                UserRoleAssignment.user_id == user.id,
                                UserRoleAssignment.role_id == role.id,
                            )
                        )
                    )
                    assignment = res.scalar_one_or_none()
                    if not assignment:
                        assignment = UserRoleAssignment(
                            org_id=DEFAULT_ORG_ID,
                            user_id=user.id,
                            role_id=role.id,
                            is_active=True,
                        )
                        db.add(assignment)
                        logger.info("Assigned role %s to %s", role_code, uconf["email"])

        # 10. Sample Vendors
        vendors_data = [
            {
                "vendor_code": "V-10001",
                "company_name": "Acme Tech Solutions Private Limited",
                "legal_name": "Acme Tech Solutions Pvt Ltd",
                "primary_email": "sales@acmetech.example.com",
                "status": VendorStatusEnum.ACTIVE,
                "compliance_score": Decimal("92.50"),
                "performance_score": Decimal("88.00"),
                "city": "Bengaluru",
                "state": "Karnataka",
            },
            {
                "vendor_code": "V-10002",
                "company_name": "Global Cloud & Systems Corp",
                "legal_name": "Global Cloud India Private Limited",
                "primary_email": "contact@globalcloud.example.com",
                "status": VendorStatusEnum.ACTIVE,
                "compliance_score": Decimal("96.00"),
                "performance_score": Decimal("94.50"),
                "city": "Hyderabad",
                "state": "Telangana",
            },
        ]
        for vdata in vendors_data:
            res = await db.execute(select(Vendor).where(and_(Vendor.org_id == DEFAULT_ORG_ID, Vendor.vendor_code == vdata["vendor_code"])))
            vendor = res.scalar_one_or_none()
            if not vendor:
                vendor = Vendor(
                    org_id=DEFAULT_ORG_ID,
                    **vdata
                )
                db.add(vendor)
                logger.info("Created Vendor: %s", vdata["company_name"])

        # 10.1 Supplier Demo User & Role Permissions
        res = await db.execute(select(Vendor).where(and_(Vendor.org_id == DEFAULT_ORG_ID, Vendor.vendor_code == "V-10001")))
        acme_vendor = res.scalar_one_or_none()
        if acme_vendor:
            supplier_email = "supplier@acme.com"
            res = await db.execute(select(User).where(and_(User.org_id == DEFAULT_ORG_ID, User.email == supplier_email)))
            supplier_user = res.scalar_one_or_none()
            if not supplier_user:
                supplier_user = User(
                    org_id=DEFAULT_ORG_ID,
                    email=supplier_email,
                    password_hash=hash_password("Supplier123456!@#"),
                    first_name="Acme",
                    last_name="Supplier",
                    employee_id="VEND-EMP-001",
                    status=UserStatusEnum.ACTIVE,
                    mfa_enabled=False,
                    is_supplier_user=True,
                    vendor_id=acme_vendor.id,
                )
                db.add(supplier_user)
                await db.flush()
                logger.info("Created Demo Supplier User: %s", supplier_email)

            res = await db.execute(select(Role).where(and_(Role.org_id == DEFAULT_ORG_ID, Role.code == "SUPPLIER")))
            sup_role = res.scalar_one_or_none()
            if sup_role:
                res = await db.execute(
                    select(UserRoleAssignment).where(
                        and_(
                            UserRoleAssignment.user_id == supplier_user.id,
                            UserRoleAssignment.role_id == sup_role.id,
                        )
                    )
                )
                if not res.scalar_one_or_none():
                    assignment = UserRoleAssignment(
                        org_id=DEFAULT_ORG_ID,
                        user_id=supplier_user.id,
                        role_id=sup_role.id,
                        is_active=True,
                    )
                    db.add(assignment)
                    logger.info("Assigned role SUPPLIER to %s", supplier_email)

                # Ensure SUPPLIER role has supplier permissions
                supplier_perms = [
                    "vendor.view_own", "bid.submit", "bid.view_own", "bid.revise",
                    "bid.withdraw", "invoice.submit", "invoice.view_own", "po.acknowledge",
                    "po.view_own", "grn.view_own", "document.upload", "document.view_own",
                    "notification.view_own", "user.view_own", "user.update_own", "contract.view_own"
                ]
                for pcode in supplier_perms:
                    res = await db.execute(text("SELECT id FROM permissions WHERE code = :code"), {"code": pcode})
                    perm_row = res.fetchone()
                    if perm_row:
                        perm_id = perm_row[0]
                        await db.execute(text("""
                            INSERT INTO role_permissions (id, org_id, role_id, permission_id)
                            VALUES (:id, :org_id, :role_id, :permission_id)
                            ON CONFLICT (org_id, role_id, permission_id) DO NOTHING
                        """), {
                            "id": uuid4(),
                            "org_id": DEFAULT_ORG_ID,
                            "role_id": sup_role.id,
                            "permission_id": perm_id,
                        })

        # 11. Sample Requisitions
        buyer_user = created_users["buyer@procurement.com"]
        pr_samples = [
            {
                "pr_number": "PR-IT-2026-000001",
                "title": "Annual Developer Laptops Refresh (MacBook Pro M3)",
                "description": "Procurement of 10x 16-inch M3 Pro developer workstations for the core platform engineering team.",
                "status": PrStatusEnum.APPROVED,
                "estimated_value": Decimal("2400000.00"),
                "budget_check_status": "PASSED",
                "is_capex": True,
                "lines": [
                    {
                        "line_number": 1,
                        "item_description": "Apple MacBook Pro 16-inch M3 Pro / 36GB / 1TB SSD",
                        "quantity": Decimal("10.00"),
                        "estimated_unit_price": Decimal("240000.00"),
                    }
                ]
            },
            {
                "pr_number": "PR-IT-2026-000002",
                "title": "Production Kubernetes Cluster Cloud Infrastructure",
                "description": "Multi-region cloud compute nodes, persistent storage, and NAT gateways for Q3-Q4.",
                "status": PrStatusEnum.SUBMITTED,
                "estimated_value": Decimal("1500000.00"),
                "budget_check_status": "PASSED",
                "is_capex": False,
                "lines": [
                    {
                        "line_number": 1,
                        "item_description": "Managed Kubernetes Worker Node Pool (c6i.4xlarge x 20 nodes)",
                        "quantity": Decimal("6.00"),
                        "estimated_unit_price": Decimal("250000.00"),
                    }
                ]
            },
            {
                "pr_number": "PR-IT-2026-000003",
                "title": "Enterprise IDE & AI Assistant Licenses (Annual)",
                "description": "Team subscription renewal for developer productivity tooling.",
                "status": PrStatusEnum.DRAFT,
                "estimated_value": Decimal("350000.00"),
                "budget_check_status": "NOT_CHECKED",
                "is_capex": False,
                "lines": [
                    {
                        "line_number": 1,
                        "item_description": "AI Coding Assistant Enterprise 100-Seat Pack",
                        "quantity": Decimal("1.00"),
                        "estimated_unit_price": Decimal("350000.00"),
                    }
                ]
            },
        ]

        for pr_data in pr_samples:
            res = await db.execute(select(Requisition).where(and_(Requisition.org_id == DEFAULT_ORG_ID, Requisition.pr_number == pr_data["pr_number"])))
            pr = res.scalar_one_or_none()
            if not pr:
                lines = pr_data.pop("lines")
                pr = Requisition(
                    org_id=DEFAULT_ORG_ID,
                    requestor_id=buyer_user.id,
                    business_unit_id=bu.id,
                    plant_id=plant.id,
                    department_id=dept.id,
                    cost_center_id=cc.id,
                    category_id=categories["CAT-HW"].id,
                    currency="INR",
                    source=PrSourceEnum.MANUAL,
                    procurement_type=ProcurementTypeEnum.CAPEX if pr_data["is_capex"] else ProcurementTypeEnum.OPEX,
                    delivery_location_id=loc.id,
                    required_by_date=date.today() + timedelta(days=30),
                    **pr_data
                )
                db.add(pr)
                await db.flush()

                for line in lines:
                    pr_line = RequisitionLine(
                        org_id=DEFAULT_ORG_ID,
                        requisition_id=pr.id,
                        category_id=categories["CAT-HW"].id,
                        uom_id=uom_ea_id,
                        delivery_location_id=loc.id,
                        required_by_date=date.today() + timedelta(days=30),
                        **line
                    )
                    db.add(pr_line)
                logger.info("Created Requisition: %s (%s)", pr.pr_number, pr.title)

        # 12. Sample Unmapped PR Exception
        res = await db.execute(select(Requisition).where(and_(Requisition.org_id == DEFAULT_ORG_ID, Requisition.pr_number == "PR-ERP-2026-UNMAPPED01")))
        unmapped_req = res.scalar_one_or_none()
        if not unmapped_req:
            unmapped_req = Requisition(
                org_id=DEFAULT_ORG_ID,
                pr_number="PR-ERP-2026-UNMAPPED01",
                title="Legacy ERP Import: High-Speed Optical Transceivers",
                description="Imported from SAP MM with missing standard category and cost center mapping.",
                status=PrStatusEnum.DRAFT,
                estimated_value=Decimal("450000.00"),
                currency="INR",
                source=PrSourceEnum.ERP_API,
                procurement_type=ProcurementTypeEnum.OPEX,
                requestor_id=buyer_user.id,
                business_unit_id=bu.id,
                plant_id=plant.id,
                department_id=dept.id,
                cost_center_id=cc.id,
                category_id=categories["CAT-IT"].id,
                delivery_location_id=loc.id,
            )
            db.add(unmapped_req)
            await db.flush()

            line = RequisitionLine(
                org_id=DEFAULT_ORG_ID,
                requisition_id=unmapped_req.id,
                line_number=1,
                item_description="100G QSFP28 SR4 Optical Transceiver Modules",
                quantity=Decimal("15.00"),
                uom_id=uom_ea_id,
                estimated_unit_price=Decimal("30000.00"),
                category_id=categories["CAT-IT"].id,
                delivery_location_id=loc.id,
            )
            db.add(line)
            await db.flush()

            exc = UnmappedPrException(
                org_id=DEFAULT_ORG_ID,
                requisition_id=unmapped_req.id,
                failed_fields={
                    "category": {"value": "COMM-NET-OPT", "reason": "Category code not found in portal master data"},
                    "cost_center": {"value": "CC-OLD-999", "reason": "Cost center deactivated in FY26"},
                },
                status=UnmappedPrStatusEnum.PENDING,
                sla_deadline=datetime.now(timezone.utc) + timedelta(hours=8),
                sla_breach_level=0,
                proposed_mappings={
                    "suggested_category": "CAT-CLOUD",
                    "confidence": 0.88,
                    "rationale": "High text similarity with Optical Network Equipment",
                },
            )
            db.add(exc)
            logger.info("Created Sample Unmapped PR Exception for %s", unmapped_req.pr_number)

        await db.commit()
        logger.info("Demo data seeding completed successfully!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_demo())
