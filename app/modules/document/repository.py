from __future__ import annotations
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.db.repository_base import BaseRepository
from app.modules.document.models import Document, DocumentVersion


class DocumentRepository(BaseRepository[Document]):
    def __init__(self) -> None:
        super().__init__(Document)

    async def find_latest(
        self,
        db: AsyncSession,
        entity_id: UUID,
        entity_type: str,
        org_id: UUID,
    ) -> Optional[Document]:
        stmt = (
            select(Document)
            .where(
                Document.org_id == org_id,
                Document.entity_id == entity_id,
                Document.entity_type == entity_type,
                Document.deleted_at.is_(None),
            )
            .order_by(Document.current_version.desc())
            .limit(1)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_versions(
        self,
        db: AsyncSession,
        document_id: UUID,
        org_id: UUID,
    ) -> List[DocumentVersion]:
        stmt = (
            select(DocumentVersion)
            .where(
                DocumentVersion.document_id == document_id,
                DocumentVersion.org_id == org_id,
            )
            .order_by(DocumentVersion.version_number.desc())
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def list_by_entity(
        self,
        db: AsyncSession,
        entity_type: str,
        entity_id: UUID,
        org_id: UUID,
    ) -> List[Document]:
        stmt = (
            select(Document)
            .where(
                Document.org_id == org_id,
                Document.entity_type == entity_type,
                Document.entity_id == entity_id,
                Document.deleted_at.is_(None),
            )
            .order_by(Document.created_at.desc())
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())


document_repository = DocumentRepository()
