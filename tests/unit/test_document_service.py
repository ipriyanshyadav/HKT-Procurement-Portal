from __future__ import annotations

import io
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest

from app.core.exceptions import NotFoundError, ValidationError
from app.db.enums import DocumentCategory
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
    async def test_get_presigned_url_success(self):
        service = DocumentService()
        db = AsyncMock()
        doc_mock = MagicMock()
        doc_mock.id = uuid4()
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
