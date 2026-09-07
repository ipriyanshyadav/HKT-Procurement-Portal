from __future__ import annotations

from datetime import date, datetime
from loguru import logger

from app.db.session import async_session_factory
from app.events.publisher import publisher
from app.modules.analytics.service import analytics_service
from app.modules.organization.repository import organization_repository
from app.tasks.async_runner import run_async
from app.tasks.celery_app import celery_app


def _current_fy() -> str:
    return str(datetime.now().year)


@celery_app.task(queue="analytics", name="app.tasks.analytics.generate_daily_report")
def generate_daily_analytics_report():
    run_async(_async_generate_daily())


@celery_app.task(queue="analytics", name="app.tasks.analytics.generate_weekly_report")
def generate_weekly_analytics_report():
    run_async(_async_generate_periodic("WEEKLY"))


@celery_app.task(queue="analytics", name="app.tasks.analytics.generate_monthly_report")
def generate_monthly_analytics_report():
    run_async(_async_generate_periodic("MONTHLY"))


async def _async_generate_daily():
    async with async_session_factory() as db:
        try:
            active_orgs = await organization_repository.get_all_active(db)
            fy = _current_fy()
            for org in active_orgs:
                try:
                    kpis = await analytics_service.get_procurement_kpis(db, org.id, fy, [])
                    spend = await analytics_service.get_spend_summary(db, org.id, fy, [])
                    report = {
                        "org_id": str(org.id),
                        "report_date": date.today().isoformat(),
                        "kpis": kpis,
                        "spend_summary": spend[:10],
                    }
                    await publisher.publish(
                        db,
                        "procurement.notification",
                        "notification.email.daily_report",
                        {
                            "template_code": "DAILY_ANALYTICS_REPORT",
                            "org_id": str(org.id),
                            "recipient_role": "PROCUREMENT_HEAD",
                            "report_data": report,
                        },
                        org.id,
                    )
                except Exception as org_err:
                    logger.error(f"Failed to generate daily report for org {org.id}: {org_err}")
            await db.commit()
        except Exception as e:
            logger.error(f"Failed to run daily report task: {e}")
            await db.rollback()


async def _async_generate_periodic(period: str):
    async with async_session_factory() as db:
        try:
            active_orgs = await organization_repository.get_all_active(db)
            fy = _current_fy()
            for org in active_orgs:
                try:
                    kpis = await analytics_service.get_procurement_kpis(db, org.id, fy, [])
                    spend = await analytics_service.get_all_spend(db, org.id, fy, [])
                    savings = await analytics_service.get_savings_analysis(db, org.id, fy, [])
                    report = {
                        "org_id": str(org.id),
                        "period": period,
                        "report_date": date.today().isoformat(),
                        "kpis": kpis,
                        "spend": spend,
                        "savings": savings,
                    }
                    await publisher.publish(
                        db,
                        "procurement.notification",
                        f"notification.email.{period.lower()}_report",
                        {
                            "template_code": f"{period}_ANALYTICS_REPORT",
                            "org_id": str(org.id),
                            "recipient_role": "PROCUREMENT_HEAD",
                            "report_data": report,
                        },
                        org.id,
                    )
                except Exception as org_err:
                    logger.error(f"Failed to generate {period} report for org {org.id}: {org_err}")
            await db.commit()
        except Exception as e:
            logger.error(f"Failed to run {period} report task: {e}")
            await db.rollback()
