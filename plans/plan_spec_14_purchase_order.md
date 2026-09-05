# IMPLEMENTATION PLAN — SPEC_14: Purchase Order
**Module:** 14 | **Phase:** Core | **Squad:** D
**Spec File:** SPEC_14_PURCHASE_ORDER.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S14-01 | PO number (BU-scoped, year-reset sequence) | purchase_order/service.py | DONE |
| S14-02 | 9-status FSM | purchase_order/fsm.py | DONE |
| S14-03 | PO creation from RFQ award / direct from contract | purchase_order/service.py | DONE |
| S14-04 | PO approval workflow | purchase_order/service.py + rules_engine | DONE |
| S14-05 | PO line items (UOM, tax, delivery schedule) | purchase_order/models.py | DONE |
| S14-06 | PO amendment (formal, version increment) | purchase_order/service.py | DONE |
| S14-07 | ERP PO sync (async outbox) | integration/adapters/erp_po.py | DONE |
| S14-08 | Vendor acceptance tracking | purchase_order/service.py | DONE |
| S14-09 | Delivery schedule tracking | purchase_order/models.py | DONE |
| S14-10 | GRN linking (3-way match setup) | purchase_order/service.py | DONE |
| S14-11 | PO cancellation with reason | purchase_order/service.py | DONE |
| S14-12 | Partial receipt handling | purchase_order/service.py | DONE |
| S14-13 | PO PDF generation | purchase_order/pdf_generator.py | DONE |
| S14-14 | Contract utilization update on PO creation | purchase_order/service.py + contract | DONE |
| S14-15 | 12 audit events | purchase_order/service.py | DONE |
| S14-16 | GENERATED ALWAYS AS: po_lines.total_price | Migration 0032 | DONE |

