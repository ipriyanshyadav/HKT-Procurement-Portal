# IMPLEMENTATION PLAN — SPEC_22: Observability & Monitoring
**Module:** 22 | **Phase:** Foundation | **Squad:** A (DevOps)
**Spec File:** SPEC_22_OBSERVABILITY.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S22-01 | OpenTelemetry traces (Jaeger) | core/telemetry.py (already) | PLANNED |
| S22-02 | Prometheus metrics (12 custom metrics) | core/metrics.py | PLANNED |
| S22-03 | Grafana dashboards (7 dashboards) | k8s/monitoring/grafana/ | PLANNED |
| S22-04 | Loki + Promtail log aggregation | k8s/logging/ | PLANNED |
| S22-05 | Promtail: JSON parse, drop health logs | k8s/logging/promtail-config.yaml | PLANNED |
| S22-06 | Alertmanager: 15 alert rules | k8s/monitoring/alertmanager/ | PLANNED |
| S22-07 | SLO: 99.9% uptime, p95<500ms, p99<1s | Grafana SLO dashboard | PLANNED |
| S22-08 | Elasticsearch for audit log search | elasticsearch/service.py | PLANNED |
| S22-09 | Dead man's switch (Watchdog alert) | alertmanager/rules.yaml | PLANNED |
| S22-10 | PagerDuty / OpsGenie routing | alertmanager/receivers.yaml | PLANNED |
| S22-11 | Business metrics dashboard | Grafana JSON | PLANNED |
| S22-12 | DB query performance (pg_stat_statements) | PostgreSQL + Grafana | PLANNED |
| S22-13 | DLQ depth monitoring | Grafana + alert | PLANNED |
| S22-14 | Celery task metrics | celery/metrics.py | PLANNED |
| S22-15 | Security event dashboard | Grafana | PLANNED |

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-22-1 | Prometheus scrapes FastAPI metrics at `/metrics` endpoint (not behind Kong auth); Kong route for /metrics is IP-allowlisted to monitoring namespace | SPEC specifies Prometheus scraping | LOW | DevOps |
| A-22-2 | Alertmanager routes CRITICAL→PagerDuty, WARNING→OpsGenie; API keys from K3s Secrets | SPEC Section 10 routing | LOW | DevOps |
| A-22-3 | Grafana provisioned dashboards via ConfigMap (not manual UI); file-based provisioning | GitOps requirement | LOW | DevOps |
| A-22-4 | Elasticsearch index: `audit-logs-{YYYY.MM}`; rotated monthly; kept 1 year by ILM policy | SPEC Section 8 audit search | LOW | Squad E |

---
## STEP 2 — IMPLEMENT

### 2.1 `app/core/metrics.py` — Custom Prometheus Metrics
```python
from prometheus_client import Counter, Histogram, Gauge, Info

# API metrics
http_requests_total = Counter(
    "http_requests_total", "Total HTTP requests",
    ["method", "endpoint", "status_code", "org_id"]
)
http_request_duration_seconds = Histogram(
    "http_request_duration_seconds", "HTTP request duration",
    ["method", "endpoint"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
)

# Business metrics
pr_created_total = Counter("pr_created_total", "Total PRs created", ["org_id", "bu_id"])
pr_approval_duration_hours = Histogram(
    "pr_approval_duration_hours", "PR approval cycle time in hours",
    ["org_id"], buckets=[1, 4, 8, 24, 48, 72, 168]
)
rfq_published_total = Counter("rfq_published_total", "Total RFQs published", ["org_id", "rfq_type"])
bid_submitted_total = Counter("bid_submitted_total", "Total bids submitted", ["org_id"])
po_value_total = Counter("po_value_total", "Total PO value created", ["org_id", "currency"])

# SLA metrics
workflow_tasks_pending = Gauge(
    "workflow_tasks_pending", "Current pending workflow tasks",
    ["org_id", "step_name"]
)
workflow_sla_breaches_total = Counter(
    "workflow_sla_breaches_total", "Total SLA breaches",
    ["org_id", "entity_type"]
)

# Infrastructure metrics
outbox_messages_pending = Gauge("outbox_messages_pending", "Pending outbox messages")
dlq_message_count = Gauge("dlq_message_count", "Messages in DLQ", ["queue_name"])
integration_job_failures_total = Counter(
    "integration_job_failures_total", "Failed integration jobs",
    ["job_type", "org_id"]
)
vendor_compliance_holds = Gauge("vendor_compliance_holds", "Vendors on compliance hold", ["org_id"])
```

### 2.2 Metrics Middleware Integration
```python
# In app/core/middleware.py TimingMiddleware:
async def dispatch(self, request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start

    endpoint = request.url.path
    org_id = getattr(request.state, "org_id", "unknown")

    http_requests_total.labels(
        method=request.method,
        endpoint=endpoint,
        status_code=response.status_code,
        org_id=str(org_id)
    ).inc()

    if not endpoint.startswith("/health"):
        http_request_duration_seconds.labels(
            method=request.method, endpoint=endpoint
        ).observe(duration)

    return response
```

