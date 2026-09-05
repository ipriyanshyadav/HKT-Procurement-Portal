from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AppException
from app.core.metrics import integration_job_failures_total
from app.db.enums import IntegrationJobStatusEnum
from app.events.publisher import OutboxPublisher
from app.modules.audit.service import audit_service
from app.modules.integration.adapters.erp_base import ERPAdapterFactory
from app.modules.integration.models import IntegrationJob, TenantSetting
from app.modules.integration.repository import integration_repository


class IntegrationJobProcessor:
    """Core processor executing and retrying outbound/inbound integration jobs with exponential backoff."""

    def __init__(
        self,
        repo=integration_repository,
        audit=audit_service,
        publisher=None,
    ) -> None:
        self.repo = repo
        self.audit = audit
        self.publisher = publisher

    async def create_job(
        self,
        db: AsyncSession,
        job_type: str,
        entity_type: str,
        entity_id: UUID,
        payload: Optional[Dict[str, Any]] = None,
        org_id: Optional[UUID] = None,
        direction: str = "OUTBOUND",
        adapter_type: str = "SAP",
        request_payload: Optional[Dict[str, Any]] = None,
        max_retries: Optional[int] = None,
    ) -> IntegrationJob:
        """Create a new integration job initialized in PENDING state."""
        actual_payload = request_payload if request_payload is not None else payload
        job = IntegrationJob(
            org_id=org_id,
            job_type=job_type,
            entity_type=entity_type,
            entity_id=entity_id,
            direction=direction,
            adapter_type=adapter_type.upper(),
            status=IntegrationJobStatusEnum.PENDING,
            request_payload=actual_payload,
            retry_count=0,
            max_retries=max_retries or settings.INTEGRATION_JOB_MAX_RETRIES,
            next_retry_at=datetime.now(timezone.utc),
        )
        db.add(job)
        await db.flush()
        return job

    async def get_due_jobs(
        self,
        db: AsyncSession,
        now: Optional[datetime] = None,
        limit: int = 50,
    ) -> List[IntegrationJob]:
        """Fetch pending and retry-scheduled jobs whose retry deadline has arrived."""
        return await self.repo.get_due_jobs(db, now=now, limit=limit)

    async def process_pending_jobs(
        self,
        db: AsyncSession,
        now: Optional[datetime] = None,
        limit: int = 50,
    ) -> List[IntegrationJob]:
        """Fetch and execute all due jobs."""
        jobs = await self.get_due_jobs(db, now=now, limit=limit)
        processed: List[IntegrationJob] = []
        for job in jobs:
            await self._process_job(db, job)
            processed.append(job)
        if processed:
            await db.flush()
        return processed

    async def _process_job(self, db: AsyncSession, job: IntegrationJob) -> IntegrationJob:
        """Execute single job, updating status or calculating next retry backoff upon error."""
        job.status = IntegrationJobStatusEnum.IN_PROGRESS
        await db.flush()

        try:
            # 1. Fetch tenant ERP settings
            erp_config: Dict[str, Any] = {}
            erp_provider = job.adapter_type or "SAP"

            stmt = select(TenantSetting).where(
                TenantSetting.org_id == job.org_id,
                TenantSetting.setting_key.in_(["erp_config", "erp_adapter_type"]),
                TenantSetting.deleted_at.is_(None),
            )
            settings_res = await db.execute(stmt)
            for row in settings_res.scalars().all():
                if row.setting_key == "erp_config" and isinstance(row.setting_value, dict):
                    erp_config = row.setting_value
                    if "adapter_type" in erp_config:
                        erp_provider = erp_config["adapter_type"]
                elif row.setting_key == "erp_adapter_type" and isinstance(row.setting_value, dict):
                    erp_provider = row.setting_value.get("provider", erp_provider)

            adapter = ERPAdapterFactory.get_adapter(erp_provider, erp_config)

            # 2. Invoke appropriate adapter function
            job_type_upper = (job.job_type or "").upper()
            entity_type_upper = (job.entity_type or "").upper()

            if "VENDOR" in job_type_upper or entity_type_upper == "VENDOR":
                result = await adapter.sync_vendor(job.entity_id, job.org_id)
            elif "PO" in job_type_upper or "PURCHASE_ORDER" in job_type_upper or entity_type_upper == "PURCHASE_ORDER":
                result = await adapter.create_po(job.entity_id, job.org_id)
            elif "INVOICE" in job_type_upper or entity_type_upper == "INVOICE":
                result = await adapter.sync_invoice(job.entity_id, job.org_id)
            elif "PAYMENT" in job_type_upper or entity_type_upper == "PAYMENT":
                result = await adapter.confirm_payment(job.entity_id, job.org_id)
            elif "MATERIAL" in job_type_upper or entity_type_upper in ("MATERIAL", "CATEGORY"):
                result = await adapter.get_material_master(str(job.entity_id), job.org_id)
            else:
                raise AppException(f"Unknown integration job type '{job.job_type}' for entity '{job.entity_type}'")

            job.status = IntegrationJobStatusEnum.COMPLETED
            job.response_payload = result
            job.completed_at = datetime.now(timezone.utc)
            job.error_message = None

            await self.audit.log(
                db,
                entity_type="INTEGRATION_JOB",
                entity_id=job.id,
                action="INTEGRATION_JOB_COMPLETED",
                actor_id=None,
                org_id=job.org_id,
                metadata={
                    "job_type": job.job_type,
                    "adapter_type": job.adapter_type,
                    "retry_count": job.retry_count,
                },
            )

        except Exception as e:
            job.retry_count += 1
            error_text = str(e)[:500]
            job.error_message = error_text

            if job.retry_count >= job.max_retries:
                job.status = IntegrationJobStatusEnum.FAILED
                integration_job_failures_total.labels(
                    job_type=str(job.job_type),
                    org_id=str(job.org_id),
                ).inc()
                alert_payload = {
                    "job_id": str(job.id),
                    "job_type": job.job_type,
                    "entity_type": job.entity_type,
                    "error": str(e)[:200],
                    "retry_count": job.retry_count,
                    "max_retries": job.max_retries,
                }

                if self.publisher is not None:
                    try:
                        await self.publisher.publish(
                            "procurement.alert",
                            "alert.integration.job_failed",
                            alert_payload,
                            job.org_id,
                        )
                    except TypeError:
                        await self.publisher.publish(
                            db,
                            "procurement.alert",
                            "alert.integration.job_failed",
                            alert_payload,
                            job.org_id,
                        )
                else:
                    await OutboxPublisher.publish(
                        db,
                        "procurement.alert",
                        "alert.integration.job_failed",
                        alert_payload,
                        job.org_id,
                    )
            else:
                job.status = IntegrationJobStatusEnum.PENDING
                delays = settings.INTEGRATION_RETRY_DELAYS_SECONDS
                delay_index = min(job.retry_count - 1, len(delays) - 1)
                delay_seconds = delays[delay_index]
                job.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)

        return job


integration_job_processor = IntegrationJobProcessor()
