from __future__ import annotations
from typing import Any, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from loguru import logger
from app.modules.audit.models import AuditLog
from app.db.enums import AuditEntityTypeEnum
from app.core.telemetry import get_current_trace_id
from app.core.metrics import audit_log_last_insert_timestamp


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

        now_utc = datetime.now(timezone.utc)
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
            created_at=now_utc,
        )
        db.add(log_entry)
        audit_log_last_insert_timestamp.set(now_utc.timestamp())

        # Forward to Elasticsearch audit search service
        try:
            from app.modules.audit.search_service import audit_search_service
            await audit_search_service.index_audit_log(log_entry)
        except Exception as exc:
            logger.warning(f"Error calling search_service.index_audit_log: {exc}")
        # No commit — caller's transaction commits


audit_service = AuditService()
