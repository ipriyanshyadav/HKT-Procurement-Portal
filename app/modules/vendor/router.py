from __future__ import annotations
import math
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_permission
from app.auth.service import auth_service
from app.core.constants import PermissionCode
from app.core.exceptions import AppException, ForbiddenError, NotFoundError
from app.core.responses import APIResponse, PaginationMeta, created_response, success_response
from app.db.session import get_db
from app.modules.user.models import User
from app.modules.vendor.models import Vendor
from app.modules.vendor.schemas import (
    DuplicateCheckRequest,
    DuplicateCheckResult,
    PennyTestConfirmRequest,
    VendorBankAccountCreateRequest,
    VendorBankAccountResponse,
    VendorBlacklistConfirmRequest,
    VendorBlacklistInitiateRequest,
    VendorCategoriesUpdateRequest,
    VendorCategoryMappingResponse,
    VendorContactResponse,
    VendorDetailResponse,
    VendorDocumentCreateRequest,
    VendorDocumentResponse,
    VendorInviteRequest,
    VendorQualifyRequest,
    VendorRegistrationRequest,
    VendorRejectRequest,
    VendorReinstateRequest,
    VendorResponse,
    VendorResubmissionRequest,
    VendorScorecardResponse,
    VendorScorecardUpdateRequest,
    VendorSubmitRequest,
    VendorSuspendRequest,
    VendorUpdateRequest,
    BulkVendorCategoryMappingRequest,
    BulkVendorCategoryMappingResponse,
)
from app.core.streaming import stream_csv, stream_pdf, generate_table_pdf
from app.modules.vendor.service import vendor_service


router = APIRouter(tags=["Vendor"])


def _assert_vendor_access(user: User, vendor_id: UUID) -> None:
    """Enforce supplier portal boundary: supplier user can only access their own vendor."""
    if user.is_supplier_user:
        if not user.vendor_id or str(user.vendor_id) != str(vendor_id):
            raise ForbiddenError("Supplier cannot access another vendor's data")


