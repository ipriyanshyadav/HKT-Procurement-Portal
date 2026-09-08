from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.repository_base import BaseRepository
from app.modules.ticket.models import (
    Ticket,
    TicketActivityLog,
    TicketAutomationRule,
    TicketComment,
    TicketCustomFieldDef,
    TicketCustomFieldValue,
    TicketLink,
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

    # --- Links ---
    async def get_links(
        self, db: AsyncSession, ticket_id: UUID, org_id: UUID
    ) -> Sequence[TicketLink]:
        stmt = (
            select(TicketLink)
            .where(
                or_(TicketLink.source_ticket_id == ticket_id, TicketLink.target_ticket_id == ticket_id),
                TicketLink.org_id == org_id,
                TicketLink.deleted_at.is_(None),
            )
            .order_by(TicketLink.created_at.desc())
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get_link(
        self, db: AsyncSession, link_id: UUID, org_id: UUID
    ) -> TicketLink:
        stmt = select(TicketLink).where(
            TicketLink.id == link_id,
            TicketLink.org_id == org_id,
            TicketLink.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        link = result.scalar_one_or_none()
        if not link:
            raise NotFoundError("ticket_links", str(link_id))
        return link

    # --- Custom Fields ---
    async def get_custom_field_defs(
        self, db: AsyncSession, org_id: UUID, ticket_type: str | None = None
    ) -> Sequence[TicketCustomFieldDef]:
        stmt = select(TicketCustomFieldDef).where(
            TicketCustomFieldDef.org_id == org_id,
            TicketCustomFieldDef.deleted_at.is_(None),
        )
        if ticket_type:
            stmt = stmt.where(
                or_(
                    TicketCustomFieldDef.applies_to_ticket_types == [],
                    TicketCustomFieldDef.applies_to_ticket_types.any(ticket_type),
                )
            )
        stmt = stmt.order_by(TicketCustomFieldDef.created_at.asc())
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get_custom_field_def(
        self, db: AsyncSession, field_def_id: UUID, org_id: UUID
    ) -> TicketCustomFieldDef:
        stmt = select(TicketCustomFieldDef).where(
            TicketCustomFieldDef.id == field_def_id,
            TicketCustomFieldDef.org_id == org_id,
            TicketCustomFieldDef.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        fd = result.scalar_one_or_none()
        if not fd:
            raise NotFoundError("ticket_custom_field_defs", str(field_def_id))
        return fd

    async def get_custom_field_def_by_key(
        self, db: AsyncSession, field_key: str, org_id: UUID
    ) -> TicketCustomFieldDef | None:
        stmt = select(TicketCustomFieldDef).where(
            TicketCustomFieldDef.field_key == field_key,
            TicketCustomFieldDef.org_id == org_id,
            TicketCustomFieldDef.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_custom_field_values(
        self, db: AsyncSession, ticket_id: UUID, org_id: UUID
    ) -> Sequence[TicketCustomFieldValue]:
        stmt = select(TicketCustomFieldValue).where(
            TicketCustomFieldValue.ticket_id == ticket_id,
            TicketCustomFieldValue.org_id == org_id,
            TicketCustomFieldValue.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    # --- Automation Rules ---
    async def get_automation_rules(
        self, db: AsyncSession, org_id: UUID, trigger_type: str | None = None, only_enabled: bool = True
    ) -> Sequence[TicketAutomationRule]:
        stmt = select(TicketAutomationRule).where(
            TicketAutomationRule.org_id == org_id,
            TicketAutomationRule.deleted_at.is_(None),
        )
        if only_enabled:
            stmt = stmt.where(TicketAutomationRule.is_enabled.is_(True))
        if trigger_type:
            stmt = stmt.where(TicketAutomationRule.trigger_type == trigger_type)
        stmt = stmt.order_by(TicketAutomationRule.created_at.asc())
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get_automation_rule(
        self, db: AsyncSession, rule_id: UUID, org_id: UUID
    ) -> TicketAutomationRule:
        stmt = select(TicketAutomationRule).where(
            TicketAutomationRule.id == rule_id,
            TicketAutomationRule.org_id == org_id,
            TicketAutomationRule.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        rule = result.scalar_one_or_none()
        if not rule:
            raise NotFoundError("ticket_automation_rules", str(rule_id))
        return rule

    async def count_open_tickets_by_users(
        self, db: AsyncSession, user_ids: list[UUID], org_id: UUID
    ) -> dict[UUID, int]:
        if not user_ids:
            return {}
        stmt = (
            select(Ticket.assigned_to, func.count().label("cnt"))
            .where(
                Ticket.org_id == org_id,
                Ticket.assigned_to.in_(user_ids),
                Ticket.status.in_(["OPEN", "IN_PROGRESS", "PENDING_RESPONSE", "ESCALATED", "REOPENED"]),
                Ticket.deleted_at.is_(None),
            )
            .group_by(Ticket.assigned_to)
        )
        result = await db.execute(stmt)
        counts = {uid: 0 for uid in user_ids}
        for row in result.all():
            if row[0]:
                counts[row[0]] = row[1]
        return counts


ticket_repository = TicketRepository()
