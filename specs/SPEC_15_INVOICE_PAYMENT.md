# SPEC_15_INVOICE_PAYMENT.md

## Title
Enterprise S2P Procurement Portal — Invoice & Payment

## Purpose
Define invoice submission, 3-way match engine, dispute management, debit/credit notes, and payment tracking.

## Scope
Covers invoice submission eligibility, duplicate detection, 3-way match engine with exact logic, match outcome handling, tax validation, invoice approval workflow, dispute management, debit/credit notes, payment tracking, and ERP posting.

## Dependencies
- SPEC_03_DATABASE.md (invoices, invoice_lines, invoice_match_results, payment_records, disputes, dispute_messages tables)
- SPEC_05_WORKFLOW_ENGINE.md (INVOICE_APPROVAL template)
- SPEC_14_PURCHASE_ORDER.md (PO lines, GRN data)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. Invoice Submission Eligibility

Supplier can invoice only against GRN-posted PO lines:

```python
async def get_eligible_lines(self, db, vendor_id: UUID, org_id: UUID) -> list[EligibleLine]:
    """Returns PO lines that the supplier can invoice against."""
    # Query: PO lines WHERE po.vendor_id = vendor_id AND po.status IN (RELEASED, ACKNOWLEDGED, PARTIALLY_RECEIVED, FULLY_RECEIVED)
    # AND grn_lines exist with accepted_quantity > 0
    # Compute: remaining_uninvoiced = SUM(grn_accepted) - SUM(previously_invoiced)
    # Return lines where remaining_uninvoiced > 0
```

## 2. Duplicate Detection

DB constraint: `UNIQUE (org_id, vendor_id, vendor_invoice_number)` on `invoices` table.

Application-layer check before insertion:
```python
existing = await self.repo.find_by_vendor_invoice(db, org_id, vendor_id, vendor_invoice_number)
if existing:
    raise ConflictError("DUPLICATE_INVOICE",
        f"Invoice {vendor_invoice_number} already exists for this vendor (Invoice ID: {existing.id})")
```

**Admin override path:** Cancel original invoice → accept new invoice → both actions require mandatory audit note.

## 3. Three-Way Match Engine

```python
# app/modules/invoice/match_engine.py

class ThreeWayMatchEngine:

    async def run_match(self, db: AsyncSession, invoice_id: UUID, org_id: UUID) -> MatchResult:
        invoice = await self.invoice_repo.get(db, invoice_id, org_id)
        invoice_lines = await self.line_repo.get_lines(db, invoice_id, org_id)
        po = await self.po_repo.get(db, invoice.po_id, org_id)

        all_match = True
        results = []

        for inv_line in invoice_lines:
            po_line = await self.po_line_repo.get(db, inv_line.po_line_id, org_id)
            grn_accepted = await self.grn_repo.get_total_accepted(db, po_line.id, org_id)
            previously_invoiced = await self.invoice_line_repo.get_total_invoiced(db, po_line.id, org_id, exclude_invoice_id=invoice_id)

            # Match 1: Price match
            price_deviation = abs(inv_line.unit_price - po_line.unit_price) / po_line.unit_price if po_line.unit_price > 0 else 0
            price_match = price_deviation <= invoice.price_tolerance  # default 0.5%

            # Match 2: Quantity match
            max_invoiceable = grn_accepted - previously_invoiced
            quantity_match = inv_line.quantity <= max_invoiceable
            quantity_deviation = inv_line.quantity - max_invoiceable if not quantity_match else Decimal("0")

            # Match 3: PO reference valid
            po_ref_valid = po.status in (POStatus.RELEASED, POStatus.ACKNOWLEDGED, POStatus.PARTIALLY_RECEIVED, POStatus.FULLY_RECEIVED)

            # Match 4: Tax validation
            expected_tax = inv_line.unit_price * (po_line.tax_rate / Decimal("100"))
            tax_deviation = abs(inv_line.tax_amount - expected_tax * inv_line.quantity)
            tax_tolerance = expected_tax * inv_line.quantity * Decimal("0.01")  # 1% tolerance
            tax_match = tax_deviation <= tax_tolerance

            overall = price_match and quantity_match and po_ref_valid and tax_match

            match_result = InvoiceMatchResult(
                org_id=org_id, invoice_id=invoice_id,
                invoice_line_id=inv_line.id, po_line_id=po_line.id,
                price_match=price_match, price_deviation=price_deviation,
                quantity_match=quantity_match, quantity_deviation=quantity_deviation,
                po_reference_valid=po_ref_valid,
                tax_match=tax_match, tax_deviation=tax_deviation,
                overall_match=overall,
                mismatch_reasons=self._collect_reasons(price_match, quantity_match, po_ref_valid, tax_match),
            )
            db.add(match_result)
            results.append(match_result)

            if not overall:
                all_match = False

        return MatchResult(all_match=all_match, line_results=results)
```

