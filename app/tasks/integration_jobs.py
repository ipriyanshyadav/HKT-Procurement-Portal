from __future__ import annotations

import asyncio
from loguru import logger

from app.db.session import async_session
from app.modules.integration.job_processor import integration_job_processor
from app.tasks.celery_app import celery_app


@celery_app.task(queue="integrations", name="app.tasks.integration.process_due_jobs")
def process_due_jobs() -> int:
    """Scheduled Celery task executing due integration jobs and retry queues every 60s."""
    return asyncio.run(_async_process_due_jobs())


async def _async_process_due_jobs() -> int:
    async with async_session() as db:
        try:
            jobs = await integration_job_processor.process_pending_jobs(db, limit=50)
            await db.commit()
            if jobs:
                logger.info(f"Processed {len(jobs)} due integration jobs.")
            return len(jobs)
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to process due integration jobs: {e}")
            raise
