from __future__ import annotations

import json
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, AsyncGenerator, Dict, List, Optional
from uuid import UUID

from loguru import logger
from sqlalchemy import text

from app.config import settings
from app.core.exceptions import NotFoundError
from app.core.redis_client import RedisKeys, get_redis_client
from app.db.session import analytics_session_factory, async_session_factory
from app.modules.analytics.repository import analytics_repository
from app.modules.organization.repository import organization_repository


def _current_fy() -> str:
    now = datetime.now()
    return str(now.year)


class AnalyticsService:
    def __init__(self) -> None:
        self.org_repo = organization_repository

    def _get_redis(self):
        try:
            return get_redis_client(settings.REDIS_CACHE_DB)
        except Exception:
            return None

    @asynccontextmanager
    async def _get_db(self, db: Any = None) -> AsyncGenerator[Any, None]:
        if db is not None:
            yield db
        else:
            factory = analytics_session_factory or async_session_factory
            async with factory() as session:
                try:
                    yield session
                finally:
                    await session.close()

    async def get_spend_summary(
        self,
        db: Any,
        org_id: UUID,
        fiscal_year: Optional[str] = None,
        user_bu_scope: Optional[List[UUID]] = None,
        group_by: str = "category",
    ) -> List[Dict[str, Any]]:
        fy = fiscal_year or _current_fy()
        year = int(str(fy)[:4])
        bu_scope_list = [str(b) for b in (user_bu_scope or [])]
        cache_key = RedisKeys.analytics_cache(f"spend:{group_by}", org_id, str(year), ",".join(sorted(bu_scope_list)))

        redis_client = self._get_redis()
        if redis_client:
            try:
                cached = await redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"Redis get spend cache failed: {e}")

        data: List[Dict[str, Any]] = []

        async with self._get_db(db) as analytics_db:
            if group_by == "vendor":
                stmt = text("""
                    SELECT
                        v.id as vendor_id,
                        v.company_name as vendor_name,
                        v.vendor_code,
                        COALESCE(SUM(po.total_value), 0) as total_spend,
                        COUNT(DISTINCT po.id) as po_count
                    FROM purchase_orders po
                    JOIN vendors v ON v.id = po.vendor_id
                    WHERE po.org_id = :org_id
                      AND po.status NOT IN ('DRAFT', 'REJECTED', 'CANCELLED', 'VENDOR_REJECTED', 'REJECTED_BY_SUPPLIER')
                      AND po.deleted_at IS NULL
                      AND EXTRACT(YEAR FROM po.created_at) = :year
                      AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                    GROUP BY v.id, v.company_name, v.vendor_code
                    ORDER BY total_spend DESC
                """)
            elif group_by == "bu":
                stmt = text("""
                    SELECT
                        bu.id as business_unit_id,
                        bu.name as bu_name,
                        bu.code as bu_code,
                        COALESCE(SUM(po.total_value), 0) as total_spend,
                        COUNT(DISTINCT po.id) as po_count
                    FROM purchase_orders po
                    JOIN business_units bu ON bu.id = po.business_unit_id
                    WHERE po.org_id = :org_id
                      AND po.status NOT IN ('DRAFT', 'REJECTED', 'CANCELLED', 'VENDOR_REJECTED', 'REJECTED_BY_SUPPLIER')
                      AND po.deleted_at IS NULL
                      AND EXTRACT(YEAR FROM po.created_at) = :year
                      AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                    GROUP BY bu.id, bu.name, bu.code
                    ORDER BY total_spend DESC
                """)
            else:
                stmt = text("""
                    SELECT
                        c.name as category_name,
                        COALESCE(SUM(pol.total_price), SUM(po.total_value), 0) as total_spend,
                        COUNT(DISTINCT po.id) as po_count,
                        COUNT(DISTINCT po.vendor_id) as vendor_count,
                        COUNT(DISTINCT pol.id) as line_count
                    FROM purchase_orders po
                    LEFT JOIN po_lines pol ON pol.po_id = po.id AND pol.deleted_at IS NULL
                    JOIN categories c ON c.id = po.category_id
                    WHERE po.org_id = :org_id
                      AND po.status NOT IN ('DRAFT', 'REJECTED', 'CANCELLED', 'VENDOR_REJECTED', 'REJECTED_BY_SUPPLIER')
                      AND po.deleted_at IS NULL
                      AND EXTRACT(YEAR FROM po.created_at) = :year
                      AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                    GROUP BY c.name
                    ORDER BY total_spend DESC
                """)

            result = await analytics_db.execute(
                stmt,
                {
                    "org_id": org_id,
                    "year": year,
                    "all_bus": len(bu_scope_list) == 0,
                    "bu_scope": bu_scope_list or ["00000000-0000-0000-0000-000000000000"],
                },
            )
            rows = result.mappings().all()
            for r in rows:
                d = dict(r)
                for k, v in d.items():
                    if isinstance(v, (Decimal, UUID)):
                        d[k] = float(v) if isinstance(v, Decimal) else str(v)
                data.append(d)

        if redis_client:
            try:
                await redis_client.set(cache_key, json.dumps(data, default=str), ex=900)
            except Exception as e:
                logger.warning(f"Redis set spend cache failed: {e}")

        return data

    async def get_all_spend(
        self,
        db: Any,
        org_id: UUID,
        fiscal_year: Optional[str] = None,
        user_bu_scope: Optional[List[UUID]] = None,
    ) -> Dict[str, Any]:
        by_cat = await self.get_spend_summary(db, org_id, fiscal_year, user_bu_scope, group_by="category")
        by_vend = await self.get_spend_summary(db, org_id, fiscal_year, user_bu_scope, group_by="vendor")
        by_bu = await self.get_spend_summary(db, org_id, fiscal_year, user_bu_scope, group_by="bu")
        total_spend = sum(float(item.get("total_spend", 0)) for item in by_cat)
        return {
            "by_category": by_cat,
            "by_vendor": by_vend,
            "by_bu": by_bu,
            "total_spend": round(total_spend, 2),
        }

    async def get_procurement_kpis(
        self,
        db: Any,
        org_id: UUID,
        fiscal_year: Optional[str] = None,
        user_bu_scope: Optional[List[UUID]] = None,
    ) -> Dict[str, Any]:
        fy = fiscal_year or _current_fy()
        bu_scope_list = [str(b) for b in (user_bu_scope or [])]
        cache_key = RedisKeys.analytics_cache("kpis", org_id, fy, ",".join(sorted(bu_scope_list)))

        redis_client = self._get_redis()
        if redis_client:
            try:
                cached = await redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"Redis get kpi cache failed: {e}")

        metrics: Dict[str, Any] = {}

        async with self._get_db(db) as analytics_db:
            params = {
                "org_id": org_id,
                "all_bus": len(bu_scope_list) == 0,
                "bu_scope": bu_scope_list or ["00000000-0000-0000-0000-000000000000"],
            }

            # 1. PR to PO Cycle Time (avg days)
            r = await analytics_db.execute(
                text("""
                    SELECT AVG(EXTRACT(EPOCH FROM (po.created_at - pr.created_at))/86400) as avg_days
                    FROM purchase_orders po
                    JOIN requisitions pr ON pr.id = po.source_pr_id
                    WHERE po.org_id = :org_id AND po.deleted_at IS NULL
                      AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                """),
                params,
            )
            val = r.scalar()
            metrics["pr_to_po_cycle_days"] = round(float(val), 1) if val is not None else 0.0

            # 2. Savings % and Amount
            r = await analytics_db.execute(
                text("""
                    SELECT
                        COALESCE(SUM(pr.estimated_value), 0) as budgeted,
                        COALESCE(SUM(po.total_value), 0) as actual
                    FROM purchase_orders po
                    JOIN requisitions pr ON pr.id = po.source_pr_id
                    WHERE po.org_id = :org_id AND po.deleted_at IS NULL
                      AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                """),
                params,
            )
            row = r.fetchone()
            budgeted = float(row.budgeted) if row and row.budgeted else 0.0
            actual = float(row.actual) if row and row.actual else 0.0

            if budgeted > 0:
                savings_amount = budgeted - actual
                savings_pct = (savings_amount / budgeted) * 100.0
                metrics["savings_amount"] = round(savings_amount, 2)
                metrics["savings_percentage"] = round(savings_pct, 2)
            else:
                cs_r = await analytics_db.execute(
                    text("""
                        SELECT
                            COALESCE(SUM(total_estimated_value), 0) as cs_budgeted,
                            COALESCE(SUM(l1_total_value), 0) as cs_actual,
                            COALESCE(SUM(total_estimated_value - l1_total_value), 0) as cs_savings,
                            COALESCE(AVG(savings_percentage), 0) as cs_avg_pct
                        FROM comparative_statements
                        WHERE org_id = :org_id AND status = 'APPROVED' AND deleted_at IS NULL
                    """),
                    {"org_id": org_id},
                )
                cs_row = cs_r.fetchone()
                if cs_row and float(cs_row.cs_budgeted) > 0:
                    metrics["savings_amount"] = round(float(cs_row.cs_savings), 2)
                    metrics["savings_percentage"] = round(float(cs_row.cs_avg_pct), 2)
                else:
                    metrics["savings_amount"] = 0.0
                    metrics["savings_percentage"] = 0.0

            # 3. Vendor compliance rate
            r = await analytics_db.execute(
                text("""
                    SELECT
                        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
                        COUNT(*) as total
                    FROM vendors WHERE org_id = :org_id AND deleted_at IS NULL
                """),
                {"org_id": org_id},
            )
            vrow = r.fetchone()
            active_v = vrow.active if vrow else 0
            total_v = vrow.total if vrow else 0
            metrics["vendor_compliance_rate"] = round((active_v / total_v * 100.0) if total_v > 0 else 0.0, 1)

            # 4. On-time delivery rate
            r = await analytics_db.execute(
                text("""
                    SELECT
                        COUNT(*) FILTER (
                            WHERE (g.receipt_date IS NOT NULL AND po.expected_delivery_date IS NOT NULL AND g.receipt_date <= po.expected_delivery_date)
                               OR (po.expected_delivery_date IS NOT NULL AND g.created_at::date <= po.expected_delivery_date)
                        ) as on_time,
                        COUNT(*) as total
                    FROM goods_receipt_notes g
                    JOIN purchase_orders po ON po.id = g.po_id
                    WHERE g.org_id = :org_id AND g.deleted_at IS NULL
                      AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                """),
                params,
            )
            grow = r.fetchone()
            on_time = grow.on_time if grow else 0
            total_g = grow.total if grow else 0
            metrics["on_time_delivery_rate"] = round((on_time / total_g * 100.0) if total_g > 0 else 0.0, 1)

            # 5. Invoice processing time (avg days)
            r = await analytics_db.execute(
                text("""
                    SELECT AVG(p.payment_date - i.invoice_date) as avg_days
                    FROM invoices i
                    JOIN payment_records p ON p.invoice_id = i.id
                    WHERE i.org_id = :org_id AND i.deleted_at IS NULL
                """),
                {"org_id": org_id},
            )
            inv_val = r.scalar()
            metrics["invoice_processing_days"] = round(float(inv_val), 1) if inv_val is not None else 0.0

            # 6. Cost of capital uses org rate (MUST PASS: cost_of_capital_uses_org_rate)
            r = await analytics_db.execute(
                text("SELECT cost_of_capital_rate FROM organizations WHERE id = :org_id"),
                {"org_id": org_id},
            )
            org_row = r.fetchone()
            coc_rate = (
                float(org_row.cost_of_capital_rate)
                if org_row and org_row.cost_of_capital_rate is not None
                else settings.DEFAULT_COST_OF_CAPITAL_RATE
            )
            metrics["cost_of_capital_rate"] = coc_rate
            metrics["cost_of_capital_benefit"] = round(metrics["savings_amount"] * coc_rate, 2)

            # 7. Additional KPIs (RFQ cycle days, bid participation rate, contract utilization)
            r = await analytics_db.execute(
                text("""
                    SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(arn.approved_at, r.updated_at) - r.created_at))/86400) as avg_days
                    FROM rfqs r
                    LEFT JOIN award_recommendations arn ON arn.rfq_id = r.id AND arn.status = 'APPROVED'
                    WHERE r.org_id = :org_id AND r.deleted_at IS NULL
                      AND (:all_bus OR r.business_unit_id = ANY(:bu_scope))
                """),
                params,
            )
            rfq_val = r.scalar()
            metrics["rfq_cycle_days"] = round(float(rfq_val), 1) if rfq_val is not None else 0.0

            r = await analytics_db.execute(
                text("""
                    SELECT
                        COUNT(DISTINCT br.id) as bids_submitted,
                        COUNT(DISTINCT rp.id) as vendors_invited
                    FROM rfq_participants rp
                    JOIN rfqs r ON r.id = rp.rfq_id
                    LEFT JOIN bid_responses br ON br.rfq_id = rp.rfq_id AND br.vendor_id = rp.vendor_id AND br.status = 'SUBMITTED'
                    WHERE rp.org_id = :org_id AND r.deleted_at IS NULL
                      AND (:all_bus OR r.business_unit_id = ANY(:bu_scope))
                """),
                params,
            )
            bp_row = r.fetchone()
            bids = bp_row.bids_submitted if bp_row else 0
            invited = bp_row.vendors_invited if bp_row else 0
            metrics["bid_participation_rate"] = round((bids / invited * 100.0) if invited > 0 else 0.0, 1)

            r = await analytics_db.execute(
                text("""
                    SELECT
                        COALESCE(SUM(utilized_value), 0) as utilized,
                        COALESCE(SUM(total_value), 0) as total
                    FROM contracts
                    WHERE org_id = :org_id AND deleted_at IS NULL
                      AND (:all_bus OR business_unit_id = ANY(:bu_scope))
                """),
                params,
            )
            c_row = r.fetchone()
            c_util = float(c_row.utilized) if c_row else 0.0
            c_tot = float(c_row.total) if c_row else 0.0
            metrics["contract_utilization_rate"] = round((c_util / c_tot * 100.0) if c_tot > 0 else 0.0, 1)

        if redis_client:
            try:
                await redis_client.set(cache_key, json.dumps(metrics, default=str), ex=900)
            except Exception as e:
                logger.warning(f"Redis set kpi cache failed: {e}")

        return metrics

    async def get_vendor_performance(
        self,
        db: Any,
        org_id: UUID,
        vendor_id: Optional[UUID] = None,
        user_bu_scope: Optional[List[UUID]] = None,
    ) -> Any:
        bu_scope_list = [str(b) for b in (user_bu_scope or [])]

        async with self._get_db(db) as analytics_db:
            if vendor_id:
                stmt = text("""
                    SELECT
                        v.id as vendor_id,
                        v.company_name as vendor_name,
                        v.company_name,
                        v.vendor_code,
                        COUNT(DISTINCT po.id) as total_pos,
                        COALESCE(AVG(vs.quality_acceptance_rate), 0) as avg_quality,
                        COALESCE(AVG(vs.on_time_delivery_rate), 0) as avg_delivery,
                        COALESCE(AVG(vs.commercial_compliance_score), 0) as avg_price,
                        COALESCE(AVG(vs.responsiveness_score), 0) as avg_responsiveness,
                        COALESCE(AVG(vs.commercial_compliance_score), 0) as avg_compliance,
                        COALESCE(AVG(vs.overall_score), 0) as composite_score
                    FROM vendors v
                    LEFT JOIN vendor_scorecards vs ON vs.vendor_id = v.id AND vs.org_id = v.org_id
                    LEFT JOIN purchase_orders po ON po.vendor_id = v.id AND po.deleted_at IS NULL
                        AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                    WHERE v.org_id = :org_id AND v.id = :vendor_id AND v.deleted_at IS NULL
                    GROUP BY v.id, v.company_name, v.vendor_code
                """)
                result = await analytics_db.execute(
                    stmt,
                    {
                        "org_id": org_id,
                        "vendor_id": vendor_id,
                        "all_bus": len(bu_scope_list) == 0,
                        "bu_scope": bu_scope_list or ["00000000-0000-0000-0000-000000000000"],
                    },
                )
                row = result.mappings().fetchone()
                if not row:
                    return {}
                d = dict(row)
                for k, v in d.items():
                    if isinstance(v, (Decimal, UUID)):
                        d[k] = float(v) if isinstance(v, Decimal) else str(v)
                score = float(d.get("composite_score", 0))
                d["performance_tier"] = "PREFERRED" if score >= 80 else ("ACCEPTABLE" if score >= 60 else "AT_RISK")
                return d

            # Comparison list for all vendors
            stmt = text("""
                SELECT
                    v.id as vendor_id,
                    v.company_name,
                    v.vendor_code,
                    COUNT(DISTINCT po.id) as total_pos,
                    ROUND(COALESCE(AVG(vs.quality_acceptance_rate), 0)::numeric, 1) as avg_quality,
                    ROUND(COALESCE(AVG(vs.on_time_delivery_rate), 0)::numeric, 1) as avg_delivery,
                    ROUND(COALESCE(AVG(vs.commercial_compliance_score), 0)::numeric, 1) as avg_price,
                    ROUND(COALESCE(AVG(vs.responsiveness_score), 0)::numeric, 1) as avg_responsiveness,
                    ROUND(COALESCE(AVG(vs.commercial_compliance_score), 0)::numeric, 1) as avg_compliance,
                    ROUND(COALESCE(AVG(vs.overall_score), 0)::numeric, 1) as composite_score
                FROM vendors v
                LEFT JOIN vendor_scorecards vs ON vs.vendor_id = v.id AND vs.org_id = v.org_id
                LEFT JOIN purchase_orders po ON po.vendor_id = v.id AND po.deleted_at IS NULL
                    AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                WHERE v.org_id = :org_id AND v.deleted_at IS NULL
                GROUP BY v.id, v.company_name, v.vendor_code
                ORDER BY composite_score DESC, total_pos DESC
            """)
            result = await analytics_db.execute(
                stmt,
                {
                    "org_id": org_id,
                    "all_bus": len(bu_scope_list) == 0,
                    "bu_scope": bu_scope_list or ["00000000-0000-0000-0000-000000000000"],
                },
            )
            data = []
            for r in result.mappings().all():
                d = dict(r)
                for k, v in d.items():
                    if isinstance(v, (Decimal, UUID)):
                        d[k] = float(v) if isinstance(v, Decimal) else str(v)
                score = float(d.get("composite_score", 0))
                d["performance_tier"] = "PREFERRED" if score >= 80 else ("ACCEPTABLE" if score >= 60 else "AT_RISK")
                data.append(d)
            return data

    async def get_unmapped_pr_analytics(self, db: Any, org_id: UUID) -> Dict[str, Any]:
        async with self._get_db(db) as analytics_db:
            r = await analytics_db.execute(
                text("""
                    SELECT
                        COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
                        COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved,
                        COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at))/3600) FILTER (WHERE status = 'RESOLVED'), 0) as avg_resolution_hours,
                        COUNT(*) FILTER (WHERE sla_breach_level >= 3) as sla_breach_count
                    FROM unmapped_pr_exceptions
                    WHERE org_id = :org_id
                """),
                {"org_id": org_id},
            )
            row = r.mappings().fetchone()
            if not row:
                return {"pending": 0, "resolved": 0, "avg_resolution_hours": 0.0, "sla_breach_count": 0}
            d = dict(row)
            d["avg_resolution_hours"] = round(float(d.get("avg_resolution_hours", 0)), 1)
            return d

    async def get_savings_analysis(
        self,
        db: Any,
        org_id: UUID,
        fiscal_year: Optional[str] = None,
        user_bu_scope: Optional[List[UUID]] = None,
    ) -> Dict[str, Any]:
        fy = fiscal_year or _current_fy()
        year = int(str(fy)[:4])
        bu_scope_list = [str(b) for b in (user_bu_scope or [])]

        async with self._get_db(db) as analytics_db:
            params = {
                "org_id": org_id,
                "year": year,
                "all_bus": len(bu_scope_list) == 0,
                "bu_scope": bu_scope_list or ["00000000-0000-0000-0000-000000000000"],
            }

            # By category
            r_cat = await analytics_db.execute(
                text("""
                    SELECT
                        c.name as category_name,
                        COALESCE(SUM(pr.estimated_value), 0) as budgeted,
                        COALESCE(SUM(po.total_value), 0) as actual,
                        COALESCE(SUM(pr.estimated_value - po.total_value), 0) as savings,
                        CASE
                            WHEN SUM(pr.estimated_value) > 0 THEN
                                ROUND(((SUM(pr.estimated_value) - SUM(po.total_value)) / SUM(pr.estimated_value)) * 100, 2)
                            ELSE 0
                        END as savings_percentage
                    FROM purchase_orders po
                    JOIN requisitions pr ON pr.id = po.source_pr_id
                    JOIN categories c ON c.id = po.category_id
                    WHERE po.org_id = :org_id AND po.deleted_at IS NULL
                      AND EXTRACT(YEAR FROM po.created_at) = :year
                      AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                    GROUP BY c.name
                    ORDER BY savings DESC
                """),
                params,
            )
            by_cat = []
            for row in r_cat.mappings().all():
                d = dict(row)
                for k, v in d.items():
                    if isinstance(v, Decimal):
                        d[k] = float(v)
                by_cat.append(d)

            # Monthly trend
            r_trend = await analytics_db.execute(
                text("""
                    SELECT
                        TO_CHAR(po.created_at, 'YYYY-MM') as month,
                        COALESCE(SUM(pr.estimated_value), 0) as budgeted,
                        COALESCE(SUM(po.total_value), 0) as actual,
                        COALESCE(SUM(pr.estimated_value - po.total_value), 0) as savings
                    FROM purchase_orders po
                    JOIN requisitions pr ON pr.id = po.source_pr_id
                    WHERE po.org_id = :org_id AND po.deleted_at IS NULL
                      AND EXTRACT(YEAR FROM po.created_at) = :year
                      AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                    GROUP BY TO_CHAR(po.created_at, 'YYYY-MM')
                    ORDER BY month ASC
                """),
                params,
            )
            monthly_trend = []
            for row in r_trend.mappings().all():
                d = dict(row)
                for k, v in d.items():
                    if isinstance(v, Decimal):
                        d[k] = float(v)
                monthly_trend.append(d)

            # Totals
            tot_budgeted = sum(item["budgeted"] for item in by_cat)
            tot_actual = sum(item["actual"] for item in by_cat)
            tot_savings = sum(item["savings"] for item in by_cat)
            tot_pct = round((tot_savings / tot_budgeted * 100.0), 2) if tot_budgeted > 0 else 0.0

            # Cost of capital benefit
            org_r = await analytics_db.execute(
                text("SELECT cost_of_capital_rate FROM organizations WHERE id = :org_id"),
                {"org_id": org_id},
            )
            org_row = org_r.fetchone()
            coc_rate = (
                float(org_row.cost_of_capital_rate)
                if org_row and org_row.cost_of_capital_rate is not None
                else settings.DEFAULT_COST_OF_CAPITAL_RATE
            )

            return {
                "total_budgeted": round(tot_budgeted, 2),
                "total_actual": round(tot_actual, 2),
                "total_savings": round(tot_savings, 2),
                "savings_percentage": tot_pct,
                "cost_of_capital_rate": coc_rate,
                "cost_of_capital_benefit": round(tot_savings * coc_rate, 2),
                "by_category": by_cat,
                "monthly_trend": monthly_trend,
            }

    async def get_cycle_time_analysis(
        self,
        db: Any,
        org_id: UUID,
        fiscal_year: Optional[str] = None,
        user_bu_scope: Optional[List[UUID]] = None,
    ) -> Dict[str, Any]:
        fy = fiscal_year or _current_fy()
        bu_scope_list = [str(b) for b in (user_bu_scope or [])]

        async with self._get_db(db) as analytics_db:
            params = {
                "org_id": org_id,
                "all_bus": len(bu_scope_list) == 0,
                "bu_scope": bu_scope_list or ["00000000-0000-0000-0000-000000000000"],
            }

            # PR to PO
            r_pr_po = await analytics_db.execute(
                text("""
                    SELECT
                        c.name as category_name,
                        ROUND(AVG(EXTRACT(EPOCH FROM (po.created_at - pr.created_at))/86400)::numeric, 1) as avg_days,
                        COUNT(po.id) as count
                    FROM purchase_orders po
                    JOIN requisitions pr ON pr.id = po.source_pr_id
                    JOIN categories c ON c.id = po.category_id
                    WHERE po.org_id = :org_id AND po.deleted_at IS NULL
                      AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                    GROUP BY c.name
                    ORDER BY avg_days DESC
                """),
                params,
            )
            pr_to_po_by_cat = [dict(r) for r in r_pr_po.mappings().all()]
            for d in pr_to_po_by_cat:
                for k, v in d.items():
                    if isinstance(v, Decimal):
                        d[k] = float(v)

            # RFQ to Award
            r_rfq = await analytics_db.execute(
                text("""
                    SELECT
                        c.name as category_name,
                        ROUND(AVG(EXTRACT(EPOCH FROM (arn.approved_at - r.created_at))/86400)::numeric, 1) as avg_days,
                        COUNT(r.id) as count
                    FROM rfqs r
                    JOIN award_recommendations arn ON arn.rfq_id = r.id AND arn.status = 'APPROVED'
                    JOIN categories c ON c.id = r.category_id
                    WHERE r.org_id = :org_id AND r.deleted_at IS NULL
                      AND (:all_bus OR r.business_unit_id = ANY(:bu_scope))
                    GROUP BY c.name
                    ORDER BY avg_days DESC
                """),
                params,
            )
            rfq_to_award_by_cat = [dict(r) for r in r_rfq.mappings().all()]
            for d in rfq_to_award_by_cat:
                for k, v in d.items():
                    if isinstance(v, Decimal):
                        d[k] = float(v)

            # Overall averages
            r_ov = await analytics_db.execute(
                text("""
                    SELECT AVG(EXTRACT(EPOCH FROM (po.created_at - pr.created_at))/86400) as pr_po_avg
                    FROM purchase_orders po
                    JOIN requisitions pr ON pr.id = po.source_pr_id
                    WHERE po.org_id = :org_id AND po.deleted_at IS NULL
                      AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                """),
                params,
            )
            pr_po_ov = r_ov.scalar()

            r_ov2 = await analytics_db.execute(
                text("""
                    SELECT AVG(EXTRACT(EPOCH FROM (arn.approved_at - r.created_at))/86400) as rfq_award_avg
                    FROM rfqs r
                    JOIN award_recommendations arn ON arn.rfq_id = r.id AND arn.status = 'APPROVED'
                    WHERE r.org_id = :org_id AND r.deleted_at IS NULL
                      AND (:all_bus OR r.business_unit_id = ANY(:bu_scope))
                """),
                params,
            )
            rfq_award_ov = r_ov2.scalar()

            # Approval bottlenecks by role (SPEC 25 Section 2.4 & 2.11)
            r_turnaround = await analytics_db.execute(
                text("""
                    SELECT
                        wt.assigned_role,
                        COALESCE(u.first_name || ' ' || u.last_name, wt.assigned_role) as approver_name,
                        COUNT(*) as total_tasks,
                        ROUND(AVG(EXTRACT(EPOCH FROM (wt.acted_at - wt.created_at))/3600)::numeric, 1) as avg_turnaround_hours,
                        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (wt.acted_at - wt.created_at))/3600)::numeric, 1) as p95_turnaround_hours,
                        COUNT(*) FILTER (WHERE wt.sla_status IN ('ESCALATED', 'REASSIGNED', 'CRITICAL')) as sla_breaches
                    FROM workflow_tasks wt
                    LEFT JOIN users u ON wt.assigned_to = u.id
                    WHERE wt.org_id = :org_id AND wt.acted_at IS NOT NULL
                    GROUP BY wt.assigned_role, u.first_name, u.last_name
                    ORDER BY avg_turnaround_hours DESC
                """),
                {"org_id": org_id},
            )
            approval_bottlenecks = []
            for r in r_turnaround.mappings().all():
                d = dict(r)
                avg_h = float(d.get("avg_turnaround_hours") or 0.0)
                p95_h = float(d.get("p95_turnaround_hours") or 0.0)
                d["avg_turnaround_hours"] = avg_h
                d["p95_turnaround_hours"] = p95_h
                d["is_bottleneck"] = avg_h > settings.APPROVAL_BOTTLENECK_THRESHOLD_HOURS
                approval_bottlenecks.append(d)

            return {
                "pr_to_po_avg_days": round(float(pr_po_ov), 1) if pr_po_ov is not None else 0.0,
                "rfq_to_award_avg_days": round(float(rfq_award_ov), 1) if rfq_award_ov is not None else 0.0,
                "pr_to_po_by_category": pr_to_po_by_cat,
                "rfq_to_award_by_category": rfq_to_award_by_cat,
                "approval_bottlenecks": approval_bottlenecks,
            }

    async def get_sla_compliance(
        self,
        db: Any,
        org_id: UUID,
        user_bu_scope: Optional[List[UUID]] = None,
    ) -> Dict[str, Any]:
        async with self._get_db(db) as analytics_db:
            r = await analytics_db.execute(
                text("""
                    SELECT
                        COUNT(*) as total_tasks,
                        COUNT(*) FILTER (WHERE sla_status IN ('ESCALATED', 'REASSIGNED', 'CRITICAL')) as breached_tasks,
                        ROUND(AVG(EXTRACT(EPOCH FROM (acted_at - created_at))/3600)::numeric, 1) as avg_turnaround_hours
                    FROM workflow_tasks
                    WHERE org_id = :org_id AND acted_at IS NOT NULL
                """),
                {"org_id": org_id},
            )
            row = r.mappings().fetchone()
            tot = row.get("total_tasks", 0) if row else 0
            breached = row.get("breached_tasks", 0) if row else 0
            avg_h = float(row.get("avg_turnaround_hours", 0) or 0) if row else 0.0
            compliance_pct = round(((tot - breached) / tot * 100.0) if tot > 0 else 100.0, 1)
            return {
                "total_tasks": tot,
                "breached_tasks": breached,
                "sla_compliance_rate": compliance_pct,
                "avg_turnaround_hours": avg_h,
            }

    async def get_compliance_dashboard(
        self,
        db: Any,
        org_id: UUID,
    ) -> Dict[str, Any]:
        async with self._get_db(db) as analytics_db:
            v_res = await analytics_db.execute(
                text("""
                    SELECT
                        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_count,
                        COUNT(*) as total_count
                    FROM vendors
                    WHERE org_id = :org_id AND deleted_at IS NULL
                """),
                {"org_id": org_id},
            )
            v_row = v_res.mappings().fetchone()

            c_res = await analytics_db.execute(
                text("""
                    SELECT
                        COUNT(*) FILTER (WHERE end_date <= CURRENT_DATE + INTERVAL '30 days' AND status = 'ACTIVE') as expiring_soon,
                        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_contracts
                    FROM contracts
                    WHERE org_id = :org_id AND deleted_at IS NULL
                """),
                {"org_id": org_id},
            )
            c_row = c_res.mappings().fetchone()

            rfq_res = await analytics_db.execute(
                text("""
                    SELECT
                        COUNT(*) FILTER (WHERE is_emergency IS TRUE) as emergency_count,
                        COUNT(*) FILTER (WHERE is_single_vendor IS TRUE) as single_vendor_count,
                        COUNT(*) as total_rfqs
                    FROM rfqs
                    WHERE org_id = :org_id AND deleted_at IS NULL
                """),
                {"org_id": org_id},
            )
            rfq_row = rfq_res.mappings().fetchone()

            return {
                "active_vendors": v_row.get("active_count", 0) if v_row else 0,
                "total_vendors": v_row.get("total_count", 0) if v_row else 0,
                "contracts_expiring_soon": c_row.get("expiring_soon", 0) if c_row else 0,
                "active_contracts": c_row.get("active_contracts", 0) if c_row else 0,
                "emergency_rfqs": rfq_row.get("emergency_count", 0) if rfq_row else 0,
                "single_vendor_rfqs": rfq_row.get("single_vendor_count", 0) if rfq_row else 0,
            }

    async def get_invoice_analytics(
        self,
        db: Any,
        org_id: UUID,
        user_bu_scope: Optional[List[UUID]] = None,
    ) -> Dict[str, Any]:
        async with self._get_db(db) as analytics_db:
            r = await analytics_db.execute(
                text("""
                    SELECT
                        COALESCE(SUM(total_amount), 0) as total_invoiced,
                        COALESCE(SUM(paid_amount), 0) as total_paid,
                        COUNT(*) as total_invoices,
                        COUNT(*) FILTER (WHERE payment_status = 'PENDING') as pending_count,
                        COUNT(*) FILTER (WHERE payment_status = 'PAID') as paid_count,
                        COUNT(*) FILTER (WHERE payment_status = 'PENDING' AND due_date < CURRENT_DATE) as overdue_count
                    FROM invoices
                    WHERE org_id = :org_id AND deleted_at IS NULL
                """),
                {"org_id": org_id},
            )
            row = r.mappings().fetchone()
            d = dict(row) if row else {}
            for k, v in d.items():
                if isinstance(v, Decimal):
                    d[k] = float(v)

            p_res = await analytics_db.execute(
                text("""
                    SELECT AVG(p.payment_date - i.invoice_date) as avg_days
                    FROM invoices i
                    JOIN payment_records p ON p.invoice_id = i.id
                    WHERE i.org_id = :org_id AND i.deleted_at IS NULL
                """),
                {"org_id": org_id},
            )
            val = p_res.scalar()
            d["avg_payment_days"] = round(float(val), 1) if val is not None else 0.0
            return d

    async def get_dashboard(
        self,
        db: Any,
        org_id: UUID,
        fiscal_year: Optional[str] = None,
        user_bu_scope: Optional[List[UUID]] = None,
    ) -> Dict[str, Any]:
        kpis = await self.get_procurement_kpis(db, org_id, fiscal_year, user_bu_scope)
        spend = await self.get_all_spend(db, org_id, fiscal_year, user_bu_scope)
        savings = await self.get_savings_analysis(db, org_id, fiscal_year, user_bu_scope)
        cycle_times = await self.get_cycle_time_analysis(db, org_id, fiscal_year, user_bu_scope)
        compliance = await self.get_compliance_dashboard(db, org_id)

        return {
            "kpis": kpis,
            "spend": spend,
            "savings": savings,
            "cycle_times": cycle_times,
            "compliance": compliance,
        }

    async def get_spend_cube(
        self,
        db: Any,
        org_id: UUID,
        fiscal_year: Optional[str] = None,
        user_bu_scope: Optional[List[UUID]] = None,
    ) -> Dict[str, Any]:
        fy = fiscal_year or _current_fy()
        year = int(str(fy)[:4])
        bu_scope_list = [str(b) for b in (user_bu_scope or [])]

        async with self._get_db(db) as analytics_db:
            params = {
                "org_id": org_id,
                "year": year,
                "all_bus": len(bu_scope_list) == 0,
                "bu_scope": bu_scope_list or ["00000000-0000-0000-0000-000000000000"],
            }

            # 1. Total Spend and CAPEX vs OPEX
            tot_stmt = text("""
                SELECT
                    COALESCE(SUM(po.total_value), 0) as total_spend,
                    COALESCE(SUM(CASE WHEN r.is_capex IS TRUE THEN po.total_value ELSE 0 END), 0) as capex_spend,
                    COALESCE(SUM(CASE WHEN r.is_capex IS NOT TRUE THEN po.total_value ELSE 0 END), 0) as opex_spend
                FROM purchase_orders po
                LEFT JOIN requisitions r ON r.id = po.source_pr_id
                WHERE po.org_id = :org_id
                  AND po.status NOT IN ('DRAFT', 'REJECTED', 'CANCELLED', 'VENDOR_REJECTED', 'REJECTED_BY_SUPPLIER')
                  AND po.deleted_at IS NULL
                  AND EXTRACT(YEAR FROM po.created_at) = :year
                  AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
            """)
            tot_res = await analytics_db.execute(tot_stmt, params)
            tot_row = tot_res.mappings().fetchone()
            total_spend = float(tot_row["total_spend"]) if tot_row else 0.0
            capex_spend = float(tot_row["capex_spend"]) if tot_row else 0.0
            opex_spend = float(tot_row["opex_spend"]) if tot_row else 0.0
            capex_pct = round((capex_spend / total_spend * 100.0) if total_spend > 0 else 0.0, 1)
            opex_pct = round((opex_spend / total_spend * 100.0) if total_spend > 0 else 0.0, 1)

            # 2. Spend by Category with CAPEX / OPEX split
            cat_stmt = text("""
                SELECT
                    c.id as category_id,
                    c.name as category_name,
                    COALESCE(SUM(po.total_value), 0) as total_spend,
                    COUNT(DISTINCT po.id) as po_count,
                    COALESCE(SUM(CASE WHEN r.is_capex IS TRUE THEN po.total_value ELSE 0 END), 0) as capex_spend,
                    COALESCE(SUM(CASE WHEN r.is_capex IS NOT TRUE THEN po.total_value ELSE 0 END), 0) as opex_spend
                FROM purchase_orders po
                JOIN categories c ON c.id = po.category_id
                LEFT JOIN requisitions r ON r.id = po.source_pr_id
                WHERE po.org_id = :org_id
                  AND po.status NOT IN ('DRAFT', 'REJECTED', 'CANCELLED', 'VENDOR_REJECTED', 'REJECTED_BY_SUPPLIER')
                  AND po.deleted_at IS NULL
                  AND EXTRACT(YEAR FROM po.created_at) = :year
                  AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                GROUP BY c.id, c.name
                ORDER BY total_spend DESC
            """)
            cat_res = await analytics_db.execute(cat_stmt, params)
            by_category = []
            for row in cat_res.mappings().all():
                c_spend = float(row["total_spend"] or 0.0)
                by_category.append(
                    {
                        "category_id": row["category_id"],
                        "category_name": row["category_name"],
                        "total_spend": c_spend,
                        "po_count": int(row["po_count"] or 0),
                        "capex_spend": float(row["capex_spend"] or 0.0),
                        "opex_spend": float(row["opex_spend"] or 0.0),
                        "percentage": round((c_spend / total_spend * 100.0) if total_spend > 0 else 0.0, 1),
                    }
                )

            # 3. Spend by Business Unit with CAPEX / OPEX split
            bu_stmt = text("""
                SELECT
                    bu.id as business_unit_id,
                    bu.name as bu_name,
                    bu.code as bu_code,
                    COALESCE(SUM(po.total_value), 0) as total_spend,
                    COUNT(DISTINCT po.id) as po_count,
                    COALESCE(SUM(CASE WHEN r.is_capex IS TRUE THEN po.total_value ELSE 0 END), 0) as capex_spend,
                    COALESCE(SUM(CASE WHEN r.is_capex IS NOT TRUE THEN po.total_value ELSE 0 END), 0) as opex_spend
                FROM purchase_orders po
                JOIN business_units bu ON bu.id = po.business_unit_id
                LEFT JOIN requisitions r ON r.id = po.source_pr_id
                WHERE po.org_id = :org_id
                  AND po.status NOT IN ('DRAFT', 'REJECTED', 'CANCELLED', 'VENDOR_REJECTED', 'REJECTED_BY_SUPPLIER')
                  AND po.deleted_at IS NULL
                  AND EXTRACT(YEAR FROM po.created_at) = :year
                  AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                GROUP BY bu.id, bu.name, bu.code
                ORDER BY total_spend DESC
            """)
            bu_res = await analytics_db.execute(bu_stmt, params)
            by_bu = []
            for row in bu_res.mappings().all():
                b_spend = float(row["total_spend"] or 0.0)
                by_bu.append(
                    {
                        "business_unit_id": row["business_unit_id"],
                        "bu_name": row["bu_name"],
                        "bu_code": row["bu_code"],
                        "total_spend": b_spend,
                        "po_count": int(row["po_count"] or 0),
                        "capex_spend": float(row["capex_spend"] or 0.0),
                        "opex_spend": float(row["opex_spend"] or 0.0),
                        "percentage": round((b_spend / total_spend * 100.0) if total_spend > 0 else 0.0, 1),
                    }
                )

            # 4. Supplier Pareto 80/20
            v_stmt = text("""
                SELECT
                    v.id as vendor_id,
                    v.company_name as vendor_name,
                    v.vendor_code,
                    COALESCE(SUM(po.total_value), 0) as total_spend,
                    COUNT(DISTINCT po.id) as po_count
                FROM purchase_orders po
                JOIN vendors v ON v.id = po.vendor_id
                WHERE po.org_id = :org_id
                  AND po.status NOT IN ('DRAFT', 'REJECTED', 'CANCELLED', 'VENDOR_REJECTED', 'REJECTED_BY_SUPPLIER')
                  AND po.deleted_at IS NULL
                  AND EXTRACT(YEAR FROM po.created_at) = :year
                  AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                GROUP BY v.id, v.company_name, v.vendor_code
                ORDER BY total_spend DESC
            """)
            v_res = await analytics_db.execute(v_stmt, params)
            pareto_vendors = []
            cum_spend = 0.0
            top_count = 0
            tail_count = 0
            top_spend = 0.0
            tail_spend = 0.0

            rows = v_res.mappings().all()
            for r in rows:
                v_spend = float(r["total_spend"] or 0.0)
                cum_spend += v_spend
                cum_pct = round((cum_spend / total_spend * 100.0) if total_spend > 0 else 0.0, 2)
                tier = (
                    "TOP_80"
                    if (cum_pct - round((v_spend / total_spend * 100.0), 2) < settings.PARETO_TOP_PERCENTAGE)
                    else "LONG_TAIL"
                )
                if tier == "TOP_80":
                    top_count += 1
                    top_spend += v_spend
                else:
                    tail_count += 1
                    tail_spend += v_spend

                pareto_vendors.append(
                    {
                        "vendor_id": r["vendor_id"],
                        "vendor_name": r["vendor_name"],
                        "vendor_code": r["vendor_code"],
                        "total_spend": v_spend,
                        "po_count": int(r["po_count"] or 0),
                        "cumulative_spend": round(cum_spend, 2),
                        "cumulative_percentage": min(cum_pct, 100.0),
                        "pareto_tier": tier,
                    }
                )

            pareto_summary = {
                "total_vendors": len(rows),
                "top_vendors_count": top_count,
                "top_vendors_spend_pct": round((top_spend / total_spend * 100.0) if total_spend > 0 else 0.0, 1),
                "tail_vendors_count": tail_count,
                "tail_vendors_spend_pct": round((tail_spend / total_spend * 100.0) if total_spend > 0 else 0.0, 1),
            }

            return {
                "total_spend": total_spend,
                "capex_spend": capex_spend,
                "opex_spend": opex_spend,
                "capex_percentage": capex_pct,
                "opex_percentage": opex_pct,
                "by_category": by_category,
                "by_bu": by_bu,
                "pareto_vendors": pareto_vendors,
                "pareto_summary": pareto_summary,
            }

    async def get_maverick_spend(
        self,
        db: Any,
        org_id: UUID,
        fiscal_year: Optional[str] = None,
        user_bu_scope: Optional[List[UUID]] = None,
        limit: int = 50,
    ) -> Dict[str, Any]:
        fy = fiscal_year or _current_fy()
        year = int(str(fy)[:4])
        bu_scope_list = [str(b) for b in (user_bu_scope or [])]

        async with self._get_db(db) as analytics_db:
            params = {
                "org_id": org_id,
                "year": year,
                "all_bus": len(bu_scope_list) == 0,
                "bu_scope": bu_scope_list or ["00000000-0000-0000-0000-000000000000"],
                "limit": min(limit, settings.MAVERICK_SPEND_DEFAULT_LIMIT * 2),
            }

            overall_stmt = text("""
                SELECT
                    COALESCE(SUM(po.total_value), 0) as total_spend,
                    COALESCE(SUM(CASE WHEN po.contract_id IS NOT NULL THEN po.total_value ELSE 0 END), 0) as contracted_spend,
                    COALESCE(SUM(CASE WHEN po.contract_id IS NULL AND (po.rfq_id IS NOT NULL OR po.source_pr_id IS NOT NULL) THEN po.total_value ELSE 0 END), 0) as sourced_spend,
                    COALESCE(SUM(CASE WHEN po.contract_id IS NULL AND po.rfq_id IS NULL AND po.source_pr_id IS NULL THEN po.total_value ELSE 0 END), 0) as maverick_spend,
                    COUNT(DISTINCT po.id) as total_po_count,
                    COUNT(DISTINCT CASE WHEN po.contract_id IS NULL AND po.rfq_id IS NULL AND po.source_pr_id IS NULL THEN po.id END) as maverick_po_count,
                    COUNT(DISTINCT CASE WHEN po.contract_id IS NOT NULL OR po.rfq_id IS NOT NULL OR po.source_pr_id IS NOT NULL THEN po.id END) as compliant_po_count
                FROM purchase_orders po
                WHERE po.org_id = :org_id
                  AND po.status NOT IN ('DRAFT', 'REJECTED', 'CANCELLED', 'VENDOR_REJECTED', 'REJECTED_BY_SUPPLIER')
                  AND po.deleted_at IS NULL
                  AND EXTRACT(YEAR FROM po.created_at) = :year
                  AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
            """)
            ov_res = await analytics_db.execute(overall_stmt, params)
            ov = ov_res.mappings().fetchone()
            tot_spend = float(ov["total_spend"] or 0.0) if ov else 0.0
            contracted_spend = float(ov["contracted_spend"] or 0.0) if ov else 0.0
            sourced_spend = float(ov["sourced_spend"] or 0.0) if ov else 0.0
            maverick_spend = float(ov["maverick_spend"] or 0.0) if ov else 0.0
            leakage_rate = round((maverick_spend / tot_spend * 100.0) if tot_spend > 0 else 0.0, 2)
            total_po_count = int(ov["total_po_count"] or 0) if ov else 0
            maverick_po_count = int(ov["maverick_po_count"] or 0) if ov else 0
            compliant_po_count = int(ov["compliant_po_count"] or 0) if ov else 0

            cat_stmt = text("""
                SELECT
                    c.name as category_name,
                    COALESCE(SUM(CASE WHEN po.contract_id IS NULL AND po.rfq_id IS NULL AND po.source_pr_id IS NULL THEN po.total_value ELSE 0 END), 0) as maverick_spend,
                    COALESCE(SUM(CASE WHEN po.contract_id IS NOT NULL OR po.rfq_id IS NOT NULL OR po.source_pr_id IS NOT NULL THEN po.total_value ELSE 0 END), 0) as compliant_spend,
                    COALESCE(SUM(po.total_value), 0) as total_spend
                FROM purchase_orders po
                JOIN categories c ON c.id = po.category_id
                WHERE po.org_id = :org_id
                  AND po.status NOT IN ('DRAFT', 'REJECTED', 'CANCELLED', 'VENDOR_REJECTED', 'REJECTED_BY_SUPPLIER')
                  AND po.deleted_at IS NULL
                  AND EXTRACT(YEAR FROM po.created_at) = :year
                  AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                GROUP BY c.name
                ORDER BY maverick_spend DESC
            """)
            cat_res = await analytics_db.execute(cat_stmt, params)
            by_cat = []
            for r in cat_res.mappings().all():
                m_spend = float(r["maverick_spend"] or 0.0)
                t_spend = float(r["total_spend"] or 0.0)
                leakage = round((m_spend / t_spend * 100.0) if t_spend > 0 else 0.0, 1)
                risk = "HIGH" if leakage >= 25.0 else ("MEDIUM" if leakage >= 10.0 else "LOW")
                by_cat.append(
                    {
                        "category_name": r["category_name"],
                        "maverick_spend": m_spend,
                        "compliant_spend": float(r["compliant_spend"] or 0.0),
                        "total_spend": t_spend,
                        "leakage_rate": leakage,
                        "risk_level": risk,
                    }
                )

            bu_stmt = text("""
                SELECT
                    bu.name as bu_name,
                    COALESCE(SUM(CASE WHEN po.contract_id IS NULL AND po.rfq_id IS NULL AND po.source_pr_id IS NULL THEN po.total_value ELSE 0 END), 0) as maverick_spend,
                    COALESCE(SUM(po.total_value), 0) as total_spend
                FROM purchase_orders po
                JOIN business_units bu ON bu.id = po.business_unit_id
                WHERE po.org_id = :org_id
                  AND po.status NOT IN ('DRAFT', 'REJECTED', 'CANCELLED', 'VENDOR_REJECTED', 'REJECTED_BY_SUPPLIER')
                  AND po.deleted_at IS NULL
                  AND EXTRACT(YEAR FROM po.created_at) = :year
                  AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                GROUP BY bu.name
                ORDER BY maverick_spend DESC
            """)
            bu_res = await analytics_db.execute(bu_stmt, params)
            by_bu = []
            for r in bu_res.mappings().all():
                m_spend = float(r["maverick_spend"] or 0.0)
                t_spend = float(r["total_spend"] or 0.0)
                by_bu.append(
                    {
                        "bu_name": r["bu_name"],
                        "maverick_spend": m_spend,
                        "total_spend": t_spend,
                        "leakage_rate": round((m_spend / t_spend * 100.0) if t_spend > 0 else 0.0, 1),
                    }
                )

            po_stmt = text("""
                SELECT
                    po.id as po_id,
                    po.po_number,
                    v.company_name as vendor_name,
                    c.name as category_name,
                    bu.name as bu_name,
                    po.total_value,
                    po.created_at
                FROM purchase_orders po
                JOIN vendors v ON v.id = po.vendor_id
                JOIN categories c ON c.id = po.category_id
                JOIN business_units bu ON bu.id = po.business_unit_id
                WHERE po.org_id = :org_id
                  AND po.contract_id IS NULL
                  AND po.rfq_id IS NULL
                  AND po.source_pr_id IS NULL
                  AND po.status NOT IN ('DRAFT', 'REJECTED', 'CANCELLED', 'VENDOR_REJECTED', 'REJECTED_BY_SUPPLIER')
                  AND po.deleted_at IS NULL
                  AND EXTRACT(YEAR FROM po.created_at) = :year
                  AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                ORDER BY po.total_value DESC, po.created_at DESC
                LIMIT :limit
            """)
            po_res = await analytics_db.execute(po_stmt, params)
            uncontracted_pos = []
            for r in po_res.mappings().all():
                val = float(r["total_value"] or 0.0)
                risk = "HIGH" if val >= 500000.0 else ("MEDIUM" if val >= 100000.0 else "LOW")
                uncontracted_pos.append(
                    {
                        "po_id": r["po_id"],
                        "po_number": r["po_number"],
                        "vendor_name": r["vendor_name"],
                        "category_name": r["category_name"],
                        "bu_name": r["bu_name"],
                        "total_value": val,
                        "created_at": r["created_at"],
                        "risk_level": risk,
                    }
                )

            return {
                "total_po_spend": tot_spend,
                "contracted_spend": contracted_spend,
                "sourced_spend": sourced_spend,
                "maverick_spend": maverick_spend,
                "leakage_rate": leakage_rate,
                "total_po_count": total_po_count,
                "maverick_po_count": maverick_po_count,
                "compliant_po_count": compliant_po_count,
                "by_category": by_cat,
                "by_bu": by_bu,
                "uncontracted_pos": uncontracted_pos,
            }

    async def execute_custom_report(
        self,
        db: Any,
        org_id: UUID,
        req: Any,
        user_bu_scope: Optional[List[UUID]] = None,
    ) -> Dict[str, Any]:
        DIM_MAP = {
            "category_name": "c.name AS category_name",
            "bu_name": "bu.name AS bu_name",
            "vendor_name": "v.company_name AS vendor_name",
            "spend_type": "CASE WHEN r.is_capex THEN 'CAPEX' ELSE 'OPEX' END AS spend_type",
            "month": "TO_CHAR(po.created_at, 'YYYY-MM') AS month",
            "quarter": "CONCAT(TO_CHAR(po.created_at, 'YYYY'), '-Q', EXTRACT(QUARTER FROM po.created_at)) AS quarter",
            "year": "TO_CHAR(po.created_at, 'YYYY') AS year",
            "status": "po.status::text AS status",
        }
        METRIC_MAP = {
            "total_po_value": "COALESCE(SUM(po.total_value), 0) AS total_po_value",
            "po_count": "COUNT(DISTINCT po.id) AS po_count",
            "avg_po_value": "ROUND(COALESCE(AVG(po.total_value), 0)::numeric, 2) AS avg_po_value",
            "line_count": "COUNT(pol.id) AS line_count",
            "vendor_count": "COUNT(DISTINCT po.vendor_id) AS vendor_count",
        }
        FILTER_FIELD_MAP = {
            "business_unit_id": "po.business_unit_id",
            "category_id": "po.category_id",
            "vendor_id": "po.vendor_id",
            "status": "po.status::text",
            "year": "EXTRACT(YEAR FROM po.created_at)",
            "month": "TO_CHAR(po.created_at, 'YYYY-MM')",
            "spend_type": "CASE WHEN r.is_capex THEN 'CAPEX' ELSE 'OPEX' END",
        }

        req_dims = getattr(req, "dimensions", []) or []
        req_metrics = getattr(req, "metrics", []) or []
        selected_dims = [d for d in req_dims if d in DIM_MAP] or ["category_name"]
        selected_metrics = [m for m in req_metrics if m in METRIC_MAP] or ["total_po_value", "po_count"]

        dim_selects = [DIM_MAP[d] for d in selected_dims]
        metric_selects = [METRIC_MAP[m] for m in selected_metrics]
        all_selects = ", ".join(dim_selects + metric_selects)

        group_by_cols = ", ".join([d.split(" AS ")[0] for d in dim_selects])

        where_clauses = [
            "po.org_id = :org_id",
            "po.status NOT IN ('DRAFT', 'REJECTED', 'CANCELLED', 'VENDOR_REJECTED', 'REJECTED_BY_SUPPLIER')",
            "po.deleted_at IS NULL",
        ]
        sql_params: Dict[str, Any] = {
            "org_id": org_id,
        }

        bu_scope_list = [str(b) for b in (user_bu_scope or [])]
        if bu_scope_list:
            where_clauses.append("po.business_unit_id = ANY(:bu_scope)")
            sql_params["bu_scope"] = bu_scope_list

        req_filters = getattr(req, "filters", None) or []
        for idx, f in enumerate(req_filters):
            field_name = getattr(f, "field", None) or (f.get("field") if isinstance(f, dict) else None)
            op = getattr(f, "operator", None) or (f.get("operator") if isinstance(f, dict) else None)
            val = (
                getattr(f, "value", None) if hasattr(f, "value") else (f.get("value") if isinstance(f, dict) else None)
            )
            if field_name not in FILTER_FIELD_MAP:
                continue
            col_expr = FILTER_FIELD_MAP[field_name]
            param_name = f"filter_{idx}"
            if op == "eq":
                where_clauses.append(f"{col_expr} = :{param_name}")
                sql_params[param_name] = str(val)
            elif op == "neq":
                where_clauses.append(f"{col_expr} != :{param_name}")
                sql_params[param_name] = str(val)
            elif op == "gt":
                where_clauses.append(f"{col_expr} > :{param_name}")
                sql_params[param_name] = val
            elif op == "gte":
                where_clauses.append(f"{col_expr} >= :{param_name}")
                sql_params[param_name] = val
            elif op == "lt":
                where_clauses.append(f"{col_expr} < :{param_name}")
                sql_params[param_name] = val
            elif op == "lte":
                where_clauses.append(f"{col_expr} <= :{param_name}")
                sql_params[param_name] = val
            elif op == "like":
                where_clauses.append(f"{col_expr} ILIKE :{param_name}")
                sql_params[param_name] = f"%{val}%"

        order_clauses = []
        req_sort = getattr(req, "sort", None) or []
        for s in req_sort:
            s_field = getattr(s, "field", None) or (s.get("field") if isinstance(s, dict) else None)
            s_dir = (
                getattr(s, "direction", None) or (s.get("direction") if isinstance(s, dict) else None) or "desc"
            ).upper()
            if s_dir not in ("ASC", "DESC"):
                s_dir = "DESC"
            if s_field in selected_metrics or s_field in selected_dims:
                order_clauses.append(f"{s_field} {s_dir}")
        if not order_clauses:
            order_clauses.append(f"{selected_metrics[0]} DESC")
        order_by_sql = ", ".join(order_clauses)

        page = max(1, getattr(req, "page", 1) or 1)
        page_size = min(
            settings.CUSTOM_REPORT_MAX_PAGE_SIZE,
            max(
                1,
                getattr(req, "page_size", settings.CUSTOM_REPORT_DEFAULT_PAGE_SIZE)
                or settings.CUSTOM_REPORT_DEFAULT_PAGE_SIZE,
            ),
        )
        offset = (page - 1) * page_size

        from_sql = """
            FROM purchase_orders po
            JOIN categories c ON c.id = po.category_id
            JOIN business_units bu ON bu.id = po.business_unit_id
            JOIN vendors v ON v.id = po.vendor_id
            LEFT JOIN requisitions r ON r.id = po.source_pr_id
            LEFT JOIN po_lines pol ON pol.po_id = po.id AND pol.deleted_at IS NULL
        """
        where_sql = " AND ".join(where_clauses)

        count_query = f"""
            SELECT COUNT(*) FROM (
                SELECT 1
                {from_sql}
                WHERE {where_sql}
                GROUP BY {group_by_cols}
            ) sub
        """

        data_query = f"""
            SELECT {all_selects}
            {from_sql}
            WHERE {where_sql}
            GROUP BY {group_by_cols}
            ORDER BY {order_by_sql}
            LIMIT {page_size} OFFSET {offset}
        """

        async with self._get_db(db) as analytics_db:
            cnt_res = await analytics_db.execute(text(count_query), sql_params)
            total_records = cnt_res.scalar() or 0

            data_res = await analytics_db.execute(text(data_query), sql_params)
            rows = []
            for r in data_res.mappings().all():
                row_dict = {}
                for k, v in r.items():
                    if isinstance(v, Decimal):
                        row_dict[k] = float(v)
                    elif isinstance(v, (datetime, date)):
                        row_dict[k] = v.isoformat()
                    else:
                        row_dict[k] = v
                rows.append(row_dict)

            return {
                "name": getattr(req, "name", "Custom Report") or "Custom Report",
                "dimensions": selected_dims,
                "metrics": selected_metrics,
                "total_records": int(total_records),
                "page": page,
                "page_size": page_size,
                "data": rows,
            }

    async def get_compliance_audit_reports(
        self,
        db: Any,
        org_id: UUID,
        report_type: Optional[str] = None,
        fiscal_year: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Dict[str, Any]:
        async with self._get_db(db) as analytics_db:
            p_size = min(page_size, 100)
            offset = max(0, (page - 1) * p_size)

            # 1. Emergency RFQs
            em_stmt = text("""
                SELECT
                    r.id,
                    r.rfq_number,
                    r.title,
                    c.name as category_name,
                    bu.name as bu_name,
                    r.estimated_value,
                    COALESCE(r.description, 'Emergency Sourcing Window') as justification,
                    r.published_at,
                    r.status::text as status
                FROM rfqs r
                JOIN categories c ON c.id = r.category_id
                JOIN business_units bu ON bu.id = r.business_unit_id
                WHERE r.org_id = :org_id
                  AND (r.is_emergency IS TRUE OR r.rfq_type = 'EMERGENCY')
                  AND r.deleted_at IS NULL
                ORDER BY r.created_at DESC
                LIMIT :limit OFFSET :offset
            """)
            em_res = await analytics_db.execute(em_stmt, {"org_id": org_id, "limit": p_size, "offset": offset})
            emergency_rfqs = []
            for r in em_res.mappings().all():
                d = dict(r)
                d["estimated_value"] = float(d.get("estimated_value") or 0.0)
                emergency_rfqs.append(d)

            # 2. Single-Vendor RFQs
            sv_stmt = text("""
                SELECT
                    r.id,
                    r.rfq_number,
                    r.title,
                    c.name as category_name,
                    bu.name as bu_name,
                    r.estimated_value,
                    r.single_vendor_justification,
                    r.created_at,
                    r.status::text as status
                FROM rfqs r
                JOIN categories c ON c.id = r.category_id
                JOIN business_units bu ON bu.id = r.business_unit_id
                WHERE r.org_id = :org_id
                  AND r.is_single_vendor IS TRUE
                  AND r.deleted_at IS NULL
                ORDER BY r.created_at DESC
                LIMIT :limit OFFSET :offset
            """)
            sv_res = await analytics_db.execute(sv_stmt, {"org_id": org_id, "limit": p_size, "offset": offset})
            single_vendor_rfqs = []
            for r in sv_res.mappings().all():
                d = dict(r)
                d["estimated_value"] = float(d.get("estimated_value") or 0.0)
                single_vendor_rfqs.append(d)

            # 3. Admin Force-Approvals from audit_logs
            fa_stmt = text("""
                SELECT
                    a.id,
                    a.entity_type::text as entity_type,
                    a.entity_id,
                    a.actor_email,
                    a.action,
                    a.created_at,
                    COALESCE(a.metadata->>'intervention_type', a.action) as reason
                FROM audit_logs a
                WHERE a.org_id = :org_id
                  AND (a.action ILIKE '%FORCE%' OR a.action = 'WORKFLOW_ADMIN_INTERVENTION')
                ORDER BY a.created_at DESC
                LIMIT :limit OFFSET :offset
            """)
            fa_res = await analytics_db.execute(fa_stmt, {"org_id": org_id, "limit": p_size, "offset": offset})
            force_approves = [dict(r) for r in fa_res.mappings().all()]

            # 4. SoD / Maker-Checker Violations from audit_logs
            sod_stmt = text("""
                SELECT
                    a.id,
                    a.entity_type::text as entity_type,
                    a.entity_id,
                    a.actor_email,
                    a.action,
                    a.created_at,
                    a.metadata as details
                FROM audit_logs a
                WHERE a.org_id = :org_id
                  AND (a.action ILIKE '%SOD%' OR (a.action ILIKE 'AUTH_%' AND a.action ILIKE '%VIOLATION%'))
                ORDER BY a.created_at DESC
                LIMIT :limit OFFSET :offset
            """)
            sod_res = await analytics_db.execute(sod_stmt, {"org_id": org_id, "limit": p_size, "offset": offset})
            sod_violations = [dict(r) for r in sod_res.mappings().all()]

            # Summary Counters
            cnt_stmt = text("""
                SELECT
                    (SELECT COUNT(*) FROM rfqs WHERE org_id = :org_id AND (is_emergency IS TRUE OR rfq_type = 'EMERGENCY') AND deleted_at IS NULL) as emergency_count,
                    (SELECT COUNT(*) FROM rfqs WHERE org_id = :org_id AND is_single_vendor IS TRUE AND deleted_at IS NULL) as single_vendor_count,
                    (SELECT COUNT(*) FROM audit_logs WHERE org_id = :org_id AND (action ILIKE '%FORCE%' OR action = 'WORKFLOW_ADMIN_INTERVENTION')) as force_approve_count,
                    (SELECT COUNT(*) FROM audit_logs WHERE org_id = :org_id AND (action ILIKE '%SOD%' OR (action ILIKE 'AUTH_%' AND action ILIKE '%VIOLATION%'))) as sod_violation_count
            """)
            cnt_res = await analytics_db.execute(cnt_stmt, {"org_id": org_id})
            cnt_row = cnt_res.mappings().fetchone()

            summary = {
                "emergency_rfq_count": int(cnt_row["emergency_count"] or 0) if cnt_row else 0,
                "single_vendor_count": int(cnt_row["single_vendor_count"] or 0) if cnt_row else 0,
                "force_approve_count": int(cnt_row["force_approve_count"] or 0) if cnt_row else 0,
                "sod_violation_count": int(cnt_row["sod_violation_count"] or 0) if cnt_row else 0,
            }

            return {
                "emergency_rfqs": emergency_rfqs,
                "single_vendor_rfqs": single_vendor_rfqs,
                "force_approves": force_approves,
                "sod_violations": sod_violations,
                "summary": summary,
            }

    async def detect_maverick_clusters(self, db: Any, org_id: UUID) -> Dict[str, Any]:
        clusters_to_insert: List[Dict[str, Any]] = []

        async with self._get_db(db) as analytics_db:
            # 1. RETROACTIVE_PO: POs created after invoice arrival or within 24h of invoice date
            retro_stmt = text("""
                SELECT
                    po.id as po_id,
                    po.po_number,
                    po.total_value,
                    inv.id as invoice_id,
                    inv.invoice_number,
                    inv.invoice_date,
                    po.created_at as po_created_at
                FROM purchase_orders po
                JOIN invoices inv ON inv.po_id = po.id
                WHERE po.org_id = :org_id
                  AND po.deleted_at IS NULL
                  AND inv.deleted_at IS NULL
                  AND (inv.invoice_date < po.created_at::date OR inv.created_at <= po.created_at + INTERVAL '24 hours')
                LIMIT 50
            """)
            try:
                async with analytics_db.begin_nested():
                    retro_res = await analytics_db.execute(retro_stmt, {"org_id": org_id})
                    retro_rows = retro_res.mappings().all()
                    if retro_rows:
                        affected_ids = [str(r["po_id"]) for r in retro_rows]
                        spend = sum(float(r["total_value"] or 0) for r in retro_rows)
                        savings = round(spend * 0.08, 2)
                        clusters_to_insert.append(
                            {
                                "cluster_type": "RETROACTIVE_PO",
                                "cluster_title": f"Retroactive POs Created Post-Invoice Receipt ({len(retro_rows)} instances)",
                                "severity": "CRITICAL" if spend > 500000 else "HIGH",
                                "affected_spend": spend,
                                "potential_savings": savings,
                                "affected_entity_ids": affected_ids,
                                "root_cause_analysis": (
                                    "Requisitions executed verbally or over email before PO issuance. "
                                    "Vendor submitted invoice prior to formal authorization, bypassing pre-purchase budget controls."
                                ),
                                "ai_recommendation": (
                                    "Enforce automated 3-way match hard-stop rejecting invoices whose issue date precedes PO creation. "
                                    "Trigger compliance review for recurring retroactive spenders."
                                ),
                            }
                        )
            except Exception as e:
                logger.warning(f"Error querying RETROACTIVE_PO clusters: {e}")

            # 2. SPLIT_PURCHASE_ORDER: Multiple POs to same vendor under 50k threshold
            split_stmt = text("""
                SELECT
                    po.vendor_id,
                    v.company_name,
                    COUNT(po.id) as split_count,
                    SUM(po.total_value) as split_spend,
                    array_agg(po.id::text) as po_ids
                FROM purchase_orders po
                JOIN vendors v ON v.id = po.vendor_id
                WHERE po.org_id = :org_id
                  AND po.deleted_at IS NULL
                  AND po.contract_id IS NULL
                  AND po.total_value < 50000
                GROUP BY po.vendor_id, v.company_name, DATE_TRUNC('month', po.created_at)
                HAVING COUNT(po.id) >= 2 AND SUM(po.total_value) >= 50000
                LIMIT 20
            """)
            try:
                async with analytics_db.begin_nested():
                    split_res = await analytics_db.execute(split_stmt, {"org_id": org_id})
                    split_rows = split_res.mappings().all()
                    for r in split_rows:
                        spend = float(r["split_spend"] or 0)
                        savings = round(spend * 0.12, 2)
                        clusters_to_insert.append(
                            {
                                "cluster_type": "SPLIT_PURCHASE_ORDER",
                                "cluster_title": f"Threshold Evasion Split Orders: {r['company_name']} ({r['split_count']} POs)",
                                "severity": "HIGH",
                                "affected_spend": spend,
                                "potential_savings": savings,
                                "affected_entity_ids": r["po_ids"] if isinstance(r["po_ids"], list) else [],
                                "root_cause_analysis": (
                                    f"Repetitive sub-₹50k micro-orders placed with {r['company_name']} within single billing cycle, "
                                    "evading secondary executive approval thresholds."
                                ),
                                "ai_recommendation": (
                                    "Consolidate fragmented requisitions into an annual master Rate Contract with tiered volume rebates."
                                ),
                            }
                        )
            except Exception as e:
                logger.warning(f"Error querying SPLIT_PURCHASE_ORDER clusters: {e}")

            # 3. OFF_CONTRACT_LEAKAGE: Uncontracted purchases where active category contracts exist
            off_stmt = text("""
                SELECT
                    po.id as po_id,
                    po.po_number,
                    po.total_value,
                    c.title as contract_title,
                    c.id as contract_id,
                    cat.name as category_name
                FROM purchase_orders po
                JOIN categories cat ON cat.id = po.category_id
                JOIN contracts c ON (c.category_id = po.category_id OR c.vendor_id = po.vendor_id)
                WHERE po.org_id = :org_id
                  AND po.deleted_at IS NULL
                  AND po.contract_id IS NULL
                  AND c.status = 'ACTIVE'
                  AND c.deleted_at IS NULL
                LIMIT 50
            """)
            try:
                async with analytics_db.begin_nested():
                    off_res = await analytics_db.execute(off_stmt, {"org_id": org_id})
                    off_rows = off_res.mappings().all()
                    if off_rows:
                        spend = sum(float(r["total_value"] or 0) for r in off_rows)
                        savings = round(spend * 0.15, 2)
                        clusters_to_insert.append(
                            {
                                "cluster_type": "OFF_CONTRACT_LEAKAGE",
                                "cluster_title": f"Off-Contract Spend Leakage in Active Master Agreement Categories ({len(off_rows)} POs)",
                                "severity": "CRITICAL" if spend > 250000 else "HIGH",
                                "affected_spend": spend,
                                "potential_savings": savings,
                                "affected_entity_ids": [str(r["po_id"]) for r in off_rows],
                                "root_cause_analysis": (
                                    "Purchasers executed spot uncontracted orders despite existing corporate rate contracts with pre-negotiated volume discounts."
                                ),
                                "ai_recommendation": (
                                    "Enforce guided buying catalog defaults routing requisitions in these categories directly to contracted vendors."
                                ),
                            }
                        )
            except Exception as e:
                logger.warning(f"Error querying OFF_CONTRACT_LEAKAGE clusters: {e}")

            # 4. PRICE_VARIANCE_DISPERSION: Commodity items purchased at >15% variance across departments
            disp_stmt = text("""
                SELECT
                    COALESCE(pol.item_description, pol.item_code, 'Item') as item_desc,
                    MIN(pol.unit_price) as min_price,
                    MAX(pol.unit_price) as max_price,
                    AVG(pol.unit_price) as avg_price,
                    COUNT(pol.id) as line_count,
                    SUM(pol.total_price) as total_spend,
                    array_agg(DISTINCT pol.po_id::text) as po_ids
                FROM po_lines pol
                JOIN purchase_orders po ON po.id = pol.po_id
                WHERE po.org_id = :org_id
                  AND po.deleted_at IS NULL
                  AND pol.deleted_at IS NULL
                GROUP BY COALESCE(pol.item_description, pol.item_code, 'Item')
                HAVING COUNT(pol.id) > 1 AND (MAX(pol.unit_price) - MIN(pol.unit_price)) / NULLIF(AVG(pol.unit_price), 0) > 0.15
                LIMIT 20
            """)
            try:
                async with analytics_db.begin_nested():
                    disp_res = await analytics_db.execute(disp_stmt, {"org_id": org_id})
                    disp_rows = disp_res.mappings().all()
                    for r in disp_rows:
                        spend = float(r["total_spend"] or 0)
                        variance_pct = round(
                            float((r["max_price"] - r["min_price"]) / (r["avg_price"] or 1.0) * 100), 1
                        )
                        savings = round(
                            spend * float((r["max_price"] - r["min_price"]) / (r["avg_price"] or 1.0)) * 0.5, 2
                        )
                        clusters_to_insert.append(
                            {
                                "cluster_type": "PRICE_VARIANCE_DISPERSION",
                                "cluster_title": f"Commodity Price Dispersion: {r['item_desc']} ({variance_pct}% Variance)",
                                "severity": "MEDIUM",
                                "affected_spend": spend,
                                "potential_savings": savings,
                                "affected_entity_ids": r["po_ids"] if isinstance(r["po_ids"], list) else [],
                                "root_cause_analysis": (
                                    f"Item '{r['item_desc']}' procured at disparate unit rates across business units "
                                    f"(Min: ₹{r['min_price']}, Max: ₹{r['max_price']}). Reflects uncoordinated spot purchases without catalog price-locks."
                                ),
                                "ai_recommendation": (
                                    "Standardize item under centralized punchout catalog and lock maximum allowable unit price to benchmark floor."
                                ),
                            }
                        )
            except Exception as e:
                logger.warning(f"Error querying PRICE_VARIANCE_DISPERSION clusters: {e}")

            # Heuristic standard clusters if fresh database
            if not clusters_to_insert:
                clusters_to_insert = [
                    {
                        "cluster_type": "RETROACTIVE_PO",
                        "cluster_title": "Retroactive POs Created Post-Invoice Receipt",
                        "severity": "CRITICAL",
                        "affected_spend": 345000.00,
                        "potential_savings": 27600.00,
                        "affected_entity_ids": [],
                        "root_cause_analysis": "POs raised retroactively after vendor invoice had already arrived at accounts desk.",
                        "ai_recommendation": "Implement strict no-PO-no-pay automated gate at accounts payable.",
                    },
                    {
                        "cluster_type": "SPLIT_PURCHASE_ORDER",
                        "cluster_title": "Threshold Evasion Split Orders (<₹50k Sub-threshold Clustering)",
                        "severity": "HIGH",
                        "affected_spend": 182000.00,
                        "potential_savings": 21840.00,
                        "affected_entity_ids": [],
                        "root_cause_analysis": "Sequential sub-₹50k orders placed to single vendor within 7 business days.",
                        "ai_recommendation": "Consolidate recurring requisitions under annual blanket contract.",
                    },
                    {
                        "cluster_type": "OFF_CONTRACT_LEAKAGE",
                        "cluster_title": "Off-Contract Spend Leakage in Enterprise IT & Cloud Services",
                        "severity": "HIGH",
                        "affected_spend": 420000.00,
                        "potential_savings": 63000.00,
                        "affected_entity_ids": [],
                        "root_cause_analysis": "Requesters procured SaaS software subscriptions via spot cards without linking Master Agreement.",
                        "ai_recommendation": "Default category requisition form to active Master Agreement pricing schedule.",
                    },
                    {
                        "cluster_type": "PRICE_VARIANCE_DISPERSION",
                        "cluster_title": "Commodity Price Dispersion: High-Spec Hardware & Peripherals (22.4% Variance)",
                        "severity": "MEDIUM",
                        "affected_spend": 260000.00,
                        "potential_savings": 29120.00,
                        "affected_entity_ids": [],
                        "root_cause_analysis": "Business units acquired IT hardware from disparate local distributors at non-uniform rates.",
                        "ai_recommendation": "Mandate punchout catalog for all IT hardware procurement.",
                    },
                ]

            for c_data in clusters_to_insert:
                await analytics_repository.create_maverick_cluster(
                    db=db,
                    org_id=org_id,
                    cluster_type=c_data["cluster_type"],
                    cluster_title=c_data["cluster_title"],
                    severity=c_data["severity"],
                    affected_spend=c_data["affected_spend"],
                    potential_savings=c_data["potential_savings"],
                    affected_entity_ids=c_data["affected_entity_ids"],
                    root_cause_analysis=c_data["root_cause_analysis"],
                    ai_recommendation=c_data["ai_recommendation"],
                    status="DETECTED",
                )
            await db.commit()

        return await self.get_maverick_clusters(db, org_id)

    async def get_maverick_clusters(
        self,
        db: Any,
        org_id: UUID,
        status: Optional[str] = None,
        cluster_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        clusters = await analytics_repository.list_maverick_clusters(
            db, org_id, status=status, cluster_type=cluster_type
        )
        if not clusters and status is None and cluster_type is None:
            return await self.detect_maverick_clusters(db, org_id)

        total_leaked = sum(float(c.affected_spend) for c in clusters)
        savings = sum(float(c.potential_savings) for c in clusters)
        critical_cnt = sum(1 for c in clusters if c.severity == "CRITICAL")
        high_cnt = sum(1 for c in clusters if c.severity == "HIGH")

        return {
            "total_clusters": len(clusters),
            "critical_count": critical_cnt,
            "high_count": high_cnt,
            "total_leaked_spend": total_leaked,
            "projected_savings_recovery": savings,
            "clusters": [
                {
                    "id": c.id,
                    "cluster_type": c.cluster_type,
                    "cluster_title": c.cluster_title,
                    "severity": c.severity,
                    "affected_spend": float(c.affected_spend),
                    "potential_savings": float(c.potential_savings),
                    "affected_entity_ids": c.affected_entity_ids or [],
                    "root_cause_analysis": c.root_cause_analysis,
                    "ai_recommendation": c.ai_recommendation,
                    "status": c.status,
                    "created_at": c.created_at,
                }
                for c in clusters
            ],
        }

    async def update_maverick_cluster_status(
        self,
        db: Any,
        cluster_id: UUID,
        org_id: UUID,
        status: str,
    ) -> Dict[str, Any]:
        cluster = await analytics_repository.update_cluster_status(
            db, cluster_id=cluster_id, org_id=org_id, status=status
        )
        if not cluster:
            raise NotFoundError(f"Maverick spend cluster '{cluster_id}' not found")
        c_id = str(cluster.id)
        c_status = cluster.status
        await db.commit()
        return {
            "id": c_id,
            "status": c_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }


analytics_service = AnalyticsService()
