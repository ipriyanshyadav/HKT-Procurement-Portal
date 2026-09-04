"""
Integration tests for SPEC_13 Contract Management:
- S13-01 / S13-02: Contract creation & 10-status lifecycle FSM
- S13-03 / S13-04: Auto-numbering and creation from approved award recommendation
- S13-05 / S13-10: Milestone tracking and completion
- S13-06: eSign workflow integration (Digio & DocuSign)
- S13-07: Versioned contract amendments with full pre-change snapshot
- S13-08 / S13-09: Auto-renewal & expiry check (90/60/30/0 days)
- S13-17: Rate contract value utilization with optimistic lock validation
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.main  # noqa: F401
from app.config import settings
from app.core.exceptions import AppException, NotFoundError, ValidationError
from app.db.enums import ContractStatus
from app.modules.contract.fsm import can_transition, validate_contract_transition
from app.modules.contract.models import Contract, ContractLine, ContractMilestone
from app.modules.contract.repository import contract_repository
from app.modules.contract.schemas import (
    ContractAmendRequest,
    ContractCreateRequest,
    ContractFromAwardRequest,
    ContractLineCreate,
    ContractMilestoneCreate,
)
from app.modules.contract.service import contract_service
from app.tasks.contract_expiry import async_check_contract_expiry

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def create_contract_fixtures(db: AsyncSession, org_id):
    buyer_id = uuid4()
    vendor_id = uuid4()
    bu_id = uuid4()
    cat_id = uuid4()
    uom_id = uuid4()
    le_id = uuid4()
    rfq_id = uuid4()
    arn_id = uuid4()

    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, :name, :legal_name, 'IN', 'INR', '{"budget_check_config": {"default_mode": "soft"}}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id, "name": f"Org {org_id.hex[:6]}", "legal_name": f"Legal {org_id.hex[:6]}"},
    )

    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
        VALUES (:id, :org_id, :email, 'hash', 'Buyer', 'One', 'ACTIVE', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": buyer_id, "org_id": org_id, "email": f"buyer-{buyer_id.hex[:6]}@test.com"},
    )

    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, country_code)
        VALUES (:id, :org_id, 'Test Entity', :reg, 'IN') ON CONFLICT (id) DO NOTHING
        """),
        {"id": le_id, "org_id": org_id, "reg": f"REG{le_id.hex[:8]}"},
    )
    await db.execute(
        text("""
        INSERT INTO business_units (id, org_id, name, code, legal_entity_id)
        VALUES (:id, :org_id, 'Test BU', :code, :le_id) ON CONFLICT (id) DO NOTHING
        """),
        {"id": bu_id, "org_id": org_id, "code": f"BU{bu_id.hex[:4]}", "le_id": le_id},
    )
    await db.execute(
        text("""
        INSERT INTO categories (id, org_id, name, code, level)
        VALUES (:id, :org_id, 'Test Cat', :code, 1) ON CONFLICT (id) DO NOTHING
        """),
        {"id": cat_id, "org_id": org_id, "code": f"C{cat_id.hex[:6]}"},
    )
    await db.execute(
        text("""
        INSERT INTO uom_master (id, org_id, name, code)
        VALUES (:id, :org_id, 'Each', 'EA') ON CONFLICT (id) DO NOTHING
        """),
        {"id": uom_id, "org_id": org_id},
    )

    await db.execute(
        text("""
        INSERT INTO vendors (id, org_id, vendor_code, company_name, primary_email, status, version)
        VALUES (:id, :org_id, :code, :name, :email, 'ACTIVE', 1) ON CONFLICT (id) DO NOTHING
        """),
        {"id": vendor_id, "org_id": org_id, "code": f"V{vendor_id.hex[:4]}", "name": "Alpha Vendor Ltd", "email": f"vendor-{vendor_id.hex[:4]}@test.com"},
    )

    # RFQ
    await db.execute(
        text("""
        INSERT INTO rfqs (id, org_id, rfq_number, title, status, sourcing_type, rfq_type,
                          buyer_id, business_unit_id, category_id, estimated_value, currency)
        VALUES (:id, :org_id, :num, 'Contract RFQ', 'UNDER_EVALUATION', 'GOODS', 'LIMITED_TENDER',
                :buyer_id, :bu_id, :cat_id, 500000.00, 'INR')
        ON CONFLICT (id) DO NOTHING
        """),
        {
            "id": rfq_id,
            "org_id": org_id,
            "num": f"RFQ-{rfq_id.hex[:6]}",
            "buyer_id": buyer_id,
            "bu_id": bu_id,
            "cat_id": cat_id,
        },
    )

    # CS
    cs_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO comparative_statements (id, org_id, rfq_id, cs_number, status, cost_of_capital_rate,
                                           evaluation_methodology, total_estimated_value, generated_by)
        VALUES (:id, :org_id, :rfq_id, :cs_num, 'APPROVED', 0.10, 'L1', 500000.00, :gen_by)
        ON CONFLICT (id) DO NOTHING
        """),
        {
            "id": cs_id,
            "org_id": org_id,
            "rfq_id": rfq_id,
            "cs_num": f"CS-{cs_id.hex[:6]}",
            "gen_by": buyer_id,
        },
    )

    # Award recommendation
    await db.execute(
        text("""
        INSERT INTO award_recommendations (id, org_id, rfq_id, cs_id, arn_number, status, justification, total_awarded_value, recommended_by)
        VALUES (:id, :org_id, :rfq_id, :cs_id, :num, 'APPROVED', 'L1 vendor selection based on commercial evaluation', 250000.00, :rec_by)
        ON CONFLICT (id) DO NOTHING
        """),
        {
            "id": arn_id,
            "org_id": org_id,
            "rfq_id": rfq_id,
            "cs_id": cs_id,
            "num": f"ARN-{arn_id.hex[:6]}",
            "rec_by": buyer_id,
        },
    )

    # Bid
    bid_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO bid_responses (id, org_id, rfq_id, vendor_id, status)
        VALUES (:id, :org_id, :rfq_id, :vendor_id, 'SUBMITTED')
        ON CONFLICT (id) DO NOTHING
        """),
        {
            "id": bid_id,
            "org_id": org_id,
            "rfq_id": rfq_id,
            "vendor_id": vendor_id,
        },
    )

    # Award detail
    await db.execute(
        text("""
        INSERT INTO award_details (id, org_id, arn_id, vendor_id, bid_id, awarded_unit_price, awarded_quantity, awarded_total, award_type)
        VALUES (gen_random_uuid(), :org_id, :arn_id, :vendor_id, :bid_id, 2500.0, 100.0, 250000.0, 'FULL')
        """),
        {"org_id": org_id, "arn_id": arn_id, "vendor_id": vendor_id, "bid_id": bid_id},
    )

    await db.commit()
    return {
        "buyer_id": buyer_id,
        "vendor_id": vendor_id,
        "bu_id": bu_id,
        "cat_id": cat_id,
        "uom_id": uom_id,
        "rfq_id": rfq_id,
        "arn_id": arn_id,
    }


