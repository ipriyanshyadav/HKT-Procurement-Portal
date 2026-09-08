from __future__ import annotations
from urllib.parse import urlparse, urlunparse
from celery import Celery
from kombu import Queue
from celery.schedules import crontab
from app.config import settings

def _get_result_backend_url(redis_url: str | None, db_index: int) -> str | None:
    if not redis_url:
        return None
    if "://" not in redis_url:
        redis_url = f"redis://{redis_url}"
    parsed = urlparse(redis_url)
    return urlunparse((
        parsed.scheme,
        parsed.netloc,
        f"/{db_index}",
        parsed.params,
        parsed.query,
        parsed.fragment,
    ))

celery_app = Celery(
    'procurement',
    include=[
        'app.tasks.exchange_rates',
        'app.tasks.master_data_import',
        'app.tasks.pr_aging',
        'app.tasks.rfq_lifecycle',
        'app.tasks.sla_timers',
        'app.tasks.unmapped_pr_sla',
        'app.tasks.vendor_compliance',
        'app.tasks.auction',
        'app.tasks.contract_expiry',
        'app.tasks.invoice_aging',
        'app.tasks.document_scan',
        'app.tasks.stubs',
        'app.events.outbox_worker',
        'app.tasks.notification_digest',
        'app.tasks.integration_jobs',
        'app.tasks.analytics_refresh',
        'app.tasks.scheduled_reports',
        'app.tasks.ticket_sla',
    ],
)
celery_app.conf.broker_url = settings.RABBITMQ_URL
celery_app.conf.result_backend = _get_result_backend_url(settings.REDIS_URL, settings.REDIS_CELERY_BACKEND_DB)


celery_app.conf.task_queues = (
    Queue('default', routing_key='task.default'),
    Queue('notifications', routing_key='task.notifications'),
    Queue('integrations', routing_key='task.integrations'),
    Queue('analytics', routing_key='task.analytics'),
    Queue('maintenance', routing_key='task.maintenance'),
    Queue('critical', routing_key='task.critical'),
)

celery_app.conf.task_routes = {
    'app.tasks.notification.*': {'queue': 'notifications'},
    'app.tasks.integration.*': {'queue': 'integrations'},
    'app.tasks.analytics.*': {'queue': 'analytics'},
    'app.tasks.maintenance.*': {'queue': 'maintenance'},
    'app.tasks.critical.*': {'queue': 'critical'},
    '*': {'queue': 'default'},
}

celery_app.conf.beat_schedule = {
    'compile-notification-digests': {
        'task': 'app.tasks.notification.compile_digests',
        'schedule': settings.CELERY_DIGEST_INTERVAL_MINUTES * 60,
    },
    'outbox-publisher': {
        'task': 'app.tasks.maintenance.publish_outbox',
        'schedule': settings.CELERY_OUTBOX_INTERVAL_SECONDS,
    },
    'sla-check': {
        'task': 'app.tasks.critical.check_slas',
        'schedule': settings.CELERY_SLA_CHECK_MINUTES * 60,
    },
    'unmapped-pr-sla-check': {
        'task': 'app.tasks.critical.check_unmapped_pr_sla',
        'schedule': settings.CELERY_UNMAPPED_SLA_CHECK_SECONDS,
    },
    'bid-window-check': {
        'task': 'app.tasks.default.check_bid_windows',
        'schedule': settings.CELERY_BID_WINDOW_CHECK_MINUTES * 60,
    },
    'compliance-check': {
        'task': 'app.tasks.maintenance.check_vendor_compliance',
        'schedule': settings.CELERY_COMPLIANCE_CHECK_HOURS * 3600,
    },
    'exchange-rate-update': {
        'task': 'app.tasks.integration.update_exchange_rates',
        'schedule': settings.CELERY_EXCHANGE_RATE_HOURS * 3600,
    },
    'pr-aging-check': {
        'task': 'app.tasks.default.check_pr_aging',
        'schedule': settings.CELERY_PR_AGING_HOURS * 3600,
    },
    'contract-expiry-check': {
        'task': 'app.tasks.maintenance.check_contract_expiry',
        'schedule': settings.CELERY_CONTRACT_EXPIRY_CHECK_HOURS * 3600,
    },
    'invoice-aging-check': {
        'task': 'app.tasks.default.check_invoice_aging',
        'schedule': settings.CELERY_INVOICE_AGING_CHECK_SECONDS,
    },
    'open-scheduled-auctions': {
        'task': 'app.tasks.auction.open_scheduled_auctions',
        'schedule': settings.CELERY_AUCTION_OPEN_SECONDS,
    },
    'close-due-auctions': {
        'task': 'app.tasks.auction.close_due_auctions',
        'schedule': settings.CELERY_AUCTION_CLOSE_SECONDS,
    },
    'auction-closing-warning': {
        'task': 'app.tasks.auction.send_auction_closing_warning',
        'schedule': settings.CELERY_AUCTION_WARNING_SECONDS,
    },
    'auction-start-reminders': {
        'task': 'app.tasks.auction.notify_auction_start_reminders',
        'schedule': settings.CELERY_AUCTION_REMINDER_SECONDS,
    },
    'process-due-integration-jobs': {
        'task': 'app.tasks.integration.process_due_jobs',
        'schedule': settings.CELERY_INTEGRATION_JOB_SECONDS,
    },
    'refresh-analytics-cache': {
        'task': 'app.tasks.analytics.refresh_analytics_cache',
        'schedule': settings.CELERY_ANALYTICS_REFRESH_SECONDS,
    },
    'generate-daily-analytics-report': {
        'task': 'app.tasks.analytics.generate_daily_report',
        'schedule': settings.CELERY_DAILY_REPORT_SECONDS,
    },
    'check-ticket-sla-timers': {
        'task': 'app.tasks.ticket_sla.check_ticket_sla_timers',
        'schedule': settings.CELERY_SLA_CHECK_MINUTES * 60,
    },
    'auto-close-idle-tickets': {
        'task': 'app.tasks.ticket_sla.auto_close_idle_tickets',
        'schedule': crontab(hour=1, minute=0),
    },
    'send-ticket-digest': {
        'task': 'app.tasks.ticket_sla.send_ticket_digest',
        'schedule': crontab(hour=8, minute=0),
    },
}
celery_app.conf.timezone = 'UTC'

from celery.signals import worker_process_init


@worker_process_init.connect
def on_worker_process_init(**kwargs):
    """Dispose parent connection pools, engines, and async loops in child workers post-fork."""
    try:
        from app.db.session import engine, analytics_engine
        engine.sync_engine.dispose()
        analytics_engine.sync_engine.dispose()
    except Exception:
        pass
    try:
        from app.tasks.async_runner import reset_worker_loop
        reset_worker_loop()
    except Exception:
        pass
