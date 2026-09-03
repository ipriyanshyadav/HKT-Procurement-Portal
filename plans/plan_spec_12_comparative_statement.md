# IMPLEMENTATION PLAN — SPEC_12: Comparative Statement & Evaluation
**Module:** 12 | **Phase:** Core | **Squad:** C
**Spec File:** SPEC_12_COMPARATIVE_STATEMENT.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S12-01 | CS auto-generation on bid opening | evaluation/service.py | PLANNED |
| S12-02 | L1 discovery per lot/line (lowest price per line) | evaluation/service.py | PLANNED |
| S12-03 | Technical scoring (weighted) | evaluation/service.py | PLANNED |
| S12-04 | Commercial scoring (weighted) | evaluation/service.py | PLANNED |
| S12-05 | Composite score calculation | evaluation/service.py | PLANNED |
| S12-06 | CS PDF generation (reportlab) | evaluation/pdf_generator.py | PLANNED |
| S12-07 | Shortlisting logic | evaluation/service.py | PLANNED |
| S12-08 | Negotiation rounds tracking | evaluation/models.py | PLANNED |
| S12-09 | Negotiation price vs original bid comparison | evaluation/service.py | PLANNED |
| S12-10 | Award recommendation workflow | evaluation/service.py + workflow | PLANNED |
| S12-11 | Award details per lot/line | evaluation/models.py | PLANNED |
| S12-12 | CS approval workflow | evaluation/service.py | PLANNED |
| S12-13 | Price tolerance validation | evaluation/service.py | PLANNED |
| S12-14 | CS amendment (re-evaluation) | evaluation/service.py | PLANNED |
| S12-15 | Regret letters to non-awarded vendors | evaluation/service.py | PLANNED |
| S12-16 | 12 audit events | evaluation/service.py | PLANNED |
| S12-17 | CS stored in MinIO (comparative-statement bucket) | evaluation/service.py | PLANNED |

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-12-1 | L1 is calculated on `normalized_price_inr` (post-currency-normalization); if any bid lacks normalized_price_inr, CS generation fails with clear error | SPEC_12 Section 2; multi-currency RFQs need normalized prices | HIGH | Squad C |
| A-12-2 | Technical + Commercial weights from `rfq.evaluation_weights` JSONB; if NULL defaults to 70/30 split | SPEC defines weighted scoring; default not stated | MEDIUM | Squad C |
| A-12-3 | Negotiation round creates new bid_versions on parent bid_responses; price only (not full bid revision) | SPEC Section 8 negotiation rounds | MEDIUM | Squad C |
| A-12-4 | Price tolerance check: `(negotiated_price - original_price) / original_price ≤ settings.PRICE_TOLERANCE_DEFAULT (0.5%)`; INCREASE beyond 0.5% requires PROCUREMENT_HEAD approval | SPEC_12 Section 13 tolerance | MEDIUM | Squad C |
| A-12-5 | Regret letters sent via outbox→notification module; template_code = "VENDOR_REGRET_LETTER" | SPEC Section 15 regret letters | LOW | Squad C |

---
## STEP 2 — IMPLEMENT

