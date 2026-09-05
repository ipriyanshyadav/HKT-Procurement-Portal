"""
Seed sample in-app notifications for demo users (buyer, supplier, admin).
This populates the notifications table with realistic unread and read alerts
across Requisitions, RFQs, POs, Invoices, Compliance, and SLA categories.
Also optionally publishes a real-time live notification via Redis pub/sub to active WebSocket clients.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from uuid import UUID, uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select, and_
from app.db.session import async_session
from app.db.enums import NotificationChannelEnum, NotificationStatusEnum
from app.modules.notification.models import Notification
from app.modules.user.models import User
from app.core.redis_client import get_redis, RedisKeys

DEFAULT_ORG_ID = UUID("00000000-0000-0000-0000-000000000001")

SAMPLE_BUYER_NOTIFICATIONS = [
    {
        "type": "pr_submitted",
        "title": "New PR Approval Request",
        "body": "PR PR-2026-0042 (Cloud Infrastructure Q3) submitted by John Doe requires your approval.",
        "entity_type": "requisition",
        "is_read": False,
        "delta_hours": 0.25,
    },
    {
        "type": "rfq_published",
        "title": "New Tender Available",
        "body": "RFQ RFQ-2026-0089 (Office IT Equipment) is now published. Bidding window is open.",
        "entity_type": "rfq",
        "is_read": False,
        "delta_hours": 1.0,
    },
    {
        "type": "bid_submitted",
        "title": "Bid Received",
        "body": "Vendor Acme Tech Solutions submitted sealed bid BID-2026-0112 for RFQ-2026-0089.",
        "entity_type": "bid",
        "is_read": False,
        "delta_hours": 2.5,
    },
    {
        "type": "invoice_disputed",
        "title": "Invoice Disputed",
        "body": "Invoice INV-2026-0105 flagged with price mismatch (0.8% variance exceeding 0.5% tolerance).",
        "entity_type": "invoice",
        "is_read": False,
        "delta_hours": 4.0,
    },
    {
        "type": "approval_sla_escalation",
        "title": "SLA Escalation Alert",
        "body": "Approval task 'PO-2026-0029 High-Value Signoff' breached 24h SLA. Escalated to Procurement Head.",
        "entity_type": "approval_task",
        "is_read": False,
        "delta_hours": 6.0,
    },
    {
        "type": "po_released",
        "title": "Purchase Order Released",
        "body": "PO PO-2026-0031 worth INR 450,000 has been officially released to Acme Tech Solutions.",
        "entity_type": "purchase_order",
        "is_read": True,
        "delta_hours": 24.0,
    },
    {
        "type": "payment_completed",
        "title": "Payment Processed",
        "body": "Payment Advice for INV-2026-0098 (INR 280,000) processed. Banking UTR: AXISN00984716.",
        "entity_type": "payment",
        "is_read": True,
        "delta_hours": 48.0,
    },
    {
        "type": "vendor_qualified",
        "title": "Vendor Qualified",
        "body": "Vendor 'Global Cloud Systems' onboarding qualification approved and marked ACTIVE.",
        "entity_type": "vendor",
        "is_read": True,
        "delta_hours": 72.0,
    },
]

SAMPLE_SUPPLIER_NOTIFICATIONS = [
    {
        "type": "rfq_published",
        "title": "Invitation to Bid",
        "body": "You have been invited to bid on RFQ-2026-0089 (Office IT Equipment). Deadline: 2 days.",
        "entity_type": "rfq",
        "is_read": False,
        "delta_hours": 1.5,
    },
    {
        "type": "rfq_bid_deadline_4h",
        "title": "URGENT: 4 Hours Left to Bid",
        "body": "Only 4 hours remain before the bid submission window closes for RFQ-2026-0085.",
        "entity_type": "rfq",
        "is_read": False,
        "delta_hours": 3.0,
    },
    {
        "type": "po_released",
        "title": "New Purchase Order Released",
        "body": "Purchase Order PO-2026-0031 worth INR 450,000 released for fulfillment. Please acknowledge.",
        "entity_type": "purchase_order",
        "is_read": False,
        "delta_hours": 8.0,
    },
    {
        "type": "payment_completed",
        "title": "Payment Advice Received",
        "body": "Payment of INR 320,000 for Invoice INV-2026-0098 processed. UTR: AXISN00984716.",
        "entity_type": "payment",
        "is_read": True,
        "delta_hours": 36.0,
    },
    {
        "type": "vendor_compliance_warning",
        "title": "Compliance Certificate Expiry",
        "body": "Your GST Certificate expires in 25 days. Please upload renewal to prevent compliance hold.",
        "entity_type": "vendor",
        "is_read": True,
        "delta_hours": 60.0,
    },
]

async def seed_demo_notifications():
    now = datetime.now(timezone.utc)
    redis = get_redis()

    async with async_session() as db:
        # Find demo users
        users_res = await db.execute(
            select(User).where(
                User.org_id == DEFAULT_ORG_ID,
                User.email.in_(["buyer@procurement.com", "supplier@acme.com", "admin@procurement.com"]),
            )
        )
        users = {u.email: u for u in users_res.scalars().all()}

        buyer = users.get("buyer@procurement.com")
        supplier = users.get("supplier@acme.com")

        seeded_count = 0

        # Seed Buyer Notifications
        if buyer:
            for item in SAMPLE_BUYER_NOTIFICATIONS:
                # Check if already seeded
                existing_res = await db.execute(
                    select(Notification).where(
                        Notification.user_id == buyer.id,
                        Notification.title == item["title"],
                        Notification.notification_type == item["type"],
                    )
                )
                if existing_res.scalar_one_or_none():
                    continue

                created_at = now - timedelta(hours=item["delta_hours"])
                read_at = created_at + timedelta(minutes=5) if item["is_read"] else None

                notif = Notification(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    user_id=buyer.id,
                    notification_type=item["type"],
                    channel=NotificationChannelEnum.IN_APP,
                    title=item["title"],
                    body=item["body"],
                    entity_type=item["entity_type"],
                    entity_id=uuid4(),
                    status=NotificationStatusEnum.SENT,
                    sent_at=created_at,
                    delivered_at=created_at,
                    read_at=read_at,
                    created_at=created_at,
                )
                db.add(notif)
                seeded_count += 1

                # If it's a recent unread item, publish to live Redis channel
                if not item["is_read"] and item["delta_hours"] < 1.0:
                    payload = {
                        "id": str(notif.id),
                        "notification_id": str(notif.id),
                        "org_id": str(DEFAULT_ORG_ID),
                        "user_id": str(buyer.id),
                        "notification_type": notif.notification_type,
                        "channel": "IN_APP",
                        "title": notif.title,
                        "body": notif.body,
                        "message": notif.body,
                        "entity_type": notif.entity_type,
                        "entity_id": str(notif.entity_id),
                        "status": "SENT",
                        "created_at": notif.created_at.isoformat(),
                        "is_read": False,
                    }
                    try:
                        channel_key = RedisKeys.notification_channel(buyer.id)
                        await redis.publish(channel_key, json.dumps(payload))
                    except Exception:
                        pass

        # Seed Supplier Notifications
        if supplier:
            for item in SAMPLE_SUPPLIER_NOTIFICATIONS:
                existing_res = await db.execute(
                    select(Notification).where(
                        Notification.user_id == supplier.id,
                        Notification.title == item["title"],
                        Notification.notification_type == item["type"],
                    )
                )
                if existing_res.scalar_one_or_none():
                    continue

                created_at = now - timedelta(hours=item["delta_hours"])
                read_at = created_at + timedelta(minutes=5) if item["is_read"] else None

                notif = Notification(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    user_id=supplier.id,
                    notification_type=item["type"],
                    channel=NotificationChannelEnum.IN_APP,
                    title=item["title"],
                    body=item["body"],
                    entity_type=item["entity_type"],
                    entity_id=uuid4(),
                    status=NotificationStatusEnum.SENT,
                    sent_at=created_at,
                    delivered_at=created_at,
                    read_at=read_at,
                    created_at=created_at,
                )
                db.add(notif)
                seeded_count += 1

        await db.commit()
        await redis.aclose()
        print(f"Seeded {seeded_count} demo notifications.")

if __name__ == "__main__":
    asyncio.run(seed_demo_notifications())
