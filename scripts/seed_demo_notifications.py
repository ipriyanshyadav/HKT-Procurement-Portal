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

from sqlalchemy import select, and_, delete
from app.db.session import async_session
from app.db.enums import NotificationChannelEnum, NotificationStatusEnum
from app.modules.notification.models import Notification
from app.modules.user.models import User
from app.modules.requisition.models import Requisition
from app.modules.sourcing.models import Rfq
from app.modules.purchase_order.models import PurchaseOrder
from app.modules.invoice.models import Invoice
from app.core.redis_client import get_redis, RedisKeys

DEFAULT_ORG_ID = UUID("00000000-0000-0000-0000-000000000001")

async def seed_demo_notifications():
    now = datetime.now(timezone.utc)
    redis = get_redis()

    async with async_session() as db:
        # Fetch live entities from other tabs in Default Org
        pr_res = await db.execute(select(Requisition).where(Requisition.org_id == DEFAULT_ORG_ID).limit(1))
        live_pr = pr_res.scalar_one_or_none()

        rfq_res = await db.execute(select(Rfq).where(Rfq.org_id == DEFAULT_ORG_ID).limit(1))
        live_rfq = rfq_res.scalar_one_or_none()

        po_res = await db.execute(select(PurchaseOrder).where(PurchaseOrder.org_id == DEFAULT_ORG_ID).limit(1))
        live_po = po_res.scalar_one_or_none()

        inv_res = await db.execute(select(Invoice).where(Invoice.org_id == DEFAULT_ORG_ID).limit(1))
        live_inv = inv_res.scalar_one_or_none()

        # Find demo users
        users_res = await db.execute(
            select(User).where(
                User.org_id == DEFAULT_ORG_ID,
                User.email.in_(["buyer@procurement.com", "supplier@acme.com", "admin@procurement.com", "approver@procurement.com"]),
            )
        )
        users = {u.email: u for u in users_res.scalars().all()}
        buyer = users.get("buyer@procurement.com")
        supplier = users.get("supplier@acme.com")
        approver = users.get("approver@procurement.com")
        admin = users.get("admin@procurement.com")

        # Clean existing demo notifications to ensure fresh live links
        for u in [buyer, supplier, approver, admin]:
            if u:
                await db.execute(delete(Notification).where(Notification.user_id == u.id))

        pr_num = live_pr.pr_number if live_pr else "PR-IT-2026-000002"
        pr_id = live_pr.id if live_pr else uuid4()
        pr_title = live_pr.title if live_pr else "Production Kubernetes Cluster Cloud Infrastructure"

        rfq_num = live_rfq.rfq_number if live_rfq else "RFQ-2026-000002"
        rfq_id = live_rfq.id if live_rfq else uuid4()
        rfq_title = live_rfq.title if live_rfq else "Enterprise Cloud Object Storage & Backup Expansion"

        po_num = live_po.po_number if live_po else "PO-2026-000001"
        po_id = live_po.id if live_po else uuid4()

        inv_num = live_inv.invoice_number if live_inv else "INV-2026-000001"
        inv_id = live_inv.id if live_inv else uuid4()

        buyer_items = [
            {
                "type": "pr_submitted",
                "title": f"New PR Approval Request: {pr_num}",
                "body": f"Requisition {pr_num} ('{pr_title}') requires your review and approval.",
                "entity_type": "requisition",
                "entity_id": pr_id,
                "is_read": False,
                "delta_hours": 0.25,
            },
            {
                "type": "rfq_published",
                "title": f"Active Sourcing Tender: {rfq_num}",
                "body": f"RFQ {rfq_num} ('{rfq_title}') is active. Sourcing and bids are open.",
                "entity_type": "rfq",
                "entity_id": rfq_id,
                "is_read": False,
                "delta_hours": 1.0,
            },
            {
                "type": "bid_submitted",
                "title": f"Bid Received on {rfq_num}",
                "body": f"Vendor Acme Tech Solutions submitted sealed proposal for tender {rfq_num}.",
                "entity_type": "rfq",
                "entity_id": rfq_id,
                "is_read": False,
                "delta_hours": 2.5,
            },
            {
                "type": "invoice_disputed",
                "title": f"Invoice Disputed: {inv_num}",
                "body": f"Invoice {inv_num} flagged with 3-way match price mismatch exceeding 0.5% tolerance.",
                "entity_type": "invoice",
                "entity_id": inv_id,
                "is_read": False,
                "delta_hours": 4.0,
            },
            {
                "type": "approval_sla_escalation",
                "title": "SLA Escalation Alert: High-Value Approval",
                "body": f"Approval workflow for {po_num} breached 24h SLA. Escalated to Procurement Head.",
                "entity_type": "purchase_order",
                "entity_id": po_id,
                "is_read": False,
                "delta_hours": 6.0,
            },
            {
                "type": "po_released",
                "title": f"Purchase Order Released: {po_num}",
                "body": f"PO {po_num} has been officially issued to supplier for delivery.",
                "entity_type": "purchase_order",
                "entity_id": po_id,
                "is_read": True,
                "delta_hours": 24.0,
            },
            {
                "type": "payment_completed",
                "title": f"Payment Processed: {inv_num}",
                "body": f"Payment completed for invoice {inv_num}. Remittance advice UTR: AXISN00984716.",
                "entity_type": "invoice",
                "entity_id": inv_id,
                "is_read": True,
                "delta_hours": 48.0,
            },
            {
                "type": "vendor_qualified",
                "title": "Vendor Onboarding Approved",
                "body": "Vendor qualification status for 'Acme Tech Solutions' is now marked QUALIFIED.",
                "entity_type": "vendor",
                "entity_id": uuid4(),
                "is_read": True,
                "delta_hours": 72.0,
            },
        ]

        supplier_items = [
            {
                "type": "rfq_published",
                "title": f"Invitation to Bid: {rfq_num}",
                "body": f"You are invited to submit bids for tender {rfq_num} ('{rfq_title}').",
                "entity_type": "rfq",
                "entity_id": rfq_id,
                "is_read": False,
                "delta_hours": 1.5,
            },
            {
                "type": "rfq_bid_deadline_4h",
                "title": f"URGENT: 4h Bid Deadline on {rfq_num}",
                "body": f"Only 4 hours remain before bidding closes for tender {rfq_num}. Please submit your sealed bid.",
                "entity_type": "rfq",
                "entity_id": rfq_id,
                "is_read": False,
                "delta_hours": 3.0,
            },
            {
                "type": "po_released",
                "title": f"New PO Issued: {po_num}",
                "body": f"Purchase order {po_num} has been issued to your organization. Please acknowledge receipt.",
                "entity_type": "purchase_order",
                "entity_id": po_id,
                "is_read": False,
                "delta_hours": 8.0,
            },
            {
                "type": "payment_completed",
                "title": f"Payment Remittance Advice: {inv_num}",
                "body": f"Payment for invoice {inv_num} has been transferred. UTR: AXISN00984716.",
                "entity_type": "invoice",
                "entity_id": inv_id,
                "is_read": True,
                "delta_hours": 36.0,
            },
            {
                "type": "vendor_compliance_warning",
                "title": "GST Certificate Expiry Warning",
                "body": "Your GST tax compliance certificate expires in 25 days. Please upload renewed documentation.",
                "entity_type": "vendor",
                "entity_id": uuid4(),
                "is_read": True,
                "delta_hours": 60.0,
            },
        ]

        approver_items = [
            {
                "type": "pr_submitted",
                "title": f"PR Approval Required: {pr_num}",
                "body": f"Requisition {pr_num} ('{pr_title}') requires your sign-off in the Approvals inbox.",
                "entity_type": "requisition",
                "entity_id": pr_id,
                "is_read": False,
                "delta_hours": 0.5,
            },
            {
                "type": "po_approval",
                "title": f"Purchase Order Sign-Off: {po_num}",
                "body": f"Purchase order {po_num} requires procurement leadership authorization.",
                "entity_type": "purchase_order",
                "entity_id": po_id,
                "is_read": False,
                "delta_hours": 1.8,
            },
            {
                "type": "rfq_bid_opening",
                "title": f"Dual-Auth Bid Opening Ready: {rfq_num}",
                "body": f"Bidding deadline has elapsed for {rfq_num}. Dual-authorization required to unseal bids.",
                "entity_type": "rfq",
                "entity_id": rfq_id,
                "is_read": False,
                "delta_hours": 3.2,
            },
            {
                "type": "contract_review",
                "title": "Contract Under Review: CON-2026-000002",
                "body": "Annual Hardware Support contract terms submitted for executive review and e-signature.",
                "entity_type": "contract",
                "entity_id": uuid4(),
                "is_read": True,
                "delta_hours": 18.0,
            },
        ]

        admin_items = [
            {
                "type": "integration_sync_completed",
                "title": "ERP Integration Sync Complete",
                "body": "Nightly SAP S/4HANA vendor and MM purchase order sync finished with 0 errors.",
                "entity_type": "integration",
                "entity_id": uuid4(),
                "is_read": False,
                "delta_hours": 1.0,
            },
            {
                "type": "sla_warning",
                "title": "Support Ticket SLA Approaching",
                "body": "Ticket TKT-DEF-2026-000001 resolution SLA deadline in under 4 hours.",
                "entity_type": "ticket",
                "entity_id": uuid4(),
                "is_read": False,
                "delta_hours": 2.0,
            },
            {
                "type": "system_health_ok",
                "title": "System Telemetry Healthy",
                "body": "PostgreSQL connection pools, Redis cache, and RabbitMQ message broker all operating normally.",
                "entity_type": "system",
                "entity_id": uuid4(),
                "is_read": True,
                "delta_hours": 24.0,
            },
        ]

        seeded_count = 0

        if buyer:
            for item in buyer_items:
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
                    entity_id=item["entity_id"],
                    status=NotificationStatusEnum.SENT,
                    sent_at=created_at,
                    delivered_at=created_at,
                    read_at=read_at,
                    created_at=created_at,
                )
                db.add(notif)
                seeded_count += 1

                # Live push for recent unread items
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

        if supplier:
            for item in supplier_items:
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
                    entity_id=item["entity_id"],
                    status=NotificationStatusEnum.SENT,
                    sent_at=created_at,
                    delivered_at=created_at,
                    read_at=read_at,
                    created_at=created_at,
                )
                db.add(notif)
                seeded_count += 1

        if approver:
            for item in approver_items:
                created_at = now - timedelta(hours=item["delta_hours"])
                read_at = created_at + timedelta(minutes=5) if item["is_read"] else None

                notif = Notification(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    user_id=approver.id,
                    notification_type=item["type"],
                    channel=NotificationChannelEnum.IN_APP,
                    title=item["title"],
                    body=item["body"],
                    entity_type=item["entity_type"],
                    entity_id=item["entity_id"],
                    status=NotificationStatusEnum.SENT,
                    sent_at=created_at,
                    delivered_at=created_at,
                    read_at=read_at,
                    created_at=created_at,
                )
                db.add(notif)
                seeded_count += 1

        if admin:
            for item in admin_items:
                created_at = now - timedelta(hours=item["delta_hours"])
                read_at = created_at + timedelta(minutes=5) if item["is_read"] else None

                notif = Notification(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    user_id=admin.id,
                    notification_type=item["type"],
                    channel=NotificationChannelEnum.IN_APP,
                    title=item["title"],
                    body=item["body"],
                    entity_type=item["entity_type"],
                    entity_id=item["entity_id"],
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
        print(f"Seeded {seeded_count} live-linked notifications.")

if __name__ == "__main__":
    asyncio.run(seed_demo_notifications())