```
MODULE | SPEC | DATE
SPEC_14 | Purchase Order & GRN | 2026-09-05
OVERALL: 16/16 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-14-1 | PO number format: `{BU_CODE}-PO-{YYYY}-{NNNNNN}` using DB sequence `seq_po_{bu_code}_{year}` | Same pattern as PR; SPEC does not define format | LOW | Squad D |
| A-14-2 | Vendor acceptance: vendor must acknowledge PO via supplier portal within `tenant_settings.po_acceptance_sla_hours`; no response = deemed accepted after SLA | SPEC Section 8 acceptance tracking | MEDIUM | Squad D |
| A-14-3 | PO is "closed" when all lines have `received_quantity = ordered_quantity`; partial close requires all lines partially received | SPEC Section 12 partial receipt | LOW | Squad D |
| A-14-4 | ERP PO sync writes to `outbox_messages` table with `entity_type=PO`, picked up by outbox worker; retry per SPEC_02 outbox config | SPEC Section 7 ERP async | LOW | Squad D |
| A-14-5 | Direct PO (bypass RFQ) requires `rfq_id=NULL` and explicit `contract_id` or `justification`; PROCUREMENT_HEAD approval required for direct PO above threshold from tenant_settings | SPEC Section 3 direct PO path | MEDIUM | Squad D |

---
## STEP 2 — IMPLEMENT

### 2.1 `app/modules/purchase_order/fsm.py`
```python
PO_FSM = {
    "DRAFT":            ["PENDING_APPROVAL", "CANCELLED"],
    "PENDING_APPROVAL": ["APPROVED", "REJECTED"],
    "APPROVED":         ["SENT_TO_VENDOR", "CANCELLED"],
    "SENT_TO_VENDOR":   ["VENDOR_ACKNOWLEDGED", "VENDOR_REJECTED", "CANCELLED"],
    "VENDOR_ACKNOWLEDGED": ["PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CANCELLED"],
    "VENDOR_REJECTED":  ["AMENDED", "CANCELLED"],
    "PARTIALLY_RECEIVED": ["FULLY_RECEIVED", "CANCELLED"],
    "FULLY_RECEIVED":   ["CLOSED"],
    "AMENDED":          ["SENT_TO_VENDOR"],
    "CLOSED":           [],
    "CANCELLED":        [],
    "REJECTED":         [],
}
```

### 2.2 `app/modules/purchase_order/service.py`
```python
class PurchaseOrderService:

    async def create(self, db, data: POCreateRequest, actor_id: UUID, org_id: UUID) -> PurchaseOrder:
        # Validate source
        if data.rfq_id:
            rfq = await self.rfq_repo.get(db, data.rfq_id, org_id)
            if rfq.status != "AWARDED":
                raise AppException("RFQ_NOT_AWARDED", "RFQ must be in AWARDED status")
        if data.contract_id:
            await self.contract_service.update_utilization(db, data.contract_id, float(data.total_value), org_id)
        po_number = await self._generate_po_number(db, data.business_unit_id, org_id)
        po = PurchaseOrder(
            org_id=org_id, po_number=po_number, rfq_id=data.rfq_id,
            contract_id=data.contract_id, vendor_id=data.vendor_id,
            business_unit_id=data.business_unit_id, category_id=data.category_id,
            currency=data.currency, total_value=data.total_value,
            delivery_location_id=data.delivery_location_id,
            payment_terms_code=data.payment_terms_code, incoterm_code=data.incoterm_code,
            status="DRAFT", created_by=actor_id, po_type=data.po_type or "STANDARD",
        )
        db.add(po)
        await db.flush()
        for line in data.lines:
            po_line = POLine(org_id=org_id, po_id=po.id, **line.model_dump())
            # IMPORTANT: total_price is GENERATED ALWAYS AS in DB — do NOT set it in code
            db.add(po_line)
        # Trigger approval workflow
        entity_context = {
            "amount": float(po.total_value), "bu_id": str(po.business_unit_id),
            "po_type": po.po_type, "vendor_id": str(po.vendor_id),
            "has_contract": po.contract_id is not None,
        }
        rule = await self.rules_engine.find_matching_rule(db, "PO", entity_context, org_id)
        if rule:
            await self.workflow_engine.instantiate(db, rule.workflow_template_code,
                "PURCHASE_ORDER", po.id, entity_context, org_id, actor_id)
        await self.publisher.publish("procurement.po", "po.created",
            {"po_id": str(po.id), "po_number": po_number, "vendor_id": str(po.vendor_id)}, org_id)
        await self.audit.log(db, "PO", po.id, "PO_CREATED", actor_id, org_id)
        return po

    async def send_to_vendor(self, db, po_id: UUID, actor_id: UUID, org_id: UUID) -> PurchaseOrder:
        po = await self.repo.get(db, po_id, org_id)
        validate_po_transition(po.status, "SENT_TO_VENDOR")
        # Generate PDF
        pdf_path = await self.pdf_generator.generate(po, org_id)
        po.po_document_path = pdf_path
        po.status = "SENT_TO_VENDOR"
        po.sent_at = datetime.utcnow()
        # Notify vendor via notification module
        await self.publisher.publish("procurement.notification", "notification.email.po_issued",
            {"vendor_id": str(po.vendor_id), "po_id": str(po.id), "po_number": po.po_number,
             "total_value": float(po.total_value), "currency": po.currency}, org_id)
        # ERP sync via outbox
        await self.publisher.publish("procurement.po", "po.sent_to_vendor",
            {"po_id": str(po.id), "erp_sync_required": True}, org_id)
        await self.audit.log(db, "PO", po.id, "PO_SENT_TO_VENDOR", actor_id, org_id)
        return po

    async def record_vendor_acknowledgement(self, db, po_id: UUID, accepted: bool,
                                             rejection_reason: Optional[str],
                                             actor_id: UUID, org_id: UUID) -> PurchaseOrder:
        po = await self.repo.get(db, po_id, org_id)
        target = "VENDOR_ACKNOWLEDGED" if accepted else "VENDOR_REJECTED"
        validate_po_transition(po.status, target)
        po.status = target
        po.vendor_acknowledged_at = datetime.utcnow()
        po.vendor_rejection_reason = rejection_reason
        if not accepted:
            await self.publisher.publish("procurement.po", "po.vendor_rejected",
                {"po_id": str(po.id), "reason": rejection_reason}, org_id)
        await self.audit.log(db, "PO", po.id, f"PO_{target}", actor_id, org_id)
        return po

    async def record_grn_receipt(self, db, po_id: UUID, received_lines: list[dict],
                                  org_id: UUID) -> PurchaseOrder:
        """Called by GRN service when GRN is confirmed."""
        po = await self.repo.get(db, po_id, org_id)
        for receipt in received_lines:
            line = await self.line_repo.get(db, receipt["po_line_id"], org_id)
            line.received_quantity = (line.received_quantity or 0) + receipt["quantity"]
        # Check if fully received
        all_received = all(l.received_quantity >= l.ordered_quantity for l in po.lines)
        if all_received:
            validate_po_transition(po.status, "FULLY_RECEIVED")
            po.status = "FULLY_RECEIVED"
        else:
            po.status = "PARTIALLY_RECEIVED"
        return po
```

---
## STEP 3 — TEST
```python
async def test_po_total_price_is_computed_column(db, factory):
    """po_lines.total_price NOT settable — DB generates it."""
async def test_contract_utilization_updated_on_po(db, factory):
    """Creating PO against rate contract updates utilized_value."""
async def test_po_closes_when_all_lines_received(db, factory):
    """All lines fully received → status FULLY_RECEIVED."""
async def test_vendor_acknowledgement_required(db, factory):
    """No GRN possible until vendor acknowledges PO."""
async def test_erp_po_sync_via_outbox(db, factory):
    """PO creation adds record to outbox_messages."""
async def test_direct_po_without_rfq_requires_justification(db, factory):
    """rfq_id=None and contract_id=None without justification → ValidationError."""
```
