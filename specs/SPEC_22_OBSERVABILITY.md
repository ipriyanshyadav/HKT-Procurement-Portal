# SPEC_22_OBSERVABILITY.md

## Title
Enterprise S2P Procurement Portal — Observability Stack

## Purpose
Define the complete observability stack: Loguru logging, Prometheus metrics, Jaeger tracing, Grafana Alerts, Uptime Kuma, and on-call runbooks.

## Scope
Covers Loguru configuration, trace correlation, Promtail pipeline, Prometheus custom metrics, OpenTelemetry setup, Grafana dashboard definitions, complete alert rule definitions, Uptime Kuma monitors, and runbook templates.

## Dependencies
- SPEC_02_ARCHITECTURE.md (Loguru config, OpenTelemetry setup, Celery Beat schedule)
- SPEC_21_INFRASTRUCTURE.md (observability stack deployment)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. Loguru Configuration

See SPEC_02 Section 12 for base configuration.

**Production JSON format fields:** `timestamp`, `level`, `message`, `module`, `function`, `line`, `trace_id`, `span_id`, `user_id`, `org_id`, `request_id`, `entity_type`, `entity_id`

**Log levels:** Local/Dev: DEBUG, Staging: DEBUG, Production: INFO

## 2. Trace Correlation

Every FastAPI request → OpenTelemetry trace created → `trace_id` injected into Loguru context via `contextvars`. All log lines in that request include `trace_id`. Links log lines to Jaeger spans.

```python
# app/core/middleware.py — LoggingContextMiddleware

class LoggingContextMiddleware:
    async def __call__(self, request, call_next):
        span = trace.get_current_span()
        ctx = span.get_span_context()
        with logger.contextualize(
            trace_id=format(ctx.trace_id, "032x") if ctx.trace_id else "",
            span_id=format(ctx.span_id, "016x") if ctx.span_id else "",
            request_id=request.headers.get("X-Request-ID", ""),
            user_id=getattr(request.state, "user_id", ""),
            org_id=getattr(request.state, "org_id", ""),
        ):
            response = await call_next(request)
        return response
```

## 3. Promtail Configuration

```yaml
# promtail-config.yaml (DaemonSet)
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: kubernetes-pods
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        target_label: app
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod
    pipeline_stages:
      - json:
          expressions:
            level: level
            trace_id: trace_id
            message: message
            module: module
      - labels:
          level:
      - match:
          selector: '{app="procurement-api"}'
          stages:
            - regex:
                expression: 'GET /health'
            - drop:
                source: ""
                expression: 'GET /health.*'
```

## 4. Prometheus Custom Metrics

```python
# Registered via prometheus-fastapi-instrumentator + custom metrics

from prometheus_client import Counter, Histogram, Gauge

rfq_processing_duration = Histogram(
    "rfq_processing_duration_seconds",
    "Time to process RFQ from creation to award",
    ["org_id", "rfq_type"],
    buckets=[3600, 7200, 14400, 28800, 86400, 172800, 604800]  # 1h to 7d
)

bid_submission_total = Counter(
    "bid_submission_total",
    "Total bid submissions",
    ["org_id", "rfq_type"]
)

approval_task_pending_count = Gauge(
    "approval_task_pending_count",
    "Number of pending approval tasks",
    ["org_id", "entity_type", "role"]
)

workflow_sla_breach_total = Counter(
    "workflow_sla_breach_total",
    "Total SLA breaches",
    ["org_id", "entity_type", "breach_level"]
)

integration_job_failure_total = Counter(
    "integration_job_failure_total",
    "Total integration job failures",
    ["org_id", "job_type", "adapter_type"]
)

unmapped_pr_pending_count = Gauge(
    "unmapped_pr_pending_count",
    "Number of pending unmapped PRs",
    ["org_id"]
)
```

## 5. OpenTelemetry Setup

See SPEC_02 Section 11. Key details:
- **Sampling:** 100% in staging, 10% in production (with 100% for errors)
- **Instrumented:** FastAPI, SQLAlchemy, redis-py, httpx, Celery
- **Propagation:** W3C TraceContext via `traceparent` header

## 6. Grafana Dashboard Definitions

### App Overview Dashboard
- **RPS:** `rate(http_requests_total[5m])` by status code
- **Error Rate:** `rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100`
- **Latency p50/p95/p99:** `histogram_quantile(0.xx, rate(http_request_duration_seconds_bucket[5m]))`
- **Active Users:** `count(distinct user_id from recent sessions)`

