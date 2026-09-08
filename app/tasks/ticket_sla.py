from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone

from app.config import settings
from app.db.session import async_session_factory
from app.events.publisher import OutboxPublisher
from app.modules.ticket.repository import ticket_repository
from app.modules.ticket.sla_service import TicketSLAService
from app.tasks.async_runner import run_async
from app.tasks.celery_app import celery_app

sla_service = TicketSLAService(ticket_repository)


@celery_app.task(queue="critical", name="app.tasks.ticket_sla.check_ticket_sla_timers")
def check_ticket_sla_timers() -> None:
    try:
        run_async(_check_sla())
    except Exception:
        asyncio.run(_check_sla())


@celery_app.task(queue="maintenance", name="app.tasks.ticket_sla.auto_close_idle_tickets")
def auto_close_idle_tickets() -> None:
    try:
        run_async(_auto_close())
    except Exception:
        asyncio.run(_auto_close())


@celery_app.task(queue="notifications", name="app.tasks.ticket_sla.send_ticket_digest")
def send_ticket_digest() -> None:
    try:
        run_async(_send_digest())
    except Exception:
        asyncio.run(_send_digest())


@celery_app.task(queue="critical", name="app.tasks.ticket_sla.check_ticket_due_dates")
def check_ticket_due_dates() -> None:
    try:
        run_async(_check_due_dates())
    except Exception:
        asyncio.run(_check_due_dates())


async def _check_sla() -> None:
    async with async_session_factory() as db:
        tickets = await ticket_repository.get_active_with_sla(db)
        for ticket in tickets:
            if not ticket.sla_breach_at or not ticket.created_at:
                continue

            new_status = sla_service.compute_status(ticket.sla_breach_at, ticket.created_at)
            if new_status == ticket.sla_status:
                continue

            old_status = ticket.sla_status
            ticket.sla_status = new_status

            if new_status == "BREACHED" and old_status != "BREACHED":
                await OutboxPublisher.publish(
                    session=db,
                    exchange_or_event="procurement.ticket",
                    routing_key="ticket.sla.breached",
                    payload={
                        "ticket_id": str(ticket.id),
                        "ticket_number": ticket.ticket_number,
                        "priority": str(ticket.priority),
                        "assigned_to": str(ticket.assigned_to) if ticket.assigned_to else None,
                        "org_id": str(ticket.org_id),
                    },
                    org_id=ticket.org_id,
                )
                # Auto-escalate on breach
                if ticket.status != "ESCALATED":
                    ticket.status = "ESCALATED"
                    await OutboxPublisher.publish(
                        session=db,
                        exchange_or_event="procurement.ticket",
                        routing_key="ticket.escalated",
                        payload={
                            "ticket_id": str(ticket.id),
                            "ticket_number": ticket.ticket_number,
                            "escalation_reason": "SLA_AUTO_ESCALATION",
                            "org_id": str(ticket.org_id),
                        },
                        org_id=ticket.org_id,
                    )
            elif new_status == "AT_RISK" and old_status == "WITHIN_SLA":
                await OutboxPublisher.publish(
                    session=db,
                    exchange_or_event="procurement.ticket",
                    routing_key="ticket.sla.warning",
                    payload={
                        "ticket_id": str(ticket.id),
                        "ticket_number": ticket.ticket_number,
                        "priority": str(ticket.priority),
                        "assigned_to": str(ticket.assigned_to) if ticket.assigned_to else None,
                        "org_id": str(ticket.org_id),
                    },
                    org_id=ticket.org_id,
                )
        await db.commit()


async def _auto_close() -> None:
    async with async_session_factory() as db:
        now = datetime.now(timezone.utc)
        r_cutoff = now - timedelta(days=settings.TICKET_AUTO_CLOSE_RESOLVED_DAYS)
        resolved = await ticket_repository.get_stale_resolved(db, r_cutoff)
        for t in resolved:
            t.status = "CLOSED"
            await OutboxPublisher.publish(
                session=db,
                exchange_or_event="procurement.ticket",
                routing_key="ticket.closed",
                payload={
                    "ticket_id": str(t.id),
                    "ticket_number": t.ticket_number,
                    "closure_reason": f"AUTO_CLOSE_RESOLVED_{settings.TICKET_AUTO_CLOSE_RESOLVED_DAYS}D",
                    "org_id": str(t.org_id),
                },
                org_id=t.org_id,
            )

        p_cutoff = now - timedelta(days=settings.TICKET_AUTO_CLOSE_PENDING_RESPONSE_DAYS)
        pending = await ticket_repository.get_stale_pending_response(db, p_cutoff)
        for t in pending:
            t.status = "CLOSED"
            await OutboxPublisher.publish(
                session=db,
                exchange_or_event="procurement.ticket",
                routing_key="ticket.closed",
                payload={
                    "ticket_id": str(t.id),
                    "ticket_number": t.ticket_number,
                    "closure_reason": f"AUTO_CLOSE_NO_RESPONSE_{settings.TICKET_AUTO_CLOSE_PENDING_RESPONSE_DAYS}D",
                    "org_id": str(t.org_id),
                },
                org_id=t.org_id,
            )
        await db.commit()


async def _send_digest() -> None:
    async with async_session_factory() as db:
        assignees = await ticket_repository.get_unique_assignees_with_open_tickets(db)
        for row in assignees:
            assignee_id, org_id, open_count, breached_count = row[0], row[1], row[2], row[3]
            await OutboxPublisher.publish(
                session=db,
                exchange_or_event="procurement.notification",
                routing_key="notification.email.ticket_digest",
                payload={
                    "recipient_id": str(assignee_id),
                    "org_id": str(org_id),
                    "open_count": int(open_count),
                    "breached_count": int(breached_count),
                    "template_code": "TICKET_DAILY_DIGEST",
                },
                org_id=org_id,
            )
        await db.commit()


async def _check_due_dates() -> None:
    async with async_session_factory() as db:
        from sqlalchemy import select
        from app.modules.ticket.models import Ticket

        today = date.today()
        tomorrow = today + timedelta(days=1)
        stmt = select(Ticket).where(
            Ticket.due_date.is_not(None),
            Ticket.due_date >= today,
            Ticket.due_date <= tomorrow,
            Ticket.status.not_in(["CLOSED", "RESOLVED"]),
            Ticket.deleted_at.is_(None),
        )
        res = await db.execute(stmt)
        tickets = res.scalars().all()
        for t in tickets:
            await OutboxPublisher.publish(
                session=db,
                exchange_or_event="procurement.ticket",
                routing_key="ticket.due_date.approaching",
                payload={
                    "ticket_id": str(t.id),
                    "ticket_number": t.ticket_number,
                    "due_date": t.due_date.isoformat(),
                    "assigned_to": str(t.assigned_to) if t.assigned_to else None,
                    "org_id": str(t.org_id),
                },
                org_id=t.org_id,
            )
        await db.commit()
