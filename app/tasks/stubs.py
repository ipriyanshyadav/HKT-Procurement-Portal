from __future__ import annotations
from loguru import logger
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.analytics.collect_metrics", queue="analytics")
def stub_collect_metrics():
    logger.info("Celery task collect_metrics executed (stub, SPEC_25 Analytics planned)")


@celery_app.task(name="app.tasks.analytics.take_snapshots", queue="analytics")
def stub_take_snapshots():
    logger.info("Celery task take_snapshots executed (stub, SPEC_25 Analytics planned)")


@celery_app.task(name="app.tasks.analytics.refresh_report_cache", queue="analytics")
def stub_refresh_report_cache():
    logger.info("Celery task refresh_report_cache executed (stub, SPEC_25 Analytics planned)")


@celery_app.task(name="app.tasks.critical.check_workflow_timeouts", queue="critical")
def stub_check_workflow_timeouts():
    logger.info("Celery task check_workflow_timeouts executed (stub)")


@celery_app.task(name="app.tasks.critical.check_escalations", queue="critical")
def stub_check_escalations():
    logger.info("Celery task check_escalations executed (delegating to check_slas)")
    from app.tasks.sla_timers import check_slas
    check_slas()


@celery_app.task(name="app.tasks.notification.send_digests", queue="notifications")
def stub_send_digests():
    logger.info("Celery task send_digests executed (stub, SPEC_16 Notification planned)")


@celery_app.task(name="app.tasks.notification.check_reminders", queue="notifications")
def stub_check_reminders():
    logger.info("Celery task check_reminders executed (stub, SPEC_16 Notification planned)")


@celery_app.task(name="app.tasks.maintenance.cleanup_sessions", queue="maintenance")
def stub_cleanup_sessions():
    logger.info("Celery task cleanup_sessions executed (stub)")


@celery_app.task(name="app.tasks.maintenance.check_dormant_users", queue="maintenance")
def stub_check_dormant_users():
    logger.info("Celery task check_dormant_users executed (stub)")


@celery_app.task(name="app.tasks.maintenance.verify_backups", queue="maintenance")
def stub_verify_backups():
    logger.info("Celery task verify_backups executed (stub)")
