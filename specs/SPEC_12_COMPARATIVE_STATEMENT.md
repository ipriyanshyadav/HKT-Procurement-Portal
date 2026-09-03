# SPEC_12_COMPARATIVE_STATEMENT.md

## Title
Enterprise S2P Procurement Portal — Comparative Statement & Evaluation

## Purpose
Define the CS generation engine, normalization algorithms, ranking logic, tie-breaking rules, output format, CS approval workflow, versioning, and EvaluationService class.

## Scope
Covers CS generation trigger, step-by-step normalization with exact formulas, tax discrepancy detection, tie-breaking, CS output format, PDF generation, CS approval, versioning, and EvaluationService interface.

## Dependencies
- SPEC_03_DATABASE.md (evaluations, evaluation_scores, comparative_statements, cs_line_rankings tables)
- SPEC_05_WORKFLOW_ENGINE.md (CS approval as part of sourcing workflow)
- SPEC_11_BID_MANAGEMENT.md (bid data, opened bids)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. CS Generation Trigger

After technical evaluation is approved (or immediately after bid opening for L1-only RFQs):

```python
# Called by EvaluationService after technical evaluation is complete
await evaluation_service.generate_comparative_statement(rfq_id, org_id)
```

**Pre-conditions:**
- RFQ status == `BIDS_OPENED` or `UNDER_EVALUATION`
- All bids have `bid_opened_at` set
- For 2-envelope: technical evaluation completed and technically-qualified list finalized
- At least 1 technically qualified bid (or 1 bid for L1-only)

---

## 2. Step-by-Step Normalization Algorithm

```python
# app/modules/evaluation/cs_engine.py

class CSEngine:

    async def generate_cs(
        self, db: AsyncSession, rfq_id: UUID, org_id: UUID, generated_by: UUID
    ) -> ComparativeStatement:
        rfq = await self.rfq_repo.get(db, rfq_id, org_id)
        org = await self.org_repo.get(db, org_id)
        cost_of_capital_rate = org.cost_of_capital_rate  # e.g., 0.12

        rfq_lines = await self.rfq_line_repo.get_lines(db, rfq_id, org_id)
        qualified_bids = await self._get_qualified_bids(db, rfq_id, org_id)

        cs = ComparativeStatement(
            org_id=org_id, rfq_id=rfq_id,
            cs_number=await self._generate_cs_number(db, org_id),
            status="DRAFT",
            cost_of_capital_rate=cost_of_capital_rate,
            evaluation_methodology=self._describe_methodology(rfq),
            total_estimated_value=rfq.estimated_value,
            generated_by=generated_by,
        )
        db.add(cs)
        await db.flush()

        all_rankings = []
        for rfq_line in rfq_lines:
            line_rankings = []
            hsn_tax_rate = await self._get_hsn_tax_rate(db, org_id, rfq_line.hsn_code)

            for bid in qualified_bids:
                bid_line = await self.bid_line_repo.get_for_line(db, bid.id, rfq_line.id, org_id)
                if not bid_line:
                    continue

                # Step 1: Extract base unit price
                unit_price = bid_line.unit_price

                # Step 2: Add freight per unit
                if rfq.incoterm_freight_terms == "INCLUSIVE":
                    freight_per_unit = Decimal("0")
                elif rfq.incoterm_freight_terms == "AS_ACTUALS":
                    freight_per_unit = self._get_buyer_estimated_freight(rfq_line)
                else:  # EXTRA
                    freight_per_unit = bid_line.freight_quoted / rfq_line.quantity

                # Step 3: Compute tax per unit (from HSN master, NOT supplier-declared)
                tax_per_unit = unit_price * (hsn_tax_rate / Decimal("100"))

                # Step 3a: Detect tax discrepancy
                tax_discrepancy = False
                if abs(bid_line.tax_rate_declared - hsn_tax_rate) > Decimal("0.01"):
                    tax_discrepancy = True

                # Step 4: Landed cost
                landed_cost = unit_price + freight_per_unit + tax_per_unit

                # Step 5: Payment term NPV adjustment
                payment_term = await self._get_payment_term(db, org_id, bid.payment_terms_proposed_id or rfq.payment_term_id)
                payment_days = payment_term.payment_days
                effective_cost = landed_cost / (Decimal("1") - (Decimal(payment_days) / Decimal("365")) * cost_of_capital_rate)

                ranking_entry = CSLineRanking(
                    org_id=org_id, cs_id=cs.id,
                    rfq_line_id=rfq_line.id, bid_id=bid.id,
                    vendor_id=bid.vendor_id,
                    raw_unit_price=unit_price,
                    freight_per_unit=freight_per_unit,
                    tax_per_unit=tax_per_unit,
                    landed_cost=landed_cost,
                    npv_adjusted_cost=effective_cost,
                    rank=0,  # Set after sorting
                    tax_discrepancy=tax_discrepancy,
                    supplier_declared_rate=bid_line.tax_rate_declared,
                    hsn_master_rate=hsn_tax_rate,
                )
                line_rankings.append(ranking_entry)

            # Step 6: Rank by effective_cost (ascending)
            line_rankings.sort(key=lambda r: r.npv_adjusted_cost)
            for idx, ranking in enumerate(line_rankings):
                ranking.rank = idx + 1  # L1 = 1, L2 = 2, L3 = 3

            # Step 6a: Tie detection and breaking
            await self._apply_tie_breaking(db, line_rankings, org_id)

            for ranking in line_rankings:
                db.add(ranking)
            all_rankings.extend(line_rankings)

        # Calculate L1 total and savings
        l1_rankings = [r for r in all_rankings if r.rank == 1]
        if l1_rankings:
            l1_total = sum(r.npv_adjusted_cost * self._get_line_qty(rfq_lines, r.rfq_line_id) for r in l1_rankings)
            cs.l1_total_value = l1_total
            if rfq.estimated_value > 0:
                cs.savings_percentage = ((rfq.estimated_value - l1_total) / rfq.estimated_value * 100).quantize(Decimal("0.01"))

        await self.publisher.publish("procurement.evaluation", "evaluation.cs_generated",
            {"cs_id": str(cs.id), "rfq_id": str(rfq_id)}, org_id)

        return cs
```

