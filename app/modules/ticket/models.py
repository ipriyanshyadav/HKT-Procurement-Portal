from __future__ import annotations

from datetime import date, datetime  # noqa: TC002
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, BaseModel


class Ticket(BaseModel):
    __tablename__ = "tickets"

    ticket_number: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    ticket_type: Mapped[str] = mapped_column(
        SAEnum(
            "QUERY",
            "BUG",
            "DISCREPANCY",
            "COMPLAINT",
            "CHANGE_REQUEST",
            "SUPPORT",
            "AUDIT_QUERY",
            "VENDOR_ISSUE",
            name="ticket_type_enum",
            create_type=False,
        ),
        nullable=False,
    )
    priority: Mapped[str] = mapped_column(
        SAEnum(
            "CRITICAL",
            "HIGH",
            "MEDIUM",
            "LOW",
            name="ticket_priority_enum",
            create_type=False,
        ),
        nullable=False,
        default="MEDIUM",
    )
    status: Mapped[str] = mapped_column(
        SAEnum(
            "OPEN",
            "IN_PROGRESS",
            "PENDING_RESPONSE",
            "ESCALATED",
            "RESOLVED",
            "CLOSED",
            "REOPENED",
            name="ticket_status_enum",
            create_type=False,
        ),
        nullable=False,
        default="OPEN",
    )
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    raised_by: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    raised_by_portal: Mapped[str] = mapped_column(String(20), nullable=False, default="buyer")
    assigned_to: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assigned_team: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    entity_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sla_breach_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sla_status: Mapped[str] = mapped_column(String(20), default="WITHIN_SLA", nullable=False)
    first_response_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reopen_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    comments: Mapped[list[TicketComment]] = relationship(
        back_populates="ticket", lazy="selectin", cascade="all, delete-orphan"
    )
    watchers: Mapped[list[TicketWatcher]] = relationship(
        back_populates="ticket", lazy="selectin", cascade="all, delete-orphan"
    )
    activity_logs: Mapped[list[TicketActivityLog]] = relationship(
        back_populates="ticket", lazy="selectin", cascade="all, delete-orphan"
    )
    attachments: Mapped[list[TicketAttachment]] = relationship(
        back_populates="ticket", lazy="selectin", cascade="all, delete-orphan"
    )
    outgoing_links: Mapped[list[TicketLink]] = relationship(
        "TicketLink",
        foreign_keys="TicketLink.source_ticket_id",
        back_populates="source_ticket",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    incoming_links: Mapped[list[TicketLink]] = relationship(
        "TicketLink",
        foreign_keys="TicketLink.target_ticket_id",
        back_populates="target_ticket",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    custom_field_values: Mapped[list[TicketCustomFieldValue]] = relationship(
        "TicketCustomFieldValue",
        back_populates="ticket",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class TicketComment(BaseModel):
    __tablename__ = "ticket_comments"

    ticket_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mentioned_users: Mapped[list[UUID]] = mapped_column(
        ARRAY(PGUUID(as_uuid=True)), default=list, nullable=False
    )
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    edited_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    parent_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("ticket_comments.id"), nullable=True
    )

    ticket: Mapped[Ticket] = relationship(back_populates="comments")


class TicketAttachment(BaseModel):
    __tablename__ = "ticket_attachments"

    ticket_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False
    )
    comment_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("ticket_comments.id"), nullable=True
    )
    document_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    uploaded_by: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)

    ticket: Mapped[Ticket] = relationship(back_populates="attachments")


class TicketWatcher(BaseModel):
    __tablename__ = "ticket_watchers"

    ticket_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    added_by: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    __table_args__ = (UniqueConstraint("ticket_id", "user_id", name="uq_ticket_watchers_ticket_user"),)

    ticket: Mapped[Ticket] = relationship(back_populates="watchers")


