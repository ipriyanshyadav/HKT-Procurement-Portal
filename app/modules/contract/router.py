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
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_any_permission, require_permission
from app.core.constants import PermissionCode
from app.core.exceptions import ForbiddenError
from app.core.responses import APIResponse, PaginationMeta, created_response, success_response
from app.db.session import get_db
from app.modules.contract.schemas import (
    ContractAmendRequest,
    ContractApproveRequest,
    ContractClauseCreate,
    ContractClauseInstanceCreate,
    ContractClauseInstanceResponse,
    ContractClauseResponse,
    ContractCreateRequest,
    ContractEsignSessionResponse,
    ContractFromAwardRequest,
    ContractLineCreate,
    ContractLineResponse,
    ContractListResponse,
    ContractMilestoneCreate,
    ContractMilestoneResponse,
    ContractMilestoneUpdate,
    ContractRedlineCreate,
    ContractRedlineResponse,
    ContractRedlineReviewRequest,
    ContractResponse,
    ContractReturnRequest,
    ContractReviewSubmitRequest,
    ContractStatusUpdateRequest,
    ContractTemplateResponse,
    ContractTerminateRequest,
    ContractUtilizationUpdateRequest,
    EsignConfirmRequest,
    EsignInitiateRequest,
    EsignInitiateResponse,
    EsignWebhookPayload,
    InitiateSigningCeremonyRequest,
    SubmitDigitalSignatureRequest,
)
from app.modules.contract.service import contract_service
from app.modules.user.models import User

router = APIRouter(tags=["Contract"])


@router.get("/health")
async def health():
    return {"status": "ok", "module": "contract"}


# ─── Contract CRUD ─────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=APIResponse[list[ContractListResponse]],
    status_code=status.HTTP_200_OK,
)
async def list_contracts(
    status_filter: str | None = Query(None, alias="status"),
    vendor_id: UUID | None = Query(None),
    category_id: UUID | None = Query(None),
    search: str | None = Query(None),
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
    effective_vendor_id = vendor_id
    if current_user.vendor_id:
        effective_vendor_id = current_user.vendor_id

    items, total = await contract_service.list_contracts(
        db,
        org_id=current_user.org_id,
        status=status_filter,
        vendor_id=effective_vendor_id,
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
    body: ContractFromAwardRequest | None = None,
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
    response_model=APIResponse[list[ContractTemplateResponse]],
    status_code=status.HTTP_200_OK,
)
async def list_templates(
    contract_type: str | None = Query(None),
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
    return success_response(
        data=templates,
        meta=PaginationMeta(total=len(templates), page=1, page_size=len(templates) or 20),
    )


@router.get(
    "/clauses/library",
    response_model=APIResponse[list[ContractClauseResponse]],
    status_code=status.HTTP_200_OK,
)
async def get_clause_library(
    category: str | None = Query(None),
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.CONTRACT_VIEW_ALL,
            PermissionCode.CONTRACT_VIEW_OWN,
            PermissionCode.CONTRACT_CREATE,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve standard legal clause library for contract redlining (SPEC_13)."""
    clauses = await contract_service.get_clause_library(db, current_user.org_id, category)
    return success_response(
        data=clauses,
        meta=PaginationMeta(total=len(clauses), page=1, page_size=len(clauses) or 50),
    )


@router.post(
    "/clauses/library",
    response_model=APIResponse[ContractClauseResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_library_clause(
    body: ContractClauseCreate,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Add a new standard clause to the organization clause library."""
    clause = await contract_service.create_clause(db, current_user.org_id, body)
    return created_response(data=clause)


@router.post(
    "/redlines/{redline_id}/review",
    response_model=APIResponse[ContractRedlineResponse],
    status_code=status.HTTP_200_OK,
)
async def review_contract_redline(
    redline_id: UUID,
    body: ContractRedlineReviewRequest,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_AMEND)),
    db: AsyncSession = Depends(get_db),
):
    """Accept, reject, or propose alternative on a contract clause redline suggestion."""
    redline = await contract_service.review_redline(
        db, redline_id, current_user.org_id, current_user.id, body
    )
    return success_response(data=redline)


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
    if current_user.vendor_id and contract.vendor_id != current_user.vendor_id:
        raise ForbiddenError("Access denied: You do not have permission to view this contract")
    return success_response(data=contract)



# ─── eSign Integration ─────────────────────────────────────────────────────────

@router.post(
    "/{contract_id}/esign/initiate",
    response_model=APIResponse[EsignInitiateResponse],
    status_code=status.HTTP_200_OK,
)
async def initiate_esign(
    contract_id: UUID,
    body: EsignInitiateRequest | None = None,
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
    body: EsignConfirmRequest | None = None,
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
    "/{contract_id}/submit-review",
    response_model=APIResponse[ContractResponse],
    status_code=status.HTTP_200_OK,
)
async def submit_contract_for_review(
    contract_id: UUID,
    body: ContractReviewSubmitRequest | None = None,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.CONTRACT_CREATE,
            PermissionCode.CONTRACT_VIEW_ALL,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    """Submit contract for managerial and legal review (DRAFT -> PENDING_REVIEW)."""
    notes = body.comment if body else None
    contract = await contract_service.update_status(
        db,
        contract_id=contract_id,
        new_status="PENDING_REVIEW",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        notes=notes,
    )
    await db.commit()
    return success_response(data=contract)


@router.post(
    "/{contract_id}/approve",
    response_model=APIResponse[ContractResponse],
    status_code=status.HTTP_200_OK,
)
async def approve_contract(
    contract_id: UUID,
    body: ContractApproveRequest | None = None,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_ACTIVATE)),
    db: AsyncSession = Depends(get_db),
):
    """Approve contract (PENDING_REVIEW -> APPROVED)."""
    notes = body.comment if body else None
    contract = await contract_service.update_status(
        db,
        contract_id=contract_id,
        new_status="APPROVED",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        notes=notes,
    )
    await db.commit()
    return success_response(data=contract)


