"""Integration tests for BaseRepository soft-delete pattern and version incrementing."""
from __future__ import annotations

import pytest
from uuid import uuid4
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings
from app.db.repository_base import BaseRepository
from app.modules.organization.models import LegalEntity
from app.core.exceptions import NotFoundError

pytestmark = pytest.mark.asyncio

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)

async def test_soft_delete_lifecycle():
    """Verify that BaseRepository.soft_delete sets deleted_at and get() respects include_deleted."""
    repo = BaseRepository(LegalEntity)
    org_id = uuid4()
    entity_id = uuid4()

    # 1. Setup organization and insert active legal entity
    async with TestSession() as session:
        await session.execute(
            text("""
            INSERT INTO organizations (id, name, legal_name, country_code, base_currency)
            VALUES (:id, :name, :legal_name, 'IN', 'INR')
            ON CONFLICT (id) DO NOTHING
            """),
            {"id": org_id, "name": f"Org {org_id.hex[:6]}", "legal_name": f"Legal {org_id.hex[:6]}"}
        )
        
        entity = LegalEntity(
            id=entity_id,
            org_id=org_id,
            name="Test Legal Entity",
            registration_number=f"REG-{entity_id.hex[:6]}",
            country_code="IN",
            version=1
        )
        session.add(entity)
        await session.commit()

    # 2. Get active legal entity
    async with TestSession() as session:
        found = await repo.get(session, id=entity_id, org_id=org_id)
        assert found.id == entity_id
        assert found.deleted_at is None
        assert found.name == "Test Legal Entity"

    # 3. Soft delete legal entity
    async with TestSession() as session:
        await repo.soft_delete(session, id=entity_id, org_id=org_id)
        await session.commit()

    # 4. Get soft-deleted legal entity without include_deleted - should raise NotFoundError
    async with TestSession() as session:
        with pytest.raises(NotFoundError):
            await repo.get(session, id=entity_id, org_id=org_id, include_deleted=False)

    # 5. Get soft-deleted legal entity with include_deleted=True - should succeed
    async with TestSession() as session:
        found_deleted = await repo.get(session, id=entity_id, org_id=org_id, include_deleted=True)
        assert found_deleted.id == entity_id
        assert found_deleted.deleted_at is not None

    # 6. get_multi filters out soft deleted records
    async with TestSession() as session:
        active_items = await repo.get_multi(session, org_id=org_id, include_deleted=False)
        assert not any(item.id == entity_id for item in active_items)

        all_items = await repo.get_multi(session, org_id=org_id, include_deleted=True)
        assert any(item.id == entity_id for item in all_items)

async def test_increment_version():
    """Verify that BaseRepository.increment_version increments version."""
    repo = BaseRepository(LegalEntity)
    org_id = uuid4()
    entity_id = uuid4()

    async with TestSession() as session:
        await session.execute(
            text("""
            INSERT INTO organizations (id, name, legal_name, country_code, base_currency)
            VALUES (:id, :name, :legal_name, 'IN', 'INR')
            ON CONFLICT (id) DO NOTHING
            """),
            {"id": org_id, "name": f"Org {org_id.hex[:6]}", "legal_name": f"Legal {org_id.hex[:6]}"}
        )
        entity = LegalEntity(
            id=entity_id,
            org_id=org_id,
            name="Operations Entity",
            registration_number=f"REG-{entity_id.hex[:6]}",
            country_code="IN",
            version=1
        )
        session.add(entity)
        await session.commit()

    async with TestSession() as session:
        entity = await repo.get(session, id=entity_id, org_id=org_id)
        assert entity.version == 1
        await repo.increment_version(session, entity)
        assert entity.version == 2
        await session.commit()

    async with TestSession() as session:
        entity = await repo.get(session, id=entity_id, org_id=org_id)
        assert entity.version == 2
