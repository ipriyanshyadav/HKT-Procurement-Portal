"""Comprehensive unit tests covering all SQLAlchemy models across all modules."""
from __future__ import annotations

import pytest
from uuid import uuid4
from datetime import datetime, date, timezone
from decimal import Decimal

# Import all module models
import app.modules.organization.models as org_models
import app.modules.master_data.models as md_models
import app.modules.user.models as user_models
import app.modules.vendor.models as vendor_models
import app.modules.workflow.models as wf_models
import app.modules.requisition.models as req_models
import app.modules.sourcing.models as src_models
import app.modules.bid.models as bid_models
import app.modules.evaluation.models as eval_models
import app.modules.contract.models as contract_models
import app.modules.purchase_order.models as po_models
import app.modules.grn.models as grn_models
import app.modules.invoice.models as inv_models
import app.modules.payment.models as pay_models
import app.modules.document.models as doc_models
import app.modules.notification.models as notif_models
import app.modules.audit.models as audit_models
import app.modules.integration.models as int_models

def test_organization_models():
    org = org_models.Organization(
        name="Test Org",
        legal_name="Test Legal Name",
        country_code="IN",
        base_currency="INR",
        cost_of_capital_rate=Decimal("0.1200"),
        settings={"tier": "enterprise"},
        is_active=True
    )
    assert org.__tablename__ == "organizations"
    assert org.name == "Test Org"

    le = org_models.LegalEntity(
        org_id=uuid4(),
        name="Test Entity",
        registration_number="REG-12345",
        country_code="IN"
    )
    assert le.__tablename__ == "legal_entities"

    bu = org_models.BusinessUnit(
        org_id=uuid4(),
        code="BU-1",
        name="Tech BU",
        legal_entity_id=uuid4(),
        is_active=True
    )
    assert bu.__tablename__ == "business_units"

    pl = org_models.Plant(
        org_id=uuid4(),
        code="PL-1",
        name="Plant 1",
        business_unit_id=uuid4(),
        country_code="IN",
        is_active=True
    )
    assert pl.__tablename__ == "plants"

    cc = org_models.CostCenter(
        org_id=uuid4(),
        code="CC-1",
        name="Cost Center 1",
        business_unit_id=uuid4(),
        is_active=True
    )
    assert cc.__tablename__ == "cost_centers"

    dp = org_models.Department(
        org_id=uuid4(),
        code="DEP-1",
        name="Eng Dept",
        business_unit_id=uuid4(),
        is_active=True
    )
    assert dp.__tablename__ == "departments"

def test_master_data_models():
    cat = md_models.Category(org_id=uuid4(), code="IT", name="Information Tech")
    assert cat.__tablename__ == "categories"

    uom = md_models.UomMaster(org_id=uuid4(), code="EA", name="Each")
    assert uom.__tablename__ == "uom_master"

    curr = md_models.CurrencyMaster(org_id=uuid4(), code="INR", name="Indian Rupee")
    assert curr.__tablename__ == "currency_master"

    pt = md_models.PaymentTerm(org_id=uuid4(), code="NET30", name="Net 30", net_days=30)
    assert pt.__tablename__ == "payment_terms"

    inco = md_models.Incoterm(org_id=uuid4(), code="FOB", name="Free on Board", risk_transfer_point="Port")
    assert inco.__tablename__ == "incoterms"

    tax = md_models.TaxCode(org_id=uuid4(), code="GST18", name="GST 18%", rate=Decimal("18.00"), tax_type="IGST")
    assert tax.__tablename__ == "tax_codes"

    dl = md_models.DeliveryLocation(
        org_id=uuid4(), code="LOC1", name="HQ", address="Street 1", city="Mumbai", state="MH", postal_code="400001"
    )
    assert dl.__tablename__ == "delivery_locations"

    dt = md_models.DocumentType(org_id=uuid4(), code="GST_CERT", name="GST Certificate")
    assert dt.__tablename__ == "document_types"

    sc = md_models.SupplierCategory(org_id=uuid4(), code="TIER1", name="Tier 1 Vendor")
    assert sc.__tablename__ == "supplier_categories"

    hm = md_models.HolidayMaster(org_id=uuid4(), name="Diwali", holiday_date=date(2026, 11, 8))
    assert hm.__tablename__ == "holiday_master"

    mg = md_models.ErpMaterialGroupMapping(org_id=uuid4(), erp_material_group="GRP-1", category_id=uuid4())
    assert mg.__tablename__ == "erp_material_group_mapping"

