from __future__ import annotations
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, WebSocket, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import success_response, PaginationMeta
from app.db.session import get_db
from app.db.enums import NotificationChannelEnum
from app.modules.notification.schemas import (
    NotificationResponse,
    NotificationPreferenceItem,
    NotificationPreferencesUpdateRequest,
    NotificationTemplateResponse,
    NotificationTemplateCreateRequest,
    NotificationTemplateUpdateRequest,
    NotificationTemplatePreviewRequest,
    NotificationTemplatePreviewResponse,
    NotificationSendRequest,
)
from app.modules.notification.service import notification_service
from app.modules.notification.websocket import ws_manager
from app.modules.user.models import User

router = APIRouter(tags=["Notification"])

@router.get("", summary="Get notifications for current user")
async def get_notifications(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    unread_only: bool = Query(False, description="Filter unread only"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve paginated notifications for current user, ordered unread first."""
    items, total, unread = await notification_service.list_notifications(
        db,
        user_id=current_user.id,
        org_id=current_user.org_id,
        page=page,
        page_size=page_size,
        unread_only=unread_only,
    )
    meta = PaginationMeta(
        page=page,
        page_size=page_size,
        total=total,
        unread_count=unread,
        total_pages=(total + page_size - 1) // page_size if total > 0 else 1,
    )
    return success_response(data=[item.model_dump() for item in items], meta=meta)

@router.post("/{notification_id}/read", summary="Mark single notification as read")
async def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a specific notification as read."""
    updated = await notification_service.mark_as_read(
        db,
        notification_id=notification_id,
        user_id=current_user.id,
        org_id=current_user.org_id,
    )
    return success_response(data=updated.model_dump())

@router.post("/mark-all-read", summary="Mark all notifications as read")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all unread notifications for current user as read."""
    count = await notification_service.mark_all_as_read(
        db,
        user_id=current_user.id,
        org_id=current_user.org_id,
    )
    return success_response(data={"updated_count": count})

@router.get("/preferences", summary="Get user notification preferences")
async def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve notification channel preferences for current user."""
    prefs = await notification_service.get_preferences(
        db,
        user_id=current_user.id,
        org_id=current_user.org_id,
    )
    return success_response(
        data=[p.model_dump() for p in prefs],
        meta=PaginationMeta(total=len(prefs), page=1, page_size=len(prefs) or 20),
    )

@router.put("/preferences", summary="Update user notification preferences")
async def update_notification_preferences(
    body: NotificationPreferencesUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update notification preferences for current user."""
    updated = await notification_service.update_preferences(
        db,
        user_id=current_user.id,
        org_id=current_user.org_id,
        preferences=body.preferences,
    )
    return success_response(data=[p.model_dump() for p in updated])

@router.get("/templates", summary="List notification templates")
async def list_notification_templates(
    channel: Optional[NotificationChannelEnum] = Query(None, description="Filter by channel"),
    language: Optional[str] = Query(None, description="Filter by language"),
    search: Optional[str] = Query(None, description="Search by code, subject or body"),
    is_active: Optional[bool] = Query(None, description="Filter by active state"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Page size"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List paginated notification templates for the organization."""
    items, total = await notification_service.list_templates(
        db,
        org_id=current_user.org_id,
        channel=channel,
        language=language,
        search=search,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )
    meta = PaginationMeta(
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size if total > 0 else 1,
    )
    return success_response(
        data=[NotificationTemplateResponse.model_validate(item).model_dump() for item in items],
        meta=meta,
    )

@router.post("/templates/preview", summary="Preview rendered notification template")
async def preview_notification_template(
    body: NotificationTemplatePreviewRequest,
    current_user: User = Depends(get_current_user),
):
    """Test render Jinja2 templates with context variables."""
    result = notification_service.preview_template(
        subject_template=body.subject_template,
        body_template=body.body_template,
        context=body.context,
    )
    return success_response(data=NotificationTemplatePreviewResponse(**result).model_dump())

@router.get("/templates/{template_id}", summary="Get notification template details")
async def get_notification_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve details of a single notification template."""
    tmpl = await notification_service.get_template_by_id(
        db, template_id=template_id, org_id=current_user.org_id
    )
    return success_response(data=NotificationTemplateResponse.model_validate(tmpl).model_dump())

@router.post("/templates", summary="Create notification template")
async def create_notification_template(
    body: NotificationTemplateCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new notification template."""
    tmpl = await notification_service.create_template(
        db,
        org_id=current_user.org_id,
        template_code=body.template_code,
        channel=body.channel,
        language=body.language,
        subject_template=body.subject_template,
        body_template=body.body_template,
        variables=body.variables,
        is_active=body.is_active,
    )
    return success_response(data=NotificationTemplateResponse.model_validate(tmpl).model_dump())

@router.put("/templates/{template_id}", summary="Update notification template")
async def update_notification_template(
    template_id: UUID,
    body: NotificationTemplateUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update subject, body, variables or active status of a notification template."""
    tmpl = await notification_service.update_template(
        db,
        template_id=template_id,
        org_id=current_user.org_id,
        language=body.language,
        subject_template=body.subject_template,
        body_template=body_template if (body_template := body.body_template) is not None else None,
        variables=body.variables,
        is_active=body.is_active,
    )
    return success_response(data=NotificationTemplateResponse.model_validate(tmpl).model_dump())

@router.delete("/templates/{template_id}", summary="Delete notification template")
async def delete_notification_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a notification template."""
    await notification_service.delete_template(
        db, template_id=template_id, org_id=current_user.org_id
    )
    return success_response(data={"message": "Notification template deleted successfully"})
    
@router.post("/dispatch-test", summary="Dispatch notification test event")
async def dispatch_test_notification(
    body: NotificationSendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test trigger immediate in-app and email notification dispatch for a user."""
    notifs = await notification_service.dispatch(
        db,
        user_id=body.user_id,
        org_id=current_user.org_id,
        notification_type=body.notification_type,
        title=body.title,
        body=body.body,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        to_email=current_user.email if body.user_id == current_user.id else None,
        context=body.context,
    )
    await db.commit()
    return success_response(
        data=[
            NotificationResponse(
                id=n.id,
                org_id=n.org_id,
                user_id=n.user_id,
                notification_type=n.notification_type,
                channel=n.channel,
                title=n.title,
                body=n.body,
                entity_type=n.entity_type,
                entity_id=n.entity_id,
                status=n.status,
                sent_at=n.sent_at,
                delivered_at=n.delivered_at,
                read_at=n.read_at,
                error_message=n.error_message,
                retry_count=n.retry_count,
                created_at=n.created_at,
                is_read=n.read_at is not None,
            ).model_dump()
            for n in notifs
        ],
        meta=PaginationMeta(total=len(notifs), page=1, page_size=len(notifs) or 1),
    )

@router.websocket("/ws")
async def notification_ws(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """WebSocket stream for real-time notifications."""
    await ws_manager.handle_connection(websocket, token=token)
