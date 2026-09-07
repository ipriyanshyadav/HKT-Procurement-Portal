from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional, Any
from loguru import logger

from app.config import settings
from app.db.enums import RFQStatus
from app.db.session import async_session
from app.events.publisher import OutboxPublisher
from app.modules.sourcing.models import Rfq
from app.modules.sourcing.repository import rfq_repository
from app.modules.bid.repository import bid_repository
from app.tasks.async_runner import run_async
from app.tasks.celery_app import celery_app


@celery_app.task(queue="default", name="app.tasks.default.check_bid_windows")
def check_bid_windows() -> None:
    """
    Auto-close RFQs where bid deadline has passed. (SPEC_10 S10-20)
    Runs every settings.CELERY_BID_WINDOW_CHECK_MINUTES minutes.
    """
    run_async(_async_check_bid_windows())


async def _async_check_bid_windows(session_factory: Optional[Any] = None) -> dict:
    factory = session_factory or async_session
    processed = 0

    async with factory() as db:
        now = datetime.now(timezone.utc)
        past_deadline = await rfq_repository.get_published_past_deadline(db, now)

        for rfq in past_deadline:
            bid_count = await bid_repository.count_submitted(db, rfq.id, rfq.org_id)

            if bid_count == 0:
                # No bids received — auto-cancel (SPEC_10 S10-20)
                rfq.status = RFQStatus.NO_BIDS
                rfq.cancel_reason = "NO_BIDS_RECEIVED"
                rfq.cancelled_at = now
                await OutboxPublisher.publish(
                    db,
                    "procurement.rfq",
                    "rfq.cancelled",
                    {
                        "rfq_id": str(rfq.id),
                        "rfq_number": rfq.rfq_number,
                        "reason": "NO_BIDS_RECEIVED",
                        "org_id": str(rfq.org_id),
                    },
                    rfq.org_id,
                )
                logger.info(f"RFQ {rfq.rfq_number} auto-cancelled: no bids received")
            else:
                # Bids available — move to BID_OPEN status (awaiting dual-auth opening)
                rfq.status = RFQStatus.BID_OPEN
                await OutboxPublisher.publish(
                    db,
                    "procurement.rfq",
                    "rfq.bids.ready_for_opening",
                    {
                        "rfq_id": str(rfq.id),
                        "rfq_number": rfq.rfq_number,
                        "bid_count": bid_count,
                        "org_id": str(rfq.org_id),
                    },
                    rfq.org_id,
                )
                logger.info(f"RFQ {rfq.rfq_number} moved to BID_OPEN: {bid_count} bids received")

            processed += 1

        await db.commit()

    return {"rfqs_processed": processed}