def test_user_models():
    role = user_models.Role(org_id=uuid4(), code="BUYER", name="Buyer Role")
    assert role.__tablename__ == "roles"

    perm = user_models.Permission(code="pr.create", name="Create PR", module="pr")
    assert perm.__tablename__ == "permissions"

    rp = user_models.RolePermission(org_id=uuid4(), role_id=uuid4(), permission_id=uuid4())
    assert rp.__tablename__ == "role_permissions"

    pw = user_models.PasswordHistory(org_id=uuid4(), user_id=uuid4(), password_hash="hash")
    assert pw.__tablename__ == "password_history"

    user = user_models.User(org_id=uuid4(), email="user@test.com", first_name="John", last_name="Doe")
    assert user.__tablename__ == "users"

    sess = user_models.UserSession(org_id=uuid4(), user_id=uuid4(), token_jti="jti-123", expires_at=datetime.now(timezone.utc))
    assert sess.__tablename__ == "user_sessions"

    mfa = user_models.UserMfa(org_id=uuid4(), user_id=uuid4(), totp_secret_encrypted="secret")
    assert mfa.__tablename__ == "user_mfa"

    ura = user_models.UserRoleAssignment(org_id=uuid4(), user_id=uuid4(), role_id=uuid4())
    assert ura.__tablename__ == "user_role_assignments"

    ucs = user_models.UserCategoryScope(org_id=uuid4(), user_id=uuid4(), category_id=uuid4())
    assert ucs.__tablename__ == "user_category_scopes"

    ubs = user_models.UserBuScope(org_id=uuid4(), user_id=uuid4(), business_unit_id=uuid4())
    assert ubs.__tablename__ == "user_bu_scopes"

    coi = user_models.UserCoiDeclaration(org_id=uuid4(), user_id=uuid4(), vendor_id=uuid4(), relationship_type="Family", description="None")
    assert coi.__tablename__ == "user_coi_declarations"

    dl = user_models.DelegationRule(
        org_id=uuid4(), delegator_id=uuid4(), delegate_id=uuid4(), reason="Leave",
        valid_from=datetime.now(timezone.utc), valid_until=datetime.now(timezone.utc)
    )
    assert dl.__tablename__ == "delegation_rules"

def test_vendor_models():
    v = vendor_models.Vendor(
        org_id=uuid4(), vendor_code="V-1", company_name="ABC Ltd",
        city="Mumbai", state="MH", postal_code="400001",
        primary_email="abc@test.com", primary_phone="9999999999"
    )
    assert v.__tablename__ == "vendors"

    vc = vendor_models.VendorContact(org_id=uuid4(), vendor_id=uuid4(), contact_name="Agent", email="agent@test.com", phone="123")
    assert vc.__tablename__ == "vendor_contacts"

    vb = vendor_models.VendorBankAccount(org_id=uuid4(), vendor_id=uuid4(), bank_name="HDFC", account_number_encrypted="enc", ifsc_code="HDFC0001")
    assert vb.__tablename__ == "vendor_bank_accounts"

    vm = vendor_models.VendorCategoryMapping(org_id=uuid4(), vendor_id=uuid4(), category_id=uuid4())
    assert vm.__tablename__ == "vendor_category_mappings"

    vd = vendor_models.VendorDocument(org_id=uuid4(), vendor_id=uuid4(), document_type_id=uuid4(), document_id=uuid4())
    assert vd.__tablename__ == "vendor_documents"

    vs = vendor_models.VendorScorecard(org_id=uuid4(), vendor_id=uuid4(), evaluation_period="2026-Q1")
    assert vs.__tablename__ == "vendor_scorecards"

    vl = vendor_models.VendorErpSyncLog(org_id=uuid4(), vendor_id=uuid4(), sync_direction="OUTBOUND")
    assert vl.__tablename__ == "vendor_erp_sync_log"

