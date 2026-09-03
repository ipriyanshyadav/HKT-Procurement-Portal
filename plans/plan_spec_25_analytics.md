# IMPLEMENTATION PLAN — SPEC_25: Analytics & Reporting
**Module:** 25 | **Phase:** Core | **Squad:** E
**Spec File:** SPEC_25_ANALYTICS.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S25-01 | 8 procurement KPI metrics | analytics/service.py | PLANNED |
| S25-02 | Spend analytics (by category, vendor, BU, period) | analytics/service.py | PLANNED |
| S25-03 | Savings analytics (budgeted vs actual, negotiation savings) | analytics/service.py | PLANNED |
| S25-04 | Vendor performance dashboard | analytics/service.py | PLANNED |
| S25-05 | Cycle time analytics (PR→PO, RFQ→Award) | analytics/service.py | PLANNED |
| S25-06 | SLA compliance report | analytics/service.py | PLANNED |
| S25-07 | Compliance dashboard (vendor docs, contract expiry) | analytics/service.py | PLANNED |
| S25-08 | On-time delivery rate | analytics/service.py | PLANNED |
| S25-09 | Invoice processing analytics | analytics/service.py | PLANNED |
| S25-10 | Cost of capital analysis | analytics/service.py | PLANNED |
| S25-11 | Scheduled report exports (daily/weekly/monthly) | tasks/scheduled_reports.py | PLANNED |
| S25-12 | Ad-hoc report builder | analytics/router.py | PLANNED |
| S25-13 | Dashboard API (pre-aggregated) | analytics/router.py | PLANNED |
| S25-14 | Export: CSV + PDF + Excel | analytics/export_service.py | PLANNED |
| S25-15 | Analytics data refreshed every 15 min (Celery) | tasks/analytics_refresh.py | PLANNED |
| S25-16 | Access control: data scoped by user BU/category | analytics/service.py | PLANNED |
| S25-17 | Unmapped PR analytics | analytics/service.py | PLANNED |

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-25-1 | Analytics queries run on PostgreSQL read replica (not primary); connection string from `settings.ANALYTICS_DATABASE_URL` | Heavy aggregation queries should not block transactional DB | HIGH — performance | Squad E |
| A-25-2 | Pre-aggregated dashboard data cached in Redis with 15-minute TTL; cache key includes org_id + fiscal_year; invalidated by Celery refresh task | SPEC Section 15 15-min refresh | LOW | Squad E |
| A-25-3 | Cost of capital analysis uses `organizations.cost_of_capital_rate` (default 12%); formula: `savings * cost_of_capital_rate * (payment_days / 365)` | SPEC Section 10 cost of capital | MEDIUM | Squad E |
| A-25-4 | Savings = `sum(pr_estimated_value) - sum(po_total_value)` for matched PR→PO pairs; negative savings (cost overrun) shown explicitly | SPEC Section 3 savings calculation | MEDIUM | Squad E |
| A-25-5 | Excel export uses openpyxl; separate from CSV streaming; max 100k rows | SPEC Section 14 Excel export; limit not specified | LOW | Squad E |
| A-25-6 | Analytics data respects user scope: BU-scoped users only see their BU data; PROCUREMENT_HEAD sees org-wide | SPEC Section 16 access control | HIGH — data leak risk | Squad E |

---
## STEP 2 — IMPLEMENT

