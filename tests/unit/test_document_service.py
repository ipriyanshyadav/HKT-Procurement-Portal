from __future__ import annotations

import io
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest

from app.core.exceptions import AppException, ForbiddenError, NotFoundError, ValidationError
from app.db.enums import DocumentCategory
from app.modules.document.models import Document, DocumentVersion
from app.modules.document.service import DocumentService


class TestDocumentService:
    @pytest.mark.asyncio
    async def test_upload_file_too_large(self):
        service = DocumentService()
        db = AsyncMock()
        large_bytes = b"0" * (100 * 1024 * 1024)

        with patch("app.modules.document.service.settings.MINIO_MAX_FILE_SIZE_MB", 50):
            with pytest.raises(ValidationError) as exc:
                await service.upload_document(
                    db=db,
                    file_bytes=large_bytes,
                    original_filename="large.pdf",
                    content_type="application/pdf",
                    entity_type="PR",
                    entity_id=uuid4(),
                    category=DocumentCategory.COMPLIANCE,
                    org_id=uuid4(),
                )
            assert exc.value.code == "FILE_TOO_LARGE"

    @pytest.mark.asyncio
    async def test_upload_infected_file_rejected(self):
        service = DocumentService()
        db = AsyncMock()
        data = b"pretend-virus-data"

        with patch("app.modules.document.service.validate_file_magic", return_value="application/pdf"):
            with patch("app.modules.document.service.scanner.scan_bytes", return_value=(False, "INFECTED: Eicar")):
                with pytest.raises(ValidationError) as exc:
                    await service.upload_document(
                        db=db,
                        file_bytes=data,
                        original_filename="bad.pdf",
                        content_type="application/pdf",
                        entity_type="PR",
                        entity_id=uuid4(),
                        category=DocumentCategory.COMPLIANCE,
                        org_id=uuid4(),
                    )
                assert exc.value.code == "MALICIOUS_FILE_DETECTED"

    @pytest.mark.asyncio
    async def test_upload_clean_file_success(self):
        service = DocumentService()
        db = AsyncMock()
        data = b"%PDF-1.7 sample data"
        org_id = uuid4()
        entity_id = uuid4()

        mock_minio = MagicMock()
        mock_minio.bucket_exists.return_value = True
        service._minio_client = mock_minio

        with patch("app.modules.document.service.validate_file_magic", return_value="application/pdf"):
            with patch("app.modules.document.service.scanner.scan_bytes", return_value=(True, "CLEAN")):
                doc = await service.upload_document(
                    db=db,
                    file_bytes=data,
                    original_filename="good.pdf",
                    content_type="application/pdf",
                    entity_type="PR",
                    entity_id=entity_id,
                    category=DocumentCategory.COMPLIANCE,
                    org_id=org_id,
                )
                assert doc.original_filename == "good.pdf"
                assert doc.scan_status == "CLEAN"
                assert doc.content_type == "application/pdf"
                assert mock_minio.put_object.called
                assert db.add.called
                assert db.flush.called

    @pytest.mark.asyncio
    async def test_upload_spec17_async_scan(self):
        service = DocumentService()
        db = AsyncMock()
        mock_repo = AsyncMock()
        mock_repo.find_latest.return_value = None
        service.repo = mock_repo

        mock_minio = MagicMock()
        mock_minio.bucket_exists.return_value = True
        service._minio_client = mock_minio

        data = b"%PDF-1.7 sample pdf content"
        org_id = uuid4()
        entity_id = uuid4()
        actor_id = uuid4()

        with patch("app.modules.document.service.validate_mime_type", return_value="application/pdf"):
            with patch("app.tasks.document_scan.scan_document_task.delay") as mock_delay:
                doc = await service.upload(
                    db=db,
                    file_bytes=data,
                    original_filename="tender.pdf",
                    document_type="TENDER_DOCUMENT",
                    entity_type="TENDER",
                    entity_id=entity_id,
                    actor_id=actor_id,
                    org_id=org_id,
                )
                assert doc.scan_status == "PENDING"
                assert doc.current_version == 1
                assert doc.minio_bucket == "tender-documents"
                mock_minio.put_object.assert_called_once()
                mock_delay.assert_called_once()

    @pytest.mark.asyncio
    async def test_upload_spec17_version_increments(self):
        service = DocumentService()
        db = AsyncMock()
        org_id = uuid4()
        entity_id = uuid4()

        existing_doc = Document(
            id=uuid4(),
            org_id=org_id,
            entity_type="TENDER",
            entity_id=entity_id,
            category=DocumentCategory.TENDER,
            original_filename="old_tender.pdf",
            stored_filename="old_tender.pdf",
            minio_bucket="tender-documents",
            minio_key="old/path.pdf",
            content_type="application/pdf",
            file_size_bytes=100,
            sha256_hash="hash1",
            current_version=1,
            scan_status="CLEAN",
        )

        mock_repo = AsyncMock()
        mock_repo.find_latest.return_value = existing_doc
        service.repo = mock_repo

        mock_minio = MagicMock()
        mock_minio.bucket_exists.return_value = True
        service._minio_client = mock_minio

        data = b"%PDF-1.7 new version content"
        with patch("app.modules.document.service.validate_mime_type", return_value="application/pdf"):
            with patch("app.tasks.document_scan.scan_document_task.delay"):
                updated_doc = await service.upload(
                    db=db,
                    file_bytes=data,
                    original_filename="new_tender.pdf",
                    document_type="TENDER_DOCUMENT",
                    entity_type="TENDER",
                    entity_id=entity_id,
                    org_id=org_id,
                )
                assert updated_doc.current_version == 2
                assert updated_doc.scan_status == "PENDING"

    @pytest.mark.asyncio
    async def test_get_presigned_url_not_found(self):
        service = DocumentService()
        db = AsyncMock()
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        db.execute.return_value = result_mock

        with pytest.raises(NotFoundError):
            await service.get_presigned_url(
                db=db,
                document_id=uuid4(),
                org_id=uuid4(),
            )

    @pytest.mark.asyncio
    async def test_get_presigned_url_infected_raises_forbidden(self):
        service = DocumentService()
        db = AsyncMock()
        doc_mock = MagicMock()
        doc_mock.id = uuid4()
        doc_mock.scan_status = "INFECTED"

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = doc_mock
        db.execute.return_value = result_mock

        with pytest.raises(ForbiddenError) as exc:
            await service.get_presigned_url(
                db=db,
                document_id=doc_mock.id,
                org_id=uuid4(),
            )
        assert exc.value.code == "INFECTED_FILE"

    @pytest.mark.asyncio
    async def test_get_presigned_url_pending_raises_app_exception(self):
        service = DocumentService()
        db = AsyncMock()
        doc_mock = MagicMock()
        doc_mock.id = uuid4()
        doc_mock.scan_status = "PENDING"

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = doc_mock
        db.execute.return_value = result_mock

        with pytest.raises(AppException) as exc:
            await service.get_presigned_url(
                db=db,
                document_id=doc_mock.id,
                org_id=uuid4(),
            )
        assert exc.value.code == "SCAN_PENDING"

    @pytest.mark.asyncio
    async def test_get_presigned_url_success(self):
        service = DocumentService()
        db = AsyncMock()
        doc_mock = MagicMock()
        doc_mock.id = uuid4()
        doc_mock.scan_status = "CLEAN"
        doc_mock.minio_bucket = "documents"
        doc_mock.minio_key = "test/path/doc.pdf"

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = doc_mock
        db.execute.return_value = result_mock

        mock_minio = MagicMock()
        mock_minio.get_presigned_url.return_value = "https://minio.test/presigned-url"
        service._minio_client = mock_minio

        url = await service.get_presigned_url(
            db=db,
            document_id=doc_mock.id,
            org_id=uuid4(),
        )
        assert url == "https://minio.test/presigned-url"
        mock_minio.get_presigned_url.assert_called_once()

    @pytest.mark.asyncio
    async def test_version_history_and_soft_delete(self):
        service = DocumentService()
        db = AsyncMock()
        mock_repo = AsyncMock()
        service.repo = mock_repo

        doc_id = uuid4()
        org_id = uuid4()

        mock_repo.get_versions.return_value = [
            DocumentVersion(id=uuid4(), org_id=org_id, document_id=doc_id, version_number=1, minio_key="k", file_size_bytes=10, sha256_hash="h", uploaded_by=uuid4())
        ]
        versions = await service.get_version_history(db, doc_id, org_id)
        assert len(versions) == 1
        mock_repo.get_versions.assert_called_once_with(db, doc_id, org_id)

        await service.soft_delete(db, doc_id, org_id)
        mock_repo.soft_delete.assert_called_once_with(db, doc_id, org_id)
