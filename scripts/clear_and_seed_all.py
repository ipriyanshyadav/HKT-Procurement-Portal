"""
Master database reset and synchronous end-to-end seed orchestrator.
Strictly executes according to docs/PLATFORM_WORKFLOW_DOCUMENT.md and GEMINI.md:

1. Truncates all transactional and test tables in PostgreSQL CASCADE (preserving alembic_version).
2. Flushes Redis cache to prevent stale counts and cached tokens.
3. Seeds Master Data & Security (Organization, Roles, Permissions, Categories, UOMs, Payment Terms, HSN).
4. Seeds Workflow Templates (12 templates) and Business Rule Engine Approval Rules.
5. Seeds Notification Templates (66 templates across all channels).
6. Seeds Master Catalog Items (9 items across IT, Cloud, Facilities).
7. Seeds Complete End-to-End Demo Lifecycle Entities:
   - Demo Users (Admin, Buyer, Approver, Supplier Acme, Supplier Global Cloud)
   - Vendors across all 5 lifecycle statuses (Active, Qualified, Submitted, Invited)
   - Requisitions across all 5 states + Unmapped PR Exception
   - Workflow Instances & Tasks (lights up Approver /tasks inbox)
   - RFQs across 6 states (Published, Bid Open, Under Evaluation, Awarded, Draft, Live Reverse Auction)
   - Sealed and Live Bids
   - Comparative Statements, CS Line Rankings, Negotiations, Award Recommendations & Details
   - Purchase Orders across 4 states (Acknowledged, Sent to Vendor, Partially Received, Approved)
   - Goods Receipt Notes (Approved, Draft/Pending Inspection)
   - Invoices across 3 states (Matched & Pending Approval, Disputed with 2-way message thread, Paid)
   - Payments across 2 states (Scheduled, Completed with UTR)
   - Contracts across 3 states (Active with 30% utilization & milestones, Under Review, Draft)
   - ERP Integrations (6 IntegrationJobs + 3 ScheduledJobRuns)
   - Relational Tickets across all 7 statuses, SLAs, Custom Fields, Bidirectional Links, Automation Rules
   - In-App Notifications for all demo user personas

Usage:
    .venv/bin/python scripts/clear_and_seed_all.py
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
from uuid import UUID

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text

from app.core.redis_client import get_redis_client
from app.db.session import async_session, engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("clear_and_seed_all")

DEFAULT_ORG_ID = UUID("00000000-0000-0000-0000-000000000001")


async def clear_database() -> int:
    """Safely truncate all base tables excluding alembic_version and partition children."""
    logger.info("Starting database truncation...")
    async with async_session() as db:
        # Find all base tables excluding alembic_version and child partitions of audit_logs
        query = text("""
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename != 'alembic_version'
              AND tablename NOT LIKE 'audit_logs_20%'
            ORDER BY tablename;
        """)
        res = await db.execute(query)
        tables = [row[0] for row in res.fetchall()]

        if tables:
            # Truncate all in a single CASCADE statement
            truncate_stmt = f"TRUNCATE TABLE {', '.join(tables)} CASCADE;"
            await db.execute(text(truncate_stmt))
            await db.commit()
            logger.info("Successfully truncated %d tables CASCADE (alembic_version preserved).", len(tables))
            return len(tables)
        return 0


async def clear_redis() -> None:
    """Flush all Redis keys to ensure clean cache and reset state."""
    logger.info("Flushing Redis cache...")
    try:
        redis = get_redis_client()
        await redis.flushdb()
        logger.info("Redis cache flushed successfully.")
    except Exception as e:
        logger.warning("Redis flush failed or skipped: %s", e)


async def run_all_seeds():
    start_time = time.time()
    logger.info("================================================================================")
    logger.info("🚀 STARTING COMPLETE SYNCHRONOUS PLATFORM WORKFLOW DATABASE RESET & SEEDING")
    logger.info("================================================================================")

    # 1. Truncate Tables
    await clear_database()

    # 2. Flush Redis
    await clear_redis()

    # 3. Seed Master Data & Organization
    logger.info("--- [1/6] Seeding Master Data, Categories, Roles & Permissions ---")
    from scripts.seed_master_data import seed_data as seed_master_data_fn

    await seed_master_data_fn()

    # 4. Seed Workflow Templates & Approval Rules
    logger.info("--- [2/6] Seeding Workflow Templates & Approval Rules ---")
    from scripts.seed_workflows import seed_approval_rules, seed_workflows

    async with async_session() as db:
        await seed_workflows(db, DEFAULT_ORG_ID)
        await seed_approval_rules(db, DEFAULT_ORG_ID)

    # 5. Seed Notification Templates
    logger.info("--- [3/6] Seeding Notification Templates ---")
    from scripts.seed_notification_templates import seed_templates as seed_notification_templates_fn

    await seed_notification_templates_fn()

    # 6. Seed Catalog Items
    logger.info("--- [4/6] Seeding Master Catalog Items ---")
    from scripts.seed_catalog_items import seed as seed_catalog_items_fn

    await seed_catalog_items_fn()

    # 7. Seed Demo Users, Vendors, PRs, RFQs, Bids, CS, POs, GRNs, Invoices, Payments, Contracts, Integrations, Tickets, Notifications
    logger.info("--- [5/6] Seeding Complete Demo Lifecycle Entities & Transacting Data ---")
    from scripts.seed_demo_user import seed_demo

    await seed_demo()

    # 8. Verification & Summary
    logger.info("--- [6/6] Verifying Seeded Entity Counts ---")
    async with async_session() as db:
        tables_to_check = [
            "organizations",
            "users",
            "roles",
            "categories",
            "item_master",
            "vendors",
            "vendor_bank_accounts",
            "requisitions",
            "requisition_lines",
            "unmapped_pr_exceptions",
            "workflow_templates",
            "workflow_instances",
            "workflow_tasks",
            "rfqs",
            "rfq_lines",
            "bid_responses",
            "comparative_statements",
            "cs_line_rankings",
            "negotiations",
            "award_recommendations",
            "live_auctions",
            "purchase_orders",
            "po_lines",
            "goods_receipt_notes",
            "grn_lines",
            "invoices",
            "invoice_match_results",
            "disputes",
            "dispute_messages",
            "payment_records",
            "contracts",
            "contract_lines",
            "contract_milestones",
            "contract_amendments",
            "contract_documents",
            "delivery_locations",
            "document_types",
            "documents",
            "vendor_category_mappings",
            "vendor_scorecards",
            "live_bids",
            "po_amendments",
            "tickets",
            "ticket_comments",
            "ticket_attachments",
            "ticket_activity_log",
            "ticket_sla_config",
            "ticket_custom_field_defs",
            "ticket_custom_field_values",
            "ticket_links",
            "ticket_automation_rules",
            "notifications",
            "notification_templates",
            "notification_preferences",
            "integration_jobs",
            "scheduled_job_runs",
            "advance_shipping_notices",
            "asn_lines",
            "e_invoices",
            "e_way_bills",
            "service_entry_sheets",
            "ses_lines",
            "quality_inspections",
            "delegation_rules",
            "vendor_onboarding_applications",
            "vendor_risk_assessments",
            "contract_templates",
            "contract_clauses",
            "contract_clause_instances",
            "contract_redlines",
            "contract_esign_sessions",
            "dr_backup_checkpoints",
            "dr_failover_drills",
            "api_keys",
            "webhook_subscriptions",
            "webhook_deliveries",
            "maverick_spend_clusters",
            "carbon_emission_factors",
            "supplier_esg_metrics",
            "compliance_policies",
            "compliance_scans",
            "compliance_findings",
            "user_carts",
            "cart_items",
            "user_bu_scopes",
            "user_category_scopes",
            "user_coi_declarations",
            "user_company_access",
            "user_mfa",
            "password_history",
            "approval_groups",
            "approval_group_members",
            "approval_rules",
            "approval_rule_versions",
            "rfq_amendments",
            "bid_documents",
            "evaluations",
            "evaluation_scores",
            "ai_rfq_drafts",
            "negotiation_sessions",
            "negotiation_rounds",
            "supplier_radar_scores",
            "communication_threads",
            "communication_messages",
            "tenant_settings",
            "feature_flags",
            "erp_entity_mappings",
            "erp_material_group_mapping",
            "supplier_categories",
            "catalog_tier_pricing",
            "punchout_sessions",
            "document_versions",
            "auction_rank_snapshots",
            "bid_versions",
            "workflow_events",
            "unmapped_pr_mapping_log",
            "vendor_erp_sync_log",
            "outbox_messages",
            "audit_logs",
        ]
        counts = {}
        for tbl in tables_to_check:
            try:
                res = await db.execute(text(f"SELECT count(*) FROM {tbl}"))  # noqa: S608
                counts[tbl] = res.scalar_one()
            except Exception as e:
                await db.rollback()
                counts[tbl] = f"Error: {e}"

    logger.info("================================================================================")
    logger.info("📊 PLATFORM WORKFLOW SEED SUMMARY REPORT")
    logger.info("================================================================================")
    for tbl, cnt in counts.items():
        logger.info("  %-30s : %s", tbl, cnt)

    elapsed = time.time() - start_time
    logger.info("================================================================================")
    logger.info("✅ FULL SYNCHRONOUS SEEDING COMPLETED SUCCESSFULLY in %.2f seconds!", elapsed)
    logger.info("================================================================================")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run_all_seeds())
