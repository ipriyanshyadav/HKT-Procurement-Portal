from __future__ import annotations
import hashlib
import io
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional, List
from uuid import UUID

from minio import Minio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from app.config import settings
from app.core.exceptions import AppException, ForbiddenError, NotFoundError, ValidationError
from app.db.enums import DocumentCategory
from app.modules.document.models import Document, DocumentVersion
from app.modules.document.repository import document_repository, DocumentRepository
from app.modules.document.scanner import (
    ALLOWED_MIME_TYPES,
    BUCKET_MAPPING,
    scanner,
    sanitize_filename,
    validate_file_magic,
    validate_mime_type,
)

DOCUMENT_TYPE_TO_CATEGORY: dict[str, DocumentCategory] = {
    "GSTIN_CERTIFICATE": DocumentCategory.COMPLIANCE,
    "PAN_CARD": DocumentCategory.COMPLIANCE,
    "BANK_DETAILS": DocumentCategory.COMPLIANCE,
    "INCORPORATION_CERTIFICATE": DocumentCategory.COMPLIANCE,
    "QUALITY_CERTIFICATE": DocumentCategory.COMPLIANCE,
    "TENDER_DOCUMENT": DocumentCategory.TENDER,
    "BID_DOCUMENT": DocumentCategory.BID,
    "CONTRACT_DOCUMENT": DocumentCategory.CONTRACT,
    "PURCHASE_ORDER": DocumentCategory.PURCHASE_ORDER,
    "INVOICE": DocumentCategory.INVOICE,
    "GRN_DOCUMENT": DocumentCategory.GRN_SES,
    "COMPLIANCE": DocumentCategory.COMPLIANCE,
    "TENDER": DocumentCategory.TENDER,
    "BID": DocumentCategory.BID,
    "CONTRACT": DocumentCategory.CONTRACT,
    "GRN_SES": DocumentCategory.GRN_SES,
    "AUDIT": DocumentCategory.AUDIT,
}


