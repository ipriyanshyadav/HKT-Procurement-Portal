from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional, List, Any, Tuple
from uuid import UUID
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

import re
from app.core.exceptions import NotFoundError, ConflictError
from app.db.enums import NotificationChannelEnum, NotificationStatusEnum
from app.modules.notification.channels.email import email_channel, EmailChannel
from app.modules.notification.channels.sms import sms_channel, SMSChannel
from app.modules.notification.channels.inapp import inapp_channel, InAppChannel
from app.modules.notification.channels.whatsapp import whatsapp_channel, WhatsAppChannel
from app.modules.notification.models import Notification, NotificationPreference, NotificationTemplate
from app.modules.notification.repository import (
    notification_repo, NotificationRepository,
    preference_repo, NotificationPreferenceRepository,
    template_repo, NotificationTemplateRepository,
)
from app.modules.notification.schemas import (
    NotificationResponse,
    NotificationPreferenceItem,
)

class NotificationService:
    """Service layer managing notification dispatch, channels, preferences, and templates."""

    CRITICAL_NOTIFICATION_TYPES = {
        "rfq_bid_deadline_4h",
        "approval_sla_escalation",
        "security_alert",
        "account_locked",
        "vendor_compliance_hold",
        "rfq_compliance_hold",
        "sla_breach",
        "compliance",
    }

    def __init__(
        self,
        notif_repo: Optional[NotificationRepository] = None,
        pref_repo: Optional[NotificationPreferenceRepository] = None,
        tmpl_repo: Optional[NotificationTemplateRepository] = None,
        email_ch: Optional[EmailChannel] = None,
        sms_ch: Optional[SMSChannel] = None,
        inapp_ch: Optional[InAppChannel] = None,
        whatsapp_ch: Optional[WhatsAppChannel] = None,
    ):
        self.notif_repo = notif_repo or notification_repo
        self.pref_repo = pref_repo or preference_repo
        self.tmpl_repo = tmpl_repo or template_repo
        self.email_channel = email_ch or email_channel
        self.sms_channel = sms_ch or sms_channel
        self.inapp_channel = inapp_ch or inapp_channel
        self.whatsapp_channel = whatsapp_ch or whatsapp_channel

    @staticmethod
    def render_template_str(template_str: str, context: dict[str, Any]) -> str:
        """Render string using Jinja2 with robust fallback."""
        try:
            import jinja2
            return jinja2.Template(template_str).render(**context)
        except Exception:
            result = template_str
            for k, v in context.items():
                result = result.replace(f"{{{{{k}}}}}", str(v))
                result = result.replace(f"{{{{ {k} }}}}", str(v))
            return result

    def is_critical(self, notification_type: str) -> bool:
        norm = notification_type.strip().lower()
        return any(norm == crit or norm.startswith(f"{crit}_") or norm.endswith(f"_{crit}") for crit in self.CRITICAL_NOTIFICATION_TYPES)

    async def list_notifications(
        self,
        db: AsyncSession,
        user_id: UUID,
        org_id: UUID,
        page: int = 1,
        page_size: int = 20,
        unread_only: bool = False,
    ) -> Tuple[List[NotificationResponse], int, int]:
        items, total_count, unread_count = await self.notif_repo.list_for_user(
            db, user_id=user_id, org_id=org_id, page=page, page_size=page_size, unread_only=unread_only
        )
        responses = [
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
            )
            for n in items
        ]
        return responses, total_count, unread_count

    async def mark_as_read(
        self,
        db: AsyncSession,
        notification_id: UUID,
        user_id: UUID,
        org_id: UUID,
    ) -> NotificationResponse:
        updated = await self.notif_repo.mark_as_read(db, notification_id, user_id, org_id)
        if not updated:
            raise NotFoundError(f"Notification {notification_id} not found")
        await db.commit()
        return NotificationResponse(
            id=updated.id,
            org_id=updated.org_id,
            user_id=updated.user_id,
            notification_type=updated.notification_type,
            channel=updated.channel,
            title=updated.title,
            body=updated.body,
            entity_type=updated.entity_type,
            entity_id=updated.entity_id,
            status=updated.status,
            sent_at=updated.sent_at,
            delivered_at=updated.delivered_at,
            read_at=updated.read_at,
            error_message=updated.error_message,
            retry_count=updated.retry_count,
            created_at=updated.created_at,
            is_read=True,
        )

    async def mark_all_as_read(
        self,
        db: AsyncSession,
        user_id: UUID,
        org_id: UUID,
    ) -> int:
        count = await self.notif_repo.mark_all_as_read(db, user_id, org_id)
        await db.commit()
        return count

    async def get_preferences(
        self,
        db: AsyncSession,
        user_id: UUID,
        org_id: UUID,
    ) -> List[NotificationPreferenceItem]:
        prefs = await self.pref_repo.get_preferences_for_user(db, user_id, org_id)
        return [
            NotificationPreferenceItem(
                notification_type=p.notification_type,
                email_enabled=p.email_enabled,
                sms_enabled=p.sms_enabled,
                inapp_enabled=p.inapp_enabled,
                digest_mode=p.digest_mode,
                quiet_hours_start=p.quiet_hours_start,
                quiet_hours_end=p.quiet_hours_end,
            )
            for p in prefs
        ]

    async def update_preferences(
        self,
        db: AsyncSession,
        user_id: UUID,
        org_id: UUID,
        preferences: List[NotificationPreferenceItem],
    ) -> List[NotificationPreferenceItem]:
        results = []
        for p in preferences:
            pref = await self.pref_repo.upsert_preference(
                db,
                user_id=user_id,
                org_id=org_id,
                notification_type=p.notification_type,
                email_enabled=p.email_enabled,
                sms_enabled=p.sms_enabled,
                inapp_enabled=p.inapp_enabled,
                digest_mode=p.digest_mode,
                quiet_hours_start=p.quiet_hours_start,
                quiet_hours_end=p.quiet_hours_end,
            )
            results.append(
                NotificationPreferenceItem(
                    notification_type=pref.notification_type,
                    email_enabled=pref.email_enabled,
                    sms_enabled=pref.sms_enabled,
                    inapp_enabled=pref.inapp_enabled,
                    digest_mode=pref.digest_mode,
                    quiet_hours_start=pref.quiet_hours_start,
                    quiet_hours_end=pref.quiet_hours_end,
                )
            )
        await db.commit()
        return results

    async def dispatch(
        self,
        db: AsyncSession,
        user_id: UUID,
        org_id: UUID,
        notification_type: str,
        title: str,
        body: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[UUID] = None,
        to_email: Optional[str] = None,
        to_phone: Optional[str] = None,
        context: Optional[dict[str, Any]] = None,
    ) -> List[Notification]:
        """Dispatch notification across configured channels adhering to user preferences & critical rules."""
        context = context or {}
        is_crit = self.is_critical(notification_type)

        # Retrieve preference for this user & notification_type
        pref = await self.pref_repo.get_preference(db, user_id, org_id, notification_type)

        # Critical types bypass mute preferences and never digest
        inapp_enabled = True if is_crit else (pref.inapp_enabled if pref else True)
        email_enabled = True if is_crit else (pref.email_enabled if pref else True)
        sms_enabled = True if is_crit else (pref.sms_enabled if pref else False)
        digest_mode = False if is_crit else (pref.digest_mode if pref else False)

        created_notifs = []
        now = datetime.now(timezone.utc)

        # 1. In-App Channel (WebSocket + Redis pub/sub)
        if inapp_enabled:
            notif = Notification(
                org_id=org_id,
                user_id=user_id,
                notification_type=notification_type,
                channel=NotificationChannelEnum.IN_APP,
                title=title,
                body=body,
                entity_type=entity_type,
                entity_id=entity_id,
                status=NotificationStatusEnum.SENT,
                sent_at=now,
                delivered_at=now,
            )
            await self.notif_repo.create(db, notif)
            try:
                await self.inapp_channel.send(user_id, notif)
            except Exception as e:
                logger.warning(f"In-app publish to Redis failed: {e}")
            created_notifs.append(notif)

        # 2. Email Channel or Digest
        if email_enabled and to_email:
            if digest_mode:
                # Accumulate for digest
                digest_notif = Notification(
                    org_id=org_id,
                    user_id=user_id,
                    notification_type=notification_type,
                    channel=NotificationChannelEnum.DIGEST,
                    title=title,
                    body=body,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    status=NotificationStatusEnum.PENDING,
                )
                await self.notif_repo.create(db, digest_notif)
                created_notifs.append(digest_notif)
            else:
                email_notif = Notification(
                    org_id=org_id,
                    user_id=user_id,
                    notification_type=notification_type,
                    channel=NotificationChannelEnum.EMAIL,
                    title=title,
                    body=body,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    status=NotificationStatusEnum.PENDING,
                )
                await self.notif_repo.create(db, email_notif)
                try:
                    await self.email_channel.send(
                        to_email=to_email,
                        subject=title,
                        body_html=body,
                        template_code=notification_type,
                        context=context,
                        org_id=org_id,
                    )
                    email_notif.status = NotificationStatusEnum.SENT
                    email_notif.sent_at = now
                except Exception as e:
                    email_notif.status = NotificationStatusEnum.FAILED
                    email_notif.error_message = str(e)
                    logger.error(f"Email delivery failed for {to_email}: {e}")
                created_notifs.append(email_notif)

        # 3. SMS Channel
        if sms_enabled and to_phone:
            sms_notif = Notification(
                org_id=org_id,
                user_id=user_id,
                notification_type=notification_type,
                channel=NotificationChannelEnum.SMS,
                title=title,
                body=body,
                entity_type=entity_type,
                entity_id=entity_id,
                status=NotificationStatusEnum.PENDING,
            )
            await self.notif_repo.create(db, sms_notif)
            try:
                await self.sms_channel.send(to_phone=to_phone, message=body, org_id=org_id)
                sms_notif.status = NotificationStatusEnum.SENT
                sms_notif.sent_at = now
            except Exception as e:
                sms_notif.status = NotificationStatusEnum.FAILED
                sms_notif.error_message = str(e)
                logger.error(f"SMS delivery failed for {to_phone}: {e}")
            created_notifs.append(sms_notif)

        await db.commit()
        return created_notifs

    async def list_templates(
        self,
        db: AsyncSession,
        org_id: Optional[UUID] = None,
        channel: Optional[NotificationChannelEnum] = None,
        language: Optional[str] = None,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[List[NotificationTemplate], int]:
        return await self.tmpl_repo.list_templates_paginated(
            db=db,
            org_id=org_id,
            channel=channel,
            language=language,
            search=search,
            is_active=is_active,
            page=page,
            page_size=page_size,
        )

    async def get_template_by_id(
        self,
        db: AsyncSession,
        template_id: UUID,
        org_id: Optional[UUID] = None,
    ) -> NotificationTemplate:
        template = await self.tmpl_repo.get_by_id(db, template_id, org_id)
        if not template:
            raise NotFoundError("Notification template not found")
        return template

    async def create_template(
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
        existing = await self.tmpl_repo.get_template(
            db, template_code=template_code, channel=channel, language=language, org_id=org_id
        )
        if existing and not existing.deleted_at:
            raise ConflictError(f"Template with code '{template_code}', channel '{channel.value}', and language '{language}' already exists")

        # Auto-detect variables if not passed
        if not variables:
            vars_found = set(re.findall(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", body_template))
            if subject_template:
                vars_found.update(re.findall(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", subject_template))
            variables = sorted(list(vars_found))

        tmpl = await self.tmpl_repo.create_template(
            db=db,
            org_id=org_id,
            template_code=template_code,
            channel=channel,
            language=language,
            subject_template=subject_template,
            body_template=body_template,
            variables=variables,
            is_active=is_active,
        )
        await db.commit()
        return tmpl

    async def update_template(
        self,
        db: AsyncSession,
        template_id: UUID,
        org_id: UUID,
        language: Optional[str] = None,
        subject_template: Optional[str] = None,
        body_template: Optional[str] = None,
        variables: Optional[List[str]] = None,
        is_active: Optional[bool] = None,
    ) -> NotificationTemplate:
        template = await self.get_template_by_id(db, template_id, org_id)

        # Auto-detect variables if body or subject updated and variables not explicitly passed
        if variables is None and (body_template is not None or subject_template is not None):
            body_to_scan = body_template if body_template is not None else template.body_template
            subject_to_scan = subject_template if subject_template is not None else template.subject_template
            vars_found = set(re.findall(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", body_to_scan or ""))
            if subject_to_scan:
                vars_found.update(re.findall(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", subject_to_scan))
            variables = sorted(list(vars_found))

        updated = await self.tmpl_repo.update_template(
            db=db,
            template=template,
            language=language,
            subject_template=subject_template,
            body_template=body_template,
            variables=variables,
            is_active=is_active,
        )
        await db.commit()
        return updated

    async def delete_template(
        self,
        db: AsyncSession,
        template_id: UUID,
        org_id: UUID,
    ) -> None:
        template = await self.get_template_by_id(db, template_id, org_id)
        await self.tmpl_repo.delete_template(db, template)
        await db.commit()

    def preview_template(
        self,
        subject_template: Optional[str],
        body_template: str,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        vars_found = set(re.findall(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", body_template))
        if subject_template:
            vars_found.update(re.findall(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", subject_template))

        rendered_subject = (
            self.render_template_str(subject_template, context)
            if subject_template
            else None
        )
        rendered_body = self.render_template_str(body_template, context)

        return {
            "rendered_subject": rendered_subject,
            "rendered_body": rendered_body,
            "detected_variables": sorted(list(vars_found)),
        }

notification_service = NotificationService()