# ─── Tests ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_contract_creation_and_fsm(org_id):
    """Test manual contract creation with lines/milestones and valid FSM transitions."""
    async with TestSession() as db:
        fix = await create_contract_fixtures(db, org_id)

        req = ContractCreateRequest(
            title="Enterprise Cloud Services Agreement",
            vendor_id=fix["vendor_id"],
            contract_type="RATE_CONTRACT",
            currency="INR",
            total_value=Decimal("500000.00"),
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            business_unit_id=fix["bu_id"],
            category_id=fix["cat_id"],
            lines=[
                ContractLineCreate(
                    line_number=1,
                    item_description="Cloud Compute Unit",
                    uom_id=fix["uom_id"],
                    contracted_quantity=Decimal("100"),
                    unit_rate=Decimal("5000.00"),
                    hsn_code="998313",
                )
            ],
            milestones=[
                ContractMilestoneCreate(
                    title="Phase 1 Onboarding",
                    due_date=date.today() + timedelta(days=30),
                    responsible_party="VENDOR",
                )
            ],
        )

        contract = await contract_service.create_contract(db, req, fix["buyer_id"], org_id)

        assert contract.id is not None
        assert contract.status == "DRAFT"
        assert contract.contract_number.startswith("CNT-")
        assert len(contract.lines) == 1
        assert len(contract.milestones) == 1
        assert contract.days_remaining >= 360
        assert contract.expiry_warning_level == "SAFE"

        await db.commit()

        # FSM check: DRAFT -> PENDING_REVIEW is valid
        assert can_transition("DRAFT", "PENDING_REVIEW") is True
        assert can_transition("DRAFT", "ACTIVE") is False

        # Transition to PENDING_REVIEW
        c_reviewed = await contract_service.update_status(db, contract.id, "PENDING_REVIEW", fix["buyer_id"], org_id)
        await db.commit()
        assert c_reviewed.status == "PENDING_REVIEW"

        # Invalid transition PENDING_REVIEW -> EXPIRED should raise AppException
        with pytest.raises(AppException) as exc_info:
            await contract_service.update_status(db, contract.id, "EXPIRED", fix["buyer_id"], org_id)
        assert exc_info.value.code == "INVALID_STATE_TRANSITION"


