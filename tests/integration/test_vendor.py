"""
Integration tests for Vendor Management Module (SPEC_07).

Tests cover:
1. test_invite_hashes_token_not_plaintext
2. test_gst_validation_cached
3. test_pan_validation_cached
4. test_blacklist_different_user_required (Segregation of Duties)
5. test_compliance_hold_zero_days
6. test_invalid_fsm_transition
7. test_supplier_cannot_access_other_vendor
8. test_scorecard_calculation
9. test_duplicate_detection_pan_and_gstin
10. test_vendor_bank_account_and_penny_drop
11. test_full_vendor_lifecycle
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import hashlib
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.config import settings
from app.core.exceptions import AppException, ForbiddenError, NotFoundError
from app.db.enums import VendorStatusEnum
from app.main import app
from app.auth.dependencies import get_current_user
from app.modules.user.models import User
from app.modules.user.role_repository import role_repository
from app.modules.vendor.fsm import validate_transition
from app.modules.vendor.models import Vendor, VendorBankAccount, VendorDocument
from app.modules.vendor.schemas import (
    VendorBankAccountCreateRequest,
    VendorInviteRequest,
    VendorRegistrationRequest,
    VendorScorecardUpdateRequest,
    VendorUpdateRequest,
)
from app.modules.vendor.service import vendor_service
from app.tasks.vendor_compliance import async_check_compliance
from integration.adapters.gst import GSTAdapter
from integration.adapters.pan import PANAdapter


test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def create_test_org(db, org_id: UUID) -> None:
    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency)
        VALUES (:id, :name, :legal_name, 'IN', 'INR')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id, "name": f"Org {org_id.hex[:6]}", "legal_name": f"Legal {org_id.hex[:6]}"},
    )
    await db.flush()


async def create_test_user(db, user_id: UUID, org_id: UUID) -> None:
    await create_test_org(db, org_id)
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
        VALUES (:id, :org_id, :email, 'hash', 'Test', 'User', 'ACTIVE', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": user_id, "org_id": org_id, "email": f"user-{user_id.hex[:6]}@test.com"},
    )
async def create_test_doc_type(db, doc_type_id: UUID, org_id: UUID, code: str = "GSTIN_CERTIFICATE") -> None:
    await db.execute(
        text("""
        INSERT INTO document_types (id, org_id, code, name, category, allowed_extensions, is_mandatory, max_file_size_mb, ocr_enabled, is_active, version)
        VALUES (:id, :org_id, :code, :name, 'COMPLIANCE', ARRAY['pdf', 'jpg'], false, 10, false, true, 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": doc_type_id, "org_id": org_id, "code": code, "name": code},
    )
    await db.flush()


