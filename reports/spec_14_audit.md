# SPEC AUDIT REPORT — SPEC_14: Purchase Order (PO) & Goods Receipt (GRN)
**MODULE:** 14 | **SPEC:** SPEC_14_PURCHASE_ORDER.md | **DATE:** 2026-09-05
**Squad:** Squad C (Contracts & PO) | **Status:** COMPLETE (100%)

---

## 1. Requirements Audit Matrix

| Req ID | Requirement Description | Implementation Reference | Status | Verification Evidence |
|---|---|---|---|---|
| S14-01 | PO number generation with yearly reset | `app/modules/purchase_order/service.py` | DONE | Sequence generator `{BU}-PO-{YYYY}-{NNNNNN}` |
| S14-02 | 9-status lifecycle FSM | `app/modules/purchase_order/fsm.py` | DONE | FSM validates DRAFT -> PENDING_APPROVAL -> APPROVED -> SENT_TO_VENDOR -> VENDOR_ACKNOWLEDGED -> PARTIALLY_RECEIVED -> FULLY_RECEIVED -> CLOSED |
| S14-03 | PO creation from RFQ award or Rate Contract | `app/modules/purchase_order/service.py` | DONE | Validates source award status; updates rate contract utilization |
| S14-04 | DB computed column for line total | `alembic/versions/0032_purchase_order_grn_spec14.py` | DONE | `po_lines.total_price GENERATED ALWAYS AS (ordered_quantity * unit_price) STORED` |
| S14-05 | Purchase Order PDF generation | `app/modules/purchase_order/pdf_generator.py` | DONE | ReportLab PO PDF generation and upload to MinIO `po-documents` bucket |
| S14-06 | Outbox ERP PO synchronization | `app/modules/purchase_order/service.py` | DONE | Outbox event `po.created` / `po.sent_to_vendor` published for asynchronous sync |
| S14-07 | Vendor acknowledgement tracking | `app/modules/purchase_order/service.py` | DONE | Supplier can accept or reject with reason via supplier portal |
| S14-08 | Goods Receipt Note (GRN) linking | `app/modules/grn/service.py` | DONE | Records received quantities against PO lines, updates open quantity |
| S14-09 | Partial receipt handling & auto-closure | `app/modules/purchase_order/service.py` | DONE | Transitions to `PARTIALLY_RECEIVED` or `FULLY_RECEIVED` when all line quantities met |

---

## 2. Frontend Implementation & UI Usability Audit

| Component / Page | Location | Status | Usability & Action Buttons Verified |
|---|---|---|---|
| Buyer Purchase Orders Directory | `apps/buyer-portal/app/(main)/purchase-orders/page.tsx` | DONE | Search, status filters, "+ New PO" button, pagination table |
| Buyer PO Creation Wizard | `apps/buyer-portal/app/(main)/purchase-orders/new/page.tsx` | DONE | Vendor selector, rate contract picker, line items table, delivery schedule, save draft |
| Buyer PO Workspace | `apps/buyer-portal/app/(main)/purchase-orders/[id]/page.tsx` | DONE | "Approve PO" button, "Send to Vendor" button, "Cancel PO" modal, "Download PDF" button, "Create Goods Receipt (GRN)" link, DeliveryScheduleTable component, DocumentList component, linked GRN table |
| Warehouse GRN Directory | `apps/buyer-portal/app/(main)/grn/page.tsx` | DONE | Filter by PO, warehouse receipt records list, "+ New Receipt" button |
| Warehouse GRN Receipt Console | `apps/buyer-portal/app/(main)/grn/new/page.tsx` | DONE | PO selector, delivery challan number, LR number, transporter, per-line received quantities, QC inspection flags, submit receipt button |
| Supplier PO Management Console | `apps/supplier-portal/app/(main)/purchase-orders/page.tsx` | DONE | View orders, "Acknowledge PO" button, "Reject PO" modal with reason |

---

## 3. Summary Score

```
MODULE | SPEC | DATE
SPEC_14 | SPEC_14_PURCHASE_ORDER.md | 2026-09-05
OVERALL: 9/9 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100% (9/9 passed)
```
