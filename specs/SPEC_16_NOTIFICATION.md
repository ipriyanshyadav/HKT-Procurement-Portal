# SPEC_16_NOTIFICATION.md

## Title
Enterprise S2P Procurement Portal — Notification System

## Purpose
Define the notification architecture, all event handlers, channel routing, template management, retry logic, preferences, digest mode, and WebSocket real-time delivery.

## Scope
Covers architecture, all 30+ notification events, email (SendGrid), SMS (MSG91/Twilio), in-app (WebSocket), template system, critical notifications, digest mode, notification_logs, and preference management.

## Dependencies
- SPEC_02_ARCHITECTURE.md (RabbitMQ topology, Celery queues)
- SPEC_03_DATABASE.md (notifications, notification_preferences, notification_templates tables)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. Architecture

```
RabbitMQ (procurement.notification exchange)
  → q.notification.email → Celery worker → SendGrid API
  → q.notification.sms → Celery worker → MSG91 / Twilio API
  → q.notification.inapp → Celery worker → Redis pub/sub → WebSocket
  → q.notification.digest → Celery worker → accumulate → daily digest email
```

The `NotificationService` subscribes to the `procurement.notification` exchange. When any module publishes a notification event, the service:
1. Loads the notification template
2. Checks user preferences
3. Routes to appropriate channel queues

---

## 2. All Notification Events

| # | Event | Template Code | Recipients | Channels | Can Be Muted | Retry |
|---|---|---|---|---|---|---|
| 1 | Vendor invited | `vendor_invited` | Vendor primary email | Email | No | 3× |
| 2 | Vendor submitted for review | `vendor_submitted` | Vendor Admin, Category Manager | Email, In-App | Yes | 3× |
| 3 | Vendor qualification approved | `vendor_qualified` | Vendor primary email | Email, In-App | No | 3× |
| 4 | Vendor qualification rejected | `vendor_rejected` | Vendor primary email | Email | No | 3× |
| 5 | Vendor resubmission requested | `vendor_resubmission` | Vendor primary email | Email, In-App | No | 3× |
| 6 | Vendor activated | `vendor_activated` | Vendor primary email, Vendor Admin | Email, In-App | No | 3× |
| 7 | Vendor compliance warning (90/30 days) | `vendor_compliance_warning` | Vendor primary email, Vendor Admin | Email, In-App | Yes | 3× |
| 8 | Vendor compliance hold | `vendor_compliance_hold` | Vendor primary email, Vendor Admin, Proc Head | Email, SMS, In-App | No | 3× |
| 9 | Vendor blacklisted | `vendor_blacklisted` | Vendor primary email, Compliance, Proc Head | Email, In-App | No | 3× |
| 10 | PR submitted for approval | `pr_submitted` | Assigned approver | Email, In-App | Yes | 3× |
| 11 | PR approved | `pr_approved` | Requestor, Buyer | Email, In-App | Yes | 3× |
| 12 | PR rejected | `pr_rejected` | Requestor | Email, In-App | No | 3× |
| 13 | PR aging warning | `pr_aging` | Buyer, Sourcing Manager | Email, In-App | Yes | 2× |
| 14 | PR merged | `pr_merged` | All source PR requestors | Email, In-App | Yes | 3× |
| 15 | RFQ published (to bidders) | `rfq_published` | All invited vendor contacts | Email, In-App | No | 3× |
| 16 | RFQ amended | `rfq_amended` | All invited vendor contacts, Buyer | Email, In-App | No | 3× |
| 17 | RFQ cancelled | `rfq_cancelled` | All invited vendor contacts | Email, In-App | No | 3× |
| 18 | RFQ bid deadline 4h reminder | `rfq_bid_deadline_4h` | All invited vendors who haven't submitted | Email, SMS | No | 2× |
| 19 | Bid submitted confirmation | `bid_submitted` | Submitting vendor contact | Email, In-App | Yes | 3× |
| 20 | Bid opening completed | `bid_opened` | Buyer, Sourcing Manager | Email, In-App | Yes | 3× |
| 21 | Award notification (winner) | `award_winner` | Winning vendor contact | Email, In-App | No | 3× |
| 22 | Award notification (non-winner) | `award_non_winner` | Non-winning vendor contacts | Email | No | 3× |
| 23 | Approval task created | `approval_task_created` | Assigned approver | Email, In-App | Yes | 3× |
| 24 | Approval SLA escalation | `approval_sla_escalation` | Escalation target, Original approver | Email, SMS, In-App | No | 3× |
| 25 | PO released | `po_released` | Supplier contact | Email, In-App | No | 3× |
| 26 | PO rejected by supplier | `po_rejected_supplier` | Buyer, Proc Head | Email, SMS, In-App | No | 3× |
| 27 | Invoice matched | `invoice_matched` | Finance Controller | Email, In-App | Yes | 3× |
| 28 | Invoice disputed | `invoice_disputed` | Supplier, Finance | Email, In-App | No | 3× |
| 29 | Payment completed | `payment_completed` | Supplier finance contact | Email, In-App | Yes | 3× |
| 30 | Contract expiry alert (90/60/30 days) | `contract_expiry` | Buyer, Category Manager | Email, In-App | Yes | 3× |
| 31 | Security alert (account locked) | `security_alert` | Affected user, Admin | Email, SMS | No | 3× |
| 32 | Unmapped PR SLA breach | `unmapped_pr_sla` | Proc Admin, Category Manager | Email, In-App | No | 3× |
| 33 | ERP sync failure | `erp_sync_failure` | Integration Admin | Email, In-App | Yes | 3× |
| 34 | Clarification answer published | `clarification_published` | All invited vendors | Email, In-App | Yes | 3× |