async def create_test_document(db, doc_id: UUID, org_id: UUID, entity_id: UUID) -> None:
    await db.execute(
        text("""
        INSERT INTO documents (
            id, org_id, entity_type, entity_id, category,
            original_filename, stored_filename, minio_bucket, minio_key,
            content_type, file_size_bytes, sha256_hash, scan_status, version
        )
        VALUES (
            :id, :org_id, 'VENDOR', :entity_id, 'COMPLIANCE',
            'test.pdf', 'test_stored.pdf', 'docs', 'test/test.pdf',
            'application/pdf', 1024, 'dummyhash123', 'CLEAN', 1
        )
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": doc_id, "org_id": org_id, "entity_id": entity_id},
    )
    await db.flush()


# ─── 1. Invitation Token Hashing ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_invite_hashes_token_not_plaintext():
    """Verify raw invitation token is never stored in the database, only SHA-256 hash."""
    org_id = uuid4()
    actor_id = uuid4()
    company_name = f"Test Corp {uuid4().hex[:6]}"
    email = f"vendor-{uuid4().hex[:6]}@example.com"

    invite_data = VendorInviteRequest(
        company_name=company_name,
        primary_email=email,
        primary_phone="9876543210",
        category_ids=[],
    )

    async with TestSession() as db:
        await create_test_user(db, actor_id, org_id)
        vendor = await vendor_service.invite_vendor(db, invite_data, actor_id=actor_id, org_id=org_id)
        await db.commit()

        # Check in-memory vendor object has _raw_token
        assert hasattr(vendor, "_raw_token")
        raw_token = vendor._raw_token
        assert len(raw_token) >= 32

        # Verify DB stores SHA-256 hash, NOT raw token
        assert vendor.invitation_token != raw_token
        expected_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        assert vendor.invitation_token == expected_hash

        # Retrieval using raw token succeeds
        retrieved = await vendor_service.get_by_invitation_token(db, raw_token)
        assert retrieved.id == vendor.id

        # Retrieval using invalid token raises NotFoundError
        with pytest.raises(NotFoundError):
            await vendor_service.get_by_invitation_token(db, "invalid_raw_token_xyz")


# ─── 2. GST Validation & Redis Caching ───────────────────────────────────────

@pytest.mark.asyncio
async def test_gst_validation_cached():
    """Verify GST validation result is cached in Redis with 90-day TTL."""
    adapter = GSTAdapter()
    test_gstin = "29AABCU9603R1ZJ"
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.setex = AsyncMock()

    with patch.object(adapter, "_get_redis", return_value=mock_redis):
        # 1. First call: cache miss -> queries API and stores in cache
        res1 = await adapter.validate(test_gstin)
        assert res1["is_valid"] is True
        assert res1["gstin"] == test_gstin
        assert mock_redis.setex.called
        call_args = mock_redis.setex.call_args[0]
        assert call_args[1] == settings.VENDOR_GST_CACHE_TTL_DAYS * 86400

        # 2. Second call: cache hit -> returns cached result without API call
        mock_redis.get = AsyncMock(return_value='{"is_valid": true, "gstin": "29AABCU9603R1ZJ", "legal_name": "CACHED"}')
        res2 = await adapter.validate(test_gstin)
        assert res2["legal_name"] == "CACHED"


# ─── 3. PAN Validation & Redis Caching ───────────────────────────────────────

@pytest.mark.asyncio
async def test_pan_validation_cached():
    """Verify PAN validation result is cached in Redis with 90-day TTL."""
    adapter = PANAdapter()
    test_pan = "AABCU9603R"
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.setex = AsyncMock()

    with patch.object(adapter, "_get_redis", return_value=mock_redis):
        res1 = await adapter.validate(test_pan)
        assert res1["is_valid"] is True
        assert res1["pan"] == test_pan
        assert res1["entity_type"] == "COMPANY"
        assert mock_redis.setex.called

        # Second call cache hit
        mock_redis.get = AsyncMock(return_value='{"is_valid": true, "pan": "AABCU9603R", "status": "CACHED"}')
        res2 = await adapter.validate(test_pan)
        assert res2["status"] == "CACHED"


# ─── 4. Blacklisting Segregation of Duties ───────────────────────────────────

@pytest.mark.asyncio
async def test_blacklist_different_user_required():
    """Initiator cannot confirm blacklist (Segregation of Duties)."""
    org_id = uuid4()
    initiator_id = uuid4()
    approver_id = uuid4()

    async with TestSession() as db:
        await create_test_user(db, initiator_id, org_id)
        await create_test_user(db, approver_id, org_id)

        vendor = Vendor(
            org_id=org_id,
            company_name=f"Vendor SoD {uuid4().hex[:6]}",
            primary_email=f"sod-{uuid4().hex[:6]}@example.com",
            status=VendorStatusEnum.ACTIVE,
        )
        db.add(vendor)
        await db.commit()
        await db.refresh(vendor)

        # 1. Initiator initiates blacklist
        await vendor_service.initiate_blacklist(
            db,
            vendor_id=vendor.id,
            reason="Material breach of contract",
            actor_id=initiator_id,
            org_id=org_id,
        )
        await db.commit()

        # 2. Initiator attempts to confirm -> ForbiddenError
        with pytest.raises(ForbiddenError) as exc_info:
            await vendor_service.confirm_blacklist(
                db,
                vendor_id=vendor.id,
                workflow_task_id=None,
                actor_id=initiator_id,
                org_id=org_id,
                reason="Attempt self-confirmation",
            )
        assert "Initiator cannot confirm blacklisting" in str(exc_info.value)

        # 3. Different user confirms -> Succeeds
        updated_vendor = await vendor_service.confirm_blacklist(
            db,
            vendor_id=vendor.id,
            workflow_task_id=None,
            actor_id=approver_id,
            org_id=org_id,
            reason="Approved by compliance head",
        )
        await db.commit()
        assert updated_vendor.status == VendorStatusEnum.BLACKLISTED
        assert updated_vendor.blacklist_confirmed_by == approver_id


# ─── 5. Compliance Hold Auto-Trigger on Expiry ───────────────────────────────

@pytest.mark.asyncio
async def test_compliance_hold_zero_days():
    """Expired document triggers automatic COMPLIANCE_HOLD on active vendor."""
    org_id = uuid4()
    doc_type_id = uuid4()

    async with TestSession() as db:
        await create_test_org(db, org_id)
        await create_test_doc_type(db, doc_type_id, org_id)
        vendor = Vendor(
            org_id=org_id,
            company_name=f"Expiring Vendor {uuid4().hex[:6]}",
            primary_email=f"expiry-{uuid4().hex[:6]}@example.com",
            status=VendorStatusEnum.ACTIVE,
        )
        db.add(vendor)
        await db.flush()

        doc_id = uuid4()
        await create_test_document(db, doc_id, org_id, vendor.id)
        expired_doc = VendorDocument(
            org_id=org_id,
            vendor_id=vendor.id,
            document_id=doc_id,
            document_type_id=doc_type_id,
            expiry_date=date.today() - timedelta(days=2),  # Expired 2 days ago
            verification_status="VERIFIED",
        )
        db.add(expired_doc)
        await db.commit()
        vendor_id = vendor.id

    # Run compliance check using TestSession
    res = await async_check_compliance(session_factory=TestSession)
    assert res["holds_placed"] >= 1

    async with TestSession() as db:
        updated = await vendor_service.repo.find_by_id(db, vendor_id, org_id)
        assert updated.status == VendorStatusEnum.COMPLIANCE_HOLD
        assert "expired" in (updated.suspension_reason or "").lower()


# ─── 6. FSM Transitions Enforcement ──────────────────────────────────────────

def test_invalid_fsm_transition():
    """Validate that FSM blocks unauthorized status jumps."""
    with pytest.raises(AppException) as exc:
        validate_transition("BLACKLISTED", "ACTIVE")
    assert exc.value.code == "INVALID_STATUS_TRANSITION"

    with pytest.raises(AppException):
        validate_transition("INVITED", "ACTIVE")

    with pytest.raises(AppException):
        validate_transition("ACTIVE", "SUBMITTED")

    # Valid transitions do not raise
    validate_transition("INVITED", "REGISTRATION_IN_PROGRESS")
    validate_transition("ACTIVE", "SUSPENDED")
    validate_transition("SUSPENDED", "ACTIVE")
    validate_transition("ACTIVE", "COMPLIANCE_HOLD")
    validate_transition("COMPLIANCE_HOLD", "ACTIVE")


# ─── 7. Supplier User Boundary (403 on Other Vendor) ─────────────────────────

def test_supplier_cannot_access_other_vendor():
    """Supplier user with vendor_id A gets 403 Forbidden when requesting vendor B."""
    vendor_a_id = uuid4()
    vendor_b_id = uuid4()
    org_id = uuid4()

    supplier_user = MagicMock(spec=User)
    supplier_user.id = uuid4()
    supplier_user.org_id = org_id
    supplier_user.email = "supplier@vendor-a.com"
    supplier_user.is_supplier_user = True
    supplier_user.vendor_id = vendor_a_id
    supplier_user.roles = ["SUPPLIER"]

    app.dependency_overrides[get_current_user] = lambda: supplier_user

    with patch.object(role_repository, "user_has_permission", AsyncMock(return_value=True)):
        with TestClient(app) as client:
            # 1. Access other vendor B -> 403 Forbidden
            res = client.get(f"/api/v1/vendors/{vendor_b_id}")
            assert res.status_code == 403

            # 2. Access all vendors list -> 403 Forbidden
            res_list = client.get("/api/v1/vendors")
            assert res_list.status_code == 403

    app.dependency_overrides.clear()


# ─── 8. Vendor Scorecard Calculation ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_scorecard_calculation():
    """Verify scorecard calculates 40/30/20/10 weighted average accurately."""
    org_id = uuid4()

    async with TestSession() as db:
        await create_test_org(db, org_id)
        vendor = Vendor(
            org_id=org_id,
            company_name=f"Scorecard Vendor {uuid4().hex[:6]}",
            primary_email=f"score-{uuid4().hex[:6]}@example.com",
            status=VendorStatusEnum.ACTIVE,
        )
        db.add(vendor)
        await db.commit()
        await db.refresh(vendor)

        data = VendorScorecardUpdateRequest(
            on_time_delivery_rate=Decimal("90.0"),
            quality_acceptance_rate=Decimal("95.0"),
            commercial_compliance_score=Decimal("80.0"),
            responsiveness_score=Decimal("85.0"),
        )
        # Expected: (90*0.4) + (95*0.3) + (80*0.2) + (85*0.1)
        # = 36.0 + 28.5 + 16.0 + 8.5 = 89.0
        scorecard = await vendor_service.update_scorecard(db, vendor.id, org_id, data)
        await db.commit()

        assert scorecard.overall_score == Decimal("89.00")
        assert vendor.performance_score == Decimal("89.00")
        assert scorecard.on_time_delivery_rate == Decimal("90.00")
        assert scorecard.quality_acceptance_rate == Decimal("95.00")


# ─── 9. Duplicate Detection (GSTIN / PAN / Similarity) ───────────────────────

@pytest.mark.asyncio
async def test_duplicate_detection_pan_and_gstin():
    """Verify hard block on matching PAN/GSTIN and soft warning on similar name."""
    org_id = uuid4()
    existing_pan = "AAACB1234F"
    existing_gstin = "29AAACB1234F1Z5"
    existing_name = "Acme Global Solutions Pvt Ltd"

    async with TestSession() as db:
        await create_test_org(db, org_id)
        v1 = Vendor(
            org_id=org_id,
            company_name=existing_name,
            primary_email="contact@acme.com",
            pan=existing_pan,
            gstin=existing_gstin,
            status=VendorStatusEnum.ACTIVE,
        )
        db.add(v1)
        await db.commit()

        # Check duplicate GSTIN
        res_gst = await vendor_service.detect_duplicates(db, org_id, gstin=existing_gstin)
        assert res_gst.has_hard_blocks is True
        assert any(b.code == "GSTIN_DUPLICATE" for b in res_gst.hard_blocks)

        # Check duplicate PAN
        res_pan = await vendor_service.detect_duplicates(db, org_id, pan=existing_pan)
        assert res_pan.has_hard_blocks is True
        assert any(b.code == "PAN_DUPLICATE" for b in res_pan.hard_blocks)

        # Check similar company name (>85% match)
        res_name = await vendor_service.detect_duplicates(
            db, org_id, company_name="Acme Global Solutions Private Limited"
        )
        assert res_name.has_soft_warnings is True
        assert any(w.code == "NAME_SIMILAR" for w in res_name.soft_warnings)


# ─── 10. Bank Account & Penny Drop Simulation ────────────────────────────────

@pytest.mark.asyncio
async def test_vendor_bank_account_and_penny_drop():
    """Add bank account and complete penny drop verification."""
    org_id = uuid4()
    actor_id = uuid4()

    async with TestSession() as db:
        await create_test_user(db, actor_id, org_id)
        vendor = Vendor(
            org_id=org_id,
            company_name=f"Bank Test Vendor {uuid4().hex[:6]}",
            primary_email=f"bank-{uuid4().hex[:6]}@example.com",
            status=VendorStatusEnum.ACTIVE,
        )
        db.add(vendor)
        await db.commit()
        await db.refresh(vendor)

        bank_payload = VendorBankAccountCreateRequest(
            account_holder_name="Acme Corp",
            bank_name="HDFC Bank",
            branch_name="Bangalore Main",
            account_number="123456789012",
            ifsc_code="HDFC0000001",
            is_primary=True,
        )

        bank = await vendor_service.add_bank_account(db, vendor.id, bank_payload, actor_id, org_id)
        await db.commit()
        assert bank.penny_test_status == "NOT_INITIATED"

        # Initiate penny test
        init_res = await vendor_service.initiate_penny_test(db, vendor.id, bank.id, actor_id, org_id)
        assert init_res["status"] == "PENNY_TEST_INITIATED"
        test_amount = init_res.get("amount", 1.00)

        # Confirm penny test with incorrect amount -> FAILS
        fail_res = await vendor_service.confirm_penny_test(
            db, vendor.id, bank.id, amount_received=99.99, actor_id=actor_id, org_id=org_id
        )
        assert fail_res["is_valid"] is False
        assert fail_res["status"] == "FAILED"

        # Confirm penny test with correct amount -> SUCCEEDS
        pass_res = await vendor_service.confirm_penny_test(
            db, vendor.id, bank.id, amount_received=test_amount, actor_id=actor_id, org_id=org_id
        )
        assert pass_res["is_valid"] is True
        assert pass_res["status"] == "VALIDATED"
        assert bank.penny_test_validated_at is not None


# ─── 11. Full Lifecycle Transition Verification ──────────────────────────────

@pytest.mark.asyncio
async def test_full_vendor_lifecycle():
    """Test standard progression: INVITED -> REG_IN_PROGRESS -> SUBMITTED -> QUALIFIED -> ACTIVE."""
    org_id = uuid4()
    actor_id = uuid4()

    async with TestSession() as db:
        await create_test_user(db, actor_id, org_id)

        # 1. Invite
        invite_data = VendorInviteRequest(
            company_name=f"Lifecycle Vendor {uuid4().hex[:6]}",
            primary_email=f"life-{uuid4().hex[:6]}@example.com",
        )
        vendor = await vendor_service.invite_vendor(db, invite_data, actor_id, org_id)
        await db.commit()
        assert vendor.status == VendorStatusEnum.INVITED

        # 2. Register with token -> REGISTRATION_IN_PROGRESS
        raw_token = vendor._raw_token
        reg_data = VendorRegistrationRequest(
            company_name=vendor.company_name,
            legal_name="Lifecycle Vendor LLC",
            pan="AAACP9999K",
            gstin="29AAACP9999K1Z5",
        )
        registered = await vendor_service.register_with_token(db, raw_token, reg_data)
        await db.commit()
        assert registered.status == VendorStatusEnum.REGISTRATION_IN_PROGRESS

        # 3. Add required documents & submit -> SUBMITTED
        doc_types = ["GSTIN_CERTIFICATE", "PAN_CARD", "BANK_DETAILS", "INCORPORATION_CERTIFICATE"]
        for dt in doc_types:
            dt_id = uuid4()
            await create_test_doc_type(db, dt_id, org_id, dt)
            doc_id = uuid4()
            await create_test_document(db, doc_id, org_id, vendor.id)
            doc_rec = VendorDocument(
                org_id=org_id,
                vendor_id=vendor.id,
                document_id=doc_id,
                document_type_id=dt_id,
                verification_notes=dt,
                verification_status="PENDING",
            )
            db.add(doc_rec)
        await db.commit()

        submitted = await vendor_service.submit_registration(db, vendor.id, None, actor_id, org_id)
        await db.commit()
        assert submitted.status == VendorStatusEnum.SUBMITTED

        # 4. Qualify -> QUALIFIED
        qualified = await vendor_service.qualify(db, vendor.id, actor_id, org_id)
        await db.commit()
        assert qualified.status == VendorStatusEnum.QUALIFIED

        # 5. Activate -> ACTIVE with vendor code
        activated = await vendor_service.activate_vendor(db, vendor.id, actor_id, org_id)
        await db.commit()
        assert activated.status == VendorStatusEnum.ACTIVE
        assert activated.vendor_code is not None
        assert activated.vendor_code.startswith("VND-")
