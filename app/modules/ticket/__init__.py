"""Ticket & Query Management System (SPEC_26).

Responsibility:
    Jira-style enterprise ticketing system supporting 7-state FSM,
    multi-priority SLA computation & auto-escalation, threaded markdown comments,
    @mention user tagging, internal notes with supplier isolation, advisory entity linking,
    auditing, and multi-portal operations (Buyer, Supplier, Admin).

Dependencies:
    - Organizations (tenant isolation, SLA configuration)
    - Users (raisers, assignees, commenters, watchers)
    - Documents (ticket file attachments)
    - Permissions (RBAC: 12 permission codes across 10 roles)
    - Audit (immutable audit logging)
    - Events (RabbitMQ outbox publisher)
    - Redis (real-time notification pub/sub)
    - Elasticsearch (multi-match highlighted search)

Events Published:
    - Exchange: procurement.ticket
      - ticket.created: New ticket opened
      - ticket.comment.added: New comment posted or internal note added
      - ticket.assigned: Ticket assignee / team changed
      - ticket.resolved: Ticket resolved with resolution note
      - ticket.closed: Ticket closed (user or auto-close)
      - ticket.reopened: Ticket reopened by buyer/supplier
      - ticket.escalated: Ticket escalated manually or via SLA breach
      - ticket.sla.breached: Ticket breached SLA threshold
      - ticket.sla.warning: Ticket reached 50% SLA threshold (at risk)
    - Exchange: procurement.notification
      - notification.email.ticket_digest: Daily ticket status digest email

Events Consumed:
    - Queue: q.ticket.events (bound to procurement.ticket ticket.*)
      - Consumed by NotificationConsumer to dispatch email and in-app notifications
"""

from .router import router

__all__ = ["router"]
