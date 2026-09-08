from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.ticket.models import TicketSLAConfig

# Structural defaults per spec (NOT operator-configurable env vars)
_DEFAULT_SLA: dict[str, dict[str, Any]] = {
    "CRITICAL": {"first_response": 1, "resolution": 4, "escalation": 2, "escalate_to_role": "PROCUREMENT_ADMIN"},
    "HIGH": {"first_response": 4, "resolution": 24, "escalation": 12, "escalate_to_role": "VENDOR_ADMIN"},
    "MEDIUM": {"first_response": 8, "resolution": 72, "escalation": 48, "escalate_to_role": "BUYER"},
    "LOW": {"first_response": 24, "resolution": 168, "escalation": 96, "escalate_to_role": "BUYER"},
}


class TicketSLAService:
    def __init__(self, repo=None) -> None:
        self.repo = repo

    async def get_config(self, db: AsyncSession, org_id: UUID, priority: str) -> dict[str, Any]:
        row = None
        if self.repo and hasattr(self.repo, "get_sla_config"):
            row = await self.repo.get_sla_config(db, org_id, priority)
        else:
            stmt = select(TicketSLAConfig).where(
                TicketSLAConfig.org_id == org_id,
                TicketSLAConfig.priority == priority,
                TicketSLAConfig.deleted_at.is_(None),
            )
            res = await db.execute(stmt)
            row = res.scalar_one_or_none()

        if row:
            return {
                "first_response": row.first_response_hours,
                "resolution": row.resolution_hours,
                "escalation": row.escalation_hours,
                "escalate_to_role": row.escalate_to_role,
            }
        return dict(_DEFAULT_SLA.get(priority, _DEFAULT_SLA["MEDIUM"]))

    async def compute_breach_at(
        self, db: AsyncSession, org_id: UUID, priority: str, created_at: datetime
    ) -> datetime:
        cfg = await self.get_config(db, org_id, priority)
        return created_at + timedelta(hours=cfg["resolution"])

    def compute_status(self, sla_breach_at: datetime, created_at: datetime) -> str:
        if sla_breach_at.tzinfo is not None:
            now = datetime.now(UTC)
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=UTC)
        else:
            now = datetime.utcnow()
            if created_at.tzinfo is not None:
                created_at = created_at.replace(tzinfo=None)

        total_secs = (sla_breach_at - created_at).total_seconds()
        elapsed_secs = (now - created_at).total_seconds()
        if total_secs <= 0 or elapsed_secs >= total_secs:
            return "BREACHED"
        pct = (elapsed_secs / total_secs) * 100
        if pct >= 100:
            return "BREACHED"
        if pct >= 50:
            return "AT_RISK"
        return "WITHIN_SLA"
