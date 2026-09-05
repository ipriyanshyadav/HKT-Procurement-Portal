"""Unit tests for SPEC_22 Observability, Metrics, Dashboards, and Audit Search."""

import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.core.metrics import (
    audit_log_last_insert_timestamp,
    bid_submitted_total,
    celery_workers_active,
    dlq_message_count,
    get_metric_value,
    http_request_duration_seconds,
    http_requests_total,
    integration_job_failures_total,
    outbox_messages_pending,
    pg_stat_activity_count,
    po_value_total,
    pr_approval_duration_hours,
    pr_created_total,
    rfq_processing_duration,
    rfq_published_total,
    unmapped_pr_pending_count,
    vendor_compliance_holds,
    workflow_sla_breaches_total,
    workflow_tasks_pending,
)
from app.main import app
from app.modules.audit.models import AuditLog
from app.modules.audit.search_service import AuditSearchQuery, AuditSearchService
from app.modules.audit.service import AuditService

ROOT_DIR = Path(__file__).resolve().parent.parent.parent


def test_custom_metrics_registered():
    """Verify that all 12 custom metrics specified in SPEC_22 are defined."""
    assert http_requests_total is not None
    assert http_request_duration_seconds is not None
    assert pr_created_total is not None
    assert pr_approval_duration_hours is not None
    assert rfq_published_total is not None
    assert bid_submitted_total is not None
    assert po_value_total is not None
    assert workflow_tasks_pending is not None
    assert workflow_sla_breaches_total is not None
    assert outbox_messages_pending is not None
    assert dlq_message_count is not None
    assert integration_job_failures_total is not None
    assert vendor_compliance_holds is not None
    assert unmapped_pr_pending_count is not None
    assert audit_log_last_insert_timestamp is not None
    assert pg_stat_activity_count is not None
    assert rfq_processing_duration is not None


def test_business_metrics_increments():
    """Verify that business metric counters and gauges function correctly."""
    test_org = str(uuid4())
    test_bu = str(uuid4())

    # 1. PR created counter
    initial_pr = get_metric_value("pr_created_total", org_id=test_org, bu_id=test_bu)
    pr_created_total.labels(org_id=test_org, bu_id=test_bu).inc()
    assert get_metric_value("pr_created_total", org_id=test_org, bu_id=test_bu) == initial_pr + 1.0

    # 2. RFQ published counter
    initial_rfq = get_metric_value("rfq_published_total", org_id=test_org, rfq_type="STANDARD")
    rfq_published_total.labels(org_id=test_org, rfq_type="STANDARD").inc()
    assert get_metric_value("rfq_published_total", org_id=test_org, rfq_type="STANDARD") == initial_rfq + 1.0

    # 3. Bid submitted counter
    initial_bid = get_metric_value("bid_submitted_total", org_id=test_org)
    bid_submitted_total.labels(org_id=test_org).inc()
    assert get_metric_value("bid_submitted_total", org_id=test_org) == initial_bid + 1.0

    # 4. PO value counter
    initial_po = get_metric_value("po_value_total", org_id=test_org, currency="INR")
    po_value_total.labels(org_id=test_org, currency="INR").inc(50000.0)
    assert get_metric_value("po_value_total", org_id=test_org, currency="INR") == initial_po + 50000.0

    # 5. Workflow tasks pending gauge
    workflow_tasks_pending.labels(org_id=test_org, step_name="FinanceApproval").set(5)
    assert get_metric_value("workflow_tasks_pending", org_id=test_org, step_name="FinanceApproval") == 5.0
    workflow_tasks_pending.labels(org_id=test_org, step_name="FinanceApproval").dec()
    assert get_metric_value("workflow_tasks_pending", org_id=test_org, step_name="FinanceApproval") == 4.0

    # 6. Workflow SLA breaches counter
    initial_sla = get_metric_value("workflow_sla_breaches_total", org_id=test_org, entity_type="WORKFLOW_TASK")
    workflow_sla_breaches_total.labels(org_id=test_org, entity_type="WORKFLOW_TASK").inc()
    assert get_metric_value("workflow_sla_breaches_total", org_id=test_org, entity_type="WORKFLOW_TASK") == initial_sla + 1.0

    # 7. Outbox and DLQ gauges
    outbox_messages_pending.set(42)
    assert get_metric_value("outbox_messages_pending") == 42.0
    dlq_message_count.labels(queue_name="critical").set(3)
    assert get_metric_value("dlq_message_count", queue_name="critical") == 3.0