@pytest.mark.asyncio
async def test_contract_from_unapproved_award_fails(org_id):
    """Attempting to create contract from unapproved award must fail with AWARD_NOT_APPROVED."""
    async with TestSession() as db:
        fix = await create_contract_fixtures(db, org_id)
        unapproved_arn = uuid4()

        # Insert DRAFT award recommendation
        await db.execute(
            text("""
            INSERT INTO award_recommendations (id, org_id, rfq_id, cs_id, arn_number, status, justification, total_awarded_value, recommended_by)
            VALUES (:id, :org_id, :rfq_id, (SELECT id FROM comparative_statements WHERE rfq_id = :rfq_id LIMIT 1), :num, 'DRAFT', 'Draft recommendation', 100000.00, :rec_by)
            """),
            {
                "id": unapproved_arn,
                "org_id": org_id,
                "rfq_id": fix["rfq_id"],
                "num": f"ARN-DRAFT-{unapproved_arn.hex[:4]}",
                "rec_by": fix["buyer_id"],
            },
        )
        await db.commit()

        req = ContractFromAwardRequest(award_recommendation_id=unapproved_arn)
        with pytest.raises(AppException) as exc_info:
            await contract_service.create_from_award(db, unapproved_arn, req, fix["buyer_id"], org_id)
        assert exc_info.value.code == "AWARD_NOT_APPROVED"


@pytest.mark.asyncio
async def test_contract_from_approved_award_success(org_id):
    """Creating contract from approved award recommendation populates vendor, value and lines."""
    async with TestSession() as db:
        fix = await create_contract_fixtures(db, org_id)

        req = ContractFromAwardRequest(
            award_recommendation_id=fix["arn_id"],
            title="Awarded Hardware Procurement Contract",
            auto_renew=True,
            renewal_notice_days=45,
        )

        contract = await contract_service.create_from_award(db, fix["arn_id"], req, fix["buyer_id"], org_id)

        assert contract.id is not None
        assert contract.status == "DRAFT"
        assert contract.vendor_id == fix["vendor_id"]
        assert contract.total_value == Decimal("250000.00")
        assert contract.auto_renew is True
        assert contract.renewal_notice_days == 45
        assert len(contract.lines) >= 1
        assert contract.lines[0].unit_rate == Decimal("2500.0000")

        await db.commit()


@pytest.mark.asyncio
async def test_esign_workflow_digio_and_docusign(org_id):
    """Initiate and confirm eSign workflow via Digio and DocuSign fallback."""
    async with TestSession() as db:
        fix = await create_contract_fixtures(db, org_id)

        # 1. Digio flow
        req = ContractCreateRequest(
            title="Digio eSign Contract",
            vendor_id=fix["vendor_id"],
            total_value=Decimal("150000.00"),
            start_date=date.today(),
            end_date=date.today() + timedelta(days=180),
            business_unit_id=fix["bu_id"],
            category_id=fix["cat_id"],
        )
        contract = await contract_service.create_contract(db, req, fix["buyer_id"], org_id)
        await db.commit()

        # Advance to PENDING_REVIEW first
        await contract_service.update_status(db, contract.id, "PENDING_REVIEW", fix["buyer_id"], org_id)
        await db.commit()

        # Initiate Digio eSign
        esign_res = await contract_service.initiate_esign(
            db, contract.id, fix["buyer_id"], org_id, provider_override="digio"
        )
        await db.commit()

        assert esign_res["provider"] == "digio"
        assert esign_res["request_id"].startswith("DIGIO-REQ-")
        assert contract.status == "PENDING_ESIGN"
        assert contract.esign_provider == "digio"
        assert contract.contract_document_path is not None

        # Confirm completion
        active_contract = await contract_service.confirm_esign_complete(
            db, contract.id, "minio/contract-documents/signed.pdf", fix["buyer_id"], org_id
        )
        await db.commit()

        assert active_contract.status == "ACTIVE"
        assert active_contract.activated_at is not None
        assert active_contract.signed_document_path == "minio/contract-documents/signed.pdf"

        # 2. DocuSign fallback flow
        contract2 = await contract_service.create_contract(db, req, fix["buyer_id"], org_id)
        await db.commit()
        await contract_service.update_status(db, contract2.id, "PENDING_REVIEW", fix["buyer_id"], org_id)
        await db.commit()

        docusign_res = await contract_service.initiate_esign(
            db, contract2.id, fix["buyer_id"], org_id, provider_override="docusign"
        )
        await db.commit()

        assert docusign_res["provider"] == "docusign"
        assert docusign_res["request_id"].startswith("DOCU-ENV-")
        assert contract2.esign_provider == "docusign"


