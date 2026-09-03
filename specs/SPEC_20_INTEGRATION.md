# SPEC_20_INTEGRATION.md

## Title
Enterprise S2P Procurement Portal — Integration Architecture

## Purpose
Define the complete integration architecture for ERP, HRMS, SSO, email, SMS, eSignature, tax APIs, bank validation, and BI tools.

## Scope
Covers IntegrationService adapter architecture, ERP integration flows for all 10 data entities, integration job tracking and retry, HRMS integration, SSO SAML/OIDC, email/SMS infrastructure, bank validation, GST/PAN verification, eSign integration, and nightly reconciliation.

## Dependencies
- SPEC_02_ARCHITECTURE.md (Celery queues, RabbitMQ topology)
- SPEC_03_DATABASE.md (integration_jobs table)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. IntegrationService Architecture

```python
# app/modules/integration/adapters/base.py

class ERPAdapter(ABC):
    @abstractmethod
    async def push_vendor(self, vendor_data: dict) -> ERPResponse: ...
    @abstractmethod
    async def push_po(self, po_data: dict) -> ERPResponse: ...
    @abstractmethod
    async def push_invoice(self, invoice_data: dict) -> ERPResponse: ...
    @abstractmethod
    async def pull_vendor_updates(self) -> list[dict]: ...
    @abstractmethod
    async def pull_payment_confirmations(self) -> list[dict]: ...

class SAPAdapter(ERPAdapter):
    """SAP RFC/REST integration. Maps portal fields to SAP IDocs."""
    ...

class OracleAdapter(ERPAdapter):
    """Oracle EBS REST API integration."""
    ...

class GenericRESTAdapter(ERPAdapter):
    """Configurable REST adapter for other ERP systems."""
    ...
```

Adapter selection from tenant configuration: `tenant_settings.erp_adapter_type` → `"SAP"` | `"ORACLE"` | `"GENERIC_REST"`

## 2. ERP Integration Flows

### 10 Data Entities

| Entity | Direction | Trigger | Payload Schema | Retry Policy |
|---|---|---|---|---|
| Vendor | Portal → ERP | `vendor.activated` event | Vendor master fields, bank accounts, categories | 7 retries, exponential backoff |
| Vendor | ERP → Portal | Webhook / batch | Vendor updates (address, contact, status) | N/A (inbound) |
| PR | ERP → Portal | REST API / batch file | PR header + lines, material group, cost center | N/A (inbound) |
| PO | Portal → ERP | `po.released` event | PO header + lines, vendor code, delivery schedule | 7 retries |
| PO Amendment | Portal → ERP | `po.amended` event | Amendment diff, new values | 7 retries |
| GRN | Portal → ERP | `grn.approved` event | GRN header + lines, quantities | 7 retries |
| Invoice | Portal → ERP | `invoice.approved` event | Invoice header + lines, match results | 7 retries |
| Payment | ERP → Portal | Webhook / batch | UTR, amount, invoice ref | N/A (inbound) |
| Contract | Portal → ERP | `contract.executed` event | Contract header, rates, terms | 7 retries |
| Employee | HRMS → Portal | Webhook | Create/update/terminate events | N/A (inbound) |

Each outbound flow: Map portal fields → adapter-specific payload → HTTP call → parse response → store ERP reference → create `integration_jobs` record → on failure: schedule retry.

## 3. Integration Job Tracking

```python
# Retry schedule (exponential backoff)
RETRY_DELAYS = [60, 300, 900, 1800, 3600, 14400, 86400]  # 1m, 5m, 15m, 30m, 1h, 4h, 24h

@celery_app.task(queue="celery.integration")
async def retry_failed_integration_jobs():
    """Runs every 30 minutes. Retries failed jobs with exponential backoff."""
    async with async_session_factory() as db:
        jobs = await integration_repo.get_retryable_jobs(db)
        for job in jobs:
            if job.retry_count >= job.max_retries:
                job.status = IntegrationJobStatus.MAX_RETRIES_EXCEEDED
                await publisher.publish("procurement.alert", "alert.integration_max_retries",
                    {"job_id": str(job.id), "entity_type": job.entity_type}, job.org_id)
                continue
            if datetime.utcnow() < job.next_retry_at:
                continue
            try:
                adapter = get_adapter(job.adapter_type)
                result = await adapter.execute(job)
                job.status = IntegrationJobStatus.COMPLETED
                job.response_payload = result
                job.completed_at = datetime.utcnow()
            except Exception as e:
                job.retry_count += 1
                delay = RETRY_DELAYS[min(job.retry_count - 1, len(RETRY_DELAYS) - 1)]
                job.next_retry_at = datetime.utcnow() + timedelta(seconds=delay)
                job.error_message = str(e)
                job.status = IntegrationJobStatus.RETRY_SCHEDULED
        await db.commit()
```