---

## 3. Tax Discrepancy Detection

When `supplier_declared_rate != hsn_master_rate`:

- `cs_line_rankings.tax_discrepancy = True`
- Both rates stored in the ranking record
- CS UI displays both rates with a warning icon
- Note in CS PDF: "Tax rate discrepancy: supplier declared X%, HSN master rate Y%"
- The HSN master rate is used for normalization calculation (not the supplier rate)

---

## 4. Tie-Breaking Rules

When two or more bidders have identical `npv_adjusted_cost` for the same line:

```python
async def _apply_tie_breaking(self, db, rankings: list[CSLineRanking], org_id: UUID):
    """Apply tie-breaking rules in sequence."""
    groups = {}
    for r in rankings:
        groups.setdefault(r.npv_adjusted_cost, []).append(r)

    for cost_value, tied in groups.items():
        if len(tied) <= 1:
            continue

        # Rule 1: Delivery lead time (lowest wins)
        tied.sort(key=lambda r: self._get_delivery_days(r))
        if tied[0].delivery_days != tied[1].delivery_days:
            for idx, r in enumerate(tied):
                r.rank = rankings.index(r) + 1  # Recalculate position
                r.tie_breaking_applied = True
                r.tie_breaking_reason = "Delivery lead time"
            continue

        # Rule 2: Vendor performance score (highest wins)
        for r in tied:
            vendor = await self.vendor_repo.get(db, r.vendor_id, org_id)
            r._perf_score = vendor.performance_score or Decimal("0")
        tied.sort(key=lambda r: r._perf_score, reverse=True)
        if tied[0]._perf_score != tied[1]._perf_score:
            for r in tied:
                r.tie_breaking_applied = True
                r.tie_breaking_reason = "Vendor performance score"
            continue

        # Rule 3: Admin discretion
        for r in tied:
            r.tie_breaking_applied = True
            r.tie_breaking_reason = "Tied — requires admin discretion"
            # Generate tie-flag for admin with justification form
```