def test_timing_middleware_and_metrics_endpoint():
    """Verify that TimingMiddleware instruments endpoints and /metrics returns Prometheus text format."""
    client = TestClient(app)

    # Query health check
    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert "X-Process-Time" in res_health.headers

    # Query metrics endpoint
    res_metrics = client.get("/metrics")
    assert res_metrics.status_code == 200
    content = res_metrics.text
    assert "http_requests_total" in content
    assert "http_request_duration_seconds" in content
    assert "pr_created_total" in content
    assert "rfq_published_total" in content
    assert "bid_submitted_total" in content
    assert "po_value_total" in content


@pytest.mark.asyncio
async def test_audit_search_service_indexing_and_search():
    """Verify that AuditSearchService indexes to monthly index and builds ES queries."""
    service = AuditSearchService()
    mock_es = AsyncMock()
    service._es = mock_es

    org_id = uuid4()
    log = AuditLog(
        id=uuid4(),
        org_id=org_id,
        entity_type="REQUISITION",
        entity_id=uuid4(),
        action="CREATE",
        actor_id=uuid4(),
        actor_email="buyer@enterprise.com",
        actor_ip="10.0.0.1",
        created_at=datetime(2026, 9, 5, 12, 0, 0, tzinfo=timezone.utc),
        field_changes={"title": "New IT Hardware"},
        metadata_={"browser": "Chrome"},
        trace_id="00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    )

    await service.index_audit_log(log)

    mock_es.index.assert_called_once()
    call_kwargs = mock_es.index.call_args.kwargs
    assert call_kwargs["index"] == "audit-logs-2026.09"
    assert call_kwargs["id"] == str(log.id)
    doc = call_kwargs["document"]
    assert doc["org_id"] == str(org_id)
    assert doc["action"] == "CREATE"
    assert doc["actor_email"] == "buyer@enterprise.com"

    # Test Search Query Building
    mock_es.search.return_value = {
        "hits": {
            "total": {"value": 1},
            "hits": [{"_source": doc}],
        }
    }

    query = AuditSearchQuery(
        entity_type="REQUISITION",
        action="CREATE",
        search="hardware",
        page=1,
        page_size=10,
    )
    search_res = await service.search(org_id=org_id, query=query)
    assert search_res["total"] == 1
    assert search_res["items"][0]["action"] == "CREATE"

    search_call_kwargs = mock_es.search.call_args.kwargs
    assert search_call_kwargs["index"] == "audit-logs-*"
    body = search_call_kwargs["body"]
    assert "bool" in body["query"]
    must_clauses = body["query"]["bool"]["must"]
    assert any("org_id" in str(c) for c in must_clauses)
    assert any("REQUISITION" in str(c) for c in must_clauses)


def test_prometheus_alert_rules_15_rules():
    """Verify that k8s/monitoring/prometheus/rules.yaml contains ALL 15 alert rules."""
    rules_file = ROOT_DIR / "k8s" / "monitoring" / "prometheus" / "rules.yaml"
    assert rules_file.exists(), "rules.yaml does not exist"
    content = rules_file.read_text()

    expected_rules = [
        "HighErrorRate",
        "HighAPILatency",
        "SlowP99",
        "DLQDepthHigh",
        "OutboxMessagesPending",
        "WorkflowSLABreachRate",
        "IntegrationJobFailureRate",
        "DeadMansSwitch",
        "DatabaseConnectionPoolExhausted",
        "VendorComplianceHoldsHigh",
        "RabbitMQQueueDepth",
        "RedisMemoryHigh",
        "CeleryWorkerDown",
        "MinIODiskUsageHigh",
        "AuditLogIngestionLag",
    ]

    for rule in expected_rules:
        assert f"alert: {rule}" in content, f"Missing expected alert rule: {rule}"

    # Verify severity distribution
    assert "severity: critical" in content
    assert "severity: warning" in content
    assert "severity: none" in content


def test_alertmanager_routing_config():
    """Verify that alertmanager routes CRITICAL->PagerDuty, WARNING->OpsGenie, and DeadMansSwitch->null."""
    config_file = ROOT_DIR / "k8s" / "monitoring" / "alertmanager" / "config.yaml"
    assert config_file.exists(), "alertmanager config.yaml does not exist"
    content = config_file.read_text()

    assert "pagerduty-critical" in content
    assert "opsgenie-warning" in content
    assert "DeadMansSwitch" in content
    assert "receiver: 'null'" in content
    assert "severity: critical" in content
    assert "severity: warning" in content


def test_promtail_logging_configuration():
    """Verify that promtail config parses JSON and drops /health check logs."""
    promtail_file = ROOT_DIR / "k8s" / "logging" / "promtail-config.yaml"
    assert promtail_file.exists(), "promtail-config.yaml does not exist"
    content = promtail_file.read_text()

    assert "http://loki.logging.svc.cluster.local:3100/loki/api/v1/push" in content
    assert "drop:" in content
    assert "'.*\"/health\".*'" in content
    assert "'.*\"/health/live\".*'" in content
    assert "'.*\"/health/ready\".*'" in content
    assert "trace_id" in content


def test_grafana_7_dashboards_valid_json():
    """Verify that all 7 Grafana dashboards exist, are valid JSON, and have panels."""
    dashboards_dir = ROOT_DIR / "k8s" / "monitoring" / "grafana" / "dashboards"
    expected_dashboards = [
        "app-overview.json",
        "procurement-kpis.json",
        "database.json",
        "infrastructure.json",
        "queue-depth.json",
        "slo.json",
        "security.json",
    ]

    for fname in expected_dashboards:
        path = dashboards_dir / fname
        assert path.exists(), f"Dashboard {fname} does not exist"
        data = json.loads(path.read_text())
        assert "uid" in data
        assert "title" in data
        assert "panels" in data
        assert len(data["panels"]) >= 4, f"Dashboard {fname} has insufficient panels"


def test_elasticsearch_ilm_policy_and_template():
    """Verify that elasticsearch ILM policy specifies monthly rollover and 365d retention."""
    ilm_file = ROOT_DIR / "k8s" / "base" / "elasticsearch" / "ilm-policy.yaml"
    assert ilm_file.exists(), "ilm-policy.yaml does not exist"
    content = ilm_file.read_text()

    assert "audit-logs-ilm-policy" in content
    assert "30d" in content
    assert "365d" in content
    assert "audit-logs-*" in content
    assert "elasticsearch-ilm-setup" in content


def test_audit_log_timezone_and_asyncpg_compilation():
    """Verify that Base.type_annotation_map and AuditLog enforce DateTime(timezone=True) for asyncpg compatibility."""
    from sqlalchemy.dialects.postgresql.asyncpg import PGDialect_asyncpg
    from sqlalchemy.sql import insert
    from app.db.base import Base

    # Verify column type on AuditLog table
    assert AuditLog.__table__.c.created_at.type.timezone is True

    # Verify compilation for asyncpg binds $2 with TIMESTAMP WITH TIME ZONE
    stmt = insert(AuditLog)
    compiled = stmt.compile(dialect=PGDialect_asyncpg())
    compiled_str = str(compiled)
    assert "TIMESTAMP WITH TIME ZONE" in compiled_str
    assert "TIMESTAMP WITHOUT TIME ZONE" not in compiled_str


@pytest.mark.asyncio
async def test_audit_search_service_circuit_breaker_and_disabled():
    """Verify that AuditSearchService gracefully handles disabled state, connection errors, and cooldown."""
    # 1. Disabled state
    service_disabled = AuditSearchService(enabled=False)
    assert not service_disabled.is_enabled
    assert not service_disabled.is_available
    assert service_disabled.es is None
    res = await service_disabled.search(org_id=uuid4(), query=AuditSearchQuery())
    assert res["source"] == "empty"
    assert res["total"] == 0

    # 2. Connection failure trips circuit breaker
    service = AuditSearchService(es_url="http://invalid-host-for-test:9200", enabled=True)
    mock_failing_client = AsyncMock()
    mock_failing_client.index.side_effect = Exception("Connection refused")
    service._es = mock_failing_client

    log = AuditLog(
        id=uuid4(),
        org_id=uuid4(),
        entity_type="ORGANIZATION",
        entity_id=uuid4(),
        action="TEST_BREAKER",
        created_at=datetime.now(timezone.utc),
    )
    await service.index_audit_log(log)
    assert not service.is_available
    assert service.es is None

    # Subsequent call does not call mock_failing_client because circuit is open
    mock_failing_client.index.reset_mock()
    await service.index_audit_log(log)
    mock_failing_client.index.assert_not_called()

    # Search with open circuit falls back
    fallback_res = await service.search(org_id=uuid4(), query=AuditSearchQuery())
    assert fallback_res["source"] == "empty"

    # 3. Clean close
    mock_close_client = AsyncMock()
    service._es = mock_close_client
    await service.close()
    mock_close_client.close.assert_awaited_once()
    assert service._es is None

