"""
Contract Management Router (SPEC_13 S13-01 to S13-17).

Provides REST endpoints for:
- Contract creation & retrieval
- Award recommendation conversion
- eSign workflow initiation & webhook confirmation (Digio / DocuSign)
- Formal versioned amendments with snapshots
- Rate contract utilization tracking
- Milestone completion tracking
- Template listings
"""
from __future__ import annotations

import math
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_any_permission, require_permission
from app.core.constants import PermissionCode
from app.core.exceptions import NotFoundError
from app.core.responses import APIResponse, PaginationMeta, created_response, success_response
from app.db.session import get_db
from app.modules.contract.models import Contract
from app.modules.contract.schemas import (
    ContractAmendRequest,
    ContractCreateRequest,
    ContractFromAwardRequest,
    ContractListResponse,
    ContractMilestoneResponse,
    ContractMilestoneUpdate,
    ContractResponse,
    ContractStatusUpdateRequest,
    ContractTemplateResponse,
    ContractUtilizationUpdateRequest,
    EsignConfirmRequest,
    EsignInitiateRequest,
    EsignInitiateResponse,
    EsignWebhookPayload,
)
from app.modules.contract.service import contract_service
from app.modules.user.models import User

router = APIRouter(tags=["Contracts"])


@router.get("/health")
async def health():
    return {"status": "ok", "module": "contract"}


