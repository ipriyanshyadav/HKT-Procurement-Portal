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

    ENTITY_CONFIG = {
        "categories": {
            "job_type": "CATEGORY_IMPORT",
            "required_headers": ["code", "name", "parent_code"],
        },
        "uom": {
            "job_type": "UOM_IMPORT",
            "required_headers": ["code", "name"],
        },
        "tax-codes": {
            "job_type": "TAX_CODE_IMPORT",
            "required_headers": ["code", "name", "rate", "tax_type"],
        },
        "payment-terms": {
            "job_type": "PAYMENT_TERM_IMPORT",
            "required_headers": ["code", "name", "net_days"],
        },
        "locations": {
            "job_type": "LOCATION_IMPORT",
            "required_headers": ["code", "name", "address", "city", "state", "postal_code"],
        },
    }

    async def import_entity_csv(
        self,
        db: AsyncSession,
        entity_type: str,
        file_bytes: bytes,
        actor_id: UUID,
        org_id: UUID,
    ) -> IntegrationJob:
        normalized_type = entity_type.lower().replace("_", "-")
        if normalized_type not in self.ENTITY_CONFIG:
            raise ValidationError(
                "UNSUPPORTED_IMPORT_ENTITY",
                {"error": f"Entity '{entity_type}' is not supported for CSV bulk import", "supported": list(self.ENTITY_CONFIG.keys())},
            )

        config = self.ENTITY_CONFIG[normalized_type]
        job_type = config["job_type"]
        required_headers = config["required_headers"]

        try:
            content = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as e:
            raise ValidationError("INVALID_CSV_ENCODING", {"error": "File must be valid UTF-8 encoded CSV"}) from e

        reader = csv.DictReader(io.StringIO(content))
        if not reader.fieldnames:
            raise ValidationError("EMPTY_CSV_FILE", {"error": "The uploaded CSV file is empty"})

        self.validate_csv_headers(list(reader.fieldnames), required_headers)

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
            job_type=job_type,
            entity_type="MASTER_DATA",
            entity_id=uuid4(),
            direction="IN",
            adapter_type="CSV",
            status=IntegrationJobStatusEnum.PENDING,
            request_payload={"rows": rows, "actor_id": str(actor_id), "entity_type": normalized_type},
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
            new_values={"job_type": job_type, "entity_type": normalized_type, "row_count": len(rows)},
        )
        logger.info(f"{normalized_type} CSV import job initiated", job_id=str(job.id), rows=len(rows), org_id=str(org_id))
        return job

    async def import_categories_csv(
        self,
        db: AsyncSession,
        file_bytes: bytes,
        actor_id: UUID,
        org_id: UUID,
    ) -> IntegrationJob:
        return await self.import_entity_csv(db, "categories", file_bytes, actor_id, org_id)

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
