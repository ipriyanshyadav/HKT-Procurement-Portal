from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy import select, update, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import NotificationChannelEnum, NotificationStatusEnum
from app.modules.notification.models import (
    Notification,
    NotificationPreference,
    NotificationTemplate,
)

class NotificationRepository:
    """Data access layer for notifications."""

    async def create(self, db: AsyncSession, notification: Notification) -> Notification:
        db.add(notification)
        await db.flush()
        return notification

    async def get_by_id(
        self,
        db: AsyncSession,
        notification_id: UUID,
        user_id: Optional[UUID] = None,
        org_id: Optional[UUID] = None,
    ) -> Optional[Notification]:
        stmt = select(Notification).where(Notification.id == notification_id)
        if user_id:
            stmt = stmt.where(Notification.user_id == user_id)
        if org_id:
            stmt = stmt.where(Notification.org_id == org_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        db: AsyncSession,
        user_id: UUID,
        org_id: UUID,
        page: int = 1,
        page_size: int = 20,
        unread_only: bool = False,
    ) -> Tuple[List[Notification], int, int]:
        base_filter = and_(Notification.user_id == user_id, Notification.org_id == org_id)
        
        # Total matching
        count_stmt = select(func.count()).select_from(Notification).where(base_filter)
        if unread_only:
            count_stmt = count_stmt.where(Notification.read_at.is_(None))
        total_res = await db.execute(count_stmt)
        total_count = total_res.scalar() or 0

        # Unread count (always calculate for badge)
        unread_stmt = select(func.count()).select_from(Notification).where(
            and_(base_filter, Notification.read_at.is_(None))
        )
        unread_res = await db.execute(unread_stmt)
        unread_count = unread_res.scalar() or 0

        # Query items
        stmt = select(Notification).where(base_filter)
        if unread_only:
            stmt = stmt.where(Notification.read_at.is_(None))

        # Unread first, then newest first
        stmt = stmt.order_by(
            Notification.read_at.is_(None).desc(),
            Notification.created_at.desc(),
        )
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await db.execute(stmt)
        items = list(result.scalars().all())
        return items, total_count, unread_count

    async def mark_as_read(
        self,
        db: AsyncSession,
        notification_id: UUID,
        user_id: UUID,
        org_id: UUID,
    ) -> Optional[Notification]:
        now = datetime.now(timezone.utc)
        stmt = (
            update(Notification)
            .where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
                Notification.org_id == org_id,
            )
            .values(read_at=now)
            .returning(Notification)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def mark_all_as_read(
        self,
        db: AsyncSession,
        user_id: UUID,
        org_id: UUID,
    ) -> int:
        now = datetime.now(timezone.utc)
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.org_id == org_id,
                Notification.read_at.is_(None),
            )
            .values(read_at=now)
        )
        result = await db.execute(stmt)
        return result.rowcount or 0

    async def get_pending_digest(
        self,
        db: AsyncSession,
        user_id: UUID,
        org_id: UUID,
    ) -> List[Notification]:
        stmt = select(Notification).where(
            Notification.user_id == user_id,
            Notification.org_id == org_id,
            Notification.channel == NotificationChannelEnum.DIGEST,
            Notification.status == NotificationStatusEnum.PENDING,
        ).order_by(Notification.created_at.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_users_with_pending_digest(
        self,
        db: AsyncSession,
    ) -> List[Tuple[UUID, UUID]]:
        stmt = select(Notification.user_id, Notification.org_id).where(
            Notification.channel == NotificationChannelEnum.DIGEST,
            Notification.status == NotificationStatusEnum.PENDING,
        ).distinct()
        result = await db.execute(stmt)
        return list(result.all())

    async def update_status(
        self,
        db: AsyncSession,
        notification_id: UUID,
        status: NotificationStatusEnum,
        error_message: Optional[str] = None,
        provider_message_id: Optional[str] = None,
        sent_at: Optional[datetime] = None,
        delivered_at: Optional[datetime] = None,
    ) -> Optional[Notification]:
        values = {"status": status}
        if error_message is not None:
            values["error_message"] = error_message
        if provider_message_id is not None:
            values["provider_message_id"] = provider_message_id
        if sent_at is not None:
            values["sent_at"] = sent_at
        if delivered_at is not None:
            values["delivered_at"] = delivered_at

        stmt = (
            update(Notification)
            .where(Notification.id == notification_id)
            .values(**values)
            .returning(Notification)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

class NotificationPreferenceRepository:
    """Data access layer for user notification preferences."""

    async def get_preferences_for_user(
        self,
        db: AsyncSession,
        user_id: UUID,
        org_id: UUID,
    ) -> List[NotificationPreference]:
        stmt = select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.org_id == org_id,
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_preference(
        self,
        db: AsyncSession,
        user_id: UUID,
        org_id: UUID,
        notification_type: str,
    ) -> Optional[NotificationPreference]:
        stmt = select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.org_id == org_id,
            NotificationPreference.notification_type == notification_type,
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert_preference(
        self,
        db: AsyncSession,
        user_id: UUID,
        org_id: UUID,
        notification_type: str,
        email_enabled: bool = True,
        sms_enabled: bool = False,
        inapp_enabled: bool = True,
        digest_mode: bool = False,
        quiet_hours_start=None,
        quiet_hours_end=None,
    ) -> NotificationPreference:
        pref = await self.get_preference(db, user_id, org_id, notification_type)
        if pref:
            pref.email_enabled = email_enabled
            pref.sms_enabled = sms_enabled
            pref.inapp_enabled = inapp_enabled
            pref.digest_mode = digest_mode
            pref.quiet_hours_start = quiet_hours_start
            pref.quiet_hours_end = quiet_hours_end
        else:
            pref = NotificationPreference(
                org_id=org_id,
                user_id=user_id,
                notification_type=notification_type,
                email_enabled=email_enabled,
                sms_enabled=sms_enabled,
                inapp_enabled=inapp_enabled,
                digest_mode=digest_mode,
                quiet_hours_start=quiet_hours_start,
                quiet_hours_end=quiet_hours_end,
            )
            db.add(pref)
        await db.flush()
        return pref

class NotificationTemplateRepository:
    """Data access layer for notification templates."""

    async def get_template(
        self,
        db: AsyncSession,
        template_code: str,
        channel: NotificationChannelEnum,
        language: str = "en",
        org_id: Optional[UUID] = None,
    ) -> Optional[NotificationTemplate]:
        stmt = select(NotificationTemplate).where(
            NotificationTemplate.template_code == template_code,
            NotificationTemplate.channel == channel,
            NotificationTemplate.language == language,
            NotificationTemplate.is_active == True,
        )
        if org_id:
            # First check for org-specific template, fallback to any
            org_stmt = stmt.where(NotificationTemplate.org_id == org_id)
            res = await db.execute(org_stmt)
            t = res.scalar_one_or_none()
            if t:
                return t
        
        res = await db.execute(stmt)
        return res.scalars().first()

    async def list_templates(
        self,
        db: AsyncSession,
        org_id: Optional[UUID] = None,
    ) -> List[NotificationTemplate]:
        stmt = select(NotificationTemplate).where(NotificationTemplate.is_active == True)
        if org_id:
            stmt = stmt.where(NotificationTemplate.org_id == org_id)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def upsert_template(
        self,
        db: AsyncSession,
        org_id: UUID,
        template_code: str,
        channel: NotificationChannelEnum,
        language: str,
        subject_template: Optional[str],
        body_template: str,
        variables: List[str],
        is_active: bool = True,
    ) -> NotificationTemplate:
        stmt = select(NotificationTemplate).where(
            NotificationTemplate.org_id == org_id,
            NotificationTemplate.template_code == template_code,
            NotificationTemplate.channel == channel,
            NotificationTemplate.language == language,
        )
        res = await db.execute(stmt)
        tmpl = res.scalar_one_or_none()
        if tmpl:
            tmpl.subject_template = subject_template
            tmpl.body_template = body_template
            tmpl.variables = variables
            tmpl.is_active = is_active
        else:
            tmpl = NotificationTemplate(
                org_id=org_id,
                template_code=template_code,
                channel=channel,
                language=language,
                subject_template=subject_template,
                body_template=body_template,
                variables=variables,
                is_active=is_active,
            )
            db.add(tmpl)
        await db.flush()
        return tmpl

notification_repo = NotificationRepository()
preference_repo = NotificationPreferenceRepository()
template_repo = NotificationTemplateRepository()
