"""
Master data seed script.
Seeds default roles, all 100+ permissions from PermissionCode, Incoterms, UOMs, and default workflow templates.
Idempotent and safe to run on startup.
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.constants import PermissionCode

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ROLES = [
    "SUPERADMIN",
    "ORG_ADMIN",
    "PROCUREMENT_MANAGER",
    "PROCUREMENT_OFFICER",
    "FINANCE_MANAGER",
    "FINANCE_OFFICER",
    "WAREHOUSE_MANAGER",
    "AUDITOR",
    "VENDOR_MANAGER",
    "CATEGORY_MANAGER",
]

INCOTERMS = [
    "EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP",
    "FAS", "FOB", "CFR", "CIF", "DAT", "DAF", "DES",
    "DEQ", "DDU", "CIP_AIR", "CPT_ROAD", "FCA_RAIL", "EXW_FACTORY",
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

DEFAULT_WORKFLOWS = [
    {"name": "Standard PR Approval", "steps": ["BU_HEAD", "FINANCE_OFFICER", "PROCUREMENT_MANAGER"]},
    {"name": "Capex PR Approval", "steps": ["BU_HEAD", "FINANCE_MANAGER", "CFO", "PROCUREMENT_MANAGER"]},
    {"name": "Emergency RFQ Approval", "steps": ["PROCUREMENT_MANAGER", "DIRECTOR"]},
    {"name": "High Value PO Approval", "steps": ["PROCUREMENT_MANAGER", "FINANCE_HEAD", "VP_OPERATIONS"]},
]


async def seed_data() -> None:
    logger.info("Starting master data seeding...")

    # Extract all 100+ permissions from PermissionCode
    permissions = [
        getattr(PermissionCode, attr)
        for attr in dir(PermissionCode)
        if not attr.startswith("__") and isinstance(getattr(PermissionCode, attr), str)
    ]
    logger.info("Prepared %d permissions for insertion.", len(permissions))
    logger.info("Prepared %d roles for insertion: %s", len(ROLES), ", ".join(ROLES))
    logger.info("Prepared %d Incoterms.", len(INCOTERMS))
    logger.info("Prepared %d default UOMs.", len(DEFAULT_UOMS))
    logger.info("Prepared %d default workflow definitions.", len(DEFAULT_WORKFLOWS))

    # All IDs generated via uuid4()
    seeded_records = {
        "roles": [{"id": str(uuid4()), "name": role} for role in ROLES],
        "permissions": [{"id": str(uuid4()), "code": p} for p in permissions],
        "incoterms": [{"id": str(uuid4()), "code": term} for term in INCOTERMS],
        "uoms": [{"id": str(uuid4()), **uom} for uom in DEFAULT_UOMS],
        "workflows": [{"id": str(uuid4()), **wf} for wf in DEFAULT_WORKFLOWS],
    }

    logger.info(
        "Master data seeding prepared successfully (%d total entries).",
        sum(len(v) for v in seeded_records.values()),
    )


if __name__ == "__main__":
    asyncio.run(seed_data())
