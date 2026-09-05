# IMPLEMENTATION PLAN — SPEC_16: Notification Module
**Module:** 16 | **Phase:** Core | **Squad:** E
**Spec File:** SPEC_16_NOTIFICATION.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S16-01 | Email channel (SendGrid) | notification/channels/email.py | PLANNED |
| S16-02 | SMS channel (MSG91) | notification/channels/sms.py | PLANNED |
| S16-03 | In-app notifications (WebSocket + Redis pub/sub) | notification/channels/inapp.py | PLANNED |
| S16-04 | WhatsApp channel (Twilio, Phase 3 stub) | notification/channels/whatsapp.py | PLANNED |
| S16-05 | Notification templates (DB-stored, Jinja2) | notification/service.py | PLANNED |
| S16-06 | User notification preferences | notification/service.py | PLANNED |
| S16-07 | Digest mode (hourly/daily) | tasks/notification_digest.py | PLANNED |
| S16-08 | Notification consumer (RabbitMQ q.notification.*) | notification/consumer.py | PLANNED |
| S16-09 | Notification persistence (notifications table) | notification/service.py | PLANNED |
| S16-10 | Read/unread status | notification/service.py | PLANNED |
| S16-11 | Bulk mark-as-read | notification/router.py | PLANNED |
| S16-12 | WebSocket connection per user | notification/websocket.py | PLANNED |
| S16-13 | Redis channel per user (ws:user:{id}) | notification/websocket.py | PLANNED |
| S16-14 | Retry on delivery failure | notification/consumer.py | PLANNED |
| S16-15 | 20+ notification template types | scripts/seed_notification_templates.py | PLANNED |

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-16-1 | WebSocket endpoint at `/ws/notifications` authenticated via query param `?token={access_token}` (not header, since WS protocol doesn't support Authorization header natively) | Standard WebSocket auth pattern | MEDIUM | Squad E |
| A-16-2 | Redis pub/sub channel per user: `channel:notifications:{user_id}`; message payload is full notification JSON | Multiple WS connections per user supported | LOW | Squad E |
| A-16-3 | Digest mode: unread in-app notifications accumulated; sent as single email at digest interval; NEVER digest SLA_BREACH or COMPLIANCE alerts (always immediate) | SPEC Section 7; priority exceptions not stated | HIGH | Squad E |
| A-16-4 | WhatsApp stub: logs warning "WhatsApp channel is Phase 3 — not implemented"; returns success code 202 | SPEC lists WhatsApp as Phase 3 feature | LOW | Squad E |
| A-16-5 | Notification consumer uses aio-pika; separate consumer per queue (4 queues: email, sms, inapp, digest) | SPEC_02 defines 4 notification queues | LOW | Squad E |
| A-16-6 | SendGrid template ID stored in notification_templates.external_template_id; dynamic data passed as dict | SendGrid dynamic templates | LOW | Squad E |
| A-16-7 | Email and SMS channels in test/mock environments or when API keys are placeholder gracefully mock or record deliveries unless in live environment | Test suite reliability | LOW | Squad E |
| A-16-8 | Notification endpoints: GET /api/v1/notifications, POST /api/v1/notifications/{id}/read, POST /api/v1/notifications/mark-all-read, GET /api/v1/notifications/preferences, PUT /api/v1/notifications/preferences, and WS route /ws/notifications | Standard REST + WS routing | LOW | Squad E |
| A-16-9 | NotificationBell and NotificationCenter components use TanStack query and Zustand notification store with WebSocket live updates | UI responsiveness | LOW | Squad E |

---
## STEP 2 — IMPLEMENT

### 2.1 `app/modules/notification/channels/email.py`
```python
import httpx
from app.config import settings

class EmailChannel:
    BASE_URL = "https://api.sendgrid.com/v3/mail/send"

    async def send(self, to_email: str, template_code: str, context: dict, org_id: UUID) -> bool:
        template = await self._get_template(template_code, org_id)
        payload = {
            "personalizations": [{"to": [{"email": to_email}], "dynamic_template_data": context}],
            "from": {"email": settings.SENDGRID_FROM_EMAIL, "name": "Procurement Portal"},
            "template_id": template.external_template_id,
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                self.BASE_URL, json=payload,
                headers={"Authorization": f"Bearer {settings.SENDGRID_API_KEY}"},
            )
        if response.status_code not in (200, 202):
            raise ExternalServiceError("SENDGRID_FAILED", f"SendGrid API error: {response.status_code}")
        return True
```

### 2.2 `app/modules/notification/channels/inapp.py`
```python
import json
from app.core.redis_client import get_redis

class InAppChannel:
    async def send(self, user_id: UUID, notification: Notification) -> bool:
        redis = await get_redis()
        payload = {
            "notification_id": str(notification.id),
            "title": notification.title,
            "message": notification.message,
            "notification_type": notification.notification_type,
            "entity_type": notification.entity_type,
            "entity_id": str(notification.entity_id) if notification.entity_id else None,
            "created_at": notification.created_at.isoformat(),
            "is_read": False,
        }
        channel_key = RedisKeys.notification_channel(user_id)
        await redis.publish(channel_key, json.dumps(payload))
        return True
```

### 2.3 `app/modules/notification/websocket.py`
```python
from fastapi import WebSocket, WebSocketDisconnect, Query
from app.auth.jwt import decode_jwt
from app.core.redis_client import get_redis
import asyncio, json

class NotificationWebSocketManager:
    active_connections: dict[UUID, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, token: str) -> UUID:
        try:
            payload = decode_jwt(token)
            user_id = UUID(payload["sub"])
        except Exception:
            await websocket.close(code=4001)
            raise
        await websocket.accept()
        self.active_connections.setdefault(user_id, []).append(websocket)
        return user_id

    async def listen_redis(self, user_id: UUID, websocket: WebSocket):
        """Subscribe to Redis channel and forward to WebSocket."""
        redis = await get_redis()
        channel_key = RedisKeys.notification_channel(user_id)
        pubsub = redis.pubsub()
        await pubsub.subscribe(channel_key)
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await websocket.send_text(message["data"].decode())
        except WebSocketDisconnect:
            await pubsub.unsubscribe(channel_key)
            self.active_connections[user_id].remove(websocket)

ws_manager = NotificationWebSocketManager()
```

### 2.4 `app/modules/notification/consumer.py`
```python
class NotificationConsumer:
    """aio-pika consumer for all notification queues."""

    async def start_consuming(self, channel):
        for queue_name in ["q.notification.email", "q.notification.sms", "q.notification.inapp", "q.notification.digest"]:
            queue = await channel.declare_queue(queue_name, durable=True, passive=True)
            await queue.consume(self._route_message)

    async def _route_message(self, message: aio_pika.IncomingMessage):
        async with message.process(requeue=True):
            body = json.loads(message.body)
            routing_key = message.routing_key
            try:
                if routing_key.startswith("notification.email"):
                    await self.email_channel.send(body["to_email"], body["template_code"], body.get("context", {}), UUID(body["org_id"]))
                elif routing_key.startswith("notification.sms"):
                    await self.sms_channel.send(body["to_phone"], body["message"], UUID(body["org_id"]))
                elif routing_key.startswith("notification.inapp"):
                    await self._create_and_push_inapp(body)
                elif routing_key.startswith("notification.digest"):
                    await self._add_to_digest(body)
                await self._persist_notification(body)
            except ExternalServiceError as e:
                retry_count = message.headers.get("x-retry-count", 0)
                if retry_count >= settings.OUTBOX_RETRY_MAX:
                    await message.reject(requeue=False)  # Send to DLQ
                else:
                    await asyncio.sleep(2 ** retry_count)
                    raise  # Requeue with incremented retry count
```

### 2.5 Router
- `GET /api/v1/notifications` — paginated list (unread first)
- `POST /api/v1/notifications/{id}/read` — mark single as read
- `POST /api/v1/notifications/mark-all-read`
- `GET /api/v1/notifications/preferences`
- `PUT /api/v1/notifications/preferences`
- `WebSocket: /ws/notifications?token={access_token}`

---
## STEP 3 — TEST
```python
async def test_websocket_auth_invalid_token(ws_client):
    """Invalid token → WebSocket closed with 4001."""
async def test_inapp_notification_delivered_via_redis(ws_client, factory):
    """InAppChannel.send() publishes to correct Redis channel."""
async def test_digest_excludes_sla_breach(db, factory):
    """SLA_BREACH notification type never queued to digest."""
async def test_email_retry_on_sendgrid_failure(mock_sendgrid):
    """SendGrid 500 → message requeued with retry delay."""
async def test_whatsapp_stub_returns_202(db, factory):
    """WhatsApp channel returns 202 with stub warning log."""
async def test_user_preferences_respected(db, factory):
    """User with email=False preference: no email notification sent."""
```

---
## STEP 5 — GRAPHIFY UPDATE
```bash
graphify update
# Nodes: EmailChannel, SMSChannel, InAppChannel, WhatsAppStub, NotificationConsumer,
#        NotificationWebSocketManager, DigestTask, NotificationService
```
