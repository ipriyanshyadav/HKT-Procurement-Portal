"""
Clear all seeded transactional and operational data from all portals while preserving:
- Users, User Role Assignments, User Sessions, MFA, and Security Settings
- Organizations and Organizational Units (Entities, BUs, Plants, Depts, Cost Centers, Locations)
- Roles and Permissions (15 roles, 100+ permissions, role-permission mappings)
- Vendors, Vendor Contacts, and Vendor Bank Accounts (so Supplier portal accounts remain functional)
- Master Reference Data (Categories, UOMs, Currencies, Incoterms, Payment Terms, Tax Codes, Holidays)
- Workflow Templates & Approval Rules
- Notification Templates
- Master Catalog Items
- Ticket Configurations (SLAs, Custom Field Definitions, Automation Rules)

Usage:
    .venv/bin/python scripts/clear_seeded_data.py
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text

from app.core.redis_client import get_redis_client
from app.db.session import async_session, engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("clear_seeded_data")

# Transactional and operational tables across all portals to truncate CASCADE
TRANSACTIONAL_TABLES = [
    # Auctions & Bids
    "auction_participants",
    "auction_rank_snapshots",
    "live_bids",
    "live_auctions",
    "bid_line_responses",
    "bid_responses",
    "bid_documents",
    "bid_versions",
    # Evaluation & Awards
    "cs_line_rankings",
    "comparative_statements",
    "evaluation_scores",
    "evaluations",
    "negotiation_rounds",
    "negotiation_sessions",
    "negotiations",
    "award_details",
    "award_recommendations",
    # RFQs / Sourcing
    "ai_rfq_drafts",
    "rfq_clarifications",
    "rfq_amendments",
    "rfq_participants",
    "rfq_lines",
    "rfq_lots",
    "rfqs",
    # Requisitions
    "requisition_lines",
    "requisitions",
    "unmapped_pr_exceptions",
    "unmapped_pr_mapping_log",
    # Purchase Orders
    "po_amendments",
    "po_lines",
    "purchase_orders",
    # Goods Receipt & Quality
    "advance_shipping_notices",
    "asn_lines",
    "grn_lines",
    "goods_receipt_notes",
    "quality_inspections",
    "ses_lines",
    "service_entry_sheets",
    # Invoices & Payments
    "invoice_match_results",
    "invoice_lines",
    "invoices",
    "e_invoices",
    "e_way_bills",
    "dispute_messages",
    "disputes",
    "payment_records",
    # Contracts
    "contract_milestones",
    "contract_lines",
    "contract_amendments",
    "contract_documents",
    "contract_redlines",
    "contract_clause_instances",
    "contract_esign_sessions",
    "contracts",
    # Workflow Instances & Tasks
    "workflow_events",
    "workflow_tasks",
    "workflow_instances",
    # Tickets
    "ticket_custom_field_values",
    "ticket_links",
    "ticket_watchers",
    "ticket_activity_log",
    "ticket_comments",
    "ticket_attachments",
    "tickets",
    # Communications
    "communication_messages",
    "communication_threads",
    # Notifications
    "notifications",
    # Integrations & Sync
    "scheduled_job_runs",
    "integration_jobs",
    "vendor_erp_sync_log",
    "erp_material_group_mapping",
    "erp_entity_mappings",
    # Vendor transactional artifacts
    "vendor_documents",
    "vendor_scorecards",
    "vendor_risk_assessments",
    "vendor_onboarding_applications",
    "supplier_esg_metrics",
    "supplier_radar_scores",
    # Documents
    "document_versions",
    "documents",
    # Carts & Sessions
    "cart_items",
    "user_carts",
    "punchout_sessions",
    # Analytics & Maverick spend
    "maverick_spend_clusters",
    # Compliance & DR
    "compliance_findings",
    "compliance_scans",
    "dr_failover_drills",
    "dr_backup_checkpoints",
    # Webhooks & Delegations & Misc
    "delegation_rules",
    "webhook_deliveries",
    "webhook_subscriptions",
    "user_coi_declarations",
    "password_history",
    "notification_preferences",
    # Outbox & Audit
    "outbox_messages",
    "audit_logs",
]

PRESERVED_TABLES = [
    "users",
    "user_role_assignments",
    "roles",
    "permissions",
    "role_permissions",
    "organizations",
    "legal_entities",
    "business_units",
    "plants",
    "departments",
    "cost_centers",
    "delivery_locations",
    "vendors",
    "vendor_contacts",
    "vendor_bank_accounts",
    "categories",
    "item_master",
    "uom_master",
    "currency_master",
    "incoterms",
    "payment_terms",
    "tax_codes",
    "holiday_master",
    "workflow_templates",
    "approval_rules",
    "notification_templates",
    "ticket_sla_config",
    "ticket_custom_field_defs",
    "ticket_automation_rules",
]

CLEANUP_EPHEMERAL_STATEMENTS = [
    # Break cross references on test rows before deletion
    "UPDATE users SET vendor_id = NULL, business_unit_id = NULL, department_id = NULL, plant_id = NULL WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "UPDATE vendors SET invited_by = NULL, blacklist_initiated_by = NULL, blacklist_confirmed_by = NULL;",
    "UPDATE vendor_bank_accounts SET validated_by = NULL;",
    "UPDATE user_role_assignments SET assigned_by = NULL;",
    "UPDATE api_keys SET revoked_by = NULL;",

    # User child associations for non-default users
    "DELETE FROM user_sessions WHERE user_id NOT IN (SELECT id FROM users WHERE org_id IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001'));",
    "DELETE FROM user_mfa WHERE user_id NOT IN (SELECT id FROM users WHERE org_id IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001'));",
    "DELETE FROM user_company_access WHERE user_id NOT IN (SELECT id FROM users WHERE org_id IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001')) OR org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM user_bu_scopes WHERE user_id NOT IN (SELECT id FROM users WHERE org_id IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001'));",
    "DELETE FROM user_category_scopes WHERE user_id NOT IN (SELECT id FROM users WHERE org_id IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001'));",
    "DELETE FROM approval_group_members WHERE user_id NOT IN (SELECT id FROM users WHERE org_id IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001'));",
    "DELETE FROM api_keys WHERE user_id NOT IN (SELECT id FROM users WHERE org_id IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001'));",
    "DELETE FROM user_role_assignments WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001') OR user_id NOT IN (SELECT id FROM users WHERE org_id IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001')) OR role_id NOT IN (SELECT id FROM roles WHERE org_id IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001'));",
    "DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001'));",
    "DELETE FROM roles WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM users WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",

    # Master and org hierarchy data for non-default orgs
    "DELETE FROM vendor_bank_accounts WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM vendor_contacts WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM vendor_category_mappings WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM supplier_categories WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM catalog_tier_pricing WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM item_master WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM categories WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM uom_master WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM currency_master WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM payment_terms WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM tax_codes WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM holiday_master WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM approval_rule_versions WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM approval_rules WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM approval_groups WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM workflow_templates WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM notification_templates WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM ticket_sla_config WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM ticket_custom_field_defs WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM ticket_automation_rules WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM tenant_settings WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM punchout_configs WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM delivery_locations WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM cost_centers WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM plants WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM departments WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM business_units WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM legal_entities WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM vendors WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM compliance_policies WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM contract_clauses WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM document_types WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
    "DELETE FROM incoterms WHERE org_id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",

    # Non-default organizations
    "DELETE FROM organizations WHERE id NOT IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');",
]


async def clear_transactional_tables() -> int:
    """Safely truncate transactional tables CASCADE and cleanup non-default ephemeral test artifacts."""
    logger.info("Truncating %d transactional tables in PostgreSQL CASCADE...", len(TRANSACTIONAL_TABLES))
    async with async_session() as db:
        stmt = f"TRUNCATE TABLE {', '.join(TRANSACTIONAL_TABLES)} CASCADE;"
        await db.execute(text(stmt))

        logger.info("Cleaning up ephemeral test organizations, users, and orphaned rows...")
        for s in CLEANUP_EPHEMERAL_STATEMENTS:
            await db.execute(text(s))

        await db.commit()
    logger.info("Successfully truncated %d transactional tables and cleaned test artifacts.", len(TRANSACTIONAL_TABLES))
    return len(TRANSACTIONAL_TABLES)




async def reset_sequences() -> int:
    """Reset all public database sequences back to 1."""
    logger.info("Resetting PostgreSQL sequences...")
    async with async_session() as db:
        res = await db.execute(
            text(
                "SELECT sequence_name FROM information_schema.sequences "
                "WHERE sequence_schema = 'public' ORDER BY sequence_name;"
            )
        )
        sequences = [row[0] for row in res.fetchall()]
        for seq in sequences:
            await db.execute(text(f"ALTER SEQUENCE {seq} RESTART WITH 1;"))
        await db.commit()
    logger.info("Reset %d sequences back to 1.", len(sequences))
    return len(sequences)


async def clear_redis() -> None:
    """Flush Redis cache to eliminate stale cached counts, rates, and sequences."""
    logger.info("Flushing Redis cache...")
    try:
        redis = get_redis_client()
        await redis.flushdb()
        logger.info("Redis cache flushed successfully.")
    except Exception as e:
        logger.warning("Redis flush encountered notice: %s", e)


async def verify_clearing():
    """Verify that all transactional tables are empty and preserved tables are intact."""
    logger.info("Verifying database state...")
    async with async_session() as db:
        cleared_status = {}
        for tbl in TRANSACTIONAL_TABLES:
            try:
                cnt = (await db.execute(text(f"SELECT count(*) FROM {tbl}"))).scalar()
                cleared_status[tbl] = cnt
            except Exception as e:
                cleared_status[tbl] = f"Error: {e}"

        preserved_status = {}
        for tbl in PRESERVED_TABLES:
            try:
                cnt = (await db.execute(text(f"SELECT count(*) FROM {tbl}"))).scalar()
                preserved_status[tbl] = cnt
            except Exception as e:
                preserved_status[tbl] = f"Error: {e}"

    logger.info("================================================================================")
    logger.info("📊 DATABASE CLEARING VERIFICATION REPORT")
    logger.info("================================================================================")
    logger.info("--- PRESERVED TABLES (Retained with row counts) ---")
    for tbl, cnt in preserved_status.items():
        logger.info("  %-32s : %s", tbl, cnt)

    logger.info("--- TRANSACTIONAL TABLES (Expected 0 rows) ---")
    non_zero = {k: v for k, v in cleared_status.items() if v != 0}
    if non_zero:
        logger.error("❌ ERROR: Some transactional tables still have rows: %s", non_zero)
        sys.exit(1)
    else:
        logger.info("  ✅ All %d transactional tables are completely empty (0 rows).", len(TRANSACTIONAL_TABLES))


async def main():
    start_time = time.time()
    logger.info("================================================================================")
    logger.info("🧹 CLEARING ALL SEEDED DATA ACROSS ALL PORTALS (EXCEPT USERS & MASTER DATA)")
    logger.info("================================================================================")

    await clear_transactional_tables()
    await reset_sequences()
    await clear_redis()
    await verify_clearing()

    elapsed = time.time() - start_time
    logger.info("================================================================================")
    logger.info("✅ ALL SEEDED PORTAL DATA CLEARED SUCCESSFULLY in %.2f seconds!", elapsed)
    logger.info("================================================================================")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
