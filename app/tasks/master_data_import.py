from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import UUID

from loguru import logger
from sqlalchemy import select

from app.db.enums import IntegrationJobStatusEnum
from app.db.session import async_session
from app.modules.integration.models import IntegrationJob
from app.modules.master_data.category.service import (
    CategoryCreateRequest,
    category_service,
)
from app.tasks.celery_app import celery_app


@celery_app.task(queue="integrations", name="app.tasks.master_data_import.import_categories")
def import_categories_task(job_id: str, org_id: str) -> None:
    """Async Celery task to process category CSV rows."""
    asyncio.run(_async_import(job_id, org_id))


async def _async_import(job_id: str, org_id: str) -> None:
    job_uuid = UUID(job_id)
    org_uuid = UUID(org_id)

    async with async_session() as db:
        stmt = select(IntegrationJob).where(
            IntegrationJob.id == job_uuid,
            IntegrationJob.org_id == org_uuid,
            IntegrationJob.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        job = result.scalar_one_or_none()
        if not job:
            logger.error(f"IntegrationJob {job_id} not found for import")
            return

        job.status = IntegrationJobStatusEnum.RUNNING
        await db.flush()

        payload = job.request_payload or {}
        rows = payload.get("rows", [])
        actor_id_str = payload.get("actor_id")
        actor_uuid = UUID(actor_id_str) if actor_id_str else org_uuid

        success_count = 0
        errors: list[dict[str, str]] = []

        for idx, row in enumerate(rows):
            code = (row.get("code") or "").strip()
            name = (row.get("name") or "").strip()
            parent_code = (row.get("parent_code") or "").strip()

            if not code or not name:
                errors.append({"row": str(idx + 1), "code": code, "error": "Missing code or name"})
                continue

            parent_id = None
            if parent_code:
                parent = await category_service.get_by_code(db, parent_code, org_uuid)
                if parent:
                    parent_id = parent.id
                else:
                    errors.append({
                        "row": str(idx + 1),
                        "code": code,
                        "error": f"Parent category code '{parent_code}' not found",
                    })
                    continue

            try:
                req = CategoryCreateRequest(code=code, name=name, parent_id=parent_id)
                await category_service.create(db, req, actor_uuid, org_uuid)
                success_count += 1
            except Exception as e:
                logger.warning(f"Error importing category row {idx + 1} ({code}): {e}")
                errors.append({"row": str(idx + 1), "code": code, "error": str(e)})

        now = datetime.now(timezone.utc)
        job.completed_at = now
        job.response_payload = {
            "total_rows": len(rows),
            "success_count": success_count,
            "error_count": len(errors),
            "errors": errors[:100],  # cap error details
        }

        if len(errors) == 0:
            job.status = IntegrationJobStatusEnum.COMPLETED
        elif success_count > 0:
            job.status = IntegrationJobStatusEnum.PARTIAL
        else:
            job.status = IntegrationJobStatusEnum.FAILED
            job.error_message = f"All {len(rows)} rows failed to import"

        await db.commit()
        logger.info(
            f"Category import job {job_id} finished with status {job.status.value}: {success_count}/{len(rows)} imported"
        )