## 4. Match Outcome Handling

| Outcome | Invoice Status | Action |
|---|---|---|
| ALL lines match | `PENDING_APPROVAL` | Invoice enters approval workflow |
| Any price mismatch > tolerance | `DISPUTED` | Auto-create dispute with reason `PRICE_MISMATCH` |
| Any quantity mismatch | `PARTIALLY_MATCHED` | Finance can approve matched lines, hold mismatched |
| Duplicate invoice | Hard block | 409 response; no record created |
| Tax discrepancy > 1% | Flag in match result | Warning shown; does not auto-dispute |

## 5. Invoice Approval Workflow

Per INVOICE_APPROVAL template: Finance Controller → Finance Head (if > ₹10L).

## 6. Dispute Management

```python
class DisputeService:
    async def create_dispute(self, db, invoice_id: UUID, reason_code: str, description: str, actor: User, org_id: UUID) -> Dispute:
        dispute = Dispute(
            org_id=org_id, invoice_id=invoice_id, vendor_id=invoice.vendor_id,
            reason_code=reason_code, description=description,
            status="OPEN", raised_by=actor.id,
        )
        db.add(dispute)
        return dispute

    async def add_message(self, db, dispute_id: UUID, message: str, actor: User, org_id: UUID) -> DisputeMessage: ...

    async def resolve(self, db, dispute_id: UUID, resolution: str, action: str, credit_note_amount: Decimal, actor: User, org_id: UUID) -> Dispute: ...
```

**Reason codes:** `PRICE_MISMATCH`, `QUANTITY_MISMATCH`, `WRONG_PO`, `DUPLICATE`, `QUALITY_ISSUE`, `PAYMENT_OVERDUE`, `OTHER`

**Resolution states:** `OPEN` → `UNDER_REVIEW` → `RESOLVED_ACCEPTED` / `RESOLVED_REJECTED` / `RESOLVED_CREDIT_NOTE`

Both buyer and supplier can post messages in `dispute_messages` thread.

## 7. Debit/Credit Notes

Finance creates credit/debit note linked to invoice:
- Credit note: reduces payment amount; `invoices.total_amount -= credit_note_amount`
- Debit note: requests additional payment
- Both require approval workflow
- Both ERP-posted

## 8. Payment Tracking

Portal receives payment confirmation from ERP:
- **Webhook:** ERP calls `POST /api/v1/webhooks/erp/payment` with UTR, amount, invoice reference
- **Daily batch:** Celery task processes payment file from ERP

`payment_records` created: UTR number, payment date, amount, payment method.
`invoices.payment_status` updated: `PAID` (full) or `PARTIALLY_PAID`.

Supplier sees payment status in their portal's payment tracking screen.

## 9. Payment Dispute

If `invoice.due_date + grace_period_days` passed with no payment record:
- Supplier can raise payment dispute via `POST /api/v1/payments/disputes`
- Grace period configurable (default 3 business days)
- Dispute → Finance review → resolution or UTR confirmation

## 10. ERP Posting

Invoice approval → `IntegrationService.post_invoice_to_erp(invoice_id)` → ERP API → ERP posts accounting entry → ERP invoice number returned → stored in `invoices.erp_invoice_number`.
