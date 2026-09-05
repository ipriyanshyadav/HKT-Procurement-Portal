from __future__ import annotations
import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID
from loguru import logger
from sqlalchemy import select

from app.tasks.celery_app import celery_app
from app.db.session import get_db_ctx
from app.modules.bid.live_bid_service import LiveBidService
from app.modules.bid.models import LiveBid


@celery_app.task(name="tasks.open_scheduled_auctions", bind=True, max_retries=3)
def open_scheduled_auctions(self):
    """Runs every 30 seconds via Celery beat. Opens SCHEDULED auctions past start time."""
    async def _run():
        async with get_db_ctx() as db:
            svc = LiveBidService()
            auctions = await svc.live_bid_repo.get_due_to_open(db)
            targets = [(a.id, a.org_id) for a in auctions]
            for a_id, org_id in targets:
                try:
                    await svc.open_auction(db, a_id, org_id)
                    await db.commit()
                except Exception as exc:
                    logger.warning(f"Failed to open auction {a_id}: {exc}")
                    await db.rollback()
    asyncio.run(_run())


@celery_app.task(name="tasks.close_due_auctions", bind=True, max_retries=3)
def close_due_auctions(self):
    """Runs every 10 seconds. Closes OPEN/EXTENDED/CLOSING auctions past current_close_at."""
    async def _run():
        async with get_db_ctx() as db:
            svc = LiveBidService()
            auctions = await svc.live_bid_repo.get_due_to_close(db)
            targets = [(a.id, a.org_id) for a in auctions]
            for a_id, org_id in targets:
                try:
                    await svc.close_auction(db, a_id, org_id)
                    await db.commit()
                except Exception as exc:
                    logger.warning(f"Failed to close auction {a_id}: {exc}")
                    await db.rollback()
    asyncio.run(_run())


@celery_app.task(name="tasks.send_auction_closing_warning")
def send_auction_closing_warning():
    """Runs every 10 seconds. Broadcasts AUCTION_CLOSING for auctions within 30s of close."""
    async def _run():
        async with get_db_ctx() as db:
            svc = LiveBidService()
            auctions = await svc.live_bid_repo.get_closing_soon(db, seconds=30)
            for auction in auctions:
                a_id = auction.id
                org_id = auction.org_id
                try:
                    await svc.send_closing_warning(db, auction, org_id)
                    await db.commit()
                except Exception as exc:
                    logger.warning(f"Failed to send closing warning for {a_id}: {exc}")
                    await db.rollback()
    asyncio.run(_run())


@celery_app.task(name="tasks.notify_auction_start_reminders")
def notify_auction_start_reminders():
    """Runs every minute. Sends email+in-app alerts 60min and 15min before start."""
    async def _run():
        from app.events.publisher import OutboxPublisher
        async with get_db_ctx() as db:
            svc = LiveBidService()
            publisher = OutboxPublisher()
            for minutes, template in [(60, "AUCTION_START_REMINDER_60M"), (15, "AUCTION_START_REMINDER_15M")]:
                auctions = await svc.live_bid_repo.get_starting_in(db, minutes=minutes)
                for auction in auctions:
                    participants = await svc.live_bid_repo.get_participants(db, auction.id, auction.org_id)
                    for p in participants:
                        try:
                            await publisher.publish(
                                "procurement.notification",
                                "notification.email.auction_reminder",
                                {
                                    "vendor_id": str(p.vendor_id),
                                    "auction_id": str(auction.id),
                                    "template_code": template,
                                    "org_id": str(auction.org_id),
                                },
                                auction.org_id,
                            )
                        except Exception as exc:
                            logger.warning(f"Error publishing reminder for participant {p.vendor_id}: {exc}")
            await db.commit()
    asyncio.run(_run())


@celery_app.task(name="tasks.execute_proxy_bids")
def execute_proxy_bids_task(
    auction_id_str: str,
    lot_id_str: Optional[str],
    triggering_bid_id_str: str,
    org_id_str: str,
    cascade_count: int = 0,
):
    """Executes residual proxy bids when cascade cap was reached."""
    async def _run():
        async with get_db_ctx() as db:
            svc = LiveBidService()
            auction_id = UUID(auction_id_str)
            lot_id = UUID(lot_id_str) if lot_id_str else None
            triggering_bid_id = UUID(triggering_bid_id_str)
            org_id = UUID(org_id_str)

            stmt = select(LiveBid).where(LiveBid.id == triggering_bid_id)
            triggering_bid = (await db.execute(stmt)).scalar_one_or_none()
            if triggering_bid:
                await svc.execute_proxy_bids(db, auction_id, lot_id, triggering_bid, org_id, cascade_count=cascade_count)
                await db.commit()
    asyncio.run(_run())
