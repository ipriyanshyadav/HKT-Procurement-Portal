"""Unit tests for ExportCenterService (SPEC 27-G)."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import UTC, datetime

from app.core.exceptions import AppException, NotFoundError
from app.modules.export.models import ExportJob
from app.modules.export.schemas import ExportJobCreateRequest
from app.modules.export.service import ExportCenterService


@pytest.mark.asyncio
async def test_request_export_unsupported_type_raises():
    service = ExportCenterService()
    db = AsyncMock()
    req = ExportJobCreateRequest(export_type="INVALID_TYPE")

    with pytest.raises(AppException) as exc:
        await service.request_export(db, uuid4(), uuid4(), req)
    assert exc.value.code == "INVALID_EXPORT_TYPE"


@pytest.mark.asyncio
async def test_request_export_success():
    service = ExportCenterService()
    db = AsyncMock()
    org_id = uuid4()
    user_id = uuid4()

    req = ExportJobCreateRequest(
        export_type="REQUISITIONS",
        filters={"status": "APPROVED"},
        format="CSV",
    )

    with patch.object(service, "execute_export_job", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = None
        job = await service.request_export(db, org_id, user_id, req)

        assert job.org_id == org_id
        assert job.requested_by == user_id
        assert job.export_type == "REQUISITIONS"
        assert job.status == "QUEUED"
        assert db.add.called
        assert db.flush.called


@pytest.mark.asyncio
async def test_get_export_job_not_found():
    service = ExportCenterService()
    db = AsyncMock()
    res = MagicMock()
    res.scalar_one_or_none.return_value = None
    db.execute.return_value = res

    with pytest.raises(NotFoundError):
        await service.get_export_job(db, uuid4(), uuid4(), uuid4())


@pytest.mark.asyncio
async def test_cancel_export_queued():
    service = ExportCenterService()
    db = AsyncMock()
    job_id = uuid4()

    job = MagicMock(spec=ExportJob)
    job.id = job_id
    job.status = "QUEUED"

    with patch.object(service, "get_export_job", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = job
        await service.cancel_or_delete_export(db, uuid4(), uuid4(), job_id)

        assert job.status == "FAILED"
        assert job.error_message == "Export canceled by user."
        assert db.flush.called


@pytest.mark.asyncio
async def test_refresh_download_url():
    service = ExportCenterService()
    db = AsyncMock()
    job_id = uuid4()

    job = MagicMock(spec=ExportJob)
    job.id = job_id
    job.status = "COMPLETED"

    with patch.object(service, "get_export_job", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = job
        url, exp = await service.refresh_download_url(db, uuid4(), uuid4(), job_id)

        assert f"/api/v1/exports/{job_id}/download" in url
        assert db.flush.called