@router.post(
    "/{contract_id}/return",
    response_model=APIResponse[ContractResponse],
    status_code=status.HTTP_200_OK,
)
async def return_contract(
    contract_id: UUID,
    body: ContractReturnRequest,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_ACTIVATE)),
    db: AsyncSession = Depends(get_db),
):
    """Return contract to author for revisions (PENDING_REVIEW -> RETURNED)."""
    contract = await contract_service.update_status(
        db,
        contract_id=contract_id,
        new_status="RETURNED",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        notes=body.reason,
    )
    await db.commit()
    return success_response(data=contract)


@router.post(
    "/{contract_id}/activate",
    response_model=APIResponse[ContractResponse],
    status_code=status.HTTP_200_OK,
)
async def activate_contract(
    contract_id: UUID,
    body: ContractStatusUpdateRequest | None = None,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_ACTIVATE)),
    db: AsyncSession = Depends(get_db),
):
    """Directly activate an approved/executed contract (APPROVED -> ACTIVE)."""
    notes = body.notes if body else None
    contract = await contract_service.update_status(
        db,
        contract_id=contract_id,
        new_status="ACTIVE",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        notes=notes,
    )
    await db.commit()
    return success_response(data=contract)


@router.post(
    "/{contract_id}/terminate",
    response_model=APIResponse[ContractResponse],
    status_code=status.HTTP_200_OK,
)
async def terminate_contract(
    contract_id: UUID,
    body: ContractTerminateRequest,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_TERMINATE)),
    db: AsyncSession = Depends(get_db),
):
    """Terminate an active contract (ACTIVE -> TERMINATED)."""
    contract = await contract_service.update_status(
        db,
        contract_id=contract_id,
        new_status="TERMINATED",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        notes=body.reason,
    )
    await db.commit()
    return success_response(data=contract)


