"""
Approval Rules Router — 7 endpoints.

Simulate endpoint makes ZERO DB writes (read-only transaction pattern).
Activate/deactivate require PROCUREMENT_ADMIN (rules.create permission).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_permission
from app.core.constants import PermissionCode
from app.core.exceptions import ValidationError
from app.core.responses import APIResponse, PaginationMeta, created_response, success_response
from app.db.session import get_db
from app.modules.approval_rules.models import ApprovalRule
from app.modules.approval_rules.repository import approval_rules_repository
from app.modules.approval_rules.schemas import (
    ApprovalRuleCreateRequest,
    ApprovalRuleResponse,
    ApprovalRuleSimulateRequest,
    ApprovalRuleSimulateResponse,
    ApprovalRuleUpdateRequest,
    ApprovalRuleVersionResponse,
    VALID_ENTITY_TYPES,
)
from app.modules.approval_rules.service import rules_engine
from app.modules.user.models import User

router = APIRouter(tags=["Approval Rules"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_rule(
    data: ApprovalRuleCreateRequest,
    current_user: User = Depends(require_permission(PermissionCode.RULES_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Create an approval rule (PROCUREMENT_ADMIN only)."""
    if data.entity_type not in VALID_ENTITY_TYPES:
        raise ValidationError(
            f"entity_type must be one of: {', '.join(sorted(VALID_ENTITY_TYPES))}"
        )

    effective_from = data.effective_from or datetime.now(timezone.utc)

    rule = ApprovalRule(
        org_id=current_user.org_id,
        entity_type=data.entity_type,
        rule_code=data.rule_code,
        rule_name=data.rule_name,
        priority=data.priority,
        conditions=data.conditions,
        condition_expression=data.condition_expression,
        workflow_template_code=data.workflow_template_code,
        is_catch_all=data.is_catch_all,
        effective_from=effective_from,
        effective_to=data.effective_to,
        created_by=current_user.id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return created_response(ApprovalRuleResponse.model_validate(rule))


@router.put("/{rule_id}")
async def update_rule(
    rule_id: UUID,
    data: ApprovalRuleUpdateRequest,
    current_user: User = Depends(require_permission(PermissionCode.RULES_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    """Update an approval rule (must be inactive to update)."""
    rule = await approval_rules_repository.get(db, rule_id, current_user.org_id)
    if rule.is_active:
        raise ValidationError("Cannot update an active rule. Deactivate it first.")

    if data.rule_name is not None:
        rule.rule_name = data.rule_name
    if data.priority is not None:
        rule.priority = data.priority
    if data.conditions is not None:
        rule.conditions = data.conditions
    if data.condition_expression is not None:
        rule.condition_expression = data.condition_expression
    if data.workflow_template_code is not None:
        rule.workflow_template_code = data.workflow_template_code
    if data.effective_to is not None:
        rule.effective_to = data.effective_to

    await db.commit()
    await db.refresh(rule)
    return success_response(ApprovalRuleResponse.model_validate(rule))


@router.post("/{rule_id}/activate")
async def activate_rule(
    rule_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.RULES_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Activate a rule (PROCUREMENT_ADMIN only). Checks priority conflicts first."""
    rule = await rules_engine.activate_rule(db, rule_id, current_user.id, current_user.org_id)
    await db.commit()
    await db.refresh(rule)
    return success_response(ApprovalRuleResponse.model_validate(rule))


@router.post("/{rule_id}/deactivate")
async def deactivate_rule(
    rule_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.RULES_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a rule. Does NOT create a version snapshot."""
    rule = await rules_engine.deactivate_rule(db, rule_id, current_user.id, current_user.org_id)
    await db.commit()
    await db.refresh(rule)
    return success_response(ApprovalRuleResponse.model_validate(rule))


@router.get("")
async def list_rules(
    entity_type: Optional[str] = Query(None),
    current_user: User = Depends(require_permission(PermissionCode.RULES_VIEW)),
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    page_size: int = 25,
):
    """List approval rules by entity_type (optional filter)."""
    if entity_type:
        if entity_type not in VALID_ENTITY_TYPES:
            raise ValidationError(
                f"entity_type must be one of: {', '.join(sorted(VALID_ENTITY_TYPES))}"
            )
        skip = (page - 1) * page_size
        rules = await approval_rules_repository.list_by_entity_type(
            db, entity_type, current_user.org_id, skip=skip, limit=page_size
        )
    else:
        rules = await approval_rules_repository.get_multi(
            db, current_user.org_id, skip=(page - 1) * page_size, limit=page_size
        )
    return success_response(
        [ApprovalRuleResponse.model_validate(r) for r in rules],
        meta=PaginationMeta(total=len(rules), page=page, page_size=page_size),
    )


@router.get("/{rule_id}")
async def get_rule(
    rule_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.RULES_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """Get single approval rule detail."""
    rule = await approval_rules_repository.get(db, rule_id, current_user.org_id)
    return success_response(ApprovalRuleResponse.model_validate(rule))


@router.get("/{rule_id}/versions")
async def get_rule_versions(
    rule_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.RULES_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """Get version history for an approval rule."""
    versions = await approval_rules_repository.get_versions(db, rule_id, current_user.org_id)
    return success_response(
        [ApprovalRuleVersionResponse.model_validate(v) for v in versions],
        meta=PaginationMeta(total=len(versions), page=1, page_size=len(versions) or 20),
    )


@router.post("/simulate")
async def simulate_rule_matching(
    data: ApprovalRuleSimulateRequest,
    current_user: User = Depends(require_permission(PermissionCode.RULES_TEST)),
    db: AsyncSession = Depends(get_db),
):
    """
    Dry-run rule matching — ZERO DB writes.
    Returns which rule would match and the resulting workflow template.
    """
    if data.entity_type not in VALID_ENTITY_TYPES:
        raise ValidationError(
            f"entity_type must be one of: {', '.join(sorted(VALID_ENTITY_TYPES))}"
        )

    now = datetime.now(timezone.utc)
    active_rules = await approval_rules_repository.get_active_rules(
        db, data.entity_type, current_user.org_id, now
    )
    evaluated_count = len(active_rules)

    matched_rule = await rules_engine.find_matching_rule(
        db, data.entity_type, data.entity_context, current_user.org_id
    )

    if matched_rule is None:
        return success_response(
            ApprovalRuleSimulateResponse(
                matched_rule=None,
                workflow_template_code=None,
                match_type="NONE",
                evaluated_rules_count=evaluated_count,
            )
        )

    match_type = "CATCH_ALL" if matched_rule.is_catch_all else "SPECIFIC"
    return success_response(
        ApprovalRuleSimulateResponse(
            matched_rule=ApprovalRuleResponse.model_validate(matched_rule),
            workflow_template_code=matched_rule.workflow_template_code,
            match_type=match_type,
            evaluated_rules_count=evaluated_count,
        )
    )


@router.post("/resolve-chain")
async def resolve_approval_chain(
    data: ApprovalRuleSimulateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resolve approval chain dynamic matrix according to SPEC_06."""
    chain = await rules_engine.resolve_chain(
        db, data.entity_type, data.entity_context, current_user.org_id
    )
    return success_response(chain)