### Procurement KPIs Dashboard
- **PR Aging Buckets:** Count of APPROVED PRs by days since approval (0-3, 3-7, 7-14, 14+)
- **RFQ Cycle Time:** Average days from RFQ creation to award by category
- **Bid Participation Rate:** `submitted_bids / invited_vendors * 100` by RFQ
- **Unmapped PR Queue Depth:** Real-time count and value

### Database Dashboard
- **Query Time:** p95 from PostgreSQL exporter
- **Active Connections:** PgBouncer `server_active` / `server_total`
- **Lock Waits:** `pg_locks` count by type
- **Index Hit Rate:** `pg_stat_user_indexes`
- **Replication Lag:** Seconds behind master

### Infrastructure Dashboard
- **CPU/Memory/Disk/Network** per K3s node
- **Pod restart count** (last 24h)
- **Node status** (Ready/NotReady)

### Queue Depth Dashboard
- **RabbitMQ per queue:** `rabbitmq_queue_messages` for each queue
- **DLQ depth:** Messages in dead letter queues
- **Consumer count:** Active consumers per queue

### Alerts History Dashboard
- **Firing alerts** timeline
- **MTTR** (mean time to resolve)

## 7. Grafana Alert Rules (Complete)

```yaml
# HighAPILatency
expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="procurement-api"}[5m])) by (le)) > 2
for: 5m
severity: critical
annotations:
  summary: "API p95 latency exceeds 2 seconds"
  runbook_url: "/runbooks/high-api-latency"

# HighErrorRate
expr: sum(rate(http_requests_total{job="procurement-api",status=~"5.."}[5m])) / sum(rate(http_requests_total{job="procurement-api"}[5m])) > 0.01
for: 5m
severity: critical

# DBConnectionPoolExhausted
expr: pgbouncer_pools_server_active{database="procurement"} / pgbouncer_pools_server_total{database="procurement"} > 0.9
for: 2m
severity: critical

# RabbitMQQueueDepth
expr: rabbitmq_queue_messages{vhost="procurement"} > 1000
for: 15m
severity: warning

# RedisMemoryHigh
expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.8
for: 10m
severity: warning

# CeleryWorkerDown
expr: celery_workers_active == 0
for: 2m
severity: critical

# SLABreachAccumulating
expr: increase(workflow_sla_breach_total[1h]) > 10
severity: critical

# MinIODiskUsageHigh
expr: minio_disk_used_bytes / minio_disk_total_bytes > 0.85
for: 10m
severity: warning

# IntegrationJobFailureRate
expr: increase(integration_job_failure_total[30m]) > 5
severity: warning

# VendorComplianceAutoHolds
expr: increase(vendor_compliance_hold_total[1h]) > 3
severity: warning
annotations:
  summary: "Multiple vendors placed on compliance hold — may indicate systemic document expiry issue"

# AuditLogIngestionLag
expr: time() - max(audit_log_last_insert_timestamp) > 60
severity: critical
annotations:
  summary: "Audit log ingestion lag exceeds 60 seconds — audit trigger may be failing"
```

## 8. Uptime Kuma Monitors

| Monitor | URL / Check | Interval | Notification |
|---|---|---|---|
| Buyer Portal | `https://buyer.procurement.example.com` | 60s | Email + SMS (P1) |
| Supplier Portal | `https://supplier.procurement.example.com` | 60s | Email + SMS (P1) |
| Admin Portal | `https://admin.procurement.example.com` | 60s | Email + SMS (P1) |
| API Health | `https://api.procurement.example.com/health/ready` | 30s | Email + SMS (P1) |
| Kong Gateway | `https://kong.procurement.example.com/health` | 30s | Email + SMS (P1) |
| SendGrid API | HTTPS check | 300s | Email |
| MSG91 API | HTTPS check | 300s | Email |
| Digio API | HTTPS check | 300s | Email |
| GST Portal API | HTTPS check | 600s | Email |
| PostgreSQL | TCP port 5432 | 30s | Email + SMS (P1) |
| Redis | TCP port 6379 | 30s | Email |
| RabbitMQ | TCP port 5672 | 30s | Email |
| MinIO | HTTPS health check | 60s | Email |
| Elasticsearch | HTTP port 9200 | 60s | Email |

## 9. On-Call Runbooks

Each Grafana alert links to a runbook with:
1. **Symptom:** What the alert means
2. **Probable Cause:** Top 3 likely causes
3. **Investigation Steps:** Commands and dashboards to check
4. **Remediation Steps:** How to fix
5. **Escalation Path:** Who to contact if unresolved in 30 min
