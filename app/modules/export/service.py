"""Service for Asynchronous Export Center (SPEC 27-G).

Module: export
Layer: service
"""
from __future__ import annotations

import csv
import io
import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

from loguru import logger
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException, NotFoundError
from app.modules.export.models import ExportJob
from app.modules.export.schemas import ExportJobCreateRequest, SUPPORTED_EXPORT_TYPES

# Target export storage directory
EXPORT_STORAGE_DIR = Path(os.environ.get("EXPORT_STORAGE_DIR", "/tmp/procurement_exports"))


class ExportCenterService:
    def __init__(self) -> None:
        try:
            EXPORT_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.warning(f"Could not create export directory {EXPORT_STORAGE_DIR}: {e}")

    async def request_export(
        self,
        db: AsyncSession,
        org_id: UUID,
        user_id: UUID,
        data: ExportJobCreateRequest,
    ) -> ExportJob:
        """Create a new async export job and trigger processing."""
        export_type_norm = data.export_type.upper()
        if export_type_norm not in SUPPORTED_EXPORT_TYPES:
            raise AppException(
                f"Unsupported export type: {data.export_type}. Must be one of {SUPPORTED_EXPORT_TYPES}",
                "INVALID_EXPORT_TYPE",
                status_code=400,
            )

        now = datetime.now(UTC)
        job = ExportJob(
            id=uuid4(),
            org_id=org_id,
            requested_by=user_id,
            export_type=export_type_norm,
            filters=data.filters or {},
            format=data.format.upper(),
            status="QUEUED",
            total_rows=0,
            processed_rows=0,
            created_at=now,
            updated_at=now,
        )
        db.add(job)
        await db.flush()

        # Run extraction pipeline
        await self.execute_export_job(db, job.id)
        await db.refresh(job)
        return job

    async def execute_export_job(self, db: AsyncSession, job_id: UUID) -> ExportJob:
        """Process an export job, extract entity records, and write output file."""
        res = await db.execute(select(ExportJob).where(ExportJob.id == job_id))
        job = res.scalar_one_or_none()
        if not job:
            raise NotFoundError(f"Export job {job_id} not found", "EXPORT_JOB_NOT_FOUND")

        now = datetime.now(UTC)
        job.status = "PROCESSING"
        job.started_at = now
        await db.flush()

        try:
            # 1. Fetch data rows based on export type
            rows, headers = await self._extract_data(db, job.org_id, job.export_type, job.filters)
            job.total_rows = len(rows)

            # 2. Generate file content (CSV format default)
            filename = f"export_{job.export_type.lower()}_{job.id.hex[:8]}.csv"
            file_path = EXPORT_STORAGE_DIR / filename

            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(headers)
            for r in rows:
                writer.writerow([r.get(h, "") for h in headers])

            content = output.getvalue().encode("utf-8")
            try:
                with open(file_path, "wb") as f:
                    f.write(content)
                job.file_path = str(file_path)
            except Exception as io_err:
                logger.warning(f"File write warning: {io_err}. Keeping in memory.")
                job.file_path = f"memory://{filename}"

            job.file_size_bytes = len(content)
            job.processed_rows = len(rows)
            job.status = "COMPLETED"
            job.completed_at = datetime.now(UTC)
            job.expires_at = datetime.now(UTC) + timedelta(days=7)
            job.presigned_url = f"/api/v1/exports/{job.id}/download"
            job.presigned_url_expires_at = datetime.now(UTC) + timedelta(hours=24)
            await db.flush()
            return job

        except Exception as err:
            logger.error(f"Export job {job_id} failed: {err}")
            job.status = "FAILED"
            job.error_message = str(err)
            job.completed_at = datetime.now(UTC)
            await db.flush()
            return job

    async def list_user_exports(
        self,
        db: AsyncSession,
        org_id: UUID,
        user_id: UUID,
        limit: int = 30,
    ) -> list[ExportJob]:
        """List past export requests for the current user."""
        res = await db.execute(
            select(ExportJob)
            .where(
                ExportJob.org_id == org_id,
                ExportJob.requested_by == user_id,
                ExportJob.deleted_at.is_(None),
            )
            .order_by(desc(ExportJob.created_at))
            .limit(limit)
        )
        return list(res.scalars().all())

    async def get_export_job(
        self,
        db: AsyncSession,
        org_id: UUID,
        user_id: UUID,
        job_id: UUID,
    ) -> ExportJob:
        """Get export job status and metadata."""
        res = await db.execute(
            select(ExportJob).where(
                ExportJob.id == job_id,
                ExportJob.org_id == org_id,
                ExportJob.deleted_at.is_(None),
            )
        )
        job = res.scalar_one_or_none()
        if not job:
            raise NotFoundError(f"Export job {job_id} not found", "EXPORT_JOB_NOT_FOUND")
        return job

    async def cancel_or_delete_export(
        self,
        db: AsyncSession,
        org_id: UUID,
        user_id: UUID,
        job_id: UUID,
    ) -> None:
        """Cancel a queued job or soft-delete an export job."""
        job = await self.get_export_job(db, org_id, user_id, job_id)
        if job.status == "QUEUED":
            job.status = "FAILED"
            job.error_message = "Export canceled by user."
        job.deleted_at = datetime.now(UTC)
        await db.flush()

    async def refresh_download_url(
        self,
        db: AsyncSession,
        org_id: UUID,
        user_id: UUID,
        job_id: UUID,
    ) -> tuple[str, datetime]:
        """Generate a fresh download link with renewed expiration."""
        job = await self.get_export_job(db, org_id, user_id, job_id)
        if job.status != "COMPLETED":
            raise AppException("Export is not completed yet", "EXPORT_NOT_COMPLETED", 400)

        expires_at = datetime.now(UTC) + timedelta(hours=24)
        job.presigned_url = f"/api/v1/exports/{job.id}/download"
        job.presigned_url_expires_at = expires_at
        await db.flush()
        return job.presigned_url, expires_at

    async def get_export_file_content(
        self,
        db: AsyncSession,
        org_id: UUID,
        user_id: UUID,
        job_id: UUID,
    ) -> tuple[bytes, str]:
        """Fetch raw CSV bytes for streaming download."""
        job = await self.get_export_job(db, org_id, user_id, job_id)
        if job.status != "COMPLETED":
            raise AppException("Export is not completed yet", "EXPORT_NOT_COMPLETED", 400)

        filename = f"{job.export_type.lower()}_export_{job.id.hex[:6]}.csv"
        if job.file_path and os.path.exists(job.file_path):
            with open(job.file_path, "rb") as f:
                return f.read(), filename

        # Fallback dynamic re-render if temp file was cleaned up
        rows, headers = await self._extract_data(db, job.org_id, job.export_type, job.filters)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        for r in rows:
            writer.writerow([r.get(h, "") for h in headers])
        return output.getvalue().encode("utf-8"), filename

    async def _extract_data(
        self,
        db: AsyncSession,
        org_id: UUID,
        export_type: str,
        filters: dict,
    ) -> tuple[list[dict], list[str]]:
        """Extract database records formatted as tabular dictionaries."""
        # Generic query adapter per export type
        rows: list[dict] = []
        headers: list[str] = []

        if export_type == "REQUISITIONS":
            from app.modules.requisition.models import Requisition

            q = select(Requisition).where(Requisition.org_id == org_id)
            res = await db.execute(q.limit(1000))
            for item in res.scalars().all():
                rows.append({
                    "id": str(item.id),
                    "pr_number": getattr(item, "pr_number", ""),
                    "title": getattr(item, "title", ""),
                    "status": str(getattr(item, "status", "")),
                    "total_amount": str(getattr(item, "total_estimated_amount", 0)),
                    "created_at": item.created_at.isoformat() if item.created_at else "",
                })
            headers = ["id", "pr_number", "title", "status", "total_amount", "created_at"]

        elif export_type == "PURCHASE_ORDERS":
            from app.modules.purchase_order.models import PurchaseOrder

            q = select(PurchaseOrder).where(PurchaseOrder.org_id == org_id)
            res = await db.execute(q.limit(1000))
            for item in res.scalars().all():
                rows.append({
                    "id": str(item.id),
                    "po_number": getattr(item, "po_number", ""),
                    "status": str(getattr(item, "status", "")),
                    "total_amount": str(getattr(item, "total_amount", 0)),
                    "currency": getattr(item, "currency", "INR"),
                    "created_at": item.created_at.isoformat() if item.created_at else "",
                })
            headers = ["id", "po_number", "status", "total_amount", "currency", "created_at"]

        elif export_type == "INVOICES":
            from app.modules.invoice.models import Invoice

            q = select(Invoice).where(Invoice.org_id == org_id)
            res = await db.execute(q.limit(1000))
            for item in res.scalars().all():
                rows.append({
                    "id": str(item.id),
                    "invoice_number": getattr(item, "invoice_number", ""),
                    "status": str(getattr(item, "status", "")),
                    "total_amount": str(getattr(item, "total_amount", 0)),
                    "due_date": str(getattr(item, "due_date", "")),
                    "created_at": item.created_at.isoformat() if item.created_at else "",
                })
            headers = ["id", "invoice_number", "status", "total_amount", "due_date", "created_at"]

        elif export_type == "VENDORS":
            from app.modules.vendor.models import Vendor

            q = select(Vendor).where(Vendor.org_id == org_id)
            res = await db.execute(q.limit(1000))
            for item in res.scalars().all():
                rows.append({
                    "id": str(item.id),
                    "name": getattr(item, "name", ""),
                    "email": getattr(item, "email", ""),
                    "status": str(getattr(item, "status", "")),
                    "country": getattr(item, "country", ""),
                })
            headers = ["id", "name", "email", "status", "country"]

        elif export_type == "TICKETS":
            from app.modules.support.models import SupportTicket

            q = select(SupportTicket).where(SupportTicket.org_id == org_id)
            res = await db.execute(q.limit(1000))
            for item in res.scalars().all():
                rows.append({
                    "id": str(item.id),
                    "ticket_number": getattr(item, "ticket_number", ""),
                    "subject": getattr(item, "subject", ""),
                    "category": getattr(item, "category", ""),
                    "priority": getattr(item, "priority", ""),
                    "status": getattr(item, "status", ""),
                    "created_at": item.created_at.isoformat() if item.created_at else "",
                })
            headers = ["id", "ticket_number", "subject", "category", "priority", "status", "created_at"]

        else:
            # Default schema for other entities
            headers = ["entity_type", "org_id", "exported_at", "records_count"]
            rows = [{
                "entity_type": export_type,
                "org_id": str(org_id),
                "exported_at": datetime.now(UTC).isoformat(),
                "records_count": 0,
            }]

        return rows, headers


export_center_service = ExportCenterService()
