from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.constants import AuditAction
from app.core.exceptions import NotFoundError, ValidationError
from app.db.enums import IntegrationJobStatusEnum
from app.modules.audit.service import audit_service
from app.modules.integration.models import IntegrationJob

_ENTITY_TYPE = "MASTER_DATA"


class MasterDataImportService:
    def validate_csv_headers(self, headers: list[str], required_headers: list[str]) -> None:
        header_set = {h.strip().lower() for h in headers if h}
        missing = [rh for rh in required_headers if rh.lower() not in header_set]
        if missing:
            raise ValidationError(
                "MISSING_CSV_HEADERS",
                {"missing_headers": missing, "required_headers": required_headers},
            )

    async def import_categories_csv(
        self,
        db: AsyncSession,
        file_bytes: bytes,
        actor_id: UUID,
        org_id: UUID,
    ) -> IntegrationJob:
        try:
            content = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as e:
            raise ValidationError("INVALID_CSV_ENCODING", {"error": "File must be valid UTF-8 encoded CSV"}) from e

        reader = csv.DictReader(io.StringIO(content))
        if not reader.fieldnames:
            raise ValidationError("EMPTY_CSV_FILE", {"error": "The uploaded CSV file is empty"})

        self.validate_csv_headers(list(reader.fieldnames), ["code", "name", "parent_code"])

        rows = list(reader)
        max_rows = getattr(settings, "CSV_IMPORT_MAX_ROWS", 5000)
        if len(rows) > max_rows:
            raise ValidationError(
                "IMPORT_TOO_LARGE",
                {"error": f"Maximum {max_rows} rows per import", "row_count": len(rows)},
            )
        if len(rows) == 0:
            raise ValidationError("EMPTY_CSV_FILE", {"error": "The uploaded CSV contains no data rows"})

        job = IntegrationJob(
            id=uuid4(),
            org_id=org_id,
            job_type="CATEGORY_IMPORT",
            entity_type="MASTER_DATA",
            entity_id=uuid4(),
            direction="IN",
            adapter_type="CSV",
            status=IntegrationJobStatusEnum.PENDING,
            request_payload={"rows": rows, "actor_id": str(actor_id)},
            max_retries=settings.INTEGRATION_JOB_MAX_RETRIES,
        )
        db.add(job)
        await db.flush()

        from app.tasks.master_data_import import import_categories_task
        try:
            import_categories_task.delay(str(job.id), str(org_id))
        except Exception as e:
            logger.warning(f"Could not dispatch Celery task for import job {job.id}: {e}")

        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=job.id,
            action=AuditAction.IMPORTED,
            actor_id=actor_id,
            org_id=org_id,
            new_values={"job_type": "CATEGORY_IMPORT", "row_count": len(rows)},
        )
        logger.info("Category CSV import job initiated", job_id=str(job.id), rows=len(rows), org_id=str(org_id))
        return job

    async def get_import_job(
        self,
        db: AsyncSession,
        job_id: UUID,
        org_id: UUID,
    ) -> IntegrationJob:
        stmt = select(IntegrationJob).where(
            IntegrationJob.id == job_id,
            IntegrationJob.org_id == org_id,
            IntegrationJob.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        job = result.scalar_one_or_none()
        if not job:
            raise NotFoundError(f"Import job '{job_id}' not found")
        return job


master_data_import_service = MasterDataImportService()
