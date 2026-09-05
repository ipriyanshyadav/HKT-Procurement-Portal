from __future__ import annotations
from tests.factories.organization import (
    OrganizationFactory,
    LegalEntityFactory,
    BusinessUnitFactory,
    PlantFactory,
    CostCenterFactory,
    DepartmentFactory,
    DeliveryLocationFactory,
)
from tests.factories.user import UserFactory, RoleFactory, UserRoleAssignmentFactory
from tests.factories.master_data import (
    CategoryFactory,
    UOMFactory,
    CurrencyFactory,
    PaymentTermFactory,
    TaxCodeFactory,
    IncotermFactory,
)
from tests.factories.vendor import VendorFactory, VendorContactFactory, VendorBankFactory
from tests.factories.requisition import RequisitionFactory, RequisitionLineFactory
from tests.factories.rfq import RfqFactory, RfqLineFactory, RfqParticipantFactory
from tests.factories.bid import BidFactory, BidLineFactory
from tests.factories.purchase_order import (
    PurchaseOrderFactory,
    POLineFactory,
    GRNFactory,
    GrnLineFactory,
)
from tests.factories.invoice import InvoiceFactory, InvoiceLineFactory, PaymentFactory
from tests.factories.contract import ContractFactory, ContractTemplateFactory
from tests.factories.workflow import (
    WorkflowTemplateFactory,
    WorkflowInstanceFactory,
    WorkflowTaskFactory,
    ApprovalGroupFactory,
)


class FactoryBundle:
    """Unified access to all model factories without hardcoded data."""
    organization = OrganizationFactory
    legal_entity = LegalEntityFactory
    business_unit = BusinessUnitFactory
    plant = PlantFactory
    cost_center = CostCenterFactory
    department = DepartmentFactory
    delivery_location = DeliveryLocationFactory
    user = UserFactory
    role = RoleFactory
    user_role = UserRoleAssignmentFactory
    category = CategoryFactory
    uom = UOMFactory
    currency = CurrencyFactory
    payment_term = PaymentTermFactory
    tax_code = TaxCodeFactory
    incoterm = IncotermFactory
    vendor = VendorFactory
    vendor_contact = VendorContactFactory
    vendor_bank = VendorBankFactory
    requisition = RequisitionFactory
    requisition_line = RequisitionLineFactory
    rfq = RfqFactory
    rfq_line = RfqLineFactory
    rfq_participant = RfqParticipantFactory
    bid = BidFactory
    bid_line = BidLineFactory
    purchase_order = PurchaseOrderFactory
    po_line = POLineFactory
    grn = GRNFactory
    grn_line = GrnLineFactory
    invoice = InvoiceFactory
    invoice_line = InvoiceLineFactory
    payment = PaymentFactory
    contract = ContractFactory
    contract_template = ContractTemplateFactory
    workflow_template = WorkflowTemplateFactory
    workflow_instance = WorkflowInstanceFactory
    workflow_task = WorkflowTaskFactory
    approval_group = ApprovalGroupFactory


__all__ = [
    "FactoryBundle",
    "OrganizationFactory",
    "LegalEntityFactory",
    "BusinessUnitFactory",
    "PlantFactory",
    "CostCenterFactory",
    "DepartmentFactory",
    "DeliveryLocationFactory",
    "UserFactory",
    "RoleFactory",
    "UserRoleAssignmentFactory",
    "CategoryFactory",
    "UOMFactory",
    "CurrencyFactory",
    "PaymentTermFactory",
    "TaxCodeFactory",
    "IncotermFactory",
    "VendorFactory",
    "VendorContactFactory",
    "VendorBankFactory",
    "RequisitionFactory",
    "RequisitionLineFactory",
    "RfqFactory",
    "RfqLineFactory",
    "RfqParticipantFactory",
    "BidFactory",
    "BidLineFactory",
    "PurchaseOrderFactory",
    "POLineFactory",
    "GRNFactory",
    "GrnLineFactory",
    "InvoiceFactory",
    "InvoiceLineFactory",
    "PaymentFactory",
    "ContractFactory",
    "ContractTemplateFactory",
    "WorkflowTemplateFactory",
    "WorkflowInstanceFactory",
    "WorkflowTaskFactory",
    "ApprovalGroupFactory",
]
