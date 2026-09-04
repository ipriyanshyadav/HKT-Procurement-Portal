from __future__ import annotations
import hashlib
import io
import uuid
from datetime import timedelta
from typing import Optional
from uuid import UUID

from minio import Minio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from app.config import settings
from app.core.exceptions import NotFoundError, ValidationError
from app.db.enums import DocumentCategory
from app.modules.document.models import Document, DocumentVersion
from app.modules.document.scanner import scanner, validate_file_magic


class DocumentService:
    def __init__(self) -> None:
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

        minio_bucket = "documents"
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
        expires_seconds: Optional[int] = None,
    ) -> str:
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

        expires = timedelta(seconds=expires_seconds or settings.PRESIGNED_URL_EXPIRY_SECONDS)
        client = self._get_minio()
        try:
            url = client.get_presigned_url(
                "GET",
                doc.minio_bucket,
                doc.minio_key,
                expires=expires,
            )
            return url
        except Exception as exc:
            logger.error(f"Failed to generate presigned URL: {exc}")
            return f"http://{settings.MINIO_ENDPOINT}/{doc.minio_bucket}/{doc.minio_key}"


document_service = DocumentService()
