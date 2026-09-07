"""Unit tests for app.db.session, app.db.enums, and PgBouncer configuration."""
from __future__ import annotations

import os
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import session as db_session
from app.db import enums as db_enums


@pytest.mark.asyncio
async def test_get_db_success():
    """Verify get_db yields session and commits on success."""
    mock_session = AsyncMock(spec=AsyncSession)
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = None

    with patch.object(db_session, "async_session", mock_factory):
        gen = db_session.get_db()
        sess = await anext(gen)
        assert sess == mock_session
        with pytest.raises(StopAsyncIteration):
            await anext(gen)

    mock_session.commit.assert_awaited_once()
    mock_factory.return_value.__aexit__.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_db_rollback_on_error():
    """Verify get_db rolls back session if an exception occurs."""
    mock_session = AsyncMock(spec=AsyncSession)
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = None

    with patch.object(db_session, "async_session", mock_factory):
        gen = db_session.get_db()
        sess = await anext(gen)
        assert sess == mock_session
        with pytest.raises(RuntimeError):
            await gen.athrow(RuntimeError("DB error"))

    mock_session.rollback.assert_awaited_once()
    mock_factory.return_value.__aexit__.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_db_ctx_success():
    """Verify get_db_ctx context manager yields session and commits."""
    mock_session = AsyncMock(spec=AsyncSession)
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = None

    with patch.object(db_session, "async_session", mock_factory):
        async with db_session.get_db_ctx() as sess:
            assert sess == mock_session

    mock_session.commit.assert_awaited_once()
    mock_factory.return_value.__aexit__.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_db_with_rls_sets_org_id():
    """Verify get_db_with_rls sets app.current_org_id before yielding."""
    test_org_id = uuid4()
    mock_session = AsyncMock(spec=AsyncSession)
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = None

    with patch.object(db_session, "async_session", mock_factory):
        gen = db_session.get_db_with_rls(test_org_id)
        sess = await anext(gen)
        assert sess == mock_session
        mock_session.execute.assert_awaited_once()
        stmt = str(mock_session.execute.await_args[0][0])
        assert "SELECT set_config('app.current_org_id', :org_id, false)" in stmt
        assert mock_session.execute.await_args[0][1] == {"org_id": str(test_org_id)}
        with pytest.raises(StopAsyncIteration):
            await anext(gen)

    mock_session.commit.assert_awaited_once()
    mock_factory.return_value.__aexit__.assert_awaited_once()


def test_db_enums_defined():
    """Verify all 20+ ENUM types from SPEC_03 Section 2 are properly declared."""
    expected_enums = [
        "user_status",
        "vendor_status",
        "pr_status",
        "rfq_type",
        "rfq_status",
        "bid_status",
        "contract_status",
        "po_status",
        "invoice_status",
        "payment_status",
        "document_category",
        "notification_channel",
        "audit_entity_type",
        "integration_job_status",
    ]
    declared_names = []
    for attr in dir(db_enums):
        val = getattr(db_enums, attr)
        if hasattr(val, "name") and isinstance(val.name, str):
            declared_names.append(val.name)

    for expected in expected_enums:
        assert expected in declared_names, f"Missing enum: {expected}"


def test_pgbouncer_configuration_files():
    """Verify PgBouncer configuration exists in docker and k8s and conforms to SPEC_03."""
    # 1. Docker PgBouncer config
    docker_ini_path = "docker/pgbouncer/pgbouncer.ini"
    assert os.path.exists(docker_ini_path), "docker/pgbouncer/pgbouncer.ini must exist"
    with open(docker_ini_path, "r") as f:
        content = f.read()
    assert "pool_mode = transaction" in content
    assert "port=5432" in content
    assert "listen_port = 6432" in content

    # 2. K8s PgBouncer config
    k8s_yaml_path = "k8s/base/pgbouncer-config.yaml"
    assert os.path.exists(k8s_yaml_path), "k8s/base/pgbouncer-config.yaml must exist"
    with open(k8s_yaml_path, "r") as f:
        k8s_content = f.read()
    assert "pool_mode = transaction" in k8s_content
    assert "max_client_conn = 200" in k8s_content
