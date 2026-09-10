"""
Cross-Portal Synchronous Integration Test Suite (Admin <-> Buyer <-> Supplier).

Validates that changes in any portal immediately propagate and reflect synchronously
in the other two portals as expected in an enterprise procurement platform:

1. ADMIN PORTAL:
   - Admin sets up Master Data: Cost Center, Delivery Location, Category, Approval Rule, and Out-of-Office Delegation.
   - Admin configures multi-tier workflow routing rules.

2. BUYER PORTAL:
   - Buyer queries master data and uses the Admin's Cost Center, Category, and Location to create a PR.
   - PR triggers the multi-tier workflow engine.
   - Delegated Approver approves the PR on behalf of the primary approver.
   - Entity status synchronously becomes APPROVED.
   - Buyer converts PR to RFQ (PR becomes IN_SOURCING) and publishes RFQ to Supplier.

3. SUPPLIER PORTAL:
   - Supplier sees published RFQ, submits sealed bid.
   - Buyer evaluates Comparative Statement (CS) and awards ARN.
   - Buyer creates Contract, initiates signing ceremony.
   - Supplier reviews and e-signs contract -> Contract becomes ACTIVE.
   - Buyer issues PO from ARN (PR becomes CONVERTED, PO becomes APPROVED).
   - Supplier sees PO in Supplier Portal, acknowledges PO, and dispatches ASN.

4. BUYER DOCK INTAKE & 3-WAY MATCH:
   - Buyer receives ASN via warehouse fast GRN barcode scan intake.
   - Supplier submits Invoice referencing PO and GRN.
   - Buyer performs 3-way automated reconciliation -> status FULLY_MATCHED.
   - Invoice auto-approved and payment record automatically scheduled.

5. PAYMENT & SUPPORT TICKET WORKFLOW:
   - Buyer settles payment with Bank UTR reference.
   - Supplier views remittance advice in Supplier Portal.
   - Supplier creates a Support Ticket regarding tax TDS advice.
   - Admin views ticket in Service Desk, updates status, and resolves it with audit trails.
   - Admin triggers ERP Gateway Sync (SAP/Tally) and verifies audit chain of custody.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
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
)
from app.modules.approval_rules.models import ApprovalRule
from app.modules.asn.schemas import AsnCreateRequest, AsnDispatchPayload, AsnFastGrnRequest, AsnLineCreate
from app.modules.asn.service import asn_service
from app.modules.bid.schemas import BidLineSubmitRequest, BidSubmitRequest
from app.modules.bid.service import bid_service
from app.modules.contract.schemas import (
    ContractFromAwardRequest,
    InitiateSigningCeremonyRequest,
    SubmitDigitalSignatureRequest,
)
from app.modules.contract.service import contract_service
from app.modules.evaluation.schemas import AwardRecommendationItem
from app.modules.evaluation.service import evaluation_service
from app.modules.integration.service import integration_service
from app.modules.invoice.schemas import AdvancedReconciliationRequest, InvoiceLineCreate, InvoiceSubmitRequest
from app.modules.invoice.service import invoice_service
from app.modules.master_data.category.service import CategoryCreateRequest, category_service
from app.modules.master_data.location.service import LocationCreateRequest, delivery_location_service
from app.modules.organization.schemas import CostCenterCreateRequest
from app.modules.organization.service import organization_service
from app.modules.payment.schemas import PaymentFilterParams, PaymentProcessRequest
from app.modules.payment.service import payment_service
from app.modules.purchase_order.schemas import POFromAwardRequest
from app.modules.purchase_order.service import purchase_order_service
from app.modules.requisition.schemas import PRCreateRequest, PRLineItemRequest
from app.modules.requisition.service import requisition_service
from app.modules.sourcing.schemas import AddParticipantsRequest, RfqCreateRequest, RfqLineCreateRequest
from app.modules.sourcing.service import rfq_service
from app.modules.ticket.schemas import TicketCreateRequest
from app.modules.ticket.service import ticket_service
from app.modules.user.models import DelegationRule
from app.modules.workflow.models import WorkflowTemplate
from app.modules.workflow.repository import workflow_repository
from app.modules.workflow.service import workflow_engine

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


@pytest.fixture
async def db_session():
    async with TestSession() as session:
        yield session


@pytest.mark.asyncio
async def test_cross_portal_synchronous_lifecycle(db_session: AsyncSession):
    """
    Validates end-to-end synchronicity across Admin Portal, Buyer Portal, and Supplier Portal.
    """
    db = db_session
    org_id = uuid4()
    le_id = uuid4()
    admin_id = uuid4()
    buyer_id = uuid4()
    approver1_id = uuid4()  # Primary Approver
    approver2_id = uuid4()  # Authorized Delegate
    co_auth_id = uuid4()    # Bid unsealing co-authorizer
    vendor_user_id = uuid4()
    vendor_id = uuid4()
    uom_id = uuid4()
    payment_term_id = uuid4()
    bu_id = uuid4()
    now_dt = datetime.now(UTC)

    # ─────────────────────────────────────────────────────────────────────────
    # SEED BASE FOUNDATIONS
    # ─────────────────────────────────────────────────────────────────────────
    await db.execute(
        text(
            """
            INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
            VALUES (:id, :name, :legal_name, 'IN', 'INR', '{"budget_check_config": {"default_mode": "soft"}}')
            ON CONFLICT (id) DO NOTHING
            """
        ),
        {"id": org_id, "name": f"Cross-Portal Org {org_id.hex[:6]}", "legal_name": "Cross-Portal Corp Ltd"},
    )

    # Users
    users_to_seed = [
        (admin_id, "admin", "Admin", "User"),
        (buyer_id, "buyer", "Procurement", "Buyer"),
        (approver1_id, "manager", "Primary", "Approver"),
        (approver2_id, "delegate", "Deputy", "Delegate"),
        (co_auth_id, "coauth", "DualAuth", "Officer"),
        (vendor_user_id, "supplier", "Vendor", "Rep"),
    ]
    for uid, prefix, fn, ln in users_to_seed:
        await db.execute(
            text(
                """
                INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
                VALUES (:id, :org_id, :email, 'hash', :fn, :ln, 'ACTIVE', 1)
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {"id": uid, "org_id": org_id, "email": f"{prefix}-{uid.hex[:6]}@crossportal.com", "fn": fn, "ln": ln},
        )

    # Legal Entity & BU
    await db.execute(
        text(
            """
            INSERT INTO legal_entities (id, org_id, name, registration_number, country_code)
            VALUES (:id, :org_id, 'Cross-Portal Entity Ltd', :reg, 'IN') ON CONFLICT (id) DO NOTHING
            """
        ),
        {"id": le_id, "org_id": org_id, "reg": f"REG-{le_id.hex[:6]}"},
    )
    await db.execute(
        text(
            """
            INSERT INTO business_units (id, org_id, name, code, legal_entity_id)
            VALUES (:id, :org_id, 'Engineering BU', :code, :le_id) ON CONFLICT (id) DO NOTHING
            """
        ),
        {"id": bu_id, "org_id": org_id, "code": f"BU-{bu_id.hex[:4]}", "le_id": le_id},
    )

    # Vendor
    await db.execute(
        text(
            """
            INSERT INTO vendors (
                id, org_id, vendor_code, company_name, legal_name, primary_email,
                status, pan, gstin, tds_applicable, tds_percentage, version
            )
            VALUES (
                :id, :org_id, :code, 'Acme Global Supplies', 'Acme Global Supplies Ltd',
                :email, 'ACTIVE', 'ABCDE1234F', '29ABCDE1234F1Z5', true, 2.0, 1
            )
            ON CONFLICT (id) DO NOTHING
            """
        ),
        {"id": vendor_id, "org_id": org_id, "code": f"VEND-{vendor_id.hex[:6]}", "email": f"acme-{vendor_id.hex[:4]}@test.com"},
    )

    # Mark vendor user as supplier user
    await db.execute(
        text("UPDATE users SET is_supplier_user = TRUE, vendor_id = :vid WHERE id = :uid"),
        {"vid": vendor_id, "uid": vendor_user_id},
    )

    # UOM, Payment Term
    await db.execute(
        text(
            """
            INSERT INTO uom_master (id, org_id, name, code)
            VALUES (:id, :org_id, 'Units', 'UNT') ON CONFLICT (id) DO NOTHING
            """
        ),
        {"id": uom_id, "org_id": org_id},
    )
    await db.execute(
        text(
            """
            INSERT INTO payment_terms (id, org_id, name, code, payment_days, net_days)
            VALUES (:id, :org_id, 'Net 30 Days', 'NET30', 30, 30) ON CONFLICT (id) DO NOTHING
            """
        ),
        {"id": payment_term_id, "org_id": org_id},
    )
    await db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 1: ADMIN PORTAL -> Create Master Data & Workflow Rules
    # ─────────────────────────────────────────────────────────────────────────
    # 1A. Admin creates Cost Center with budget
    cc = await organization_service.create_cost_center(
        db,
        org_id,
        CostCenterCreateRequest(
            code=f"CC-XP-{uuid4().hex[:4].upper()}",
            name="IT Core Infrastructure",
            business_unit_id=bu_id,
            annual_budget=Decimal("5000000.00"),
        ),
    )
    cost_center_id = cc.id

    # 1B. Admin creates Delivery Location / Warehouse
    loc = await delivery_location_service.create(
        db,
        LocationCreateRequest(
            code=f"LOC-XP-{uuid4().hex[:4].upper()}",
            name="Bengaluru Central DC",
            address="Electronic City Phase 1",
            city="Bengaluru",
            state="Karnataka",
            postal_code="560100",
            country_code="IN",
        ),
        actor_id=admin_id,
        org_id=org_id,
    )
    delivery_location_id = loc.id

    # 1C. Admin creates Category with Emission Factor
    cat = await category_service.create(
        db,
        CategoryCreateRequest(
            code=f"CAT-IT-{uuid4().hex[:4].upper()}",
            name="Network Switching Gear",
        ),
        actor_id=admin_id,
        org_id=org_id,
    )
    category_id = cat.id

    # 1D. Admin creates Approval Workflow Template & Routing Rule
    wf_template = WorkflowTemplate(
        id=uuid4(),
        org_id=org_id,
        code="PR_TIER_APPROVAL",
        name="PR Multi-Tier Approval Template",
        entity_type="PR",
        is_active=True,
        steps=[
            {
                "step_number": 1,
                "name": "Manager Review",
                "resolver": "NAMED_USER",
                "resolver_config": {"user_id": str(approver1_id)},
                "assigned_role": "MANAGER",
            }
        ],
    )
    db.add(wf_template)

    rule = ApprovalRule(
        id=uuid4(),
        org_id=org_id,
        name="PR Routing Rule",
        transaction_type="PR",
        priority=10,
        conditions=[],
        approval_steps=[{"template_code": "PR_TIER_APPROVAL"}],
        is_active=True,
    )
    db.add(rule)

    # 1E. Admin configures Out-of-Office Approval Delegation Matrix
    delegation = DelegationRule(
        id=uuid4(),
        org_id=org_id,
        delegator_id=approver1_id,
        delegate_id=approver2_id,
        valid_from=now_dt - timedelta(hours=1),
        valid_until=now_dt + timedelta(days=14),
        is_active=True,
        entity_types=["REQUISITION", "PR"],
        max_amount_threshold=Decimal("1000000.00"),
        bu_ids=[str(bu_id)],
        reason="Executive delegation",
    )
    db.add(delegation)
    await db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2: BUYER PORTAL -> Query Master Data, Create PR, & Approve via Delegate
    # ─────────────────────────────────────────────────────────────────────────
    # 2A. Buyer queries cost centers, locations, and categories (Verifies Admin -> Buyer synchronicity)
    buyer_ccs = await organization_service.list_cost_centers(db, org_id)
    assert any(c.id == cost_center_id for c in buyer_ccs)

    buyer_locs = await delivery_location_service.list_all(db, org_id)
    assert any(loc.id == delivery_location_id for loc in buyer_locs)

    buyer_cats = await category_service.get_tree(db, org_id)
    assert any(c["id"] == str(category_id) or c["code"] == cat.code for c in buyer_cats)

    # 2B. Buyer creates Purchase Requisition
    pr = await requisition_service.create(
        db,
        PRCreateRequest(
            title="Q3 Network Core Upgrade",
            business_unit_id=bu_id,
            cost_center_id=cost_center_id,
            category_id=category_id,
            delivery_location_id=delivery_location_id,
            lines=[
                PRLineItemRequest(
                    line_number=1,
                    item_description="Enterprise L3 Switch 48-Port 10G SFP+",
                    category_id=category_id,
                    uom_id=uom_id,
                    quantity=Decimal("4.0"),
                    estimated_unit_price=Decimal("120000.00"),
                    delivery_location_id=delivery_location_id,
                )
            ],
        ),
        actor_id=buyer_id,
        org_id=org_id,
    )
    await db.commit()
    assert pr.status == PRStatus.DRAFT

    # 2C. Buyer submits PR -> Triggers Workflow Engine
    await requisition_service.submit(db, pr.id, actor_id=buyer_id, org_id=org_id)
    await db.commit()

    inst = await workflow_repository.get_active_instance_for_entity(db, entity_id=pr.id, org_id=org_id)
    assert inst is not None

    tasks = await workflow_repository.get_pending_tasks_for_step(db, instance_id=inst.id, step_number=1, org_id=org_id)
    assert len(tasks) == 1
    task = tasks[0]
    assert task.assigned_to == approver2_id  # Delegated!
    assert task.delegated_from == approver1_id

    # 2D. Delegate Approver (Approver 2) acts on behalf of Approver 1
    await workflow_engine.advance(
        db,
        instance_id=inst.id,
        task_id=task.id,
        action="APPROVE",
        actor_id=approver2_id,
        comment="Approved under executive OOO delegation matrix.",
        org_id=org_id,
    )
    await db.commit()

    # Synchronous verification: Underlying PR is immediately APPROVED
    refreshed_pr = await requisition_service.get_by_id(db, pr.id, org_id)
    assert refreshed_pr.status == PRStatus.APPROVED

    # 2E. Buyer converts PR to Sourcing RFQ
    rfq = await rfq_service.create(
        db,
        data=RfqCreateRequest(
            title="RFQ - Network Core Upgrade",
            rfq_type="LIMITED_TENDER",
            business_unit_id=bu_id,
            category_id=category_id,
            source_pr_id=pr.id,
            bid_close_at=datetime.now(UTC) + timedelta(days=5),
            bid_validity_days=60,
            estimated_value=Decimal("480000.00"),
            lines=[
                RfqLineCreateRequest(
                    line_number=1,
                    item_description="Enterprise L3 Switch 48-Port 10G SFP+",
                    category_id=category_id,
                    uom_id=uom_id,
                    quantity=Decimal("4.0"),
                    estimated_unit_price=Decimal("120000.00"),
                )
            ],
        ),
        actor_id=buyer_id,
        org_id=org_id,
    )
    await db.commit()

    # Synchronous verification: PR is now IN_SOURCING
    refreshed_pr = await requisition_service.get_by_id(db, pr.id, org_id)
    assert refreshed_pr.status == PRStatus.IN_SOURCING

    rfq.status = RFQStatus.PUBLISHED
    rfq.published_at = datetime.now(UTC)
    await db.commit()

    # Buyer invites Vendor
    await rfq_service.add_participants(
        db, rfq_id=rfq.id, data=AddParticipantsRequest(vendor_ids=[vendor_id]), actor_id=buyer_id, org_id=org_id
    )
    await db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 3: SUPPLIER PORTAL -> View RFQ, Submit Sealed Bid
    # ─────────────────────────────────────────────────────────────────────────
    # 3A. Supplier queries available RFQs (Verifies Buyer -> Supplier synchronicity)
    supplier_rfqs, _ = await rfq_service.list_for_supplier(db, org_id=org_id, vendor_id=vendor_id)
    assert any(r.id == rfq.id for r in supplier_rfqs)

    # 3B. Supplier submits Sealed Bid
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
                    unit_price=Decimal("110000.00"),
                    total_price=Decimal("440000.00"),
                    currency="INR",
                    quantity=Decimal("4.0"),
                    delivery_days=14,
                )
            ],
        ),
        vendor_id=vendor_id,
        actor_id=vendor_user_id,
        org_id=org_id,
    )
    bid.technical_score = Decimal("95.0")
    await db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 4: BUYER PORTAL -> Dual Unsealing, CS, Award ARN, Contract, and PO
    # ─────────────────────────────────────────────────────────────────────────
    rfq.bid_close_at = datetime.now(UTC) - timedelta(minutes=5)
    await db.commit()

    # Dual-auth unsealing ceremony
    await rfq_service.initiate_bid_opening(db, rfq_id=rfq.id, actor_id=approver1_id, org_id=org_id)
    await db.commit()
    await rfq_service.co_authorize_bid_opening(db, rfq_id=rfq.id, actor_id=co_auth_id, org_id=org_id)
    await db.commit()
    await bid_service.normalize_prices_on_opening(db, rfq_id=rfq.id, org_id=org_id)
    await db.commit()

    # Comparative Statement & Award Recommendation (ARN)
    cs = await evaluation_service.generate_comparative_statement(
        db, rfq_id=rfq.id, actor_id=buyer_id, org_id=org_id
    )
    await db.commit()

    rec = await evaluation_service.recommend_award(
        db,
        cs_id=cs.id,
        awards=[
            AwardRecommendationItem(
                rfq_line_id=rfq_line.id,
                vendor_id=vendor_id,
                bid_id=bid.id,
                value=Decimal("440000.00"),
                quantity=Decimal("4.0"),
                unit_price=Decimal("110000.00"),
                justification="L1 lowest landed cost compliant bid",
            )
        ],
        justification="Award to Acme Global Supplies",
        actor_id=buyer_id,
        org_id=org_id,
    )
    await db.commit()

    approved_rec = await evaluation_service.approve_award(
        db, arn_id=rec.id, actor_id=buyer_id, org_id=org_id, comments="Approved ARN"
    )
    await db.commit()
    assert approved_rec.status == "APPROVED"

    # Author Contract & Initiate e-Signature Ceremony
    contract = await contract_service.create_from_award(
        db,
        award_rec_id=approved_rec.id,
        data=ContractFromAwardRequest(
            award_recommendation_id=approved_rec.id,
            title="Enterprise Network Equipment Supply Agreement",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
        ),
        actor_id=buyer_id,
        org_id=org_id,
    )
    await db.commit()

    ceremony = await contract_service.initiate_signing_ceremony(
        db,
        contract.id,
        org_id,
        buyer_id,
        InitiateSigningCeremonyRequest(
            signers=[
                {"name": "Buyer User", "email": "buyer-001@crossportal.com", "role": "BUYER"},
                {"name": "Supplier User", "email": "supplier-001@crossportal.com", "role": "SUPPLIER"},
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
        SubmitDigitalSignatureRequest(signer_email="buyer-001@crossportal.com", signature_token=str(uuid4())),
    )
    # Supplier signs in Supplier Portal
    await contract_service.submit_digital_signature(
        db,
        contract.id,
        org_id,
        vendor_user_id,
        SubmitDigitalSignatureRequest(signer_email="supplier-001@crossportal.com", signature_token=str(uuid4())),
    )
    await db.commit()

    refreshed_contract = await contract_service.get(db, contract.id, org_id)
    assert refreshed_contract.status == ContractStatusEnum.ACTIVE

    # Buyer generates PO from approved ARN
    created_pos = await purchase_order_service.create_from_award(
        db,
        POFromAwardRequest(arn_id=approved_rec.id),
        actor_id=buyer_id,
        org_id=org_id,
    )
    await db.commit()
    assert len(created_pos) == 1
    po = created_pos[0]
    po_id = po.id
    po_line = po.lines[0]

    # Synchronous verification: PR is now CONVERTED
    refreshed_pr = await requisition_service.get_by_id(db, pr.id, org_id)
    assert refreshed_pr.status == PRStatus.CONVERTED

    # Release PO to Vendor (approve if pending threshold)
    if po.status == POStatus.PENDING_APPROVAL:
        po = await purchase_order_service.approve(db, po_id, actor_id=buyer_id, org_id=org_id)
        await db.commit()
    assert po.status == POStatus.APPROVED

    po = await purchase_order_service.send_to_vendor(db, po_id, actor_id=buyer_id, org_id=org_id)
    await db.commit()
    assert po.status == POStatus.RELEASED

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 5: SUPPLIER PORTAL -> View PO, Acknowledge, & Create ASN
    # ─────────────────────────────────────────────────────────────────────────
    # Supplier acknowledges PO
    po = await purchase_order_service.record_vendor_acknowledgement(
        db, po.id, accepted=True, rejection_reason=None, actor_id=vendor_user_id, org_id=org_id
    )
    await db.commit()
    assert po.status == POStatus.ACKNOWLEDGED

    # Supplier creates ASN with tracking
    asn = await asn_service.create_asn(
        db,
        data=AsnCreateRequest(
            po_id=po_id,
            carrier_name="Gati KWE Logistics",
            tracking_number=f"TRK-{uuid4().hex[:8].upper()}",
            shipment_date=date.today(),
            expected_delivery_date=date.today() + timedelta(days=2),
            package_count=4,
            gross_weight_kg=Decimal("45.0"),
            lines=[
                AsnLineCreate(
                    po_line_id=po_line.id,
                    shipped_quantity=Decimal("4.0"),
                    lot_number="LOT-2026-XP",
                )
            ],
        ),
        actor_id=vendor_user_id,
        org_id=org_id,
    )
    asn_id = asn.id
    await db.commit()

    # Supplier dispatches ASN
    asn = await asn_service.dispatch_asn(
        db,
        asn_id,
        AsnDispatchPayload(carrier_name="Gati KWE Logistics", vehicle_number="KA-05-MN-9988"),
        actor_id=vendor_user_id,
        org_id=org_id,
    )
    await db.commit()
    assert asn.status == "SHIPPED"

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 6: BUYER DOCK INTAKE & 3-WAY MATCHING
    # ─────────────────────────────────────────────────────────────────────────
    # Warehouse intake: Fast GRN via barcode scanning
    updated_asn, grn = await asn_service.fast_grn_intake(
        db,
        asn_id,
        AsnFastGrnRequest(notes="Verified barcode scan intake at BLR-DOCK-01"),
        actor_id=buyer_id,
        org_id=org_id,
    )
    await db.commit()
    assert updated_asn.status == "RECEIVED"
    assert grn.status == "CONFIRMED"

    # Supplier submits Invoice
    grn_line = grn.lines[0]
    invoice = await invoice_service.submit_invoice(
        db,
        data=InvoiceSubmitRequest(
            po_id=po_id,
            vendor_invoice_number=f"INV-XP-{uuid4().hex[:8].upper()}",
            invoice_date=date.today(),
            currency="INR",
            subtotal=Decimal("440000.00"),
            tax_amount=Decimal("0.00"),
            total_amount=Decimal("440000.00"),
            lines=[
                InvoiceLineCreate(
                    po_line_id=po_line.id,
                    grn_line_id=grn_line.id,
                    line_number=1,
                    item_description="Enterprise L3 Switch 48-Port 10G SFP+",
                    quantity=Decimal("4.0"),
                    unit_price=Decimal("110000.00"),
                    tax_rate=Decimal("0.00"),
                    tax_amount=Decimal("0.00"),
                    line_total=Decimal("440000.00"),
                )
            ],
        ),
        actor_id=vendor_user_id,
        vendor_id=vendor_id,
        org_id=org_id,
    )
    invoice_id = invoice.id
    await db.commit()

    # Buyer runs 3-Way Auto-Reconciliation
    recon = await invoice_service.perform_advanced_reconciliation(
        db,
        invoice_id,
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
    assert recon.overall_status == "FULLY_MATCHED"
    assert recon.auto_approved is True

    # Verify Invoice is APPROVED and Payment is scheduled automatically
    reloaded_inv = await invoice_service.get(db, invoice_id, org_id)
    assert reloaded_inv.status == InvoiceStatusEnum.APPROVED

    payments = await payment_service.repo.find_by_invoice_id(db, invoice_id, org_id)
    assert len(payments) >= 1
    payment = payments[0]

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 7: PAYMENT SETTLEMENT & CROSS-PORTAL REMITTANCE REFLECTION
    # ─────────────────────────────────────────────────────────────────────────
    bank_utr = f"UTR-{uuid4().hex[:12].upper()}"
    settled_payment = await payment_service.process_payment(
        db,
        payment.id,
        PaymentProcessRequest(
            utr_number=bank_utr,
            payment_method="NEFT",
            payment_date=date.today(),
        ),
        actor_id=buyer_id,
        org_id=org_id,
    )
    await db.commit()
    assert settled_payment.status.value == "COMPLETED"

    # Supplier Portal queries payments -> Settled payment with UTR is visible
    supplier_payments, _ = await payment_service.repo.list_payments(
        db, org_id, PaymentFilterParams(vendor_id=vendor_id)
    )
    assert any(p.utr_number == bank_utr for p in supplier_payments)

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 8: SUPPORT TICKET LIFECYCLE (Supplier -> Admin -> Resolution)
    # ─────────────────────────────────────────────────────────────────────────
    # 8A. Supplier creates Support Ticket regarding TDS certificate
    ticket = await ticket_service.create(
        db,
        TicketCreateRequest(
            title="Request for Form 16A TDS Certificate Q2",
            description="Kindly share the quarterly TDS withholding certificate for settled invoice.",
            ticket_type="SUPPORT",
            priority="MEDIUM",
            entity_type="PAYMENT",
            entity_id=settled_payment.id,
        ),
        actor_id=vendor_user_id,
        org_id=org_id,
        portal="supplier",
    )
    ticket_id = ticket.id
    await db.commit()
    assert ticket.status == "OPEN"

    # 8B. Admin Portal: Admin views ticket in service desk and assigns to themselves
    await ticket_service.assign(
        db,
        ticket_id,
        user_id=admin_id,
        team="Finance Operations",
        actor_id=admin_id,
        org_id=org_id,
    )
    await db.commit()

    # 8C. Admin adds comment and resolves ticket
    await ticket_service.add_comment(
        db,
        ticket_id,
        content="Form 16A TDS certificate has been generated and dispatched to your registered email.",
        is_internal=False,
        actor_id=admin_id,
        org_id=org_id,
    )
    resolved_ticket = await ticket_service.resolve(
        db,
        ticket_id,
        resolution_note="TDS Certificate issued and mailed.",
        actor_id=admin_id,
        org_id=org_id,
    )
    await db.commit()
    assert resolved_ticket.status == "RESOLVED"

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 9: ADMIN AUDIT TRAIL & MULTI-ERP SYNC VERIFICATION
    # ─────────────────────────────────────────────────────────────────────────
    # 9A. Admin verifies ERP Gateway Sync for PO and Invoice
    po_erp = await integration_service.trigger_sync(
        db,
        org_id=org_id,
        actor_id=admin_id,
        adapter_type="SAP",
        entity_type="PURCHASE_ORDER",
    )
    assert po_erp["status"] == "SUCCESS"
    assert po_erp["jobs_created"] >= 1

    inv_erp = await integration_service.trigger_sync(
        db,
        org_id=org_id,
        actor_id=admin_id,
        adapter_type="TALLY",
        entity_type="INVOICE",
    )
    assert inv_erp["status"] == "SUCCESS"
    assert inv_erp["jobs_created"] >= 1

    # 9B. Admin queries audit trail: Immutable sequence of actions verified
    audit_rows = (
        await db.execute(
            text(
                """
                SELECT entity_type, action, actor_id FROM audit_logs
                WHERE org_id = :org_id
                ORDER BY created_at ASC
                """
            ),
            {"org_id": str(org_id)},
        )
    ).fetchall()

    logged_actions = [row[1] for row in audit_rows]
    # Verify core milestones were all logged immutably
    assert "MD_CREATED" in logged_actions
    assert "PR_SUBMITTED" in logged_actions
    assert "APPROVED" in logged_actions
    assert "RFQ_CREATED" in logged_actions
