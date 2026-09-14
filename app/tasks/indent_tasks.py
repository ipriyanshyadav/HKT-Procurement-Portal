from __future__ import annotations

import asyncio
from uuid import UUID

from loguru import logger
from sqlalchemy import select

from app.db.session import async_session
from app.events.publisher import OutboxPublisher
from app.modules.grn.models import GoodsReceiptNote
from app.modules.purchase_order.models import PurchaseOrder
from app.modules.requisition.models import Requisition
from app.tasks.celery_app import celery_app


@celery_app.task(queue="celery.sla_timers")
def notify_indentor_on_grn_delivery(grn_id: str, org_id: str) -> None:
    asyncio.run(_notify_indentor_on_grn_delivery_async(UUID(grn_id), UUID(org_id)))


async def _notify_indentor_on_grn_delivery_async(grn_id: UUID, org_id: UUID) -> None:
    async with async_session() as db:
        try:
            stmt = (
                select(Requisition)
                .join(PurchaseOrder, PurchaseOrder.source_pr_id == Requisition.id)
                .join(GoodsReceiptNote, GoodsReceiptNote.po_id == PurchaseOrder.id)
                .where(
                    GoodsReceiptNote.id == grn_id,
                    GoodsReceiptNote.org_id == org_id,
                    Requisition.is_indent.is_(True),
                )
            )
            res = await db.execute(stmt)
            prs = res.scalars().all()
            for pr in prs:
                if pr.indentor_id:
                    await OutboxPublisher.publish(
                        db,
                        "procurement.indent",
                        "INDENT_GOODS_DELIVERED",
                        {
                            "grn_id": str(grn_id),
                            "pr_id": str(pr.id),
                            "indentor_id": str(pr.indentor_id),
                        },
                        org_id,
                    )
            await db.commit()
        except Exception as e:
            logger.error(f"Failed to process notify_indentor_on_grn_delivery: {e}")