### 2.1 `app/modules/analytics/service.py`
```python
class AnalyticsService:

    async def get_spend_summary(self, db, org_id: UUID, fiscal_year: str,
                                 user_bu_scope: list[UUID]) -> dict:
        cache_key = f"analytics:spend:{org_id}:{fiscal_year}:{','.join(str(b) for b in sorted(user_bu_scope))}"
        cached = await self.redis.get(cache_key)
        if cached:
            return json.loads(cached)
        # Run on read replica
        async with analytics_session_factory() as analytics_db:
            result = await analytics_db.execute(text("""
                SELECT
                    c.name as category_name,
                    SUM(pol.total_price) as total_spend,
                    COUNT(DISTINCT po.id) as po_count,
                    COUNT(DISTINCT po.vendor_id) as vendor_count,
                    COUNT(DISTINCT pol.id) as line_count
                FROM purchase_orders po
                JOIN po_lines pol ON pol.po_id = po.id AND pol.deleted_at IS NULL
                JOIN categories c ON c.id = po.category_id
                WHERE po.org_id = :org_id
                  AND po.status IN ('APPROVED','SENT_TO_VENDOR','VENDOR_ACKNOWLEDGED',
                                    'PARTIALLY_RECEIVED','FULLY_RECEIVED','CLOSED')
                  AND po.deleted_at IS NULL
                  AND EXTRACT(YEAR FROM po.created_at) = :year
                  AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
                GROUP BY c.name
                ORDER BY total_spend DESC
            """), {
                "org_id": org_id, "year": int(fiscal_year[:4]),
                "all_bus": len(user_bu_scope) == 0,
                "bu_scope": [str(b) for b in user_bu_scope] or ["00000000-0000-0000-0000-000000000000"],
            })
        data = [dict(row) for row in result.fetchall()]
        await self.redis.setex(cache_key, 900, json.dumps(data, default=str))  # 15-min TTL
        return data

    async def get_procurement_kpis(self, db, org_id: UUID, fiscal_year: str,
                                    user_bu_scope: list[UUID]) -> dict:
        async with analytics_session_factory() as analytics_db:
            metrics = {}
            # 1. PR to PO Cycle Time (avg days)
            r = await analytics_db.execute(text("""
                SELECT AVG(EXTRACT(EPOCH FROM (po.created_at - pr.created_at))/86400) as avg_days
                FROM purchase_orders po
                JOIN requisitions pr ON pr.id = po.source_pr_id
                WHERE po.org_id = :org_id AND po.deleted_at IS NULL
                  AND (:all_bus OR po.business_unit_id = ANY(:bu_scope))
            """), {"org_id": org_id, "all_bus": not user_bu_scope, "bu_scope": [str(b) for b in user_bu_scope]})
            metrics["pr_to_po_cycle_days"] = round(r.scalar() or 0, 1)

            # 2. Savings %
            r = await analytics_db.execute(text("""
                SELECT
                    SUM(pr.estimated_total) as budgeted,
                    SUM(po.total_value) as actual
                FROM purchase_orders po
                JOIN requisitions pr ON pr.id = po.source_pr_id
                WHERE po.org_id = :org_id AND po.deleted_at IS NULL
            """), {"org_id": org_id})
            row = r.fetchone()
            if row and row.budgeted and row.budgeted > 0:
                savings_pct = ((row.budgeted - row.actual) / row.budgeted) * 100
                metrics["savings_percentage"] = round(savings_pct, 2)
                metrics["savings_amount"] = float(row.budgeted - row.actual)
            else:
                metrics["savings_percentage"] = 0
                metrics["savings_amount"] = 0

            # 3. Vendor compliance rate
            r = await analytics_db.execute(text("""
                SELECT
                    COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
                    COUNT(*) as total
                FROM vendors WHERE org_id = :org_id AND deleted_at IS NULL
            """), {"org_id": org_id})
            row = r.fetchone()
            metrics["vendor_compliance_rate"] = round((row.active / row.total * 100) if row.total > 0 else 0, 1)

            # 4. On-time delivery rate
            r = await analytics_db.execute(text("""
                SELECT
                    COUNT(*) FILTER (WHERE g.created_at <= po.expected_delivery_date) as on_time,
                    COUNT(*) as total
                FROM goods_receipt_notes g
                JOIN purchase_orders po ON po.id = g.po_id
                WHERE g.org_id = :org_id AND g.deleted_at IS NULL
            """), {"org_id": org_id})
            row = r.fetchone()
            metrics["on_time_delivery_rate"] = round((row.on_time / row.total * 100) if row.total > 0 else 0, 1)

            # 5. Invoice processing time (avg days)
            r = await analytics_db.execute(text("""
                SELECT AVG(EXTRACT(EPOCH FROM (p.created_at - i.invoice_date))/86400)
                FROM invoices i JOIN payment_records p ON p.invoice_id = i.id
                WHERE i.org_id = :org_id AND i.deleted_at IS NULL
            """), {"org_id": org_id})
            metrics["invoice_processing_days"] = round(r.scalar() or 0, 1)

            # 6. Cost of capital on savings
            org = await self.org_repo.get(db, org_id)
            coc_rate = float(org.cost_of_capital_rate)
            metrics["cost_of_capital_benefit"] = round(
                metrics["savings_amount"] * coc_rate, 2
            )

        return metrics

    async def get_vendor_performance(self, db, org_id: UUID, vendor_id: UUID) -> dict:
        async with analytics_session_factory() as analytics_db:
            r = await analytics_db.execute(text("""
                SELECT
                    COUNT(DISTINCT po.id) as total_pos,
                    AVG(vs.quality_score) as avg_quality,
                    AVG(vs.delivery_score) as avg_delivery,
                    AVG(vs.price_score) as avg_price,
                    AVG(vs.responsiveness_score) as avg_responsiveness,
                    AVG(vs.compliance_score) as avg_compliance,
                    (AVG(vs.quality_score) * 0.3 +
                     AVG(vs.delivery_score) * 0.25 +
                     AVG(vs.price_score) * 0.2 +
                     AVG(vs.responsiveness_score) * 0.15 +
                     AVG(vs.compliance_score) * 0.1) as composite_score
                FROM vendor_scorecards vs
                LEFT JOIN purchase_orders po ON po.vendor_id = vs.vendor_id
                WHERE vs.org_id = :org_id AND vs.vendor_id = :vendor_id
            """), {"org_id": org_id, "vendor_id": vendor_id})
            return dict(r.fetchone() or {})

    async def get_unmapped_pr_analytics(self, db, org_id: UUID) -> dict:
        async with analytics_session_factory() as analytics_db:
            r = await analytics_db.execute(text("""
                SELECT
                    COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
                    COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved,
                    AVG(resolution_time_hours) FILTER (WHERE status = 'RESOLVED') as avg_resolution_hours,
                    COUNT(*) FILTER (WHERE sla_status IN ('TIER_3', 'TIER_4')) as sla_breach_count
                FROM unmapped_pr_exceptions
                WHERE org_id = :org_id AND deleted_at IS NULL
            """), {"org_id": org_id})
            return dict(r.fetchone() or {})
```

