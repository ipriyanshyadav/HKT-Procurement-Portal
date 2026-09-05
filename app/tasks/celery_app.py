from __future__ import annotations
from urllib.parse import urlparse, urlunparse
from celery import Celery
from kombu import Queue
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
        'app.events.outbox_worker',
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
    'outbox-publisher': {
        'task': 'app.tasks.maintenance.publish_outbox',
        'schedule': settings.CELERY_OUTBOX_INTERVAL_SECONDS,
    },
    'sla-check': {
        'task': 'app.tasks.critical.check_slas',
        'schedule': settings.CELERY_SLA_CHECK_MINUTES * 60,
    },
    'bid-window-check': {
        'task': 'app.tasks.default.check_bid_windows',
        'schedule': settings.CELERY_BID_WINDOW_CHECK_MINUTES * 60,
    },
    'compliance-check': {
        'task': 'app.tasks.maintenance.check_vendor_compliance',
        'schedule': settings.CELERY_COMPLIANCE_CHECK_HOURS * 3600,
    },
    'notification-digest': {
        'task': 'app.tasks.notification.send_digests',
        'schedule': settings.CELERY_DIGEST_INTERVAL_MINUTES * 60,
    },
    'analytics-snapshot': {
        'task': 'app.tasks.analytics.take_snapshots',
        'schedule': settings.CELERY_ANALYTICS_SNAPSHOT_HOURS * 3600,
    },
    'session-cleanup': {
        'task': 'app.tasks.maintenance.cleanup_sessions',
        'schedule': settings.CELERY_SESSION_CLEANUP_MINUTES * 60,
    },
    'dormant-user-check': {
        'task': 'app.tasks.maintenance.check_dormant_users',
        'schedule': settings.CELERY_DORMANT_USER_CHECK_DAYS * 86400,
    },
    'exchange-rate-update': {
        'task': 'app.tasks.integration.update_exchange_rates',
        'schedule': settings.CELERY_EXCHANGE_RATE_HOURS * 3600,
    },
    'reminder-check': {
        'task': 'app.tasks.notification.check_reminders',
        'schedule': settings.CELERY_REMINDER_CHECK_MINUTES * 60,
    },
    'pr-aging-check': {
        'task': 'app.tasks.default.check_pr_aging',
        'schedule': settings.CELERY_PR_AGING_HOURS * 3600,
    },
    'escalation-check': {
        'task': 'app.tasks.critical.check_escalations',
        'schedule': settings.CELERY_ESCALATION_CHECK_MINUTES * 60,
    },
    'report-cache-refresh': {
        'task': 'app.tasks.analytics.refresh_report_cache',
        'schedule': settings.CELERY_REPORT_CACHE_HOURS * 3600,
    },
    'backup-verification': {
        'task': 'app.tasks.maintenance.verify_backups',
        'schedule': settings.CELERY_BACKUP_VERIFICATION_HOURS * 3600,
    },
    'metrics-collection': {
        'task': 'app.tasks.analytics.collect_metrics',
        'schedule': settings.CELERY_METRICS_COLLECTION_MINUTES * 60,
    },
    'workflow-timeout-check': {
        'task': 'app.tasks.critical.check_workflow_timeouts',
        'schedule': settings.CELERY_WORKFLOW_TIMEOUT_CHECK_MINUTES * 60,
    },
    'open-scheduled-auctions': {
        'task': 'tasks.open_scheduled_auctions',
        'schedule': 30.0,
    },
    'close-due-auctions': {
        'task': 'tasks.close_due_auctions',
        'schedule': 10.0,
    },
    'auction-closing-warning': {
        'task': 'tasks.send_auction_closing_warning',
        'schedule': 10.0,
    },
    'auction-start-reminders': {
        'task': 'tasks.notify_auction_start_reminders',
        'schedule': 60.0,
    },
    'contract-expiry-check': {
        'task': 'app.tasks.maintenance.check_contract_expiry',
        'schedule': settings.CELERY_CONTRACT_EXPIRY_CHECK_HOURS * 3600,
    },
    'invoice-aging-check': {
        'task': 'app.tasks.default.check_invoice_aging',
        'schedule': 14400.0,
    },
}
celery_app.conf.timezone = 'UTC'
