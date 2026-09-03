# IMPLEMENTATION PLAN — SPEC_20: Integration Layer
**Module:** 20 | **Phase:** Core | **Squad:** E
**Spec File:** SPEC_20_INTEGRATION.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S20-01 | ERP adapter interface (SAP/Oracle/custom) | integration/adapters/erp_base.py | PLANNED |
| S20-02 | ERP vendor sync (bidirectional) | integration/adapters/erp_vendor.py | PLANNED |
| S20-03 | ERP PO sync (outbound only) | integration/adapters/erp_po.py | PLANNED |
| S20-04 | ERP invoice sync (inbound: ERP→procurement) | integration/adapters/erp_invoice.py | PLANNED |
| S20-05 | ERP payment sync (outbound) | integration/adapters/erp_payment.py | PLANNED |
| S20-06 | ERP material master lookup | integration/adapters/erp_material.py | PLANNED |
| S20-07 | HRMS user sync (employee→user) | integration/adapters/hrms.py | PLANNED |
| S20-08 | GST portal integration | integration/adapters/gst.py | PLANNED |
| S20-09 | GEM portal integration | integration/adapters/gem.py | PLANNED |
| S20-10 | integration_jobs table + retry logic | integration/job_processor.py | PLANNED |
| S20-11 | 7-step exponential retry (60s→86400s) | integration/job_processor.py | PLANNED |
| S20-12 | SSRF prevention (allowlist per org) | integration/http_client.py | PLANNED |
| S20-13 | Webhook outbound delivery | integration/webhook.py | PLANNED |
| S20-14 | Idempotency on all integration writes | integration/adapters/erp_base.py | PLANNED |
| S20-15 | Integration audit trail | integration/job_processor.py | PLANNED |
| S20-16 | Dead Letter + manual retry UI | admin/router.py | PLANNED |
| S20-17 | Bank account verification | integration/adapters/bank.py | PLANNED |

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-20-1 | ERP adapter is pluggable interface; `ERPAdapterBase` abstract class; concrete adapter selected via `tenant_settings.erp_provider` ("SAP", "ORACLE", "CUSTOM") | SPEC Section 1 pluggable ERP | MEDIUM | Squad E |
| A-20-2 | ERP base URL, credentials stored in `tenant_settings.erp_config` (encrypted JSONB); NOT in environment variables (multi-tenant) | Different orgs may have different ERPs | HIGH — credential exposure | Squad E |
| A-20-3 | Integration retry delays from `settings.INTEGRATION_RETRY_DELAYS_SECONDS = [60, 300, 900, 1800, 3600, 14400, 86400]`; exactly 7 steps | SPEC Section 11 | LOW | Squad E |
| A-20-4 | SSRF allowlist: each org's allowed_integration_domains stored in `tenant_settings.allowed_domains`; requests to non-listed domains rejected with 403 | SPEC_04 Section 26 SSRF | HIGH — open redirect risk | Squad E |
| A-20-5 | HRMS sync: employee terminated → `users.status=TERMINATED`, all active sessions revoked | SPEC Section 7 HRMS termination | HIGH — security risk | Squad E |
| A-20-6 | Webhook delivery: HMAC-SHA256 signature in `X-Procurement-Signature` header; secret per webhook endpoint stored in `integration_jobs` config | SPEC Section 13 | MEDIUM | Squad E |

---
## STEP 2 — IMPLEMENT

### 2.1 `app/modules/integration/adapters/erp_base.py`
```python
from abc import ABC, abstractmethod
from uuid import UUID

class ERPAdapterBase(ABC):
    """All ERP adapters implement this interface."""

    @abstractmethod
    async def sync_vendor(self, vendor_id: UUID, org_id: UUID) -> dict: ...

    @abstractmethod
    async def create_po(self, po_id: UUID, org_id: UUID) -> dict: ...

    @abstractmethod
    async def get_material_master(self, material_code: str, org_id: UUID) -> dict: ...

    @abstractmethod
    async def confirm_payment(self, payment_id: UUID, org_id: UUID) -> dict: ...

    @abstractmethod
    async def health_check(self) -> bool: ...

class ERPAdapterFactory:
    @staticmethod
    def get_adapter(erp_provider: str, erp_config: dict) -> ERPAdapterBase:
        if erp_provider == "SAP":
            from .erp_sap import SAPAdapter
            return SAPAdapter(erp_config)
        elif erp_provider == "ORACLE":
            from .erp_oracle import OracleAdapter
            return OracleAdapter(erp_config)
        else:
            from .erp_custom import CustomERPAdapter
            return CustomERPAdapter(erp_config)
```

### 2.2 `app/modules/integration/http_client.py` — SSRF-Safe HTTP Client
```python
import httpx
from app.core.exceptions import ForbiddenError

class SafeHTTPClient:
    """HTTP client with SSRF allowlist enforcement."""

    def __init__(self, allowed_domains: list[str]):
        self._allowed = set(allowed_domains)

    def _validate_url(self, url: str) -> None:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        domain = parsed.hostname
        if domain not in self._allowed:
            raise ForbiddenError("SSRF_BLOCKED",
                f"Domain {domain} not in integration allowlist. Add via tenant settings.")

    async def get(self, url: str, **kwargs) -> httpx.Response:
        self._validate_url(url)
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
            return await client.get(url, **kwargs)

    async def post(self, url: str, **kwargs) -> httpx.Response:
        self._validate_url(url)
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
            return await client.post(url, **kwargs)
```

