from __future__ import annotations
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_permission, require_any_permission
from app.core.constants import PermissionCode
from app.core.exceptions import NotFoundError
from app.core.responses import APIResponse, created_response, success_response
from app.db.session import get_db
from app.modules.user.models import User
from app.modules.evaluation.service import evaluation_service
from app.modules.evaluation.repository import evaluation_repository, negotiation_repository, award_repository
from app.modules.evaluation.schemas import (
    CSGenerateRequest,
    ComparativeStatementResponse,
    CSVersionSummaryResponse,
    ShortlistVendorsRequest,
    ShortlistResponse,
    NegotiationStartRequest,
    NegotiatedPriceSubmitRequest,
    NegotiationResponse,
    AwardRecommendRequest,
    AwardRecommendationResponse,
    AwardApprovalRequest,
    RegretLettersResponse,
)

router = APIRouter(tags=["Evaluation & Comparative Statement"])


@router.get("/health")
async def health():
    return {"status": "ok", "module": "evaluation"}


# ─── CS Generation & Retrieval ────────────────────────────────────────────────

@router.post(
    "/rfq/{rfq_id}/generate-cs",
    response_model=APIResponse[ComparativeStatementResponse],
    status_code=status.HTTP_201_CREATED,
)
async def generate_comparative_statement(
    rfq_id: UUID,
    body: Optional[CSGenerateRequest] = None,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.EVAL_SUBMIT_RECOMMENDATION,
            PermissionCode.EVAL_SCORE,
            PermissionCode.RFQ_CREATE,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    cocr = body.cost_of_capital_rate if body else None
    meth = body.evaluation_methodology if body else None
    cs = await evaluation_service.generate_comparative_statement(
        db,
        rfq_id=rfq_id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        cost_of_capital_rate=cocr,
        evaluation_methodology=meth,
    )
    await db.commit()
    await db.refresh(cs)
    # Ensure relations are loaded
    full_cs = await evaluation_repository.get_cs(db, cs.id, current_user.org_id)
    return created_response(ComparativeStatementResponse.model_validate(full_cs or cs))


@router.get(
    "/rfq/{rfq_id}/cs",
    response_model=APIResponse[ComparativeStatementResponse],
)
async def get_latest_cs_for_rfq(
    rfq_id: UUID,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.EVAL_VIEW_COMPARATIVE,
            PermissionCode.EVAL_VIEW,
            PermissionCode.RFQ_VIEW_ALL,
            PermissionCode.RFQ_VIEW_OWN,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    cs = await evaluation_repository.get_latest_cs_by_rfq(db, rfq_id, current_user.org_id)
    if not cs:
        raise NotFoundError(f"No Comparative Statement found for RFQ {rfq_id}")
    return success_response(ComparativeStatementResponse.model_validate(cs))


@router.get(
    "/rfq/{rfq_id}/cs-versions",
    response_model=APIResponse[List[CSVersionSummaryResponse]],
)
async def list_cs_versions(
    rfq_id: UUID,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.EVAL_VIEW_COMPARATIVE,
            PermissionCode.EVAL_VIEW,
            PermissionCode.RFQ_VIEW_ALL,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    versions = await evaluation_repository.list_cs_versions(db, rfq_id, current_user.org_id)
    return success_response([CSVersionSummaryResponse.model_validate(v) for v in versions])


@router.get(
    "/{cs_id}",
    response_model=APIResponse[ComparativeStatementResponse],
)
async def get_cs_by_id(
    cs_id: UUID,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.EVAL_VIEW_COMPARATIVE,
            PermissionCode.EVAL_VIEW,
            PermissionCode.RFQ_VIEW_ALL,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    cs = await evaluation_repository.get_cs(db, cs_id, current_user.org_id)
    if not cs:
        raise NotFoundError(f"Comparative Statement {cs_id} not found")
    return success_response(ComparativeStatementResponse.model_validate(cs))


# ─── Shortlisting ─────────────────────────────────────────────────────────────

@router.post(
    "/{cs_id}/shortlist",
    response_model=APIResponse[ShortlistResponse],
)
async def shortlist_vendors(
    cs_id: UUID,
    body: ShortlistVendorsRequest,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.EVAL_SUBMIT_RECOMMENDATION,
            PermissionCode.EVAL_SCORE,
            PermissionCode.RFQ_CREATE,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    vendor_ids = await evaluation_service.shortlist_vendors(
        db,
        cs_id=cs_id,
        vendor_ids=body.vendor_ids,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        criteria=body.criteria,
    )
    await db.commit()
    return success_response(
        ShortlistResponse(
            cs_id=cs_id,
            shortlisted_vendor_ids=vendor_ids,
            message=f"Successfully shortlisted {len(vendor_ids)} vendor(s)",
        )
    )


# ─── Negotiations ─────────────────────────────────────────────────────────────

@router.post(
    "/{cs_id}/negotiations",
    response_model=APIResponse[List[NegotiationResponse]],
    status_code=status.HTTP_201_CREATED,
)
async def start_negotiation(
    cs_id: UUID,
    body: NegotiationStartRequest,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.EVAL_SUBMIT_RECOMMENDATION,
            PermissionCode.EVAL_SCORE,
            PermissionCode.RFQ_CREATE,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    negs = await evaluation_service.start_negotiation(
        db,
        cs_id=cs_id,
        vendor_ids=body.vendor_ids,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        notes=body.notes,
    )
    await db.commit()
    for n in negs:
        await db.refresh(n)
    return created_response([NegotiationResponse.model_validate(n) for n in negs])


@router.get(
    "/{cs_id}/negotiations",
    response_model=APIResponse[List[NegotiationResponse]],
)
async def get_negotiations_for_cs(
    cs_id: UUID,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.EVAL_VIEW_COMPARATIVE,
            PermissionCode.EVAL_VIEW,
            PermissionCode.RFQ_VIEW_ALL,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    negs = await negotiation_repository.list_by_cs(db, cs_id, current_user.org_id)
    return success_response([NegotiationResponse.model_validate(n) for n in negs])


@router.post(
    "/negotiations/{negotiation_id}/submit-price",
    response_model=APIResponse[NegotiationResponse],
)
async def submit_negotiated_price(
    negotiation_id: UUID,
    body: NegotiatedPriceSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    neg = await evaluation_service.submit_negotiated_price(
        db,
        negotiation_id=negotiation_id,
        new_price=body.negotiated_price,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        notes=body.notes,
    )
    await db.commit()
    await db.refresh(neg)
    return success_response(NegotiationResponse.model_validate(neg))


# ─── Award Recommendations ────────────────────────────────────────────────────

@router.post(
    "/{cs_id}/recommend-award",
    response_model=APIResponse[AwardRecommendationResponse],
    status_code=status.HTTP_201_CREATED,
)
async def recommend_award(
    cs_id: UUID,
    body: AwardRecommendRequest,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.AWARD_RECOMMEND,
            PermissionCode.EVAL_SUBMIT_RECOMMENDATION,
            PermissionCode.RFQ_CREATE,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    rec = await evaluation_service.recommend_award(
        db,
        cs_id=cs_id,
        awards=body.awards,
        justification=body.justification,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    full_rec = await award_repository.get(db, rec.id, current_user.org_id)
    return created_response(AwardRecommendationResponse.model_validate(full_rec or rec))


@router.get(
    "/{cs_id}/award",
    response_model=APIResponse[AwardRecommendationResponse],
)
async def get_award_recommendation(
    cs_id: UUID,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.AWARD_RECOMMEND,
            PermissionCode.AWARD_APPROVE,
            PermissionCode.EVAL_VIEW_COMPARATIVE,
            PermissionCode.EVAL_VIEW,
            PermissionCode.RFQ_VIEW_ALL,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    rec = await award_repository.get_by_cs(db, cs_id, current_user.org_id)
    if not rec:
        raise NotFoundError(f"No award recommendation found for CS {cs_id}")
    return success_response(AwardRecommendationResponse.model_validate(rec))


@router.post(
    "/awards/{arn_id}/approve",
    response_model=APIResponse[AwardRecommendationResponse],
)
async def approve_award(
    arn_id: UUID,
    body: Optional[AwardApprovalRequest] = None,
    current_user: User = Depends(require_permission(PermissionCode.AWARD_APPROVE)),
    db: AsyncSession = Depends(get_db),
):
    comments = body.comments if body else None
    rec = await evaluation_service.approve_award(
        db,
        arn_id=arn_id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        comments=comments,
    )
    await db.commit()
    full_rec = await award_repository.get(db, rec.id, current_user.org_id)
    return success_response(AwardRecommendationResponse.model_validate(full_rec or rec))


# ─── Regret Letters ───────────────────────────────────────────────────────────

@router.post(
    "/{cs_id}/send-regret-letters",
    response_model=APIResponse[RegretLettersResponse],
)
async def send_regret_letters(
    cs_id: UUID,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.AWARD_RECOMMEND,
            PermissionCode.AWARD_APPROVE,
            PermissionCode.RFQ_CREATE,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    non_awarded, count = await evaluation_service.send_regret_letters(
        db,
        cs_id=cs_id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(
        RegretLettersResponse(
            sent_to_vendors=non_awarded,
            count=count,
            message=f"Dispatched regret letter notifications to {count} vendor(s)",
        )
    )
