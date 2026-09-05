from __future__ import annotations
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, WebSocket, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import success_response, PaginationMeta
from app.db.session import get_db
from app.modules.notification.schemas import (
    NotificationResponse,
    NotificationPreferenceItem,
    NotificationPreferencesUpdateRequest,
)
from app.modules.notification.service import notification_service
from app.modules.notification.websocket import ws_manager
from app.modules.user.models import User

router = APIRouter()

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
    meta = {
        "page": page,
        "page_size": page_size,
        "total_count": total,
        "total": total,
        "unread_count": unread,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 1,
    }
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
    return success_response(data=[p.model_dump() for p in prefs])

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

@router.websocket("/ws")
async def notification_ws(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """WebSocket stream for real-time notifications."""
    await ws_manager.handle_connection(websocket, token=token)