@pytest.mark.asyncio
async def test_amendment_creates_snapshot(org_id):
    """Contract amendment increments count, creates snapshot of previous state, and updates values."""
    async with TestSession() as db:
        fix = await create_contract_fixtures(db, org_id)

        req = ContractCreateRequest(
            title="Contract for Amendment",
            vendor_id=fix["vendor_id"],
            total_value=Decimal("100000.00"),
            start_date=date.today(),
            end_date=date.today() + timedelta(days=100),
            business_unit_id=fix["bu_id"],
            category_id=fix["cat_id"],
        )
        contract = await contract_service.create_contract(db, req, fix["buyer_id"], org_id)
        contract.status = "ACTIVE"
        await db.commit()

        # Amend contract: value increase & extension
        new_val = Decimal("150000.00")
        new_end = date.today() + timedelta(days=200)
        amend_req = ContractAmendRequest(
            amendment_type="VALUE_AND_TIME_EXTENSION",
            change_description="Scope expansion: adding 50k and 100 days",
            new_total_value=new_val,
            new_end_date=new_end,
        )

        amended_contract = await contract_service.amend_contract(
            db, contract.id, amend_req, fix["buyer_id"], org_id
        )
        await db.commit()

        assert amended_contract.status == "AMENDED"
        assert amended_contract.amendment_count == 1
        assert amended_contract.total_value == new_val
        assert amended_contract.end_date == new_end

        # Verify snapshot in amendments table
        amendments = await contract_repository.get_amendments(db, contract.id, org_id)
        assert len(amendments) == 1
        amendment = amendments[0]
        assert amendment.amendment_number == 1
        assert amendment.original_snapshot["total_value"] == 100000.0
        assert amendment.amendment_type == "VALUE_AND_TIME_EXTENSION"


@pytest.mark.asyncio
async def test_rate_contract_utilization_and_validation(org_id):
    """Rate contract utilization increments utilized_value and raises ValidationError on overflow."""
    async with TestSession() as db:
        fix = await create_contract_fixtures(db, org_id)

        req = ContractCreateRequest(
            title="Rate Contract for Utilization",
            vendor_id=fix["vendor_id"],
            contract_type="RATE_CONTRACT",
            total_value=Decimal("200000.00"),
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            business_unit_id=fix["bu_id"],
            category_id=fix["cat_id"],
        )
        contract = await contract_service.create_contract(db, req, fix["buyer_id"], org_id)
        contract.status = "ACTIVE"
        await db.commit()

        # 1st PO: 80,000 -> OK
        c1 = await contract_service.update_utilization(db, contract.id, 80000.00, org_id)
        await db.commit()
        assert c1.utilized_value == Decimal("80000.00")
        assert c1.version == 2

        # 2nd PO: 150,000 -> Exceeds 200,000 total (80,000 + 150,000 = 230,000 > 200,000)
        with pytest.raises(ValidationError) as exc_info:
            await contract_service.update_utilization(db, contract.id, 150000.00, org_id)
        assert exc_info.value.code == "CONTRACT_VALUE_EXCEEDED"


@pytest.mark.asyncio
async def test_milestone_completion(org_id):
    """Mark milestone completed updates completion date and notes."""
    async with TestSession() as db:
        fix = await create_contract_fixtures(db, org_id)

        req = ContractCreateRequest(
            title="Contract with Milestones",
            vendor_id=fix["vendor_id"],
            total_value=Decimal("50000.00"),
            start_date=date.today(),
            end_date=date.today() + timedelta(days=60),
            business_unit_id=fix["bu_id"],
            category_id=fix["cat_id"],
            milestones=[
                ContractMilestoneCreate(
                    title="Deliver Hardware Prototype",
                    due_date=date.today() + timedelta(days=15),
                    responsible_party="VENDOR",
                )
            ],
        )
        contract = await contract_service.create_contract(db, req, fix["buyer_id"], org_id)
        milestone_id = contract.milestones[0].id
        await db.commit()

        completed_ms = await contract_service.complete_milestone(
            db, contract.id, milestone_id, "Prototype verified in lab", fix["buyer_id"], org_id
        )
        assert completed_ms.status == "COMPLETED"
        assert completed_ms.completed_at is not None
        assert "verified in lab" in completed_ms.completion_notes
        await db.commit()


