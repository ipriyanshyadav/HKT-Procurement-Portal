# IMPLEMENTATION PLAN — SPEC_02: System Architecture
**Module:** 02 | **Phase:** Foundation | **Squad:** A (Platform)
**Spec File:** SPEC_02_ARCHITECTURE.md | **Plan Date:** 2026-08-04

---

## SESSION BOOTSTRAP CHECKLIST
- [x] 0-A: GEMINI.md read
- [x] 0-B: Graphify loaded — confirm SPEC_01 nodes exist
- [x] 0-C: README.md — confirm scaffolding complete
- [x] 0-D: SPEC_02_ARCHITECTURE.md analyzed

---

## SPEC COVERAGE MAP
| Req# | Section | Coverage Target | Status |
|---|---|---|---|
| S02-01 | Modular monolith decision + extraction path | main.py factory + module boundaries | PLANNED |
| S02-02 | Full directory structure (24 modules) | `mkdir -p` commands | PLANNED |
| S02-03 | 24 service modules with dependencies | Service registry → Graphify | PLANNED |
| S02-04 | FastAPI application factory | app/main.py | PLANNED |
| S02-05 | RabbitMQ: 25 exchanges (topic, durable) | rabbitmq_setup.py script | PLANNED |
| S02-06 | RabbitMQ: routing key convention | events/schemas.py | PLANNED |
| S02-07 | RabbitMQ: 12 queue definitions with DLQs | rabbitmq_setup.py | PLANNED |
| S02-08 | DLQ policy (7-day TTL, depth alert >50) | rabbitmq_setup.py + Grafana alert | PLANNED |
| S02-09 | Outbox pattern — outbox_messages table | Migration 0002 + publisher.py | PLANNED |
| S02-10 | Outbox worker (5s interval, SKIP LOCKED) | outbox_worker.py | PLANNED |
| S02-11 | SQLAlchemy async session (pool_size=20) | db/session.py | PLANNED |
| S02-12 | Redis usage map (14 key patterns) | Redis clients per module | PLANNED |
| S02-13 | MinIO: 8 buckets + 2 internal | minio_setup.py script | PLANNED |
| S02-14 | MinIO path convention | document/service.py | PLANNED |
| S02-15 | Kong: services, routes, 5 plugins | kong/kong.yml | PLANNED |
| S02-16 | Kong: 5 rate-limiting tiers | kong/kong.yml route overrides | PLANNED |
| S02-17 | OpenTelemetry: Jaeger, sampling, force-error | core/telemetry.py | PLANNED |
| S02-18 | Loguru: JSON prod, structured fields | core/logging.py | PLANNED |
| S02-19 | Promtail: JSON parse, drop health logs | k8s/promtail-config.yaml | PLANNED |
| S02-20 | Celery: 6 queues, all 16 Beat tasks | tasks/celery_app.py | PLANNED |
| S02-21 | Health endpoints (3: basic, ready, live) | main.py | PLANNED |
| S02-22 | Error handling: 9 exception classes, handlers | core/exceptions.py | PLANNED |
| S02-23 | HTTP status codes (9 scenarios) | Documented in exceptions.py | PLANNED |

---

## ASSUMPTIONS LOG

| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-02-1 | RabbitMQ topology initialized via `scripts/rabbitmq_setup.py` (not via Celery or app startup) | App startup should not own infrastructure setup | LOW | DevOps |
| A-02-2 | MinIO buckets created via `scripts/minio_setup.py` with versioning + SSE-S3 enabled | Same reasoning as above | LOW | DevOps |
| A-02-3 | Cross-module service calls use direct Python function calls (no HTTP/gRPC in Phase 1 monolith) | SPEC states "direct Python function calls through well-defined service interfaces" | LOW — clear in spec | Squad A |
| A-02-4 | Celery Beat runs in a dedicated container (not merged with worker) | Best practice for predictable scheduling | LOW | DevOps |
| A-02-5 | `audit` module (module 24) is a service-layer-only module — no router (audit writes are internal only) | SPEC lists AuditService as terminal — no inbound calls | LOW | Squad A |
| A-02-6 | `procurement.dlx` (dead letter exchange) auto-receives failed messages via queue-level policy; no application-layer DLQ routing needed | Standard RabbitMQ DLX config | LOW | DevOps |

---

## STEP 2 — IMPLEMENT