def test_workflow_models():
    ar = wf_models.ApprovalRule(org_id=uuid4(), name="Rule 1", transaction_type="PR", priority=1)
    assert ar.__tablename__ == "approval_rules"

    arv = wf_models.ApprovalRuleVersion(org_id=uuid4(), approval_rule_id=uuid4(), version_number=1, conditions=[], approval_steps=[], effective_from=datetime.now(timezone.utc))
    assert arv.__tablename__ == "approval_rule_versions"

    ag = wf_models.ApprovalGroup(org_id=uuid4(), code="FIN", name="Finance Group")
    assert ag.__tablename__ == "approval_groups"

    agm = wf_models.ApprovalGroupMember(org_id=uuid4(), approval_group_id=uuid4(), user_id=uuid4())
    assert agm.__tablename__ == "approval_group_members"

    wt = wf_models.WorkflowTemplate(org_id=uuid4(), code="WT-1", name="Template 1", entity_type="PR", steps=[])
    assert wt.__tablename__ == "workflow_templates"

    wi = wf_models.WorkflowInstance(org_id=uuid4(), template_id=uuid4(), entity_type="PR", entity_id=uuid4())
    assert wi.__tablename__ == "workflow_instances"

    task = wf_models.WorkflowTask(org_id=uuid4(), workflow_instance_id=uuid4(), step_number=1, assigned_to=uuid4())
    assert task.__tablename__ == "workflow_tasks"

    evt = wf_models.WorkflowEvent(org_id=uuid4(), workflow_instance_id=uuid4(), event_type="SUBMITTED")
    assert evt.__tablename__ == "workflow_events"

def test_requisition_models():
    pr = req_models.Requisition(
        org_id=uuid4(), pr_number="PR-100", title="Laptop Purchase",
        requestor_id=uuid4(), business_unit_id=uuid4(), cost_center_id=uuid4(), category_id=uuid4()
    )
    assert pr.__tablename__ == "requisitions"

    prl = req_models.RequisitionLine(
        org_id=uuid4(), requisition_id=uuid4(), line_number=1, item_description="ThinkPad",
        category_id=uuid4(), uom_id=uuid4(), quantity=Decimal("5.0")
    )
    assert prl.__tablename__ == "requisition_lines"

    unmapped = req_models.UnmappedPrException(org_id=uuid4(), requisition_id=uuid4(), failed_fields={})
    assert unmapped.__tablename__ == "unmapped_pr_exceptions"

    log = req_models.UnmappedPrMappingLog(
        org_id=uuid4(), exception_id=uuid4(), field_name="category", source_value="IT",
        mapped_to_id=uuid4(), mapped_to_label="IT Category", mapping_method="MANUAL", mapped_by=uuid4()
    )
    assert log.__tablename__ == "unmapped_pr_mapping_log"

def test_sourcing_models():
    rfq = src_models.Rfq(
        org_id=uuid4(), rfq_number="RFQ-100", title="Laptop RFQ",
        buyer_id=uuid4(), business_unit_id=uuid4(), category_id=uuid4()
    )
    assert rfq.__tablename__ == "rfqs"

    lot = src_models.RfqLot(org_id=uuid4(), rfq_id=uuid4(), lot_number=1, title="Lot 1")
    assert lot.__tablename__ == "rfq_lots"

    line = src_models.RfqLine(
        org_id=uuid4(), rfq_id=uuid4(), line_number=1, item_description="Dell XPS",
        category_id=uuid4(), uom_id=uuid4(), quantity=Decimal("10.0")
    )
    assert line.__tablename__ == "rfq_lines"

    p = src_models.RfqParticipant(org_id=uuid4(), rfq_id=uuid4(), vendor_id=uuid4())
    assert p.__tablename__ == "rfq_participants"

    c = src_models.RfqClarification(org_id=uuid4(), rfq_id=uuid4(), question="Warranty?", asked_by=uuid4())
    assert c.__tablename__ == "rfq_clarifications"

    am = src_models.RfqAmendment(org_id=uuid4(), rfq_id=uuid4(), amendment_number=1, changes_summary="date extended", field_changes={}, amended_by=uuid4())
    assert am.__tablename__ == "rfq_amendments"

