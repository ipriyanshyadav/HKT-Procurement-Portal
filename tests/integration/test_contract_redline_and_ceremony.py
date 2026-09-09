"""
Integration tests for SPEC_13 Contract Lifecycle Redlining & Collaborative Clause Editor.
Tests:
- Clause library retrieval and auto-seeding
- Instantiating clauses on a contract
- Submitting redline proposal with diff computation
- Reviewing and accepting redline (updates current text)
- Initiating multi-party cryptographic signing ceremony
- Submitting digital signatures and transitioning contract to ACTIVE
"""
from __future__ import annotations

from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.main  # noqa: F401
from app.config import settings
from app.db.enums import ContractStatusEnum
from app.modules.contract.schemas import (
    ContractClauseCreate,
    ContractRedlineCreate,
    ContractRedlineReviewRequest,
    InitiateSigningCeremonyRequest,
    SubmitDigitalSignatureRequest,
)
from app.modules.contract.service import contract_service

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def setup_contract_fixtures(db: AsyncSession, org_id):
    buyer_id = uuid4()
    vendor_id = uuid4()
    bu_id = uuid4()
    cat_id = uuid4()
    le_id = uuid4()

    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, :name, :legal_name, 'IN', 'INR', '{}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id, "name": f"Org {org_id.hex[:6]}", "legal_name": f"Legal {org_id.hex[:6]}"},
    )
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
        VALUES (:id, :org_id, :email, 'hash', 'Test', 'Buyer', 'ACTIVE', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": buyer_id, "org_id": org_id, "email": f"b-{buyer_id.hex[:6]}@t.com"},
    )
    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, country_code)
        VALUES (:id, :org_id, 'Legal Entity', :reg, 'IN')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": le_id, "org_id": org_id, "reg": f"R-{le_id.hex[:6]}"},
    )
    await db.execute(
        text("""
        INSERT INTO business_units (id, org_id, name, code, legal_entity_id)
        VALUES (:id, :org_id, 'Procurement BU', :code, :le_id)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": bu_id, "org_id": org_id, "code": f"BU-{bu_id.hex[:4]}", "le_id": le_id},
    )
    await db.execute(
        text("""
        INSERT INTO categories (id, org_id, name, code, level)
        VALUES (:id, :org_id, 'Services', :code, 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": cat_id, "org_id": org_id, "code": f"C-{cat_id.hex[:4]}"},
    )
    await db.execute(
        text("""
        INSERT INTO vendors (id, org_id, vendor_code, company_name, primary_email, status, version)
        VALUES (:id, :org_id, :code, 'Acme Corp', 'v@t.com', 'ACTIVE', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": vendor_id, "org_id": org_id, "code": f"V-{vendor_id.hex[:4]}"},
    )

    contract_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO contracts (
            id, org_id, contract_number, title, vendor_id, status,
            contract_type, currency, total_value, utilized_value,
            start_date, end_date, business_unit_id, category_id, version
        )
        VALUES (
            :id, :org_id, :num, 'MSA Hardware Support', :vendor_id, 'DRAFT',
            'RATE_CONTRACT', 'INR', 2500000.00, 0.0,
            :start_date, :end_date, :bu_id, :cat_id, 1
        )
        """),
        {
            "id": contract_id,
            "org_id": org_id,
            "num": f"CNT-{contract_id.hex[:6]}",
            "vendor_id": vendor_id,
            "start_date": date(2026, 1, 1),
            "end_date": date(2027, 1, 1),
            "bu_id": bu_id,
            "cat_id": cat_id,
        },
    )
    await db.commit()

    return {
        "buyer_id": buyer_id,
        "vendor_id": vendor_id,
        "contract_id": contract_id,
    }


@pytest.mark.asyncio
async def test_clause_library_and_instantiation():
    async with TestSession() as db:
        org_id = uuid4()
        fixtures = await setup_contract_fixtures(db, org_id)

        # 1. Get clause library (should auto-seed default enterprise clauses)
        library = await contract_service.get_clause_library(db, org_id)
        assert len(library) >= 5
        codes = [c.clause_code for c in library]
        assert "INDEMNITY" in codes
        assert "LIMITATION_OF_LIABILITY" in codes

        # 2. Add custom clause to library
        new_clause = await contract_service.create_clause(
            db,
            org_id,
            ContractClauseCreate(
                clause_code="ESG_SUSTAINABILITY",
                title="Environmental & Sustainability Standard",
                category="COMPLIANCE",
                standard_text="Vendor shall comply with ISO 14001 and achieve net-zero carbon packaging.",
                risk_level="MEDIUM",
            ),
        )
        assert new_clause.clause_code == "ESG_SUSTAINABILITY"

        # 3. Get contract clause instances (should auto-populate from library)
        instances = await contract_service.get_contract_clause_instances(
            db, fixtures["contract_id"], org_id
        )
        assert len(instances) >= 5


@pytest.mark.asyncio
async def test_redline_submission_and_review_workflow():
    async with TestSession() as db:
        org_id = uuid4()
        fixtures = await setup_contract_fixtures(db, org_id)

        instances = await contract_service.get_contract_clause_instances(
            db, fixtures["contract_id"], org_id
        )
        target_instance = instances[0]

        # Submit redline proposal
        redline_req = ContractRedlineCreate(
            clause_instance_id=target_instance.id,
            original_text=target_instance.current_text,
            proposed_text=target_instance.current_text + " Liability is strictly capped at ₹5,000,000.",
            change_rationale="Supplier requested financial liability cap ceiling.",
            author_type="SUPPLIER",
        )
        redline = await contract_service.submit_redline(
            db, fixtures["contract_id"], org_id, fixtures["buyer_id"], redline_req
        )

        assert redline.status == "PENDING"
        assert redline.diff_summary["additions_count"] > 0
        assert redline.diff_summary["similarity_pct"] > 50.0

        # Review and accept redline
        reviewed = await contract_service.review_redline(
            db,
            redline.id,
            org_id,
            fixtures["buyer_id"],
            ContractRedlineReviewRequest(
                action="ACCEPT",
                review_comment="Acceptable after risk committee review.",
            ),
        )
        assert reviewed.status == "ACCEPTED"
        assert reviewed.review_comment == "Acceptable after risk committee review."

        # Verify target clause instance text updated
        updated_instances = await contract_service.get_contract_clause_instances(
            db, fixtures["contract_id"], org_id
        )
        updated_inst = next(i for i in updated_instances if i.id == target_instance.id)
        assert "Liability is strictly capped at ₹5,000,000." in updated_inst.current_text
        assert updated_inst.status == "MODIFIED"


@pytest.mark.asyncio
async def test_signing_ceremony_workflow():
    async with TestSession() as db:
        org_id = uuid4()
        fixtures = await setup_contract_fixtures(db, org_id)

        # 1. Initiate signing ceremony
        ceremony = await contract_service.initiate_signing_ceremony(
            db,
            fixtures["contract_id"],
            org_id,
            fixtures["buyer_id"],
            InitiateSigningCeremonyRequest(
                signers=[
                    {"name": "Buyer Head", "email": "buyer@test.com", "role": "BUYER"},
                    {"name": "Supplier CEO", "email": "supplier@test.com", "role": "SUPPLIER"},
                ]
            ),
        )
        assert ceremony.ceremony_status == "IN_PROGRESS"
        assert len(ceremony.audit_trail_hash) == 64

        contract = await contract_service.get(db, fixtures["contract_id"], org_id)
        assert contract.status == ContractStatusEnum.PENDING_ESIGN

        # 2. Buyer signs
        session = await contract_service.submit_digital_signature(
            db,
            fixtures["contract_id"],
            org_id,
            fixtures["buyer_id"],
            SubmitDigitalSignatureRequest(signer_email="buyer@test.com", signature_token=str(uuid4())),
        )
        assert session.ceremony_status == "IN_PROGRESS"

        # 3. Supplier signs -> completes ceremony and activates contract
        session = await contract_service.submit_digital_signature(
            db,
            fixtures["contract_id"],
            org_id,
            fixtures["buyer_id"],
            SubmitDigitalSignatureRequest(signer_email="supplier@test.com", signature_token=str(uuid4())),
        )
        assert session.ceremony_status == "COMPLETED"
        assert session.completed_at is not None

        contract_final = await contract_service.get(db, fixtures["contract_id"], org_id)
        assert contract_final.status == ContractStatusEnum.ACTIVE
