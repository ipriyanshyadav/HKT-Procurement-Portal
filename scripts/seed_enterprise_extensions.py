"""
Enterprise extensions seed script.
Populates all remaining enterprise modules and subtabs across all 3 portals
(Buyer :3000, Supplier :3001, Admin :3002) with realistic, relational, and cohesive data:

1. Advance Shipping Notices (ASNs) & ASN Lines
2. E-Invoices & E-Way Bills
3. Service Entry Sheets (SES), Lines & Quality Inspections
4. Approval Delegation Rules
5. Vendor Onboarding Applications & Vendor Risk Assessments
6. Contract Lifecycle: Templates, Clauses, Instances, Redlines & E-Sign Sessions
7. Disaster Recovery: Backup Checkpoints & Failover Drills
8. Developer Platform: Webhook Subscriptions & Deliveries
9. Analytics & ESG: Maverick Spend Clusters & Supplier ESG Metrics
10. Compliance Posture: Comprehensive Scans & Findings
11. User Shopping Carts & Cart Items (Buyer Catalog)
12. User Scopes & Governance: BU Scopes, Category Scopes, COI Declarations, MFA & Company Access
13. Approval Groups & Members
14. Sourcing: RFQ Amendments & Bid Documents
15. Sourcing Evaluations: QCBS Evaluations & Scores
16. AI Sourcing: AI RFQ Drafts, Autonomous Negotiations & Radar Scores
17. Buyer-Vendor Communications: Threads & Messages
18. Integrations & Platform Extensions: Tenant Settings, Feature Flags, ERP Mappings,
    Material Group Mappings, Supplier Categories, Tier Pricing, Punchout Sessions,
    Document Versions, Auction Rank Snapshots, Bid Versions, Workflow Events,
    Unmapped PR Mapping Logs, Vendor ERP Sync Logs, Outbox Messages & Notification Preferences.

Safe, idempotent, zero dead code, zero print statements.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import DEFAULT_ORG_ID
from app.db.enums import EvaluationTypeEnum
from app.db.session import async_session
from app.modules.ai_sourcing.models import (
    AiRfqDraft,
    NegotiationRound,
    NegotiationSession,
    SupplierRadarScore,
)
from app.modules.analytics.models import MaverickSpendCluster, SupplierESGMetric
from app.modules.approval_rules.models import ApprovalRule, ApprovalRuleVersion
from app.modules.asn.models import AdvanceShippingNotice, AsnLine
from app.modules.bid.models import (
    AuctionRankSnapshot,
    BidDocument,
    BidResponse,
    BidVersion,
    LiveAuction,
)
from app.modules.catalog.models import CartItem, CatalogTierPricing, PunchoutConfig, PunchoutSession, UserCart
from app.modules.compliance.models import ComplianceFinding, ComplianceScan
from app.modules.contract.models import (
    Contract,
    ContractClause,
    ContractClauseInstance,
    ContractEsignSession,
    ContractRedline,
    ContractTemplate,
)
from app.modules.developer.models import WebhookDelivery, WebhookSubscription
from app.modules.disaster_recovery.models import DRBackupCheckpoint, DRFailoverDrill
from app.modules.document.models import Document, DocumentVersion
from app.modules.einvoicing.models import EInvoice, EWayBill
from app.modules.evaluation.models import Evaluation, EvaluationScore
from app.modules.grn.models import GoodsReceiptNote, GrnLine, QualityInspection, ServiceEntrySheet, SesLine
from app.modules.integration.models import ERPEntityMapping, FeatureFlag, OutboxMessage, TenantSetting
from app.modules.invoice.models import Invoice
from app.modules.master_data.models import Category, ErpMaterialGroupMapping, ItemMaster, SupplierCategory
from app.modules.notification.models import (
    CommunicationMessage,
    CommunicationThread,
    NotificationPreference,
)
from app.modules.organization.models import BusinessUnit, LegalEntity, UserCompanyAccess
from app.modules.purchase_order.models import PoLine, PurchaseOrder
from app.modules.requisition.models import UnmappedPrException, UnmappedPrMappingLog
from app.modules.sourcing.models import Rfq, RfqAmendment
from app.modules.user.models import (
    DelegationRule,
    PasswordHistory,
    User,
    UserBuScope,
    UserCategoryScope,
    UserCoiDeclaration,
    UserMfa,
)
from app.modules.vendor.models import (
    Vendor,
    VendorErpSyncLog,
    VendorOnboardingApplication,
    VendorRiskAssessment,
)
from app.modules.workflow.models import (
    ApprovalGroup,
    ApprovalGroupMember,
    WorkflowEvent,
    WorkflowInstance,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_enterprise_extensions")


async def seed_enterprise_extensions(session: AsyncSession | None = None) -> None:
    """Synchronously seed all enterprise extension entities with realistic relations."""
    if session is None:
        async with async_session() as db:
            await _seed_extensions_internal(db)
            await db.commit()
    else:
        await _seed_extensions_internal(session)


async def _seed_extensions_internal(db: AsyncSession) -> None:
    now_utc = datetime.now(UTC)
    today = date.today()

    logger.info("Seeding enterprise extension domains...")

    # Fetch Core Reference Entities
    users_res = await db.execute(select(User).where(User.org_id == DEFAULT_ORG_ID))
    users_by_email = {u.email: u for u in users_res.scalars().all()}

    admin_user = users_by_email.get("admin@procurement.com")
    buyer_user = users_by_email.get("buyer@procurement.com")
    approver_user = users_by_email.get("approver@procurement.com")
    finance_user = users_by_email.get("finance@procurement.com")
    warehouse_user = users_by_email.get("warehouse@procurement.com")
    ap_user = users_by_email.get("ap@procurement.com")
    super_admin_user = users_by_email.get("superadmin@procurement.com")
    acme_supplier_user = users_by_email.get("supplier@acme.com")
    gc_supplier_user = users_by_email.get("supplier@globalcloud.com")

    if not admin_user or not buyer_user:
        logger.warning("Required demo users not found. Ensure seed_demo_user has executed first.")
        return

    vendors_res = await db.execute(select(Vendor).where(Vendor.org_id == DEFAULT_ORG_ID))
    vendors_by_code = {v.vendor_code: v for v in vendors_res.scalars().all()}
    acme_vendor = vendors_by_code.get("V-10001")
    gc_vendor = vendors_by_code.get("V-10002")
    erg_vendor = vendors_by_code.get("V-10003")
    courier_vendor = vendors_by_code.get("V-10004")

    pos_res = await db.execute(select(PurchaseOrder).where(PurchaseOrder.org_id == DEFAULT_ORG_ID))
    pos_by_num = {po.po_number: po for po in pos_res.scalars().all()}
    po1 = pos_by_num.get("PO-2026-000001")
    po2 = pos_by_num.get("PO-2026-000002")
    po3 = pos_by_num.get("PO-2026-000003")
    po4 = pos_by_num.get("PO-2026-000004")

    po_lines_map: dict[UUID, list[PoLine]] = {}
    if pos_by_num:
        lines_res = await db.execute(
            select(PoLine).where(PoLine.po_id.in_([p.id for p in pos_by_num.values()]))
        )
        for line in lines_res.scalars().all():
            po_lines_map.setdefault(line.po_id, []).append(line)

    grns_res = await db.execute(select(GoodsReceiptNote).where(GoodsReceiptNote.org_id == DEFAULT_ORG_ID))
    grns_by_num = {g.grn_number: g for g in grns_res.scalars().all()}
    grn1 = grns_by_num.get("GRN-2026-000001")
    grn2 = grns_by_num.get("GRN-2026-000002")

    grn_lines_map: dict[UUID, list[GrnLine]] = {}
    if grns_by_num:
        grn_lines_res = await db.execute(
            select(GrnLine).where(GrnLine.grn_id.in_([g.id for g in grns_by_num.values()]))
        )
        for gline in grn_lines_res.scalars().all():
            grn_lines_map.setdefault(gline.grn_id, []).append(gline)

    invoices_res = await db.execute(select(Invoice).where(Invoice.org_id == DEFAULT_ORG_ID))
    invoices_by_num = {inv.invoice_number: inv for inv in invoices_res.scalars().all()}
    inv1 = invoices_by_num.get("INV-2026-000001")
    inv2 = invoices_by_num.get("INV-2026-000002")

    contracts_res = await db.execute(select(Contract).where(Contract.org_id == DEFAULT_ORG_ID))
    contracts_by_num = {c.contract_number: c for c in contracts_res.scalars().all()}
    con1 = contracts_by_num.get("CON-2026-000001")
    con2 = contracts_by_num.get("CON-2026-000002")

    rfqs_res = await db.execute(select(Rfq).where(Rfq.org_id == DEFAULT_ORG_ID))
    rfqs_by_num = {r.rfq_number: r for r in rfqs_res.scalars().all()}
    rfq1 = rfqs_by_num.get("RFQ-2026-000001")
    _rfq2 = rfqs_by_num.get("RFQ-2026-000002")
    rfq3 = rfqs_by_num.get("RFQ-2026-000003")
    rfq6 = rfqs_by_num.get("RFQ-2026-000006")

    bids_res = await db.execute(select(BidResponse).where(BidResponse.org_id == DEFAULT_ORG_ID))
    bids = bids_res.scalars().all()
    bid_acme = next((b for b in bids if acme_vendor and b.vendor_id == acme_vendor.id), None)
    bid_gc = next((b for b in bids if gc_vendor and b.vendor_id == gc_vendor.id), None)

    bu_res = await db.execute(select(BusinessUnit).where(BusinessUnit.org_id == DEFAULT_ORG_ID))
    bu = bu_res.scalars().first()

    legal_entity_res = await db.execute(select(LegalEntity).where(LegalEntity.org_id == DEFAULT_ORG_ID))
    legal_entity = legal_entity_res.scalars().first()

    cats_res = await db.execute(select(Category).where(Category.org_id == DEFAULT_ORG_ID))
    categories = {c.code: c for c in cats_res.scalars().all()}

    docs_res = await db.execute(select(Document).where(Document.org_id == DEFAULT_ORG_ID))
    documents = docs_res.scalars().all()
    first_doc = documents[0] if documents else None

    # -------------------------------------------------------------------------
    # 1. Advance Shipping Notices (ASNs) & Lines
    # -------------------------------------------------------------------------
    asn_check = await db.execute(select(AdvanceShippingNotice).where(AdvanceShippingNotice.org_id == DEFAULT_ORG_ID))
    asn_map: dict[str, AdvanceShippingNotice] = {a.asn_number: a for a in asn_check.scalars().all()}

    if po1 and acme_vendor and "ASN-2026-000001" not in asn_map:
        asn1 = AdvanceShippingNotice(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            asn_number="ASN-2026-000001",
            po_id=po1.id,
            vendor_id=acme_vendor.id,
            shipment_date=today - timedelta(days=3),
            expected_delivery_date=today - timedelta(days=2),
            carrier_name="BlueDart Express Limited",
            tracking_number="BD-982173491IN",
            vehicle_number="MH-04-AZ-9921",
            driver_name="Ramesh Shinde",
            driver_phone="+91-9820192831",
            packaging_type="BOX",
            package_count=3,
            gross_weight_kg=Decimal("24.50"),
            status="DELIVERED",
            barcode_data="ASN20260001MH04AZ9921",
            notes="Priority enterprise compute delivery. Pre-configured and tested.",
            shipped_at=now_utc - timedelta(days=3),
            received_at=now_utc - timedelta(days=2),
            grn_id=grn1.id if grn1 else None,
            created_by=acme_supplier_user.id if acme_supplier_user else None,
            updated_by=admin_user.id,
            version=1,
        )
        db.add(asn1)
        asn_map["ASN-2026-000001"] = asn1

        po1_lines = po_lines_map.get(po1.id, [])
        for pline in po1_lines:
            db.add(
                AsnLine(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    asn_id=asn1.id,
                    po_line_id=pline.id,
                    item_code=pline.item_code or "IT-ITEM",
                    item_description=pline.item_description,
                    uom="EA",
                    ordered_quantity=pline.ordered_quantity,
                    shipped_quantity=pline.ordered_quantity,
                    received_quantity=pline.ordered_quantity,
                    lot_number="LOT-APL-2026-01",
                    serial_numbers=[f"SN-{pline.item_code or 'IT'}-{i:03d}" for i in range(1, 4)],
                    version=1,
                )
            )

    if po3 and acme_vendor and "ASN-2026-000002" not in asn_map:
        asn2 = AdvanceShippingNotice(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            asn_number="ASN-2026-000002",
            po_id=po3.id,
            vendor_id=acme_vendor.id,
            shipment_date=today - timedelta(days=2),
            expected_delivery_date=today - timedelta(days=1),
            carrier_name="Delhivery Express Freight",
            tracking_number="DL-883910283IN",
            vehicle_number="KA-01-MJ-4412",
            driver_name="Sunil Gowda",
            driver_phone="+91-9945012345",
            packaging_type="CRATE",
            package_count=2,
            gross_weight_kg=Decimal("18.00"),
            status="PARTIALLY_DELIVERED",
            barcode_data="ASN20260002KA01MJ4412",
            notes="Partial shipment of 12 units out of 20 ordered. Remaining 8 on backorder.",
            shipped_at=now_utc - timedelta(days=2),
            received_at=now_utc - timedelta(days=1),
            grn_id=grn2.id if grn2 else None,
            created_by=acme_supplier_user.id if acme_supplier_user else None,
            version=1,
        )
        db.add(asn2)
        asn_map["ASN-2026-000002"] = asn2

        po3_lines = po_lines_map.get(po3.id, [])
        for pline in po3_lines:
            db.add(
                AsnLine(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    asn_id=asn2.id,
                    po_line_id=pline.id,
                    item_code=pline.item_code or "IT-MON",
                    item_description=pline.item_description,
                    uom="EA",
                    ordered_quantity=pline.ordered_quantity,
                    shipped_quantity=Decimal("12.0000"),
                    received_quantity=Decimal("10.0000"),
                    lot_number="LOT-MON-2026-B",
                    serial_numbers=[f"SN-MON-{i:03d}" for i in range(1, 13)],
                    version=1,
                )
            )

    if po2 and gc_vendor and "ASN-2026-000003" not in asn_map:
        asn3 = AdvanceShippingNotice(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            asn_number="ASN-2026-000003",
            po_id=po2.id,
            vendor_id=gc_vendor.id,
            shipment_date=today,
            expected_delivery_date=today + timedelta(days=2),
            carrier_name="Gati KWE Logistics",
            tracking_number="GATI-77381920",
            vehicle_number="TS-07-EQ-8819",
            driver_name="Mohammed Ali",
            driver_phone="+91-9849011223",
            packaging_type="CONTAINER",
            package_count=1,
            gross_weight_kg=Decimal("5.50"),
            status="SHIPPED",
            barcode_data="ASN20260003TS07EQ8819",
            notes="Secure HSM cryptographic key hardware tokens in tamper-evident container.",
            shipped_at=now_utc - timedelta(hours=6),
            created_by=gc_supplier_user.id if gc_supplier_user else None,
            version=1,
        )
        db.add(asn3)
        asn_map["ASN-2026-000003"] = asn3

    if po4 and acme_vendor and "ASN-2026-000004" not in asn_map:
        asn4 = AdvanceShippingNotice(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            asn_number="ASN-2026-000004",
            po_id=po4.id,
            vendor_id=acme_vendor.id,
            shipment_date=today + timedelta(days=1),
            expected_delivery_date=today + timedelta(days=3),
            carrier_name="BlueDart Express Limited",
            tracking_number="BD-DRAFT-99018",
            vehicle_number="MH-04-TR-1100",
            packaging_type="BOX",
            package_count=1,
            gross_weight_kg=Decimal("12.00"),
            status="DRAFT",
            barcode_data="ASN20260004DRAFT",
            notes="Pre-dispatch packing and labeling in progress at Bengaluru warehouse.",
            created_by=acme_supplier_user.id if acme_supplier_user else None,
            version=1,
        )
        db.add(asn4)
        asn_map["ASN-2026-000004"] = asn4

    await db.flush()

    # -------------------------------------------------------------------------
    # 2. E-Invoicing & E-Way Bills
    # -------------------------------------------------------------------------
    einv_check = await db.execute(select(EInvoice).where(EInvoice.org_id == DEFAULT_ORG_ID))
    einv_by_doc = {e.doc_number: e for e in einv_check.scalars().all()}

    einv1 = einv_by_doc.get("INV-2026-000001")
    if inv1 and not einv1:
        einv1 = EInvoice(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            invoice_id=inv1.id,
            asn_id=asn_map.get("ASN-2026-000001").id if "ASN-2026-000001" in asn_map else None,
            seller_gstin="27AABCA1234A1Z5",
            buyer_gstin="27AABCU9603R1ZM",
            doc_number="INV-2026-000001",
            doc_type="INV",
            financial_year="2026-27",
            irn="f1a8c9b4e2d3f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
            ack_number="122610948271049",
            ack_date=now_utc - timedelta(days=1),
            total_invoice_value=Decimal("2159400.00"),
            total_tax_value=Decimal("329400.00"),
            signed_invoice='{"irn": "f1a8c9b4e2d3f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0", "status": "ACT", "issued_by": "NIC-IRN-PORTAL"}',
            signed_qr_code="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADIAQMAAACFi5LrAAAABlBMVEUAAAD///+l2Z/dAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANElEQVR4nO3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIB3A0vAAAEw3gfaAAAAAElFTkSuQmCC",
            status="GENERATED",
            peppol_xml="<Invoice xmlns='urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'><ID>INV-2026-000001</ID></Invoice>",
        )
        db.add(einv1)
        await db.flush()

        ewb_check = await db.execute(select(EWayBill).where(EWayBill.org_id == DEFAULT_ORG_ID))
        if not ewb_check.scalars().first():
            db.add(
                EWayBill(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    e_invoice_id=einv1.id,
                    asn_id=asn_map.get("ASN-2026-000001").id if "ASN-2026-000001" in asn_map else None,
                    ewb_number="271094820194",
                    ewb_date=now_utc - timedelta(days=3),
                    valid_until=now_utc + timedelta(days=2),
                    transporter_id="27AABCB9921C1Z1",
                    transporter_name="BlueDart Express Limited",
                    vehicle_number="MH-04-AZ-9921",
                    distance_km=Decimal("420.00"),
                    from_pincode="560066",
                    to_pincode="400076",
                    status="ACTIVE",
                )
            )

    if inv2 and "INV-2026-000002" not in einv_by_doc:
        db.add(
            EInvoice(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                invoice_id=inv2.id,
                seller_gstin="36BBCGB5678B1Z2",
                buyer_gstin="27AABCU9603R1ZM",
                doc_number="INV-2026-000002",
                doc_type="INV",
                financial_year="2026-27",
                irn="c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
                ack_number="122610948271050",
                ack_date=now_utc - timedelta(hours=8),
                total_invoice_value=Decimal("4248000.00"),
                total_tax_value=Decimal("648000.00"),
                signed_invoice='{"irn": "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4", "status": "ACT"}',
                signed_qr_code="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADIAQMAAACFi5LrAAAABlBMVEUAAAD///+l2Z/dAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANElEQVR4nO3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIB3A0vAAAEw3gfaAAAAAElFTkSuQmCC",
                status="GENERATED",
            )
        )

    await db.flush()

    # -------------------------------------------------------------------------
    # 3. Service Entry Sheets (SES), Lines & Quality Inspections
    # -------------------------------------------------------------------------
    ses_check = await db.execute(select(ServiceEntrySheet).where(ServiceEntrySheet.org_id == DEFAULT_ORG_ID))
    ses_by_num = {s.ses_number: s for s in ses_check.scalars().all()}

    if po2 and gc_vendor and "SES-2026-000001" not in ses_by_num:
        ses1 = ServiceEntrySheet(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            ses_number="SES-2026-000001",
            po_id=po2.id,
            vendor_id=gc_vendor.id,
            service_period_start=today - timedelta(days=30),
            service_period_end=today - timedelta(days=1),
            certified_by=warehouse_user.id if warehouse_user else admin_user.id,
            status="APPROVED",
            erp_ses_number="SAP-SES-990182",
            notes="Cloud architecture deployment, VPC peering, and container migration milestone 100% verified.",
            created_by=buyer_user.id,
            updated_by=admin_user.id,
            version=1,
        )
        db.add(ses1)
        ses_by_num["SES-2026-000001"] = ses1

        po2_lines = po_lines_map.get(po2.id, [])
        if po2_lines:
            db.add(
                SesLine(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    ses_id=ses1.id,
                    po_line_id=po2_lines[0].id,
                    service_description="Kubernetes Multi-Region Cluster Architecture & Load Balancer Setup",
                    completed_quantity=Decimal("1.0000"),
                    completion_percentage=Decimal("100.00"),
                    version=1,
                )
            )

    if po2 and gc_vendor and "SES-2026-000002" not in ses_by_num:
        ses2 = ServiceEntrySheet(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            ses_number="SES-2026-000002",
            po_id=po2.id,
            vendor_id=gc_vendor.id,
            service_period_start=today - timedelta(days=15),
            service_period_end=today,
            certified_by=warehouse_user.id if warehouse_user else admin_user.id,
            status="SUBMITTED",
            notes="DevOps continuous integration pipeline optimization - Under certification review.",
            created_by=buyer_user.id,
            version=1,
        )
        db.add(ses2)
        ses_by_num["SES-2026-000002"] = ses2

    qi_check = await db.execute(select(QualityInspection).where(QualityInspection.org_id == DEFAULT_ORG_ID))
    if not qi_check.scalars().first():
        if grn1 and grn_lines_map.get(grn1.id):
            db.add(
                QualityInspection(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    grn_line_id=grn_lines_map[grn1.id][0].id,
                    inspector_id=warehouse_user.id if warehouse_user else admin_user.id,
                    inspection_date=today - timedelta(days=2),
                    result="PASSED",
                    accepted_quantity=Decimal("10.0000"),
                    rejected_quantity=Decimal("0.0000"),
                    remarks="All 10 laptops completed AQL Level 1 visual, boot, and diagnostic hardware testing with zero defects.",
                    version=1,
                )
            )
        if grn2 and grn_lines_map.get(grn2.id):
            db.add(
                QualityInspection(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    grn_line_id=grn_lines_map[grn2.id][0].id,
                    inspector_id=warehouse_user.id if warehouse_user else admin_user.id,
                    inspection_date=today - timedelta(days=1),
                    result="REJECTED",
                    accepted_quantity=Decimal("10.0000"),
                    rejected_quantity=Decimal("2.0000"),
                    remarks="Transit impact damage detected on outer carton. 2 monitors have cracked bezels. Returned for vendor RMA replacement.",
                    version=1,
                )
            )

    await db.flush()

    # -------------------------------------------------------------------------
    # 4. Approval Delegation Rules
    # -------------------------------------------------------------------------
    deleg_check = await db.execute(select(DelegationRule).where(DelegationRule.org_id == DEFAULT_ORG_ID))
    if not deleg_check.scalars().first() and approver_user and finance_user and bu:
        db.add(
            DelegationRule(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                delegator_id=approver_user.id,
                delegate_id=finance_user.id,
                reason="Executive delegation during Annual Global Procurement Conference and Supplier Audits",
                valid_from=now_utc - timedelta(days=2),
                valid_until=now_utc + timedelta(days=14),
                entity_types=["REQUISITION", "PURCHASE_ORDER", "CONTRACT"],
                max_amount_threshold=Decimal("1000000.00"),
                bu_ids=[str(bu.id)],
                is_active=True,
                created_by=approver_user.id,
                version=1,
            )
        )
        await db.flush()

    # -------------------------------------------------------------------------
    # 5. Vendor Onboarding Applications & Risk Assessments
    # -------------------------------------------------------------------------
    onb_check = await db.execute(
        select(VendorOnboardingApplication).where(VendorOnboardingApplication.org_id == DEFAULT_ORG_ID)
    )
    onb_by_num = {o.application_number: o for o in onb_check.scalars().all()}

    if acme_vendor and "APP-2026-000001" not in onb_by_num:
        db.add(
            VendorOnboardingApplication(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                vendor_id=acme_vendor.id,
                application_number="APP-2026-000001",
                status="APPROVED",
                gstin_verified=True,
                pan_verified=True,
                penny_drop_verified=True,
                kyc_risk_tier="LOW",
                submitted_payload={
                    "company_name": acme_vendor.company_name,
                    "gstin": acme_vendor.gstin,
                    "pan": acme_vendor.pan,
                    "msme_registered": True,
                    "category": "IT Hardware & Solutions",
                },
                review_notes="All statutory documents, bank penny drop, and GST verification passed successfully.",
                reviewed_by=admin_user.id,
                reviewed_at=now_utc - timedelta(days=60),
                version=1,
            )
        )

    if gc_vendor and "APP-2026-000002" not in onb_by_num:
        db.add(
            VendorOnboardingApplication(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                vendor_id=gc_vendor.id,
                application_number="APP-2026-000002",
                status="APPROVED",
                gstin_verified=True,
                pan_verified=True,
                penny_drop_verified=True,
                kyc_risk_tier="LOW",
                submitted_payload={
                    "company_name": gc_vendor.company_name,
                    "gstin": gc_vendor.gstin,
                    "pan": gc_vendor.pan,
                    "soc2_certified": True,
                },
                review_notes="Approved for cloud and enterprise software hosting tier.",
                reviewed_by=admin_user.id,
                reviewed_at=now_utc - timedelta(days=45),
                version=1,
            )
        )

    if erg_vendor and "APP-2026-000003" not in onb_by_num:
        db.add(
            VendorOnboardingApplication(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                vendor_id=erg_vendor.id,
                application_number="APP-2026-000003",
                status="UNDER_REVIEW",
                gstin_verified=True,
                pan_verified=True,
                penny_drop_verified=False,
                kyc_risk_tier="MEDIUM",
                submitted_payload={"company_name": erg_vendor.company_name},
                review_notes="GST verified. Penny drop verification awaiting NPCI response.",
                reviewed_by=admin_user.id,
                version=1,
            )
        )

    if courier_vendor and "APP-2026-000004" not in onb_by_num:
        db.add(
            VendorOnboardingApplication(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                vendor_id=courier_vendor.id,
                application_number="APP-2026-000004",
                status="SUBMITTED",
                gstin_verified=True,
                pan_verified=False,
                penny_drop_verified=False,
                kyc_risk_tier="MEDIUM",
                submitted_payload={"company_name": courier_vendor.company_name},
                review_notes="Application submitted by vendor. Scheduled for KYC compliance review.",
                version=1,
            )
        )

    risk_check = await db.execute(select(VendorRiskAssessment).where(VendorRiskAssessment.org_id == DEFAULT_ORG_ID))
    if not risk_check.scalars().first():
        risk_configs = [
            (acme_vendor, Decimal("15.00"), "CRISIL AA+", Decimal("88.50"), "LOW", "LOW", Decimal("0.35"), Decimal("18.00"), Decimal("82.00"), Decimal("85.00"), Decimal("90.00"), "AA", Decimal("16.50"), "LOW"),
            (gc_vendor, Decimal("10.50"), "ICRA AAA", Decimal("94.00"), "LOW", "LOW", Decimal("0.12"), Decimal("12.00"), Decimal("92.00"), Decimal("94.00"), Decimal("96.00"), "AAA", Decimal("11.20"), "LOW"),
            (erg_vendor, Decimal("38.00"), "CARE BBB+", Decimal("72.00"), "MEDIUM", "LOW", Decimal("0.85"), Decimal("42.00"), Decimal("65.00"), Decimal("70.00"), Decimal("75.00"), "BBB", Decimal("40.00"), "MEDIUM"),
            (courier_vendor, Decimal("58.00"), "CRISIL BB", Decimal("54.00"), "HIGH", "MEDIUM", Decimal("1.40"), Decimal("62.00"), Decimal("50.00"), Decimal("55.00"), Decimal("60.00"), "BB", Decimal("60.00"), "HIGH"),
        ]
        for v, frs, cr, fss, lr, br, dte, ers, env, soc, gov, esgr, ovr, tier in risk_configs:
            if v:
                db.add(
                    VendorRiskAssessment(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        vendor_id=v.id,
                        financial_risk_score=frs,
                        credit_rating=cr,
                        financial_stability_score=fss,
                        liquidity_risk=lr,
                        bankruptcy_risk=br,
                        debt_to_equity_ratio=dte,
                        esg_risk_score=ers,
                        environmental_score=env,
                        social_score=soc,
                        governance_score=gov,
                        esg_rating=esgr,
                        overall_risk_score=ovr,
                        risk_tier=tier,
                        risk_factors=[{"category": "FINANCIAL", "detail": f"Credit rating {cr}", "severity": tier}],
                        mitigation_actions=[{"action": "Continuous automated credit watch monitoring"}],
                        last_assessed_at=now_utc - timedelta(days=15),
                        assessed_by=admin_user.id,
                        version=1,
                    )
                )

    await db.flush()

    # -------------------------------------------------------------------------
    # 6. Contract Lifecycle: Templates, Clauses, Instances, Redlines & E-Sign
    # -------------------------------------------------------------------------
    tmpl_check = await db.execute(select(ContractTemplate).where(ContractTemplate.org_id == DEFAULT_ORG_ID))
    if not tmpl_check.scalars().first():
        db.add(
            ContractTemplate(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                name="Master Services Agreement (MSA) Standard Template",
                contract_type="SERVICES",
                template_content={
                    "clauses": ["Scope of Services", "SLA Obligations", "Payment Terms", "Confidentiality", "Limitation of Liability"],
                    "governing_law": "Republic of India",
                },
                is_active=True,
                created_by=admin_user.id,
                version=1,
            )
        )
        db.add(
            ContractTemplate(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                name="Annual Rate Contract (ARC) Hardware Template",
                contract_type="RATE_CONTRACT",
                template_content={"clauses": ["Pricing Schedule", "Warranty & Support", "Penalties for Downtime"]},
                is_active=True,
                created_by=admin_user.id,
                version=1,
            )
        )

    clause_check = await db.execute(select(ContractClause).where(ContractClause.org_id == DEFAULT_ORG_ID))
    clause_map = {c.clause_code: c for c in clause_check.scalars().all()}

    if "CLS-PAY-01" not in clause_map:
        c1 = ContractClause(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            clause_code="CLS-PAY-01",
            title="Statutory Payment Terms (Net 30 Days)",
            category="COMMERCIAL",
            standard_text="The Buyer shall settle all undisputed and verified invoices within 30 days of submission, subject to statutory TDS deductions.",
            risk_level="MEDIUM",
            is_mandatory=True,
            guidance_notes="Required under MSME payment act compliance.",
            version=1,
        )
        db.add(c1)
        clause_map["CLS-PAY-01"] = c1

    if "CLS-SLA-02" not in clause_map:
        c2 = ContractClause(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            clause_code="CLS-SLA-02",
            title="Service Level Agreement & Uptime Guarantee",
            category="OPERATIONAL",
            standard_text="The Service Provider guarantees 99.9% monthly availability for all managed cloud services with penalty credits.",
            risk_level="HIGH",
            is_mandatory=True,
            guidance_notes="Mandated by Enterprise Architecture Committee.",
            version=1,
        )
        db.add(c2)
        clause_map["CLS-SLA-02"] = c2

    await db.flush()

    c_inst_check = await db.execute(select(ContractClauseInstance).where(ContractClauseInstance.org_id == DEFAULT_ORG_ID))
    clause_instances = c_inst_check.scalars().all()

    if not clause_instances and con1 and "CLS-PAY-01" in clause_map:
        c_inst1 = ContractClauseInstance(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            contract_id=con1.id,
            clause_id=clause_map["CLS-PAY-01"].id,
            title="Payment Terms & Early Settlement Discount",
            current_text="Payment shall be made within 30 days of invoice submission with 1.5% prompt payment discount for payments within 10 days.",
            original_text="Payment shall be made within 45 days of invoice submission.",
            status="ACCEPTED",
            deviation_risk="LOW",
            order_index=1,
            version=1,
        )
        db.add(c_inst1)
        await db.flush()

        db.add(
            ContractRedline(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                contract_id=con1.id,
                clause_instance_id=c_inst1.id,
                author_id=acme_supplier_user.id if acme_supplier_user else None,
                author_type="SUPPLIER",
                original_text="Payment shall be made within 45 days of invoice submission.",
                proposed_text="Payment shall be made within 30 days of invoice submission with 1.5% prompt payment discount for payments within 10 days.",
                change_rationale="Alignment with MSME statutory compliance and working capital requirements.",
                diff_summary={"added": ["30 days", "1.5% prompt payment discount"], "removed": ["45 days"]},
                status="ACCEPTED",
                reviewed_by=buyer_user.id,
                reviewed_at=now_utc - timedelta(days=25),
                review_comment="Agreed to 30 days Net terms with prompt discount incentive.",
                version=1,
            )
        )

    if con2 and "CLS-SLA-02" in clause_map:
        c_inst2_check = await db.execute(
            select(ContractClauseInstance).where(ContractClauseInstance.contract_id == con2.id)
        )
        if not c_inst2_check.scalars().first():
            c_inst2 = ContractClauseInstance(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                contract_id=con2.id,
                clause_id=clause_map["CLS-SLA-02"].id,
                title="Service Level Agreement & High Availability",
                current_text="Standard uptime SLA of 99.5% per calendar month.",
                original_text="Standard uptime SLA of 99.5% per calendar month.",
                status="UNDER_REVIEW",
                deviation_risk="MEDIUM",
                order_index=1,
                version=1,
            )
            db.add(c_inst2)
            await db.flush()

            db.add(
                ContractRedline(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    contract_id=con2.id,
                    clause_instance_id=c_inst2.id,
                    author_id=buyer_user.id,
                    author_type="BUYER",
                    original_text="Standard uptime SLA of 99.5% per calendar month.",
                    proposed_text="Mission-critical uptime SLA of 99.95% with 10% penalty credit per 0.1% breach.",
                    change_rationale="Required for core production infrastructure.",
                    diff_summary={"added": ["99.95%", "10% penalty credit"], "removed": ["99.5%"]},
                    status="PENDING",
                    review_comment="Under negotiation with Global Cloud legal team.",
                    version=1,
                )
            )

    esign_check = await db.execute(select(ContractEsignSession).where(ContractEsignSession.org_id == DEFAULT_ORG_ID))
    if not esign_check.scalars().first() and con1:
        db.add(
            ContractEsignSession(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                contract_id=con1.id,
                ceremony_status="COMPLETED",
                signers=[
                    {
                        "name": super_admin_user.first_name + " " + super_admin_user.last_name if super_admin_user else "Alexander Vance",
                        "email": "superadmin@procurement.com",
                        "role": "BUYER_SIGNATORY",
                        "status": "SIGNED",
                        "timestamp": (now_utc - timedelta(days=60)).isoformat(),
                        "ip": "103.21.14.8",
                    },
                    {
                        "name": "Rajesh Kumar",
                        "email": "supplier@acme.com",
                        "role": "SUPPLIER_SIGNATORY",
                        "status": "SIGNED",
                        "timestamp": (now_utc - timedelta(days=60)).isoformat(),
                        "ip": "115.99.201.42",
                    },
                ],
                audit_trail_hash="9e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2d",
                completed_at=now_utc - timedelta(days=60),
                version=1,
            )
        )

    await db.flush()

    # -------------------------------------------------------------------------
    # 7. Disaster Recovery: Backup Checkpoints & Failover Drills
    # -------------------------------------------------------------------------
    dr_check = await db.execute(select(DRBackupCheckpoint).where(DRBackupCheckpoint.org_id == DEFAULT_ORG_ID))
    if not dr_check.scalars().first():
        db.add(
            DRBackupCheckpoint(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                checkpoint_type="HOT_STANDBY_BASEBACKUP",
                status="COMPLETED",
                storage_tier="HOT_STANDBY",
                storage_location="s3://procurement-dr-mumbai/backups/pg_wal_20260910_01.tar.gz",
                wal_start_lsn="0/16000028",
                wal_end_lsn="0/16000160",
                size_bytes=428901284,
                checksum_sha256="a35f12b6c4987e0291dfbc83a12903120abef873491823019283746192837412",
                worm_locked=True,
                worm_retention_until=now_utc + timedelta(days=365),
                metadata_json={"cluster": "pg-primary-mum-01", "pg_version": "16.2", "tables_count": 151},
                completed_at=now_utc - timedelta(hours=2),
                version=1,
            )
        )
        db.add(
            DRBackupCheckpoint(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                checkpoint_type="GLACIER_DEEP_ARCHIVE",
                status="COMPLETED",
                storage_tier="GLACIER_COLD",
                storage_location="s3://procurement-dr-cold-vault/monthly/snapshot_2026_08.enc",
                size_bytes=1290312849,
                checksum_sha256="b84f99a12c847e0129dfac83a12903120abef873491823019283746192837499",
                worm_locked=True,
                worm_retention_until=now_utc + timedelta(days=1095),
                metadata_json={"retention_years": 3, "compliance": "DPDP_2023"},
                completed_at=now_utc - timedelta(days=10),
                version=1,
            )
        )

    drill_check = await db.execute(select(DRFailoverDrill).where(DRFailoverDrill.org_id == DEFAULT_ORG_ID))
    if not drill_check.scalars().first():
        db.add(
            DRFailoverDrill(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                drill_code="DRILL-2026-Q2",
                drill_name="Q2 Automated Regional Failover Simulation (Mumbai -> Hyderabad)",
                target_environment="SECONDARY_K3S_COLD_STANDBY",
                status="COMPLETED",
                simulated_disaster_scenario="Primary Regional Data Center Power Grid Loss",
                target_rpo_minutes=15,
                target_rto_minutes=60,
                actual_rpo_minutes=Decimal("4.20"),
                actual_rto_minutes=Decimal("38.50"),
                rpo_compliant=True,
                rto_compliant=True,
                initiated_by=admin_user.id,
                started_at=now_utc - timedelta(days=45),
                completed_at=now_utc - timedelta(days=45) + timedelta(minutes=42),
                drill_phases=[
                    {"phase": "DNS_TRAFFIC_SWAP", "status": "SUCCESS", "duration_sec": 120},
                    {"phase": "REPLICA_PROMOTION", "status": "SUCCESS", "duration_sec": 840},
                    {"phase": "INTEGRITY_CHECK", "status": "SUCCESS", "duration_sec": 420},
                ],
                audit_report={"result": "PASSED", "data_loss_bytes": 0, "failover_duration_sec": 2310},
                version=1,
            )
        )
        db.add(
            DRFailoverDrill(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                drill_code="DRILL-2026-Q3",
                drill_name="Q3 Multi-Cloud Disaster Resilience & Data Integrity Drill",
                target_environment="SECONDARY_GCP_FAILOVER",
                status="SCHEDULED",
                simulated_disaster_scenario="Multi-Zone Total Partition",
                target_rpo_minutes=15,
                target_rto_minutes=45,
                initiated_by=admin_user.id,
                version=1,
            )
        )

    await db.flush()

    # -------------------------------------------------------------------------
    # 8. Developer Platform: Webhook Subscriptions & Deliveries
    # -------------------------------------------------------------------------
    wh_check = await db.execute(select(WebhookSubscription).where(WebhookSubscription.org_id == DEFAULT_ORG_ID))
    wh_sub = wh_check.scalars().first()

    if not wh_sub:
        wh_sub = WebhookSubscription(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            user_id=admin_user.id,
            endpoint_url="https://erp.internal.example.com/api/v1/webhooks/procurement",
            secret_token="whsec_99a8b7c6d5e4f3a2b1c0d9e8f7",  # noqa: S106
            description="Real-time SAP S/4HANA Purchase Order & Goods Receipt Sync",
            subscribed_events=["purchase_order.acknowledged", "goods_receipt.approved", "invoice.matched"],
            is_active=True,
            failure_count=0,
            last_delivery_at=now_utc - timedelta(minutes=30),
            last_delivery_status=200,
        )
        db.add(wh_sub)
        await db.flush()

        db.add(
            WebhookDelivery(
                id=uuid4(),
                subscription_id=wh_sub.id,
                event_type="purchase_order.acknowledged",
                payload={
                    "event": "purchase_order.acknowledged",
                    "po_number": "PO-2026-000001",
                    "vendor": "Acme Tech Solutions",
                    "total_amount": 2159400.0,
                },
                response_status_code=200,
                response_body='{"status": "ACK", "idoc_number": "00000009182310"}',
                execution_time_ms=142,
                is_success=True,
                attempt_number=1,
            )
        )
        db.add(
            WebhookDelivery(
                id=uuid4(),
                subscription_id=wh_sub.id,
                event_type="goods_receipt.approved",
                payload={"event": "goods_receipt.approved", "grn_number": "GRN-2026-000001", "po_number": "PO-2026-000001"},
                response_status_code=200,
                response_body='{"status": "ACK", "sap_material_doc": "50000912"}',
                execution_time_ms=98,
                is_success=True,
                attempt_number=1,
            )
        )

    await db.flush()

    # -------------------------------------------------------------------------
    # 9. Analytics & ESG: Maverick Spend Clusters & Supplier ESG Metrics
    # -------------------------------------------------------------------------
    mav_check = await db.execute(select(MaverickSpendCluster).where(MaverickSpendCluster.org_id == DEFAULT_ORG_ID))
    if not mav_check.scalars().first():
        db.add(
            MaverickSpendCluster(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                cluster_type="OFF_CONTRACT_LEAKAGE",
                cluster_title="Unmanaged IT Peripheral Purchases outside Rate Contract CON-1",
                severity="HIGH",
                affected_spend=Decimal("485000.00"),
                potential_savings=Decimal("87300.00"),
                affected_entity_ids=[str(po1.id)] if po1 else [],
                root_cause_analysis="Departments independently ordering monitors and docks via commercial retail channels instead of using negotiated catalog discounts.",
                ai_recommendation="Enforce mandatory catalog lock for Category CAT-HW and auto-route requisition items to Master Contract CON-1.",
                status="DETECTED",
                version=1,
            )
        )
        db.add(
            MaverickSpendCluster(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                cluster_type="PRICE_VARIANCE_DISPERSION",
                cluster_title="Spot Market Cloud Storage Bandwidth Rate Spikes",
                severity="MEDIUM",
                affected_spend=Decimal("1250000.00"),
                potential_savings=Decimal("250000.00"),
                affected_entity_ids=[str(po2.id)] if po2 else [],
                root_cause_analysis="Compute burst instances exceeded baseline reserved capacity during quarterly analytics model runs.",
                ai_recommendation="Negotiate tier-2 reserved volume discount amendment under Global Cloud Services Agreement CON-2.",
                status="INVESTIGATING",
                version=1,
            )
        )
        db.add(
            MaverickSpendCluster(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                cluster_type="SPLIT_PURCHASE_ORDER",
                cluster_title="Repetitive Purchase Orders below ₹50,000 threshold within 48h",
                severity="LOW",
                affected_spend=Decimal("142000.00"),
                potential_savings=Decimal("18000.00"),
                affected_entity_ids=[],
                root_cause_analysis="Fragmented office supply requisitions created to bypass Manager approval limit.",
                ai_recommendation="Consolidate fragmented requisitions into weekly bulk purchase orders.",
                status="RESOLVED",
                version=1,
            )
        )

    esg_check = await db.execute(select(SupplierESGMetric).where(SupplierESGMetric.org_id == DEFAULT_ORG_ID))
    if not esg_check.scalars().first():
        if acme_vendor:
            db.add(
                SupplierESGMetric(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    vendor_id=acme_vendor.id,
                    environmental_score=Decimal("82.00"),
                    social_score=Decimal("86.00"),
                    governance_score=Decimal("91.00"),
                    composite_esg_score=Decimal("86.30"),
                    esg_rating="AA",
                    carbon_intensity_kg_per_spend=Decimal("0.3800"),
                    sbti_committed=True,
                    net_zero_target_year=2035,
                    iso_14001_certified=True,
                    renewable_energy_pct=Decimal("65.00"),
                    last_audit_date=now_utc - timedelta(days=90),
                    audit_notes="Bureau Veritas certified Scope 1 & 2 carbon disclosures. 65% solar/wind powering Bengaluru manufacturing plants.",
                    version=1,
                )
            )
        if gc_vendor:
            db.add(
                SupplierESGMetric(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    vendor_id=gc_vendor.id,
                    environmental_score=Decimal("94.00"),
                    social_score=Decimal("92.00"),
                    governance_score=Decimal("95.00"),
                    composite_esg_score=Decimal("93.70"),
                    esg_rating="AAA",
                    carbon_intensity_kg_per_spend=Decimal("0.1200"),
                    sbti_committed=True,
                    net_zero_target_year=2030,
                    iso_14001_certified=True,
                    renewable_energy_pct=Decimal("100.00"),
                    last_audit_date=now_utc - timedelta(days=45),
                    audit_notes="100% matched with renewable energy certificates; zero landfill data center operations.",
                    version=1,
                )
            )

    await db.flush()

    # -------------------------------------------------------------------------
    # 10. Compliance Posture: Comprehensive Scans & Findings
    # -------------------------------------------------------------------------
    scan_check = await db.execute(select(ComplianceScan).where(ComplianceScan.org_id == DEFAULT_ORG_ID))
    comp_scan = scan_check.scalars().first()

    if not comp_scan:
        comp_scan = ComplianceScan(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            scanned_by=admin_user.id,
            overall_score=Decimal("94.50"),
            status="COMPLETED",
            total_checks=24,
            passed_checks=22,
            warning_checks=2,
            failed_checks=0,
            framework_scores={"ISO_27001": 96.0, "CVC": 95.0, "ESG": 92.5},
            summary_notes="Comprehensive quarterly audit across vendor KYC onboarding, sealed bid cryptography, 3-way matching, and statutory GST e-invoicing.",
        )
        db.add(comp_scan)
        await db.flush()

        findings_data = [
            ("POL-SEC-01", "SOC 2 Type II Recertification Reminder", "ISO_27001", "LOW", "PASS", Decimal("98.00"), "Acme Tech SOC 2 Type II report valid through Nov 2026. Global Cloud SOC 2 valid through Jan 2027.", "Maintain 60-day renewal notification queue."),
            ("POL-FIN-02", "MSME Settlement Window Compliance", "CVC", "MEDIUM", "WARN", Decimal("88.00"), "Invoice INV-2 in dispute for 14 days; requires prompt resolution to ensure 45-day statutory MSME window.", "Accounts Payable Claire Redfield to review vendor revised credit note."),
            ("POL-ABAC-04", "Dual-Key Sourcing Encryption Verification", "CVC", "CRITICAL", "PASS", Decimal("100.00"), "All tender bids sealed with asymmetric dual-key encryption. Zero unsealed access before deadline.", "Mandatory dual-key threshold verified above ₹10,00,000."),
            ("POL-ESG-03", "Tier-1 Supplier Carbon Reporting Coverage", "ESG", "LOW", "PASS", Decimal("92.00"), "100% of active Tier-1 suppliers have reported audited Scope 1 and Scope 2 emissions.", "Expand carbon reporting to Tier-2 suppliers in Q4."),
        ]
        for pcode, ptitle, pframe, psev, pstat, pscr, pevid, premd in findings_data:
            db.add(
                ComplianceFinding(
                    id=uuid4(),
                    scan_id=comp_scan.id,
                    policy_code=pcode,
                    title=ptitle,
                    framework=pframe,
                    severity=psev,
                    status=pstat,
                    score=pscr,
                    evidence_summary=pevid,
                    remediation_guidance=premd,
                )
            )

    await db.flush()

    # -------------------------------------------------------------------------
    # 11. User Shopping Carts & Cart Items (Buyer Catalog)
    # -------------------------------------------------------------------------
    cart_check = await db.execute(
        select(UserCart).where(and_(UserCart.org_id == DEFAULT_ORG_ID, UserCart.user_id == buyer_user.id))
    )
    cart = cart_check.scalars().first()

    if not cart:
        cart = UserCart(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            user_id=buyer_user.id,
            currency="INR",
            status="ACTIVE",
        )
        db.add(cart)
        await db.flush()

        items_res = await db.execute(select(ItemMaster).where(ItemMaster.org_id == DEFAULT_ORG_ID))
        items_list = items_res.scalars().all()
        item1 = next((i for i in items_list if "LAPTOP" in (i.code or "")), None)
        item2 = next((i for i in items_list if "MON" in (i.code or "")), None)

        if item1:
            db.add(
                CartItem(
                    id=uuid4(),
                    cart_id=cart.id,
                    item_id=item1.id,
                    item_code=item1.code,
                    item_name=item1.name,
                    quantity=Decimal("2.00"),
                    unit_price=item1.standard_price,
                    total_price=item1.standard_price * Decimal("2.00"),
                    currency="INR",
                    punchout_payload={},
                )
            )
        if item2:
            db.add(
                CartItem(
                    id=uuid4(),
                    cart_id=cart.id,
                    item_id=item2.id,
                    item_code=item2.code,
                    item_name=item2.name,
                    quantity=Decimal("1.00"),
                    unit_price=item2.standard_price,
                    total_price=item2.standard_price,
                    currency="INR",
                    punchout_payload={},
                )
            )

    await db.flush()

    # -------------------------------------------------------------------------
    # 12. User Scopes & Governance: BU, Category, COI, MFA, Company Access
    # -------------------------------------------------------------------------
    if bu:
        for u in [buyer_user, approver_user]:
            bu_scope_check = await db.execute(
                select(UserBuScope).where(and_(UserBuScope.user_id == u.id, UserBuScope.business_unit_id == bu.id))
            )
            if not bu_scope_check.scalars().first():
                db.add(
                    UserBuScope(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        user_id=u.id,
                        business_unit_id=bu.id,
                        created_by=admin_user.id,
                        version=1,
                    )
                )

    if "CAT-HW" in categories:
        cat_scope_check = await db.execute(
            select(UserCategoryScope).where(
                and_(UserCategoryScope.user_id == buyer_user.id, UserCategoryScope.category_id == categories["CAT-HW"].id)
            )
        )
        if not cat_scope_check.scalars().first():
            db.add(
                UserCategoryScope(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    user_id=buyer_user.id,
                    category_id=categories["CAT-HW"].id,
                    created_by=admin_user.id,
                    version=1,
                )
            )

    if acme_vendor:
        coi_check = await db.execute(
            select(UserCoiDeclaration).where(
                and_(UserCoiDeclaration.user_id == buyer_user.id, UserCoiDeclaration.vendor_id == acme_vendor.id)
            )
        )
        if not coi_check.scalars().first():
            db.add(
                UserCoiDeclaration(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    user_id=buyer_user.id,
                    vendor_id=acme_vendor.id,
                    relationship_type="ARM_LENGTH",
                    description="Standard commercial arm's-length buyer relationship. No financial interest, shares, or family relations.",
                    declared_at=now_utc - timedelta(days=90),
                    acknowledged_by=admin_user.id,
                    acknowledged_at=now_utc - timedelta(days=88),
                    is_active=True,
                    version=1,
                )
            )

    for u in [super_admin_user, admin_user, buyer_user, approver_user]:
        if u:
            uca_check = await db.execute(select(UserCompanyAccess).where(UserCompanyAccess.user_id == u.id))
            if not uca_check.scalars().first():
                db.add(
                    UserCompanyAccess(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        user_id=u.id,
                        target_org_id=DEFAULT_ORG_ID,
                        legal_entity_id=legal_entity.id if legal_entity else None,
                        role_code="ORG_ADMIN" if u == admin_user else "BUYER",
                        is_default=True,
                    )
                )

    for u in [super_admin_user, admin_user]:
        if u:
            mfa_check = await db.execute(select(UserMfa).where(UserMfa.user_id == u.id))
            if not mfa_check.scalars().first():
                db.add(
                    UserMfa(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        user_id=u.id,
                        totp_secret_encrypted="enc_totp_secret_key_demo_2026",  # noqa: S106
                        backup_codes_hashed=["hash_code_1", "hash_code_2", "hash_code_3"],
                        is_verified=True,
                        enabled_at=now_utc - timedelta(days=30),
                        version=1,
                    )
                )

    await db.flush()

    # -------------------------------------------------------------------------
    # 13. Approval Groups & Members
    # -------------------------------------------------------------------------
    grp_check = await db.execute(select(ApprovalGroup).where(ApprovalGroup.org_id == DEFAULT_ORG_ID))
    grp_map = {g.code: g for g in grp_check.scalars().all()}

    if "GRP-EXEC-FINANCE" not in grp_map and finance_user and approver_user:
        g1 = ApprovalGroup(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            code="GRP-EXEC-FINANCE",
            name="Executive Finance Approvers",
            description="L2 Sign-offs and Budget Controls for high-value Purchase Orders above ₹5,00,000",
            is_active=True,
            created_by=admin_user.id,
            version=1,
        )
        db.add(g1)
        grp_map["GRP-EXEC-FINANCE"] = g1
        await db.flush()

        db.add(ApprovalGroupMember(id=uuid4(), org_id=DEFAULT_ORG_ID, approval_group_id=g1.id, user_id=finance_user.id, is_active=True, version=1))
        db.add(ApprovalGroupMember(id=uuid4(), org_id=DEFAULT_ORG_ID, approval_group_id=g1.id, user_id=approver_user.id, is_active=True, version=1))

    if "GRP-IT-BUYERS" not in grp_map:
        g2 = ApprovalGroup(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            code="GRP-IT-BUYERS",
            name="IT & Hardware Procurement Committee",
            description="Technical evaluation and commercial negotiation specialists for Category CAT-IT",
            is_active=True,
            created_by=admin_user.id,
            version=1,
        )
        db.add(g2)
        grp_map["GRP-IT-BUYERS"] = g2
        await db.flush()
        db.add(ApprovalGroupMember(id=uuid4(), org_id=DEFAULT_ORG_ID, approval_group_id=g2.id, user_id=buyer_user.id, is_active=True, version=1))

    if "GRP-WH-OPERATIONS" not in grp_map and warehouse_user:
        g3 = ApprovalGroup(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            code="GRP-WH-OPERATIONS",
            name="Warehouse & Logistics Gate Operations",
            description="Dock receiving, barcode scanning, and physical inspection team",
            is_active=True,
            created_by=admin_user.id,
            version=1,
        )
        db.add(g3)
        grp_map["GRP-WH-OPERATIONS"] = g3
        await db.flush()
        db.add(ApprovalGroupMember(id=uuid4(), org_id=DEFAULT_ORG_ID, approval_group_id=g3.id, user_id=warehouse_user.id, is_active=True, version=1))

    await db.flush()

    # -------------------------------------------------------------------------
    # 14. Sourcing: RFQ Amendments & Bid Documents
    # -------------------------------------------------------------------------
    if rfq1:
        amend_check = await db.execute(select(RfqAmendment).where(RfqAmendment.rfq_id == rfq1.id))
        if not amend_check.scalars().first():
            db.add(
                RfqAmendment(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    rfq_id=rfq1.id,
                    amendment_number=1,
                    changes_summary="Extended bid closing deadline by 72 hours due to vendor clarification inquiries regarding technical specifications.",
                    field_changes={"bid_close_at": (now_utc + timedelta(days=5)).isoformat()},
                    previous_bid_close_at=now_utc + timedelta(days=2),
                    new_bid_close_at=now_utc + timedelta(days=5),
                    bids_reset=False,
                    admin_waiver=True,
                    amended_by=buyer_user.id,
                    version=1,
                )
            )

    if bid_acme and first_doc:
        bdoc_check = await db.execute(select(BidDocument).where(BidDocument.bid_id == bid_acme.id))
        if not bdoc_check.scalars().first():
            db.add(
                BidDocument(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    bid_id=bid_acme.id,
                    document_id=first_doc.id,
                    document_type="TECHNICAL_PROPOSAL",
                    is_technical=True,
                )
            )

    # -------------------------------------------------------------------------
    # 15. Sourcing Evaluations: QCBS Evaluations & Scores
    # -------------------------------------------------------------------------
    if rfq3:
        eval_check = await db.execute(select(Evaluation).where(Evaluation.rfq_id == rfq3.id))
        if not eval_check.scalars().first():
            ev = Evaluation(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                rfq_id=rfq3.id,
                evaluation_type=EvaluationTypeEnum.QCBS_QUALITY_COST,
                status="COMPLETED",
                evaluated_by=buyer_user.id,
                completed_at=now_utc - timedelta(days=1),
                version=1,
            )
            db.add(ev)
            await db.flush()

            if bid_acme:
                db.add(
                    EvaluationScore(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        evaluation_id=ev.id,
                        bid_id=bid_acme.id,
                        criterion="Technical Architecture & OEM Support SLA",
                        max_score=Decimal("100.00"),
                        awarded_score=Decimal("94.50"),
                        remarks="Strong OEM backing with certified local engineering support.",
                        scored_by=buyer_user.id,
                        version=1,
                    )
                )
            if bid_gc:
                db.add(
                    EvaluationScore(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        evaluation_id=ev.id,
                        bid_id=bid_gc.id,
                        criterion="Technical Architecture & OEM Support SLA",
                        max_score=Decimal("100.00"),
                        awarded_score=Decimal("96.00"),
                        remarks="Exemplary high-availability cloud architecture with automated failover.",
                        scored_by=buyer_user.id,
                        version=1,
                    )
                )

    await db.flush()

    # -------------------------------------------------------------------------
    # 16. AI Sourcing: AI RFQ Drafts, Autonomous Negotiations & Radar Scores
    # -------------------------------------------------------------------------
    ai_rfq_check = await db.execute(select(AiRfqDraft).where(AiRfqDraft.org_id == DEFAULT_ORG_ID))
    if not ai_rfq_check.scalars().first():
        db.add(
            AiRfqDraft(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                rfq_title="AI Draft: Scalable Cloud Kubernetes Cluster Infrastructure FY26-27",
                target_category_id=categories.get("CAT-CLOUD").id if "CAT-CLOUD" in categories else None,
                lots=[
                    {"lot_name": "Lot 1: Compute Nodes", "estimated_cost": 3000000.0},
                    {"lot_name": "Lot 2: Managed Database & Storage", "estimated_cost": 1500000.0},
                ],
                anomaly_flags=[],
                estimated_total_value=Decimal("4500000.00"),
                status="DRAFT",
            )
        )

    neg_check = await db.execute(select(NegotiationSession).where(NegotiationSession.org_id == DEFAULT_ORG_ID))
    if not neg_check.scalars().first() and acme_vendor:
        ns = NegotiationSession(
            id=uuid4(),
            org_id=DEFAULT_ORG_ID,
            rfq_id=rfq1.id if rfq1 else None,
            vendor_id=acme_vendor.id,
            item_description="Dell Latitude 5440 Enterprise Volume Discount",
            initial_quote_price=Decimal("4100000.00"),
            target_price=Decimal("3800000.00"),
            max_acceptable_price=Decimal("3950000.00"),
            current_bid_price=Decimal("3900000.00"),
            bot_status="ACTIVE",
            current_round=2,
            max_rounds=5,
            savings_achieved=Decimal("200000.00"),
            concession_strategy="BALANCED",
        )
        db.add(ns)
        await db.flush()

        db.add(
            NegotiationRound(
                id=uuid4(),
                session_id=ns.id,
                round_number=1,
                bidder_type="VENDOR",
                offer_price=Decimal("4100000.00"),
                counter_offer_price=Decimal("3850000.00"),
                concession_amount=Decimal("0.00"),
                rationale="Initial vendor sealed bid submission.",
            )
        )
        db.add(
            NegotiationRound(
                id=uuid4(),
                session_id=ns.id,
                round_number=2,
                bidder_type="AI_BOT",
                offer_price=Decimal("3900000.00"),
                counter_offer_price=None,
                concession_amount=Decimal("200000.00"),
                rationale="Bot countered with volume discount benchmark from historical ARC-2025.",
            )
        )

    radar_check = await db.execute(select(SupplierRadarScore).where(SupplierRadarScore.org_id == DEFAULT_ORG_ID))
    if not radar_check.scalars().first():
        if acme_vendor:
            db.add(
                SupplierRadarScore(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    vendor_id=acme_vendor.id,
                    category_id=categories.get("CAT-HW").id if "CAT-HW" in categories else None,
                    overall_fit_score=Decimal("91.50"),
                    quality_score=Decimal("94.00"),
                    esg_score=Decimal("86.30"),
                    lead_time_score=Decimal("92.00"),
                    price_competitiveness_score=Decimal("89.00"),
                    recommendation_tier="HIGHLY_RECOMMENDED",
                    insights={"strength": "Consistently high OTD and responsive customer support in Tier-1 hardware."},
                )
            )
        if gc_vendor:
            db.add(
                SupplierRadarScore(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    vendor_id=gc_vendor.id,
                    category_id=categories.get("CAT-CLOUD").id if "CAT-CLOUD" in categories else None,
                    overall_fit_score=Decimal("96.20"),
                    quality_score=Decimal("98.00"),
                    esg_score=Decimal("93.70"),
                    lead_time_score=Decimal("97.00"),
                    price_competitiveness_score=Decimal("93.50"),
                    recommendation_tier="HIGHLY_RECOMMENDED",
                    insights={"strength": "Zero downtime cloud architecture with 100% renewable energy compliance."},
                )
            )

    await db.flush()

    # -------------------------------------------------------------------------
    # 17. Buyer-Vendor Communications: Threads & Messages
    # -------------------------------------------------------------------------
    comm_check = await db.execute(select(CommunicationThread).where(CommunicationThread.org_id == DEFAULT_ORG_ID))
    if not comm_check.scalars().first():
        if rfq1:
            t1 = CommunicationThread(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                entity_type="RFQ",
                entity_id=rfq1.id,
                subject="Technical Query: SFP+ Transceiver Compatibility with Cisco Switches",
                status="OPEN",
            )
            db.add(t1)
            await db.flush()

            if acme_supplier_user:
                db.add(
                    CommunicationMessage(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        thread_id=t1.id,
                        sender_id=acme_supplier_user.id,
                        message="Dear Buyer Team, Could you please confirm if MSA compliant 10G SFP+ transceivers from OEM partners are acceptable under line item 2?",
                    )
                )
            db.add(
                CommunicationMessage(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    thread_id=t1.id,
                    sender_id=buyer_user.id,
                    message="Confirmed. Third-party MSA compliant transceivers with OEM coding are acceptable provided a 3-year warranty is included.",
                )
            )

        if po1:
            t2 = CommunicationThread(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                entity_type="PURCHASE_ORDER",
                entity_id=po1.id,
                subject="Delivery Dock Slot Booking & Vehicle Gate Entry",
                status="RESOLVED",
            )
            db.add(t2)
            await db.flush()

            if acme_supplier_user:
                db.add(
                    CommunicationMessage(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        thread_id=t2.id,
                        sender_id=acme_supplier_user.id,
                        message="Truck MH-04-AZ-9921 carrying ASN-2026-000001 will arrive at Powai Tech Park tomorrow at 10:00 AM. Kindly issue dock security pass.",
                    )
                )
            if warehouse_user:
                db.add(
                    CommunicationMessage(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        thread_id=t2.id,
                        sender_id=warehouse_user.id,
                        message="Gate Pass #GP-2026-9901 issued for Dock #3. Please report directly to Central Logistics receiving bay.",
                    )
                )

    await db.flush()

    # -------------------------------------------------------------------------
    # 18. Integrations & Platform Extensions
    # -------------------------------------------------------------------------
    ts_check = await db.execute(select(TenantSetting).where(TenantSetting.org_id == DEFAULT_ORG_ID))
    if not ts_check.scalars().first():
        db.add(
            TenantSetting(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                setting_key="GLOBAL_PROCUREMENT_CONTROLS",
                setting_value={
                    "auto_po_generation": True,
                    "three_way_match_tolerance_pct": 2.0,
                    "msme_payment_window_days": 45,
                    "dual_key_threshold_inr": 1000000.0,
                    "auto_irn_e_invoicing": True,
                },
                description="Global governance controls and business rule parameters",
                updated_by=admin_user.id,
                version=1,
            )
        )

    ff_check = await db.execute(select(FeatureFlag).where(FeatureFlag.org_id == DEFAULT_ORG_ID))
    if not ff_check.scalars().first():
        db.add(
            FeatureFlag(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                flag_key="ENABLE_AI_CONTRACT_REDLINE_ANALYSIS",
                flag_value=True,
                description="Enable Gemini LLM redline and deviation risk evaluation on supplier contracts",
                updated_by=admin_user.id,
                version=1,
            )
        )
        db.add(
            FeatureFlag(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                flag_key="ENABLE_LIVE_AUCTION_DYNAMIC_EXTENSION",
                flag_value=True,
                description="Auto-extend live reverse auctions by 5 minutes on last-minute bids",
                updated_by=admin_user.id,
                version=1,
            )
        )

    erp_m_check = await db.execute(select(ERPEntityMapping).where(ERPEntityMapping.org_id == DEFAULT_ORG_ID))
    if not erp_m_check.scalars().first():
        if po1:
            db.add(
                ERPEntityMapping(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    erp_system="SAP_S4HANA",
                    entity_type="PURCHASE_ORDER",
                    internal_id=po1.id,
                    external_id="SAP-PO-4500091823",
                    sync_direction="OUTBOUND",
                    sync_status="SUCCESS",
                    idoc_number="IDOC-990182049",
                    version=1,
                )
            )
        if inv1:
            db.add(
                ERPEntityMapping(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    erp_system="SAP_S4HANA",
                    entity_type="INVOICE",
                    internal_id=inv1.id,
                    external_id="SAP-INV-5100082731",
                    sync_direction="OUTBOUND",
                    sync_status="SUCCESS",
                    idoc_number="IDOC-990182050",
                    version=1,
                )
            )
        if acme_vendor:
            db.add(
                ERPEntityMapping(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    erp_system="SAP_S4HANA",
                    entity_type="VENDOR",
                    internal_id=acme_vendor.id,
                    external_id="SAP-BP-100293",
                    sync_direction="INBOUND",
                    sync_status="SUCCESS",
                    version=1,
                )
            )

    scat_check = await db.execute(select(SupplierCategory).where(SupplierCategory.org_id == DEFAULT_ORG_ID))
    if not scat_check.scalars().first():
        db.add(
            SupplierCategory(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                code="SUP-CAT-STRATEGIC",
                name="Strategic Tier-1 Partners",
                description="High spend, mission critical technology and cloud infrastructure suppliers.",
                is_active=True,
                version=1,
            )
        )
        db.add(
            SupplierCategory(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                code="SUP-CAT-PREFERRED",
                name="Preferred Commercial Vendors",
                description="Approved standard rate card vendors with pre-negotiated MSAs.",
                is_active=True,
                version=1,
            )
        )

    emg_check = await db.execute(select(ErpMaterialGroupMapping).where(ErpMaterialGroupMapping.org_id == DEFAULT_ORG_ID))
    if not emg_check.scalars().first() and "CAT-HW" in categories:
        db.add(
            ErpMaterialGroupMapping(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                erp_material_group="00100_IT_HARDWARE",
                category_id=categories["CAT-HW"].id,
                confidence=Decimal("1.00"),
                is_verified=True,
                version=1,
            )
        )

    items_for_pricing = await db.execute(select(ItemMaster).where(ItemMaster.org_id == DEFAULT_ORG_ID))
    first_item = items_for_pricing.scalars().first()
    if first_item:
        ctp_check = await db.execute(select(CatalogTierPricing).where(CatalogTierPricing.item_id == first_item.id))
        if not ctp_check.scalars().first():
            db.add(
                CatalogTierPricing(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    item_id=first_item.id,
                    min_quantity=Decimal("10.00"),
                    unit_price=first_item.standard_price * Decimal("0.90"),
                    contract_id=con1.id if con1 else None,
                )
            )

    po_cfg_res = await db.execute(select(PunchoutConfig).where(PunchoutConfig.org_id == DEFAULT_ORG_ID))
    first_po_cfg = po_cfg_res.scalars().first()
    if first_po_cfg:
        ps_check = await db.execute(select(PunchoutSession).where(PunchoutSession.org_id == DEFAULT_ORG_ID))
        if not ps_check.scalars().first():
            db.add(
                PunchoutSession(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    user_id=buyer_user.id,
                    config_id=first_po_cfg.id,
                    session_token=f"demo-punchout-session-{uuid4().hex[:12]}",
                    status="RETURNED",
                    cart_data=[{"item_name": "Ergonomic Monitor Arm", "price": 4500.0, "qty": 4}],
                )
            )

    if first_doc:
        dv_check = await db.execute(select(DocumentVersion).where(DocumentVersion.document_id == first_doc.id))
        if not dv_check.scalars().first():
            db.add(
                DocumentVersion(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    document_id=first_doc.id,
                    version_number=1,
                    minio_key=first_doc.minio_key,
                    file_size_bytes=first_doc.file_size_bytes,
                    sha256_hash=first_doc.sha256_hash,
                    uploaded_by=buyer_user.id,
                )
            )

    if rfq6:
        auction_res = await db.execute(select(LiveAuction).where(LiveAuction.rfq_id == rfq6.id))
        live_auc = auction_res.scalars().first()
        if live_auc:
            ars_check = await db.execute(select(AuctionRankSnapshot).where(AuctionRankSnapshot.auction_id == live_auc.id))
            if not ars_check.scalars().first():
                db.add(
                    AuctionRankSnapshot(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        auction_id=live_auc.id,
                        ranks={
                            "L1": {"vendor_id": str(gc_vendor.id) if gc_vendor else "", "amount": 1630000.0},
                            "L2": {"vendor_id": str(acme_vendor.id) if acme_vendor else "", "amount": 1660000.0},
                        },
                    )
                )

    if bid_acme:
        bv_check = await db.execute(select(BidVersion).where(BidVersion.bid_id == bid_acme.id))
        if not bv_check.scalars().first():
            db.add(
                BidVersion(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    bid_id=bid_acme.id,
                    version_number=1,
                    snapshot_encrypted="enc_bid_snapshot_v1_payload_2026",
                    bid_hash="f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2",
                )
            )

    wf_inst_res = await db.execute(select(WorkflowInstance).where(WorkflowInstance.org_id == DEFAULT_ORG_ID))
    first_wf_inst = wf_inst_res.scalars().first()
    if first_wf_inst:
        we_check = await db.execute(select(WorkflowEvent).where(WorkflowEvent.workflow_instance_id == first_wf_inst.id))
        if not we_check.scalars().first():
            db.add(
                WorkflowEvent(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    workflow_instance_id=first_wf_inst.id,
                    event_type="STEP_TRIGGERED",
                    event_data={"step": 1, "role": "APPROVER", "assigned_to": str(approver_user.id)},
                    actor_id=buyer_user.id,
                    version=1,
                )
            )

    unmapped_exc_res = await db.execute(select(UnmappedPrException).where(UnmappedPrException.org_id == DEFAULT_ORG_ID))
    unmapped_exc = unmapped_exc_res.scalars().first()
    if unmapped_exc and "CAT-HW" in categories:
        uml_check = await db.execute(select(UnmappedPrMappingLog).where(UnmappedPrMappingLog.exception_id == unmapped_exc.id))
        if not uml_check.scalars().first():
            db.add(
                UnmappedPrMappingLog(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    exception_id=unmapped_exc.id,
                    field_name="material_group",
                    source_value="MAT-IT-COMPUTE-LEGACY",
                    mapped_to_id=categories["CAT-HW"].id,
                    mapped_to_label="Hardware & Compute",
                    mapping_method="AI_AUTO",
                    confidence=Decimal("0.95"),
                    mapped_by=buyer_user.id,
                )
            )

    if acme_vendor:
        ves_check = await db.execute(select(VendorErpSyncLog).where(VendorErpSyncLog.vendor_id == acme_vendor.id))
        if not ves_check.scalars().first():
            db.add(
                VendorErpSyncLog(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    vendor_id=acme_vendor.id,
                    sync_direction="OUTBOUND",
                    sync_status="SUCCESS",
                    erp_vendor_code="SAP-BP-100293",
                    request_payload={"company_name": acme_vendor.company_name, "gstin": acme_vendor.gstin},
                    response_payload={"sap_status": "CREATED", "bapi_code": "000"},
                )
            )

    ob_check = await db.execute(select(OutboxMessage).where(OutboxMessage.org_id == DEFAULT_ORG_ID))
    if not ob_check.scalars().first():
        db.add(
            OutboxMessage(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                exchange="procurement.events",
                routing_key="purchase_order.acknowledged",
                payload={"po_number": "PO-2026-000001", "status": "ACKNOWLEDGED", "vendor": "Acme Tech Solutions"},
                headers={"source": "seed_enterprise_extensions"},
                status="PUBLISHED",
                published_at=now_utc - timedelta(hours=1),
            )
        )

    np_check = await db.execute(select(NotificationPreference).where(NotificationPreference.org_id == DEFAULT_ORG_ID))
    if not np_check.scalars().first():
        for u in [admin_user, buyer_user, approver_user, finance_user]:
            db.add(
                NotificationPreference(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    user_id=u.id,
                    notification_type="PURCHASE_ORDER_UPDATE",
                    email_enabled=True,
                    sms_enabled=False,
                    inapp_enabled=True,
                    digest_mode=False,
                )
            )

    # Password History
    ph_check = await db.execute(select(PasswordHistory).where(PasswordHistory.org_id == DEFAULT_ORG_ID))
    if not ph_check.scalars().first():
        all_demo_users = [super_admin_user, admin_user, buyer_user, approver_user, finance_user, warehouse_user, ap_user, acme_supplier_user, gc_supplier_user]
        for u in all_demo_users:
            if u and u.password_hash:
                db.add(
                    PasswordHistory(
                        id=uuid4(),
                        org_id=DEFAULT_ORG_ID,
                        user_id=u.id,
                        password_hash=u.password_hash,
                        version=1,
                    )
                )

    # Approval Rule Versions
    arv_check = await db.execute(select(ApprovalRuleVersion).where(ApprovalRuleVersion.org_id == DEFAULT_ORG_ID))
    if not arv_check.scalars().first():
        rules_res = await db.execute(select(ApprovalRule).where(ApprovalRule.org_id == DEFAULT_ORG_ID))
        for r in rules_res.scalars().all():
            db.add(
                ApprovalRuleVersion(
                    id=uuid4(),
                    org_id=DEFAULT_ORG_ID,
                    approval_rule_id=r.id,
                    version_number=1,
                    conditions=r.conditions,
                    approval_steps=r.approval_steps,
                    effective_from=now_utc - timedelta(days=90),
                    change_reason="Initial baseline activation per enterprise policy",
                    created_by=admin_user.id,
                    version=1,
                )
            )

    await db.flush()
    logger.info("Successfully seeded all enterprise extension domains!")


if __name__ == "__main__":
    asyncio.run(seed_enterprise_extensions())
