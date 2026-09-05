from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest

from app.modules.document.models import Document
from app.tasks.document_scan import _async_scan


@pytest.mark.asyncio
async def test_document_scan_clean():
    doc_id = uuid4()
    org_id = uuid4()
    doc = Document(
        id=doc_id,
        org_id=org_id,
        entity_type="VENDOR",
        entity_id=uuid4(),
        category="COMPLIANCE",
        original_filename="gst.pdf",
        stored_filename="gst.pdf",
        minio_bucket="compliance-documents",
        minio_key="path/gst.pdf",
        content_type="application/pdf",
        file_size_bytes=100,
        sha256_hash="hash",
        scan_status="PENDING",
    )

    db_mock = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = doc
    db_mock.execute.return_value = result_mock

    session_ctx = AsyncMock()
    session_ctx.__aenter__.return_value = db_mock
    session_ctx.__aexit__.return_value = None

    minio_mock = MagicMock()
    minio_mock.fget_object.return_value = None

    with patch("app.tasks.document_scan.async_session_factory", return_value=session_ctx):
        with patch("app.tasks.document_scan.document_service._get_minio", return_value=minio_mock):
            with patch("app.tasks.document_scan.scan_with_clamav", return_value=(True, "")):
                await _async_scan(str(doc_id), "compliance-documents", "path/gst.pdf", str(org_id))

    assert doc.scan_status == "CLEAN"
    assert doc.scan_result == "CLEAN"
    assert db_mock.commit.called


@pytest.mark.asyncio
async def test_document_scan_infected_quarantined():
    doc_id = uuid4()
    org_id = uuid4()
    doc = Document(
        id=doc_id,
        org_id=org_id,
        entity_type="VENDOR",
        entity_id=uuid4(),
        category="COMPLIANCE",
        original_filename="virus.pdf",
        stored_filename="virus.pdf",
        minio_bucket="compliance-documents",
        minio_key="path/virus.pdf",
        content_type="application/pdf",
        file_size_bytes=100,
        sha256_hash="hash",
        scan_status="PENDING",
    )

    db_mock = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = doc
    db_mock.execute.return_value = result_mock

    session_ctx = AsyncMock()
    session_ctx.__aenter__.return_value = db_mock
    session_ctx.__aexit__.return_value = None

    minio_mock = MagicMock()
    minio_mock.bucket_exists.return_value = True

    with patch("app.tasks.document_scan.async_session_factory", return_value=session_ctx):
        with patch("app.tasks.document_scan.document_service._get_minio", return_value=minio_mock):
            with patch("app.tasks.document_scan.scan_with_clamav", return_value=(False, "Eicar-Test-Signature")):
                with patch("app.events.publisher.OutboxPublisher.publish", new_callable=AsyncMock) as mock_pub:
                    await _async_scan(str(doc_id), "compliance-documents", "path/virus.pdf", str(org_id))
                    mock_pub.assert_called_once()

    assert doc.scan_status == "INFECTED"
    assert doc.scan_result == "Eicar-Test-Signature"
    assert doc.minio_bucket == "quarantine"
    assert minio_mock.copy_object.called
    assert minio_mock.remove_object.called
    assert db_mock.commit.called
