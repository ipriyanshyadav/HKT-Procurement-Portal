from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from loguru import logger
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException, ForbiddenError, ValidationError
from app.core.redis_client import RedisKeys, get_redis_client
from app.events.publisher import OutboxPublisher
from app.modules.audit.service import audit_service
from app.modules.ticket.fsm import validate_ticket_transition
from app.modules.ticket.mention_parser import MentionParser
from app.modules.ticket.models import (
    Ticket,
    TicketActivityLog,
    TicketAttachment,
    TicketComment,
    TicketSLAConfig,
    TicketWatcher,
)
from app.modules.ticket.repository import TicketRepository, ticket_repository
from app.modules.ticket.schemas import (
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

    async def create(
        self,
        db: AsyncSession,
        data: TicketCreateRequest,
        actor_id: UUID,
        org_id: UUID,
        portal: str = "buyer",
    ) -> Ticket:
        ticket_number = await self._generate_number(db, org_id)
        now = datetime.utcnow()
        sla_breach_at = await self.sla.compute_breach_at(db, org_id, data.priority, now)

        ticket = Ticket(
            org_id=org_id,
            ticket_number=ticket_number,
            title=data.title,
            description=data.description,
            ticket_type=data.ticket_type,
            priority=data.priority,
            category=data.category,
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
            ticket.first_response_at = datetime.utcnow()

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

        created_dt = comment.created_at.replace(tzinfo=None) if comment.created_at.tzinfo else comment.created_at
        elapsed = (datetime.utcnow() - created_dt).total_seconds()
        if elapsed > 900:  # 15 minutes structural constraint per spec
            raise AppException(
                message="Comments can only be edited within 15 minutes of posting",
                code="EDIT_WINDOW_CLOSED",
                status_code=409,
                details={"elapsed_seconds": int(elapsed), "max_seconds": 900},
            )

        comment.content = content
        comment.edited_at = datetime.utcnow()
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
        comment.deleted_at = datetime.utcnow()

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
        ticket.resolved_at = datetime.utcnow()

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

        if not reason or len(reason.strip()) < 5:
            raise ValidationError(
                "Reopen reason must be at least 5 characters",
                "REOPEN_REASON_REQUIRED",
            )

        if ticket.status == "CLOSED" and not await self._is_admin(db, actor_id, org_id):
            updated_dt = ticket.updated_at.replace(tzinfo=None) if ticket.updated_at.tzinfo else ticket.updated_at
            days_closed = (datetime.utcnow() - updated_dt).days
            if days_closed > 30:
                raise AppException(
                    message="Tickets can only be reopened within 30 days of closing",
                    code="REOPEN_WINDOW_EXPIRED",
                    status_code=409,
                )

        old_status = ticket.status
        ticket.status = "REOPENED"
        ticket.reopen_count += 1
        ticket.resolved_at = None
        ticket.resolution_note = None

        # Reset SLA breach time from now
        now = datetime.utcnow()
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
            now = datetime.utcnow()
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

        ticket.updated_at = datetime.utcnow()
        return ticket

    async def soft_delete(
        self,
        db: AsyncSession,
        ticket_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        ticket = await self.repo.get(db, ticket_id, org_id)
        ticket.deleted_at = datetime.utcnow()
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
            watcher.deleted_at = datetime.utcnow()
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
            att.deleted_at = datetime.utcnow()
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
                existing.updated_at = datetime.utcnow()
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

    async def _generate_number(self, db: AsyncSession, org_id: UUID) -> str:
        from app.modules.organization.models import Organization
        org = await db.get(Organization, org_id)
        raw_name = org.name if org and org.name else "HKT"
        clean_code = "".join(c for c in raw_name.upper() if c.isalpha())[:3]
        code = clean_code.ljust(3, "X") if len(clean_code) < 3 else clean_code[:3]
        year = datetime.utcnow().year
        seq = f"seq_tkt_{code.lower()}_{year}"

        for attempt in range(3):
            try:
                await db.execute(text(f"CREATE SEQUENCE IF NOT EXISTS {seq} START 1 INCREMENT 1;"))
                result = await db.execute(text(f"SELECT nextval('{seq}');"))
                n = result.scalar()
                return f"TKT-{code}-{year}-{str(n).zfill(6)}"
            except Exception:
                if attempt == 2:
                    raise
        return None

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
