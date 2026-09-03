# SPEC_25_ANALYTICS.md

## Title
Enterprise S2P Procurement Portal — Analytics & Reporting

## Purpose
Define KPI definitions, analytics architecture, materialized views, Superset integration, custom report builder, spend analytics, and compliance reports.

## Scope
Covers analytics architecture (read replica + materialized views), complete SQL for all 11 materialized views, all KPI definitions with formulas, Superset configuration, custom report builder API, spend analytics, compliance reports, and data retention for analytics.

## Dependencies
- SPEC_02_ARCHITECTURE.md (Celery Beat analytics refresh task)
- SPEC_03_DATABASE.md (all entity tables referenced by views)
- SPEC_21_INFRASTRUCTURE.md (PostgreSQL read replica)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. Analytics Architecture

```
Production PostgreSQL (Primary)
    ↓ Streaming Replication
PostgreSQL Read Replica
    ↓ analytics schema
Materialized Views (refreshed every 15 min via Celery Beat)
    ↓
Apache Superset (embedded dashboards)
    ↓
Buyer/Admin/Executive Portals (iframe or API)
```

- All analytics queries run against the read replica — zero impact on production
- `analytics` schema contains all materialized views
- Superset connected to read replica with read-only user

## 2. Materialized View Definitions

### 2.1 `mv_rfq_cycle_time`

```sql
CREATE MATERIALIZED VIEW analytics.mv_rfq_cycle_time AS
SELECT
    r.org_id,
    r.id AS rfq_id,
    r.rfq_number,
    r.rfq_type,
    r.sourcing_type,
    r.category_id,
    c.name AS category_name,
    r.business_unit_id,
    bu.name AS bu_name,
    r.estimated_value,
    r.currency,
    r.status,
    r.created_at,
    r.published_at,
    r.bids_opened_at,
    cs.created_at AS cs_generated_at,
    cs.approved_at AS cs_approved_at,
    arn.approved_at AS award_approved_at,
    EXTRACT(EPOCH FROM (r.published_at - r.created_at)) / 3600 AS hours_to_publish,
    EXTRACT(EPOCH FROM (r.bids_opened_at - r.published_at)) / 3600 AS hours_bid_window,
    EXTRACT(EPOCH FROM (cs.created_at - r.bids_opened_at)) / 3600 AS hours_to_cs,
    EXTRACT(EPOCH FROM (arn.approved_at - r.created_at)) / 86400 AS total_cycle_days
FROM rfqs r
LEFT JOIN categories c ON r.category_id = c.id
LEFT JOIN business_units bu ON r.business_unit_id = bu.id
LEFT JOIN comparative_statements cs ON cs.rfq_id = r.id AND cs.status = 'APPROVED'
LEFT JOIN award_recommendations arn ON arn.rfq_id = r.id AND arn.status = 'APPROVED'
WHERE r.deleted_at IS NULL;
```

### 2.2 `mv_pr_aging_buckets`

```sql
CREATE MATERIALIZED VIEW analytics.mv_pr_aging_buckets AS
SELECT
    r.org_id,
    r.business_unit_id,
    bu.name AS bu_name,
    r.category_id,
    c.name AS category_name,
    COUNT(*) FILTER (WHERE CURRENT_DATE - r.approved_at::date BETWEEN 0 AND 3) AS aging_0_3_days,
    COUNT(*) FILTER (WHERE CURRENT_DATE - r.approved_at::date BETWEEN 4 AND 7) AS aging_4_7_days,
    COUNT(*) FILTER (WHERE CURRENT_DATE - r.approved_at::date BETWEEN 8 AND 14) AS aging_8_14_days,
    COUNT(*) FILTER (WHERE CURRENT_DATE - r.approved_at::date > 14) AS aging_over_14_days,
    SUM(r.estimated_value) FILTER (WHERE CURRENT_DATE - r.approved_at::date > 7) AS value_aging_over_7_days
FROM requisitions r
LEFT JOIN business_units bu ON r.business_unit_id = bu.id
LEFT JOIN categories c ON r.category_id = c.id
WHERE r.status = 'APPROVED' AND r.deleted_at IS NULL
GROUP BY r.org_id, r.business_unit_id, bu.name, r.category_id, c.name;
```

### 2.3 `mv_unmapped_pr_realtime`

