from __future__ import annotations
import csv
import io
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from loguru import logger
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.metrics import audit_log_last_insert_timestamp
from app.core.telemetry import get_current_trace_id
from app.db.enums import AuditEntityTypeEnum
from app.modules.audit.crypto_chain import (
    GENESIS_HASH,
    compute_record_hash,
    resolve_ip_geolocation,
    verify_audit_log_chain,
)
from app.modules.audit.models import AuditLog
from app.modules.audit.search_service import AuditSearchQuery, audit_search_service


class AuditService:
    """
    INSERT-ONLY audit service with cryptographic SHA-256 chain of custody and IP geolocation.
    Never UPDATE or DELETE.
    """

    async def _get_latest_record_hash(self, db: AsyncSession, org_id: UUID) -> str:
        """Fetch the record_hash of the most recent audit entry for the organization."""
        try:
            stmt = (
                select(AuditLog)
                .where(AuditLog.org_id == org_id)
                .order_by(desc(AuditLog.created_at))
                .limit(1)
            )
            exec_res = db.execute(stmt)
            res = await exec_res if hasattr(exec_res, "__await__") else exec_res
            if hasattr(res, "scalar_one_or_none"):
                latest_log = res.scalar_one_or_none()
                if hasattr(latest_log, "__await__"):
                    latest_log = await latest_log
                if latest_log and hasattr(latest_log, "metadata_"):
                    meta = latest_log.metadata_
                    if isinstance(meta, dict) and "record_hash" in meta:
                        return meta["record_hash"]
        except Exception:
            pass
        return GENESIS_HASH

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
        """Insert an immutable, cryptographically chained audit log entry."""
        # Resolve entity type enum safely
        try:
            entity_type_enum = AuditEntityTypeEnum(entity_type)
        except ValueError:
            entity_type_enum = AuditEntityTypeEnum.USER  # fallback for auth events

        now_utc = datetime.now(timezone.utc)
        created_at_iso = now_utc.isoformat()

        # Resolve previous hash in chain
        prev_hash = await self._get_latest_record_hash(db, org_id)

        # Resolve IP geolocation
        geo_info = resolve_ip_geolocation(actor_ip)

        from uuid import uuid4
        record_id = uuid4()

        payload = new_values or old_values or {}
        record_hash = compute_record_hash(
            prev_hash=prev_hash,
            log_id=record_id,
            org_id=org_id,
            entity_type=entity_type_enum.value,
            entity_id=entity_id,
            action=action,
            created_at_iso=created_at_iso,
            actor_id=actor_id,
            payload_data=payload,
        )

        merged_metadata = dict(metadata or {})
        merged_metadata["prev_hash"] = prev_hash
        merged_metadata["record_hash"] = record_hash
        merged_metadata["geo"] = geo_info

        log_entry = AuditLog(
            id=record_id,
            org_id=org_id,
            entity_type=entity_type_enum,
            entity_id=entity_id,
            action=action,
            actor_id=actor_id,
            actor_email=actor_email,
            actor_ip=actor_ip,
            old_values=old_values,
            new_values=new_values,
            metadata_=merged_metadata,
            trace_id=trace_id or get_current_trace_id(),
            created_at=now_utc,
        )
        db.add(log_entry)
        audit_log_last_insert_timestamp.set(now_utc.timestamp())

        # Forward to Elasticsearch audit search service
        try:
            await audit_search_service.index_audit_log(log_entry)
        except Exception as exc:
            logger.warning(f"Error calling search_service.index_audit_log: {exc}")

    async def get_audit_logs(
        self,
        db: AsyncSession,
        org_id: UUID,
        query: AuditSearchQuery,
    ) -> Dict[str, Any]:
        """Search and list audit logs using Elasticsearch or SQL fallback."""
        return await audit_search_service.search_audit_logs(db, org_id=org_id, query=query)

    async def verify_chain_integrity(
        self,
        db: AsyncSession,
        org_id: UUID,
        entity_type: Optional[str] = None,
        limit: int = 500,
    ) -> Dict[str, Any]:
        """
        Run cryptographic SHA-256 chain of custody verification across audit records.
        """
        stmt = select(AuditLog).where(AuditLog.org_id == org_id)
        if entity_type:
            try:
                stmt = stmt.where(AuditLog.entity_type == AuditEntityTypeEnum(entity_type))
            except ValueError:
                pass
        stmt = stmt.order_by(AuditLog.created_at.asc()).limit(limit)

        res = await db.execute(stmt)
        logs = res.scalars().all()
        return verify_audit_log_chain(logs)

    async def export_compliance_report(
        self,
        db: AsyncSession,
        org_id: UUID,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        format_type: str = "json",
    ) -> Dict[str, Any]:
        """
        Generate tamper-evident compliance audit export with cryptographic hash manifest.
        """
        stmt = select(AuditLog).where(AuditLog.org_id == org_id)
        if date_from:
            stmt = stmt.where(AuditLog.created_at >= date_from)
        if date_to:
            stmt = stmt.where(AuditLog.created_at <= date_to)
        stmt = stmt.order_by(AuditLog.created_at.asc()).limit(2000)

        res = await db.execute(stmt)
        logs = res.scalars().all()

        verification = verify_audit_log_chain(logs)

        records_data = []
        for l in logs:
            meta = l.metadata_ or {}
            geo = meta.get("geo", {})
            records_data.append({
                "id": str(l.id),
                "timestamp": l.created_at.isoformat() if l.created_at else "",
                "entity_type": l.entity_type.value if hasattr(l.entity_type, "value") else str(l.entity_type),
                "entity_id": str(l.entity_id),
                "action": l.action,
                "actor_email": l.actor_email or "SYSTEM",
                "actor_ip": l.actor_ip or "INTERNAL",
                "location": f"{geo.get('city', 'Unknown')}, {geo.get('country', 'Unknown')}",
                "record_hash": meta.get("record_hash", ""),
                "prev_hash": meta.get("prev_hash", ""),
            })

        manifest = {
            "org_id": str(org_id),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "record_count": len(records_data),
            "chain_valid": verification["is_valid"],
            "head_hash": verification.get("head_hash"),
            "format": format_type.upper(),
        }

        if format_type.lower() == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["Log ID", "Timestamp", "Entity Type", "Entity ID", "Action", "Actor Email", "Actor IP", "Location", "Record Hash", "Prev Hash"])
            for r in records_data:
                writer.writerow([
                    r["id"],
                    r["timestamp"],
                    r["entity_type"],
                    r["entity_id"],
                    r["action"],
                    r["actor_email"],
                    r["actor_ip"],
                    r["location"],
                    r["record_hash"],
                    r["prev_hash"],
                ])
            csv_content = output.getvalue()
            return {
                "manifest": manifest,
                "csv_content": csv_content,
                "verification": verification,
            }

        return {
            "manifest": manifest,
            "verification": verification,
            "records": records_data,
        }


audit_service = AuditService()

