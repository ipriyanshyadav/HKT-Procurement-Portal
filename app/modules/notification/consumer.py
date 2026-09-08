from __future__ import annotations
import asyncio
import json
from typing import Optional
from uuid import UUID
import aio_pika
from loguru import logger

from app.config import settings
from app.core.exceptions import ExternalServiceError
from app.db.enums import NotificationChannelEnum, NotificationStatusEnum
from app.db.session import get_db_ctx
from app.modules.notification.channels.email import email_channel, EmailChannel
from app.modules.notification.channels.sms import sms_channel, SMSChannel
from app.modules.notification.channels.inapp import inapp_channel, InAppChannel
from app.modules.notification.models import Notification
from app.modules.notification.repository import notification_repo

class NotificationConsumer:
    """aio-pika consumer for all notification queues (email, sms, inapp, digest)."""

    QUEUES = [
        "q.notification.email",
        "q.notification.sms",
        "q.notification.inapp",
        "q.notification.digest",
        "q.ticket.events",
    ]

    def __init__(
        self,
        email_ch: Optional[EmailChannel] = None,
        sms_ch: Optional[SMSChannel] = None,
        inapp_ch: Optional[InAppChannel] = None,
    ):
        self.email_channel = email_ch or email_channel
        self.sms_channel = sms_ch or sms_channel
        self.inapp_channel = inapp_ch or inapp_channel

    async def start_consuming(self, channel: aio_pika.abc.AbstractChannel) -> None:
        for queue_name in self.QUEUES:
            queue = await channel.declare_queue(queue_name, durable=True)
            await queue.consume(self._route_message)
            logger.info(f"[NotificationConsumer] Subscribed to queue {queue_name}")

    async def _route_message(self, message: aio_pika.IncomingMessage) -> None:
        async with message.process(requeue=True):
            body = json.loads(message.body.decode())
            routing_key = message.routing_key or ""
            headers = dict(message.headers or {})
            retry_count = int(headers.get("x-retry-count", 0))

            try:
                if routing_key.startswith("notification.email") or "email" in routing_key:
                    await self.email_channel.send(
                        to_email=body["to_email"],
                        subject=body.get("subject", ""),
                        body_html=body.get("body", ""),
                        template_code=body.get("template_code"),
                        context=body.get("context", {}),
                        org_id=UUID(body["org_id"]) if "org_id" in body else None,
                    )
                elif routing_key.startswith("notification.sms") or "sms" in routing_key:
                    await self.sms_channel.send(
                        to_phone=body["to_phone"],
                        message=body.get("message") or body.get("body", ""),
                        org_id=UUID(body["org_id"]) if "org_id" in body else None,
                    )
                elif routing_key.startswith("notification.inapp") or "inapp" in routing_key:
                    user_id = UUID(body["user_id"])
                    await self.inapp_channel.send(user_id=user_id, notification=body)
                elif routing_key.startswith("notification.digest") or "digest" in routing_key:
                    logger.info(f"[NotificationConsumer] Queued digest item for user {body.get('user_id')}")
                elif routing_key.startswith("ticket.") or "ticket" in routing_key:
                    await self._handle_ticket_notification(body, routing_key)

                # Persist notification in DB if user_id and org_id are provided
                await self._persist_notification(body, routing_key)

            except ExternalServiceError as e:
                logger.error(f"[NotificationConsumer] External service error (retry {retry_count}): {e}")
                if retry_count >= settings.OUTBOX_RETRY_MAX:
                    logger.warning(f"[NotificationConsumer] Max retries reached ({retry_count}). Sending to DLQ.")
                    await message.reject(requeue=False)
                else:
                    await asyncio.sleep(min(2 ** retry_count, 30))
                    raise

            except Exception as ex:
                logger.error(f"[NotificationConsumer] Unexpected message error: {ex}")
                if retry_count >= settings.OUTBOX_RETRY_MAX:
                    await message.reject(requeue=False)
                else:
                    raise

    async def _persist_notification(self, body: dict, routing_key: str) -> None:
        user_id_str = body.get("user_id")
        org_id_str = body.get("org_id")
        if not user_id_str or not org_id_str:
            return

        try:
            async with get_db_ctx() as db:
                channel = NotificationChannelEnum.IN_APP
                if "email" in routing_key:
                    channel = NotificationChannelEnum.EMAIL
                elif "sms" in routing_key:
                    channel = NotificationChannelEnum.SMS
                elif "digest" in routing_key:
                    channel = NotificationChannelEnum.DIGEST

                notif = Notification(
                    org_id=UUID(org_id_str),
                    user_id=UUID(user_id_str),
                    notification_type=body.get("notification_type", "GENERAL"),
                    channel=channel,
                    title=body.get("title") or body.get("subject", "Notification"),
                    body=body.get("body") or body.get("message", ""),
                    entity_type=body.get("entity_type"),
                    entity_id=UUID(body["entity_id"]) if body.get("entity_id") else None,
                    status=NotificationStatusEnum.SENT,
                )
                await notification_repo.create(db, notif)
                await db.commit()
        except Exception as err:
            logger.debug(f"[NotificationConsumer] Could not persist notification: {err}")

    async def _handle_ticket_notification(self, body: dict, routing_key: str) -> None:
        event_type = routing_key.replace("ticket.", "")
        ticket_number = body.get("ticket_number", "Ticket")
        org_id_str = body.get("org_id")
        org_id = UUID(org_id_str) if org_id_str else None
        ticket_id = body.get("ticket_id")

        recipients: list[UUID] = []
        if event_type == "mention":
            recipients = [UUID(uid) for uid in body.get("mentioned_user_ids", [])]
            title = f"You were mentioned in ticket {ticket_number}"
            template_code = "TICKET_MENTION_NOTIFICATION"
        elif event_type == "assigned":
            if body.get("assigned_to"):
                recipients = [UUID(body["assigned_to"])]
            title = f"Ticket {ticket_number} assigned to you"
            template_code = "TICKET_ASSIGNED_NOTIFICATION"
        elif event_type == "created":
            if body.get("assigned_to"):
                recipients = [UUID(body["assigned_to"])]
            title = f"Ticket {ticket_number} created"
            template_code = "TICKET_CREATED_NOTIFICATION"
        elif event_type == "commented":
            title = f"New comment on ticket {ticket_number}"
            template_code = "TICKET_COMMENT_NOTIFICATION"
            if body.get("created_by") and body.get("created_by") != body.get("author_id"):
                recipients.append(UUID(body["created_by"]))
        elif event_type == "resolved":
            title = f"Ticket {ticket_number} resolved"
            template_code = "TICKET_RESOLVED_NOTIFICATION"
            if body.get("created_by"):
                recipients.append(UUID(body["created_by"]))
        elif event_type == "reopened":
            title = f"Ticket {ticket_number} reopened"
            template_code = "TICKET_REOPENED_NOTIFICATION"
            if body.get("assigned_to"):
                recipients.append(UUID(body["assigned_to"]))
        elif event_type == "escalated":
            title = f"Ticket {ticket_number} escalated"
            template_code = "TICKET_ESCALATED_NOTIFICATION"
            if body.get("assigned_to"):
                recipients.append(UUID(body["assigned_to"]))
        elif event_type == "sla_breach":
            title = f"SLA breach warning on ticket {ticket_number}"
            template_code = "TICKET_SLA_BREACH_ALERT"
            if body.get("assigned_to"):
                recipients.append(UUID(body["assigned_to"]))
        else:
            title = f"Update on ticket {ticket_number}"
            template_code = "TICKET_CREATED_NOTIFICATION"

        for recipient_id in recipients:
            notif_data = {
                "user_id": str(recipient_id),
                "org_id": str(org_id) if org_id else None,
                "title": title,
                "body": f"Ticket {ticket_number}: {title}",
                "entity_type": "ticket",
                "entity_id": ticket_id,
                "template_code": template_code,
            }
            try:
                await self.inapp_channel.send(user_id=recipient_id, notification=notif_data)
            except Exception as e:
                logger.warning(f"[NotificationConsumer] In-app ticket notification failed: {e}")
            await self._persist_notification(notif_data, routing_key="notification.inapp")

notification_consumer = NotificationConsumer()