@router.post(
    "/{contract_id}/initiate-esign",
    response_model=APIResponse[EsignInitiateResponse],
    status_code=status.HTTP_200_OK,
)
async def initiate_esign_alias(
    contract_id: UUID,
    body: EsignInitiateRequest | None = None,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_ACTIVATE)),
    db: AsyncSession = Depends(get_db),
):
    """Alias for /{contract_id}/esign/initiate."""
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
    "/{contract_id}/confirm-esign",
    response_model=APIResponse[ContractResponse],
    status_code=status.HTTP_200_OK,
)
async def confirm_esign_alias(
    contract_id: UUID,
    body: EsignConfirmRequest | None = None,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_ACTIVATE)),
    db: AsyncSession = Depends(get_db),
):
    """Alias for /{contract_id}/esign/confirm."""
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
    "/{contract_id}/milestones",
    response_model=APIResponse[ContractMilestoneResponse],
    status_code=status.HTTP_201_CREATED,
)
async def add_contract_milestone(
    contract_id: UUID,
    body: ContractMilestoneCreate,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.CONTRACT_MANAGE_MILESTONES,
            PermissionCode.CONTRACT_CREATE,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    """Add a new milestone or deliverable obligation to the contract."""
    milestone = await contract_service.add_milestone(
        db,
        contract_id=contract_id,
        data=body,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return created_response(data=milestone)


@router.post(
    "/{contract_id}/milestones/{milestone_id}/complete",
    response_model=APIResponse[ContractMilestoneResponse],
    status_code=status.HTTP_200_OK,
)
async def complete_milestone(
    contract_id: UUID,
    milestone_id: UUID,
    body: ContractMilestoneUpdate | None = None,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.CONTRACT_MANAGE_MILESTONES,
            PermissionCode.CONTRACT_VIEW_OWN,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    """Mark a contract milestone as completed (supports both buyer and supplier)."""
    notes = body.completion_notes if body else None
    milestone = await contract_service.complete_milestone_by_id(
        db,
        milestone_id=milestone_id,
        notes=notes,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        vendor_id=current_user.vendor_id,
    )
    await db.commit()
    return success_response(data=milestone)


@router.post(
    "/milestones/{milestone_id}/complete",
    response_model=APIResponse[ContractMilestoneResponse],
    status_code=status.HTTP_200_OK,
)
async def complete_milestone_direct(
    milestone_id: UUID,
    body: ContractMilestoneUpdate | None = None,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.CONTRACT_MANAGE_MILESTONES,
            PermissionCode.CONTRACT_VIEW_OWN,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    """Complete milestone directly by milestone UUID."""
    notes = body.completion_notes if body else None
    milestone = await contract_service.complete_milestone_by_id(
        db,
        milestone_id=milestone_id,
        notes=notes,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        vendor_id=current_user.vendor_id,
    )
    await db.commit()
    return success_response(data=milestone)


@router.post(
    "/{contract_id}/lines",
    response_model=APIResponse[ContractLineResponse],
    status_code=status.HTTP_201_CREATED,
)
async def add_contract_line(
    contract_id: UUID,
    body: ContractLineCreate,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Add a rate card catalog line item to the contract."""
    line = await contract_service.add_line(
        db,
        contract_id=contract_id,
        data=body,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return created_response(data=line)


@router.delete(
    "/{contract_id}/lines/{line_id}",
    response_model=APIResponse[dict],
    status_code=status.HTTP_200_OK,
)
async def delete_contract_line(
    contract_id: UUID,
    line_id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Delete a rate card line item from a draft contract."""
    await contract_service.delete_line(
        db,
        contract_id=contract_id,
        line_id=line_id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(data={"deleted": True, "line_id": str(line_id)})


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


# ─── Collaborative Redlining & Clause Instances ──────────────────────────────

@router.get(
    "/{contract_id}/clauses",
    response_model=APIResponse[list[ContractClauseInstanceResponse]],
    status_code=status.HTTP_200_OK,
)
async def get_contract_clauses(
    contract_id: UUID,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.CONTRACT_VIEW_ALL,
            PermissionCode.CONTRACT_VIEW_OWN,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    """List instantiated legal clauses for a specific contract."""
    clauses = await contract_service.get_contract_clause_instances(
        db, contract_id=contract_id, org_id=current_user.org_id
    )
    return success_response(
        data=clauses,
        meta=PaginationMeta(total=len(clauses), page=1, page_size=len(clauses) or 50),
    )


@router.post(
    "/{contract_id}/clauses",
    response_model=APIResponse[ContractClauseInstanceResponse],
    status_code=status.HTTP_201_CREATED,
)
async def add_contract_clause(
    contract_id: UUID,
    body: ContractClauseInstanceCreate,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Instantiate and attach a clause to a contract."""
    inst = await contract_service.instantiate_clause(
        db, contract_id=contract_id, org_id=current_user.org_id, payload=body
    )
    return created_response(data=inst)


@router.get(
    "/{contract_id}/redlines",
    response_model=APIResponse[list[ContractRedlineResponse]],
    status_code=status.HTTP_200_OK,
)
async def get_contract_redlines(
    contract_id: UUID,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.CONTRACT_VIEW_ALL,
            PermissionCode.CONTRACT_VIEW_OWN,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all collaborative redline edits and track-changes proposals for a contract."""
    redlines = await contract_service.get_contract_redlines(
        db, contract_id=contract_id, org_id=current_user.org_id
    )
    return success_response(
        data=redlines,
        meta=PaginationMeta(total=len(redlines), page=1, page_size=len(redlines) or 50),
    )


@router.post(
    "/{contract_id}/redlines",
    response_model=APIResponse[ContractRedlineResponse],
    status_code=status.HTTP_201_CREATED,
)
async def submit_contract_redline(
    contract_id: UUID,
    body: ContractRedlineCreate,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.CONTRACT_VIEW_ALL,
            PermissionCode.CONTRACT_VIEW_OWN,
            PermissionCode.CONTRACT_AMEND,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    """Propose a clause redline diff with change rationale."""
    redline = await contract_service.submit_redline(
        db,
        contract_id=contract_id,
        org_id=current_user.org_id,
        actor_id=current_user.id,
        payload=body,
    )
    return created_response(data=redline)


# ─── Multi-Party Signing Ceremony ─────────────────────────────────────────────

@router.post(
    "/{contract_id}/ceremony/initiate",
    response_model=APIResponse[ContractEsignSessionResponse],
    status_code=status.HTTP_201_CREATED,
)
async def initiate_signing_ceremony(
    contract_id: UUID,
    body: InitiateSigningCeremonyRequest | None = None,
    current_user: User = Depends(require_permission(PermissionCode.CONTRACT_ACTIVATE)),
    db: AsyncSession = Depends(get_db),
):
    """Initiate cryptographic multi-party electronic signing ceremony with SHA-256 integrity hash."""
    req_body = body or InitiateSigningCeremonyRequest()
    session = await contract_service.initiate_signing_ceremony(
        db,
        contract_id=contract_id,
        org_id=current_user.org_id,
        actor_id=current_user.id,
        payload=req_body,
    )
    return created_response(data=session)


@router.post(
    "/{contract_id}/ceremony/sign",
    response_model=APIResponse[ContractEsignSessionResponse],
    status_code=status.HTTP_200_OK,
)
async def submit_digital_signature(
    contract_id: UUID,
    body: SubmitDigitalSignatureRequest,
    current_user: User = Depends(
        require_any_permission([
            PermissionCode.CONTRACT_VIEW_OWN,
            PermissionCode.CONTRACT_VIEW_ALL,
            PermissionCode.CONTRACT_ACTIVATE,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    """Record a cryptographic digital signature for a signer in the ceremony."""
    session = await contract_service.submit_digital_signature(
        db,
        contract_id=contract_id,
        org_id=current_user.org_id,
        actor_id=current_user.id,
        payload=body,
    )
    return success_response(data=session)