```sql
CREATE MATERIALIZED VIEW analytics.mv_unmapped_pr_realtime AS
SELECT
    e.org_id,
    COUNT(*) AS total_pending,
    SUM(r.estimated_value) AS total_pending_value,
    AVG(EXTRACT(EPOCH FROM (COALESCE(e.resolved_at, NOW()) - e.created_at)) / 3600) AS avg_resolution_hours,
    COUNT(*) FILTER (WHERE e.status = 'RESOLVED') AS resolved_count,
    COUNT(*) FILTER (WHERE e.sla_breach_level >= 3) AS sla_breached_count,
    jsonb_agg(DISTINCT jsonb_build_object('field', f->>'field', 'source_value', f->>'source_value'))
        FILTER (WHERE e.status IN ('PENDING', 'ASSIGNED')) AS common_failed_fields
FROM unmapped_pr_exceptions e
JOIN requisitions r ON e.requisition_id = r.id
CROSS JOIN LATERAL jsonb_array_elements(e.failed_fields) AS f
WHERE e.status NOT IN ('RESOLVED', 'MANUAL_INTERVENTION_REQUIRED')
GROUP BY e.org_id;
```

### 2.4 `mv_approval_turnaround`

```sql
CREATE MATERIALIZED VIEW analytics.mv_approval_turnaround AS
SELECT
    wt.org_id,
    wi.entity_type,
    wt.assigned_role,
    COUNT(*) AS total_tasks,
    AVG(EXTRACT(EPOCH FROM (wt.acted_at - wt.created_at)) / 3600) AS avg_turnaround_hours,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (wt.acted_at - wt.created_at)) / 3600) AS p95_turnaround_hours,
    COUNT(*) FILTER (WHERE wt.sla_status IN ('ESCALATED', 'REASSIGNED', 'CRITICAL')) AS sla_breached_count,
    COUNT(*) FILTER (WHERE wt.action = 'FORCE_APPROVE') AS force_approved_count
FROM workflow_tasks wt
JOIN workflow_instances wi ON wt.workflow_instance_id = wi.id
WHERE wt.acted_at IS NOT NULL
GROUP BY wt.org_id, wi.entity_type, wt.assigned_role;
```

### 2.5 `mv_sourcing_savings`

```sql
CREATE MATERIALIZED VIEW analytics.mv_sourcing_savings AS
SELECT
    cs.org_id,
    r.business_unit_id,
    r.category_id,
    c.name AS category_name,
    DATE_TRUNC('month', cs.created_at) AS month,
    COUNT(*) AS cs_count,
    SUM(cs.total_estimated_value) AS total_estimated,
    SUM(cs.l1_total_value) AS total_awarded,
    SUM(cs.total_estimated_value - cs.l1_total_value) AS total_savings,
    AVG(cs.savings_percentage) AS avg_savings_pct
FROM comparative_statements cs
JOIN rfqs r ON cs.rfq_id = r.id
JOIN categories c ON r.category_id = c.id
WHERE cs.status = 'APPROVED' AND cs.l1_total_value IS NOT NULL
GROUP BY cs.org_id, r.business_unit_id, r.category_id, c.name, DATE_TRUNC('month', cs.created_at);
```

### 2.6 `mv_bid_participation_rate`

```sql
CREATE MATERIALIZED VIEW analytics.mv_bid_participation_rate AS
SELECT
    rp.org_id,
    r.id AS rfq_id,
    r.rfq_number,
    r.rfq_type,
    COUNT(*) AS invited_count,
    COUNT(*) FILTER (WHERE rp.invitation_status = 'ACCEPTED') AS accepted_count,
    COUNT(*) FILTER (WHERE br.status = 'SUBMITTED') AS submitted_count,
    ROUND(COUNT(*) FILTER (WHERE br.status = 'SUBMITTED')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) AS participation_rate
FROM rfq_participants rp
JOIN rfqs r ON rp.rfq_id = r.id
LEFT JOIN bid_responses br ON br.rfq_id = r.id AND br.vendor_id = rp.vendor_id AND br.status = 'SUBMITTED'
GROUP BY rp.org_id, r.id, r.rfq_number, r.rfq_type;
```

### 2.7 `mv_supplier_performance_scores`

```sql
CREATE MATERIALIZED VIEW analytics.mv_supplier_performance_scores AS
SELECT
    vs.org_id,
    vs.vendor_id,
    v.company_name,
    v.vendor_code,
    vs.period_start,
    vs.period_end,
    vs.on_time_delivery_rate,
    vs.quality_acceptance_rate,
    vs.commercial_compliance_score,
    vs.responsiveness_score,
    vs.overall_score,
    CASE WHEN vs.overall_score < 60 THEN 'AT_RISK' WHEN vs.overall_score < 80 THEN 'ACCEPTABLE' ELSE 'PREFERRED' END AS performance_tier
FROM vendor_scorecards vs
JOIN vendors v ON vs.vendor_id = v.id
WHERE vs.calculated_at = (SELECT MAX(vs2.calculated_at) FROM vendor_scorecards vs2 WHERE vs2.vendor_id = vs.vendor_id);
```

