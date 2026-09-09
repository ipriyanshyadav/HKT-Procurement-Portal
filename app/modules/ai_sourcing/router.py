from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.core.responses import success_response
from app.db.session import get_db
from app.modules.ai_sourcing.repository import (
    ai_rfq_draft_repository,
    negotiation_session_repository,
    supplier_radar_score_repository,
)
from app.modules.ai_sourcing.schemas import (
    CalculateRadarScoresRequest,
    ConvertDraftToRfqRequest,
    GenerateSmartRfqRequest,
    StartNegotiationSessionRequest,
    SubmitSupplierCounterRequest,
)
from app.modules.ai_sourcing.service import ai_sourcing_service
from app.modules.user.models import User

router = APIRouter(tags=["AI Sourcing Copilot"])


@router.get("/health")
async def health():
    return {"status": "ok", "module": "ai_sourcing"}


# 1. Smart RFQ Generator
@router.post("/smart-rfq/generate", status_code=status.HTTP_201_CREATED)
async def generate_smart_rfq(
    payload: GenerateSmartRfqRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    draft = await ai_sourcing_service.generate_smart_rfq(db, current_user.org_id, payload)
    return success_response(data=draft)


@router.get("/smart-rfq/drafts")
async def list_smart_rfq_drafts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    drafts = await ai_rfq_draft_repository.list_by_org(db, current_user.org_id)
    return success_response(data=drafts)


@router.post("/smart-rfq/convert")
async def convert_draft_to_rfq(
    payload: ConvertDraftToRfqRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await ai_sourcing_service.convert_draft_to_rfq(db, current_user.org_id, current_user.id, payload)
    return success_response(data=result)


# 2. Autonomous Tail-Spend Negotiation Bot
@router.post("/negotiation/sessions", status_code=status.HTTP_201_CREATED)
async def start_negotiation_session(
    payload: StartNegotiationSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await ai_sourcing_service.start_negotiation_session(db, current_user.org_id, payload)
    return success_response(data=session)


@router.get("/negotiation/sessions")
async def list_negotiation_sessions(
    vendor_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sessions = await negotiation_session_repository.list_by_org(db, current_user.org_id, vendor_id=vendor_id)
    res_list = [await ai_sourcing_service._build_session_response(db, s) for s in sessions]
    return success_response(data=res_list)


@router.get("/negotiation/sessions/{session_id}")
async def get_negotiation_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await negotiation_session_repository.get_by_id(db, session_id, current_user.org_id)
    if not session:
        raise NotFoundError("NegotiationSession", str(session_id))
    resp = await ai_sourcing_service._build_session_response(db, session)
    return success_response(data=resp)


@router.post("/negotiation/counter")
async def submit_supplier_counter(
    payload: SubmitSupplierCounterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await ai_sourcing_service.submit_supplier_counter(db, current_user.org_id, payload)
    return success_response(data=session)


# 3. Supplier Recommendation Radar
@router.post("/radar/calculate")
async def calculate_supplier_radar_scores(
    payload: CalculateRadarScoresRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scores = await ai_sourcing_service.calculate_supplier_radar_scores(db, current_user.org_id, payload)
    return success_response(data=scores)


@router.get("/radar/scores")
async def list_supplier_radar_scores(
    category_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scores = await supplier_radar_score_repository.list_by_org(db, current_user.org_id, category_id=category_id)
    return success_response(data=scores)
