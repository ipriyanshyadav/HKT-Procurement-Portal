from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.repository_base import BaseRepository
from app.modules.ticket.models import (
    Ticket,
    TicketActivityLog,
    TicketComment,
    TicketSLAConfig,
    TicketWatcher,
)


class TicketRepository(BaseRepository[Ticket]):
    def __init__(self) -> None:
        super().__init__(Ticket)

    async def get_by_number(
        self, db: AsyncSession, ticket_number: str, org_id: UUID
    ) -> Ticket | None:
        stmt = select(Ticket).where(
            Ticket.ticket_number == ticket_number,
            Ticket.org_id == org_id,
            Ticket.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_with_sla(self, db: AsyncSession) -> Sequence[Ticket]:
        """Tickets with status IN ('OPEN', 'IN_PROGRESS', 'PENDING_RESPONSE')
        and sla_breach_at IS NOT NULL and deleted_at IS NULL.
        """
        stmt = select(Ticket).where(
            Ticket.status.in_(["OPEN", "IN_PROGRESS", "PENDING_RESPONSE"]),
            Ticket.sla_breach_at.is_not(None),
            Ticket.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get_stale_resolved(
        self, db: AsyncSession, cutoff_dt: datetime
    ) -> Sequence[Ticket]:
        """RESOLVED tickets with updated_at < cutoff and deleted_at IS NULL."""
        stmt = select(Ticket).where(
            Ticket.status == "RESOLVED",
            Ticket.updated_at < cutoff_dt,
            Ticket.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get_stale_pending_response(
        self, db: AsyncSession, cutoff_dt: datetime
    ) -> Sequence[Ticket]:
        """PENDING_RESPONSE tickets with updated_at < cutoff and deleted_at IS NULL."""
        stmt = select(Ticket).where(
            Ticket.status == "PENDING_RESPONSE",
            Ticket.updated_at < cutoff_dt,
            Ticket.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get_watchers(
        self, db: AsyncSession, ticket_id: UUID, org_id: UUID
    ) -> Sequence[TicketWatcher]:
        stmt = select(TicketWatcher).where(
            TicketWatcher.ticket_id == ticket_id,
            TicketWatcher.org_id == org_id,
            TicketWatcher.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get_watcher(
        self, db: AsyncSession, ticket_id: UUID, user_id: UUID, org_id: UUID
    ) -> TicketWatcher | None:
        stmt = select(TicketWatcher).where(
            TicketWatcher.ticket_id == ticket_id,
            TicketWatcher.user_id == user_id,
            TicketWatcher.org_id == org_id,
            TicketWatcher.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_comment(
        self, db: AsyncSession, comment_id: UUID, org_id: UUID
    ) -> TicketComment:
        stmt = select(TicketComment).where(
            TicketComment.id == comment_id,
            TicketComment.org_id == org_id,
            TicketComment.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        comment = result.scalar_one_or_none()
        if not comment:
            raise NotFoundError("ticket_comments", str(comment_id))
        return comment

    async def get_activity(
        self, db: AsyncSession, ticket_id: UUID, org_id: UUID
    ) -> Sequence[TicketActivityLog]:
        stmt = (
            select(TicketActivityLog)
            .where(
                TicketActivityLog.ticket_id == ticket_id,
                TicketActivityLog.org_id == org_id,
            )
            .order_by(TicketActivityLog.created_at.asc())
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get_all_sla_configs(
        self, db: AsyncSession, org_id: UUID
    ) -> Sequence[TicketSLAConfig]:
        stmt = (
            select(TicketSLAConfig)
            .where(
                TicketSLAConfig.org_id == org_id,
                TicketSLAConfig.deleted_at.is_(None),
            )
            .order_by(TicketSLAConfig.priority.asc())
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get_sla_config(
        self, db: AsyncSession, org_id: UUID, priority: str
    ) -> TicketSLAConfig | None:
        stmt = select(TicketSLAConfig).where(
            TicketSLAConfig.org_id == org_id,
            TicketSLAConfig.priority == priority,
            TicketSLAConfig.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_unique_assignees_with_open_tickets(
        self, db: AsyncSession
    ) -> Sequence[tuple[UUID, UUID, int, int]]:
        """Returns list of (assigned_to, org_id, open_count, breached_count) for digest task."""
        stmt = (
            select(
                Ticket.assigned_to,
                Ticket.org_id,
                func.count().label("open_count"),
                func.count()
                .filter(Ticket.sla_status == "BREACHED")
                .label("breached_count"),
            )
            .where(
                Ticket.assigned_to.is_not(None),
                Ticket.status.in_(["OPEN", "IN_PROGRESS", "PENDING_RESPONSE", "ESCALATED", "REOPENED"]),
                Ticket.deleted_at.is_(None),
            )
            .group_by(Ticket.assigned_to, Ticket.org_id)
        )
        result = await db.execute(stmt)
        return result.all()


ticket_repository = TicketRepository()