def test_bid_models():
    bid = bid_models.BidResponse(org_id=uuid4(), rfq_id=uuid4(), vendor_id=uuid4())
    assert bid.__tablename__ == "bid_responses"

    blr = bid_models.BidLineResponse(
        org_id=uuid4(), bid_id=uuid4(), rfq_line_id=uuid4(),
        unit_price=Decimal("50000.00"), delivery_lead_time_days=14
    )
    assert blr.__tablename__ == "bid_line_responses"

    bv = bid_models.BidVersion(org_id=uuid4(), bid_id=uuid4(), version_number=1, version_data={}, bid_hash="hash")
    assert bv.__tablename__ == "bid_versions"

    bd = bid_models.BidDocument(org_id=uuid4(), bid_id=uuid4(), document_id=uuid4(), document_type="TECH")
    assert bd.__tablename__ == "bid_documents"

def test_evaluation_models():
    ev = eval_models.Evaluation(org_id=uuid4(), rfq_id=uuid4(), evaluation_type=eval_models.EvaluationTypeEnum.L1_PRICE_ONLY, evaluated_by=uuid4())
    assert ev.__tablename__ == "evaluations"

    sc = eval_models.EvaluationScore(org_id=uuid4(), evaluation_id=uuid4(), bid_id=uuid4(), criterion="Tech", max_score=Decimal("100"), awarded_score=Decimal("95"), scored_by=uuid4())
    assert sc.__tablename__ == "evaluation_scores"

    cs = eval_models.ComparativeStatement(
        org_id=uuid4(), rfq_id=uuid4(), cs_number="CS-1",
        cost_of_capital_rate=Decimal("0.12"), evaluation_methodology="L1",
        total_estimated_value=Decimal("500000"), generated_by=uuid4()
    )
    assert cs.__tablename__ == "comparative_statements"

    csr = eval_models.CsLineRanking(
        org_id=uuid4(), cs_id=uuid4(), rfq_line_id=uuid4(), bid_id=uuid4(), vendor_id=uuid4(),
        raw_unit_price=Decimal("100"), landed_cost=Decimal("110"), npv_adjusted_cost=Decimal("110"), rank=1
    )
    assert csr.__tablename__ == "cs_line_rankings"

    neg = eval_models.Negotiation(org_id=uuid4(), rfq_id=uuid4(), vendor_id=uuid4(), negotiated_by=uuid4())
    assert neg.__tablename__ == "negotiations"

    arn = eval_models.AwardRecommendation(org_id=uuid4(), rfq_id=uuid4(), cs_id=uuid4(), arn_number="ARN-1", justification="L1 vendor", recommended_by=uuid4())
    assert arn.__tablename__ == "award_recommendations"

    ad = eval_models.AwardDetail(
        org_id=uuid4(), arn_id=uuid4(), vendor_id=uuid4(), bid_id=uuid4(),
        awarded_unit_price=Decimal("100"), awarded_quantity=Decimal("10"), awarded_total=Decimal("1000")
    )
    assert ad.__tablename__ == "award_details"

