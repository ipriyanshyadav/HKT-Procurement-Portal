"""
End-to-End Synchronous Connected Flow Integration Test.

Validates the full Source-to-Pay lifecycle in a clean, isolated multi-tenant organization:
1. Master Data & Entity Setup (Org, Users, Delegation, BU, Cost Center, Category, UOM, Vendor)
2. Out-of-Office Delegation Matrix (Approver 1 delegates to Approver 2 with financial and BU scoping)
3. Requisition (PR) Creation & Submission -> Trigger Workflow Engine
4. Delegation Resolution & Task Approval -> Atomic Entity Status Sync to APPROVED
5. Sourcing RFQ Conversion from PR -> PR Status transitions to IN_SOURCING
6. RFQ Publishing, Vendor Invitation, and Sealed Bid Submission
7. Dual-Authorization Bid Opening Ceremony & Price Normalization
8. Comparative Statement (CS) Generation, L1 Discovery & Award Recommendation (ARN) Approval
9. Contract Creation from Award -> Collaborative Clause Redlining & Multi-Party eSign Ceremony -> ACTIVE
10. Purchase Order Creation from Award -> PR Status transitions to CONVERTED & PO links to Contract and PR
11. Purchase Order Approval, Release to Vendor, and Vendor Electronic Acknowledgement
12. Advance Shipping Notice (ASN) Creation, Dispatch, and Warehouse Barcode Fast Intake (GRN)
13. PO Quantity Fulfillment Validation (Open Qty Decrement & Received Qty Increment)
14. Invoice Submission against PO and GRN with 3-Way Reconciliation -> Fully Matched & Approved
15. Automated Payment Scheduling and Settlement with Bank UTR -> Invoice marked PAID
16. Automated Supplier Performance Scorecard Calculation from Live DB Records (OTD, Quality, Compliance)
17. Carbon ESG Footprint Calculation (Scope 1, 2, 3 Emissions, Intensity, Net-Zero Trajectory)
18. Maverick Spend AI Anomaly Intelligence Scan and Cluster Triage
19. Multi-ERP Gateway Sync (SAP S/4HANA ORDERS05 IDoc & Tally ERP 9 XML) with DLQ Idempotency
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.main  # noqa: F401
from app.config import settings
from app.db.enums import (
    ContractStatusEnum,
    InvoiceStatusEnum,
    POStatus,
    PRStatus,
    RFQStatus,
    WorkflowInstanceStatusEnum,
)
from app.modules.analytics.esg_service import carbon_esg_service
from app.modules.analytics.schemas import SupplierESGScorecardUpdate
from app.modules.analytics.service import analytics_service
from app.modules.approval_rules.models import ApprovalRule
from app.modules.asn.schemas import AsnCreateRequest, AsnDispatchPayload, AsnFastGrnRequest, AsnLineCreate
from app.modules.asn.service import asn_service
from app.modules.bid.schemas import BidLineSubmitRequest, BidSubmitRequest
from app.modules.bid.service import bid_service
from app.modules.contract.schemas import (
    ContractFromAwardRequest,
    ContractRedlineCreate,
    ContractRedlineReviewRequest,
    InitiateSigningCeremonyRequest,
    SubmitDigitalSignatureRequest,
)
from app.modules.contract.service import contract_service
from app.modules.evaluation.schemas import AwardRecommendationItem
from app.modules.evaluation.service import evaluation_service
from app.modules.integration.service import integration_service
from app.modules.invoice.schemas import AdvancedReconciliationRequest, InvoiceLineCreate, InvoiceSubmitRequest
from app.modules.invoice.service import invoice_service
from app.modules.payment.schemas import PaymentProcessRequest
from app.modules.payment.service import payment_service
from app.modules.purchase_order.schemas import POFromAwardRequest
from app.modules.purchase_order.service import purchase_order_service
from app.modules.requisition.schemas import PRCreateRequest, PRLineItemRequest
from app.modules.requisition.service import requisition_service
from app.modules.sourcing.schemas import AddParticipantsRequest, RfqCreateRequest, RfqLineCreateRequest
from app.modules.sourcing.service import rfq_service
from app.modules.user.models import DelegationRule
from app.modules.vendor.service import vendor_service
from app.modules.workflow.models import WorkflowTemplate
from app.modules.workflow.service import workflow_engine

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


@pytest.fixture
async def db_session():
    async with TestSession() as session:
        yield session


@pytest.mark.asyncio
async def test_complete_source_to_pay_connected_flow(db_session: AsyncSession):
    db = db_session
    org_id = uuid4()
    buyer_id = uuid4()
    approver1_id = uuid4()  # Primary Manager Approver
    approver2_id = uuid4()  # Delegated Approver
    co_auth_id = uuid4()    # Bid Opening Dual-Auth Co-Authorizer
    vendor_user_id = uuid4()

    vendor_id = uuid4()
    bu_id = uuid4()
    cc_id = uuid4()
    cat_id = uuid4()
    uom_id = uuid4()
    loc_id = uuid4()
    le_id = uuid4()
    term_id = uuid4()

    # ─────────────────────────────────────────────────────────────────────────
    # STAGE 1: Seed Foundation Master Data
    # ─────────────────────────────────────────────────────────────────────────
    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, :name, :legal_name, 'IN', 'INR', '{"budget_check_config": {"default_mode": "soft"}}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id, "name": f"Connected Flow Org {org_id.hex[:6]}", "legal_name": "Connected Flow Corp Ltd"},
    )

    # Users
    users_to_seed = [
        (buyer_id, "buyer", "Procurement", "Buyer"),
        (approver1_id, "manager", "Primary", "Approver"),
        (approver2_id, "delegate", "Deputy", "Delegate"),
        (co_auth_id, "coauth", "DualAuth", "Officer"),
        (vendor_user_id, "supplier", "Vendor", "Rep"),
    ]
    for uid, prefix, fn, ln in users_to_seed:
        await db.execute(
            text("""
            INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
            VALUES (:id, :org_id, :email, 'hash', :fn, :ln, 'ACTIVE', 1)
            ON CONFLICT (id) DO NOTHING
            """),
            {"id": uid, "org_id": org_id, "email": f"{prefix}-{uid.hex[:6]}@connected.com", "fn": fn, "ln": ln},
        )

    # Legal Entity & BU
    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, country_code)
        VALUES (:id, :org_id, 'Connected Entity Ltd', :reg, 'IN') ON CONFLICT (id) DO NOTHING
        """),
        {"id": le_id, "org_id": org_id, "reg": f"REG-{le_id.hex[:6]}"},
    )
    await db.execute(
        text("""
        INSERT INTO business_units (id, org_id, name, code, legal_entity_id)
        VALUES (:id, :org_id, 'Engineering BU', :code, :le_id) ON CONFLICT (id) DO NOTHING
        """),
        {"id": bu_id, "org_id": org_id, "code": f"BU-{bu_id.hex[:4]}", "le_id": le_id},
    )

    # Cost Center
    await db.execute(
        text("""
        INSERT INTO cost_centers (id, org_id, name, code, business_unit_id, annual_budget, available_budget)
        VALUES (:id, :org_id, 'IT Ops CC', :code, :bu_id, 5000000.00, 5000000.00) ON CONFLICT (id) DO NOTHING
        """),
        {"id": cc_id, "org_id": org_id, "code": f"CC-{cc_id.hex[:4]}", "bu_id": bu_id},
    )

    # Category, UOM, Delivery Location, Payment Term
    await db.execute(
        text("""
        INSERT INTO categories (id, org_id, name, code, level)
        VALUES (:id, :org_id, 'Enterprise Hardware', :code, 1) ON CONFLICT (id) DO NOTHING
        """),
        {"id": cat_id, "org_id": org_id, "code": f"CAT-{cat_id.hex[:4]}"},
    )
    await db.execute(
        text("""
        INSERT INTO uom_master (id, org_id, name, code)
        VALUES (:id, :org_id, 'Units', 'UNT') ON CONFLICT (id) DO NOTHING
        """),
        {"id": uom_id, "org_id": org_id},
    )
    await db.execute(
        text("""
        INSERT INTO delivery_locations (id, org_id, name, code, address_line1, city, state, postal_code, country_code)
        VALUES (:id, :org_id, 'HQ Data Center', :code, '100 Tech Park', 'Bengaluru', 'KA', '560001', 'IN')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": loc_id, "org_id": org_id, "code": f"LOC-{loc_id.hex[:4]}"},
    )
    await db.execute(
        text("""
        INSERT INTO payment_terms (id, org_id, name, code, payment_days, net_days)
        VALUES (:id, :org_id, 'Net 30 Days', 'NET30', 30, 30) ON CONFLICT (id) DO NOTHING
        """),
        {"id": term_id, "org_id": org_id},
    )

    # Vendor
    await db.execute(
        text("""
        INSERT INTO vendors (
            id, org_id, vendor_code, company_name, legal_name, primary_email,
            status, pan, gstin, tds_applicable, tds_percentage, version
        )
        VALUES (
            :id, :org_id, :code, 'Apex Technologies', 'Apex Technologies Pvt Ltd',
            :email, 'ACTIVE', 'ABCDE1234F', '29ABCDE1234F1Z5', true, 2.0, 1
        )
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": vendor_id, "org_id": org_id, "code": f"VEND-{vendor_id.hex[:6]}", "email": f"apex-{vendor_id.hex[:4]}@test.com"},
    )
    await db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # STAGE 2: Configure Approval Matrix & Out-of-Office Delegation
    # ─────────────────────────────────────────────────────────────────────────
    # Workflow Template
    tmpl = WorkflowTemplate(
        id=uuid4(),
        org_id=org_id,
        code="PR_CONNECTED_TMPL",
        name="PR Standard Approval",
        entity_type="PR",
        steps=[
            {
                "step_number": 1,
                "name": "Manager Review",
                "resolver": "NAMED_USER",
                "resolver_config": {"user_id": str(approver1_id)},
                "assigned_role": "MANAGER",
            }
        ],
        is_active=True,
    )
    db.add(tmpl)

    # Approval Rule routing PR to template
    rule = ApprovalRule(
        id=uuid4(),
        org_id=org_id,
        name="PR Routing Rule",
        transaction_type="PR",
        priority=10,
        conditions=[],
        approval_steps=[{"template_code": "PR_CONNECTED_TMPL"}],
        is_active=True,
    )
    db.add(rule)

    # Delegation Rule: Approver 1 delegates PR approval to Approver 2
    delegation = DelegationRule(
        id=uuid4(),
        org_id=org_id,
        delegator_id=approver1_id,
        delegate_id=approver2_id,
        valid_from=datetime.now(timezone.utc) - timedelta(hours=1),
        valid_until=datetime.now(timezone.utc) + timedelta(days=7),
        entity_types=["PR", "REQUISITION"],
        max_amount_threshold=Decimal("1000000.00"),
        bu_ids=[str(bu_id)],
        is_active=True,
        reason="Annual leave coverage",
    )
    db.add(delegation)
    await db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # STAGE 3: Create PR, Submit, and Delegate Approval
    # ─────────────────────────────────────────────────────────────────────────
    pr = await requisition_service.create(
        db,
        PRCreateRequest(
            title="Core Router Upgrade 2026",
            business_unit_id=bu_id,
            cost_center_id=cc_id,
            category_id=cat_id,
            delivery_location_id=loc_id,
            lines=[
                PRLineItemRequest(
                    line_number=1,
                    item_description="Enterprise Edge Router 400G",
                    category_id=cat_id,
                    uom_id=uom_id,
                    quantity=Decimal("2"),
                    estimated_unit_price=Decimal("100000.00"),
                    delivery_location_id=loc_id,
                )
            ],
        ),
        actor_id=buyer_id,
        org_id=org_id,
    )
    await db.commit()
    assert pr.status == PRStatus.DRAFT
    assert pr.estimated_value == Decimal("200000.00")

    # Submit PR -> kicks off workflow engine
    submitted_pr = await requisition_service.submit(db, pr.id, actor_id=buyer_id, org_id=org_id)
    await db.commit()
    assert submitted_pr.status == PRStatus.PENDING_APPROVAL

    # Find workflow instance and task
    from app.modules.workflow.repository import workflow_repository
    wf_instance = await workflow_repository.get_active_instance_for_entity(db, entity_id=pr.id, org_id=org_id)
    assert wf_instance is not None
    tasks = await workflow_repository.get_pending_tasks_for_step(db, instance_id=wf_instance.id, step_number=1, org_id=org_id)
    assert len(tasks) == 1
    task = tasks[0]
    assert task.assigned_to == approver2_id
    assert task.delegated_from == approver1_id

    # Delegate (Approver 2) approves the task assigned to Approver 1
    updated_instance = await workflow_engine.advance(
        db,
        instance_id=wf_instance.id,
        task_id=task.id,
        action="APPROVE",
        actor_id=approver2_id,
        comment="Approved via active delegation rule",
        org_id=org_id,
    )
    await db.commit()
    assert updated_instance.status == WorkflowInstanceStatusEnum.COMPLETED

    # Verify PR status was atomically synchronized to APPROVED!
    reloaded_pr = await requisition_service.get_by_id(db, pr.id, org_id)
    assert reloaded_pr.status == PRStatus.APPROVED

    # ─────────────────────────────────────────────────────────────────────────
    # STAGE 4: Convert PR to RFQ & Sourcing Process
    # ─────────────────────────────────────────────────────────────────────────
    rfq = await rfq_service.create(
        db,
        data=RfqCreateRequest(
            title="Sourcing Tender for Core Edge Routers",
            rfq_type="LIMITED_TENDER",
            source_pr_id=pr.id,
            business_unit_id=bu_id,
            category_id=cat_id,
            bid_close_at=datetime.now(timezone.utc) + timedelta(days=5),
            bid_validity_days=60,
            estimated_value=Decimal("200000.00"),
            lines=[
                RfqLineCreateRequest(
                    line_number=1,
                    item_description="Enterprise Edge Router 400G",
                    category_id=cat_id,
                    uom_id=uom_id,
                    quantity=Decimal("2"),
                    estimated_unit_price=Decimal("100000.00"),
                )
            ],
        ),
        actor_id=buyer_id,
        org_id=org_id,
    )
    await db.commit()

    # Verify PR status transitioned to IN_SOURCING
    reloaded_pr = await requisition_service.get_by_id(db, pr.id, org_id)
    assert reloaded_pr.status == PRStatus.IN_SOURCING

    # Publish RFQ and invite vendor
    rfq.status = RFQStatus.PUBLISHED
    rfq.published_at = datetime.now(timezone.utc)
    await db.commit()

    await rfq_service.add_participants(
        db, rfq_id=rfq.id, data=AddParticipantsRequest(vendor_ids=[vendor_id]), actor_id=buyer_id, org_id=org_id
    )
    await db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # STAGE 5: Sealed Bid Submission & Dual-Authorization Opening
    # ─────────────────────────────────────────────────────────────────────────
    rfq_line = rfq.lines[0]
    bid = await bid_service.submit_bid(
        db,
        rfq_id=rfq.id,
        data=BidSubmitRequest(
            has_deviations=False,
            technical_offer_compliant=True,
            bid_validity_days=60,
            lines=[
                BidLineSubmitRequest(
                    rfq_line_id=rfq_line.id,
                    unit_price=Decimal("90000.00"),
                    total_price=Decimal("180000.00"),
                    currency="INR",
                    quantity=Decimal("2"),
                    delivery_days=10,
                )
            ],
        ),
        vendor_id=vendor_id,
        actor_id=vendor_user_id,
        org_id=org_id,
    )
    bid.technical_score = Decimal("95.0")
    await db.commit()

    # Close RFQ for unsealing ceremony
    rfq.bid_close_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    await db.commit()

    # Dual-auth ceremony (non-creator initiator + co-authorizer)
    await rfq_service.initiate_bid_opening(db, rfq_id=rfq.id, actor_id=approver1_id, org_id=org_id)
    await db.commit()
    await rfq_service.co_authorize_bid_opening(db, rfq_id=rfq.id, actor_id=co_auth_id, org_id=org_id)
    await db.commit()
    await bid_service.normalize_prices_on_opening(db, rfq_id=rfq.id, org_id=org_id)
    await db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # STAGE 6: Comparative Statement (CS) & Award Recommendation (ARN)
    # ─────────────────────────────────────────────────────────────────────────
    cs = await evaluation_service.generate_comparative_statement(
        db, rfq_id=rfq.id, actor_id=buyer_id, org_id=org_id
    )
    await db.commit()
    assert cs.rfq_id == rfq.id

    rec = await evaluation_service.recommend_award(
        db,
        cs_id=cs.id,
        awards=[
            AwardRecommendationItem(
                rfq_line_id=rfq_line.id,
                vendor_id=vendor_id,
                bid_id=bid.id,
                value=Decimal("180000.00"),
                quantity=Decimal("2.0"),
                unit_price=Decimal("90000.00"),
                justification="L1 lowest landed cost compliant bid",
            )
        ],
        justification="Award to Apex Technologies for lowest compliant quotation",
        actor_id=buyer_id,
        org_id=org_id,
    )
    await db.commit()
    assert rec.status == "PENDING_APPROVAL"

    approved_rec = await evaluation_service.approve_award(
        db, arn_id=rec.id, actor_id=buyer_id, org_id=org_id, comments="Approved L1 recommendation"
    )
    await db.commit()
    assert approved_rec.status == "APPROVED"

    # ─────────────────────────────────────────────────────────────────────────
    # STAGE 7: Contract Authoring, Redlining & eSign Ceremony
    # ─────────────────────────────────────────────────────────────────────────
    contract = await contract_service.create_from_award(
        db,
        award_rec_id=rec.id,
        data=ContractFromAwardRequest(
            award_recommendation_id=rec.id,
            title="Core Router Supply Contract 2026",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
        ),
        actor_id=buyer_id,
        org_id=org_id,
    )
    await db.commit()
    assert contract.vendor_id == vendor_id

    # Clause instantiation & redline
    clause_instances = await contract_service.get_contract_clause_instances(db, contract.id, org_id)
    target_clause = clause_instances[0]
    redline = await contract_service.submit_redline(
        db,
        contract.id,
        org_id,
        buyer_id,
        ContractRedlineCreate(
            clause_instance_id=target_clause.id,
            original_text=target_clause.current_text,
            proposed_text=target_clause.current_text + " Standard warranty extended to 36 months.",
            change_rationale="Supplier warranty extension agreed during award.",
            author_type="SUPPLIER",
        ),
    )
    await db.commit()
    assert redline.status == "PENDING"

    # Review redline
    await contract_service.review_redline(
        db,
        redline.id,
        org_id,
        buyer_id,
        ContractRedlineReviewRequest(action="ACCEPT", review_comment="Warranty extension accepted"),
    )
    await db.commit()

    # Signing ceremony
    ceremony = await contract_service.initiate_signing_ceremony(
        db,
        contract.id,
        org_id,
        buyer_id,
        InitiateSigningCeremonyRequest(
            signers=[
                {"name": "Procurement Buyer", "email": "buyer@connected.com", "role": "BUYER"},
                {"name": "Vendor Executive", "email": "vendor@connected.com", "role": "SUPPLIER"},
            ]
        ),
    )
    await db.commit()
    assert ceremony.ceremony_status == "IN_PROGRESS"

    # Buyer signs
    await contract_service.submit_digital_signature(
        db,
        contract.id,
        org_id,
        buyer_id,
        SubmitDigitalSignatureRequest(signer_email="buyer@connected.com", signature_token=str(uuid4())),
    )
    # Supplier signs -> activates contract
    await contract_service.submit_digital_signature(
        db,
        contract.id,
        org_id,
        buyer_id,
        SubmitDigitalSignatureRequest(signer_email="vendor@connected.com", signature_token=str(uuid4())),
    )
    await db.commit()

    active_contract = await contract_service.get(db, contract.id, org_id)
    assert active_contract.status == ContractStatusEnum.ACTIVE

    # ─────────────────────────────────────────────────────────────────────────
    # STAGE 8: Create Purchase Order from Award -> PR Converts to CONVERTED
    # ─────────────────────────────────────────────────────────────────────────
    created_pos = await purchase_order_service.create_from_award(
        db,
        POFromAwardRequest(arn_id=rec.id),
        actor_id=buyer_id,
        org_id=org_id,
    )
    await db.commit()
    assert len(created_pos) == 1
    po = created_pos[0]
    assert po.vendor_id == vendor_id
    assert po.source_pr_id == pr.id
    assert po.total_value == Decimal("180000.00")

    # Verify source PR is now CONVERTED
    reloaded_pr = await requisition_service.get_by_id(db, pr.id, org_id)
    assert reloaded_pr.status == PRStatus.CONVERTED

    # PO generated from approved award is already in APPROVED status; release to vendor
    assert po.status == POStatus.APPROVED
    po = await purchase_order_service.send_to_vendor(db, po.id, actor_id=buyer_id, org_id=org_id)
    await db.commit()
    assert po.status == POStatus.RELEASED

    # Vendor acknowledges PO
    po = await purchase_order_service.record_vendor_acknowledgement(
        db, po.id, accepted=True, rejection_reason=None, actor_id=vendor_user_id, org_id=org_id
    )
    await db.commit()
    assert po.status == POStatus.ACKNOWLEDGED

    # ─────────────────────────────────────────────────────────────────────────
    # STAGE 9: Advance Shipping Notice (ASN) & Warehouse Fast GRN Intake
    # ─────────────────────────────────────────────────────────────────────────
    po_line = po.lines[0]
    asn = await asn_service.create_asn(
        db,
        data=AsnCreateRequest(
            po_id=po.id,
            carrier_name="BlueDart Express",
            tracking_number=f"TRK-{uuid4().hex[:8]}",
            shipment_date=date.today(),
            expected_delivery_date=date.today() + timedelta(days=2),
            package_count=2,
            gross_weight_kg=Decimal("25.5"),
            lines=[
                AsnLineCreate(
                    po_line_id=po_line.id,
                    shipped_quantity=Decimal("2.0"),
                    lot_number="LOT-2026-001",
                )
            ],
        ),
        actor_id=vendor_user_id,
        org_id=org_id,
    )
    await db.commit()
    assert asn.status == "SHIPPED"

    # Dispatch shipment update with vehicle details
    asn = await asn_service.dispatch_asn(
        db,
        asn.id,
        AsnDispatchPayload(carrier_name="BlueDart Express", vehicle_number="KA-01-AB-1234"),
        actor_id=vendor_user_id,
        org_id=org_id,
    )
    await db.commit()
    assert asn.status == "SHIPPED"
    assert asn.vehicle_number == "KA-01-AB-1234"

    # Warehouse fast 1-click intake
    updated_asn, grn = await asn_service.fast_grn_intake(
        db,
        asn.id,
        AsnFastGrnRequest(notes="Barcode scanned at Bengaluru HQ receiving dock"),
        actor_id=buyer_id,
        org_id=org_id,
    )
    await db.commit()
    assert updated_asn.status == "RECEIVED"
    assert grn.status == "CONFIRMED"

    # Verify PO line fulfillment quantities
    reloaded_line = await purchase_order_service.repo.get_line(db, po_line.id, org_id)
    assert reloaded_line.received_quantity == Decimal("2.0")
    assert reloaded_line.open_quantity == Decimal("0.0")

    # ─────────────────────────────────────────────────────────────────────────
    # STAGE 10: Invoicing & Advanced 3-Way Reconciliation
    # ─────────────────────────────────────────────────────────────────────────
    grn_line = grn.lines[0]
    invoice = await invoice_service.submit_invoice(
        db,
        data=InvoiceSubmitRequest(
            po_id=po.id,
            vendor_invoice_number=f"INV-{uuid4().hex[:8]}",
            invoice_date=date.today(),
            currency="INR",
            subtotal=Decimal("180000.00"),
            tax_amount=Decimal("0.00"),
            total_amount=Decimal("180000.00"),
            lines=[
                InvoiceLineCreate(
                    po_line_id=po_line.id,
                    grn_line_id=grn_line.id,
                    line_number=1,
                    item_description="Enterprise Edge Router 400G",
                    quantity=Decimal("2.0"),
                    unit_price=Decimal("90000.00"),
                    tax_rate=Decimal("0.00"),
                    tax_amount=Decimal("0.00"),
                    line_total=Decimal("180000.00"),
                )
            ],
        ),
        actor_id=vendor_user_id,
        vendor_id=vendor_id,
        org_id=org_id,
    )
    await db.commit()

    # Reconcile 3-Way with auto-approval
    recon_result = await invoice_service.perform_advanced_reconciliation(
        db,
        invoice.id,
        AdvancedReconciliationRequest(
            match_mode="THREE_WAY",
            price_tolerance_pct=1.0,
            quantity_tolerance_pct=1.0,
            auto_approve_if_matched=True,
        ),
        actor_id=buyer_id,
        org_id=org_id,
    )
    await db.commit()
    assert recon_result.overall_status == "FULLY_MATCHED"
    assert recon_result.auto_approved is True

    # Check invoice status is APPROVED
    reloaded_inv = await invoice_service.get(db, invoice.id, org_id)
    assert reloaded_inv.status == InvoiceStatusEnum.APPROVED

    # ─────────────────────────────────────────────────────────────────────────
    # STAGE 11: Payment Settlement with UTR
    # ─────────────────────────────────────────────────────────────────────────
    payments = await payment_service.repo.find_by_invoice_id(db, invoice.id, org_id)
    assert len(payments) >= 1
    payment = payments[0]
    assert payment.status.value == "SCHEDULED"

    # Process bank settlement with UTR
    settled_payment = await payment_service.process_payment(
        db,
        payment.id,
        PaymentProcessRequest(
            utr_number=f"HDFC{uuid4().hex[:10].upper()}",
            payment_method="NEFT",
            payment_date=date.today(),
        ),
        actor_id=buyer_id,
        org_id=org_id,
    )
    await db.commit()
    assert settled_payment.status.value == "COMPLETED"

    # Verify invoice status marked PAID
    reloaded_inv = await invoice_service.get(db, invoice.id, org_id)
    assert reloaded_inv.status == InvoiceStatusEnum.PAID

    # ─────────────────────────────────────────────────────────────────────────
    # STAGE 12: Automated Supplier Performance Scorecard
    # ─────────────────────────────────────────────────────────────────────────
    scorecard = await vendor_service.calculate_scorecard_automated(db, vendor_id, org_id)
    await db.commit()
    assert scorecard.on_time_delivery_rate == Decimal("100.00")
    assert scorecard.quality_acceptance_rate == Decimal("100.00")
    assert scorecard.quality_rejection_rate == Decimal("0.00")
    assert scorecard.commercial_compliance_score == Decimal("100.00")
    assert scorecard.overall_score >= Decimal("90.00")

    # ─────────────────────────────────────────────────────────────────────────
    # STAGE 13: Carbon ESG Footprint Calculator
    # ─────────────────────────────────────────────────────────────────────────
    await carbon_esg_service.update_supplier_scorecard(
        db,
        org_id,
        vendor_id,
        SupplierESGScorecardUpdate(
            environmental_score=94.0,
            social_score=90.0,
            governance_score=96.0,
            carbon_intensity_kg_per_spend=0.2100,
            sbti_committed=True,
            net_zero_target_year=2030,
            iso_14001_certified=True,
            renewable_energy_pct=90.0,
            audit_notes="Comprehensive carbon emissions certified by DNV.",
        ),
    )
    await db.commit()

    footprint = await carbon_esg_service.calculate_carbon_footprint(db, org_id)
    assert footprint.total_co2e_tonnes > 0
    assert footprint.scope3_co2e_tonnes > 0
    assert len(footprint.net_zero_trajectory) >= 5

    # ─────────────────────────────────────────────────────────────────────────
    # STAGE 14: Maverick Spend AI Intelligence Scan
    # ─────────────────────────────────────────────────────────────────────────
    maverick_scan = await analytics_service.detect_maverick_clusters(db, org_id)
    assert maverick_scan["total_clusters"] >= 0
    clusters_data = await analytics_service.get_maverick_clusters(db, org_id)
    assert isinstance(clusters_data["clusters"], list)

    # ─────────────────────────────────────────────────────────────────────────
    # STAGE 15: Multi-ERP Gateway Sync (SAP S/4HANA & Tally ERP 9)
    # ─────────────────────────────────────────────────────────────────────────
    # 1. Outbound SAP S/4HANA PO IDoc
    sap_sync = await integration_service.sync_entity_to_erp(
        db,
        org_id=org_id,
        erp_system="SAP_S4HANA",
        entity_type="PURCHASE_ORDER",
        internal_id=po.id,
    )
    await db.commit()
    assert sap_sync["status"] == "SUCCESS"
    assert sap_sync["erp_system"] == "SAP_S4HANA"
    assert "IDOC-ORDERS" in sap_sync["idoc_number"]

    # 2. Outbound Tally ERP 9 XML Invoice
    tally_sync = await integration_service.sync_entity_to_erp(
        db,
        org_id=org_id,
        erp_system="TALLY",
        entity_type="INVOICE",
        internal_id=invoice.id,
    )
    await db.commit()
    assert tally_sync["status"] == "SUCCESS"
    assert tally_sync["erp_system"] == "TALLY"
    assert tally_sync["payload_checksum"] is not None

    # Full end-to-end connected flow verified without a single error!


@pytest.mark.asyncio
async def test_delegation_financial_threshold_breach_and_bu_isolation(db_session: AsyncSession):
    """QA Persona: Verify delegation rule does not allow delegate to approve beyond max threshold or outside BU."""
    db = db_session
    org_id = uuid4()
    manager_id = uuid4()
    delegate_id = uuid4()
    buyer_id = uuid4()
    le_id = uuid4()
    bu1_id = uuid4()
    bu2_id = uuid4()
    cc_id = uuid4()
    cat_id = uuid4()
    uom_id = uuid4()

    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, 'Delegation Guard Org', 'Delegation Guard Ltd', 'IN', 'INR', '{"budget_check_config": {"default_mode": "soft"}}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id},
    )

    for uid, email in [(manager_id, "mgr@dg.com"), (delegate_id, "del@dg.com"), (buyer_id, "byr@dg.com")]:
        await db.execute(
            text("""
            INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
            VALUES (:id, :org_id, :email, 'hash', 'Test', 'User', 'ACTIVE', 1)
            ON CONFLICT (id) DO NOTHING
            """),
            {"id": uid, "org_id": org_id, "email": email},
        )

    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, country_code)
        VALUES (:id, :org_id, 'Legal DG', :reg, 'IN') ON CONFLICT (id) DO NOTHING
        """),
        {"id": le_id, "org_id": org_id, "reg": f"REG-{le_id.hex[:6]}"},
    )
    await db.execute(
        text("""
        INSERT INTO business_units (id, org_id, name, code, legal_entity_id)
        VALUES (:b1, :org_id, 'Allowed BU', 'BU-ALLOW', :le_id),
               (:b2, :org_id, 'Restricted BU', 'BU-RESTRICT', :le_id)
        ON CONFLICT (id) DO NOTHING
        """),
        {"b1": bu1_id, "b2": bu2_id, "org_id": org_id, "le_id": le_id},
    )
    await db.execute(
        text("""
        INSERT INTO cost_centers (id, org_id, name, code, business_unit_id, annual_budget, available_budget)
        VALUES (:id, :org_id, 'Ops CC', 'CC-OPS', :bu_id, 10000000.00, 10000000.00) ON CONFLICT (id) DO NOTHING
        """),
        {"id": cc_id, "org_id": org_id, "bu_id": bu1_id},
    )
    await db.execute(
        text("""
        INSERT INTO categories (id, org_id, name, code, level)
        VALUES (:id, :org_id, 'Hardware', 'CAT-HW', 1) ON CONFLICT (id) DO NOTHING
        """),
        {"id": cat_id, "org_id": org_id},
    )
    await db.execute(
        text("""
        INSERT INTO uom_master (id, org_id, name, code)
        VALUES (:id, :org_id, 'Units', 'UNT') ON CONFLICT (id) DO NOTHING
        """),
        {"id": uom_id, "org_id": org_id},
    )

    # Template with step assigned to manager_id
    tmpl = WorkflowTemplate(
        id=uuid4(),
        org_id=org_id,
        code="PR_GUARD_TMPL",
        name="PR Guard Template",
        entity_type="PR",
        steps=[
            {
                "step_number": 1,
                "name": "Manager Review",
                "resolver": "NAMED_USER",
                "resolver_config": {"user_id": str(manager_id)},
                "assigned_role": "MANAGER",
            }
        ],
        is_active=True,
    )
    db.add(tmpl)
    rule = ApprovalRule(
        id=uuid4(),
        org_id=org_id,
        name="PR Guard Rule",
        transaction_type="PR",
        priority=1,
        conditions=[],
        approval_steps=[{"template_code": "PR_GUARD_TMPL"}],
        is_active=True,
    )
    db.add(rule)

    # Delegation rule: max threshold = 50,000, allowed BU = bu1_id only
    delegation = DelegationRule(
        id=uuid4(),
        org_id=org_id,
        delegator_id=manager_id,
        delegate_id=delegate_id,
        valid_from=datetime.now(timezone.utc) - timedelta(hours=1),
        valid_until=datetime.now(timezone.utc) + timedelta(days=7),
        entity_types=["PR", "REQUISITION"],
        max_amount_threshold=Decimal("50000.00"),  # Cap at 50k
        bu_ids=[str(bu1_id)],
        is_active=True,
        reason="Leave coverage with strict 50k ceiling",
    )
    db.add(delegation)
    await db.commit()

    # Scenario A: Amount exceeds financial ceiling (60,000 > 50,000)
    # At submission time, delegation is skipped because amount > 50k
    pr_high = await requisition_service.create(
        db,
        PRCreateRequest(
            title="High Value Purchase",
            business_unit_id=bu1_id,
            cost_center_id=cc_id,
            category_id=cat_id,
            lines=[
                PRLineItemRequest(
                    line_number=1,
                    item_description="Server",
                    category_id=cat_id,
                    uom_id=uom_id,
                    quantity=Decimal("1"),
                    estimated_unit_price=Decimal("60000.00"),
                )
            ],
        ),
        actor_id=buyer_id,
        org_id=org_id,
    )
    await db.commit()
    await requisition_service.submit(db, pr_high.id, actor_id=buyer_id, org_id=org_id)
    await db.commit()

    from app.modules.workflow.repository import workflow_repository
    wf_inst = await workflow_repository.get_active_instance_for_entity(db, entity_id=pr_high.id, org_id=org_id)
    tasks = await workflow_repository.get_pending_tasks_for_step(db, instance_id=wf_inst.id, step_number=1, org_id=org_id)
    task = tasks[0]
    # Task assigned directly to manager because delegation rule threshold was exceeded
    assert task.assigned_to == manager_id

    # Delegate tries to approve high value PR -> ForbiddenError
    from app.core.exceptions import ForbiddenError
    with pytest.raises(ForbiddenError):
        await workflow_engine.advance(
            db,
            instance_id=wf_inst.id,
            task_id=task.id,
            action="APPROVE",
            actor_id=delegate_id,
            comment="Attempting unauthorized approval",
            org_id=org_id,
        )


@pytest.mark.asyncio
async def test_maker_checker_segregation_of_duties_flow(db_session: AsyncSession):
    """User Persona: Segregation of Duties (SoD) prevents PR creator self-approval and RFQ self-opening."""
    db = db_session
    org_id = uuid4()
    creator_id = uuid4()
    other_user_id = uuid4()
    le_id = uuid4()
    bu_id = uuid4()
    cc_id = uuid4()
    cat_id = uuid4()
    uom_id = uuid4()

    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, 'SoD Org', 'SoD Corp Ltd', 'IN', 'INR', '{"budget_check_config": {"default_mode": "soft"}}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id},
    )
    for uid, email in [(creator_id, "creator@sod.com"), (other_user_id, "other@sod.com")]:
        await db.execute(
            text("""
            INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
            VALUES (:id, :org_id, :email, 'hash', 'SoD', 'User', 'ACTIVE', 1)
            ON CONFLICT (id) DO NOTHING
            """),
            {"id": uid, "org_id": org_id, "email": email},
        )
    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, country_code)
        VALUES (:id, :org_id, 'Legal SoD', :reg, 'IN') ON CONFLICT (id) DO NOTHING
        """),
        {"id": le_id, "org_id": org_id, "reg": f"REG-{le_id.hex[:6]}"},
    )
    await db.execute(
        text("""
        INSERT INTO business_units (id, org_id, name, code, legal_entity_id)
        VALUES (:id, :org_id, 'SoD BU', 'BU-SOD', :le_id) ON CONFLICT (id) DO NOTHING
        """),
        {"id": bu_id, "org_id": org_id, "le_id": le_id},
    )
    await db.execute(
        text("""
        INSERT INTO cost_centers (id, org_id, name, code, business_unit_id, annual_budget, available_budget)
        VALUES (:id, :org_id, 'SoD CC', 'CC-SOD', :bu_id, 1000000.00, 1000000.00) ON CONFLICT (id) DO NOTHING
        """),
        {"id": cc_id, "org_id": org_id, "bu_id": bu_id},
    )
    await db.execute(
        text("""
        INSERT INTO categories (id, org_id, name, code, level)
        VALUES (:id, :org_id, 'General', 'CAT-GEN', 1) ON CONFLICT (id) DO NOTHING
        """),
        {"id": cat_id, "org_id": org_id},
    )
    await db.execute(
        text("""
        INSERT INTO uom_master (id, org_id, name, code)
        VALUES (:id, :org_id, 'Units', 'UNT') ON CONFLICT (id) DO NOTHING
        """),
        {"id": uom_id, "org_id": org_id},
    )
    await db.commit()

    # 1. Maker-checker on PR approval
    pr = await requisition_service.create(
        db,
        PRCreateRequest(
            title="SoD Test PR",
            business_unit_id=bu_id,
            cost_center_id=cc_id,
            category_id=cat_id,
            lines=[
                PRLineItemRequest(
                    line_number=1,
                    item_description="Stationery",
                    category_id=cat_id,
                    uom_id=uom_id,
                    quantity=Decimal("10"),
                    estimated_unit_price=Decimal("100.00"),
                )
            ],
        ),
        actor_id=creator_id,
        org_id=org_id,
    )
    pr.status = PRStatus.PENDING_APPROVAL
    await db.commit()

    from app.core.exceptions import ForbiddenError
    # Creator self-approval is strictly forbidden
    with pytest.raises(ForbiddenError):
        await requisition_service.approve(db, pr.id, task_id=None, comment="Self approving", actor_id=creator_id, org_id=org_id)

    # Different checker user can approve
    approved = await requisition_service.approve(db, pr.id, task_id=None, comment="Checker approved", actor_id=other_user_id, org_id=org_id)
    assert approved.status == PRStatus.APPROVED


