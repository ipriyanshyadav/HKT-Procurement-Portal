from __future__ import annotations
import asyncio
import os
import tempfile
from uuid import UUID
from loguru import logger
from minio.commonconfig import CopySource
from sqlalchemy import select

from app.db.session import async_session_factory
from app.modules.document.models import Document
from app.modules.document.scanner import scan_with_clamav
from app.modules.document.service import document_service
from app.tasks.celery_app import celery_app


@celery_app.task(queue="default", name="scan_document")
def scan_document_task(document_id: str, bucket: str, minio_path: str, org_id: str):
    """
    Celery task: download document from MinIO → run ClamAV scan → update scan status or quarantine.
    """
    asyncio.run(_async_scan(document_id, bucket, minio_path, org_id))


async def _async_scan(document_id: str, bucket: str, minio_path: str, org_id: str):
    logger.info(f"Starting ClamAV scan for document {document_id} in bucket {bucket}")
    async with async_session_factory() as db:
        stmt = (
            select(Document)
            .where(Document.id == UUID(document_id), Document.org_id == UUID(org_id))
        )
        res = await db.execute(stmt)
        doc = res.scalar_one_or_none()
        if not doc:
            logger.warning(f"Document {document_id} not found for scan")
            return

        client = document_service._get_minio()
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{doc.stored_filename}") as tmp:
            tmp_path = tmp.name

        try:
            client.fget_object(bucket, minio_path, tmp_path)
            is_clean, virus_name = await scan_with_clamav(tmp_path)
        except Exception as exc:
            logger.error(f"Error downloading or scanning file {minio_path}: {exc}")
            is_clean, virus_name = True, ""
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

        if is_clean:
            doc.scan_status = "CLEAN"
            doc.scan_result = "CLEAN"
            logger.info(f"Document {document_id} scanned: CLEAN")
        else:
            doc.scan_status = "INFECTED"
            doc.scan_result = virus_name or "INFECTED"
            logger.warning(f"Document {document_id} INFECTED with {virus_name}! Moving to quarantine.")

            # Move to quarantine bucket
            quarantine_bucket = "quarantine"
            if not client.bucket_exists(quarantine_bucket):
                client.make_bucket(quarantine_bucket)

            quarantine_key = f"infected/{document_id}/{doc.stored_filename}"
            try:
                client.copy_object(
                    quarantine_bucket,
                    quarantine_key,
                    CopySource(bucket, minio_path),
                )
                client.remove_object(bucket, minio_path)
                doc.minio_bucket = quarantine_bucket
                doc.minio_key = quarantine_key
            except Exception as copy_exc:
                logger.error(f"Failed to quarantine infected document {document_id}: {copy_exc}")

            # Alert event via transactional OutboxPublisher
            try:
                from app.events.publisher import OutboxPublisher
                await OutboxPublisher.publish(
                    session=db,
                    exchange_or_event="procurement.alert",
                    routing_key="alert.document.infected",
                    payload={"document_id": document_id, "virus": virus_name, "org_id": org_id},
                    org_id=UUID(org_id),
                )
            except Exception as event_exc:
                logger.debug(f"Event publication skipped or failed: {event_exc}")

        await db.commit()
