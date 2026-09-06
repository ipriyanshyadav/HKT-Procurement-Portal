"""Unit test coverage for Celery background tasks:
- app/tasks/sla_timers.py
- app/tasks/exchange_rates.py
- app/tasks/analytics_refresh.py
- app/tasks/scheduled_reports.py
- app/tasks/stubs.py
- app/tasks/integration_jobs.py
- app/tasks/auction.py
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.workflow.models import WorkflowTask
from app.tasks.sla_timers import _evaluate_task_sla, _async_check_sla, check_workflow_sla_timers, check_slas
from app.tasks.exchange_rates import _async_refresh as async_refresh_exchange, refresh_exchange_rates
from app.tasks.analytics_refresh import _async_refresh as async_refresh_analytics, refresh_analytics_cache
from app.tasks.scheduled_reports import (
    _async_generate_daily,
    _async_generate_periodic,
    generate_daily_analytics_report,
    generate_weekly_analytics_report,
    generate_monthly_analytics_report,
)
from app.tasks.stubs import (
    stub_collect_metrics,
    stub_take_snapshots,
    stub_refresh_report_cache,
    stub_check_workflow_timeouts,
    stub_check_escalations,
    stub_send_digests,
    stub_check_reminders,
    stub_cleanup_sessions,
    stub_check_dormant_users,
    stub_verify_backups,
)
from app.tasks.integration_jobs import _async_process_due_jobs, process_due_jobs
from app.tasks.auction import open_scheduled_auctions, close_due_auctions, send_auction_closing_warning


@pytest.mark.unit
class TestSlaTimersTask:
    @pytest.mark.asyncio
    async def test_evaluate_task_sla_warning_and_escalation(self):
        db = AsyncMock(spec=AsyncSession)
        task = WorkflowTask(
            id=uuid4(),
            org_id=uuid4(),
            workflow_instance_id=uuid4(),
            assigned_to=uuid4(),
            created_at=datetime.now(timezone.utc) - timedelta(hours=10),
            sla_deadline=datetime.now(timezone.utc) - timedelta(hours=2),
            sla_status="PENDING",
        )
        now = datetime.now(timezone.utc)

        with patch("app.tasks.sla_timers.workflow_event_publisher") as mock_pub:
            mock_pub.sla_escalation = AsyncMock()
            mock_pub.sla_critical = AsyncMock()
            mock_pub.sla_warning = AsyncMock()
            await _evaluate_task_sla(db, task, now)
            assert task.sla_status in ("ESCALATED", "REASSIGNED", "CRITICAL")

    @pytest.mark.asyncio
    async def test_evaluate_task_sla_critical(self):
        db = AsyncMock(spec=AsyncSession)
        created = datetime.now(timezone.utc) - timedelta(hours=20)
        task = WorkflowTask(
            id=uuid4(),
            org_id=uuid4(),
            workflow_instance_id=uuid4(),
            assigned_to=uuid4(),
            created_at=created,
            sla_deadline=created + timedelta(hours=4),
            sla_status="PENDING",
        )
        now = datetime.now(timezone.utc)

        with patch("app.tasks.sla_timers.workflow_event_publisher") as mock_pub:
            mock_pub.sla_critical = AsyncMock()
            mock_pub.sla_escalation = AsyncMock()
            await _evaluate_task_sla(db, task, now)
            assert task.sla_status == "CRITICAL"

    @pytest.mark.asyncio
    async def test_evaluate_task_sla_reassigned(self):
        db = AsyncMock(spec=AsyncSession)
        created = datetime.now(timezone.utc) - timedelta(hours=15)
        task = WorkflowTask(
            id=uuid4(),
            org_id=uuid4(),
            workflow_instance_id=uuid4(),
            assigned_to=uuid4(),
            created_at=created,
            sla_deadline=created + timedelta(hours=10),
            sla_status="PENDING",
        )
        now = datetime.now(timezone.utc)

        with patch("app.tasks.sla_timers.workflow_event_publisher") as mock_pub, \
             patch("app.tasks.sla_timers._reassign_task", new_callable=AsyncMock):
            mock_pub.sla_escalation = AsyncMock()
            await _evaluate_task_sla(db, task, now)
            assert task.sla_status == "REASSIGNED"

    @pytest.mark.asyncio
    async def test_evaluate_task_sla_warning(self):
        db = AsyncMock(spec=AsyncSession)
        created = datetime.now(timezone.utc) - timedelta(hours=6)
        task = WorkflowTask(
            id=uuid4(),
            org_id=uuid4(),
            workflow_instance_id=uuid4(),
            assigned_to=uuid4(),
            created_at=created,
            sla_deadline=created + timedelta(hours=10),
            sla_status="WITHIN_SLA",
        )
        now = datetime.now(timezone.utc)

        with patch("app.tasks.sla_timers.workflow_event_publisher") as mock_pub:
            mock_pub.sla_reminder = AsyncMock()
            await _evaluate_task_sla(db, task, now)
            assert task.sla_status == "WARNING"

    @pytest.mark.asyncio
    async def test_async_check_sla_runner(self):
        mock_session = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_ctx = MagicMock()
        mock_ctx.__aenter__.return_value = mock_session

        with patch("app.db.session.async_session_factory", return_value=mock_ctx), \
             patch("app.tasks.sla_timers.workflow_repository.get_all_pending_tasks_with_sla", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = []
            await _async_check_sla()
            mock_session.commit.assert_awaited_once()

    def test_sync_celery_task_wrappers(self):
        with patch("app.tasks.sla_timers._async_check_sla", new_callable=AsyncMock):
            check_workflow_sla_timers()
            check_slas()


@pytest.mark.unit
class TestExchangeRatesTask:
    @pytest.mark.asyncio
    async def test_async_refresh_rates(self):
        mock_session = AsyncMock()
        mock_ctx = MagicMock()
        mock_ctx.__aenter__.return_value = mock_session

        mock_redis = AsyncMock()
        mock_redis.set = AsyncMock()

        with patch("app.tasks.exchange_rates.async_session", return_value=mock_ctx), \
             patch("app.tasks.exchange_rates.get_redis_client", return_value=mock_redis), \
             patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.get = AsyncMock(
                return_value=MagicMock(
                    status_code=200,
                    json=lambda: {"rates": {"USD": 1.0, "EUR": 0.9, "GBP": 0.8}},
                )
            )
            mock_client_cls.return_value = mock_client

            mock_session.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [])))
            await async_refresh_exchange()

    def test_refresh_exchange_rates_sync(self):
        with patch("app.tasks.exchange_rates._async_refresh", new_callable=AsyncMock):
            refresh_exchange_rates()


@pytest.mark.unit
class TestAnalyticsRefreshTask:
    @pytest.mark.asyncio
    async def test_async_refresh_analytics(self):
        mock_session = AsyncMock()
        mock_ctx = MagicMock()
        mock_ctx.__aenter__.return_value = mock_session

        mock_org = MagicMock(id=uuid4())
        with patch("app.tasks.analytics_refresh.async_session_factory", return_value=mock_ctx), \
             patch("app.tasks.analytics_refresh.organization_repository.get_all_active", new_callable=AsyncMock, return_value=[mock_org]), \
             patch("app.tasks.analytics_refresh.analytics_service") as mock_svc:
            mock_svc.get_spend_summary = AsyncMock()
            mock_svc.get_procurement_kpis = AsyncMock()
            await async_refresh_analytics()
            mock_svc.get_spend_summary.assert_awaited_once()

    def test_refresh_analytics_cache_sync(self):
        with patch("app.tasks.analytics_refresh._async_refresh", new_callable=AsyncMock):
            refresh_analytics_cache()


@pytest.mark.unit
class TestScheduledReportsTask:
    @pytest.mark.asyncio
    async def test_async_generate_daily(self):
        mock_session = AsyncMock()
        mock_ctx = MagicMock()
        mock_ctx.__aenter__.return_value = mock_session
        mock_org = MagicMock(id=uuid4())

        with patch("app.tasks.scheduled_reports.async_session_factory", return_value=mock_ctx), \
             patch("app.tasks.scheduled_reports.organization_repository.get_all_active", new_callable=AsyncMock, return_value=[mock_org]), \
             patch("app.tasks.scheduled_reports.analytics_service") as mock_svc, \
             patch("app.tasks.scheduled_reports.publisher.publish", new_callable=AsyncMock) as mock_pub:
            mock_svc.get_procurement_kpis = AsyncMock(return_value={"total_spend": 10000})
            mock_svc.get_spend_summary = AsyncMock(return_value=[{"category": "IT", "spend": 5000}])
            await _async_generate_daily()
            mock_pub.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_async_generate_periodic(self):
        mock_session = AsyncMock()
        mock_ctx = MagicMock()
        mock_ctx.__aenter__.return_value = mock_session
        mock_org = MagicMock(id=uuid4())

        with patch("app.tasks.scheduled_reports.async_session_factory", return_value=mock_ctx), \
             patch("app.tasks.scheduled_reports.organization_repository.get_all_active", new_callable=AsyncMock, return_value=[mock_org]), \
             patch("app.tasks.scheduled_reports.analytics_service") as mock_svc, \
             patch("app.tasks.scheduled_reports.publisher.publish", new_callable=AsyncMock) as mock_pub:
            mock_svc.get_procurement_kpis = AsyncMock(return_value={"total_spend": 10000})
            mock_svc.get_all_spend = AsyncMock(return_value=[])
            mock_svc.get_savings_analysis = AsyncMock(return_value=[])
            await _async_generate_periodic("WEEKLY")
            mock_pub.assert_awaited_once()

    def test_scheduled_reports_sync(self):
        with patch("app.tasks.scheduled_reports._async_generate_daily", new_callable=AsyncMock), \
             patch("app.tasks.scheduled_reports._async_generate_periodic", new_callable=AsyncMock):
            generate_daily_analytics_report()
            generate_weekly_analytics_report()
            generate_monthly_analytics_report()


@pytest.mark.unit
class TestStubTasks:
    def test_all_stubs(self):
        stub_collect_metrics()
        stub_take_snapshots()
        stub_refresh_report_cache()
        stub_check_workflow_timeouts()
        with patch("app.tasks.sla_timers.check_slas"):
            stub_check_escalations()
        stub_send_digests()
        stub_check_reminders()
        stub_cleanup_sessions()
        stub_check_dormant_users()
        stub_verify_backups()


@pytest.mark.unit
class TestIntegrationJobsTask:
    @pytest.mark.asyncio
    async def test_async_process_due_jobs(self):
        mock_session = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_ctx = MagicMock()
        mock_ctx.__aenter__.return_value = mock_session

        with patch("app.tasks.integration_jobs.async_session", return_value=mock_ctx), \
             patch("app.tasks.integration_jobs.integration_job_processor.process_pending_jobs", new_callable=AsyncMock) as mock_proc:
            mock_proc.return_value = [MagicMock()]
            result = await _async_process_due_jobs()
            assert result == 1
            mock_session.commit.assert_awaited_once()

    def test_process_due_jobs_sync(self):
        with patch("app.tasks.integration_jobs._async_process_due_jobs", new_callable=AsyncMock, return_value=0):
            res = process_due_jobs()
            assert res == 0


@pytest.mark.unit
class TestAuctionTasks:
    def test_auction_tasks_sync_dispatch(self):
        with patch("app.tasks.auction.LiveBidService") as mock_svc_cls, \
             patch("app.tasks.auction.get_db_ctx") as mock_ctx:
            mock_db = AsyncMock()
            mock_db.commit = AsyncMock()
            mock_ctx.return_value.__aenter__.return_value = mock_db

            mock_svc = MagicMock()
            mock_svc.live_bid_repo.get_due_to_open = AsyncMock(return_value=[])
            mock_svc.live_bid_repo.get_due_to_close = AsyncMock(return_value=[])
            mock_svc.live_bid_repo.get_closing_soon = AsyncMock(return_value=[])
            mock_svc_cls.return_value = mock_svc
            open_scheduled_auctions()
            close_due_auctions()
            send_auction_closing_warning()


@pytest.mark.unit
class TestIntegrationRepositoryDueJobs:
    @pytest.mark.asyncio
    async def test_get_due_jobs_default_now(self):
        from app.modules.integration.repository import IntegrationRepository
        repo = IntegrationRepository()
        mock_db = AsyncMock(spec=AsyncSession)
        mock_res = MagicMock()
        mock_res.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_res

        # Call with now=None to exercise datetime.now(timezone.utc)
        jobs = await repo.get_due_jobs(mock_db, now=None, limit=10)
        assert jobs == []
        mock_db.execute.assert_awaited_once()


@pytest.mark.unit
class TestCeleryWorkerProcessInit:
    def test_on_worker_process_init(self):
        from app.tasks.celery_app import on_worker_process_init
        with patch("app.db.session.engine.sync_engine.dispose") as mock_disp, \
             patch("app.db.session.analytics_engine.sync_engine.dispose") as mock_a_disp:
            on_worker_process_init()
            mock_disp.assert_called_once()
            mock_a_disp.assert_called_once()