### 2.8 `mv_contract_utilization`

```sql
CREATE MATERIALIZED VIEW analytics.mv_contract_utilization AS
SELECT
    c.org_id,
    c.id AS contract_id,
    c.contract_number,
    c.vendor_id,
    v.company_name AS vendor_name,
    c.total_value,
    COALESCE(SUM(po.total_value), 0) AS utilized_value,
    ROUND(COALESCE(SUM(po.total_value), 0) / NULLIF(c.total_value, 0) * 100, 2) AS utilization_pct,
    c.start_date,
    c.end_date,
    c.end_date - CURRENT_DATE AS days_remaining,
    c.status
FROM contracts c
JOIN vendors v ON c.vendor_id = v.id
LEFT JOIN purchase_orders po ON po.contract_id = c.id AND po.status NOT IN ('CANCELLED', 'DRAFT')
WHERE c.deleted_at IS NULL
GROUP BY c.org_id, c.id, c.contract_number, c.vendor_id, v.company_name, c.total_value, c.start_date, c.end_date, c.status;
```

### 2.9 `mv_invoice_aging`

```sql
CREATE MATERIALIZED VIEW analytics.mv_invoice_aging AS
SELECT
    i.org_id,
    i.vendor_id,
    v.company_name AS vendor_name,
    COUNT(*) FILTER (WHERE i.payment_status = 'PENDING' AND i.due_date >= CURRENT_DATE) AS current_invoices,
    COUNT(*) FILTER (WHERE i.payment_status = 'PENDING' AND CURRENT_DATE - i.due_date BETWEEN 1 AND 30) AS overdue_1_30,
    COUNT(*) FILTER (WHERE i.payment_status = 'PENDING' AND CURRENT_DATE - i.due_date BETWEEN 31 AND 60) AS overdue_31_60,
    COUNT(*) FILTER (WHERE i.payment_status = 'PENDING' AND CURRENT_DATE - i.due_date > 60) AS overdue_over_60,
    SUM(i.total_amount) FILTER (WHERE i.payment_status = 'PENDING') AS total_outstanding
FROM invoices i
JOIN vendors v ON i.vendor_id = v.id
WHERE i.status IN ('APPROVED', 'POSTED') AND i.deleted_at IS NULL
GROUP BY i.org_id, i.vendor_id, v.company_name;
```

### 2.10 `mv_compliance_exceptions`

```sql
CREATE MATERIALIZED VIEW analytics.mv_compliance_exceptions AS
SELECT
    org_id,
    DATE_TRUNC('week', created_at) AS week,
    COUNT(*) FILTER (WHERE action = 'WORKFLOW_ADMIN_INTERVENTION' AND metadata->>'intervention_type' = 'FORCE_ADVANCE') AS force_approves,
    COUNT(*) FILTER (WHERE entity_type = 'RFQ' AND metadata->>'is_emergency' = 'true') AS emergency_rfqs,
    COUNT(*) FILTER (WHERE entity_type = 'RFQ' AND metadata->>'is_single_vendor' = 'true') AS single_vendor_rfqs,
    COUNT(*) FILTER (WHERE action = 'VENDOR_BLACKLISTED') AS blacklisting_events,
    COUNT(*) FILTER (WHERE action LIKE 'AUTH_%' AND action LIKE '%VIOLATION%') AS sod_violations
FROM audit_logs
GROUP BY org_id, DATE_TRUNC('week', created_at);
```

### 2.11 `mv_approval_bottleneck`

```sql
CREATE MATERIALIZED VIEW analytics.mv_approval_bottleneck AS
SELECT
    wt.org_id,
    wt.assigned_to,
    u.first_name || ' ' || u.last_name AS approver_name,
    wt.assigned_role,
    COUNT(*) FILTER (WHERE wt.status = 'PENDING') AS pending_count,
    AVG(EXTRACT(EPOCH FROM (COALESCE(wt.acted_at, NOW()) - wt.created_at)) / 3600) AS avg_response_hours,
    COUNT(*) FILTER (WHERE wt.sla_status IN ('ESCALATED', 'REASSIGNED', 'CRITICAL')) AS sla_breaches
FROM workflow_tasks wt
JOIN users u ON wt.assigned_to = u.id
WHERE wt.created_at > NOW() - INTERVAL '30 days'
GROUP BY wt.org_id, wt.assigned_to, u.first_name, u.last_name, wt.assigned_role
ORDER BY pending_count DESC;
```

