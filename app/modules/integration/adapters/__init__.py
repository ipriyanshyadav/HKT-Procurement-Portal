"""
Integration Adapters Module.
Provides pluggable ERP adapters, HRMS consumer, GST, GEM, and tax verification connectors.
"""
from .erp_base import ERPAdapterBase, ERPAdapterFactory
from .erp_sap import SAPAdapter
from .erp_oracle import OracleAdapter
from .erp_custom import CustomERPAdapter
from .erp_vendor import ERPVendorAdapter
from .erp_po import ERPPOAdapter
from .erp_invoice import ERPInvoiceAdapter
from .erp_payment import ERPPaymentAdapter
from .erp_material import ERPMaterialAdapter
from .hrms import HRMSConsumer, hrms_consumer
from .gst import GSTAdapter
from .gem import GEMAdapter, gem_adapter

# Legacy / root adapters
try:
    from integration.adapters.pan import PANAdapter
    from integration.adapters.bank import BankVerificationAdapter
except ImportError:
    PANAdapter = None  # type: ignore
    BankVerificationAdapter = None  # type: ignore

__all__ = [
    "ERPAdapterBase",
    "ERPAdapterFactory",
    "SAPAdapter",
    "OracleAdapter",
    "CustomERPAdapter",
    "ERPVendorAdapter",
    "ERPPOAdapter",
    "ERPInvoiceAdapter",
    "ERPPaymentAdapter",
    "ERPMaterialAdapter",
    "HRMSConsumer",
    "hrms_consumer",
    "GSTAdapter",
    "GEMAdapter",
    "gem_adapter",
    "PANAdapter",
    "BankVerificationAdapter",
]