class DocumentService:
    def __init__(self, repo: Optional[DocumentRepository] = None) -> None:
        self.repo = repo or document_repository
        self._minio_client: Optional[Minio] = None

    def _get_minio(self) -> Minio:
        if self._minio_client is None:
            self._minio_client = Minio(
                settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_USE_SSL,
            )
        return self._minio_client

    async def upload(
        self,
        db: AsyncSession,
        file_bytes: bytes,
        original_filename: str,
        document_type: str,
        entity_type: str,
        entity_id: UUID,
        actor_id: Optional[UUID] = None,
        org_id: Optional[UUID] = None,
        compliance_expiry: Optional[date] = None,
        content_type: Optional[str] = None,
    ) -> Document:
        """
        Uploads document, enforces file size & magic bytes validation,
        stores in MinIO with scan_status=PENDING, tracks document versioning,
        and enqueues asynchronous ClamAV scan via Celery.
        """
        # 1. File size check
        size_bytes = len(file_bytes)
        max_bytes = settings.MINIO_MAX_FILE_SIZE_MB * 1024 * 1024
        if size_bytes > max_bytes:
            raise ValidationError(
                "FILE_TOO_LARGE",
                f"File exceeds {settings.MINIO_MAX_FILE_SIZE_MB}MB limit",
            )

        # 2. Filename sanitization
        safe_name = sanitize_filename(original_filename)

        # 3. MIME validation (magic bytes)
        declared_ext = safe_name.rsplit(".", 1)[-1] if "." in safe_name else ""
        detected_mime = validate_mime_type(file_bytes, document_type, declared_ext)

        # 4. Resolve bucket and category
        bucket = BUCKET_MAPPING.get(document_type, "documents")
        if document_type in DocumentCategory.__members__:
            category = DocumentCategory[document_type]
        else:
            category = DOCUMENT_TYPE_TO_CATEGORY.get(document_type, DocumentCategory.COMPLIANCE)

        effective_org_id = org_id or uuid.uuid4()
        minio_path = f"{effective_org_id}/{entity_type.lower()}/{entity_id}/{safe_name}"
        sha256_hash = hashlib.sha256(file_bytes).hexdigest()

        # 5. Version check
        existing = await self.repo.find_latest(db, entity_id, entity_type, effective_org_id)
        if existing:
            version_number = (existing.current_version or 1) + 1
            doc = existing
            doc.current_version = version_number
            doc.stored_filename = safe_name
            doc.minio_bucket = bucket
            doc.minio_key = minio_path
            doc.content_type = detected_mime
            doc.file_size_bytes = size_bytes
            doc.sha256_hash = sha256_hash
            doc.scan_status = "PENDING"
            doc.scan_result = None
            doc.updated_at = datetime.now(timezone.utc)
        else:
            version_number = 1
            doc = Document(
                org_id=effective_org_id,
                entity_type=entity_type,
                entity_id=entity_id,
                category=category,
                original_filename=original_filename,
                stored_filename=safe_name,
                minio_bucket=bucket,
                minio_key=minio_path,
                content_type=detected_mime,
                file_size_bytes=size_bytes,
                sha256_hash=sha256_hash,
                scan_status="PENDING",
                scan_result=None,
                is_encrypted=False,
                current_version=1,
                created_by=actor_id,
            )
            db.add(doc)
            await db.flush()

        # 6. Put to MinIO
        client = self._get_minio()
        try:
            if not client.bucket_exists(bucket):
                client.make_bucket(bucket)
            client.put_object(
                bucket_name=bucket,
                object_name=minio_path,
                data=io.BytesIO(file_bytes),
                length=size_bytes,
                content_type=detected_mime,
            )
        except Exception as exc:
            logger.error(f"MinIO storage failure: {exc}")
            if settings.ENVIRONMENT not in ("local", "dev"):
                raise ValidationError("STORAGE_ERROR", "Failed to save document to storage")

        # 7. Record DocumentVersion
        version = DocumentVersion(
            org_id=effective_org_id,
            document_id=doc.id,
            version_number=version_number,
            minio_key=minio_path,
            file_size_bytes=size_bytes,
            sha256_hash=sha256_hash,
            uploaded_by=actor_id or doc.id,
        )
        db.add(version)
        await db.flush()

        # 8. Enqueue async ClamAV scan via Celery
        try:
            from app.tasks.document_scan import scan_document_task
            scan_document_task.delay(str(doc.id), bucket, minio_path, str(effective_org_id))
        except Exception as exc:
            logger.warning(f"Could not enqueue scan_document_task: {exc}")

        # 9. Audit event
        try:
            from app.modules.audit.service import audit_service
            await audit_service.log(
                db,
                "DOCUMENT",
                doc.id,
                "DOCUMENT_UPLOADED",
                actor_id,
                effective_org_id,
                new_values={
                    "filename": safe_name,
                    "document_type": document_type,
                    "size_bytes": size_bytes,
                    "version": version_number,
                },
            )
        except Exception as exc:
            logger.debug(f"Audit log skipped: {exc}")

        return doc

    async def upload_document(
        self,
        db: AsyncSession,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
        entity_type: str,
        entity_id: UUID,
        category: DocumentCategory,
        org_id: UUID,
        actor_id: Optional[UUID] = None,
    ) -> Document:
        """
        Legacy upload method with inline virus scanning support for existing unit test compatibility.
        """
        max_bytes = settings.MINIO_MAX_FILE_SIZE_MB * 1024 * 1024
        if len(file_bytes) > max_bytes:
            raise ValidationError(
                "FILE_TOO_LARGE",
                f"File size exceeds maximum allowed limit of {settings.MINIO_MAX_FILE_SIZE_MB}MB",
            )

        detected_mime = validate_file_magic(file_bytes, content_type)
        sha256_hash = hashlib.sha256(file_bytes).hexdigest()

        is_clean, scan_detail = await scanner.scan_bytes(file_bytes)
        if not is_clean:
            raise ValidationError(
                "MALICIOUS_FILE_DETECTED",
                f"Antivirus scan rejected file: {scan_detail}",
            )

        scan_status = "CLEAN" if is_clean and scan_detail == "CLEAN" else "SKIPPED"
        minio_bucket = BUCKET_MAPPING.get(getattr(category, "value", str(category)), "documents")
        stored_filename = f"{uuid.uuid4()}_{original_filename}"
        minio_key = f"{org_id}/{entity_type.lower()}/{entity_id}/{stored_filename}"

        client = self._get_minio()
        try:
            if not client.bucket_exists(minio_bucket):
                client.make_bucket(minio_bucket)
            client.put_object(
                bucket_name=minio_bucket,
                object_name=minio_key,
                data=io.BytesIO(file_bytes),
                length=len(file_bytes),
                content_type=detected_mime,
            )
        except Exception as exc:
            logger.error(f"MinIO storage failure: {exc}")
            if settings.ENVIRONMENT not in ("local", "dev"):
                raise ValidationError("STORAGE_ERROR", "Failed to save document to storage")

        doc = Document(
            org_id=org_id,
            entity_type=entity_type,
            entity_id=entity_id,
            category=category,
            original_filename=original_filename,
            stored_filename=stored_filename,
            minio_bucket=minio_bucket,
            minio_key=minio_key,
            content_type=detected_mime,
            file_size_bytes=len(file_bytes),
            sha256_hash=sha256_hash,
            scan_status=scan_status,
            scan_result=scan_detail,
            is_encrypted=False,
            created_by=actor_id,
        )
        db.add(doc)
        await db.flush()

        version = DocumentVersion(
            org_id=org_id,
            document_id=doc.id,
            version_number=1,
            minio_key=minio_key,
            file_size_bytes=len(file_bytes),
            sha256_hash=sha256_hash,
            uploaded_by=actor_id or doc.id,
        )
        db.add(version)
        await db.flush()

        return doc

    async def get_presigned_url(
        self,
        db: AsyncSession,
        document_id: UUID,
        org_id: UUID,
        actor_id: Optional[UUID] = None,
        expires_seconds: Optional[int] = None,
    ) -> str:
        """
        Generates 15-minute presigned download URL for a document.
        Raises ForbiddenError if infected and quarantined.
        Raises 202 AppException if scan is still pending.
        """
        stmt = (
            select(Document)
            .where(Document.id == document_id)
            .where(Document.org_id == org_id)
            .where(Document.deleted_at.is_(None))
        )
        res = await db.execute(stmt)
        doc = res.scalar_one_or_none()
        if not doc:
            raise NotFoundError(f"Document {document_id} not found")

        # Scan status security enforcement
        status_val = getattr(doc, "scan_status", None)
        if status_val == "INFECTED":
            raise ForbiddenError(
                "INFECTED_FILE",
                "This document has been quarantined due to malware detection",
            )
        if status_val == "PENDING":
            raise AppException(
                "SCAN_PENDING",
                "Document is still being scanned. Try again shortly.",
                status_code=202,
            )

        expires = timedelta(seconds=expires_seconds or settings.PRESIGNED_URL_EXPIRY_SECONDS)
        client = self._get_minio()
        try:
            url = client.get_presigned_url(
                "GET",
                doc.minio_bucket,
                doc.minio_key,
                expires=expires,
            )
        except Exception as exc:
            logger.error(f"Failed to generate presigned URL: {exc}")
            url = f"http://{settings.MINIO_ENDPOINT}/{doc.minio_bucket}/{doc.minio_key}"

        try:
            from app.modules.audit.service import audit_service
            await audit_service.log(
                db, "DOCUMENT", document_id, "DOCUMENT_ACCESSED", actor_id, org_id
            )
        except Exception as exc:
            logger.debug(f"Audit log skipped: {exc}")

        return url

    async def get_version_history(
        self,
        db: AsyncSession,
        document_id: UUID,
        org_id: UUID,
    ) -> List[DocumentVersion]:
        """Returns all versions for a document ordered by version number descending."""
        return await self.repo.get_versions(db, document_id, org_id)

    async def soft_delete(
        self,
        db: AsyncSession,
        document_id: UUID,
        org_id: UUID,
        actor_id: Optional[UUID] = None,
    ) -> None:
        """Soft-deletes a document and writes audit log."""
        await self.repo.soft_delete(db, document_id, org_id)
        try:
            from app.modules.audit.service import audit_service
            await audit_service.log(
                db, "DOCUMENT", document_id, "DOCUMENT_DELETED", actor_id, org_id
            )
        except Exception as exc:
            logger.debug(f"Audit log skipped: {exc}")

    async def list_documents_for_entity(
        self,
        db: AsyncSession,
        entity_type: str,
        entity_id: UUID,
        org_id: UUID,
    ) -> List[Document]:
        """Lists active documents associated with an entity."""
        return await self.repo.list_by_entity(db, entity_type, entity_id, org_id)


document_service = DocumentService()
