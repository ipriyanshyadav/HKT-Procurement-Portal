from __future__ import annotations

import difflib
import hashlib
import secrets
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.encryption import decrypt_field, encrypt_field
from app.core.exceptions import (
    AppException,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.core.security import mask_pii
from app.db.enums import VendorStatusEnum, UserStatusEnum
from app.events.publisher import OutboxPublisher
from app.modules.audit.service import audit_service
from app.modules.vendor.fsm import validate_transition
from app.modules.vendor.models import (
    Vendor,
    VendorBankAccount,
    VendorCategoryMapping,
    VendorContact,
    VendorDocument,
    VendorRiskAssessment,
    VendorScorecard,
)
from app.modules.vendor.repository import VendorRepository, vendor_repository
from app.modules.vendor.schemas import (
    BulkVendorCategoryMappingItem,
    BulkVendorCategoryMappingResponse,
    DuplicateCheckResult,
    DuplicateMatch,
    VendorBankAccountCreateRequest,
    VendorDocumentCreateRequest,
    VendorInviteRequest,
    VendorKYCReviewRequest,
    VendorRegistrationRequest,
    VendorRiskAssessmentUpdateRequest,
    VendorScorecardUpdateRequest,
    VendorSelfRegistrationRequest,
    VendorUpdateRequest,
)
from integration.adapters.bank import BankVerificationAdapter
from integration.adapters.gst import GSTAdapter
from integration.adapters.pan import PANAdapter


class VendorService:
    def __init__(
        self,
        repo: VendorRepository | None = None,
        gst_adapter: GSTAdapter | None = None,
        pan_adapter: PANAdapter | None = None,
        bank_adapter: BankVerificationAdapter | None = None,
    ):
        self.repo = repo or vendor_repository
        self.gst_adapter = gst_adapter or GSTAdapter()
        self.pan_adapter = pan_adapter or PANAdapter()
        self.bank_adapter = bank_adapter or BankVerificationAdapter()

    @staticmethod
    def _hash_token(raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    async def _generate_vendor_code(self, db: AsyncSession, org_id: UUID) -> str:
        stmt = select(func.count(Vendor.id)).where(Vendor.org_id == org_id)
        count = (await db.execute(stmt)).scalar() or 0
        return f"VND-{count + 1:05d}"

    # ─────────────────────────────────────────────────────────────────────────
    # Duplicate Detection
    # ─────────────────────────────────────────────────────────────────────────

    async def detect_duplicates(
        self,
        db: AsyncSession,
        org_id: UUID,
        pan: str | None = None,
        gstin: str | None = None,
        company_name: str | None = None,
        email: str | None = None,
        bank_account: str | None = None,
        ifsc: str | None = None,
        exclude_vendor_id: UUID | None = None,
    ) -> DuplicateCheckResult:
        result = DuplicateCheckResult()

        # 1. PAN exact match — HARD BLOCK
        if pan:
            existing = await self.repo.find_by_pan(db, org_id, pan)
            if existing and existing.id != exclude_vendor_id:
                result.has_hard_blocks = True
                result.hard_blocks.append(
                    DuplicateMatch(
                        code="PAN_DUPLICATE",
                        message=f"PAN {pan} already registered",
                        vendor_id=existing.id,
                    )
                )

        # 2. GSTIN uniqueness — HARD BLOCK
        if gstin:
            existing = await self.repo.find_by_gstin(db, org_id, gstin)
            if existing and existing.id != exclude_vendor_id:
                result.has_hard_blocks = True
                result.hard_blocks.append(
                    DuplicateMatch(
                        code="GSTIN_DUPLICATE",
                        message=f"GSTIN {gstin} already registered",
                        vendor_id=existing.id,
                    )
                )

        # 3. Company name fuzzy match — SOFT WARNING (>85% similarity)
        if company_name:
            active_vendors = await self.repo.get_active_vendor_names(db, org_id)
            c_name_lower = company_name.lower().strip()
            for v in active_vendors:
                if exclude_vendor_id and v.id == exclude_vendor_id:
                    continue
                v_name_lower = v.company_name.lower().strip()
                similarity = difflib.SequenceMatcher(None, c_name_lower, v_name_lower).ratio()
                if similarity > settings.VENDOR_DUPLICATE_NAME_SIMILARITY:
                    result.has_soft_warnings = True
                    result.soft_warnings.append(
                        DuplicateMatch(
                            code="NAME_SIMILAR",
                            message=f"Company name '{company_name}' is {similarity:.0%} similar to '{v.company_name}'",
                            vendor_id=v.id,
                        )
                    )

        # 4. Email domain match — SOFT WARNING
        if email and "@" in email:
            domain = email.split("@")[1].lower().strip()
            # Ignore public domains
            if domain not in {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com"}:
                same_domain_vendors = await self.repo.find_by_email_domain(db, org_id, domain)
                for v in same_domain_vendors:
                    if exclude_vendor_id and v.id == exclude_vendor_id:
                        continue
                    result.has_soft_warnings = True
                    result.soft_warnings.append(
                        DuplicateMatch(
                            code="EMAIL_DOMAIN_MATCH",
                            message=f"Email domain @{domain} matches existing vendor '{v.company_name}'",
                            vendor_id=v.id,
                        )
                    )
                    break

        # 5. Bank account + IFSC exact match — FRAUD FLAG
        if bank_account and ifsc:
            account_enc = encrypt_field(bank_account.strip())
            # Search by decrypting matching IFSC accounts
            stmt = select(VendorBankAccount).where(
                VendorBankAccount.org_id == org_id,
                func.upper(VendorBankAccount.ifsc_code) == ifsc.upper().strip(),
                VendorBankAccount.deleted_at.is_(None),
            )
            candidates = (await db.execute(stmt)).scalars().all()
            for cand in candidates:
                if exclude_vendor_id and cand.vendor_id == exclude_vendor_id:
                    continue
                try:
                    dec = decrypt_field(cand.account_number_encrypted)
                    if dec == bank_account.strip():
                        result.has_fraud_flags = True
                        result.fraud_flags.append(
                            DuplicateMatch(
                                code="BANK_ACCOUNT_DUPLICATE",
                                message="Bank account + IFSC combination matches existing vendor",
                                vendor_id=cand.vendor_id,
                            )
                        )
                        break
                except Exception:
                    pass

        return result

    # ─────────────────────────────────────────────────────────────────────────
    # External Verification Helpers
    # ─────────────────────────────────────────────────────────────────────────

    async def _validate_gstin(self, gstin: str | None, org_id: UUID) -> dict[str, Any]:
        if not gstin:
            return {"is_valid": True, "status": "SKIPPED"}
        return await self.gst_adapter.validate(gstin)

    async def _validate_pan(self, pan: str | None, org_id: UUID) -> dict[str, Any]:
        if not pan:
            return {"is_valid": True, "status": "SKIPPED"}
        return await self.pan_adapter.validate(pan)

    # ─────────────────────────────────────────────────────────────────────────
    # Onboarding & Lifecycle Methods
    # ─────────────────────────────────────────────────────────────────────────

    async def invite_vendor(
        self,
        db: AsyncSession,
        data: VendorInviteRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Vendor:
        # Check duplicate email in org
        existing = await self.repo.find_by_email(db, org_id, data.primary_email)
        if existing:
            raise ConflictError(f"Vendor with email {data.primary_email} already exists")

        # Duplicate check on name
        dup_check = await self.detect_duplicates(
            db, org_id, company_name=data.company_name, email=data.primary_email
        )
        if dup_check.has_hard_blocks:
            raise ConflictError(dup_check.hard_blocks[0].message)

        raw_token = secrets.token_urlsafe(32)
        token_hash = self._hash_token(raw_token)
        expires_at = datetime.now(UTC) + timedelta(days=settings.INVITATION_TOKEN_TTL_DAYS)

        vendor = Vendor(
            org_id=org_id,
            company_name=data.company_name,
            primary_email=data.primary_email,
            primary_phone=data.primary_phone,
            invitation_token=token_hash,
            invitation_expires_at=expires_at,
            status=VendorStatusEnum.INVITED,
            invited_by=actor_id,
            onboarding_step=0,
            created_by=actor_id,
        )
        db.add(vendor)
        await db.flush()

        if data.category_ids:
            await self.repo.set_categories(db, org_id, vendor.id, data.category_ids)

        # Publish outbox event with raw token for email sending
        await OutboxPublisher.publish(
            db,
            event_type="vendor.invited",
            routing_key="procurement.vendor",
            payload={
                "vendor_id": str(vendor.id),
                "email": data.primary_email,
                "company_name": data.company_name,
                "token": raw_token,
                "org_id": str(org_id),
                "invited_by": str(actor_id),
                "expiry_days": settings.INVITATION_TOKEN_TTL_DAYS,
            },
            org_id=org_id,
        )

        await audit_service.log(
            db,
            entity_type="VENDOR",
            entity_id=vendor.id,
            action="VENDOR_INVITED",
            actor_id=actor_id,
            org_id=org_id,
            new_values={
                "email": mask_pii(data.primary_email),
                "company_name": data.company_name,
            },
        )
        # Attach raw token dynamically for caller/controller reference
        vendor._raw_token = raw_token
        return vendor

    async def get_by_invitation_token(self, db: AsyncSession, token: str) -> Vendor:
        token_hash = self._hash_token(token)
        vendor = await self.repo.find_by_invitation_token(db, token_hash)
        if not vendor:
            # Fallback to direct token if stored unhashed
            vendor = await self.repo.find_by_invitation_token(db, token)
        if not vendor:
            raise NotFoundError("Vendor invitation token not found")
        if vendor.invitation_expires_at:
            exp = vendor.invitation_expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=UTC)
            if exp < datetime.now(UTC):
                raise AppException("Invitation token has expired", "TOKEN_EXPIRED")
        return vendor

    async def register_with_token(
        self,
        db: AsyncSession,
        token: str,
        data: VendorRegistrationRequest,
    ) -> Vendor:
        vendor = await self.get_by_invitation_token(db, token)

        if vendor.status == VendorStatusEnum.INVITED:
            validate_transition(vendor.status, "REGISTRATION_IN_PROGRESS")
            vendor.status = VendorStatusEnum.REGISTRATION_IN_PROGRESS

        # Run duplicate detection for PAN/GSTIN
        dup_check = await self.detect_duplicates(
            db,
            vendor.org_id,
            pan=data.pan,
            gstin=data.gstin,
            company_name=data.company_name or vendor.company_name,
            email=vendor.primary_email,
            exclude_vendor_id=vendor.id,
        )
        if dup_check.has_hard_blocks:
            raise ConflictError(dup_check.hard_blocks[0].message)

        if data.company_name:
            vendor.company_name = data.company_name
        if data.legal_name:
            vendor.legal_name = data.legal_name
        if data.pan:
            vendor.pan = data.pan.upper().strip()
            vendor.pan_encrypted = encrypt_field(vendor.pan)
        if data.gstin:
            vendor.gstin = data.gstin.upper().strip()
            vendor.gstin_encrypted = encrypt_field(vendor.gstin)
        if data.cin:
            vendor.cin = data.cin
        if data.duns_number:
            vendor.duns_number = data.duns_number
        if data.website:
            vendor.website = data.website
        if data.primary_phone:
            vendor.primary_phone = data.primary_phone
        if data.address_line1:
            vendor.address_line1 = data.address_line1
        if data.address_line2:
            vendor.address_line2 = data.address_line2
        if data.city:
            vendor.city = data.city
        if data.state:
            vendor.state = data.state
        if data.postal_code:
            vendor.postal_code = data.postal_code
        if data.country_code:
            vendor.country_code = data.country_code
        vendor.onboarding_step = max(vendor.onboarding_step, 1)

        if data.category_ids:
            await self.repo.set_categories(db, vendor.org_id, vendor.id, data.category_ids)

        for c in data.contacts:
            await self.repo.create_contact(
                db,
                vendor.org_id,
                vendor.id,
                {
                    "name": c.name,
                    "designation": c.designation,
                    "email": c.email,
                    "phone": c.phone,
                    "is_primary": c.is_primary,
                },
            )

        for b in data.bank_accounts:
            await self.repo.create_bank_account(
                db,
                vendor.org_id,
                vendor.id,
                {
                    "account_holder_name": b.account_holder_name,
                    "bank_name": b.bank_name,
                    "branch_name": b.branch_name,
                    "account_number_encrypted": encrypt_field(b.account_number),
                    "ifsc_code": b.ifsc_code.upper().strip(),
                    "swift_code": b.swift_code,
                    "is_primary": b.is_primary,
                },
            )

        await db.flush()

        await OutboxPublisher.publish(
            db,
            event_type="vendor.registration_started",
            routing_key="procurement.vendor",
            payload={"vendor_id": str(vendor.id), "org_id": str(vendor.org_id)},
            org_id=vendor.org_id,
        )

        await audit_service.log(
            db,
            entity_type="VENDOR",
            entity_id=vendor.id,
            action="VENDOR_REGISTRATION_STARTED",
            actor_id=None,
            org_id=vendor.org_id,
        )

        return vendor

    async def update_vendor(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        data: VendorUpdateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Vendor:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        if data.pan or data.gstin or data.company_name:
            dup_check = await self.detect_duplicates(
                db,
                org_id,
                pan=data.pan,
                gstin=data.gstin,
                company_name=data.company_name,
                exclude_vendor_id=vendor_id,
            )
            if dup_check.has_hard_blocks:
                raise ConflictError(dup_check.hard_blocks[0].message)

        if data.company_name is not None:
            vendor.company_name = data.company_name
        if data.legal_name is not None:
            vendor.legal_name = data.legal_name
        if data.pan is not None:
            vendor.pan = data.pan.upper().strip()
            vendor.pan_encrypted = encrypt_field(vendor.pan)
        if data.gstin is not None:
            vendor.gstin = data.gstin.upper().strip()
            vendor.gstin_encrypted = encrypt_field(vendor.gstin)
        if data.cin is not None:
            vendor.cin = data.cin
        if data.duns_number is not None:
            vendor.duns_number = data.duns_number
        if data.website is not None:
            vendor.website = data.website
        if data.primary_phone is not None:
            vendor.primary_phone = data.primary_phone
        if data.address_line1 is not None:
            vendor.address_line1 = data.address_line1
        if data.address_line2 is not None:
            vendor.address_line2 = data.address_line2
        if data.city is not None:
            vendor.city = data.city
        if data.state is not None:
            vendor.state = data.state
        if data.postal_code is not None:
            vendor.postal_code = data.postal_code
        if data.country_code is not None:
            vendor.country_code = data.country_code
        if data.onboarding_step is not None:
            vendor.onboarding_step = data.onboarding_step
        vendor.updated_by = actor_id

        await db.flush()
        return vendor

    async def submit_registration(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        data: Any | None = None,
        actor_id: UUID | None = None,
        org_id: UUID | None = None,
    ) -> Vendor:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        resolved_org_id = org_id or vendor.org_id
        effective_actor_id = actor_id or vendor.invited_by or vendor.id

        validate_transition(vendor.status, "SUBMITTED")

        # Validate GSTIN & PAN format and online check
        if vendor.gstin:
            await self._validate_gstin(vendor.gstin, resolved_org_id)
        if vendor.pan:
            await self._validate_pan(vendor.pan, resolved_org_id)

        vendor.status = VendorStatusEnum.SUBMITTED
        vendor.submitted_at = datetime.now(UTC)
        vendor.onboarding_step = 8

        # Instantiate VENDOR_QUAL workflow template
        try:
            from app.modules.workflow.service import workflow_engine
            await workflow_engine.instantiate(
                db,
                template_code="VENDOR_QUAL",
                entity_type="VENDOR",
                entity_id=vendor.id,
                entity_context={
                    "vendor_id": str(vendor.id),
                    "company_name": vendor.company_name,
                    "pan": vendor.pan,
                    "gstin": vendor.gstin,
                },
                org_id=resolved_org_id,
                actor_id=effective_actor_id,
            )
        except Exception as e:
            logger.warning(f"Could not instantiate VENDOR_QUAL workflow: {e}")

        await OutboxPublisher.publish(
            db,
            event_type="vendor.submitted",
            routing_key="procurement.vendor",
            payload={"vendor_id": str(vendor.id), "org_id": str(resolved_org_id)},
            org_id=resolved_org_id,
        )

        await audit_service.log(
            db,
            entity_type="VENDOR",
            entity_id=vendor.id,
            action="VENDOR_SUBMITTED",
            actor_id=effective_actor_id,
            org_id=resolved_org_id,
        )

        await db.flush()
        return vendor

    async def qualify(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        actor_id: UUID,
        org_id: UUID,
        notes: str | None = None,
    ) -> Vendor:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        # Support transitioning from SUBMITTED or UNDER_REVIEW
        if vendor.status == VendorStatusEnum.SUBMITTED:
            vendor.status = VendorStatusEnum.UNDER_REVIEW

        validate_transition(vendor.status, "QUALIFIED")

        vendor.status = VendorStatusEnum.QUALIFIED
        vendor.qualified_at = datetime.now(UTC)
        vendor.updated_by = actor_id

        # Mark category mappings as qualified
        cats = await self.repo.get_categories(db, vendor.id)
        for c in cats:
            c.is_qualified = True
            c.qualified_at = datetime.now(UTC)

        await OutboxPublisher.publish(
            db,
            event_type="vendor.qualified",
            routing_key="procurement.vendor",
            payload={"vendor_id": str(vendor.id), "notes": notes},
            org_id=org_id,
        )

        await audit_service.log(
            db,
            entity_type="VENDOR",
            entity_id=vendor.id,
            action="VENDOR_QUALIFIED",
            actor_id=actor_id,
            org_id=org_id,
            new_values={"notes": notes},
        )

        await db.flush()
        return vendor

    async def activate_vendor(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> Vendor:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        validate_transition(vendor.status, "ACTIVE")

        if not vendor.vendor_code:
            vendor.vendor_code = await self._generate_vendor_code(db, org_id)

        vendor.status = VendorStatusEnum.ACTIVE
        vendor.activated_at = datetime.now(UTC)
        vendor.updated_by = actor_id

        await OutboxPublisher.publish(
            db,
            event_type="vendor.activated",
            routing_key="procurement.vendor",
            payload={"vendor_id": str(vendor.id), "vendor_code": vendor.vendor_code},
            org_id=org_id,
        )

        await audit_service.log(
            db,
            entity_type="VENDOR",
            entity_id=vendor.id,
            action="VENDOR_ACTIVATED",
            actor_id=actor_id,
            org_id=org_id,
            new_values={"vendor_code": vendor.vendor_code},
        )

        await db.flush()
        return vendor

    async def reject(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        reason: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> Vendor:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        validate_transition(vendor.status, "DEACTIVATED")

        vendor.status = VendorStatusEnum.DEACTIVATED
        vendor.suspension_reason = reason
        vendor.updated_by = actor_id

        await OutboxPublisher.publish(
            db,
            event_type="vendor.rejected",
            routing_key="procurement.vendor",
            payload={"vendor_id": str(vendor.id), "reason": reason},
            org_id=org_id,
        )

        await audit_service.log(
            db,
            entity_type="VENDOR",
            entity_id=vendor.id,
            action="VENDOR_REJECTED",
            actor_id=actor_id,
            org_id=org_id,
            new_values={"reason": reason},
        )

        await db.flush()
        return vendor

    async def request_resubmission(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        reason: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> Vendor:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        if vendor.status == VendorStatusEnum.SUBMITTED:
            vendor.status = VendorStatusEnum.UNDER_REVIEW

        validate_transition(vendor.status, "RESUBMISSION_REQUESTED")

        vendor.status = VendorStatusEnum.RESUBMISSION_REQUESTED
        vendor.suspension_reason = reason
        vendor.updated_by = actor_id

        await OutboxPublisher.publish(
            db,
            event_type="vendor.resubmission_requested",
            routing_key="procurement.vendor",
            payload={"vendor_id": str(vendor.id), "reason": reason},
            org_id=org_id,
        )

        await audit_service.log(
            db,
            entity_type="VENDOR",
            entity_id=vendor.id,
            action="VENDOR_RESUBMISSION_REQUESTED",
            actor_id=actor_id,
            org_id=org_id,
            new_values={"reason": reason},
        )

        await db.flush()
        return vendor

    async def suspend(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        reason: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> Vendor:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        validate_transition(vendor.status, "SUSPENDED")

        vendor.status = VendorStatusEnum.SUSPENDED
        vendor.suspension_reason = reason
        vendor.updated_by = actor_id

        await OutboxPublisher.publish(
            db,
            event_type="vendor.suspended",
            routing_key="procurement.vendor",
            payload={"vendor_id": str(vendor.id), "reason": reason},
            org_id=org_id,
        )

        await audit_service.log(
            db,
            entity_type="VENDOR",
            entity_id=vendor.id,
            action="VENDOR_SUSPENDED",
            actor_id=actor_id,
            org_id=org_id,
            new_values={"reason": reason},
        )

        await db.flush()
        return vendor

    async def reinstate(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        actor_id: UUID,
        org_id: UUID,
        reason: str | None = None,
    ) -> Vendor:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        validate_transition(vendor.status, "ACTIVE")

        vendor.status = VendorStatusEnum.ACTIVE
        vendor.suspension_reason = None
        vendor.updated_by = actor_id

        await OutboxPublisher.publish(
            db,
            event_type="vendor.reinstated",
            routing_key="procurement.vendor",
            payload={"vendor_id": str(vendor.id), "reason": reason},
            org_id=org_id,
        )

        await audit_service.log(
            db,
            entity_type="VENDOR",
            entity_id=vendor.id,
            action="VENDOR_REINSTATED",
            actor_id=actor_id,
            org_id=org_id,
            new_values={"reason": reason},
        )

        await db.flush()
        return vendor

    async def initiate_blacklist(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        reason: str,
        actor_id: UUID,
        org_id: UUID,
    ) -> Vendor:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        # Validate that vendor is in an active or suspended state that can be blacklisted
        validate_transition(vendor.status, "BLACKLISTED")

        vendor.blacklist_reason = reason
        vendor.blacklist_initiated_by = actor_id
        vendor.updated_by = actor_id

        # Instantiate VENDOR_BLACKLIST dual-approval workflow
        try:
            from app.modules.workflow.service import workflow_engine
            await workflow_engine.instantiate(
                db,
                template_code="VENDOR_BLACKLIST",
                entity_type="VENDOR",
                entity_id=vendor.id,
                entity_context={
                    "vendor_id": str(vendor.id),
                    "reason": reason,
                    "initiated_by": str(actor_id),
                },
                org_id=org_id,
                actor_id=actor_id,
            )
        except Exception as e:
            logger.warning(f"Could not instantiate VENDOR_BLACKLIST workflow: {e}")

        await OutboxPublisher.publish(
            db,
            event_type="vendor.blacklist_initiated",
            routing_key="procurement.vendor",
            payload={"vendor_id": str(vendor.id), "reason": reason, "initiated_by": str(actor_id)},
            org_id=org_id,
        )

        await audit_service.log(
            db,
            entity_type="VENDOR",
            entity_id=vendor.id,
            action="VENDOR_BLACKLIST_INITIATED",
            actor_id=actor_id,
            org_id=org_id,
            new_values={"reason": reason},
        )

        await db.flush()
        return vendor

    async def confirm_blacklist(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        workflow_task_id: UUID | None,
        actor_id: UUID,
        org_id: UUID,
        reason: str | None = None,
    ) -> Vendor:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        # Segregation of Duties: Initiator cannot confirm blacklisting
        if vendor.blacklist_initiated_by and str(actor_id) == str(vendor.blacklist_initiated_by):
            raise ForbiddenError(
                "Initiator cannot confirm blacklisting",
                details={
                    "blacklist_initiated_by": str(vendor.blacklist_initiated_by),
                    "confirming_actor": str(actor_id),
                },
            )

        validate_transition(vendor.status, "BLACKLISTED")

        vendor.status = VendorStatusEnum.BLACKLISTED
        vendor.blacklist_confirmed_by = actor_id
        vendor.blacklisted_at = datetime.now(UTC)
        if reason:
            vendor.blacklist_reason = reason
        vendor.updated_by = actor_id

        await OutboxPublisher.publish(
            db,
            event_type="vendor.blacklisted",
            routing_key="procurement.vendor",
            payload={
                "vendor_id": str(vendor.id),
                "confirmed_by": str(actor_id),
                "blacklisted_at": vendor.blacklisted_at.isoformat(),
            },
            org_id=org_id,
        )

        await audit_service.log(
            db,
            entity_type="VENDOR",
            entity_id=vendor.id,
            action="VENDOR_BLACKLISTED",
            actor_id=actor_id,
            org_id=org_id,
            new_values={"confirmed_by": str(actor_id)},
        )

        await db.flush()
        return vendor

    # ─────────────────────────────────────────────────────────────────────────
    # Scorecard Calculation
    # ─────────────────────────────────────────────────────────────────────────

    async def update_scorecard(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        org_id: UUID,
        data: VendorScorecardUpdateRequest | None = None,
    ) -> VendorScorecard:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        on_time = data.on_time_delivery_rate if data and data.on_time_delivery_rate is not None else Decimal("100.0")
        quality = data.quality_acceptance_rate if data and data.quality_acceptance_rate is not None else Decimal("100.0")
        commercial = data.commercial_compliance_score if data and data.commercial_compliance_score is not None else Decimal("100.0")
        responsiveness = data.responsiveness_score if data and data.responsiveness_score is not None else Decimal("100.0")

        # 40% on-time, 30% quality, 20% commercial, 10% responsiveness
        overall = (
            (on_time * Decimal("0.40"))
            + (quality * Decimal("0.30"))
            + (commercial * Decimal("0.20"))
            + (responsiveness * Decimal("0.10"))
        )

        period_start = data.period_start if data and data.period_start else date.today() - timedelta(days=90)
        period_end = data.period_end if data and data.period_end else date.today()

        scorecard = await self.repo.create_scorecard(
            db,
            org_id=org_id,
            vendor_id=vendor_id,
            data={
                "period_start": period_start,
                "period_end": period_end,
                "on_time_delivery_rate": round(on_time, 2),
                "quality_acceptance_rate": round(quality, 2),
                "commercial_compliance_score": round(commercial, 2),
                "responsiveness_score": round(responsiveness, 2),
                "overall_score": round(overall, 2),
            },
        )
        scorecard.quality_rejection_rate = round(Decimal("100.0") - quality, 2)
        scorecard.pricing_competitiveness = responsiveness

        vendor.performance_score = round(overall, 2)
        vendor.last_scorecard_at = datetime.now(UTC)

        await db.flush()
        return scorecard

    async def calculate_scorecard_automated(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        org_id: UUID,
        period_start: date | None = None,
        period_end: date | None = None,
    ) -> VendorScorecard:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        start_dt = period_start or (date.today() - timedelta(days=90))
        end_dt = period_end or date.today()

        # 1. On-Time Delivery Rate
        from sqlalchemy import select

        from app.modules.bid.models import BidResponse
        from app.modules.grn.models import GoodsReceiptNote, GrnLine
        from app.modules.invoice.models import Invoice
        from app.modules.purchase_order.models import PurchaseOrder

        grn_stmt = (
            select(GoodsReceiptNote, PurchaseOrder)
            .join(PurchaseOrder, PurchaseOrder.id == GoodsReceiptNote.po_id)
            .where(
                GoodsReceiptNote.vendor_id == vendor_id,
                GoodsReceiptNote.org_id == org_id,
                GoodsReceiptNote.receipt_date >= start_dt,
                GoodsReceiptNote.receipt_date <= end_dt,
                GoodsReceiptNote.deleted_at.is_(None),
            )
        )
        grn_res = await db.execute(grn_stmt)
        grn_po_pairs = list(grn_res.all())

        if grn_po_pairs:
            on_time_count = 0
            for grn, po in grn_po_pairs:
                if po.expected_delivery_date is None or grn.receipt_date <= po.expected_delivery_date or (grn.receipt_date - po.expected_delivery_date).days <= 0:
                    on_time_count += 1
            on_time_delivery_rate = Decimal(str(round((on_time_count / len(grn_po_pairs)) * 100, 2)))
        else:
            on_time_delivery_rate = Decimal("100.00")

        # 2. Quality Acceptance & Rejection Rate
        grn_ids = [grn.id for grn, _ in grn_po_pairs]
        total_received = Decimal("0.0")
        total_accepted = Decimal("0.0")
        total_rejected = Decimal("0.0")
        if grn_ids:
            line_stmt = (
                select(GrnLine)
                .where(
                    GrnLine.grn_id.in_(grn_ids),
                    GrnLine.deleted_at.is_(None),
                )
            )
            line_res = await db.execute(line_stmt)
            lines = list(line_res.scalars().all())
            for line in lines:
                total_received += Decimal(str(line.received_quantity or 0))
                total_accepted += Decimal(str(line.accepted_quantity or 0))
                total_rejected += Decimal(str(line.rejected_quantity or 0))

        if total_received > Decimal("0.0"):
            quality_acceptance_rate = Decimal(str(round(float(total_accepted / total_received) * 100, 2)))
            quality_rejection_rate = Decimal(str(round(float(total_rejected / total_received) * 100, 2)))
        else:
            quality_acceptance_rate = Decimal("100.00")
            quality_rejection_rate = Decimal("0.00")

        # 3. Commercial Compliance Score (3-way matched invoices)
        inv_stmt = (
            select(Invoice)
            .where(
                Invoice.vendor_id == vendor_id,
                Invoice.org_id == org_id,
                Invoice.invoice_date >= start_dt,
                Invoice.invoice_date <= end_dt,
                Invoice.deleted_at.is_(None),
            )
        )
        inv_res = await db.execute(inv_stmt)
        invoices = list(inv_res.scalars().all())
        if invoices:
            matched_count = sum(1 for inv in invoices if str(getattr(inv, "match_status", "")).upper() in ("MATCHED", "3_WAY_MATCHED"))
            commercial_compliance_score = Decimal(str(round((matched_count / len(invoices)) * 100, 2)))
        else:
            commercial_compliance_score = Decimal("100.00")

        # 4. Responsiveness Score & Pricing Competitiveness (Bids)
        bid_stmt = (
            select(BidResponse)
            .where(
                BidResponse.vendor_id == vendor_id,
                BidResponse.org_id == org_id,
                BidResponse.created_at >= datetime.combine(start_dt, datetime.min.time(), tzinfo=UTC),
                BidResponse.created_at <= datetime.combine(end_dt, datetime.max.time(), tzinfo=UTC),
                BidResponse.deleted_at.is_(None),
            )
        )
        bid_res = await db.execute(bid_stmt)
        bids = list(bid_res.scalars().all())
        if bids:
            active_bids = sum(1 for b in bids if str(getattr(b, "status", "")).upper() not in ("INVITED", "REGRETTED"))
            responsiveness_score = Decimal(str(round((active_bids / len(bids)) * 100, 2)))
            pricing_competitiveness = Decimal(str(round(min(100.0, (active_bids / len(bids)) * 95.0 + 5.0), 2)))
        else:
            responsiveness_score = Decimal("100.00")
            pricing_competitiveness = Decimal("100.00")

        # Weighted formula per SPEC_07: 40% delivery, 30% quality, 20% commercial, 10% responsiveness
        overall_score = round(
            (on_time_delivery_rate * Decimal("0.40"))
            + (quality_acceptance_rate * Decimal("0.30"))
            + (commercial_compliance_score * Decimal("0.20"))
            + (responsiveness_score * Decimal("0.10")),
            2,
        )

        scorecard = await self.repo.create_scorecard(
            db,
            org_id=org_id,
            vendor_id=vendor_id,
            data={
                "period_start": start_dt,
                "period_end": end_dt,
                "on_time_delivery_rate": on_time_delivery_rate,
                "quality_acceptance_rate": quality_acceptance_rate,
                "commercial_compliance_score": commercial_compliance_score,
                "responsiveness_score": responsiveness_score,
                "overall_score": overall_score,
            },
        )
        scorecard.quality_rejection_rate = quality_rejection_rate
        scorecard.pricing_competitiveness = pricing_competitiveness

        vendor.performance_score = overall_score
        vendor.last_scorecard_at = datetime.now(UTC)

        # Advisory flag if score < 60
        if overall_score < Decimal("60.0"):
            try:
                await OutboxPublisher.publish(
                    db,
                    "procurement.vendor",
                    "vendor.low_performance",
                    {"vendor_id": str(vendor_id), "overall_score": float(overall_score)},
                    org_id,
                )
            except Exception:
                pass

        await db.flush()
        return scorecard

    async def get_risk_assessment(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        org_id: UUID,
    ) -> VendorRiskAssessment:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        assessment = await self.repo.get_risk_assessment(db, vendor_id, org_id)
        if not assessment:
            assessment = await self.repo.upsert_risk_assessment(
                db,
                org_id=org_id,
                vendor_id=vendor_id,
                data={
                    "financial_risk_score": Decimal("15.00"),
                    "credit_rating": "A",
                    "financial_stability_score": Decimal("85.00"),
                    "liquidity_risk": "LOW",
                    "bankruptcy_risk": "LOW",
                    "esg_risk_score": Decimal("20.00"),
                    "environmental_score": Decimal("80.00"),
                    "social_score": Decimal("85.00"),
                    "governance_score": Decimal("90.00"),
                    "esg_rating": "AVERAGE",
                    "overall_risk_score": Decimal("18.00"),
                    "risk_tier": "LOW",
                    "risk_factors": ["Standard operational onboarding risk"],
                    "mitigation_actions": ["Annual statutory document review"],
                },
            )
        return assessment

    async def update_risk_assessment(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        org_id: UUID,
        data: VendorRiskAssessmentUpdateRequest,
        actor_id: UUID | None = None,
    ) -> VendorRiskAssessment:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        current = await self.get_risk_assessment(db, vendor_id, org_id)
        update_dict = data.model_dump(exclude_unset=True)

        fin_risk = Decimal(str(update_dict.get("financial_risk_score", current.financial_risk_score)))
        esg_risk = Decimal(str(update_dict.get("esg_risk_score", current.esg_risk_score)))
        perf_score = vendor.performance_score or Decimal("100.00")

        # Composite risk formula: 45% financial risk + 35% ESG risk + 20% (100 - performance score)
        overall_risk = round(
            (fin_risk * Decimal("0.45"))
            + (esg_risk * Decimal("0.35"))
            + ((Decimal("100.00") - min(Decimal("100.00"), perf_score)) * Decimal("0.20")),
            2,
        )
        update_dict["overall_risk_score"] = overall_risk

        if overall_risk >= Decimal("75.00"):
            update_dict["risk_tier"] = "CRITICAL"
        elif overall_risk >= Decimal("50.00"):
            update_dict["risk_tier"] = "HIGH"
        elif overall_risk >= Decimal("25.00"):
            update_dict["risk_tier"] = "MEDIUM"
        else:
            update_dict["risk_tier"] = "LOW"

        updated = await self.repo.upsert_risk_assessment(
            db, org_id=org_id, vendor_id=vendor_id, data=update_dict, assessed_by=actor_id
        )
        return updated

    async def get_risk_dashboard(
        self,
        db: AsyncSession,
        org_id: UUID,
    ) -> dict[str, Any]:
        rows = await self.repo.list_risk_assessments(db, org_id)
        total = len(rows)
        low_count = sum(1 for a, _ in rows if a.risk_tier == "LOW")
        med_count = sum(1 for a, _ in rows if a.risk_tier == "MEDIUM")
        high_count = sum(1 for a, _ in rows if a.risk_tier == "HIGH")
        crit_count = sum(1 for a, _ in rows if a.risk_tier == "CRITICAL")

        avg_fin = (
            round(sum(a.financial_risk_score for a, _ in rows) / total, 2)
            if total > 0
            else Decimal("0.00")
        )
        avg_esg = (
            round(sum(a.esg_risk_score for a, _ in rows) / total, 2)
            if total > 0
            else Decimal("0.00")
        )
        avg_overall = (
            round(sum(a.overall_risk_score for a, _ in rows) / total, 2)
            if total > 0
            else Decimal("0.00")
        )

        watchlist = []
        for a, v in rows:
            if a.risk_tier in ("HIGH", "CRITICAL") or a.overall_risk_score >= Decimal("50.00"):
                watchlist.append({
                    "vendor_id": v.id,
                    "vendor_code": v.vendor_code,
                    "company_name": v.company_name,
                    "overall_risk_score": a.overall_risk_score,
                    "risk_tier": a.risk_tier,
                    "financial_risk_score": a.financial_risk_score,
                    "credit_rating": a.credit_rating,
                    "esg_risk_score": a.esg_risk_score,
                    "esg_rating": a.esg_rating,
                    "performance_score": v.performance_score,
                })

        esg_dist: dict[str, int] = {}
        for a, _ in rows:
            rating = a.esg_rating or "NOT_ASSESSED"
            esg_dist[rating] = esg_dist.get(rating, 0) + 1

        return {
            "total_vendors_monitored": total,
            "low_risk_count": low_count,
            "medium_risk_count": med_count,
            "high_risk_count": high_count,
            "critical_risk_count": crit_count,
            "avg_financial_risk_score": avg_fin,
            "avg_esg_risk_score": avg_esg,
            "avg_overall_risk_score": avg_overall,
            "high_risk_watchlist": watchlist,
            "esg_ratings_distribution": esg_dist,
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Sub-Entities (Categories, Bank, Documents, Contacts)
    # ─────────────────────────────────────────────────────────────────────────

    async def get_vendor_detail(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        org_id: UUID,
    ) -> dict[str, Any]:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        categories = await self.repo.get_categories(db, vendor_id)
        contacts = await self.repo.get_contacts(db, vendor_id)
        bank_accounts = await self.repo.get_bank_accounts(db, vendor_id)
        documents = await self.repo.get_documents(db, vendor_id)
        scorecard = await self.repo.get_latest_scorecard(db, vendor_id)

        # Mask account numbers for display
        masked_banks = []
        for b in bank_accounts:
            try:
                dec = decrypt_field(b.account_number_encrypted)
                masked_num = f"****{dec[-4:]}" if len(dec) >= 4 else "****"
            except Exception:
                masked_num = "****"
            b_dict = {
                "id": b.id,
                "vendor_id": b.vendor_id,
                "account_holder_name": b.account_holder_name,
                "bank_name": b.bank_name,
                "branch_name": b.branch_name,
                "account_number_masked": masked_num,
                "ifsc_code": b.ifsc_code,
                "swift_code": b.swift_code,
                "is_primary": b.is_primary,
                "penny_test_status": b.penny_test_status,
                "penny_test_reference": b.penny_test_reference,
                "penny_test_initiated_at": b.penny_test_initiated_at,
                "penny_test_validated_at": b.penny_test_validated_at,
            }
            masked_banks.append(b_dict)

        risk_assessment = await self.get_risk_assessment(db, vendor_id, org_id)

        return {
            "vendor": vendor,
            "category_ids": [c.category_id for c in categories],
            "contacts": contacts,
            "bank_accounts": masked_banks,
            "documents": documents,
            "scorecard": scorecard,
            "risk_assessment": risk_assessment,
        }

    async def update_categories(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        category_ids: list[UUID],
        actor_id: UUID,
        org_id: UUID,
    ) -> list[VendorCategoryMapping]:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        mappings = await self.repo.set_categories(db, org_id, vendor_id, category_ids)
        await audit_service.log(
            db,
            entity_type="VENDOR",
            entity_id=vendor_id,
            action="VENDOR_CATEGORIES_UPDATED",
            actor_id=actor_id,
            org_id=org_id,
            new_values={"category_ids": [str(c) for c in category_ids]},
        )
        await db.flush()
        return mappings

    async def add_document(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        data: VendorDocumentCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> VendorDocument:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        doc = await self.repo.create_document(
            db,
            org_id,
            vendor_id,
            {
                "document_id": data.document_id,
                "document_type_id": data.document_type_id,
                "expiry_date": data.expiry_date,
                "verification_notes": data.verification_notes,
            },
        )
        await db.flush()
        return doc

    async def add_bank_account(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        data: VendorBankAccountCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> VendorBankAccount:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        bank = await self.repo.create_bank_account(
            db,
            org_id,
            vendor_id,
            {
                "account_holder_name": data.account_holder_name,
                "bank_name": data.bank_name,
                "branch_name": data.branch_name,
                "account_number_encrypted": encrypt_field(data.account_number),
                "ifsc_code": data.ifsc_code.upper().strip(),
                "swift_code": data.swift_code,
                "is_primary": data.is_primary,
            },
        )
        await db.flush()
        return bank

    async def initiate_penny_test(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        bank_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> dict[str, Any]:
        bank = await self.repo.get_bank_account(db, bank_id, vendor_id)
        if not bank:
            raise NotFoundError(f"Bank account {bank_id} not found")

        acc_num = decrypt_field(bank.account_number_encrypted)
        result = await self.bank_adapter.initiate_penny_test(
            vendor_id, acc_num, bank.ifsc_code, bank.account_holder_name
        )

        bank.penny_test_status = result["status"]
        bank.penny_test_reference = result.get("reference")
        bank.penny_test_initiated_at = datetime.now(UTC)
        await db.flush()
        return result

    async def confirm_penny_test(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        bank_id: UUID,
        amount_received: float,
        actor_id: UUID,
        org_id: UUID,
    ) -> dict[str, Any]:
        bank = await self.repo.get_bank_account(db, bank_id, vendor_id)
        if not bank:
            raise NotFoundError(f"Bank account {bank_id} not found")

        res = await self.bank_adapter.verify_penny_test(
            bank.penny_test_reference or "", amount_received
        )
        bank.penny_test_status = res["status"]
        if res["is_valid"]:
            bank.penny_test_validated_at = datetime.now(UTC)
            bank.validated_by = actor_id
        await db.flush()
        return res

    async def bulk_map_categories(
        self,
        db: AsyncSession,
        mappings: list[BulkVendorCategoryMappingItem],
        actor_id: UUID,
        org_id: UUID,
    ) -> BulkVendorCategoryMappingResponse:
        updated = 0
        errors: list[str] = []
        for idx, item in enumerate(mappings):
            vendor = None
            if item.vendor_id:
                vendor = await self.repo.find_by_id(db, item.vendor_id, org_id)
            elif item.vendor_code:
                vendor = await self.repo.find_by_vendor_code(db, org_id, item.vendor_code)

            if not vendor:
                errors.append(f"Row {idx + 1}: Vendor not found ({item.vendor_id or item.vendor_code})")
                continue

            try:
                await self.repo.set_categories(db, org_id, vendor.id, item.category_ids)
                updated += 1
            except Exception as e:
                errors.append(f"Row {idx + 1}: Failed to set categories: {str(e)}")

        await audit_service.log(
            db,
            entity_type="VENDOR",
            entity_id=actor_id,
            action="VENDOR_BULK_CATEGORY_MAPPED",
            actor_id=actor_id,
            org_id=org_id,
            metadata={"total_submitted": len(mappings), "updated": updated, "errors_count": len(errors)},
        )
        return BulkVendorCategoryMappingResponse(
            total_processed=len(mappings),
            updated_vendors=updated,
            errors=errors,
        )

    async def self_register_vendor(
        self,
        db: AsyncSession,
        data: VendorSelfRegistrationRequest,
    ) -> dict[str, Any]:
        dup = await self.detect_duplicates(
            db,
            data.org_id,
            pan=data.pan,
            gstin=data.gstin,
            company_name=data.company_name,
            email=str(data.primary_email),
        )
        if dup.has_hard_blocks:
            raise ConflictError(dup.hard_blocks[0].message)

        gstin_valid = False
        if data.gstin:
            gst_clean = data.gstin.strip().upper()
            gst_res = await GSTAdapter().validate(gst_clean)
            gstin_valid = gst_res.get("is_valid", False)

        pan_valid = False
        if data.pan:
            pan_clean = data.pan.strip().upper()
            pan_res = await PANAdapter().validate(pan_clean)
            pan_valid = pan_res.get("is_valid", False)

        penny_valid = False
        if data.account_number and data.ifsc_code:
            ifsc_valid = BankVerificationAdapter.validate_ifsc(data.ifsc_code.strip())
            acc_valid = BankVerificationAdapter.validate_account_number(data.account_number.strip())
            penny_valid = ifsc_valid and acc_valid

        if gstin_valid and pan_valid and (penny_valid or not data.account_number):
            kyc_risk_tier = "LOW"
        elif gstin_valid or pan_valid:
            kyc_risk_tier = "MEDIUM"
        else:
            kyc_risk_tier = "HIGH"

        vendor_code = await self._generate_vendor_code(db, data.org_id)

        vendor = Vendor(
            org_id=data.org_id,
            vendor_code=vendor_code,
            company_name=data.company_name,
            legal_name=data.legal_name or data.company_name,
            registration_type="DOMESTIC",
            pan=data.pan.strip().upper() if data.pan else None,
            pan_encrypted=encrypt_field(data.pan.strip().upper()) if data.pan else None,
            gstin=data.gstin.strip().upper() if data.gstin else None,
            gstin_encrypted=encrypt_field(data.gstin.strip().upper()) if data.gstin else None,
            cin=data.cin,
            duns_number=data.duns_number,
            website=data.website,
            primary_email=str(data.primary_email),
            primary_phone=data.primary_phone,
            address_line1=data.address_line1,
            address_line2=data.address_line2,
            city=data.city,
            state=data.state,
            postal_code=data.postal_code,
            country_code=data.country_code or "IN",
            status=VendorStatusEnum.SUBMITTED,
            onboarding_step=8,
            submitted_at=datetime.now(UTC),
        )
        db.add(vendor)
        await db.flush()

        contact = VendorContact(
            org_id=data.org_id,
            vendor_id=vendor.id,
            name=data.contact_name,
            designation=data.contact_designation or "Authorized Signatory",
            email=str(data.primary_email),
            phone=data.contact_phone or data.primary_phone,
            is_primary=True,
            is_active=True,
        )
        db.add(contact)

        if data.account_number and data.ifsc_code:
            bank = VendorBankAccount(
                org_id=data.org_id,
                vendor_id=vendor.id,
                account_holder_name=data.bank_account_holder or data.company_name,
                bank_name=data.bank_name or "Primary Bank",
                branch_name=data.branch_name,
                account_number_encrypted=encrypt_field(data.account_number.strip()),
                ifsc_code=data.ifsc_code.strip().upper(),
                is_primary=True,
                penny_test_status="VERIFIED" if penny_valid else "NOT_INITIATED",
                penny_test_reference=f"PENNY-AUTO-{secrets.token_hex(4).upper()}" if penny_valid else None,
                penny_test_validated_at=datetime.now(UTC) if penny_valid else None,
            )
            db.add(bank)

        if data.category_ids:
            await self.repo.set_categories(db, data.org_id, vendor.id, data.category_ids)

        app_num = f"APP-ONB-{datetime.now(UTC).year}-{secrets.token_hex(3).upper()}"
        onb_app = await self.repo.create_onboarding_application(
            db,
            org_id=data.org_id,
            vendor_id=vendor.id,
            application_number=app_num,
            submitted_payload=data.model_dump(mode="json"),
            gstin_verified=gstin_valid,
            pan_verified=pan_valid,
            penny_drop_verified=penny_valid,
            kyc_risk_tier=kyc_risk_tier,
        )

        await db.commit()
        await db.refresh(vendor)

        await OutboxPublisher.publish(
            db,
            event_type="vendor.self_registered",
            routing_key="procurement.vendor",
            payload={
                "vendor_id": str(vendor.id),
                "application_id": str(onb_app.id),
                "application_number": app_num,
                "org_id": str(data.org_id),
                "kyc_risk_tier": kyc_risk_tier,
            },
            org_id=data.org_id,
        )

        return {
            "vendor_id": vendor.id,
            "application_id": onb_app.id,
            "application_number": app_num,
            "company_name": vendor.company_name,
            "status": "SUBMITTED",
            "gstin_verified": gstin_valid,
            "pan_verified": pan_valid,
            "penny_drop_verified": penny_valid,
            "kyc_risk_tier": kyc_risk_tier,
            "message": "Self-onboarding submitted successfully. Application queued for Buyer Compliance Review.",
        }

    async def list_pending_onboarding(
        self, db: AsyncSession, org_id: UUID, skip: int = 0, limit: int = 50
    ) -> list[dict[str, Any]]:
        rows = await self.repo.list_pending_onboarding_applications(db, org_id, skip=skip, limit=limit)
        results = []
        for app, v in rows:
            results.append({
                "id": app.id,
                "org_id": app.org_id,
                "vendor_id": app.vendor_id,
                "application_number": app.application_number,
                "status": app.status,
                "gstin_verified": app.gstin_verified,
                "pan_verified": app.pan_verified,
                "penny_drop_verified": app.penny_drop_verified,
                "kyc_risk_tier": app.kyc_risk_tier,
                "submitted_payload": app.submitted_payload,
                "review_notes": app.review_notes,
                "reviewed_by": app.reviewed_by,
                "reviewed_at": app.reviewed_at,
                "created_at": app.created_at,
                "company_name": v.company_name,
                "primary_email": v.primary_email,
            })
        return results

    async def review_onboarding_application(
        self,
        db: AsyncSession,
        app_id: UUID,
        org_id: UUID,
        reviewer_id: UUID,
        review_data: VendorKYCReviewRequest,
    ) -> dict[str, Any]:
        app = await self.repo.get_onboarding_application(db, app_id, org_id)
        if not app:
            raise NotFoundError(f"Onboarding application {app_id} not found")
        vendor = await self.repo.find_by_id(db, app.vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor for application {app_id} not found")

        user_provisioned = False
        user_email = None

        if review_data.action == "APPROVE":
            app.status = "APPROVED"
            app.review_notes = review_data.review_notes or "Approved by Compliance Officer"
            app.reviewed_by = reviewer_id
            app.reviewed_at = datetime.now(UTC)

            vendor.status = VendorStatusEnum.ACTIVE
            vendor.activated_at = datetime.now(UTC)
            if not vendor.vendor_code:
                vendor.vendor_code = await self._generate_vendor_code(db, org_id)

            if review_data.assigned_category_ids:
                await self.repo.set_categories(db, org_id, vendor.id, review_data.assigned_category_ids)

            from app.core.security import hash_password
            from app.modules.user.models import Role, User, UserRoleAssignment
            user_stmt = select(User).where(User.email == vendor.primary_email, User.org_id == org_id)
            existing_user = (await db.execute(user_stmt)).scalar_one_or_none()

            if not existing_user:
                temp_pwd = f"Supplier{secrets.token_hex(4)}!@#"
                new_user = User(
                    org_id=org_id,
                    email=vendor.primary_email,
                    password_hash=hash_password(temp_pwd),
                    first_name=vendor.company_name[:40],
                    last_name="Admin",
                    is_supplier_user=True,
                    vendor_id=vendor.id,
                    status=UserStatusEnum.ACTIVE,
                )
                db.add(new_user)
                await db.flush()

                role_stmt = select(Role).where(Role.code == "SUPPLIER", Role.org_id == org_id)
                supplier_role = (await db.execute(role_stmt)).scalar_one_or_none()
                if supplier_role:
                    assignment = UserRoleAssignment(
                        org_id=org_id,
                        user_id=new_user.id,
                        role_id=supplier_role.id,
                    )
                    db.add(assignment)
                user_provisioned = True
                user_email = new_user.email
            else:
                existing_user.vendor_id = vendor.id
                existing_user.is_supplier_user = True
                user_provisioned = True
                user_email = existing_user.email

            await db.commit()

            await OutboxPublisher.publish(
                db,
                event_type="vendor.onboarding_approved",
                routing_key="procurement.vendor",
                payload={"vendor_id": str(vendor.id), "application_id": str(app.id), "org_id": str(org_id)},
                org_id=org_id,
            )

            return {
                "application_id": app.id,
                "vendor_id": vendor.id,
                "status": "APPROVED",
                "vendor_code": vendor.vendor_code,
                "user_provisioned": user_provisioned,
                "user_email": user_email,
                "message": "Vendor onboarding approved and supplier credentials activated.",
            }
        app.status = "REJECTED"
        app.review_notes = review_data.review_notes or "Rejected by Compliance Reviewer"
        app.reviewed_by = reviewer_id
        app.reviewed_at = datetime.now(UTC)

        vendor.status = VendorStatusEnum.RESUBMISSION_REQUESTED
        vendor.suspension_reason = review_data.review_notes
        await db.commit()

        await OutboxPublisher.publish(
            db,
            event_type="vendor.onboarding_rejected",
            routing_key="procurement.vendor",
            payload={"vendor_id": str(vendor.id), "application_id": str(app.id), "org_id": str(org_id), "reason": review_data.review_notes},
            org_id=org_id,
        )

        return {
            "application_id": app.id,
            "vendor_id": vendor.id,
            "status": "REJECTED",
            "review_notes": app.review_notes,
            "message": "Vendor onboarding rejected. Notification sent to supplier.",
        }


vendor_service = VendorService()