## 4. HRMS Integration

Webhook from HRMS on employee create/update/terminate:

```python
async def process_hrms_event(self, event: dict, org_id: UUID):
    event_type = event["type"]
    if event_type == "EMPLOYEE_CREATED":
        await self.user_service.create_from_hrms(db, event["data"], org_id)
    elif event_type == "EMPLOYEE_UPDATED":
        await self.user_service.update_from_hrms(db, event["data"], org_id)
    elif event_type == "EMPLOYEE_TERMINATED":
        user = await self.user_repo.find_by_employee_id(db, event["data"]["employee_id"], org_id)
        if user:
            user.status = UserStatus.TERMINATED
            # Revoke all sessions
            await self.auth_service.revoke_all_sessions(db, user.id, org_id, "HRMS_TERMINATION")
            # Reassign open tasks
            await self.workflow_engine.reassign_user_tasks(db, user.id, org_id)
            # Notify admin
            await self.publisher.publish("procurement.user", "user.terminated", {"user_id": str(user.id)}, org_id)
```

Daily reconciliation: Compare active users in portal vs HRMS employee list. Flag discrepancies.

## 5. SSO

SAML 2.0: `python3-saml` — SP-initiated flow. See SPEC_04 Section 7.
OIDC: `authlib` — Authorization code flow. See SPEC_04 Section 7.2.

## 6. Email Infrastructure (SendGrid)

- `httpx` async client with retry (3×)
- Template management in SendGrid (template IDs referenced in `notification_templates`)
- Bounce webhook handler at `/api/v1/webhooks/email/bounce`
- Complaint webhook handler
- Suppression list sync
- Required DNS records: SPF, DKIM, DMARC

## 7. Bank Validation (Razorpay)

See SPEC_07 Section 4 for penny test flow.

## 8. GST/PAN Verification

See SPEC_07 Section 3 for verification service details.

## 9. eSign (Digio)

See SPEC_13 Section 5 for eSignature integration flow.

## 10. Nightly ERP Reconciliation

```python
@celery_app.task(queue="celery.integration")
async def nightly_erp_reconciliation():
    """Daily at 01:00 UTC. Compare portal vs ERP entity counts."""
    async with async_session_factory() as db:
        orgs = await org_repo.get_all_active(db)
        for org in orgs:
            adapter = get_adapter_for_org(org.id)
            entities = ["vendors", "purchase_orders", "invoices", "payments", "contracts"]
            for entity in entities:
                portal_count = await count_portal_entities(db, org.id, entity)
                erp_count = await adapter.count_erp_entities(entity)
                discrepancy_pct = abs(portal_count - erp_count) / max(portal_count, 1) * 100
                if discrepancy_pct > 2:
                    await publisher.publish("procurement.alert", "alert.erp_reconciliation_discrepancy",
                        {"entity": entity, "portal_count": portal_count, "erp_count": erp_count, "pct": discrepancy_pct}, org.id)
```

## 11. Configuration UI and API

To enable administrators to configure the active ERP integration, the portal must expose a configuration UI backed by a dedicated settings API.

### 11.1 Backend API
- **Endpoint**: `GET /api/v1/integrations/config`
  - **Permission**: `PROCUREMENT_ADMIN`
  - **Response**: Returns the current `TenantSettings` record for `erp_adapter_type` (and any related URL/credentials).
- **Endpoint**: `PUT /api/v1/integrations/config`
  - **Permission**: `PROCUREMENT_ADMIN`
  - **Payload**: `{"adapter_type": "SAP" | "ORACLE" | "GENERIC_REST", "endpoint_url": "..."}`
  - **Action**: Updates or creates the `TenantSettings` record with `setting_key = 'erp_adapter_type'`. Creates an `audit_logs` entry for the configuration change.

### 11.2 Frontend UI
- **Location**: `apps/procurement-portal/src/app/(portal)/integrations/page.tsx`
- **Action**: Clicking "Configure Integration" opens a modal/dialog (`ConfigureIntegrationDialog`).
- **Fields**:
  - `Adapter Type` (Select: SAP, Oracle, Generic REST)
  - `Endpoint URL` (Text input, optional for SAP/Oracle if using internal connectors, required for Generic REST)
- **State Handling**: Must gracefully handle loading, error, and empty states. TanStack query used for data fetching (`useIntegrationConfig`, `useUpdateIntegrationConfig`).
