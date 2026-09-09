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

# 68 transactional and operational tables across all portals to truncate
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
    "negotiations",
    "award_details",
    "award_recommendations",
    # RFQs / Sourcing
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
    "grn_lines",
    "goods_receipt_notes",
    "quality_inspections",
    "ses_lines",
    "service_entry_sheets",
    # Invoices & Payments
    "invoice_match_results",
    "invoice_lines",
    "invoices",
    "dispute_messages",
    "disputes",
    "payment_records",
    # Contracts
    "contract_milestones",
    "contract_lines",
    "contract_amendments",
    "contract_documents",
    "contract_templates",
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
    # Vendor transactional artifacts
    "vendor_documents",
    "vendor_scorecards",
    # Documents
    "document_versions",
    "documents",
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


async def clear_transactional_tables() -> int:
    """Safely truncate transactional tables and cleanup ephemeral test artifacts while leaving preserved tables intact."""
    logger.info("Truncating %d transactional tables in PostgreSQL...", len(TRANSACTIONAL_TABLES))
    async with async_session() as db:
        stmt = f"TRUNCATE TABLE {', '.join(TRANSACTIONAL_TABLES)} CASCADE;"
        await db.execute(text(stmt))

        # Cleanup ephemeral test users, roles, and test organizations inserted during pytest runs
        await db.execute(text("DELETE FROM user_role_assignments WHERE org_id IN (SELECT id FROM organizations WHERE name LIKE 'Test Org%') OR user_id IN (SELECT id FROM users WHERE email LIKE '%@testcorp%');"))
        await db.execute(text("DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE org_id IN (SELECT id FROM organizations WHERE name LIKE 'Test Org%'));"))
        await db.execute(text("DELETE FROM roles WHERE org_id IN (SELECT id FROM organizations WHERE name LIKE 'Test Org%');"))
        await db.execute(text("DELETE FROM users WHERE email LIKE '%@testcorp%';"))
        await db.execute(text("DELETE FROM organizations WHERE name LIKE 'Test Org%';"))

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
