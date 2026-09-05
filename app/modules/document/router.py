from __future__ import annotations
from datetime import date
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.config import settings
from app.core.responses import APIResponse, PaginationMeta, created_response, success_response
from app.db.enums import DocumentCategory
from app.db.session import get_db
from app.modules.document.schemas import (
    DocumentResponse,
    DocumentVersionResponse,
    PresignedUrlResponse,
)
from app.modules.document.service import document_service
from app.modules.user.models import User

router = APIRouter(tags=["Document"])


@router.get("/health")
async def health():
    return {"status": "ok", "module": "document"}


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    entity_type: str = Form(...),
    entity_id: UUID = Form(...),
    document_type: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    compliance_expiry: Optional[date] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload and virus-scan a document attachment, storing in MinIO."""
    file_bytes = await file.read()
    resolved_type = document_type or category or "TENDER_DOCUMENT"
    doc = await document_service.upload(
        db=db,
        file_bytes=file_bytes,
        original_filename=file.filename or "document",
        document_type=resolved_type,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        compliance_expiry=compliance_expiry,
        content_type=file.content_type,
    )
    await db.commit()
    return created_response(DocumentResponse.model_validate(doc))


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
        actor_id=current_user.id,
    )
    return success_response(PresignedUrlResponse(url=url, expires_in=settings.PRESIGNED_URL_EXPIRY_SECONDS))


@router.get("/{id}/versions", status_code=status.HTTP_200_OK)
async def get_document_versions(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve version history for a document."""
    versions = await document_service.get_version_history(
        db=db,
        document_id=id,
        org_id=current_user.org_id,
    )
    version_models = [DocumentVersionResponse.model_validate(v) for v in versions]
    return success_response(
        version_models,
        meta=PaginationMeta(total=len(version_models), page=1, page_size=len(version_models) or 20),
    )


@router.delete("/{id}", status_code=status.HTTP_200_OK)
async def delete_document(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a document."""
    await document_service.soft_delete(
        db=db,
        document_id=id,
        org_id=current_user.org_id,
        actor_id=current_user.id,
    )
    await db.commit()
    return success_response({"message": "Document deleted successfully", "id": str(id)})


@router.get("/entity/{entity_type}/{entity_id}", status_code=status.HTTP_200_OK)
async def list_entity_documents(
    entity_type: str,
    entity_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List active documents associated with a specific entity (e.g. Vendor, PO, Invoice)."""
    docs = await document_service.list_documents_for_entity(
        db=db,
        entity_type=entity_type,
        entity_id=entity_id,
        org_id=current_user.org_id,
    )
    doc_models = [DocumentResponse.model_validate(doc) for doc in docs]
    return success_response(
        doc_models,
        meta=PaginationMeta(total=len(doc_models), page=1, page_size=len(doc_models) or 20),
    )
