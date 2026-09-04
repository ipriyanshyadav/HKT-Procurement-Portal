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
    # 11. Vendor Qualification (VENDOR_QUAL)
    {
        "code": "VENDOR_QUAL",
        "name": "Vendor Qualification Approval",
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
    # 12. Vendor Blacklist Dual-Approval (VENDOR_BLACKLIST)
    {
        "code": "VENDOR_BLACKLIST",
        "name": "Vendor Blacklist Dual Approval",
        "entity_type": "VENDOR",
        "steps": [
            {
                "step_number": 1,
                "step_name": "Compliance Officer Review",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {"role_code": "COMPLIANCE_OFFICER"},
                "sla_hours": _SLA[2],  # 24h
                "condition_expression": "",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
            {
                "step_number": 2,
                "step_name": "Procurement Head Final Approval",
                "step_type": "SEQUENTIAL",
                "resolver": "ROLE",
                "resolver_config": {
                    "role_code": "PROCUREMENT_HEAD",
                    "fallback_role": "PROCUREMENT_ADMIN",
                },
                "sla_hours": _SLA[2],  # 24h
                "condition_expression": "",
                "escalation_config": {"role_code": "PROCUREMENT_ADMIN"},
            },
        ],
    },
]

# Default approval rules for all document types (SPEC_06 S06-05)
DEFAULT_APPROVAL_RULES = [
    {
        "entity_type": "PR",
        "rule_code": "PR_HIGH_VALUE_CAPEX",
        "rule_name": "PR High-Value CapEx Approval",
        "priority": 100,
        "conditions": [{"field": "total_amount", "operator": ">=", "value": 50000}],
        "condition_expression": "total_amount >= 50000",
        "workflow_template_code": "PR_APPROVAL",
        "is_active": True,
        "is_catch_all": False,
    },
    {
        "entity_type": "PR",
        "rule_code": "PR_CATCH_ALL",
        "rule_name": "PR Default Catch-All",
        "priority": 1000,
        "conditions": [{"is_catch_all": True}],
        "condition_expression": None,
        "workflow_template_code": "PR_APPROVAL",
        "is_active": True,
        "is_catch_all": True,
    },
    {
        "entity_type": "RFQ",
        "rule_code": "RFQ_STRATEGIC",
        "rule_name": "RFQ Strategic Sourcing Approval",
        "priority": 100,
        "conditions": [{"field": "estimated_value", "operator": ">=", "value": 100000}],
        "condition_expression": "estimated_value >= 100000",
        "workflow_template_code": "RFQ_APPROVAL",
        "is_active": True,
        "is_catch_all": False,
    },
    {
        "entity_type": "RFQ",
        "rule_code": "RFQ_CATCH_ALL",
        "rule_name": "RFQ Default Catch-All",
        "priority": 1000,
        "conditions": [{"is_catch_all": True}],
        "condition_expression": None,
        "workflow_template_code": "RFQ_APPROVAL",
        "is_active": True,
        "is_catch_all": True,
    },
    {
        "entity_type": "PO",
        "rule_code": "PO_HIGH_VALUE",
        "rule_name": "PO High-Value Execution Approval",
        "priority": 100,
        "conditions": [{"field": "total_amount", "operator": ">=", "value": 50000}],
        "condition_expression": "total_amount >= 50000",
        "workflow_template_code": "PO_APPROVAL",
        "is_active": True,
        "is_catch_all": False,
    },
    {
        "entity_type": "PO",
        "rule_code": "PO_CATCH_ALL",
        "rule_name": "PO Default Catch-All",
        "priority": 1000,
        "conditions": [{"is_catch_all": True}],
        "condition_expression": None,
        "workflow_template_code": "PO_APPROVAL",
        "is_active": True,
        "is_catch_all": True,
    },
    {
        "entity_type": "VENDOR",
        "rule_code": "VENDOR_STRATEGIC",
        "rule_name": "Vendor Strategic Risk Qualification",
        "priority": 100,
        "conditions": [{"field": "risk_tier", "operator": "==", "value": "HIGH"}],
        "condition_expression": "risk_tier == 'HIGH'",
        "workflow_template_code": "VENDOR_ONBOARDING",
        "is_active": True,
        "is_catch_all": False,
    },
    {
        "entity_type": "VENDOR",
        "rule_code": "VENDOR_CATCH_ALL",
        "rule_name": "Vendor Onboarding Default Catch-All",
        "priority": 1000,
        "conditions": [{"is_catch_all": True}],
        "condition_expression": None,
        "workflow_template_code": "VENDOR_ONBOARDING",
        "is_active": True,
        "is_catch_all": True,
    },
    {
        "entity_type": "CONTRACT",
        "rule_code": "CONTRACT_HIGH_VALUE",
        "rule_name": "Contract Legal & Executive Review",
        "priority": 100,
        "conditions": [{"field": "contract_value", "operator": ">=", "value": 100000}],
        "condition_expression": "contract_value >= 100000",
        "workflow_template_code": "CONTRACT_APPROVAL",
        "is_active": True,
        "is_catch_all": False,
    },
    {
        "entity_type": "CONTRACT",
        "rule_code": "CONTRACT_CATCH_ALL",
        "rule_name": "Contract Execution Default Catch-All",
        "priority": 1000,
        "conditions": [{"is_catch_all": True}],
        "condition_expression": None,
        "workflow_template_code": "CONTRACT_APPROVAL",
        "is_active": True,
        "is_catch_all": True,
    },
]


async def seed_workflows(db: AsyncSession, org_id: UUID) -> None:
    """Insert all workflow templates. Idempotent on (code, org_id)."""
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


async def seed_approval_rules(db: AsyncSession, org_id: UUID) -> None:
    """Insert default approval rules for all document types. Idempotent via ORM query."""
    from sqlalchemy import select
    from app.modules.approval_rules.models import ApprovalRule

    for item in DEFAULT_APPROVAL_RULES:
        stmt = select(ApprovalRule).where(
            ApprovalRule.org_id == org_id,
            ApprovalRule.name == item["rule_code"],
        )
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()
        if not existing:
            rule = ApprovalRule(
                org_id=org_id,
                name=item["rule_code"],
                transaction_type=item["entity_type"],
                priority=item["priority"],
                conditions=item["conditions"],
                approval_steps=[{"template_code": item["workflow_template_code"]}],
                is_active=item["is_active"],
                created_by=org_id,
            )
            db.add(rule)
            logger.info("Seeded approval rule: [%s] %s", item["entity_type"], item["rule_code"])
        else:
            logger.info("Approval rule already exists: [%s] %s", item["entity_type"], item["rule_code"])

    await db.commit()
    logger.info("All default approval rules seeded for org %s.", org_id)


async def main() -> None:
    org_id_str = os.environ.get("DEFAULT_ORG_ID") or "00000000-0000-0000-0000-000000000000"
    org_id = UUID(org_id_str)

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        await seed_workflows(db, org_id)
        await seed_approval_rules(db, org_id)

    await engine.dispose()
    logger.info("Workflow seed complete.")


if __name__ == "__main__":
    asyncio.run(main())
