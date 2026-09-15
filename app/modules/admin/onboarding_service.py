"""Onboarding Service — SPEC_27-B.

Manages 8-step guided buyer onboarding sessions with checkpoint persistence.
Layer: service
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.exceptions import AppException
from app.modules.admin.models import OnboardingSession
from app.modules.admin.schemas import OnboardingChecklistItem, OnboardingChecklistResponse
from app.modules.audit.service import audit_service


class OnboardingService:
    CHECKLIST_STEPS = [
        ("org_basics", "Organization Basics", "Legal name, PAN, GSTIN, currency & logo configuration"),
        ("structure", "Company Structure", "Creation of Legal Entity and at least one Business Unit"),
        ("erp_integration", "ERP & Integration Config", "ERP provider, eSign provider and endpoint settings"),
        ("master_data", "Master Data Seeding", "Category hierarchy, UOMs, payment terms and delivery locations"),
        ("users_roles", "User Roles & Permissions", "Invitation of key procurement and finance administrators"),
        ("vendor_qualification", "Vendor Onboarding Setup", "Vendor invite lists and required compliance documents"),
        ("approval_rules", "Approval Rules Configuration", "PR and PO approval matrices and threshold rules"),
        ("go_live", "Go-Live Checklist & Verification", "Creation and test submission of sample procurement cycle"),
    ]

    async def get_or_create_session(
        self, db: AsyncSession, org_id: UUID, user_id: UUID
    ) -> OnboardingSession:
        stmt = (
            select(OnboardingSession)
            .where(
                OnboardingSession.org_id == org_id,
                OnboardingSession.deleted_at.is_(None),
            )
            .order_by(OnboardingSession.created_at.desc())
        )
        result = await db.execute(stmt)
        session = result.scalars().first()
        if not session:
            session = OnboardingSession(
                org_id=org_id,
                initiated_by=user_id,
                current_step=1,
                completed_steps=[],
                step_data={},
                status="IN_PROGRESS",
            )
            db.add(session)
            await db.flush()

            await audit_service.log(
                db=db,
                entity_type="ORGANIZATION",
                entity_id=org_id,
                action=AuditAction.ONBOARDING_SESSION_STARTED,
                actor_id=user_id,
                org_id=org_id,
                new_values={"session_id": str(session.id)},
            )

        return session

    async def save_step(
        self,
        db: AsyncSession,
        org_id: UUID,
        user_id: UUID,
        step: int,
        data: dict[str, Any],
        mark_completed: bool = True,
    ) -> OnboardingSession:
        session = await self.get_or_create_session(db, org_id, user_id)
        if session.status == "COMPLETED":
            raise AppException(message="Onboarding session is already completed", code="ONBOARDING_ALREADY_COMPLETED", status_code=400)

        step_data = dict(session.step_data or {})
        step_data[f"step_{step}"] = data
        session.step_data = step_data

        completed = list(session.completed_steps or [])
        if mark_completed and step not in completed:
            completed.append(step)
            completed.sort()
            session.completed_steps = completed

        if step >= session.current_step and step < 8:
            session.current_step = step + 1

        await db.flush()

        await audit_service.log(
            db=db,
            entity_type="ORGANIZATION",
            entity_id=org_id,
            action=AuditAction.ONBOARDING_STEP_SAVED,
            actor_id=user_id,
            org_id=org_id,
            new_values={"step": step, "completed_steps": session.completed_steps},
        )

        return session

    async def complete_onboarding(
        self, db: AsyncSession, org_id: UUID, user_id: UUID
    ) -> OnboardingSession:
        session = await self.get_or_create_session(db, org_id, user_id)
        session.status = "COMPLETED"
        session.completed_at = datetime.now(UTC)
        if 8 not in (session.completed_steps or []):
            completed = list(session.completed_steps or [])
            completed.append(8)
            session.completed_steps = completed

        await db.flush()

        await audit_service.log(
            db=db,
            entity_type="ORGANIZATION",
            entity_id=org_id,
            action=AuditAction.ONBOARDING_COMPLETED,
            actor_id=user_id,
            org_id=org_id,
            new_values={"completed_at": session.completed_at.isoformat()},
        )

        return session

    async def get_checklist(
        self, db: AsyncSession, org_id: UUID, user_id: UUID
    ) -> OnboardingChecklistResponse:
        session = await self.get_or_create_session(db, org_id, user_id)
        completed = set(session.completed_steps or [])

        items = []
        for idx, (key, title, desc) in enumerate(self.CHECKLIST_STEPS, start=1):
            items.append(
                OnboardingChecklistItem(
                    key=key,
                    title=f"Step {idx}: {title}",
                    description=desc,
                    is_completed=idx in completed,
                )
            )

        completed_count = len(completed)
        percent = (completed_count / len(self.CHECKLIST_STEPS)) * 100.0

        return OnboardingChecklistResponse(
            total_steps=len(self.CHECKLIST_STEPS),
            completed_count=completed_count,
            percent_complete=round(percent, 1),
            items=items,
            is_ready_for_golive=completed_count >= 7,
        )


onboarding_service = OnboardingService()