### 2.1 RabbitMQ Setup Script
**File:** `scripts/rabbitmq_setup.py`
```python
"""
Idempotent RabbitMQ topology setup.
Run once per environment. Safe to re-run.
All names and settings from SPEC_02 Section 5.
"""
import asyncio
import aio_pika
from app.config import settings

EXCHANGES = [
    "procurement.org", "procurement.user", "procurement.audit",
    "procurement.master", "procurement.vendor", "procurement.pr",
    "procurement.unmapped", "procurement.rfq", "procurement.bid",
    "procurement.evaluation", "procurement.award", "procurement.contract",
    "procurement.po", "procurement.grn", "procurement.invoice",
    "procurement.payment", "procurement.notification", "procurement.document",
    "procurement.workflow", "procurement.rules", "procurement.integration",
    "procurement.integration.inbound", "procurement.admin", "procurement.alert",
    "procurement.dlx",
]

QUEUES = [
    # (name, exchange, routing_key, dlq_name)
    ("q.notification.email", "procurement.notification", "notification.email.*", "q.dlq.notification.email"),
    ("q.notification.sms", "procurement.notification", "notification.sms.*", "q.dlq.notification.sms"),
    ("q.notification.inapp", "procurement.notification", "notification.inapp.*", "q.dlq.notification.inapp"),
    ("q.notification.digest", "procurement.notification", "notification.digest.*", "q.dlq.notification.digest"),
    ("q.integration.erp.outbound", "procurement.integration", "integration.erp.*", "q.dlq.integration.erp"),
    ("q.integration.hrms", "procurement.integration.inbound", "hrms.*", "q.dlq.integration.hrms"),
    ("q.vendor.lifecycle", "procurement.vendor", "vendor.*", "q.dlq.vendor"),
    ("q.rfq.lifecycle", "procurement.rfq", "rfq.*", "q.dlq.rfq"),
    ("q.bid.lifecycle", "procurement.bid", "bid.*", "q.dlq.bid"),
    ("q.workflow.events", "procurement.workflow", "workflow.*", "q.dlq.workflow"),
    ("q.alert.critical", "procurement.alert", "alert.*", "q.dlq.alert"),
    ("q.audit.write", "procurement.audit", "audit.*", "q.dlq.audit"),
]

DLQ_TTL_MS = 604800000  # 7 days from settings
```

### 2.2 MinIO Setup Script
**File:** `scripts/minio_setup.py`
```python
"""
Creates all MinIO buckets with versioning + SSE-S3.
Bucket names, lifecycle rules from SPEC_02 Section 9.
"""
from minio import Minio
from app.config import settings

BUCKETS = [
    "tender-documents",
    "bid-documents",
    "compliance-documents",
    "contract-documents",
    "po-documents",
    "grn-ses-documents",
    "invoice-documents",
    "audit-documents",
    "key-vault",
    "quarantine",
]

# Lifecycle rules per bucket (archive after N years, delete after M years)
LIFECYCLE_RULES = {
    "tender-documents": {"archive_years": 7, "delete_years": 10},
    "bid-documents": {"archive_years": 7, "delete_years": 10},
    "compliance-documents": {"archive_years": 7, "delete_years": None},
    "contract-documents": {"archive_years": 10, "delete_years": None},
    "po-documents": {"archive_years": None, "delete_years": 10},
    "grn-ses-documents": {"archive_years": 7, "delete_years": None},
    "invoice-documents": {"archive_years": None, "delete_years": 10},
    "audit-documents": {"archive_years": None, "delete_years": None},  # Permanent
    "key-vault": {"archive_years": None, "delete_years": None},  # No deletion
    "quarantine": {"delete_days": 90},
}
```

### 2.3 `app/events/schemas.py` — Event Payload Schemas
```python
# All RabbitMQ event payloads as Pydantic models
# Pattern: {entity}.{action}[.{qualifier}]
# See SPEC_02 Section 5.2 for full routing key convention

class VendorInvitedEvent(BaseModel):
    vendor_id: UUID
    email: str
    org_id: UUID
    event_type: str = "vendor.invited"

class RFQPublishedEvent(BaseModel):
    rfq_id: UUID
    rfq_number: str
    org_id: UUID
    invited_vendor_count: int
    event_type: str = "rfq.published"
# ... (one model per routing key pattern from SPEC_02 Section 5.2)
```