# ─────────────────────────────────────────────────────────────────────────────
# Public Token Registration Endpoints (Supplier Portal)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/invitation/{token}")
async def validate_invitation_token(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Validate invitation token and return pre-filled vendor data."""
    vendor = await vendor_service.get_by_invitation_token(db, token)
    return success_response(VendorResponse.model_validate(vendor).model_dump())


@router.post("/register/{token}", status_code=status.HTTP_200_OK)
async def register_vendor_with_token(
    token: str,
    data: VendorRegistrationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Complete vendor registration wizard step via invitation token."""
    if data.turnstile_token:
        remote_ip = request.client.host if request.client else None
        valid_bot = await auth_service.verify_turnstile(data.turnstile_token, remote_ip)
        if not valid_bot:
            raise AppException("Anti-bot verification failed", "BOT_VERIFICATION_FAILED")
    vendor = await vendor_service.register_with_token(db, token, data)
    await db.commit()
    return success_response(VendorResponse.model_validate(vendor).model_dump())


# ─────────────────────────────────────────────────────────────────────────────
# Buyer Portal Endpoints (Vendor Admin / Procurement Team)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/invite", status_code=status.HTTP_201_CREATED)
async def invite_vendor(
    data: VendorInviteRequest,
    current_user: User = Depends(require_permission(PermissionCode.VENDOR_INVITE)),
    db: AsyncSession = Depends(get_db),
):
    """Buyer invites a vendor by company name and email."""
    if current_user.is_supplier_user:
        raise ForbiddenError("Suppliers cannot invite vendors")

    vendor = await vendor_service.invite_vendor(
        db, data, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    res = VendorResponse.model_validate(vendor).model_dump()
    if hasattr(vendor, "_raw_token"):
        res["invitation_token_raw"] = vendor._raw_token
    return created_response(res)


@router.get("", status_code=status.HTTP_200_OK)
async def list_vendors(
    status: Optional[str] = Query(None),
    category_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_dir: str = Query("desc"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List vendors with pagination, filtering, and search."""
    if current_user.is_supplier_user:
        raise ForbiddenError("Suppliers cannot list all vendors")

    items, total = await vendor_service.repo.list_vendors(
        db,
        org_id=current_user.org_id,
        status=status,
        category_id=category_id,
        search=search,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )

    total_pages = math.ceil(total / page_size) if page_size > 0 else 1
    meta = PaginationMeta(
        page=page,
        page_size=page_size,
        total_count=total,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )
    data = [VendorResponse.model_validate(v).model_dump() for v in items]
    return success_response(data, meta=meta)


@router.get("/export/csv")
async def export_vendors_csv(
    status: Optional[str] = Query(None),
    category_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream CSV export of vendors."""
    if current_user.is_supplier_user:
        raise ForbiddenError("Suppliers cannot export vendor catalog")

    items, _ = await vendor_service.repo.list_vendors(
        db,
        org_id=current_user.org_id,
        status=status,
        category_id=category_id,
        search=search,
        page=1,
        page_size=1000,
    )
    headers = ["vendor_code", "company_name", "status", "pan", "gstin", "created_at"]
    rows = [
        {
            "vendor_code": getattr(v, "vendor_code", ""),
            "company_name": getattr(v, "company_name", ""),
            "status": getattr(v, "status", ""),
            "pan": getattr(v, "pan", ""),
            "gstin": getattr(v, "gstin", ""),
            "created_at": getattr(v, "created_at", ""),
        }
        for v in items
    ]
    return stream_csv(headers=headers, rows=rows, filename=f"vendors_{current_user.org_id.hex[:6]}")


@router.get("/export/pdf")
async def export_vendors_pdf(
    status: Optional[str] = Query(None),
    category_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream PDF export of vendors."""
    if current_user.is_supplier_user:
        raise ForbiddenError("Suppliers cannot export vendor catalog")

    items, _ = await vendor_service.repo.list_vendors(
        db,
        org_id=current_user.org_id,
        status=status,
        category_id=category_id,
        search=search,
        page=1,
        page_size=500,
    )
    headers = ["vendor_code", "company_name", "status", "pan", "gstin"]
    rows = [
        {
            "vendor_code": getattr(v, "vendor_code", ""),
            "company_name": getattr(v, "company_name", ""),
            "status": getattr(v, "status", ""),
            "pan": getattr(v, "pan", ""),
            "gstin": getattr(v, "gstin", ""),
        }
        for v in items
    ]
    pdf_bytes = generate_table_pdf("Vendors Master Report", headers, rows)
    return stream_pdf(pdf_bytes, f"vendors_{current_user.org_id.hex[:6]}")


@router.post("/check-duplicates", status_code=status.HTTP_200_OK)
async def check_duplicates(
    data: DuplicateCheckRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run duplicate detection checks."""
    result = await vendor_service.detect_duplicates(
        db,
        current_user.org_id,
        pan=data.pan,
        gstin=data.gstin,
        company_name=data.company_name,
        email=data.email,
        bank_account=data.bank_account,
        ifsc=data.ifsc,
    )
    return success_response(result.model_dump())


@router.post("/bulk-category-mapping", status_code=status.HTTP_200_OK)
async def bulk_category_mapping(
    data: BulkVendorCategoryMappingRequest,
    current_user: User = Depends(require_permission(PermissionCode.VENDOR_MANAGE_CATEGORIES)),
    db: AsyncSession = Depends(get_db),
):
    """Bulk map categories to multiple vendors via imported CSV / JSON entries."""
    result = await vendor_service.bulk_map_categories(
        db,
        mappings=data.mappings,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(result.model_dump())


# ─────────────────────────────────────────────────────────────────────────────
# Supplier Portal Endpoints (/me)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/me", status_code=status.HTTP_200_OK)
async def get_my_vendor_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Supplier portal endpoint to fetch the current supplier's own vendor details."""
    if not current_user.is_supplier_user or not current_user.vendor_id:
        raise ForbiddenError("Current user is not associated with a vendor profile")
    detail = await vendor_service.get_vendor_detail(db, current_user.vendor_id, current_user.org_id)
    v_dict = VendorResponse.model_validate(detail["vendor"]).model_dump()
    v_dict["category_ids"] = [str(c) for c in detail["category_ids"]]
    v_dict["contacts"] = [
        VendorContactResponse.model_validate(c).model_dump() for c in detail["contacts"]
    ]
    v_dict["bank_accounts"] = detail["bank_accounts"]
    v_dict["documents"] = [
        VendorDocumentResponse.model_validate(d).model_dump() for d in detail["documents"]
    ]
    v_dict["scorecard"] = (
        VendorScorecardResponse.model_validate(detail["scorecard"]).model_dump()
        if detail["scorecard"]
        else None
    )
    return success_response(v_dict)


@router.put("/me", status_code=status.HTTP_200_OK)
async def update_my_vendor_profile(
    data: VendorUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Supplier portal endpoint to update the current supplier's own vendor details."""
    if not current_user.is_supplier_user or not current_user.vendor_id:
        raise ForbiddenError("Current user is not associated with a vendor profile")
    vendor = await vendor_service.update_vendor(
        db, current_user.vendor_id, data, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(VendorResponse.model_validate(vendor).model_dump())


@router.get("/me/documents", status_code=status.HTTP_200_OK)
async def get_my_vendor_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Supplier portal endpoint to list documents for current supplier."""
    if not current_user.is_supplier_user or not current_user.vendor_id:
        raise ForbiddenError("Current user is not associated with a vendor profile")
    docs = await vendor_service.repo.get_documents(db, current_user.vendor_id)
    data = [VendorDocumentResponse.model_validate(d).model_dump() for d in docs]
    return success_response(data)


@router.post("/me/documents", status_code=status.HTTP_201_CREATED)
async def add_my_vendor_document(
    data: VendorDocumentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Supplier portal endpoint to attach a document for current supplier."""
    if not current_user.is_supplier_user or not current_user.vendor_id:
        raise ForbiddenError("Current user is not associated with a vendor profile")
    doc = await vendor_service.add_document(
        db, current_user.vendor_id, data, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return created_response(VendorDocumentResponse.model_validate(doc).model_dump())


# ─────────────────────────────────────────────────────────────────────────────
# Vendor Detail & Mutation Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{id}", status_code=status.HTTP_200_OK)
async def get_vendor_detail(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get complete vendor details."""
    _assert_vendor_access(current_user, id)
    detail = await vendor_service.get_vendor_detail(db, id, current_user.org_id)
    v_dict = VendorResponse.model_validate(detail["vendor"]).model_dump()
    v_dict["category_ids"] = [str(c) for c in detail["category_ids"]]
    v_dict["contacts"] = [
        VendorContactResponse.model_validate(c).model_dump() for c in detail["contacts"]
    ]
    v_dict["bank_accounts"] = detail["bank_accounts"]
    v_dict["documents"] = [
        VendorDocumentResponse.model_validate(d).model_dump() for d in detail["documents"]
    ]
    v_dict["scorecard"] = (
        VendorScorecardResponse.model_validate(detail["scorecard"]).model_dump()
        if detail["scorecard"]
        else None
    )
    return success_response(v_dict)


@router.put("/{id}", status_code=status.HTTP_200_OK)
async def update_vendor(
    id: UUID,
    data: VendorUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update vendor profile."""
    _assert_vendor_access(current_user, id)
    vendor = await vendor_service.update_vendor(
        db, id, data, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(VendorResponse.model_validate(vendor).model_dump())


@router.post("/{id}/submit", status_code=status.HTTP_200_OK)
async def submit_vendor(
    id: UUID,
    data: Optional[VendorSubmitRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit vendor registration for review."""
    _assert_vendor_access(current_user, id)
    vendor = await vendor_service.submit_registration(
        db, id, data, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(VendorResponse.model_validate(vendor).model_dump())


@router.post("/{id}/qualify", status_code=status.HTTP_200_OK)
async def qualify_vendor(
    id: UUID,
    data: Optional[VendorQualifyRequest] = None,
    current_user: User = Depends(require_permission(PermissionCode.VENDOR_QUALIFY)),
    db: AsyncSession = Depends(get_db),
):
    """Mark vendor as qualified."""
    if current_user.is_supplier_user:
        raise ForbiddenError("Suppliers cannot qualify vendors")

    notes = data.notes if data else None
    vendor = await vendor_service.qualify(
        db, id, actor_id=current_user.id, org_id=current_user.org_id, notes=notes
    )
    await db.commit()
    return success_response(VendorResponse.model_validate(vendor).model_dump())


@router.post("/{id}/activate", status_code=status.HTTP_200_OK)
async def activate_vendor(
    id: UUID,
    current_user: User = Depends(require_permission(PermissionCode.VENDOR_ACTIVATE)),
    db: AsyncSession = Depends(get_db),
):
    """Activate a qualified vendor and assign vendor code."""
    if current_user.is_supplier_user:
        raise ForbiddenError("Suppliers cannot activate vendors")

    vendor = await vendor_service.activate_vendor(
        db, id, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(VendorResponse.model_validate(vendor).model_dump())


@router.post("/{id}/reject", status_code=status.HTTP_200_OK)
async def reject_vendor(
    id: UUID,
    data: VendorRejectRequest,
    current_user: User = Depends(require_permission(PermissionCode.VENDOR_REJECT)),
    db: AsyncSession = Depends(get_db),
):
    """Reject vendor qualification."""
    if current_user.is_supplier_user:
        raise ForbiddenError("Suppliers cannot reject vendors")

    vendor = await vendor_service.reject(
        db, id, reason=data.reason, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(VendorResponse.model_validate(vendor).model_dump())


@router.post("/{id}/request-resubmission", status_code=status.HTTP_200_OK)
async def request_resubmission(
    id: UUID,
    data: VendorResubmissionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Request resubmission of vendor documents or information."""
    if current_user.is_supplier_user:
        raise ForbiddenError("Suppliers cannot request resubmission")

    vendor = await vendor_service.request_resubmission(
        db, id, reason=data.reason, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(VendorResponse.model_validate(vendor).model_dump())


@router.post("/{id}/suspend", status_code=status.HTTP_200_OK)
async def suspend_vendor(
    id: UUID,
    data: VendorSuspendRequest,
    current_user: User = Depends(require_permission(PermissionCode.VENDOR_SUSPEND)),
    db: AsyncSession = Depends(get_db),
):
    """Suspend an active vendor."""
    if current_user.is_supplier_user:
        raise ForbiddenError("Suppliers cannot suspend vendors")

    vendor = await vendor_service.suspend(
        db, id, reason=data.reason, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(VendorResponse.model_validate(vendor).model_dump())


@router.post("/{id}/reinstate", status_code=status.HTTP_200_OK)
async def reinstate_vendor(
    id: UUID,
    data: Optional[VendorReinstateRequest] = None,
    current_user: User = Depends(require_permission(PermissionCode.VENDOR_REINSTATE)),
    db: AsyncSession = Depends(get_db),
):
    """Reinstate a suspended vendor."""
    if current_user.is_supplier_user:
        raise ForbiddenError("Suppliers cannot reinstate vendors")

    reason = data.reason if data else None
    vendor = await vendor_service.reinstate(
        db, id, actor_id=current_user.id, org_id=current_user.org_id, reason=reason
    )
    await db.commit()
    return success_response(VendorResponse.model_validate(vendor).model_dump())


@router.post("/{id}/initiate-blacklist", status_code=status.HTTP_200_OK)
async def initiate_blacklist(
    id: UUID,
    data: VendorBlacklistInitiateRequest,
    current_user: User = Depends(require_permission(PermissionCode.VENDOR_BLACKLIST_INITIATE)),
    db: AsyncSession = Depends(get_db),
):
    """Initiate dual-approval blacklisting for a vendor."""
    if current_user.is_supplier_user:
        raise ForbiddenError("Suppliers cannot initiate blacklisting")

    vendor = await vendor_service.initiate_blacklist(
        db, id, reason=data.reason, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(VendorResponse.model_validate(vendor).model_dump())


@router.post("/{id}/confirm-blacklist", status_code=status.HTTP_200_OK)
async def confirm_blacklist(
    id: UUID,
    data: Optional[VendorBlacklistConfirmRequest] = None,
    current_user: User = Depends(require_permission(PermissionCode.VENDOR_BLACKLIST_APPROVE)),
    db: AsyncSession = Depends(get_db),
):
    """Confirm vendor blacklisting (enforces Segregation of Duties)."""
    if current_user.is_supplier_user:
        raise ForbiddenError("Suppliers cannot confirm blacklisting")

    task_id = data.workflow_task_id if data else None
    reason = data.reason if data else None
    vendor = await vendor_service.confirm_blacklist(
        db,
        id,
        workflow_task_id=task_id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        reason=reason,
    )
    await db.commit()
    return success_response(VendorResponse.model_validate(vendor).model_dump())


# ─────────────────────────────────────────────────────────────────────────────
# Scorecard, Documents, Categories & Bank Accounts
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{id}/scorecard", status_code=status.HTTP_200_OK)
async def get_vendor_scorecard(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the latest vendor scorecard."""
    _assert_vendor_access(current_user, id)
    scorecard = await vendor_service.repo.get_latest_scorecard(db, id)
    if not scorecard:
        raise NotFoundError("Scorecard not found for this vendor")
    return success_response(VendorScorecardResponse.model_validate(scorecard).model_dump())


@router.post("/{id}/scorecard", status_code=status.HTTP_200_OK)
async def update_vendor_scorecard(
    id: UUID,
    data: Optional[VendorScorecardUpdateRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recalculate or update vendor scorecard."""
    if current_user.is_supplier_user:
        raise ForbiddenError("Suppliers cannot update scorecards")

    scorecard = await vendor_service.update_scorecard(
        db, id, org_id=current_user.org_id, data=data
    )
    await db.commit()
    return success_response(VendorScorecardResponse.model_validate(scorecard).model_dump())


@router.get("/{id}/documents", status_code=status.HTTP_200_OK)
async def get_vendor_documents(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List documents for a vendor."""
    _assert_vendor_access(current_user, id)
    docs = await vendor_service.repo.get_documents(db, id)
    data = [VendorDocumentResponse.model_validate(d).model_dump() for d in docs]
    return success_response(data)


@router.post("/{id}/documents", status_code=status.HTTP_201_CREATED)
async def add_vendor_document(
    id: UUID,
    data: VendorDocumentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Attach a document to vendor profile."""
    _assert_vendor_access(current_user, id)
    doc = await vendor_service.add_document(
        db, id, data, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return created_response(VendorDocumentResponse.model_validate(doc).model_dump())


@router.post("/{id}/categories", status_code=status.HTTP_200_OK)
async def update_vendor_categories(
    id: UUID,
    data: VendorCategoriesUpdateRequest,
    current_user: User = Depends(require_permission(PermissionCode.VENDOR_MANAGE_CATEGORIES)),
    db: AsyncSession = Depends(get_db),
):
    """Update category mappings for a vendor."""
    if current_user.is_supplier_user:
        raise ForbiddenError("Suppliers cannot manage category mappings")

    mappings = await vendor_service.update_categories(
        db, id, data.category_ids, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(
        [VendorCategoryMappingResponse.model_validate(m).model_dump() for m in mappings]
    )


@router.post("/{id}/bank-accounts", status_code=status.HTTP_201_CREATED)
async def add_bank_account(
    id: UUID,
    data: VendorBankAccountCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a bank account to vendor profile."""
    _assert_vendor_access(current_user, id)
    bank = await vendor_service.add_bank_account(
        db, id, data, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    b_dict = {
        "id": bank.id,
        "vendor_id": bank.vendor_id,
        "account_holder_name": bank.account_holder_name,
        "bank_name": bank.bank_name,
        "branch_name": bank.branch_name,
        "account_number_masked": f"****{data.account_number[-4:]}",
        "ifsc_code": bank.ifsc_code,
        "swift_code": bank.swift_code,
        "is_primary": bank.is_primary,
        "penny_test_status": bank.penny_test_status,
        "penny_test_reference": bank.penny_test_reference,
    }
    return created_response(b_dict)


@router.post("/{id}/bank-accounts/{bank_id}/initiate-penny-test", status_code=status.HTTP_200_OK)
async def initiate_penny_test(
    id: UUID,
    bank_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate penny drop verification test."""
    _assert_vendor_access(current_user, id)
    res = await vendor_service.initiate_penny_test(
        db, id, bank_id, actor_id=current_user.id, org_id=current_user.org_id
    )
    await db.commit()
    return success_response(res)


@router.post("/{id}/bank-accounts/{bank_id}/confirm-penny-test", status_code=status.HTTP_200_OK)
async def confirm_penny_test(
    id: UUID,
    bank_id: UUID,
    data: PennyTestConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm penny test by entering amount received."""
    _assert_vendor_access(current_user, id)
    res = await vendor_service.confirm_penny_test(
        db,
        id,
        bank_id,
        amount_received=data.amount_received,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    await db.commit()
    return success_response(res)
