from __future__ import annotations
import asyncio
from datetime import datetime, timezone
from typing import Optional, Any
from loguru import logger

from app.config import settings
from app.db.session import async_session
from app.events.publisher import OutboxPublisher
from app.modules.unmapped_pr.repository import unmapped_pr_repository
from app.tasks.celery_app import celery_app


@celery_app.task(queue="critical", name="app.tasks.critical.check_unmapped_pr_sla")
def check_unmapped_pr_sla() -> None:
    asyncio.run(async_check_unmapped_sla())


async def async_check_unmapped_sla(session_factory: Optional[Any] = None) -> dict:
    now = datetime.now(timezone.utc)
    factory = session_factory or async_session
    escalations = 0

    sla_hours = settings.UNMAPPED_PR_SLA_HOURS  # [4, 8, 24, 48]
    tier_1_h = sla_hours[0] if len(sla_hours) > 0 else 4
    tier_2_h = sla_hours[1] if len(sla_hours) > 1 else 8
    tier_3_h = sla_hours[2] if len(sla_hours) > 2 else 24
    tier_4_h = sla_hours[3] if len(sla_hours) > 3 else 48

    async with factory() as db:
        pending = await unmapped_pr_repository.get_all_pending(db)

        for exc in pending:
            created_at = exc.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            elapsed_hours = (now - created_at).total_seconds() / 3600

            if elapsed_hours >= tier_4_h and exc.sla_breach_level < 4:
                exc.sla_breach_level = 4
                await OutboxPublisher.publish(
                    db,
                    "procurement.alert",
                    "alert.unmapped_pr_sla_critical",
                    {
                        "exception_id": str(exc.id),
                        "elapsed_hours": elapsed_hours,
                        "tier": 4,
                        "target": "HOD",
                    },
                    exc.org_id,
                )
                escalations += 1

            elif elapsed_hours >= tier_3_h and exc.sla_breach_level < 3:
                exc.sla_breach_level = 3
                await OutboxPublisher.publish(
                    db,
                    "procurement.alert",
                    "alert.unmapped_pr_sla_breach",
                    {
                        "exception_id": str(exc.id),
                        "elapsed_hours": elapsed_hours,
                        "tier": 3,
                        "target": "PROCUREMENT_HEAD",
                    },
                    exc.org_id,
                )
                escalations += 1

            elif elapsed_hours >= tier_2_h and exc.sla_breach_level < 2:
                exc.sla_breach_level = 2
                await OutboxPublisher.publish(
                    db,
                    "procurement.alert",
                    "alert.unmapped_pr_sla_escalation",
                    {
                        "exception_id": str(exc.id),
                        "elapsed_hours": elapsed_hours,
                        "tier": 2,
                        "target": "CATEGORY_MANAGER",
                    },
                    exc.org_id,
                )
                escalations += 1

            elif elapsed_hours >= tier_1_h and exc.sla_breach_level < 1:
                exc.sla_breach_level = 1
                await OutboxPublisher.publish(
                    db,
                    "procurement.notification",
                    "notification.unmapped_pr_reminder",
                    {
                        "exception_id": str(exc.id),
                        "elapsed_hours": elapsed_hours,
                        "tier": 1,
                        "target": "PROCUREMENT_ADMIN",
                    },
                    exc.org_id,
                )
                escalations += 1

        await db.commit()

    return {"escalations": escalations}