### 2.3 `k8s/monitoring/prometheus/rules.yaml` — Alert Rules
```yaml
groups:
- name: procurement.slo
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
    for: 2m
    labels: {severity: critical}
    annotations:
      summary: "Error rate > 1% for 2 minutes"

  - alert: SlowP95
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
    for: 5m
    labels: {severity: warning}
    annotations:
      summary: "P95 latency > 500ms"

  - alert: SlowP99
    expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 1.0
    for: 5m
    labels: {severity: critical}

  - alert: DLQDepthHigh
    expr: dlq_message_count > 50
    for: 5m
    labels: {severity: warning}
    annotations:
      summary: "DLQ depth > 50 messages"

  - alert: OutboxMessagesPending
    expr: outbox_messages_pending > 1000
    for: 10m
    labels: {severity: warning}

  - alert: WorkflowSLABreachRate
    expr: rate(workflow_sla_breaches_total[1h]) > 10
    for: 5m
    labels: {severity: warning}

  - alert: IntegrationJobFailureRate
    expr: rate(integration_job_failures_total[1h]) > 5
    for: 5m
    labels: {severity: critical}

  - alert: DeadMansSwitch
    expr: vector(1)
    for: 0m
    labels: {severity: none}
    annotations:
      summary: "Watchdog: alertmanager is functioning"

  - alert: DatabaseConnectionPoolExhausted
    expr: pg_stat_activity_count > 180  # 90% of max_connections=200
    for: 2m
    labels: {severity: critical}

  - alert: VendorComplianceHoldsHigh
    expr: vendor_compliance_holds > 10
    for: 30m
    labels: {severity: warning}
```

### 2.4 `k8s/logging/promtail-config.yaml`
```yaml
server:
  http_listen_port: 9080

clients:
  - url: http://loki.logging.svc.cluster.local:3100/loki/api/v1/push

scrape_configs:
  - job_name: procurement-api
    static_configs:
      - targets: [localhost]
        labels:
          job: procurement-api
          __path__: /var/log/pods/procurement_procurement-api*/*/*.log
    pipeline_stages:
      - json:
          expressions:
            output: log
            level: level
            trace_id: trace_id
            user_id: user_id
            org_id: org_id
      - drop:
          expression: '.*"/health".*'  # Drop health check logs
      - drop:
          expression: '.*"/health/live".*'
      - drop:
          expression: '.*"/health/ready".*'
      - output:
          source: output
      - labels:
          level:
          trace_id:
```

### 2.5 Elasticsearch Audit Search Service
```python
# app/modules/audit/search_service.py
from elasticsearch import AsyncElasticsearch
from app.config import settings

class AuditSearchService:
    def __init__(self):
        self.es = AsyncElasticsearch(hosts=[settings.ELASTICSEARCH_URL])

    async def index_audit_log(self, log: AuditLog) -> None:
        index = f"audit-logs-{log.created_at.strftime('%Y.%m')}"
        await self.es.index(index=index, id=str(log.id), document={
            "org_id": str(log.org_id),
            "entity_type": log.entity_type,
            "entity_id": str(log.entity_id),
            "action": log.action,
            "actor_id": str(log.actor_id) if log.actor_id else None,
            "actor_email": log.actor_email,
            "created_at": log.created_at.isoformat(),
            "field_changes": log.field_changes,
            "trace_id": log.trace_id,
        })

    async def search(self, org_id: UUID, query: AuditSearchQuery) -> list[dict]:
        must = [{"term": {"org_id": str(org_id)}}]
        if query.entity_type: must.append({"term": {"entity_type": query.entity_type}})
        if query.action: must.append({"term": {"action": query.action}})
        if query.actor_id: must.append({"term": {"actor_id": str(query.actor_id)}})
        if query.date_from or query.date_to:
            range_filter = {}
            if query.date_from: range_filter["gte"] = query.date_from.isoformat()
            if query.date_to: range_filter["lte"] = query.date_to.isoformat()
            must.append({"range": {"created_at": range_filter}})
        result = await self.es.search(
            index="audit-logs-*",
            body={"query": {"bool": {"must": must}},
                  "sort": [{"created_at": {"order": "desc"}}],
                  "from": query.offset, "size": query.limit}
        )
        return [hit["_source"] for hit in result["hits"]["hits"]]
```

---
## STEP 3 — TEST
```python
async def test_health_logs_not_in_loki(log_capture):
    """GET /health/live requests do NOT appear in log stream."""
async def test_prometheus_metrics_endpoint(client):
    resp = await client.get("/metrics")
    assert b"http_requests_total" in resp.content
async def test_pr_created_counter_increments(client, factory):
    pre = await get_metric_value("pr_created_total", org_id=str(test_org_id))
    await create_pr(client)
    post = await get_metric_value("pr_created_total", org_id=str(test_org_id))
    assert post == pre + 1
async def test_audit_log_indexed_to_elasticsearch(db, factory):
    """Creating a vendor indexes to ES within 5 seconds."""
```
