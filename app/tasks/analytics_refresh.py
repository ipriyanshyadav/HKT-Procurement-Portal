from __future__ import annotations

from datetime import datetime
from loguru import logger

from app.config import settings
from app.core.redis_client import get_redis_client
from app.db.session import async_session_factory
from app.modules.analytics.service import analytics_service
from app.modules.organization.repository import organization_repository
from app.tasks.async_runner import run_async
from app.tasks.celery_app import celery_app


def _current_fy() -> str:
    return str(datetime.now().year)


@celery_app.task(queue="analytics", name="app.tasks.analytics.refresh_analytics_cache")
def refresh_analytics_cache():
    """Runs every 15 minutes. Warms Redis cache for all active orgs."""
    run_async(_async_refresh())


async def _async_refresh():
    async with async_session_factory() as db:
        orgs = await organization_repository.get_all_active(db)
        fiscal_year = _current_fy()
        try:
            redis_client = get_redis_client(settings.REDIS_CACHE_DB)
        except Exception:
            redis_client = None

        for org in orgs:
            if redis_client:
                try:
                    pattern = f"analytics:*:{org.id}:{fiscal_year}:*"
                    keys = await redis_client.keys(pattern)
                    if keys:
                        await redis_client.delete(*keys)
                except Exception as e:
                    logger.warning(f"Error clearing cache for org {org.id}: {e}")

            try:
                await analytics_service.get_spend_summary(db, org.id, fiscal_year, [])
                await analytics_service.get_procurement_kpis(db, org.id, fiscal_year, [])
            except Exception as e:
                logger.error(f"Error warming cache for org {org.id}: {e}")
