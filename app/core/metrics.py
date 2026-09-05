from __future__ import annotations
from typing import Any, Optional
from prometheus_client import REGISTRY, Counter, Gauge, Histogram

# ==============================================================================
# API Metrics
# ==============================================================================
http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests handled by the platform",
    ["method", "endpoint", "status_code", "org_id"],
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)

# ==============================================================================
# Business Metrics
# ==============================================================================
pr_created_total = Counter(
    "pr_created_total",
    "Total Purchase Requisitions created",
    ["org_id", "bu_id"],
)

pr_approval_duration_hours = Histogram(
    "pr_approval_duration_hours",
    "PR approval cycle time in hours",
    ["org_id"],
    buckets=[1.0, 4.0, 8.0, 24.0, 48.0, 72.0, 168.0],
)

rfq_published_total = Counter(
    "rfq_published_total",
    "Total RFQs published to vendors",
    ["org_id", "rfq_type"],
)

rfq_processing_duration = Histogram(
    "rfq_processing_duration_seconds",
    "Time to process RFQ from creation to award in seconds",
    ["org_id", "rfq_type"],
    buckets=[3600.0, 7200.0, 14400.0, 28800.0, 86400.0, 172800.0, 604800.0],
)

bid_submitted_total = Counter(
    "bid_submitted_total",
    "Total bids submitted by vendors",
    ["org_id"],
)

po_value_total = Counter(
    "po_value_total",
    "Total Purchase Order value created",
    ["org_id", "currency"],
)

# ==============================================================================
# SLA & Governance Metrics
# ==============================================================================
workflow_tasks_pending = Gauge(
    "workflow_tasks_pending",
    "Current count of pending workflow tasks",
    ["org_id", "step_name"],
)

workflow_sla_breaches_total = Counter(
    "workflow_sla_breaches_total",
    "Total workflow SLA breaches recorded",
    ["org_id", "entity_type"],
)

unmapped_pr_pending_count = Gauge(
    "unmapped_pr_pending_count",
    "Number of pending unmapped purchase requisitions",
    ["org_id"],
)

vendor_compliance_holds = Gauge(
    "vendor_compliance_holds",
    "Number of vendors currently placed on compliance hold",
    ["org_id"],
)

# ==============================================================================
# Infrastructure & Integration Metrics
# ==============================================================================
outbox_messages_pending = Gauge(
    "outbox_messages_pending",
    "Number of pending transactional outbox messages awaiting dispatch",
)

dlq_message_count = Gauge(
    "dlq_message_count",
    "Number of dead-letter messages in DLQ",
    ["queue_name"],
)

integration_job_failures_total = Counter(
    "integration_job_failures_total",
    "Total failed external integration jobs",
    ["job_type", "org_id"],
)

audit_log_last_insert_timestamp = Gauge(
    "audit_log_last_insert_timestamp",
    "Epoch timestamp of the most recently inserted audit log",
)

pg_stat_activity_count = Gauge(
    "pg_stat_activity_count",
    "Current active database connection count",
)

celery_workers_active = Gauge(
    "celery_workers_active",
    "Number of active Celery worker instances",
)


def get_metric_value(metric_name: str, **labels: Any) -> float:
    """Helper for testing and programmatic metric verification.
    
    Finds a metric by name in the default collector registry and matches label values.
    """
    valid_metric_names = {metric_name, metric_name.removesuffix("_total")}
    valid_sample_names = {metric_name, f"{metric_name}_total", metric_name.removesuffix("_total")}
    for metric in REGISTRY.collect():
        if metric.name in valid_metric_names:
            for sample in metric.samples:
                if sample.name in valid_sample_names:
                    if not labels:
                        return float(sample.value)
                    if all(str(sample.labels.get(k)) == str(v) for k, v in labels.items()):
                        return float(sample.value)
    return 0.0
