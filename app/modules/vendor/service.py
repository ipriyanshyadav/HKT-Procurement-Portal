from __future__ import annotations
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
import difflib
import hashlib
import json
import secrets
from typing import Optional, List, Tuple, Any
from uuid import UUID

from loguru import logger
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.constants import AuditAction
from app.core.encryption import encrypt_field, decrypt_field
from app.core.exceptions import (
    AppException,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from app.core.security import mask_pii
from app.db.enums import VendorStatusEnum
from app.events.publisher import OutboxPublisher
from app.modules.audit.service import audit_service
from app.modules.vendor.fsm import validate_transition
from app.modules.vendor.models import (
    Vendor,
    VendorBankAccount,
    VendorCategoryMapping,
    VendorContact,
    VendorDocument,
    VendorScorecard,
)
from app.modules.vendor.repository import VendorRepository, vendor_repository
from app.modules.vendor.schemas import (
    DuplicateCheckResult,
    DuplicateMatch,
    PennyTestConfirmRequest,
    VendorBankAccountCreateRequest,
    VendorContactCreateRequest,
    VendorDocumentCreateRequest,
    VendorInviteRequest,
    VendorRegistrationRequest,
    VendorScorecardUpdateRequest,
    VendorUpdateRequest,
)
from integration.adapters.bank import BankVerificationAdapter
from integration.adapters.gst import GSTAdapter
from integration.adapters.pan import PANAdapter


class VendorService:
    def __init__(
        self,
        repo: Optional[VendorRepository] = None,
        gst_adapter: Optional[GSTAdapter] = None,
        pan_adapter: Optional[PANAdapter] = None,
        bank_adapter: Optional[BankVerificationAdapter] = None,
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
        pan: Optional[str] = None,
        gstin: Optional[str] = None,
        company_name: Optional[str] = None,
        email: Optional[str] = None,
        bank_account: Optional[str] = None,
        ifsc: Optional[str] = None,
        exclude_vendor_id: Optional[UUID] = None,
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
                if similarity > 0.85:
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

    async def _validate_gstin(self, gstin: Optional[str], org_id: UUID) -> dict[str, Any]:
        if not gstin:
            return {"is_valid": True, "status": "SKIPPED"}
        return await self.gst_adapter.validate(gstin)

    async def _validate_pan(self, pan: Optional[str], org_id: UUID) -> dict[str, Any]:
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
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.INVITATION_TOKEN_TTL_DAYS)

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
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < datetime.now(timezone.utc):
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
        data: Optional[Any] = None,
        actor_id: Optional[UUID] = None,
        org_id: Optional[UUID] = None,
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
        vendor.submitted_at = datetime.now(timezone.utc)
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
        notes: Optional[str] = None,
    ) -> Vendor:
        vendor = await self.repo.find_by_id(db, vendor_id, org_id)
        if not vendor:
            raise NotFoundError(f"Vendor {vendor_id} not found")

        # Support transitioning from SUBMITTED or UNDER_REVIEW
        if vendor.status == VendorStatusEnum.SUBMITTED:
            vendor.status = VendorStatusEnum.UNDER_REVIEW

        validate_transition(vendor.status, "QUALIFIED")

        vendor.status = VendorStatusEnum.QUALIFIED
        vendor.qualified_at = datetime.now(timezone.utc)
        vendor.updated_by = actor_id

        # Mark category mappings as qualified
        cats = await self.repo.get_categories(db, vendor.id)
        for c in cats:
            c.is_qualified = True
            c.qualified_at = datetime.now(timezone.utc)

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
        vendor.activated_at = datetime.now(timezone.utc)
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
        reason: Optional[str] = None,
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
        workflow_task_id: Optional[UUID],
        actor_id: UUID,
        org_id: UUID,
        reason: Optional[str] = None,
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
        vendor.blacklisted_at = datetime.now(timezone.utc)
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
        data: Optional[VendorScorecardUpdateRequest] = None,
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

        vendor.performance_score = round(overall, 2)
        vendor.last_scorecard_at = datetime.now(timezone.utc)

        await db.flush()
        return scorecard

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

        return {
            "vendor": vendor,
            "category_ids": [c.category_id for c in categories],
            "contacts": contacts,
            "bank_accounts": masked_banks,
            "documents": documents,
            "scorecard": scorecard,
        }

    async def update_categories(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        category_ids: List[UUID],
        actor_id: UUID,
        org_id: UUID,
    ) -> List[VendorCategoryMapping]:
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
        bank.penny_test_initiated_at = datetime.now(timezone.utc)
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
            bank.penny_test_validated_at = datetime.now(timezone.utc)
            bank.validated_by = actor_id
        await db.flush()
        return res


vendor_service = VendorService()