### 2.1 `app/modules/evaluation/service.py`
```python
class EvaluationService:

    async def generate_comparative_statement(self, db, rfq_id: UUID, actor_id: UUID, org_id: UUID) -> ComparativeStatement:
        rfq = await self.rfq_repo.get(db, rfq_id, org_id)
        if rfq.bids_opened_at is None:
            raise AppException("BIDS_NOT_OPENED", "Bids must be opened before CS generation")
        bids = await self.bid_repo.get_all_opened(db, rfq_id, org_id)
        # Validate all bids have normalized prices
        missing_normalized = [b for b in bids if any(l.normalized_price_inr is None for l in b.lines)]
        if missing_normalized:
            raise AppException("MISSING_NORMALIZED_PRICES",
                f"{len(missing_normalized)} bids lack normalized prices. Run price normalization first.",
                400, {"bid_ids": [str(b.id) for b in missing_normalized]})
        # Get lots
        lots = await self.rfq_repo.get_lots(db, rfq_id, org_id)
        cs = ComparativeStatement(org_id=org_id, rfq_id=rfq_id, generated_by=actor_id,
            status="DRAFT", version=1)
        db.add(cs)
        await db.flush()
        weights = rfq.evaluation_weights or {"technical": 0.70, "commercial": 0.30}
        for lot in lots:
            lot_bids = [b for b in bids if any(l.lot_id == lot.id for l in b.lines)]
            for bid in lot_bids:
                lot_lines = [l for l in bid.lines if l.lot_id == lot.id]
                lot_total = sum(l.normalized_price_inr for l in lot_lines)
                ranking = CSLineRanking(
                    org_id=org_id, cs_id=cs.id, lot_id=lot.id, vendor_id=bid.vendor_id,
                    bid_id=bid.id, lot_total_inr=lot_total,
                    technical_score=await self._compute_technical_score(db, bid, rfq),
                    commercial_score=await self._compute_commercial_score(bid, lot_total, lot_bids),
                )
                ranking.composite_score = (
                    ranking.technical_score * weights["technical"] +
                    ranking.commercial_score * weights["commercial"]
                )
                db.add(ranking)
        # Determine L1 per lot
        for lot in lots:
            lot_rankings = [r for r in cs.rankings if r.lot_id == lot.id]
            l1 = min(lot_rankings, key=lambda r: r.lot_total_inr)
            l1.is_l1 = True
        # Generate PDF
        pdf_path = await self.pdf_generator.generate(cs, rfq, bids, lots, org_id)
        cs.document_path = pdf_path
        await self.publisher.publish("procurement.evaluation", "evaluation.cs.generated",
            {"cs_id": str(cs.id), "rfq_id": str(rfq_id)}, org_id)
        await self.audit.log(db, "EVALUATION", cs.id, "CS_GENERATED", actor_id, org_id)
        return cs

    async def _compute_commercial_score(self, bid, lot_total: float, all_lot_bids: list) -> float:
        """Lower price = higher commercial score. L1 gets 100."""
        l1_total = min(b.lot_total_inr for b in all_lot_bids if hasattr(b, "lot_total_inr"))
        if l1_total == 0:
            return 0.0
        return (l1_total / lot_total) * 100

    async def start_negotiation(self, db, cs_id: UUID, vendor_ids: list[UUID],
                                 actor_id: UUID, org_id: UUID) -> list[Negotiation]:
        cs = await self.repo.get(db, cs_id, org_id)
        negotiations = []
        for vendor_id in vendor_ids:
            neg = Negotiation(org_id=org_id, cs_id=cs_id, vendor_id=vendor_id,
                round_number=1, status="OPEN", initiated_by=actor_id)
            db.add(neg)
            negotiations.append(neg)
            await self.publisher.publish("procurement.evaluation", "evaluation.negotiation.started",
                {"cs_id": str(cs_id), "vendor_id": str(vendor_id)}, org_id)
        return negotiations

    async def submit_negotiated_price(self, db, negotiation_id: UUID, new_price: float,
                                       actor_id: UUID, org_id: UUID) -> Negotiation:
        neg = await self.neg_repo.get(db, negotiation_id, org_id)
        original_price = neg.original_price
        increase_pct = (new_price - original_price) / original_price if original_price > 0 else 0
        if increase_pct > settings.PRICE_TOLERANCE_DEFAULT:
            raise ValidationError("PRICE_TOLERANCE_EXCEEDED",
                f"Negotiated price is {increase_pct*100:.2f}% above original. Max {settings.PRICE_TOLERANCE_DEFAULT*100:.2f}%")
        neg.negotiated_price = new_price
        neg.price_change_pct = ((new_price - original_price) / original_price) * 100
        neg.status = "PRICE_SUBMITTED"
        return neg

    async def recommend_award(self, db, cs_id: UUID, awards: list[AwardRecommendationItem],
                               actor_id: UUID, org_id: UUID) -> AwardRecommendation:
        cs = await self.repo.get(db, cs_id, org_id)
        rec = AwardRecommendation(org_id=org_id, cs_id=cs_id, recommended_by=actor_id,
            status="PENDING_APPROVAL", total_awarded_value=sum(a.value for a in awards))
        db.add(rec)
        await db.flush()
        for award in awards:
            detail = AwardDetail(org_id=org_id, recommendation_id=rec.id,
                lot_id=award.lot_id, vendor_id=award.vendor_id,
                awarded_value=award.value, justification=award.justification)
            db.add(detail)
        # Trigger award approval workflow
        entity_context = {"awarded_total": float(rec.total_awarded_value), "rfq_id": str(cs.rfq_id),
                           "is_single_vendor": len({a.vendor_id for a in awards}) == 1}
        rule = await self.rules_engine.find_matching_rule(db, "AWARD", entity_context, org_id)
        if rule:
            await self.workflow_engine.instantiate(db, rule.workflow_template_code, "AWARD", rec.id,
                entity_context, org_id, actor_id)
        await self.audit.log(db, "EVALUATION", cs_id, "AWARD_RECOMMENDED", actor_id, org_id)
        return rec

    async def send_regret_letters(self, db, cs_id: UUID, actor_id: UUID, org_id: UUID):
        cs = await self.repo.get(db, cs_id, org_id)
        awarded_vendor_ids = {str(d.vendor_id) for d in cs.award_recommendation.details}
        all_bidders = await self.bid_repo.get_all_vendor_ids(db, cs.rfq_id, org_id)
        non_awarded = [v for v in all_bidders if str(v) not in awarded_vendor_ids]
        for vendor_id in non_awarded:
            await self.publisher.publish("procurement.notification", "notification.email.regret_letter",
                {"vendor_id": str(vendor_id), "rfq_id": str(cs.rfq_id),
                 "template_code": "VENDOR_REGRET_LETTER", "org_id": str(org_id)}, org_id)
```

### 2.2 `app/modules/evaluation/pdf_generator.py`
```python
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet

class CSPDFGenerator:
    async def generate(self, cs, rfq, bids, lots, org_id: UUID) -> str:
        """Generate CS PDF, upload to MinIO, return path."""
        filename = f"cs_{cs.id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.pdf"
        minio_path = f"{org_id}/rfq/{rfq.id}/cs/{filename}"
        # Build PDF in memory; upload to MinIO bucket "comparative-statement"
        # Table: rows=vendors, columns=lots with L1 highlighted
        # Return path for storage in cs.document_path
        return minio_path
```

---
## STEP 3 — TEST
```python
async def test_l1_identified_per_lot(db, factory):
    """L1 is vendor with lowest normalized_price_inr per lot."""
async def test_cs_fails_without_normalized_prices(db, factory):
    """Missing normalized prices → MISSING_NORMALIZED_PRICES error."""
async def test_price_tolerance_exceeded(db, factory):
    """Negotiated price >0.5% above original → ValidationError."""
async def test_commercial_score_l1_is_100(db, factory):
    """L1 vendor gets commercial_score=100."""
async def test_regret_letters_exclude_awarded_vendors(db, factory):
    """Awarded vendors not in regret letter notification list."""
async def test_cs_pdf_uploaded_to_minio(db, factory, mock_minio):
    """CS generation uploads PDF to MinIO 'comparative-statement' bucket."""
```
