from __future__ import annotations
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest

from app.db.enums import IntegrationJobStatusEnum
from app.modules.integration.models import IntegrationJob
from app.tasks.master_data_import import _async_import, import_categories_task


@pytest.mark.unit
class TestMasterDataImportTask:
    def test_import_categories_task_sync(self):
        with patch("app.tasks.master_data_import._async_import", new_callable=AsyncMock) as mock_async:
            import_categories_task(str(uuid4()), str(uuid4()))
            mock_async.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_async_import_job_not_found(self):
        mock_session = AsyncMock()
        mock_ctx = MagicMock()
        mock_ctx.__aenter__.return_value = mock_session
        mock_session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))

        with patch("app.tasks.master_data_import.async_session", return_value=mock_ctx):
            await _async_import(str(uuid4()), str(uuid4()))
            mock_session.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_async_import_success_and_errors(self):
        job_id = uuid4()
        org_id = uuid4()
        job = IntegrationJob(
            id=job_id,
            org_id=org_id,
            status=IntegrationJobStatusEnum.PENDING,
            request_payload={
                "actor_id": str(uuid4()),
                "rows": [
                    {"code": "IT", "name": "Information Tech", "parent_code": ""},
                    {"code": "HDW", "name": "Hardware", "parent_code": "IT"},
                    {"code": "", "name": "Bad Row"},
                    {"code": "SFT", "name": "Software", "parent_code": "UNKNOWN_PARENT"},
                    {"code": "FAIL", "name": "Fail Category"},
                ],
            },
        )

        mock_session = AsyncMock()
        mock_session.flush = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_ctx = MagicMock()
        mock_ctx.__aenter__.return_value = mock_session
        mock_session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: job))

        parent_mock = MagicMock(id=uuid4())

        async def mock_get_by_code(db, code, o_id):
            if code == "IT":
                return parent_mock
            return None

        async def mock_create(db, req, actor_id, o_id):
            if req.code == "FAIL":
                raise ValueError("Simulated DB error")
            return MagicMock()

        with patch("app.tasks.master_data_import.async_session", return_value=mock_ctx), \
             patch("app.tasks.master_data_import.category_service.get_by_code", side_effect=mock_get_by_code), \
             patch("app.tasks.master_data_import.category_service.create", side_effect=mock_create):
            await _async_import(str(job_id), str(org_id))

        assert job.status == IntegrationJobStatusEnum.COMPLETED
        assert job.response_payload["success_count"] == 2

        assert job.response_payload["error_count"] == 3
        mock_session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_async_import_all_failed(self):
        job_id = uuid4()
        org_id = uuid4()
        job = IntegrationJob(
            id=job_id,
            org_id=org_id,
            status=IntegrationJobStatusEnum.PENDING,
            request_payload={
                "rows": [
                    {"code": "", "name": "Invalid"},
                ],
            },
        )

        mock_session = AsyncMock()
        mock_session.flush = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_ctx = MagicMock()
        mock_ctx.__aenter__.return_value = mock_session
        mock_session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: job))

        with patch("app.tasks.master_data_import.async_session", return_value=mock_ctx):
            await _async_import(str(job_id), str(org_id))

        assert job.status == IntegrationJobStatusEnum.FAILED
        assert job.response_payload["success_count"] == 0
        mock_session.commit.assert_awaited_once()