@pytest.mark.asyncio
async def test_auto_renewal_creates_new_contract(org_id):
    """Auto-renewal expires original contract and creates a new active contract with copied lines."""
    async with TestSession() as db:
        fix = await create_contract_fixtures(db, org_id)

        req = ContractCreateRequest(
            title="Auto Renewable Contract",
            vendor_id=fix["vendor_id"],
            total_value=Decimal("300000.00"),
            start_date=date.today() - timedelta(days=365),
            end_date=date.today(),
            business_unit_id=fix["bu_id"],
            category_id=fix["cat_id"],
            auto_renew=True,
            lines=[
                ContractLineCreate(
                    line_number=1,
                    item_description="Annual Support License",
                    uom_id=fix["uom_id"],
                    contracted_quantity=Decimal("1"),
                    unit_rate=Decimal("300000.00"),
                )
            ],
        )
        contract = await contract_service.create_contract(db, req, fix["buyer_id"], org_id)
        contract.status = "ACTIVE"
        await db.commit()

        new_contract = await contract_service.auto_renew_contract(db, contract)

        assert contract.status == "EXPIRED"
        assert new_contract.id is not None
        assert new_contract.id != contract.id
        assert new_contract.status == "ACTIVE"
        assert new_contract.original_contract_id == contract.id
        assert new_contract.start_date == contract.end_date
        assert len(new_contract.lines) == 1
        assert new_contract.lines[0].item_description == "Annual Support License"

        await db.commit()


@pytest.mark.asyncio
async def test_contract_expiry_celery_task(org_id):
    """Celery maintenance task checks 90/60/30/0 thresholds and triggers auto-renewal."""
    async with TestSession() as db:
        fix = await create_contract_fixtures(db, org_id)

        # 1. Expiring in 30 days -> warning alert
        c30 = Contract(
            org_id=org_id,
            contract_number=f"CNT-ALERT-30-{uuid4().hex[:4]}",
            title="30 Days Alert Contract",
            vendor_id=fix["vendor_id"],
            status="ACTIVE",
            contract_type="FIXED_PRICE",
            total_value=Decimal("50000.00"),
            start_date=date.today() - timedelta(days=335),
            end_date=date.today() + timedelta(days=30),
            business_unit_id=fix["bu_id"],
            category_id=fix["cat_id"],
            auto_renew=False,
        )
        db.add(c30)

        # 2. Expiring today with auto_renew=False -> marked EXPIRED
        c0_expire = Contract(
            org_id=org_id,
            contract_number=f"CNT-EXP-TODAY-{uuid4().hex[:4]}",
            title="Expiring Today Contract",
            vendor_id=fix["vendor_id"],
            status="ACTIVE",
            contract_type="FIXED_PRICE",
            total_value=Decimal("75000.00"),
            start_date=date.today() - timedelta(days=365),
            end_date=date.today(),
            business_unit_id=fix["bu_id"],
            category_id=fix["cat_id"],
            auto_renew=False,
        )
        db.add(c0_expire)

        # 3. Expiring today with auto_renew=True -> auto-renewed
        c0_renew = Contract(
            org_id=org_id,
            contract_number=f"CNT-RENEW-TODAY-{uuid4().hex[:4]}",
            title="Renewing Today Contract",
            vendor_id=fix["vendor_id"],
            status="ACTIVE",
            contract_type="RATE_CONTRACT",
            total_value=Decimal("120000.00"),
            start_date=date.today() - timedelta(days=365),
            end_date=date.today(),
            business_unit_id=fix["bu_id"],
            category_id=fix["cat_id"],
            auto_renew=True,
        )
        db.add(c0_renew)
        await db.commit()

        # Run task passing TestSession factory
        stats = await async_check_contract_expiry(session_factory=TestSession)

        assert stats["alerts_sent"] >= 1
        assert stats["renewals_processed"] >= 1
        assert stats["expired_count"] >= 1