class TicketActivityLog(Base):
    """Immutable — NO deleted_at, NO updated_at. Never update or delete."""

    __tablename__ = "ticket_activity_log"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    ticket_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False
    )
    actor_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    old_value: Mapped[str | None] = mapped_column(String(500), nullable=True)
    new_value: Mapped[str | None] = mapped_column(String(500), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    ticket: Mapped[Ticket] = relationship(back_populates="activity_logs")


class TicketSLAConfig(BaseModel):
    __tablename__ = "ticket_sla_config"

    priority: Mapped[str] = mapped_column(
        SAEnum("CRITICAL", "HIGH", "MEDIUM", "LOW", name="ticket_priority_enum", create_type=False),
        nullable=False,
    )
    first_response_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    resolution_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    escalation_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    escalate_to_role: Mapped[str | None] = mapped_column(String(100), nullable=True)

    __table_args__ = (UniqueConstraint("org_id", "priority", name="uq_ticket_sla_config_org_priority"),)


class TicketLink(BaseModel):
    __tablename__ = "ticket_links"

    source_ticket_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False
    )
    target_ticket_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False
    )
    link_type: Mapped[str] = mapped_column(
        SAEnum(
            "BLOCKS",
            "IS_BLOCKED_BY",
            "RELATES_TO",
            "DUPLICATES",
            "IS_DUPLICATED_BY",
            "CLONES",
            "IS_CLONED_BY",
            name="ticket_link_type_enum",
            create_type=False,
        ),
        nullable=False,
    )
    created_by: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    source_ticket: Mapped[Ticket] = relationship(
        "Ticket", foreign_keys=[source_ticket_id], back_populates="outgoing_links"
    )
    target_ticket: Mapped[Ticket] = relationship(
        "Ticket", foreign_keys=[target_ticket_id], back_populates="incoming_links"
    )

    __table_args__ = (
        UniqueConstraint(
            "source_ticket_id",
            "target_ticket_id",
            "link_type",
            name="uq_ticket_links_source_target_type",
        ),
    )


class TicketCustomFieldDef(BaseModel):
    __tablename__ = "ticket_custom_field_defs"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    field_key: Mapped[str] = mapped_column(String(100), nullable=False)
    field_type: Mapped[str] = mapped_column(
        SAEnum(
            "TEXT",
            "NUMBER",
            "DATE",
            "SELECT",
            "MULTI_SELECT",
            "BOOLEAN",
            name="custom_field_type_enum",
            create_type=False,
        ),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    default_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    options: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)
    applies_to_ticket_types: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, nullable=False
    )
    created_by: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    __table_args__ = (
        UniqueConstraint("org_id", "field_key", name="uq_ticket_custom_field_defs_org_key"),
    )


class TicketCustomFieldValue(BaseModel):
    __tablename__ = "ticket_custom_field_values"

    ticket_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False
    )
    field_def_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("ticket_custom_field_defs.id", ondelete="CASCADE"), nullable=False
    )
    value_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_number: Mapped[float | None] = mapped_column(Numeric(15, 4), nullable=True)
    value_json: Mapped[Any | None] = mapped_column(JSONB, nullable=True)

    ticket: Mapped[Ticket] = relationship("Ticket", back_populates="custom_field_values")
    field_def: Mapped[TicketCustomFieldDef] = relationship("TicketCustomFieldDef", lazy="joined")

    __table_args__ = (
        UniqueConstraint("ticket_id", "field_def_id", name="uq_ticket_custom_field_values_ticket_field"),
    )


class TicketAutomationRule(BaseModel):
    __tablename__ = "ticket_automation_rules"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    trigger_type: Mapped[str] = mapped_column(
        SAEnum(
            "TICKET_CREATED",
            "STATUS_CHANGED",
            "FIELD_CHANGED",
            "SLA_BREACHED",
            "SCHEDULE",
            name="automation_trigger_enum",
            create_type=False,
        ),
        nullable=False,
    )
    trigger_config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    conditions: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    actions: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    execution_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

