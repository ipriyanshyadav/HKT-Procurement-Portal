"""Onboarding API Router — SPEC_27-B.

Endpoints for 8-step guided buyer onboarding wizard.
Layer: router
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import APIResponse, success_response
from app.db.session import get_db
from app.modules.admin.onboarding_service import onboarding_service
from app.modules.admin.schemas import (
    OnboardingChecklistResponse,
    OnboardingSessionResponse,
    OnboardingStepUpdateRequest,
)
from app.modules.user.models import User

router = APIRouter(prefix="/onboarding", tags=["Onboarding Wizard"])


@router.get("/session", response_model=APIResponse[OnboardingSessionResponse])
async def get_or_create_onboarding_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve or initialize the active organization onboarding session."""
    session = await onboarding_service.get_or_create_session(
        db, current_user.org_id, current_user.id
    )
    return success_response(session)


@router.put("/session/step", response_model=APIResponse[OnboardingSessionResponse])
async def save_onboarding_step(
    payload: OnboardingStepUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Persist partial step data and advance current step pointer."""
    session = await onboarding_service.save_step(
        db,
        current_user.org_id,
        current_user.id,
        payload.step,
        payload.data,
        payload.mark_step_completed,
    )
    await db.commit()
    return success_response(session)


@router.post("/session/complete", response_model=APIResponse[OnboardingSessionResponse])
async def complete_onboarding_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark onboarding session as completed and seal go-live readiness."""
    session = await onboarding_service.complete_onboarding(
        db, current_user.org_id, current_user.id
    )
    await db.commit()
    return success_response(session)


@router.get("/checklist", response_model=APIResponse[OnboardingChecklistResponse])
async def get_onboarding_checklist(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the 8-step go-live verification checklist and completion percentages."""
    checklist = await onboarding_service.get_checklist(
        db, current_user.org_id, current_user.id
    )
    return success_response(checklist)
