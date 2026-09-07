"""
Contract Expiry & Auto-Renewal Celery Task (SPEC_13 S13-08, S13-09).

Checks contracts expiring at 90, 60, 30, and 0 days.
At 0 days:
  - If auto_renew is True: triggers auto-renewal, expiring old contract and creating active renewed contract.
  - If auto_renew is False: marks contract EXPIRED and publishes event.
At 90, 60, 30 days:
  - Publishes contract expiry alert notification.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, Optional

from loguru import logger

from app.config import settings
from app.db.session import async_session
from app.events.publisher import OutboxPublisher
from app.modules.contract.repository import contract_repository
from app.modules.contract.service import contract_service
from app.tasks.async_runner import run_async
from app.tasks.celery_app import celery_app


@celery_app.task(queue="maintenance", name="app.tasks.maintenance.check_contract_expiry")
def check_contract_expiry() -> None:
    """Daily Celery task to check contract expiry thresholds and trigger auto-renewal."""
    run_async(async_check_contract_expiry())


async def async_check_contract_expiry(session_factory: Optional[Any] = None) -> Dict[str, int]:
    """
    Core contract expiry and auto-renewal check logic.
    Returns counts of alerts sent, renewals processed, and expirations marked.
    """
    today = date.today()
    alerts_sent = 0
    renewals_processed = 0
    expired_count = 0

    factory = session_factory or async_session
    async with factory() as db:
        thresholds = sorted(settings.CONTRACT_EXPIRY_ALERT_DAYS, reverse=True)

        for threshold_days in thresholds:
            check_date = today + timedelta(days=threshold_days)
            expiring_contracts = await contract_repository.get_expiring_on(db, check_date)

            for contract in expiring_contracts:
                if threshold_days == 0:
                    if contract.auto_renew:
                        logger.info("Auto-renewing contract {}: {}", contract.contract_number, contract.id)
                        await contract_service.auto_renew_contract(db, contract)
                        renewals_processed += 1
                    else:
                        logger.info("Marking contract {} as EXPIRED: {}", contract.contract_number, contract.id)
                        contract.status = "EXPIRED"
                        await OutboxPublisher.publish(
                            db,
                            exchange_or_event="procurement.contract",
                            routing_key="contract.expired",
                            payload={
                                "contract_id": str(contract.id),
                                "org_id": str(contract.org_id),
                                "contract_number": contract.contract_number,
                            },
                            org_id=contract.org_id,
                        )
                        expired_count += 1
                else:
                    logger.info(
                        "Sending {}-day expiry alert for contract {}: {}",
                        threshold_days,
                        contract.contract_number,
                        contract.id,
                    )
                    await OutboxPublisher.publish(
                        db,
                        exchange_or_event="procurement.notification",
                        routing_key="notification.email.contract_expiry",
                        payload={
                            "contract_id": str(contract.id),
                            "contract_number": contract.contract_number,
                            "days_remaining": threshold_days,
                            "end_date": contract.end_date.isoformat(),
                        },
                        org_id=contract.org_id,
                    )
                    alerts_sent += 1

        await db.commit()

    return {
        "alerts_sent": alerts_sent,
        "renewals_processed": renewals_processed,
        "expired_count": expired_count,
    }
