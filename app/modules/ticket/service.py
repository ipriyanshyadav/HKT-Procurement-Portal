from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from loguru import logger
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AppException, ForbiddenError, ValidationError
from app.core.redis_client import RedisKeys, get_redis_client
from app.events.publisher import OutboxPublisher
from app.modules.audit.service import audit_service
from app.modules.ticket.fsm import validate_ticket_transition
from app.modules.ticket.mention_parser import MentionParser
from app.modules.ticket.automation_engine import ticket_automation_engine
from app.modules.ticket.models import (
    Ticket,
    TicketActivityLog,
    TicketAttachment,
    TicketAutomationRule,
    TicketComment,
    TicketCustomFieldDef,
    TicketCustomFieldValue,
    TicketLink,
    TicketSLAConfig,
    TicketWatcher,
)
from app.modules.ticket.repository import TicketRepository, ticket_repository
from app.modules.ticket.schemas import (
    AutomationRuleCreateRequest,
    AutomationRuleUpdateRequest,
    CustomFieldDefCreateRequest,
    CustomFieldDefUpdateRequest,
    TicketCreateRequest,
    TicketFilters,
    TicketSLAConfigRequest,
    TicketUpdateRequest,
)
from app.modules.ticket.search_service import TicketSearchService
from app.modules.ticket.sla_service import TicketSLAService


class TicketPublisherAdapter:
    """Adapter to support both:
    publisher.publish(session, exchange, routing_key, payload, org_id)
    and publisher.publish(exchange, routing_key, payload, org_id)
    """

    @staticmethod
    async def publish(*args: Any, **kwargs: Any) -> None:
        if len(args) >= 5 and isinstance(args[0], AsyncSession):
            session = args[0]
            exchange = args[1]
            routing_key = args[2]
            payload = args[3]
            org_id = args[4]
        elif len(args) >= 4 and not isinstance(args[0], AsyncSession):
            session = kwargs.get("db") or kwargs.get("session")
            exchange = args[0]
            routing_key = args[1]
            payload = args[2]
            org_id = args[3]
        else:
            session = kwargs.get("db") or kwargs.get("session")
            exchange = kwargs.get("exchange", "procurement.ticket")
            routing_key = kwargs.get("routing_key", "")
            payload = kwargs.get("payload", {})
            org_id = kwargs.get("org_id")

        if session is not None:
            await OutboxPublisher.publish(
                session=session,
                exchange_or_event=exchange,
                routing_key=routing_key,
                payload=payload,
                org_id=org_id,
            )


