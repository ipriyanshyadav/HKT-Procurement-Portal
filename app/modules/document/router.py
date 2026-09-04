from __future__ import annotations
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.config import settings
from app.db.enums import DocumentCategory
from app.db.session import get_db
from app.modules.document.schemas import DocumentResponse, PresignedUrlResponse
from app.modules.document.service import document_service
from app.modules.user.models import User

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "module": "document"}


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    entity_type: str = Form(...),
    entity_id: UUID = Form(...),
    category: DocumentCategory = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload and virus-scan a document attachment, storing in MinIO."""
    file_bytes = await file.read()
    doc = await document_service.upload_document(
        db=db,
        file_bytes=file_bytes,
        original_filename=file.filename or "document",
        content_type=file.content_type or "application/octet-stream",
        entity_type=entity_type,
        entity_id=entity_id,
        category=category,
        org_id=current_user.org_id,
        actor_id=current_user.id,
    )
    await db.commit()
    return {"data": DocumentResponse.model_validate(doc).model_dump()}


@router.get("/{id}/presigned-url", status_code=status.HTTP_200_OK)
async def get_document_presigned_url(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a 15-minute presigned download URL for a document."""
    url = await document_service.get_presigned_url(
        db=db,
        document_id=id,
        org_id=current_user.org_id,
    )
    return {"data": PresignedUrlResponse(url=url, expires_in=settings.PRESIGNED_URL_EXPIRY_SECONDS).model_dump()}