# ─── Contract CRUD ─────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=APIResponse[List[ContractListResponse]],
    status_code=status.HTTP_200_OK,
)
async def list_contracts(
    status_filter: Optional[str] = Query(None, alias="status"),
    vendor_id: Optional[UUID] = Query(None),
    category_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.CONTRACT_VIEW_ALL,
            PermissionCode.CONTRACT_VIEW_OWN,
            PermissionCode.CONTRACT_CREATE,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    """List contracts with filters and pagination."""
    items, total = await contract_service.list_contracts(
        db,
        org_id=current_user.org_id,
        status=status_filter,
        vendor_id=vendor_id,
        category_id=category_id,
        search=search,
        page=page,
        page_size=page_size,
    )
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    meta = PaginationMeta(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
    return success_response(data=items, meta=meta)


@router.post(
    "",
    response_model=APIResponse[ContractResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_contract(
    body: ContractCreateRequest,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Create a new contract manually."""
    contract = await contract_service.create_contract(
        db,
        data=body,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return created_response(data=contract)


@router.post(
    "/from-award/{arn_id}",
    response_model=APIResponse[ContractResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_contract_from_award(
    arn_id: UUID,
    body: Optional[ContractFromAwardRequest] = None,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Create contract from an approved award recommendation (S13-04)."""
    req_data = body or ContractFromAwardRequest(award_recommendation_id=arn_id)
    req_data.award_recommendation_id = arn_id

    contract = await contract_service.create_from_award(
        db,
        award_rec_id=arn_id,
        data=req_data,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return created_response(data=contract)


@router.get(
    "/templates",
    response_model=APIResponse[List[ContractTemplateResponse]],
    status_code=status.HTTP_200_OK,
)
async def list_templates(
    contract_type: Optional[str] = Query(None),
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.CONTRACT_VIEW_ALL,
            PermissionCode.CONTRACT_CREATE,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    """List available contract templates."""
    templates = await contract_service.repo.list_templates(db, current_user.org_id, contract_type)
    return success_response(data=templates)


@router.get(
    "/{contract_id}",
    response_model=APIResponse[ContractResponse],
    status_code=status.HTTP_200_OK,
)
async def get_contract_detail(
    contract_id: UUID,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.CONTRACT_VIEW_ALL,
            PermissionCode.CONTRACT_VIEW_OWN,
            PermissionCode.CONTRACT_CREATE,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    """Get single contract details including lines, milestones, amendments, countdown."""
    contract = await contract_service.get_contract(db, contract_id, current_user.org_id)
    return success_response(data=contract)


# ─── eSign Integration ─────────────────────────────────────────────────────────

@router.post(
    "/{contract_id}/esign/initiate",
    response_model=APIResponse[EsignInitiateResponse],
    status_code=status.HTTP_200_OK,
)
async def initiate_esign(
    contract_id: UUID,
    body: Optional[EsignInitiateRequest] = None,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_ACTIVATE)),
    db: AsyncSession = Depends(get_db),
):
    """Initiate eSignature workflow via Digio (primary) or DocuSign (fallback)."""
    provider = body.provider if body else None
    signatories = body.signatories if body else None
    result = await contract_service.initiate_esign(
        db,
        contract_id=contract_id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        provider_override=provider,
        signatories=signatories,
    )
    await db.commit()
    return success_response(data=result)


@router.post(
    "/{contract_id}/esign/confirm",
    response_model=APIResponse[ContractResponse],
    status_code=status.HTTP_200_OK,
)
async def confirm_esign(
    contract_id: UUID,
    body: Optional[EsignConfirmRequest] = None,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_ACTIVATE)),
    db: AsyncSession = Depends(get_db),
):
    """Confirm signature completion and activate contract."""
    doc_path = body.signed_doc_path if body else None
    contract = await contract_service.confirm_esign_complete(
        db,
        contract_id=contract_id,
        esign_doc_path=doc_path,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(data=contract)


@router.post(
    "/esign/callback",
    response_model=APIResponse[dict],
    status_code=status.HTTP_200_OK,
)
async def esign_webhook(
    payload: EsignWebhookPayload,
    db: AsyncSession = Depends(get_db),
):
    """Receive eSign webhook events from Digio / DocuSign."""
    # Webhooks authenticate via signature or token in real deployment
    # Using org_id from database record associated with the request_id
    contract = await contract_service.handle_esign_webhook(db, payload, org_id=payload.metadata.get("org_id") if payload.metadata else None)  # type: ignore
    await db.commit()
    return success_response(data={"received": True, "contract_id": str(contract.id) if contract else None})


# ─── Amendments & Lifecycle ────────────────────────────────────────────────────

@router.post(
    "/{contract_id}/amend",
    response_model=APIResponse[ContractResponse],
    status_code=status.HTTP_200_OK,
)
async def amend_contract(
    contract_id: UUID,
    body: ContractAmendRequest,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_AMEND)),
    db: AsyncSession = Depends(get_db),
):
    """Create a formal versioned amendment with before/after snapshot (S13-07)."""
    contract = await contract_service.amend_contract(
        db,
        contract_id=contract_id,
        data=body,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(data=contract)


@router.put(
    "/{contract_id}/status",
    response_model=APIResponse[ContractResponse],
    status_code=status.HTTP_200_OK,
)
async def update_contract_status(
    contract_id: UUID,
    body: ContractStatusUpdateRequest,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.CONTRACT_ACTIVATE,
            PermissionCode.CONTRACT_TERMINATE,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    """Transition contract status validated against FSM rules."""
    contract = await contract_service.update_status(
        db,
        contract_id=contract_id,
        new_status=body.status,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        notes=body.notes,
    )
    await db.commit()
    return success_response(data=contract)


@router.post(
    "/{contract_id}/milestones/{milestone_id}/complete",
    response_model=APIResponse[ContractMilestoneResponse],
    status_code=status.HTTP_200_OK,
)
async def complete_milestone(
    contract_id: UUID,
    milestone_id: UUID,
    body: Optional[ContractMilestoneUpdate] = None,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_MANAGE_MILESTONES)),
    db: AsyncSession = Depends(get_db),
):
    """Mark a contract milestone as completed."""
    notes = body.completion_notes if body else None
    milestone = await contract_service.complete_milestone(
        db,
        contract_id=contract_id,
        milestone_id=milestone_id,
        notes=notes,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(data=milestone)


@router.post(
    "/{contract_id}/utilization",
    response_model=APIResponse[ContractResponse],
    status_code=status.HTTP_200_OK,
)
async def update_utilization(
    contract_id: UUID,
    body: ContractUtilizationUpdateRequest,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_VIEW_ALL)),
    db: AsyncSession = Depends(get_db),
):
    """Update utilized value for RATE_CONTRACT with optimistic locking check (S13-17)."""
    contract = await contract_service.update_utilization(
        db,
        contract_id=contract_id,
        po_value=float(body.po_value),
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(data=contract)