---

## 3. Email Provider (SendGrid)

```python
# app/modules/notification/channels/email.py

class EmailChannel:
    async def send(self, recipient_email: str, subject: str, body_html: str, template_vars: dict) -> str:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {settings.SENDGRID_API_KEY}"},
                json={
                    "personalizations": [{"to": [{"email": recipient_email}], "dynamic_template_data": template_vars}],
                    "from": {"email": settings.FROM_EMAIL, "name": "S2P Procurement Portal"},
                    "subject": subject,
                    "content": [{"type": "text/html", "value": body_html}],
                }
            )
            if response.status_code >= 400:
                raise NotificationDeliveryError(f"SendGrid error: {response.status_code}")
            return response.headers.get("X-Message-Id", "")
```

**Bounce handling:** Webhook at `POST /api/v1/webhooks/email/bounce` → update `notifications.status = BOUNCED` → notify buyer to update vendor contact.

**Dead letter:** After 3 failed retries → `notifications.status = FAILED` → logged in notification_logs.

## 4. SMS Provider

Primary: MSG91 (India). Fallback: Twilio (international). Retry 2×. On SMS failure → fallback to email. SMS character limit: split messages > 160 chars.

## 5. In-App (WebSocket)

```python
# app/modules/notification/channels/websocket.py

@router.websocket("/ws/notifications/{user_id}")
async def notification_ws(websocket: WebSocket, user_id: UUID):
    # Authenticate via one-time token in query param
    token = websocket.query_params.get("token")
    user = await validate_ws_token(token)
    if not user or str(user.id) != str(user_id):
        await websocket.close(code=4001)
        return

    await websocket.accept()
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"channel:notifications:{user_id}")

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_json(json.loads(message["data"]))
    except WebSocketDisconnect:
        await pubsub.unsubscribe(f"channel:notifications:{user_id}")
```

Redis pub/sub distributes notifications across multiple FastAPI instances. Fallback to SSE if WebSocket not supported by client.

## 6. Notification Template System

Templates stored in `notification_templates` table. Body uses Jinja2 syntax:

```
Subject: "Action Required: Approve PR {{pr_number}}"
Body: "Dear {{approver_name}},\n\nPR {{pr_number}} ({{pr_title}}) worth {{currency}} {{amount}} requires your approval.\n\nSubmitted by: {{requestor_name}}\nBusiness Unit: {{bu_name}}\n\nPlease review at: {{portal_url}}/approvals/{{task_id}}"
```

Multi-language: `language` field on template (default `en`); matched to `users.language`.

## 7. Critical Notifications (Cannot Be Muted)

`rfq_bid_deadline_4h`, `approval_sla_escalation`, `security_alert`, `account_locked`, `vendor_compliance_hold`, `rfq_compliance_hold`

These bypass user preference settings and are always delivered on all enabled channels.

## 8. Digest Mode

Non-critical notifications accumulate in `notifications` table with `channel = DIGEST`. Celery Beat task `compile_notification_digests` runs daily at 07:00 UTC:

```python
async def compile_digests():
    users_with_digest = await pref_repo.get_users_with_digest(db)
    for user in users_with_digest:
        # Adjust for user timezone
        pending = await notification_repo.get_pending_digest(db, user.id, user.org_id)
        if pending:
            digest_html = render_digest_template(pending)
            await email_channel.send(user.email, "Your Daily Procurement Digest", digest_html, {})
            for n in pending:
                n.status = NotificationStatus.SENT
```

## 9. Preference Management

`notification_preferences` table: per user per notification_type.

```
GET /api/v1/notifications/preferences
PUT /api/v1/notifications/preferences

{
  "preferences": [
    {"notification_type": "pr_submitted", "email_enabled": true, "sms_enabled": false, "inapp_enabled": true, "digest_mode": false},
    {"notification_type": "pr_aging", "email_enabled": false, "sms_enabled": false, "inapp_enabled": true, "digest_mode": true},
    ...
  ]
}
```

Quiet hours (SMS only): `quiet_hours_start` and `quiet_hours_end` — SMS delayed until quiet hours end.