---

## 5. CS Output

### 5.1 Database Record

`comparative_statements` table stores the CS header. `cs_line_rankings` stores per-line per-bidder ranking data.

### 5.2 PDF Generation

Library: `weasyprint` (or `reportlab` as fallback)

**PDF sections:**
1. **RFQ Summary:** RFQ number, title, category, BU, buyer, estimated value, bid window dates
2. **Evaluation Methodology:** L1-only / QCBS / Technical Merit; cost of capital rate used; freight treatment
3. **Per-Line Comparison Table:**
   - Columns: Item Description | Qty | UOM | [Bidder 1: Raw Price | Freight | Tax | Landed | NPV-Adj | Rank] | [Bidder 2: ...] | ...
   - Tax discrepancy notes per cell
   - Tie-breaking annotations
4. **Per-Lot Summary (if multi-lot):** Lot total by bidder, lot winner
5. **Overall Winner:** L1 vendor, total L1 value
6. **Savings Analysis:** `(estimated_value - l1_value) / estimated_value × 100`
7. **Recommendations:** Auto-generated summary; buyer can edit before approval

PDF stored in MinIO `audit-documents` bucket; `comparative_statements.pdf_document_id` references the stored document.

---

## 6. CS Approval

```
1. Buyer generates CS → CS status = DRAFT
2. Buyer reviews, adds recommendations → saves
3. Buyer submits CS for approval → POST /api/v1/evaluations/{cs_id}/submit
4. Approval workflow instantiated:
   - Sourcing Manager review (mandatory)
   - Procurement Head approval (if value > threshold)
5. Each approver can:
   - APPROVE → advance to next step
   - REJECT → CS back to DRAFT; buyer revises
   - RETURN → CS back to buyer with comments
6. All approvers approve → CS status = APPROVED
7. CS approval triggers ARN creation: POST /api/v1/awards/from-cs/{cs_id}
```

---

## 7. CS Versioning

Each CS generation creates a new version:
- `comparative_statements.cs_version` incremented
- Previous version preserved (new row with same `rfq_id` but different `cs_number` suffix)
- Only the APPROVED version can trigger ARN creation
- Version history available via `GET /api/v1/evaluations/rfq/{rfq_id}/cs-versions`

---

## 8. EvaluationService Class

```python
class EvaluationService:
    async def assign_technical_evaluators(
        self, db, rfq_id: UUID, evaluator_ids: list[UUID], actor: User, org_id: UUID
    ) -> list[Evaluation]: ...

    async def submit_technical_scores(
        self, db, evaluation_id: UUID, scores: list[TechScoreRequest], actor: User, org_id: UUID
    ) -> Evaluation: ...

    async def finalize_technical_evaluation(
        self, db, rfq_id: UUID, actor: User, org_id: UUID
    ) -> list[BidResponse]:
        """Finalize technical evaluation. Returns technically-qualified bid list."""
        ...

    async def generate_comparative_statement(
        self, db, rfq_id: UUID, actor: User, org_id: UUID
    ) -> ComparativeStatement: ...

    async def submit_cs_for_approval(
        self, db, cs_id: UUID, actor: User, org_id: UUID
    ) -> ComparativeStatement: ...

    async def approve_cs(
        self, db, cs_id: UUID, task_id: UUID, actor: User, org_id: UUID
    ) -> ComparativeStatement: ...

    async def generate_arn(
        self, db, cs_id: UUID, actor: User, org_id: UUID
    ) -> AwardRecommendation:
        """Generate ARN from approved CS. Creates award_recommendations and award_details records."""
        ...
```
