from __future__ import annotations

import io
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4
import httpx
import pytest
from sqlalchemy import text

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.auth.dependencies import get_current_user
from app.config import settings
from app.db.enums import UserStatusEnum
from app.db.session import get_db
from app.main import app
from app.modules.document.service import document_service
from app.modules.user.models import User

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def create_test_org(db, org_id: UUID) -> None:
    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency)
        VALUES (:id, :name, :legal_name, 'IN', 'INR')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id, "name": f"Org {org_id.hex[:6]}", "legal_name": f"Legal {org_id.hex[:6]}"},
    )
    await db.commit()


async def create_test_user(db, user_id: UUID, org_id: UUID) -> User:
    await create_test_org(db, org_id)
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
        VALUES (:id, :org_id, :email, 'hash', 'Test', 'User', 'ACTIVE', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": user_id, "org_id": org_id, "email": f"user-{user_id.hex[:6]}@test.com"},
    )
    await db.commit()
    return User(
        id=user_id,
        org_id=org_id,
        email=f"user-{user_id.hex[:6]}@test.com",
        first_name="Test",
        last_name="User",
        status=UserStatusEnum.ACTIVE,
    )


@pytest.mark.asyncio
async def test_document_health():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/documents/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok", "module": "document"}


@pytest.mark.asyncio
async def test_document_upload_and_lifecycle():
    org_id = uuid4()
    user_id = uuid4()
    entity_id = uuid4()

    async def override_get_db():
        async with TestSession() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    async with TestSession() as db:
        user = await create_test_user(db, user_id, org_id)

    app.dependency_overrides[get_current_user] = lambda: user

    fake_pdf = b"%PDF-1.7 sample document data"
    mock_minio = MagicMock()
    mock_minio.bucket_exists.return_value = True
    mock_minio.get_presigned_url.return_value = "https://minio.test/presigned-url"
    document_service._minio_client = mock_minio

    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            with patch("app.modules.document.service.validate_mime_type", return_value="application/pdf"):
                with patch("app.tasks.document_scan.scan_document_task.delay") as mock_delay:
                    # 1. Upload
                    res = await client.post(
                        "/api/v1/documents/upload",
                        data={
                            "entity_type": "VENDOR",
                            "entity_id": str(entity_id),
                            "document_type": "GSTIN_CERTIFICATE",
                        },
                        files={
                            "file": ("gst_cert.pdf", fake_pdf, "application/pdf")
                        },
                    )
                    assert res.status_code == 201
                    data = res.json()["data"]
                    doc_id = data["id"]
                    assert data["entity_type"] == "VENDOR"
                    assert data["scan_status"] == "PENDING"
                    assert data["original_filename"] == "gst_cert.pdf"
                    mock_delay.assert_called_once()

                    # 2. Get list by entity
                    res_list = await client.get(f"/api/v1/documents/entity/VENDOR/{entity_id}")
                    assert res_list.status_code == 200
                    docs = res_list.json()["data"]
                    assert len(docs) >= 1
                    assert docs[0]["id"] == doc_id

                    # 3. Get versions
                    res_ver = await client.get(f"/api/v1/documents/{doc_id}/versions")
                    assert res_ver.status_code == 200
                    versions = res_ver.json()["data"]
                    assert len(versions) >= 1
                    assert versions[0]["version_number"] == 1

                    # 4. Presigned URL while PENDING -> returns 202 SCAN_PENDING
                    res_url_pending = await client.get(f"/api/v1/documents/{doc_id}/presigned-url")
                    assert res_url_pending.status_code == 202

                    # 5. Delete document
                    res_del = await client.delete(f"/api/v1/documents/{doc_id}")
                    assert res_del.status_code == 200
                    assert res_del.json()["data"]["id"] == doc_id
    finally:
        app.dependency_overrides.pop(get_current_user, None)
