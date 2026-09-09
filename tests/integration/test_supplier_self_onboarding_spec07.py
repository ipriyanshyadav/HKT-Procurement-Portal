from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.db.enums import UserStatusEnum, VendorStatusEnum
from app.modules.organization.models import Organization
from app.modules.user.models import Role, User
from app.modules.vendor.models import Vendor
from app.modules.vendor.schemas import (
    VendorKYCReviewRequest,
    VendorSelfRegistrationRequest,
)
from app.modules.vendor.service import vendor_service


@pytest.fixture
async def db_session():
    test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session
    await test_engine.dispose()


@pytest.mark.asyncio
async def test_supplier_self_registration_and_compliance_approval(db_session: AsyncSession):
    # 1. Setup isolated organization & compliance reviewer
    org_id = uuid4()
    org = Organization(
        id=org_id,
        name=f"Self-Onboard Test Org {uuid4().hex[:6]}",
        legal_name=f"Self-Onboard Test Org Legal {uuid4().hex[:6]}",
    )
    db_session.add(org)

    # Ensure SUPPLIER role exists for this org
    role = Role(
        org_id=org_id,
        code="SUPPLIER",
        name="Supplier Vendor Role",
        is_supplier_role=True,
    )
    db_session.add(role)

    reviewer = User(
        org_id=org_id,
        email=f"compliance_{uuid4().hex[:6]}@buyer.com",
        first_name="Compliance",
        last_name="Officer",
        status=UserStatusEnum.ACTIVE,
    )
    db_session.add(reviewer)
    await db_session.commit()

    # 2. External Prospective Supplier Self-Registration
    supplier_email = f"sales_{uuid4().hex[:6]}@techcorp.in"
    reg_data = VendorSelfRegistrationRequest(
        org_id=org_id,
        company_name=f"TechCorp Global Solutions {uuid4().hex[:4]}",
        legal_name="TechCorp Global Solutions Private Limited",
        primary_email=supplier_email,
        primary_phone="+919876543210",
        pan="ABCDE1234F",
        gstin="27ABCDE1234F1Z5",
        cin="U72200MH2020PTC123456",
        address_line1="Plot 42, Hinjawadi Tech Park",
        city="Pune",
        state="Maharashtra",
        postal_code="411057",
        country_code="IN",
        contact_name="Rohan Sharma",
        contact_designation="Director of Accounts",
        bank_account_holder="TechCorp Global Solutions Pvt Ltd",
        bank_name="HDFC Bank",
        branch_name="Hinjawadi",
        account_number="50200012345678",
        ifsc_code="HDFC0001234",
        coi_declared=True,
    )

    onboard_res = await vendor_service.self_register_vendor(db_session, reg_data)

    assert onboard_res["status"] == "SUBMITTED"
    assert onboard_res["application_number"].startswith("APP-ONB-")
    assert onboard_res["gstin_verified"] is True
    assert onboard_res["pan_verified"] is True
    assert onboard_res["penny_drop_verified"] is True
    assert onboard_res["kyc_risk_tier"] == "LOW"

    app_id = onboard_res["application_id"]
    vendor_id = onboard_res["vendor_id"]

    # 3. Buyer Compliance Review Queue
    pending_apps = await vendor_service.list_pending_onboarding(db_session, org_id)
    assert len(pending_apps) >= 1
    target_app = next(a for a in pending_apps if a["id"] == app_id)
    assert target_app["gstin_verified"] is True
    assert target_app["company_name"] == reg_data.company_name

    # 4. Compliance Reviewer Approves Onboarding
    review_data = VendorKYCReviewRequest(
        action="APPROVE",
        review_notes="All GSTIN, PAN, and Bank penny-drop documents fully verified against NSDL and GSTN.",
    )
    approval_res = await vendor_service.review_onboarding_application(
        db_session,
        app_id=app_id,
        org_id=org_id,
        reviewer_id=reviewer.id,
        review_data=review_data,
    )

    assert approval_res["status"] == "APPROVED"
    assert approval_res["user_provisioned"] is True
    assert approval_res["user_email"] == supplier_email

    # 5. Verify Vendor is now ACTIVE and Supplier User is provisioned
    vendor = await db_session.get(Vendor, vendor_id)
    assert vendor is not None
    assert vendor.status == VendorStatusEnum.ACTIVE
    assert vendor.vendor_code is not None

    user_stmt = select(User).where(User.email == supplier_email, User.org_id == org_id)
    created_user = (await db_session.execute(user_stmt)).scalar_one_or_none()
    assert created_user is not None
    assert created_user.is_supplier_user is True
    assert created_user.vendor_id == vendor_id
    assert created_user.status == UserStatusEnum.ACTIVE


@pytest.mark.asyncio
async def test_supplier_self_registration_rejection_flow(db_session: AsyncSession):
    org_id = uuid4()
    org = Organization(
        id=org_id,
        name=f"Rejection Flow Org {uuid4().hex[:6]}",
        legal_name=f"Rejection Flow Org Legal {uuid4().hex[:6]}",
    )
    db_session.add(org)

    reviewer = User(
        org_id=org_id,
        email=f"reviewer_{uuid4().hex[:6]}@buyer.com",
        first_name="Auditor",
        last_name="Reviewer",
        status=UserStatusEnum.ACTIVE,
    )
    db_session.add(reviewer)
    await db_session.commit()

    supplier_email = f"vendor_{uuid4().hex[:6]}@invalid.com"
    reg_data = VendorSelfRegistrationRequest(
        org_id=org_id,
        company_name=f"Unverified Supplies {uuid4().hex[:4]}",
        primary_email=supplier_email,
        contact_name="Unknown Representative",
    )

    onboard_res = await vendor_service.self_register_vendor(db_session, reg_data)
    app_id = onboard_res["application_id"]
    vendor_id = onboard_res["vendor_id"]

    # Reviewer rejects
    review_data = VendorKYCReviewRequest(
        action="REJECT",
        review_notes="Missing mandatory GSTIN certificate and cancelled bank cheque.",
    )
    rejection_res = await vendor_service.review_onboarding_application(
        db_session,
        app_id=app_id,
        org_id=org_id,
        reviewer_id=reviewer.id,
        review_data=review_data,
    )

    assert rejection_res["status"] == "REJECTED"

    vendor = await db_session.get(Vendor, vendor_id)
    assert vendor.status == VendorStatusEnum.RESUBMISSION_REQUESTED
    assert "Missing mandatory GSTIN" in vendor.suspension_reason
