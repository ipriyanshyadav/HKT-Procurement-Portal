from __future__ import annotations
from datetime import date, timedelta
from typing import Optional, Any
from loguru import logger
from sqlalchemy import select, and_

from app.config import settings
from app.core.metrics import vendor_compliance_holds
from app.db.enums import VendorStatusEnum
from app.db.session import async_session
from app.events.publisher import OutboxPublisher
from app.modules.audit.service import audit_service
from app.modules.vendor.models import Vendor, VendorDocument
from app.modules.vendor.repository import vendor_repository
from app.tasks.async_runner import run_async
from app.tasks.celery_app import celery_app


@celery_app.task(queue="maintenance", name="app.tasks.maintenance.check_vendor_compliance")
def check_vendor_compliance() -> None:
    """Daily Celery task to check compliance document expiry and set hold if expired."""
    run_async(async_check_compliance())


async def async_check_compliance(session_factory: Optional[Any] = None) -> dict:
    """Core compliance check logic for vendor documents."""
    today = date.today()
    holds_placed = 0
    alerts_sent = 0

    factory = session_factory or async_session
    async with factory() as db:
        # Check all warning thresholds, e.g. [90, 30, 0]
        thresholds = sorted(settings.COMPLIANCE_EXPIRY_WARNING_DAYS, reverse=True)

        for threshold_days in thresholds:
            check_date = today + timedelta(days=threshold_days)
            # Find all active/submitted vendors' documents expiring on or before check_date
            stmt = (
                select(VendorDocument, Vendor)
                .join(Vendor, Vendor.id == VendorDocument.vendor_id)
                .where(
                    and_(
                        VendorDocument.expiry_date.is_not(None),
                        VendorDocument.expiry_date <= check_date,
                        VendorDocument.deleted_at.is_(None),
                        Vendor.deleted_at.is_(None),
                    )
                )
            )
            res = await db.execute(stmt)
            rows = res.all()

            for doc, vendor in rows:
                days_remaining = (doc.expiry_date - today).days if doc.expiry_date else 0

                if threshold_days == settings.VENDOR_COMPLIANCE_HOLD_EXPIRY_DAYS or days_remaining <= 0:
                    # 0 days remaining or expired: place on COMPLIANCE_HOLD if ACTIVE
                    if vendor.status == VendorStatusEnum.ACTIVE:
                        vendor.status = VendorStatusEnum.COMPLIANCE_HOLD
                        vendor_compliance_holds.labels(org_id=str(vendor.org_id)).inc()
                        reason = f"Compliance document {doc.document_id} expired on {doc.expiry_date}"
                        vendor.suspension_reason = reason
                        holds_placed += 1

                        await OutboxPublisher.publish(
                            db,
                            event_type="vendor.compliance.expired",
                            routing_key="procurement.vendor",
                            payload={
                                "vendor_id": str(vendor.id),
                                "document_id": str(doc.document_id),
                                "expiry_date": doc.expiry_date.isoformat(),
                                "reason": reason,
                                "org_id": str(vendor.org_id),
                            },
                            org_id=vendor.org_id,
                        )

                        await audit_service.log(
                            db,
                            entity_type="VENDOR",
                            entity_id=vendor.id,
                            action="VENDOR_COMPLIANCE_HOLD",
                            actor_id=None,
                            org_id=vendor.org_id,
                            new_values={"reason": reason},
                        )
                else:
                    # Alert notification for expiring documents (e.g. 90 or 30 days)
                    alerts_sent += 1
                    await OutboxPublisher.publish(
                        db,
                        event_type="vendor.compliance.expiring",
                        routing_key="procurement.vendor",
                        payload={
                            "vendor_id": str(vendor.id),
                            "document_id": str(doc.document_id),
                            "expiry_date": doc.expiry_date.isoformat(),
                            "days_remaining": days_remaining,
                            "threshold_days": threshold_days,
                            "org_id": str(vendor.org_id),
                        },
                        org_id=vendor.org_id,
                    )

        await db.commit()

    logger.info(f"Compliance check finished: {holds_placed} holds placed, {alerts_sent} alerts sent.")
    return {"holds_placed": holds_placed, "alerts_sent": alerts_sent}