### 2.2 `app/modules/analytics/export_service.py`
```python
class AnalyticsExportService:

    async def export_csv(self, data: list[dict], columns: list[str], filename: str) -> StreamingResponse:
        return stream_csv(columns, data, filename)

    async def export_excel(self, data: list[dict], sheet_name: str, filename: str) -> Response:
        import openpyxl
        from io import BytesIO
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = sheet_name
        if data:
            ws.append(list(data[0].keys()))
            for row in data:
                ws.append([str(v) if not isinstance(v, (int, float, type(None))) else v
                           for v in row.values()])
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return Response(
            content=output.read(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
```

### 2.3 `app/tasks/scheduled_reports.py`
```python
@celery_app.task(queue="celery.maintenance", name="generate_daily_analytics_report")
def generate_daily_analytics_report():
    asyncio.run(_async_generate_daily())

async def _async_generate_daily():
    async with async_session_factory() as db:
        active_orgs = await org_repo.get_all_active(db)
        for org in active_orgs:
            kpis = await analytics_service.get_procurement_kpis(db, org.id, _current_fy())
            spend = await analytics_service.get_spend_summary(db, org.id, _current_fy(), [])
            report = {
                "org_id": str(org.id), "report_date": date.today().isoformat(),
                "kpis": kpis, "spend_summary": spend[:10],  # Top 10 categories
            }
            await publisher.publish("procurement.notification", "notification.email.daily_report",
                {"template_code": "DAILY_ANALYTICS_REPORT", "org_id": str(org.id),
                 "recipient_role": "PROCUREMENT_HEAD", "report_data": report}, org.id)
```

