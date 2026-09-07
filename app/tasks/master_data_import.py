from __future__ import annotations

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
from app.modules.master_data.uom.service import (
    UomCreateRequest,
    uom_service,
)
from app.modules.master_data.tax.service import (
    TaxCreateRequest,
    tax_service,
)
from app.modules.master_data.payment_terms.schemas import PaymentTermCreateRequest
from app.modules.master_data.payment_terms.service import payment_terms_service
from app.modules.master_data.location.service import (
    LocationCreateRequest,
    delivery_location_service,
)
from decimal import Decimal
from app.tasks.async_runner import run_async
from app.tasks.celery_app import celery_app


@celery_app.task(queue="integrations", name="app.tasks.master_data_import.import_categories")
def import_categories_task(job_id: str, org_id: str) -> None:
    """Async Celery task to process master data CSV rows (categories, uom, tax, terms, locations)."""
    run_async(_async_import(job_id, org_id))


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

        job.status = IntegrationJobStatusEnum.IN_PROGRESS
        await db.flush()

        payload = job.request_payload or {}
        rows = payload.get("rows", [])
        actor_id_str = payload.get("actor_id")
        actor_uuid = UUID(actor_id_str) if actor_id_str else org_uuid
        job_type = job.job_type

        success_count = 0
        errors: list[dict[str, str]] = []

        for idx, row in enumerate(rows):
            code = (row.get("code") or "").strip()
            name = (row.get("name") or "").strip()

            if not code or not name:
                errors.append({"row": str(idx + 1), "code": code, "error": "Missing code or name"})
                continue

            try:
                if job_type in ("CATEGORY_IMPORT", None):
                    parent_code = (row.get("parent_code") or "").strip()
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
                    req = CategoryCreateRequest(code=code, name=name, parent_id=parent_id)
                    await category_service.create(db, req, actor_uuid, org_uuid)
                elif job_type == "UOM_IMPORT":
                    iso = (row.get("iso_code") or "").strip() or None
                    uom_req = UomCreateRequest(code=code, name=name, iso_code=iso)
                    await uom_service.create(db, uom_req, actor_uuid, org_uuid)
                elif job_type == "TAX_CODE_IMPORT":
                    raw_rate = (row.get("rate") or "0").strip()
                    tax_type = (row.get("tax_type") or "GST").strip().upper()
                    tax_req = TaxCreateRequest(code=code, name=name, rate=Decimal(raw_rate), tax_type=tax_type)
                    await tax_service.create(db, tax_req, actor_uuid, org_uuid)
                elif job_type == "PAYMENT_TERM_IMPORT":
                    net_days = int((row.get("net_days") or "30").strip())
                    term_req = PaymentTermCreateRequest(code=code, name=name, net_days=net_days)
                    await payment_terms_service.create(db, term_req, actor_uuid, org_uuid)
                elif job_type == "LOCATION_IMPORT":
                    loc_req = LocationCreateRequest(
                        code=code,
                        name=name,
                        address=(row.get("address") or "N/A").strip(),
                        city=(row.get("city") or "N/A").strip(),
                        state=(row.get("state") or "N/A").strip(),
                        postal_code=(row.get("postal_code") or "000000").strip(),
                    )
                    await delivery_location_service.create(db, loc_req, actor_uuid, org_uuid)
                else:
                    errors.append({"row": str(idx + 1), "code": code, "error": f"Unsupported job type {job_type}"})
                    continue

                success_count += 1
            except Exception as e:
                logger.warning(f"Error importing row {idx + 1} ({code}): {e}")
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
            job.status = IntegrationJobStatusEnum.COMPLETED
        else:
            job.status = IntegrationJobStatusEnum.FAILED
            job.error_message = f"All {len(rows)} rows failed to import"


        await db.commit()
        logger.info(
            f"Category import job {job_id} finished with status {job.status.value}: {success_count}/{len(rows)} imported"
        )