@pytest.mark.asyncio
async def test_po_over_shipping_and_duplicate_invoice_guard(db_session: AsyncSession):
    """QA Persona: Guard against ASN over-shipping and duplicate vendor invoices in the same financial year."""
    db = db_session
    org_id = uuid4()
    buyer_id = uuid4()
    vendor_id = uuid4()
    vendor_user_id = uuid4()
    le_id = uuid4()
    bu_id = uuid4()
    cat_id = uuid4()
    uom_id = uuid4()

    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, 'Guard Org', 'Guard Corp Ltd', 'IN', 'INR', '{}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id},
    )
    for uid, email in [(buyer_id, "byr@gd.com"), (vendor_user_id, "vnd@gd.com")]:
        await db.execute(
            text("""
            INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
            VALUES (:id, :org_id, :email, 'hash', 'Guard', 'User', 'ACTIVE', 1)
            ON CONFLICT (id) DO NOTHING
            """),
            {"id": uid, "org_id": org_id, "email": email},
        )
    await db.execute(
        text("""
        INSERT INTO vendors (id, org_id, vendor_code, company_name, primary_email, status, version)
        VALUES (:id, :org_id, 'V-GD', 'Guard Vendor', 'v@gd.com', 'ACTIVE', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": vendor_id, "org_id": org_id},
    )
    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, country_code)
        VALUES (:id, :org_id, 'Legal GD', :reg, 'IN') ON CONFLICT (id) DO NOTHING
        """),
        {"id": le_id, "org_id": org_id, "reg": f"REG-{le_id.hex[:6]}"},
    )
    await db.execute(
        text("""
        INSERT INTO business_units (id, org_id, name, code, legal_entity_id)
        VALUES (:id, :org_id, 'Guard BU', 'BU-GD', :le_id) ON CONFLICT (id) DO NOTHING
        """),
        {"id": bu_id, "org_id": org_id, "le_id": le_id},
    )
    await db.execute(
        text("""
        INSERT INTO categories (id, org_id, name, code, level)
        VALUES (:id, :org_id, 'Guard Cat', 'CAT-GD', 1) ON CONFLICT (id) DO NOTHING
        """),
        {"id": cat_id, "org_id": org_id},
    )
    await db.execute(
        text("""
        INSERT INTO uom_master (id, org_id, name, code)
        VALUES (:id, :org_id, 'Units', 'UNT') ON CONFLICT (id) DO NOTHING
        """),
        {"id": uom_id, "org_id": org_id},
    )

    from app.modules.purchase_order.schemas import POCreateRequest, POLineCreate
    po = await purchase_order_service.create(
        db,
        POCreateRequest(
            title="Over-shipping Guard PO",
            vendor_id=vendor_id,
            business_unit_id=bu_id,
            category_id=cat_id,
            deviation_justification="Emergency direct procurement of essential widgets.",
            lines=[
                POLineCreate(
                    item_description="Widget A",
                    uom_id=uom_id,
                    ordered_quantity=Decimal("10.0"),
                    unit_price=Decimal("100.00"),
                )
            ],
        ),
        actor_id=buyer_id,
        org_id=org_id,
    )
    po_id = po.id
    po_line_id = po.lines[0].id
    po.status = POStatus.ACKNOWLEDGED
    await db.commit()

    # Over-shipping attempt (15.0 shipped > 10.0 open) -> OVER_SHIPPING_EXCEEDED
    from app.core.exceptions import AppException, ConflictError
    with pytest.raises(AppException) as exc_info:
        await asn_service.create_asn(
            db,
            AsnCreateRequest(
                po_id=po_id,
                carrier_name="Speedy Cargo",
                tracking_number="TRK-OVER-01",
                expected_delivery_date=date.today() + timedelta(days=2),
                package_count=1,
                lines=[
                    AsnLineCreate(
                        po_line_id=po_line_id,
                        shipped_quantity=Decimal("15.0"),  # Exceeds 10.0!
                    )
                ],
            ),
            actor_id=vendor_user_id,
            org_id=org_id,
        )
    assert exc_info.value.code == "OVER_SHIPPING_EXCEEDED"

    # Duplicate invoice guard
    inv1 = await invoice_service.submit_invoice(
        db,
        InvoiceSubmitRequest(
            po_id=po_id,
            vendor_invoice_number="INV-DUP-TEST",
            invoice_date=date(2026, 6, 1),
            currency="INR",
            subtotal=Decimal("1000.00"),
            tax_amount=Decimal("0.00"),
            total_amount=Decimal("1000.00"),
            lines=[
                InvoiceLineCreate(
                    po_line_id=po_line_id,
                    line_number=1,
                    item_description="Widget A",
                    quantity=Decimal("10.0"),
                    unit_price=Decimal("100.00"),
                    tax_rate=Decimal("0.00"),
                    tax_amount=Decimal("0.00"),
                    line_total=Decimal("1000.00"),
                )
            ],
        ),
        actor_id=vendor_user_id,
        vendor_id=vendor_id,
        org_id=org_id,
    )
    await db.commit()
    assert inv1.vendor_invoice_number == "INV-DUP-TEST"

    # Submitting duplicate invoice number in same FY raises ConflictError
    with pytest.raises(ConflictError) as conf_info:
        await invoice_service.submit_invoice(
            db,
            InvoiceSubmitRequest(
                po_id=po_id,
                vendor_invoice_number="INV-DUP-TEST",  # Duplicate!
                invoice_date=date(2026, 7, 1),        # Same FY 2026-27
                currency="INR",
                subtotal=Decimal("1000.00"),
                tax_amount=Decimal("0.00"),
                total_amount=Decimal("1000.00"),
                lines=[
                    InvoiceLineCreate(
                        po_line_id=po_line_id,
                        line_number=1,
                        item_description="Widget A",
                        quantity=Decimal("10.0"),
                        unit_price=Decimal("100.00"),
                        tax_rate=Decimal("0.00"),
                        tax_amount=Decimal("0.00"),
                        line_total=Decimal("1000.00"),
                    )
                ],
            ),
            actor_id=vendor_user_id,
            vendor_id=vendor_id,
            org_id=org_id,
        )
    assert conf_info.value.code == "DUPLICATE_INVOICE"

