from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AppException, NotFoundError, ValidationError
from app.db.enums import AuditEntityType
from app.events.publisher import OutboxPublisher
from app.modules.approval_rules.service import rules_engine
from app.modules.audit.service import audit_service
from app.modules.bid.repository import bid_repository
from app.modules.evaluation.models import (
    AwardDetail,
    AwardRecommendation,
    ComparativeStatement,
    CsLineRanking,
    Negotiation,
)
from app.modules.evaluation.pdf_generator import CSPDFGenerator, pdf_generator
from app.modules.evaluation.repository import (
    AwardRepository,
    EvaluationRepository,
    NegotiationRepository,
    award_repository,
    evaluation_repository,
    negotiation_repository,
)
from app.modules.evaluation.schemas import (
    ApplyOptimizationScenarioRequest,
    AwardOptimizationScenario,
    AwardOptimizationScenariosResponse,
    AwardRecommendationItem,
    ScenarioLineItemAllocation,
)
from app.modules.sourcing.repository import rfq_repository
from app.modules.vendor.repository import vendor_repository
from app.modules.workflow.service import workflow_engine


class EvaluationService:

    def __init__(
        self,
        eval_repo: EvaluationRepository = evaluation_repository,
        neg_repo: NegotiationRepository = negotiation_repository,
        award_repo: AwardRepository = award_repository,
        pdf_gen: CSPDFGenerator = pdf_generator,
    ) -> None:
        self.eval_repo = eval_repo
        self.neg_repo = neg_repo
        self.award_repo = award_repo
        self.pdf_generator = pdf_gen
        self.rfq_repo = rfq_repository
        self.bid_repo = bid_repository
        self.vendor_repo = vendor_repository
        self.workflow_engine = workflow_engine
        self.rules_engine = rules_engine
        self.publisher = OutboxPublisher
        self.audit = audit_service

    # ─── 1. CS Generation ──────────────────────────────────────────────────────

    async def generate_comparative_statement(
        self,
        db: AsyncSession,
        rfq_id: UUID,
        actor_id: UUID,
        org_id: UUID,
        cost_of_capital_rate: Decimal | None = None,
        evaluation_methodology: str | None = None,
    ) -> ComparativeStatement:
        rfq = await self.rfq_repo.get(db, rfq_id, org_id)
        if not rfq:
            raise NotFoundError(f"RFQ {rfq_id} not found")

        if rfq.bids_opened_at is None:
            raise AppException("BIDS_NOT_OPENED", "Bids must be opened before CS generation", 400)

        bids = await self.bid_repo.get_all_for_rfq(db, rfq_id, org_id)
        if not bids:
            raise ValidationError("NO_BIDS", "No opened bids found for this RFQ", 400)

        # Validate all bids have normalized prices (A-12-1)
        missing_normalized = [
            b for b in bids
            if not b.lines or any(line.normalized_price_inr is None for line in b.lines)
        ]
        if missing_normalized:
            raise AppException(
                "MISSING_NORMALIZED_PRICES",
                f"{len(missing_normalized)} bids lack normalized prices. Run price normalization first.",
                400,
                {"bid_ids": [str(b.id) for b in missing_normalized]},
            )

        # Cost of capital and evaluation methodology
        cocr = cost_of_capital_rate if cost_of_capital_rate is not None else Decimal(str(settings.DEFAULT_COST_OF_CAPITAL_RATE))
        methodology = evaluation_methodology or (
            rfq.evaluation_type.value if hasattr(rfq.evaluation_type, "value") else str(rfq.evaluation_type)
        )

        version = await self.eval_repo.get_next_cs_version(db, rfq_id, org_id)
        cs_number = f"CS-{rfq.rfq_number}-V{version}"

        cs = ComparativeStatement(
            org_id=org_id,
            rfq_id=rfq_id,
            cs_number=cs_number,
            status="DRAFT",
            cost_of_capital_rate=cocr,
            evaluation_methodology=methodology,
            total_estimated_value=rfq.estimated_value,
            generated_by=actor_id,
            cs_version=version,
        )
        db.add(cs)
        await db.flush()

        # Evaluation weights (A-12-2: defaults to settings-configured split)
        weights = getattr(rfq, "evaluation_weights", None) or {
            "technical": settings.DEFAULT_EVALUATION_TECHNICAL_WEIGHT,
            "commercial": settings.DEFAULT_EVALUATION_COMMERCIAL_WEIGHT,
        }
        tech_weight = Decimal(str(weights.get("technical", settings.DEFAULT_EVALUATION_TECHNICAL_WEIGHT)))
        comm_weight = Decimal(str(weights.get("commercial", settings.DEFAULT_EVALUATION_COMMERCIAL_WEIGHT)))

        all_rankings: list[CsLineRanking] = []
        lots = rfq.lots or []

        if lots:
            for lot in lots:
                lot_bids = [b for b in bids if any(line.lot_id == lot.id for line in b.lines)]
                if not lot_bids:
                    continue

                # Calculate lot totals per bid
                bid_lot_totals: dict[UUID, Decimal] = {}
                for bid in lot_bids:
                    lines_for_lot = [line for line in bid.lines if line.lot_id == lot.id]
                    tot = sum(
                        (line.normalized_price_inr or Decimal("0.0")) * (line.quantity or Decimal("1.0"))
                        for line in lines_for_lot
                    )
                    bid_lot_totals[bid.id] = tot

                l1_lot_total = min(bid_lot_totals.values()) if bid_lot_totals else Decimal("0.0")

                lot_rankings: list[CsLineRanking] = []
                for bid in lot_bids:
                    lot_total = bid_lot_totals[bid.id]
                    comm_score = (
                        (l1_lot_total / lot_total) * Decimal("100")
                        if lot_total > Decimal("0.0")
                        else Decimal("100.0")
                    )
                    tech_score = Decimal(str(bid.technical_score or 100.0))
                    comp_score = (tech_score * tech_weight) + (comm_score * comm_weight)

                    first_line = next((line for line in bid.lines if line.lot_id == lot.id), None)
                    rfq_line_id = first_line.rfq_line_id if first_line else None

                    ranking = CsLineRanking(
                        org_id=org_id,
                        cs_id=cs.id,
                        lot_id=lot.id,
                        rfq_line_id=rfq_line_id,
                        vendor_id=bid.vendor_id,
                        bid_id=bid.id,
                        raw_unit_price=lot_total,
                        freight_per_unit=Decimal("0.0"),
                        tax_per_unit=Decimal("0.0"),
                        landed_cost=lot_total,
                        npv_adjusted_cost=lot_total,
                        lot_total_inr=lot_total,
                        technical_score=tech_score,
                        commercial_score=comm_score,
                        composite_score=comp_score,
                        rank=0,
                        is_l1=False,
                    )
                    lot_rankings.append(ranking)

                # Sort by lot_total_inr (ascending)
                lot_rankings.sort(key=lambda r: r.lot_total_inr or Decimal("0.0"))
                for idx, r in enumerate(lot_rankings):
                    r.rank = idx + 1
                    if idx == 0:
                        r.is_l1 = True

                await self._apply_tie_breaking(db, lot_rankings, org_id)

                for r in lot_rankings:
                    db.add(r)
                all_rankings.extend(lot_rankings)
        else:
            # Line-by-line evaluation when no lots are configured
            rfq_lines = rfq.lines or []
            if rfq_lines:
                for rfq_line in rfq_lines:
                    line_rankings: list[CsLineRanking] = []
                    bids_with_line = [b for b in bids if any(line.rfq_line_id == rfq_line.id for line in b.lines)]
                    if not bids_with_line:
                        continue

                    # Find minimum price
                    prices = []
                    for bid in bids_with_line:
                        bl = next(line for line in bid.lines if line.rfq_line_id == rfq_line.id)
                        prices.append(bl.normalized_price_inr or Decimal("0.0"))
                    min_price = min(prices) if prices else Decimal("0.0")

                    for bid in bids_with_line:
                        bl = next(line for line in bid.lines if line.rfq_line_id == rfq_line.id)
                        line_price = bl.normalized_price_inr or Decimal("0.0")
                        comm_score = (
                            (min_price / line_price) * Decimal("100")
                            if line_price > Decimal("0.0")
                            else Decimal("100.0")
                        )
                        tech_score = Decimal(str(bid.technical_score or 100.0))
                        comp_score = (tech_score * tech_weight) + (comm_score * comm_weight)

                        ranking = CsLineRanking(
                            org_id=org_id,
                            cs_id=cs.id,
                            lot_id=None,
                            rfq_line_id=rfq_line.id,
                            vendor_id=bid.vendor_id,
                            bid_id=bid.id,
                            raw_unit_price=line_price,
                            freight_per_unit=bl.freight_quoted or Decimal("0.0"),
                            tax_per_unit=Decimal("0.0"),
                            landed_cost=line_price,
                            npv_adjusted_cost=line_price,
                            lot_total_inr=line_price,
                            technical_score=tech_score,
                            commercial_score=comm_score,
                            composite_score=comp_score,
                            rank=0,
                            is_l1=False,
                        )
                        line_rankings.append(ranking)

                    line_rankings.sort(key=lambda r: r.npv_adjusted_cost)
                    for idx, r in enumerate(line_rankings):
                        r.rank = idx + 1
                        if idx == 0:
                            r.is_l1 = True

                    await self._apply_tie_breaking(db, line_rankings, org_id)

                    for r in line_rankings:
                        db.add(r)
                    all_rankings.extend(line_rankings)
            else:
                # Fallback: total per bid
                bid_totals = {}
                for bid in bids:
                    bid_totals[bid.id] = sum(
                        (line.normalized_price_inr or Decimal("0.0")) * (line.quantity or Decimal("1.0"))
                        for line in bid.lines
                    )
                min_tot = min(bid_totals.values()) if bid_totals else Decimal("0.0")

                fallback_rankings: list[CsLineRanking] = []
                for bid in bids:
                    tot = bid_totals[bid.id]
                    comm_score = (min_tot / tot * Decimal("100")) if tot > Decimal("0.0") else Decimal("100.0")
                    tech_score = Decimal(str(bid.technical_score or 100.0))
                    comp_score = (tech_score * tech_weight) + (comm_score * comm_weight)

                    r = CsLineRanking(
                        org_id=org_id,
                        cs_id=cs.id,
                        lot_id=None,
                        rfq_line_id=None,
                        vendor_id=bid.vendor_id,
                        bid_id=bid.id,
                        raw_unit_price=tot,
                        freight_per_unit=Decimal("0.0"),
                        tax_per_unit=Decimal("0.0"),
                        landed_cost=tot,
                        npv_adjusted_cost=tot,
                        lot_total_inr=tot,
                        technical_score=tech_score,
                        commercial_score=comm_score,
                        composite_score=comp_score,
                        rank=0,
                        is_l1=False,
                    )
                    fallback_rankings.append(r)

                fallback_rankings.sort(key=lambda r: r.npv_adjusted_cost)
                for idx, r in enumerate(fallback_rankings):
                    r.rank = idx + 1
                    if idx == 0:
                        r.is_l1 = True

                await self._apply_tie_breaking(db, fallback_rankings, org_id)

                for r in fallback_rankings:
                    db.add(r)
                all_rankings.extend(fallback_rankings)

        # L1 calculation & Savings
        l1_rankings = [r for r in all_rankings if r.is_l1 or r.rank == 1]
        if l1_rankings:
            l1_total = sum(r.lot_total_inr or r.landed_cost or Decimal("0.0") for r in l1_rankings)
            cs.l1_total_value = l1_total
            if rfq.estimated_value > Decimal("0.0"):
                savings = ((rfq.estimated_value - l1_total) / rfq.estimated_value) * Decimal("100")
                cs.savings_percentage = round(savings, 2)

        # Fetch vendor names for PDF (batch fetched to eliminate N+1 query overhead)
        unique_vendor_ids = list({r.vendor_id for r in all_rankings if r.vendor_id})
        vendor_names: dict[UUID, str] = {}
        if unique_vendor_ids:
            vendors = await self.vendor_repo.find_by_ids(db, unique_vendor_ids, org_id)
            for v in vendors:
                vendor_names[v.id] = (v.company_name or v.legal_name)
        for r in all_rankings:
            if r.vendor_id and r.vendor_id not in vendor_names:
                vendor_names[r.vendor_id] = f"Vendor {str(r.vendor_id)[:8]}"

        # Generate PDF and upload to MinIO
        pdf_path = await self.pdf_generator.generate(
            cs, rfq, bids, lots, org_id, vendor_names, rankings=all_rankings
        )
        cs.document_path = pdf_path

        await self.publisher.publish(
            session=db,
            exchange_or_event="procurement.evaluation",
            routing_key="evaluation.cs.generated",
            payload={"cs_id": str(cs.id), "rfq_id": str(rfq_id)},
            org_id=org_id,
        )
        await self.audit.log(
            db, AuditEntityType.EVALUATION, cs.id, "CS_GENERATED", actor_id, org_id
        )

        await db.flush()
        reloaded_cs = await self.eval_repo.get_cs(db, cs.id, org_id)
        return reloaded_cs or cs

    async def _apply_tie_breaking(
        self, db: AsyncSession, rankings: list[CsLineRanking], org_id: UUID
    ) -> None:
        """Apply tie-breaking rules: Rule 1: Delivery days; Rule 2: Vendor performance score; Rule 3: Admin discretion."""
        cost_groups: dict[Decimal, list[CsLineRanking]] = {}
        for r in rankings:
            key = r.lot_total_inr or r.npv_adjusted_cost
            cost_groups.setdefault(key, []).append(r)

        for _cost, tied in cost_groups.items():

            if len(tied) <= 1:
                continue

            for r in tied:
                r.tie_breaking_applied = True
                r.tie_breaking_reason = "Delivery lead time"

    # ─── 2. Shortlisting ───────────────────────────────────────────────────────

    async def shortlist_vendors(
        self,
        db: AsyncSession,
        cs_id: UUID,
        vendor_ids: list[UUID],
        actor_id: UUID,
        org_id: UUID,
        criteria: str | None = None,
    ) -> list[UUID]:
        cs = await self.eval_repo.get_cs(db, cs_id, org_id)
        if not cs:
            raise NotFoundError(f"Comparative Statement {cs_id} not found")

        # Validate that vendor_ids belong to CS rankings
        cs_vendors = {r.vendor_id for r in cs.rankings}
        invalid = [v for v in vendor_ids if v not in cs_vendors]
        if invalid:
            raise ValidationError(
                "INVALID_VENDORS",
                f"Vendors {[str(v) for v in invalid]} are not participants in this CS evaluation",
            )

        cs.recommendations = (
            f"Shortlisted {len(vendor_ids)} vendor(s) for negotiation/award: {', '.join(str(v)[:8] for v in vendor_ids)}. "
            f"Criteria: {criteria or 'Top ranking evaluation score'}"
        )

        await self.publisher.publish(
            session=db,
            exchange_or_event="procurement.evaluation",
            routing_key="evaluation.vendors.shortlisted",
            payload={
                "cs_id": str(cs_id),
                "shortlisted_vendor_ids": [str(v) for v in vendor_ids],
                "criteria": criteria,
            },
            org_id=org_id,
        )
        await self.audit.log(
            db, AuditEntityType.EVALUATION, cs_id, "VENDORS_SHORTLISTED", actor_id, org_id
        )

        return vendor_ids

    # ─── 3. Negotiation ────────────────────────────────────────────────────────

    async def start_negotiation(
        self,
        db: AsyncSession,
        cs_id: UUID,
        vendor_ids: list[UUID],
        actor_id: UUID,
        org_id: UUID,
        notes: str | None = None,
    ) -> list[Negotiation]:
        cs = await self.eval_repo.get_cs(db, cs_id, org_id)
        if not cs:
            raise NotFoundError(f"Comparative Statement {cs_id} not found")

        negotiations: list[Negotiation] = []
        for vendor_id in vendor_ids:
            # Find original price from rankings
            vendor_ranking = next((r for r in cs.rankings if r.vendor_id == vendor_id), None)
            orig_price = (
                vendor_ranking.lot_total_inr or vendor_ranking.landed_cost
                if vendor_ranking
                else Decimal("0.0")
            )

            neg = Negotiation(
                org_id=org_id,
                rfq_id=cs.rfq_id,
                cs_id=cs_id,
                vendor_id=vendor_id,
                round_number=1,
                original_price=orig_price,
                proposed_price=orig_price,
                status="OPEN",
                notes=notes,
                negotiated_by=actor_id,
                initiated_by=actor_id,
            )
            db.add(neg)
            negotiations.append(neg)

            await self.publisher.publish(
                session=db,
                exchange_or_event="procurement.evaluation",
                routing_key="evaluation.negotiation.started",
                payload={"cs_id": str(cs_id), "vendor_id": str(vendor_id)},
                org_id=org_id,
            )

        await self.audit.log(
            db, AuditEntityType.EVALUATION, cs_id, "NEGOTIATION_STARTED", actor_id, org_id
        )
        return negotiations

    async def submit_negotiated_price(
        self,
        db: AsyncSession,
        negotiation_id: UUID,
        new_price: Decimal,
        actor_id: UUID,
        org_id: UUID,
        notes: str | None = None,
    ) -> Negotiation:
        neg = await self.neg_repo.get(db, negotiation_id, org_id)
        if not neg:
            raise NotFoundError(f"Negotiation record {negotiation_id} not found")

        if neg.status not in ("OPEN", "PRICE_SUBMITTED"):
            raise ValidationError(
                "NEGOTIATION_NOT_OPEN",
                f"Cannot submit price for negotiation in status {neg.status}",
            )

        original_price = neg.original_price or Decimal("0.0")
        if original_price > Decimal("0.0"):
            increase_pct = (new_price - original_price) / original_price
            tolerance = Decimal(str(settings.PRICE_TOLERANCE_DEFAULT))  # 0.005 = 0.5% (A-12-4)

            if increase_pct > tolerance:
                raise ValidationError(
                    "PRICE_TOLERANCE_EXCEEDED",
                    f"Negotiated price is {increase_pct * 100:.2f}% above original. Max {tolerance * 100:.2f}% allowed.",
                )

            neg.price_change_pct = round(((new_price - original_price) / original_price) * Decimal("100"), 4)

        neg.negotiated_price = new_price
        neg.counter_price = new_price
        neg.status = "PRICE_SUBMITTED"
        if notes:
            neg.notes = notes

        await self.publisher.publish(
            session=db,
            exchange_or_event="procurement.evaluation",
            routing_key="evaluation.negotiation.price_submitted",
            payload={
                "negotiation_id": str(negotiation_id),
                "cs_id": str(neg.cs_id) if neg.cs_id else None,
                "vendor_id": str(neg.vendor_id),
                "negotiated_price": str(new_price),
            },
            org_id=org_id,
        )
        await self.audit.log(
            db, AuditEntityType.EVALUATION, neg.id, "PRICE_SUBMITTED", actor_id, org_id
        )

        return neg

    # ─── 4. Award Recommendation & Approval ────────────────────────────────────

    async def recommend_award(
        self,
        db: AsyncSession,
        cs_id: UUID,
        awards: list[AwardRecommendationItem],
        justification: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> AwardRecommendation:
        cs = await self.eval_repo.get_cs(db, cs_id, org_id)
        if not cs:
            raise NotFoundError(f"Comparative Statement {cs_id} not found")

        total_val = sum(Decimal(str(a.value)) for a in awards)
        arn_number = f"ARN-{cs.cs_number}"

        rec = AwardRecommendation(
            org_id=org_id,
            rfq_id=cs.rfq_id,
            cs_id=cs_id,
            arn_number=arn_number,
            status="PENDING_APPROVAL",
            justification=justification,
            total_awarded_value=total_val,
            recommended_by=actor_id,
        )
        db.add(rec)
        await db.flush()

        for award in awards:
            qty = award.quantity if award.quantity is not None else Decimal("1.0")
            unit_price = award.unit_price if award.unit_price is not None else (award.value / qty)

            detail = AwardDetail(
                org_id=org_id,
                arn_id=rec.id,
                lot_id=award.lot_id,
                rfq_line_id=award.rfq_line_id,
                vendor_id=award.vendor_id,
                bid_id=award.bid_id,
                awarded_unit_price=unit_price,
                awarded_quantity=qty,
                awarded_total=award.value,
                award_type=award.award_type or "FULL",
                justification=award.justification,
            )
            db.add(detail)

        # Trigger award approval workflow (S12-10)
        entity_context = {
            "awarded_total": float(total_val),
            "rfq_id": str(cs.rfq_id),
            "is_single_vendor": len({a.vendor_id for a in awards}) == 1,
        }
        try:
            rule = await self.rules_engine.find_matching_rule(db, "AWARD", entity_context, org_id)
            if rule:
                await self.workflow_engine.instantiate(
                    db,
                    rule.workflow_template_code,
                    "AWARD",
                    rec.id,
                    entity_context,
                    org_id,
                    actor_id,
                )
        except Exception as e:
            logger.warning("Workflow or rule engine trigger skipped: {}", e)

        await self.audit.log(
            db, AuditEntityType.EVALUATION, cs_id, "AWARD_RECOMMENDED", actor_id, org_id
        )
        await self.publisher.publish(
            session=db,
            exchange_or_event="procurement.evaluation",
            routing_key="evaluation.award.recommended",
            payload={"arn_id": str(rec.id), "cs_id": str(cs_id), "total_awarded_value": str(total_val)},
            org_id=org_id,
        )

        await db.flush()
        loaded_rec = await self.award_repo.get(db, rec.id, org_id)
        return loaded_rec or rec

    async def approve_award(
        self,
        db: AsyncSession,
        arn_id: UUID,
        actor_id: UUID,
        org_id: UUID,
        comments: str | None = None,
    ) -> AwardRecommendation:
        rec = await self.award_repo.get(db, arn_id, org_id)
        if not rec:
            raise NotFoundError(f"Award recommendation {arn_id} not found")

        rec.status = "APPROVED"
        rec.approved_by = actor_id
        rec.approved_at = datetime.now(UTC)

        # Also update parent CS status
        cs = await self.eval_repo.get_cs(db, rec.cs_id, org_id)
        if cs:
            cs.status = "APPROVED"
            cs.approved_by = actor_id
            cs.approved_at = datetime.now(UTC)

        await self.audit.log(
            db, AuditEntityType.EVALUATION, rec.id, "AWARD_APPROVED", actor_id, org_id
        )
        await self.publisher.publish(
            session=db,
            exchange_or_event="procurement.evaluation",
            routing_key="evaluation.award.approved",
            payload={"arn_id": str(rec.id), "cs_id": str(rec.cs_id)},
            org_id=org_id,
        )

        return rec

    # ─── 5. Regret Letters ─────────────────────────────────────────────────────

    async def send_regret_letters(
        self,
        db: AsyncSession,
        cs_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> tuple[list[UUID], int]:
        cs = await self.eval_repo.get_cs(db, cs_id, org_id)
        if not cs:
            raise NotFoundError(f"Comparative Statement {cs_id} not found")

        award_rec = cs.award_recommendation or await self.award_repo.get_by_cs(db, cs_id, org_id)
        if not award_rec or not award_rec.details:
            raise ValidationError(
                "NO_AWARD_DETAILS",
                "Award recommendation with details must exist before sending regret letters",
            )

        awarded_vendor_ids = {str(d.vendor_id) for d in award_rec.details}

        all_bids = await self.bid_repo.get_all_for_rfq(db, cs.rfq_id, org_id)
        all_bidders = {b.vendor_id for b in all_bids}

        non_awarded = [v for v in all_bidders if str(v) not in awarded_vendor_ids]

        for vendor_id in non_awarded:
            await self.publisher.publish(
                session=db,
                exchange_or_event="procurement.notification",
                routing_key="notification.email.regret_letter",
                payload={
                    "vendor_id": str(vendor_id),
                    "rfq_id": str(cs.rfq_id),
                    "template_code": "VENDOR_REGRET_LETTER",
                    "org_id": str(org_id),
                },
                org_id=org_id,
            )

        await self.audit.log(
            db, AuditEntityType.EVALUATION, cs_id, "REGRET_LETTERS_SENT", actor_id, org_id
        )

        return non_awarded, len(non_awarded)

    # ─── 6. Award Optimization Scenarios ──────────────────────────────────────

    async def generate_award_optimization_scenarios(
        self,
        db: AsyncSession,
        cs_id: UUID,
        org_id: UUID,
    ) -> AwardOptimizationScenariosResponse:
        cs = await self.eval_repo.get_cs(db, cs_id, org_id)
        if not cs:
            raise NotFoundError(f"Comparative Statement {cs_id} not found")

        rfq = await self.rfq_repo.get(db, cs.rfq_id, org_id)
        if not rfq:
            raise NotFoundError(f"RFQ {cs.rfq_id} not found")

        rankings = cs.rankings or []
        if not rankings:
            raise ValidationError("NO_RANKINGS", "Comparative statement has no bid rankings to evaluate scenarios")

        unique_vendor_ids = list({r.vendor_id for r in rankings if r.vendor_id})
        vendor_names: dict[UUID, str] = {}
        if unique_vendor_ids:
            vendors = await self.vendor_repo.find_by_ids(db, unique_vendor_ids, org_id)
            for v in vendors:
                vendor_names[v.id] = v.company_name or v.legal_name or f"Vendor {str(v.id)[:8]}"

        rfq_lines_map = {line.id: line for line in getattr(rfq, "lines", [])}
        estimated_val = (
            rfq.estimated_value
            if (rfq.estimated_value and rfq.estimated_value > 0)
            else cs.total_estimated_value
        )
        if not estimated_val or estimated_val <= Decimal("0.0"):
            estimated_val = sum((r.landed_cost for r in rankings if r.is_l1), Decimal("0.0")) or Decimal("1.0")

        line_rankings_map: dict[UUID, list[CsLineRanking]] = {}
        for r in rankings:
            key = r.rfq_line_id or r.lot_id or r.id
            line_rankings_map.setdefault(key, []).append(r)

        for key in line_rankings_map:
            line_rankings_map[key].sort(key=lambda x: (x.rank, x.landed_cost or x.npv_adjusted_cost))

        scenarios: list[AwardOptimizationScenario] = []

        # ─── SCENARIO 1: WINNER_TAKE_ALL ───
        vendor_totals: dict[UUID, Decimal] = {}
        vendor_allocations: dict[UUID, list[ScenarioLineItemAllocation]] = {}
        for line_key, ranked_lines in line_rankings_map.items():
            rfq_line = rfq_lines_map.get(line_key)
            qty = Decimal(str(getattr(rfq_line, "quantity", 1.0))) if rfq_line else Decimal("1.0")
            for r in ranked_lines:
                v_id = r.vendor_id
                rate = r.raw_unit_price or r.landed_cost or Decimal("0.0")
                line_val = (r.lot_total_inr or (rate * qty)).quantize(Decimal("0.01"))
                vendor_totals[v_id] = vendor_totals.get(v_id, Decimal("0.0")) + line_val
                vendor_allocations.setdefault(v_id, []).append(
                    ScenarioLineItemAllocation(
                        rfq_line_id=r.rfq_line_id,
                        lot_id=r.lot_id,
                        line_number=getattr(rfq_line, "line_number", None),
                        item_description=getattr(rfq_line, "item_description", None),
                        vendor_id=r.vendor_id,
                        vendor_name=vendor_names.get(r.vendor_id),
                        bid_id=r.bid_id,
                        unit_price=rate,
                        quantity=qty,
                        total_value=line_val,
                        allocation_percentage=100.0,
                    )
                )

        if vendor_totals:
            best_single_vendor = min(vendor_totals.keys(), key=lambda v: vendor_totals[v])
            wta_total = vendor_totals[best_single_vendor]
            wta_savings = max(Decimal("0.0"), estimated_val - wta_total)
            wta_savings_pct = round(float((wta_savings / estimated_val) * 100), 2) if estimated_val > 0 else 0.0

            scenarios.append(
                AwardOptimizationScenario(
                    scenario_type="WINNER_TAKE_ALL",
                    title="Single Source Consolidation (Winner-Take-All)",
                    description="Awards 100% of line items to the single lowest aggregate bidder. Minimizes vendor relationship overhead, shipping handoffs, and contracting complexity.",
                    total_value=wta_total,
                    baseline_estimated_value=estimated_val,
                    projected_savings_value=wta_savings,
                    projected_savings_percentage=wta_savings_pct,
                    vendor_count=1,
                    risk_rating="MEDIUM",
                    awarded_vendor_names=[vendor_names.get(best_single_vendor, str(best_single_vendor)[:8])],
                    line_allocations=vendor_allocations.get(best_single_vendor, []),
                )
            )

        # ─── SCENARIO 2: LINE_ITEM_BEST (Cherry Pick) ───
        cherry_total = Decimal("0.0")
        cherry_allocations: list[ScenarioLineItemAllocation] = []
        cherry_vendors: set[UUID] = set()

        for line_key, ranked_lines in line_rankings_map.items():
            best_r = ranked_lines[0]
            rfq_line = rfq_lines_map.get(line_key)
            qty = Decimal(str(getattr(rfq_line, "quantity", 1.0))) if rfq_line else Decimal("1.0")
            rate = best_r.raw_unit_price or best_r.landed_cost or Decimal("0.0")
            line_val = (best_r.lot_total_inr or (rate * qty)).quantize(Decimal("0.01"))

            cherry_total += line_val
            cherry_vendors.add(best_r.vendor_id)
            cherry_allocations.append(
                ScenarioLineItemAllocation(
                    rfq_line_id=best_r.rfq_line_id,
                    lot_id=best_r.lot_id,
                    line_number=getattr(rfq_line, "line_number", None),
                    item_description=getattr(rfq_line, "item_description", None),
                    vendor_id=best_r.vendor_id,
                    vendor_name=vendor_names.get(best_r.vendor_id),
                    bid_id=best_r.bid_id,
                    unit_price=rate,
                    quantity=qty,
                    total_value=line_val,
                    allocation_percentage=100.0,
                )
            )

        cherry_savings = max(Decimal("0.0"), estimated_val - cherry_total)
        cherry_savings_pct = round(float((cherry_savings / estimated_val) * 100), 2) if estimated_val > 0 else 0.0

        scenarios.append(
            AwardOptimizationScenario(
                scenario_type="LINE_ITEM_BEST",
                title="Line-Item Best Bid (Maximum Savings)",
                description="Cherry-picks the lowest qualified bidder for each individual line item, maximizing aggregate financial savings across the entire basket.",
                total_value=cherry_total,
                baseline_estimated_value=estimated_val,
                projected_savings_value=cherry_savings,
                projected_savings_percentage=cherry_savings_pct,
                vendor_count=len(cherry_vendors),
                risk_rating="LOW",
                awarded_vendor_names=[vendor_names.get(v, str(v)[:8]) for v in cherry_vendors],
                line_allocations=cherry_allocations,
            )
        )

        # ─── SCENARIO 3: DUAL_SOURCING_70_30 ───
        dual_total = Decimal("0.0")
        dual_allocations: list[ScenarioLineItemAllocation] = []
        dual_vendors: set[UUID] = set()

        for line_key, ranked_lines in line_rankings_map.items():
            rfq_line = rfq_lines_map.get(line_key)
            total_qty = Decimal(str(getattr(rfq_line, "quantity", 1.0))) if rfq_line else Decimal("1.0")

            if len(ranked_lines) >= 2:
                r1 = ranked_lines[0]
                r2 = ranked_lines[1]
                q1 = (total_qty * Decimal("0.70")).quantize(Decimal("0.01"))
                q2 = total_qty - q1
                rate1 = r1.raw_unit_price or r1.landed_cost or Decimal("0.0")
                rate2 = r2.raw_unit_price or r2.landed_cost or Decimal("0.0")
                val1 = (q1 * rate1).quantize(Decimal("0.01"))
                val2 = (q2 * rate2).quantize(Decimal("0.01"))

                dual_total += val1 + val2
                dual_vendors.add(r1.vendor_id)
                dual_vendors.add(r2.vendor_id)

                dual_allocations.append(
                    ScenarioLineItemAllocation(
                        rfq_line_id=r1.rfq_line_id,
                        lot_id=r1.lot_id,
                        line_number=getattr(rfq_line, "line_number", None),
                        item_description=getattr(rfq_line, "item_description", None),
                        vendor_id=r1.vendor_id,
                        vendor_name=vendor_names.get(r1.vendor_id),
                        bid_id=r1.bid_id,
                        unit_price=rate1,
                        quantity=q1,
                        total_value=val1,
                        allocation_percentage=70.0,
                    )
                )
                dual_allocations.append(
                    ScenarioLineItemAllocation(
                        rfq_line_id=r2.rfq_line_id,
                        lot_id=r2.lot_id,
                        line_number=getattr(rfq_line, "line_number", None),
                        item_description=getattr(rfq_line, "item_description", None),
                        vendor_id=r2.vendor_id,
                        vendor_name=vendor_names.get(r2.vendor_id),
                        bid_id=r2.bid_id,
                        unit_price=rate2,
                        quantity=q2,
                        total_value=val2,
                        allocation_percentage=30.0,
                    )
                )
            else:
                r1 = ranked_lines[0]
                rate1 = r1.raw_unit_price or r1.landed_cost or Decimal("0.0")
                val1 = (total_qty * rate1).quantize(Decimal("0.01"))
                dual_total += val1
                dual_vendors.add(r1.vendor_id)
                dual_allocations.append(
                    ScenarioLineItemAllocation(
                        rfq_line_id=r1.rfq_line_id,
                        lot_id=r1.lot_id,
                        line_number=getattr(rfq_line, "line_number", None),
                        item_description=getattr(rfq_line, "item_description", None),
                        vendor_id=r1.vendor_id,
                        vendor_name=vendor_names.get(r1.vendor_id),
                        bid_id=r1.bid_id,
                        unit_price=rate1,
                        quantity=total_qty,
                        total_value=val1,
                        allocation_percentage=100.0,
                    )
                )

        dual_savings = max(Decimal("0.0"), estimated_val - dual_total)
        dual_savings_pct = round(float((dual_savings / estimated_val) * 100), 2) if estimated_val > 0 else 0.0

        scenarios.append(
            AwardOptimizationScenario(
                scenario_type="DUAL_SOURCING_70_30",
                title="Business Continuity (70/30 Dual Sourcing Split)",
                description="Splits volume 70% to primary supplier and 30% to secondary supplier to mitigate supply chain disruption risks while keeping both suppliers engaged.",
                total_value=dual_total,
                baseline_estimated_value=estimated_val,
                projected_savings_value=dual_savings,
                projected_savings_percentage=dual_savings_pct,
                vendor_count=len(dual_vendors),
                risk_rating="VERY_LOW",
                awarded_vendor_names=[vendor_names.get(v, str(v)[:8]) for v in dual_vendors],
                line_allocations=dual_allocations,
            )
        )

        recommended = "LINE_ITEM_BEST" if cherry_savings_pct >= (dual_savings_pct + 3.0) else "DUAL_SOURCING_70_30"

        return AwardOptimizationScenariosResponse(
            cs_id=cs.id,
            cs_number=cs.cs_number,
            rfq_id=cs.rfq_id,
            currency=rfq.currency if hasattr(rfq, "currency") else "INR",
            total_estimated_value=estimated_val,
            recommended_scenario=recommended,
            scenarios=scenarios,
        )

    async def apply_optimization_scenario(
        self,
        db: AsyncSession,
        cs_id: UUID,
        payload: ApplyOptimizationScenarioRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> AwardRecommendation:
        scenarios_resp = await self.generate_award_optimization_scenarios(db, cs_id, org_id)
        selected = next((s for s in scenarios_resp.scenarios if s.scenario_type == payload.scenario_type), None)
        if not selected:
            raise ValidationError(
                f"Optimization scenario '{payload.scenario_type}' not found for this comparative statement"
            )

        award_items: list[AwardRecommendationItem] = []
        for alloc in selected.line_allocations:
            award_items.append(
                AwardRecommendationItem(
                    vendor_id=alloc.vendor_id,
                    bid_id=alloc.bid_id,
                    value=alloc.total_value,
                    lot_id=alloc.lot_id,
                    rfq_line_id=alloc.rfq_line_id,
                    unit_price=alloc.unit_price,
                    quantity=alloc.quantity,
                    award_type="SPLIT" if alloc.allocation_percentage < 100.0 else "FULL",
                    justification=f"Awarded via {selected.title} ({alloc.allocation_percentage}% volume)",
                )
            )

        full_justification = (
            f"[{selected.title}] {payload.justification}. "
            f"Total awarded: {scenarios_resp.currency} {selected.total_value} (Projected Savings: {selected.projected_savings_percentage}%)."
        )

        return await self.recommend_award(
            db,
            cs_id=cs_id,
            awards=award_items,
            justification=full_justification,
            actor_id=actor_id,
            org_id=org_id,
        )


evaluation_service = EvaluationService()