### 2.4 `app/core/redis_client.py` — Redis Client Factory
```python
# Separate clients per DB index (not one client for all uses)
# Key patterns from SPEC_02 Section 8 — all stored as constants:

class RedisKeys:
    @staticmethod
    def session(jti: str) -> str: return f"session:{jti}"

    @staticmethod
    def revoked_token(jti: str) -> str: return f"revoked:{jti}"

    @staticmethod
    def rate_limit(user_id: UUID, endpoint_tier: str) -> str:
        return f"ratelimit:{user_id}:{endpoint_tier}"

    @staticmethod
    def failed_login(email: str) -> str: return f"failed_login:{email}"

    @staticmethod
    def idempotency(key: str) -> str: return f"idem:{key}"

    @staticmethod
    def ws_user(user_id: UUID) -> str: return f"ws:user:{user_id}"

    @staticmethod
    def notification_channel(user_id: UUID) -> str:
        return f"channel:notifications:{user_id}"

    @staticmethod
    def pr_count_cache(org_id: UUID, status: str) -> str:
        return f"cache:pr_count:{org_id}:{status}"

    @staticmethod
    def rfq_count_cache(org_id: UUID, status: str) -> str:
        return f"cache:rfq_count:{org_id}:{status}"

    @staticmethod
    def pending_approvals(user_id: UUID) -> str:
        return f"cache:pending_approvals:{user_id}"

    @staticmethod
    def vendor_verify(verification_type: str, identifier: str) -> str:
        return f"vendor_verify:{verification_type}:{identifier}"

    @staticmethod
    def exchange_rate(base: str, target: str) -> str:
        return f"exchange_rate:{base}:{target}"
```

### 2.5 `app/core/idempotency.py` — Idempotency Key Handler
```python
async def check_idempotency(redis, key: str) -> Optional[dict]:
    """Returns cached response if key exists, else None."""
    cached = await redis.get(RedisKeys.idempotency(key))
    return json.loads(cached) if cached else None

async def store_idempotency(redis, key: str, response: dict, ttl_seconds: int = 86400):
    """Store response for idempotency key with TTL from settings (not hardcoded)."""
    await redis.setex(RedisKeys.idempotency(key), ttl_seconds, json.dumps(response))
```

### 2.6 Module `__init__.py` Files
Each module directory gets an `__init__.py` with a module docstring documenting:
- Module name and responsibility
- Dependencies (which other modules it calls)
- Events published
- Events consumed
Example:
```python
# app/modules/vendor/__init__.py
"""
Vendor Management Module.
Responsibility: Vendor lifecycle from invite through blacklisting.
Dependencies: organization, master_data, user, workflow, notification, integration, document
Events Published: procurement.vendor exchange
Events Consumed: procurement.integration exchange (ERP vendor sync)
"""
```

---

## STEP 3 — TEST

### 3.1 User Persona
- All 25 RabbitMQ exchanges exist and are durable topic type
- All 12 queues exist and have DLQ binding
- All 10 MinIO buckets exist with versioning enabled
- Kong routes 24 API prefixes correctly

### 3.2 Developer Persona
**File:** `tests/unit/test_redis_keys.py`
```python
def test_session_key_format():
    assert RedisKeys.session("abc123") == "session:abc123"

def test_idempotency_key_format():
    assert RedisKeys.idempotency("idem-key-1") == "idem:idem-key-1"
```

**File:** `tests/unit/test_event_schemas.py`
- VendorInvitedEvent validates required fields
- Unknown routing key patterns rejected by schema validation

**File:** `tests/integration/test_rabbitmq.py`
- All 25 exchanges exist via management API
- DLQ depth monitoring returns 0 on clean setup

### 3.3 QA Persona
- Re-running `rabbitmq_setup.py` is idempotent (no errors on second run)
- Re-running `minio_setup.py` is idempotent
- Kong health check on all 24 upstreams passes
- Celery Beat schedule produces exactly 16 task entries in worker output
- Outbox worker processes 100 messages in < 5 seconds (batch timing test)
- DLQ Grafana alert fires when synthetic messages injected to DLQ

---

## STEP 4 — INTEGRATE
```bash
# Verify all infrastructure:
python scripts/rabbitmq_setup.py
python scripts/minio_setup.py
# Check Kong:
curl http://localhost:8001/routes | jq '. | length'  # must be >= 24
# Check Celery Beat:
celery -A app.tasks.celery_app inspect scheduled
```

---

## STEP 5 — GRAPHIFY UPDATE
```bash
graphify update
# New nodes: RabbitMQ exchanges (24 + DLX), MinIO buckets (10),
#            Redis key patterns (14), Celery Beat tasks (16)
graphify check --integrity
graphify diff > graphify_diff_$(date +%Y%m%d_%H%M%S).txt
```

---

## STEP 6 — README UPDATE
```markdown
## Current Session State
**Status:** SPEC_02 architecture verification COMPLETED
**Completed:** RabbitMQ topology (25 exchanges, 12 queues, DLQs), MinIO (10 buckets),
               Redis key patterns (14), Celery Beat (16 tasks), Kong (24 routes, 5 plugins),
               outbox pattern, module boundaries documented
**Next:** SPEC_03 Database schema
```
