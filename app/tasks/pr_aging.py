from __future__ import annotations
import asyncio
from datetime import datetime, date, timezone
from typing import Optional, Any
from loguru import logger
from sqlalchemy import select, and_

from app.config import settings
from app.db.enums import PRStatus
from app.db.session import async_session
from app.events.publisher import OutboxPublisher
from app.modules.requisition.models import Requisition
from app.tasks.celery_app import celery_app


@celery_app.task(queue="default", name="app.tasks.default.check_pr_aging")
def check_pr_aging() -> None:
    asyncio.run(async_check_pr_aging())


async def async_check_pr_aging(session_factory: Optional[Any] = None) -> dict:
    today = date.today()
    factory = session_factory or async_session
    alerts_sent = 0

    # Configurable thresholds from settings, e.g. [7, 14, 30]
    thresholds = sorted(settings.PR_AGING_ALERT_DAYS)

    async with factory() as db:
        stmt = (
            select(Requisition)
            .where(
                and_(
                    Requisition.status.in_([
                        PRStatus.APPROVED.value,
                        PRStatus.PENDING_APPROVAL.value,
                        PRStatus.SUBMITTED.value,
                    ]),
                    Requisition.deleted_at.is_(None),
                )
            )
        )
        res = await db.execute(stmt)
        prs = res.scalars().all()

        for pr in prs:
            ref_dt = pr.approved_at or pr.created_at
            if not ref_dt:
                continue
            ref_date = ref_dt.date() if isinstance(ref_dt, datetime) else ref_dt
            days_pending = (today - ref_date).days

            level = 0
            for idx, th in enumerate(thresholds, 1):
                if days_pending >= th:
                    level = idx

            if level > pr.aging_alert_level:
                pr.aging_alert_level = level
                await OutboxPublisher.publish(
                    db,
                    "procurement.pr",
                    "pr.aging.warning",
                    {
                        "pr_id": str(pr.id),
                        "pr_number": pr.pr_number,
                        "days_pending": days_pending,
                        "aging_alert_level": level,
                        "threshold_days": thresholds[level - 1] if level > 0 else 0,
                        "org_id": str(pr.org_id),
                    },
                    pr.org_id,
                )
                alerts_sent += 1

        await db.commit()

    return {"alerts_sent": alerts_sent}
