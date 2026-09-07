from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional

from loguru import logger
from sqlalchemy import and_, select

from app.config import settings
from app.db.enums import InvoiceStatusEnum, PaymentStatusEnum
from app.db.session import async_session
from app.events.publisher import OutboxPublisher
from app.modules.invoice.models import Invoice
from app.tasks.async_runner import run_async
from app.tasks.celery_app import celery_app


@celery_app.task(queue="default", name="app.tasks.default.check_invoice_aging")
def check_invoice_aging() -> None:
    run_async(async_check_invoice_aging())


async def async_check_invoice_aging(session_factory: Optional[Any] = None) -> dict:
    """
    Scans unpaid or pending invoices and generates aging alerts
    based on configured day thresholds past due_date.
    """
    today = date.today()
    factory = session_factory or async_session
    alerts_sent = 0

    thresholds = sorted(settings.INVOICE_AGING_ALERT_DAYS)

    async with factory() as db:
        stmt = select(Invoice).where(
            and_(
                Invoice.payment_status.notin_([
                    PaymentStatusEnum.COMPLETED.value if hasattr(PaymentStatusEnum.COMPLETED, "value") else "COMPLETED",
                ]),
                Invoice.status.notin_([
                    InvoiceStatusEnum.CANCELLED.value if hasattr(InvoiceStatusEnum.CANCELLED, "value") else "CANCELLED",
                    InvoiceStatusEnum.PAID.value if hasattr(InvoiceStatusEnum.PAID, "value") else "PAID",
                ]),
                Invoice.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        invoices = res.scalars().all()

        for inv in invoices:
            ref_date = inv.due_date
            if not ref_date:
                ref_date = inv.invoice_date

            if not ref_date:
                continue

            days_overdue = (today - ref_date).days
            if days_overdue <= 0:
                continue

            # Determine aging bucket level
            level = 0
            for idx, th in enumerate(thresholds, 1):
                if days_overdue >= th:
                    level = idx

            if level > 0:
                await OutboxPublisher.publish(
                    db,
                    "procurement.invoice",
                    "invoice.aging.warning",
                    {
                        "invoice_id": str(inv.id),
                        "invoice_number": inv.invoice_number,
                        "vendor_invoice_number": inv.vendor_invoice_number,
                        "vendor_id": str(inv.vendor_id),
                        "total_amount": str(inv.total_amount),
                        "due_date": inv.due_date.isoformat(),
                        "days_overdue": days_overdue,
                        "aging_level": level,
                        "threshold_days": thresholds[level - 1],
                        "org_id": str(inv.org_id),
                    },
                    inv.org_id,
                )
                alerts_sent += 1

        await db.commit()

    return {"alerts_sent": alerts_sent}
