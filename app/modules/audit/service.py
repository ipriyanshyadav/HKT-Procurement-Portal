from __future__ import annotations
from typing import Any, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.audit.models import AuditLog
from app.db.enums import AuditEntityTypeEnum
from app.core.telemetry import get_current_trace_id


class AuditService:
    """INSERT-ONLY audit service. Never UPDATE or DELETE."""

    async def log(
        self,
        db: AsyncSession,
        entity_type: str,
        entity_id: UUID,
        action: str,
        actor_id: Optional[UUID],
        org_id: UUID,
        old_values: Optional[dict[str, Any]] = None,
        new_values: Optional[dict[str, Any]] = None,
        metadata: Optional[dict[str, Any]] = None,
        actor_email: Optional[str] = None,
        actor_ip: Optional[str] = None,
        trace_id: str = "",
    ) -> None:
        """Insert an audit log entry. Caller's transaction commits it."""
        # Resolve entity type enum safely
        try:
            entity_type_enum = AuditEntityTypeEnum(entity_type)
        except ValueError:
            entity_type_enum = AuditEntityTypeEnum.USER  # fallback for auth events

        log_entry = AuditLog(
            org_id=org_id,
            entity_type=entity_type_enum,
            entity_id=entity_id,
            action=action,
            actor_id=actor_id,
            actor_email=actor_email,
            actor_ip=actor_ip,
            old_values=old_values,
            new_values=new_values,
            metadata_=metadata or {},
            trace_id=trace_id or get_current_trace_id(),
        )
        db.add(log_entry)
        # No commit — caller's transaction commits


audit_service = AuditService()