class TicketService:
    def __init__(
        self,
        repo: TicketRepository | None = None,
        sla_svc: TicketSLAService | None = None,
        search_svc: TicketSearchService | None = None,
        mention_parser: MentionParser | None = None,
    ) -> None:
        self.repo = repo or ticket_repository
        self.sla = sla_svc or TicketSLAService(self.repo)
        self.search_service = search_svc or TicketSearchService()
        self.mentions = mention_parser or MentionParser()
        self.publisher = TicketPublisherAdapter()
        self.audit = audit_service
        self.redis = get_redis_client()
        self.automation = ticket_automation_engine

    async def create(
        self,
        db: AsyncSession,
        data: TicketCreateRequest,
        actor_id: UUID,
        org_id: UUID,
        portal: str = "buyer",
    ) -> Ticket:
        ticket_number = await self._generate_number(db, org_id)
        now = datetime.now(timezone.utc)
        sla_breach_at = await self.sla.compute_breach_at(db, org_id, data.priority, now)

        ticket = Ticket(
            org_id=org_id,
            ticket_number=ticket_number,
            title=data.title,
            description=data.description,
            ticket_type=data.ticket_type,
            priority=data.priority,
            category=data.category,
            due_date=data.due_date,
            status="OPEN",
            raised_by=actor_id,
            raised_by_portal=portal,
            entity_type=data.entity_type,
            entity_id=data.entity_id,
            entity_number=data.entity_number,
            tags=list(data.tags or []),
            is_private=bool(data.is_private),
            sla_breach_at=sla_breach_at,
            sla_status="WITHIN_SLA",
        )
        db.add(ticket)
        await db.flush()

        # Custom fields
        if getattr(data, "custom_fields", None):
            for cf in data.custom_fields:
                db.add(
                    TicketCustomFieldValue(
                        org_id=org_id,
                        ticket_id=ticket.id,
                        field_def_id=cf.field_def_id,
                        value_text=cf.value_text,
                        value_number=cf.value_number,
                        value_json=cf.value_json,
                    )
                )

        # Trigger Automation Rules
        try:
            await self.automation.trigger(
                db,
                "TICKET_CREATED",
                ticket,
                org_id,
                {"priority": data.priority, "ticket_type": data.ticket_type, "category": data.category},
            )
        except Exception as e:
            logger.warning(f"Error executing automation rules on create for ticket {ticket.id}: {e}")

        # Auto-watch: add raiser as watcher
        db.add(
            TicketWatcher(
                org_id=org_id,
                ticket_id=ticket.id,
                user_id=actor_id,
                added_by=actor_id,
            )
        )

        await self._log(
            db,
            ticket.id,
            actor_id,
            org_id,
            "TICKET_CREATED",
            new_value=f"status=OPEN priority={data.priority} type={data.ticket_type}",
        )

        await self.publisher.publish(
            db,
            "procurement.ticket",
            "ticket.created",
            {
                "ticket_id": str(ticket.id),
                "ticket_number": ticket_number,
                "priority": data.priority,
                "raised_by": str(actor_id),
                "org_id": str(org_id),
                "entity_type": data.entity_type,
                "entity_number": data.entity_number,
            },
            org_id,
        )

        await self.audit.log(
            db,
            "TICKET",
            ticket.id,
            "TICKET_CREATED",
            actor_id,
            org_id,
            new_values={
                "number": ticket_number,
                "priority": data.priority,
                "type": data.ticket_type,
            },
        )

        # Index in Elasticsearch
        try:
            await self.search_service.index_ticket(ticket)
        except Exception as e:
            logger.warning(f"Error indexing ticket {ticket.id} on create: {e}")

        return ticket

    async def add_comment(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        content: str,
        is_internal: bool,
        actor_id: UUID,
        org_id: UUID,
        is_supplier: bool = False,
    ) -> TicketComment:
        if is_internal and is_supplier:
            raise ForbiddenError(
                "Suppliers cannot add internal notes to tickets",
                "SUPPLIER_CANNOT_ADD_INTERNAL",
            )

        ticket = await self.repo.get(db, ticket_id, org_id)
        mentioned_ids = await self.mentions.parse(db, content, org_id)

        comment = TicketComment(
            org_id=org_id,
            ticket_id=ticket_id,
            author_id=actor_id,
            content=content,
            is_internal=is_internal,
            mentioned_users=mentioned_ids,
        )
        db.add(comment)
        await db.flush()

        # Auto-add mentions as watchers
        for uid in mentioned_ids:
            existing = await self.repo.get_watcher(db, ticket_id, uid, org_id)
            if not existing:
                db.add(
                    TicketWatcher(
                        org_id=org_id,
                        ticket_id=ticket_id,
                        user_id=uid,
                        added_by=actor_id,
                    )
                )

        # Track first response
        if ticket.assigned_to == actor_id and not ticket.first_response_at:
            ticket.first_response_at = datetime.now(timezone.utc)

        # PENDING_RESPONSE → IN_PROGRESS when raiser replies
        if ticket.status == "PENDING_RESPONSE" and actor_id == ticket.raised_by:
            ticket.status = "IN_PROGRESS"
            await self._log(
                db,
                ticket_id,
                actor_id,
                org_id,
                "STATUS_CHANGE",
                old_value="PENDING_RESPONSE",
                new_value="IN_PROGRESS",
            )

        activity = "INTERNAL_NOTE_ADDED" if is_internal else "COMMENT_ADDED"
        await self._log(db, ticket_id, actor_id, org_id, activity)

        await self.publisher.publish(
            db,
            "procurement.ticket",
            "ticket.comment.added",
            {
                "ticket_id": str(ticket_id),
                "comment_id": str(comment.id),
                "is_internal": is_internal,
                "author_id": str(actor_id),
                "mentioned_users": [str(u) for u in mentioned_ids],
                "org_id": str(org_id),
            },
            org_id,
        )

        # Real-time push via existing WebSocket Redis pub/sub
        try:
            watchers = await self.repo.get_watchers(db, ticket_id, org_id)
            supplier_ids = await self._get_supplier_user_ids(db, org_id)
            for w in watchers:
                if w.user_id == actor_id:
                    continue
                if is_internal and str(w.user_id) in supplier_ids:
                    continue  # Never push internal notes to suppliers
                await self.redis.publish(
                    RedisKeys.notification_channel(w.user_id),
                    json.dumps({
                        "notification_type": "TICKET_UPDATE",
                        "ticket_id": str(ticket_id),
                        "ticket_number": ticket.ticket_number,
                        "event": "NEW_COMMENT",
                        "is_internal": is_internal,
                        "author_id": str(actor_id),
                        "content": content[:100],
                    }),
                )
        except Exception as e:
            logger.warning(f"Error publishing comment notification to Redis: {e}")

        # Index comment in Elasticsearch
        try:
            await self.search_service.index_comment(comment, ticket)
        except Exception as e:
            logger.warning(f"Error updating comment in ES: {e}")

        return comment

    async def edit_comment(
        self,
        db: AsyncSession,
        comment_id: UUID,
        content: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> TicketComment:
        comment = await self.repo.get_comment(db, comment_id, org_id)
        if comment.author_id != actor_id:
            raise ForbiddenError("Only the comment author can edit", "NOT_COMMENT_AUTHOR")

        created_dt = comment.created_at
        if created_dt.tzinfo is None:
            created_dt = created_dt.replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - created_dt).total_seconds()
        if elapsed > settings.TICKET_COMMENT_EDIT_WINDOW_SECONDS:
            raise AppException(
                message="Comments can only be edited within 15 minutes of posting",
                code="EDIT_WINDOW_CLOSED",
                status_code=409,
                details={
                    "elapsed_seconds": int(elapsed),
                    "max_seconds": settings.TICKET_COMMENT_EDIT_WINDOW_SECONDS,
                },
            )

        comment.content = content
        comment.edited_at = datetime.now(timezone.utc)
        comment.edited_by = actor_id
        return comment

    async def delete_comment(
        self,
        db: AsyncSession,
        comment_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        comment = await self.repo.get_comment(db, comment_id, org_id)
        is_admin = await self._is_admin(db, actor_id, org_id)
        if comment.author_id != actor_id and not is_admin:
            raise ForbiddenError(
                "Only the author or admin can delete a comment",
                "NOT_COMMENT_AUTHOR",
            )
        comment.deleted_at = datetime.now(timezone.utc)

    async def get_comments(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        org_id: UUID,
        is_supplier: bool,
        cursor: str | None = None,
        limit: int = 20,
    ) -> tuple[list[TicketComment], bool]:
        query = (
            select(TicketComment)
            .where(TicketComment.ticket_id == ticket_id)
            .where(TicketComment.org_id == org_id)
            .where(TicketComment.deleted_at.is_(None))
        )
        # Suppliers NEVER see internal notes — enforced at DB query level
        if is_supplier:
            query = query.where(TicketComment.is_internal.is_(False))

        if cursor:
            from app.core.pagination import decode_cursor
            try:
                last_id = decode_cursor(cursor)
                query = query.where(TicketComment.id > last_id)
            except Exception as e:
                logger.debug("Failed to decode cursor {}: {}", cursor, e)

        result = await db.execute(
            query.order_by(TicketComment.created_at.asc()).limit(limit + 1)
        )
        rows = list(result.scalars().all())
        has_more = len(rows) > limit
        return rows[:limit], has_more

    async def assign(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        user_id: UUID,
        team: str | None,
        actor_id: UUID,
        org_id: UUID,
    ) -> Ticket:
        ticket = await self.repo.get(db, ticket_id, org_id)
        old_assignee = ticket.assigned_to
        ticket.assigned_to = user_id
        ticket.assigned_team = team
        if ticket.status == "OPEN":
            ticket.status = "IN_PROGRESS"

        # Add new assignee as watcher
        existing = await self.repo.get_watcher(db, ticket_id, user_id, org_id)
        if not existing:
            db.add(
                TicketWatcher(
                    org_id=org_id,
                    ticket_id=ticket_id,
                    user_id=user_id,
                    added_by=actor_id,
                )
            )

        await self._log(
            db,
            ticket_id,
            actor_id,
            org_id,
            "ASSIGNMENT_CHANGE",
            old_value=str(old_assignee) if old_assignee else None,
            new_value=str(user_id),
        )

        await self.publisher.publish(
            db,
            "procurement.ticket",
            "ticket.assigned",
            {
                "ticket_id": str(ticket_id),
                "ticket_number": ticket.ticket_number,
                "new_assignee_id": str(user_id),
                "org_id": str(org_id),
            },
            org_id,
        )

        await self.audit.log(
            db,
            "TICKET",
            ticket_id,
            "TICKET_ASSIGNED",
            actor_id,
            org_id,
            old_values={"assigned_to": str(old_assignee) if old_assignee else None},
            new_values={"assigned_to": str(user_id)},
        )

        return ticket

    async def start_progress(
        self, db: AsyncSession, ticket_id: UUID, actor_id: UUID, org_id: UUID
    ) -> Ticket:
        ticket = await self.repo.get(db, ticket_id, org_id)
        validate_ticket_transition(ticket.status, "IN_PROGRESS")
        old_status = ticket.status
        ticket.status = "IN_PROGRESS"
        if not ticket.assigned_to:
            ticket.assigned_to = actor_id

        await self._log(
            db,
            ticket_id,
            actor_id,
            org_id,
            "STATUS_CHANGE",
            old_value=old_status,
            new_value="IN_PROGRESS",
        )
        return ticket

    async def resolve(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        resolution_note: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> Ticket:
        ticket = await self.repo.get(db, ticket_id, org_id)
        validate_ticket_transition(ticket.status, "RESOLVED")

        if not resolution_note or len(resolution_note.strip()) < 10:
            raise ValidationError(
                "Resolution note must be at least 10 characters",
                "RESOLUTION_NOTE_REQUIRED",
                {"min_length": 10},
            )

        old_status = ticket.status
        ticket.status = "RESOLVED"
        ticket.resolution_note = resolution_note.strip()
        ticket.resolved_at = datetime.now(timezone.utc)

        await self._log(
            db,
            ticket_id,
            actor_id,
            org_id,
            "TICKET_RESOLVED",
            old_value=old_status,
            new_value="RESOLVED",
        )

        await self.publisher.publish(
            db,
            "procurement.ticket",
            "ticket.resolved",
            {
                "ticket_id": str(ticket_id),
                "ticket_number": ticket.ticket_number,
                "resolved_by": str(actor_id),
                "resolution_note": resolution_note[:200],
                "raised_by": str(ticket.raised_by),
                "org_id": str(org_id),
            },
            org_id,
        )

        await self.audit.log(
            db,
            "TICKET",
            ticket_id,
            "TICKET_RESOLVED",
            actor_id,
            org_id,
            old_values={"status": old_status},
            new_values={"status": "RESOLVED"},
        )

        return ticket

    async def close(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        actor_id: UUID,
        org_id: UUID,
        is_supplier: bool = False,
        closure_reason: str = "User closed",
    ) -> Ticket:
        ticket = await self.repo.get(db, ticket_id, org_id)
        validate_ticket_transition(ticket.status, "CLOSED", is_supplier=is_supplier)

        old_status = ticket.status
        ticket.status = "CLOSED"

        await self._log(
            db,
            ticket_id,
            actor_id,
            org_id,
            "TICKET_CLOSED",
            old_value=old_status,
            new_value=f"CLOSED reason={closure_reason}",
        )

        await self.publisher.publish(
            db,
            "procurement.ticket",
            "ticket.closed",
            {
                "ticket_id": str(ticket_id),
                "ticket_number": ticket.ticket_number,
                "closure_reason": closure_reason,
                "closed_by": str(actor_id),
                "org_id": str(org_id),
            },
            org_id,
        )

        await self.audit.log(
            db,
            "TICKET",
            ticket_id,
            "TICKET_CLOSED",
            actor_id,
            org_id,
            old_values={"status": old_status},
            new_values={"status": "CLOSED"},
        )

        return ticket

    async def reopen(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        reason: str,
        actor_id: UUID,
        org_id: UUID,
        is_supplier: bool = False,
    ) -> Ticket:
        ticket = await self.repo.get(db, ticket_id, org_id)

        if is_supplier and ticket.raised_by != actor_id:
            raise ForbiddenError(
                "Suppliers can only reopen their own tickets",
                "NOT_TICKET_OWNER",
            )

        validate_ticket_transition(ticket.status, "REOPENED", is_supplier=is_supplier)

        if not reason or len(reason.strip()) < settings.TICKET_REOPEN_REASON_MIN_LENGTH:
            raise ValidationError(
                f"Reopen reason must be at least {settings.TICKET_REOPEN_REASON_MIN_LENGTH} characters",
                "REOPEN_REASON_REQUIRED",
            )

        if ticket.status == "CLOSED" and not await self._is_admin(db, actor_id, org_id):
            updated_dt = ticket.updated_at
            if updated_dt.tzinfo is None:
                updated_dt = updated_dt.replace(tzinfo=timezone.utc)
            days_closed = (datetime.now(timezone.utc) - updated_dt).days
            if days_closed > settings.TICKET_REOPEN_MAX_DAYS:
                raise AppException(
                    message=f"Tickets can only be reopened within {settings.TICKET_REOPEN_MAX_DAYS} days of closing",
                    code="REOPEN_WINDOW_EXPIRED",
                    status_code=409,
                )

        old_status = ticket.status
        ticket.status = "REOPENED"
        ticket.reopen_count += 1
        ticket.resolved_at = None
        ticket.resolution_note = None

        # Reset SLA breach time from now
        now = datetime.now(timezone.utc)
        ticket.sla_breach_at = await self.sla.compute_breach_at(db, org_id, ticket.priority, now)
        ticket.sla_status = "WITHIN_SLA"

        await self._log(
            db,
            ticket_id,
            actor_id,
            org_id,
            "TICKET_REOPENED",
            old_value=old_status,
            new_value=f"REOPENED (count={ticket.reopen_count}) reason={reason}",
        )

        await self.publisher.publish(
            db,
            "procurement.ticket",
            "ticket.reopened",
            {
                "ticket_id": str(ticket_id),
                "reason": reason,
                "reopen_count": ticket.reopen_count,
                "org_id": str(org_id),
            },
            org_id,
        )

        return ticket

    async def escalate(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        reason: str,
        escalate_to_user_id: UUID | None,
        actor_id: UUID,
        org_id: UUID,
    ) -> Ticket:
        ticket = await self.repo.get(db, ticket_id, org_id)
        validate_ticket_transition(ticket.status, "ESCALATED")

        if not reason or len(reason.strip()) < 5:
            raise ValidationError(
                "Escalation reason must be at least 5 characters",
                "ESCALATION_REASON_REQUIRED",
            )

        old_status = ticket.status
        ticket.status = "ESCALATED"
        if escalate_to_user_id:
            ticket.assigned_to = escalate_to_user_id
            existing = await self.repo.get_watcher(db, ticket_id, escalate_to_user_id, org_id)
            if not existing:
                db.add(
                    TicketWatcher(
                        org_id=org_id,
                        ticket_id=ticket_id,
                        user_id=escalate_to_user_id,
                        added_by=actor_id,
                    )
                )

        await self._log(
            db,
            ticket_id,
            actor_id,
            org_id,
            "TICKET_ESCALATED",
            old_value=old_status,
            new_value=f"ESCALATED reason={reason}",
        )

        await self.publisher.publish(
            db,
            "procurement.ticket",
            "ticket.escalated",
            {
                "ticket_id": str(ticket_id),
                "ticket_number": ticket.ticket_number,
                "reason": reason,
                "escalated_by": str(actor_id),
                "org_id": str(org_id),
            },
            org_id,
        )

        return ticket

    async def set_pending_response(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> Ticket:
        ticket = await self.repo.get(db, ticket_id, org_id)
        validate_ticket_transition(ticket.status, "PENDING_RESPONSE")
        old_status = ticket.status
        ticket.status = "PENDING_RESPONSE"

        await self._log(
            db,
            ticket_id,
            actor_id,
            org_id,
            "STATUS_CHANGE",
            old_value=old_status,
            new_value="PENDING_RESPONSE",
        )
        return ticket

    async def update(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        data: TicketUpdateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Ticket:
        ticket = await self.repo.get(db, ticket_id, org_id)

        if data.title is not None:
            ticket.title = data.title
        if data.description is not None:
            ticket.description = data.description
        if data.category is not None:
            ticket.category = data.category
        if data.tags is not None:
            ticket.tags = data.tags
        if data.is_private is not None:
            ticket.is_private = data.is_private
        if data.priority is not None and data.priority != ticket.priority:
            old_priority = ticket.priority
            ticket.priority = data.priority
            now = datetime.now(timezone.utc)
            ticket.sla_breach_at = await self.sla.compute_breach_at(db, org_id, data.priority, now)
            await self._log(
                db,
                ticket_id,
                actor_id,
                org_id,
                "PRIORITY_CHANGE",
                old_value=old_priority,
                new_value=data.priority,
            )

        if data.due_date is not None:
            ticket.due_date = data.due_date

        if getattr(data, "custom_fields", None) is not None:
            for cf in data.custom_fields:
                stmt = select(TicketCustomFieldValue).where(
                    TicketCustomFieldValue.ticket_id == ticket_id,
                    TicketCustomFieldValue.field_def_id == cf.field_def_id,
                    TicketCustomFieldValue.org_id == org_id,
                    TicketCustomFieldValue.deleted_at.is_(None),
                )
                res = await db.execute(stmt)
                existing_cf = res.scalar_one_or_none()
                if existing_cf:
                    existing_cf.value_text = cf.value_text
                    existing_cf.value_number = cf.value_number
                    existing_cf.value_json = cf.value_json
                    existing_cf.updated_at = datetime.now(timezone.utc)
                else:
                    db.add(
                        TicketCustomFieldValue(
                            org_id=org_id,
                            ticket_id=ticket.id,
                            field_def_id=cf.field_def_id,
                            value_text=cf.value_text,
                            value_number=cf.value_number,
                            value_json=cf.value_json,
                        )
                    )

        ticket.updated_at = datetime.now(timezone.utc)

        # Trigger automation on field changed
        try:
            await self.automation.trigger(
                db,
                "FIELD_CHANGED",
                ticket,
                org_id,
                {"priority": ticket.priority, "due_date": str(ticket.due_date) if ticket.due_date else None},
            )
        except Exception as e:
            logger.warning(f"Error executing automation rules on update for ticket {ticket.id}: {e}")

        return ticket

    async def soft_delete(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        ticket = await self.repo.get(db, ticket_id, org_id)
        ticket.deleted_at = datetime.now(timezone.utc)
        await self._log(db, ticket_id, actor_id, org_id, "TICKET_DELETED")

    async def get_list(
        self,
        db: AsyncSession,
        filters: TicketFilters,
        actor_id: UUID,
        org_id: UUID,
        is_supplier: bool,
    ) -> tuple[list[Ticket], int]:
        query = (
            select(Ticket)
            .where(Ticket.org_id == org_id)
            .where(Ticket.deleted_at.is_(None))
        )

        # SQL-level visibility filter
        if is_supplier:
            query = query.where(Ticket.raised_by == actor_id)
        else:
            is_admin = await self._is_admin(db, actor_id, org_id)
            if not is_admin:
                query = query.where(
                    or_(
                        Ticket.is_private.is_(False),
                        Ticket.raised_by == actor_id,
                        Ticket.assigned_to == actor_id,
                    )
                )
            if filters.view_scope == "my_tickets":
                query = query.where(Ticket.raised_by == actor_id)
            elif filters.view_scope == "assigned_to_me":
                query = query.where(Ticket.assigned_to == actor_id)

        if filters.status:
            query = query.where(Ticket.status == filters.status)
        if filters.priority:
            query = query.where(Ticket.priority == filters.priority)
        if filters.ticket_type:
            query = query.where(Ticket.ticket_type == filters.ticket_type)
        if filters.entity_type:
            query = query.where(Ticket.entity_type == filters.entity_type)
        if filters.entity_id:
            query = query.where(Ticket.entity_id == filters.entity_id)
        if filters.tags:
            query = query.where(Ticket.tags.overlap(filters.tags))
        if filters.date_from:
            query = query.where(Ticket.created_at >= filters.date_from)
        if filters.date_to:
            query = query.where(Ticket.created_at <= filters.date_to)
        if getattr(filters, "due_date_from", None):
            query = query.where(Ticket.due_date >= filters.due_date_from)
        if getattr(filters, "due_date_to", None):
            query = query.where(Ticket.due_date <= filters.due_date_to)

        count = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
        result = await db.execute(
            query.order_by(Ticket.created_at.desc()).limit(filters.limit).offset(filters.offset)
        )
        return list(result.scalars().all()), count

    async def get_detail(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        actor_id: UUID,
        org_id: UUID,
        is_supplier: bool,
    ) -> Ticket:
        ticket = await self.repo.get(db, ticket_id, org_id)
        if is_supplier and ticket.raised_by != actor_id:
            raise ForbiddenError("Suppliers can only view their own tickets", "FORBIDDEN")
        if not is_supplier and ticket.is_private:
            is_admin = await self._is_admin(db, actor_id, org_id)
            if not is_admin and ticket.raised_by != actor_id and ticket.assigned_to != actor_id:
                raise ForbiddenError("Access to this private ticket is restricted", "FORBIDDEN")
        return ticket

    async def get_dashboard(self, db: AsyncSession, actor_id: UUID, org_id: UUID) -> dict[str, Any]:
        base = select(Ticket).where(Ticket.org_id == org_id).where(Ticket.deleted_at.is_(None))

        by_status = {}
        for s in ["OPEN", "IN_PROGRESS", "PENDING_RESPONSE", "ESCALATED", "RESOLVED", "CLOSED", "REOPENED"]:
            r = await db.execute(
                select(func.count()).select_from(base.where(Ticket.status == s).subquery())
            )
            by_status[s] = r.scalar() or 0

        by_priority = {}
        for p in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
            r = await db.execute(
                select(func.count()).select_from(
                    base.where(Ticket.priority == p)
                    .where(Ticket.status.not_in(["CLOSED", "RESOLVED"]))
                    .subquery()
                )
            )
            by_priority[p] = r.scalar() or 0

        my_open = (
            await db.execute(
                select(func.count()).select_from(
                    base.where(Ticket.raised_by == actor_id)
                    .where(Ticket.status.not_in(["CLOSED", "RESOLVED"]))
                    .subquery()
                )
            )
        ).scalar() or 0

        assigned_to_me = (
            await db.execute(
                select(func.count()).select_from(
                    base.where(Ticket.assigned_to == actor_id)
                    .where(Ticket.status.not_in(["CLOSED"]))
                    .subquery()
                )
            )
        ).scalar() or 0

        breached = (
            await db.execute(
                select(func.count()).select_from(
                    base.where(Ticket.sla_status == "BREACHED")
                    .where(Ticket.status.not_in(["CLOSED", "RESOLVED"]))
                    .subquery()
                )
            )
        ).scalar() or 0

        total = sum(by_status.values())
        open_count = sum(v for k, v in by_status.items() if k not in ["CLOSED", "RESOLVED"])
        compliance_pct = round(((total - breached) / total * 100), 1) if total > 0 else 100.0

        return {
            "total_tickets": total,
            "open_tickets": open_count,
            "sla_compliance_pct": compliance_pct,
            "by_status": by_status,
            "by_priority": by_priority,
            "my_open_tickets": my_open,
            "assigned_to_me": assigned_to_me,
            "sla_breached": breached,
        }

    async def add_watcher(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        user_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> TicketWatcher:
        await self.repo.get(db, ticket_id, org_id)
        existing = await self.repo.get_watcher(db, ticket_id, user_id, org_id)
        if existing:
            return existing

        watcher = TicketWatcher(
            org_id=org_id,
            ticket_id=ticket_id,
            user_id=user_id,
            added_by=actor_id,
        )
        db.add(watcher)
        await self._log(
            db,
            ticket_id,
            actor_id,
            org_id,
            "WATCHER_ADDED",
            new_value=str(user_id),
        )
        return watcher

    async def remove_watcher(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        user_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        watcher = await self.repo.get_watcher(db, ticket_id, user_id, org_id)
        if watcher:
            watcher.deleted_at = datetime.now(timezone.utc)
            await self._log(
                db,
                ticket_id,
                actor_id,
                org_id,
                "WATCHER_REMOVED",
                old_value=str(user_id),
            )

    async def attach_file(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        document_id: UUID,
        file_name: str,
        actor_id: UUID,
        org_id: UUID,
        comment_id: UUID | None = None,
    ) -> TicketAttachment:
        await self.repo.get(db, ticket_id, org_id)
        attachment = TicketAttachment(
            org_id=org_id,
            ticket_id=ticket_id,
            comment_id=comment_id,
            document_id=document_id,
            uploaded_by=actor_id,
            file_name=file_name,
        )
        db.add(attachment)
        await self._log(
            db,
            ticket_id,
            actor_id,
            org_id,
            "ATTACHMENT_ADDED",
            new_value=file_name,
        )
        return attachment

    async def remove_attachment(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        attachment_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        stmt = select(TicketAttachment).where(
            TicketAttachment.id == attachment_id,
            TicketAttachment.ticket_id == ticket_id,
            TicketAttachment.org_id == org_id,
            TicketAttachment.deleted_at.is_(None),
        )
        res = await db.execute(stmt)
        att = res.scalar_one_or_none()
        if att:
            att.deleted_at = datetime.now(timezone.utc)
            await self._log(
                db,
                ticket_id,
                actor_id,
                org_id,
                "ATTACHMENT_REMOVED",
                old_value=att.file_name,
            )

    async def update_sla_config(
        self,
        db: AsyncSession,
        configs: list[TicketSLAConfigRequest],
        actor_id: UUID,
        org_id: UUID,
    ) -> list[TicketSLAConfig]:
        results: list[TicketSLAConfig] = []
        for cfg in configs:
            stmt = select(TicketSLAConfig).where(
                TicketSLAConfig.org_id == org_id,
                TicketSLAConfig.priority == cfg.priority,
                TicketSLAConfig.deleted_at.is_(None),
            )
            res = await db.execute(stmt)
            existing = res.scalar_one_or_none()
            if existing:
                existing.first_response_hours = cfg.first_response_hours
                existing.resolution_hours = cfg.resolution_hours
                existing.escalation_hours = cfg.escalation_hours
                existing.escalate_to_role = cfg.escalate_to_role
                existing.version += 1
                existing.updated_at = datetime.now(timezone.utc)
                results.append(existing)
            else:
                new_cfg = TicketSLAConfig(
                    org_id=org_id,
                    priority=cfg.priority,
                    first_response_hours=cfg.first_response_hours,
                    resolution_hours=cfg.resolution_hours,
                    escalation_hours=cfg.escalation_hours,
                    escalate_to_role=cfg.escalate_to_role,
                )
                db.add(new_cfg)
                results.append(new_cfg)

        await self.audit.log(
            db,
            "TICKET",
            uuid4(),
            "TICKET_SLA_CONFIG_UPDATED",
            actor_id,
            org_id,
            new_values={"count": len(configs)},
        )
        return results

    # --- Ticket Links (Jira Issue Linking) ---
    async def create_link(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        target_ticket_id: UUID,
        link_type: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> TicketLink:
        if ticket_id == target_ticket_id:
            raise ValidationError("Cannot link a ticket to itself", "SELF_LINK_NOT_ALLOWED")

        source_ticket = await self.repo.get(db, ticket_id, org_id)
        target_ticket = await self.repo.get(db, target_ticket_id, org_id)

        # Check existing link
        stmt = select(TicketLink).where(
            TicketLink.source_ticket_id == ticket_id,
            TicketLink.target_ticket_id == target_ticket_id,
            TicketLink.link_type == link_type,
            TicketLink.org_id == org_id,
            TicketLink.deleted_at.is_(None),
        )
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing:
            return existing

        link = TicketLink(
            org_id=org_id,
            source_ticket_id=ticket_id,
            target_ticket_id=target_ticket_id,
            link_type=link_type,
            created_by=actor_id,
        )
        db.add(link)
        await self._log(
            db,
            ticket_id,
            actor_id,
            org_id,
            "LINK_ADDED",
            new_value=f"{link_type} -> {target_ticket.ticket_number}",
        )
        await self.publisher.publish(
            db,
            "procurement.ticket",
            "ticket.link.created",
            {
                "source_ticket_id": str(ticket_id),
                "target_ticket_id": str(target_ticket_id),
                "link_type": link_type,
                "created_by": str(actor_id),
                "org_id": str(org_id),
            },
            org_id,
        )
        return link

    async def remove_link(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        link_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        link = await self.repo.get_link(db, link_id, org_id)
        if link.source_ticket_id != ticket_id and link.target_ticket_id != ticket_id:
            raise ForbiddenError("Link does not belong to this ticket", "LINK_NOT_FOUND")
        link.deleted_at = datetime.now(timezone.utc)
        await self._log(
            db,
            ticket_id,
            actor_id,
            org_id,
            "LINK_REMOVED",
            old_value=f"{link.link_type} -> {link.target_ticket_id}",
        )

    async def get_ticket_links(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        org_id: UUID,
    ) -> list[dict[str, Any]]:
        links = await self.repo.get_links(db, ticket_id, org_id)
        results: list[dict[str, Any]] = []
        if not links:
            return results

        inverse_map = {
            "BLOCKS": "IS_BLOCKED_BY",
            "IS_BLOCKED_BY": "BLOCKS",
            "DUPLICATES": "IS_DUPLICATED_BY",
            "IS_DUPLICATED_BY": "DUPLICATES",
            "CLONES": "IS_CLONED_BY",
            "IS_CLONED_BY": "CLONES",
            "RELATES_TO": "RELATES_TO",
        }

        # Batch fetch all target/source tickets in 1 query to prevent N+1 queries
        other_ids = [
            l.target_ticket_id if l.source_ticket_id == ticket_id else l.source_ticket_id
            for l in links
        ]
        target_map = {}
        if hasattr(self.repo, "get_by_ids"):
            try:
                targets = await self.repo.get_by_ids(db, other_ids, org_id)
                target_map = {t.id: t for t in targets}
            except Exception:
                target_map = {}

        for l in links:
            is_source = (l.source_ticket_id == ticket_id)
            target_id = l.target_ticket_id if is_source else l.source_ticket_id
            target = target_map.get(target_id)
            if target is None:
                try:
                    target = await self.repo.get(db, target_id, org_id)
                except Exception:
                    target = None

            link_type = l.link_type if is_source else inverse_map.get(l.link_type, l.link_type)
            results.append({
                "id": l.id,
                "source_ticket_id": l.source_ticket_id if is_source else l.target_ticket_id,
                "target_ticket_id": l.target_ticket_id if is_source else l.source_ticket_id,
                "link_type": link_type,
                "created_by": l.created_by,
                "created_at": l.created_at,
                "target_ticket_number": getattr(target, "ticket_number", "UNKNOWN") if target else "UNKNOWN",
                "target_ticket_title": getattr(target, "title", "Unknown Ticket") if target else "Unknown Ticket",
                "target_ticket_status": getattr(target, "status", "UNKNOWN") if target else "UNKNOWN",
                "target_ticket_priority": getattr(target, "priority", "UNKNOWN") if target else "UNKNOWN",
            })
        return results

    # --- Custom Fields ---
    async def create_custom_field_def(
        self,
        db: AsyncSession,
        data: CustomFieldDefCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> TicketCustomFieldDef:
        existing = await self.repo.get_custom_field_def_by_key(db, data.field_key, org_id)
        if existing:
            raise ValidationError(f"Field key '{data.field_key}' already exists", "FIELD_KEY_EXISTS")

        cf_def = TicketCustomFieldDef(
            org_id=org_id,
            name=data.name,
            field_key=data.field_key,
            field_type=data.field_type,
            description=data.description,
            is_required=data.is_required,
            default_value=data.default_value,
            options=data.options or [],
            applies_to_ticket_types=data.applies_to_ticket_types or [],
            created_by=actor_id,
        )
        db.add(cf_def)
        await self.audit.log(
            db,
            "TICKET_CUSTOM_FIELD_DEF",
            cf_def.id,
            "CUSTOM_FIELD_DEF_CREATED",
            actor_id,
            org_id,
            new_values={"key": data.field_key, "type": data.field_type},
        )
        return cf_def

    async def update_custom_field_def(
        self,
        db: AsyncSession,
        field_def_id: UUID,
        data: CustomFieldDefUpdateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> TicketCustomFieldDef:
        cf_def = await self.repo.get_custom_field_def(db, field_def_id, org_id)
        if data.name is not None:
            cf_def.name = data.name
        if data.description is not None:
            cf_def.description = data.description
        if data.is_required is not None:
            cf_def.is_required = data.is_required
        if data.default_value is not None:
            cf_def.default_value = data.default_value
        if data.options is not None:
            cf_def.options = data.options
        if data.applies_to_ticket_types is not None:
            cf_def.applies_to_ticket_types = data.applies_to_ticket_types
        cf_def.updated_at = datetime.now(timezone.utc)
        return cf_def

    async def delete_custom_field_def(
        self,
        db: AsyncSession,
        field_def_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        cf_def = await self.repo.get_custom_field_def(db, field_def_id, org_id)
        cf_def.deleted_at = datetime.now(timezone.utc)

    async def get_custom_field_defs(
        self,
        db: AsyncSession,
        org_id: UUID,
        ticket_type: str | None = None,
    ) -> list[TicketCustomFieldDef]:
        defs = await self.repo.get_custom_field_defs(db, org_id, ticket_type)
        return list(defs)

    async def get_ticket_custom_field_values(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        org_id: UUID,
    ) -> list[dict[str, Any]]:
        vals = await self.repo.get_custom_field_values(db, ticket_id, org_id)
        results = []
        for v in vals:
            results.append({
                "id": v.id,
                "field_def_id": v.field_def_id,
                "field_key": v.field_def.field_key if v.field_def else None,
                "field_name": v.field_def.name if v.field_def else None,
                "field_type": str(v.field_def.field_type) if v.field_def else None,
                "value_text": v.value_text,
                "value_number": float(v.value_number) if v.value_number is not None else None,
                "value_json": v.value_json,
            })
        return results

    # --- Automation Rules (Jira No-Code Automation) ---
    async def create_automation_rule(
        self,
        db: AsyncSession,
        data: AutomationRuleCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> TicketAutomationRule:
        rule = TicketAutomationRule(
            org_id=org_id,
            name=data.name,
            description=data.description,
            is_enabled=data.is_enabled,
            trigger_type=data.trigger_type,
            trigger_config=data.trigger_config or {},
            conditions=data.conditions or [],
            actions=data.actions or [],
            created_by=actor_id,
        )
        db.add(rule)
        await self.audit.log(
            db,
            "TICKET_AUTOMATION_RULE",
            rule.id,
            "AUTOMATION_RULE_CREATED",
            actor_id,
            org_id,
            new_values={"name": data.name, "trigger": data.trigger_type},
        )
        return rule

    async def update_automation_rule(
        self,
        db: AsyncSession,
        rule_id: UUID,
        data: AutomationRuleUpdateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> TicketAutomationRule:
        rule = await self.repo.get_automation_rule(db, rule_id, org_id)
        if data.name is not None:
            rule.name = data.name
        if data.description is not None:
            rule.description = data.description
        if data.is_enabled is not None:
            rule.is_enabled = data.is_enabled
        if data.trigger_type is not None:
            rule.trigger_type = data.trigger_type
        if data.trigger_config is not None:
            rule.trigger_config = data.trigger_config
        if data.conditions is not None:
            rule.conditions = data.conditions
        if data.actions is not None:
            rule.actions = data.actions
        rule.updated_at = datetime.now(timezone.utc)
        return rule

    async def delete_automation_rule(
        self,
        db: AsyncSession,
        rule_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        rule = await self.repo.get_automation_rule(db, rule_id, org_id)
        rule.deleted_at = datetime.now(timezone.utc)

    async def get_automation_rules(
        self,
        db: AsyncSession,
        org_id: UUID,
    ) -> list[TicketAutomationRule]:
        rules = await self.repo.get_automation_rules(db, org_id, only_enabled=False)
        return list(rules)

    async def run_automation_rule(
        self,
        db: AsyncSession,
        rule_id: UUID,
        ticket_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> dict[str, Any]:
        rule = await self.repo.get_automation_rule(db, rule_id, org_id)
        ticket = await self.repo.get(db, ticket_id, org_id)
        results = await self.automation._execute_actions(db, rule, ticket, org_id)
        rule.execution_count += 1
        rule.last_executed_at = datetime.now(timezone.utc)
        return {"rule_id": str(rule.id), "ticket_id": str(ticket.id), "actions": results}

    async def _generate_number(self, db: AsyncSession, org_id: UUID) -> str:
        from app.modules.organization.models import Organization
        org = await db.get(Organization, org_id)
        raw_name = org.name if org and org.name else "HKT"
        clean_code = "".join(c for c in raw_name.upper() if c.isalpha())[:3]
        code = clean_code.ljust(3, "X") if len(clean_code) < 3 else clean_code[:3]
        year = datetime.now(timezone.utc).year
        seq = f"seq_tkt_{code.lower()}_{year}"

        for attempt in range(5):
            try:
                await db.execute(text(f"CREATE SEQUENCE IF NOT EXISTS {seq} START 1 INCREMENT 1;"))
                result = await db.execute(text(f"SELECT nextval('{seq}');"))
                n = result.scalar()
                candidate = f"TKT-{code}-{year}-{str(n).zfill(6)}"

                existing = await db.execute(
                    select(Ticket.id).where(Ticket.ticket_number == candidate)
                )
                if existing.scalar_one_or_none() is None:
                    return candidate

                # Existing record found; synchronize sequence to current maximum in database
                max_stmt = select(func.max(Ticket.ticket_number)).where(
                    Ticket.ticket_number.like(f"TKT-{code}-{year}-%")
                )
                max_res = await db.execute(max_stmt)
                max_val = max_res.scalar()
                if max_val:
                    try:
                        cur_max_num = int(str(max_val).split("-")[-1])
                        await db.execute(text(f"SELECT setval('{seq}', {cur_max_num});"))
                    except (ValueError, IndexError):
                        pass
            except Exception:
                if attempt == 4:
                    raise
        raise RuntimeError(f"Failed to generate unique ticket sequence number for org {org_id} after multiple attempts")

    async def _log(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        actor_id: UUID,
        org_id: UUID,
        activity_type: str,
        old_value: str | None = None,
        new_value: str | None = None,
    ) -> None:
        db.add(
            TicketActivityLog(
                org_id=org_id,
                ticket_id=ticket_id,
                actor_id=actor_id,
                activity_type=activity_type,
                old_value=old_value,
                new_value=new_value,
            )
        )

    async def _is_admin(self, db: AsyncSession, user_id: UUID, org_id: UUID) -> bool:
        from app.modules.user.models import Role, UserRoleAssignment
        stmt = (
            select(Role.code)
            .join(UserRoleAssignment, UserRoleAssignment.role_id == Role.id)
            .where(
                UserRoleAssignment.user_id == user_id,
                Role.org_id == org_id,
                Role.code.in_(["PROCUREMENT_ADMIN", "SUPERADMIN", "ORG_ADMIN"]),
                Role.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return len(res.scalars().all()) > 0

    async def _get_supplier_user_ids(self, db: AsyncSession, org_id: UUID) -> set[str]:
        from app.modules.user.models import User
        stmt = select(User.id).where(
            User.org_id == org_id,
            User.is_supplier_user,
            User.deleted_at.is_(None),
        )
        res = await db.execute(stmt)
        return {str(uid) for uid in res.scalars().all()}


ticket_service = TicketService()
