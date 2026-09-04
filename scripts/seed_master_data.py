"""
Master data seed script.
Seeds ALL permissions (100+), ALL 15 roles (REQUESTOR through SUPPLIER_USER),
Incoterms, UOMs, and role-permission mappings.
Idempotent (ON CONFLICT DO NOTHING). Safe to run at startup.
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings
from app.core.constants import PermissionCode

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ALL 15 roles per SPEC_04 Section 9.2
ROLES = [
    # Internal roles (11)
    {"code": "REQUESTOR", "name": "Requestor", "is_system_role": True, "is_supplier_role": False},
    {"code": "APPROVER", "name": "Approver", "is_system_role": True, "is_supplier_role": False},
    {"code": "PROCUREMENT_OFFICER", "name": "Procurement Officer", "is_system_role": True, "is_supplier_role": False},
    {"code": "PROCUREMENT_MANAGER", "name": "Procurement Manager", "is_system_role": True, "is_supplier_role": False},
    {"code": "PROCUREMENT_HEAD", "name": "Procurement Head", "is_system_role": True, "is_supplier_role": False},
    {"code": "FINANCE_CONTROLLER", "name": "Finance Controller", "is_system_role": True, "is_supplier_role": False},
    {"code": "COMPLIANCE_OFFICER", "name": "Compliance Officer", "is_system_role": True, "is_supplier_role": False},
    {"code": "VENDOR_ADMIN", "name": "Vendor Admin", "is_system_role": True, "is_supplier_role": False},
    {"code": "PROCUREMENT_ADMIN", "name": "Procurement Admin", "is_system_role": True, "is_supplier_role": False},
    {"code": "SOURCING_MANAGER", "name": "Sourcing Manager", "is_system_role": True, "is_supplier_role": False},
    {"code": "CFO", "name": "CFO", "is_system_role": True, "is_supplier_role": False},
    # Supplier roles (4)
    {"code": "SUPPLIER_ADMIN", "name": "Supplier Admin", "is_system_role": True, "is_supplier_role": True},
    {"code": "SUPPLIER_USER", "name": "Supplier User", "is_system_role": True, "is_supplier_role": True},
    {"code": "SUPERADMIN", "name": "Super Admin", "is_system_role": True, "is_supplier_role": False},
    {"code": "ORG_ADMIN", "name": "Organization Admin", "is_system_role": True, "is_supplier_role": False},
]

# All 100+ permissions from PermissionCode
PERMISSIONS = [
    (code_val, name, module)
    for attr in dir(PermissionCode)
    if not attr.startswith("_") and isinstance((code_val := getattr(PermissionCode, attr)), str)
    for name, module in [(
        attr.replace("_", " ").title(),
        code_val.split(".")[0] if "." in code_val else "system"
    )]
]

INCOTERMS = [
    {"code": "EXW", "name": "Ex Works", "edition_year": 2020, "risk_transfer_point": "Seller premises"},
    {"code": "FCA", "name": "Free Carrier", "edition_year": 2020, "risk_transfer_point": "Named carrier"},
    {"code": "CPT", "name": "Carriage Paid To", "edition_year": 2020, "risk_transfer_point": "First carrier"},
    {"code": "CIP", "name": "Carriage and Insurance Paid To", "edition_year": 2020, "risk_transfer_point": "First carrier"},
    {"code": "DAP", "name": "Delivered at Place", "edition_year": 2020, "risk_transfer_point": "Named place"},
    {"code": "DPU", "name": "Delivered at Place Unloaded", "edition_year": 2020, "risk_transfer_point": "Unloaded at destination"},
    {"code": "DDP", "name": "Delivered Duty Paid", "edition_year": 2020, "risk_transfer_point": "Destination cleared for import"},
    {"code": "FAS", "name": "Free Alongside Ship", "edition_year": 2020, "risk_transfer_point": "Alongside ship at port"},
    {"code": "FOB", "name": "Free On Board", "edition_year": 2020, "risk_transfer_point": "On board vessel"},
    {"code": "CFR", "name": "Cost and Freight", "edition_year": 2020, "risk_transfer_point": "On board vessel"},
    {"code": "CIF", "name": "Cost, Insurance and Freight", "edition_year": 2020, "risk_transfer_point": "On board vessel"},
]

DEFAULT_UOMS = [
    {"code": "EA", "name": "Each"},
    {"code": "KG", "name": "Kilogram"},
    {"code": "L", "name": "Liter"},
    {"code": "M", "name": "Meter"},
    {"code": "BOX", "name": "Box"},
    {"code": "SET", "name": "Set"},
    {"code": "TON", "name": "Metric Ton"},
    {"code": "SQM", "name": "Square Meter"},
    {"code": "CUM", "name": "Cubic Meter"},
    {"code": "PKT", "name": "Packet"},
]

# Role-permission mappings: role_code -> list of permission codes granted
ROLE_PERMISSIONS: dict[str, list[str]] = {
    "REQUESTOR": [
        PermissionCode.PR_CREATE, PermissionCode.PR_VIEW_OWN, PermissionCode.PR_SUBMIT,
        PermissionCode.PR_CANCEL, PermissionCode.USER_VIEW_OWN, PermissionCode.USER_UPDATE_OWN,
        PermissionCode.DOCUMENT_UPLOAD, PermissionCode.DOCUMENT_VIEW_OWN,
        PermissionCode.NOTIFICATION_VIEW_OWN, PermissionCode.ANALYTICS_VIEW_DASHBOARD,
        PermissionCode.MASTER_VIEW,
    ],
    "APPROVER": [
        PermissionCode.PR_VIEW_BU, PermissionCode.PR_APPROVE, PermissionCode.PR_REJECT,
        PermissionCode.USER_VIEW_OWN, PermissionCode.USER_UPDATE_OWN,
        PermissionCode.DOCUMENT_VIEW_OWN, PermissionCode.NOTIFICATION_VIEW_OWN,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.WORKFLOW_VIEW,
    ],
    "PROCUREMENT_OFFICER": [
        PermissionCode.PR_VIEW_ALL, PermissionCode.PR_APPROVE, PermissionCode.PR_REJECT,
        PermissionCode.RFQ_CREATE, PermissionCode.RFQ_VIEW_ALL, PermissionCode.RFQ_PUBLISH,
        PermissionCode.BID_VIEW_ALL, PermissionCode.BID_OPEN,
        PermissionCode.VENDOR_VIEW_ALL, PermissionCode.VENDOR_INVITE,
        PermissionCode.DOCUMENT_UPLOAD, PermissionCode.DOCUMENT_VIEW_ALL,
        PermissionCode.NOTIFICATION_VIEW_OWN, PermissionCode.ANALYTICS_VIEW_DASHBOARD,
        PermissionCode.WORKFLOW_VIEW, PermissionCode.USER_VIEW_OWN, PermissionCode.USER_UPDATE_OWN,
        PermissionCode.LIVE_AUCTION_CREATE, PermissionCode.LIVE_AUCTION_CANCEL,
        PermissionCode.LIVE_AUCTION_MONITOR, PermissionCode.LIVE_AUCTION_RELEASE_RESULTS,
    ],
    "PROCUREMENT_MANAGER": [
        PermissionCode.PR_VIEW_ALL, PermissionCode.PR_APPROVE, PermissionCode.PR_REJECT,
        PermissionCode.RFQ_CREATE, PermissionCode.RFQ_VIEW_ALL, PermissionCode.RFQ_PUBLISH,
        PermissionCode.RFQ_AMEND, PermissionCode.RFQ_CANCEL,
        PermissionCode.BID_VIEW_ALL, PermissionCode.BID_OPEN, PermissionCode.BID_EVALUATE,
        PermissionCode.EVAL_VIEW, PermissionCode.EVAL_SCORE, PermissionCode.EVAL_SUBMIT_RECOMMENDATION,
        PermissionCode.AWARD_RECOMMEND, PermissionCode.AWARD_APPROVE,
        PermissionCode.CONTRACT_CREATE, PermissionCode.CONTRACT_VIEW_ALL,
        PermissionCode.PO_CREATE, PermissionCode.PO_VIEW_ALL, PermissionCode.PO_APPROVE,
        PermissionCode.VENDOR_VIEW_ALL, PermissionCode.VENDOR_INVITE, PermissionCode.VENDOR_QUALIFY,
        PermissionCode.DOCUMENT_UPLOAD, PermissionCode.DOCUMENT_VIEW_ALL,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.ANALYTICS_VIEW_REPORTS,
        PermissionCode.WORKFLOW_VIEW, PermissionCode.RULES_VIEW,
        PermissionCode.USER_VIEW_ALL, PermissionCode.USER_UPDATE_OWN,
        PermissionCode.MASTER_VIEW,
        PermissionCode.LIVE_AUCTION_CREATE, PermissionCode.LIVE_AUCTION_CANCEL,
        PermissionCode.LIVE_AUCTION_MONITOR, PermissionCode.LIVE_AUCTION_RELEASE_RESULTS,
    ],
    "PROCUREMENT_HEAD": [
        PermissionCode.PR_VIEW_ALL, PermissionCode.PR_APPROVE, PermissionCode.PR_REJECT,
        PermissionCode.PR_VIEW_BU, PermissionCode.PR_SUBMIT,
        PermissionCode.RFQ_CREATE, PermissionCode.RFQ_VIEW_ALL, PermissionCode.RFQ_PUBLISH,
        PermissionCode.RFQ_AMEND, PermissionCode.RFQ_CANCEL, PermissionCode.RFQ_MANAGE_COMMITTEE,
        PermissionCode.BID_VIEW_ALL, PermissionCode.BID_OPEN, PermissionCode.BID_EVALUATE,
        PermissionCode.EVAL_VIEW, PermissionCode.EVAL_SCORE, PermissionCode.EVAL_OVERRIDE,
        PermissionCode.AWARD_RECOMMEND, PermissionCode.AWARD_APPROVE, PermissionCode.AWARD_SPLIT,
        PermissionCode.CONTRACT_CREATE, PermissionCode.CONTRACT_VIEW_ALL, PermissionCode.CONTRACT_ACTIVATE,
        PermissionCode.PO_CREATE, PermissionCode.PO_VIEW_ALL, PermissionCode.PO_APPROVE,
        PermissionCode.VENDOR_VIEW_ALL, PermissionCode.VENDOR_QUALIFY,
        PermissionCode.VENDOR_BLACKLIST_INITIATE,
        PermissionCode.DOCUMENT_VIEW_ALL, PermissionCode.DOCUMENT_UPLOAD,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.ANALYTICS_VIEW_REPORTS, PermissionCode.ANALYTICS_EXPORT,
        PermissionCode.WORKFLOW_VIEW, PermissionCode.WORKFLOW_CREATE, PermissionCode.WORKFLOW_UPDATE,
        PermissionCode.RULES_VIEW, PermissionCode.RULES_CREATE, PermissionCode.RULES_UPDATE,
        PermissionCode.USER_VIEW_ALL, PermissionCode.USER_CREATE, PermissionCode.USER_ASSIGN_ROLE,
        PermissionCode.MASTER_VIEW, PermissionCode.MASTER_CREATE,
        PermissionCode.ORG_VIEW, PermissionCode.ORG_VIEW_AUDIT,
        PermissionCode.LIVE_AUCTION_CREATE, PermissionCode.LIVE_AUCTION_CANCEL,
        PermissionCode.LIVE_AUCTION_MONITOR, PermissionCode.LIVE_AUCTION_RELEASE_RESULTS,
    ],
    "FINANCE_CONTROLLER": [
        PermissionCode.PR_VIEW_ALL, PermissionCode.PR_APPROVE,
        PermissionCode.PO_VIEW_ALL, PermissionCode.PO_APPROVE,
        PermissionCode.GRN_VIEW_ALL, PermissionCode.GRN_APPROVE,
        PermissionCode.INVOICE_VIEW_ALL, PermissionCode.INVOICE_MATCH, PermissionCode.INVOICE_APPROVE,
        PermissionCode.PAYMENT_VIEW_ALL, PermissionCode.PAYMENT_INITIATE, PermissionCode.PAYMENT_APPROVE,
        PermissionCode.CONTRACT_VIEW_ALL,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.ANALYTICS_VIEW_REPORTS, PermissionCode.ANALYTICS_EXPORT,
        PermissionCode.DOCUMENT_VIEW_ALL, PermissionCode.DOCUMENT_UPLOAD,
        PermissionCode.USER_VIEW_OWN, PermissionCode.USER_UPDATE_OWN,
        PermissionCode.ORG_VIEW, PermissionCode.ORG_VIEW_AUDIT,
    ],
    "COMPLIANCE_OFFICER": [
        PermissionCode.VENDOR_VIEW_ALL, PermissionCode.VENDOR_BLACKLIST_INITIATE, PermissionCode.VENDOR_BLACKLIST_APPROVE,
        PermissionCode.VENDOR_UPDATE_COMPLIANCE,
        PermissionCode.CONTRACT_VIEW_ALL,
        PermissionCode.DOCUMENT_VIEW_ALL,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.ANALYTICS_VIEW_REPORTS,
        PermissionCode.ORG_VIEW, PermissionCode.ORG_VIEW_AUDIT,
        PermissionCode.USER_VIEW_OWN,
    ],
    "VENDOR_ADMIN": [
        PermissionCode.VENDOR_VIEW_ALL, PermissionCode.VENDOR_INVITE, PermissionCode.VENDOR_QUALIFY,
        PermissionCode.VENDOR_REJECT, PermissionCode.VENDOR_ACTIVATE, PermissionCode.VENDOR_SUSPEND,
        PermissionCode.VENDOR_REINSTATE, PermissionCode.VENDOR_MANAGE_CATEGORIES,
        PermissionCode.VENDOR_UPDATE_COMPLIANCE,
        PermissionCode.MASTER_VIEW, PermissionCode.MASTER_CREATE, PermissionCode.MASTER_UPDATE,
        PermissionCode.USER_VIEW_ALL, PermissionCode.USER_CREATE, PermissionCode.USER_ASSIGN_ROLE,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD,
        PermissionCode.ORG_VIEW, PermissionCode.ORG_VIEW_AUDIT,
    ],
    "PROCUREMENT_ADMIN": [
        # Full procurement access
        PermissionCode.PR_CREATE, PermissionCode.PR_VIEW_ALL, PermissionCode.PR_SUBMIT,
        PermissionCode.PR_APPROVE, PermissionCode.PR_REJECT, PermissionCode.PR_CANCEL,
        PermissionCode.RFQ_CREATE, PermissionCode.RFQ_VIEW_ALL, PermissionCode.RFQ_PUBLISH,
        PermissionCode.RFQ_AMEND, PermissionCode.RFQ_CANCEL, PermissionCode.RFQ_MANAGE_COMMITTEE,
        PermissionCode.BID_VIEW_ALL, PermissionCode.BID_OPEN, PermissionCode.BID_EVALUATE,
        PermissionCode.EVAL_VIEW, PermissionCode.EVAL_SCORE, PermissionCode.EVAL_OVERRIDE,
        PermissionCode.EVAL_SUBMIT_RECOMMENDATION, PermissionCode.EVAL_VIEW_COMPARATIVE,
        PermissionCode.AWARD_RECOMMEND, PermissionCode.AWARD_APPROVE, PermissionCode.AWARD_SPLIT,
        PermissionCode.CONTRACT_CREATE, PermissionCode.CONTRACT_VIEW_ALL, PermissionCode.CONTRACT_ACTIVATE,
        PermissionCode.CONTRACT_AMEND, PermissionCode.CONTRACT_RENEW, PermissionCode.CONTRACT_TERMINATE,
        PermissionCode.PO_CREATE, PermissionCode.PO_VIEW_ALL, PermissionCode.PO_APPROVE,
        PermissionCode.PO_AMEND, PermissionCode.PO_CANCEL,
        PermissionCode.VENDOR_VIEW_ALL, PermissionCode.VENDOR_INVITE, PermissionCode.VENDOR_QUALIFY,
        PermissionCode.VENDOR_REJECT, PermissionCode.VENDOR_ACTIVATE, PermissionCode.VENDOR_SUSPEND,
        PermissionCode.VENDOR_BLACKLIST_INITIATE,
        PermissionCode.MASTER_VIEW, PermissionCode.MASTER_CREATE, PermissionCode.MASTER_UPDATE, PermissionCode.MASTER_IMPORT,
        PermissionCode.USER_CREATE, PermissionCode.USER_VIEW_ALL, PermissionCode.USER_UPDATE_ALL,
        PermissionCode.USER_ASSIGN_ROLE,
        PermissionCode.WORKFLOW_VIEW, PermissionCode.WORKFLOW_CREATE, PermissionCode.WORKFLOW_UPDATE,
        PermissionCode.WORKFLOW_ACTIVATE, PermissionCode.WORKFLOW_DEACTIVATE,
        PermissionCode.RULES_VIEW, PermissionCode.RULES_CREATE, PermissionCode.RULES_UPDATE,
        PermissionCode.RULES_DELETE,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.ANALYTICS_VIEW_REPORTS, PermissionCode.ANALYTICS_EXPORT,
        PermissionCode.DOCUMENT_UPLOAD, PermissionCode.DOCUMENT_VIEW_ALL,
        PermissionCode.ORG_VIEW, PermissionCode.ORG_UPDATE, PermissionCode.ORG_MANAGE_SETTINGS, PermissionCode.ORG_VIEW_AUDIT,
        PermissionCode.LIVE_AUCTION_CREATE, PermissionCode.LIVE_AUCTION_CANCEL,
        PermissionCode.LIVE_AUCTION_MONITOR, PermissionCode.LIVE_AUCTION_RELEASE_RESULTS,
    ],
    "SOURCING_MANAGER": [
        PermissionCode.RFQ_CREATE, PermissionCode.RFQ_VIEW_ALL, PermissionCode.RFQ_PUBLISH,
        PermissionCode.RFQ_AMEND, PermissionCode.RFQ_CANCEL, PermissionCode.RFQ_MANAGE_COMMITTEE,
        PermissionCode.BID_VIEW_ALL, PermissionCode.BID_OPEN, PermissionCode.BID_EVALUATE,
        PermissionCode.EVAL_VIEW, PermissionCode.EVAL_SCORE, PermissionCode.EVAL_VIEW_COMPARATIVE,
        PermissionCode.AWARD_RECOMMEND,
        PermissionCode.PR_VIEW_ALL,
        PermissionCode.VENDOR_VIEW_ALL, PermissionCode.VENDOR_INVITE,
        PermissionCode.DOCUMENT_UPLOAD, PermissionCode.DOCUMENT_VIEW_ALL,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.ANALYTICS_VIEW_REPORTS,
        PermissionCode.USER_VIEW_OWN, PermissionCode.USER_UPDATE_OWN,
        PermissionCode.LIVE_AUCTION_CREATE, PermissionCode.LIVE_AUCTION_MONITOR,
        PermissionCode.LIVE_AUCTION_RELEASE_RESULTS,
    ],
    "CFO": [
        PermissionCode.PR_VIEW_ALL, PermissionCode.PR_APPROVE,
        PermissionCode.PO_VIEW_ALL, PermissionCode.PO_APPROVE,
        PermissionCode.INVOICE_VIEW_ALL, PermissionCode.INVOICE_APPROVE,
        PermissionCode.PAYMENT_VIEW_ALL, PermissionCode.PAYMENT_APPROVE, PermissionCode.PAYMENT_PROCESS,
        PermissionCode.CONTRACT_VIEW_ALL, PermissionCode.CONTRACT_ACTIVATE,
        PermissionCode.AWARD_APPROVE,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.ANALYTICS_VIEW_REPORTS, PermissionCode.ANALYTICS_EXPORT,
        PermissionCode.ORG_VIEW, PermissionCode.ORG_VIEW_AUDIT, PermissionCode.ORG_MANAGE_LICENSE,
        PermissionCode.DOCUMENT_VIEW_ALL,
    ],
    "SUPPLIER_ADMIN": [
        PermissionCode.VENDOR_VIEW_OWN,
        PermissionCode.RFQ_VIEW_OWN,
        PermissionCode.BID_SUBMIT, PermissionCode.BID_VIEW_OWN, PermissionCode.BID_REVISE, PermissionCode.BID_WITHDRAW,
        PermissionCode.INVOICE_SUBMIT, PermissionCode.INVOICE_VIEW_OWN,
        PermissionCode.PO_ACKNOWLEDGE, PermissionCode.PO_VIEW_OWN,
        PermissionCode.GRN_VIEW_OWN,
        PermissionCode.DOCUMENT_UPLOAD, PermissionCode.DOCUMENT_VIEW_OWN,
        PermissionCode.NOTIFICATION_VIEW_OWN,
        PermissionCode.USER_VIEW_OWN, PermissionCode.USER_UPDATE_OWN,
        PermissionCode.CONTRACT_VIEW_OWN,
    ],
    "SUPPLIER_USER": [
        PermissionCode.VENDOR_VIEW_OWN,
        PermissionCode.RFQ_VIEW_OWN,
        PermissionCode.BID_SUBMIT, PermissionCode.BID_VIEW_OWN,
        PermissionCode.INVOICE_SUBMIT, PermissionCode.INVOICE_VIEW_OWN,
        PermissionCode.PO_VIEW_OWN,
        PermissionCode.GRN_VIEW_OWN,
        PermissionCode.DOCUMENT_UPLOAD, PermissionCode.DOCUMENT_VIEW_OWN,
        PermissionCode.NOTIFICATION_VIEW_OWN,
        PermissionCode.USER_VIEW_OWN,
        PermissionCode.CONTRACT_VIEW_OWN,
    ],
    "SUPERADMIN": [
        # Full system access - all permissions except permanently denied
        PermissionCode.ORG_VIEW, PermissionCode.ORG_UPDATE, PermissionCode.ORG_MANAGE_SETTINGS,
        PermissionCode.ORG_MANAGE_LICENSE, PermissionCode.ORG_VIEW_AUDIT, PermissionCode.ORG_MANAGE_USERS,
        PermissionCode.USER_CREATE, PermissionCode.USER_VIEW_ALL, PermissionCode.USER_UPDATE_ALL,
        PermissionCode.USER_DEACTIVATE, PermissionCode.USER_ASSIGN_ROLE, PermissionCode.USER_MANAGE_PERMISSIONS,
        PermissionCode.ADMIN_VIEW_SETTINGS, PermissionCode.ADMIN_MANAGE_SETTINGS,
        PermissionCode.ADMIN_VIEW_AUDIT_LOG, PermissionCode.ADMIN_MANAGE_ROLES,
        PermissionCode.ADMIN_MANAGE_SYSTEM, PermissionCode.ADMIN_VIEW_HEALTH,
        PermissionCode.MASTER_VIEW, PermissionCode.MASTER_CREATE, PermissionCode.MASTER_UPDATE,
        PermissionCode.MASTER_DELETE, PermissionCode.MASTER_IMPORT, PermissionCode.MASTER_EXPORT,
    ],
    "ORG_ADMIN": [
        PermissionCode.ORG_VIEW, PermissionCode.ORG_UPDATE, PermissionCode.ORG_MANAGE_SETTINGS, PermissionCode.ORG_VIEW_AUDIT,
        PermissionCode.USER_CREATE, PermissionCode.USER_VIEW_ALL, PermissionCode.USER_UPDATE_ALL,
        PermissionCode.USER_DEACTIVATE, PermissionCode.USER_ASSIGN_ROLE,
        PermissionCode.MASTER_VIEW, PermissionCode.MASTER_CREATE, PermissionCode.MASTER_UPDATE,
        PermissionCode.ADMIN_VIEW_SETTINGS, PermissionCode.ADMIN_MANAGE_SETTINGS, PermissionCode.ADMIN_VIEW_AUDIT_LOG,
        PermissionCode.ANALYTICS_VIEW_DASHBOARD, PermissionCode.ANALYTICS_VIEW_REPORTS,
        PermissionCode.WORKFLOW_VIEW, PermissionCode.WORKFLOW_CREATE, PermissionCode.WORKFLOW_UPDATE,
        PermissionCode.RULES_VIEW, PermissionCode.RULES_CREATE,
    ],
}


async def seed_data() -> None:
    logger.info("Starting master data seeding...")
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with session_factory() as session:
        # 1. Seed permissions
        perm_code_to_id: dict[str, str] = {}
        seen_codes: set[str] = set()
        for attr_name in dir(PermissionCode):
            if attr_name.startswith("_"):
                continue
            code_val = getattr(PermissionCode, attr_name)
            if not isinstance(code_val, str) or code_val in seen_codes:
                continue
            seen_codes.add(code_val)
            module = code_val.split(".")[0] if "." in code_val else "system"
            display_name = attr_name.replace("_", " ").title()
            perm_id = str(uuid4())
            await session.execute(text("""
                INSERT INTO permissions (id, code, name, module)
                VALUES (:id, :code, :name, :module)
                ON CONFLICT (code) DO NOTHING
            """), {"id": perm_id, "code": code_val, "name": display_name, "module": module})
            # Retrieve actual ID (may have existed already)
            result = await session.execute(
                text("SELECT id FROM permissions WHERE code = :code"), {"code": code_val}
            )
            row = result.fetchone()
            if row:
                perm_code_to_id[code_val] = str(row[0])

        logger.info("Seeded %d permissions", len(perm_code_to_id))

        # 2. Ensure system org exists (FK required by roles.org_id)
        SYSTEM_ORG_ID = "00000000-0000-0000-0000-000000000000"
        DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001"
        await session.execute(text("""
            INSERT INTO organizations (id, name, legal_name, country_code, version)
            VALUES (:id, 'System Organization', 'System Organization', 'IN', 1)
            ON CONFLICT (id) DO NOTHING
        """), {"id": SYSTEM_ORG_ID})

        target_org_ids = [SYSTEM_ORG_ID, DEFAULT_ORG_ID]

        # 3. Seed roles and role-permission mappings for each organization
        total_mappings = 0
        for current_org_id in target_org_ids:
            role_code_to_id: dict[str, str] = {}
            for role in ROLES:
                role_id = str(uuid4())
                await session.execute(text("""
                    INSERT INTO roles (id, org_id, code, name, is_system_role, is_supplier_role, is_active, version)
                    VALUES (:id, :org_id, :code, :name, :is_system_role, :is_supplier_role, true, 1)
                    ON CONFLICT (org_id, code) DO NOTHING
                """), {
                    "id": role_id,
                    "org_id": current_org_id,
                    "code": role["code"],
                    "name": role["name"],
                    "is_system_role": role["is_system_role"],
                    "is_supplier_role": role["is_supplier_role"],
                })
                result = await session.execute(
                    text("SELECT id FROM roles WHERE code = :code AND org_id = :org_id"),
                    {"code": role["code"], "org_id": current_org_id}
                )
                row = result.fetchone()
                if row:
                    role_code_to_id[role["code"]] = str(row[0])

            for role_code, perm_codes in ROLE_PERMISSIONS.items():
                role_id = role_code_to_id.get(role_code)
                if not role_id:
                    continue
                for perm_code in perm_codes:
                    perm_id = perm_code_to_id.get(perm_code)
                    if not perm_id:
                        logger.warning("Permission code not found: %s", perm_code)
                        continue
                    await session.execute(text("""
                        INSERT INTO role_permissions (id, org_id, role_id, permission_id)
                        VALUES (:id, :org_id, :role_id, :permission_id)
                        ON CONFLICT (org_id, role_id, permission_id) DO NOTHING
                    """), {
                        "id": str(uuid4()),
                        "org_id": current_org_id,
                        "role_id": role_id,
                        "permission_id": perm_id,
                    })
                    total_mappings += 1

        logger.info("Seeded %d role-permission mappings across %d organizations", total_mappings, len(target_org_ids))

        # 4. Seed Incoterms
        for term in INCOTERMS:
            await session.execute(text("""
                INSERT INTO incoterms (id, org_id, code, name, edition_year, risk_transfer_point, is_active, version)
                VALUES (:id, :org_id, :code, :name, :edition_year, :risk_transfer_point, true, 1)
                ON CONFLICT (org_id, code) DO NOTHING
            """), {
                "id": str(uuid4()),
                "org_id": SYSTEM_ORG_ID,
                "code": term["code"],
                "name": term["name"],
                "edition_year": term["edition_year"],
                "risk_transfer_point": term["risk_transfer_point"],
            })

        # 5. Seed UOMs
        DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001"
        await session.execute(text("""
            INSERT INTO organizations (id, name, legal_name, country_code, version)
            VALUES (:id, 'Default Organization', 'Default Organization Private Limited', 'IN', 1)
            ON CONFLICT (id) DO NOTHING
        """), {"id": DEFAULT_ORG_ID})

        for target_org in [SYSTEM_ORG_ID, DEFAULT_ORG_ID]:
            for uom in DEFAULT_UOMS:
                await session.execute(text("""
                    INSERT INTO uom_master (id, org_id, code, name, is_active, version)
                    VALUES (:id, :org_id, :code, :name, true, 1)
                    ON CONFLICT (org_id, code) DO NOTHING
                """), {"id": str(uuid4()), "org_id": target_org, "code": uom["code"], "name": uom["name"]})

            # 6. Seed Default Legal Entity, Business Unit, and Cost Center
            le_id = str(uuid4())
            await session.execute(text("""
                INSERT INTO legal_entities (id, org_id, name, registration_number, country_code, version)
                VALUES (:id, :org_id, 'Corporate Legal Entity', 'REG-001', 'IN', 1)
                ON CONFLICT (org_id, registration_number) DO NOTHING
            """), {"id": le_id, "org_id": target_org})

            le_res = await session.execute(
                text("SELECT id FROM legal_entities WHERE org_id = :org_id AND registration_number = 'REG-001'"),
                {"org_id": target_org}
            )
            real_le_id = str(le_res.scalar_one())

            bu_id = str(uuid4())
            await session.execute(text("""
                INSERT INTO business_units (id, org_id, legal_entity_id, code, name, default_currency, is_active, version)
                VALUES (:id, :org_id, :legal_entity_id, 'BU-CORP', 'Corporate & HQ', 'INR', true, 1)
                ON CONFLICT (org_id, code) DO NOTHING
            """), {"id": bu_id, "org_id": target_org, "legal_entity_id": real_le_id})

            bu_res = await session.execute(
                text("SELECT id FROM business_units WHERE org_id = :org_id AND code = 'BU-CORP'"),
                {"org_id": target_org}
            )
            real_bu_id = str(bu_res.scalar_one())

            cc_id = str(uuid4())
            await session.execute(text("""
                INSERT INTO cost_centers (id, org_id, business_unit_id, code, name, annual_budget, available_budget, is_active, version)
                VALUES (:id, :org_id, :business_unit_id, 'CC-EXEC', 'Executive & Administration', 10000000, 10000000, true, 1)
                ON CONFLICT (org_id, code) DO NOTHING
            """), {"id": cc_id, "org_id": target_org, "business_unit_id": real_bu_id})

        logger.info("Seeded default Legal Entity, Business Unit, and Cost Center")

        await session.commit()
        logger.info("Master data seeding completed successfully.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_data())
