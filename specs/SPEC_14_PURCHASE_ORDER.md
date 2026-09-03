# SPEC_14_PURCHASE_ORDER.md

## Title
Enterprise S2P Procurement Portal — Purchase Order

## Purpose
Define PO generation, number sequencing, price validation, approval, ERP sync, release to supplier, acceptance flow, amendments, GRN linkage, multi-delivery tracking, and quality inspection gate.

## Scope
Covers PO number generation, pre-fill from award/contract, price validation, approval workflow, ERP sync, PO release (PDF + notification), supplier acceptance/rejection, amendments, GRN linkage, open quantity tracking, and QC gate.

## Dependencies
- SPEC_03_DATABASE.md (purchase_orders, po_lines, po_amendments, goods_receipt_notes, grn_lines, service_entry_sheets, ses_lines, quality_inspections tables)
- SPEC_05_WORKFLOW_ENGINE.md (PO_APPROVAL template)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. PO Number Generation

Format: `{BU_CODE}-PO-{YYYY}-{sequential_per_bu}`

Example: `BUN-PO-2026-000147`

```sql
CREATE SEQUENCE po_seq_bun OWNED BY NONE;
-- One sequence per BU code, managed via tenant_settings or dynamic sequence creation
```

```python
async def _generate_po_number(self, db: AsyncSession, org_id: UUID, bu_code: str) -> str:
    year = datetime.utcnow().year
    seq_name = f"po_seq_{bu_code.lower()}_{year}"
    result = await db.execute(text(f"SELECT nextval('{seq_name}')"))
    seq_val = result.scalar()
    return f"{bu_code}-PO-{year}-{str(seq_val).zfill(6)}"
```

Atomic reservation prevents gaps in concurrent PO creation.

## 2. Pre-Fill from Award/Contract

```python
async def create_from_award(self, db, arn_id: UUID, actor: User, org_id: UUID) -> PurchaseOrder:
    arn = await self.arn_repo.get(db, arn_id, org_id)
    award_details = await self.award_detail_repo.get_for_arn(db, arn_id, org_id)
    rfq = await self.rfq_repo.get(db, arn.rfq_id, org_id)

    # Group award details by vendor (split award → multiple POs)
    by_vendor = {}
    for detail in award_details:
        by_vendor.setdefault(detail.vendor_id, []).append(detail)

    pos = []
    for vendor_id, details in by_vendor.items():
        po = PurchaseOrder(
            org_id=org_id,
            po_number=await self._generate_po_number(db, org_id, rfq.business_unit.code),
            title=f"PO from {arn.arn_number}",
            vendor_id=vendor_id, rfq_id=rfq.id, arn_id=arn.id,
            status=POStatus.DRAFT,
            business_unit_id=rfq.business_unit_id,
            category_id=rfq.category_id,
            currency=rfq.currency,
            payment_term_id=rfq.payment_term_id,
            incoterm_id=rfq.incoterm_id,
            delivery_location_id=rfq.delivery_location_id,
            buyer_id=actor.id,
        )
        db.add(po)
        await db.flush()

        total = Decimal("0")
        for idx, detail in enumerate(details, 1):
            po_line = POLine(
                org_id=org_id, po_id=po.id, line_number=idx,
                item_description=detail.item_description,
                uom_id=detail.uom_id,
                ordered_quantity=detail.awarded_quantity,
                unit_price=detail.awarded_unit_price,
                awarded_unit_price=detail.awarded_unit_price,
                open_quantity=detail.awarded_quantity,
                tax_rate=detail.tax_rate,
            )
            db.add(po_line)
            total += detail.awarded_quantity * detail.awarded_unit_price

        po.total_value = total
        pos.append(po)

    return pos
```

## 3. Price Validation

PO unit price must match awarded unit price within ±0.1% tolerance:

```python
for po_line in po_lines:
    if po_line.awarded_unit_price and po_line.awarded_unit_price > 0:
        deviation = abs(po_line.unit_price - po_line.awarded_unit_price) / po_line.awarded_unit_price
        if deviation > Decimal("0.001"):
            raise AppException("PRICE_DEVIATION",
                f"Line {po_line.line_number}: price deviation {deviation:.2%} exceeds 0.1% tolerance. Justification required.")
```

Buyer must provide `deviation_justification` text if deviation > 0.1%.

## 4. PO Approval

Per PO_APPROVAL template (SPEC_05). Below ₹2L threshold: approval record created but no human approval step required (the approval is automatic and logged). Above threshold: standard workflow.

## 5. ERP Sync

```python
async def release_po(self, db, po_id: UUID, actor: User, org_id: UUID) -> PurchaseOrder:
    po = await self.repo.get(db, po_id, org_id)
    # 1. Verify approval complete
    # 2. Push to ERP
    await self.integration_service.push_po_to_erp(db, po, org_id)
    # 3. If ERP returns PO number → store in po.erp_po_number
    # 4. If ERP fails → po.status = SYNC_PENDING; retry queue
    # 5. Generate PDF → store in MinIO
    # 6. Notify supplier (email + in-app)
    po.status = POStatus.RELEASED
    return po
```

## 6. PO Release to Supplier

After approval + ERP sync: PDF generated from PO template → stored in MinIO → `notification.po.released` event → supplier receives email with PO PDF attachment link + in-app notification. Supplier portal shows PO PDF with "Acknowledge" button.

## 7. Supplier Acceptance Flow

- **Accept:** `POST /api/v1/purchase-orders/{po_id}/acknowledge` → PO status = `ACKNOWLEDGED`
- **Reject:** `POST /api/v1/purchase-orders/{po_id}/reject` with comments → buyer notified + Procurement Head escalation
- **No response within SLA** (configurable, default 72h): escalation alert to buyer

## 8. PO Amendment

1. Reason mandatory
2. Value increase > threshold (configurable, default 10%) → re-approval required
3. `po_amendments` record: amendment_number, reason, field_changes JSONB, value_change
4. PO version incremented
5. ERP amendment sync
6. Supplier re-notified with updated PO PDF

## 9. GRN Linkage

`goods_receipt_notes` linked to `purchase_orders`. Partial GRN allowed.

Quantity validation: `grn_line.received_quantity <= po_line.open_quantity`

Over-receipt: If `received_quantity > open_quantity`, system allows with warning alert to buyer (configurable: block or allow with alert).

GRN aggregate determines invoice eligibility: `invoiceable_quantity = SUM(grn_lines.accepted_quantity) - SUM(previously_invoiced_quantity)`

## 10. Multi-Delivery PO Tracking

`po_lines.open_quantity = ordered_quantity - SUM(grn_lines.accepted_quantity WHERE grn.po_id = po.id AND grn_line.po_line_id = po_line.id)`

PO auto-close conditions (all must be true):
- All lines: `open_quantity == 0`
- All invoices: `status IN (APPROVED, POSTED, PAID)`
- All payments: `status == COMPLETED`

When all conditions met → PO status = `CLOSED`

## 11. Quality Inspection Gate

If `categories.requires_quality_inspection = TRUE` for the PO's category:
- GRN cannot be posted (status cannot move to APPROVED) without a `quality_inspections` record linked to each `grn_line`
- QC inspector role (`qc.inspect` permission) required
- Partial acceptance recorded per line: `accepted_quantity` and `rejected_quantity`
- Rejected items: `rejection_reason` mandatory; vendor notified
