"""
Workflow Template Seed Script — inserts all 10 workflow template definitions.

Templates:
  1. PR_APPROVAL           — Purchase Requisition
  2. RFQ_APPROVAL          — RFQ / Tender
  3. VENDOR_ONBOARDING     — Vendor qualification & activation
  4. CONTRACT_APPROVAL     — Contract execution
  5. PO_APPROVAL           — Purchase Order
  6. INVOICE_APPROVAL      — Invoice 3-way match + payment approval
  7. UNMAPPED_PR_MAPPING   — Unmapped PR → category resolution
  8. MASTER_DATA_CHANGE    — Master data update
  9. VENDOR_QUALIFICATION  — Vendor re-qualification
  10. AWARD_APPROVAL       — Award recommendation approval

Idempotent (ON CONFLICT DO NOTHING on code + org_id).
org_id from DEFAULT_ORG_ID env var.
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
from uuid import UUID

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ─── SLA hours from settings (UNMAPPED_PR_SLA_HOURS = [4, 8, 24, 48]) ────────
# Index 0=4h, 1=8h, 2=24h, 3=48h
_SLA = settings.UNMAPPED_PR_SLA_HOURS  # [4, 8, 24, 48]

WORKFLOW_TEMPLATES = [
    # 1. PR Approval — 4-step conditional workflow
    {
        "code": "PR_APPROVAL",
        "name": "Purchase Requisition Approval",
        "entity_type": "REQUISITION",
        "steps": [
            {
                "step_number": 1,
                "step_name": "HOD Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "APPROVER",
                    "scope_filter": "same_bu",
                    "fallback_role": "PROCUREMENT_MANAGER",
                },
                "sla_hours": _SLA[1],  # 8h
                "condition_expression": "",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
            {
                "step_number": 2,
                "step_name": "Finance Controller Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "FINANCE_CONTROLLER",
                    "scope_filter": "same_bu",
                    "fallback_role": "PROCUREMENT_ADMIN",
                },
                "sla_hours": _SLA[1],  # 8h
                "condition_expression": "amount > 500000",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
            {
                "step_number": 3,
                "step_name": "Procurement Head Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "PROCUREMENT_HEAD",
                    "fallback_role": "PROCUREMENT_ADMIN",
                },
                "sla_hours": _SLA[2],  # 24h
                "condition_expression": "amount > 2500000",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
            {
                "step_number": 4,
                "step_name": "CFO Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "CFO",
                    "fallback_role": "PROCUREMENT_ADMIN",
                },
                "sla_hours": _SLA[3],  # 48h
                "condition_expression": "is_capex == True and amount > 2500000",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
        ],
    },
    # 2. RFQ Approval
    {
        "code": "RFQ_APPROVAL",
        "name": "Request for Quotation Approval",
        "entity_type": "RFQ",
        "steps": [
            {
                "step_number": 1,
                "step_name": "Sourcing Manager Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "SOURCING_MANAGER",
                    "fallback_role": "PROCUREMENT_MANAGER",
                },
                "sla_hours": _SLA[1],  # 8h
                "condition_expression": "",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
            {
                "step_number": 2,
                "step_name": "Procurement Head Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "PROCUREMENT_HEAD",
                    "fallback_role": "PROCUREMENT_ADMIN",
                },
                "sla_hours": _SLA[2],  # 24h
                "condition_expression": "estimated_value > 1000000",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
        ],
    },
    # 3. Vendor Onboarding Approval
    {
        "code": "VENDOR_ONBOARDING",
        "name": "Vendor Onboarding & Qualification",
        "entity_type": "VENDOR",
        "steps": [
            {
                "step_number": 1,
                "step_name": "Vendor Admin Review",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {"role_code": "VENDOR_ADMIN"},
                "sla_hours": _SLA[2],  # 24h
                "condition_expression": "",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
            {
                "step_number": 2,
                "step_name": "Compliance Review",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "COMPLIANCE_OFFICER",
                    "fallback_role": "PROCUREMENT_ADMIN",
                },
                "sla_hours": _SLA[3],  # 48h
                "condition_expression": "",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
            {
                "step_number": 3,
                "step_name": "Finance Validation",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "FINANCE_CONTROLLER",
                    "fallback_role": "PROCUREMENT_ADMIN",
                },
                "sla_hours": _SLA[2],  # 24h
                "condition_expression": "vendor_type == 'STRATEGIC'",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
        ],
    },
    # 4. Contract Approval
    {
        "code": "CONTRACT_APPROVAL",
        "name": "Contract Execution Approval",
        "entity_type": "CONTRACT",
        "steps": [
            {
                "step_number": 1,
                "step_name": "Legal Review",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {"role_code": "COMPLIANCE_OFFICER"},
                "sla_hours": _SLA[3],  # 48h
                "condition_expression": "",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
            {
                "step_number": 2,
                "step_name": "Finance Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "FINANCE_CONTROLLER",
                    "fallback_role": "CFO",
                },
                "sla_hours": _SLA[3],  # 48h
                "condition_expression": "total_value > 500000",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
            {
                "step_number": 3,
                "step_name": "CFO Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {"role_code": "CFO"},
                "sla_hours": _SLA[3],  # 48h
                "condition_expression": "total_value > 5000000",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
        ],
    },
    # 5. PO Approval
    {
        "code": "PO_APPROVAL",
        "name": "Purchase Order Approval",
        "entity_type": "PURCHASE_ORDER",
        "steps": [
            {
                "step_number": 1,
                "step_name": "Procurement Officer Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "PROCUREMENT_OFFICER",
                    "scope_filter": "same_bu",
                    "fallback_role": "PROCUREMENT_MANAGER",
                },
                "sla_hours": _SLA[0],  # 4h
                "condition_expression": "",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
            {
                "step_number": 2,
                "step_name": "Finance Controller Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "FINANCE_CONTROLLER",
                    "fallback_role": "PROCUREMENT_ADMIN",
                },
                "sla_hours": _SLA[1],  # 8h
                "condition_expression": "po_value > 200000",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
        ],
    },
    # 6. Invoice Approval
    {
        "code": "INVOICE_APPROVAL",
        "name": "Invoice 3-Way Match and Approval",
        "entity_type": "INVOICE",
        "steps": [
            {
                "step_number": 1,
                "step_name": "Accounts Payable Review",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "FINANCE_CONTROLLER",
                    "fallback_role": "PROCUREMENT_ADMIN",
                },
                "sla_hours": _SLA[1],  # 8h
                "condition_expression": "",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
            {
                "step_number": 2,
                "step_name": "CFO Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {"role_code": "CFO"},
                "sla_hours": _SLA[2],  # 24h
                "condition_expression": "invoice_amount > 1000000",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
        ],
    },
    # 7. Unmapped PR Mapping
    {
        "code": "UNMAPPED_PR_MAPPING",
        "name": "Unmapped PR Category Resolution",
        "entity_type": "UNMAPPED_PR",
        "steps": [
            {
                "step_number": 1,
                "step_name": "Procurement Officer Assignment",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {"role_code": "PROCUREMENT_OFFICER"},
                "sla_hours": _SLA[0],  # 4h — from UNMAPPED_PR_SLA_HOURS[0]
                "condition_expression": "",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
            {
                "step_number": 2,
                "step_name": "Checker Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "PROCUREMENT_MANAGER",
                    "fallback_role": "PROCUREMENT_ADMIN",
                },
                "sla_hours": _SLA[1],  # 8h — from UNMAPPED_PR_SLA_HOURS[1]
                "condition_expression": "",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
        ],
    },
    # 8. Master Data Change
    {
        "code": "MASTER_DATA_CHANGE",
        "name": "Master Data Change Approval",
        "entity_type": "MASTER_DATA",
        "steps": [
            {
                "step_number": 1,
                "step_name": "Procurement Admin Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {"role_code": "PROCUREMENT_ADMIN"},
                "sla_hours": _SLA[2],  # 24h
                "condition_expression": "",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
        ],
    },
    # 9. Vendor Qualification (re-evaluation)
    {
        "code": "VENDOR_QUALIFICATION",
        "name": "Vendor Re-Qualification Approval",
        "entity_type": "VENDOR",
        "steps": [
            {
                "step_number": 1,
                "step_name": "Parallel Compliance + Finance Review",
                "step_type": "PARALLEL",
                "convergence": "ALL",
                "resolver": "APPROVAL_GROUP",
                "resolver_config": {"group_code": "VENDOR_QUAL_COMMITTEE"},
                "sla_hours": _SLA[3],  # 48h
                "condition_expression": "",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
            {
                "step_number": 2,
                "step_name": "Procurement Head Final Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {"role_code": "PROCUREMENT_HEAD"},
                "sla_hours": _SLA[2],  # 24h
                "condition_expression": "",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
        ],
    },
    # 10. Award Recommendation Approval
    {
        "code": "AWARD_APPROVAL",
        "name": "Award Recommendation Approval",
        "entity_type": "AWARD",
        "steps": [
            {
                "step_number": 1,
                "step_name": "Sourcing Manager Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "SOURCING_MANAGER",
                    "fallback_role": "PROCUREMENT_MANAGER",
                },
                "sla_hours": _SLA[1],  # 8h
                "condition_expression": "",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
            {
                "step_number": 2,
                "step_name": "Procurement Head Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "PROCUREMENT_HEAD",
                    "fallback_role": "PROCUREMENT_ADMIN",
                },
                "sla_hours": _SLA[2],  # 24h
                "condition_expression": "awarded_total > 1000000",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
            {
                "step_number": 3,
                "step_name": "CFO + Finance Parallel Approval (QUORUM 2 of 2)",
                "step_type": "PARALLEL",
                "convergence": "QUORUM_2_OF_2",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "CFO",
                    "fallback_role": "FINANCE_CONTROLLER",
                },
                "sla_hours": _SLA[3],  # 48h
                "condition_expression": "awarded_total > 5000000",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
        ],
    },
]

# Default catch-all approval rule (SPEC_06 S06-05)
CATCH_ALL_APPROVAL_RULE = {
    "entity_type": "PR",
    "rule_code": "PR_CATCH_ALL",
    "rule_name": "PR Default Catch-All",
    "priority": 1000,
    "conditions": {},
    "condition_expression": None,
    "workflow_template_code": "PR_APPROVAL",
    "is_active": True,
    "is_catch_all": True,
}


async def seed_workflows(db: AsyncSession, org_id: UUID) -> None:
    """Insert all 10 workflow templates. Idempotent on (code, org_id)."""
    import json

    for template in WORKFLOW_TEMPLATES:
        stmt = text(
            """
            INSERT INTO workflow_templates (id, org_id, code, name, entity_type, steps, is_active, version, created_at, updated_at)
            VALUES (gen_random_uuid(), :org_id, :code, :name, :entity_type, CAST(:steps AS JSONB), TRUE, 1, NOW(), NOW())
            ON CONFLICT (org_id, code) DO NOTHING
            """
        )
        await db.execute(
            stmt,
            {
                "org_id": str(org_id),
                "code": template["code"],
                "name": template["name"],
                "entity_type": template["entity_type"],
                "steps": json.dumps(template["steps"]),
            },
        )
        logger.info("Seeded workflow template: %s", template["code"])

    await db.commit()
    logger.info("All %d workflow templates seeded.", len(WORKFLOW_TEMPLATES))


async def seed_catch_all_rule(db: AsyncSession, org_id: UUID) -> None:
    """Insert catch-all PR approval rule. Idempotent via ORM query."""
    from sqlalchemy import select
    from app.modules.approval_rules.models import ApprovalRule

    stmt = select(ApprovalRule).where(
        ApprovalRule.org_id == org_id,
        ApprovalRule.name == CATCH_ALL_APPROVAL_RULE["rule_code"],
    )
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    if not existing:
        rule = ApprovalRule(
            org_id=org_id,
            name=CATCH_ALL_APPROVAL_RULE["rule_code"],
            transaction_type=CATCH_ALL_APPROVAL_RULE["entity_type"],
            priority=CATCH_ALL_APPROVAL_RULE["priority"],
            conditions=[{"is_catch_all": True}],
            approval_steps=[{"template_code": CATCH_ALL_APPROVAL_RULE["workflow_template_code"]}],
            is_active=CATCH_ALL_APPROVAL_RULE["is_active"],
            created_by=org_id,
        )
        db.add(rule)
        await db.commit()
        logger.info("Seeded catch-all approval rule: %s", CATCH_ALL_APPROVAL_RULE["rule_code"])
    else:
        logger.info("Catch-all approval rule already exists: %s", CATCH_ALL_APPROVAL_RULE["rule_code"])


async def main() -> None:
    org_id_str = os.environ.get("DEFAULT_ORG_ID")
    if not org_id_str:
        logger.error(
            "DEFAULT_ORG_ID env var is required. "
            "Run: DEFAULT_ORG_ID=<uuid> python scripts/seed_workflows.py"
        )
        sys.exit(1)

    org_id = UUID(org_id_str)

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        await seed_workflows(db, org_id)
        await seed_catch_all_rule(db, org_id)

    await engine.dispose()
    logger.info("Workflow seed complete.")


if __name__ == "__main__":
    asyncio.run(main())