def test_contract_models():
    tmpl = contract_models.ContractTemplate(org_id=uuid4(), name="Template", contract_type="Standard", template_content={})
    assert tmpl.__tablename__ == "contract_templates"

    ct = contract_models.Contract(
        org_id=uuid4(), contract_number="CT-1", title="Rate Contract",
        vendor_id=uuid4(), start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
        business_unit_id=uuid4(), category_id=uuid4()
    )
    assert ct.__tablename__ == "contracts"

    ctl = contract_models.ContractLine(
        org_id=uuid4(), contract_id=uuid4(), line_number=1, item_description="Item 1",
        uom_id=uuid4(), unit_rate=Decimal("100")
    )
    assert ctl.__tablename__ == "contract_lines"

    cd = contract_models.ContractDocument(org_id=uuid4(), contract_id=uuid4(), document_id=uuid4(), document_purpose="Signed")
    assert cd.__tablename__ == "contract_documents"

    ca = contract_models.ContractAmendment(org_id=uuid4(), contract_id=uuid4(), amendment_number=1, changes_summary="Sum", field_changes={}, amended_by=uuid4())
    assert ca.__tablename__ == "contract_amendments"

    cm = contract_models.ContractMilestone(org_id=uuid4(), contract_id=uuid4(), title="Phase 1", due_date=date(2026, 6, 1), responsible_party="Vendor")
    assert cm.__tablename__ == "contract_milestones"

def test_purchase_order_models():
    po = po_models.PurchaseOrder(
        org_id=uuid4(), po_number="PO-1", title="PO Title",
        vendor_id=uuid4(), business_unit_id=uuid4(), category_id=uuid4(), buyer_id=uuid4()
    )
    assert po.__tablename__ == "purchase_orders"

    pol = po_models.PoLine(
        org_id=uuid4(), po_id=uuid4(), line_number=1, item_description="Line 1",
        uom_id=uuid4(), ordered_quantity=Decimal("10"), unit_price=Decimal("100"), open_quantity=Decimal("10")
    )
    assert pol.__tablename__ == "po_lines"

    poa = po_models.PoAmendment(org_id=uuid4(), po_id=uuid4(), amendment_number=1, reason="Qty increase", field_changes={}, amended_by=uuid4())
    assert poa.__tablename__ == "po_amendments"

def test_grn_and_invoice_models():
    grn = grn_models.GoodsReceiptNote(
        org_id=uuid4(), grn_number="GRN-1", po_id=uuid4(), vendor_id=uuid4(),
        receipt_date=date(2026, 5, 1), received_by=uuid4()
    )
    assert grn.__tablename__ == "goods_receipt_notes"

    gl = grn_models.GrnLine(org_id=uuid4(), grn_id=uuid4(), po_line_id=uuid4(), received_quantity=Decimal("10"), accepted_quantity=Decimal("10"))
    assert gl.__tablename__ == "grn_lines"

    ses = grn_models.ServiceEntrySheet(
        org_id=uuid4(), ses_number="SES-1", po_id=uuid4(), vendor_id=uuid4(),
        service_period_start=date(2026, 4, 1), service_period_end=date(2026, 4, 30), certified_by=uuid4()
    )
    assert ses.__tablename__ == "service_entry_sheets"

    ses_l = grn_models.SesLine(org_id=uuid4(), ses_id=uuid4(), po_line_id=uuid4(), service_description="Maint", completed_quantity=Decimal("1"))
    assert ses_l.__tablename__ == "ses_lines"

    qi = grn_models.QualityInspection(org_id=uuid4(), grn_line_id=uuid4(), inspector_id=uuid4(), inspection_date=date(2026, 5, 2), result="PASS", accepted_quantity=Decimal("10"))
    assert qi.__tablename__ == "quality_inspections"

    inv = inv_models.Invoice(
        org_id=uuid4(), invoice_number="INV-1", vendor_invoice_number="VIN-1",
        vendor_id=uuid4(), po_id=uuid4(), invoice_date=date(2026, 5, 1), due_date=date(2026, 5, 31),
        subtotal=Decimal("1000"), total_amount=Decimal("1180")
    )
    assert inv.__tablename__ == "invoices"

    il = inv_models.InvoiceLine(
        org_id=uuid4(), invoice_id=uuid4(), po_line_id=uuid4(), line_number=1,
        item_description="Descr", quantity=Decimal("10"), unit_price=Decimal("100"), line_total=Decimal("1000")
    )
    assert il.__tablename__ == "invoice_lines"

    mr = inv_models.InvoiceMatchResult(
        org_id=uuid4(), invoice_id=uuid4(), invoice_line_id=uuid4(), po_line_id=uuid4(),
        price_match=True, quantity_match=True, po_reference_valid=True, overall_match=True
    )
    assert mr.__tablename__ == "invoice_match_results"