### 2.3 `app/modules/integration/job_processor.py`
```python
class IntegrationJobProcessor:

    async def create_job(self, db, job_type: str, entity_type: str, entity_id: UUID,
                          payload: dict, org_id: UUID) -> IntegrationJob:
        job = IntegrationJob(
            org_id=org_id, job_type=job_type, entity_type=entity_type,
            entity_id=entity_id, payload=payload, status="PENDING",
            retry_count=0, max_retries=settings.INTEGRATION_JOB_MAX_RETRIES,
            next_retry_at=datetime.utcnow(),
        )
        db.add(job)
        return job

    async def process_pending_jobs(self, db) -> None:
        jobs = await self.repo.get_due_jobs(db, datetime.utcnow())
        for job in jobs:
            await self._process_job(db, job)

    async def _process_job(self, db, job: IntegrationJob) -> None:
        job.status = "IN_PROGRESS"
        job.last_attempted_at = datetime.utcnow()
        try:
            # Load ERP config from tenant settings
            tenant_settings = await self.tenant_repo.get_settings(db, job.org_id)
            erp_config = tenant_settings.erp_config or {}
            erp_provider = tenant_settings.erp_provider or "CUSTOM"
            adapter = ERPAdapterFactory.get_adapter(erp_provider, erp_config)
            if job.job_type == "VENDOR_SYNC":
                result = await adapter.sync_vendor(job.entity_id, job.org_id)
            elif job.job_type == "PO_CREATE":
                result = await adapter.create_po(job.entity_id, job.org_id)
            elif job.job_type == "PAYMENT_CONFIRM":
                result = await adapter.confirm_payment(job.entity_id, job.org_id)
            else:
                raise AppException("UNKNOWN_JOB_TYPE", f"Unknown job type: {job.job_type}")
            job.status = "COMPLETED"
            job.result = result
            await self.audit.log(db, "INTEGRATION", job.id, "INTEGRATION_JOB_COMPLETED", None, job.org_id)
        except Exception as e:
            job.retry_count += 1
            job.last_error = str(e)[:500]
            if job.retry_count >= job.max_retries:
                job.status = "FAILED"
                await self.publisher.publish("procurement.alert", "alert.integration.job_failed",
                    {"job_id": str(job.id), "job_type": job.job_type, "error": str(e)[:200]}, job.org_id)
            else:
                job.status = "PENDING"
                delay = settings.INTEGRATION_RETRY_DELAYS_SECONDS[min(job.retry_count - 1, len(settings.INTEGRATION_RETRY_DELAYS_SECONDS) - 1)]
                job.next_retry_at = datetime.utcnow() + timedelta(seconds=delay)
```

### 2.4 `app/modules/integration/webhook.py`
```python
import hmac, hashlib, json, httpx

class WebhookDeliveryService:

    async def deliver(self, endpoint_url: str, secret: str, payload: dict, event_type: str) -> bool:
        body = json.dumps(payload, default=str).encode()
        signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
                resp = await client.post(endpoint_url, content=body, headers={
                    "Content-Type": "application/json",
                    "X-Procurement-Event": event_type,
                    "X-Procurement-Signature": f"sha256={signature}",
                })
            return resp.status_code in (200, 201, 202)
        except Exception:
            return False
```

### 2.5 HRMS Consumer
```python
# app/modules/integration/adapters/hrms.py
class HRMSConsumer:
    async def handle_termination(self, db, employee_id: str, org_id: UUID) -> None:
        user = await self.user_repo.find_by_employee_id(db, employee_id, org_id)
        if user:
            user.status = "TERMINATED"
            # Revoke ALL active sessions immediately
            await self.session_repo.revoke_all(db, user.id, org_id, "HRMS_TERMINATION")
            # Revoke pending workflow tasks
            await self.workflow_repo.reassign_pending_tasks(db, user.id, org_id)
            await self.audit.log(db, "USER", user.id, "USER_HRMS_TERMINATED", None, org_id)
```

---
## STEP 3 — TEST
```python
async def test_ssrf_blocked_unknown_domain(factory):
    client = SafeHTTPClient(allowed_domains=["erp.company.com"])
    with pytest.raises(ForbiddenError, match="SSRF_BLOCKED"):
        await client.get("https://evil.com/steal")

async def test_retry_delay_sequence(db, factory):
    """Job fails 7 times; next_retry_at follows INTEGRATION_RETRY_DELAYS_SECONDS."""
async def test_failed_job_sends_alert(db, factory, mock_erp):
    """7 failures → status=FAILED + alert published to procurement.alert."""
async def test_hrms_termination_revokes_sessions(db, factory):
    """Employee terminated → user.status=TERMINATED + 0 active sessions."""
async def test_webhook_signature_valid(factory):
    """Verify HMAC-SHA256 sig in X-Procurement-Signature header."""
async def test_erp_adapter_factory_selects_correct(factory):
    adapter = ERPAdapterFactory.get_adapter("SAP", {})
    assert isinstance(adapter, SAPAdapter)
```