---

## 3. KPI Definitions

| KPI | Formula | Dimensions | Audience | Refresh | Target |
|---|---|---|---|---|---|
| PR-to-PO Cycle Time | `po.created_at - pr.submitted_at` (days) | Category, BU, procurement type | Buyer, SM | 15 min | < 14 days |
| RFQ Cycle Time | `award.approved_at - rfq.created_at` (days) | Category, BU, RFQ type | SM, PH | 15 min | < 21 days |
| Sourcing Savings % | `(estimated_value - l1_value) / estimated_value * 100` | Category, BU, month | PH, CFO | 15 min | > 5% |
| Bid Participation Rate | `submitted_bids / invited_vendors * 100` | RFQ type, category | SM, Buyer | 15 min | > 60% |
| Approval Turnaround (avg) | `AVG(acted_at - created_at)` in hours | Entity type, role | PH, Admin | 15 min | < 24h |
| SLA Breach Rate | `breached_tasks / total_tasks * 100` | Entity type, role | PH, Admin | 15 min | < 5% |
| Unmapped PR Resolution Time | `AVG(resolved_at - created_at)` in hours | Source BU, material group | Admin | 15 min | < 8h |
| Vendor On-Time Delivery | `on_time_deliveries / total_deliveries * 100` | Vendor, category | Buyer, Cat Mgr | Quarterly | > 90% |
| Invoice Match Rate | `matched_invoices / total_invoices * 100` | Vendor, category | FC | 15 min | > 95% |
| Contract Utilization | `utilized_value / total_value * 100` | Vendor, category | Buyer, SM | 15 min | > 70% |
| Invoice Aging (>60 days) | Count + value of invoices overdue >60 days | Vendor | FC | 15 min | < 5% of total |

---

## 4. Superset Configuration

- **Datasource:** PostgreSQL read replica, connection with SSL, read-only user `analytics_reader`
- **Custom SQL datasets:** One per materialized view
- **Dashboard templates:** Buyer Dashboard, Supplier Dashboard, Admin Dashboard, Executive Dashboard
- **Embedding:** Superset guest token API for embedding dashboards in portal iframes
- **Row-level security:** Superset RLS rules filter by `org_id` based on logged-in user's organization

## 5. Custom Report Builder

```
POST /api/v1/analytics/reports
Permission: analytics.create_reports

Request body:
{
  "name": "Monthly Category Spend",
  "dimensions": ["category_name", "month"],
  "metrics": ["total_po_value", "total_invoice_value", "savings_pct"],
  "filters": [
    {"field": "business_unit_id", "operator": "eq", "value": "uuid"},
    {"field": "month", "operator": "gte", "value": "2026-01-01"}
  ],
  "sort": [{"field": "total_po_value", "direction": "desc"}],
  "schedule": {"frequency": "WEEKLY", "day": "MONDAY", "time": "08:00", "format": "XLSX"}
}
```

**Execution:** Generates SQL from config → executes against read replica with 30s timeout → paginates results → optionally schedules recurring export via Celery.

**Export formats:** XLSX (Excel), CSV

## 6. Spend Analytics

- Total spend by category, BU, plant, time period
- Spend breakdown by supplier (Pareto analysis — top 20% suppliers covering 80% spend)
- CAPEX vs OPEX split
- Budget vs actual comparison (cost center level)
- Trend charts (monthly, quarterly, YoY)
- Maverick spend identification (POs created without RFQ/contract)

## 7. Compliance Reports

| Report | Frequency | Content |
|---|---|---|
| Emergency RFQ Log | Weekly | All emergency RFQs: number, justification, approver, cycle time |
| Single-Vendor Justification Log | Weekly | All single-vendor RFQs with justification text, supporting docs |
| Force-Approve Log | Monthly | All admin force-advance actions with reason, entity, actor |
| Blacklisting Events | Monthly | All blacklisting events with vendor, reason, dual approvers |
| SoD Violations Attempted | Daily | All maker-checker violations attempted (blocked by system) |
| Unmapped PR SLA Breaches | Weekly | All unmapped PRs that breached SLA, resolution time, root cause |

## 8. Data Retention for Analytics

- **Anonymized aggregated data:** Retained indefinitely
- **Raw transactional data:** Per retention policy (SPEC_01 Section 4.5)
- **Personal data (user names):** Redacted from analytics exports by default; full data available only to users with `audit.view_all` permission