def test_payment_and_document_models():
    pay = pay_models.PaymentRecord(
        org_id=uuid4(), invoice_id=uuid4(), vendor_id=uuid4(),
        payment_date=date(2026, 6, 1), amount=Decimal("1180")
    )
    assert pay.__tablename__ == "payment_records"

    disp = pay_models.Dispute(
        org_id=uuid4(), invoice_id=uuid4(), vendor_id=uuid4(),
        reason_code="PRICE_MISMATCH", description="Overcharged", raised_by=uuid4()
    )
    assert disp.__tablename__ == "disputes"

    dm = pay_models.DisputeMessage(org_id=uuid4(), dispute_id=uuid4(), sender_id=uuid4(), message="Hello")
    assert dm.__tablename__ == "dispute_messages"

    doc = doc_models.Document(
        org_id=uuid4(), entity_type="PO", entity_id=uuid4(),
        category=doc_models.DocumentCategoryEnum.PURCHASE_ORDER,
        original_filename="po.pdf", stored_filename="hash.pdf",
        minio_bucket="docs", minio_key="po/hash.pdf",
        content_type="application/pdf", file_size_bytes=1024, sha256_hash="hash"
    )
    assert doc.__tablename__ == "documents"

    dv = doc_models.DocumentVersion(
        org_id=uuid4(), document_id=uuid4(), version_number=1,
        minio_key="po/hash_v1.pdf", file_size_bytes=1024, sha256_hash="hash", uploaded_by=uuid4()
    )
    assert dv.__tablename__ == "document_versions"

def test_notification_audit_integration_models():
    notif = notif_models.Notification(
        org_id=uuid4(), user_id=uuid4(), notification_type="PR_APPROVED",
        channel=notif_models.NotificationChannelEnum.EMAIL, title="Approved", body="Your PR was approved."
    )
    assert notif.__tablename__ == "notifications"

    np = notif_models.NotificationPreference(org_id=uuid4(), user_id=uuid4(), notification_type="PR_APPROVED")
    assert np.__tablename__ == "notification_preferences"

    nt = notif_models.NotificationTemplate(org_id=uuid4(), template_code="PR_APP", channel=notif_models.NotificationChannelEnum.EMAIL, body_template="Body")
    assert nt.__tablename__ == "notification_templates"

    ct = notif_models.CommunicationThread(org_id=uuid4(), entity_type="RFQ", entity_id=uuid4(), subject="Thread")
    assert ct.__tablename__ == "communication_threads"

    cm = notif_models.CommunicationMessage(org_id=uuid4(), thread_id=uuid4(), sender_id=uuid4(), message="Msg")
    assert cm.__tablename__ == "communication_messages"

    audit = audit_models.AuditLog(
        org_id=uuid4(), entity_type=audit_models.AuditEntityTypeEnum.PURCHASE_ORDER,
        entity_id=uuid4(), action="CREATE"
    )
    assert audit.__tablename__ == "audit_logs"

    outbox = int_models.OutboxMessage(org_id=uuid4(), exchange="ex", routing_key="rk", payload={"k": "v"})
    assert outbox.__tablename__ == "outbox_messages"

    job = int_models.IntegrationJob(org_id=uuid4(), job_type="ERP_SYNC", entity_type="PO", entity_id=uuid4(), direction="OUTBOUND", adapter_type="SAP")
    assert job.__tablename__ == "integration_jobs"

    ff = int_models.FeatureFlag(org_id=uuid4(), flag_key="ENABLE_AI", flag_value=True)
    assert ff.__tablename__ == "feature_flags"

    ts = int_models.TenantSetting(org_id=uuid4(), setting_key="DEFAULT_TIMEOUT", setting_value={"sec": 30})
    assert ts.__tablename__ == "tenant_settings"

    sjr = int_models.ScheduledJobRun(job_name="daily_cleanup")
    assert sjr.__tablename__ == "scheduled_job_runs"