### 2.4 Router (12 endpoints)
```python
@router.get("/dashboard")                  # Pre-aggregated KPI dashboard
@router.get("/spend")                      # Spend by category/vendor/BU
@router.get("/savings")                    # Savings analysis
@router.get("/cycle-times")                # PR→PO, RFQ→Award cycle times
@router.get("/vendor-performance")         # Overall vendor performance
@router.get("/vendor-performance/{id}")    # Single vendor scorecard
@router.get("/sla-compliance")             # Workflow SLA compliance
@router.get("/compliance")                 # Vendor + contract compliance
@router.get("/unmapped-prs")               # Unmapped PR analytics
@router.get("/invoices")                   # Invoice processing analytics
@router.post("/export/csv")                # Ad-hoc CSV export
@router.post("/export/excel")              # Ad-hoc Excel export
```

All endpoints enforce scope: `user_bu_scope` extracted from JWT claims; PROCUREMENT_HEAD/SUPERADMIN get full org scope.

### 2.5 `app/tasks/analytics_refresh.py`
```python
@celery_app.task(queue="celery.maintenance", name="refresh_analytics_cache")
def refresh_analytics_cache():
    """Runs every 15 minutes. Warms Redis cache for all active orgs."""
    asyncio.run(_async_refresh())

async def _async_refresh():
    async with async_session_factory() as db:
        orgs = await org_repo.get_all_active(db)
        fiscal_year = _current_fy()
        for org in orgs:
            # Invalidate and rebuild key caches
            pattern = f"analytics:*:{org.id}:{fiscal_year}:*"
            keys = await redis.keys(pattern)
            if keys:
                await redis.delete(*keys)
            # Warm spend summary (org-wide, no BU filter)
            await analytics_service.get_spend_summary(db, org.id, fiscal_year, [])
```

---
## STEP 3 — TEST

### 3.1 Developer Persona
```python
async def test_kpi_pr_to_po_cycle_time(db, factory):
    """Cycle time calculated correctly from PR.created_at to PO.created_at."""
async def test_spend_scoped_to_bu(db, factory):
    """BU-scoped user only sees their BU spend data."""
async def test_savings_negative_cost_overrun(db, factory):
    """PO value > PR estimate → negative savings shown correctly."""
async def test_cost_of_capital_uses_org_rate(db, factory):
    """Cost of capital uses org.cost_of_capital_rate, not hardcoded 12%."""
async def test_analytics_cached_in_redis(db, factory):
    """Second call returns from Redis; no DB query executed."""
async def test_procurement_head_sees_all_bus(db, factory):
    """PROCUREMENT_HEAD role gets org-wide spend, not filtered."""
async def test_excel_export_correct_columns(db, factory):
    """Excel export file has correct sheet name and column headers."""
```

### 3.2 QA Persona
- Full dashboard loads with real data in < 2 seconds (Prometheus p95)
- Spend data matches manually summed PO line totals (accuracy check)
- Export: 50,000 rows CSV → downloads in < 30 seconds
- Daily report email arrives in supplier mailbox by 07:30 org timezone
- Analytics cache invalidated after new PO created (within 15 min)
- Fiscal year boundary: April 1 data in new FY, March 31 in previous

---
## STEP 5 — GRAPHIFY UPDATE
```bash
graphify update
# Nodes: AnalyticsService (17 methods), ExportService, ScheduledReportsTask,
#        AnalyticsRefreshTask, AnalyticsRouter (12 endpoints)
graphify check --integrity
graphify diff > graphify_diff_$(date +%Y%m%d_%H%M%S).txt
```

---
## STEP 6 — README UPDATE
```markdown
## Current Session State
**Status:** SPEC_25 Analytics COMPLETED — ALL 25 modules planned
**Module Coverage:** 25/25 complete
**Next Action:** Begin SPEC_01 implementation (scaffolding) → SPEC_03 migrations → SPEC_04 auth
**Implementation Priority:** 01 → 03 → 04 → 24 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 25
**Graphify:** All 25 modules documented
```
