from __future__ import annotations
import asyncio
from datetime import datetime, timezone
from typing import List
from uuid import UUID
from loguru import logger
from sqlalchemy import select

from app.db.enums import NotificationChannelEnum, NotificationStatusEnum
from app.db.session import get_db_ctx
from app.modules.notification.channels.email import email_channel
from app.modules.notification.models import Notification
from app.modules.notification.repository import notification_repo
from app.modules.user.models import User
from app.tasks.celery_app import celery_app

EXCLUDED_DIGEST_TYPES = {
    "sla_breach",
    "compliance",
    "vendor_compliance_hold",
    "vendor_compliance_warning",
    "approval_sla_escalation",
    "unmapped_pr_sla",
    "security_alert",
    "account_locked",
}

def is_digest_excluded(notification_type: str) -> bool:
    norm = notification_type.strip().lower()
    return any(norm == exc or norm.startswith(f"{exc}_") or norm.endswith(f"_{exc}") or exc in norm for exc in EXCLUDED_DIGEST_TYPES)

async def compile_notification_digests_async() -> int:
    """Aggregate pending digest notifications and dispatch per user email."""
    logger.info("[NotificationDigest] Starting digest aggregation...")
    digests_sent = 0

    async with get_db_ctx() as db:
        user_org_pairs = await notification_repo.get_users_with_pending_digest(db)
        if not user_org_pairs:
            logger.info("[NotificationDigest] No pending digest notifications found.")
            return 0

        for user_id, org_id in user_org_pairs:
            pending = await notification_repo.get_pending_digest(db, user_id, org_id)
            if not pending:
                continue

            # CRITICAL RULE: NEVER digest SLA_BREACH or COMPLIANCE alerts
            eligible = [n for n in pending if not is_digest_excluded(n.notification_type)]
            
            # If any non-eligible were accidentally marked DIGEST, mark them FAILED or log
            excluded = [n for n in pending if is_digest_excluded(n.notification_type)]
            for ex in excluded:
                logger.warning(
                    f"[NotificationDigest] Skipping excluded notification {ex.id} (type: {ex.notification_type}) from digest"
                )
                ex.status = NotificationStatusEnum.FAILED
                ex.error_message = "CRITICAL_EXCLUDED_FROM_DIGEST"

            if not eligible:
                await db.commit()
                continue

            # Fetch recipient user email
            user_stmt = select(User).where(User.id == user_id)
            user_res = await db.execute(user_stmt)
            user = user_res.scalar_one_or_none()
            if not user or not user.email:
                logger.warning(f"[NotificationDigest] User {user_id} not found or has no email; marking digest failed")
                for n in eligible:
                    n.status = NotificationStatusEnum.FAILED
                    n.error_message = "USER_EMAIL_NOT_FOUND"
                await db.commit()
                continue

            # Render HTML digest
            digest_items_html = "".join(
                f"<li style='margin-bottom: 8px;'><strong>{n.title}</strong>: {n.body} <small style='color: #888;'>({n.created_at.strftime('%Y-%m-%d %H:%M')})</small></li>"
                for n in eligible
            )
            html_body = f"""
            <h2>Your Procurement Daily Digest</h2>
            <p>You have {len(eligible)} new notifications:</p>
            <ul>{digest_items_html}</ul>
            <p><a href='http://localhost:3000/notifications'>View all in Notification Center</a></p>
            """

            try:
                await email_channel.send(
                    to_email=user.email,
                    subject=f"Procurement Portal Digest ({len(eligible)} updates)",
                    body_html=html_body,
                    org_id=org_id,
                )
                now = datetime.now(timezone.utc)
                for n in eligible:
                    n.status = NotificationStatusEnum.SENT
                    n.sent_at = now
                    n.delivered_at = now
                digests_sent += 1
                logger.info(f"[NotificationDigest] Dispatched digest to {user.email} with {len(eligible)} items")
            except Exception as err:
                logger.error(f"[NotificationDigest] Failed to dispatch digest to {user.email}: {err}")
                for n in eligible:
                    n.status = NotificationStatusEnum.FAILED
                    n.error_message = str(err)

            await db.commit()

    logger.info(f"[NotificationDigest] Finished digest compilation. Sent {digests_sent} digest emails.")
    return digests_sent

@celery_app.task(queue="notifications", name="app.tasks.notification.compile_digests")
def compile_notification_digests() -> int:
    """Celery entrypoint for compiling daily/hourly notification digests."""
    return asyncio.run(compile_notification_digests_async())
