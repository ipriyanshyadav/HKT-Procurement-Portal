# SPEC_13_CONTRACT_MANAGEMENT.md

## Title
Enterprise S2P Procurement Portal — Contract Management

## Purpose
Define the contract workspace, approval workflow, eSignature integration, amendments, compliance tracking, renewal management, repository search, and watermarking.

## Scope
Covers contract creation triggers, template system, workspace sections, approval flow, eSignature (Digio/DocuSign), fallback signing, amendments, compliance tracking, renewal alerts, Elasticsearch repository, and PDF watermarking.

## Dependencies
- SPEC_03_DATABASE.md (contracts, contract_lines, contract_documents, contract_amendments, contract_milestones, contract_templates tables)
- SPEC_05_WORKFLOW_ENGINE.md (CONTRACT_APPROVAL template)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. Contract Creation Triggers

A contract is created when:
1. **Award approved with value above threshold:** `tenant_settings.contract_threshold_by_category` defines per-category thresholds. If `award_total > threshold`, `ContractService.create_from_award()` auto-triggers.
2. **Buyer manually creates from award:** `POST /api/v1/contracts/from-award/{arn_id}` — buyer initiates contract creation for awards below threshold.

## 2. Contract Template System

`contract_templates` table stores structured templates:

```json
{
  "name": "Standard Rate Contract - Goods",
  "contract_type": "RATE_CONTRACT",
  "template_content": {
    "sections": [
      {"id": "parties", "title": "Parties", "content": "This agreement is between {{buyer_legal_name}} ('Buyer') and {{vendor_legal_name}} ('Supplier')..."},
      {"id": "scope", "title": "Scope of Work", "content": "{{scope_description}}"},
      {"id": "pricing", "title": "Rate Schedule", "content": "As per Annexure A (auto-populated from award)"},
      {"id": "payment", "title": "Payment Terms", "content": "{{payment_term_description}}"},
      {"id": "delivery", "title": "Delivery Schedule", "content": "{{delivery_schedule}}"},
      {"id": "sla", "title": "Service Level Agreement", "content": "..."},
      {"id": "penalties", "title": "Penalty Clauses", "content": "Late delivery penalty: {{penalty_rate}}% per week, max {{penalty_cap}}%"},
      {"id": "ip", "title": "Intellectual Property", "content": "..."},
      {"id": "termination", "title": "Termination", "content": "..."},
      {"id": "dispute_resolution", "title": "Dispute Resolution", "content": "..."},
      {"id": "force_majeure", "title": "Force Majeure", "content": "..."}
    ]
  }
}
```

**Pre-fill engine:** Maps award data to template placeholders — `{{vendor_legal_name}}`, `{{buyer_legal_name}}`, `{{payment_term_description}}`, rate schedule from `award_details`, delivery terms from RFQ.

## 3. Contract Workspace

**Header:** Parties, type, reference number, value, currency, start/end date, status, linked RFQ/ARN.

**Sections:**
- **Obligations Tracker:** Milestone rows with due dates, responsible party, completion status. Managed via `contract_milestones` table.
- **Document Section:** All versions of contract documents with upload/download. Versioning tracked in `contract_documents`.
- **Amendment History:** Chronological list of amendments with before/after diffs.
- **Linked POs:** Auto-populated list of POs created against this contract.
- **Compliance Documents:** Required supplier documents with expiry dates. Links to `vendor_documents`.
- **Renewal Configuration:** Auto-renew toggle, renewal alert dates (90/60/30 days).

## 4. Contract Approval Flow

Per CONTRACT_APPROVAL workflow template (SPEC_05): Buyer → Legal → Sourcing Manager → Procurement Head (if > ₹10L) → CFO (if > ₹50L) → Legal Final Sign-Off.

## 5. eSignature Integration

```python
# app/modules/contract/esignature.py

class eSignatureProvider(ABC):
    @abstractmethod
    async def create_signature_request(self, contract_id: UUID, signatories: list[Signatory]) -> str: ...
    @abstractmethod
    async def get_status(self, request_id: str) -> SignatureStatus: ...
    @abstractmethod
    async def download_signed_document(self, request_id: str) -> bytes: ...

class DigioProvider(eSignatureProvider):
    async def create_signature_request(self, contract_id, signatories):
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{settings.DIGIO_API_URL}/v2/client/document/upload", ...)
        return response.json()["id"]

class DocuSignProvider(eSignatureProvider):
    # Fallback implementation
    ...
```

**Flow:**
1. `ContractService.send_for_esignature(contract_id)` → select provider (Digio primary)
2. Create signature request via provider API
3. Signatories: supplier signs first, then buyer
4. Webhook `POST /api/v1/webhooks/esign/callback` receives signature events
5. Both signed → download signed PDF → store in MinIO `contract-documents` → contract status = `EXECUTED`

**Fallback:** If provider unavailable, buyer uploads scanned signed PDF. Admin marks contract as EXECUTED (requires dual confirmation + audit note).

## 6. Contract Amendment

1. Amendment number incremented
2. Before/after diff stored in `contract_amendments.field_changes` JSONB
3. New version of contract document uploaded
4. Amendment approval workflow (simplified 2-level: Buyer → Sourcing Manager)
5. Both parties notified
6. ERP sync updated with amended values

## 7. Compliance and Renewal Tracking

**Milestones:** Celery Beat task `check_contract_milestones` runs daily. Overdue milestones → alert buyer + category manager.

**Renewal/Expiry:** Celery task sends alerts at 90, 60, 30 days before `end_date`. On `end_date`: contract status auto-set to `EXPIRED`. Contracts with active POs: POs continue; alert sent; no auto-cancel.

## 8. Contract Repository (Elasticsearch)

Index: `procurement-contracts`
Fields indexed: contract_number, title, vendor_name, category, BU, value, status, start_date, end_date, clause summaries (not full confidential text).
Filters: status, category, vendor, value range, expiry range, BU.

## 9. PDF Watermarking

```python
# app/modules/document/watermark.py

from pikepdf import Pdf, Page
from reportlab.pdfgen import canvas
from io import BytesIO

async def apply_watermark(pdf_bytes: bytes, user_name: str, document_id: str) -> bytes:
    watermark_text = f"CONFIDENTIAL - Downloaded by {user_name} at {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} - Doc ID: {document_id}"
    # Create watermark overlay using reportlab
    # Apply to every page using pikepdf
    # Return watermarked PDF bytes — original file in MinIO unchanged
```
